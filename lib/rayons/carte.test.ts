import { test } from "node:test";
import assert from "node:assert/strict";
import { iconeDeRayon, libelleRatio, nomDeRayon } from "./carte.ts";

/**
 * Le pur de la carte-rayon (story 2.4).
 *
 * **Ce que ce fichier existe pour tenir.** `CarteRayon` est un composant, et le
 * dépôt n'a aucun moyen d'en éprouver un : `node --test` refuse un `.tsx`
 * (`ERR_UNKNOWN_FILE_EXTENSION`). Tout ce qui pouvait être extrait du JSX l'a
 * donc été ici — c'est **la seule partie du composant qui aura un filet** entre
 * cette story et la 4.2. Le détail de la contrainte, et pourquoi ce n'est pas
 * « `lib/` est le seul emplacement testable », est daté dans `carte.ts`.
 *
 * ⛔ **CE QUE CES TESTS NE TIENNENT PAS.** L'invariant central — l'annonce et le
 * visible viennent de la même source — n'est tenu par **aucune assertion**, et
 * il ne peut pas l'être : un doublon aujourd'hui correct rend les mêmes valeurs,
 * donc aucune assertion ne distingue deux implémentations équivalentes.
 * ⚠ **Il n'est pas non plus tenu par construction, contrairement à ce que ce
 * fichier a affirmé jusqu'au 2026-08-07** : mesuré à la seconde passe de revue,
 * réécrire la dérivation en construction parallèle laisse la suite verte
 * (216/216). Le test ci-dessous épingle la **forme** de la dérivation ; c'est
 * tout ce qui existe, et c'est une convention, pas une garantie.
 */

// ── libelleRatio ─────────────────────────────────────────────────────────

test("le ratio rend la forme visible ET sa lecture, depuis le même appel", () => {
  assert.deepEqual(libelleRatio({ pris: 3, total: 4 }), {
    visible: "3/4",
    pourLecteur: "3 sur 4 pris",
  });
});

test("l'annonce garde la forme du visible sur toute la plage", () => {
  /*
   * ⚠ Ce test n'attrape PAS un doublon numériquement équivalent — rien ne le
   * peut, voir l'en-tête. Ce qu'il tient : le jour où quelqu'un changera la
   * forme visible (un « sur », un espace, un séparateur), l'annonce suivra ou
   * ce test tombera.
   */
  for (const [pris, total] of [
    [0, 1],
    [3, 4],
    [7, 7],
    [5, 4],
    [-2, 9],
  ]) {
    const ratio = libelleRatio({ pris, total });
    assert.notEqual(ratio, null);
    const [numerateur, denominateur] = ratio!.visible.split("/");
    assert.equal(ratio!.pourLecteur, `${numerateur} sur ${denominateur} pris`);
  }
});

test("un rayon dont rien n'est pris rend bien `0/4`", () => {
  /*
   * ⚠ Le cas nominal jusqu'à la story 4.3 : la vue `grocery_list_by_aisle`
   * filtre `status = 'pending'`, donc `pris` vaut structurellement 0 tant que
   * rien ne coche. La story 4.2 prévient son relecteur qu'il verra des `0/n` —
   * rendre `null` ici la contredirait.
   */
  assert.deepEqual(libelleRatio({ pris: 0, total: 4 }), {
    visible: "0/4",
    pourLecteur: "0 sur 4 pris",
  });
});

test("un rayon VIDE n'a pas de ratio du tout", () => {
  // `0/0` n'apprend rien, et l'annoncer au lecteur d'écran est du bruit.
  assert.equal(libelleRatio({ pris: 0, total: 0 }), null);
  assert.equal(libelleRatio({ total: 0 }), null);
});

test("un total négatif n'a pas de ratio non plus", () => {
  // ⚠ Trou mesuré à la revue du 2026-08-07 : le garde `total <= 0` n'était
  // couvert que par le cas `0`. Muté en `total === 0`, la suite restait verte
  // alors qu'un total de -3 rendait « -3 sur -3 pris ».
  assert.equal(libelleRatio({ pris: 2, total: -1 }), null);
  assert.equal(libelleRatio({ pris: 0, total: -3 }), null);
});

test("sans compte de pris, il n'y a ni ratio ni annonce", () => {
  /*
   * `pris` est optionnel : l'AC1 conditionne le ratio à « recevoir un compte
   * d'articles ». Une surface de configuration (qui n'a pas d'articles) peut
   * donc monter la carte sans mentir.
   */
  assert.equal(libelleRatio({ total: 4 }), null);
});

