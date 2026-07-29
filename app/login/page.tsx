import { safeNext } from "@/lib/auth/safe-next";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Connexion · NutriClaude" };

/**
 * Écran de connexion. Aucun mot de passe n'est demandé ni créé (AD-11) : on
 * envoie un lien par email, c'est le seul chemin d'entrée humain du produit.
 *
 * En Next 16, `searchParams` est une `Promise`. Avec `strictRouteTypes` activé,
 * un typage en objet nu échouerait au build plutôt que de valoir `undefined`
 * en silence à l'exécution.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="ecran-centre">
      <LoginForm next={safeNext(next)} error={error} />
    </main>
  );
}
