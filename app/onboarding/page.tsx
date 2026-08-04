import { redirect } from "next/navigation";
import { appartenance } from "@/app/_lib/garde";
import { OnboardingChoice } from "./OnboardingChoice";

export const metadata = { title: "Mon foyer, pour commencer · NutriClaude" };

/**
 * Inscription au foyer. Route **protégée** — elle n'a de sens que connecté, et
 * n'a rien à faire dans les routes publiques du proxy.
 *
 * Un membre qui a déjà un foyer n'a rien à faire ici : il repart à l'accueil.
 * C'est la moitié « aucun nouvel appel de création » de l'AC3 de la Story 1.3,
 * et c'est aussi ce qui empêche un membre de racheter une invitation.
 */
export default async function OnboardingPage() {
  const etat = await appartenance();

  if (etat.etat === "anonyme") redirect("/login");
  if (etat.etat === "membre") redirect("/");

  /*
   * `inverifiable` lève, comme sur `/` et `/foyer`.
   *
   * La première version rendait le formulaire ici, au nom de NFR-1. Le
   * commentaire promettait que « les deux formulaires échoueront proprement » —
   * ils échouaient en **succès** : un membre qui a déjà un foyer, victime d'un
   * `getUser()` lent, recevait l'écran de création, tapait un nom, et se
   * retrouvait renvoyé vers son ancien foyer sans qu'un mot lui soit dit. C'est
   * l'AC3 de la story 1.3 (« aucun nouvel appel de création n'est déclenché »)
   * qui tombait, par un chemin que personne n'avait vu.
   *
   * Les trois routes se comportent désormais pareil face à une panne, et
   * `app/error.tsx` offre un « Réessayer » qui refait la requête.
   */
  if (etat.etat === "inverifiable") {
    throw new Error("Service d'authentification injoignable");
  }

  return (
    <main className="ecran-centre">
      <OnboardingChoice />
    </main>
  );
}
