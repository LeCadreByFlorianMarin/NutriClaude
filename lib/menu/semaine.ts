/**
 * Le calendaire de la grille du menu : quelle semaine, quels jours, comment on
 * les nomme en français.
 *
 * **Pourquoi un module, et pas trois expressions dans le JSX.** Tout ce qui suit
 * est pur, donc testable — et c'est là que vivent les deux défauts qui décalent
 * un jour sans que rien ne le signale (le fuseau à la construction, le fuseau du
 * serveur). Le JSX, lui, n'est couvert par rien : NFR-10 interdit le harnais de
 * composants. Même partage que `lib/recettes/lecture.ts`.
 *
 * ⚠️ **UNE SEULE RÈGLE, ET ELLE N'A PAS D'EXCEPTION ICI : une date est une
 * CHAÎNE `"AAAA-MM-JJ"`.** `meal_date` est un `date` Postgres — pas d'heure, pas
 * de fuseau. Tout calcul se fait en UTC (`Date.UTC`, `getUTC*`), tout formatage
 * avec `timeZone: "UTC"`. Le seul endroit qui connaît `Europe/Paris` est
 * `aujourdhuiAParis`, et c'est exactement là que le fuseau a du sens : « quel
 * jour est-on » est la seule question de ce fichier dont la réponse dépend d'où
 * l'on se tient.
 */

/** Une date civile, sans heure ni fuseau. Le format de `meal_date`. */
export type JourISO = string;

/**
 * La locale, écrite en dur et pas déduite — même raison que `LOCALE` dans
 * `lib/recettes/lecture.ts` : sans argument, `Intl` suit la locale du NAVIGATEUR,
 * et un membre dont le système est en anglais lirait « Monday ». Le produit est
 * en français par NFR-8, pas par coïncidence de configuration.
 */
const LOCALE = "fr-FR";

/**
 * Le fuseau du foyer. Écrit en dur pour la même raison que la locale : déduire le
 * fuseau du serveur donnerait UTC en production et `Europe/Paris` sur le poste,
 * c'est-à-dire un défaut invisible partout où on peut le chercher.
 */
const FUSEAU = "Europe/Paris";

const MOTIF_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** `"AAAA-MM-JJ"` → l'instant UTC de minuit ce jour-là. */
function enDate(jour: JourISO): Date {
  const [annee, mois, quantieme] = jour.split("-").map(Number);
  return new Date(Date.UTC(annee, mois - 1, quantieme));
}

/** L'inverse. `toISOString` est sûr ici : la date a été construite en UTC. */
function enJour(date: Date): JourISO {
  return date.toISOString().slice(0, 10);
}

/** « lundi » → « Lundi ». `Intl` rend les jours et les mois en minuscules. */
function capitaliser(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * Vrai si la valeur est une date civile qui EXISTE.
 *
 * ⚠️ **Le contrôle de forme ne suffit pas, et c'est tout l'intérêt de cette
 * fonction.** `Date.UTC` ne lève jamais sur une date impossible — il DÉBORDE :
 * `Date.UTC(2026, 12, 45)` vaut le 14 février 2027 (mesuré). Une garde écrite
 * avec `Number.isNaN` laisserait donc passer « le 45 janvier » et la grille
 * afficherait tranquillement une autre semaine que celle demandée.
 *
 * La validation se fait donc par **aller-retour** : on reconstruit la chaîne
 * depuis la date obtenue et on exige l'égalité. Ça attrape d'un coup le mois 13,
 * le 30 février, le 29 février d'une année non bissextile — et aussi le piège des
 * années à deux chiffres, `Date.UTC(99, 0, 1)` valant 1999.
 *
 * Même rôle qu'`estUuid` dans `lib/recettes/saisie.ts` : une garde de forme qui
 * évite un aller-retour réseau et une erreur que rien ne traduirait.
 */
export function estJourISO(valeur: string | null | undefined): valeur is JourISO {
  if (typeof valeur !== "string" || !MOTIF_JOUR.test(valeur)) return false;
  const date = enDate(valeur);
  return !Number.isNaN(date.getTime()) && enJour(date) === valeur;
}

/**
 * Le lundi de la semaine qui contient ce jour. La semaine du produit est celle
 * de l'ISO 8601 : lundi → dimanche.
 *
 * ⚠️ **`getUTCDay()` rend `0` pour DIMANCHE, pas pour lundi.** Sans le décalage
 * `(jour + 6) % 7`, un dimanche renverrait le lundi de la semaine SUIVANTE — et
 * la grille afficherait la mauvaise semaine un jour sur sept, celui-là même où
 * l'on planifie la semaine à venir.
 */
export function lundiDeLaSemaine(jour: JourISO): JourISO {
  const date = enDate(jour);
  const depuisLundi = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - depuisLundi);
  return enJour(date);
}

