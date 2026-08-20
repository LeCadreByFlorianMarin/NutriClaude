---
name: NutriClaude
status: final
updated: 2026-07-23
sources:
  - "prd: _bmad-output/planning-artifacts/prds/prd-nutriclaude-2026-07-21/prd.md"
  - "addendum: _bmad-output/planning-artifacts/prds/prd-nutriclaude-2026-07-21/addendum.md"
  - "design: ./DESIGN.md"
---

# NutriClaude — Experience Spine

> La liste de courses est le produit. Cinq surfaces de rang égal consomment la même donnée. Aucune n'est « la vraie ». `DESIGN.md` porte l'identité visuelle ; ce document porte le comportement, l'IA, la voix et les parcours. Cible d'acceptation implicite qui plane sur tout : **on doit pouvoir se servir de NutriClaude sans jamais rien configurer** — si une capacité exige de comprendre l'outil, elle a échoué. ⚠️ Ce document formulait cette cible comme une asymétrie entre membres (« la conjointe ne configure jamais rien ») ; c'est **corrigé le 2026-07-30**, voir la décision en tête de la section Foundation. La cible est un objectif de simplicité, pas un contrôle d'accès.

## Foundation

> ### ⚠️ Décision du 2026-07-30 — le foyer est symétrique
>
> **Tous les membres d'un foyer ont exactement les mêmes droits.** Il n'y a pas, et il n'y aura
> pas, de rôle « celui qui configure » et de rôle « celle qui fait les courses ».
>
> **Ce que ce document disait**, en huit endroits : « surfaces de Florian uniquement », « la
> conjointe ne configure jamais rien », « la conjointe ne voit jamais la notion de règle ». Ces
> formulations promettaient une **asymétrie de permissions** que rien n'a jamais portée — et
> que rien ne portera : `profiles` n'a aucune colonne de rôle, et les **13 politiques RLS sur
> 18** qui filtrent passent toutes par `current_household_id()`, c'est-à-dire par **foyer**, pas
> par membre.
>
> La contradiction a été relevée à la création de la story 2.1, mesurée à sa revue
> (2026-07-29), et tranchée par Florian le 2026-07-30. **C'est ce document qui avait tort**, pas
> le schéma : le coût du modèle promis était une colonne de rôle, les 13 politiques rejugées une
> par une, les 20 tests rejoués, et une famille de tests d'isolation **à deux membres du même
> foyer** qui n'existe pas encore — les 17 actuels opposent deux *foyers*.
>
> **Ce qui reste, et qui n'a rien à voir.** La cible d'acceptation « on doit pouvoir s'en servir
> sans jamais rien configurer » est intacte, et c'est elle qui compte. Elle dit que le produit
> doit marcher pour qui ne configure rien — **pas** qu'il faut l'en empêcher. Les deux avaient
> été confondues ; elles sont désormais distinctes partout dans ce document :
>
> - la **surface** décide ce qu'on y montre — aucune surface liste ne parle jamais de « règle »
>   ni de « configuration », à personne ;
> - la **personne** ne décide de rien — tout membre du foyer peut ouvrir `/rayons`.
>
> ⚠️ **Corollaire pour l'implémentation :** ne jamais inventer un contrôle d'accès applicatif
> entre membres. Il serait contournable à un appel RPC près et contredirait AD-2 (la règle vit
> en base). Voir `_bmad-output/project-context.md § Architecture`.

Produit **multi-surface, 5 surfaces de rang égal**, hérité du PRD (§2). Ce n'est pas une app avec des intégrations : c'est une donnée avec cinq points d'accès. Une règle métier appliquée par une surface l'est par toutes (FR-20 / NFR-5). Aucune surface n'est prioritaire dans l'expérience ; chacune a son contexte et son geste dominant.

