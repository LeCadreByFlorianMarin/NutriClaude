import { Children } from "react";

import { iconeDeRayon, libelleRatio, nomDeRayon } from "@/lib/rayons/carte";

/**
 * Le contrat de la carte-rayon, figé par la décision D2 de la story 2.4.
 *
 * ⚠ **Exporté délibérément** : les stories 4.2, 4.17 et 4.18 doivent s'y
 * conformer, et un type littéral anonyme ne se nomme pas. Toute divergence se
 * **signale** plutôt que de s'adapter en place (Task 2 de la 4.2).
 */
export type ProprietesCarteRayon = {
  /**
   * L'identifiant du rayon — `null` pour « À classer », qui n'en a pas.
   *
   * ⚠ **Il est dans le contrat et n'est LU par rien, délibérément.** La story
   * 4.18 (déplacer un article vers le bon rayon) en aura besoin, et le contrat
   * est annoncé à trois stories : l'exiger dès maintenant fige la signature
   * pendant qu'elle n'a encore aucun appelant.
   *
   * ⚠ **L'argument d'origine — « l'ajouter plus tard obligerait à toucher les
   * trois appelants » — ne tient PAS, et il est retiré** (seconde passe de
   * revue, 2026-08-07). Il n'est vrai que d'une propriété *requise* : un
   * `id?: string | null` ajouté à la 4.18 compilerait chez les trois appelants
   * sans une ligne de changement. Ce qui reste vrai est le choix de le rendre
   * **obligatoire** dès maintenant, pour qu'aucun appelant ne l'oublie.
   *
   * ⛔ **Conséquence à connaître : rien ne le valide.** Ni test, ni typecheck,
   * ni lint jusqu'à la 4.18 — un appelant qui y passerait l'identifiant de
   * l'article ne serait repris par aucune porte.
   */
  id: string | null;
  /** `null` quand le rayon n'est pas résolu — le repli vit dans `nomDeRayon`. */
  nom: string | null;
  /** `null` est fréquent : `aisles.icon` est nullable, et la vue rend `null`. */
  icone: string | null;
  /**
   * Le nombre d'articles pris. Absent ou `null` = pas de ratio du tout.
   * L'AC1 le conditionne à « recevoir un compte d'articles ».
   *
   * ⛔ **`pris`/`total` et `children` DOIVENT être dérivés du MÊME tableau,
   * dans la même expression.** La carte ne peut pas le vérifier : l'AC3 lui
   * interdit de connaître le type des articles qu'elle enveloppe. Un appelant
   * qui filtrerait les enfants en comptant sur la liste non filtrée ferait
   * annoncer « 3 sur 5 pris » au-dessus de 4 lignes, et **aucune porte ne le
   * verrait**. Contrat gelé par D2 : l'obligation reste chez l'appelant.
   */
  pris?: number | null;
  total: number;
  /** Vide est un cas nominal (AC2) : un rayon sans article reste une carte. */
  children?: React.ReactNode;
};

/**
 * La carte d'un rayon : son icône, son nom, son ratio, et ses articles.
 *
 * **Le composant qui fait que « chaque rayon se présente partout de la même
 * façon »** — l'écran de la liste (story 4.2), le groupe « À classer » (4.17) et
 * le dashboard (Epic 5) le montent tous. C'est aussi pourquoi il ne lit rien :
 * il reçoit **tout** en propriétés, et ne connaît ni la base ni le type des
 * articles qu'il enveloppe.
 *
 * ⚠ **CE FICHIER N'EST TENU PAR AUCUN TEST**, et ce n'est pas un oubli :
 * `node --test` refuse un `.tsx` (`ERR_UNKNOWN_FILE_EXTENSION`). Tout ce qui
 * pouvait sortir d'ici est dans `lib/rayons/carte.ts`, qui **est** testé — y
 * compris le nettoyage qui décide si la pastille s'affiche. Ce qui reste — les
 * classes, la structure, l'`aria-hidden` — ne se vérifie qu'à l'œil.
 * ⚠ **La version datée de cette contrainte, et ce qu'elle n'implique PAS, vit
 * dans `lib/rayons/carte.ts`** — une seule copie fait foi.
 *
 * ⚠ **`aria-hidden` sur l'emoji, et c'est UX-DR4.** Le nom du rayon est en texte
 * juste à côté : le lire deux fois n'apporte rien à qui écoute.
 */
