# Réconciliation — `architecture-nutriclaude.html` (v2.0) → `prd.md` + `addendum.md`

Date : 2026-07-22 · Source : « DOCUMENT D'ARCHITECTURE v2.0 — NutriClaude », avril 2026, Florian Marin.

Méthode : extraction du texte intégral de la source (25 600 caractères après dépouillement du HTML), puis
comparaison item par item avec le PRD v0.2 et l'addendum. Le rétrécissement volontaire du périmètre
(outil perso/famille, funnel Le Cadre / Open Food Facts / macros / génération IA différés) n'est pas
compté comme une perte : il est vérifié séparément en §3.

---

## 1. Ce qui a été perdu

### 1.1 — L'interface iOS Shortcuts a disparu sans être ni exigée ni écartée · **impact fort**

La source consacre une section entière (`📱 iOS Shortcuts`) à ce qui est, chez elle, **le** mode
d'interaction quotidien :

> « L'interface se fait via des iOS Shortcuts et via Claude en conversation (MCP). »
> « Quatre Shortcuts couvrent les interactions quotidiennes. Chacun est un workflow Shortcuts qui fait
> des appels HTTP à l'API REST Supabase. »

Elle décrit aussi leur modèle d'authentification, qui n'existe nulle part ailleurs :

> « Chaque Shortcut stocke un token API (Supabase anon key + JWT utilisateur) dans un dictionnaire
> Shortcuts persistant. Le JWT est obtenu une seule fois via un Shortcut "Login" qui fait un appel
> POST `/auth/v1/magiclink`. »

Dans les documents dérivés, cette matière n'est **ni reprise, ni listée en non-objectif, ni conservée en
addendum**. Elle s'est évaporée entre deux raisonnements distincts :

- l'étude de faisabilité vocale (addendum §5) conclut que **Siri** est hors d'atteinte d'une PWA
  (« App Intents […] une PWA n'y a aucun accès ») ;
- NFR-11 interdit tout **binaire natif publié sur un store**.

Or aucune de ces deux conclusions ne touche les Shortcuts : l'app Raccourcis est préinstallée, ne
demande aucun compte développeur, aucune publication, aucun binaire — c'est un client HTTP scriptable.
Le glissement se lit noir sur blanc dans l'addendum : « Le doc d'origine misait toute son interface sur
les iOS Shortcuts. L'étude conclut que **cette hypothèse fondatrice n'est plus tenable pour une
application web** » — alors que l'étude ne portait que sur les *capacités Siri*, pas sur les Shortcuts
comme appelant d'API.

Trois conséquences concrètes :

1. **NFR-6 est orphelin.** Il dit : « Les identités d'appareil (**dashboard, raccourcis**) ont un
   périmètre restreint […] révocables une par une. » L'addendum §5 aussi : « les raccourcis vocaux
   rejouent un jeton indéfiniment ». Aucune FR ne définit ce que sont ces « raccourcis ». Une exigence
   non fonctionnelle protège une surface qui n'est plus au périmètre.
2. **La proposition « aucun chemin vocal indépendant d'un tiers » n'est pas démontrée.** FR-45 assume :
   « le foyer n'a plus aucun chemin vocal indépendant d'un tiers ». Un raccourci nommé, déclenché par
   « Dis Siri, <nom du raccourci> », avec une action *Demander une entrée* en dictée puis
   *Obtenir le contenu de l'URL*, est exactement le repli que FR-48/FR-49 réclament et que le PRD
   déclare inexistant. Le chemin n'a jamais été instruit — c'est une lacune d'analyse, pas une décision.
3. **Le modèle de jeton persistant côté client** (jeton stocké dans un dictionnaire, obtenu une fois via
   un raccourci « Login ») est justement le patron dont FR-21/FR-28/NFR-6 cherchent l'équivalent pour le
   dashboard mural. Il aurait dû atterrir dans l'addendum §1 avec les autres décisions techniques.

**À faire** : soit une FR « raccourcis iOS/Android comme client de l'API », soit une ligne explicite en
§2 « Non-objectifs » — mais pas le silence actuel, qui laisse NFR-6 sans objet.

### 1.2 — Tags et recherche de recettes · **impact moyen-fort**

La source modélise et expose la sélection de recettes :

> `tags text[]` , -- {'rapide', 'batch-cooking', 'végé'}
> `list_recipes` — « Liste les recettes du foyer, filtrables par tag » — paramètres :
> `household_id, tags?, search?`

FR-18 énumère les attributs d'une recette (« titre, portions, temps, instructions consultables en
lecture, et une liste d'ingrédients ») : **ni tags, ni recherche, ni filtrage**. FR-37 permet de
« consulter et créer des recettes » en conversation, sans axe de sélection. L'addendum ne cite
`list_recipes` que comme nom d'outil MCP, sans son contrat.

Pourquoi ça coûte : le parcours UJ-4 (« le dimanche soir désamorcé ») repose sur « il assigne les
recettes du répertoire aux cases du menu » avec un répertoire dimensionné par la source à
« 10-15 recettes » et destiné à grossir. `rapide` et `batch-cooking` sont précisément les critères par
lesquels on remplit une grille jour × repas — sans eux, l'assignation redevient un défilement. C'est
aussi la seule fonctionnalité de recette que la source jugeait assez importante pour lui dédier un tool
MCP paramétré.

### 1.3 — Le sans-mot-de-passe comme engagement produit, pas comme choix technique · **impact moyen**

Source :

> Authentification — Supabase Auth (Magic Link) — « **Pas de mot de passe.** Magic link par email =
> simple pour l'utilisateur. »

L'addendum le range en §1 « Choix de socle » et en §3 « alternatives rejetées » (« Le mot de passe —
rejeté au profit du magic link »), donc rien n'est perdu au sens strict. Mais le PRD, lui, ne dit
**rien** de la façon dont un membre s'authentifie — alors qu'il érige en test d'acceptation universel :

