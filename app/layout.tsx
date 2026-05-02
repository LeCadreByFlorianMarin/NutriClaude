import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NutriCloud — Le Cadre",
  description:
    "Planification nutritionnelle familiale avec liste de courses triée par rayon. Brique nutrition de Le Cadre.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="font-sans">{children}</body>
    </html>
  );
}
