---
name: NutriClaude
status: final
updated: 2026-07-23
description: La liste de courses du foyer, partout. Verre et profondeur hérités d'un dashboard premium, une seule couleur-signature abricot réservée à l'action courses, thème clair/sombre automatique.
colors:
  # ── Accent unique (RÉSERVÉ à l'action courses : compteur, coche, provenance, tuile Courses) ──
  accent: '#FFA94D'                       # abricot — usage sur thème sombre (AA large + petit OK sur fond chaud)
  accent-strong: '#F5912B'                # variante forte — FILLS sur thème clair (coche, halo). Voir note AA ci-dessous.
  accent-text-light: '#C2410C'            # abricot brûlé pour TEXTE/compteur accent sur clair (AA ~4.5:1) — décidé par Florian. #F5912B en texte échoue AA (~2:1) donc réservé aux aplats.
  accent-ink: '#3A1E04'                   # encre foncée POSÉE SUR un aplat abricot (coche cochée, bouton d'action)
  accent-soft-dark: 'rgba(255,169,77,.16)'   # halo/voile abricot sur sombre (tuile, pastille, icône rayon)
  accent-soft-light: 'rgba(245,145,43,.14)'  # halo/voile abricot sur clair
  # ── Thème CLAIR (défaut sémantique — blanc cassé chaud, plein soleil) ──
  surface-base: '#F4F1EA'                 # blanc cassé chaud (fond avec léger radial blanc + linéaire 160deg, voir Elevation)
  surface-card: '#FFFFFF'
  card-border: 'rgba(20,20,20,.07)'
  text: '#20211D'
  muted: '#6A6F66'                         # secondaire PORTEUR d'info (quantités, ratio, horodatage, provenance texte, séparateur) — 5,15:1 sur carte blanche, 4,56:1 sur base. AA.
  muted-2: '#8B9083'                        # tertiaire NON-ESSENTIEL uniquement (atténué d'un article déjà coché, note italique). 3,27:1 sur carte blanche. Jamais un texte porteur d'info. (était #A2A79A ~2,46:1 — sous AA en texte)
  checkbox-empty: '#83887B'                 # contour coche vide — 3,64:1 sur carte blanche, 3,22:1 sur base (≥3:1 non-textuel). (était #C9CCC0 ~1,6:1 — invisible en plein soleil)
  checkbox-empty-fill: 'rgba(20,20,20,.03)' # très léger fond interne de la case vide : renforce l'affordance au-delà du seul contour
  offline-bg: '#FBF3E2'
  offline-text: '#7E6224'                   # 5,20:1 sur offline-bg (AA). (était #8A6D2E ~4,42:1 — sous AA)
  offline-border: '#F0E2C0'
  focus-ring-light: '#C2410C'               # anneau de focus clavier (thème clair) — 5,18:1 sur blanc, 4,59:1 sur base (≥3:1 non-textuel)
  # ── Thème SOMBRE (aubergine/espresso chaud — REMPLACE le #0f1117 câblé en dur) ──
  surface-base-dark: '#191016'            # base espresso/aubergine (dégradé 160deg + halos radiaux, voir Elevation)
  surface-base-dark-2: '#211318'          # butée haute du dégradé
  surface-base-dark-3: '#2A1512'          # butée basse du dégradé (terracotta)
  surface-card-dark: 'rgba(255,255,255,.055)'   # verre translucide (.05–.06)
  card-border-dark: 'rgba(255,255,255,.10)'     # bordure verre (.10–.12)
  text-dark: '#EEF1F8'
  muted-dark: '#AEB6C9'                          # secondaire PORTEUR d'info — 8,06:1 sur verre carte (#261d23). AA.
  muted-2-dark: '#8990A5'                         # tertiaire non-essentiel — 5,14:1 sur verre (4,69:1 en halo terracotta). (était #7D849C ~4,41:1, 4,02:1 en halo — sous AA en texte sur verre)
  checkbox-empty-dark: '#828AA3'                  # contour coche vide — 4,77:1 sur verre carte, 4,35:1 en halo (≥3:1 non-textuel). (était #59617A ~2,66:1 sur verre — sous seuil)
  checkbox-empty-fill-dark: 'rgba(255,255,255,.04)' # léger fond interne de la case vide sur sombre (affordance)
  offline-bg-dark: 'rgba(255,255,255,.04)'
  offline-text-dark: '#AEB6C9'
  offline-border-dark: 'rgba(255,255,255,.08)'
  focus-ring-dark: '#FFA94D'                      # anneau de focus clavier (thème sombre) — 8,60:1 sur verre, 9,79:1 sur base (≥3:1 non-textuel)