> « **Elle ne configurera jamais rien.** Si une capacité exige de comprendre l'outil, elle a échoué. »

Et que FR-28 et FR-32 formulent déjà des exigences de non-connexion pour le dashboard et la voix. Le
« pas de mot de passe » est de la même famille : c'est une propriété perçue par la conjointe, pas un
détail d'implémentation. Le rétrograder en décision d'archi le rend révocable par un architecte sans
que personne ne remarque que le test d'acceptation vient de bouger.

### 1.4 — Le vocabulaire d'unités et l'angle mort de la mise à l'échelle · **impact moyen**

Source, sur `recipe_ingredients` et `grocery_list_items` :

> `unit text` , -- 'g', 'ml', 'pièce', 'cs', 'cc'

Le PRD écrit FR-5 (« même nom, **même unité** → additionne les quantités ») et FR-16 (« quantités mises
à l'échelle selon les personnes prévues rapportées aux portions de la recette ») sans jamais fixer ce
vocabulaire ni traiter ce qu'il implique :

- `cs` / `cc` (cuillère à soupe / à café) et `pièce` **ne se mettent pas à l'échelle comme des grammes** :
  0,66 cuillère à café pour 1,5 personne, ou 1,5 œuf, est un résultat vrai et inutilisable ;
- deux recettes qui appellent « oignon » l'une en `pièce` et l'autre en `g` ne fusionneront pas sous
  FR-5, et produiront deux lignes pour le même achat — exactement le doublon que FR-5 existe pour
  supprimer, et exactement le genre de bavure que la contre-métrique « les corrections après coup »
  détectera sans en expliquer la cause.

Aucun des deux documents ne pose de règle d'arrondi, de conversion, ni de liste fermée d'unités. C'est
la seule règle métier chiffrable du PRD laissée sans garde-fou.

### 1.5 — Petits attributs porteurs de sens, tombés du modèle · **impact faible**

- `recipes.source text DEFAULT 'claude'` — `'claude' | 'manual' | 'import'`. La provenance d'une
  **recette** (saisie à la main / dictée par Claude / importée) est traçable dans la source. Le PRD ne
  garde la provenance que pour les **articles** (FR-7). En v2, quand la génération IA arrivera, savoir
  quelles recettes viennent de l'IA sera nécessaire — et rétroactivement impossible.
- `recipes.description` — absent de FR-18, qui ne retient que titre/portions/temps/instructions.
- `recipe_ingredients.sort_order` — l'ordre des ingrédients dans une recette. FR-18 liste les champs
  d'un ingrédient sans lui.
- `profiles.preferences jsonb` (« préférences libres ») — distinct des `restrictions`, non mentionné,
  y compris dans le renvoi v2 du §10 qui ne parle que d'objectifs macros et de restrictions.

---

## 2. Ce qui a été déformé

### 2.1 — UJ-3 met en scène « Dis Siri » que le PRD déclare hors v1 · **impact fort**

Parcours UJ-3, présenté comme nominal :

> « *« Dis Siri, ajoute de l'huile d'olive à la liste. »* Confirmation : l'huile est ajoutée, classée en
> Épicerie sèche. […] Aucune app n'a été ouverte. Le même geste fonctionne depuis un assistant Google. »

Le corps du même document dit l'inverse, trois fois :

- FR-29 : « Deux mécanismes le réalisent : **l'assistant Google** (FR-31) et **la dictée du système sur
  téléphone** (FR-46). » Siri n'y figure pas.
- FR-46 : la dictée « suivie d'un **partage vers NutriClaude** » — donc en ouvrant, précisément, une app.
- §10 Horizon : « **La vraie voix Siri** — "Dis Siri, ajoute de l'huile d'olive", application fermée »,
  classée hors v1, au prix d'un wrapper natif publié.

Le parcours cité en tête du PRD promet donc mot pour mot la capacité que l'horizon renvoie à plus tard.
C'est la partie du document que lisent en premier les lecteurs non techniques (et l'architecte au
moment de dimensionner) ; l'incohérence est reprise du vocabulaire de la source (« Dis Siri, recette
pour ce soir ») sans être réalignée sur la décision du 2026-07-22. Correctif minimal : réécrire UJ-3 en
« Ok Google » (cohérent avec FR-31), ou l'annoter comme cible d'horizon.

