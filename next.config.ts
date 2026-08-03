import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /*
     * Sans ce drapeau, ni `tsc` ni `next build` ne détectent un `params` ou un
     * `searchParams` typé en objet plutôt qu'en `Promise` : le validateur généré
     * par Next type le composant en `{ params: Promise<…> } & any`, et le `& any`
     * fait s'effondrer la vérification. Le symptôme serait un bug silencieux à
     * l'exécution (`params.id` valant `undefined`).
     */
    strictRouteTypes: true,
  },

  /**
   * En-têtes de sécurité, sur toutes les réponses.
   *
   * Le cookie de session Supabase est lisible en JavaScript (`httpOnly: false`,
   * c'est la librairie qui l'impose) et dure 400 jours : une XSS exfiltrerait un
   * jeton porteur authentique, que la RLS honorerait sans broncher. Ces en-têtes
   * ne ferment pas ce risque — seule une CSP le ferait — mais ils ferment le
   * clickjacking, la fuite de Referer vers un tiers et le reniflage de type.
   *
   * Pas de `Content-Security-Policy` ici : Next 16 exige un nonce par requête
   * pour ses scripts inline, ce qui se règle dans le proxy et demande une
   * vérification en conditions réelles.
   *
   * ⚠️ **Échéance révisée le 2026-08-01 (décision de Florian) : Epic 6, avec la
   * story PWA.** L'ancienne disait « l'epic qui introduit du contenu libre saisi
   * par le membre (recettes, articles) ».
   *
   * **Contrôle refait le 2026-08-02, sur l'arbre complet, et c'est le contrôle qui
   * compte** : la story 3.1 ouvrait l'ÉCRITURE des recettes, la story 3.3 en ouvre
   * la LECTURE — c'est elle qui rend du texte écrit par un membre, et donc elle qui
   * pouvait ouvrir la surface. Elle ne l'a pas ouverte : aucune occurrence de
   * `dangerouslySetInnerHTML`, `innerHTML` ni `__html` dans `app/` et `lib/` (la
   * seule est un commentaire qui les interdit), aucun parseur Markdown ni sanitizer
   * parmi les dépendances, tout champ de membre rendu par une expression React donc
   * échappé, et la mise en forme des instructions tenue par `white-space: pre-wrap`
   * — du CSS, pas du balisage. NFR-10 interdit d'ajouter la dépendance qui en
   * apporterait un.
   *
   * ⚠️ **Ce que ce contrôle NE dit PAS, et qu'il faut rouvrir en Epic 6 :** il porte
   * sur l'injection de balisage, pas sur le fait que le texte rendu soit BORNÉ.
   * `recipes.description` et `recipes.instructions` n'ont aucune contrainte en base
   * — ni contenu, ni longueur ; les gardes vivent dans le navigateur alors que
   * l'écriture est client-direct. Reporté par Florian le 2026-08-02 (« pas de limite
   * pour l'instant »), détail dans `deferred-work.md`. Un `grep` vert ne referme que
   * la moitié de la question.
   *
   * **La prochaine story qui rend du texte de membre refait ce contrôle**, elle ne
   * le suppose pas fait.
   *
   * La nouvelle échéance n'est pas un report de plus : la CSP a besoin d'un
   * nonce **dans le proxy**, et `deferred-work.md` note déjà que le matcher du
   * proxy est à rouvrir avant l'Epic 6 pour les icônes PWA. Les deux travaux
   * touchent le même fichier pour la même raison ; les séparer ferait ouvrir le
   * proxy deux fois.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Le produit ne s'embarque dans aucune iframe.
          { key: "X-Frame-Options", value: "DENY" },
          // Interdit au navigateur de deviner un type MIME contre le nôtre.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Un lien sortant ne doit pas emporter le chemin visité.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HTTPS obligatoire ensuite. Sans `preload` : irréversible à l'échelle
          // du navigateur, et le domaine n'est pas figé.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
