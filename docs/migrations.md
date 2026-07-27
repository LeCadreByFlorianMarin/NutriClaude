# Discipline de migrations

Le schéma Postgres **est** le produit : c'est là que vivent les règles, l'isolation entre foyers et l'essentiel de la logique. Une erreur de migration ne casse pas un écran, elle casse la donnée.

Ce document fixe la convention. Elle était restée ouverte depuis la conception (`Deferred` de l'Architecture Spine : « une seule migration initiale existe ; l'outillage/convention de migrations additives est à établir »).

---

## La règle qui prime sur toutes les autres

**Un fichier de migration déjà appliqué ne se modifie plus jamais.**

Pas une faute de frappe, pas un commentaire, pas un reformatage. Le projet distant garde la trace des migrations jouées ; un fichier édité après coup crée une divergence silencieuse entre ce que dit le dépôt et ce qui tourne réellement. Le jour où ça se découvre, c'est en production et sans filet.

Une erreur dans une migration appliquée se corrige par **une nouvelle migration** qui l'amende. Jamais en retouchant l'ancienne.

**État actuel :** une seule migration existe, `20260502000000_initial_schema.sql`, et elle **est déployée**. Elle est donc gelée au sens ci-dessus. Elle porte 10 tables, la RLS ancrée sur `current_household_id()`, et les fonctions de résolution, de génération et d'inscription au foyer.

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

**Prérequis, à faire une fois par poste.** Le CLI doit être authentifié :

```bash
npx supabase login                              # ouvre le navigateur
```

**Le projet est déjà relié** — l'état vit dans `supabase/.temp/` (ignoré par git, il contient le `project-ref`). Si ce cache disparaît, le rétablir avec :

```bash
npx supabase link --project-ref <ref>           # <ref> est lisible dans NEXT_PUBLIC_SUPABASE_URL
```

L'authentification, elle, est **par poste et non versionnée** : un `login` est nécessaire sur chaque machine, et son absence se manifeste par une erreur trompeuse — `LegacyGenTypesUnexpectedStatusError`, « your account does not have the necessary privileges ». Ce n'est pas un problème de droits sur le projet, c'est simplement l'absence de jeton.

## Régénérer les types TypeScript

Le schéma est la source de vérité ; `lib/supabase/types.ts` en est le reflet, **généré, jamais écrit à la main** :

```bash
npx supabase gen types typescript --linked > lib/supabase/types.ts
```

**À rejouer après chaque migration**, dans le même commit. C'est ce qui fait qu'un nom de table, de colonne ou de fonction inexistant échoue au `typecheck` au lieu de casser à l'exécution. Contrôle rapide après génération : le bloc `Functions` doit lister les sept fonctions du schéma — s'il est vide, la génération a échoué et il ne faut pas commiter le résultat.

**Le cycle.**

```bash
npx supabase migration new <nom>     # 1. créer le fichier
                                      # 2. l'écrire
npx supabase db diff                  # 3. voir l'écart avec le distant
npx supabase db push                  # 4. appliquer
npx supabase migration list           # 5. vérifier local et distant alignés
```

L'étape 5 n'est pas décorative : c'est la seule preuve que ce que dit le dépôt correspond à ce qui tourne.

**Ce qui ne doit jamais servir sur ce projet** — `supabase db reset` détruit et rejoue tout le schéma. Sur le projet distant, c'est une perte de données sèche. Il n'y a pas d'environnement de développement séparé : **un seul projet, qui est la production**.

---

## Pour la revue

Une pull request qui touche `supabase/migrations/` doit répondre à ces questions dans sa description :

- La migration est-elle additive au sens ci-dessus ? Si elle ne l'est pas, pourquoi et avec quelle sauvegarde ?
- Une migration déjà appliquée a-t-elle été modifiée ? *(Doit être non, sans exception.)*
- L'horodatage est-il postérieur à toutes les migrations existantes ?
- Si des politiques RLS changent : quel foyer peut désormais lire quoi, et l'a-t-on vérifié avec **deux comptes distincts** ?

La dernière est la plus importante. L'isolation entre foyers (NFR-5) est la seule chose que ce produit ne peut pas se permettre de casser.

---

## Ce que ce projet n'a pas, et pourquoi

**Pas d'environnement de préproduction.** Un seul projet Supabase, qui sert la production. Assumé : le produit sert un foyer de deux personnes, et un second projet doublerait la charge d'entretien pour un bénéfice théorique.

Conséquence concrète : **toute migration est jouée directement sur les données réelles.** C'est ce qui rend la règle du fichier non modifiable et l'interdiction de `db reset` non négociables, plutôt que de simples bonnes manières.

**Pas de migration descendante.** Une correction est une nouvelle migration, jamais un retour en arrière. Les sauvegardes gérées par Supabase sont le filet, et le seul.
