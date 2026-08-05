import Link from "next/link";
import { requireProfile } from "@/app/_lib/garde";
import { createServerComponentClient } from "@/lib/supabase/server";
import {
  casesDeLaSemaine,
  cleDeCase,
  grouperParCase,
  REPAS,
  type CaseDeMenu,
} from "@/lib/menu/menu";
import {
  aujourdhuiAParis,
  estJourISO,
  formaterJourLong,
  formaterPlageDeSemaine,
  joursDeLaSemaine,
  lundiDeLaSemaine,
  semaineVoisine,
  type JourISO,
} from "@/lib/menu/semaine";

export const metadata = { title: "Mon menu · NutriClaude" };

/**
 * Une case de la grille : un jour, un repas, et ce qui y est prévu.
 *
 * ⚠️ **`entrees` est une LISTE, et la contrainte d'AD-6 ne change PAS ça.**
 * `meal_plan_entries_assignation_unique` (`20260804144217`) interdit la même
 * recette deux fois au même repas ; elle laisse « Soir : gratin + salade », qui
 * est un menu normal. N'en afficher qu'une le rendrait faux en silence, alors que
 * la génération de liste de l'Epic 4 comptera les deux.
 *
 * ⚠️ **DEUX AFFORDANCES PAR CASE, ET ELLES NE S'IMBRIQUENT PAS.** Le titre mène à
 * la recette, le pied de case mène à l'assignation. Poser un `<Link>` sur toute la
 * case avalerait le clic du titre, et un `<Link>` dans un `<button>` serait un DOM
 * invalide. Les deux portent `min-h-touch` — une cible née sous 44px serait un
 * défaut d'accessibilité introduit par cette story (UX-DR11).
 */
function Case({
  jour,
  repas,
  entrees,
}: {
  jour: JourISO;
  repas: (typeof REPAS)[number];
  entrees: CaseDeMenu[];
}) {
  /*
   * ⚠️ **Le libellé se dérive de `repas`, il ne se passe plus en second paramètre.**
   * Depuis que la case reçoit l'objet `REPAS` entier (pour son `slug`), un paramètre
   * `libelle` était une seconde voie par laquelle un nom de repas pouvait entrer —
   * dans un composant dont `REPAS` proclame être « le seul endroit qui nomme les
   * repas ». Câblage mort relevé par la revue du 2026-08-05.
   */
  const libelle = repas.libelle;

  /*
   * ⚠️ **Le nom accessible NOMME sa case, et c'est une correction de revue.** Sans
   * lui, la grille présente 28 liens intitulés « Mettre une recette » ou « Modifier »,
   * indiscernables au rotor d'un lecteur d'écran ou en navigation par liens : le jour
   * vit dans un `<h2>` et le repas dans un `<p>`, tous deux frères du lien et non
   * associés à lui. Le défaut est né avec cette story — l'état vide était auparavant un
   * `<p>` non interactif.
   */
  const situe = `${formaterJourLong(jour)}, ${libelle.toLowerCase()}`;
  /*
   * La destination que la story 3.5 avait dessinée sans pouvoir la donner. Son
   * `min-h-touch` avait été posé d'avance pour ce moment : rien n'a été jeté.
   *
   * ⚠️ **L'URL parle français** — `/menu/2026-08-04/midi`, jamais `lunch`. Le
   * jeton anglais est un détail de schéma ; une adresse se lit et se partage.
   */
  const destination = `/menu/${jour}/${repas.slug}`;

  return (
    <div className="min-h-touch rounded-md border border-card-border bg-surface-card p-card">
      <p className="text-eyebrow text-muted uppercase">{libelle}</p>

      {entrees.length === 0 ? (
        /*
          ⚠️ **LA MOITIÉ D'AC4 QUE LA STORY 3.5 AVAIT LAISSÉE OUVERTE SE FERME
          ICI.** Ses cases vides étaient « lisibles » mais pas « directement
          actionnables », faute de destination — décision datée de Florian du
          2026-08-04, option (a), consignée dans `deferred-work.md` pour être
          ROUVERTE et non supposée close (règle §5).

          L'objection qui avait fait écarter l'affordance à l'époque — « elle
          mènerait à un 404 en attendant » — tombe : c'est cette story qui
          construit la destination. Ce n'est donc plus la « zone ambiguë » que la
          seconde moitié du même critère interdit ; c'est un lien qui mène
          quelque part.
        */
        <Link
          href={destination}
          aria-label={`Mettre une recette — ${situe}`}
          className="hint mt-1 flex min-h-touch items-center underline underline-offset-4"
        >
          Mettre une recette
        </Link>
      ) : (
        <>
          <ul className="mt-1">
            {entrees.map((entree) => (
              <li key={entree.id}>
                {/*
                  La destination existe depuis la story 3.3 et n'est pas à
                  inventer.
                */}
                <Link
                  href={`/recettes/${entree.recetteId}`}
                  className="flex min-h-touch items-center text-base break-words underline underline-offset-4"
                >
                  {entree.recetteTitre}
                </Link>
                {/*
                  ⚠️ **AC4 : « chaque case montre la recette assignée ET SON
                  NOMBRE DE PERSONNES ».** `servings` était lu depuis la story
                  3.5 et n'était affiché nulle part.

                  ⚠️ **« pers. » et non « portions ».** Trois nombres de personnes
                  coexistent désormais dans le produit, et deux s'appellent
                  `servings` en base : ce pour quoi la RECETTE est écrite
                  (`recipes.servings`, le dénominateur de la mise à l'échelle), ce
                  qu'on PRÉVOIT ici (le numérateur), et ce que le foyer règle par
                  défaut. C'est leur rapport que l'Epic 4 calcule — leur donner le
                  même mot rendrait le produit incompréhensible au premier
                  ajustement.

                  `tabular-nums` (UX-DR12) : sans lui la grille tremble d'une
                  colonne à l'autre.
                */}
                <p className="hint tabular-nums">{entree.personnes} pers.</p>
              </li>
            ))}
          </ul>

          <Link
            href={destination}
            aria-label={`Modifier — ${situe}`}
            className="hint mt-2 flex min-h-touch items-center underline underline-offset-4"
          >
            Modifier
          </Link>
        </>
      )}
    </div>
  );
}

