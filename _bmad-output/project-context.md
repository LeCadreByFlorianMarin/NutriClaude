---
project_name: 'nutriclaude'
user_name: 'Florian'
date: '2026-07-30'
sections_completed: ['technology_stack', 'critical_rules', 'method_rules']
existing_patterns_found: 12
---

# Project Context for AI Agents

_Règles et motifs que tout agent doit suivre en implémentant sur ce projet. On n'y met
que **l'inhabituel** : ce qu'un agent compétent ferait de travers faute de le savoir._

> **Pourquoi ce fichier a été rempli le 2026-07-30.** Il existait depuis le 2026-07-24 avec
> deux sections vides. Pendant ce temps, les sept règles d'équipe issues de la rétrospective
> de l'Epic 1 vivaient dans `next-steps.md §4` — un document de **planification** que
> personne ne charge au moment d'écrire du code. Trois d'entre elles sont restées « ouvertes »
> deux epics durant, et la revue du 2026-07-29 a mesuré que **deux avaient été violées par la
> passe de revue elle-même**. Une règle rangée au mauvais endroit n'est pas une règle.

---

## Règles de méthode — celles qui ont le plus coûté

Elles ne portent pas sur le code mais sur la façon de rendre compte. Chacune a un défaut
réel derrière elle, et chacune a été violée **après** avoir été écrite.

### 1. Ne consigner comme vérifié que ce qui a été exécuté, en citant la commande

Une déduction s'écrit « **déduit** », jamais « vérifié ». Un fait rapporté par quelqu'un
d'autre s'écrit « **rapporté par X** », jamais « mesuré ».

*Trois défauts en deux jours sont nés de cette seule confusion, dont un qui a atteint le
déploiement (`engines: ">=25.0.0"`, CI verte, production morte). Et le 2026-07-29, une passe
de revue a écrit « ce job ne peut pas devenir vert en n'ayant rien vérifié » — c'était faux,
`node --test` sur un glob vide rend 0.*

**Une case vide honnête vaut mieux qu'une case cochée à tort.** Les stories 1.5, 1.6, 1.7 et
2.1 ont laissé des sous-tâches non cochées avec leur raison écrite ; la revue l'a préféré à
chaque fois.

### 2. Un commentaire explique un *pourquoi*, jamais un état de la base

Un état se vérifie et se périme. S'il doit vraiment être écrit, il porte **sa date** et le
**fichier qui fait foi**.

*Cinq commentaires sont devenus faux sur ce projet, dont **quatre écrits pendant une revue**.
Exemple du 2026-07-29 : deux migrations disaient « À CONTRÔLER AVANT `db push` » alors que le
commit voisin de la même branche venait de supprimer le `db push` manuel.*

### 3. Une énumération ne peut pas gagner contre une catégorie

Quand la règle porte sur un ensemble qu'on ne contrôle pas (points de code Unicode, codes
SQLSTATE, versions), employer un **prédicat** et non une liste.

*`INVISIBLES` dans `lib/texte.ts` a été écrit deux fois comme une liste — huit points de code,
puis seize. Les deux se voulaient exhaustives, les deux étaient fausses. La catégorie `Cf`
seule en compte plusieurs centaines. La troisième rédaction emploie
`\p{Default_Ignorable_Code_Point}\p{Cc}\p{Cf}\p{Cn}`.*

### 4. Un invariant entre deux fichiers se mesure, il ne s'affirme pas

Si deux endroits doivent rester d'accord et ne peuvent pas partager le code, **un test
exécuté** dit qu'ils le sont. Un commentaire qui l'affirme sera faux un jour sans que rien
ne le dise.

*L'accord entre `lib/texte.ts` et la contrainte `aisles_name_non_vide` a été affirmé deux
fois et faux deux fois. Il est désormais mesuré par `supabase/tests/contraintes.test.ts`.*

### 5. Une prémisse qui sert à reporter un défaut se rouvre avant d'être réinvoquée

*« La base est gelée » a couvert le trou NFR-5 de `profiles_update_own` pendant tout l'Epic 1.*

### 6. Revue adversariale par story, pas en fin d'epic

**Et la passe de correction doit être revue à son tour.** *Trois des six défauts majeurs de
l'Epic 1 ont été introduits par une passe de revue. Le 2026-07-29, la seconde passe a mesuré
que la première avait réparé la moitié d'un défaut, en avait introduit trois et affirmé deux
choses fausses.*

### 7. Ce qu'aucune porte automatique ne voit

Trois familles de défaut n'ont jamais été attrapées que par un humain qui regarde :

