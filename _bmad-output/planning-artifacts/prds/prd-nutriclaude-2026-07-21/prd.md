---
title: "NutriClaude — PRD v1 : la liste de courses, partout"
status: draft
created: 2026-07-22
updated: 2026-07-22
---

# NutriClaude — PRD v1

> **v1.0** — arbitrages du 2026-07-22, après deux études de faisabilité vocale. Objectifs nutritionnels reportés en v2 · dashboard maison en surface de premier plan · hors-ligne érigé en exigence critique sur iPhone 15 Pro · enfant non modélisé · aucune application native, aucun store · l'ajout à la voix passe par l'assistant Google via un pont non officiel assumé. Quatre exigences ont été retirées en cours de route (FR-30, FR-34, FR-45, et FR-31 retirée puis réhabilitée) : leurs identifiants ne sont pas réattribués et le motif du retrait reste visible dans le document.

## 1. Le problème

Le dimanche soir est un casse-tête. Décider quoi manger dans la semaine, en déduire ce qu'il faut acheter, et ne pas se retrouver au supermarché à reconstituer de mémoire une liste qu'on a faite dans sa tête — c'est une charge mentale récurrente, datée, et partagée à deux.

Les apps de meal planning ne règlent pas ça : elles demandent plus d'entretien qu'elles n'en font gagner, et **elles ne tiennent jamais plus de deux semaines**. C'est le seul benchmark qui compte ici, et il est négatif : le succès de NutriClaude, c'est d'être encore utilisé au bout de deux mois.

**La promesse** : que ma femme et moi mangions bien *sans y penser*. Pas optimiser la décision — la faire disparaître.

## 2. Ce qu'on construit

**La liste de courses est le produit.** Les recettes, le menu de la semaine et les rayons ne sont pas des fonctionnalités parallèles : ce sont les affluents qui alimentent la liste. Toute décision produit se tranche en demandant *est-ce que ça améliore la liste ?*

Une liste de courses qui a trois propriétés que les autres n'ont pas :

- **Partagée** — une seule liste pour le foyer, la même partout, en temps réel.
- **Triée selon le parcours réel du magasin** — pas par ordre alphabétique, pas par catégorie théorique : dans l'ordre où on croise physiquement les rayons.
- **Présente là où on est, sans avoir à la chercher** — sur l'écran de la cuisine, à la voix depuis le plan de travail, dans la poche au supermarché, ou en conversation avec Claude.

### La liste a cinq surfaces

C'est la caractéristique structurante de ce PRD, et son principal risque. La liste n'est pas une app avec des intégrations : c'est **une donnée avec cinq points d'accès de rang égal**.

| Surface | Sert à | Contexte |
|---|---|---|
| **Dashboard maison** | Voir et cocher | Écran fixe de la cuisine, produit développé séparément |
| **Assistant Google** | Ajouter à la voix | Toute la maison, via un pont non officiel |
| **Téléphone** (iPhone et Android) | Cocher, ajouter | Supermarché, **hors ligne** |
| **Claude en conversation** | Piloter, planifier | Bureau, dimanche soir |
| **Web** | Configurer, planifier | Recettes, menu, rayons |

Aucune de ces surfaces n'est « la vraie ». Elles consomment toutes le même contrat, et une règle métier appliquée par l'une doit l'être par toutes.

**La voix passe entièrement par l'assistant Google, et par un chemin non officiel.** Aucun assistant n'est ouvert à un développeur indépendant sans application native publiée sur un store. Le foyer parle donc à l'assistant Google, et NutriClaude récupère ce que Google dépose déjà dans sa propre liste (FR-31). Ce pont cassera un jour — le PRD dit ce qui se passe ce jour-là (FR-48), et assume qu'il n'existe **aucun chemin vocal de repli** indépendant d'un tiers.

### Non-objectifs de la v1

Explicitement écartés, et ce n'est pas un oubli :

- **Les objectifs nutritionnels et restrictions alimentaires.** Modélisés en base, ils restent inexploités. → v2, avec les macros et l'IA qui leur donneront un sens.
- **Le catalogue Open Food Facts, le Nutri-Score, le scan de code-barres.** La base est déjà modélisée pour, elle restera vide.
- **Le calcul automatique des macros d'une recette.** Les colonnes existent, elles resteront `NULL`.
- **La génération de recettes et de menus par l'IA.** Claude sert à *piloter* la liste, pas à décider des repas.
- **Le profil enfant** (portions, allergies). Non modélisé.
- **Tout ce qui relève du funnel Le Cadre** — lead magnet, séquence d'emails, instances clients, micro-SaaS. C'est un outil pour un foyer : le mien. Voir `addendum.md`.

> **La v1 assume d'être un outil de courses, pas un outil de nutrition.** Le « nutri » de NutriClaude arrive en v2. Autant le dire franchement plutôt que de laisser traîner des champs vides qui font croire le contraire.