/**
 * La grille du menu de la semaine : sept jours × quatre repas.
 *
 * ⚠️ **Aucun `"use client"`, aucun `useState`.** La semaine vit dans l'URL, pas
 * dans un état React — et ça règle trois choses gratuitement : le rechargement
 * garde la semaine, le bouton Retour du navigateur fait la navigation entre
 * semaines sans qu'on l'écrive, et l'écran reste un rendu serveur pur (AD-13 :
 * pas de client sans cause).
 *
 * ⚠️ **CET ÉCRAN N'ÉCRIT TOUJOURS RIEN, ET C'EST UN CHOIX DE LA STORY 3.6, PAS UN
 * RESTE DE LA 3.5.** L'assignation vit sur `/menu/[jour]/[repas]` : un `<select>`
 * de recettes prend l'intrinsèque de sa plus longue option — jusqu'à 80
 * caractères — et le poser dans une piste à 1/7 de largeur ferait déborder la page
 * en largeur, ce que l'AC2 de la story 3.5 interdit. Le sortir de la grille
 * supprime le risque à la source au lieu de le contenir par des classes.
 * **Si un `useSoumission`, un `Notice` ou une région de statut apparaît ici, c'est
 * que le formulaire a glissé dans la grille.**
 *
 * ⚠️ **UN SEUL DOM, à toutes les largeurs (AC2/NFR-3/UX-DR10).** La maquette
 * `mockups/grille-menu.html` rend deux structures et en masque une par media
 * query ; ici sept sections « jour » se replient de sept colonnes à une seule
 * colonne empilée. Deux structures, ce serait deux fois le contenu à maintenir,
 * deux fois les cases à câbler en 3.6, et une copie masquée que traverserait un
 * lecteur d'écran le jour où le masquage bouge.
 *
 * ⚠️ **Pas de `<table>`**, pour la même raison : un tableau ne se replie pas en
 * colonne unique sans mentir sur sa structure, et l'AC2 est précisément un
 * critère de repli. D'où aussi le nom du repas écrit DANS chaque case plutôt
 * qu'en étiquette de ligne : l'étiquette de marge disparaît à l'empilement, et
 * c'est ce qui oblige la maquette à réécrire « Midi · … » dans sa version mobile.
 *
 * ⚠️ **`subgrid` n'est pas décoratif.** Sans lui, une case portant un titre long
 * grandit et décale toute sa colonne : les quatre lignes de repas ne s'alignent
 * plus d'un jour à l'autre, et la grille cesse d'être une grille. Les cinq
 * pistes (l'en-tête du jour + les quatre repas) sont définies par le conteneur et
 * héritées par chaque section.
 */
