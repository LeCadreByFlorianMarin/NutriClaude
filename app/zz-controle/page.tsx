import { CarteRayon } from "@/app/_lib/CarteRayon";
import { Notice } from "@/app/_lib/Notice";

/* ⛔ ROUTE JETABLE — contrôle visuel de la revue du 2026-08-07 (décision D-4).
   À SUPPRIMER avant la fusion. Elle reproduit le gabarit exact de
   `ListeCourses` : `p-screen`, `gap-gutter`, `min-h-item`, mêmes classes. */
const RAYONS = [
  { id: "1", nom: "Fruits & Légumes", icone: "🥬", articles: ["Pommes", "Carottes", "Salade"] },
  { id: "2", nom: "Crèmerie", icone: "🧀", articles: ["Lait", "Beurre"] },
  { id: "3", nom: "Épicerie", icone: "🥫", articles: ["Riz", "Huile d'olive", "Sel"] },
  { id: "4", nom: "Boucherie", icone: "🥩", articles: ["Poulet"] },
  { id: "5", nom: "Boissons", icone: "🧃", articles: ["Jus d'orange", "Eau"] },
  { id: null, nom: null, icone: null, articles: ["Truc non classé", "Autre truc"] },
];

export default function ZzControle() {
  return (
    <main className="flex-1 p-screen">
      <div className="mx-auto w-full max-w-md py-6">
        <h1 className="titre-ecran mt-2">Ma liste</h1>
        <p className="text-meta mt-1 text-muted">Rangée dans l&apos;ordre de ton magasin.</p>

        <div className="mt-8 border-t border-card-border pt-4">
          <p className="text-meta text-muted">— état d&apos;échec (correctif P-1) —</p>
          <Notice reserve>On n&apos;a pas réussi à ouvrir ta liste.</Notice>
          <p className="text-meta text-muted">
            (rien d&apos;autre ne doit apparaître ici : pas de « Ta liste est vide. »)
          </p>
        </div>

        <div className="mt-8 border-t border-card-border pt-4">
          <p className="text-meta text-muted">— pile serrée, {RAYONS.length} cartes (décision D-4) —</p>
          <p className="mt-6">
            <span aria-hidden className="compteur block text-accent-text">12</span>
            <span aria-hidden className="text-meta text-muted">à prendre</span>
          </p>
          <ul className="mt-6 flex list-none flex-col gap-gutter p-0">
            {RAYONS.map((r) => (
              <li key={r.id ?? "a-classer"}>
                <CarteRayon id={r.id} nom={r.nom} icone={r.icone} pris={0} total={r.articles.length}>
                  <ul className="list-none p-0">
                    {r.articles.map((a) => (
                      <li key={a} className="flex min-h-item items-center gap-2">
                        <span className="text-body min-w-0 flex-1 break-words">{a}</span>
                        <span className="text-qty shrink-0 text-muted tabular-nums">2 pièce</span>
                      </li>
                    ))}
                  </ul>
                </CarteRayon>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