## 3. Les utilisateurs

Un foyer, deux adultes. Pas de persona abstrait.

- **Florian** — construit l'outil et l'utilise. Configure les rayons, saisit les recettes, planifie le menu. À l'aise pour parler à Claude en conversation.
- **Sa conjointe** — utilisatrice de plein droit, pas invitée. Son usage principal est la liste au supermarché et l'ajout à la voix. **Elle ne configurera jamais rien.** Si une capacité exige de comprendre l'outil, elle a échoué. C'est le test d'acceptation implicite de tout le produit.

L'enfant existe dans le foyer mais **pas dans le produit** : ni profil, ni portions, ni allergies.

> `[HYPOTHÈSE]` Ces deux profils sont déduits du doc d'archi et du modèle de données, pas de ton récit. À confirmer.

## 4. Parcours

> `[HYPOTHÈSE]` Ces parcours sont reconstruits à partir du doc d'architecture, du code et de tes arbitrages. Ils demandent ta validation : ce sont eux qui portent tout le reste du PRD.

**UJ-1 — Le supermarché (le parcours critique).**
Samedi matin, sa conjointe pousse le caddie, iPhone dans une main. Elle ouvre la liste : les articles sont groupés par rayon, dans l'ordre où elle traverse *son* magasin. Elle arrive aux Fruits & Légumes, prend les trois articles du groupe, les coche d'un doigt — ils disparaissent. **Le réseau ne passe pas au fond du magasin : rien ne change.** Elle continue de cocher, l'app ne proteste pas. Elle croise Florian au rayon Crémerie, il a coché le yaourt depuis son téléphone : quand le réseau revient, les deux appareils sont d'accord sans que personne n'ait à arbitrer. Elle se rend compte qu'elle a coché le beurre par erreur : elle le remet dans la liste en un geste.

**UJ-2 — L'écran de la cuisine.**
Le dashboard maison affiche la liste en permanence, lisible d'un mètre. On voit ce qu'il reste à acheter sans rien ouvrir ni déverrouiller. En rentrant des courses, on coche les derniers articles directement sur l'écran, et on supprime celui qu'on a finalement décidé de ne pas prendre. L'écran n'a jamais demandé à personne de se connecter.

**UJ-3 — L'ajout à chaud.**
Mardi, 19h. Florian ouvre le placard, voit qu'il n'y a plus d'huile d'olive. Il ne s'essuie pas les mains, il ne cherche pas son téléphone : *« Ok Google, ajoute de l'huile d'olive à la liste de courses. »* L'enceinte confirme. Moins d'une minute plus tard, l'huile est dans NutriClaude, classée en Épicerie sèche, visible sur l'écran de la cuisine et sur le téléphone de sa conjointe. Aucune app n'a été ouverte, aucun écran touché.

Au supermarché le lendemain, sa conjointe veut ajouter quelque chose : elle dicte dans n'importe quelle app et partage vers NutriClaude. Deux gestes, mais sans clavier — c'est le chemin de repli, sur iPhone comme sur Android.

**UJ-4 — Le dimanche soir désamorcé.**
Florian discute avec Claude de ce qu'ils vont manger cette semaine. Il assigne les recettes du répertoire aux cases du menu. Puis, en une action, la liste de courses complète se génère : les ingrédients de toutes les recettes de la semaine, agrégés (deux recettes avec des oignons = une seule ligne), mis à l'échelle selon le nombre de personnes prévues, et déjà classés par rayon. Le dimanche soir a duré quatre minutes.

## 5. Capacités et exigences fonctionnelles

### A. La liste de courses

- **FR-1** — Le foyer dispose d'une liste de courses unique et partagée : toute surface voit et modifie la même liste.
- **FR-2** — La liste s'affiche groupée par rayon, les groupes ordonnés selon le parcours physique du magasin, chaque groupe identifié par son nom et son icône.
- **FR-3** — Un article a deux états : *à acheter* et *acheté*. Basculer de l'un à l'autre se fait en une seule action, **dans les deux sens**. Les articles achetés restent consultables et récupérables.
- **FR-4** — Un article peut être ajouté avec un nom, une quantité et une unité ; le rayon est déterminé automatiquement, et reste corrigeable.
- **FR-5** — Ajouter un article déjà présent dans la liste (même nom, même unité) **additionne les quantités** au lieu de créer un doublon — **quelle que soit la surface d'où vient l'ajout**, pas seulement lors d'une génération depuis le menu.
- **FR-52** — Les quantités s'expriment dans un **vocabulaire d'unités fermé** (g, kg, ml, L, pièce, cuillère à soupe, cuillère à café, pincée). Deux unités différentes ne sont jamais additionnées ni converties : elles restent deux lignes. Les quantités mises à l'échelle (FR-16) sont arrondies à une valeur qu'on peut acheter — on n'écrit pas « 1,67 oignon ».
- **FR-6** — Un article peut être supprimé de la liste, distinctement du fait de le cocher.
- **FR-7** — Chaque article conserve sa provenance : la recette dont il vient ou l'indication d'un ajout manuel, la surface par laquelle il est arrivé, et le membre qui l'a ajouté.
- **FR-8** — Les articles achetés peuvent être archivés d'un geste, et la liste entièrement vidée, avec confirmation.
- **FR-9** — Les articles dont le rayon n'a pas pu être déterminé sont regroupés dans un groupe « À classer » visible, jamais silencieusement masqués.
- **FR-10** — Une modification faite depuis une surface apparaît sur les autres surfaces sans action de l'utilisateur.

