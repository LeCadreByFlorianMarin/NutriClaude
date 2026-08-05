---
baseline_commit: 9c127d4da106e8ec0de832695ad6cd9d948ce3af
---

# Story 7.1: Accès conversationnel scopé foyer, sans contournement de l'isolation

Status: ready-for-dev

<!-- ⛔ **LE FICHIER EST PRÊT. LA STORY NE L'EST PAS TANT QUE LES QUATRE DÉCISIONS
     DU § « Décisions à trancher » N'ONT PAS ÉTÉ PRISES.** Le statut
     `ready-for-dev` dit que le contexte est complet, pas que le chemin est
     tranché — c'est la même honnêteté de statut que la règle §6 bis de
     `project-context.md`, du côté de l'ouverture. Ne pas lancer `dev-story`
     avant le § Décisions.

     **CE QUI DISTINGUE CETTE STORY DE TOUTES LES PRÉCÉDENTES — quatre choses,
     à avoir en tête avant de lire les critères :**

     1. ⛔ **SES TROIS CRITÈRES CITENT DES STORIES QUI N'EXISTENT PAS.** L'AC1
        renvoie à l'Epic 5.1 (« identité d'appareil »), l'AC3 à l'Epic 5.7
        (« révocable depuis le web »). `sprint-status.yaml` les donne toutes deux
        en `backlog`, et `epic-5` en `backlog`. Mesuré : aucune table
        `device_credentials` dans `supabase/migrations/` (grep sur les 15
        migrations). Cette story ne peut donc pas *consommer* l'identité
        d'appareil — elle doit soit la **construire**, soit la **remplacer**.
        C'est l'objet de la Décision 1, et c'est la plus lourde.

     2. ⚠️ **ELLE EST LA PREMIÈRE SURFACE NON-WEB DU PRODUIT.** Jusqu'ici, tout
        ce qui touche la base est soit un rendu serveur Next, soit le client
        navigateur du même membre connecté. Une seconde surface sur la même base
        change la nature de trois défauts déjà consignés dans
        `deferred-work.md` (lignes 56, 597-598, 643) : ils y sont écrits « et
        l'Epic 7 ouvre une seconde surface (MCP) sur la même base ». **C'est
        maintenant.** Voir § Ce que cette story REFERME.

     3. ⚠️ **ELLE NE LIVRE AUCUN OUTIL MÉTIER.** Consulter la liste (FR-36) est
        la 7.2, recettes et menu (FR-37) la 7.3, rayons et règles (FR-38) la
        7.4. Cette story livre **le tuyau et sa serrure**, rien d'autre. La
        tentation de « au moins exposer la liste tant qu'on y est » est la
        frontière la plus facile à franchir sans s'en apercevoir — d'autant que
        la liste de l'Epic 4 **n'existe pas encore** : `grocery_list_items` est
        encore la table du squelette, sans clé canonique, sans tombstone, sans
        `intent_at`, sans `actor_kind`. Un outil écrit dessus aujourd'hui serait
        à réécrire en entier.

     4. ⚠️ **ELLE PEUT AJOUTER DES DÉPENDANCES, ET NFR-10 DIT L'INVERSE.** Un
        serveur MCP est une implémentation de protocole, pas une commodité d'UI.
        `project-context.md` interdit « ni bibliothèque de glisser-déposer, ni
        sélecteur d'emoji, ni gestionnaire de formulaire, ni harnais de test de
        composants » — un protocole n'est dans aucune de ces familles, mais
        l'arbitrage revient à Florian. Décision 3, avec le coût **mesuré**. -->

## Story

As a foyer,
I want que Claude n'agisse que dans le périmètre de mon foyer, jamais au-delà,
So that le pilotage conversationnel n'ouvre aucune brèche dans l'isolation entre foyers.

## Acceptance Criteria

Cités **verbatim** de `epics.md#Story-7.1`, suivis de ce qu'ils exigent compte tenu de l'état
réel du dépôt.

### AC1 — Aucun chemin de contournement de la RLS

> **Given** la tension connue (un serveur MCP tenté d'utiliser la clé de service, qui
> court-circuiterait le RLS)
> **When** la surface MCP est construite
> **Then** elle s'authentifie avec une **identité d'appareil** scopée foyer (Epic 5.1), **sans
> jamais `SUPABASE_SERVICE_KEY`** ni aucun chemin bypass RLS (AD-2/AD-9) — la tension FR-39 est
> dénouée structurellement

**Ce que « structurellement » exige, et qui est plus fort que « on n'a pas mis la clé ».** Le
critère ne demande pas qu'on s'abstienne d'utiliser la clé de service : il demande qu'**aucun
secret détenu par la surface MCP ne permette de contourner la RLS**, même employé de travers.
Une clé absente d'un fichier `.env` est une abstention ; un secret qui ne *peut pas* signer un
jeton `service_role` est une structure. La distinction décide de la Décision 1 — voir le
piège n°1, qui est la raison pour laquelle le mécanisme proposé par l'`[ASSUMPTION]` d'AD-9
mérite d'être remis en question avant d'être implémenté.

### AC2 — Périmètre strict au foyer

> **Given** une action déclenchée depuis une conversation
> **When** elle s'exécute
> **Then** elle s'applique **dans le seul périmètre du foyer de l'utilisateur** (FR-39),
> l'isolation étant appliquée au niveau de la donnée (NFR-5)

**Il ne se démontre pas par l'absence d'outils.** Aucun outil métier n'est livré ici (frontière
n°3 ci-dessus) ; le critère porte donc sur les **politiques**, pas sur les appels. Il se prouve
par un test exécuté qui présente un jeton de la surface conversationnelle du foyer A et
constate qu'il ne voit rien de B — AD-17, et la règle §4 de `project-context.md` (« un invariant
entre deux fichiers se mesure, il ne s'affirme pas »).

⚠️ **Et il porte aussi sur ce que la surface ne doit PAS atteindre DANS son propre foyer.**
AD-9 : « périmètre restreint ; **jamais d'accès admin foyer** ». Aujourd'hui, six politiques
n'ont pour toute condition que `household_id = current_household_id()` : une surface
conversationnelle qui obtient le foyer obtient donc aussi le droit d'**émettre un code
d'invitation**, de **renommer le foyer** et de **lire les profils des membres** (dont
`daily_calories`, `restrictions`, `preferences`). Voir piège n°3 — c'est le vrai travail de
cette story.

### AC3 — Révocation à l'unité

> **Given** l'identité d'appareil du client MCP
> **When** elle doit être coupée
> **Then** elle est révocable à l'unité depuis le web (Epic 5.7), sans affecter les autres
> surfaces

**« Depuis le web » désigne la story 5.7, qui n'existe pas.** Le critère est donc *à moitié*
livrable ici : le mécanisme de révocation est du ressort de cette story, l'**écran** qui le
déclenche est du ressort de la 5.7. La règle §5 de `project-context.md` s'applique — la moitié
reportée se **date** et se **cite**, elle ne se tait pas. Voir Task 6.

---

## ⛔ Ce que cette story ne peut pas supposer — la dépendance Epic 5

**Mesuré le 2026-08-05**, `sprint-status.yaml` et `supabase/migrations/` :

