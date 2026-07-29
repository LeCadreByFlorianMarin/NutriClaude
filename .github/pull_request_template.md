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