### B. Le classement par rayon

- **FR-11** — Chaque foyer définit ses propres rayons : nom, icône, position dans le parcours. Un jeu de rayons par défaut est créé à l'initialisation du foyer.
- **FR-12** — Le parcours se réordonne **directement par manipulation de la liste** (glisser, ou monter/descendre) — pas par saisie d'un numéro d'ordre.
- **FR-13** — Le foyer définit des règles mot-clé → rayon (`poulet` → Boucherie). Le classement résout la règle dont le mot-clé est le plus spécifique parmi ceux contenus dans le nom de l'article.
- **FR-14** — Corriger le rayon d'un article propose de mémoriser la correction comme règle, pour que l'erreur ne se reproduise pas.

> **FR-14 est la boucle d'apprentissage du produit.** Sans elle, le classement automatique reste figé à sa qualité du premier jour et l'utilisateur finit par ne plus lui faire confiance. Avec elle, la liste devient plus juste chaque semaine sans que personne n'ait à « configurer » quoi que ce soit.

### C. Alimenter la liste depuis le menu

- **FR-15** — Le foyer planifie un menu hebdomadaire en assignant des recettes à une grille jour × repas, avec le nombre de personnes prévues.
- **FR-16** — La liste se génère depuis le menu d'une semaine donnée : ingrédients non optionnels de toutes les recettes planifiées, quantités mises à l'échelle selon les personnes prévues rapportées aux portions de la recette, doublons agrégés, rayons résolus.
- **FR-17** — La génération n'écrase pas les articles ajoutés à la main et n'efface pas les articles déjà achetés ; elle indique combien d'articles ont été ajoutés.
- **FR-18** — Le foyer tient un répertoire de recettes : titre, description, portions, temps, instructions consultables en lecture, et une liste d'ingrédients (quantité, unité, nom, mot-clé de rayon, caractère optionnel), chaque ingrédient étant modifiable après création et réordonnable.
- **FR-51** — Les recettes portent des **étiquettes libres** (`rapide`, `batch-cooking`, `végé`…), éditables, et le répertoire se **filtre par étiquette et se cherche par titre**. Sans ça, assigner des recettes au menu (FR-15) devient un défilement dans une liste qui grossit à chaque semaine.

### D. L'API — le contrat commun

> Ce n'est plus un détail d'implémentation : le dashboard maison est un produit distinct qui consomme cette interface. Elle a donc un consommateur externe et doit être traitée comme un contrat.

- **FR-19** — Une interface programmatique stable expose les opérations de la liste : lire la liste groupée par rayon, ajouter un article, cocher, décocher, supprimer, archiver les achetés, vider.
- **FR-20** — Cette interface applique les mêmes règles métier que l'écran — agrégation des doublons, résolution du rayon, isolation du foyer. **Aucune surface ne peut produire un état que les autres jugeraient invalide.**
- **FR-21** — Chaque appareil ou client s'authentifie avec une identité propre, révocable individuellement sans affecter les autres surfaces.
- **FR-22** — Un consommateur peut être notifié des changements de la liste sans avoir à interroger l'interface en boucle.
- **FR-23** — Le contrat est versionné : une évolution ne casse pas un consommateur existant sans préavis. C'est ce qui empêche une modification de NutriClaude de casser silencieusement le dashboard.

### E. Le dashboard maison

> L'écran lui-même est un produit distinct, développé séparément. Ce que NutriClaude doit livrer, ce sont les capacités ci-dessous *côté liste* — le contrat, l'identité d'appareil, la propagation — sans lesquelles le dashboard ne peut pas les offrir. Le lot 2 finance cette moitié-là, pas l'interface.

- **FR-24** — Le dashboard affiche la liste à acheter, groupée par rayon, **lisible à distance** sur un écran fixe.
- **FR-25** — Un article peut être coché comme acheté d'un seul geste depuis le dashboard.
- **FR-26** — Un article peut être supprimé depuis le dashboard.
- **FR-27** — Le dashboard reflète les changements survenus ailleurs sans intervention et sans rechargement manuel.
- **FR-28** — Le dashboard est rattaché au foyer une fois pour toutes, et **ne demande jamais à un utilisateur de se connecter**. C'est un écran partagé, allumé en permanence, sans utilisateur courant.
- **FR-44** — Le dashboard affiche également les repas planifiés du jour, à côté de la liste. *(Ajouté après FR-43 pour préserver la numérotation ; sa place logique est ici.)*

