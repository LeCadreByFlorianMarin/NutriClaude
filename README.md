# NutriClaude

La liste de courses d'un foyer, triée par les rayons de **son** magasin.

Ce n'est pas une application avec des intégrations : c'est **une donnée** — la liste — avec plusieurs points d'accès de rang égal (téléphone, écran de cuisine, assistant vocal, conversation avec Claude, web). Postgres en est la source unique et l'autorité ; chaque surface n'est qu'un adaptateur mince au-dessus d'un contrat partagé.

Outil familial, pour un foyer de deux personnes. Pas un produit commercial.

## État d'avancement

| | Périmètre | État |
|---|---|---|
| **1.1** | Socle Next 16, contrôle d'accès, clients Supabase | ✅ livré |
| **1.2** | Connexion par lien envoyé par email | 🚧 code écrit, vérification de bout en bout en attente de configuration |
| 1.3 → 1.7 | Foyer, invitations, profil, thème | à venir |
| Epics 2 → 7 | Rayons apprenants, recettes & menu, liste hors-ligne, écran de cuisine, surfaces mobiles, pilotage par Claude | à venir |

L'application **ne fait encore rien de visible** au-delà de la connexion : c'est un socle assumé. Le découpage complet vit dans `_bmad-output/planning-artifacts/epics.md`.

## Stack

| | Version | Note |
|---|---|---|
| Next.js (App Router) | 16.2.12 | convention `proxy.ts`, plus de `middleware.ts` |
| React / React DOM | 19.2.8 | |
| Tailwind CSS | 4.3.3 | via `@tailwindcss/postcss`, **versions identiques obligatoires** |
| TypeScript | 6.0.3 | TS 7 volontairement non adopté |
| `@supabase/ssr` | 0.12.3 | |
| `@supabase/supabase-js` | 2.110.8 | impose **Node ≥ 22** |
| ESLint | 9.39.5 | **ne pas monter en 10** — voir « Pièges connus » |

Hébergement : **Vercel** (coquille web) + **Supabase** (Postgres, Auth, Realtime). Aucun autre service.

Les versions sont **épinglées à l'exact**, sans `^`. Un `npm ci` qui échoue signale une divergence entre `package.json` et `package-lock.json` — c'est voulu.

## Démarrer en local

Prérequis : **Node ≥ 22** (le dépôt fixe `.node-version`).

```bash
npm install
cp .env.local.example .env.local   # puis renseigner les deux valeurs
npm run dev
```

Les deux variables se trouvent dans *Supabase Dashboard → Project Settings → API*. **Sans elles, toutes les routes retournent 500**, y compris l'écran de connexion : le client Supabase lève à l'instanciation.

Se connecter en local suppose en outre que la configuration externe soit faite — voir **[`docs/configuration.md`](docs/configuration.md)**.

### Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | build de production |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

Ces trois dernières sont exactement ce que rejoue la CI sur chaque *pull request* (`.github/workflows/ci.yml`).

## Structure

```
app/                      surfaces web (App Router)
  auth/callback/route.ts  retour du lien de connexion
  login/                  écran de connexion
lib/
  auth/safe-next.ts       validation de la destination de retour
  supabase/               client (navigateur) · server (SSR + Route Handler) · proxy
  dates.ts
proxy.ts                  contrôle d'accès (convention Next 16)
supabase/migrations/      schéma — DÉPLOYÉ ET GELÉ, voir ci-dessous
docs/                     configuration et exploitation
_bmad-output/             corpus de planification (PRD, architecture, UX, epics, stories)
```

## Les règles qui ne se négocient pas

Cinq invariants gouvernent le code. Les ignorer produit du travail à jeter.

**Toute règle métier vit en Postgres.** RLS, contraintes et fonctions SQL sont la vérité et l'application. Le TypeScript n'est jamais un dépôt de règles.

**L'isolation entre foyers est appliquée à la donnée, jamais à l'interface.** Toutes les politiques RLS sont ancrées sur `current_household_id()`. **Aucune surface n'utilise de clé de service** — pas de contournement, jamais.

**Le schéma est déployé et gelé.** Il n'évolue qu'en migrations *additives*. `git status supabase/` doit rester vide tant qu'une story ne prescrit pas explicitement une migration.

**L'authentification humaine est sans mot de passe.** Un lien envoyé par email, point. C'est un invariant produit : le test d'acceptation est « elle ne configure rien ».

**Le hors-ligne est le mode nominal, pas une erreur.** Au supermarché, consulter, cocher et ajouter fonctionnent sans réseau. Aucun écran ne rougit ni ne bloque pour cette raison.

Un sixième, de forme : **aucun jargon technique n'est rendu à l'écran.** Mots bannis sur toutes les surfaces — *synchronisation, jeton, API, MCP, pont, Supabase, RLS, cache*. On parle de repas, de rayons et de courses, en tutoyant.

## Pièges connus

**ESLint reste en 9.** `eslint-config-next@16.2.12` embarque un `eslint-plugin-react` incompatible avec l'API de contexte d'ESLint 10 : avec la 10, `npm run lint` sort en code 2 et **ne lint rien du tout**. À revisiter quand l'amont bougera.

**`npm run build | grep …` ne rend jamais la main.** Les workers Turbopack gardent le descripteur de sortie ouvert, `grep` n'atteint jamais l'EOF — le build, lui, se termine en ~2 s. **Rediriger vers un fichier** plutôt que de piper.

**`params` et `searchParams` sont des `Promise`.** `experimental.strictRouteTypes` est activé pour que l'oubli d'un `await` échoue au build au lieu de produire un `undefined` silencieux à l'exécution.

**Le proxy ne fait aucune exclusion par extension de fichier.** Une règle du type `.*\.png$` laisserait passer sans contrôle d'accès toute route finissant ainsi. Conséquence assumée : les fichiers servis depuis `public/` traversent le proxy, et devront y être exclus explicitement, un par un, le jour où il y en aura.

**Le prototype d'origine reste consultable** — `git show prototype-2026-05-02:<chemin>`. Il a été abandonné le 2026-07-26 : il ne compilait pas, et l'essentiel de ses surfaces était condamné par des décisions d'architecture postérieures. **C'est un contre-exemple, pas un modèle** : son écran de connexion contenait notamment une redirection ouverte non validée.

## Documentation

- **[`docs/configuration.md`](docs/configuration.md)** — tout ce qui se règle **hors du dépôt** : Supabase, Vercel, domaine, variables d'environnement. À lire avant de tenter une connexion.
- `_bmad-output/planning-artifacts/` — PRD, architecture, design UX, découpage en epics et stories.
- `_bmad-output/implementation-artifacts/` — stories, revues de code, travaux différés.
