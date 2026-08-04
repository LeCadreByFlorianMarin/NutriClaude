"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createNavigateurClient } from "@/lib/supabase/client";
import { messageDe } from "@/lib/messages";
import { LIBELLE_OCCUPE } from "@/app/_lib/libelles";
import { Notice } from "@/app/_lib/Notice";
import { useSoumission } from "@/app/_lib/useSoumission";
import { refusRecette } from "@/lib/recettes/erreurs";
import type { Recette } from "@/lib/recettes/recettes";
import { MAX_TITRE, normaliserTitre } from "@/lib/recettes/saisie";

/** Messages en français, sans jargon (NFR-8/NFR-9). */
const MESSAGES = {
  "titre-vide": "Il faut un titre.",
  "portions-invalides": "Il faut au moins une personne.",
  echec: "Ça n'a pas marché. Réessaie dans un instant.",
} as const;

type Cle = keyof typeof MESSAGES;

/**
 * Le répertoire, et la création d'une recette au titre seul.
 *
 * ⚠️ **Écriture client-direct, pas de Server Action** — et le critère est la
 * cause, pas l'analogie de vocabulaire (AD-13) : une écriture passe par une
 * Server Action si elle exige un secret serveur, ou si sa conséquence doit
 * apparaître dans un rendu serveur. Ici, ni l'un ni l'autre. C'est le motif de
 * `DisplayNameForm` et de `ListeRayons`.
 *
 * ⚠️ **Aucune copie locale de la liste.** L'état ne porte que la saisie en
 * cours ; la liste vient des propriétés, et `router.refresh()` la rafraîchit.
 * Une copie locale divergerait dès que l'autre membre du foyer écrit, et il n'y
 * a pas encore de propagation temps réel (AD-8, Epic 4).
 */
export function ListeRecettes({
  recettes,
  foyerId,
  profilId,
}: {
  recettes: Recette[];
  foyerId: string;
  profilId: string;
}) {
  const router = useRouter();
  const { occupe, cle, refuser, effacer, soumettre } = useSoumission<Cle>();
  const [nouveauTitre, setNouveauTitre] = useState("");

  async function creer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const titre = normaliserTitre(nouveauTitre);
    if (!titre) return refuser("titre-vide");

    await soumettre(async () => {
      const supabase = createNavigateurClient();

      /*
       * `household_id` est explicite : la colonne est `not null` et n'a pas de
       * défaut. Ce n'est pas une garde — `recipes_all` porte
       * `with check (household_id = current_household_id())`, donc une valeur
       * étrangère serait refusée par Postgres. La frontière est en base (AD-2).
       *
       * `created_by` l'est aussi, et sans défaut non plus. `profiles.id` EST
       * `auth.users.id`, donc le profil rendu par `requireProfile()` porte
       * exactement la valeur attendue. Aucun critère ne le demande, mais la
       * laisser nulle perdrait définitivement l'information pour toutes les
       * recettes créées d'ici l'Epic 7.
       *
       * `servings` et `source` sont laissés à leurs défauts — 2 et 'manual' —
       * qui sont justes. L'écran d'édition prendra la suite.
       */
      const { data, error } = await supabase
        .from("recipes")
        .insert({ household_id: foyerId, created_by: profilId, title: titre })
        .select("id")
        .maybeSingle();

      if (error || !data) {
        if (error) console.error("[recettes] création refusée :", error.message);
        return refusRecette(error);
      }

      setNouveauTitre("");
      /*
       * `refresh()` AVANT de partir : sans lui, revenir sur ce répertoire par le
       * bouton Retour du navigateur servirait la version en cache, sans la
       * recette qu'on vient de créer.
       */
      router.refresh();
      router.replace(`/recettes/${data.id}/modifier`);
      return undefined;
    });
  }

  const message = messageDe(MESSAGES, cle, "echec");

  return (
    <div>
      <section>
        <h2 className="titre-section">Mon répertoire</h2>

        {recettes.length === 0 ? (
          <div className="mt-2">
            <p className="text-base">Tu n&apos;as encore aucune recette.</p>
            <p className="hint mt-1">
              Ajoutes-en une juste en dessous, et elle servira à remplir le menu.
            </p>
          </div>
        ) : (
          <ul className="mt-2">
            {recettes.map((recette) => (
              <li
                key={recette.id}
                className="border-b border-card-border last:border-0"
              >
                {/*
                  La cible mène à la LECTURE depuis la story 3.3 — c'est la
                  destination naturelle d'un titre. L'édition s'atteint depuis
                  la recette, par son bouton « Modifier ».

                  (Elle a mené à l'édition jusqu'au 2026-08-02, faute d'écran de
                  lecture ; le commentaire qui l'annonçait vivait ici et a été
                  réécrit avec le changement, pas après.)
                */}
                <Link
                  href={`/recettes/${recette.id}`}
                  className="flex min-h-touch items-center gap-3 py-2 text-base"
                >
                  <span className="min-w-0 flex-1 break-all">
                    {recette.titre}
                  </span>
                  <span className="hint shrink-0 tabular-nums">
                    {recette.portions} pers.
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="titre-section">Ajouter une recette</h2>

        <form onSubmit={creer} className="mt-2">
          <label htmlFor="nouveau-titre" className="sr-only">
            Titre de la recette
          </label>
          <input
            id="nouveau-titre"
            type="text"
            required
            maxLength={MAX_TITRE}
            placeholder="Curry de pois chiches"
            value={nouveauTitre}
            onChange={(e) => {
              setNouveauTitre(e.target.value);
              effacer();
            }}
            className="input"
          />

          <p className="hint mt-2">
            Juste le titre pour l&apos;instant. Tu renseignes le reste juste
            après.
          </p>

          {/*
            La région de statut de CE formulaire, au-dessus de son bouton.
            `reserve` parce qu'elle le surplombe : sans elle, un message
            pousserait la cible sous le doigt au moment du clic (contrat de
            `Notice`). C'est le défaut trouvé DEUX fois de suite sur `/rayons`.
          */}
          <Notice reserve className="mt-3">
            {message}
          </Notice>

          <button
            type="submit"
            disabled={occupe}
            className="btn-primaire mt-3 w-full"
          >
            {occupe ? LIBELLE_OCCUPE : "Ajouter"}
          </button>
        </form>
      </section>
    </div>
  );
}