- **Le rendu.** `typecheck`, `lint`, `test`, `build` ne voient pas un message affiché hors
  écran, un focus perdu, un thème cassé. *Le parcours à l'écran du 2026-07-29 a trouvé quatre
  défauts que 92 tests ne voyaient pas.*
- **Le déploiement.** La CI tourne sur le runtime du poste ; Vercel en construit un autre.
  Toute modification de `package.json` `engines`, `.node-version`, `next.config.ts` ou
  `vercel.json` se contrôle **sur le déploiement de la PR**.
- **L'outillage de test lui-même.** *Le stack local ne savait pas créer un compte pendant
  deux epics — `site_url` sur le mauvais port et les modèles d'email par défaut de Supabase.
  Rien ne le signalait ; il fallait essayer de s'en servir.*

---

## Contraintes techniques inhabituelles

### Tailwind 4 — la palette par défaut est neutralisée

`--color-*: initial` dans `globals.css`. **`bg-red-500`, `text-gray-400`, `bg-white` ne
génèrent plus rien et échouent EN SILENCE.** Toute couleur employée doit être un token de
`DESIGN.md`. Il n'y a **pas** de fichier de configuration Tailwind et il ne faut pas en créer :
tout passe par `@theme` / `@theme inline`. `dark:` suit `prefers-color-scheme`, aucune bascule
manuelle à écrire.

### Le thème se contrôle au réglage système, pas dans les outils de développement

`globals.css:68` lit `prefers-color-scheme`. Une émulation d'outils de développement ne prouve
rien. Sur macOS : `osascript -e 'tell application "System Events" to tell appearance
preferences to set dark mode to false'` — **et le remettre après**.

### Aucune dépendance nouvelle (NFR-10)

Ni bibliothèque de glisser-déposer, ni sélecteur d'emoji, ni gestionnaire de formulaire, ni
harnais de test de composants. `Intl.Segmenter`, `node --test` et les propriétés Unicode des
expressions rationnelles sont natifs — c'est presque toujours la réponse.

⚠ La cible TypeScript n'accepte pas le drapeau `v` des expressions rationnelles (soustraction
d'ensembles). Employer une anticipation négative : `/(?!\u200C|\u200D)[\p{Cf}]/gu`.

### Les migrations s'appliquent au déploiement, plus à la main

`vercel.json` → `scripts/migrer-au-deploiement.mjs`. Conséquences :

- **Il n'y a plus de moment « juste avant de pousser ».** La requête de contrôle en en-tête
  de migration s'exécute **en revue**, avant la fusion. `npm run check:migrations` vérifie
  qu'elle existe ; que quelqu'un l'ait exécutée reste humain.
- `supabase db push` **n'est pas atomique sur un lot** : sur deux migrations dont la seconde
  échoue, la première est appliquée et enregistrée. C'est l'**additivité** qui rend cet état
  supportable, pas une propriété du script.
- `db reset` est l'outil **normal en local**, interdit sur le distant.
- `supabase gen types` s'emploie avec **`--local`**, pas `--linked` : le distant n'a pas
  encore les migrations au moment où l'on génère.

### Les prévisualisations Vercel parlent à la base de PRODUCTION

Un seul projet Supabase. **Un écran qui écrit se relit sur le stack local**, jamais sur la
prévisualisation — y supprimer touche de vraies données. Et un critère qui dépend d'une
migration de la PR n'y est **pas démontrable**, la migration n'y étant pas appliquée.

### Le serveur de développement écoute sur 3333, et l'hôte compte

Naviguer sur `localhost:3333`, **jamais `127.0.0.1:3333`** : Next 16 bloque ses ressources de
développement en cross-origin, l'hydratation échoue, les formulaires partent en GET natif —
et **rien ne le dit dans le navigateur**, seulement dans la sortie du serveur.

### `node --test` sur un glob vide rend 0

Un fichier de test renommé ou déplacé rend la CI verte sans une assertion. Les deux jobs
comptent donc les fichiers avant de lancer les tests. **Tout nouveau contrôle automatique doit
répondre à : « que se passe-t-il s'il ne trouve rien à contrôler ? »**

---

## Motifs à reprendre, jamais à réinventer

