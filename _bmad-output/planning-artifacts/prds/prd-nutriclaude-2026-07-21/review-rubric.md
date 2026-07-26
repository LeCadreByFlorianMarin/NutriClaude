# PRD Quality Review — NutriClaude v1 : la liste de courses, partout

## Verdict global

Ce PRD est franc, décidé et bien calibré pour son enjeu : il a une thèse (« la liste de courses est le produit »), une métrique unique qui peut l'invalider (rétention à 8 semaines), des non-objectifs qui coûtent quelque chose, et des retraits d'exigence documentés avec leurs conséquences assumées — c'est rare et c'est ce qui tient le document debout. Le risque est concentré dans un seul endroit : **la grappe vocale**, où plusieurs strates de révision se sont sédimentées sans être nettoyées (UJ-3 raconte encore un parcours Siri explicitement hors périmètre, l'intro du §5.F désigne toujours FR-45 retirée comme le chemin vocal, NFR-4 exige « quelques secondes » là où le pont retenu tourne à ~60 s). Second risque, moins visible : le §9 laisse orphelins plusieurs écarts pourtant identifiés au §7 (NFR-3, NFR-7, FR-9, la collation de FR-15), donc le plan de lots ne couvre pas ce que le PRD lui-même déclare cassé.

---

## Decision-readiness — strong

Les décisions sont posées comme des décisions, pas comme des « pistes ». NFR-11 (« Aucun binaire natif, aucun store en v1 ») nomme explicitement ce qu'on renonce à acheter — « un compte développeur payant, une revue externe, et des cycles de release à perpétuité » — et va jusqu'à énoncer la règle de conséquence : « Toute exigence qui impose implicitement une app native est à réécrire, pas à financer. » C'est du cadrage exécutable.

Le traitement du pont Google est le meilleur passage du document sur cette dimension. Le §2 assume à voix haute que « ce pont cassera un jour », FR-45 énonce la contrepartie sans l'adoucir (« le foyer n'a plus aucun chemin vocal indépendant d'un tiers »), et le Lot 3 pose un test de renoncement — « si ce lot n'existait pas, le produit serait-il quand même utilisable au quotidien ? La réponse doit rester oui. » Un lecteur qui voudrait objecter « tu construis sur du sable » trouve son objection déjà formulée et bornée.

Les questions du §11 sont réellement ouvertes (l'authentification du dashboard est marquée « *bloquant pour l'architecture* », et la Q4 sur le périmètre du hors-ligne penche sans trancher). Le §10 refuse la facilité en chiffrant l'option Siri (« ~1-2 semaines, 99 $/an ») au lieu de la déclarer impossible.

Réserve unique : le §11 annonce un arbitrage — « pas de voix sur le dashboard → FR-45 retirée » — dont les traces contradictoires subsistent ailleurs dans le document (voir Done-ness). L'arbitrage est bon ; sa propagation est incomplète.

---

## Substance over theater — strong

Pas de théâtre de persona : §3 tient en cinq lignes, deux personnes réelles, et l'une des deux porte un critère d'acceptation opérationnel — « **Elle ne configurera jamais rien.** Si une capacité exige de comprendre l'outil, elle a échoué. » Ce n'est pas décoratif : ça se retrouve en FR-14 (mémoriser la correction au lieu de « configurer »), en NFR-9 (« jamais de synchronisation, de jeton ou d'API »), et dans la métrique d'appui « Adoption par la conjointe ».

Les NFR ne sont pas du boilerplate. NFR-1 nomme un appareil de référence (iPhone 15 Pro) et un contexte d'échec (« Une liste qui échoue en magasin n'a aucune valeur »). NFR-10 (coût de possession) énonce une règle de suppression, pas un vœu. NFR-2 précise ce qui *n'est pas* un conflit — « Cocher un article déjà coché ailleurs n'est pas une erreur » — ce qui est exactement le niveau de détail qu'un ingénieur peut tester.

Aucune revendication d'innovation gratuite : le §1 assume un benchmark négatif (« elles ne tiennent jamais plus de deux semaines ») plutôt qu'une différenciation inventée.

### Findings
- **low** Le §2 introduit le tri par rayon comme une des « trois propriétés que les autres n'ont pas » (§2) — or Bring! et AnyList, cités dans l'addendum §5, font tous deux du tri par rayon. La singularité réelle est le *parcours physique du magasin propre au foyer* + la boucle d'apprentissage FR-14, pas le tri en soi. *Fix :* reformuler la puce en « triée selon le parcours réel de *mon* magasin, et qui apprend de mes corrections ».

---

## Strategic coherence — strong

Le PRD a une phrase-pivot et s'y tient : « Toute décision produit se tranche en demandant *est-ce que ça améliore la liste ?* » (§2). Le §9 en est le corollaire honnête : le Lot 1 est décrit comme « le lot le plus ingrat et le plus important », et le PRD accepte qu'« à la fin de ce lot, l'utilisateur ne voit *aucune fonctionnalité nouvelle* ». C'est l'inverse d'un backlog trié par facilité.

Les non-objectifs servent la thèse au lieu de la contredire : reporter les macros et l'IA en v2 « faute de consommateur » est cohérent avec un produit dont la valeur est la fiabilité, pas la richesse fonctionnelle. Le paragraphe encadré du §2 (« La v1 assume d'être un outil de courses, pas un outil de nutrition ») ferme la porte au dérapage de périmètre le plus probable, celui que le nom du produit invite.