| Ce que les critères citent | État réel | Conséquence |
|---|---|---|
| Epic 5.1 — identité d'appareil (`device_credentials`, claim, révocation) | `backlog`, aucune table, aucune migration | AC1 n'a rien à consommer |
| Epic 5.7 — écran de gestion des appareils | `backlog` | AC3 n'a pas d'écran |
| Epic 4 — la liste (clé canonique, tombstone, `intent_at`, `actor_kind`) | 18 stories en `backlog` | Les outils de la 7.2 n'ont pas de modèle |
| `epic-5`, `epic-6`, `epic-7` | tous `backlog` | 7.1 est prise **hors ordre** |

**Ce n'est pas un blocage — c'est un choix de séquence, et il se tient.** La 7.1 est la seule
story de l'Epic 7 qui ne touche ni la liste, ni les recettes, ni le menu, ni les rayons : elle
ne pose que l'authentification et son périmètre. Elle est donc la seule des quatre à être
implémentable sans l'Epic 4. **Mais elle absorbe alors le cœur de la 5.1**, ou le remplace.
C'est la Décision 1.

⚠️ **Ce qui reste vrai quoi qu'il arrive** : la 7.2, la 7.3 et la 7.4 restent bloquées derrière
l'Epic 4 (liste), l'Epic 3 étant seul complet. Livrer la 7.1 ne débloque **pas** l'Epic 7 ; elle
débloque l'Epic 5 et la moitié de l'Epic 6.

---

## ⛔ Décisions à trancher avant démarrage

Quatre, dont la première commande les trois autres. Chacune porte une recommandation et son
motif ; aucune n'est une préférence de style.

### Décision 1 — Le mécanisme d'identité. **C'est la story.**

`ARCHITECTURE-SPINE.md` § Open Questions le dit lui-même : *« [ASSUMPTION] Mécanisme d'émission
des jetons d'appareil (AD-9/AD-10) : JWT signé portant le claim `household_id` […]. La technique
de signature/rotation exacte reste à confirmer à l'implémentation (le memlog fixe le modèle, pas
le procédé cryptographique). »* Le moment de la confirmer est arrivé, et l'étude de 2026-08-05
en fait ressortir une objection que les sources n'avaient pas.