> **FR-28 est le point dur de cette surface.** Tout le modèle de sécurité actuel repose sur « un utilisateur connecté appartient à un foyer ». Un écran mural n'a pas d'utilisateur. Il faut une identité d'appareil rattachée au foyer, avec des droits restreints à la liste — pas une session personnelle laissée ouverte pour toujours.

### F. La voix

> **Réécrit le 2026-07-22** après deux études de faisabilité. Aucun assistant n'est ouvert à un développeur indépendant par la voie officielle — ni Siri sans app native publiée, ni Google. L'ajout par la parole repose donc sur **un pont non officiel vers la liste que l'assistant Google alimente déjà** (FR-31), avec la dictée-partage du téléphone en repli (FR-46). Détail, chemins écartés et sources dans `addendum.md`.

- **FR-29** — Un membre peut ajouter un article à la liste **en parlant**, sans clavier. Deux mécanismes le réalisent : l'assistant Google dans la maison (FR-31) et la dictée du système sur téléphone (FR-46).
- **FR-30** — ~~Consulter la liste à voix haute.~~ **Exigence retirée le 2026-07-22 : non réalisable, et trompeuse si on l'approchait.** Nous n'avons aucune surface qui écoute (FR-45 abandonnée), et l'assistant Google ne saurait lire que *sa* liste — celle que le pont vide au fur et à mesure. Demander « qu'est-ce qu'il reste à acheter ? » renverrait une réponse fausse. L'identifiant n'est pas réattribué.
- **FR-31** — **Réhabilitée le 2026-07-22** après seconde étude. Un membre peut dire à l'assistant Google, y compris sur une enceinte, *« Ok Google, ajoute des poivrons à la liste de courses »*, et l'article arrive dans la liste NutriClaude, classé par rayon comme n'importe quel autre.
  > La reconnaissance vocale n'est pas la nôtre : Google la fait déjà et dépose l'article dans sa propre liste. **Ce que NutriClaude construit est un pont, pas une intégration vocale.** Les exigences FR-47 à FR-50 existent parce que ce pont est non officiel et cassera un jour.
- **FR-47** — Le pont est **idempotent** : un article dicté une fois n'apparaît qu'une fois dans la liste, quel que soit le nombre de récupérations. Le pont **marque les articles traités du côté Google, sans les supprimer** — il ne détruit jamais de donnée qu'il n'a pas créée. Les articles marqués depuis longtemps sont purgés périodiquement pour que la liste Google ne grossisse pas indéfiniment.
- **FR-48** — **Dégradation gracieuse.** Si le pont est rompu, la commande vocale continue de fonctionner : les articles s'accumulent côté Google et sont récupérés au rétablissement, sans perte. Une panne du pont fait perdre la synchronisation, jamais le geste ni les données.
- **FR-49** — **Le foyer est prévenu quand le pont est rompu**, sans avoir à le constater au supermarché. Le rétablissement est une procédure documentée, réalisable sans redéploiement.
- **FR-50** — **Le pont ne circule que dans un sens** : de l'assistant Google vers NutriClaude. NutriClaude ne maintient pas la liste Google à son image. **Conséquence à assumer et à ne pas oublier : la lecture native (« Ok Google, qu'est-ce qu'il y a sur ma liste ? ») n'est pas fiable et ne doit pas être utilisée** — elle ignore tout ce qui a été ajouté depuis une autre surface, et considère comme traité tout ce que le pont a déjà ingéré. La liste Google est une boîte aux lettres, pas un miroir.
- **FR-32** — Aucune surface ne demande de se connecter au moment où l'on parle. Le rattachement au foyer est fait une fois pour toutes, en amont.
- **FR-45** — ~~Voix sur le dashboard maison.~~ **Exigence retirée le 2026-07-22** sur décision de Florian : l'assistant Google couvre déjà l'ajout vocal dans la maison, sans mot de réveil ni geste préalable. L'identifiant n'est pas réattribué. **Conséquence assumée : le foyer n'a plus aucun chemin vocal indépendant d'un tiers** — le jour où le pont casse, l'ajout par la parole s'arrête jusqu'à réparation, et le repli est la saisie manuelle ou la dictée-partage (FR-46).
- **FR-46** — Sur téléphone, l'ajout par la parole passe par la dictée du système suivie d'un partage vers NutriClaude — **identiquement sur iPhone et sur Android**, sans application native.

### G. Les surfaces mobiles

