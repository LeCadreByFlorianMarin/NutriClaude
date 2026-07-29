---
baseline_commit: eae9121
---

# Story 2.1: Gérer ses rayons

Status: in-progress

<!--
2026-07-29 — revue adversariale. 5 décisions tranchées, 14 correctifs appliqués, 6 reportés.
`review` → `in-progress` et non `done`, pour trois raisons nommées en fin de fichier
(§ « Ce que la revue a exécuté ») : le parcours à l'écran n'a pas été rejoué après les
quatre changements de `ListeRayons.tsx`, la portée de `SUPABASE_DB_URL` dans Vercel n'est
pas contrôlée, et le job CI `isolation` n'a jamais tourné sur un runner. Cocher `done`
reviendrait à consigner comme vérifié ce qui ne l'a pas été.
-->


<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a membre configurant le foyer (Florian),
I want créer, renommer, ré-iconifier et supprimer des rayons,
so that la liste reflète les rayons réels de mon magasin.

## Acceptance Criteria

**AC1 — Créer un rayon**
**Given** l'écran des rayons sur la surface web
**When** Florian ajoute un rayon avec un nom et une icône emoji
**Then** le rayon est créé, rattaché au foyer, et placé en fin de parcours par défaut

**AC2 — Modifier un rayon**
**Given** un rayon existant
**When** Florian modifie son nom ou son icône
**Then** la modification est persistée et se reflète partout où le rayon apparaît

**AC3 — Supprimer un rayon**
**Given** un rayon que Florian supprime
**When** il confirme la suppression
**Then** le rayon est retiré. *(Le rattachement des articles est déjà tenu par le schéma :
`grocery_list_items.aisle_id` est `on delete set null` depuis le squelette, donc les articles
basculent vers « À classer » sans rien à implémenter. À **démontrer** en Epic 4, quand une liste
existera — pas à cocher ici.)*

**AC4 — L'état vide**
**Given** un foyer dont tous les rayons ont été supprimés
**When** l'écran des rayons s'affiche
**Then** il montre un état vide lisible en français invitant à créer un rayon, jamais une page
blanche ni un message technique (NFR-8)