typography:
  # Familles
  # rounded  = humaniste arrondie (titres + gros compteur). [ASSUMPTION] fallback webfont Android à confirmer sous NFR-10/11.
  # neutral  = sans-serif lisible (corps, libellés, chrome)
  counter:                                # gros compteur téléphone (« 12 à prendre »)
    fontFamily: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif'
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '0.9'
    letterSpacing: -0.03em
    fontVariantNumeric: 'tabular-nums'
  counter-dashboard:                      # compteur tuile Courses sur écran cuisine
    fontFamily: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif'
    fontSize: 40px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: -0.02em
    fontVariantNumeric: 'tabular-nums'
  clock:                                  # horloge dashboard
    fontFamily: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif'
    fontSize: 34px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: -0.02em
    fontVariantNumeric: 'tabular-nums'
  body-dashboard:                         # corps LISIBLE À UN MÈTRE (menu du jour, peek des ajouts) — plancher FR-24
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.4'
  meta-dashboard:                         # méta dashboard (horodatage de provenance, jour) — plancher lisibilité 1 m
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.5'
  title:                                  # « Ta liste est prête »
    fontFamily: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif'
    fontSize: 19px
    fontWeight: '700'
    lineHeight: '1.25'
    letterSpacing: -0.01em
  eyebrow:                                # « TA LISTE », noms de rayon
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1.4'
    letterSpacing: 0.05em
  body:                                   # libellé d'article
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.4'
  meta:                                   # provenance texte, horodatage, contexte magasin
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.5'
  qty:                                    # quantités
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
    fontVariantNumeric: 'tabular-nums'
  pending-tag:                            # pastille « arrive… »
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: 9.5px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.02em
rounded:
  sm: 8px            # coche
  md: 14px           # cartes-rayon, tuiles
  lg: 20px           # grandes cartes
  xl: 22px           # conteneur dashboard
  pill: 20px         # pastilles, chips, séparateurs pilulés (≥ 20px)
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  gutter: 14px                    # espace inter-cartes
  card-padding: 12px
  screen-margin: 8px              # marge latérale de l'écran liste (téléphone une main)
  touch-target: 44px             # cible tactile plancher (NFR / a11y)
  item-min-height: 46px          # ligne-article téléphone
  item-min-height-dashboard: 48px
  checkbox-size: 25px            # coche téléphone
  checkbox-size-dashboard: 26px  # coche dashboard
