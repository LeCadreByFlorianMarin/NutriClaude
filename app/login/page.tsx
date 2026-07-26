// Page d'attente. La connexion par magic link (AD-11) est construite en Story 1.2.
// Elle existe ici uniquement pour que la redirection du proxy ait une destination
// réelle — sans elle, le contrôle d'accès renverrait vers une page introuvable.

export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">NutriClaude</h1>
        <p className="mt-3 text-sm opacity-70">
          La connexion arrive à la prochaine étape.
        </p>
      </div>
    </main>
  );
}