test("un compte NUL n'est pas un compte de zéro", () => {
  // ⚠ Une colonne de comptage vide rendait `"0/4"` — la carte affirmait
  // « aucun article pris » là où l'appelant n'avait rien à dire.
  assert.equal(libelleRatio({ pris: null, total: 4 }), null);
});

test("le ratio ne rend jamais une valeur incohérente", () => {
  /*
   * ⚠ `pris > total` ne devrait pas arriver, mais la carte reçoit ses chiffres
   * en propriétés : elle ne contrôle pas qui les calcule. Afficher « 5/4 »
   * serait un défaut visible et inexplicable ; on borne plutôt que d'y croire.
   */
  assert.deepEqual(libelleRatio({ pris: 5, total: 4 }), {
    visible: "4/4",
    pourLecteur: "4 sur 4 pris",
  });
});

test("un compte négatif est ramené à zéro plutôt que rendu", () => {
  // ⚠ `deepEqual` plutôt qu'un déréférencement `!` : une régression vers `null`
  // nommerait le comportement tombé au lieu de rendre un `Cannot read
  // properties of null`. Et il épingle en prime qu'aucun champ n'est apparu.
  assert.deepEqual(libelleRatio({ pris: -2, total: 4 }), {
    visible: "0/4",
    pourLecteur: "0 sur 4 pris",
  });
});

test("un chiffre qui n'est pas un entier fini ne s'affiche pas", () => {
  /*
   * ⛔ Trou mesuré à la revue du 2026-08-07. `Math.min`/`Math.max` PROPAGENT
   * `NaN` : le bornage laissait passer « NaN sur 4 pris » jusqu'au lecteur
   * d'écran. Et `NaN <= 0` étant faux, un total `NaN` franchissait aussi le
   * garde du rayon vide.
   */
  assert.equal(libelleRatio({ pris: NaN, total: 4 }), null);
  assert.equal(libelleRatio({ pris: 3, total: NaN }), null);
  assert.equal(libelleRatio({ pris: 3, total: Infinity }), null);
  assert.equal(libelleRatio({ pris: Infinity, total: 4 }), null);
  assert.equal(libelleRatio({ pris: 2.5, total: 4 }), null);
  assert.equal(libelleRatio({ pris: 1, total: 4.7 }), null);
});

// ── nomDeRayon ───────────────────────────────────────────────────────────

test("un rayon nommé garde son nom", () => {
  assert.equal(nomDeRayon("Fruits & légumes"), "Fruits & légumes");
});

test("un nom entouré de blancs est rogné", () => {
  // ⚠ Trou mesuré à la revue du 2026-08-07 : seul le cas « tout en blancs »
  // était couvert. Rendre le nom NON rogné laissait la suite verte, alors que
  // c'est un comportement visible — la carte affiche « Fruits », pas « Fruits ».
  assert.equal(nomDeRayon("  Fruits & légumes  "), "Fruits & légumes");
});

test("un rayon SANS nom rend le repli, et c'est le cas « À classer »", () => {
  /*
   * ⚠ **Ce repli est TECHNIQUE, pas une décision de microcopy.** La vue
   * `grocery_list_by_aisle` rend `aisle_name = null` pour un article dont le
   * rayon n'est pas résolu (`left join`), et la story 4.2 type donc son groupe
   * `nom: string | null`. Sans ce repli, elle se retrouverait avec `null` face à
   * une propriété `string`, et personne ne posséderait le libellé.
   *
   * **La story 4.17 garde le dernier mot** : c'est elle qui possède le groupe
   * « À classer » et son libellé définitif. Le jour où elle le change, elle le
   * change ICI, à un seul endroit.
   */
  assert.equal(nomDeRayon(null), "À classer");
});

test("un nom vide ou fait de blancs retombe sur le repli", () => {
  // La base n'autorise pas un nom vide (`aisles_name_non_vide`), mais la carte
  // reçoit son nom en propriété : le composant ne peut pas le supposer.
  assert.equal(nomDeRayon(""), "À classer");
  assert.equal(nomDeRayon("   "), "À classer");
});

test("un nom fait d'INVISIBLES retombe aussi sur le repli", () => {
  /*
   * ⛔ Trou mesuré à la revue du 2026-08-07. `trim()` ne retire ni U+200B, ni
   * U+200D, ni U+2060 : `nomDeRayon("​")` rendait la chaîne telle quelle,
   * et le `<h2>` s'affichait vide sans que rien ne le signale.
   * `project-context.md` §3 : une catégorie, jamais une énumération.
   */
  assert.equal(nomDeRayon("​"), "À classer");
  assert.equal(nomDeRayon("‍"), "À classer");
  assert.equal(nomDeRayon("⁠"), "À classer");
  assert.equal(nomDeRayon("ㅤ"), "À classer");
});

