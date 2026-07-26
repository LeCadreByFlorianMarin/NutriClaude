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
};

export default nextConfig;
