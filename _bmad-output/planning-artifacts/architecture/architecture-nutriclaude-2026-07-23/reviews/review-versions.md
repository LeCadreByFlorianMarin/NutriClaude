# Versions & Réel — ARCHITECTURE-SPINE NutriClaude

## Verdict (1 phrase)
Toutes les versions et faits techniques engagés sont **confirmés sur le web au 23/07/2026** et cohérents entre eux ; la table Stack correspond exactement au `package.json` (brownfield sain), la seule nuance réelle étant un détail d'implémentation (pg_cron seul n'appelle pas une Edge Function — il faut pg_net).

## Findings

- **[low] Cohérence brownfield Stack ↔ package.json** — *confirmé* : les 6 versions applicatives de la table Stack correspondent **au caractère près** au `package.json` (`next 16.2.4`, `react 19.2.5`, `tailwindcss 4.2.4`, `typescript 6.0.3`, `@supabase/ssr 0.10.2`, `@supabase/supabase-js 2.105.1`). La table affiche les minor (16.2 / 19.2 / 4.2 / 6) — abréviation correcte, jamais divergente. *Fix:* aucun.

- **[low] Ensemble Next 16 + React 19.2 + Tailwind 4.2 + TS 6 viable ?** — *confirmé* : Next.js 16.2 (patch le plus récent observé : 16.2.6, correctif sécurité) embarque **React 19.2** comme paire officielle (View Transitions, useEffectEvent, Activity). Tailwind 4.2 (sortie 18/02/2026) et TypeScript 6.0 (sortie 23/03/2026, dernière version JS-based avant le portage Go de TS 7) sont indépendants du couple Next/React. **Les quatre forment un ensemble cohérent et courant pour mi-2026.** *Fix:* aucun.

- **[low] Versions légèrement en retrait du dernier npm** — *confirmé (non bloquant)* : au 23/07/2026 les têtes de série sont plus récentes — `@supabase/ssr 0.10.3` (07/05/2026), `@supabase/supabase-js 2.110.8`, `tailwindcss 4.3.2`, et TS 7.0 est en RC (18/06/2026). Les versions gelées **existent toutes** (supabase-js 2.105.1 publié le 28/04/2026, ssr 0.10.2 antérieur à 0.10.3) et le spine assume explicitement « le code fait foi » + « à re-confirmer web avant gel ». Aucune version fantôme, aucune incohérence. *Fix:* mentionner qu'un bump patch mineur (ssr 0.10.3, supabase-js 2.11x) est disponible si souhaité au Lot 0 ; rester sur TS 6 (ne pas sauter à TS 7 RC/Go) est le bon choix.

- **[low] « pg_cron + Edge Functions pour un job périodique » (AD-12, AD-15)** — *confirmé avec nuance* : le pattern hosted Supabase est bien pg_cron pour l'ordonnancement, **mais l'appel à l'Edge Function passe par `pg_net` / `net.http_post()`** (jeton stocké en Supabase Vault), pas par pg_cron seul. Le spine écrit « Edge Function déclenchée par pg_cron » — exact au niveau intention, incomplet au niveau mécanisme. *Fix:* au Lot 1, prévoir `create extension pg_net` en plus de `pg_cron` et le secret Vault ; c'est un détail de migration, pas un défaut d'architecture.

- **[low] Faits Next 16 (middleware→proxy, cookies() async) et Tailwind 4 (@tailwindcss/postcss + @theme)** — *confirmés* : (1) Next 16 renomme `middleware.ts` → `proxy.ts` (fonction `proxy`, codemod `middleware-to-proxy`), l'ancien fichier est déprécié — la convention `lib/supabase/proxy.ts` du spine est juste ; **à noter : `proxy` tourne désormais sur le runtime Node.js** (vs Edge), sans impact sur le gating décrit. (2) `cookies()`/`headers()` sont asynchrones et exigent `await` — conforme au prérequis Lot 0. (3) Tailwind v4 se configure via `@tailwindcss/postcss` et le bloc CSS `@theme` (config CSS-first) — exact. *Fix:* aucun.

- **[low] Web Share Target limité sur iOS PWA (AD-13) + Realtime sans polling (AD-8) + RLS via auth.jwt() (AD-9)** — *confirmés* : l'API Web Share (partage sortant) marche sur iOS, mais l'enregistrement comme **cible de partage** (Web Share Target du manifeste) et le Background Sync restent non/peu supportés sur iOS Safari en 2026 → « asymétrie de plateforme assumée » factuellement fondée. Supabase Realtime (souscription par foyer, propagation push sans polling) et la résolution de claim custom via `auth.jwt()` en RLS sont des patterns Supabase standards et courants. *Fix:* aucun.

## Sources
- [Next.js 16 — middleware → proxy](https://nextjs.org/blog/next-16)
- [Rename middleware.ts in Next.js 16 (discussion #84842)](https://github.com/vercel/next.js/discussions/84842)
- [Next.js 16.2 release](https://nextjs.org/blog/next-16-2)
- [Next.js — cookies() async](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [TypeScript 6.0 ships as final JS-based release (23/03/2026)](https://visualstudiomagazine.com/articles/2026/03/23/typescript-6-0-ships-as-final-javascript-based-release-clears-path-for-go-native-7-0.aspx)
- [Announcing TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)
- [Tailwind CSS 4.2 — nouveautés + @tailwindcss/postcss + @theme](https://medium.com/@milwad.dev/whats-new-in-tailwindcss-4-2-a967c6d9bf9f)
- [Tailwind CSS v4 (CSS-first, @theme)](https://tailwindcss.com/blog/tailwindcss-v4)
- [@supabase/supabase-js — npm (2.105.1 / latest)](https://www.npmjs.com/package/@supabase/supabase-js)
- [@supabase/ssr — releases (0.10.x)](https://github.com/supabase/ssr/releases)
- [Supabase — Scheduling Edge Functions (pg_cron + pg_net)](https://supabase.com/docs/guides/functions/schedule-functions)
- [Supabase Cron](https://supabase.com/blog/supabase-cron)
- [PWA iOS limitations & Safari support 2026 (Web Share Target / Background Sync)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
