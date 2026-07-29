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
   * vérification en conditions réelles. À traiter avec l'epic qui introduit du
   * contenu libre saisi par le membre (recettes, articles), là où la surface XSS
   * apparaît réellement.
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