**(A) — Le chemin de l'`[ASSUMPTION]` : clé de signature importée, jeton frappé par nous.**
Supabase permet d'importer sa propre clé de signature (`supabase gen signing-key --algorithm
ES256`), puis de frapper des JWT portant des claims libres — dont `household_id` — que
PostgREST accepte. On étend `current_household_id()` à `auth.jwt()`, on pose
`device_credentials`, et les politiques joignent la table en exigeant `revoked_at is null`.
C'est mot pour mot AD-9.

⛔ **L'objection, et elle vise le cœur de l'AC1.** Une clé de signature importée est la clé du
**projet** : ce qu'elle signe, PostgREST le croit. Rien n'empêche son porteur de frapper un
jeton portant `role: service_role` — c'est-à-dire de reconstituer exactement la clé de service
que l'AC1 interdit, sous un autre nom. Détenir cette clé dans une variable d'environnement
Vercel, c'est détenir un contournement de RLS **de plein droit**, pas par accident.
⚠️ **DÉDUIT du modèle documenté, pas MESURÉ** (règle §1). La sonde qui le trancherait est
écrite en Task 1 et elle est due avant de choisir (A) : frapper avec la clé importée un jeton
`role: service_role`, le présenter à PostgREST sur le stack local, regarder s'il traverse la
RLS. Si oui, (A) ne dénoue rien.

**(B) — Le serveur OAuth 2.1 de Supabase.** Depuis sa sortie, Supabase Auth peut être un
serveur d'autorisation OAuth 2.1 : Claude s'y enregistre comme client, Florian consent une
fois sur un écran hébergé par NutriClaude, et la surface MCP reçoit un **jeton frappé par
Supabase** — jamais par nous. Il porte `role: authenticated`, `sub` = le membre, et un claim
`client_id` identifiant le client OAuth. La RLS s'applique nativement, et le périmètre se
restreint par des politiques dédiées lisant `auth.jwt() ->> 'client_id'`. Supabase documente
explicitement ce chemin pour MCP.

✅ **Il dénoue l'AC1 au sens fort** : nous ne détenons **aucun secret de signature**. Il n'y a
pas de jeton `service_role` à frapper, parce qu'il n'y a pas de clé. Il n'y a rien à révoquer
en urgence si Vercel fuit, parce qu'il n'y a rien à fuir.

⚠️ **Ce qu'il coûte, et ce sont de vraies concessions, pas des détails :**
- **Il contredit AD-9 pour cette surface.** Le jeton porte l'identité d'une *personne*
  (Florian), pas d'un *appareil*. NFR-6 (« appareil ≠ personne ») a été écrit pour l'écran
  mural, que personne ne regarde ; une conversation avec Claude a un humain au bout. C'est
  défendable — mais c'est un **amendement d'architecture**, à écrire, pas à supposer.
- **Il est en bêta** (annoncé gratuit sur tous les plans pendant la bêta). NFR-10 tolère mal
  une dépendance qui bouge ; en contrepartie, elle ne coûte aucun code.
- **Les portées granulaires ne sont pas là** (« coming soon » au 2026-08-05) : un jeton OAuth
  ouvre aujourd'hui **tout ce que le membre peut faire**. La restriction se fait donc
  entièrement à la main, dans les politiques, sur `client_id`. **C'est le travail de la
  Task 3, et il est dû quel que soit le chemin choisi.**
- **Il exige un écran de consentement** hébergé par nous — `authorization_url_path =
  "/oauth/consent"` est déjà la valeur par défaut de `supabase/config.toml:415`. Un écran
  français sans jargon, donc de la microcopy réelle (NFR-9).
- **La révocation change de forme** : révoquer un client OAuth invalide ses sessions et ses
  jetons de rafraîchissement. C'est une révocation à l'unité, mais elle ne passe pas par
  `device_credentials.revoked_at`. La 5.7 devra en tenir compte.

**(C) — RPC `security definer` prenant un secret d'appareil en paramètre.** Écarté, et pas
seulement par goût : il fait perdre PostgREST comme contrat (FR-19, AD-1) puisque chaque
opération exigerait sa fonction, et `project-context.md` § Architecture le signale nommément —
« une fonction `security definer` qui reçoit une identité en paramètre doit la recontrôler
elle-même », le motif exact du trou de `seed_default_aisles` que onze tests d'isolation ne
voyaient pas.

> **Recommandation : (B), sous réserve de la sonde de la Task 1.** Motif : l'AC1 demande que la
> tension soit dénouée *structurellement*. (A) la déplace du `SUPABASE_SERVICE_KEY` vers une
> clé de signature qui en fait autant ; (B) la supprime. Le prix est un amendement à AD-9 pour
> la surface conversationnelle — et cet amendement se défend tout seul : **le dashboard est
> sans témoin, la conversation ne l'est jamais.**
>
> ⚠️ **Si (A) est retenu**, cette story absorbe l'intégralité de la story 5.1 (table, extension
> de `current_household_id()`, révocation, émission) et il faut le dire : la 5.1 devient sans
> objet et `sprint-status.yaml` doit le refléter. Ne pas laisser deux stories prétendre poser
> la même table.

### Décision 2 — Le périmètre exact de la surface conversationnelle

L'AC2 exige un périmètre ; AD-9 le veut « restreint à la liste ». Or les stories 7.3 et 7.4
demandent recettes, menu, rayons et règles. **AD-9 et l'Epic 7 ne disent pas la même chose**, et
c'est cette story qui doit trancher, puisque c'est elle qui écrit les politiques.

Périmètre proposé — **tout ce que les stories 7.2 à 7.4 réclament, et rien de plus** :

| Table | Accès conversationnel | Pourquoi |
|---|---|---|
| `grocery_list_items` | lecture + écriture | FR-36 (7.2) |
| `recipes`, `recipe_ingredients` | lecture + écriture | FR-37 (7.3) |
| `meal_plan_entries` | lecture + écriture | FR-37 (7.3) |
| `aisles`, `product_aisle_map` | lecture + écriture | FR-38 (7.4) |
| `products` | lecture | catalogue partagé, déjà ouvert à tout `authenticated` |
| `households` | **lecture seule** | `default_servings` est lu par la génération ; renommer le foyer est de l'admin |
| `profiles` | ⛔ **à trancher** | voir ci-dessous |
| `household_invites` | ⛔ **aucun** | voir piège n°3 |

⚠️ **`profiles` est le seul cas qui n'a pas de réponse évidente.** La table porte
`daily_calories`, `daily_protein_g`, `restrictions`, `preferences` — des données de santé, que
le PRD §9 range explicitement dans une dette de conformité non traitée (NFR-7). Les stories 7.2
à 7.4 n'en ont besoin pour rien. **Recommandation : aucun accès `profiles` depuis la surface
conversationnelle**, quitte à l'ouvrir le jour où une story le réclame. Ouvrir maintenant, c'est
ouvrir pour rien.

### Décision 3 — La dépendance MCP, et son coût mesuré

**Mesuré le 2026-08-05 (`npm view`), pas rapporté :**

| Paquet | Version | Ce qu'il tire | Node |
|---|---|---|---|
| `mcp-handler` | 2.1.0 | `chalk`, `commander` ; **pairs** : `@modelcontextprotocol/server ^2.0.0`, `next >=13` | `>=20` ✅ (on est en 24.x) |
| `@modelcontextprotocol/server` | 2.0.0 | `zod ^4.2.0`, `@modelcontextprotocol/core` 2.0.0 | — |
| `@modelcontextprotocol/sdk` (l'alternative) | 1.30.0 | `express`, `hono`, `cors`, `jose`, `ajv`, `eventsource`, `zod-to-json-schema`… | `>=18` |

`mcp-handler` est édité par Vercel et se monte dans un Route Handler Next. Sa v2 sert la
spécification MCP du 2026-07-28 en mode sans état, **sans Redis ni stockage de session** — ce
qui compte pour NFR-10 : pas d'infrastructure en plus. Son empreinte réelle est de **quatre
paquets** (`mcp-handler`, `server`, `core`, `zod`), contre une douzaine pour le SDK seul.

**(a)** `mcp-handler` 2.1.0 — quatre paquets, un Route Handler, sans état.
**(b)** `@modelcontextprotocol/sdk` 1.30.0 en direct — plus de paquets, plus de contrôle.
**(c)** Écrire le transport à la main — MCP sur HTTP est du JSON-RPC en POST plus un flux SSE ;
c'est faisable, c'est du travail réel, et ça se re-maintient à chaque révision de la
spécification.

> **Recommandation : (a).** NFR-10 vise le **coût de possession**, et quatre paquets qu'on ne
> maintient pas coûtent moins qu'un transport de protocole qu'on maintient seul. ⚠️ Mais
> `project-context.md` écrit « **Aucune dépendance nouvelle (NFR-10)** » sans nuance : la
> nuance, si elle est acceptée, doit être **écrite dans `project-context.md`**, pas supposée
> par une story. Task 8.

### Décision 4 — Où vit le serveur MCP

**(a) Route Handler Next sur Vercel** (`app/api/mcp/route.ts`) — même déploiement, même
environnement, `mcp-handler` est fait pour ça. ⚠️ AD-13 dit « Next = coquille », mais la
première branche de son critère de cause s'applique : la surface MCP **exige un secret
serveur** (au minimum le jeton de la conversation, jamais exposé au navigateur).
**(b) Edge Function Supabase** — `supabase/functions/` existe pour le pont (AD-15), mais la
surface MCP n'est pas déclenchée par `pg_cron` et n'a rien à faire là.

> **Recommandation : (a).** Et c'est le déploiement Vercel de la PR qui en fait foi, jamais la
> CI — `project-context.md` § 7 : « la CI tourne sur le runtime du poste ; Vercel en construit
> un autre. »

---

## Ce que cette story REFERME — trois reports datés qui la nomment

Règle §5 de `project-context.md` : *une prémisse qui sert à reporter un défaut se rouvre avant
d'être réinvoquée.* Trois reports du dépôt disent, mot pour mot, « l'Epic 7 ouvre une seconde
surface (MCP) sur la même base ». **Cette story est cette phrase.** Les rouvrir en les citant
est un travail de cette story, pas une politesse.

### 1. La garde humaine de `generate_household_invite` — et le report se trompe de garde

`deferred-work.md:56` (story 1.4, 2026-07-27), **exigence dure**, verbatim :

> `generate_household_invite` devra vérifier explicitement que l'appelant est un humain.
> L'AC3 de la story 1.4 exige qu'une identité d'appareil ne puisse pas émettre d'invitation.
> Aujourd'hui c'est vrai **par effet de bord** : `current_household_id()` ne résout le foyer que
> depuis `profiles`, donc une identité non-humaine obtient `NULL` et la fonction lève. […] La
> garde devra alors être explicite, par exemple `exists (select 1 from profiles where id =
> auth.uid())`.

⛔ **La garde proposée ne tient pas sous le chemin (B), et c'est le piège le plus fin de cette
story.** Sous (B), le jeton porte `sub` = **Florian**, qui a bel et bien une ligne `profiles` :
`exists (select 1 from profiles where id = auth.uid())` rend **vrai**, et Claude émet des codes
d'invitation. La garde écrite en 2026-07-27 répond à la question « est-ce un humain ? » ; la
question qui compte est « **est-ce une surface de première partie ?** ». Sous (B) elle s'écrit
`(auth.jwt() ->> 'client_id') is null`. Sous (A), les deux formes conviennent.

**Un code d'invitation est le passe du foyer.** Qui le lit peut faire entrer qui il veut : c'est
la porte de FR-40, et sa lecture vaut son émission. `invites_select_own` est donc à refermer au
même titre que la fonction — voir piège n°3.

### 2. Le texte libre non contraint des recettes

`deferred-work.md:585-601` (story 3.1) : `description`, `instructions`, `prep_time_min`,
`cook_time_min` ne sont contraints **que dans le navigateur**. Le report nomme son propre modèle
de menace et cite l'Epic 7 : « un `PATCH` PostgREST direct suffit à poser 2 Mo d'instructions ou
`prep_time_min = -30` ».

**Ce n'est PAS à cette story de le refermer**, et il faut le dire pour que ce ne soit pas
redécouvert : la 7.1 n'expose **aucun outil** touchant `recipes`. La prémisse se rouvre à la
**story 7.3**, qui est celle qui ouvrira ce `PATCH`. *Reporté ici en le datant, pas en le
taisant.* ⚠️ Et il change de gravité au moment où la 7.3 arrive : un modèle de langage écrit
plus vite et plus long qu'un humain dans un formulaire.

### 3. L'intégrité de `meal_plan_entries.recipe_id`

`deferred-work.md:643` (story 3.5) citait le même « l'Epic 7 ouvre une seconde surface ». **Ce
report est déjà refermé** : la story 3.6 a posé la politique resserrée dans
`20260804144217_contraindre_les_assignations_de_menu.sql`. Rien à faire — noté pour qu'on ne le
rouvre pas par réflexe en relisant `deferred-work.md`.

---

## Tasks / Subtasks

⛔ **Les Tasks 2 à 8 sont écrites pour le chemin (B).** Si la Décision 1 retient (A), les
Tasks 2, 4 et 6 changent de contenu (elles posent `device_credentials`, étendent
`current_household_id()`, et émettent le jeton) ; les Tasks 1, 3, 5, 7, 8 sont **identiques
dans les deux cas**.

- [ ] **Task 1 — Trancher la Décision 1, en mesurant (AC: 1)**
  - [ ] Sonder le chemin (A) sur le stack local : `supabase gen signing-key --algorithm ES256`,
        importer la clé, frapper un JWT `{ "role": "service_role", "exp": … }` avec le `kid`
        de la clé importée, l'envoyer à PostgREST, **lire ce qui revient**. Consigner la
        commande et la sortie (règle §1).
  - [ ] Sonder le chemin (B) sur le stack local : `[auth.oauth_server] enabled = true` dans
        `supabase/config.toml:413`, `supabase stop && supabase start`, puis
        `GET /.well-known/oauth-authorization-server`. **Vérifier que le CLI 2.111.0 sert bien
        ce point d'entrée** — la clé existe dans le modèle de configuration, ce qui ne prouve
        pas que le stack local l'implémente.
  - [ ] Porter le résultat des deux sondes, avec leurs commandes, dans le § Décisions.
  - [ ] ⛔ **Ne rien construire avant cette tâche.** Les deux chemins divergent dès la première
        migration.

- [ ] **Task 2 — Activer le serveur d'autorisation et son écran de consentement (AC: 1)**
  - [ ] `supabase/config.toml` : `[auth.oauth_server] enabled = true`, `allow_dynamic_registration`
        laissé à `false` (voir piège n°4), `authorization_url_path` inchangé.
  - [ ] Poser `app/oauth/consent/page.tsx` — l'écran que Florian voit une fois. Français,
        tutoiement pour les phrases, **aucun des mots bannis** (piège n°6). Il nomme le foyer
        et ce que la conversation pourra faire ; il ne parle ni de jeton, ni d'API, ni de MCP.
  - [ ] Deux thèmes, et **regardés** — clair et sombre au réglage système, pas dans les outils
        de développement (`project-context.md` § thème).
  - [ ] ⚠️ Enregistrer le client **statiquement**, pas par découverte dynamique.

- [ ] **Task 3 — Refermer le périmètre en base — le cœur de la story (AC: 2)**
  - [ ] Une migration additive posant, sur chaque surface d'**administration du foyer**, la
        condition qui exclut la surface conversationnelle. Sous (B) :
        `(auth.jwt() ->> 'client_id') is null`.
  - [ ] Surfaces à refermer, **mesurées dans `initial_schema.sql`** :
        `invites_select_own` (266-267), `invites_insert_own` (268-269), `invites_delete_own`
        (270-271), `households_update` (250-251), `profiles_update_own` (260-262), et la
        fonction `generate_household_invite` (§ REFERME n°1).
  - [ ] Trancher `profiles_select_own_household` (258-259) selon la Décision 2. Si l'accès est
        refusé, la condition va sur la politique ; si un besoin apparaît en 7.2-7.4, il se
        rouvre là-bas.
  - [ ] **Les fonctions, qu'aucune politique ne couvre** — inventaire au piège n°3 :
        garder `generate_household_invite()` et `create_household_with_profile()` ; **dater**
        le cas de `redeem_household_invite()` (gardée par effet de bord) ou le refermer.
        Laisser `resolve_aisle_id`, `reorder_aisles`, `reorder_recipe_ingredients` ouvertes.
  - [ ] ⚠️ **Écrire la requête de contrôle en en-tête de migration** — elle s'exécute **en
        revue, avant la fusion** (`project-context.md` § migrations). `npm run check:migrations`
        vérifie qu'elle existe, pas qu'on l'a lancée.
  - [ ] ⚠️ **Ne pas toucher aux politiques des tables métier** (`aisles`, `recipes`,
        `meal_plan_entries`, `grocery_list_items`, `product_aisle_map`) : elles doivent rester
        ouvertes à la surface conversationnelle, c'est tout l'objet des stories 7.2 à 7.4.

- [ ] **Task 4 — Le serveur MCP, et rien dedans (AC: 1, 2)**
  - [ ] `app/api/mcp/route.ts` via `mcp-handler` (Décision 3/4).
  - [ ] Une fabrique de client Supabase portant le jeton de la conversation, sur le modèle de
        `lib/supabase/client.ts` — **anon key + `Authorization: Bearer <jeton de la
        conversation>`**, jamais de clé de service. Elle vit dans `lib/supabase/`, typée
        `<Database>` comme les trois autres.
  - [ ] **Un seul outil**, et il ne touche aucune table métier : il rend le nom du foyer courant
        (via `lib/foyer/foyer.ts`, qui prend déjà le client en paramètre — ne pas le réécrire).
        Il existe pour **démontrer l'AC2**, pas pour servir.
  - [ ] Refus franc et lisible si le jeton est absent, expiré ou révoqué. **Aucun message
        technique brut** (AD-15 § forme d'erreur).

- [ ] **Task 5 — Prouver l'isolation par exécution (AC: 2, 3) — AD-17**
  - [ ] Étendre `supabase/tests/` : un jeton de la surface conversationnelle du foyer A ne voit
        **aucune** ligne de B, sur chacune des tables du périmètre de la Décision 2.
  - [ ] Le **témoin négatif** est obligatoire : lire d'abord en `service_role` pour prouver que
        les deux foyers existent, sans quoi « A ne voit rien de B » est vrai gratuitement
        (`isolation.test.ts:22-27` — reprendre le motif, ne pas l'inventer).
  - [ ] Prouver aussi le **refus** : le même jeton ne peut ni émettre une invitation, ni en
        lire une, ni renommer le foyer, ni créer un foyer.
  - [ ] ⚠️ **Tester les FONCTIONS, pas seulement les tables.** Une politique ne s'applique pas
        à l'intérieur d'un `security definer` : c'est le trou de `seed_default_aisles`, que
        onze tests portant tous sur des tables n'ont pas vu.
  - [ ] Prouver la **révocation** : jeton révoqué, jeton non expiré → refus.
  - [ ] ⚠️ Si un fichier de test est ajouté, `.github/workflows/ci.yml:153` compte
        `supabase/tests -name '*.test.ts'` avant de lancer — le compte doit rester ≥ 1.
        **Toute nouvelle porte automatique doit répondre à : « que se passe-t-il si elle ne
        trouve rien à contrôler ? »**

- [ ] **Task 6 — Révocation : le mécanisme ici, l'écran daté ailleurs (AC: 3)**
  - [ ] Le mécanisme de révocation, prouvé par la Task 5.
  - [ ] ⛔ **L'écran est la story 5.7.** Écrire dans `deferred-work.md` la moitié reportée,
        **datée**, avec ce que la 5.7 devra savoir : sous (B) la révocation ne passe pas par
        `device_credentials.revoked_at` mais par la révocation du client OAuth. Ne pas poser
        d'ébauche d'écran dans `/foyer` — la 5.7 la trouverait à moitié faite, et
        `project-context.md` § 6 bis dit ce que valent les moitiés non datées.

- [ ] **Task 7 — Ce qui n'a aucune porte automatique**
  - [ ] Parcours à l'écran de `/oauth/consent`, **clair et sombre**, au réglage système. Quatre
        défauts de rendu trouvés le 2026-07-29 par un parcours que 92 tests ne voyaient pas.
  - [ ] Le déploiement : cette story touche `supabase/config.toml` et ajoute des dépendances →
        **contrôle sur le déploiement de la PR**, pas sur la CI.
  - [ ] Un aller-retour réel depuis un client MCP. *« Le stack local ne savait pas créer un
        compte pendant deux epics » — l'outillage se prouve en s'en servant.*
  - [ ] ⛔ **Sur le stack local, jamais sur la prévisualisation** : les prévisualisations Vercel
        parlent à la base de PRODUCTION, et la migration de cette PR n'y est pas appliquée.

- [ ] **Task 8 — Rendre les décisions relisables**
  - [ ] Amender `ARCHITECTURE-SPINE.md` : l'`[ASSUMPTION]` d'AD-9 est **résolue** — écrire par
        quoi et pourquoi, et l'écart d'AD-9 si (B) est retenu. Ne pas laisser l'hypothèse dire
        une chose et le code une autre.
  - [ ] Amender `project-context.md` § NFR-10 si la Décision 3 ouvre la porte aux dépendances de
        protocole. **Une règle rangée au mauvais endroit n'est pas une règle** — et une règle
        contredite par le dépôt sans être amendée non plus.
  - [ ] `docs/configuration.md` : les variables et réglages nouveaux.
  - [ ] ⚠️ Relire les textes qui deviennent faux avec ce commit — `deferred-work.md:56`
        (la garde proposée), `garde.ts:24-26` (« donc inutilisable par le serveur MCP de
        l'Epic 7 » — il existe maintenant).

---

## Dev Notes

### Ce qui existe déjà, et qu'il ne faut pas réimplémenter

| Besoin | Où c'est déjà écrit |
|---|---|
| Lecture prenant le client **en paramètre** (réutilisable hors rendu Next) | `lib/foyer/foyer.ts`, `lib/foyer/membres.ts` |
| Fabrique de client typée `<Database>` | `lib/supabase/client.ts` (modèle à suivre) |
| Lecture d'environnement qui échoue en nommant la variable | `lib/supabase/env.ts` — **l'employer**, ne pas remettre des `process.env.X!` |
| Erreur métier : SQLSTATE d'abord, texte en repli | `lib/foyer/erreurs.ts` |
| Zone de message accessible | `app/_lib/Notice.tsx` (⚠️ `reserve` si la zone est au-dessus) |
| Harnais de test d'isolation à deux comptes réels | `supabase/tests/isolation.test.ts`, `stack-local.ts` |
| État de soumission avec son `finally` | `app/_lib/useSoumission.ts` |

⚠️ **`app/_lib/garde.ts:24-26` a été écrit en pensant à cette story** : *« Elle vit dans `app/`
et non dans `lib/` : c'est de la politique de routage web, et l'y laisser rendait la couche
données inutilisable hors d'un rendu Next — donc inutilisable par le serveur MCP de l'Epic 7. »*
La séparation est déjà faite. **Ne jamais appeler `requireProfile()` depuis le serveur MCP** :
il `redirect()`, ce qui n'a aucun sens hors d'un rendu Next.

### Piège n°1 — « Sans clé de service » n'est pas la même chose que « sans contournement »

Le cœur de la Décision 1, redit ici parce que c'est ce qu'une revue vérifiera. L'AC1 dit
« **ni aucun chemin bypass RLS** ». Une clé de signature du projet **est** un chemin de
contournement : elle signe ce qu'on veut, `role` compris. Écrire « on n'utilise pas
`SUPABASE_SERVICE_KEY` » dans une note de complétion serait **vrai et hors sujet**.

⚠️ **DÉDUIT, pas mesuré.** La Task 1 le mesure. Si la sonde montre que PostgREST **refuse** un
`service_role` frappé par une clé importée, l'objection tombe et (A) redevient recevable —
consigner alors la commande et la sortie, pas la conclusion.

### Piège n°2 — La liste de l'Epic 4 n'existe pas, et l'actuelle est trompeuse

`grocery_list_items` existe depuis le squelette (`initial_schema.sql:194-206`) et **ne
ressemble pas** à ce qu'AD-3 décrit : pas de contrainte `unique(household_id, name, unit)`, pas
de `deleted_at`, pas de `intent_at`, pas de `actor_kind`/`actor_id`, pas de `source_ref` — juste
un `added_by` qui référence `auth.users` et qu'AD-9 interdit explicitement pour un appareil
(« un appareil n'est jamais une FK `profiles` »). Et `generate_grocery_list_from_menu`
(`initial_schema.sql:517+`) fait exactement ce qu'AD-6 corrige : `delete from grocery_list_items
where … status = 'pending'`, c'est-à-dire la génération **destructive** que FR-17 interdit.

**Conséquence pour cette story : n'exposer aucun outil de liste.** Un outil écrit sur la table
d'aujourd'hui serait faux au sens du contrat avant même d'être utilisé. La Task 3 laisse les
politiques de `grocery_list_items` ouvertes pour la 7.2 ; elle n'y touche pas autrement.

### Piège n°3 — Six politiques n'ont qu'une condition, et c'est la faille de cette story

Mesuré dans `initial_schema.sql`. Chacune se contente de `household_id = current_household_id()` :

| Politique | Ligne | Ce qu'une surface conversationnelle obtiendrait sans garde |
|---|---|---|
| `invites_select_own` | 266-267 | **lire un code d'invitation valide** → le passe du foyer |
| `invites_insert_own` | 268-269 | émettre un code (via la fonction) |
| `invites_delete_own` | 270-271 | supprimer un code |
| `households_update` | 250-251 | renommer le foyer, changer `default_servings` |
| `profiles_update_own` | 260-262 | (borné à `id = auth.uid()`, mais réécrit le prénom) |
| `profiles_select_own_household` | 258-259 | lire `restrictions`, `preferences`, `daily_*` de tous les membres |

⚠️ **`invites_select_own` est le pire des six, et il est le moins évident.** Lire un code vaut
l'émettre : le code est un porteur, et `redeem_household_invite` ne demande rien d'autre. Une
garde posée sur la seule fonction d'émission laisserait la lecture ouverte et n'aurait rien
fermé. **La garde va sur les deux.**

⚠️ **`households_update` est devenu plus intéressant depuis la story 3.6**, qui y a ajouté
`default_servings` (`20260804144217…sql:181`). Une surface conversationnelle qui peut l'écrire
change silencieusement l'échelle de toutes les générations à venir.

**Et les politiques ne sont que la moitié : dix fonctions existent, dont six en
`security definer`, et une politique ne les couvre pas.** Inventaire complet, mesuré sur les
15 migrations — l'oublier, c'est refermer la porte et laisser la fenêtre :

| Fonction | Où | Statut pour la surface conversationnelle |
|---|---|---|
| `generate_household_invite()` | `initial_schema:437` | ⛔ **à refermer** — § REFERME n°1 |
| `create_household_with_profile()` | `initial_schema:354` | ⛔ **à refermer** — créer un foyer est de l'admin, et rien n'appartient à une conversation là-dedans |
| `redeem_household_invite()` | `guard_invite_use_count:34` | ⚠️ **déjà gardée par effet de bord** : `if exists (select 1 from profiles where id = v_user_id) → raise`. Un membre du foyer ne peut donc pas être déplacé. **Mais la garde tient sur « a déjà un profil », pas sur « est de première partie »** — un compte sans profil doté d'un jeton de conversation ferait entrer sa conversation dans un foyer. Effet de bord = règle §5 : le rouvrir ici ou le **dater**, pas le supposer |
| `seed_default_aisles()` | `guard_seed_default_aisles:64` | ✅ gardée depuis le 2026-07-29 — ne pas y toucher, mais **relire la garde** : c'est le précédent exact du piège n°8 |
| `current_household_id()` | `initial_schema:48` | ⚠️ **le pivot**. Sous (A) elle change ; sous (B) elle ne change pas — et c'est un argument de plus pour (B) : la fonction dont dépendent **toutes** les politiques reste intouchée |
| `resolve_aisle_id()`, `reorder_aisles()`, `reorder_recipe_ingredients()` | métier | ✅ laisser ouvertes — 7.3 et 7.4 en ont besoin |
| `generate_grocery_list_from_menu()` | `initial_schema:517` | ⚠️ laisser en l'état : l'Epic 4 la réécrit (piège n°2). Ne pas la garder ni la corriger ici |
| `set_updated_at()` | `initial_schema:578` | déclencheur, sans surface |

⚠️ **Une politique RLS ne s'applique pas à l'intérieur d'une fonction `security definer`** —
c'est précisément le trou que `guard_seed_default_aisles` a refermé le 2026-07-29, et que les
onze tests d'isolation d'alors ne voyaient pas parce qu'ils **portaient tous sur des tables**.
La Task 5 doit donc tester les **fonctions**, pas seulement les tables.

⛔ **Et `EXECUTE` est déjà accordé sur tout, à tout le monde.**
`20260729094500_grant_table_privileges.sql:60-71`, mesuré :

```sql
grant all on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
```

Un jeton `role: authenticated` — ce que **tout** jeton OAuth du chemin (B) sera — peut donc
appeler **les dix fonctions**, y compris celles qui viendront. La migration le dit elle-même
(l.55) : *« La RLS reste le seul mécanisme d'isolation. »* Conséquence directe : **la garde va
dans le corps de la fonction**, pas dans un `revoke` — un `revoke` serait rendu par les
privilèges par défaut à la prochaine fonction créée, en silence. C'est la règle §3 sous une
autre forme : une énumération ne peut pas gagner contre une catégorie.

### Piège n°4 — L'enregistrement dynamique de clients ouvre la porte à n'importe qui

`supabase/config.toml:417` : `allow_dynamic_registration = false`. Claude sait s'enregistrer
dynamiquement (DCR), et c'est commode — c'est aussi, mot pour mot dans la documentation
Supabase, la porte par laquelle « n'importe quel client MCP peut s'enregistrer sur ton projet ».
Le périmètre de la Task 3 repose sur `client_id` ; il ne vaut rien si n'importe qui peut
s'en faire attribuer un.

**Laisser `false`, enregistrer le client statiquement.** Si Claude l'exige un jour, ce sera une
décision datée, pas un réglage qu'on aura laissé ouvert.

### Piège n°5 — Activer le serveur d'autorisation touche la PRODUCTION

`supabase/config.toml` gouverne le **stack local**. Sur l'hébergé, l'activation se fait au
tableau de bord — et **il n'y a qu'un seul projet Supabase, qui est la production**
(`project-context.md` § prévisualisations). Deux conséquences :

- L'activer, c'est modifier la configuration d'authentification de la production, pendant que
  Florian s'en sert. Le faire délibérément, pas en passant.
- Un critère qui dépend de la migration de la Task 3 **n'est pas démontrable sur la
  prévisualisation** : la migration ne s'y applique pas. Tout se démontre sur le stack local.

### Piège n°6 — La microcopy de l'écran de consentement, et elle est piégée

`/oauth/consent` est un écran de configuration OAuth : c'est **le pire endroit du produit** pour
respecter NFR-9, parce que le vocabulaire natif du sujet est intégralement banni.

**Mots bannis dans toute chaîne rendue** : synchronisation, jeton/token, API, MCP, pont,
Supabase, RLS, cache. ⚠️ *Y compris dans Claude conversationnel* — `EXPERIENCE.md:94`.

**Les possessifs** (`project-context.md`, décision du 2026-08-02) : première personne pour ce
qui **nomme** une chose du membre (« Mon foyer »), tutoiement pour ce que l'application **dit**
(« Tu autorises… »). ⚠️ Le piège est le **voisinage** : si une phrase surplombe un libellé qui
nomme la même chose, c'est **la phrase** qu'on rend neutre, jamais le libellé qu'on retourne au
tutoiement.

**Jamais « Réessaie » sur une condition non transitoire** : un consentement refusé n'est pas un
incident réseau.

**Pas d'abricot** hors de l'anneau de focus — UX-DR2 le réserve à l'action courses.

*Piste, à valider par Florian : parler de « laisser Claude t'aider avec les courses de Mon
foyer », en énumérant ce qu'il pourra faire (voir la liste, ajouter, cocher, ranger) et ce
qu'il ne pourra pas (faire entrer quelqu'un dans le foyer).* Le second point est vrai grâce à
la Task 3, et le dire est la meilleure preuve qu'on l'a fait.

### Piège n°7 — Tailwind 4 : la palette par défaut est neutralisée

`--color-*: initial` dans `globals.css`. **`bg-red-500`, `text-gray-400`, `bg-white` ne génèrent
plus rien et échouent EN SILENCE.** Toute couleur de `/oauth/consent` doit être un token de
`DESIGN.md`. Il n'y a pas de fichier de configuration Tailwind et il ne faut pas en créer.
`dark:` suit `prefers-color-scheme` — aucune bascule manuelle.

### Piège n°8 — `security definer` et l'identité reçue en paramètre

Si la Décision 1 retient (A), ou si une fonction quelconque de cette story reçoit une identité,
`project-context.md` § Architecture est catégorique : *« Une fonction `security definer` qui
reçoit une identité en paramètre doit la recontrôler elle-même. La RLS ne la couvre pas — c'est
tout l'intérêt de `security definer`. »* C'est ce qui rendait le trou de `seed_default_aisles`
invisible aux onze tests d'isolation, **qui portaient tous sur des tables**. Un test qui ne
porte que sur des tables ne verra pas ce trou-là non plus.

### Piège n°9 — Le serveur de développement écoute sur 3333, et l'hôte compte

Naviguer sur `localhost:3333`, **jamais `127.0.0.1:3333`** : Next 16 bloque ses ressources de
développement en cross-origin, l'hydratation échoue, les formulaires partent en GET natif — et
**rien ne le dit dans le navigateur**, seulement dans la sortie du serveur.
`supabase/config.toml:174` porte déjà `site_url = "http://localhost:3333"` pour cette raison ;
toute URL de redirection OAuth ajoutée doit suivre la même forme, et `additional_redirect_urls`
(179-182) porte déjà les deux.

### Piège n°10 — `supabase gen types` est dû si et seulement si la forme du schéma change

Une **politique** seule ne change pas les types ; une **colonne** ou une **table**, si. Sous (B),
la Task 3 ne pose que des politiques → rien à régénérer. Sous (A), `device_credentials` est une
table → régénération due, **avec `--local`** et jamais `--linked` : le distant n'a pas encore les
migrations au moment où l'on génère (`project-context.md` § migrations).

### Frontières — ce que cette story ne fait pas

- **Aucun outil de liste, de recette, de menu, de rayon ou de règle.** 7.2, 7.3, 7.4.
- **Aucun écran de gestion des appareils.** 5.7 — la moitié reportée se date (Task 6).
- **Aucune refonte de `grocery_list_items` ni de `generate_grocery_list_from_menu`.** Epic 4.
- **Aucune contrainte de base sur le texte libre des recettes.** Rouvert par la 7.3
  (§ REFERME n°2), pas ici.
- **Aucun pont Google, aucun Shortcut iOS.** Epic 6, même si AD-9 les nomme au même endroit.
- **Aucune correction de `households_insert`** (foyers orphelins, `deferred-work.md`) : sans
  rapport, et la base n'est plus gelée mais ce n'est pas ce commit-ci.

### Contraintes d'architecture applicables

- **AD-1** — la règle métier vit en Postgres. Le serveur MCP est un **adaptateur mince**, jamais
  un dépôt de règles. S'il contient un `if` qui décide d'un droit, il est au mauvais endroit.
- **AD-2** — l'isolation est appliquée **au niveau de la donnée**, sur les 10 tables. Aucune
  `SUPABASE_SERVICE_KEY`, aucun chemin bypass. C'est l'AC1.
- **AD-9** — identité scopée foyer, révocable à l'unité, périmètre restreint, jamais d'accès
  admin foyer. ⚠️ **Amendé par la Décision 1 si (B)** — l'amendement s'écrit (Task 8).
- **AD-13** — le critère est la **cause**, pas l'analogie : la surface MCP est côté serveur
  parce qu'elle exige un secret serveur, pas parce qu'elle « ressemble » à une API.
- **AD-17** — l'isolation se prouve par un test **exécuté**. Le job CI `isolation` existe pour
  ça ; il n'existait pas jusqu'au 2026-07-29 et les 17 tests ne tournaient nulle part.
- **NFR-5 / NFR-6** — isolation par foyer ; un appareil n'est jamais promu membre.
- **NFR-9** — mots bannis, y compris dans Claude conversationnel.
- **NFR-10** — coût de possession. Décision 3.
- ⚠️ **La RLS est par FOYER, pas par membre.** `profiles` n'a aucune colonne de rôle. Ne jamais
  inventer un contrôle d'accès applicatif pour distinguer les membres — il serait contournable
  à un appel PostgREST près. **Le périmètre de cette story porte sur la SURFACE, pas sur la
  personne** : c'est exactement la décision de Florian du 2026-07-30 (`EXPERIENCE.md`
  § Foundation), et elle s'applique mot pour mot ici.

### Standards de test

- `npm test` → `node --test "lib/**/*.test.ts"` — unitaires, faux clients, aucun réseau.
- `npm run test:isolation` → `node --test "supabase/tests/**/*.test.ts"` — exige
  `npx supabase start`. **Aucun repli silencieux** : `stack-local.ts` lève si le stack est
  absent, volontairement.
- ⚠️ **`node --test` sur un glob vide rend 0.** Les deux jobs CI comptent les fichiers avant de
  lancer (`ci.yml:75` et `ci.yml:153`). Toute porte ajoutée doit répondre à : « que se passe-t-il
  si elle ne trouve rien à contrôler ? »
- Le **témoin négatif** est un motif du dépôt, pas une option : prouver d'abord en `service_role`
  que les deux foyers existent.
- ⚠️ **Un faux client ne modélise pas la RLS.** L'AC2 ne peut pas être prouvé dans `lib/`.
- Les quatre portes avant de conclure : `npm test`, `npm run typecheck`,
  `npm run lint`, `npm run build`. Plus `npm run check:migrations` si une migration est posée.
- **Piège d'outillage** : après suppression d'une route, `typecheck` échoue sur un validateur
  périmé sous `.next/dev/types/`. Purger `.next` avant de conclure à une régression.

### Project Structure Notes

Fichiers attendus — sous le chemin (B) :

```text
app/
  api/mcp/route.ts              # NEW — serveur MCP (mcp-handler)
  oauth/consent/page.tsx        # NEW — écran de consentement, français, deux thèmes
