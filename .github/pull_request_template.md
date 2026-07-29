## Ce que ça change

<!-- Une ou deux phrases. Ce que le membre du foyer voit ou peut faire de plus. -->

## Comment ça a été vérifié

<!--
Concrètement, pas « ça marche ». Un test automatisé, une commande, un parcours
joué à la main — et lequel.

Rappel de méthode : sur ce dépôt, deux affirmations de vérification se sont
révélées fausses parce qu'elles étaient déduites au lieu d'être mesurées.
Si tu n'as pas exécuté le chemin, dis-le plutôt que de le supposer.
-->

- [ ] `npm test` passe
- [ ] `npm run typecheck` passe
- [ ] `npm run lint` passe

> ⚠️ **Un écran qui écrit se relit sur le stack local, pas sur la prévisualisation.**
> Les prévisualisations Vercel parlent à la base de **production** — il n'y a qu'un
> seul projet Supabase. Y créer, renommer ou **supprimer** touche de vraies données
> du foyer. Et les migrations de cette PR n'y sont pas appliquées : un critère qui
> en dépend n'y est pas démontrable. Voir `docs/migrations.md § Relire une PR`.

- [ ] Si un écran qui écrit a changé : relu sur le stack local, et `.env.local`
      **restauré** (`git diff` vide) — ou aucun écran d'écriture touché.

## Si la PR touche `supabase/migrations/`

> Ces quatre questions viennent de `docs/migrations.md`. Elles sont obligatoires :
> il n'y a **qu'un seul projet Supabase distant, et c'est la production.**
>
> ⚠️ **Fusionner cette PR applique la migration** (déploiement Vercel, depuis le
> 2026-07-29). Il n'y a plus de geste manuel entre l'approbation et la
> production : cette revue est le dernier contrôle humain.

- [ ] La migration est-elle **additive** au sens de `docs/migrations.md` ? Sinon,
      pourquoi, et avec quelle sauvegarde vérifiée ?
- [ ] Une migration **déjà appliquée** a-t-elle été modifiée ?
      *(Doit être non, sans exception.)*
- [ ] L'horodatage est-il **postérieur** à toutes les migrations existantes ?
- [ ] Si des politiques RLS changent : **quel foyer peut désormais lire quoi**,
      et l'a-t-on vérifié avec **deux comptes distincts** ?

<!--
La dernière est la plus importante. L'isolation entre foyers (NFR-5) est la
seule chose que ce produit ne peut pas se permettre de casser — et c'est
exactement ce qu'une revue a trouvé cassé sur `profiles_update_own`.
-->

- [ ] `lib/supabase/types.ts` a été **régénéré dans le même commit**
      (`npx supabase gen types typescript --local > lib/supabase/types.ts`,
      après `npx supabase db reset`), ou la migration ne change pas la forme du
      schéma. ⚠️ `--local` et non `--linked` : le distant n'a pas encore la
      migration au moment où tu génères.
- [ ] La migration a été **rejouée depuis zéro en local** (`npx supabase db reset`),
      pas seulement appliquée par-dessus un état existant.
- [ ] La **requête de contrôle en en-tête du fichier** a été exécutée sur la
      production, et son résultat est collé ci-dessous. ⚠️ C'est ici qu'elle se
      fait : il n'y a plus de `db push` manuel, donc plus de moment « juste avant
      de pousser ». Une migration qui échoue à l'application interrompt le
      déploiement **après** que les précédentes du lot ont été appliquées.
- [ ] `npm run test:isolation` passe (le job CI `isolation` le rejoue ; le lancer
      en local évite d'attendre le runner).
