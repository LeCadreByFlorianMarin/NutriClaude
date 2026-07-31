# Discipline de migrations

Le schéma Postgres **est** le produit : c'est là que vivent les règles, l'isolation entre foyers et l'essentiel de la logique. Une erreur de migration ne casse pas un écran, elle casse la donnée.

Ce document fixe la convention. Elle était restée ouverte depuis la conception (`Deferred` de l'Architecture Spine : « une seule migration initiale existe ; l'outillage/convention de migrations additives est à établir »).

---

## La règle qui prime sur toutes les autres

**Un fichier de migration déjà appliqué ne se modifie plus jamais.**

Pas une faute de frappe, pas un commentaire, pas un reformatage. Le projet distant garde la trace des migrations jouées ; un fichier édité après coup crée une divergence silencieuse entre ce que dit le dépôt et ce qui tourne réellement. Le jour où ça se découvre, c'est en production et sans filet.

Une erreur dans une migration appliquée se corrige par **une nouvelle migration** qui l'amende. Jamais en retouchant l'ancienne.

**État au 2026-07-29 :** neuf migrations existent. `20260502000000_initial_schema.sql` porte 10 tables, la RLS ancrée sur `current_household_id()`, et les fonctions de résolution, de génération et d'inscription au foyer. Les huit suivantes l'amendent. Toutes celles qui sont appliquées sont gelées au sens ci-dessus.

---

## Nommage

```
supabase/migrations/<AAAAMMJJHHMMSS>_<verbe_au_present>.sql
```

Horodatage UTC à la seconde, puis un nom court en `snake_case` qui dit ce que la migration **fait** : `20260801143000_add_device_credentials.sql`, pas `20260801143000_epic5.sql` ni `..._fix.sql`.

L'ordre d'application est l'ordre lexicographique des noms. C'est la seule raison d'être de l'horodatage : ne jamais le choisir à la main plus petit qu'une migration déjà appliquée.

```bash
npx supabase migration new add_device_credentials   # crée le fichier horodaté
```

---

## Strictement additive

« Additive » ne veut pas dire « qui n'ajoute que des tables ». Cela veut dire : **aucune migration ne détruit de donnée ni ne casse un consommateur existant**.

**Autorisé sans précaution** — créer une table, une fonction, un index, une politique ; ajouter une colonne *nullable* ou avec valeur par défaut ; ajouter une valeur à une énumération ; assouplir une contrainte.

**À traiter avec méthode** — renommer (ajouter la nouvelle forme, migrer, retirer l'ancienne plus tard, en trois temps) ; resserrer une contrainte (vérifier d'abord que les données existantes la respectent) ; ajouter une colonne `not null` sans défaut sur une table peuplée (elle échouera).

**Interdit sans décision explicite et sauvegarde vérifiée** — `drop table`, `drop column`, `truncate`, tout `delete` sans clause `where`.

`create or replace function` mérite une mention à part : c'est le mécanisme normal pour faire évoluer une fonction, mais il **écrase** l'existante. Relis la version en place avant de la remplacer, et vérifie qu'aucun appelant ne dépend du comportement que tu changes.

---

## Appliquer

**Décision de Florian, 2026-07-29 : plus aucune migration n'est poussée à la main.**

| Où | Qui applique | Comment |
| --- | --- | --- |
| **Local** (`supabase start`) | toi | `npx supabase db reset` — rejoue toute la chaîne depuis zéro |
| **Production** | le **déploiement Vercel** de `main` | `vercel.json` → `scripts/migrer-au-deploiement.mjs` |

Ce qui a changé, et pourquoi : la poussée manuelle était le dernier geste du projet qui pouvait être **oublié**, ou joué depuis un poste dont l'arbre ne correspondait pas à ce qui allait être déployé. Une migration écrite mais non poussée laissait du code en avance sur son schéma, sans qu'aucune des quatre portes ne le voie — c'est arrivé deux fois. Le déploiement, lui, ne peut pas oublier.

### En local

```bash
npx supabase start                    # une fois par session
npx supabase migration new <nom>      # 1. créer le fichier
                                      # 2. l'écrire
npx supabase db reset                 # 3. rejouer TOUTE la chaîne
npm run test:isolation                # 4. le filet NFR-5
```

`db reset` est ici l'outil normal, et il est **sans danger** : le stack local repart de zéro à chaque fois, c'est sa raison d'être. C'est la seule façon d'éprouver une migration dans les mêmes conditions que la production — c'est-à-dire jouée **après toutes les précédentes**, sur une base vierge.

> ⚠️ `db reset` reste **interdit sur le distant**, sans exception : ce serait une perte de données sèche. Le script de déploiement n'emploie que `db push`, qui n'applique que ce qui manque.