### 2.2 — La conclusion de la première étude vocale n'a jamais été réécrite · **impact fort**

Addendum §5, titre et paragraphe de clôture, tous deux périmés :

> « Étude de faisabilité vocale — 2026-07-22 (**a conduit au retrait de FR-31 et FR-34**) »
> « **Conséquence produit** : la voix ne passe par aucun assistant. Elle passe par le dashboard maison,
> qui est notre propre surface (**FR-45**), et par la dictée système + partage sur téléphone. »

Or, dans l'état final : **FR-31 a été réhabilitée** (« Réhabilitée le 2026-07-22 après seconde étude »)
et **FR-45 a été retirée** (« Exigence retirée le 2026-07-22 sur décision de Florian »). L'addendum
affirme donc, comme conclusion mise en gras, deux propositions que le PRD contredit — la sous-section
suivante (§5 « Seconde étude ») corrige les faits sans corriger cette conclusion. Un lecteur aval
(architecture, UX) qui s'arrête à la fin de la première étude construira la voix sur le dashboard,
c'est-à-dire la surface explicitement abandonnée.

Même famille, plus bénin : le titre de §5.1 parle du « retrait de FR-34 », qui est exact, mais le
mélange les deux retraits dans une même parenthèse devenue fausse pour moitié.

### 2.3 — Renvoi croisé périmé dans l'addendum : FR-24 pour FR-39 · **impact faible mais piégeur**

Addendum §1, « Tensions non résolues » :

> « **Le serveur MCP utilise `SUPABASE_SERVICE_KEY`**, ce qui contourne le RLS […] C'est exactement la
> surface visée par **FR-24** du PRD. »

Après la renumérotation annoncée en tête du PRD, **FR-24** est « le dashboard affiche la liste […]
lisible à distance ». L'exigence qui traite réellement de cette tension est **FR-39** (« Les actions
faites en conversation s'exercent dans le périmètre du foyer […] jamais au-delà »), assortie de la note
qui reprend la même analyse. Le renvoi envoie l'architecte sur la mauvaise surface pour la seule
tension de sécurité héritée de la source.

### 2.4 — Un fait de la source présenté comme une hypothèse · **impact faible**

PRD §3 :

> « `[HYPOTHÈSE]` Ces deux profils sont déduits du doc d'archi et du modèle de données, **pas de ton
> récit**. À confirmer. »