| Surface | Geste dominant | Contexte | Invariants non négociables |
|---|---|---|---|
| **Dashboard cuisine** | Voir + cocher | Écran fixe mural, allumé en continu, sans utilisateur courant | **Jamais de login** (FR-28) ; rattaché au foyer une fois par Florian ; lisible à un mètre (FR-24) |
| **Assistant Google** | Ajouter à la voix | Toute la maison, enceinte comprise | Confirmation **par l'assistant**, pas par nous ; arrivée **différée < 1 min, structurelle** (NFR-4) |
| **Téléphone (iOS + Android)** | Cocher + ajouter | Supermarché, une main, caddie dans l'autre | **Hors-ligne = mode nominal** (NFR-1) ; PWA installable, aucun binaire natif (NFR-11) ; parité iPhone/Android |
| **Claude conversationnel** | Piloter + planifier | Bureau, dimanche soir | Périmètre strict au foyer (FR-39) ; aucun jargon rendu à l'écran |
| **Web** | Configurer + planifier | Recettes, menu, rayons, règles | Seule surface de configuration ; confortable au grand écran |

`DESIGN.md` est la référence visuelle. Maquettes : [`mockups/liste-et-dashboard.html`](mockups/liste-et-dashboard.html) (téléphone + dashboard, cf. Flows 1 & 2), [`mockups/grille-menu.html`](mockups/grille-menu.html) (grille du menu web, cf. Flow 4). Le web (recettes, rayons, onboarding, profil) et Claude héritent des tokens et patterns sans composition figée ici. **Les spines (`DESIGN.md` + `EXPERIENCE.md`) priment sur toute maquette en cas de conflit.**

## Information Architecture

L'objet central est **la liste unique du foyer** (FR-1). Tout le reste sont des affluents qui l'alimentent (recettes → menu → liste) ou des lentilles pour la lire (par rayon).

| Zone | Atteinte depuis | Rôle | Surfaces |
|---|---|---|---|
| **Liste (par rayon)** | Ouverture app / tuile Courses du dashboard | Voir, cocher, décocher, ajouter, supprimer | Dashboard, Téléphone, Claude |
| **Rayon « À classer »** | Fin de liste, jamais masqué (FR-9) | Rattraper les articles dont le rayon est indéterminé | Toutes celles qui affichent la liste |
| **Ajout rapide** | Bouton d'action / cible de partage système / voix | Ajouter un article sans clavier ou en 2 gestes | Téléphone (partage), Google (voix), Claude |
| **Menu de la semaine** | Web / Claude | Assigner recettes à la grille jour × repas, générer la liste | Web, Claude, + affichage lecture seule (menu du jour) sur Dashboard (FR-44) |
| **Répertoire de recettes** | Web / Claude | Créer, filtrer par étiquette, chercher par titre (FR-51) | Web, Claude |
| **Rayons & règles** | Web / Claude | Ordonner le parcours (FR-12), consulter/révoquer les règles apprises | Web, Claude — **ouvert à tout membre du foyer** (décision du 2026-07-30) |
| **Foyer & appareils** | Web | Prénom, membres, code d'invitation (FR-41), appareils rattachés | Web |

**Le classement des rayons suit le parcours physique du magasin, jamais l'alphabet ni une catégorie théorique** (FR-2). Le rayon « À classer » est une zone de première classe, visible : le masquer serait mentir sur la fiabilité du tri.

→ Référence de composition : `.working/direction-abricot-v2.html` (écran pivot clair/sombre + dashboard), `.working/color-themes-1.html` (états hors-ligne + provenance). Le spine l'emporte en cas de conflit.

## Voice and Tone

Microcopy. La posture de marque et l'esthétique vivent dans `DESIGN.md`.

**Français, tutoiement, registre familier.** On parle de « la bouffe », « les courses », « un truc », « le dimanche soir ». La sophistication (le pont, la synchro, le stockage local) est **délibérément invisible** (NFR-8/NFR-9). Aucun message d'erreur technique n'est jamais montré brut.

