import { estSurfaceConnue, type Surface } from "./surfaces.ts";

/**
 * Ce qu'on affiche de la provenance d'un article (FR-7, story 4.6).
 *
 * ⛔ **PRÉSENTATION SEULEMENT.** Le vocabulaire des surfaces vit dans `surfaces.ts` — correctif de
 * la revue du 2026-08-20 : les deux étaient dans ce fichier, ce qui obligeait la couche de lecture
 * à importer la microcopie pour atteindre un prédicat de schéma.
 */

/**
 * Une provenance affichable : une icône **et** son équivalent texte.
 *
 * ⛔ **LES DEUX SONT INDISSOCIABLES, ET C'EST UX-DR6.** « Provenance jamais mono-canal : l'icône
 * est **doublée d'un équivalent texte / `aria-label`** — de sorte qu'un daltonien, un malvoyant ou
 * un lecteur d'écran distingue la source sans la couleur ni la forme. » Le type les tient ensemble
 * pour qu'on ne puisse pas rendre l'une sans l'autre.
 */
export type Provenance = { icone: string; texte: string };

/*
 * Les quatre canaux, dans les termes exacts d'`EXPERIENCE.md:148`.
 *
 * ⚠️ **Chacun est NOMMÉ**, y compris ceux que plusieurs surfaces partagent — correctif de la
 * revue : trois littéraux identiques étaient recopiés, si bien que changer « ajout manuel »
 * demandait trois éditions cohérentes que rien ne vérifiait.
 *
 * ⛔ **`︎` (VS15) FORCE LA PRÉSENTATION TEXTE — correctif de la revue du 2026-08-20.**
 * Sans lui, `🍴` est `Emoji_Presentation` : il est peint par la police emoji du système, en
 * couleur, et `--provenance-color` n'a **aucun effet** dessus. Le plancher « icône ≥ 3:1 » de
 * l'AC2 n'était donc démontré que pour le token, jamais pour le glyphe qui porte l'information.
 * ⚠️ `＋` (U+FF0B) est déjà un caractère texte et n'en a pas besoin.
 */
const AJOUT_MANUEL: Provenance = { icone: "＋", texte: "ajout manuel" };
const A_LA_VOIX: Provenance = { icone: "🎙︎", texte: "ajouté à la voix" };
const DICTE: Provenance = { icone: "🗒︎", texte: "dicté / partagé" };
const DEPUIS_RECETTE: Provenance = { icone: "🍴︎", texte: "issu d'une recette" };

/**
 * Six surfaces, trois canaux — le quatrième est la recette, et il vit dans `DEPUIS_RECETTE`.
 *
 * ⚠️ **`pont` et `voix` partagent le canal micro** : le pont Google est le chemin par lequel un
 * article dicté à l'assistant arrive (AD-12). Pour le membre c'est « ajouté à la voix » — il n'a
 * pas à connaître la plomberie, et `project-context.md` **bannit le mot « pont »** de toute chaîne
 * rendue.
 *
 * ⚠️ **`mcp` est rangé en « ajout manuel »** : un article demandé à Claude a bien été voulu par un
 * humain. À réexaminer en Epic 7 — la donnée, elle, reste distincte en base.
 */
const PAR_SURFACE: Record<Surface, Provenance> = {
  web: AJOUT_MANUEL,
  dashboard: AJOUT_MANUEL,
  mcp: AJOUT_MANUEL,
  voix: A_LA_VOIX,
  pont: A_LA_VOIX,
  dictee: DICTE,
};

/**
 * La provenance d'un article, ou `null` s'il n'en porte aucune de connue.
 *
 * ⛔ **`null` N'EST PAS UN DÉFAUT À REMPLACER — c'est la règle §1 appliquée à l'écran.** Un
 * article sans provenance connue n'en affiche aucune : retomber sur ＋ « ajout manuel »
 * affirmerait une origine qu'on ignore.
 *
 * ⛔ **LE GARDE EST `== null`, PAS `!== null` — correctif de la revue du 2026-08-20.** Mesuré :
 * avec `recipeId: undefined`, l'ancienne rédaction rendait 🍴 « issu d'une recette » **pour tous
 * les articles de la liste**. Or « la valeur arrive `undefined`, silencieusement, jamais en
 * erreur » est précisément le mode de défaillance que cette story invoque pour se justifier — le
 * garde n'y résistait pas. `== null` couvre `null` ET `undefined`.
 *
 * ⛔ **UN `recipeId` ABSENT NE PROUVE RIEN.** `grocery_list_items.recipe_id` est
 * `on delete set null` : un article issu d'une recette **supprimée depuis** perd sa recette sans
 * disparaître. C'est la surface qui tranche, jamais l'absence de recette.
 *
 * ⚠️ **La recette l'emporte sur la surface**, dans l'ordre de l'AC2.
 */
export function provenanceDe(article: {
  surface: string | null;
  recipeId: string | null;
}): Provenance | null {
  if (article.recipeId != null) return DEPUIS_RECETTE;
  if (!estSurfaceConnue(article.surface)) return null;
  return PAR_SURFACE[article.surface];
}
