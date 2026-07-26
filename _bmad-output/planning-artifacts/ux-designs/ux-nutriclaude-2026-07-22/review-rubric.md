# Spine Pair Review — nutriclaude

## Overall verdict

Paire solide, exploitable telle quelle comme contrat aval. Chaque token se définit, chaque `{path.to.token}` se résout, les quatre UJ canoniques deviennent quatre Key Flows verbatim avec protagonistes nommés et beats climax, et les trois fichiers visuels sont liés sans orphelin. Les seuls écarts sont mineurs : deux asymétries de composants entre les spines, la section *Inspiration & Anti-patterns* absente d'EXPERIENCE.md malgré des rejets élicités, et une duplication de la traçabilité FR entre les deux fichiers. Aucun finding critique ni high.

## 1. Flow coverage — strong

Frontmatter `sources` (prd.md + addendum.md) résolus. Les quatre UJ du PRD (§ prd.md l.74–85) — **UJ-1 Le supermarché**, **UJ-2 L'écran de la cuisine**, **UJ-3 L'ajout à chaud**, **UJ-4 Le dimanche soir désamorcé** — ont chacun un Key Flow au titre **verbatim**, avec protagoniste nommé (la conjointe, le foyer, Florian, Florian+Claude), étapes numérotées et beat **Climax** explicite. Les cinq surfaces ont au moins un flow (matrice de couverture EXPERIENCE.md l.170). Chemins d'échec présents là où porteurs : Flow 3 « Variante d'échec : le pont est rompu » (l.151), Flow 1 traite la coupure réseau comme beat de résilience (l.131).

### Findings
- **low** Flows 2 et 4 n'ont pas de ligne d'échec explicite (EXPERIENCE.md l.137–142, l.153–158). Défendable — l'anti-but du Flow 2 (un login qui apparaît) *est* le climax, et le Flow 4 est un chemin heureux — mais un échec de génération de menu (FR-17) resterait à nommer. *Fix :* ajouter une ligne « Variante d'échec » au Flow 4 (génération partielle / recette sans ingrédients), ou acter explicitement qu'aucun échec n'est porteur.

## 2. Token completeness — strong

28 tokens `colors` extraits : tous portent un hex ou rgba, aucune couleur sans valeur. Paires clair/sombre systématiques (`surface-base`/`surface-base-dark`, `card-border`/`card-border-dark`, `offline-*`/`offline-*-dark`, etc.). Les 9 rôles `typography`, 6 échelons + 6 tokens nommés `spacing`, et 6 rayons sont tous définis. Chaque `{path.to.token}` des 9 objets `components` et de la prose se résout vers le frontmatter. Cibles de contraste énoncées pour toutes les combinaisons porteuses : abricot/sombre ~9,7:1, `accent-ink`/abricot ~8:1, `accent-text-light` ~4,5:1, et le seul échec (`accent-strong` en texte sur clair ~2:1) est explicitement tracé et dérivé vers `accent-text-light` (l.190, 269, 273).

### Findings
- **low** `ligne-article.provenance-color` et `separateur-panier.color` ne portent que la valeur sombre (`{colors.muted-2-dark}`, DESIGN.md l.141, 159) sans pendant clair, alors que `muted-2` existe pour le thème clair. La prose couvre l'intention, mais un consommateur qui lit uniquement les tokens de composant n'a pas la valeur claire. *Fix :* ajouter `provenance-color-light`/`color-light` → `{colors.muted-2}`, ou une note d'héritage.
- **low** `spacing.item-min-height-dashboard`, `spacing.checkbox-size-dashboard` et `rounded.full` sont définis mais jamais référencés par un token de composant (seules les variantes téléphone le sont ; le dashboard reste en prose). *Fix :* soit référencer les variantes dashboard dans `tuile-courses`/`carte-rayon`, soit retirer `rounded.full` inutilisé.

## 3. Component coverage — adequate