**AC5 — Restaurer le jeu par défaut** *(critère absorbé de l'ancienne story 2.1)*
**Given** ce même foyer dépourvu de rayons
**When** Florian demande à restaurer le jeu par défaut
**Then** `seed_default_aisles()` — qui existe déjà, est idempotente
(`on conflict (household_id, name) do nothing`) et amorce 11 rayons français — est appelée, sans
dupliquer aucun rayon déjà présent (FR-11)

[Source: _bmad-output/planning-artifacts/epics.md#Story-2.1 — cité verbatim]

> ⚠️ **La dernière phrase de l'AC5 dans `epics.md` — « Rien n'est à écrire côté base : seul l'appel
> manque » — est fausse, et c'est le fait le plus important de cette story.** `seed_default_aisles`
> est `security definer`, prend le `household_id` **en paramètre**, ne contrôle rien, et est exposée
> en RPC à tout compte authentifié. La rendre appelable depuis un écran ouvre un **chemin d'écriture
> inter-foyers** (NFR-5). Mesuré, pas déduit — voir « Le piège n°1 ». **Une migration est requise
> avant tout code d'écran.**

## Tasks / Subtasks

- [x] **Task 1 — Migration : refermer `seed_default_aisles` avant de l'appeler** (AC: 5)
  - [x] `npx supabase migration new guard_seed_default_aisles`
  - [x] ⚠️ **Requête de contrôle en en-tête du fichier**, sans exception (règle d'équipe issue de
        l'Epic 1). Ici : `select proname, prosecdef from pg_proc where proname = 'seed_default_aisles';`
        — attendu `prosecdef = t`, c'est ce qui rend le paramètre dangereux
  - [x] `create or replace function seed_default_aisles(p_household_id uuid)` **à signature
        identique**, corps inchangé, précédé de la garde :
        ```sql
        if p_household_id is null or p_household_id is distinct from current_household_id() then
          raise exception 'Not your household';
        end if;
        ```
  - [x] Garder `security definer` **et** `set search_path = public` — les deux sont déjà là et les
        retirer casserait `create_household_with_profile`
  - [x] ⚠️ **Ne change PAS la signature, n'ajoute PAS de fonction enveloppe, ne fais PAS de
        `revoke execute`.** Ces trois variantes ont été essayées ; la voie du `revoke` casse
        PostgREST. Voir « Le piège n°2 »
  - [x] Recopier le corps `insert … on conflict` **à l'identique** depuis
        `20260502000000_initial_schema.sql:337-349` — mêmes 11 rayons, mêmes `sort_order`, mêmes
        emojis. Toute divergence est une régression silencieuse
  - [x] Répondre aux quatre questions de `.github/pull_request_template.md` dans la PR
        (`docs/migrations.md#Pour-la-revue`)

- [x] **Task 2 — Migration : un nom de rayon n'est jamais vide** (AC: 1, 2)
  - [x] `npx supabase migration new require_non_blank_aisle_name`
  - [x] Requête de contrôle en en-tête : `select id, household_id, name from aisles where btrim(name) = '';`
        — la contrainte échouera s'il existe une ligne vide
  - [x] `alter table aisles add constraint aisles_name_non_vide check (btrim(name) <> '');`
  - [x] C'est la **troisième** contrainte de cette forme : `profiles_display_name_non_vide`
        (`20260728133836`) et celle de `households` (`20260728152418`) l'ont précédée. Même motif,
        même raison — un champ libre partagé par tout le foyer, qu'aucun autre membre ne peut corriger
  - [x] Si le coût ou un cas non prévu apparaît, **renonce et dis-le** plutôt que de laisser une
        migration à moitié faite : la normalisation côté application (Task 4) reste le premier filet

- [x] **Task 3 — Appliquer en local et régénérer les types** (AC: 1, 5)
  - [x] `npx supabase db reset` — **autorisé et attendu en local**, interdit sur le distant. Voir
        « Le piège n°8 ». ⚠️ **Rectifié le 2026-07-29 (revue) :** la phrase « `docs/migrations.md` dit
        encore le contraire » était vraie à l'écriture de la story et **fausse au commit** — le commit
        `03a9a09` a réécrit ce document
  - [x] `npx supabase gen types typescript --linked > lib/supabase/types.ts` — ⚠️ **la commande est
        devenue `--local` le 2026-07-29** : le distant n'a plus les migrations au moment où l'on
        génère. Sans effet ici, la comparaison ayant été faite avec les deux sorties
  - [x] ⚠️ **Attendu : aucun diff.** La Task 1 ne change pas la signature, la Task 2 ne change pas la
        forme du schéma. Un diff inattendu = quelque chose a bougé qui ne devait pas — regarde avant
        de commiter. Contrôle de `docs/migrations.md` : le bloc `Functions` doit toujours lister
        **sept** fonctions
  - [x] ~~La poussée en production (`npx supabase db push` puis `npx supabase migration list`) est un
        geste de Florian, pas du dev.~~ **Caduc le 2026-07-29** : plus aucune migration n'est poussée
        à la main. La fusion de la PR déclenche le déploiement, qui les applique
        (`vercel.json` → `scripts/migrer-au-deploiement.mjs`). Voir `docs/migrations.md`

- [x] **Task 4 — `lib/rayons/` : le pur, testé** (AC: 1, 2)
  - [x] `lib/rayons/rayons.ts` — `type Rayon = { id, nom, icone: string | null, ordre: number }` et
        `rayonsDuFoyer(supabase): Promise<Rayon[]>`
  - [x] **Client passé en paramètre**, jamais construit dedans — motif de `membresDuFoyer` et
        `nomDuFoyer` : c'est ce qui rend la fonction utilisable par le dashboard (Epic 5) et le
        serveur MCP (Epic 7)
  - [x] **Aucun filtre `household_id`** : la RLS s'en charge, et l'écrire à la main laisserait croire
        que c'est lui qui protège (`membres.ts:19-20`)
  - [x] Lève si `error`. ⚠️ **Mais rend `[]` sans lever si zéro ligne** — contrairement à
        `membresDuFoyer`. Ici la liste vide est l'**état nominal de l'AC4**, pas un signal d'échec
  - [x] `.order("sort_order").order("name")` — le second n'est pas décoratif, voir « Le piège n°3 »
  - [x] `lib/rayons/saisie.ts` + `lib/rayons/saisie.test.ts` :
    - [x] `normaliserNomRayon(saisie): string | null` — reprend `INVISIBLES` et la forme de
          `lib/foyer/saisie.ts`, borne `MAX_NOM_RAYON = 40`. **Ne recopie pas la regex, exporte-la
          depuis `lib/foyer/saisie.ts` ou déplace-la dans un module commun** — trois copies, c'est
          exactement ce que ce fichier a été créé pour supprimer
    - [x] `normaliserIcone(saisie): string | null` — **le premier grapheme, pas le premier
          caractère** : voir « Le piège n°4 ». `null` si rien ne reste
    - [x] `prochainOrdre(rayons): number` — `max(ordre) + 10`, et `10` sur une liste vide
  - [x] `lib/rayons/erreurs.ts` + son test — `refusRayon(error): "nom-pris" | "echec"`, en lisant
        `error.code === "23505"` d'abord. Motif de `lib/foyer/erreurs.ts` : le code SQLSTATE en
        priorité, le texte en repli
  - [x] ⚠️ **Les tests vivent sous `lib/`.** Le glob de `npm test` s'arrête là ; un test déposé sous
        `app/` ne s'exécute pas et la CI reste verte

- [x] **Task 5 — `app/rayons/page.tsx` : le Server Component** (AC: 1, 2, 3, 4)
  - [x] `requireProfile()` puis `rayonsDuFoyer()` — motif exact de `app/foyer/page.tsx`
  - [x] `export const metadata = { title: "Tes rayons · NutriClaude" };`
  - [x] Aucun ajout à `PUBLIC_ROUTES` : le matcher du proxy attrape déjà tout, `/rayons` est gardée
        par construction. **Ne touche pas à `proxy.ts`**
  - [x] Mise en page reprise de `/foyer` : `<main className="flex-1 p-6">`, conteneur
        `mx-auto w-full max-w-sm py-6`, lien « ← Retour » en `.btn-quiet px-0`, `.titre-ecran`
  - [x] Le titre nomme l'**écran** (« Tes rayons »), jamais le foyer — la leçon de `/foyer` (`page.tsx:59-63`)
  - [x] Ne rends **aucune** carte-rayon : ce composant est la story 2.4. Voir « Le piège n°5 »

- [x] **Task 6 — Le composant client : créer, renommer, ré-iconifier, supprimer** (AC: 1, 2, 3)
  - [x] `app/rayons/ListeRayons.tsx`, `"use client"`, reçoit `rayons: Rayon[]` en propriété
  - [x] **Écriture client-direct + `router.refresh()`**, pas de Server Action. Critère de cause
        d'AD-13 : aucun secret serveur, et `router.refresh()` suffit à rejouer le rendu. Motif exact
        de `DisplayNameForm.tsx:63-84`. Voir « Le piège n°6 »
  - [x] ⚠️ **N'entretiens AUCUNE copie locale de la liste.** L'état local ne porte que l'interface
        (quelle ligne est en édition, quelle suppression attend confirmation). La liste vient des
        propriétés, et `router.refresh()` la rafraîchit. Une copie locale diverge dès qu'un autre
        membre écrit
  - [x] Réutilise `useSoumission` (`app/_lib/useSoumission.ts`) — son `finally` est sa raison d'être
  - [x] Réutilise `Notice` (`app/_lib/Notice.tsx`) pour **toute** zone de message : `role="status"`
        + `aria-live="polite"` oubliés rendent un message définitivement muet, sans qu'aucune porte ne
        le voie
  - [x] Réutilise `messageDe` (`lib/messages.ts`) et `LIBELLE_OCCUPE` (`app/_lib/libelles.ts`)
  - [x] **Créer** — champ nom + champ icône + bouton. `sort_order: prochainOrdre(rayons)` calculé
        depuis les propriétés, **jamais laissé au défaut de la colonne**. Voir « Le piège n°3 »
  - [x] **Renommer / ré-iconifier** — édition en ligne. `update(...).eq("id", …).select().maybeSingle()`
        et **teste `data` autant qu'`error`** : un update qui ne touche aucune ligne est un succès pour
        PostgREST, et un refus RLS afficherait « c'est noté » sans que rien ne soit écrit
        (`DisplayNameForm.tsx:70-78`)
  - [x] **Supprimer** — confirmation **en deux temps**, motif d'`InviteCard.tsx:164-205`. ⚠️ **Jamais
        `window.confirm()`** : une boîte de dialogue native est hors thème, hors ton, et bloque
        l'automatisation de navigateur
  - [x] Un nom en doublon rend `23505` → `refusRayon` → message français. Voir « Le piège n°7 »
  - [x] ℹ️ **L'AC2 (« se reflète partout où le rayon apparaît ») est tenue sans effort** : `/rayons`
        est aujourd'hui le **seul** endroit du produit où un rayon s'affiche. Ne pars pas en chasse
        d'autres surfaces à mettre à jour — il n'y en a pas avant l'Epic 4
  - [x] Cible tactile ≥ 44px sur chaque contrôle (`min-h-11`), zone de tap franche, aucun
        `outline:none` (l'anneau de focus est une règle globale `:focus-visible`, ne le répète pas)
  - [x] Emoji du rayon en `aria-hidden` — il est décoratif, le nom est déjà en texte
        (EXPERIENCE.md#Accessibility-Floor)
  - [x] ⚠️ **`autoFocus` sur aucun champ.** Trois champs le portaient encore le 2026-07-29 alors
        qu'une passe de revue le consignait « traité »

- [x] **Task 7 — L'état vide et la restauration** (AC: 4, 5)
  - [x] Quand `rayons.length === 0` : phrase française invitant à créer un rayon, jamais une page
        blanche ni un message technique
  - [x] Le bouton « Remettre les rayons de départ » n'apparaît **que dans l'état vide**. Le montrer
        sur un parcours déjà personnalisé inviterait à réintroduire onze rayons qu'on vient de
        supprimer — l'AC5 ne le demande pas, ne l'invente pas
  - [x] `supabase.rpc("seed_default_aisles", { p_household_id: profile.household_id })` puis
        `router.refresh()`. Le `household_id` vient du profil rendu par le serveur, et la fonction le
        recontrôle en base depuis la Task 1 — l'application ne s'auto-autorise pas
  - [x] Idempotence : un second appel ne duplique rien. **Mesuré : 11 → 11** (voir « Le piège n°1 »)

- [x] **Task 8 — Rendre l'écran atteignable** (AC: 1)
  - [x] Rien ne mène à `/rayons` aujourd'hui. Un écran qu'aucun lien n'atteint n'est pas livré
  - [x] Un lien depuis `app/page.tsx`, à côté de « Ton foyer ». `.btn` (secondaire) et non
        `.btn-primaire` : « Ton foyer » reste l'action principale de l'accueil
  - [x] ⚠️ La phrase « Les courses, les recettes et le menu arrivent. » (`app/page.tsx:26-28`) devient
        partiellement fausse. **Mets-la à jour** — c'est exactement le défaut que la 1.6 puis la 1.7
        ont laissé passer deux fois : un texte d'annonce qui ment après coup

- [x] **Task 9 — Étendre le filet d'isolation** (AC: 5)
  - [x] `supabase/tests/isolation.test.ts` — ajouter au moins deux tests :
    - [x] A appelle `seed_default_aisles` en visant le foyer de B → **refusé**, et le compte de rayons
          de B est **inchangé** (le témoin négatif compte autant que le refus)
    - [x] A appelle `seed_default_aisles` sur **son** foyer → accepté, 11 rayons, et un second appel
          en rend toujours 11
  - [x] Ajouter aussi le CRUD direct : A ne peut ni renommer, ni supprimer un rayon de B
        (`isolation.test.ts:334`). ⚠️ **Rectifié le 2026-07-29 (revue) :** le cas de l'**insertion**
        n'a pas été ajouté par cette story — il était déjà couvert par un test préexistant
        (`isolation.test.ts:228`). La couverture est bien complète ; c'est la case qui décrivait mal
        ce qui avait été fait
  - [x] ⚠️ **Ne « répare » pas l'ordre des tests existants ni leurs fixtures partagées** : l'en-tête
        du fichier explique que cet ordre *est* la démonstration du rayon de souffle
  - [x] `npm run test:isolation` — exige `npx supabase start` debout

- [x] **Task 10 — Vérification** (AC: 1, 2, 3, 4, 5)
  - [x] `npm run typecheck` · `npm run lint` · `npm run test` · `npm run build` — succès, zéro avertissement
  - [x] `npm run test:isolation` — tous au vert, en citant le compte
  - [x] Parcourir `/rayons` **dans les deux thèmes**, en basculant l'apparence macOS (pas l'émulation
        des outils de développement : le thème suit `prefers-color-scheme`, `globals.css:68`)
  - [x] Les cinq gestes vus pour de vrai : créer, renommer, ré-iconifier, supprimer avec
        confirmation, restaurer depuis l'état vide
  - [x] Anneau de focus au clavier (Tab) sur un champ et un bouton, dans les deux thèmes
  - [x] Grep des mots bannis dans les chaînes rendues (NFR-9) : synchronisation, jeton/token, API,
        MCP, pont, Supabase, RLS, cache
  - [x] Grep : aucune couleur hors tokens de DESIGN.md — `bg-red-*`, `text-gray-*`, `bg-white`
        n'existent plus dans la chaîne de build et échoueraient **en silence**
  - [x] Consigner dans `deferred-work.md` : (a) supprimer un rayon **détruit ses règles mot-clé** par
        `on delete cascade` — à dire dans la confirmation dès que la story 2.3 existera ; (b) tout
        choix écarté ou toute case laissée vide, avec sa raison
  - [x] ⚠️ **Ne consigne comme vérifié que ce qui a été exécuté, en citant la commande. Une déduction
        s'écrit « déduit ».** Trois défauts en deux jours viennent de cette seule confusion

## Dev Notes

### Le piège n°1 — `seed_default_aisles` est un trou d'isolation, et c'est mesuré

`epics.md` conclut l'AC5 par *« Rien n'est à écrire côté base : seul l'appel manque »*. C'est faux, et
appeler la fonction telle quelle depuis un écran livrerait une régression NFR-5.

```sql
-- 20260502000000_initial_schema.sql:330-351
create or replace function seed_default_aisles(p_household_id uuid)
returns void language plpgsql
security definer                 -- ← s'exécute avec les droits du propriétaire
set search_path = public
as $$ begin
  insert into aisles (household_id, …) values (p_household_id, …)  -- ← aucun contrôle
  on conflict (household_id, name) do nothing;
end; $$;
```

Le `household_id` **vient de l'appelant** et n'est confronté à rien. La fonction est exposée en RPC
PostgREST, et `20260729094500_grant_table_privileges.sql:62` accorde `execute` à `authenticated`.

**Exécuté le 2026-07-29 sur le stack local** (deux comptes, deux foyers, sonde jetable supprimée
après coup) :

| Contrôle | Résultat |
|---|---|
| A appelle `seed_default_aisles(<foyer de B>)` | **ACCEPTÉ** — les rayons de B passent de 0 à **11** |
| A fait un `insert` direct dans `aisles` de B | REFUSÉ — `42501` (la RLS, elle, tient) |
| A appelle la fonction sur son propre foyer | ACCEPTÉ, 11 rayons |
| Second appel sur le même foyer | 11 → **11** (idempotence confirmée) |

La RLS n'est pas en cause : `aisles_all` porte `using` **et** `with check`. C'est `security definer`
qui la contourne, par conception — et c'est pour ça qu'une fonction `security definer` à paramètre
d'identité doit toujours recontrôler.

Le trou **existe déjà en production** : cette story ne l'introduit pas, elle est celle qui l'ouvre à
une surface. Elle le referme donc.

**Le correctif prescrit a été éprouvé, pas supposé.** Après application de la garde sur le stack local :

| Contrôle | Résultat |
|---|---|
| Inscription (`create_household_with_profile`) | **ok**, 11 rayons amorcés — la garde ne casse pas l'onboarding |
| A vise le foyer de B | **REFUSÉ — `P0001 Not your household`** ; rayons de B inchangés (11) |
| A ré-amorce son propre foyer | ok, 11 rayons |
| Second appel | 11 → 11 |
| Appel anonyme | REFUSÉ |

Pourquoi l'inscription survit : `create_household_with_profile` insère la ligne `profiles` **avant**
son `perform seed_default_aisles(…)` (`:378-381`), dans la même transaction. `current_household_id()`
lit `profiles` et voit donc l'insertion en cours — la garde passe. Ce n'est pas un raisonnement, c'est
ce que la mesure montre.

> Le stack local a été remis à l'état du dépôt (`npx supabase db reset`) après ces contrôles. Aucune
> de ces fonctions modifiées n'y subsiste : tu repars du schéma versionné.

### Le piège n°2 — les deux variantes qui paraissent plus propres, et pourquoi elles ne le sont pas

**Variante « fonction enveloppe + `revoke` ».** Créer un `amorcer_rayons_par_defaut()` sans paramètre
et révoquer `execute` sur la fonction paramétrée est le réflexe. Elle a été essayée : elle **casse
PostgREST**. L'appel refusé ne rend pas un `42501` propre — il rend `PGRST001 Database client error`,
et les requêtes suivantes tombent sur `Could not query the database for the schema cache`. Reproduit
trois fois, y compris après un rechargement du cache de schéma et un redémarrage du conteneur.

**Variante « garde applicative ».** Se contenter de passer le bon `household_id` depuis l'écran ne
ferme rien du tout : l'appel RPC part du navigateur, et n'importe qui peut en poster un autre. AD-2
est explicite — la règle vit en base, jamais dans la vigilance d'une surface.

Reste la garde **dans** la fonction, à signature identique : rien à révoquer, rien à renommer, aucun
appelant à retoucher, types inchangés, refus propre (`P0001`).

### Le piège n°3 — `sort_order` a un défaut, et il entre en collision

```sql
sort_order int not null default 100   -- 20260502000000_initial_schema.sql:78
```

`seed_default_aisles` amorce `10, 20, … 90, 100, 999`. Le **100 est déjà pris** par « Hygiène &
Entretien ». Un rayon créé en laissant le défaut atterrit donc *au milieu du parcours*, ex æquo avec
un rayon existant — et l'AC1 exige « en fin de parcours ».

D'où `prochainOrdre(rayons) = max(ordre) + 10`. Sur un foyer amorcé, ça donne **1009**, c'est-à-dire
**après « Autre » (999)**. C'est la lecture littérale de l'AC1 ; si Florian préfère que « Autre »
reste le dernier, c'est une décision, pas un correctif à prendre en passant → voir « Questions ».

Corollaire : `sort_order` **n'est pas unique** en base — deux rayons peuvent légalement le partager,
et c'est déjà le cas dès qu'on crée deux rayons sans calcul. D'où le `.order("name")` en second dans
`rayonsDuFoyer` : sans lui, l'ordre d'affichage de deux ex æquo est celui que Postgres veut ce
jour-là, et l'écran « bouge tout seul » d'un rechargement à l'autre.

Réordonner reste la story 2.2. Cette story affiche l'ordre, elle ne le manipule pas.

### Le piège n°4 — `maxLength` coupe les emojis en deux

`maxLength={1}` sur le champ icône compte des **unités UTF-16**, pas des caractères perçus. 🥬 en
occupe 2, un drapeau ou un emoji avec modificateur de teinte jusqu'à 7. La saisie serait tronquée en
un demi-emoji, stocké tel quel, rendu en carré blanc.

```ts
// ❌ coupe au milieu d'une paire de substitution
saisie.slice(0, 1)

// ✅ premier grapheme, quel que soit son nombre d'unités
const segments = new Intl.Segmenter("fr", { granularity: "grapheme" });
const premier = [...segments.segment(saisie)][0]?.segment ?? null;
```

`Intl.Segmenter` est natif (Node 24, tous navigateurs cibles) — **aucune dépendance à ajouter**
(NFR-10). Pose plutôt une borne large sur le champ (`maxLength={8}`) et normalise à la soumission :
borner à 1 dans l'attribut empêche même de *taper* certains emojis.

Pas de sélecteur d'emoji : le clavier du système en a un, et une bibliothèque de picker est une
dépendance que NFR-10 refuse. `icon` est `text` **nullable** — un rayon sans icône est légal, l'écran
doit le rendre sans casse.

### Le piège n°5 — la carte-rayon n'est PAS de cette story

L'envie sera forte : DESIGN.md décrit un composant `carte-rayon`, UX-DR4 le spécifie, et on est sur
l'écran des rayons.

**C'est la story 2.4**, et son AC3 dit précisément pourquoi elle est séparée : le composant reçoit ses
chiffres en propriétés et s'éprouve « sans liste ni base ». Le ratio `n/total` qu'il affiche suppose
des articles — il n'y en a pas avant l'Epic 4.

L'écran 2.1 rend une **liste de lignes éditables**, avec la couche de composants existante (`.card`,
`.input`, `.btn`, `.btn-quiet`, `.hint`, `.notice`, `.titre-ecran`, `.titre-section`). Pas de nouveau
composant partagé, pas de nouvelle classe CSS sans appelant.

### Le piège n°6 — Server Action ou client-direct : le critère est la cause, pas la ressemblance

AD-13 a été reformulé le 2026-07-28, précisément parce que la version d'avant classait par analogie
de vocabulaire. Le critère :

> Une écriture passe par une Server Action si — et seulement si — elle **exige un secret serveur**,
> ou si **sa conséquence doit être visible dans un rendu serveur** (`revalidatePath`).

Les écritures de rayons n'exigent aucun secret. Reste la seconde branche : la conséquence doit-elle
apparaître dans un rendu serveur ? Elle est **locale à l'écran**, et `router.refresh()` la rejoue
depuis un composant client. Donc **client-direct**, exactement comme `DisplayNameForm`.

À contre-exemple : `genererInvitation` est une Server Action *malgré* l'absence de secret, parce que
`/foyer` est rendu côté serveur et que le code doit y apparaître immédiatement. Le vocabulaire
(« émission », « fonction `security definer` ») n'y est pour rien.

⚠️ Conséquence assumée : pas de mise à jour optimiste. Un temps de latence sépare le geste de son
reflet. C'est acceptable ici — l'outbox et l'optimisme d'AD-5 concernent les **surfaces liste**, au
supermarché, pas un écran de configuration au calme.

### Le piège n°7 — le doublon de nom est un refus attendu, pas un plantage

```sql
unique (household_id, name)   -- 20260502000000_initial_schema.sql:81
```

Créer « Boucherie » quand elle existe, ou renommer un rayon vers un nom pris, rend `23505`. Sans
traduction, l'écran affiche « Ça n'a pas marché » sur un cas parfaitement compréhensible, et Florian
retente à l'identique.

L'unicité est **sensible à la casse et aux espaces** : « boucherie » et « Boucherie » coexistent.
`normaliserNomRayon` ne fait que `trim` + retrait des invisibles — **n'ajoute pas de normalisation de
casse** sans décision : elle changerait le comportement d'unicité en base pour tout le produit.

### Le piège n°8 — `db reset` est interdit sur le distant, attendu en local

> ✅ **Refermé pendant la story.** Cette section décrivait un document périmé ; le commit `03a9a09` l'a
> réécrit. Elle est conservée au passé parce que la distinction local/distant, elle, reste vraie et
> vaut d'être lue. Rectifiée par la revue du 2026-07-29 : elle était encore rédigée au présent.

`docs/migrations.md` affirmait, jusqu'au 2026-07-29 : *« Ce qui ne doit jamais servir sur ce projet —
`supabase db reset` … il n'y a pas d'environnement de développement séparé : un seul projet, qui est la
production »*.

**Ce n'était plus vrai** : un stack local existe (`supabase/config.toml` versionné, ports en 5532x), et
`next-steps.md` §2 dit explicitement qu'il « repart de zéro à chaque `db reset` ». Le document a été
mis à jour depuis, dans cette même branche.

- Sur le **local** : `db reset` est l'outil normal pour rejouer la chaîne de migrations. Utilise-le.
- Sur le **distant** : interdit, sans exception. Le seul chemin est `db push`.

Si tu corriges `docs/migrations.md` en passant, dis-le dans le résumé — ce n'est pas un effet de bord
silencieux. Trois documents ont déjà porté une affirmation périmée sur ce projet.

### Ce que la base fait déjà, et qu'il ne faut pas réimplémenter

| Capacité | Où elle vit | Ce que ça implique pour toi |
|---|---|---|
| Les 11 rayons français, icônes et ordre | `seed_default_aisles` (`:330-351`) | Ne recopie **jamais** cette liste dans du TypeScript |
| Isolation des rayons par foyer | `aisles_all`, `using` + `with check` (`:276-278`) | Aucun filtre `household_id` dans tes requêtes |
| Amorçage à la création du foyer | `create_household_with_profile` (`:381`) | Aucun nouveau foyer ne naît sans rayons |
| Articles orphelins après suppression | `grocery_list_items.aisle_id … on delete set null` (`:201`) | Rien à écrire, **et rien à cocher ici** (AC3) |
| Résolution du rayon d'un article | `resolve_aisle_id` (`:466`) | Hors périmètre — Epic 4, story 4.16 |
| Ordre de la liste de courses | vue `grocery_list_by_aisle` (`:216-227`) | Hors périmètre — Epic 4, story 4.2 |

⚠️ **Une conséquence de suppression qui n'est écrite nulle part :**

```sql
aisle_id uuid not null references aisles(id) on delete cascade   -- product_aisle_map, :120
```

Supprimer un rayon **détruit en silence toutes ses règles mot-clé**. Sans portée aujourd'hui — la
story 2.3 n'a pas encore créé la moindre règle — mais dès qu'elle existera, la phrase de confirmation
de la suppression devra le dire. **Consigne-le dans `deferred-work.md` à l'intention de la 2.3.**

### Frontières — ce que cette story ne fait pas

| N'implémente pas | Appartient à |
|---|---|
| Réordonner par glisser / monter-descendre | **Story 2.2** — cette story affiche l'ordre, ne le manipule pas |
| L'écran des règles mot-clé → rayon | **Story 2.3** (`/rayons/regles`, probablement) |
| Le composant carte-rayon, le ratio `n/total` | **Story 2.4** (piège n°5) |
| Afficher la liste de courses groupée par rayon | **Epic 4**, story 4.2 |
| Démontrer que les articles basculent en « À classer » | **Epic 4** — l'AC3 le dit lui-même |
| Le `set search_path` manquant sur `resolve_aisle_id` | *hors périmètre* — la révision d'epic §7 le réserve à la story qui touche cette fonction. Ce n'est pas celle-ci |
| Distinguer Florian de la conjointe sur cet écran | *décision de produit non prise* — voir ci-dessous |
| Realtime sur les rayons | **Epic 4** (AD-8). Ici, l'autre membre voit au rechargement |
| Renommer le foyer | *aucune story ne le couvre* — constat tracé, pas un oubli |
| Un framework de test de composants | **jamais** — NFR-10 interdit la dépendance. La parade reste d'extraire le pur vers `lib/` |

⚠️ **La distinction Florian / conjointe est ouverte, et l'écran l'ignore.** EXPERIENCE.md classe
« Rayons & règles » comme **surface de Florian uniquement**, et bannit « toute notion de
règle/configuration exposée à la conjointe ». Or `profiles` n'a **aucune colonne de rôle** et toute la
RLS passe par `current_household_id()`, qui est **par foyer**. Les deux membres verront donc cet
écran. C'est une décision de produit non prise (`sprint-status.yaml`, action ouverte de l'Epic 2), pas
un trou à combler ici. **N'invente pas un contrôle d'accès applicatif** : il serait faux (contournable
à un appel RPC près) et contredirait AD-2.

### Microcopy (UX-DR12, NFR-8, NFR-9)

Tutoiement, registre familier. **Mots bannis :** synchronisation, jeton/token, API, MCP, pont,
Supabase, RLS, cache.

| Situation | Écris quelque chose comme | N'écris jamais |
|---|---|---|
| Titre de l'écran | « Tes rayons » | « Gestion des rayons » |
| Sous-titre | « L'ordre où tu traverses ton magasin. » | « Configuration du tri » |
| État vide | « Il n'y a plus aucun rayon. » | « Aucun élément à afficher » |
| Invite de l'état vide | « Ajoutes-en un, ou remets ceux de départ. » | « Veuillez créer une entrée » |
| Bouton de restauration | « Remettre les rayons de départ » | « Réinitialiser » / « Seed » |
| Champ nom | « Nom du rayon » | « Libellé » |
| Champ icône | « Un emoji » | « Icône (optionnel) » |
| Nom en doublon | « Ce rayon existe déjà. » | « Contrainte d'unicité violée » |
| Nom vide | « Il faut un nom. » | « Le champ est requis » |
| Avant suppression | « Ce rayon disparaît. » | « Cette action est irréversible » |
| Échec générique | « Ça n'a pas marché. Réessaie dans un instant. » | le message d'erreur brut |
| Confirmation | « C'est noté. » | « Enregistré avec succès » |

**Pas d'abricot sur cet écran.** UX-DR2 le réserve à l'action courses. Configurer ses rayons n'en est
pas une — c'est de la préparation. Le seul usage légitime reste l'anneau de focus, qui est déjà une
règle globale. `.btn-primaire` est le bouton principal (aplat neutre inversé), pas un aplat abricot.

**DESIGN.md ne spécifie pas cet écran** — il place explicitement « l'écran des rayons/règles
(FR-11/12/13) » hors de son périmètre : *« ils héritent des tokens ci-dessus mais leur composition
n'est pas spécifiée ici »* (`DESIGN.md:329`). Compose donc avec ce qui existe, à l'image de `/foyer`.
N'invente pas un langage visuel, et ne réclame pas une maquette qui n'existe pas.

### Contraintes d'architecture applicables

- **AD-1 / AD-2** — la règle métier vit en Postgres. Le contrôle d'accès de la Task 1 va **en base**,
  jamais dans l'écran. Jamais de `SUPABASE_SERVICE_KEY`
- **AD-13** — client-direct pour ces écritures (piège n°6). Next reste une coquille
- **AD-16** — rayons partagés entre tous les membres du foyer (FR-43)
- **AD-17** — l'isolation se prouve par un test exécuté, pas par une lecture. D'où la Task 9
- **AR-MIGRATIONS** — migrations strictement additives ; un fichier appliqué ne se modifie jamais ;
  horodatage postérieur à toutes les migrations existantes ; quatre questions dans la PR
- **UX-DR11** — cibles ≥ 44px, contraste AA sur les fonds réels, anneau de focus visible,
  `prefers-reduced-motion`, tenue à 200 % de zoom sans défilement horizontal
- **UX-DR12** — tutoiement, mots bannis, `tabular-nums` sur tout chiffre
- **NFR-8** — jamais un message technique brut. `error.tsx` est le dernier filet, pas le premier
- **NFR-10** — **aucune dépendance nouvelle**. Ni bibliothèque de glisser-déposer (c'est 2.2 de toute
  façon), ni sélecteur d'emoji, ni gestionnaire de formulaire

### Standards de test

Trois familles, et elles ne se remplacent pas :

1. **`npm test`** — `node:test`, glob `lib/**/*.test.ts`. Couvre le **pur** : `normaliserNomRayon`,
   `normaliserIcone`, `prochainOrdre`, `refusRayon`. 49 tests aujourd'hui, tous verts
2. **`npm run test:isolation`** — glob `supabase/tests/**`, exige un stack local debout, **lève** s'il
   est absent plutôt que de passer en silence. 11 tests aujourd'hui. C'est là que va la preuve du
   correctif de la Task 1
3. **Le manuel** — le JSX reste intestable sans dépendance (NFR-10). Les deux thèmes, les cinq
   gestes, le focus clavier : rien d'automatisable, et c'est la seule famille qui a attrapé les trois
   défauts du 2026-07-29

**Pas de TDD sur le JSX** — il n'y a pas de harnais pour ça et la story n'en introduit pas. Sur
`lib/`, en revanche, le test précède l'usage : c'est ce que permet l'extraction du pur.

### Project Structure Notes

```
app/
  page.tsx                    ~  + lien vers /rayons, phrase d'annonce à corriger
  rayons/
    page.tsx                  +  Server Component : requireProfile + rayonsDuFoyer
    ListeRayons.tsx           +  "use client" — CRUD client-direct + router.refresh()
lib/
  rayons/
    rayons.ts                 +  type Rayon, rayonsDuFoyer(supabase)
    saisie.ts                 +  normaliserNomRayon, normaliserIcone, prochainOrdre
    saisie.test.ts            +
    erreurs.ts                +  refusRayon — 23505 → "nom-pris"
    erreurs.test.ts           +
  foyer/saisie.ts             ~  exporter INVISIBLES (ou l'extraire) plutôt que la recopier
  supabase/types.ts           ~  régénéré — diff attendu : aucun
supabase/
  migrations/
    <ts>_guard_seed_default_aisles.sql        +  garde d'identité (piège n°1)
    <ts>_require_non_blank_aisle_name.sql     +  check btrim(name) <> ''
  tests/isolation.test.ts     ~  + tests de rayons (Task 9)
app/globals.css               INCHANGÉ — la couche de composants suffit. Une classe sans appelant
                                 est une dette, pas une fondation
proxy.ts                      INCHANGÉ — le matcher garde déjà /rayons (piège : ne l'« améliore » pas)
package.json                  INTACT — aucune dépendance
```

### Intelligence des stories précédentes

- **Trois défauts en deux jours ont le même motif** : une déduction consignée comme vérifiée, puis
  réemployée comme fondation. Le troisième a atteint le déploiement (`engines: ">=25.0.0"`, CI verte,
  production morte). D'où la règle du Task 10 : la commande, ou le mot « déduit »
- **Deux constats consignés « traités » par une passe de revue ne l'étaient pas** — `autoFocus` (0 sur
  3) et « tu cliques, tu es connecté ». Aucune des quatre portes ne pouvait les voir : seul le
  parcours visuel les a trouvés. C'est pourquoi la Task 10 exige de regarder l'écran
- **Un commentaire explique un *pourquoi*, jamais un état de la base.** Trois commentaires sont
  devenus faux, dont deux écrits pendant une revue. Si un état doit être écrit, il porte sa date et le
  fichier qui fait foi
- **Une case vide honnête vaut mieux qu'une case cochée à tort.** Les stories 1.5, 1.6 et 1.7 ont
  laissé des sous-tâches non cochées avec leur raison écrite ; la revue l'a préféré à chaque fois
- **Motifs à reprendre plutôt qu'à réinventer** : `DisplayNameForm.tsx` (écriture client-direct,
  contrôle de `data` autant que d'`error`, `router.refresh()`), `InviteCard.tsx` (confirmation en deux
  temps, région de statut unique hissée hors du conditionnel), `membres.ts` / `foyer.ts` (lecture avec
  client en paramètre), `lib/foyer/erreurs.ts` (SQLSTATE d'abord, texte en repli), `useSoumission`
- **Piège d'outillage connu** : après suppression d'une route, `npm run typecheck` échoue sur un
  validateur périmé sous `.next/` — purger `.next` avant de conclure à une régression. Et purger
  `.next` pendant qu'un serveur de développement tourne le laisse répondre `Internal Server Error` sur
  tout : il faut le redémarrer
- **Piège d'outillage n°2** : `npm run build | grep …` ne rend jamais la main. Rediriger vers un fichier
- **Décision de Florian, en vigueur depuis l'Epic 2** : **revue adversariale par story**, plus en fin
  d'epic. Trois des six défauts majeurs de l'Epic 1 ont été introduits par une passe de revue et
  attrapés par la suivante

### Intelligence git

`eae9121` est la base — **`main`, propre**, aucune PR ouverte. C'est le commit de la révision d'epic
(`docs(epic-2)`), qui ne touche aucun code : le dernier commit de code est `4ee719a` (clôture de
l'Epic 1, PR #12). Branche directement depuis `main`.

Convention : **Conventional Commits**, corps en français ; branche dédiée → PR → **squash merge** CI
verte. La CI rejoue `typecheck`, `lint`, `build` sur **Node 24** (`engines: "24.x"` et `.node-version`
épinglés le 2026-07-29 — ne les touche pas).

⚠️ **Les quatre portes ne voient pas le déploiement.** `typecheck`, `lint`, `test` et `build` tournent
sur le runtime du poste ; Vercel en construit un autre, avec ses propres plafonds. Toute modification
de `package.json` `engines`, `.node-version` ou `next.config.ts` se contrôle **sur le déploiement de la
PR**. Cette story ne devrait toucher aucun des trois.

**Le serveur de développement écoute sur le port 3333.**

Sept migrations existent, **toutes appliquées en production** (`supabase migration list` rendait local
== distant le 2026-07-29). Les tiennes seront la huitième et la neuvième.

### Informations techniques

Versions installées, **à ne pas bouger** : `next@16.2.12`, `react@19.2.8`, `tailwindcss@4.3.3`
(+ `@tailwindcss/postcss@4.3.3`), `typescript@6.0.3`, `@supabase/ssr@0.12.3`,
`@supabase/supabase-js@2.110.8`, `eslint@9.39.5` (**ne pas monter en 10**). Node 24.

- **Tailwind 4 n'a pas de fichier de configuration** et il ne faut pas en créer un. Tout est en CSS,
  via `@theme` / `@theme inline`. `dark:` suit `prefers-color-scheme` par défaut — aucune bascule
  manuelle à écrire
- **La palette Tailwind par défaut est neutralisée** (`--color-*: initial`). `bg-red-500`,
  `text-gray-400`, `bg-white` **ne génèrent plus rien** et échouent en silence. Toute couleur employée
  doit être un token de DESIGN.md
- **`Intl.Segmenter`** est natif partout où ce produit tourne — c'est la réponse au piège n°4, sans
  dépendance
- **Aucune bibliothèque nouvelle n'est requise.** Si tu ressens le besoin d'en ajouter une, relis
  NFR-10 : la réponse est dans ce qui existe déjà

### Environnement de test

Le stack local est **debout et à jour** au moment où cette story est écrite (`npx supabase status`
répond, sept migrations appliquées, base remise à zéro après les sondes). Ports en 5532x
(`supabase/config.toml` versionné) : API `55321`, base `55322`, Studio `55323`, courriels `55324`.

`npx supabase start` s'il ne répond pas. `npx supabase db reset` pour rejouer la chaîne — en local
seulement (piège n°8).

C'est l'environnement qui permet enfin de voir `/onboarding`, jamais relu dans les deux thèmes faute
d'un compte sans profil. **Hors périmètre de cette story**, mais l'occasion est là si tu crées un
compte de test : dis-le, ça ferme une action de l'Epic 1.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.1] — user story et 5 AC, cités verbatim
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-2] — objectif révisé, ce qui a bougé
- [Source: _bmad-output/planning-artifacts/epic-2-revision-2026-07-29.md] — §2 (ce qui existe déjà,
  story par story), §5 D1 (suppression de l'ancienne 2.1), §7 (`resolve_aisle_id` sans `search_path`,
  hors périmètre ici)
- [Source: …/ARCHITECTURE-SPINE.md#Invariants] — AD-1, AD-2, AD-13 (critère de cause), AD-16, AD-17
- [Source: _bmad-output/planning-artifacts/epics.md#UX-Design-Requirements] — UX-DR2, UX-DR4
  (carte-rayon → story 2.4), UX-DR11, UX-DR12
- [Source: …/ux-designs/ux-nutriclaude-2026-07-22/DESIGN.md] — frontmatter = source unique des tokens ;
  **§ Lacunes : l'écran des rayons est hors périmètre de composition**
- [Source: …/ux-designs/ux-nutriclaude-2026-07-22/EXPERIENCE.md] — Information Architecture (« Rayons &
  règles »), Voice and Tone, Accessibility Floor (emoji `aria-hidden`, focus, cibles)
- [Source: supabase/migrations/20260502000000_initial_schema.sql] — `aisles` (`:74-84`),
  `product_aisle_map` (`:115-127`), `aisles_all` (`:276-278`), `seed_default_aisles` (`:330-351`),
  `create_household_with_profile` (`:353-385`), vue `grocery_list_by_aisle` (`:216-227`)
- [Source: supabase/migrations/20260729094500_grant_table_privileges.sql] — `execute` accordé à
  `authenticated` sur toutes les fonctions ; c'est la moitié du piège n°1
- [Source: docs/migrations.md] — nommage, additivité, cycle, quatre questions de revue. ⚠️ sa section
  « Ce que ce projet n'a pas » est périmée (piège n°8)
- [Source: _bmad-output/implementation-artifacts/next-steps.md#4] — les sept règles d'équipe à
  appliquer dès cette story
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — pièges d'outillage, choix assumés
- [Source: _bmad-output/implementation-artifacts/1-7-…md] — Tailwind 4, palette neutralisée, motif de
  vérification visuelle des deux thèmes
- **Mesures exécutées le 2026-07-29 sur le stack local** — sondes jetables, supprimées après coup ;
  base remise à l'état du dépôt par `npx supabase db reset`

## Questions pour Florian

Aucune ne bloque le démarrage — le comportement par défaut est prescrit dans les tâches. Elles se
tranchent avant la revue.

1. **Un rayon créé passe-t-il après « Autre » ?** `prochainOrdre` = `max + 10` donne 1009, et « Autre »
   (📦, `sort_order` 999) est le fourre-tout de fin de parcours. La lecture littérale de l'AC1 (« en
   fin de parcours ») dit oui ; l'intention dit peut-être « juste avant Autre ». **Prescrit : après**,
   parce que c'est ce que l'AC écrit et que la story 2.2 rend le sujet trivial à corriger à la main.
2. **Le bouton « Remettre les rayons de départ » doit-il exister hors de l'état vide ?** L'AC5 ne le
   demande que là. **Prescrit : état vide uniquement.** L'ouvrir partout est une ligne de code le jour
   où tu le veux.
3. **La contrainte `check` sur `aisles.name` (Task 2) te va-t-elle ?** C'est la troisième du même
   motif. Elle n'est appelée par aucun AC — c'est une cohérence, pas une exigence. **Prescrit :
   oui**, avec sa requête de contrôle.
4. **La distinction Florian / conjointe reste ouverte** (action de l'Epic 2 dans `sprint-status.yaml`).
   Cet écran sera visible des deux membres. Rien à faire ici, mais c'est la première story où
   l'asymétrie promise par EXPERIENCE.md ne tient pas — tu voudras peut-être la trancher avant la 2.3,
   qui porte les « règles », c'est-à-dire exactement ce que le test d'acceptation dit de ne jamais
   exposer.

## Dev Agent Record

### Agent Model Used

claude-opus-5

### Debug Log References

#### Vérification (2026-07-29)

Toutes les commandes ci-dessous ont été **exécutées** sur l'arbre final. Ce qui n'a pas été exécuté
est marqué « déduit ».

| Commande | Résultat |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` (`--max-warnings 0`) | exit 0, **0 avertissement** |
| `npm run test` | **66/66** (49 existants + 17 nouveaux), 0 échec |
| `npm run build` | exit 0 ; `/rayons` construite en **ƒ (dynamique)**, comme les autres routes lisant les cookies |
| `npm run test:isolation` | **17/17** (11 existants + 6 nouveaux), 0 échec |
| `npx supabase db reset` | les 9 migrations rejouées, dont les deux nouvelles |
| `git status --short supabase/` | 2 migrations ajoutées, aucune existante modifiée |
| `git diff package.json package-lock.json` | **vide — aucune dépendance ajoutée** (NFR-10) |

**Le trou d'isolation, mesuré avant correctif.** Deux comptes, deux foyers, sur le stack local :

| Contrôle | Avant la migration | Après |
|---|---|---|
| A appelle `seed_default_aisles(<foyer de B>)` | **ACCEPTÉ** — rayons de B : 0 → **11** | **REFUSÉ**, `P0001 Not your household`, B inchangé |
| A fait un `insert` direct dans `aisles` de B | REFUSÉ `42501` (la RLS tient) | idem |
| Inscription (`create_household_with_profile`) | ok, 11 rayons | **ok, 11 rayons** — la garde ne casse pas l'onboarding |
| A ré-amorce son propre foyer | ok | ok |
| Second appel (idempotence) | 11 → 11 | 11 → 11 |
| Appel anonyme | — | REFUSÉ |

**Les dents du nouveau test ont été vérifiées.** La garde retirée à la main de la base locale, la
suite tombe de **17/17 à 16/17**, et le test qui tombe est exactement « A ne peut pas amorcer les
rayons du foyer de B ». La base a ensuite été remise à l'état du dépôt par `db reset`, et la suite
est repassée à 17/17.

**Types.** `supabase gen types` a été rejoué (`--linked` **et** `--local`). Les sept signatures du
schéma `public` et le bloc `aisles` sont **identiques**, au caractère près, à `lib/supabase/types.ts`
committé — la garde ne change pas la signature, la contrainte `check` ne change pas la forme du
schéma. Le fichier n'est donc **pas** modifié par cette story. Le seul écart rendu par le CLI est un
bloc `graphql_public` et une ligne `PostgrestVersion`, sans rapport avec ce travail : ne pas le
commiter mêlerait une montée de version du CLI à une story de fonctionnalité.

#### Parcours à l'écran (2026-07-29)

Mené **sur le stack local**, jamais en production — c'est la règle posée par la rétrospective de
l'Epic 1. `.env.local` a été basculé vers `http://127.0.0.1:55321`, contrôlé (le bundle servi au
navigateur ne contient **aucune** référence au projet de production), puis **restauré à l'identique**
(`diff` vide).

Compte de contrôle créé par le vrai chemin : lien magique → Mailpit → `/auth/callback` →
`/onboarding` → création du foyer « Foyer de contrôle 2.1 ».

| Geste | Résultat observé |
|---|---|
| Ouvrir `/rayons` | les 11 rayons amorcés, dans l'ordre du parcours, emoji + nom |
| **Créer** « Traiteur » avec 🧑‍🍳 | créé en fin de liste ; en base `sort_order = **1009**` (= 999 + 10) et `icon` de **3 points de code** — la séquence à jointure a survécu entière |
| **Renommer + ré-iconifier** en « Traiteur & plats » / 🍱 | persisté, panneau refermé, « C'est noté. » |
| **Doublon** : créer « Boucherie » | « **Ce rayon existe déjà.** », aucun rayon ajouté (12 avant, 12 après), et **la saisie est conservée** pour être corrigée |
| **Supprimer** avec confirmation en deux temps | premier clic → « Confirmer » / « Non » + « Ce rayon disparaît de ton parcours. » ; confirmation → « Le rayon est parti. » |
| **État vide** (AC4) | « Il n'y a plus aucun rayon. » + invite + bouton de restauration. Ni page blanche, ni message technique |
| **Restaurer** (AC5) | « Les rayons de départ sont revenus. », les 11 rayons français reviennent |

**Les deux thèmes**, bascule au **réglage d'apparence macOS** (le thème suit `prefers-color-scheme`,
`globals.css:68` — la bascule système est donc le vrai contrôle, pas une émulation). L'état initial
était *clair* ; il a été **remis en clair** après.

| Écran | Clair | Sombre |
|---|---|---|
| `/rayons`, liste des 11 rayons | ✅ | ✅ |
| Panneau d'édition (deux champs, trois boutons) | ✅ | ✅ |
| Anneau de focus au clavier (Tab) | ✅ | ✅ — abricot `#FFA94D`, 2px + dégagement |
| État vide + bouton de restauration | ✅ | **déduit**, non observé — voir ci-dessous |

En sombre, le fond porte sa base aubergine avec le halo terracotta en haut-gauche et le prune en
bas-droite ; les séparateurs de lignes restent lisibles, et **aucun abricot n'apparaît ailleurs que
sur l'anneau de focus** (UX-DR2).

**Ce qui n'est PAS vérifié à l'écran, et pourquoi :**

- **L'état vide en thème sombre.** Il n'emploie que `.btn`, `text-base` et `.hint`, tous vus rendus
  en sombre sur ce même écran — c'est une **déduction solide, pas une observation**, et elle est
  écrite comme telle plutôt que cochée.
- **Le comportement à deux membres simultanés.** Il n'y a pas de propagation temps réel avant
  l'Epic 4 (AD-8) : l'autre membre voit au rechargement. Non observé, et hors périmètre.

#### Contrôles de forme

| Contrôle | Résultat |
|---|---|
| Mots bannis (NFR-9) dans les chaînes rendues | **aucun** — 115 chaînes extraites hors commentaires, toutes passées au crible |
| Palette Tailwind par défaut (`bg-red-*`, `text-gray-*`, `bg-white`…) | **aucune occurrence** |
| `outline-none`, `autoFocus`, `window.confirm`, `force-dynamic` | **aucun** (la seule occurrence de `window.confirm` est un commentaire expliquant pourquoi on ne l'emploie pas) |
| Cibles tactiles | `min-h-11` (44px) sur chaque ligne, chaque champ et chaque bouton |

### Completion Notes List

**Les dix tâches sont livrées.** Deux migrations additives, aucune migration existante modifiée,
aucune dépendance ajoutée, `lib/supabase/types.ts` inchangé et le fait vérifié plutôt que supposé.

**Le fait central de cette story n'est pas l'écran, c'est ce que l'écran a révélé.** `epics.md`
affirmait « Rien n'est à écrire côté base : seul l'appel manque ». C'était faux :
`seed_default_aisles` est `security definer`, reçoit le foyer **en paramètre**, ne le confronte à
rien, et `execute` est accordé à `authenticated`. Le membre du foyer A pouvait écrire onze rayons
chez B — mesuré, deux comptes, avant/après. Le défaut est **antérieur à l'Epic 2** et vit en
production depuis le squelette ; il était sans portée tant qu'aucune surface n'appelait la fonction.
Cette story est la première à le faire, donc la première à devoir le refermer.

**La règle générale qui en sort, et qui vaut au-delà d'ici :** une fonction `security definer` qui
reçoit une identité en paramètre doit la recontrôler elle-même. La RLS ne la couvre pas — c'est tout
l'intérêt de `security definer` — et c'est exactement ce qui rendait le trou invisible aux onze tests
d'isolation existants, qui portent tous sur des **tables**. Les six nouveaux couvrent les appels
**RPC**.

**La variante qu'on écrit d'instinct ne marche pas.** Fonction enveloppe sans paramètre + `revoke
execute` sur la fonction paramétrée : PostgREST rend alors `PGRST001 Database client error` puis perd
son cache de schéma pour les requêtes suivantes. Reproduit trois fois, y compris après un
`notify pgrst, 'reload schema'` et un redémarrage du conteneur. La garde à signature identique évite
tout cela — et n'oblige ni à retoucher un appelant, ni à régénérer les types.

**Le piège des emojis est réel, pas théorique.** `maxLength={1}` et `slice(0, 1)` comptent des unités
UTF-16 ; et la plage d'invisibles de `lib/texte.ts` contient U+200D (ZWJ), qui est porteur de sens
dans un emoji. Normaliser une icône comme un nom couperait 🧑‍🍳 en 🧑. D'où
`INVISIBLES_HORS_JOINTURE` et `Intl.Segmenter`. Vérifié à l'écran et **en base** : l'icône créée
depuis le navigateur y est stockée sur ses 3 points de code.

**`sort_order` avait un piège que le défaut de colonne masquait.** Il vaut `100`, et 100 est déjà
pris par « Hygiène & Entretien » : un rayon créé sans calcul serait tombé au milieu du parcours, ex
æquo. `prochainOrdre` calcule `max + 10` — d'où 1009, soit après « Autre » (999). C'est la lecture
littérale de l'AC1 ; la question est posée à Florian plutôt que tranchée en silence.

**Une extraction faite, et seulement parce que la story la demandait.** La plage d'invisibles et la
règle de normalisation vivent désormais dans `lib/texte.ts`, `lib/foyer/saisie.ts` y déléguant. Les
49 tests existants passent sans modification — c'est ce qui prouve que le comportement n'a pas bougé.

**Écart de méthode assumé — TDD sur `lib/` uniquement.** Les 17 tests de `lib/rayons/` ont été écrits
**avant** l'implémentation, et leur échec constaté (phase rouge : 49 passants, 2 fichiers en échec de
chargement) avant d'écrire une ligne. Le JSX reste intestable sans dépendance (NFR-10) : il est
couvert par le parcours manuel, pas par un test.

**Deux choses corrigées hors du strict périmètre, parce qu'elles mentaient.** La phrase d'accueil
« Les courses, les recettes et le menu arrivent. » est devenue partiellement fausse dès lors que les
rayons existent — c'est le défaut que les stories 1.6 puis 1.7 ont laissé passer deux fois. Et
`epics.md` comme la révision d'epic portaient l'affirmation « rien à écrire côté base » / « couverts
par les tests d'isolation » : les deux sont rectifiées sur place, datées, avec le constat.

**Un piège d'outillage nouveau, coûteux, et invisible à l'écran** : Next 16 bloque ses ressources de
développement en cross-origin. Naviguer sur `127.0.0.1:3333` quand le serveur annonce
`localhost:3333` empêche l'hydratation — les formulaires partent alors en GET natif, et **rien ne le
dit dans le navigateur**, seulement dans la sortie du serveur. Consigné dans `deferred-work.md`.

### File List

**Nouveaux**
- `supabase/migrations/20260729095922_guard_seed_default_aisles.sql` — garde d'identité, signature inchangée
- `supabase/migrations/20260729095923_require_non_blank_aisle_name.sql` — `check (btrim(name) <> '')`
- `lib/texte.ts` — `INVISIBLES`, `INVISIBLES_HORS_JOINTURE`, `normaliserTexte`
- `lib/rayons/rayons.ts` — type `Rayon`, `rayonsDuFoyer`
- `lib/rayons/saisie.ts` — `normaliserNomRayon`, `normaliserIcone`, `prochainOrdre`, `MAX_NOM_RAYON`
- `lib/rayons/saisie.test.ts` — 12 tests
- `lib/rayons/erreurs.ts` — `refusRayon` (23505 / 23514, code puis texte)
- `lib/rayons/erreurs.test.ts` — 5 tests
- `app/rayons/page.tsx` — Server Component
- `app/rayons/ListeRayons.tsx` — écritures client-direct + `router.refresh()`

**Nouveaux — chaîne de livraison** *(commit `03a9a09`, ajouté à cette liste par la revue du
2026-07-29 : ils en étaient absents alors qu'ils changent la façon dont ce projet écrit dans sa base
de production)*
- `vercel.json` — `buildCommand` : construire, puis appliquer les migrations
- `scripts/migrer-au-deploiement.mjs` — application des migrations au déploiement de production

**Modifiés**
- `lib/foyer/saisie.ts` — délègue à `lib/texte.ts` ; comportement inchangé, 49 tests existants au vert
- `app/page.tsx` — lien vers `/rayons`, phrase d'annonce corrigée
- `supabase/tests/isolation.test.ts` — 6 tests de rayons, dont les appels RPC
- `docs/migrations.md` — le cycle passe par le déploiement ; section « Ce que ce projet a, et n'a
  pas » réécrite *(absent de cette liste jusqu'à la revue du 2026-07-29)*
- `.github/pull_request_template.md` — la fusion applique la migration *(idem)*
- `_bmad-output/planning-artifacts/epics.md` — correction datée de l'AC5 de la story 2.1
- `_bmad-output/planning-artifacts/epic-2-revision-2026-07-29.md` — correction datée du §6
- `_bmad-output/implementation-artifacts/deferred-work.md` — entrée de la story 2.1
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — statut

**Inchangés, vérifiés**
- `lib/supabase/types.ts` — régénéré et comparé : **aucun écart** sur le schéma `public`
- `proxy.ts` — le matcher garde déjà `/rayons`, rien à ajouter
- `app/globals.css` — la couche de composants existante a suffi, aucune classe ajoutée
- `next.config.ts`, `package.json`, `package-lock.json` — intacts
- `.env.local` — basculé vers le stack local pour le parcours visuel, **restauré à l'identique**

## Change Log

| Date | Changement |
|---|---|
| 2026-07-29 | Story créée. Statut → `ready-for-dev`. Trou d'isolation de `seed_default_aisles` découvert et mesuré sur le stack local ; correctif prescrit éprouvé par exécution ; `epics.md` AC5 (« rien à écrire côté base ») contredit sur pièce |
| 2026-07-29 | `epics.md` et `epic-2-revision-2026-07-29.md` rectifiés sur place, datés, avec le constat |
| 2026-07-29 | **Décision de Florian : plus de poussée manuelle de migration.** Les deux migrations de cette story partiront avec la fusion, appliquées par le déploiement Vercel. `docs/migrations.md`, le gabarit de PR et la Task 3 rectifiés en conséquence |
| 2026-07-29 | Implémentation : 2 migrations additives, `lib/texte.ts` + `lib/rayons/`, écran `/rayons`, lien depuis l'accueil, 6 tests d'isolation. Quatre portes vertes, 66/66 unitaires, 17/17 isolation, dents du nouveau test vérifiées. Parcours à l'écran sur le stack local : les cinq gestes et les deux thèmes. Statut → `review` |

## Review Findings

_Revue adversariale du 2026-07-29 — trois couches (Blind Hunter, Edge Case Hunter, Acceptance Auditor) sur `git diff main...HEAD`. Sévérité assignée après lecture du code aux emplacements cités, pas depuis les hunks._

### Décisions à prendre

_Les cinq tranchées par Florian le 2026-07-29, en séance de revue. La résolution retenue ouvre le correctif indiqué._

- [x] [Review][Decision] → **Protéger `main`, `verify` et `isolation` requis.** **`main` n'est pas protégée — les migrations de production ne sont gardées que par `next build`** — `gh api repos/:owner/:repo/branches/main/protection` rend `404 Branch not protected`. `vercel.json:3` fait `npm run build && node scripts/migrer-au-deploiement.mjs` : Vercel démarre le déploiement de production dès qu'un commit atteint `main`, sans attendre GitHub Actions. `typecheck`, `lint` et `test` ne sont donc dans aucun chemin qui puisse empêcher une écriture dans le schéma de production. Seul `next build` l'est. Avant ce commit, la seule porte vers la production était un geste humain ; elle est maintenant plus faible que les quatre portes que le projet croit avoir.
- [x] [Review][Decision] → **Job `isolation` dédié dans la CI, requis pour la fusion.** **Les 17 tests d'isolation ne tournent dans aucune CI** — `.github/workflows/ci.yml` lance `typecheck`, `lint`, `npm test` et `build`. `npm run test:isolation` n'y figure pas, et le glob de `npm test` (`lib/**/*.test.ts`) s'arrête avant `supabase/tests/`. Les six tests qui prouvent la garde de `seed_default_aisles` — la raison d'être de cette story — ne s'exécutent que si quelqu'un pense à lancer `npx supabase start` sur son poste. AD-17 dit « l'isolation se prouve par un test exécuté » : ces tests existent et ne s'exécutent jamais tout seuls. Un futur `create or replace function seed_default_aisles(...)` rouvrirait le trou avec les quatre portes au vert.
- [x] [Review][Decision] → **Écrire la règle : toute relecture d'un écran qui écrit se fait sur le stack local, jamais sur la prévisualisation** (`docs/migrations.md` + gabarit de PR). **La prévisualisation de cette PR écrit dans la base de production** — `scripts/migrer-au-deploiement.mjs:65-71` sort en 0 hors production, et `docs/migrations.md` explique pourquoi : « les prévisualisations partagent la base de production — il n'existe qu'un seul projet Supabase ». Conséquence non énoncée : relire `/rayons` sur la prévisualisation, c'est créer et supprimer de **vrais** rayons de production, contre une base où ni la garde ni la contrainte `check` ne sont encore appliquées. L'AC5 ne peut pas être démontrée sur la prévisualisation sans toucher la production.
- [x] [Review][Decision] → **Accepter le mécanisme, restreindre la portée** : `SUPABASE_DB_URL` déclarée pour le seul environnement Production de Vercel, et `docs/migrations.md` dit ce que ce secret contourne (la RLS, donc NFR-5). **Le secret de la base de production entre dans le conteneur de build Vercel** — `scripts/migrer-au-deploiement.mjs:73` lit `SUPABASE_DB_URL` : une URI Postgres avec mot de passe, rôle `postgres`, qui **traverse la RLS de bout en bout**. Tout le raisonnement NFR-5 du dépôt repose sur la RLS ; ce secret la contourne par construction, et il vit désormais là où `npm ci` exécute les `postinstall` de l'arbre de dépendances. S'y ajoute `npx --yes supabase@2.110.0` (`:109-113`) : un binaire hors `package-lock.json`, téléchargé à chaque build, exécuté contre la production.
- [x] [Review][Decision] → **(a) état vide uniquement, inchangé** — l'arête est consignée dans `deferred-work.md` à l'intention de la story 2.2 ; **(b) `.normalize("NFC")` ajouté dans `normaliserTexte`, la casse reste ouverte.** **Deux questions de la story que la revue rouvre sur pièce** — (a) le bouton de restauration n'existe qu'à zéro rayon (`ListeRayons.tsx:228-242`) : supprimer dix des onze rayons laisse un état où le seul moyen de réparer est de supprimer le onzième, l'ordre du parcours étant définitivement perdu avant la story 2.2 ; (b) l'unicité `(household_id, name)` est sensible à la casse — « boucherie » et « Boucherie » coexistent — et `normaliserTexte` ne fait aucun `.normalize("NFC")`, donc deux noms identiques à l'œil en NFC et NFD coexistent aussi, sans qu'aucun `23505` ne prévienne.

### Correctifs

- [x] [Review][Patch] **Le message du formulaire de création s'affiche hors écran** [app/rayons/ListeRayons.tsx:220] — la région de statut unique est rendue en tête de la première section, le formulaire de création vit dans une seconde section `mt-12` **après** onze lignes de ≥44px. « Ce rayon existe déjà. » comme « C'est noté. » apparaissent au-dessus de la zone visible au moment où l'on presse « Ajouter » : à l'écran, le champ reste rempli, le bouton redevient actif, rien ne se passe. `DisplayNameForm.tsx:122-124` fait l'inverse — sa `Notice` est juste au-dessus de son bouton. L'argument de la région unique (hérité d'`InviteCard`) est bon, mais il confond « une seule région annoncée » et « une seule région pour trois surfaces de soumission à trois endroits de la page ».
- [x] [Review][Patch] **Zéro ligne touchée : la ligne fantôme reste, et « Réessaie dans un instant » est un faux conseil** [app/rayons/ListeRayons.tsx:152-155, 175-178] — la branche `if (error || !data)` retourne **sans** `router.refresh()` ni `fermer()`. Si la conjointe a supprimé « Boucherie » depuis son téléphone, l'enregistrement ou la suppression de Florian rend `{data: null, error: null}` (zéro ligne n'est pas une erreur pour PostgREST), affiche « Ça n'a pas marché. Réessaie dans un instant. », garde la ligne à l'écran et le panneau ouvert — chaque nouvel essai reproduit le même échec, indéfiniment, jusqu'à un rechargement manuel. Le commentaire `:147-151` avait identifié qu'il fallait lire `data`, puis l'a rangé avec les vraies erreurs. Correctif : distinguer `!data && !error`, appeler `router.refresh()` et dire « Ce rayon n'existe plus. ».
- [x] [Review][Patch] **Le focus est perdu à chaque ouverture et fermeture du panneau** [app/rayons/ListeRayons.tsx:247, 309, 367] — le `<button>` porteur du focus est démonté et remplacé par un `<form>` ; le focus retombe sur `<body>`. Au clavier, il faut repartir de `Tab` depuis le haut de la page et retraverser tous les rayons précédents. Idem sur « Annuler » et après un enregistrement réussi. Aucun `ref`, aucune gestion de focus dans le fichier. Ce n'est pas ce que l'interdiction d'`autoFocus` visait : déplacer le focus en réponse à un geste explicite est autre chose que le voler au chargement.
- [x] [Review][Patch] **Le champ icône réduit « Fromages » à « F » en silence** [app/rayons/ListeRayons.tsx:397-399, lib/rayons/saisie.ts:32-39] — le champ icône est le **premier** des deux, son libellé est `sr-only`, et il ne reste à l'écran que le placeholder `🥬`. Y taper le nom du rayon par méprise enregistre son initiale, sans libellé, sans indice, sans message. `normaliserIcone` accepte n'importe quel premier grapheme, y compris une lettre ou un caractère de contrôle.
- [x] [Review][Patch] **Les deux en-têtes de migration prescrivent un contrôle « AVANT `db push` » qui n'a plus de moment** [supabase/migrations/20260729095922_guard_seed_default_aisles.sql:3-9, 20260729095923_require_non_blank_aisle_name.sql:3-13] — les deux demandent d'exécuter une requête dans le SQL Editor avant de pousser. Le commit `03a9a09` de la **même branche** a supprimé le `db push` humain : « plus aucune migration n'est poussée à la main ». Aucun de ces deux contrôles ne sera donc exécuté. C'est exactement la classe de défaut que la story elle-même consigne (« trois commentaires sont devenus faux, dont deux écrits pendant une revue »). Le contrôle de `095923` compte : si une ligne violait la contrainte, la migration échouerait **en cours de déploiement de production**.
- [x] [Review][Patch] **Le commentaire du script affirme une atomicité que `db push` n'a pas sur un lot** [scripts/migrer-au-deploiement.mjs:16-21, 120-124] — « une migration refusée fait échouer la commande de construction, donc Vercel ne promeut rien : le schéma ET le code restent intacts ». Vrai pour une migration, faux pour une chaîne : `db push` applique et enregistre fichier par fichier. Cette PR en pousse **deux** : si `095923` échoue, `095922` est déjà appliquée et enregistrée, le code n'est pas promu, et le message imprimé dans le journal Vercel (« ni le schéma ni le code servi n'ont changé ») affirme le contraire de ce qui vient de se produire.
- [x] [Review][Patch] **Durcissement du script de déploiement** [scripts/migrer-au-deploiement.mjs:58, 109-113] — quatre points : (a) `VERCEL_ENV === "production"` n'implique pas « branche `main` » — un `vercel --prod` depuis une branche non fusionnée applique ses migrations en production, exactement ce que l'en-tête `:32-36` promet d'empêcher ; ajouter `VERCEL_GIT_COMMIT_REF !== "main"` ; (b) `spawnSync` sans `timeout` bloque le build jusqu'au plafond Vercel si le pooler accepte la connexion sans répondre ; (c) le commentaire `:105-107` insiste sur le port 5432 contre 6543, puis le code accepte n'importe quelle chaîne non vide — aucun contrôle de forme ; (d) `resultat.signal` n'est jamais lu, donc un processus tué par SIGKILL se rapporte « code null » sans dire pourquoi.
- [x] [Review][Patch] **La traçabilité de la story n'a pas suivi le second commit** — quatre écarts : (a) `deferred-work.md` écrit « `docs/migrations.md` est périmé sur un point… *Non corrigé ici pour ne pas mêler une réécriture de documentation à une story de fonctionnalité* » alors que le commit `03a9a09` **qui contient cette phrase** réécrit précisément cette section ; (b) la Task 3 est cochée avec « `docs/migrations.md` dit encore le contraire », devenu faux sur la même branche, et le piège n°8 reste rédigé au présent ; (c) la `File List` omet `vercel.json`, `scripts/migrer-au-deploiement.mjs`, `docs/migrations.md` et `.github/pull_request_template.md` ; (d) la Task 9 affirme avoir ajouté le cas de l'insertion inter-foyers, qui est en réalité couvert par un test préexistant (`isolation.test.ts:228`) — la couverture est bien là, la case décrit mal ce qui a été fait.
- [x] [Review][Patch] **Les invisibles non blancs passent le client ET la contrainte** [lib/texte.ts:21, supabase/migrations/20260729095923_require_non_blank_aisle_name.sql:41] — `INVISIBLES` couvre huit points de code ; `trim()` couvre les blancs Unicode. Restent U+00AD (trait d'union conditionnel), U+3164 (remplisseur Hangul), U+2800 (braille blanc), U+180E, U+202E (forçage droite-à-gauche) : `normaliserNomRayon` les rend tels quels, et `btrim(name)` ne retire que l'espace ASCII, donc la contrainte les accepte. Un rayon au nom entièrement invisible est créable. Les deux fichiers affirment le contraire : « la base refuse le vide franc, le client refuse le vide déguisé » (`095923:35`) et « elle couvre aussi les appels directs à l'API REST » (`:31`). Correctif : `check (name ~ '[[:graph:]]')` côté base, plage élargie côté client.

**Issus des décisions ci-dessus :**

- [x] [Review][Patch] **Protéger `main`** — exiger les contrôles `verify` et `isolation` avant toute fusion, et interdire le push direct. C'est ce qui remet `typecheck`, `lint` et `test` sur le chemin qui mène à `db push`. (Décision 1)
- [x] [Review][Patch] **Job `isolation` dans `.github/workflows/ci.yml`** — `supabase/setup-cli` + `supabase start` + `npm run test:isolation`. Rend AD-17 exécuté plutôt que déclaratif. (Décision 2)
- [x] [Review][Patch] **Écrire la règle de relecture** dans `docs/migrations.md` et `.github/pull_request_template.md` : un écran qui écrit se relit sur le stack local, jamais sur la prévisualisation — celle-ci parle à la base de production. (Décision 3)
- [x] [Review][Patch] **Documenter ce que `SUPABASE_DB_URL` contourne** dans `docs/migrations.md` (rôle `postgres`, traverse la RLS, donc c'est la clé de tout NFR-5). (Décision 4)
  - [ ] ⚠️ **RESTE À FAIRE, et c'est un geste de Florian** — contrôler dans le tableau de bord Vercel que `SUPABASE_DB_URL` n'est déclarée que pour l'environnement **Production**. Non vérifié : le dépôt n'est pas lié à un projet Vercel (`vercel env ls` → « isn't linked »), et lier le dépôt est un choix qui ne revient pas à la revue. Si elle est aussi en *Preview*, chaque construction de PR a la clé de la base de production en environnement, alors que le script ne s'en sert jamais là.
- [x] [Review][Patch] **`.normalize("NFC")` dans `normaliserTexte`** [lib/texte.ts:38] — ferme le doublon NFD/NFC pour les rayons, les prénoms et les noms de foyer d'un coup. Sans effet sur l'existant : les onze rayons amorcés sont déjà en NFC dans le fichier de migration. (Décision 5b)

### Reportés

- [x] [Review][Defer] **Le bouton de restauration reste réservé à l'état vide** [app/rayons/ListeRayons.tsx:228-242] — décision de Florian du 2026-07-29, conforme à ce que la story prescrivait. L'arête demeure : supprimer dix des onze rayons laisse un état où le seul moyen de faire réapparaître le bouton est de supprimer le onzième, et l'ordre du parcours ne se ressaisit pas avant la story 2.2. — reporté à la story 2.2, qui rend le déplacement trivial et donc l'arête sans portée
- [x] [Review][Defer] **L'unicité `(household_id, name)` reste sensible à la casse** [supabase/migrations/20260502000000_initial_schema.sql:81] — « boucherie » et « Boucherie » coexistent. Décision de Florian du 2026-07-29 : seul le `NFC` est traité ; la casse changerait le comportement d'unicité pour tout le produit et exige sa propre migration. — reporté, décision de produit non prise
- [x] [Review][Defer] **Une migration à horodatage antérieur bloque tous les déploiements suivants** [scripts/migrer-au-deploiement.mjs:109] — deux branches ouvertes dans l'ordre inverse de leur fusion, et `db push` refuse (« local migration files to be inserted before the last migration on remote »). Le déploiement échoue, et **chaque déploiement suivant échoue aussi**, y compris ceux qui ne touchent aucune migration, jusqu'à une intervention manuelle. — reporté, conséquence de la conception retenue, pas un défaut du code
- [x] [Review][Defer] **Deux déploiements concurrents ne sont pas sérialisés, et un redéploiement antérieur est bloqué** [scripts/migrer-au-deploiement.mjs:109] — aucun verrou : deux PR fusionnées à quelques secondes d'écart lancent deux `db push` sur la même base. Et un « Redeploy » avec reconstruction d'un déploiement antérieur aux migrations réclame `supabase migration repair` — le chemin de secours « revenir au code d'avant » est donc bloqué par le script lui-même. — reporté, faible fréquence
- [x] [Review][Defer] **`useSoumission` : ré-entrance et ré-annonce des messages identiques** [app/_lib/useSoumission.ts:26-29, 38-50] — `occupe` n'est jamais lu dans `soumettre`, seulement rendu ; et `refuser` ne passe pas par `setCle(undefined)`, donc deux refus identiques consécutifs ne changent pas le DOM et ne sont annoncés qu'une fois au lecteur d'écran. — reporté, préexistant et partagé par tous les écrans
- [x] [Review][Defer] **Aucune borne de longueur en base sur `name` et `icon`** [supabase/migrations/20260502000000_initial_schema.sql:76-77] — `MAX_NOM_RAYON = 40` et `maxLength={16}` ne vivent que dans le navigateur ; un `POST` REST direct insère un nom d'un mégaoctet ou une icône de 5000 diacritiques. — reporté, préexistant, atteignable seulement hors interface

### Ce que la revue a exécuté

Toutes les commandes ci-dessous ont été **lancées** sur l'arbre corrigé, le 2026-07-29. Ce qui ne
l'a pas été porte le mot « non vérifié ».

| Contrôle | Résultat |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` (`--max-warnings 0`) | exit 0, 0 avertissement |
| `npm run test` | **72/72** (66 + 6 nouveaux de la revue), 0 échec |
| `npm run build` | exit 0, `/rayons` toujours en `ƒ (dynamique)` |
| `npm run test:isolation` | **17/17**, 0 échec, après `db reset` sur la migration corrigée |
| `npx supabase db reset` | les 9 migrations rejouées, dont `095923` réécrite |
| La nouvelle regex de `aisles_name_non_vide`, dans le vrai Postgres | **14/14** cas conformes (nom normal, accents, emoji seul acceptés ; vide, espaces, tabulation, saut de ligne, U+00A0, U+00AD, U+200B, U+3164, U+2800, U+202E refusés) |
| La contrainte appliquée, à l'insertion | U+3164 et `'   '` refusés en `23514` ; « Crémerie » accepté |
| `scripts/migrer-au-deploiement.mjs`, ses 5 branches de garde | local → 0 · preview → 0 · production hors `main` → 1 · sans secret → 1 · port 6543 → 1. **C'était le fichier qu'aucune porte n'exécutait ; il l'est maintenant.** |
| `.github/workflows/ci.yml` | YAML parsé : 2 jobs, 7 étapes chacun |
| Protection de `main` | posée et **relue par l'API** : `verify` + `isolation` requis, `strict`, admins soumis, push forcé et suppression interdits |
| Caractères invisibles en clair dans les sources touchées | **aucun** — tous en `\uXXXX` |
| Palette Tailwind par défaut, `autoFocus`, `outline-none`, `window.confirm` | aucune occurrence hors commentaires explicatifs |

**Non vérifié, et dit comme tel :**

- **Le parcours à l'écran n'a pas été rejoué après les correctifs.** Les quatre changements de
  `ListeRayons.tsx` — deux régions de statut, gestion du focus, refus de l'icône multiple, message
  « Ce rayon n'existe plus. » — touchent tous ce que seul l'œil attrape. Les 72 tests couvrent le
  pur, pas le JSX (NFR-10 interdit le harnais). **C'est la vérification qui manque avant de fusionner.**
- **La portée de `SUPABASE_DB_URL` dans Vercel** — voir la sous-case ci-dessus.
- **Le job CI `isolation` n'a jamais tourné sur un runner GitHub.** Le YAML est valide et les tests
  passent en local, mais `supabase start` dans un runner est un chemin neuf. Sa première exécution
  sera celle de cette PR — le même motif que le script de déploiement, et il faut le regarder.