| À faire | À éviter |
|---|---|
| « Ta liste est prête. » | « Liste synchronisée avec succès » |
| « Ajouter un truc » | « Créer un nouvel élément » |
| « Hors ligne — tes coches partiront au retour du réseau » | « Erreur réseau » / « Échec de synchronisation » |
| « arrive… » (sur l'article dicté pas encore là) | « En attente de synchronisation (token) » |
| « Rangée dans l'ordre de ton magasin » | « Tri par position de rayon » |
| « On dirait que la voix ne passe plus. Florian va regarder. » | « Le pont Google Keep est rompu (master token expiré) » |
| « Ta liste est vide » | « Aucun enregistrement trouvé » |

**Mots bannis à l'écran, toutes surfaces :** synchronisation, jeton/token, API, MCP, pont, Supabase, RLS, cache. Y compris dans Claude conversationnel : Claude parle de repas, de rayons et de courses.

## Component Patterns

Comportement. Les specs visuelles vivent dans `DESIGN.md.Components`.

| Composant | Usage | Règles de comportement |
|---|---|---|
| **Tuile Courses** | Dashboard | Tap → détail liste. Affiche le compteur à acheter, un *peek* des derniers ajouts et l'horodatage de provenance (« maj vocale il y a 2 min »). Ne prétend jamais être « à jour à la seconde » — c'est un reflet, pas un miroir temps réel (NFR-4). |
| **Carte-rayon** | Liste, toutes surfaces | En-tête emoji + nom + ratio `n/total`. Ordre des cartes = parcours magasin (FR-2). La carte « À classer » suit les mêmes règles et n'est jamais repliée par défaut (FR-9). |
| **Ligne-article** | Dans une carte-rayon | Tap n'importe où sur la ligne = bascule *acheté* (FR-3, dans les deux sens, mise à jour optimiste). ⚠️ **RÉVISÉ LE 2026-08-17 (story 4.5, décision D1 de Florian)** : la règle disait « **un seul hit-target par ligne** », et elle n'était plus tenable — FR-6 exige un geste de suppression **distinct du cochage**, et aucune autre place n'existait (un mode « Gérer » ferait diverger deux rendus de la même ligne ; un balayage serait inatteignable au clavier et invisible à l'œil). La règle devient : **un hit-target de BASCULE — le `<label>`, qui reste la plus grande zone du rang — plus un contrôle EXPLICITE de retrait, son frère.** Ce qui est préservé, et qui était l'intention d'UX-DR5, c'est qu'on ne vise jamais une cible de 25 px : le bouton tient ses 44 px. Porte la provenance iconifiée (FR-7) **doublée d'un `aria-label`** (« ajouté à la voix », « dicté / partagé », « ajout manuel », « issu d'une recette ») — la source ne dépend jamais de la seule icône. Expose au lecteur d'écran « {article}, {à prendre \| dans le panier} ». Décocher est le même geste inversé. |
| **Coche** | Ligne-article | **Vrai contrôle** (`role="checkbox"` / `<input type="checkbox">` stylé, pas un `<span>`) qui **annonce son état et son changement d'état**. Bascule idempotente (NFR-2) : cocher un article déjà coché ailleurs n'est pas une erreur. Retour visuel immédiat, même hors ligne et sous `prefers-reduced-motion`. Contour vide ≥3:1 contre la carte (voir Accessibility Floor). |
| **Pastille « arrive… »** | Ligne-article | Marque un article **non encore confirmé/synchronisé** (dicté en attente de récupération, ou action locale hors ligne). Disparaît quand l'article est confirmé. Ne bloque jamais le geste suivant. |
| **Séparateur « Dans le panier »** | Dans une carte-rayon | Repousse les articles cochés en bas du rayon, consultables et récupérables (FR-3). |
| **Bandeau hors-ligne** | Haut de la liste | Apparaît quand le réseau est absent. Informe, ne bloque pas, ne rougit pas. Disparaît au retour du réseau. |
| **Bouton d'action / ajout** | Liste (téléphone) | « Ajouter un truc ». Résout le rayon automatiquement (FR-4), agrège si doublon même nom + même unité (FR-5). |
| **Correction de rayon** | Liste (dashboard/téléphone : geste ; web/Claude : gestion) | Déplacer un article vers un autre rayon **mémorise la règle en silence** (FR-14) et l'applique immédiatement. Aucune question posée, aucune notion de « règle » montrée **sur les surfaces liste** — ni à qui que ce soit. La règle s'apprend en silence ; elle se consulte sur le web, par qui veut. |

## State Patterns

