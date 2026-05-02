# NutriCloud

Brique nutrition de l'écosystème **Le Cadre**. Planification nutritionnelle familiale, recettes, et liste de courses triée par rayon.

Stack : **Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth + RLS)**.

## Setup

### 1. Variables d'environnement

```bash
cp .env.local.example .env.local
```

Remplis avec les valeurs de ton projet Supabase :
`Supabase Dashboard → Project Settings → API`.

### 2. Installer les dépendances

```bash
npm install
```

### 3. Appliquer la migration SQL

Trois options selon ta préférence :

**A. Supabase CLI (recommandé)**
```bash
npx supabase link --project-ref <ton-project-ref>
npx supabase db push
```

**B. Dashboard SQL Editor**
Copie/colle le contenu de `supabase/migrations/20260502000000_initial_schema.sql` dans le SQL Editor.

**C. psql direct**
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260502000000_initial_schema.sql
```

### 4. Lancer le dev server

```bash
npm run dev
```

Ouvre `http://localhost:3000`.

## Architecture

Voir `architecture-nutriclaude.html` pour la vision complète (bounded contexts, MCP server, intégration Open Food Facts, funnel Le Cadre). Le doc parlait initialement d'iOS Shortcuts comme UI primaire — la v1 web Next.js est l'implémentation actuelle.

### Bounded contexts implémentés

- **Households & Profiles** — unité de partage (foyer) + profils nutritionnels individuels.
- **Aisles** — rayons personnalisés du supermarché, ordonnés selon le parcours physique.
- **Recipes** — recettes du foyer + ingrédients.
- **Meal Plan** — menu hebdomadaire (jour × repas → recette).
- **Grocery List** — liste agrégée et triée par rayon.

### Flow utilisateur v1

1. **Inscription** → `/signup`
2. **Onboarding** → créer un foyer (ou rejoindre via code) → 11 rayons par défaut sont seedés
3. **Rayons** → réorganiser selon ton supermarché, ajouter des mots-clés (`poulet → Boucherie`)
4. **Recettes** → créer ses recettes avec leurs ingrédients
5. **Menu** → assigner les recettes au planning de la semaine
6. **Liste de courses** → générer depuis le menu → liste agrégée et triée par rayon

### RLS

Toutes les tables avec `household_id` filtrent par `current_household_id()` (helper qui lit `profiles` pour `auth.uid()`). Les `products` sont partagés (cache Open Food Facts global). Aucun utilisateur ne peut lire les données d'un autre foyer.

## Routes

| Route | Description |
|---|---|
| `/login`, `/signup`, `/auth/callback` | Auth Supabase email/password |
| `/onboarding` | Créer ou rejoindre un foyer |
| `/menu` | Menu de la semaine (grille 7j × 3 repas) |
| `/recipes` | Liste des recettes |
| `/recipes/[id]` | Détail + édition + ingrédients |
| `/aisles` | Config rayons + mots-clés → rayon |
| `/grocery` | Liste de courses, triée par rayon |

## Prochaines étapes

- [ ] Edge Function pour calculer les macros automatiquement (depuis ingredient × product)
- [ ] Intégration Open Food Facts (recherche par code-barres + mots-clés)
- [ ] MCP server (générer recettes via Claude en conversation)
- [ ] PWA / shortcut iOS pour scanner code-barres
- [ ] Génération du menu via Claude (`plan_weekly_menu`)