Les contre-métriques du §8 sont réelles et bien choisies : « Le temps passé à entretenir l'outil », « Le groupe "À classer" », « Les divergences entre surfaces » — cette dernière nomme le prix exact de la décision structurante à cinq surfaces (« la synchronisation coûte sa propre classe de bugs »). Peu de PRD nomment le coût de leur propre pari.

---

## Done-ness clarity — thin

C'est la dimension faible, et l'écart avec les autres est net. Le socle est bon : la plupart des FR portent une conséquence testable (FR-5 « additionne les quantités au lieu de créer un doublon », FR-17 « n'écrase pas les articles ajoutés à la main », NFR-3 « Aucun écran de la liste n'exige de défilement horizontal », FR-47 « un article dicté une fois n'apparaît qu'une fois »). Les FR sont aussi majoritairement au bon niveau — capacité, pas implémentation : FR-22 dit « sans avoir à interroger l'interface en boucle » sans nommer de technologie, FR-3 décrit deux états et une bascule sans dire comment.

Mais la grappe vocale est incohérente avec elle-même, et un ingénieur ne peut pas en dériver un « fini ». UJ-3 — l'un des quatre parcours censés « porter tout le reste du PRD » (§4) — met en scène « *Dis Siri, ajoute de l'huile d'olive à la liste* », capacité que NFR-11 interdit, que le §10 classe hors v1 (« La vraie voix Siri »), et que FR-29 ne liste pas parmi ses deux mécanismes. Le même paragraphe promet que l'article « apparaît sur l'écran de la cuisine dans la seconde », alors que le seul chemin retenu est un pont à récupération périodique (addendum §5 : « ~60 s est raisonnable »). NFR-4 hérite du problème en exigeant « une confirmation en quelques secondes » sur un chemin où NutriClaude n'a ni la reconnaissance vocale ni le canal de retour — la confirmation vient de Google, sur sa propre liste.

Ailleurs, deux formulations échappent au test : FR-13 fait dépendre tout le classement de la règle « dont le mot-clé est le plus spécifique » sans définir *spécifique* (plus longue chaîne ? plus de tokens ? priorité explicite ?) — c'est le cœur de la boucle FR-14 et il n'est pas déterministe tel qu'écrit. FR-24 demande une liste « **lisible à distance** » alors que UJ-2 possède la borne (« lisible d'un mètre ») : la borne est du bon côté du document, mais pas dans l'exigence.

Enfin, une ambiguïté de propriété : le §5.E affirme « NutriClaude ne la construit pas ; il garantit qu'elle peut exister », puis énonce FR-24 à FR-28 comme des exigences sur le comportement du dashboard, et le §9 programme un « Lot 2 — Le dashboard maison ». Soit ces FR sont des exigences sur l'API (et il faut les réécrire côté contrat), soit le dashboard est dans le périmètre (et la note du §5.E est fausse).