- **FR-33** — NutriClaude est une **cible de partage du système** : partager un texte depuis n'importe quelle application l'ajoute à la liste, avec résolution du rayon.
- **FR-34** — ~~Widget écran d'accueil ou écran verrouillé.~~ **Exigence retirée le 2026-07-22** : exige un binaire natif publié sur un store, hors périmètre v1. L'identifiant n'est pas réattribué.
- **FR-35** — La liste s'installe comme une application à part entière, **sur iPhone et sur Android**, lançable depuis l'écran d'accueil et fonctionnant hors ligne.

### H. Le pilotage conversationnel

- **FR-36** — Depuis une conversation avec Claude, il est possible de consulter la liste, y ajouter des articles, cocher et supprimer.
- **FR-37** — Depuis une conversation avec Claude, il est possible de consulter et créer des recettes, et de consulter et modifier le menu de la semaine.
- **FR-38** — Depuis une conversation avec Claude, il est possible de consulter et modifier les rayons et les règles de classement.
- **FR-39** — Les actions faites en conversation s'exercent dans le périmètre du foyer de l'utilisateur, et jamais au-delà.

> **FR-39 est une exigence de sécurité, pas de confort.** Ton doc d'architecture prévoit un serveur MCP utilisant la clé de service Supabase — ce qui court-circuite le RLS, alors que le RLS est le seul mécanisme d'isolation entre foyers. Cette tension doit être résolue en architecture, pas contournée.

### I. Le foyer

- **FR-40** — À l'inscription, un utilisateur crée un foyer ou rejoint un foyer existant via un code d'invitation.
- **FR-41** — Un membre peut **générer un code d'invitation depuis l'application** et le partager ; le code a une durée de validité et un nombre d'usages limités.
- **FR-42** — Un membre dispose d'un écran où consulter et modifier son prénom affiché, voir les autres membres du foyer, et gérer les appareils rattachés au foyer.
- **FR-43** — Recettes, rayons, menu et liste de courses sont partagés entre tous les membres du foyer.

## 6. Exigences non fonctionnelles

- **NFR-1 — Le hors-ligne n'est pas une dégradation, c'est un mode nominal.** Au supermarché, la liste se consulte, se coche, se décoche et s'enrichit **sans réseau**, sans message d'erreur et sans attente. Les modifications se resynchronisent au retour du réseau. Une action non encore synchronisée est visuellement distinguée d'une action confirmée, sans jamais bloquer le geste suivant. Appareil de référence : **iPhone 15 Pro**. Une liste qui échoue en magasin n'a aucune valeur, quelles que soient ses autres qualités.
- **NFR-2 — Convergence entre surfaces.** Deux surfaces agissant simultanément ou hors ligne sur la liste convergent vers le même état sans perte et sans arbitrage demandé à l'utilisateur. Cocher un article déjà coché ailleurs n'est pas une erreur. Supprimer un article coché ailleurs n'est pas un conflit.
- **NFR-3 — Le magasin est le contexte de référence.** La liste se conçoit d'abord pour un téléphone tenu à une main, avec un caddie dans l'autre. Aucun écran de la liste n'exige de défilement horizontal. C'est le seul écran dont l'ergonomie mobile n'est pas négociable ; le menu et les recettes peuvent rester confortables surtout au grand écran.
- **NFR-4 — L'ajout vocal est confirmé à la voix, mais arrive en différé.** L'assistant confirme immédiatement — c'est lui qui parle, pas nous — et l'article rejoint la liste NutriClaude en moins d'une minute. **Cet écart est structurel** : le pont récupère par cycles, il ne reçoit pas de notification. Aucune surface ne doit donc laisser croire qu'un article dicté est déjà arrivé : mieux vaut qu'il apparaisse un peu tard que d'afficher une liste qu'on croit à jour et qui ne l'est pas.
- **NFR-5 — Isolation des foyers.** Aucune surface, aucun appareil, aucun jeton ne permet de lire ou modifier les données d'un autre foyer. L'isolation est appliquée au niveau de la donnée, jamais seulement au niveau de l'interface.
- **NFR-6 — Un appareil n'est pas une personne.** Les identités d'appareil (dashboard, raccourcis) ont un périmètre restreint à ce dont elles ont besoin, sont révocables une par une, et ne donnent jamais accès aux capacités d'administration du foyer.
- **NFR-7 — Données personnelles.** Un membre peut consulter, exporter et supprimer ses données, et supprimer son compte. `[HYPOTHÈSE]` Point totalement absent du doc d'origine ; je le maintiens au minimum syndical même sans données de santé en v1.
- **NFR-8 — Français.** L'interface, les libellés, les rayons par défaut et la reconnaissance vocale sont en français. Les messages d'erreur techniques ne sont jamais montrés bruts à l'utilisateur.
- **NFR-9 — Ton.** Aucun jargon technique visible. On parle de repas, de rayons et de courses — jamais de synchronisation, de jeton ou d'API. La sophistication reste invisible.
- **NFR-12 — Moindre privilège pour le pont Google.** Le compte tiers utilisé par le pont (FR-31) est dédié à cet usage, jamais un compte personnel du foyer, et n'a accès qu'à la seule liste partagée. Ses identifiants sont stockés chiffrés et révocables. Le mécanisme sous-jacent donne des droits étendus : c'est le cloisonnement du compte, et lui seul, qui contient le risque.
- **NFR-11 — Aucun binaire natif, aucun store en v1.** Le produit reste une application web installable. Publier sur l'App Store ou le Play Store engage un compte développeur payant, une revue externe, et des cycles de release à perpétuité — un coût de possession sans rapport avec un outil familial. Toute exigence qui impose implicitement une app native est à réécrire, pas à financer.
- **NFR-10 — Coût de possession.** L'outil doit tenir sans entretien régulier. Toute capacité qui exige une maintenance hebdomadaire pour rester utile est un candidat à la suppression, pas à l'optimisation.