export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string | string[] }>;
}) {
  const { semaine } = await searchParams;

  /*
   * ⚠️ **Un seul appel, et sa valeur circule.** Rappeler `aujourdhuiAParis()`
   * plus bas rouvrirait une course à minuit : deux réponses différentes dans le
   * même rendu, et un jour marqué « aujourd'hui » dans une semaine qui ne le
   * contient pas.
   */
  const aujourdhui = aujourdhuiAParis();
  const semaineCourante = lundiDeLaSemaine(aujourdhui);

  /*
   * ⚠️ **`?semaine=` est une SAISIE**, au même titre qu'un champ — elle arrive de
   * l'URL, donc de n'importe où. `?semaine=lol`, `?semaine=2026-13-45`,
   * `?semaine=` vide ou répété retombent tous sur la semaine courante, sans
   * message d'erreur : un paramètre d'URL illisible n'est pas une panne.
   *
   * Le paramètre RÉPÉTÉ arrive en tableau, et il est traité comme invalide plutôt
   * que résolu au premier : deux semaines demandées à la fois n'ont pas de bonne
   * réponse, et en choisir une serait deviner.
   *
   * Et le résultat est NORMALISÉ : `?semaine=2026-08-06` (un jeudi) désigne bien
   * une semaine, celle de son lundi.
   */
  const demandee = typeof semaine === "string" ? semaine : undefined;
  const lundi: JourISO = estJourISO(demandee)
    ? lundiDeLaSemaine(demandee)
    : semaineCourante;

  await requireProfile();
  const supabase = await createServerComponentClient();
  const cases = await casesDeLaSemaine(supabase, lundi);

  const parCase = grouperParCase(cases);
  const jours = joursDeLaSemaine(lundi);

  return (
    <main className="flex-1 p-6">
      <div className="mx-auto w-full max-w-5xl py-6">
        {/* « Retour » sans destination nommée : cet écran est de premier niveau,
            comme `/rayons` et `/recettes`, et n'a qu'un parent possible. Voir la
            justification portée par `app/recettes/page.tsx`. */}
        <Link href="/" className="btn-quiet px-0">
          ← Retour
        </Link>

        <h1 className="titre-ecran mt-2">Mon menu</h1>
        <p className="hint mt-1 tabular-nums">{formaterPlageDeSemaine(lundi)}</p>

        <nav
          aria-label="Navigation entre les semaines"
          className="mt-6 flex flex-wrap items-center gap-2"
        >
          <Link href={`/menu?semaine=${semaineVoisine(lundi, -1)}`} className="btn">
            ← La semaine d&apos;avant
          </Link>
          <Link href={`/menu?semaine=${semaineVoisine(lundi, 1)}`} className="btn">
            La semaine d&apos;après →
          </Link>
          {/* Sans paramètre, `/menu` EST la semaine courante — le même chemin que
              le repli d'une saisie invalide. Un seul chemin, pas deux. */}
          {lundi !== semaineCourante ? (
            <Link href="/menu" className="btn-quiet">
              Cette semaine
            </Link>
          ) : null}
        </nav>

        {cases.length === 0 ? (
          <p className="mt-6 text-base">
            Tu n&apos;as encore rien prévu cette semaine.
          </p>
        ) : null}

        <div className="mt-8 grid gap-gutter lg:grid-cols-7 lg:grid-rows-[repeat(5,auto)]">
          {jours.map((jour) => {
            const estAujourdhui = jour === aujourdhui;
            return (
              <section
                key={jour}
                className="grid gap-2 lg:row-span-5 lg:grid-rows-subgrid"
              >
                {/*
                  ⚠️ **« aujourd'hui » se dit EN TOUTES LETTRES, et pas seulement
                  par une couleur** — un état porté par la seule couleur est banni
                  du produit (UX-DR5), et l'abricot est de toute façon réservé à
                  l'action courses (UX-DR2) : le marquer en abricot comme le fait
                  la maquette serait décoratif, donc interdit.
                */}
                <h2 className="text-eyebrow flex items-end uppercase">
                  <span className={estAujourdhui ? "text-text" : "text-muted"}>
                    {formaterJourLong(jour)}
                    {estAujourdhui ? " — aujourd'hui" : ""}
                  </span>
                </h2>

                {REPAS.map((repas) => (
                  <Case
                    key={repas.code}
                    jour={jour}
                    repas={repas}
                    entrees={parCase.get(cleDeCase(jour, repas.code)) ?? []}
                  />
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
