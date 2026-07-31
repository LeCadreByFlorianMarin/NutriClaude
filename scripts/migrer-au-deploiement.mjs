#!/usr/bin/env node
/**
 * Applique les migrations en attente sur la base de production, depuis le
 * déploiement Vercel.
 *
 * Décision de Florian, 2026-07-29 : plus aucune migration poussée à la main.
 * Le déploiement est le seul chemin vers la production ; en local, on ne joue
 * que sur le stack `supabase start`.
 *
 * ── POURQUOI CE SCRIPT S'EXÉCUTE *APRÈS* `next build` ──────────────────────
 *
 * L'ordre n'est pas arbitraire. Les deux enchaînements possibles n'ont pas le
 * même mode de défaillance :
 *
 *   migrer puis construire → une construction cassée laisse le schéma en avance
 *                            sur du code qui ne partira jamais.
 *   construire puis migrer → une migration refusée fait échouer la commande de
 *                            construction, donc Vercel ne promeut pas le code.
 *
 * Le second est le moins mauvais, mais **il ne garantit pas « rien n'a bougé »**,
 * et ce fichier l'a affirmé à tort jusqu'à la revue du 2026-07-29.
 *
 * ⚠️ `supabase db push` **n'est pas atomique sur un lot.** Il applique les
 * fichiers un par un et enregistre chacun dans `supabase_migrations` au fur et
 * à mesure ; il n'y a pas de transaction enveloppante. Sur un lot de deux
 * migrations dont la seconde échoue, la première est appliquée ET enregistrée,
 * le code n'est pas promu, et l'on se retrouve exactement dans l'état que
 * l'enchaînement était censé rendre impossible : schéma en avance, code d'avant
 * servi. Ne pas se fier au message d'échec pour conclure que rien n'a changé —
 * lire la sortie de la CLI, qui nomme les fichiers effectivement appliqués.
 *
 * Ce qui rend cet état supportable, ici comme dans la fenêtre de quelques
 * secondes entre l'application et la mise en ligne, c'est que **les migrations
 * sont strictement additives** (AR-MIGRATIONS) : du code qui ignore une colonne
 * neuve fonctionne, l'inverse non. Cette discipline n'était qu'une bonne
 * manière ; elle est la condition de sûreté de tout ce fichier.
 *
 * ── CE QUE CE SCRIPT NE FAIT JAMAIS ────────────────────────────────────────
 *
 * Il ne touche à rien hors d'un déploiement de **production**. Les
 * prévisualisations partagent la base de production — il n'existe qu'un seul
 * projet Supabase — donc y appliquer les migrations d'une branche non fusionnée
 * écrirait dans la production depuis du code non revu.
 *
 * Il n'y a pas de migration descendante : ce script applique, il ne revient
 * jamais en arrière. Une restauration Vercel remet le code d'avant, pas le
 * schéma. C'est encore l'additivité qui rend l'opération sûre.
 */

import { spawnSync } from "node:child_process";

/**
 * Version épinglée de la CLI Supabase.
 *
 * Épinglée **ici** plutôt qu'en dépendance de développement : la CLI télécharge
 * un binaire à l'installation, et l'ajouter à `package.json` ferait payer ce
 * téléchargement à chaque `npm ci` de la CI, pour un outil dont seuls le
 * déploiement et le poste de Florian ont besoin (NFR-10).
 *
 * ⚠️ Un `npx supabase` sans version résout la dernière publiée : la production
 * serait migrée par une CLI que personne n'a choisie. Monter ce numéro est un
 * commit délibéré.
 */
const VERSION_CLI = "2.110.0";

const environnement = process.env.VERCEL_ENV;
const branche = process.env.VERCEL_GIT_COMMIT_REF;

/** La branche dont le contenu a été revu et fusionné. */
const BRANCHE_DE_PRODUCTION = "main";

/*
 * Hors production, on ne fait rien — et on le dit. `VERCEL_ENV` vaut
 * « production », « preview » ou « development » sur Vercel, et est absente en
 * local : `npm run build` sur le poste ne parle donc jamais à la production.
 */
if (environnement !== "production") {
  console.log(
    `[migrations] environnement « ${environnement ?? "local"} » — ` +
      "aucune migration appliquée. Seul un déploiement de production le fait."
  );
  process.exit(0);
}

/*
 * ⚠️ **`VERCEL_ENV === "production"` ne veut PAS dire « branche `main` ».**
 * Un `vercel --prod` lancé depuis n'importe quelle branche produit un
 * déploiement de production, et appliquerait donc les migrations d'un code que
 * personne n'a revu — exactement ce que l'en-tête de ce fichier promet
 * d'empêcher, et qu'il n'empêchait pas (revue du 2026-07-29).
 *
 * La branche est laissée passer si Vercel ne la renseigne pas : c'est le cas
 * d'un déploiement sans intégration Git, où il n'y a rien à comparer. Refuser
 * là rendrait le mécanisme inutilisable pour un redéploiement légitime.
 */
