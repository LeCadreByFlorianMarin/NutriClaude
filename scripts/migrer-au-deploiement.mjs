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
 *                            construction, donc Vercel ne promeut rien : le
 *                            schéma ET le code restent intacts.
 *
 * Le second est le seul où « ça a échoué » veut dire « rien n'a bougé ».
 *
 * Il reste une fenêtre de quelques secondes, entre l'application des migrations
 * et la mise en ligne du nouveau code, où le schéma est en avance sur le code
 * servi. C'est sans conséquence **parce que les migrations sont strictement
 * additives** (AR-MIGRATIONS) : du code qui ignore une colonne neuve fonctionne,
 * l'inverse non. Cette discipline n'était qu'une bonne manière ; elle devient
 * ici la condition de sûreté du déploiement.
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
      "  Voir docs/migrations.md § « Le déploiement applique les migrations »."
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
const resultat = spawnSync(
  "npx",
  ["--yes", `supabase@${VERSION_CLI}`, "db", "push", "--db-url", urlBase, "--yes"],
  { stdio: "inherit" }
);

if (resultat.error) {
  console.error("[migrations] la CLI Supabase n'a pas pu être lancée :", resultat.error.message);
  process.exit(1);
}

if (resultat.status !== 0) {
  console.error(
    `[migrations] échec (code ${resultat.status}). Le déploiement est interrompu :\n` +
      "  ni le schéma ni le code servi n'ont changé."
  );
  process.exit(resultat.status ?? 1);
}

console.log("[migrations] appliquées.");