## 7. Écart avec l'existant

L'app web actuelle couvre déjà une bonne part des affluents. Elle ne couvre presque rien du cœur, et **aucune des quatre surfaces non-web n'existe**.

| Domaine | État aujourd'hui | Écart |
|---|---|---|
| Liste partagée, triée par rayon, générée depuis le menu | Fonctionne | Conforme à FR-1, FR-2, FR-16 |
| Suppression d'un article, vidage | Fonctionne | Conforme à FR-6, FR-8 |
| Agrégation des doublons | **Seulement à la génération** (regroupement SQL). L'ajout manuel est une insertion nue : deux « lait » font deux lignes | FR-5 |
| Rayon d'un ajout manuel | **Non résolu** — la résolution automatique n'est appelée que par la génération. Et le rayon d'un article n'est corrigeable nulle part | FR-4, FR-14 |
| Cocher / décocher | **Cassé** — case codée en dur, un article acheté ne peut pas revenir | FR-3 |
| Génération depuis le menu | Efface les articles *à acheter* existants | FR-17 |
| Provenance d'un article | Partielle : le membre qui ajoute est bien enregistré ; la recette d'origine est omise à la génération, et la surface n'a pas de colonne | FR-7 |
| Réordonnancement des rayons | Par saisie d'un numéro | FR-12 |
| Correction de rayon apprenante | Inexistante — et sans objet tant que corriger un rayon est impossible | FR-14 |
| Propagation entre surfaces | Inexistante | FR-10, FR-22, FR-27 |
| **Hors-ligne** | **Inexistant** — tout est `force-dynamic`, chaque action est un aller-retour serveur | **NFR-1, NFR-2** |
| **API / contrat** | **Inexistant** — logique en Server Actions, non consommable de l'extérieur | **FR-19 à FR-23** |
| **Dashboard maison** | Inexistant | FR-24 à FR-28 |
| **Ajout à la voix (pont Google)** | Inexistant | FR-29, FR-31, FR-47 à FR-50, NFR-12 |
| **Installation, partage, dictée (iPhone et Android)** | Inexistant — aucun manifeste, aucun service worker | FR-33, FR-35, FR-46 |
| **Conversationnel (Claude)** | Inexistant | FR-36 à FR-39 |
| Identités d'appareil, révocation | Inexistant — seul modèle : utilisateur connecté | FR-21, FR-28, NFR-6 |
| Code d'invitation | Fonction en base, **aucun bouton dans l'app** — mode « rejoindre » inutilisable | FR-41 |
| Écran profil / membres du foyer | Inexistant | FR-42 |
| Édition d'un ingrédient | Suppression + recréation uniquement | FR-18 |
| Lecture des instructions d'une recette | Zone d'édition seulement, jamais rendue | FR-18 |
| Repas « collation » | En base, absent de l'écran | FR-15 |
| Mobile | Grille du menu à défilement horizontal forcé | NFR-3 |
| Suppression de compte / export | Inexistant ; un utilisateur appartient à un foyer à vie | NFR-7 |

**Les deux écarts structurants** sont le hors-ligne et l'API : ils ne s'ajoutent pas au produit actuel, ils en changent la construction. Tout le reste sont des compléments.

**Prérequis du lot 0 — l'application ne compile pas.** Vérifié, pas supposé : la construction échoue sur le greffon PostCSS de Tailwind 4, le typage échoue sur `cookies()` devenu asynchrone, et le fichier qui porte *tout* le contrôle d'accès est déprécié dans la version de Next déclarée. Rien de ce PRD n'est constructible avant que ce soit réglé. Détail dans `addendum.md`.

## 8. Comment on saura que ça marche

La métrique unique, celle qui invalide tout le reste si elle échoue :

- **Rétention à 8 semaines.** La liste est encore utilisée pour les courses deux mois après la mise en service. Le benchmark est explicite : les apps de meal planning meurent à deux semaines.

Métriques d'appui :

