---
baseline_commit: f29c1a1
---

# Story 2.2: Réordonner le parcours par manipulation directe

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a membre configurant le foyer (Florian),
I want réordonner mes rayons en les manipulant directement,
so that l'ordre des rayons corresponde à l'ordre où je traverse physiquement le magasin — sans saisir de numéro.

## Acceptance Criteria

**AC1 — Déplacer sans saisir de numéro**
**Given** la liste des rayons du foyer
**When** Florian déplace un rayon par glisser ou par un contrôle monter/descendre
**Then** le nouvel ordre est persisté dans `sort_order`, **sans jamais demander la saisie d'un
numéro d'ordre** (FR-12)

**AC2 — L'ordre reste cohérent**
**Given** une réorganisation en cours
**When** Florian relâche un rayon à une nouvelle position
**Then** l'ordre reste cohérent (positions uniques, aucun rayon perdu ou dupliqué)

**AC3 — L'écran reflète le nouvel ordre**
**Given** l'écran des rayons lui-même
**When** le parcours est réordonné
**Then** l'écran reflète immédiatement le nouvel ordre. *(Que la **liste de courses** s'affiche dans
cet ordre est déjà tenu par la vue `grocery_list_by_aisle`, ordonnée
`coalesce(a.sort_order, 9999)` — démontré en Epic 4, story 4.2, pas ici.)*

[Source: _bmad-output/planning-artifacts/epics.md#Story-2.2 — cité verbatim]

> ⚠️ **AC1 dit « par glisser **ou** par un contrôle monter/descendre ». Décision de Florian du
> 2026-07-30 : les DEUX.** Le glisser est donc dans le périmètre — fait à la main, sans dépendance
> (NFR-10), sur événements de pointeur et non sur `draggable` HTML5, qui n'émet rien au toucher sur
> iOS. Les flèches ne sont pas pour autant optionnelles : voir piège n°1, elles sont ce qui rend le
> glisser **conforme**.
>
> ⚠️ **AC2 est le critère coûteux, et il ne se tient pas côté écran.** « Positions uniques, aucun
> rayon perdu ou dupliqué » est un invariant de données : il se pose en Postgres et se **mesure** par
> un test exécuté. Le mécanisme est éprouvé sur le stack local avant d'être prescrit — voir
> « Le mécanisme, mesuré » ci-dessous.
>
> ⚠️ **AC3 dit « immédiatement », et la story ne livre pas l'instantané.** Sans mise à jour
> optimiste, un aller-retour sépare la pression de son reflet. **Lecture retenue : « immédiatement »
> s'oppose à « après un rechargement manuel »**, ce que `router.refresh()` satisfait — c'est la même
> lecture que la story 2.1 a appliquée à ses cinq gestes, et sa parenthèse renvoie explicitement à la
> liste de courses (Epic 4) pour le reste. **Si la revue veut lire « instantané », c'est la question 2
> qu'elle rouvre, pas un correctif** : elle a son coût (`useOptimistic`) et rien ne l'éprouve
> automatiquement. Dis dans la PR laquelle des deux lectures tu as tenue, plutôt que de laisser le
> mot trancher tout seul.

## Tasks / Subtasks

- [x] **Task 1 — Migration : la fonction `reorder_aisles(uuid[])`** (AC: 1, 2)
  - [x] `npx supabase migration new reorder_aisles`
  - [x] ⚠️ **Requête de contrôle en en-tête, sans exception** — `npm run check:migrations` fait
        échouer la CI sans elle, et c'est un job requis pour la fusion. Deux requêtes ici :
        ```sql
        -- 1) La fonction ne doit pas déjà exister — attendu : 0 ligne.
        --    Une ligne signifierait que `create or replace` remplace quelque chose
        --    que personne n'a lu.
        select proname, pronargs, prosecdef from pg_proc where proname = 'reorder_aisles';

        -- 2) Informatif, pour la question 3 posée à Florian : y a-t-il déjà des
        --    ex æquo en production ? Attendu : 0 ligne, mais un résultat non vide
        --    ne bloque rien — la fonction les résorbe (contrôle 7).
        select household_id, sort_order, count(*) from aisles
         group by 1, 2 having count(*) > 1;
        ```
  - [x] ⚠️ **N'écris PAS « À CONTRÔLER AVANT `db push` ».** Ce moment n'existe plus : la fusion
        applique les migrations (`vercel.json` → `scripts/migrer-au-deploiement.mjs`). La requête
        s'exécute **en revue**, et son résultat se colle dans la PR. Cette formulation exacte a été
        un constat de revue sur les deux migrations de la story 2.1
  - [x] Le corps **exact** de la fonction éprouvée est en Dev Notes, « Le mécanisme, mesuré ».
        Reprends-le : chacune de ses quatre gardes a un contrôle mesuré derrière elle
  - [x] ⚠️⚠️ **PAS `security definer`.** C'est le point le plus important de cette migration.
        `seed_default_aisles` était `security definer` avec une identité en paramètre, et c'était un
        trou d'écriture inter-foyers refermé par la story 2.1. Ici la fonction ne prend **aucune
        identité** : elle reçoit des identifiants de rayons, et c'est la **RLS** (`aisles_all`,
        `using` + `with check`) qui décide lesquels sont atteignables. `security definer` la
        contournerait et rouvrirait exactement le même trou
  - [x] `set search_path = public` — toutes les fonctions du projet le posent, sauf
        `resolve_aisle_id` (hors périmètre, voir Frontières)
  - [x] **Aucun `grant execute` explicite.** `20260729094500_grant_table_privileges.sql` pose
        `alter default privileges in schema public grant all on functions`, qui couvre les fonctions
        créées ensuite par `postgres` — et Postgres accorde `execute` à `public` d'office. Que
        `authenticated` puisse bien l'exécuter est **mesuré** par le test d'isolation du chemin
        légitime (Task 7), pas affirmé ici
  - [ ] Répondre aux questions de `.github/pull_request_template.md` dans la PR — **non fait : aucune PR ouverte à ce stade.** À faire à l'ouverture de la PR

- [x] **Task 2 — Appliquer en local et régénérer les types** (AC: 1)
  - [x] `npx supabase db reset` — outil normal en local, interdit sur le distant
  - [x] ⚠️ **Si l'appel RPC rend `PGRST202 Could not find the function`** : c'est le cache de schéma
        de PostgREST, pas ton SQL. `notify pgrst, 'reload schema';` ou redémarrage du conteneur.
        `db reset` le fait de lui-même ; un `create function` appliqué à chaud, non
  - [x] `npx supabase gen types typescript --local` — **`--local`, jamais `--linked`** : le distant
        n'a pas la migration au moment où tu génères
  - [x] ⚠️ **Ici un diff EST attendu**, contrairement à la story 2.1 : `reorder_aisles` doit
        apparaître dans `Database["public"]["Functions"]`, sinon `supabase.rpc("reorder_aisles", …)`
        ne passe pas le `typecheck`
  - [x] ⚠️ **Mais ne recopie pas la sortie brute par-dessus le fichier committé.** Le CLI émet aussi
        un bloc `graphql_public` et une ligne `PostgrestVersion` que la story 2.1 a délibérément
        **écartés** — les commiter mêlerait une montée de version du CLI à cette story. Génère vers
        un fichier temporaire, `diff` contre le committé, et ne porte que l'ajout `reorder_aisles`.
        Si le diff montre autre chose, **dis-le** au lieu de le commiter
  - [x] `docs/migrations.md:135` dit « le bloc `Functions` doit lister les **sept** fonctions du
        schéma (au 2026-07-29) ». Elles seront **huit**. Mets la phrase à jour **avec sa date** —
        c'est un état de la base dans un commentaire, exactement la classe d'affirmation qui est
        devenue fausse cinq fois sur ce projet

- [x] **Task 3 — `lib/rayons/ordre.ts` : le pur, testé d'abord** (AC: 1, 2)
  - [x] TDD ici, comme sur `lib/rayons/saisie.ts` : le test précède l'usage et sa phase rouge se
        constate. C'est le seul endroit de cette story qui soit testable sans base ni navigateur
  - [x] **Un seul primitif, deux appelants.** Les flèches et le glisser produisent le même objet —
        une permutation complète — et ne doivent pas avoir deux implémentations :
    - [x] `ordreDeplace(rayons: ReadonlyArray<{ id: string }>, id: string, versIndex: number): string[] | null`
          — déplace `id` à la position `versIndex`. Rend la **liste complète** des identifiants dans
          le nouvel ordre, ou **`null` quand rien ne change** (déjà à cette place, index hors bornes,
          identifiant inconnu). `null` veut dire « n'appelle pas la base »
    - [x] `export type Sens = "haut" | "bas";`
          `ordreApresDeplacement(rayons, id, sens): string[] | null` — **délègue à `ordreDeplace`**
          avec `index ± 1`. Ne réécris pas la permutation ici
  - [x] ⚠️ **Rend l'ordre complet, pas un couple à échanger.** La fonction Postgres renumérote tout
        le parcours ; lui envoyer deux identifiants la ferait échouer sur sa garde de cardinal. Et
        l'échange de deux valeurs est cassé de toute façon — voir piège n°3
  - [x] `indexCibleDuGlisser(centresAutres: readonly number[], centreTireY: number): number` — la
        **géométrie du glisser, extraite en pur donc testable**. `centresAutres` = les ordonnées des
        centres des lignes **autres que celle qu'on tire**, dans l'ordre d'affichage. Le résultat est
        le nombre de centres strictement au-dessus de `centreTireY`. Robuste aux hauteurs de ligne
        inégales — et une ligne dont le nom passe sur deux lignes EST plus haute que ses voisines
  - [x] `lib/rayons/ordre.test.ts` — au minimum :
    - [x] `ordreApresDeplacement` : monter depuis le milieu · monter le premier (`null`) · descendre
          le dernier (`null`) · liste d'un seul rayon (`null` des deux côtés) · liste de deux (les
          deux sens) · identifiant inconnu (`null`)
    - [x] `ordreDeplace` : premier → dernier · dernier → premier · vers sa propre place (`null`) ·
          `versIndex` négatif ou ≥ longueur (`null`)
    - [x] **Sur chaque cas : l'ensemble des identifiants rendus est exactement celui reçu, sans
          perte ni doublon.** C'est AC2 au niveau du pur, et c'est l'assertion à ne pas oublier
    - [x] Deux rayons de même `ordre` (ex æquo) : les fonctions travaillent sur la **position dans
          le tableau reçu**, jamais sur `ordre`
    - [x] `indexCibleDuGlisser` : au-dessus de tous (0) · en dessous de tous (longueur) · entre deux
          · hauteurs inégales · liste vide
  - [x] ⚠️ **Les tests vivent sous `lib/`.** Le glob de `npm test` est `lib/**/*.test.ts` ; un test
        déposé sous `app/` ne s'exécute pas et la CI reste verte. Le job `verify` compte les fichiers
        avant de lancer les tests, mais il compte `lib`, pas le tien en particulier
  - [x] ⚠️ **N'invente pas `peutMonter` / `peutDescendre`.** L'écran connaît déjà l'index par son
        `map((rayon, i) => …)` : `i === 0` et `i === rayons.length - 1` suffisent. Une fonction sans
        appelant est une dette