La source n'est pourtant pas allusive, elle l'affirme à trois endroits :

> « Le foyer est l'unité de partage. **Toi et ta femme appartenez au même foyer.** »
> « **Ta femme commence à utiliser le Shortcut "liste de courses".** »
> « 2 semaines d'utilisation quotidienne en conditions réelles **avec ta femme**. »

Marquer comme inférence à valider ce que la source pose en fait rouvre inutilement le seul point du PRD
qui n'a jamais bougé — et affaiblit par ricochet le test d'acceptation qui en dépend (« elle ne
configurera jamais rien »).

---

## 3. Ce qui a été correctement écarté

Vérifié : les exclusions délibérées ont bien atterri dans l'addendum, avec leur substance et leurs
verbatims, pas seulement leur intitulé.

| Matière écartée du PRD | Où elle vit | État |
|---|---|---|
| Funnel Le Cadre, escalier d'offres, prix, ICP « pères cadres tech 32-42 ans » | Addendum §2 | Intégral, avec le verbatim « Même personne, même douleur, deux angles complémentaires » et le jeu de mots *cadre* manager / *cadre* structure explicitement signalé à préserver |
| Séquence email 5 temps, E3 pivot, métriques de funnel (>25 %, >40 %, >50 %, >3 %, >20 %) | Addendum §2 | Intégral, tableau conservé |
| Parcours Endurance 12 semaines, livrables de reproductibilité, roadmap 4 phases | Addendum §2 | Intégral |
| Micro-SaaS 5-10 €/mois et sa règle de déclenchement | Addendum §3 | Conservé avec la règle « **Pas avant d'avoir le signal** » |
| Open Food Facts (API v2, cache-aside 30 jours, `off_data` brut, User-Agent, Nutri-Score) | Addendum §1 + PRD §2/§10 | Conservé côté technique **et** renvoyé en v2 côté produit |
| Macros auto, génération IA de recettes/menus, scan code-barres, profil enfant | PRD §2 (non-objectifs) et §10 (horizon) | Écarté explicitement, portes laissées ouvertes |
| « Supabase est un détail, pas l'architecture » | Addendum §1 | Cité en exergue et qualifié de « phrase la plus structurante du doc d'origine » — bon jugement |
| 4 bounded contexts, 9 tools MCP, 5 Edge Functions, double mapping rayon, vue `grocery_list_by_aisle` | Addendum §1 | Nommés un par un |
| Matière qualitative (ton, registre, frugalité, dogfooding, « sans y penser ») | Addendum §4 | La section la plus fidèle des deux documents |

Deux réserves mineures sur cette colonne :

- L'addendum §6 range « objectifs de performance ou de volumétrie chiffrés » parmi les sujets **non
  traités** par la source, alors que celle-ci donne au moins un ordre de grandeur exploitable
  (« un répertoire de 10-15 recettes », « 3M+ produits », cache 30 jours) — repris ailleurs en §2, donc
  non perdu, mais la §6 est trop absolue.
- L'authentification par magic link est bien conservée, mais uniquement comme décision technique
  (cf. §1.3 ci-dessus) : c'est le seul cas où le rangement en addendum fait perdre le *statut* de
  l'information sans en perdre le contenu.

---

## Synthèse — par coût de la perte

1. **Interface iOS Shortcuts disparue sans décision** (§1.1) — laisse NFR-6 sans objet et fait reposer
   la conclusion « aucun repli vocal indépendant d'un tiers » sur une analyse qui n'a jamais examiné ce
   chemin.
2. **UJ-3 promet « Dis Siri »** que §10 renvoie hors v1 (§2.1) — contradiction dans la partie la plus lue.
3. **Conclusion périmée de la première étude vocale** dans l'addendum (§2.2) — oriente les documents
   aval vers FR-45, retirée.
4. **Tags et recherche de recettes** (§1.2) — l'axe de sélection sur lequel repose UJ-4.
5. **Unités `cs`/`cc`/`pièce` et mise à l'échelle** (§1.4) — la seule règle métier chiffrable sans
   garde-fou.
6. **Magic link déclassé en détail technique** (§1.3), plus les micro-pertes de modèle (§1.5) et le
   renvoi FR-24 → FR-39 (§2.3).