### Findings
- **critical** UJ-3 repose sur une capacité retirée (§4, UJ-3) — « *Dis Siri, ajoute de l'huile d'olive à la liste* » contredit NFR-11, le §10 (« La vraie voix Siri » = hors v1) et FR-29. Le parcours vocal principal du PRD décrit donc un produit qu'on ne construit pas. *Fix :* réécrire UJ-3 sur « Ok Google » (enceinte), et remplacer « dans la seconde » par une latence compatible avec le pont ; ou conserver Siri en le marquant explicitement `[HORS v1 — illustratif]`.
- **critical** NFR-4 est insatisfaisable sur le seul chemin vocal retenu (§6, NFR-4) — « Un ajout vocal aboutit à une confirmation en quelques secondes » contre l'addendum §5 (« Latence dictée par la fréquence de récupération ; ~60 s est raisonnable ») ; et la confirmation entendue par l'utilisateur est celle de Google, pas de NutriClaude. *Fix :* scinder — (a) confirmation vocale immédiate = assurée par Google, hors périmètre ; (b) apparition dans la liste NutriClaude ≤ 90 s ; (c) la dictée-partage FR-46 reste, elle, en quelques secondes.
- **high** L'en-tête v0.2 est périmé sur la voix (§ frontmatter, ligne « v0.2 ») — « voix étendue à Siri **et** Google » ne survit pas à la réécriture du §5.F, qui exclut tout chemin Siri. C'est la première phrase que lira un relecteur. *Fix :* remplacer par « voix limitée à l'assistant Google, via un pont non officiel assumé ».
- **high** L'intro du §5.F cite une exigence retirée comme chemin actif (§5.F, chapeau) — « La voix passe donc par **nos propres surfaces** (FR-45, FR-46) », alors que FR-45 est retirée douze lignes plus bas, et que le PRD affirme ailleurs qu'« il n'existe aucun chemin vocal de repli » (§2). *Fix :* « passe par la dictée système sur téléphone (FR-46) et, dans la maison, par le pont Google (FR-31) ».
- **high** Le §10 fait vivre FR-45 au présent (§10, « Mot de réveil sur le dashboard ») — « FR-45 se limite à une écoute déclenchée par un geste » décrit une exigence qui n'existe plus ; l'entrée d'horizon présuppose donc une base qui n'est pas construite. *Fix :* reformuler en « une écoute sur le dashboard (FR-45, retirée en v1) reste possible en v2 ; le mot de réveil en serait l'étape suivante », ou supprimer l'entrée.
- **high** Propriété du dashboard contradictoire (§5.E vs §9 Lot 2) — « NutriClaude ne la construit pas » cohabite avec cinq FR décrivant son comportement et un lot dédié à sa livraison. *Fix :* trancher explicitement ; si le dashboard est hors périmètre, réécrire FR-24 à FR-27 en exigences sur l'API (« l'interface expose de quoi afficher… ») et renommer le Lot 2 « Ce que l'API doit offrir au dashboard ».
- **medium** FR-13 n'est pas déterministe (§5.B, FR-13) — « la règle dont le mot-clé est le plus spécifique » n'a pas de définition ; deux implémentations raisonnables classeront « filet de poulet » différemment. *Fix :* définir (ex. « le mot-clé le plus long contenu dans le nom ; à longueur égale, la règle la plus récente »).
- **medium** FR-24 sans borne, alors que la borne existe (§5.E, FR-24 vs §4 UJ-2) — « lisible à distance » est un adjectif ; « lisible d'un mètre » est un test. *Fix :* rapatrier « à un mètre » dans FR-24.
- **medium** Le hors-ligne n'est borné que pour iPhone (§6, NFR-1 vs §5.G, FR-35) — NFR-1 fixe « Appareil de référence : iPhone 15 Pro » tandis que FR-35 exige une installation « sur iPhone **et** sur Android » fonctionnant hors ligne. Le niveau d'exigence Android est indéterminé. *Fix :* une phrase — « Android est supporté au même niveau fonctionnel, sans appareil de référence ni engagement de performance ».

---

## Scope honesty — strong

C'est le point le plus solide du document après la cohérence stratégique. Les non-objectifs du §2 ne sont pas une liste de politesse : chacun explique *pourquoi* il est écarté et ce qui reste en base (« Les colonnes existent, elles resteront `NULL` »), ce qui évite précisément le malentendu qu'un schéma pré-modélisé provoque. L'encadré « autant le dire franchement plutôt que de laisser traîner des champs vides qui font croire le contraire » est du désamorçage actif.