if (branche && branche !== BRANCHE_DE_PRODUCTION) {
  console.error(
    `[migrations] déploiement de production depuis « ${branche} », ` +
      `pas « ${BRANCHE_DE_PRODUCTION} ».\n` +
      "  Les migrations ne sont appliquées que depuis la branche fusionnée et revue.\n" +
      "  Voir docs/migrations.md § « En production »."
  );
  process.exit(1);
}

const urlBase = process.env.SUPABASE_DB_URL;

/*
 * ⚠️ Absence de la variable = ÉCHEC, jamais un saut silencieux.
 *
 * C'est le point le plus important du fichier. Un script qui se contenterait de
 * passer son tour quand la configuration manque produirait exactement la classe
 * de défaut que ce dépôt a déjà rencontrée trois fois : un contrôle qui rend
 * « vert » en n'ayant rien fait. Le déploiement partirait, les migrations
 * resteraient en arrière, et le code toucherait un schéma qui n'existe pas —
 * sans qu'aucun signal ne l'annonce.
 */
if (!urlBase) {
  console.error(
    "[migrations] SUPABASE_DB_URL est absente du déploiement de production.\n" +
      "  Sans elle, les migrations ne peuvent pas être appliquées, et laisser\n" +
      "  passer le déploiement livrerait du code en avance sur son schéma.\n" +
      "  Voir docs/migrations.md § « En production »."
  );
  process.exit(1);
}

/*
 * ⚠️ **Contrôle de forme de l'URL, parce qu'un commentaire ne contrôle rien.**
 * Le pooler de TRANSACTION (port 6543) ne tient pas les instructions de
 * définition de schéma : `db push` y échoue sur une erreur pgbouncer opaque,
 * et 6543 est le port que l'interface Supabase affiche en premier.
 *
 * ⚠️ **On analyse l'URL, on ne la filtre pas par expression rationnelle.** La
 * première rédaction employait `/:6543(\/|$|\?)/`, et la seconde passe de revue
 * du 2026-07-29 l'a mesurée fausse **dans les deux sens** : une valeur collée
 * avec un retour à la ligne final (`"…:6543\n"`) passait la garde, `$` sans le
 * drapeau `m` n'acceptant pas de saut de ligne ; et une URL de pooler de
 * session légitime dont le mot de passe contient `:6543/` était refusée,
 * bloquant un déploiement valide. `new URL` connaît la grammaire, pas nous.
 *
 * Le `trim()` n'est pas cosmétique : un secret collé avec un saut de ligne est
 * un cas des plus banals, et la CLI le refuserait plus loin, plus obscurément.
 */
const urlPropre = urlBase.trim();

let url;
try {
  url = new URL(urlPropre);
} catch {
  console.error(
    "[migrations] SUPABASE_DB_URL n'est pas une URL analysable.\n" +
      "  Forme attendue, celle du pooler de session :\n" +
      "  postgresql://postgres.<ref>:<mot-de-passe>@aws-N-<région>.pooler.supabase.com:5432/postgres\n" +
      "  Le mot de passe doit être encodé pour URL s'il contient des caractères spéciaux."
  );
  process.exit(1);
}

if (url.port === "6543") {
  console.error(
    "[migrations] SUPABASE_DB_URL emploie le port 6543 (pooler de transaction).\n" +
      "  Ce pooler ne tient pas les instructions de définition de schéma.\n" +
      "  Employer le pooler de SESSION, port 5432."
  );
  process.exit(1);
}

/*
 * ⚠️ **Le port ne suffit pas à distinguer les deux hôtes, et c'est ce qui a
 * coûté le déploiement du 2026-07-30.**
 *
 * La connexion *directe* (`db.<ref>.supabase.co`) et le pooler de *session*
 * (`aws-N-<région>.pooler.supabase.com`) écoutent **tous les deux sur 5432**.
 * La garde ci-dessus laissait donc passer la première, qui est pourtant
 * structurellement injoignable d'ici : Supabase ne publie plus d'enregistrement
 * A pour l'hôte direct, seulement un AAAA — il est en **IPv6 seulement**, et un
 * conteneur de construction Vercel n'a pas d'IPv6.
 *
 * Le mode de défaillance est particulièrement trompeur : la CLI rend
 * « failed to connect to postgres », et Supabase y accole une invitation à
 * vérifier les restrictions et bannissements réseau. On cherche donc un
 * pare-feu qui n'y est pour rien, pendant que la cause est un enregistrement
 * DNS absent. Ce commentaire existe pour couper court à cette chasse.
 *
 * On refuse le motif **connu-mauvais** plutôt que d'exiger un hôte de pooler :
 * une liste blanche refuserait une base auto-hébergée ou un nommage Supabase à
 * venir, et ce fichier a déjà appris une fois — sur l'expression rationnelle du
 * port, ci-dessus — qu'une garde peut se tromper dans les deux sens.
 */