### En production

Rien à faire : ouvrir la PR, la faire passer en revue, la fusionner. Le déploiement de production applique les migrations en attente **après** avoir construit l'application, puis met le code en ligne.

L'ordre compte, et il est expliqué en tête de `scripts/migrer-au-deploiement.mjs` : une migration refusée fait échouer la construction, donc Vercel ne promeut pas le code.

⚠️ **Mais « ça a échoué » ne veut PAS dire « rien n'a bougé », et ce document l'a affirmé à tort jusqu'au 2026-07-29.** `supabase db push` n'est pas atomique sur un lot : il applique les fichiers un par un et enregistre chacun au fur et à mesure. Sur un lot de deux migrations dont la seconde échoue, **la première est appliquée** et le code n'est pas promu. Ce qui rend cet état supportable est l'**additivité** (voir plus haut), pas une propriété du script. Après un déploiement rouge qui touchait des migrations : lire la sortie de la CLI dans le journal Vercel, qui nomme les fichiers passés, puis `npx supabase migration list --linked`.

**Le seul secret nécessaire** est `SUPABASE_DB_URL`, portée **Production uniquement** dans Vercel. C'est l'URI du **pooler de session**, et le tableau de bord en propose trois — les deux autres sont des impasses :

| Ce que propose Supabase | Hôte | Port | Depuis Vercel |
| --- | --- | --- | --- |
| Connexion directe | `db.<ref>.supabase.co` | 5432 | ❌ **IPv6 seulement** |
| Pooler de transaction | `aws-N-<région>.pooler.supabase.com` | 6543 | ❌ ne tient pas le DDL |
| **Pooler de session** | `aws-N-<région>.pooler.supabase.com` | **5432** | ✅ |

⚠️ **Le nom d'utilisateur change avec l'hôte** : le pooler attend `postgres.<ref>`, pas `postgres`. Recopier l'URI entière depuis le panneau *Connect*, ne pas fabriquer l'hôte à la main dans une URI existante. Le mot de passe doit être **encodé pour URL** s'il contient des caractères spéciaux.

> ⚠️ **Ce secret n'est pas une variable d'environnement ordinaire.** C'est le rôle `postgres` : il **traverse la RLS de bout en bout**, par conception — une migration doit pouvoir tout faire. Or toute l'isolation entre foyers (NFR-5) repose sur la RLS : onze politiques, une garde `security definer`, dix-sept tests. Cette URI est la clé qui ouvre l'ensemble.
>
> Conséquences pratiques : **portée Production uniquement** (jamais Preview ni Development — le script ne s'en sert nulle part ailleurs, donc l'y déclarer n'ajouterait que de l'exposition) ; la rotation du mot de passe de la base la périme, il faut la remettre à jour ; et elle vit désormais dans un conteneur de construction où `npm ci` exécute les scripts d'installation de tout l'arbre de dépendances. C'est le coût assumé de la décision du 2026-07-29 — il est écrit ici pour être revu, pas pour être oublié.

Ce que le script refuse de faire :