export function CarteRayon({
  id: _id,
  nom,
  icone,
  pris,
  total,
  children,
}: ProprietesCarteRayon) {
  const ratio = libelleRatio({ pris, total });
  const emoji = iconeDeRayon(icone);

  return (
    /*
     * ⚠ **L'OMBRE ET LA BORDURE NE FONT PAS LE MÊME TRAVAIL SELON LE THÈME**, et
     * les deux sont dues :
     *   · en CLAIR, `--card-shadow` pose la carte sur le fond (DESIGN.md donne à
     *     la carte-rayon exactement la valeur de ce token) ;
     *   · en SOMBRE, `--card-shadow` vaut `none` — « la profondeur vient du
     *     verre, pas de l'ombre » — et `--surface-card` n'est que 5,5 % de
     *     blanc. **La bordure est alors le seul séparateur.**
     * La story 2.2 s'est fait prendre par la moitié sombre : sa ligne tirée
     * était transparente, deux noms superposés, cinq portes vertes et zéro
     * signal. Retirer l'un ou l'autre casse un thème et pas l'autre.
     *
     * ⚠ `box-shadow` en style en ligne : `var(--card-shadow)` n'a pas
     * d'utilitaire publié, et `.card` — qui l'applique — est en `rounded-lg`
     * (20px) + `p-4`, quand la carte-rayon veut `rounded-md` (14px) + `p-card`.
     */
    <section
      className="rounded-md border border-card-border bg-surface-card p-card"
      style={{ boxShadow: "var(--card-shadow)" }}
    >
      <div className="flex items-center gap-2">
        {/*
         * ⚠ **La boîte est TOUJOURS rendue, l'aplat abricot ne l'est pas.**
         * Deux exigences qui semblaient s'exclure, et qui ne s'excluent pas :
         *   · la story impose une **largeur fixe** pour que les noms de deux
         *     cartes voisines restent alignés (`ListeRayons.tsx:932` fait de
         *     même avec `w-6 shrink-0`) ;
         *   · UX-DR2 interdit l'abricot décoratif, a fortiori un carré vide.
         * Garder la gouttière et ne poser `bg-accent-soft` que s'il y a
         * quelque chose à montrer tient les deux.
         *
         * ⛔ **Le cas « pas d'icône » n'est PAS marginal** : la vue fait un
         * `left join`, donc le groupe « À classer » rend `aisle_icon = null` et
         * n'a aucune ligne `aisles` où en poser une. C'est la première carte que
         * la story 4.2 affichera. Et `normaliserIcone` rend `null` sur champ
         * vide : tout rayon créé par un membre peut être sans icône.
         */}
        <span
          aria-hidden
          className={[
            "grid size-6 shrink-0 place-items-center rounded-sm",
            emoji ? "bg-accent-soft" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {emoji}
        </span>

        {/*
         * `<h2>` : les surfaces qui montent cette carte rendent un `<h1>`
         * d'écran au-dessus, et sauter un niveau casse la navigation par titres.
         *
         * `min-w-0` + `break-all` : le nom est un champ libre, sans garantie
         * d'espace où couper. Sans `min-w-0`, un nom long élargit le conteneur
         * flex et fait défiler l'écran horizontalement — ce que NFR-3 interdit
         * sur la liste.
         *
         * ⚠ **Le bornage n'est PAS acquis à cet endroit, et c'est `nomDeRayon`
         * qui le pose.** Mesuré à la seconde passe du 2026-08-07 : `aisles` ne
         * porte aucune contrainte de longueur en base — `MAX_NOM_RAYON` vit
         * dans la saisie client — et la carte reçoit son nom d'une vue.
         */}
        <h2 className="text-eyebrow min-w-0 flex-1 break-all uppercase">
          {nomDeRayon(nom)}
        </h2>

        {/*
         * ⛔ **L'ANNONCE PASSE PAR UN JUMEAU `.sr-only`, JAMAIS PAR
         * `aria-label`.** Un `<span>` nu porte le rôle `generic`, qui est
         * *name-prohibited* en ARIA 1.2 : le nom accessible retombe sur le
         * texte, et le lecteur d'écran annonce « trois barre oblique quatre ».
         * Le dépôt a déjà payé cette leçon sur le code d'invitation — voir
         * `globals.css` (§ `.sr-only`) et `app/foyer/InviteCard.tsx`, qui pose
         * le même couple `aria-hidden` + jumeau.
         *
         * ⚠ `text-muted`, JAMAIS `text-muted-2` : le ratio porte de
         * l'information, et `muted-2` est réservé au non-essentiel
         * (`globals.css:56`). Il compile sans broncher si on l'écrit.
         *
         * ⚠ `tabular-nums` sur l'élément : il ne se porte pas sur le token
         * `--text-qty`. Sans lui, le ratio sautille quand une coche fait passer
         * « 12 » à « 11 » (UX-DR12).
         */}
        {ratio ? (
          <>
            <span
              aria-hidden
              className="text-qty shrink-0 text-muted tabular-nums"
            >
              {ratio.visible}
            </span>
            <span className="sr-only">{ratio.pourLecteur}</span>
          </>
        ) : null}
      </div>

      {/*
       * Le corps. `children` est rendu tel quel : la carte ne sait pas ce qu'on
       * y met — une liste d'articles en 4.2, autre chose ailleurs. La marge est
       * posée ICI plutôt que chez l'appelant, sans quoi chaque surface la
       * redéciderait.
       *
       * ⚠ Un rayon SANS article est un cas nominal (AC2) : le conteneur n'est
       * alors pas rendu du tout, pour ne pas payer une marge sous rien.
       *
       * ⛔ **`Children.count`, JAMAIS une vérité nue sur `children`.** Mesuré à
       * la seconde passe de revue du 2026-08-07, sur le HTML prérendu :
       * `Boolean([])` vaut **vrai**, donc `{children ? …}` rendait bien un
       * `<div class="mt-2"></div>` vide — 8 px sous rien, exactement ce que le
       * paragraphe ci-dessus prétendait éviter. ⚠ **Et le cas n'est pas
       * marginal : c'est celui de la 4.2**, dont l'idiome est
       * `{articles.map(…)}` — qui rend `[]` pour un rayon vide, le cas que
       * l'AC2 déclare nominal. Trois couches de revue aveugles l'une à l'autre
       * l'ont trouvé indépendamment ; aucune porte automatique ne le voyait.
       */}
      {Children.count(children) > 0 ? (
        <div className="mt-2">{children}</div>
      ) : null}
    </section>
  );
}