if (url.hostname.startsWith("db.") && url.hostname.endsWith(".supabase.co")) {
  console.error(
    `[migrations] SUPABASE_DB_URL emploie l'hôte de connexion directe (${url.hostname}).\n` +
      "  Cet hôte est joignable en IPv6 seulement ; un conteneur de construction\n" +
      "  Vercel n'a pas d'IPv6, donc la connexion échouera sur un « failed to\n" +
      "  connect » qui accuse à tort les restrictions réseau.\n" +
      "  Employer le pooler de SESSION : aws-N-<région>.pooler.supabase.com:5432\n" +
      "  ⚠️ Le nom d'utilisateur change aussi : « postgres.<ref> », pas « postgres ».\n" +
      "  Voir docs/migrations.md § « En production »."
  );
  process.exit(1);
}

console.log("[migrations] déploiement de production — application des migrations en attente.");

/*
 * `--db-url` plutôt que `link` + `--linked` : aucun jeton d'accès à l'API
 * Supabase n'est nécessaire, donc **un seul secret** au lieu de deux, et rien
 * n'est écrit dans `supabase/.temp/` pendant la construction.
 *
 * `--yes` parce que la commande demande confirmation par défaut, et qu'une
 * construction n'a pas de clavier.
 *
 * L'URL doit être celle du **pooler de session** (port 5432), pas celle du
 * pooler de transaction (6543) : ce dernier ne tient pas les instructions de
 * définition de schéma. Voir docs/migrations.md.
 */
/*
 * `timeout` : sans lui, un pooler qui accepte la connexion TCP sans jamais
 * répondre bloque le processus de construction jusqu'au plafond de Vercel
 * (45 min), consomme le quota, et échoue sans qu'aucun message de ce fichier
 * ne s'affiche. Dix minutes suffisent très largement à un lot de migrations.
 */
const resultat = spawnSync(
  "npx",
  ["--yes", `supabase@${VERSION_CLI}`, "db", "push", "--db-url", urlPropre, "--yes"],
  { stdio: "inherit", timeout: 10 * 60_000, killSignal: "SIGTERM" }
);

/*
 * ⚠️ **L'interruption AVANT l'échec de lancement, et l'ordre est tout.**
 * À l'expiration du délai, `spawnSync` renseigne **les deux** champs :
 * `signal = SIGTERM` *et* `error.code = ETIMEDOUT`. La première rédaction
 * testait `error` d'abord — elle affichait donc « la CLI n'a pas pu être
 * lancée », faux puisqu'elle avait tourné dix minutes, et surtout
 * l'avertissement ci-dessous, écrit pour ce cas précis, n'était **jamais**
 * imprimé. Mesuré par la seconde passe de revue du 2026-07-29.
 *
 * ⚠️ **`SIGTERM` ne tue que `npx`, pas le `supabase` qu'il a lancé.** Le
 * petit-fils survit au signal : le lot peut donc continuer à s'appliquer
 * *après* que le déploiement a été déclaré en échec. D'où l'avertissement, qui
 * n'est pas une précaution de style.
 */
const interrompu = resultat.signal || resultat.error?.code === "ETIMEDOUT";

if (interrompu) {
  const cause =
    resultat.error?.code === "ETIMEDOUT"
      ? "délai de 10 minutes dépassé"
      : `interrompue par ${resultat.signal}`;
  console.error(
    `[migrations] la CLI Supabase a été interrompue (${cause}).\n` +
      "  Conteneur de construction à court de mémoire, ou base injoignable.\n" +
      "  ⚠️ Une partie du lot a pu être appliquée — et peut même continuer de\n" +
      "     s'appliquer après ce message, le signal ne portant que sur `npx`.\n" +
      "     Lire la sortie ci-dessus, puis `supabase migration list --linked`."
  );
  process.exit(1);
}

if (resultat.error) {
  console.error("[migrations] la CLI Supabase n'a pas pu être lancée :", resultat.error.message);
  process.exit(1);
}

if (resultat.status !== 0) {
  console.error(
    `[migrations] échec (code ${resultat.status}). Le déploiement est interrompu,\n` +
      "  donc le code servi ne change pas.\n" +
      "  ⚠️ Le SCHÉMA, lui, a pu bouger : `db push` applique un lot fichier par\n" +
      "  fichier. Lire la sortie de la CLI ci-dessus pour savoir lesquels sont\n" +
      "  passés avant l'échec. Voir l'en-tête de ce fichier."
  );
  process.exit(resultat.status ?? 1);
}

console.log("[migrations] appliquées.");