/** Les sept jours d'une semaine, du lundi au dimanche. */
export function joursDeLaSemaine(lundi: JourISO): JourISO[] {
  const debut = enDate(lundi);
  return Array.from({ length: 7 }, (_, rang) => {
    const jour = new Date(debut);
    jour.setUTCDate(debut.getUTCDate() + rang);
    return enJour(jour);
  });
}

/**
 * Le lundi d'à côté.
 *
 * ⚠️ **Sept jours en UTC, jamais en heure locale.** Les semaines de changement
 * d'heure ne durent pas 168 heures locales : un calcul par accesseurs locaux
 * renverrait un dimanche fin mars et un mardi fin octobre. En UTC, la question ne
 * se pose pas — c'est pourquoi tout ce fichier y reste.
 */
export function semaineVoisine(lundi: JourISO, pas: -1 | 1): JourISO {
  const date = enDate(lundi);
  date.setUTCDate(date.getUTCDate() + pas * 7);
  return enJour(date);
}

/**
 * Le jour courant **à Paris**.
 *
 * ⚠️ **C'est la seule fonction de ce fichier qui connaisse un fuseau, et le
 * défaut qu'elle empêche n'arrive qu'en production.** L'écran est rendu côté
 * serveur ; le poste et la CI tournent en `Europe/Paris`, Vercel exécute en UTC.
 * Entre minuit et 2 h heure française, le serveur est encore la veille : la
 * grille ouvrirait sur la semaine précédente et marquerait le mauvais jour
 * « aujourd'hui », sans qu'aucune porte automatique ni aucun essai local ne
 * puisse le voir.
 *
 * `fr-CA` n'est pas une astuce : c'est la locale qui rend nativement l'ordre
 * `AAAA-MM-JJ`, ce qui évite de recomposer la chaîne à la main depuis
 * `formatToParts`.
 *
 * L'instant est un **paramètre** — c'est ce qui rend le défaut ci-dessus
 * testable ; sans lui, le test ne pourrait mesurer que le fuseau de la machine
 * qui l'exécute, c'est-à-dire rien.
 */
export function aujourdhuiAParis(maintenant: Date = new Date()): JourISO {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(maintenant);
}

/** « Lundi 3 août » — l'en-tête d'une colonne de jour. */
export function formaterJourLong(jour: JourISO): string {
  return capitaliser(
    new Intl.DateTimeFormat(LOCALE, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(enDate(jour))
  );
}

/** « Lun. » — la forme courte, quand la place manque. */
export function formaterJourCourt(jour: JourISO): string {
  return capitaliser(
    new Intl.DateTimeFormat(LOCALE, {
      weekday: "short",
      timeZone: "UTC",
    }).format(enDate(jour))
  );
}

/**
 * « Du 3 au 9 août » — la semaine, telle qu'on la dit.
 *
 * Trois formes, et le choix est délibéré : le mois n'est répété que s'il change,
 * et **l'année n'apparaît que si la semaine est à cheval sur deux années**. « Du
 * 28 décembre au 3 janvier » est ambigu, et c'est précisément la semaine qu'on
 * consulte le plus tard dans l'année ; partout ailleurs l'année est du bruit sur
 * un écran qu'on ouvre pour la semaine en cours.
 *
 * ⚠️ La fonction reste **pure** — elle ne compare pas à « aujourd'hui ». Une
 * règle du genre « l'année si ce n'est pas l'année courante » se lirait mieux et
 * rendrait ce fichier intestable.
 */
export function formaterPlageDeSemaine(lundi: JourISO): string {
  const jours = joursDeLaSemaine(lundi);
  const debut = enDate(jours[0]);
  const fin = enDate(jours[6]);

  const memeAnnee = debut.getUTCFullYear() === fin.getUTCFullYear();
  const memeMois = memeAnnee && debut.getUTCMonth() === fin.getUTCMonth();

  const quantieme = (date: Date) =>
    new Intl.DateTimeFormat(LOCALE, { day: "numeric", timeZone: "UTC" }).format(date);

  const quantiemeEtMois = (date: Date) =>
    new Intl.DateTimeFormat(LOCALE, {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(date);

  const quantiemeMoisAnnee = (date: Date) =>
    new Intl.DateTimeFormat(LOCALE, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);

  if (memeMois) return `Du ${quantieme(debut)} au ${quantiemeEtMois(fin)}`;
  if (memeAnnee) return `Du ${quantiemeEtMois(debut)} au ${quantiemeEtMois(fin)}`;
  return `Du ${quantiemeMoisAnnee(debut)} au ${quantiemeMoisAnnee(fin)}`;
}
