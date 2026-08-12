import Link from "next/link";
import { requireProfile } from "@/app/_lib/garde";
import { ListeCourses } from "./ListeCourses";

export const metadata = { title: "Ma liste · NutriClaude" };

/**
 * L'écran liste — la liste unique du foyer, groupée par rayon, dans l'ordre du
 * parcours magasin (FR-1, FR-2).
 *
 * **Le premier écran du produit à lire depuis le navigateur.** La lecture vit
 * dans `ListeCourses`, qui est un composant client : l'AC1 dit « chargée en
 * client-direct » (AD-13), pas « rafraîchie ». Cette page-ci ne lit rien — elle
 * pose la garde, le titre et l'enveloppe.
 *
 * ⚠️ **« Ma liste », pas « Ta liste ».** La maquette et `EXPERIENCE.md` écrivent
 * « Ta liste » — copie rédigée en juillet, **avant** la décision du 2026-08-02
 * sur les possessifs. Un titre d'écran NOMME une chose du membre : c'est un
 * libellé, donc première personne, comme « Mon foyer », « Mes rayons », « Mes
 * recettes » et « Mon menu ». Ce que l'application *dit* au membre reste au
 * tutoiement — d'où « Ta liste est vide » dans `ListeCourses`, qui est une
 * phrase et non un libellé.
 *
 * ⛔ **L'ENVELOPPE N'EST PAS CELLE DES AUTRES ÉCRANS, ET C'EST LE PIÈGE.** Les
 * cinq écrans existants portent `p-6` (24px). `DESIGN.md` fixe la marge latérale
 * de CET écran à **8px** (`p-screen`) : « l'écran est tenu à une main, chaque
 * pixel de largeur sert le contenu ». `app/recettes/page.tsx` nomme d'ailleurs
 * explicitement l'écran liste comme le seul à porter la contrainte du magasin
 * (NFR-3). **Recopier `p-6` est le réflexe, et il coûte 32px de largeur sur le
 * seul écran où c'est spécifié.** On reprend la structure retour/titre, pas les
 * marges.
 *
 * ⚠️ **`max-w-md` et pas plus.** L'écran est en colonne unique : le laisser
 * s'étaler au grand écran contredirait `EXPERIENCE.md`, qui réserve la
 * respiration au menu et aux recettes.
 */
export default async function CoursesPage() {
  /*
   * ⚠️ **Garde d'EXPÉRIENCE, pas de sécurité.** La RLS est la sécurité, et elle
   * seule : sans profil, `current_household_id()` vaut `NULL` et la vue ne rend
   * rien. Ce que cette ligne apporte, c'est de ne pas montrer une liste vide à
   * qui n'a pas encore de foyer.
   *
   * ⚠️ **`redirect()` LÈVE** : ne jamais l'envelopper dans un `try/catch`.
   */
  await requireProfile();

  return (
    <main className="flex-1 p-screen">
      <div className="mx-auto w-full max-w-md py-6">
        <Link href="/" className="btn-quiet px-0">
          ← Retour
        </Link>

        <h1 className="titre-ecran mt-2">Ma liste</h1>

        {/*
         * Verbatim d'`EXPERIENCE.md` — c'est la phrase qui explique au membre le
         * critère central de la story : l'ordre des cartes est celui de SON
         * magasin, pas un ordre alphabétique.
         */}
        <p className="text-meta mt-1 text-muted">
          Rangée dans l&apos;ordre de ton magasin.
        </p>

        <ListeCourses />
      </div>
    </main>
  );
}