lib/supabase/
  mcp.ts                        # NEW — fabrique de client portant le jeton de la conversation
supabase/
  config.toml                   # UPDATE — [auth.oauth_server] enabled = true
  migrations/<horodatage>_*.sql # NEW — périmètre : client_id is null sur les surfaces admin
  tests/*.test.ts               # UPDATE ou NEW — isolation + refus + révocation
docs/configuration.md           # UPDATE
_bmad-output/planning-artifacts/architecture/…/ARCHITECTURE-SPINE.md  # UPDATE — AD-9
_bmad-output/project-context.md # UPDATE — NFR-10, si la Décision 3 l'ouvre
```

⚠️ **`app/api/` n'existe pas encore dans ce dépôt.** Le seul Route Handler actuel est
`app/auth/callback/route.ts`, placé auprès de sa surface et non dans un `api/`. Suivre la
convention existante (`app/mcp/route.ts`) ou ouvrir `app/api/` est une micro-décision de
structure : **choisir, et l'écrire**, plutôt que de laisser deux conventions coexister.
⚠️ `proxy.ts:14` porte un `matcher` — vérifier que la route MCP n'y passe pas se faire
rediriger vers `/login` comme une page.

### Ce que tu sais déjà, et où ça vit

- `project-context.md` — **à charger en entier avant d'écrire une ligne.** Sept règles de méthode,
  les contraintes Tailwind 4 / migrations / prévisualisations, et le tableau des motifs à
  reprendre.
- `deferred-work.md` — 824 lignes de reports datés. Les trois qui nomment l'Epic 7 sont traités
  en § REFERME ; ne pas en rouvrir d'autres au passage.
- `ARCHITECTURE-SPINE.md` — AD-1, AD-2, AD-9, AD-13, AD-17 et l'`[ASSUMPTION]` que cette story
  résout.
- `EXPERIENCE.md:55` — la surface Claude : *« Piloter + planifier | Bureau, dimanche soir |
  Périmètre strict au foyer (FR-39) ; aucun jargon rendu à l'écran »*.

### Intelligence git

Cinq derniers commits — tous Epic 3, tous du même motif : une story, une PR, un commit de
fusion. `9c127d4` (3.6) est la base de cette story.

**Ce que l'Epic 3 a appris et qui vaut ici :**

- `7277c8b` — *« revue adversariale de la story 3.2 »* : une correction post-livraison qui a
  demandé son propre commit. Règle §6 : la passe de correction se revoit à son tour.
- `2ad08c4` — *« Refuser l'hôte de connexion directe, que le port ne distinguait pas »* : un
  défaut d'outillage de migration qu'aucune porte ne voyait. Les migrations de ce dépôt ont déjà
  mordu.
- `959a626` — le passage des possessifs à la première personne, 20 chaînes. **La microcopy de
  `/oauth/consent` doit naître conforme**, pas être reprise dans un commit de rattrapage.
- `f29c1a1` — *« et la garde d'isolation qu'elle a révélée »* : une story de surface qui
  découvre un trou de RLS en chemin. **C'est le scénario le plus probable de cette story-ci**,
  et le § Piège n°3 est là pour qu'il soit découvert *avant* et non *pendant*.

### Ce qui est à jour au 2026-08-05 — vérifié à la source

**Mesuré** (`npm view`, `npx supabase --version`, lecture de `package.json` et `config.toml`) :

- CLI Supabase **2.111.0**. `supabase/config.toml` porte déjà `[auth.oauth_server]`
  (411-417, `enabled = false`) et `[auth.third_party.*]` pour **quatre** fournisseurs seulement
  (firebase, auth0, aws_cognito, clerk) — **il n'y a pas d'option « émetteur OIDC quelconque »**.
  Le chemin « on héberge notre propre JWKS et Supabase lui fait confiance » **n'est pas
  disponible** ; c'est ce qui réduit la Décision 1 à (A) ou (B).
- `mcp-handler` **2.1.0** — pairs `@modelcontextprotocol/server ^2.0.0` et `next >=13`,
  `engines.node >= 20` (on est épinglé **24.x**, `package.json` + `.node-version`).
- `@modelcontextprotocol/server` **2.0.0** → `zod ^4.2.0` + `@modelcontextprotocol/core` 2.0.0.
- `@modelcontextprotocol/sdk` **1.30.0** → `express`, `hono`, `cors`, `jose`, `ajv`,
  `eventsource`, `zod-to-json-schema`, `express-rate-limit`. Nettement plus lourd.

**Rapporté par la documentation** (non exécuté ici — règle §1) :

- Supabase Auth expose `/.well-known/oauth-authorization-server` et **se déclare conforme à la
  spécification d'authentification OAuth 2.1 de MCP**. Les jetons portent `role`, `sub` et
  `client_id` ; les politiques RLS lisent `auth.jwt() ->> 'client_id'`, et l'absence de ce claim
  distingue une session de première partie d'un client OAuth.
- Le serveur OAuth 2.1 est **en bêta**, gratuit sur tous les plans pendant la bêta. Les portées
  granulaires sont annoncées mais pas livrées : un jeton ouvre aujourd'hui tout ce que le membre
  peut faire — **d'où la Task 3**.
- Révoquer un client invalide immédiatement ses sessions et ses jetons de rafraîchissement.
- Clés de signature : `supabase gen signing-key --algorithm ES256`, import en clé de secours puis
  rotation ; en-tête `kid` requis ; claims requis `role` et `exp`, `sub` recommandé ; claims
  libres autorisés. Le secret partagé historique est « déconseillé en production ».
- `mcp-handler` 2.x sert la spécification MCP du **2026-07-28** en mode sans état, **sans Redis
  ni stockage de session**, avec une couche de compatibilité pour les clients Streamable HTTP
  de 2025. Claude accepte les serveurs distants SSE et Streamable HTTP (SSE en voie de
  dépréciation) et prend en charge l'enregistrement dynamique de clients.

⚠️ **Tout ce bloc « rapporté » est à re-mesurer par la Task 1 avant d'y appuyer une décision.**
Trois défauts de ce dépôt en deux jours sont nés d'une déduction consignée comme vérifiée, dont
un qui a atteint le déploiement.

### References

- `_bmad-output/planning-artifacts/epics.md#Story-7.1` — critères, verbatim
- `_bmad-output/planning-artifacts/epics.md#Story-5.1`, `#Story-5.7` — ce que l'AC1 et l'AC3 citent
- `ARCHITECTURE-SPINE.md` — AD-1 (l.29-32), AD-2 (l.34-37), AD-9 (l.69-72), AD-13 (l.89-92),
  AD-17 (l.109-112), `[ASSUMPTION]` jetons (l.299)
- `prd.md` l.168-173 — FR-36 à FR-39 et *« FR-39 est une exigence de sécurité, pas de confort »*
- `addendum.md` l.43 — la tension d'origine : *« Le serveur MCP utilise `SUPABASE_SERVICE_KEY`,
  ce qui contourne le RLS »*
- `EXPERIENCE.md` l.55, l.94, l.208-218 — surface Claude, mots bannis, Flow 4
- `project-context.md` — les sept règles de méthode ; §§ Tailwind 4, migrations,
  prévisualisations, microcopy, architecture
- `deferred-work.md` l.56 (garde d'invitation), l.585-601 (texte libre des recettes),
  l.643 (intégrité `recipe_id`, **déjà refermé** par la 3.6)
- `supabase/migrations/20260502000000_initial_schema.sql` — `current_household_id()` (48-57),
  politiques (248-323), `generate_household_invite` (~440), `grocery_list_items` (194-206),
  `generate_grocery_list_from_menu` (~517)
- `supabase/migrations/20260729094500_grant_table_privileges.sql` l.55-71 — `execute` accordé
  sur **toutes** les fonctions à `authenticated`, privilèges par défaut compris
- `supabase/migrations/20260729095922_guard_seed_default_aisles.sql` — le précédent exact du
  piège n°8 : un `security definer` que onze tests portant sur des tables ne voyaient pas
- `supabase/migrations/20260727161200_guard_invite_use_count.sql` l.34-45 — la garde par effet
  de bord de `redeem_household_invite`
- `supabase/config.toml` — `[auth]` (155+), `site_url` (174), `additional_redirect_urls`
  (179-182), `[auth.third_party.*]` (388-409), `[auth.oauth_server]` (411-417)
- `.github/workflows/ci.yml` l.72-86, l.102-165 — les deux comptages de fichiers de test
- `app/_lib/garde.ts` l.24-26 — la séparation faite pour cette story
- [Supabase — MCP Authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [Supabase — OAuth 2.1 Server](https://supabase.com/docs/guides/auth/oauth-server)
- [Supabase — Token Security & RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- [Supabase — JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Supabase — Third-party auth](https://supabase.com/docs/guides/auth/third-party/overview)
- [Vercel — mcp-handler](https://github.com/vercel/mcp-handler)
- [Claude — Building custom connectors via remote MCP servers](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Quoi |
|---|---|
| 2026-08-05 | Story créée. Quatre décisions ouvertes, dépendance Epic 5 datée, trois reports de `deferred-work.md` rouverts. |
</content>
</invoke>