| État | Surface(s) | Traitement |
|---|---|---|
| **Chargement** | Liste, dashboard | Afficher la dernière liste connue (cache) immédiatement ; jamais d'écran blanc. Si aucun cache : squelette de rayons, pas de spinner plein écran. |
| **Liste vide** | Liste, dashboard | « Ta liste est vide. » Sur téléphone, lien vers l'ajout ; sur dashboard, rien à faire — l'écran est en lecture. |
| **Rayon « À classer » non vide** | Liste, dashboard | Toujours visible, jamais masqué silencieusement (FR-9). Un « À classer » qui grossit est un signal, pas un défaut à cacher. |
| **Hors ligne** | Téléphone (mode nominal) | Bandeau hors-ligne. Consultation, coche, décoche, ajout continuent **sans message d'erreur ni attente** (NFR-1). Les actions repartent au retour du réseau. |
| **Action non synchronisée** | Téléphone | Pastille « arrive… » sur l'article concerné : **visuellement distincte** d'une action confirmée, sans bloquer le geste suivant (NFR-1). |
| **Article dicté en attente** | Toutes | Un article dicté à Google **n'apparaît pas instantanément** : il arrive < 1 min (NFR-4). Aucune surface ne fait croire qu'il est déjà là. Quand il arrive, il porte la provenance micro. |
| **Article coché/supprimé ailleurs** | Toutes | Convergence sans conflit (NFR-2) : cocher un article déjà coché, ou supprimer un article coché ailleurs, n'est jamais une erreur ni un arbitrage demandé. L'état converge silencieusement. |
| **Pont vocal rompu** | Foyer prévenu (FR-49) | Le foyer est **prévenu sans avoir à le constater au supermarché** : « On dirait que la voix ne passe plus. » Les articles dictés **ne sont pas perdus** — ils s'accumulent côté Google et arrivent à la réparation (FR-48). `[ASSUMPTION]` Canal exact de la notification non spécifié par les sources — proposé : bandeau discret sur les surfaces de configuration (web + Claude), **jamais** une alerte anxiogène sur une surface liste. À trancher. |
| **Génération depuis le menu** | Web, Claude | Indique combien d'articles ont été ajoutés (FR-17), sans écraser les ajouts manuels ni les articles déjà achetés. |
| **Plein soleil** | Téléphone | Le thème automatique bascule en clair selon le système ; lisibilité prioritaire (voir `DESIGN.md`). |

## Interaction Primitives

- **Tap = basculer *acheté***, sur toute la ligne, dans les deux sens (FR-3). Geste unique, le plus gros de l'écran.
- **Ajouter sans clavier :** voix via l'assistant Google (FR-31, la maison) ; dictée système + partage vers NutriClaude (FR-46, téléphone, iPhone comme Android) ; cible de partage système depuis n'importe quelle app (FR-33).
- **Ajouter par la conversation :** demander à Claude d'ajouter/cocher/supprimer (FR-36).
- **Réordonner le parcours :** manipulation directe (glisser / monter-descendre), jamais un numéro d'ordre (FR-12) — surface web/Claude.
- **Corriger un rayon = apprendre :** le geste de correction crée la règle en silence (FR-14).
- **Vider le panier :** archiver les achetés d'un geste, avec confirmation (FR-8).

**Banni, toutes surfaces liste :** défilement horizontal (NFR-3) ; écran de login sur le dashboard (FR-28) ; message d'erreur bloquant hors ligne (NFR-1) ; toute UI qui prétend qu'un article dicté est déjà arrivé (NFR-4) ; tout jargon technique rendu (NFR-9) ; toute notion de « règle/configuration » exposée **sur une surface liste**, à n'importe quel membre (test d'acceptation ; reformulé le 2026-07-30 — c'est la surface qui est en cause, pas la personne).

## Accessibility Floor

L'accessibilité n'était traitée par aucune source (addendum §6) et vivait en `[ASSUMPTION]`. **Après audit Reviewer Gate (contraste calculé sur les fonds réels) et validation Florian, ce plancher est désormais une DÉCISION FERME**, plus une hypothèse ouverte. Les valeurs de contraste et les tokens vivent dans `DESIGN.md` ; ce qui suit fixe le comportement et les invariants a11y.