components:
  tuile-courses:
    background-dark: '{colors.surface-card-dark}'
    border: '{colors.accent}'
    radius: '{rounded.md}'
    halo: '0 0 26px {colors.accent-soft-dark}'
    counter-color: '{colors.accent}'
    counter-type: '{typography.counter-dashboard}'
    peek-type: '{typography.body-dashboard}'      # peek des derniers ajouts — lisible à 1 m (FR-24)
    meta-type: '{typography.meta-dashboard}'       # horodatage de provenance (« maj vocale il y a 2 min ») — lisible à 1 m
  carte-rayon:
    background: '{colors.surface-card}'
    background-dark: '{colors.surface-card-dark}'
    border: '{colors.card-border}'
    border-dark: '{colors.card-border-dark}'
    radius: '{rounded.md}'
    shadow-light: '0 6px 18px rgba(60,50,30,.06)'
    header-icon-bg: '{colors.accent-soft-dark}'      # pastille emoji du rayon (voile abricot)
    header-icon-bg-light: '{colors.accent-soft-light}'
  ligne-article:
    min-height: '{spacing.item-min-height}'
    gap: '{spacing.3}'
    label-type: '{typography.body}'
    qty-type: '{typography.qty}'
    qty-color: '{colors.muted}'                    # quantité active = info porteuse → muted (AA), pas muted-2
    qty-color-dark: '{colors.muted-dark}'
    provenance-color: '{colors.muted}'             # icône de provenance PORTEUSE (FR-7) : ≥3:1, jamais d'opacity réductrice. (était muted-2-dark + opacity .7 ~2,86:1)
    provenance-color-dark: '{colors.muted-dark}'
    done-label-color: '{colors.muted}'             # libellé barré ACHETÉ : reste lisible (AA), le barré + coche pleine restent les signaux primaires. (était muted-2 ~2:1 sur clair)
    done-label-color-dark: '{colors.muted-dark}'
    done-meta-color: '{colors.muted-2}'            # quantité/provenance d'un article DÉJÀ coché = non-essentiel (redondant) → muted-2 admis
    done-meta-color-dark: '{colors.muted-2-dark}'
  coche:
    size: '{spacing.checkbox-size}'
    radius: '{rounded.sm}'
    border-empty: '{colors.checkbox-empty}'
    border-empty-dark: '{colors.checkbox-empty-dark}'
    fill-empty: '{colors.checkbox-empty-fill}'         # léger fond interne (affordance au-delà du contour)
    fill-empty-dark: '{colors.checkbox-empty-fill-dark}'
    fill-checked: '{colors.accent}'
    fill-checked-light: '{colors.accent-strong}'
    tick-color: '{colors.accent-ink}'
    border-width: 2px                                  # contour ≥2px pour tenir le ≥3:1 à petite taille
  focus:                                    # anneau de focus clavier — surfaces web/PWA (voir Accessibility)
    ring-color-light: '{colors.focus-ring-light}'
    ring-color-dark: '{colors.focus-ring-dark}'
    ring-width: 2px
    ring-offset: 2px
  pastille-pending:                 # « arrive… » — action non synchronisée
    background: '{colors.accent-soft-dark}'
    background-light: '{colors.accent-soft-light}'
    color: '{colors.accent}'
    color-light: '{colors.accent-text-light}'
    radius: '{rounded.pill}'
    type: '{typography.pending-tag}'
  separateur-panier:                # « Dans le panier »
    type: '{typography.eyebrow}'
    color: '{colors.muted}'                     # séparateur = repère de lecture porteur → muted (AA). (était muted-2-dark)
    color-dark: '{colors.muted-dark}'
  bandeau-hors-ligne:
    background: '{colors.offline-bg}'
    background-dark: '{colors.offline-bg-dark}'
    color: '{colors.offline-text}'
    color-dark: '{colors.offline-text-dark}'
    border: '{colors.offline-border}'
    border-dark: '{colors.offline-border-dark}'
    radius: 11px
  bouton-action:                    # gros bouton (« Ajouter un truc »)
    background: '{colors.accent}'
    background-light: '{colors.accent-strong}'
    foreground: '{colors.accent-ink}'
    radius: '{rounded.md}'
    min-height: '{spacing.touch-target}'
    type: '{typography.title}'
---

## Brand & Style

NutriClaude n'est pas une app de nutrition. C'est **une liste de courses partagée** qui apparaît là où le foyer est — l'écran de la cuisine, le téléphone dans le caddie, l'enceinte du plan de travail, une conversation avec Claude. La promesse est émotionnelle avant d'être fonctionnelle : *« que ma femme et moi mangions bien sans y penser »*. Le langage visuel doit donc respirer la chaleur d'une cuisine du soir, jamais la froideur d'un tableau de bord logiciel.

Le vocabulaire visuel — **verre translucide, profondeur par halos, gros compteur, grosse coche** — est hérité de la référence premium fournie (`imports/reference-premium-dashboard.html`). Ce qui a changé, et qui est verrouillé : la couleur-signature devient l'**abricot** (chaleur, appétit, « la bouffe »), le vert menthe de la référence est écarté, et le fond sombre bascule d'un indigo froid vers une base **aubergine/espresso chaude** qui enveloppe l'abricot au lieu de le faire trancher. Deux thèmes complets — clair et sombre — remplacent le dark `#0f1117` câblé en dur du code actuel ; l'app suit le réglage système du téléphone.

La discipline centrale : **une seule couleur.** L'abricot est réservé à l'action courses (le compteur, la coche, la provenance, la tuile Courses). Partout ailleurs, tout est neutre. Une pastille abricot veut toujours dire « ça concerne tes courses » — jamais « c'est joli ».

## Colors

Palette monochrome chaude + un accent unique. Le reste du spectre est banni.