- **Adoption par la conjointe** — elle utilise la liste au supermarché sans assistance, et ajoute des articles de sa propre initiative. C'est le vrai test d'ergonomie.
- **Zéro échec en magasin** — aucune session de courses interrompue par un problème de réseau. C'est le critère d'acceptation de NFR-1.
- **Le dimanche soir** — le temps entre « on décide des repas » et « la liste est prête » est de l'ordre de quelques minutes, pas d'une soirée.
- **Justesse du classement** — la proportion d'articles atterrissant dans le bon rayon du premier coup augmente semaine après semaine, sans configuration manuelle. *Se lit dans le nombre de corrections faites via FR-14.*
- **Répartition par surface** — quelle part des ajouts arrive par la voix, le dashboard, le téléphone, la conversation. Une surface qui ne sert jamais est une surface à retirer, pas à améliorer. *Repose sur la provenance enregistrée en FR-7, seule exigence qui capte cette donnée.*

> **Aucune de ces mesures ne justifie d'outillage.** Un foyer de deux personnes constate ces choses en vivant avec le produit ; la seule donnée qu'il faut penser à *conserver* est la provenance (FR-7). Si une métrique demande un tableau de bord pour être lue, elle a déjà échoué au test de NFR-10.

Contre-métriques — ce qu'on surveille pour ne pas gagner sur le papier en perdant en vrai :

- **Le temps passé à entretenir l'outil.** Si configurer les rayons et saisir les recettes coûte plus que le dimanche soir qu'on remplace, le produit est un échec, quel que soit son taux d'usage.
- **Le groupe « À classer ».** S'il grossit, le tri par rayon est une fiction et la liste redevient une liste ordinaire.
- **Les courses faites hors liste.** Si on continue à acheter de mémoire en magasin, c'est que la liste n'est pas fiable ou pas accessible au bon moment.
- **Les divergences entre surfaces.** Un article qui réapparaît après avoir été coché, une quantité qui double : la synchronisation coûte sa propre classe de bugs, et c'est le prix des cinq surfaces.
- **Les corrections après coup.** Articles ajoutés puis supprimés, quantités rectifiées : signale que la génération depuis le menu ne mérite pas encore la confiance.

## 9. Ordre d'arrivée

Les surfaces n'arrivent pas ensemble. L'ordre suit une règle : **on ne construit une surface que quand le socle qu'elle consomme existe.**