- **Cibles tactiles ≥ 44px** — ligne-article 46/48px, **zone de tap = la ligne entière SAUF le bouton de retrait** (⚠️ révisé le 2026-08-17, story 4.5 D1 — voir Component Patterns ; la quantité et la provenance la quantité, la pastille « arrive… » et l'icône de provenance à droite n'interceptent jamais le tap). Bascule idempotente au tap (NFR-2).
- **Contraste AA sur les fonds RÉELS.** Les gris et contours se jugent contre la surface où ils reposent (verre translucide, carte blanche, halo), **jamais contre la base pleine**. Texte porteur ≥ 4,5:1, texte large/UI non-textuel ≥ 3:1. Décisions clés :
  - **Coche vide ≥ 3:1 contre la carte, dans les deux thèmes** — c'est le contrôle le plus fréquent, sur l'écran pivot, dans le cas plein soleil ; contour #83887B (clair, 3,64:1) / #828AA3 (sombre, 4,77:1), ≥2px + léger fond interne.
  - **Texte d'info secondaire en muted** (quantités, ratio n/total, horodatage, provenance texte, séparateur) — jamais en muted-2 (qui tombait à ~2:1 sur clair). muted-2 = non-essentiel uniquement.
  - **Accent porteur de texte sur clair = #C2410C** (AA) ; #F5912B réservé aux aplats. #FFA94D sur sombre chaud (~9,7:1) inchangé.
  - **Bandeau hors-ligne clair** relevé à #7E6224 (5,20:1, AA).