- **Abricot (`{colors.accent}` #FFA94D)** — la couleur-signature, et la seule. Réservée à l'action courses : le gros compteur, la coche cochée, l'icône de provenance active, la tuile Courses du dashboard, la pastille « arrive… ». Sur le fond sombre chaud, elle atteint ~9,7:1 (AA à toutes tailles). **Jamais décorative, jamais du chrome, jamais un badge d'état générique.**
- **Abricot fort (`{colors.accent-strong}` #F5912B)** — variante pour les **aplats** du thème clair (coche cochée, halo de la tuile), où l'abricot pur manque de densité sur blanc. ⚠️ En **texte/compteur** sur fond clair, #F5912B tombe à ~2:1 — **sous AA**. Pour tout accent porteur de texte sur clair, utiliser `{colors.accent-text-light}` (#C2410C, ~4,5:1). Voir Do's & Don'ts.
- **Encre accent (`{colors.accent-ink}` #3A1E04)** — l'unique couleur posée *sur* un aplat abricot : le trait de la coche, le texte du bouton d'action. ~8:1 sur abricot.
- **Fond sombre (`{colors.surface-base-dark}` #191016)** — aubergine/espresso. Ce n'est pas un noir : c'est une base chaude, cuisine du soir, cohérente avec l'accent. Dégradé et halos décrits en *Elevation & Depth*.
- **Fond clair (`{colors.surface-base}` #F4F1EA)** — blanc cassé chaud, pensé pour le cas « plein soleil, écran à bout de bras » au supermarché. Cartes en blanc pur (`{colors.surface-card}`).
- **Texte (`{colors.text}` clair / `{colors.text-dark}` sombre)** — encre principale. **Muted** (`{colors.muted}` / `{colors.muted-dark}`) porte **tout texte secondaire à valeur d'information** : quantités actives, ratio `n/total`, horodatage de provenance, provenance texte, séparateur « Dans le panier », ligne « Rangée dans l'ordre… ». Il atteint AA sur les fonds réels (5,15:1 sur carte blanche, 8,06:1 sur verre). **Muted-2** (`{colors.muted-2}` / `{colors.muted-2-dark}`) est **strictement réservé au non-essentiel** : l'atténué d'un article *déjà coché* (quantité/provenance devenues redondantes), une note italique. **Règle dure : aucun texte porteur d'information n'est en muted-2** — l'ancien #A2A79A y tombait à ~2,46:1 (sous AA). Sur le fond réel (verre translucide `#261d23`, pas la base pleine), tout gris porteur doit atteindre 4,5:1 ; tout composant non-textuel (contour de coche, icône porteuse) 3:1.
- **Bandeau hors-ligne** — teinte propre, ni rouge ni alerte : ambre discret sur clair (`{colors.offline-bg}` / `{colors.offline-text}` #7E6224, 5,20:1 AA), verre neutre sur sombre. Le hors-ligne est un mode nominal, pas une erreur (NFR-1) : il ne doit jamais *rougir*.
- **Anneau de focus** (`{colors.focus-ring-light}` #C2410C / `{colors.focus-ring-dark}` #FFA94D) — voir *Focus & clavier* sous Components. C'est le seul autre usage légitime de l'abricot (surfaces de saisie), car un focus courses reste dans le registre courses.

Interdit : le rouge d'erreur (le hors-ligne n'est pas une panne), toute seconde couleur chromatique, les dégradés multicolores, l'abricot en décoration.

## Typography

Deux familles, deux rôles.

- **Humaniste arrondie** (`ui-rounded` / SF Pro Rounded, fallback Nunito/Figtree) pour les **titres et le gros compteur** — le registre « sans y penser », familier, chaleureux. Elle porte le compteur (`{typography.counter}` 48px/800 sur téléphone, `{typography.counter-dashboard}` 40px sur dashboard), l'horloge, et les titres courts. `[ASSUMPTION]` La webfont de secours Android reste à confirmer au *finalize* sous contrainte de légèreté PWA (NFR-10/11) — préférer le stack système partout où il rend, ne charger un fichier que si Android l'exige.
- **Sans-serif neutre lisible** (`ui-sans-serif`, système) pour tout le reste : libellés d'articles (`{typography.body}` 15px), eyebrows de rayon (`{typography.eyebrow}` 11px capitales), méta et provenance (`{typography.meta}`), quantités (`{typography.qty}`).

**Règle dure : `tabular-nums` partout où un chiffre s'affiche** — compteurs, quantités, ratios n/total des rayons, horloge. Les colonnes de chiffres ne doivent jamais sautiller quand la valeur change (une coche fait passer « 12 » à « 11 »).

Les capitales sont réservées aux eyebrows (noms de rayon, « DANS LE PANIER »). Le corps n'est jamais en capitales.

**Plancher « lisible à un mètre » (FR-24), surface dashboard.** Le gros compteur ne suffit pas : *tout* le contexte porteur du dashboard doit se lire à distance. Planchers **fermes** : corps dashboard (menu du jour, peek des derniers ajouts) `{typography.body-dashboard}` **≥ 18px**, méta dashboard (horodatage de provenance, jour) `{typography.meta-dashboard}` **≥ 15px**. La graisse ≥ 500 sur le corps dashboard aide à distance. Le 12px reste réservé aux surfaces **tenues en main** (téléphone) ; il est **interdit** pour un texte porteur sur le dashboard.

## Layout & Spacing

Échelle : 4 / 8 / 12 / 16 / 20 / 24 px, plus des tokens nommés pour les invariants tactiles. L'espace inter-cartes est `{spacing.gutter}` (14px) ; le padding interne des cartes `{spacing.card-padding}` (12px) ; la marge latérale de l'écran liste `{spacing.screen-margin}` (8px seulement — l'écran est tenu à une main, chaque pixel de largeur sert le contenu).

**L'écran liste est colonne unique, sans exception, et n'impose jamais de défilement horizontal** (NFR-3). C'est le seul écran dont l'ergonomie mobile n'est pas négociable : téléphone à une main, caddie dans l'autre. Le menu et les recettes (surface web) peuvent respirer au grand écran.

Cibles tactiles : ligne-article `{spacing.item-min-height}` (46px téléphone, 48px dashboard), coche `{spacing.checkbox-size}` (25/26px) mais zone de tap étendue à toute la ligne. Plancher tactile absolu `{spacing.touch-target}` (44px).

## Elevation & Depth

La profondeur vient du **verre et de la lumière**, pas des bordures dures.

- **Sombre** — le fond n'est jamais plat : base `{colors.surface-base-dark}`, dégradé linéaire 160deg de `{colors.surface-base-dark-2}` (#211318) vers `{colors.surface-base-dark-3}` (#2A1512), plus deux **halos radiaux discrets** terracotta et prune (haut-gauche, bas-droite). Ambiance enveloppante, cuisine du soir. Les cartes flottent en **verre translucide** (`{colors.surface-card-dark}`, rgba blanc .055) avec bordure `{colors.card-border-dark}`.
- **Clair** — base `{colors.surface-base}` avec un léger radial blanc en haut-gauche et un linéaire 160deg vers un crème rosé. Les cartes sont en blanc pur, posées par une **ombre douce et chaude** (`0 6px 18px rgba(60,50,30,.06)`) — pas de bordure dure.
- **Le halo abricot** est le seul accent lumineux : la tuile Courses porte `0 0 26px {colors.accent-soft-dark}`. C'est la signature de profondeur, réservée à l'objet le plus important de l'écran.

Pas d'ombres portées dures, pas d'élévation en escalier. La hiérarchie vient du fond, du verre et de la typo.

## Shapes

- **Coche** — `{rounded.sm}` (8px), carrée-adoucie. Case de `{spacing.checkbox-size}` (25px téléphone, 26px dashboard). C'est le geste le plus gros et le plus fréquent de l'écran : la case est généreuse, jamais un rond, jamais minuscule. **Contraste (non négociable) : le contour de la coche vide doit atteindre ≥ 3:1 contre la surface de carte sur laquelle il repose, dans les DEUX thèmes** — c.-à-d. contre la carte blanche `#FFFFFF` en clair (contour `{colors.checkbox-empty}` #83887B = 3,64:1) et contre le verre translucide `#261d23` en sombre (contour `{colors.checkbox-empty-dark}` #828AA3 = 4,77:1), **jamais évalué contre la base pleine**. Contour ≥ 2px (`{components.coche.border-width}`) + léger fond interne (`fill-empty`) pour asseoir l'affordance au-delà du seul trait, essentiel au cas **plein soleil, écran à bout de bras**.
- **Cartes-rayon et tuiles** — `{rounded.md}` (14px).
- **Grandes cartes** — `{rounded.lg}` (20px).
- **Conteneur dashboard** — `{rounded.xl}` (22px).
- **Pastilles, chips, séparateurs pilulés** — `{rounded.pill}` (20px et plus), profil pilule.

Registre : arrondi tiède, ni angle vif (trop « logiciel »), ni tout-rond (trop « gadget »). Les images suivent le rayon de leur conteneur.

## Components

> **Maquettes de référence** (tokens finals, contrastes recalculés) : [`mockups/liste-et-dashboard.html`](mockups/liste-et-dashboard.html) — écran pivot (téléphone clair + sombre) et dashboard cuisine ; [`mockups/grille-menu.html`](mockups/grille-menu.html) — grille du menu (web). Référence d'origine (langage visuel hérité) : [`imports/reference-premium-dashboard.html`](imports/reference-premium-dashboard.html). **En cas de conflit entre une maquette et ce document, ce document (le spine) fait foi** — les maquettes illustrent, elles ne décident pas.

- **Tuile Courses** (`tuile-courses`) — l'objet-vedette du dashboard. Verre `{colors.surface-card-dark}`, **bordure abricot** `{colors.accent}` + **halo** `0 0 26px {colors.accent-soft-dark}` (seule carte à porter l'accent). En-tête : icône panier dans une pastille voilée abricot + « Courses ». **Compteur géant** `{typography.counter-dashboard}` en `{colors.accent}`. En dessous : *peek* des derniers ajouts (`{typography.body-dashboard}` ≥18px, `Poivrons, Lait, Café +9`, noms en texte plein sur fond muted) et **horodatage de provenance** (« maj vocale il y a 2 min ») en `{colors.muted-dark}`, taille `{typography.meta-dashboard}` ≥15px — porteur et lisible à 1 m (FR-24).
- **Carte-rayon** (`carte-rayon`) — en-tête : **icône emoji du rayon** (🥬 🥛 🧺… — héritée de `aisles.icon`) dans une pastille `{rounded.sm}` voilée abricot, + nom du rayon en `{typography.eyebrow}` (capitales), + ratio `n/total` en `{typography.qty}` aligné à droite. Corps : la liste des lignes-articles.
- **Ligne-article** (`ligne-article`) — de gauche à droite : **coche** / **libellé** (`{typography.body}`) / **pastille « arrive… »** si en attente / **quantité** (`{typography.qty}` en `{components.ligne-article.qty-color}` = muted, AA) / **icône de provenance** micro-format. Hauteur min `{spacing.item-min-height}`, zone de tap = toute la ligne **sauf le bouton de retrait** (⚠️ révisé le 2026-08-17, story 4.5 D1 : la ligne porte un hit-target de bascule + un contrôle explicite de retrait). À l'état *acheté* : libellé **barré** + `{components.ligne-article.done-label-color}` (= **muted**, reste lisible — AA) ; la quantité et la provenance de l'article coché peuvent s'atténuer en `done-meta-color` (muted-2, admis car redondant). **Le barré + la coche pleine restent les signaux primaires de l'état acheté** (jamais la seule couleur) ; le texte doit néanmoins rester lisible pour permettre la récupération (FR-3).
- **Coche** (`coche`) — vide : contour ≥2px `{colors.checkbox-empty-dark}` (sombre) / `{colors.checkbox-empty}` (clair) **+ léger fond interne** `fill-empty(-dark)`, contour ≥3:1 contre la carte (voir *Shapes*). Cochée : aplat `{colors.accent}` (sombre) / `{colors.accent-strong}` (clair) + trait `{colors.accent-ink}`. La transition est le retour visuel du geste principal. **Sémantique : c'est un vrai contrôle (`role="checkbox"` / `<input type="checkbox">` stylé), pas un `<span>` décoratif** — voir *EXPERIENCE.Accessibility Floor*.
- **Provenance** (icônes micro-format, couleur `{components.ligne-article.provenance-color}` = **muted**, ≥3:1, **sans opacité réductrice**) — **🎙 micro = ajout vocal** (Google), **🗒 note = dictée/partage iOS**, **＋ = ajout manuel**, **🍴 = issu d'une recette**. **L'information de provenance (FR-7) ne repose JAMAIS sur la seule icône ni la seule couleur** : chaque icône porte un équivalent texte / `aria-label` (« ajouté à la voix », « dicté / partagé », « ajout manuel », « issu d'une recette ») — voir *EXPERIENCE.Component Patterns* & *Accessibility Floor*. Les **4 canaux sont distincts et confirmés** (décision Florian) : chaque source a son icône + son `aria-label`. Traçabilité FR-7 complète sur la ligne.
- **Pastille pending** (`pastille-pending`) — « arrive… », voile abricot + texte accent, profil pilule. Marque une action **non encore synchronisée** (NFR-1). Sur clair, texte en `{colors.accent-text-light}` pour tenir l'AA.
- **Séparateur « Dans le panier »** (`separateur-panier`) — eyebrow discret `{colors.muted-dark}` (clair : `{colors.muted}`) qui sépare, à l'intérieur d'un rayon, les articles à prendre (en haut) des articles déjà cochés (repoussés en bas). Repère de lecture porteur → gris AA, jamais muted-2.
- **Bandeau hors-ligne** (`bandeau-hors-ligne`) — barre pleine largeur sous l'en-tête : icône wifi barré + *« Hors ligne — tes coches partiront au retour du réseau »*. Teinte propre, jamais rouge.
- **Bouton d'action** (`bouton-action`) — aplat abricot, texte `{colors.accent-ink}`, hauteur min `{spacing.touch-target}`. C'est un usage-courses de l'accent (« Ajouter un truc »), donc légitime.
- **Focus clavier** (`focus`) — surfaces web/PWA au clavier : anneau **visible** de `{components.focus.ring-width}` (2px) `{colors.focus-ring-light}` (clair) / `{colors.focus-ring-dark}` (sombre), avec `{components.focus.ring-offset}` (2px) de dégagement, sur **tout** élément focusable (coche, ligne, bouton, champ, lien). Contour ≥ 3:1 contre l'adjacent (5,18:1 / 8,60:1). **Interdit : `outline:none` ou `-webkit-tap-highlight-color:transparent` sans remplacement visible** — les mocks `.working` suppriment le highlight, ce contour le rétablit. Le focus ne repose jamais sur la seule couleur : anneau **+** offset.

## Do's and Don'ts

| À faire | À éviter |
|---|---|
| L'abricot **uniquement** pour l'action courses (compteur, coche, provenance, tuile, pastille pending, bouton d'ajout) | L'abricot en décoration, en chrome, en fond de section, en badge d'état générique |
| Sur clair, le texte/compteur accent en `{colors.accent-text-light}` (#C2410C, AA) | Le compteur en `{colors.accent-strong}` (#F5912B) sur clair — ~2:1, échoue AA |
| `tabular-nums` sur **tout** chiffre (compteurs, quantités, ratios, horloge) | Des chiffres qui sautillent quand la valeur change |
| Deux thèmes complets, suivant le réglage système | Réintroduire un dark `#0f1117` câblé en dur, ou un thème unique |
| Fond sombre **chaud** (aubergine/espresso) + halos discrets | Un fond noir plat, ou l'indigo froid de la référence d'origine |
| État *acheté* signalé par **barré + coche pleine** (pas la seule couleur) | Distinguer *acheté* par la seule couleur |
| Coche généreuse (25–26px), zone de tap = toute la ligne **sauf le bouton de retrait** (⚠️ révisé le 2026-08-17, story 4.5 D1 : la ligne porte un hit-target de bascule + un contrôle explicite de retrait) | Une case minuscule, un rond, une cible tactile < 44px |
| Contour de coche vide ≥ 3:1 **contre la carte** (blanc / verre), contour ≥2px + fond interne | Un contour de coche jugé contre la base pleine, ou si pâle qu'il disparaît en plein soleil (#C9CCC0 ~1,6:1) |
| Texte porteur d'info en **muted** (AA sur fond réel) ; muted-2 pour le non-essentiel seul | Un texte porteur d'info en muted-2 (~2:1 sur clair), ou un gris jugé sur la base au lieu du verre/carte |
| Provenance = icône **+** équivalent texte/`aria-label` (FR-7 jamais mono-canal) | Une provenance portée par la seule icône ou la seule couleur, icône à `opacity` réduite (<3:1) |
| Dashboard : corps ≥18px, méta ≥15px (lisible à 1 m, FR-24) | Du 12px porteur sur le dashboard (illisible à un mètre) |
| Anneau de focus visible (2px + offset) sur les surfaces clavier | `outline:none` / `tap-highlight:transparent` sans remplacement |
| Coche = vrai contrôle (`role=checkbox`/`input`), compteur annoncé « 12 articles à prendre » | Une coche en `<span>` décoratif, un compteur lu « 12 » sans son libellé |
| Le hors-ligne dans une teinte neutre/ambre discrète | Rougir le hors-ligne ou l'habiller en alerte |
| Icône emoji pour chaque rayon (hérité `aisles.icon`) | Remplacer les emojis par une icônographie custom froide |
| Une seule couleur, monochrome chaud + abricot | Une seconde couleur chromatique, des dégradés multicolores |

## Lacunes & hypothèses

**Plancher d'accessibilité — DÉCISIONS FERMES (durcissement Reviewer Gate, validé Florian).** L'a11y était en [ASSUMPTION] faute de source (addendum §6) ; elle est désormais **spécifiée**, plus une hypothèse ouverte. Corrections appliquées et recalculées :
- **Coche vide** — `checkbox-empty` #C9CCC0→**#83887B** (3,64:1 carte blanche), `checkbox-empty-dark` #59617A→**#828AA3** (4,77:1 verre) ; contour ≥2px + fond interne. Règle ≥3:1 contre la carte inscrite en *Shapes*/*Components*.
- **Gris porteurs** — rôle réassigné : tout texte d'info secondaire passe en **muted** (AA sur fond réel). `muted-2` #A2A79A→**#8B9083** et `muted-2-dark` #7D849C→**#8990A5**, restreints au non-essentiel.
- **Provenance (FR-7)** — icône ≥3:1 (muted, sans opacité) **+ équivalent texte obligatoire** (spécifié côté EXPERIENCE).
- **Dashboard 1 m (FR-24)** — planchers `body-dashboard` ≥18px / `meta-dashboard` ≥15px ajoutés.
- **Focus clavier** — tokens `focus-ring-light/-dark` + composant `focus` ajoutés (anneau visible, remplace le `tap-highlight:transparent` des mocks).
- **Bandeau hors-ligne clair** — `offline-text` #8A6D2E→**#7E6224** (5,20:1, AA).
- **État acheté** — libellé barré passe en muted (lisible, AA) ; barré + coche pleine restent les signaux primaires.

**[ASSUMPTION] restantes (non tranchées) :**
- Webfont arrondie de secours pour Android non figée — à confirmer au *finalize* sous NFR-10/11 (légèreté PWA). Stack système privilégié.
- Provenance à **4 canaux distincts confirmée** (🎙 vocal · 🗒 dictée/partage · ＋ manuel · 🍴 recette), chacun icône + `aria-label`. ~~[ASSUMPTION]~~ tranchée par Florian.
- Valeurs exactes des halos radiaux (rayon, opacité, position) reprises des mocks `.working` ; réglage fin laissé au *finalize*. **Note :** les seuils de contraste des gris porteurs et de la coche ont été calculés contre les fonds composés (verre `#261d23`, halo terracotta `#36221f`, blanc) — un réglage des halos plus clairs devra re-vérifier muted-2-dark (marge actuelle 4,69:1 en halo).

**#F5912B en texte sur clair — RÉSOLU :** #F5912B reste réservé aux aplats (coche cochée, halo) ; tout accent porteur de texte sur clair utilise `{colors.accent-text-light}` #C2410C (4,59:1 base / 5,18:1 carte, AA). Décision actée.

**FR/NFR à impact visuel — couverture :** FR-2 (carte-rayon + emoji), FR-3 (coche + barré + séparateur panier), FR-7 (provenance iconifiée), FR-9 (rayon « À classer » = variante carte-rayon, jamais masquée), FR-24/FR-44 (tuile Courses + tuile menu du jour, lisibles à distance), NFR-1 (bandeau hors-ligne + pastille pending), NFR-3 (colonne unique, pas de scroll horizontal), NFR-8/NFR-9 (copy française, aucun jargon) — **tracés**.

**Hors périmètre DESIGN.md (relèvent d'EXPERIENCE.md ou de surfaces non maquettées) :** écrans d'authentification/onboarding, code d'invitation (FR-40/41), écran profil/membres (FR-42), éditeur de recettes et grille de menu (FR-15/18/51), écran des rayons/règles (FR-11/12/13). Aucune identité visuelle n'a été élicitée pour ces écrans web ; ils héritent des tokens ci-dessus mais leur composition n'est pas spécifiée ici.
