---
name: NutriClaude — Accessibility Review
role: Reviewer Gate UX (lentille accessibilité)
updated: 2026-07-23
scope: DESIGN.md + EXPERIENCE.md + mocks .working/*.html + réf imports/
method: WCAG 2.1/2.2 AA comme plancher, calcul des ratios réels, réalités terrain (supermarché une main, plein soleil, dashboard à 1 m)
verdict: CHANGES_REQUESTED
---

# Accessibility Review — nutriclaude

## Overall verdict

Le système est **solide sur son axe le plus visible et faible sur son geste le plus important**. Le texte principal, le gros compteur et l'accent abricot sur sombre passent AA avec une marge confortable ; la garde `accent-text-light` (#C2410C) contre le piège #F5912B est correcte et bien tracée. **Mais le contrôle central — la coche vide — échoue le seuil 3:1 dans les DEUX thèmes**, catastrophiquement en clair (1,6:1) où précisément le cas d'usage pivot exige la lisibilité (plein soleil, une main). Sept combinaisons porteuses échouent AA, dont deux critiques. Le plancher a11y étant entièrement en [ASSUMPTION], plusieurs invariants comportementaux (focus, sémantique lecteur d'écran, reduced-motion, tailles dashboard à 1 m) sont *déclarés* mais **non spécifiés ni démontrés dans les mocks** — les `<span>` cliquables et les icônes sans équivalent texte contredisent déjà la promesse « rôle + état annoncés ».

## Ratios de contraste (calculés)

Base sombre `#191016` ; verre carte = `rgba(255,255,255,.055)` sur base ≈ **`#261d23`** (les lignes-articles rendent SUR la carte, pas sur la base — c'est le fond réel). Halo terracotta local ≈ `#36221f`. Seuil texte normal 4,5:1 ; texte large (≥ 24px/18,66px gras) 3:1 ; non-textuel/UI 3:1.

| Combinaison | Fond réel | Ratio | Seuil | Verdict |
|---|---|---|---|---|
| Texte `#EEF1F8` — sombre | #191016 | **16,5:1** | 4,5 | PASS |
| Texte `#EEF1F8` — verre carte | #261d23 | **14,5:1** | 4,5 | PASS |
| muted `#AEB6C9` — sombre / verre | #191016 / #261d23 | **9,2 / 8,1:1** | 4,5 | PASS |
| **muted-2 `#7D849C` — verre carte** | #261d23 | **4,41:1** | 4,5 | **FAIL** |
| muted-2 `#7D849C` — verre halo terracotta | #36221f | **4,02:1** | 4,5 | **FAIL** |
| muted-2 `#7D849C` — base sombre pleine | #191016 | 5,02:1 | 4,5 | PASS (mais rare : le texte est sur carte) |
| Provenance icône `#7D849C`@opacity .7 — verre | #261d23 | **2,86:1** | 3,0 | **FAIL** |
| Texte `#20211D` — clair / carte blanche | #F4F1EA / #FFF | **14,4 / 16,2:1** | 4,5 | PASS |
| muted `#6A6F66` — clair base | #F4F1EA | 4,56:1 | 4,5 | PASS (limite) |
| muted `#6A6F66` — carte blanche | #FFFFFF | 5,15:1 | 4,5 | PASS |
| **muted-2 clair `#A2A79A` — carte blanche** | #FFFFFF | **2,46:1** | 4,5 | **FAIL** |
| **done/sep clair `#B3B7AB` — carte blanche** (mock) | #FFFFFF | **2,04:1** | 4,5 | **FAIL** |
| accent `#FFA94D` texte — sombre / verre / halo | #191016 / #261d23 / #36221f | **9,79 / 8,60 / 7,85:1** | 4,5 | PASS |
| accent `#C2410C` texte — clair base / carte | #F4F1EA / #FFF | **4,59 / 5,18:1** | 4,5 | PASS (base limite) |
| `#F5912B` texte — clair (usage interdit) | #F4F1EA | **2,08:1** | 4,5 | FAIL *(garde design OK — réservé aplats)* |
| Encre `#3A1E04` — aplat `#F5912B` (coche clair) | #F5912B | **6,56:1** | 4,5 | PASS |
| Encre `#3A1E04` — aplat `#FFA94D` (coche sombre) | #FFA94D | **8,07:1** | 4,5 | PASS |
| **Coche vide `#59617A` bord — verre carte** | #261d23 | **2,66:1** | 3,0 | **FAIL** |
| Coche vide `#59617A` bord — base sombre pleine | #191016 | 3,03:1 | 3,0 | PASS de justesse *(mais la coche est sur la carte → voir FAIL ci-dessus)* |
| **Coche vide `#C9CCC0` bord — carte blanche** | #FFFFFF | **1,63:1** | 3,0 | **FAIL (critique)** |
| **Coche vide `#C9CCC0` bord — clair base** | #F4F1EA | **1,45:1** | 3,0 | **FAIL (critique)** |
| Bordure abricot tuile `#FFA94D` — verre (non-textuel) | #261d23 | 8,60:1 | 3,0 | PASS |
| Bandeau hors-ligne clair `#8A6D2E` — `#FBF3E2` | #FBF3E2 | **4,42:1** | 4,5 | **FAIL (marginal)** |
| Bandeau hors-ligne sombre `#AEB6C9` — verre .04 | ~#1e1519 | 8,36:1 | 4,5 | PASS |
| Pastille pending `#FFA94D` — voile .16 sur verre | ~#30231f | 6,16:1 | 4,5 | PASS |
| Pastille pending clair `#C2410C` — voile .14 sur blanc | ~#f4e6db | 4,63:1 | 4,5 | PASS |

**Total combinaisons porteuses en FAIL AA : 7** (hors #F5912B qui est une garde design correcte), dont **2 critiques** (les deux coches vides).

## Findings

- **[critical]** La **coche vide en thème clair est quasi invisible** : bord `#C9CCC0` sur carte blanche = **1,63:1**, sur base = **1,45:1**, très loin des 3:1 requis pour un composant UI non-textuel. C'est le contrôle le plus fréquent de l'écran, sur l'écran PIVOT, dans le cas d'usage plein soleil où le contraste compte le plus. *(DESIGN.md `checkbox-empty:#C9CCC0`, `coche.border-empty` ; mock direction-abricot-v2 `.light{--cbE:#c9ccc0}`).* **Fix :** passer le bord vide à ≥ `#8A8E82` (~3,1:1 sur blanc) voire `#767B6E` (~4,0:1) et l'épaissir à 2,5px ; viser 3:1 aussi sur la base `#F4F1EA` (le rayon « À classer » et les headers rendent hors carte).

- **[critical]** La **coche vide en thème sombre échoue 3:1 sur son fond réel** : bord `#59617A` = **2,66:1 sur le verre carte** (#261d23). Elle ne passe (3,03:1) que contre la base pleine `#191016`, or les lignes-articles rendent SUR la carte translucide. En zone de halo terracotta c'est pire. *(DESIGN.md `checkbox-empty-dark:#59617A`).* **Fix :** bord vide ≥ `#7A8299` (~3,4:1 sur verre) ou ajouter un fond de case légèrement plus sombre que la carte pour asseoir le contour ; recalculer le seuil contre `#261d23`, pas contre `#191016`.

- **[high]** **muted-2 échoue AA en texte dans les deux thèmes, sur le fond réel.** Sombre `#7D849C` sur verre = **4,41:1** (4,02:1 en halo) ; clair `#A2A79A` sur blanc = **2,46:1**. Ce token porte de l'information : provenance texte, quantités (`×3`), ratio `n/total` masqué, horodatage « maj vocale il y a 2 min », ligne « Rangée dans l'ordre de ton magasin », séparateur « Dans le panier ». *(DESIGN.md `muted-2-dark`, `muted-2` ; composants `ligne-article.provenance-color`, `separateur-panier.color`, `qty-type`).* **Fix :** sombre → `#9AA0B4` (~5,4:1 sur verre) ; clair → `#7E8378` (~4,6:1 sur blanc). Vérifier tous les usages contre `#261d23` et `#FFFFFF`, pas contre les bases pleines.

- **[high]** **Les icônes de provenance ne sont perceptibles ni par contraste ni par lecteur d'écran.** Rendu à `opacity:.7` sur `#7D849C` → **2,86:1** (< 3:1 non-textuel), taille 14px, et **aucun équivalent texte** : 🎙/🗒/＋/🍴 sont le seul véhicule de FR-7. Un daltonien, un malvoyant ou un utilisateur VoiceOver ne peut pas distinguer « ajout vocal » de « dicté iOS ». *(DESIGN.md `Provenance` ; mock `.it .src{opacity:.7}`).* **Fix :** retirer l'`opacity:.7`, porter la couleur au token muted-2 corrigé (≥ 3:1), et attacher un `aria-label`/texte visuellement caché par icône (« ajouté à la voix », « dicté », « ajout manuel », « depuis une recette »). Deux des quatre icônes sont déjà en [ASSUMPTION] non maquettée : l'occasion de spécifier l'équivalent texte dès la définition.

- **[high]** **Dashboard illisible à un mètre au-delà du compteur (FR-24).** Le compteur 40px/800 passe (contraste + taille), mais tout le contexte porteur est en **12px** : peek « Poivrons, Lait, Café +9 », horodatage de provenance, menu du jour (Midi/Soir/Pour), horloge secondaire `dday`. 12px se lit à ~40 cm, pas à 1 m. FR-24 est un invariant non négociable de la surface dashboard. *(mock direction-abricot-v2 `.dpeek/.dmeal/.dday` à 12px).* **Fix :** plancher dashboard ≥ 16–18px pour tout texte porteur, ≥ 20px pour le menu du jour ; réserver 12px aux surfaces téléphone tenues en main. Ajouter un token `meta-dashboard`.

- **[high]** **Focus clavier non spécifié, et le highlight par défaut est activement supprimé.** EXPERIENCE.md pose « Focus visible sur les surfaces au clavier (web, Claude) » en [ASSUMPTION], mais aucun token ni style `:focus-visible` n'existe, tandis que les mocks appliquent `-webkit-tap-highlight-color:transparent` sur `*`. Les surfaces web (config, recettes, menu) et la PWA au clavier n'ont donc aucun indicateur de focus défini. *(DESIGN.md : absent ; EXPERIENCE.md Accessibility Floor).* **Fix :** définir un token `focus-ring` (p. ex. contour 2px `#FFA94D` + halo, non-abricot sur clair pour éviter le 4,5:1 texte — un ring 3px `#C2410C` ou un double-contour clair/sombre), appliqué à tout élément focusable, jamais `outline:none` sans remplacement.

- **[medium]** **Sémantique lecteur d'écran promise mais contredite par les mocks.** Les coches sont des `<span class="cb">` sans rôle ni état ; le compteur « 12 » et le libellé « à prendre » sont deux nœuds séparés (annoncés « 12 » puis « à prendre » ou dans le désordre) ; le ratio `n/total` (`3/4`) n'a pas de label. EXPERIENCE.md exige « chaque élément interactif annonce rôle + état » et « la coche annonce son changement d'état » — non démontré. *(mocks : structure `<span>`).* **Fix :** coche = `<button role="checkbox" aria-checked>` ou `<input type=checkbox>` stylé, ligne entière = la cible avec `aria-label` « {article}, {à prendre|dans le panier} » ; compteur en un seul label « 12 articles à prendre » ; ratio `aria-label="3 sur 4 pris"`.

- **[medium]** **Bandeau hors-ligne clair sous AA (marginal).** `#8A6D2E` sur `#FBF3E2` = **4,42:1** (< 4,5). Petit texte pleine largeur, cas mode nominal fréquent. *(DESIGN.md `offline-text:#8A6D2E`/`offline-bg:#FBF3E2`).* **Fix :** foncer le texte à `#7E6224` (~5,0:1) — ne touche pas au registre ambre discret voulu.

- **[medium]** **L'état « acheté » perd son second signal en thème clair par manque de contraste.** Le principe barré + coche pleine est correct (bon découplage couleur), mais le libellé barré clair `#B3B7AB` = **2,04:1** : il est si pâle qu'il devient illisible et le barré peu perceptible → on retombe de facto sur la seule couleur/position. *(mock `.light .it.done .lbl{color:#b3b7ab}`).* **Fix :** libellé acheté ≥ `#8A8E82` (~3:1) ; le barré reste, la ligne demeure lisible pour récupération (FR-3).

- **[low]** **`prefers-reduced-motion` non traité.** Transition coche `.15s`, halo abricot statique (OK), mais aucun garde-fou déclaré pour d'éventuelles animations d'arrivée « arrive… » / mise à jour optimiste / bascule de thème. *(DESIGN.md/EXPERIENCE.md : absent).* **Fix :** clause `@media (prefers-reduced-motion: reduce)` neutralisant transitions non essentielles ; conserver le retour d'état instantané (non animé) de la coche.

- **[low]** **Zone de tap conforme mais non prouvée, et cible right-side ambiguë.** Ligne-article 46/48px ≥ 44px ✓, empilées sans gouttière → cibles adjacentes contiguës (risque de tap voisin en mouvement). Le texte dit « zone de tap = toute la ligne » mais les mocks n'ont pas de handler ; à confirmer que qty/pending/provenance à droite n'interceptent pas le tap. **Fix :** garantir 1 seul hit-target par ligne (la ligne), ajouter 2–4px de séparation verticale de sécurité, et cocher-décocher idempotent au tap (NFR-2 déjà posé).

## Angles morts

- **Le pire contraste est là où le besoin est maximal.** Le thème clair est *justifié* par le cas plein soleil / bras tendu (NFR-3) — or c'est exactement le thème où coche vide (1,6:1), quantités (2,5:1) et libellés barrés (2:1) s'effondrent. Le thème auto ne « suffit » pas : basculer en clair ne sert à rien si les éléments porteurs y sont moins lisibles qu'en sombre. À traiter comme la priorité n°1.
- **Verre translucide vs seuils calculés sur base pleine.** Tout le système semble avoir été jugé contre `#191016`/`#F4F1EA`, alors que les lignes-articles rendent sur les cartes (`#261d23` / blanc) et parfois sur des halos terracotta plus clairs. Plusieurs PASS supposés deviennent FAIL sur le fond réel. Refaire tous les calculs contre les fonds composés.
- **Provenance = information à véhicule unique.** FR-7 repose entièrement sur des micro-icônes 14px, faible contraste, sans texte, sans forme redondante côté couleur. Angle mort combiné contraste + daltonisme + lecteur d'écran.
- **Cible en mouvement + faible contraste de la coche.** Marcher avec un caddie, une main, en cochant : le geste (44px) va, mais *repérer les cases non cochées restantes* dépend d'un contour à 1,5–2,7:1. Le pivot lui-même est fragilisé.
- **Plancher a11y entièrement en [ASSUMPTION].** Focus, sémantique ARIA, reduced-motion, alternatives texte, agrandissement/zoom (200 % sans scroll horizontal — NFR-3 s'y prête mais non testé), lecteur d'écran sur la coche : tout est *déclaré comme intention*, rien n'est *spécifié en tokens/composants ni démontré en mock*. Un plancher non spécifié n'est pas un plancher — il faut le figer avant implémentation, sinon les `<span>` des mocks deviennent le comportement livré.
- **Zoom texte / OS large fonts non considéré.** Le compteur 48px et les mises en page colonne-unique à marge 8px risquent le débordement/scroll horizontal (interdit NFR-3) sous agrandissement système. Non testé.