Huit composants ont une ligne **visuelle** (DESIGN.md.Components) ET **comportementale** (EXPERIENCE.md.Component Patterns) avec de vraies règles : Tuile Courses, Carte-rayon, Ligne-article, Coche, Pastille « arrive… », Séparateur « Dans le panier », Bandeau hors-ligne, Bouton d'action. Deux asymétries subsistent.

### Findings
- **medium** **Correction de rayon** figure comme ligne de EXPERIENCE.md.Component Patterns (l.79) mais n'a **aucune ligne dans DESIGN.md.Components**. C'est en réalité une interaction (elle réapparaît en Interaction Primitives l.102), pas un composant à spec visuelle ; sa présence dans la table des composants crée une asymétrie qu'un extracteur mécanique signalera. *Fix :* la retirer de Component Patterns (elle est déjà couverte en Interaction Primitives), ou lui donner une ligne visuelle dans DESIGN.md.
- **low** **Provenance** a une spec visuelle riche dans DESIGN.md (mapping d'icônes micro/note/＋/🍴, l.244) mais aucune ligne comportementale dédiée dans EXPERIENCE.md.Component Patterns — son comportement est porté implicitement par Ligne-article + l'état « Article dicté en attente ». Acceptable, mais le mapping icône→action (porteur pour FR-7) ne vit que côté DESIGN. *Fix :* ajouter une ligne Provenance à Component Patterns, ou une note renvoyant au mapping DESIGN.

## 4. State coverage — strong

Table State Patterns (EXPERIENCE.md l.83–94) : chargement (cache d'abord, jamais d'écran blanc), liste vide, « À classer » non vide, hors-ligne (mode nominal), action non synchronisée, article dicté en attente, convergence sans conflit, pont vocal rompu, génération depuis menu, plein soleil. Les surfaces porteuses (téléphone + dashboard) sont exhaustivement couvertes. Le login refusé sur dashboard est traité par conception (aucun login, FR-28). Le focus est couvert en Accessibility Floor plutôt qu'en table.

### Findings
- **low** Aucun état **recherche vide** (répertoire de recettes, FR-51 « chercher par titre ») ni **menu/grille vide**. Ces surfaces web sont explicitement hors périmètre maquetté (EXPERIENCE.md l.172, DESIGN.md l.277), donc l'omission est défendable, mais un consommateur du répertoire de recettes n'aura pas d'état vide. *Fix :* une ligne « Recherche recette sans résultat » quand ces surfaces seront élicitées.

## 5. Visual reference coverage — strong

Trois fichiers, tous liés en ligne avec ce qu'ils illustrent, zéro orphelin :
- `imports/reference-premium-dashboard.html` → DESIGN.md Brand & Style l.181 (verre, halos, compteur, coche hérités ; menthe/indigo écartés).
- `.working/direction-abricot-v2.html` → EXPERIENCE.md IA l.45 (« écran pivot clair/sombre + dashboard »).
- `.working/color-themes-1.html` → EXPERIENCE.md IA l.45 (« états hors-ligne + provenance »).

`spines-win-on-conflict` énoncé une fois (EXPERIENCE.md l.45 : « Le spine l'emporte en cas de conflit »). Répartition propre : la référence d'identité côté DESIGN, les références de composition côté EXPERIENCE.

### Findings
Aucun.

## 6. Bloat & overspecification — adequate

La prose DESIGN.md porte une voix éditoriale légitime (chaleur cuisine du soir). Les Key Flows sont narratifs à bon escient (climax porteurs). Pas de spec pixel gratuite là où un token suffirait, à une exception près.

### Findings
- **low** Duplication de la traçabilité : les deux spines portent une section finale « Lacunes & hypothèses » qui reprend la couverture FR/NFR et le hors-périmètre (DESIGN.md l.275–277 ; EXPERIENCE.md l.170–172). Utile pour la gate, mais c'est de la restitution de scope en double. *Fix :* garder la couverture FR côté EXPERIENCE (contrat comportemental), réduire côté DESIGN aux seuls FR à impact visuel.
- **low** `bandeau-hors-ligne.radius: 11px` est un littéral hors échelle `rounded` (8/14/20/22). *Fix :* rattacher à un token ou assumer la valeur d'exception par une note.

## 7. Inheritance discipline — strong

`sources` (prd.md, addendum.md, ./DESIGN.md) résolus sur disque. Noms UJ verbatim depuis prd.md §5. Glossaire cohérent entre spines et sources (« À classer », « Dans le panier », « arrive… », « la bouffe », tuile Courses). Noms de composants stables entre frontmatter, prose et EXPERIENCE. Les refs de tokens EXPERIENCE→DESIGN se résolvent (`accent-text-light` #C2410C, l.112). Discipline notable sur le conflit contraste : le memlog verrouille #F5912B comme variante forte clair ; DESIGN **ne l'écrase pas en silence** — il dérive `accent-text-light` pour le texte, marque le token `[ASSUMPTION]` et remonte l'arbitrage à Florian (DESIGN.md l.269, EXPERIENCE.md l.112). La divergence est exposée, pas enterrée.

### Findings
Aucun.

## 8. Shape fit — adequate

DESIGN.md respecte l'ordre canonique verrouillé : Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts. EXPERIENCE.md porte les 8 défauts requis (Foundation, IA, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows) plus Responsive & Platform, requis à raison car multi-surface.

### Findings
- **medium** **Inspiration & Anti-patterns absente d'EXPERIENCE.md** alors que le déclencheur est présent : le memlog et le PRD montrent un produit de référence (dashboard premium) et des rejets nets — vert menthe/indigo écartés (visuels, captés côté DESIGN), mais aussi des rejets d'expérience non captés sous un titre dédié : lecture vocale de la liste retirée (FR-30), aucune app native/store (NFR-11), pas de voix sur le dashboard (FR-45). La substance existe, dispersée (Banni en Interaction Primitives, prose DESIGN), mais un consommateur cherchant « ce qui a été rejeté et pourquoi » n'a pas de section. *Fix :* ajouter une courte section Inspiration & Anti-patterns (Repris de : dashboard domotique premium ; Rejeté : lecture vocale FR-30, app native NFR-11, streaks/gamification).
- **low** Les deux fichiers ajoutent une section inventée « Lacunes & hypothèses » après Do's/Don'ts (DESIGN) et après Key Flows (EXPERIENCE). Appendue, non interleavée, donc l'ordre canonique tient ; elle gagne sa place pour la gate mais reste une section méta qu'un consommateur de production sauterait. *Fix :* acceptable en l'état ; envisager de la déplacer dans `.memlog.md` après finalize.

## Mechanical notes

- **Cohérence de noms de composants :** légères variations de libellé, sans ambiguïté — DESIGN « Pastille pending (pastille-pending) — arrive… » vs EXPERIENCE « Pastille arrive… » ; DESIGN « Bouton d'action » vs EXPERIENCE « Bouton d'action / ajout ». Même composant à chaque fois ; l'id frontmatter (`pastille-pending`, `bouton-action`) désambiguïse.
- **Cross-refs :** toutes les cibles `{path.to.token}` du frontmatter `components` et de la prose DESIGN se résolvent. Les liens de fichiers (`imports/…`, `.working/…`), le `./DESIGN.md` de `sources` et les chemins PRD existent tous sur disque.
- **Complétude frontmatter :** DESIGN — name, status(draft), description, colors, typography, rounded, spacing, components : complet. EXPERIENCE — name, status(draft), sources, updated : complet. `status: draft` dans les deux (attendu avant finalize).
- **Mermaid :** aucun diagramme Mermaid dans l'une ou l'autre spine — l'IA est en table. N/A, rien à valider.
- **Asymétrie de table à corriger mécaniquement :** « Correction de rayon » (EXPERIENCE.Component Patterns) sans pendant DESIGN.Components ; « Provenance » (DESIGN.Components) sans pendant EXPERIENCE.Component Patterns. Voir §3.
