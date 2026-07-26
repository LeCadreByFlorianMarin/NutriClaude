# Configuration & exploitation

Tout ce qui **ne vit pas dans le dépôt**. Sans ces réglages, le code de connexion est correct mais inopérant : aucun email ne part, ou le lien reçu ne mène nulle part.

Trois environnements consomment la même configuration : le poste local, les déploiements de prévisualisation Vercel, et la production sur `nutri.florianmarin.me`.

---

## 1. Variables d'environnement

Deux variables, partout les mêmes.

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem |

**En local** : `cp .env.local.example .env.local`, puis renseigner. Le fichier est ignoré par git.

**Sur Vercel** : Project → Settings → Environment Variables, pour les trois portées (Production, Preview, Development).

> ⚠️ Les deux valeurs sont préfixées `NEXT_PUBLIC_` : elles sont **exposées au navigateur**, et c'est voulu — le client Supabase du navigateur lit et écrit directement, sous le contrôle de la RLS. La clé « anon » n'est pas un secret. La **clé de service**, elle, n'a rien à faire ici : aucune surface ne doit jamais l'utiliser.

Symptôme d'une variable absente ou fausse : **500 sur toutes les routes**, écran de connexion compris. Le client Supabase lève à l'instanciation, et il n'existe aucune page de secours.

---

## 2. Supabase — URL et redirections

*Authentication → URL Configuration*

| Champ | Valeur |
|---|---|
| **Site URL** | `https://nutri.florianmarin.me` |
| **Redirect URLs** | `https://nutri.florianmarin.me/**` |
| | `http://localhost:3000/**` |
| | `https://*.vercel.app/**` *(facultatif — uniquement pour se connecter depuis une prévisualisation)* |

**Le `/**` est obligatoire.** L'URL de retour que l'application transmet porte une query string (`/auth/callback?next=…`) ; un motif exact la ferait rejeter par Supabase.

---

## 3. Supabase — les deux modèles d'email

*Authentication → Emails*

C'est le point le plus délicat de toute la configuration. **Deux modèles doivent être édités, pas un.**

### Pourquoi deux

`signInWithOtp` crée le compte si l'adresse est inconnue. Supabase envoie alors le modèle **« Confirm sign up »**, et non « Magic link ». N'éditer que le second casse **la toute première connexion de chaque personne** — et le bug reste invisible si l'on reteste avec un compte déjà créé.

### Ce qu'il faut y mettre

**Magic link :**

```html
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink">Se connecter à NutriClaude</a></p>
```

**Confirm sign up :**

```html
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup">Se connecter à NutriClaude</a></p>
```

Trois choses à ne pas modifier :

- `{{ .RedirectTo }}` porte l'URL de retour **query string comprise**, d'où la concaténation en `&`. L'application garantit qu'un `?next=…` y figure toujours, ne serait-ce qu'à `/`.
- **`type` est écrit en dur, et différemment dans chaque modèle.** C'est la seule façon fiable de le transmettre, et la vérification refuse un `type` qui ne correspond pas au jeton.
- On n'emploie **pas** `{{ .ConfirmationURL }}`, le modèle par défaut. Il déclenche un flux dont le vérificateur est stocké dans le navigateur qui a *demandé* le lien : un lien demandé sur l'ordinateur et ouvert sur le téléphone échouerait. C'est un usage normal du foyer, pas un cas limite.

### ⚠️ Vérifier d'abord que l'éditeur n'est pas verrouillé

Depuis le **3 juin 2026**, un **nouveau** projet en palier gratuit utilisant le service d'email par défaut ne peut plus modifier ses modèles. Les projets antérieurs sont **antériorisés**. Celui-ci date du 2 mai 2026 : il devrait passer.

**Si l'éditeur est en lecture seule, s'arrêter là.** La seule parade est de configurer un service d'envoi dédié (*Authentication → SMTP Settings*), ce qui rend aussi l'édition possible. C'est un arbitrage à prendre, pas un contournement à improviser.

---

## 4. Supabase — la livraison des emails

Le service d'envoi par défaut est conservé (décision du 2026-07-26 : le foyer compte deux personnes, on ne monte pas un service dédié pour ça). Il impose deux limites.

**Il ne livre qu'aux adresses membres de l'organisation.** Toute autre adresse reçoit un refus.

→ *Organization → Team* : **ajouter l'adresse du second membre du foyer.** Sans cette étape, elle ne recevra jamais rien — et l'erreur ne se voit pas en testant avec le compte du propriétaire du projet. L'application affiche dans ce cas « Cette adresse n'est pas encore autorisée pour NutriClaude. »