Les retraits sont traités comme des événements produit, pas comme des suppressions. FR-30, FR-34 et FR-45 restent en place, barrés, datés, motivés, avec la mention « L'identifiant n'est pas réattribué » — excellent pour la traçabilité aval. FR-45 va plus loin et énonce le prix (« le jour où le pont casse, l'ajout par la parole s'arrête jusqu'à réparation »). FR-50 fait la même chose pour une conséquence facile à oublier : « la lecture native […] n'est pas fiable et ne doit pas être utilisée. »

La densité d'items ouverts est adaptée à l'enjeu : quatre questions ouvertes, trois `[HYPOTHÈSE]`, tous à des endroits réels (les profils utilisateurs, les parcours, le RGPD). Pour un outil familial, c'est le bon dosage.

### Findings
- **medium** Pas d'index des hypothèses (§ tout le document) — trois `[HYPOTHÈSE]` inline (§3, §4, NFR-7) sans récapitulatif ; celle du §4 porte pourtant sur les parcours, « ce sont eux qui portent tout le reste du PRD ». *Fix :* trois lignes en fin de §11, « Hypothèses à confirmer », avec renvoi vers chaque emplacement.

---

## Downstream usability — thin

Ce PRD est un chain-top : il alimente une architecture (l'addendum §5 lui est explicitement destiné) et un découpage en stories. La dimension compte donc, et c'est là que les cycles de révision successifs ont laissé le plus de dette.

**Le §9 ne couvre pas ce que le §7 déclare cassé.** Le §7 identifie « Mobile | Grille du menu à défilement horizontal forcé | NFR-3 », « Suppression de compte / export | Inexistant | NFR-7 » et « Repas "collation" | En base, absent de l'écran | FR-15 » — aucun de ces trois écarts n'apparaît dans un lot, ni dans le « En continu ». FR-9 (le groupe « À classer ») n'est ni dans le §7 ni dans un lot, alors que le §8 en fait une contre-métrique : on surveille un groupe dont rien ne planifie la construction. FR-4 est dans le même cas. À l'inverse, FR-21 est affecté deux fois (Lot 1 via « FR-19 à FR-23 », puis Lot 2 explicitement).

**Le §7 s'est désynchronisé du jeu d'exigences.** La table ne mentionne ni FR-4, ni FR-9, ni FR-13, ni FR-32, ni FR-40, ni FR-43, ni FR-44, ni FR-50 — dont plusieurs sont des capacités nouvelles (FR-44 « repas planifiés du jour » sur le dashboard, FR-50 le sens unique du pont) qu'un lecteur croira couvertes par les plages « FR-24 à FR-28 » et « FR-47 à FR-49 ». La table reste juste sur ce qu'elle affirme ; elle n'est plus exhaustive sur ce qu'elle laisse croire.

**L'addendum n'a pas suivi les renumérotations.** Son §1 écrit « C'est exactement la surface visée par FR-24 du PRD » à propos de la tension MCP / `SUPABASE_SERVICE_KEY` — or c'est FR-39 aujourd'hui (le PRD le dit lui-même, §5.H), et FR-24 est devenu l'affichage du dashboard. Son §5 conclut encore « la voix ne passe par aucun assistant. Elle passe par le dashboard maison, qui est notre propre surface (FR-45) », conclusion invalidée deux sections plus bas par l'étude Keep. Un architecte lisant l'addendum en premier partira dans la mauvaise direction.

Pas de glossaire, enfin, alors que le vocabulaire est le vrai actif de ce PRD : *foyer*, *rayon*, *parcours*, *surface*, *pont*, *article*, *membre*. Les termes sont employés de façon remarquablement stable dans le corps du texte — mais une seule surface porte trois noms (« dashboard maison », « écran de la cuisine », « écran mural » en §5.E), et « liste » désigne selon les endroits la liste NutriClaude ou la liste Google.

### Findings
- **high** Exigences orphelines du §9 (§9 vs §7) — NFR-3, NFR-7, FR-9, FR-15 (collation) et FR-4 ne sont dans aucun lot alors que trois d'entre eux sont listés comme écarts au §7. Un découpage en stories issu du §9 les perdra silencieusement. *Fix :* ajouter NFR-7 et la collation au Lot 0 (petits, isolés), NFR-3 au Lot 1, FR-9 et FR-4 au Lot 1 (ils appartiennent au comportement de la liste).
- **medium** Le §7 n'est plus exhaustif après révisions (§7, table) — FR-4, FR-9, FR-13, FR-32, FR-40, FR-43, FR-44 et FR-50 absents ; les plages « FR-24 à FR-28 » et « FR-47 à FR-49 » laissent penser à une couverture complète. *Fix :* ajouter une ligne « Menu du jour sur le dashboard | Inexistant | FR-44 », une ligne « Groupe "À classer" | Inexistant | FR-9 », et compléter la ligne pont en « FR-47 à FR-50 ».
- **medium** Références FR périmées dans l'addendum (`addendum.md` §1, « Tensions non résolues ») — « la surface visée par FR-24 du PRD » vise en réalité FR-39. *Fix :* corriger en FR-39 et renvoyer vers l'encadré du §5.H.
- **medium** L'addendum §5 conclut sur un scénario abandonné (`addendum.md` §5, « Conséquence produit ») — « Elle passe par le dashboard maison […] (FR-45) » et le titre « a conduit au retrait de FR-31 et FR-34 » précèdent la réhabilitation de FR-31 sans être marqués comme dépassés. *Fix :* préfixer la section d'un bandeau « ⚠️ Conclusions révisées par la seconde étude ci-dessous » et corriger le titre en « retrait de FR-34 ; retrait puis réhabilitation de FR-31 ».
- **medium** Pas de glossaire (§ absent) — pour un PRD qui alimente architecture et stories et dont *rayon*, *foyer*, *surface*, *pont* sont des termes contractuels. *Fix :* six à huit entrées en fin de document ; y figer notamment « liste Google » vs « liste NutriClaude ».
- **low** FR-21 affecté à deux lots (§9, Lot 1 « FR-19 à FR-23 » et Lot 2 « FR-21 et NFR-6 ») — ambiguïté sur le moment où l'identité d'appareil doit exister. *Fix :* laisser FR-21 au Lot 2 et écrire « FR-19, FR-20, FR-22, FR-23 » au Lot 1.
- **low** Une surface, trois noms (§2, §4 UJ-2, §5.E) — « dashboard maison » / « écran de la cuisine » / « écran mural ». *Fix :* retenir « dashboard maison » comme terme du glossaire, les autres en usage narratif seulement.
- **low** UJ-2 n'a pas de protagoniste nommé (§4, UJ-2) — « On voit ce qu'il reste à acheter », alors que UJ-1, UJ-3 et UJ-4 en ont un. Le dashboard étant justement la surface sans utilisateur courant (FR-28), c'est peut-être intentionnel — mais ce n'est pas dit. *Fix :* une incise (« le dashboard n'a pas de protagoniste : c'est le propos »).

---

## Shape fit — strong

La forme correspond à l'objet. Cinq pages pour un outil à deux utilisateurs, personas remplacés par deux prénoms, aucune cérémonie inutile : c'est le bon dosage, et l'alléger davantage coûterait de l'information. Les UJ sont ici load-bearing malgré la petite taille du foyer, parce que le produit est fait de cinq surfaces contextuelles — UJ-1 (le hors-ligne au supermarché) fait un travail qu'aucune FR ne ferait seule, en montrant *pourquoi* NFR-1 est critique.

Le PRD est aussi correctement traité comme brownfield : le §7 est une vraie table d'écart, avec des constats vérifiables (« case codée en dur », « tout est `force-dynamic` ») et non des généralités, et il isole les deux écarts structurants au lieu de tout mettre au même niveau. La séparation PRD / addendum est bien tenue : les décisions techniques, les chemins écartés et la stratégie commerciale sont hors du PRD sans être perdus.

Une nuance sur les FR du pont (FR-47, FR-50, et NFR-12 « identifiants stockés chiffrés ») : ce sont des contraintes d'architecture rédigées comme des exigences fonctionnelles — « marque les articles traités du côté Google, sans les supprimer », « ne circule que dans un sens ». C'est défendable ici (ces mécaniques *sont* la décision produit, et FR-50 nomme une conséquence utilisateur), mais elles ne se testent pas au même endroit que FR-1 à FR-18.

### Findings
- **low** Contraintes d'architecture rédigées en FR (§5.F, FR-47 / FR-50 ; §6, NFR-12) — utile de les distinguer des capacités pour éviter qu'une story « implémenter FR-47 » ne parte à côté. *Fix :* un chapeau « Contraintes du pont (à traiter en architecture) » avant FR-47.

---

## Métriques de succès — mesurabilité réelle

Point demandé spécifiquement, traité ici plutôt que dispersé. Quatre des cinq métriques du §8 sont observables par un foyer de deux personnes sans aucune instrumentation, ce qui est le bon réflexe : « Rétention à 8 semaines » (on l'utilise ou non), « Adoption par la conjointe », « Zéro échec en magasin », « Le dimanche soir […] quelques minutes ». Elles se constatent, elles ne se calculent pas — c'est adapté.

Deux ne se constatent pas. « **Justesse du classement** — la proportion d'articles atterrissant dans le bon rayon du premier coup augmente semaine après semaine » suppose de compter les corrections dans le temps ; FR-14 les capture (elles deviennent des règles) mais aucune exigence n'expose ce compteur. Même chose pour la contre-métrique « Les corrections après coup » (articles ajoutés puis supprimés, quantités rectifiées), qui suppose un historique que rien n'exige de conserver. À l'inverse, « **Répartition par surface** » est la seule métrique nativement instrumentée : FR-7 impose de conserver « la surface par laquelle il est arrivé » — mais aucune exigence n'en prévoit la lecture.

### Findings
- **high** Deux métriques et une contre-métrique ne sont dérivables d'aucune exigence (§8) — « Justesse du classement », « Les corrections après coup », et la lecture de « Répartition par surface ». Sans donnée, elles ne seront jamais évaluées et la boucle FR-14 restera invérifiable. *Fix :* soit ajouter une FR minimale (« un écran d'administration affiche, sur les 4 dernières semaines : nombre d'articles ajoutés par surface, nombre de corrections de rayon, taille du groupe "À classer" » — c'est une requête, pas une stack d'analytics), soit requalifier ces trois métriques en « impressions à valider en rétrospective » et l'assumer.
- **low** « Le dimanche soir […] de l'ordre de quelques minutes » (§8) est la seule métrique d'appui sans seuil, là où UJ-4 en donne un (« Le dimanche soir a duré quatre minutes »). *Fix :* reprendre « moins de dix minutes » dans le §8.

---

## Notes mécaniques

- **Continuité des identifiants** — FR-1 à FR-50 : aucun trou, aucun doublon, les trois retraits (FR-30, FR-34, FR-45) conservés en place avec mention « L'identifiant n'est pas réattribué ». Excellent. Les ajouts tardifs (FR-44, FR-46 à FR-50) sont insérés hors ordre numérique dans leurs sections logiques, ce que le frontmatter annonce — cohérent, mais rend la lecture séquentielle du §5.F sautillante (FR-29, 30, 31, 47, 48, 49, 50, 32, 45, 46).
- **Ordre des NFR** — le §6 énumère NFR-1 à NFR-9, puis **NFR-12, NFR-11, NFR-10**. Inversion sans motif apparent. *Fix :* réordonner, ou expliquer si l'ordre est intentionnel (importance décroissante ?).
- **Commentaire de numérotation dans le corps d'une exigence** — FR-44 : « *(Ajouté après FR-43 pour préserver la numérotation ; sa place logique est ici.)* ». Méta-information qui n'a pas sa place dans le texte de l'exigence ; à déplacer en note de bas de section.
- **Références croisées non résolues** — FR-45 cité comme actif en §5.F (chapeau) et §10 ; « FR-24 » dans `addendum.md` §1 pointant vers ce qui est aujourd'hui FR-39. Détaillées ci-dessus.
- **Index des hypothèses** — absent ; trois `[HYPOTHÈSE]` inline (§3, §4, NFR-7).
- **Cohérence des dates** — le frontmatter indique `created: 2026-07-22` alors que le dossier est daté `2026-07-21`. Sans conséquence, mais à aligner si le nom de dossier sert de référence.
- **Sections attendues pour cet enjeu** — toutes présentes (problème, périmètre, non-objectifs, utilisateurs, parcours, FR, NFR, écart brownfield, métriques, phasage, horizon, questions ouvertes). Rien à ajouter ; le glossaire est la seule omission qui coûte quelque chose en aval.