test("un invisible AU MILIEU du nom est retiré, pas seulement aux bords", () => {
  // ⛔ Trou mesuré à la seconde passe du 2026-08-07 : ancrer la plage aux bords
  // de chaîne laissait la suite verte (216/216), parce que tous les cas
  // existants employaient des chaînes ENTIÈREMENT invisibles — qu'un nettoyage
  // de bord réduit déjà à "". Le comportement réel est global, et c'est lui qui
  // décide ce que le `<h2>` affiche.
  assert.equal(nomDeRayon("Fruits​légumes"), "Fruitslégumes");
});

test("un nom plus long que la borne est rogné, comme à la saisie", () => {
  /*
   * ⚠ Conséquence directe de la décision D2 (enveloppe de `normaliserNomRayon`).
   * Rien ne borne `aisles.name` en base — mesuré, la table ne porte
   * qu'`aisles_name_non_vide` — et la carte reçoit son nom d'une vue : sans ce
   * bornage, un nom écrit par une autre surface s'étirerait sans fin.
   */
  assert.equal(nomDeRayon("a".repeat(80)), "a".repeat(40));
});

// ── iconeDeRayon ─────────────────────────────────────────────────────────

test("une icône réelle est rendue telle quelle", () => {
  assert.equal(iconeDeRayon("🍎"), "🍎");
});

test("une icône absente, vide ou blanche ne rend rien", () => {
  // ⚠ Ce qui décide si la pastille abricot s'affiche. Une icône « vraie » mais
  // invisible peignait un carré abricot VIDE — UX-DR2 interdit l'abricot
  // décoratif, a fortiori sans contenu.
  assert.equal(iconeDeRayon(null), null);
  assert.equal(iconeDeRayon(""), null);
  assert.equal(iconeDeRayon("   "), null);
  assert.equal(iconeDeRayon("​"), null);
});

test("un emoji composé par ZWJ n'est PAS démembré par le nettoyage", () => {
  /*
   * ⚠ U+200D (ZWJ) est porteur de sens : 🧑‍🍳 s'écrit 🧑 + ZWJ + 🍳. C'est
   * pourquoi le nettoyage emploie `INVISIBLES_HORS_JOINTURE` et non
   * `INVISIBLES` — c'est désormais littéralement celui de `lib/rayons/saisie.ts`
   * (décision D2), et non plus une seconde rédaction qui s'en réclamait.
   *
   * ⛔ **Ce test ne couvre PAS les emoji composés qui portent U+FE0F**, et c'est
   * mesuré : ❤️ rend ❤, 🏳️‍🌈 et 1️⃣ sont démembrés. Le sélecteur de variante est
   * dans la plage, et cette assertion est le seul emoji composé qui n'en porte
   * pas — elle passe pour une raison qui ne se généralise pas. Défaut de racine
   * reporté à une story dédiée, mesures dans `deferred-work.md`.
   */
  assert.equal(iconeDeRayon("🧑‍🍳"), "🧑‍🍳");
});

test("une jointure ORPHELINE ne peint pas de pastille abricot vide", () => {
  /*
   * ⛔ Défaut mesuré à la seconde passe du 2026-08-07, puis vu sur le HTML
   * prérendu : `iconeDeRayon("‍")` rendait une chaîne VRAIE mais invisible,
   * donc un carré `bg-accent-soft` de 24 px sans contenu — exactement ce que
   * cette fonction existe pour empêcher (UX-DR2 interdit l'abricot décoratif).
   * `trim()` ne retire pas les jointures, et `INVISIBLES_HORS_JOINTURE` les
   * exclut délibérément. Fermé par l'enveloppe : `saisie.ts` avait déjà écrit
   * `JOINTURES_AU_BORD` — « au bord, une jointure ne porte aucun sens ».
   */
  assert.equal(iconeDeRayon("‍"), null);
  assert.equal(iconeDeRayon("‌"), null);
  assert.equal(iconeDeRayon("  ‍  "), null);
});

test("une icône de plusieurs graphemes est réduite au premier", () => {
  /*
   * ⚠ La propriété est typée `string`, pas « un point de code » : la pastille
   * fait 24 px et n'a ni `overflow-hidden` ni troncature, donc une icône longue
   * débordait par-dessus le `<h2>`. Conséquence de la décision D2 — la carte
   * réduit désormais comme la saisie réduit, au lieu de rendre ce qu'on lui
   * donne. ⚠ Réduire n'est pas refuser : `iconeTropLongue` est ce qui refuse,
   * et il vit sur l'écran de saisie.
   */
  assert.equal(iconeDeRayon("🍎🍏🍐"), "🍎");
  assert.equal(iconeDeRayon("Fromagerie"), "F");
});