- [x] **Task 4 — `lib/rayons/erreurs.ts` : traduire le refus de la fonction** (AC: 2)
  - [x] Ajouter `refusOrdre(erreur): "liste-changee" | "echec"` au module existant, **sans toucher à
        `refusRayon`** : ce sont deux surfaces d'erreur distinctes
  - [x] SQLSTATE d'abord, comme `refusRayon` : `raise exception` sans `errcode` rend **`P0001`**
        (mesuré). Les quatre gardes de la fonction le rendent toutes, et elles disent toutes la même
        chose à l'utilisateur : *la liste que tu m'as envoyée ne correspond plus à la base*
  - [x] Étendre `lib/rayons/erreurs.test.ts` : `P0001` → `"liste-changee"`, erreur sans code →
        `"echec"`, `null` → `"echec"`
  - [x] ⚠️ **Ne mappe pas sur le texte du message.** Le message de la fonction est en français
        technique et il n'est pas destiné à l'écran (NFR-8) — il part dans `console.error`, pas
        devant l'utilisateur

- [x] **Task 5 — L'écran, chemin flèches : à livrer EN ENTIER avant de toucher au glisser** (AC: 1, 2, 3)
  - [x] `app/rayons/ListeRayons.tsx` — **modifié**, pas de nouveau fichier
  - [x] ⚠️ **La ligne doit être restructurée, et c'est le risque de régression n°1.** Aujourd'hui
        toute la ligne **est** un `<button id="rayon-{id}" aria-label="Modifier {nom}">`. Un
        `<button>` ne peut pas en contenir un autre. Voir piège n°4 pour la forme exacte, la
        largeur disponible chiffrée, et ce qui doit être **préservé**
  - [x] ⚠️ **`id="rayon-{id}"` est porteur** : `fermer(\`rayon-${rayon.id}\`)` le vise depuis
        « Annuler » et depuis un enregistrement réussi. Le renommer casse en silence le retour de
        focus que la seconde passe de revue du 2026-07-29 a installé et mesuré dans le DOM
  - [x] Deux boutons par ligne : `id="monter-{id}"` / `id="descendre-{id}"`, chacun
        `aria-label={\`Monter ${rayon.nom}\`}` / `Descendre ${rayon.nom}`, glyphe visible en
        `aria-hidden` (le nom est déjà dans l'`aria-label`)
  - [x] `disabled` en bout de course : `i === 0` pour monter, `i === rayons.length - 1` pour
        descendre — **et** `disabled={occupe}` sur les deux. Voir piège n°5 : sans `occupe`, deux
        pressions rapides calculent le même ordre depuis les mêmes propriétés et la seconde est
        silencieusement perdue
  - [x] Cible ≥ 44px : `min-h-11 w-11` (UX-DR11)
  - [x] ⚠️ **Aucune classe CSS nouvelle.** `app/globals.css` reste **inchangé** — une classe sans
        appelant est une dette, et `.btn-quiet` est souligné (c'est un lien, pas une flèche).
        Emploie des utilitaires en ligne, comme le fait déjà le bouton de ligne. L'anneau de focus
        est une règle globale `:focus-visible`, ne le répète pas
  - [x] `deplacer(rayon, sens)` : `ordreApresDeplacement(...)` → si `null`, **ne fait rien et
        n'affiche rien** (le bouton était désactivé, on n'arrive normalement pas là) ; sinon
        `soumettre(...)` → `supabase.rpc("reorder_aisles", { p_ids: ordre })` → `router.refresh()`
  - [x] `setZone("liste")` avant la soumission : le message appartient à la liste, pas au panneau
  - [x] ⚠️ **Le focus, et c'est le risque de régression n°2.** Voir piège n°6 : le bouton pressé
        peut devenir `disabled` par le déplacement même, et un bouton désactivé **perd le focus**.
        Pose `retourFocus.current` **avant** la soumission, sur le bouton qui sera encore actif
  - [x] ⚠️ **Ne touche NI aux dépendances de l'effet de focus (`[enEdition, rayons]`), NI au
        mécanisme de `ref`.** `rayons` dans les dépendances est porteur : c'est ce qui a réparé le
        bouton de restauration, oublié par la première passe de revue. Ton déplacement passe par le
        même chemin — tu poses la cible, le rendu suivant la consomme
  - [x] ⚠️ **Aucune copie locale de la liste, aucune mise à jour optimiste.** La liste vient des
        propriétés, `router.refresh()` la rafraîchit. Conséquence assumée et à **mesurer** au
        parcours, pas à déduire : une latence sépare chaque pression de son reflet (question 2)
  - [x] Un refus : `refusOrdre(error)` → `"liste-changee"` déclenche **aussi** `router.refresh()`.
        Sans ça, l'écran resterait en désaccord avec la base et chaque nouvelle pression
        reproduirait le même refus — l'impasse exacte que `disparu()` a été écrit pour fermer
  - [x] **Une quatrième région de statut, sous le `<ul>`** — décision de Florian du 2026-07-30.
        Voir piège n°7 : zone `"parcours"`, montée en permanence, **sans `reserve`** (elle est en
        dessous, pas au-dessus d'une cible)
  - [x] ✋ **Ne commence pas la Task 6 avant que ce chemin soit complet et vu à l'écran.** Le glisser
        se pose par-dessus ; sur des flèches à moitié faites, il n'a aucun filet

- [x] **Task 6 — L'écran, chemin glisser** (AC: 1, 2, 3) — *décision de Florian du 2026-07-30*
  - [x] Une **poignée** par ligne, à gauche : `<span>` et **non `<button>`**, `aria-hidden="true"`,
        `tabIndex={-1}`, glyphe de préhension (⠿ ou équivalent), `min-h-11 w-11`,
        `cursor-grab` / `cursor-grabbing`
  - [x] ⚠️ **`aria-hidden` sur un élément qui réagit au pointeur n'est PAS une erreur ici, et il ne
        faut pas le « corriger ».** La poignée n'a **aucun** comportement clavier : sa fonction est
        intégralement dupliquée par les deux flèches, qui sont de vrais boutons nommés. La masquer à
        l'API d'accessibilité évite d'annoncer un contrôle inopérant au lecteur d'écran. C'est ce qui
        satisfait **WCAG 2.5.7** — écris-le en commentaire, sinon une revue le « réparera »
  - [x] ⚠️⚠️ **`touch-action: none` sur la poignée, et sur elle seule.** Sans lui, le navigateur
        interprète le geste comme un défilement et **aucun `pointermove` n'arrive** — le glisser ne
        marche tout simplement pas au doigt. Le poser sur la liste entière casserait le défilement de
        la page. C'est le défaut n°1 d'un glisser fait main
  - [x] `setPointerCapture(e.pointerId)` sur la poignée au `pointerdown` : sans lui, sortir du
        rectangle de la poignée (ce qui arrive immédiatement) fait perdre les événements
  - [x] Le déroulé, la forme exacte et l'aperçu transitoire sont au **piège n°9**. Reprends-le
  - [x] `pointercancel` **et** `Escape` annulent : l'aperçu est jeté, rien n'est écrit
  - [x] Au relâchement : `indexCibleDuGlisser(...)` → `ordreDeplace(...)` → si `null`, **rien** (pas
        d'appel, pas de message) ; sinon le même chemin de soumission que les flèches
  - [x] ⚠️ **Aucune transition CSS nulle part dans le glisser.** La ligne tirée suit le pointeur en
        1:1 (`transform: translateY`), les autres se réarrangent instantanément. C'est plus simple
        **et** ça satisfait `prefers-reduced-motion` sans code conditionnel (UX-DR11) — le retour
        d'état direct au geste reste immédiat, c'est le mouvement décoratif qui est banni
  - [x] ⚠️ **Pas de défilement automatique en bord d'écran** — limite assumée, à **écrire** dans
        `deferred-work.md` et dans la PR, jamais à taire. On ne peut donc glisser qu'à l'intérieur de
        la zone visible ; les longs trajets passent par les flèches. C'est précisément la
        complémentarité des deux mécanismes. *(Règle du projet : un périmètre borné se dit, sinon il
        se lit comme « tout est couvert ».)*
  - [x] Pendant `occupe`, `pointerdown` **retourne immédiatement** : une poignée n'est pas un
        `<button>`, `disabled` n'existe pas dessus. Même raison qu'au piège n°5
  - [x] Le focus n'est **pas** déplacé sur le chemin glisser — un utilisateur au pointeur ne navigue
        pas au focus, et le lui bouger serait une surprise. Écris-le : la dissymétrie avec les
        flèches est voulue, pas un oubli

- [x] **Task 7 — Étendre le filet d'isolation** (AC: 1, 2)
  - [x] `supabase/tests/isolation.test.ts` — pas `contraintes.test.ts`, qui porte l'accord
        client/base sur les invisibles et rien d'autre
  - [x] ⚠️⚠️ **Le piège du test lui-même, mesuré : construis le tableau des rayons de B avec le
        client `admin` (`service_role`), jamais avec celui de A.** Sous RLS, `A.from("aisles")
        .select("id")` ne rend **aucune** ligne de B — un tableau vide, donc un refus par la garde
        « aucun rayon à ordonner » au lieu de la garde qui compte. Le test passerait en ne prouvant
        rien. Ce faux positif a été **rencontré** en éprouvant le mécanisme
  - [x] Les tests, au minimum :
    - [x] A envoie les **11 identifiants de B** (bon cardinal, tous étrangers) → **refusé**, et les
          `sort_order` de B sont **inchangés** (témoin négatif — la règle de l'en-tête du fichier)
    - [x] A envoie **10 des siens + 1 de B** (bon cardinal) → refusé, rien n'a bougé chez ni l'un ni
          l'autre
    - [x] A envoie une liste **partielle** des siens → refusé. C'est AC2 : un renumérotage partiel
          créerait des ex æquo
    - [x] A **cite deux fois** le même rayon → refusé
    - [x] Un appel **anonyme** → refusé
    - [x] Le chemin légitime : A renumérote son propre parcours dans un ordre choisi → accepté, les
          positions sont **10, 20, … et toutes distinctes**, et l'ordre lu correspond au tableau
          envoyé. C'est ce test qui prouve aussi que `authenticated` a bien `execute`
  - [x] ⚠️ **Vérifie les dents.** Retire à la main la garde de cardinal sur la base locale, relance :
        le test « A envoie les 11 identifiants de B » doit **tomber**. Puis `db reset` et le compte
        doit revenir. La story 2.1 l'a fait ; c'est la seule preuve qu'un test mord
  - [x] ⚠️ **Ne « répare » ni l'ordre des tests existants ni leurs fixtures partagées** : l'en-tête
        du fichier explique que cet ordre *est* la démonstration du rayon de souffle
  - [x] `npm run test:isolation` — exige `npx supabase start` debout

- [x] **Task 8 — Vérification** (AC: 1, 2, 3)
  - [x] `npm run typecheck` · `npm run lint` · `npm run test` · `npm run build` · `npm run check:migrations`
        — succès, zéro avertissement. **Base de départ mesurée le 2026-07-30 : `npm test` 72/72,
        `npm run test:isolation` 20/20.** Cite tes propres comptes
  - [x] **Parcours à l'écran, sur le stack local**, jamais sur la prévisualisation — elle parle à la
        base de production, et la migration de cette PR n'y est pas appliquée : **AC1 et AC2 n'y sont
        pas démontrables**
  - [x] `.env.local` basculé vers le stack local puis **restauré**, avec l'empreinte comparée (la
        story 2.1 a employé SHA-256)
  - [x] Naviguer sur **`localhost:3333`**, jamais `127.0.0.1:3333` : Next 16 bloque ses ressources
        de développement en cross-origin, l'hydratation échoue, les formulaires partent en GET natif
        — et **rien ne le dit dans le navigateur**, seulement dans la sortie du serveur
  - [x] Les gestes **flèches** à voir pour de vrai :
    - [x] Monter un rayon du milieu · le descendre · remonter le premier (bouton désactivé) ·
          descendre le dernier (désactivé)
    - [x] **Amener un rayon du bas tout en haut**, pression après pression — et **dire combien de
          temps ça prend et comment ça se ressent** (question 2). Ne le déduis pas
    - [x] Ouvrir le panneau d'édition d'une ligne, puis déplacer **une autre** ligne : que devient le
          panneau ? (`enEdition` sur une ligne toujours présente — attendu : il reste ouvert)
    - [ ] Le rayon créé en dernier (`sort_order` 1009, après « Autre ») ramené où Florian le veut —
          c'est l'arête que la story 2.1 a reportée ici.
          ⚠️ **NON FAIT : aucun rayon n'a été créé pendant ce parcours.** Le cas tient en logique — le
          renumérotage à `rang × 10` rend `prochainOrdre` cohérent — mais il n'a pas été vu à l'écran
  - [x] Les gestes **glisser**, et il en faut deux séries :
    - [ ] ⚠️⚠️ **À la SOURIS *et* AU DOIGT.** Ce sont deux chemins de code différents dans le
          navigateur : `touch-action`, la capture de pointeur et le défilement concurrent
          n'existent qu'au toucher. **Un glisser qui marche à la souris ne prouve rien du toucher** —
          c'est exactement la classe d'erreur qui a fait écarter `draggable` HTML5. Emploie
          l'émulation tactile des outils de développement, et **si un iPhone est à portée, le vrai**.
          ⚠️ **SOURIS FAITE, DOIGT NON FAIT.** Le geste réel a été joué à la souris, avec capture de
          pointeur obtenue (`gotpointercapture`). Le mécanisme qui conditionne le toucher est
          **mesuré** — `touch-action: none` bien appliqué sur la poignée et sur elle seule, styles
          calculés à l'appui — mais le geste au doigt n'a **pas** été observé. C'est la vérification
          qui reste avant la fusion
    - [ ] Descendre un rayon de deux crans, le remonter · le lâcher **à sa place de départ**
          (attendu : aucun appel, aucun message) · le lâcher **hors de la liste**.
          ⚠️ **Partiel.** Le relâchement **à sa place de départ** est vérifié (aucun trait, aucun
          appel, ordre inchangé). Le glisser vers le **bas** et le relâchement **hors de la liste**
          n'ont pas été joués — seuls des glissers vers le haut l'ont été
    - [x] **Annuler en cours de geste** par `Escape` : la liste revient à son état, rien n'est écrit
    - [ ] Glisser une ligne dont le nom **passe sur deux lignes** — c'est le cas que
          `indexCibleDuGlisser` est écrit pour tenir.
          ⚠️ **NON FAIT.** À la largeur de contrôle (511px CSS), aucun des onze noms amorcés ne passe
          sur deux lignes ; il aurait fallu créer un rayon au nom long exprès. Le cas est couvert par
          les tests purs (hauteurs inégales), pas par l'œil
    - [ ] **Défiler la page pendant qu'on tire** (limite connue) : dire ce qui se passe, sans le
          corriger.
          ⚠️ **NON FAIT.** Le comportement attendu est **raisonné** et consigné dans
          `deferred-work.md` ; il n'est pas observé
    - [x] Un tap franc sur la poignée : il ne doit **pas** ouvrir le panneau d'édition
  - [x] Les **deux thèmes**, bascule au réglage d'apparence macOS et non par émulation des outils de
        développement (`globals.css:68` lit `prefers-color-scheme`) :
        `osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true'`
        — **et le remettre à l'état de départ après**
  - [x] **Le focus, relevé dans le DOM** (`document.activeElement`) après chaque déplacement, y
        compris celui qui désactive le bouton pressé. Pas de déduction : c'est là que les deux passes
        de revue de la story 2.1 ont trouvé leurs défauts
  - [x] Tenue à **200 % de zoom, sans défilement horizontal** (UX-DR11) — la ligne porte maintenant
        deux contrôles de plus sur une colonne de 336px (piège n°4)
  - [x] Navigation clavier complète : `Tab` atteint les trois contrôles de la ligne dans un ordre
        sensé, `Entrée` sur une flèche déplace, l'anneau de focus est visible dans les deux thèmes
  - [x] Grep des mots bannis dans les chaînes rendues (NFR-9) : synchronisation, jeton/token, API,
        MCP, pont, Supabase, RLS, cache
  - [x] Grep : aucune couleur hors tokens de DESIGN.md — `bg-red-*`, `text-gray-*`, `bg-white`
        n'existent plus dans la chaîne de build et échoueraient **en silence**
  - [x] Consigner dans `deferred-work.md` : (a) la fermeture — ou non — de l'arête du bouton de
        restauration héritée de la 2.1 ; (b) tout choix écarté ou case laissée vide, avec sa raison
  - [x] ⚠️ **Ne consigne comme vérifié que ce qui a été exécuté, en citant la commande. Une
        déduction s'écrit « déduit », un fait rapporté « rapporté par X ».** C'est la première règle
        de `project-context.md`, et elle a été violée après avoir été écrite

## Dev Notes

### Le mécanisme, mesuré

**Exécuté le 2026-07-30 sur le stack local** — deux comptes, deux foyers, sonde jetable supprimée et
base remise à l'état du dépôt par `npx supabase db reset` (contrôlé : `pg_proc` ne contient plus
`reorder_aisles`, aucun foyer de sonde ne subsiste). Ce n'est pas une esquisse : c'est le corps qui a
passé les huit contrôles ci-dessous.

```sql
create or replace function reorder_aisles(p_ids uuid[])
returns void
language plpgsql
-- PAS `security definer`. Voir Task 1 : c'est la RLS qui décide quels rayons
-- sont atteignables, et il n'y a aucune identité en paramètre à recontrôler.
set search_path = public
as $$
declare
  v_attendu int;
  v_touches int;
begin
  -- Garde 1 — rien à ordonner.
  if p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'Aucun rayon à ordonner';
  end if;

  -- Garde 2 — un rayon cité deux fois occuperait deux positions.
  if array_length(p_ids, 1) <> (select count(distinct id) from unnest(p_ids) as t(id)) then
    raise exception 'Un rayon est cité deux fois';
  end if;

  -- Garde 3 — le tableau doit couvrir TOUT le parcours. Sous RLS, ce `count`
  -- ne voit que le foyer de l'appelant : c'est ce qui rend la comparaison sûre
  -- sans jamais nommer un `household_id`.
  select count(*) into v_attendu from aisles;
  if array_length(p_ids, 1) <> v_attendu then
    raise exception 'La liste des rayons a changé (% cités, % en base)',
      array_length(p_ids, 1), v_attendu;
  end if;

  update aisles a
     set sort_order = t.rang * 10
    from unnest(p_ids) with ordinality as t(id, rang)
   where a.id = t.id;

  -- Garde 4 — LA garde qui compte, et la seule qui attrape un appel forgé.
  -- Un `update` sur une ligne que la RLS masque ne rend AUCUNE erreur : il ne
  -- touche simplement rien. Sans ce comptage, un appel portant onze
  -- identifiants étrangers réussirait en n'ayant rien déplacé, et l'écran
  -- afficherait « C'est noté. ». C'est « lire `data` autant qu'`error »,
  -- transposé au SQL.
  get diagnostics v_touches = row_count;
  if v_touches <> array_length(p_ids, 1) then
    raise exception 'La liste des rayons a changé (% déplacés sur %)',
      v_touches, array_length(p_ids, 1);
  end if;
end;
$$;
```

| Contrôle | Résultat mesuré |
|---|---|
| A renumérote son parcours, ordre inversé | **ACCEPTÉ** — 11 rayons, **11 positions distinctes**, `10 … 110` |
| A envoie les **11 identifiants de B** (bon cardinal, tous étrangers) | **REFUSÉ — « 0 déplacés sur 11 »** (garde 4) ; les 11 positions de B intactes |
| A envoie **10 des siens + 1 de B** | **REFUSÉ — « 10 déplacés sur 11 »** (garde 4) |
| A envoie **5 de ses 11** | REFUSÉ — « 5 cités, 11 en base » (garde 3) |
| A cite **deux fois** le même rayon | REFUSÉ — « Un rayon est cité deux fois » (garde 2) |
| Appel **anonyme** | REFUSÉ — « 1 cités, 0 en base » : `anon` ne voit aucun rayon |
| **Ex æquo préexistants** — les 11 rayons forcés à `sort_order = 100` | 1 position distincte → **11 après renumérotage**. AC2 est réparateur, pas seulement préservateur |
| SQLSTATE des quatre `raise` | **`P0001`** — c'est ce que `refusOrdre` lit |

**Deux faits que la sonde a révélés et qui changent la façon d'écrire le test :**

1. **Sous RLS, A ne peut pas même *lire* les identifiants de B.** `A.select("id")` filtré sur le
   foyer de B rend zéro ligne, donc `array_agg` rend `null`. Mes deux premières tentatives de
   contrôle inter-foyers ont ainsi été refusées par la **garde 1** (« aucun rayon à ordonner ») et
   n'ont rien prouvé du tout. **Le tableau des rayons de B doit venir du client `admin`.** C'est la
   classe de faux positif que ce dépôt a rencontrée trois fois.
2. **`seed_default_aisles` refuse un appel sans identité** — « Not your household » même en rôle
   `postgres`, `auth.uid()` étant `null`. La garde de la story 2.1 fonctionne, et une fixture SQL
   directe doit semer les rayons par `insert`, pas par la fonction.

### Le piège n°1 — les deux mécanismes, et pourquoi les flèches ne sont pas optionnelles

**Décision de Florian, 2026-07-30 : glisser ET monter/descendre.** Trois contraintes encadrent le
glisser, et elles ne sont pas négociables.

1. **`draggable` HTML5 est hors jeu.** Il n'émet **aucun événement au toucher** sur iOS Safari, et
   NFR-1 nomme l'iPhone 15 Pro comme appareil de référence. Le glisser se fait sur **événements de
   pointeur** (`pointerdown` / `pointermove` / `pointerup` / `pointercancel`), qui unifient souris,
   stylet et doigt.
2. **NFR-10 interdit la bibliothèque.** Fait main, entièrement. Le piège n°9 donne la forme exacte.
3. ⚠️⚠️ **Les flèches sont ce qui rend le glisser CONFORME, pas un doublon.** **WCAG 2.5.7
   (« Dragging Movements », AA)** exige que toute fonction reposant sur un mouvement de glissement
   dispose d'une alternative à **pointeur simple** qui ne soit pas un glissement. Les boutons
   monter/descendre **sont** cette alternative — et ils sont aussi le seul chemin clavier
   (UX-DR11). **Livrer le glisser seul serait une régression d'accessibilité.** Si le budget se
   resserre, c'est le glisser qui saute, jamais les flèches.

Ordre de construction imposé : **les flèches d'abord et complètes** (Task 5), le glisser ensuite
(Task 6), par-dessus le même primitif pur. Un glisser posé sur des flèches à moitié faites n'aurait
aucun filet.

⚠️ **Ne livre AUCUN champ de position, AUCUN `<select>` de rang, AUCUN « déplacer vers… ».** FR-12
dit « manipulation directe, **pas par saisie d'un numéro d'ordre** » : un sélecteur numérique serait
la lettre même de ce qu'il refuse.
[Source: epics.md#FR-12 ; EXPERIENCE.md § Direct manipulation]

### Le piège n°2 — pourquoi une fonction Postgres et pas des `update` depuis le navigateur

L'instinct est de faire deux `update` en client-direct, comme le reste de l'écran. Il est faux ici,
et pour une raison qui est un critère, pas un goût.

AC2 exige que l'ordre reste cohérent — **positions uniques, aucun rayon perdu ou dupliqué**. C'est un
invariant sur *plusieurs lignes à la fois*. Onze `update` HTTP successifs depuis le navigateur ne
sont pas atomiques : une coupure réseau au sixième laisse un parcours à moitié renuméroté, avec des
ex æquo et un ordre que personne n'a demandé. AD-1 et AD-2 sont explicites — **la règle métier vit en
Postgres, jamais dans la vigilance d'une surface.**

⚠️ **Et ce n'est pas une contradiction avec AD-13.** AD-13 arbitre *Server Action contre
client-direct*. La réponse reste **client-direct** : l'appel RPC part du navigateur, exactement comme
`seed_default_aisles` dans `restaurer()`. Ce qui change, c'est *où vit la transaction*, pas *qui
l'émet*. Aucun secret serveur, aucune conséquence à faire apparaître dans un rendu serveur.

⚠️ **N'emploie pas `upsert`.** Un `upsert` sur `aisles` demanderait `name` et `household_id`, qui
sont `not null` — donc de renvoyer des noms depuis le navigateur, avec le risque d'écraser un
renommage fait entre-temps par l'autre membre du foyer.

### Le piège n°3 — échanger deux `sort_order` est cassé, il faut renuméroter

```sql
sort_order int not null default 100   -- 20260502000000_initial_schema.sql:78
-- ... et AUCUNE contrainte d'unicité dessus.
```

L'échange de deux valeurs paraît minimal. Il tombe sur trois choses :

1. **Les ex æquo sont légaux.** `sort_order` n'est pas unique, et son défaut vaut `100`, déjà pris
   par « Hygiène & Entretien ». Échanger deux valeurs **égales** est un no-op : l'écran ne bouge pas,
   la base ne rend aucune erreur, et il n'y a rien à afficher. Mesuré à l'envers dans le contrôle 7 —
   onze rayons à `100` donnent une seule position distincte.
2. **AC2 dit « positions uniques ».** Un échange préserve les doublons existants ; un renumérotage
   `rang * 10` les **résorbe** (1 position → 11, mesuré).
3. **Le pas de 10 reste cohérent avec l'existant.** `prochainOrdre` (`lib/rayons/saisie.ts`) fait
   `max + 10` ; après un renumérotage à onze rayons (`10 … 110`), un rayon créé vaut `120`. Le jeu
   amorcé emploie déjà ce pas.

⚠️ **Effet de bord voulu, à dire dans le résumé : « Autre » perd son `999`.** Le fourre-tout de fin
de parcours devient `110` au premier déplacement. Rien n'en dépend — la vue `grocery_list_by_aisle`
ordonne par `coalesce(a.sort_order, 9999)`, donc par valeur relative, jamais par le nombre 999. Et
c'est ce qui rend *manipulable* le rayon créé à `1009` par la story 2.1.

### Le piège n°4 — la ligne doit être restructurée, et la largeur est comptée

État actuel (`ListeRayons.tsx:525-542`) : **toute la ligne est un seul `<button>`**, portant
`id="rayon-{id}"`, `aria-label="Modifier {nom}"`, l'emoji en `aria-hidden`, le nom, et un eyebrow
« Modifier » à droite. Un `<button>` ne peut pas contenir un `<button>` : les flèches ne peuvent pas
y entrer.

La forme à viser — un `<div class="flex">` contenant **quatre** frères :

```
[⠿] [ 🥩  Boucherie          ] [ ↑ ] [ ↓ ]
 |     button#rayon-{id}        #monter #descendre
 |     aria-label=                -{id}   -{id}
 |       "Modifier Boucherie"
 span aria-hidden, tabIndex=-1, touch-action:none
```

**La largeur, chiffrée — et c'est serré.** `page.tsx` pose `max-w-sm` (384px) dans un `p-6` : environ
**336px** de contenu. Trois contrôles à 44px (poignée + deux flèches) = **132px**. Il reste ~204px
pour le bouton d'édition, dont 24px d'emoji : **~180px pour le nom**, soit ~21 caractères par ligne
en `text-base`. `MAX_NOM_RAYON` vaut 40, donc un nom long **passera sur deux lignes** — le
`break-all` actuel le permet déjà, et `indexCibleDuGlisser` est écrit pour des hauteurs inégales
précisément à cause de ça.

⚠️ **Si le 200 % de zoom casse** (UX-DR11 : colonne unique, aucun défilement horizontal), le
correctif sanctionné est de passer **cet écran seul** en `max-w-md` dans `app/rayons/page.tsx`. La
divergence avec `/foyer` est justifiée : `/foyer` n'a pas trois contrôles par ligne. **Ne rétrécis
jamais les cibles sous 44px pour gagner de la place** — c'est un plancher, pas un réglage.

- [ ] **Supprime l'eyebrow « Modifier »** : il n'a plus la place, et poignée + flèches disent
      maintenant que la ligne est manipulable. Le nom accessible du bouton reste dans son
      `aria-label`, donc rien n'est perdu pour un lecteur d'écran
- [ ] **Préserve `id="rayon-{id}"`**, visé depuis trois endroits pour le retour de focus
- [ ] **Préserve l'emoji en `aria-hidden`** (UX-DR4 : le nom est déjà en texte)
- [ ] **Un seul et même bouton pour ouvrir l'édition** — ne fractionne pas l'ouverture en deux
      cibles. La cible unique et généreuse était un choix motivé de la story 2.1
- [ ] **La poignée est hors du bouton d'édition**, pas dedans : sinon un tap dessus ouvrirait le
      panneau par propagation (piège n°9)
- [ ] Poignée et flèches sont **hors** du `<form>` d'édition : quand la ligne est ouverte, le
      `<form>` remplace toute la ligne. C'est cohérent — on ne déplace pas ce qu'on est en train de
      renommer. **Ne cherche pas à les garder visibles pendant l'édition**

⚠️ **200 % de zoom est un critère ferme** (UX-DR11 : colonne unique, aucun défilement horizontal).
Trois contrôles sur 336px, c'est exactement ce qui casse à 200 %. **À voir, pas à déduire.**

### Le piège n°5 — deux pressions rapides, et la seconde disparaît

Il n'y a **aucune mise à jour optimiste** (règle de la story 2.1 : pas de copie locale de la liste).
`ordreApresDeplacement` calcule donc depuis les **propriétés**, c'est-à-dire depuis le dernier rendu
serveur. Deux pressions avant l'arrivée du `router.refresh()` calculent le nouvel ordre depuis le
**même** état de départ : la seconde renvoie le même tableau que la première, la base ne bronche pas,
et le rayon a bougé d'un cran au lieu de deux. Aucune erreur, aucun message, un geste perdu.

`disabled={occupe}` ferme la course — et c'est aussi pour ça qu'il n'est pas optionnel ici.

⚠️ **Il y a un constat reporté juste à côté** : « les boutons de ligne sont les seuls de l'écran sans
`disabled={occupe}` » (revue 2, reporté). Il devient plus conséquent maintenant qu'une action de
ligne réordonne. Le refermer sur le bouton d'ouverture d'édition est **permis et bienvenu** ; ce
n'est pas obligatoire, mais si tu ne le fais pas, dis-le.

⚠️ **`useSoumission` a une ré-entrance connue et reportée** : `occupe` n'est jamais *lu* dans
`soumettre`, seulement rendu. C'est le `disabled` du JSX qui protège, rien d'autre. Ne compte pas sur
le hook — mets `disabled` sur les deux flèches.

### Le piège n°6 — le déplacement désactive le bouton qu'on vient de presser

C'est le défaut le plus probable de cette story, et il est de la même famille exacte que les trois
que les deux passes de revue du 2026-07-29 ont trouvés.

Monter l'avant-dernier rayon jusqu'à la première position : au rendu suivant, `i === 0`, donc
`#monter-{id}` devient `disabled`. **Un élément désactivé perd le focus, qui retombe sur `<body>`.**
Au clavier, il faut repartir de `Tab` en haut du document et retraverser tous les rayons. Idem pour
la dernière position avec `#descendre-{id}`.

Le mécanisme existe déjà, réutilise-le tel quel :

```ts
// AVANT la soumission, pas après : l'effet est réveillé par le changement de
// `rayons`, et il consomme la cible qu'il trouve.
retourFocus.current = /* le bouton encore actif après le déplacement */;
```

| Geste | Nouvelle position | Cible du focus |
|---|---|---|
| Monter, arrivée en `0` | première | `descendre-{id}` — `monter` sera désactivé |
| Monter, arrivée ailleurs | milieu | `monter-{id}` — le même bouton |
| Descendre, arrivée en dernier | dernière | `monter-{id}` |
| Descendre, arrivée ailleurs | milieu | `descendre-{id}` |

⚠️ **`disabled={occupe}` désactive aussi le bouton *pendant* la soumission**, donc le focus part sur
`<body>` brièvement avant que l'effet ne le ramène. C'est **prescrit ainsi** pour rester cohérent
avec tout l'écran — mais c'est une prédiction, pas une mesure. **Relève `document.activeElement`
après chaque geste et écris ce que tu observes.** Si le va-et-vient est perceptible, `aria-disabled`
+ un retour anticipé dans le gestionnaire est l'alternative : c'est une décision, pas un correctif à
prendre au passage.

### Le piège n°7 — annoncer un déplacement à qui ne voit pas l'écran

Le retour visuel du déplacement, c'est la ligne qui change de place. **Un lecteur d'écran n'en voit
rien** : le DOM se réordonne en silence, aucune annonce n'est émise. Or la position est précisément
l'information de cette story.

La région de statut `statutListe` existe déjà et est montée en permanence (`role="status"` +
`aria-live="polite"`, via `Notice`). Le message doit **nommer le rayon et son nouveau rang** — le
rang est la seule chose qu'on ne peut pas percevoir autrement.

⚠️ **Deux arêtes de rédaction française :**

- Le rang 1 s'écrit **« 1re »**, jamais « 1ᵉ » ni « 1ère ». Les suivants s'écrivent « 2e », « 3e ».
  Un ordinal mal formé sera lu de travers par une synthèse vocale.
- **UX-DR12 impose `tabular-nums` sur tout chiffre rendu.** `.notice` ne le porte pas. Enrobe le
  nombre, ou formule sans chiffre.

Forme prescrite, à affiner : **« Boucherie est en 3e position. »** Si l'ordinal te paraît fragile,
« Boucherie a changé de place. » est acceptable mais **moins bon** — il perd l'information que la
story existe pour donner. Choisis, et dis pourquoi.

**Où elle vit — tranché par Florian le 2026-07-30 : une QUATRIÈME région, sous le `<ul>`.**

`statutListe` est rendu **au-dessus** de la liste (`ListeRayons.tsx:374`). Sur un foyer amorcé,
déplacer le onzième rayon y écrirait le message **hors écran** — mot pour mot le défaut que les deux
passes de revue ont trouvé, chacune sur une surface différente. Le réordonnancement est une
**quatrième surface de soumission** ; la doctrine de cet écran lui donne donc sa propre région.

- Ajoute `"parcours"` au type `Zone`, rendu **immédiatement après le `<ul>`**, monté en permanence
- **Sans `reserve`** : il est en dessous de la liste, pas au-dessus d'une cible. Le contrat de
  `Notice` réserve la hauteur uniquement quand un message pousserait un bouton sous le doigt
- `statutListe` (en tête) garde ce qui lui appartient déjà : suppression, restauration, `disparu()`

⚠️ **Limite connue, acceptée, à ne pas redécouvrir en revue :** déplacer un rayon du *haut* d'une
longue liste écrit le message *sous* la liste, donc possiblement hors écran lui aussi. Aucune
position fixe ne satisfait les deux bouts. C'est supportable parce que **le déplacement est sa propre
confirmation visuelle** — la ligne bouge sous les yeux — et que l'annonce au lecteur d'écran
fonctionne quelle que soit la position de défilement (`aria-live`). Le cas qui compterait vraiment,
le refus, s'accompagne d'un `router.refresh()` dont l'effet est visible partout. **Écris cette
limite ; ne la laisse pas se faire trouver.**

### Le piège n°8 — l'autre membre du foyer réordonne en même temps

Il n'y a **pas de propagation temps réel** avant l'Epic 4 (AD-8) : l'autre membre voit au
rechargement. Trois cas, et ils ne se ressemblent pas :

| Ce que l'autre membre a fait | Ce qui arrive à ton appel | Ce qu'il faut afficher |
|---|---|---|
| Il a **réordonné** (même ensemble) | Ton tableau passe les quatre gardes et **écrase son ordre** | Rien de spécial — dernier écrivain gagne, assumé |
| Il a **ajouté** ou **supprimé** un rayon | Garde 3 ou 4 → `P0001` | « La liste des rayons vient de changer. » **+ `router.refresh()`** |

⚠️ **Jamais « Réessaie » sur ce refus.** Réessayer sans rafraîchir reproduit exactement le même
échec, indéfiniment — c'est le défaut réel qui a produit la boucle « Ça n'a pas marché. Réessaie dans
un instant. » sur un rayon supprimé par l'autre membre. Rafraîchir **fait partie** du traitement du
refus, pas d'une éventuelle nouvelle tentative de l'utilisateur.

### Le piège n°9 — le glisser fait main, et l'exception à « aucune copie locale »

**Le déroulé, en cinq temps.** Chaque ligne existe parce qu'un glisser fait main échoue sans elle.

| Temps | Ce qui se passe |
|---|---|
| `pointerdown` sur la poignée | Si `occupe`, **retour immédiat**. Sinon : `setPointerCapture(e.pointerId)`, relever `e.clientY` de départ, l'index tiré, et **mesurer une fois pour toutes** les centres des `<li>` (`getBoundingClientRect()`). Poser l'état de geste |
| `pointermove` | `delta = e.clientY - departY`. Appliquer `transform: translateY(delta)` **à la seule ligne tirée**. Calculer `indexCibleDuGlisser(centresAutres, centreTireDepart + delta)` et, s'il a changé, mettre à jour l'**aperçu** |
| `pointerup` | Jeter l'aperçu et le transform, puis `ordreDeplace(rayons, id, indexCible)` → `null` ⇒ rien du tout ; sinon la soumission, identique aux flèches |
| `pointercancel` | Jeter l'aperçu. **Rien n'est écrit.** Arrive pour de vrai : appel entrant, changement d'application, geste système |
| `Escape` (`keydown` sur `window`, pendant le geste) | Idem `pointercancel` |

⚠️ **Mesure les centres UNE fois, au `pointerdown`.** Les relire à chaque `pointermove` lirait la
géométrie *déjà réarrangée par l'aperçu* : la ligne cible se dérobe, l'index oscille entre deux
valeurs et la liste tremble. C'est le défaut classique du glisser fait main.

⚠️ **`getBoundingClientRect()` rend des coordonnées de fenêtre.** Si la page défile pendant le geste,
elles se décalent. Sans défilement automatique, le seul défilement possible est celui que l'utilisateur
provoque — d'où la limite assumée de la Task 6. **Ne compense pas** : ça ne se voit qu'en glissant.

**L'exception à « aucune copie locale de la liste », et sa limite.** La story 2.1 pose la règle :
l'état du composant ne porte que l'interface, jamais la liste. Un aperçu de glisser **est** un ordre
local, donc une entorse. Elle est admissible à trois conditions, et elles sont fermes :

1. **Il vit le temps du geste et pas une milliseconde de plus.** Remis à `null` sur `pointerup`,
   `pointercancel` **et** `Escape` — les trois, sans exception. Aucun chemin ne doit pouvoir le
   laisser derrière lui
2. **Il ne porte que l'ORDRE**, jamais les noms, les icônes ou les positions. Un tableau
   d'identifiants, ou rien
3. **Il ne se substitue jamais à `rayons`** ailleurs que dans le rendu de la liste pendant le geste.
   La soumission recalcule depuis les **propriétés**, jamais depuis l'aperçu

Ce que la règle interdisait, c'est un état qui **diverge dans la durée** quand l'autre membre écrit.
Un aperçu de geste ne dure pas — c'est la même famille que `useOptimistic`, sauf qu'il expire à la
main. **Écris ce raisonnement en commentaire** : sans lui, la prochaine revue lira une violation.

⚠️ **Le glisser et le panneau d'édition ne coexistent pas.** Une ligne ouverte en édition est un
`<form>` qui remplace toute la ligne, poignée comprise. C'est cohérent : on ne déplace pas ce qu'on
est en train de renommer. **N'essaie pas de garder la poignée pendant l'édition.**

⚠️ **Un glisser qui ne bouge pas est un tap.** `pointerdown` puis `pointerup` quasi au même endroit
rend `indexCible === indexDepart`, donc `ordreDeplace` rend `null` : **aucun appel, aucun message**.
C'est voulu — mais vérifie qu'un tap sur la poignée n'ouvre pas non plus le panneau d'édition par
propagation. La poignée est **hors** du bouton d'édition (piège n°4) ; si tu les imbriques, elle le
déclenchera.

### Ce que la base fait déjà, et qu'il ne faut pas réimplémenter

| Capacité | Où elle vit | Ce que ça implique pour toi |
|---|---|---|
| Index sur le parcours | `idx_aisles_household (household_id, sort_order)` (`:84`) | Rien à créer |
| Isolation des rayons par foyer | `aisles_all`, `using` + `with check` (`:276-278`) | **Aucun filtre `household_id`** dans tes requêtes ni dans la fonction |
| Ordre de la liste de courses | vue `grocery_list_by_aisle`, `coalesce(a.sort_order, 9999)` (`:216-227`) | AC3 le dit : **hors périmètre**, Epic 4 story 4.2 |
| Tri secondaire par nom sur les ex æquo | `rayonsDuFoyer` (`.order("sort_order").order("name")`) | Ne le retire pas — il devient sans objet après un déplacement, mais un foyer qui n'a jamais réordonné en a toujours besoin |
| Position d'un rayon créé | `prochainOrdre` = `max + 10` | Ne le change pas ; le renumérotage le rend cohérent (piège n°3) |
| `execute` sur les fonctions à venir | `alter default privileges` (`20260729094500`) | Aucun `grant` à écrire |

### Frontières — ce que cette story ne fait pas

| N'implémente pas | Appartient à |
|---|---|
| Le défilement automatique en bord d'écran pendant un glisser | *limite assumée* — à **écrire**, jamais à taire. Les longs trajets passent par les flèches |
| `draggable` HTML5 | **jamais** — aucun événement au toucher sur iOS (piège n°1) |
| Un champ ou un sélecteur de numéro d'ordre | **jamais** — FR-12 le bannit explicitement |
| Afficher la liste de courses dans cet ordre | **Epic 4, story 4.2** — AC3 le dit lui-même |
| L'écran des règles mot-clé → rayon | **Story 2.3** |
| Le composant carte-rayon, le ratio `n/total` | **Story 2.4** — il n'y a pas d'articles avant l'Epic 4 |
| Realtime sur les rayons | **Epic 4** (AD-8). Ici, l'autre membre voit au rechargement |
| Une contrainte `unique (household_id, sort_order)` | *décision non prise* — voir question 3 |
| Le `set search_path` manquant sur `resolve_aisle_id` | *hors périmètre* — la révision d'epic §7 le réserve à la story qui touche cette fonction. Ce n'est toujours pas celle-ci |
| Rendre le bouton de restauration visible hors état vide | *décision de Florian du 2026-07-29* — ne la rouvre pas, mais l'arête qu'elle laissait est censée mourir ici (voir ci-dessous) |
| Un framework de test de composants | **jamais** — NFR-10. La parade reste d'extraire le pur vers `lib/` |

**L'arête héritée de la story 2.1, à refermer explicitement.** `deferred-work.md:374` : supprimer dix
des onze rayons laissait un état où le bouton de restauration est invisible et où « le seul moyen de
le faire réapparaître est de supprimer le onzième », l'ordre du parcours n'étant pas ressaisissable.
L'entrée porte « **À l'intention de la 2.2** : une fois le déplacement possible, l'arête perd sa
portée — c'est le moment de vérifier qu'on n'a plus besoin d'y revenir. » **Vérifie-le et écris la
conclusion**, dans un sens ou dans l'autre.

### Microcopy (UX-DR12, NFR-8, NFR-9)

Tutoiement, registre familier. **Mots bannis :** synchronisation, jeton/token, API, MCP, pont,
Supabase, RLS, cache.

| Situation | Écris quelque chose comme | N'écris jamais |
|---|---|---|
| Bouton monter (`aria-label`) | « Monter Boucherie » | « Haut » / « Décrémenter la position » |
| Bouton descendre (`aria-label`) | « Descendre Boucherie » | « Bas » / « Ordre +1 » |
| Déplacement réussi | « Boucherie est en 3e position. » | « Ordre mis à jour » / « `sort_order` enregistré » |
| L'ensemble a changé sous les pieds | « La liste des rayons vient de changer. » | « Conflit détecté » · « Réessaie » (faux conseil) |
| Échec générique | « Ça n'a pas marché. Réessaie dans un instant. » | le message brut de la fonction |
| Aide sous la liste, si tu en ajoutes une | « Mets-les dans l'ordre où tu traverses ton magasin. » | « Trier par position de rayon » |

**Pas d'abricot sur cet écran.** UX-DR2 le réserve à l'action courses ; ordonner son parcours est de
la préparation. Le seul usage légitime reste l'anneau de focus, déjà une règle globale. Les flèches
sont neutres.

**DESIGN.md ne spécifie pas cet écran** — il place « l'écran des rayons/règles (FR-11/12/13) » hors
de son périmètre de composition : *« ils héritent des tokens ci-dessus mais leur composition n'est
pas spécifiée ici »* (`DESIGN.md:329`). Compose avec ce qui existe. N'invente pas un langage visuel
et ne réclame pas une maquette qui n'existe pas.

### Contraintes d'architecture applicables

- **AD-1 / AD-2** — la règle métier vit en Postgres. L'invariant d'AC2 va **en base** (piège n°2).
  Jamais de `SUPABASE_SERVICE_KEY` côté application
- **AD-13** — client-direct, y compris pour l'appel RPC (piège n°2). Le critère est la **cause**
- **AD-16** — rayons partagés entre tous les membres. **Le foyer est symétrique** (décision de
  Florian du 2026-07-30) : n'invente aucun contrôle d'accès par membre, il serait contournable à un
  appel RPC près et contredirait AD-2
- **AD-17** — l'isolation se prouve par un test **exécuté**. D'où la Task 7, et le job CI `isolation`
- **AR-MIGRATIONS** — migrations strictement additives ; un fichier appliqué ne se modifie jamais ;
  horodatage postérieur à toutes les existantes ; requête de contrôle en en-tête (la CI la vérifie)
- **UX-DR11** — cibles ≥ 44px, contraste AA sur les fonds réels, anneau de focus visible,
  `prefers-reduced-motion`, tenue à 200 % de zoom sans défilement horizontal
- **UX-DR12** — tutoiement, mots bannis, `tabular-nums` sur tout chiffre
- **NFR-5** — l'isolation au niveau de la donnée, jamais de l'interface
- **NFR-8** — jamais un message technique brut
- **NFR-10** — **aucune dépendance nouvelle.** Ni bibliothèque de glisser-déposer, ni harnais de
  test de composants

### Standards de test

Trois familles, elles ne se remplacent pas. **Comptes mesurés le 2026-07-30 sur `f29c1a1`** :

1. **`npm test`** — `node:test`, glob `lib/**/*.test.ts`. **72/72 aujourd'hui.** Couvre le pur :
   `ordreApresDeplacement`, `refusOrdre`
2. **`npm run test:isolation`** — glob `supabase/tests/**/*.test.ts`, exige un stack local debout,
   **lève** s'il est absent. **20/20 aujourd'hui** (17 dans `isolation.test.ts`, 3 dans
   `contraintes.test.ts`). C'est là que va la preuve d'AC2 et de NFR-5
3. **Le manuel** — le JSX reste intestable sans dépendance. Les deux thèmes, le focus dans le DOM,
   le 200 % de zoom, la latence ressentie : rien d'automatisable, et c'est la seule famille qui a
   attrapé les défauts de la story 2.1

**TDD sur `lib/`, pas sur le JSX** : `lib/rayons/ordre.ts` s'écrit test d'abord, phase rouge
constatée. C'est ce que permet l'extraction du pur.

⚠️ **`node --test` sur un glob vide rend 0.** Un test renommé ou déplacé laisse la CI verte sans une
assertion. Les deux jobs comptent les fichiers avant de lancer — mais ils comptent un *dossier*, pas
ton fichier. **Tout nouveau contrôle automatique doit répondre à : « que se passe-t-il s'il ne trouve
rien à contrôler ? »**

### Project Structure Notes

```
app/
  rayons/
    ListeRayons.tsx           ~  ligne restructurée (poignée + édition + 2 flèches),
                                 deplacer(), le geste de glisser, zone "parcours"
    page.tsx                  ~  commentaire d'en-tête + `max-w-md` SI le 200 % casse
lib/
  rayons/
    ordre.ts                  +  ordreDeplace, Sens, ordreApresDeplacement,
                                 indexCibleDuGlisser
    ordre.test.ts             +
    erreurs.ts                ~  + refusOrdre (P0001 → "liste-changee")
    erreurs.test.ts           ~  + ses cas
    saisie.ts                 INCHANGÉ — prochainOrdre reste `max + 10` (piège n°3)
    rayons.ts                 INCHANGÉ — le tri secondaire par nom sert toujours
  supabase/types.ts           ~  régénéré — diff ATTENDU : reorder_aisles dans Functions
supabase/
  migrations/
    <ts>_reorder_aisles.sql   +  fonction security INVOKER, 4 gardes (Task 1)
  tests/isolation.test.ts     ~  + tests de réordonnancement (Task 7)
docs/migrations.md            ~  « sept fonctions » → huit, avec sa date
app/globals.css               INCHANGÉ — les utilitaires suffisent. Une classe sans appelant est une dette
app/_lib/Notice.tsx           INCHANGÉ — son contrat `reserve` suffit
proxy.ts                      INCHANGÉ — le matcher garde déjà /rayons
package.json                  INTACT — aucune dépendance (NFR-10)
```

⚠️ **`app/rayons/page.tsx:16-17` liste « réordonner par manipulation directe (story 2.2) » parmi ce
que l'écran ne fait pas.** Cette phrase devient fausse avec ce commit. C'est exactement le défaut que
les stories 1.6, 1.7 puis 2.1 ont chacune eu à corriger : un texte d'annonce qui ment après coup.

### Intelligence des stories précédentes

- **Trois des six défauts majeurs de l'Epic 1 ont été introduits par une passe de revue**, et le
  2026-07-29 la seconde passe a mesuré que la première avait réparé la moitié d'un défaut, en avait
  introduit trois et affirmé deux choses fausses. **Revue adversariale par story, et la passe de
  correction se fait revoir à son tour** (décision de Florian, en vigueur depuis l'Epic 2)
- **Les deux défauts trouvés deux fois de suite sur cet écran sont des défauts de *région de
  statut*** — un message rendu hors de la zone visible. La première correction en a créé deux pour
  trois surfaces de soumission. Ta quatrième surface (le déplacement) hérite du problème : piège n°7
- **Le focus est le second récidiviste** : perdu à l'ouverture du panneau (passe 1), puis sur le
  bouton de restauration (passe 2, oublié par la correction de la passe 1). Piège n°6
- **Une déduction consignée comme vérifiée, puis réemployée comme fondation** est le motif de trois
  défauts en deux jours, dont un qui a atteint le déploiement (`engines: ">=25.0.0"`, CI verte,
  production morte)
- **Une case vide honnête vaut mieux qu'une case cochée à tort.** Les stories 1.5, 1.6, 1.7 et 2.1
  ont laissé des sous-tâches non cochées avec leur raison écrite ; la revue l'a préféré à chaque fois
- **Une énumération ne peut pas gagner contre une catégorie** — `INVISIBLES` a été écrit deux fois
  comme une liste, exhaustive et fausse les deux fois. Si un contrôle porte sur un ensemble que tu ne
  maîtrises pas, emploie un prédicat
- **Motifs à reprendre plutôt qu'à réinventer** : `DisplayNameForm.tsx` (écriture client-direct,
  contrôle de `data` autant que d'`error`, `router.refresh()`), `InviteCard.tsx` (confirmation en
  deux temps), `lib/foyer/erreurs.ts` (SQLSTATE d'abord), `useSoumission` (son `finally`), `Notice`
  (son `reserve`)
- **Pièges d'outillage connus** : purger `.next` avant de conclure à une régression du `typecheck`,
  et redémarrer le serveur de développement après l'avoir purgé ; `npm run build | grep …` ne rend
  jamais la main — rediriger vers un fichier

### Intelligence git

`f29c1a1` est la base — **`main`, propre**, aucune PR ouverte (`git status --short` vide). C'est la
fusion de la story 2.1 (PR #14). **Branche directement depuis `main`.**

⚠️ **`main` est protégée depuis le 2026-07-29** : `verify` et `isolation` sont **requis**, `strict`,
administrateurs soumis, push direct et push forcé interdits. Il n'y a plus de chemin vers la
production qui ne passe pas par une PR verte. C'est délibéré — depuis `vercel.json`, un commit sur
`main` applique les migrations en production.

Convention : **Conventional Commits**, corps en français ; branche dédiée → PR → **squash merge** CI
verte. La CI rejoue `typecheck`, `lint`, `check:migrations`, `test`, `build` sur **Node 24**, et le
job `isolation` monte un stack Supabase complet (`supabase/setup-cli` épinglé à `2.110.0`, **la même
version que `scripts/migrer-au-deploiement.mjs`** — deux numéros divergents feraient valider la
chaîne par une CLI que la production n'emploie pas).

⚠️ **Les portes ne voient pas le déploiement.** `engines: "24.x"` et `.node-version` ont été épinglés
le 2026-07-29 après qu'un `>=25.0.0` a tué la production avec une CI verte. **Cette story ne devrait
toucher ni l'un ni l'autre.**

Neuf fichiers de migration existent ; la tienne sera la **dixième**. Que la production porte bien les
neuf est **rapporté** par la story 2.1 pour les sept premières et **attendu du déploiement de la
PR #14** pour les deux dernières — non mesuré ici, le dépôt n'étant pas lié à un projet Vercel.
`npx supabase db reset` les rejoue toutes les neuf en local (**mesuré le 2026-07-30**).

### Informations techniques

Versions installées, **à ne pas bouger** : `next@16.2.12`, `react@19.2.8`, `react-dom@19.2.8`,
`tailwindcss@4.3.3` (+ `@tailwindcss/postcss@4.3.3`), `typescript@6.0.3`, `@supabase/ssr@0.12.3`,
`@supabase/supabase-js@2.110.8`, `eslint@9.39.5` (**ne pas monter en 10**). Node 24.

- **Tailwind 4 n'a pas de fichier de configuration** et il ne faut pas en créer un. Tout passe par
  `@theme` / `@theme inline`. `dark:` suit `prefers-color-scheme`, aucune bascule manuelle à écrire
- **La palette Tailwind par défaut est neutralisée** (`--color-*: initial`). `bg-red-500`,
  `text-gray-400`, `bg-white` **ne génèrent plus rien et échouent EN SILENCE**. Toute couleur doit
  être un token de DESIGN.md
- **`unnest(...) with ordinality`** est du SQL standard, disponible depuis Postgres 9.4 — rien à
  installer. **Éprouvé sur le Postgres du conteneur** (contrôle 1)
- **PostgREST accepte un tableau JSON pour un paramètre `uuid[]`** : `supabase.rpc("reorder_aisles",
  { p_ids: ["…", "…"] })`. La fonction apparaît dans les types générés, donc le `typecheck` couvre
  le nom et la forme du paramètre
- **`useOptimistic` (React 19) existe** et serait la seule voie propre vers un déplacement instantané
  — mais c'est la question 2, pas un correctif à prendre en passant, et rien ne peut l'éprouver
  automatiquement ici
- **Aucune bibliothèque nouvelle n'est requise.** Si tu ressens le besoin d'en ajouter une, relis
  NFR-10 : la réponse est dans ce qui existe déjà

### Environnement de test

Le stack local est **debout au moment où cette story est écrite** (`npx supabase status` répond ;
`supabase_imgproxy` et `supabase_pooler` sont arrêtés, sans effet sur les tests). Ports en 5532x
(`supabase/config.toml` versionné) : API `55321`, base `55322`, Studio `55323`, courriels `55324`.

`npx supabase start` s'il ne répond pas. `npx supabase db reset` pour rejouer la chaîne — **en local
seulement**, jamais sur le distant.

✅ **Un compte peut désormais naître en local**, et c'est nouveau depuis la story 2.1 :
`supabase/config.toml` (`site_url` sur le port **3333**, `additional_redirect_urls`) et
`supabase/templates/{magic_link,confirmation}.html` sont **versionnés** (`git ls-files` le confirme).
C'est ce qui bloquait tout parcours à l'écran pendant deux epics, sans que rien ne le signale : le
lien magique renvoyait vers un port muet, et les modèles par défaut de Supabase émettaient un `?code=`
PKCE que `app/auth/callback/route.ts` refuse (il attend un `token_hash`). L'écran disait « lien
expiré ». Le vrai chemin : lien magique → Mailpit (`55324`) → `/auth/callback` → `/onboarding`.

⚠️ **Les prévisualisations Vercel parlent à la base de PRODUCTION** (un seul projet Supabase). Un
écran qui écrit se relit **sur le stack local**. Et un critère qui dépend d'une migration de la PR
n'y est **pas démontrable** — la migration n'y est pas appliquée. AC1 et AC2 sont dans ce cas.

Il reste une action de l'Epic 1 entamée : `/onboarding` a été vu en **sombre** le 2026-07-29 ; le
thème **clair** manque. Hors périmètre — mais si tu crées un compte de test, l'occasion est là,
**dis-le** et ça ferme l'action.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.2] — user story et 3 AC, cités verbatim
- [Source: epics.md#FR-12] — « manipulation directe (glisser / monter-descendre), **pas par saisie
  d'un numéro d'ordre** » ; [#UX-DR11], [#UX-DR12], [#NFR-1] (iPhone 15 Pro), [#NFR-10]
- [Source: epics.md#Epic-2] — objectif révisé du 2026-07-29 : l'epic produit **la table de tri et
  les écrans qui la peuplent**, l'Epic 4 s'en sert
- [Source: _bmad-output/planning-artifacts/epic-2-revision-2026-07-29.md] — §2 (`sort_order`, index
  et vue existent déjà ; « manque : l'interaction de manipulation directe »), §7
  (`resolve_aisle_id` sans `search_path`, hors périmètre)
- [Source: …/ARCHITECTURE-SPINE.md] — AD-1, AD-2, AD-13 (critère de cause), AD-16 (foyer symétrique,
  décision du 2026-07-30), AD-17
- [Source: …/ux-designs/…/EXPERIENCE.md] — § Direct manipulation (« réordonner : manipulation
  directe, jamais un numéro d'ordre — surface web/Claude »), § Information Architecture (« Rayons &
  règles … **ouvert à tout membre du foyer** »), § Accessibility Floor
- [Source: …/ux-designs/…/DESIGN.md:329] — l'écran des rayons est **hors périmètre de composition**
- [Source: _bmad-output/project-context.md] — les sept règles de méthode, les contraintes
  inhabituelles, les motifs à reprendre. **Chargé à chaque session** : c'est le fichier qui fait foi
- [Source: _bmad-output/implementation-artifacts/2-1-gerer-ses-rayons.md] — pièges n°3 (`sort_order`
  et ses ex æquo), n°6 (AD-13, client-direct) ; les deux passes de revue et leurs 23 correctifs ;
  le parcours à l'écran et le focus mesuré dans le DOM
- [Source: _bmad-output/implementation-artifacts/deferred-work.md:314, :374] — l'arête du bouton de
  restauration et le `sort_order` 1009, tous deux adressés à cette story
- [Source: supabase/migrations/20260502000000_initial_schema.sql] — `aisles` (`:74-84`), index
  (`:84`), `aisles_all` (`:276-278`), `seed_default_aisles` (`:330-351`), vue
  `grocery_list_by_aisle` (`:216-227`)
- [Source: supabase/migrations/20260729094500_grant_table_privileges.sql] — `alter default
  privileges … on functions`, qui dispense d'un `grant` explicite
- [Source: supabase/migrations/20260729095922_guard_seed_default_aisles.sql] — la garde d'identité,
  et le contre-exemple de ce qu'il ne faut pas refaire ici
- [Source: docs/migrations.md] — additivité, cycle par le déploiement, § Relire une PR ; `:135` (le
  bloc `Functions` et ses « sept fonctions », à mettre à jour)
- [Source: .github/workflows/ci.yml] — jobs `verify` et `isolation`, tous deux requis
- **Sonde exécutée le 2026-07-30 sur le stack local** — fonction candidate, deux comptes, deux
  foyers, huit contrôles ; base remise à l'état du dépôt par `db reset` et l'absence de
  `reorder_aisles` dans `pg_proc` vérifiée après coup

## Décisions de Florian — 2026-07-30

Les quatre questions ouvertes à la création de la story ont été tranchées **avant le démarrage**.
Elles ne se rouvrent pas en revue sans un fait nouveau.

1. **Glisser ET monter/descendre.** *(Contre la recommandation, qui proposait les flèches seules.)*
   Le glisser est donc dans le périmètre : fait main, sur événements de pointeur, sans dépendance.
   ⚠️ **Conséquence, et elle n'est pas négociable :** les flèches restent obligatoires — WCAG 2.5.7
   exige une alternative à pointeur simple à tout mouvement de glissement, et elles sont le seul
   chemin clavier (UX-DR11). Ordre de construction imposé : Task 5 en entier, puis Task 6.
   *Ce que ça coûte, dit d'avance : ~200 lignes de JSX que rien n'automatise (NFR-10 interdit le
   harnais de composants), et deux séries de vérification manuelle — souris et doigt.*
2. **Sans optimisme, mais on mesure.** Chaque déplacement reste un aller-retour + `router.refresh()`,
   cohérent avec la règle « aucune copie locale » de la story 2.1. **Le dev doit chronométrer et
   rapporter le ressenti** au parcours à l'écran, y compris le trajet du onzième rang au premier.
   `useOptimistic` (React 19) est la voie propre si c'est pénible — décision à rouvrir **avec la
   mesure sous les yeux**, jamais sur un pressentiment.
   ⚠️ L'aperçu transitoire du glisser (piège n°9) n'est **pas** une entorse à cette décision : il
   vit le temps du geste et ne survit à aucun chemin de sortie.
3. **Pas de contrainte `unique (household_id, sort_order)`.** La fonction garantit l'unicité par
   construction (mesuré : 11 positions distinctes ; 1 → 11 sur des ex æquo), et l'invariant est
   **mesuré par un test exécuté** — « un invariant se mesure, il ne s'affirme pas ». Une contrainte
   aurait dû être `deferrable` et aurait fait **échouer le déploiement de production** si une seule
   paire y collisionne déjà. La requête de contrôle en en-tête de migration dira si c'est le cas ;
   **si elle rend des lignes, dis-le dans la PR** — ça ne bloque rien, mais ça informe cette décision.
4. **Une quatrième région de statut, sous le `<ul>`.** Voir piège n°7 pour la forme exacte et la
   limite résiduelle assumée.

## Dev Agent Record

### Agent Model Used

claude-opus-5

### Debug Log References

#### Vérification (2026-07-31)

Toutes les commandes ci-dessous ont été **exécutées** sur l'arbre final. Ce qui ne l'a pas été porte
le mot « non fait », « déduit » ou « raisonné ».

| Commande | Résultat |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` (`--max-warnings 0`) | exit 0, **0 avertissement** |
| `npm run check:migrations` | exit 0 — **10 migrations, 8 avec requête de contrôle, 2 exemptées** |
| `npm test` | **96/96** (72 existants + 24 nouveaux), 0 échec |
| `npm run build` | exit 0 ; `/rayons` toujours en **ƒ (dynamique)** |
| `npm run test:isolation` | **27/27** (20 existants + 7 nouveaux), 0 échec |
| `npx supabase db reset` | les **10** migrations rejouées, dont la nouvelle |
| `npx supabase migration list --local` | local == remote sur les 10 |
| `git diff package.json package-lock.json` | **vide — aucune dépendance ajoutée** (NFR-10) |
| `git status app/globals.css proxy.ts next.config.ts` | **vide — aucun des trois touché** |

**Les dents du nouveau test, vérifiées.** La garde 4 (comptage des lignes affectées) retirée à la
main de la base locale, la suite tombe de **27/27 à 25/27**, et les deux tests qui tombent sont
exactement « A ne peut pas réordonner le parcours de B » et « A ne peut pas glisser un rayon de B
dans son propre parcours ». `db reset` ensuite, retour à 27/27.

**Types.** `supabase gen types --local` rejoué et comparé au fichier committé : le seul écart de
schéma `public` est l'ajout de `reorder_aisles`, porté à la main. Les deux autres blocs du diff
(`graphql_public`, `PostgrestVersion`) sont le bruit de version de CLI que la story 2.1 a
délibérément écarté — **non commités**, et le diff résiduel a été relu pour s'en assurer.

#### Parcours à l'écran (2026-07-31)

Mené **sur le stack local**, jamais en production. `.env.local` basculé vers
`http://127.0.0.1:55321` puis **restauré — empreinte SHA-256 identique au bit près**
(`d3659011…c1f9a579` avant et après). Serveur sur `localhost:3333`, jamais `127.0.0.1:3333`.

Compte créé par le vrai chemin : lien magique → Mailpit → `/auth/callback` → `/onboarding` → foyer.
Base remise à l'état du dépôt (`db reset`) après coup — **0 compte restant**, vérifié.

⚠️ **Le stack a dû être redémarré** (`supabase stop && start`) : le conteneur d'authentification
tournait encore avec la configuration d'avant la story 2.1, donc les modèles d'email par défaut de
Supabase. Le sujet reçu était « Your Magic Link » au lieu de « Ta connexion à NutriClaude ».
`db reset` ne recharge PAS `config.toml` — seul un redémarrage le fait. À savoir pour le prochain
parcours.

**Les gestes flèches, observés :**

| Geste | Observé |
|---|---|
| Monter un rayon du milieu | Poissonnerie 3e → 2e, message « Poissonnerie est en 2e position. » **sous la liste** |
| Monter jusqu'en 1re — *le cas où le bouton pressé se désactive* | « Poissonnerie est en **1re** position. » (ordinal correct), `monter` désactivé, et **le focus est passé à `descendre-…`** — relevé dans le DOM, `aria-label="Descendre Poissonnerie"` |
| Descendre le dernier | bouton `descendre` désactivé sur la dernière ligne |
| Panneau d'édition ouvert, puis déplacement d'une **autre** ligne | le panneau **reste ouvert**, sa saisie intacte (« Boucherie »), le focus va au bouton pressé |
| En base après renumérotage | **11 rayons, 11 positions distinctes**, `10 … 110`. « Autre » est passé de 999 à 110, comme la story l'annonçait |

**Les gestes glisser, observés (à la souris) :**

| Geste | Observé |
|---|---|
| Glisser réel (pilote de navigateur) | `gotpointercapture` obtenu ; Poissonnerie déplacée du 9e au 4e rang ; « Poissonnerie est en 4e position. » |
| Translation + trait d'insertion pendant le geste | la ligne suit le pointeur (`translateY`), le trait marque la destination |
| `Escape` en cours de geste | translation et trait disparaissent, **rien n'est écrit** (ordre identique avant/après) |
| Relâchement **à sa place de départ** | aucun trait, aucun appel, aucun message, ordre inchangé |
| Tap franc sur la poignée | n'ouvre **pas** le panneau d'édition |

**Accessibilité, mesurée :**

- Ordre de tabulation : `← Retour` → `rayon-1` → `descendre-1` (le `monter` de la 1re ligne étant
  désactivé, il est sauté) → `rayon-2` → `monter-2` → `descendre-2` → … **sensé**
- **La poignée n'est pas dans le parcours clavier** (`tabIndex=-1`, `aria-hidden="true"`) — vérifié
  en énumérant les focalisables
- Les **trois** régions de statut portent `aria-live="polite"`, et **une seule** porte du texte
- Anneau de focus visible au `Tab` réel sur une flèche (abricot, seul usage légitime — UX-DR2)
- Cibles de la ligne : `44x44` (poignée), `240x44` (édition), `44x44` + `44x44` (flèches)
- **Zoom 200 %** (émulé par `zoom: 2`, **pas** le zoom natif du navigateur) : aucun débordement
  horizontal, cibles à `88x88`. Le nom passe alors sur **4 lignes** — serré, mais conforme

**Les deux thèmes**, bascule au réglage d'apparence macOS (`osascript`). État de départ : **clair**
(`dark mode = false`) ; **remis en clair** après, vérifié.

#### ⚠️ Le défaut que seul l'œil a attrapé

**En thème sombre, la ligne tirée laissait lire celle qu'elle recouvrait** — deux noms superposés et
illisibles. Cause mesurée : `--surface-card` vaut `#ffffff0e` en sombre (5 % de blanc, donc
quasi transparent) et `--card-shadow` y vaut `none`. Aucune des cinq portes ne pouvait le voir.
Corrigé par un fond **opaque** (`--surface-base`) avec la teinte de carte posée par-dessus en dégradé
plat — deux tokens existants, aucune couleur inventée. **Revérifié dans les deux thèmes après
correction.**

#### La latence, mesurée — c'est la question 2 de Florian

| Build | Médiane par pression | Trajet 11e rang → 1er (10 pressions) |
|---|---|---|
| `next dev` | **~1000 ms** | 9,9 s |
| **`next build` + `next start`** | **81 ms** (min 65, max 99) | **771 ms** |

Le mode développement gonflait la mesure d'un **facteur 12**. Sur le build de production, le
déplacement est imperceptible.

⚠️ **Mesuré contre un Supabase LOCAL** : le trajet réseau vers un projet distant n'y est pas. En
production réelle, compter l'aller-retour en plus.

**Conclusion pour la question 2 : la mise à jour optimiste n'est pas nécessaire.** L'inquiétude
venait du ressenti en mode développement, qui n'est pas celui du produit.

### Completion Notes List

**Les huit tâches sont livrées**, à six sous-tâches près, laissées vides avec leur raison écrite
(voir ci-dessous). Une migration additive, aucune migration existante modifiée, aucune dépendance
ajoutée, `app/globals.css` et `proxy.ts` intacts.

**Le mécanisme prescrit a tenu sans retouche.** La fonction `reorder_aisles` a été éprouvée à la
création de la story ; son corps est passé en migration tel quel, et les sept tests d'isolation
écrits ensuite l'ont confirmée sans qu'une seule garde ait à bouger. Le renumérotage complet
(`rang × 10`) tient l'AC2 : **11 positions distinctes**, mesuré à l'écran comme en test, et il
**résorbe** des ex æquo préexistants (1 position distincte → 11).

**Ce que le parcours à l'écran a trouvé, et que rien d'autre ne pouvait trouver.** La ligne tirée
était transparente en thème sombre — `--surface-card` vaut 5 % de blanc, `--card-shadow` vaut `none`.
Deux noms superposés, illisibles. Cinq portes vertes, zéro signal. C'est le troisième epic d'affilée
où le défaut décisif est trouvé par l'œil.

**Une erreur de diagnostic, corrigée et consignée.** Le premier glisser piloté n'a rien produit ; j'ai
attribué l'échec au groupement des mises à jour de React et déplacé l'état du geste dans une `ref`.
La vraie cause était ailleurs : la page avait défilé (`scrollY: 195`) et mon point de départ ne
tombait plus sur la poignée. La `ref` est **conservée** — elle supprime par construction une classe
de défaut de fermeture — mais son commentaire a été réécrit : il affirmait un scénario **mesuré**
alors qu'il est seulement **raisonné**. C'est exactement la règle n°1 de `project-context.md`, et je
l'ai enfreinte avant de la réparer.

**Un écart assumé à la story, sur la forme du glisser.** Le piège n°9 prescrivait un aperçu qui
réordonne la liste sous le doigt. J'ai gardé l'ordre du DOM **immobile** : seule la ligne tirée se
translate, et un trait d'insertion montre la destination. Raison : un aperçu qui réordonne
invaliderait les centres mesurés au `pointerdown` **à l'instant même où on s'en sert** — c'est la
gigue que le piège n°9 décrit lui-même. Immobile, la mesure unique reste vraie par construction.

**L'entorse à « aucune copie locale » est bornée et documentée dans le code.** L'objet de geste ne
porte que des positions, jamais un nom ni un `sort_order`, et il est remis à `null` sur les trois
chemins de sortie (`pointerup`, `pointercancel`, `Escape`) — les trois vérifiés.

**Les flèches ne sont pas un doublon du glisser : elles sont ce qui le rend conforme.** WCAG 2.5.7
exige une alternative à pointeur simple à tout mouvement de glissement, et elles sont aussi le seul
chemin clavier. C'est écrit dans le code, pour qu'une revue ne les prenne pas pour de la redondance.

**L'arête héritée de la story 2.1 est refermée.** L'ordre du parcours est désormais entièrement
ressaisissable, donc supprimer dix rayons sur onze n'enferme plus dans un état irréparable. Le bouton
de restauration reste réservé à l'état vide, conformément à la décision de Florian.

**Ce qui reste à vérifier avant la fusion, et qui ne peut pas l'être d'ici :**

1. **Le glisser AU DOIGT.** Joué à la souris seulement. Le mécanisme est mesuré
   (`touch-action: none` bien posé sur la poignée et sur elle seule), le geste ne l'est pas. C'est
   la classe d'erreur qui a fait écarter `draggable` HTML5 — elle mérite un vrai téléphone.
2. **La requête de contrôle en en-tête de migration, sur la production.** Elle dira si des ex æquo de
   position y existent déjà. Non bloquant, mais il informe la décision « pas de contrainte
   d'unicité ».
3. **Les quatre questions du gabarit de PR**, à l'ouverture de la PR.

### File List

**Nouveaux**
- `supabase/migrations/20260731062945_reorder_aisles.sql` — fonction `reorder_aisles(uuid[])`,
  **security invoker**, quatre gardes
- `lib/rayons/ordre.ts` — `ordreDeplace`, `ordreApresDeplacement`, `indexCibleDuGlisser`, type `Sens`
- `lib/rayons/ordre.test.ts` — 21 tests

**Modifiés**
- `app/rayons/ListeRayons.tsx` — ligne restructurée (poignée + édition + deux flèches), `deplacer`,
  `persisterOrdre`, le geste de glisser, zone de statut `parcours`
- `app/rayons/page.tsx` — commentaire d'en-tête : il rangeait le réordonnancement parmi ce que
  l'écran NE fait PAS. Le `max-w-sm` est **inchangé** — il a tenu à 200 % de zoom, le passage en
  `max-w-md` prévu en secours n'a pas servi
- `lib/rayons/erreurs.ts` — `refusOrdre` (`P0001` → `liste-changee`)
- `lib/rayons/erreurs.test.ts` — 3 tests de plus
- `lib/supabase/types.ts` — `reorder_aisles` ajoutée aux `Functions` (bruit de CLI écarté)
- `supabase/tests/isolation.test.ts` — 7 tests de réordonnancement, dont les appels forgés
- `docs/migrations.md` — « sept fonctions » → **huit**, avec sa date et un avertissement de péremption
- `_bmad-output/implementation-artifacts/deferred-work.md` — entrée de la story 2.2
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — statut

**Inchangés, vérifiés**
- `app/globals.css` — aucune classe ajoutée, les utilitaires ont suffi
- `proxy.ts`, `next.config.ts`, `package.json`, `package-lock.json` — intacts
- `lib/rayons/saisie.ts`, `lib/rayons/rayons.ts` — `prochainOrdre` et le tri secondaire inchangés
- `.env.local` — basculé pour le parcours, **restauré à l'identique** (SHA-256 comparé)

⚠️ Le commentaire d'en-tête de `app/rayons/page.tsx` rangeait « réordonner par manipulation directe
(story 2.2) » parmi ce que l'écran **ne fait pas**. Devenu faux avec ce commit, il est **corrigé** —
c'est le défaut de texte d'annonce périmé que les stories 1.6, 1.7 et 2.1 ont chacune eu à réparer.

## Change Log

| Date | Changement |
|---|---|
| 2026-07-30 | Story créée. Mécanisme de réordonnancement **éprouvé par exécution** sur le stack local avant d'être prescrit : fonction `reorder_aisles` en `security invoker`, quatre gardes, huit contrôles mesurés dont l'appel forgé à cardinal exact (refusé par le seul comptage de lignes) et la résorption des ex æquo (1 position → 11). Deux faux positifs de test identifiés au passage — sous RLS, A ne peut pas lire les identifiants de B, donc un test inter-foyers doit les obtenir du client `admin` |
| 2026-07-31 | Implémentation. Une migration additive (`reorder_aisles`, **security invoker**, quatre gardes), `lib/rayons/ordre.ts` en TDD (phase rouge constatée), `refusOrdre`, la ligne restructurée à quatre éléments, le glisser fait main sur événements de pointeur, une quatrième région de statut, 7 tests d'isolation. **Cinq portes vertes : 96/96 unitaires, 27/27 isolation, dents du nouveau test vérifiées (27 → 25 sans la garde 4).** Parcours à l'écran sur le stack local, deux thèmes. **Un défaut trouvé par l'œil seul** : la ligne tirée était transparente en sombre (`--surface-card` = 5 % de blanc, `--card-shadow` = `none`) — corrigé et revérifié. **Latence mesurée : 81 ms médians par déplacement sur le build de production**, contre ~1000 ms en développement — la question 2 est tranchée, pas de mise à jour optimiste. Six sous-tâches laissées vides avec leur raison, dont le glisser AU DOIGT. Statut → `review` |
| 2026-07-30 | **Les quatre questions tranchées par Florian.** La première contre la recommandation : **le glisser entre dans le périmètre**, en plus des flèches. Story reprise en conséquence — piège n°1 réécrit (les flèches deviennent l'alternative qu'exige WCAG 2.5.7, donc obligatoires), piège n°9 ajouté (forme exacte du geste, `touch-action`, capture de pointeur, et l'exception bornée à « aucune copie locale »), Task 6 créée et tâches renumérotées, largeur de ligne recalculée à quatre éléments, vérification dédoublée souris/doigt. Décisions 2, 3 et 4 conformes aux prescriptions. Statut → `ready-for-dev` |