**Lot 0 — Remettre l'application en état de marche, et rendre le foyer utilisable.** Petit, ingrat, et bloquant pour tout le reste.
Remise en état de la construction (voir §7), puis FR-41 (générer un code d'invitation), FR-42 (écran profil et membres), FR-3 (réparer le décochage), FR-4 (résoudre le rayon d'un ajout manuel), FR-9 (groupe « À classer »), FR-15 (exposer la collation), NFR-3 (l'écran du menu ne doit plus imposer de défilement horizontal).
> Aujourd'hui, aucun bouton n'appelle la fonction d'invitation : **le mode « rejoindre un foyer » est inutilisable, donc le produit n'a physiquement qu'un seul utilisateur possible.** Tant que ce lot n'est pas fait, « partagé avec ma conjointe » est une intention, pas une propriété.

**Lot 1 — Le socle.** Le plus coûteux, le moins visible, et celui qui débloque tout.
NFR-1 et NFR-2 (hors-ligne et convergence), FR-19, FR-20, FR-22, FR-23 (l'API comme contrat), FR-5 (agrégation partout, pas seulement à la génération), FR-10 (propagation), FR-7 (provenance), FR-17 (génération non destructrice).
> À la fin de ce lot, l'utilisateur ne voit *aucune fonctionnalité nouvelle* — juste une liste qui ne le lâche plus au supermarché. C'est le lot le plus ingrat et le plus important : toutes les autres surfaces s'y branchent.

**Lot 2 — Le dashboard maison.**
FR-24 à FR-28, FR-44 (menu du jour), FR-21 et NFR-6 (identité d'appareil — c'est ici qu'elle est vraiment exigée).

**Lot 3 — Les surfaces mobiles et le pont Google.**
FR-33 (cible de partage), FR-35 (installation), FR-46 (dictée + partage) — peu coûteux, à condition que le hors-ligne du lot 1 soit fait.
FR-29, FR-31, FR-32 et FR-47 à FR-50 (le pont Google), plus NFR-12.
> Le pont est le seul élément du PRD dont on sait d'avance qu'il finira par casser. Il arrive après le socle pour deux raisons : il consomme l'API du lot 1, et il ne doit jamais être ce qui tient le produit debout. **Test simple avant de le construire : si ce lot n'existait pas, le produit serait-il quand même utilisable au quotidien ? La réponse doit rester oui.**

**Lot 4 — Le pilotage conversationnel.**
FR-36 à FR-39.
> Ce lot vaut plus cher qu'il n'en avait l'air : un serveur MCP sert Claude, mais aussi tout autre assistant compatible MCP. C'est le seul chemin par lequel un assistant grand public pourra un jour toucher la liste — il mérite d'être remonté si tu veux ré-ouvrir la question de la voix assistant.

**En continu, hors lots** — le classement par rayon (FR-11 à FR-14) et les recettes (FR-18, FR-51) s'améliorent au fil de l'usage réel. FR-14, la boucle d'apprentissage, gagne à arriver tôt : plus elle est en service longtemps, plus la liste est juste.

**Acquis, à ne pas régresser** — FR-1, FR-2, FR-6, FR-8, FR-16, FR-40, FR-43 fonctionnent déjà. Ils n'appartiennent à aucun lot mais doivent survivre à tous : la remise en état du lot 0 et le passage au hors-ligne du lot 1 sont les deux moments où ils risquent de casser.

**Dette de conformité, à traiter quand elle devient réelle** — NFR-7 (export et suppression des données) n'est appelée par aucun lot. Sur un foyer de deux personnes qui se font confiance, c'est défendable. À reprendre le jour où le produit sort de la famille — ce que la v1 exclut explicitement.

## 10. Horizon

Hors v1, mais les décisions v1 ne doivent pas fermer ces portes :

- **v2 — Les objectifs nutritionnels** : objectifs macros et restrictions par membre, individuels dans un foyer partagé. Reportés en v1 faute de consommateur ; la base les modélise déjà, ne pas la démonter.
- **v2 — Catalogue Open Food Facts** : recherche par nom et code-barres, Nutri-Score, données nutritionnelles.
- **v2 — Macros automatiques** : calcul des macros d'une recette par sommation des ingrédients.
- **v2 — Génération IA** : recettes et menu hebdomadaire adaptés aux objectifs de chacun. C'est ce qui donne enfin un sens aux objectifs nutritionnels.
- **Scan de code-barres** depuis le téléphone.
- **Profil enfant** — portions et allergies.
- **La vraie voix Siri** — « Dis Siri, ajoute de l'huile d'olive », application fermée. Possible à tout moment au prix d'un wrapper natif publié (~1-2 semaines, 99 $/an, revue App Store, releases à perpétuité) : c'est un arbitrage de coût, pas un blocage technique. À financer seulement si l'usage vocal se révèle être un moteur de rétention.
- **Un chemin Google officiel et durable**, qui rendrait le pont de FR-31 inutile. **Conditions** : ouverture générale d'*AppFunctions* hors accès anticipé, ou réouverture des intégrations tierces de Gemini au-delà des partenaires. Le programme « fournisseur de liste tiers », lui, est fermé depuis juin 2023 — c'est par là que Bring! et AnyList sont branchés, et la porte ne s'est pas rouverte depuis.
- **Un chemin vocal indépendant de tout tiers** — aujourd'hui il n'en existe aucun (FR-45 retirée), et c'est la seule dépendance externe du produit. À rouvrir si le pont Google se révèle trop instable à l'usage.
- **Miroir bidirectionnel avec la liste Google**, qui rendrait fiable la lecture native (« Ok Google, qu'est-ce qu'il y a sur ma liste ? ») et ressusciterait FR-30. Écarté en v1 pour ne pas doubler la taille du composant le plus fragile.

Hors PRD par décision explicite : tout ce qui touche au funnel Le Cadre. Conservé dans `addendum.md`.

## 11. Questions ouvertes

**Tranchées le 2026-07-22** : objectifs nutritionnels → v2 · dashboard maison → surface de premier plan · hors-ligne → critique, iPhone 15 Pro · enfant → non modélisé · ordre d'arrivée → §9 · menu du jour sur le dashboard → FR-44 · pas de voix sur le dashboard → FR-45 retirée, et FR-30 avec elle · aucune app native, aucun store → NFR-11 (FR-34 retirée) · **« Ok Google, ajoute des poivrons à la liste de courses » → maintenu, via un pont non officiel assumé** (FR-31 réhabilitée, FR-47 à FR-50 et NFR-12 créées).

**Restent ouvertes :**

1. **Comment le dashboard s'authentifie-t-il** (FR-28) ? Un jeton d'appareil rattaché au foyer semble la réponse, mais ça introduit une notion d'identité non-humaine qui n'existe nulle part aujourd'hui. — *bloquant pour l'architecture*
2. **Trois points à tester avant de construire le pont**, que l'étude n'a pas pu vérifier depuis la documentation : le nom exact de la note créée en français par *ton* enceinte, le comportement de la bibliothèque sur une note *partagée*, et la survie des identifiants sur plusieurs semaines depuis une IP de serveur.
3. **Un utilisateur appartient à un foyer à vie** dans le modèle actuel. Acceptable, ou faut-il pouvoir quitter/changer de foyer ?
4. **Le hors-ligne s'applique-t-il aux recettes et au menu**, ou uniquement à la liste de courses ? Le PRD ne l'exige que pour la liste — c'est le choix le moins coûteux, et probablement le bon.