| Besoin | Où est le motif |
|---|---|
| Écriture client-direct + `router.refresh()` | `app/foyer/DisplayNameForm.tsx` |
| Lire `data` autant qu'`error` — zéro ligne est un succès PostgREST | `DisplayNameForm.tsx:70-78` |
| Confirmation en deux temps, jamais `window.confirm` | `app/foyer/InviteCard.tsx` |
| Lecture avec le client **en paramètre** (réutilisable dashboard/MCP) | `lib/foyer/membres.ts`, `foyer.ts` |
| Erreur métier : SQLSTATE d'abord, texte en repli | `lib/foyer/erreurs.ts` |
| État de soumission, avec son `finally` | `app/_lib/useSoumission.ts` |
| Zone de message accessible (`role="status"` + `aria-live`) | `app/_lib/Notice.tsx` |
| Normalisation d'une saisie libre | `lib/texte.ts` |

⚠ **`Notice` prend `reserve`** : à employer quand la zone est **au-dessus** du formulaire,
sinon le message pousse la cible sous le doigt au moment du clic.

⚠ **Un écran à plusieurs formulaires a besoin d'une région de statut par formulaire.** Une
région unique en tête de page affiche ses messages hors écran dès que la page défile. *Défaut
trouvé deux fois de suite sur `/rayons` — la première correction n'en avait créé que deux
pour trois formulaires.*

---

## Architecture — les invariants qui se violent le plus

- **AD-1 / AD-2** — la règle métier vit en Postgres, jamais dans la vigilance d'une surface.
  Jamais de `SUPABASE_SERVICE_KEY` côté application.
- **AD-13** — une écriture passe par une Server Action **si et seulement si** elle exige un
  secret serveur, ou si sa conséquence doit apparaître dans un rendu serveur
  (`revalidatePath`). Le critère est la **cause**, pas l'analogie de vocabulaire.
- **AD-17** — l'isolation se prouve par un test **exécuté**. Le job CI `isolation` existe pour
  ça ; il n'existait pas jusqu'au 2026-07-29 et les 17 tests ne tournaient nulle part.
- ⚠ **Une fonction `security definer` qui reçoit une identité en paramètre doit la
  recontrôler elle-même.** La RLS ne la couvre pas — c'est tout l'intérêt de `security
  definer`. *C'est ce qui rendait le trou de `seed_default_aisles` invisible aux onze tests
  d'isolation existants, qui portaient tous sur des tables.*
- **La RLS est par FOYER, pas par membre.** `profiles` n'a aucune colonne de rôle. Ne jamais
  inventer un contrôle d'accès applicatif pour distinguer les membres : il serait contournable
  à un appel RPC près et contredirait AD-2.

---

## Microcopy (UX-DR12, NFR-8, NFR-9)

Tutoiement, registre familier. **Mots bannis dans toute chaîne rendue :** synchronisation,
jeton/token, API, MCP, pont, Supabase, RLS, cache.

### Les possessifs : première personne pour les LIBELLÉS, tutoiement pour les PHRASES

Décision de Florian du 2026-08-02, appliquée à 20 chaînes. Deux familles, et elles ne se
traitent pas pareil :

- **Ce qui NOMME une chose du membre** — titre d'écran, titre d'onglet, titre de section,
  lien de retour, libellé de champ — est à la **première personne** : « Mon foyer »,
  « Mes rayons », « Mes recettes », « Mon parcours », « Mon répertoire », « Mon prénom ».
  C'est l'usage français courant, celui de « Mes commandes » ou « Mon compte ».
- **Ce que l'application DIT au membre** reste au **tutoiement**, qu'UX-DR12 impose :
  « Tu n'as encore aucune recette », « Ta session a expiré », « Tes retours à la ligne
  sont gardés tels quels ».

**Le libellé appartient au membre ; la phrase lui parle.** Écrire « Ma session a expiré »
ferait parler l'application d'elle-même.

⚠️ **Le piège est le VOISINAGE, pas la règle.** L'accueil disait « Ton foyer est prêt »
juste au-dessus d'un bouton « Mon foyer » : deux lignes voisines qui se contredisent. Quand
une phrase surplombe un libellé qui nomme la même chose, **c'est la phrase qu'on rend
neutre** — « Tout est prêt : le foyer, les rayons, les recettes » — jamais le libellé qu'on
retourne au tutoiement.

Jamais un message technique brut — `error.tsx` est le dernier filet, pas le premier. Et
**jamais « Réessaie » sur une condition non transitoire** : un conseil qui ne peut pas
fonctionner enferme l'utilisateur dans une boucle. *Défaut réel : un rayon supprimé par
l'autre membre rendait « Ça n'a pas marché. Réessaie dans un instant. » indéfiniment.*

**Pas d'abricot** hors de l'anneau de focus : UX-DR2 le réserve à l'action courses.
