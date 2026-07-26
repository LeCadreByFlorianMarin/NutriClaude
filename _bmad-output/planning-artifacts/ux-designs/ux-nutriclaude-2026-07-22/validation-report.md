# Validation Report — nutriclaude

- **DESIGN.md :** `./DESIGN.md`
- **EXPERIENCE.md :** `./EXPERIENCE.md`
- **Run at :** 2026-07-22 (Reviewer Gate, Finalize)
- **Lentilles :** Rubric walker · Accessibilité

## Overall verdict

La paire de spines est un **contrat aval solide** : tous les tokens se définissent, tous les `{path.to.token}` se résolvent, les 4 parcours canoniques (UJ-1→UJ-4) deviennent 4 Key Flows verbatim avec protagoniste nommé et beat climax, et les 3 fichiers visuels sont liés sans orphelin. Le rubric walker n'a relevé **aucun finding critique ni high**.

L'audit accessibilité, lui, a révélé que le premier jet jugeait les contrastes contre les **bases pleines** alors que le contenu rend sur le **verre translucide** (≈ #261d23) et les cartes blanches — ce qui faisait basculer plusieurs PASS supposés en FAIL, dont le geste central (la coche vide) et, au pire endroit, le **thème clair plein soleil** qui est le cas d'usage pivot. **Les 2 findings critiques, 4 high et 3 medium ont tous été corrigés dans les spines** (tokens recalculés sur fonds réels, provenance passée à double canal, dashboard doté de planchers de lisibilité à un mètre, focus clavier et sémantique lecteur d'écran spécifiés). Le plancher d'accessibilité, absent des sources, est désormais une **décision ferme** et non plus une hypothèse ouverte.

## Category verdicts (rubric walker)

| Catégorie | Verdict |
|---|---|
| Flow coverage | **strong** |
| Token completeness | **strong** |
| Component coverage | adequate |
| State coverage | **strong** |
| Visual reference coverage | **strong** |
| Bloat & overspecification | adequate |
| Inheritance discipline | **strong** |
| Shape fit | adequate |

## Findings by severity

### Critical (2) — ✅ résolus
- **[Accessibilité] Coche vide illisible, thème clair** (`DESIGN.colors.checkbox-empty`, §Shapes) — #C9CCC0 ≈ 1,45–1,63:1 sur carte blanche, invisible en plein soleil (cas pivot). **Fix appliqué :** #83887B (3,64:1) + fond interne d'affordance + règle « contour ≥3:1 contre la carte ».
- **[Accessibilité] Coche vide sous seuil, thème sombre** (`DESIGN.colors.checkbox-empty-dark`) — #59617A ≈ 2,66:1 sur le verre réel (ne passait que contre la base pleine, jamais atteinte). **Fix appliqué :** #828AA3 (4,77:1 sur verre).

### High (4) — ✅ résolus
- **[Accessibilité] muted-2 en texte échoue AA** (`DESIGN.colors.muted-2*`) — portait quantités, horodatage, provenance texte, séparateur (2,46:1 clair / 4,02:1 halo). **Fix :** rôles porteurs réassignés à `muted` (AA : 5,15:1 blanc / 8,06:1 verre) ; muted-2 remonté (#8B9083 / #8990A5) et restreint au non-essentiel.
- **[Accessibilité] Provenance FR-7 mono-canal** (icône seule, 2,86:1, sans texte) — **Fix :** icône ≥3:1 **+** `aria-label` obligatoire (« ajouté à la voix », « dicté / partagé », « ajout manuel », « issu d'une recette ») ; l'information de source ne repose jamais sur la seule icône/couleur.
- **[Accessibilité] Dashboard illisible à 1 m au-delà du compteur** (contexte en 12px, FR-24) — **Fix :** planchers `body-dashboard` ≥18px, `meta-dashboard` ≥15px ; 12px interdit pour un texte porteur sur dashboard.
- **[Accessibilité] Focus clavier non spécifié** (mocks en `tap-highlight:transparent`) — **Fix :** tokens `focus-ring-light/-dark` + composant `focus` (anneau 2px + offset), `outline:none` sans remplacement interdit.

### Medium (5)
- **[Accessibilité] Sémantique lecteur d'écran contredite** (coches en `<span>`) — ✅ **Fix :** coche = vrai `role="checkbox"` annonçant son état ; compteur annoncé « 12 articles à prendre ».
- **[Accessibilité] Bandeau hors-ligne clair marginal** (4,42:1) — ✅ **Fix :** offline-text → #7E6224 (5,20:1).
- **[Accessibilité] Libellé « acheté » clair trop pâle** (#B3B7AB, 2,04:1) — ✅ **Fix :** libellé barré porté en `muted` (lisible) ; barré + coche pleine restent les signaux primaires.
- **[Rubric §3] « Correction de rayon » sans ligne DESIGN.Components** — *ouvert, bénin* : c'est une interaction, déjà couverte en Interaction Primitives. Pas de spec visuelle nécessaire.
- **[Rubric §8] Section *Inspiration & Anti-patterns* absente** malgré des rejets élicités (lecture vocale FR-30, app native NFR-11, menthe/indigo) — *à traiter au finalize* : substance présente mais dispersée, mérite un titre dédié.

### Low (9) — rubric walker
Asymétrie Provenance (résolue par le double canal ci-dessus), tokens clair manquants sur quelques dérivés (complétés), variantes dashboard/`rounded.full` non référencées, chemins d'échec non explicites sur Flows 2/4, états vides recherche/menu (hors périmètre maquetté), duplication de la traçabilité FR entre les deux spines, littéral `11px` hors échelle, section méta « Lacunes & hypothèses » jugée « inventée » (conservée à dessein : utile au consommateur aval). Aucun ne bloque le contrat.

## Hypothèses restantes (à trancher au finalize)
1. **Zoom texte 200 %** — la tenue de la colonne unique sans scroll horizontal est posée en exigence mais non mesurable sans rendu réel.
2. **Icônes de provenance manuel (＋) / recette (🍴)** — mapping proposé pour couvrir FR-7 en entier, absent des mocks, à valider.
3. **Section Inspiration & Anti-patterns** — à ajouter à EXPERIENCE.md pour consigner les rejets (menthe, indigo froid, lecture vocale, natif).

## Reviewer files
- `review-rubric.md`
- `review-accessibility.md`