- **Pas de dépendance à la seule couleur.** État *acheté* = **barré + coche pleine** (signaux primaires), libellé barré en muted (lisible). **Provenance (FR-7) jamais mono-canal :** l'icône (🎙/🗒/＋/🍴) est **doublée d'un équivalent texte / `aria-label`** — « ajouté à la voix », « dicté / partagé », « ajout manuel », « issu d'une recette » — de sorte qu'un daltonien, un malvoyant ou un lecteur d'écran distingue la source sans la couleur ni la forme de l'icône. La pastille « arrive… » porte toujours son **label texte**, jamais une seule pastille colorée.
- **Dashboard lisible à un mètre (FR-24)** — au-delà du compteur géant, **tout le contexte porteur** respecte un plancher de taille : corps dashboard (menu du jour, peek des ajouts) ≥ 18px, méta (horodatage de provenance, jour) ≥ 15px. Le 12px est interdit pour un texte porteur sur cette surface.
- **Focus clavier visible** sur les surfaces web/PWA — anneau 2px + offset (`{colors.focus-ring-light}` / `{colors.focus-ring-dark}`, ≥3:1) sur **tout** élément focusable (coche, ligne, bouton, champ, lien). **Jamais `outline:none` ni `tap-highlight:transparent` sans remplacement visible** (les mocks `.working` suppriment le highlight ; l'implémentation doit le rétablir). Le focus ne repose jamais sur la seule couleur.
- **Lecteur d'écran / sémantique.** Chaque élément interactif est un **vrai contrôle**, pas un `<span>` décoratif : la coche est un `role="checkbox"` (ou `<input type="checkbox">` stylé) qui **annonce son état** (coché / à prendre) **et son changement d'état**. La ligne-article expose un label « {article}, {à prendre|dans le panier} ». Le **gros compteur est annoncé en entier — « 12 articles à prendre »** (pas « 12 » seul) ; le ratio de rayon « 3 sur 4 pris ». Les emojis de rayon sont décoratifs (`aria-hidden`) car le nom du rayon est déjà en texte.
- **Mouvement — `prefers-reduced-motion`.** Sous `@media (prefers-reduced-motion: reduce)`, couper les transitions non essentielles (glow, animations d'arrivée « arrive… », bascule de thème). Le **retour d'état de la coche reste immédiat** (instantané, non animé) — jamais supprimé, seulement dé-animé.
- **Zoom / grandes polices système** — la colonne unique (NFR-3) doit tenir jusqu'à 200 % de zoom texte **sans défilement horizontal** ; à vérifier au *finalize* (le compteur 48px et la marge 8px sont les points à surveiller).

## Responsive & Platform

- **Le magasin est le contexte de référence** (NFR-3). L'écran liste se conçoit d'abord pour un **téléphone tenu à une main**, caddie dans l'autre. **Aucun défilement horizontal** sur la liste — c'est le seul écran dont l'ergonomie mobile n'est pas négociable.
- Le menu et les recettes (web) peuvent rester confortables surtout au grand écran ; ils ne portent pas la contrainte du magasin.
- **PWA installable sur iPhone et Android** (NFR-11), lançable depuis l'écran d'accueil, fonctionnant hors ligne (FR-35). **Aucun binaire natif, aucun store.** Toute capacité qui exigerait implicitement une app native est hors périmètre.
- Dashboard : écran fixe, sombre par défaut (allumé en continu, cuisine du soir), lisible à distance.

## Inspiration & Anti-patterns

Ce que le produit **assume de ne pas être** — pistes explicitement écartées, pour qu'un consommateur aval ne les « redécouvre » pas comme des manques.

**Inspiration.** Le langage visuel dérive d'un **dashboard domotique premium** (réf. `imports/reference-premium-dashboard.html`) : verre translucide, profondeur par halos, gros compteur, grosse coche. On en garde la matière et la hiérarchie — pas le contexte (météo, caméras, tuiles de pièces n'existent pas dans NutriClaude).

**Anti-patterns — écartés et pourquoi :**

| Écarté | Raison |
|---|---|
| **Vert menthe** comme couleur-signature (celui de la réf) | Code visuel « appli healthy/nutrition » ; NutriClaude assume d'être un outil de **courses**, pas de nutrition (v1). Remplacé par l'abricot (chaleur, « la bouffe »). |
| **Fond indigo froid** (celui de la réf) | Trop « tableau de bord logiciel ». Remplacé par un sombre chaud aubergine/espresso, registre cuisine du soir. |
| **Lecture de la liste à voix haute** (ex-FR-30) | Retirée du périmètre : la voix sert à **ajouter**, pas à consulter. Aucune surface ne lit la liste. |
| **App native / passage par un store** (NFR-11) | Compte développeur, revue externe, releases à perpétuité — coût de possession incompatible avec « tenir sans entretien » (NFR-10). PWA installable uniquement. |
| **Jargon technique visible** (« synchronisation », « jeton », « API », « MCP ») | Test d'acceptation : si comprendre l'outil est requis, l'outil a échoué (NFR-9). |
| **Rougir le hors-ligne** | Le hors-ligne est un **mode nominal** (NFR-1), jamais une erreur : teinte neutre, jamais d'alerte. |
| **Widget iOS, scan code-barres, génération de repas par l'IA** | Non-objectifs v1 (repoussés). Claude *pilote* la liste, ne décide pas des repas. |

## Key Flows

### Flow 1 — Le supermarché (la conjointe, samedi matin, caddie + iPhone une main)

1. Elle ouvre la liste : articles groupés par rayon, dans l'ordre où elle traverse *son* magasin (FR-2).
2. Aux Fruits & Légumes, elle prend les trois articles du groupe et les coche d'un doigt — ils passent « dans le panier ».
3. **Climax : le réseau lâche au fond du magasin. Rien ne change.** Pas de bandeau anxiogène, pas d'attente, pas d'erreur — juste un discret « hors ligne » et des coches qui portent « arrive… ». Elle continue, l'app ne proteste pas (NFR-1).
4. Elle croise Florian au rayon Crémerie : il a coché le yaourt depuis son téléphone. Au retour du réseau, les deux appareils convergent **sans que personne n'arbitre** (NFR-2).
5. Elle a coché le beurre par erreur : un tap le remet dans la liste (FR-3, geste inversé).

Elle n'a rien configuré, rien compris de technique. C'est le test d'acceptation qui passe.

### Flow 2 — L'écran de la cuisine (le foyer, en rentrant des courses)

1. Le dashboard affiche la liste en permanence, lisible d'un mètre (FR-24), plus le menu du jour à côté (FR-44).
2. On voit ce qu'il reste **sans rien ouvrir ni déverrouiller** — l'écran n'a jamais demandé à personne de se connecter (FR-28).
3. On coche les derniers articles directement sur l'écran, on supprime celui qu'on a finalement décidé de ne pas prendre (FR-26).
4. **Climax : à aucun moment un écran de login n'est apparu.** L'écran mural est un membre du foyer sans être une personne — rattaché une fois par Florian, plus jamais réinterrogé.

### Flow 3 — L'ajout à chaud (Florian, mardi 19h, mains occupées)

1. Placard ouvert, plus d'huile d'olive. Il ne s'essuie pas les mains : *« Ok Google, ajoute de l'huile d'olive à la liste de courses. »*
2. L'enceinte confirme — **c'est Google qui parle, pas nous** (NFR-4).
3. **Climax : l'huile n'apparaît pas à la seconde. Et c'est voulu.** Moins d'une minute plus tard, elle est dans NutriClaude, classée en Épicerie, provenance micro, visible sur l'écran cuisine et le téléphone de la conjointe. Aucune surface n'a menti en la montrant « déjà là » avant qu'elle le soit.
4. Le lendemain au magasin, la conjointe dicte dans n'importe quelle app et partage vers NutriClaude (FR-46/FR-33) — deux gestes, sans clavier, iPhone comme Android.

Variante d'échec : le pont est rompu. La commande vocale continue de marcher, les articles s'accumulent côté Google (FR-48), et le foyer est prévenu côté web/Claude — jamais découvert au supermarché (FR-49).

### Flow 4 — Le dimanche soir désamorcé (Florian, avec Claude)

1. Il discute avec Claude de ce qu'ils mangent cette semaine et assigne les recettes du répertoire aux cases du menu (FR-15).
2. En une action, la liste complète se génère : ingrédients non optionnels agrégés (deux recettes avec oignons = une ligne), mis à l'échelle selon le nombre de personnes, classés par rayon (FR-16).
3. La génération n'écrase pas les ajouts manuels ni les articles déjà achetés, et annonce combien d'articles ont été ajoutés (FR-17).
4. **Climax : « le dimanche soir a duré quatre minutes. »** La charge mentale récurrente et datée a disparu — pas optimisée, *supprimée*.

## Lacunes & hypothèses

**[ASSUMPTION] posées dans ce fichier :**
- **Garde-fou du silent-learning (FR-14) :** les règles mot-clé → rayon apprises sont consultables/révocables côté web + Claude, **par tout membre du foyer** ; aucune surface liste ne montre jamais la notion de règle. *(Reformulé le 2026-07-30 : le garde-fou porte sur la SURFACE, pas sur la personne — voir la décision en tête de Foundation.)*
- **Canal de la notification « pont rompu » (FR-49)** non spécifié par les sources : proposé en bandeau discret sur les surfaces de configuration (web + Claude), jamais une alerte sur une surface liste. À trancher.
- **Plancher d'accessibilité** : ~~absent des sources~~ → **désormais spécifié comme décision ferme** (durcissement Reviewer Gate, validé Florian). Cf. *Accessibility Floor* : contraste sur fonds réels, coche vraie et ≥3:1, gris porteurs en muted, provenance à double canal (icône + `aria-label`), tailles dashboard 1 m, focus clavier, `prefers-reduced-motion`, compteur annoncé en entier. Reste **une seule** [ASSUMPTION] mineure : comportement exact sous **zoom 200 %** (colonne unique sans scroll horizontal — à vérifier sur rendu réel). La provenance à **4 canaux** (🎙/🗒/＋/🍴) est désormais **confirmée** (décision Florian), plus une hypothèse.
- **Mécanisme d'appairage du dashboard** (rattachement au foyer) : l'invariant est spécifié (rattaché une fois, jamais de re-auth), le mécanisme technique (code/URL) est délégué à l'architecture.

**Conflits détectés entre décisions du memlog :** aucun conflit interne. Un seul **point de friction avec les sources**, déjà tracé : la variante clair verrouillée #F5912B échoue AA en usage texte — résolu par un token dérivé côté `DESIGN.md`, arbitrage remonté à Florian.

**FR/NFR à impact UX — couverture par surface :** chaque surface a au moins un flow (Dashboard → Flow 2, Google → Flow 3, Téléphone → Flows 1 & 3, Claude → Flow 4, Web → Flow 4 + IA). FR liste (1–10), rayons (11–14), menu/recettes (15–18, 51–52), dashboard (24–28, 44), voix/pont (29, 31, 46–50), mobile (33, 35), conversationnel (36–39), NFR (1–5, 8–12) — **tracés** dans l'IA, les états ou les flows.

**FR/NFR non couverts faute de matière UX élicitée (pas d'écran maquetté, hors périmètre de cet atelier) :** FR-40/41 (inscription, code d'invitation — parcours d'onboarding non maquetté), FR-42 (écran profil/membres/appareils), FR-19–23 & FR-52 & NFR-6/NFR-12 (contrat d'API, identités d'appareil, moindre privilège du pont — **invisibles par conception**, relèvent de l'architecture, aucune surface visible attendue), NFR-7 (export/suppression de données — reconnu comme dette de conformité par le PRD, aucun lot ne l'appelle). Ces éléments sont notés pour traçabilité, non traités faute de décision de design en amont.