- **Rien hors production.** `VERCEL_ENV` doit valoir `production`.
- **Rien hors de `main`.** `VERCEL_ENV === "production"` ne veut pas dire « branche fusionnée » : un `vercel --prod` depuis n'importe quelle branche produit un déploiement de production. Le script contrôle donc aussi `VERCEL_GIT_COMMIT_REF`. (Ajouté le 2026-07-29 : la garde promise par l'en-tête n'existait pas.)
- **Rien sur le pooler de transaction.** Une URI en `:6543` est refusée avant tout appel, plutôt que de laisser `db push` échouer sur une erreur pgbouncer opaque.
- **Rien sur l'hôte de connexion directe.** Un hôte en `db.<ref>.supabase.co` est refusé, parce qu'il est joignable en IPv6 seulement. (Ajouté le 2026-07-31, après qu'il eut coûté un déploiement : voir ci-dessous.)
- **Passer son tour en silence.** Si `SUPABASE_DB_URL` manque sur un déploiement de production, le script **échoue**. Un contrôle qui rend « vert » en n'ayant rien fait est précisément le motif de défaut que ce dépôt a rencontré trois fois.

### Relire une PR : sur le stack local, jamais sur la prévisualisation

**Les prévisualisations Vercel parlent à la base de PRODUCTION.** Il n'existe qu'un seul projet Supabase, et `NEXT_PUBLIC_SUPABASE_URL` y pointe dans tous les environnements. Le script, lui, saute les migrations hors production — la prévisualisation sert donc du code neuf contre un schéma d'avant.

Deux conséquences, et la seconde a été sous-estimée jusqu'au 2026-07-29 :

1. Un écran qui **écrit** se relit sur le stack local (`.env.local` basculé vers `http://127.0.0.1:55321`, puis **restauré**), jamais sur la prévisualisation. Créer, renommer ou **supprimer** depuis une prévisualisation touche de vraies données du foyer de production. Depuis la story 2.1, le produit a des surfaces qui suppriment.
2. Un critère d'acceptation qui dépend d'une migration de la même PR **n'est pas démontrable** sur la prévisualisation : la migration n'y est pas appliquée. Le démontrer en local, et le dire dans la PR.

La prévisualisation reste le seul témoin du **déploiement** lui-même (`engines`, `.node-version`, `next.config.ts`, et ce script). C'est pour ça qu'on la garde : on la regarde construire, on ne s'en sert pas comme d'un environnement de test.

### Ce que le déploiement automatique ne rattrape pas

- **Une restauration Vercel ne défait pas une migration.** Elle remet le code d'avant, jamais le schéma. C'est l'**additivité** qui rend l'opération sûre, et c'est ce qui la fait passer de bonne manière à condition de sûreté.
- **Un « Redeploy » avec reconstruction d'un déploiement antérieur** réclamera `supabase migration repair` : le dossier local y a moins de migrations que le distant. Le repli « revenir au code d'avant » passe donc par l'**Instant Rollback** de Vercel, qui ne reconstruit pas — pas par un redéploiement.
- **Une migration à horodatage antérieur à la dernière appliquée** fait refuser `db push`, et **tous** les déploiements suivants échouent jusqu'à intervention manuelle — y compris ceux qui ne touchent aucune migration. Cas d'école : deux branches ouvertes dans un ordre et fusionnées dans l'autre. Créer sa migration **au moment de l'écrire**, pas au moment d'ouvrir la branche.
- **Deux déploiements de production simultanés** pourraient tenter d'appliquer la même migration. La table d'historique a une clé sur la version : l'un des deux échouerait, donc ne serait pas promu. Sans portée à ce rythme, mais ce n'est pas impossible.
- **`db push` avertit sur Docker, à chaque déploiement, et ce n'est pas un échec.** `failed to cache migrations catalog: error exporting pg-delta catalog: failed to run docker` porte sur la mise en cache du catalogue `pg-delta`, une étape **postérieure** à l'application, qui réclame un Docker que le conteneur de construction n'a pas. Les migrations sont passées : `Finished supabase db push.` et le code de sortie 0 font foi, pas ce « Warning ».

### Le premier déploiement réel, et ce qu'il a démenti (2026-07-30 → 07-31)

Ce document annonçait que le premier déploiement serait le vrai test, la connexion depuis un conteneur de construction Vercel n'ayant jamais été jouée. Elle l'a été, elle a échoué, et **le point de rupture n'était pas celui qu'on avait prévu**. C'est la raison d'être de cette section : la prédiction était plausible et fausse.

On attendait le pooler de transaction (`:6543`), contre lequel une garde existait déjà. C'était l'**hôte**, pas le port. La connexion directe `db.<ref>.supabase.co` ne publie plus d'enregistrement `A`, seulement un `AAAA` : elle est joignable en IPv6 seulement, et un conteneur de construction Vercel n'a pas d'IPv6. Or l'hôte direct et le pooler de session écoutent **tous les deux sur 5432** — la garde du port ne pouvait donc pas voir passer une URI structurellement injoignable.

Le diagnostic a coûté plus que le correctif, pour deux raisons qu'il vaut la peine de savoir reconnaître :

1. **La CLI accuse le mauvais coupable.** `failed to connect to postgres` s'accompagne d'une invitation de Supabase à vérifier *Network Restrictions* et *Network Bans*. On cherche un pare-feu ; la cause est un enregistrement DNS absent. Contrôler l'hôte **avant** d'ouvrir le tableau de bord réseau : `dig +short A db.<ref>.supabase.co` — vide, c'est celui-là.
2. **L'échec est resté silencieux 23 heures.** La PR #14 a été fusionnée le 30/07 à 15 h 33 ; son déploiement a échoué à cette étape, donc la production a continué de servir le code de la PR #13 **sans que rien ne le signale**. Fusionner n'est plus mettre en ligne : depuis la décision du 29/07, il faut regarder le déploiement de `main` réussir, pas seulement la PR passer au vert.

Ce qui a rendu ces 23 heures sans conséquence est l'**additivité** (voir plus haut) : code d'avant contre schéma d'avant, cohérents entre eux. Encore une fois, elle est la condition de sûreté, pas une commodité.

## Régénérer les types TypeScript

Le schéma est la source de vérité ; `lib/supabase/types.ts` en est le reflet, **généré, jamais écrit à la main** :

```bash
npx supabase gen types typescript --local > lib/supabase/types.ts
```

⚠️ **`--local`, et non plus `--linked`** — conséquence directe du passage aux migrations appliquées
au déploiement (2026-07-29). `--linked` lit le schéma **distant**, qui n'a plus tes migrations au
moment où tu génères : il rendrait les types du schéma *d'avant*, et `tsc` validerait contre un
schéma que la production n'aura plus. Le local, lui, vient de rejouer toute la chaîne (`db reset`) :
c'est désormais lui qui est en avance, donc lui qui fait foi.

Deux écarts connus entre les deux sorties, sans rapport avec le schéma du produit : `--local` ajoute
un bloc `__InternalSupabase / PostgrestVersion` et, selon la version de la CLI, un schéma
`graphql_public`. Si le seul diff porte là-dessus, **ne le commite pas** : ça mêlerait une montée de
version de la CLI à une story de fonctionnalité.

**À rejouer après chaque migration**, dans le même commit. C'est ce qui fait qu'un nom de table, de colonne ou de fonction inexistant échoue au `typecheck` au lieu de casser à l'exécution. Contrôle rapide après génération : le bloc `Functions` doit lister les sept fonctions du schéma (au 2026-07-29) — s'il est vide, la génération a échoué et il ne faut pas commiter le résultat.

**Le cycle, du fichier à la production.**

```bash
npx supabase migration new <nom>                          # 1. créer le fichier
                                                          # 2. l'écrire, requête de contrôle en tête
npx supabase db reset                                     # 3. rejouer toute la chaîne EN LOCAL
npx supabase gen types typescript --local > lib/supabase/types.ts   # 4. régénérer
npm run test:isolation                                    # 5. le filet NFR-5
                                                          # 6. PR, revue, fusion
                                                          # 7. le déploiement applique
```

Les étapes 6 et 7 remplacent l'ancien `db push` manuel. Il n'y a plus d'étape « vérifier que local et
distant sont alignés » : c'est le déploiement qui les aligne, et son journal en est la trace.

`npx supabase migration list --linked` reste utile pour **constater** l'état du distant — après un
déploiement, ou quand un doute surgit. Il demande une authentification (`npx supabase login`), par
poste et non versionnée.

---

## Pour la revue

Une pull request qui touche `supabase/migrations/` doit répondre à ces questions dans sa description :

- La migration est-elle additive au sens ci-dessus ? Si elle ne l'est pas, pourquoi et avec quelle sauvegarde ?
- Une migration déjà appliquée a-t-elle été modifiée ? *(Doit être non, sans exception.)*
- L'horodatage est-il postérieur à toutes les migrations existantes ?
- Si des politiques RLS changent : quel foyer peut désormais lire quoi, et l'a-t-on vérifié avec **deux comptes distincts** ?

La dernière est la plus importante. L'isolation entre foyers (NFR-5) est la seule chose que ce produit ne peut pas se permettre de casser.

⚠️ **Depuis le 2026-07-29, fusionner cette PR applique la migration.** Il n'y a plus de geste manuel
entre l'approbation et la production : la revue *est* le dernier contrôle humain. Une migration qu'on
n'aurait pas voulu appliquer tout de suite ne se retient plus en ne la poussant pas — elle se retient
en ne fusionnant pas.

---

## Ce que ce projet a, et n'a pas

**Un stack local, depuis le 2026-07-29.** `supabase/config.toml` est versionné, ports décalés en
`5532x`. C'est là que se jouent les migrations avant d'être écrites, et les tests d'isolation
(`npm run test:isolation`). Il repart de zéro à chaque `db reset`.

> Cette section affirmait jusqu'au 2026-07-29 qu'il n'existait *« pas d'environnement de
> développement séparé »* et que `db reset` *« ne doit jamais servir sur ce projet »*. Les deux sont
> devenus faux le jour où le stack local a été ouvert — et l'affirmation a survécu deux jours de plus
> que le fait, ce qui est exactement le motif que la rétrospective de l'Epic 1 a nommé.

**Pas de préproduction.** Un seul projet Supabase distant, et il sert la production. Le stack local
n'en est pas une copie : il est vide, et ne porte aucune donnée réelle.

Conséquence concrète : **toute migration appliquée au distant l'est sur les données réelles.** C'est
ce qui rend la règle du fichier non modifiable, l'interdiction de `db reset` sur le distant et la
discipline additive non négociables, plutôt que de simples bonnes manières. L'automatisation du
déploiement ne relâche rien de tout cela — elle retire seulement le geste manuel, qui était la partie
oubliable.

**Pas de migration descendante.** Une correction est une nouvelle migration, jamais un retour en
arrière. Les sauvegardes gérées par Supabase sont le filet, et le seul. Une restauration Vercel remet
le code, jamais le schéma.
