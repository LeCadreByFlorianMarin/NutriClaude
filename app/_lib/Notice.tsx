/**
 * Zone de message d'un écran — échec ou confirmation.
 *
 * **Pourquoi un composant et pas trois attributs recopiés.** Le trio
 * `role="status" aria-live="polite"` était écrit à la main dans sept endroits.
 * Oublier `aria-live` sur le prochain écran rend un message **définitivement
 * muet** pour un lecteur d'écran, sans que rien — ni typage, ni lint, ni test —
 * ne le signale. C'est le seul contrat du produit dont l'oubli est à la fois
 * silencieux et grave.
 *
 * Aucune couleur d'alerte : le rouge est banni du produit (UX-DR1), le message
 * se distingue par son texte et sa graisse. La position, du coup, est le seul
 * repère restant — d'où `reserve`.
 *
 * @param reserve  Garde la hauteur d'une ligne même sans message. À utiliser
 *   quand la zone est AU-DESSUS du formulaire, pour qu'un message n'y pousse
 *   pas le champ et le bouton sous le doigt de l'utilisateur. À laisser à
 *   `false` quand elle est en dessous : le trou permanent n'y sert à rien.
 */
export function Notice({
  children,
  reserve = false,
  className = "",
}: {
  children?: React.ReactNode;
  reserve?: boolean;
  className?: string;
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={`notice ${reserve ? "" : "min-h-0"} ${className}`}
    >
      {children}
    </p>
  );
}