**Plafond de 2 emails par heure et par projet**, partagé entre inscriptions, invitations et liens de connexion.

Indolore en usage réel : deux personnes, des sessions durables, une connexion épisodique. **Serré en développement** — deux essais suffisent à bloquer une heure. En pratique : réutiliser le même lien reçu pour éprouver plusieurs fois la route de retour, et garder le chemin d'échec (lien rejoué) pour la fin.

Si ce plafond devient réellement le goulot d'étranglement, un service d'envoi dédié (Resend et son palier gratuit suffisent) le porte à ~30 nouveaux comptes par heure et lève du même coup la restriction de livraison.

---

## 5. Vercel — domaine et déploiement

**Relier le dépôt** : Vercel → New Project → importer `LeCadreByFlorianMarin/NutriClaude`. Le préréglage Next.js convient tel quel, aucune commande à personnaliser.

**Le domaine** : Project → Settings → Domains → ajouter `nutri.florianmarin.me`. Vercel affiche l'enregistrement DNS à créer chez le gestionnaire de `florianmarin.me` — un **CNAME** `nutri` vers la valeur qu'il indique. Ni les serveurs de noms ni l'apex ne bougent. Le certificat TLS est émis automatiquement une fois la propagation faite.

**Ne pas oublier les variables d'environnement** (§1) : sans elles, le déploiement se construit puis retourne 500 partout.

> Un `vercel link` en local crée un dossier `.vercel/`. Il est ignoré par git.

### Pourquoi le CDN de Vercel a des conséquences sur le code

La réponse qui pose le cookie de session traverse un cache partagé. Sans en-têtes d'interdiction de cache, **la session d'un membre pourrait être servie à l'autre**.

C'est la raison d'être de `createRouteHandlerClient()` dans `lib/supabase/server.ts` : les en-têtes viennent de la librairie Supabase elle-même et sont reportés sur la réponse, redirections comprises. **Ne pas « simplifier » ce chemin.**

---

## 6. Vérifier que tout est en place

Dans l'ordre. Chaque étape suppose la précédente.

1. **L'éditeur de modèles d'email est-il modifiable ?** Si non, s'arrêter (§3).
2. `.env.local` renseigné → `npm run dev`, puis `curl -sI localhost:3000/login` doit rendre **200**, pas 500.
3. Une route protégée renvoie vers la connexion en gardant sa destination :
   `curl -si localhost:3000/menu` → `307` vers `/login?next=%2Fmenu`.
4. Saisir son adresse sur `/login` → l'écran annonce que le lien est parti.
5. **L'email arrive**, et son lien pointe vers `…/auth/callback?next=…&token_hash=…&type=…`.
6. Cliquer → arrivée sur la destination d'origine, connecté.
7. **Rouvrir le même lien** → retour à la connexion avec « Ce lien n'est plus bon ».
8. Avec la session ouverte, dans *Supabase → SQL Editor* :
   ```sql
   select auth.uid(), current_household_id();
   ```
   Attendu pour un compte neuf : un identifiant, et `current_household_id()` à **`NULL`**. **C'est le succès**, pas un échec — aucun profil n'est créé automatiquement, et c'est la story 1.3 qui s'en charge.
9. **Le contrôle qui reste ouvert** — la réponse de `/auth/callback` qui pose le cookie doit porter `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`, `Expires: 0` et `Pragma: no-cache`. Le transport a été mesuré ; leur émission effective lors d'une vraie connexion **n'a jamais pu être observée**, faute de session. À vérifier au premier passage réussi, en inspectant les en-têtes de la redirection dans l'onglet réseau du navigateur.

---

## 7. Ce qui reste volontairement en dette

Tracé pour ne pas être redécouvert comme un oubli. Le détail vit dans `_bmad-output/implementation-artifacts/deferred-work.md`.

- **Pas de validation des variables d'environnement au démarrage** — absentes, tout retourne 500 sans page de secours.
- **Aucun framework de test** — la vérification est manuelle et exécutable. Les tests d'isolation et de convergence sont planifiés en story 4.15.
- **Les liens de connexion peuvent être consommés par les analyseurs d'emails** de certains fournisseurs, qui préchargent les URL. Marginal sur des boîtes personnelles ; le message « on t'en envoie un autre ? » est la porte de sortie prévue.
- **`lib/supabase/types.ts` est écrit à la main** et divergera silencieusement du schéma. `supabase gen types` reste la bonne réponse, à traiter dans une story dédiée.
- **Vulnérabilités `npm audit`**, toutes transitives et en dépendances de développement, jamais expédiées en production.
