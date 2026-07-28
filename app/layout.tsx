import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  /*
   * `template` plutôt qu'un titre fixe : les six routes portaient toutes le
   * même libellé dans l'onglet, l'historique et le sélecteur de tâches de la
   * PWA. Chaque page pose désormais le sien.
   */
  title: {
    default: "NutriClaude",
    template: "%s",
  },
  description:
    "La liste de courses du foyer, triée par les rayons de ton magasin.",
};

/**
 * Sans `themeColor`, la barre d'adresse et la barre d'état restent claires
 * pendant que l'application rend en aubergine — une couture visible à chaque
 * lancement sur téléphone, sur un produit qui vise l'écran de cuisine.
 * Les deux valeurs reprennent `--surface-base` de chaque thème.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#191016" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
