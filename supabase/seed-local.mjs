/**
 * Sème un foyer utilisable sur le stack LOCAL, et rend un lien de connexion.
 *
 * ⚠️ **Local seulement, et c'est vérifié** : le script lit `supabase status` et
 * refuse de tourner si l'URL n'est pas locale. Il emploie la clé `service_role`,
 * qui traverse la RLS — la pointer sur la production effacerait de vraies
 * données.
 *
 * ⚠️ **Idempotent** : il supprime le compte de démonstration et son foyer avant
 * de les recréer. Le relancer après un `supabase db reset` remet tout en place.
 *
 * Usage :  node supabase/seed-local.mjs
 *          SEED_EMAIL=moi@exemple.test PORT_APP=3344 node supabase/seed-local.mjs
 */
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

/**
 * L'adresse du compte de démonstration.
 *
 * ⛔ **Une adresse NEUTRE par défaut, et le dépôt est PUBLIC.** Y écrire en dur
 * une vraie adresse la publierait, définitivement, dans l'historique git — une
 * suppression ultérieure ne la retirerait pas des clones ni des forks.
 *
 * ⚠️ **Le domaine `.test` est réservé par la RFC 6761** : il ne se résout nulle
 * part, donc cette adresse ne peut pas atteindre une vraie boîte, même si le
 * script était lancé par accident contre un service qui envoie réellement. En
 * local, tout part de toute façon dans Mailpit.
 *
 * `SEED_EMAIL` permet d'employer sa propre adresse sans modifier ce fichier.
 */
const EMAIL = process.env.SEED_EMAIL ?? "demo@nutriclaude.test";
const PORT_APP = process.env.PORT_APP ?? "3333";

const etat = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" })
);

/* ⛔ La garde qui rend ce script sûr. Sans elle, une variable d'environnement
   égarée suffirait à le faire écrire en production avec la clé service_role. */
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(etat.API_URL)) {
  throw new Error(
    `Ce script est réservé au stack LOCAL. URL vue : ${etat.API_URL}`
  );
}

const admin = createClient(etat.API_URL, etat.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ── Table rase sur le compte de démonstration ─────────────────────────────── */
const { data: comptes } = await admin.auth.admin.listUsers();
for (const u of comptes.users.filter((u) => u.email === EMAIL)) {
  const { data: p } = await admin
    .from("profiles")
    .select("household_id")
    .eq("id", u.id)
    .maybeSingle();
  if (p?.household_id) {
    await admin.from("grocery_list_items").delete().eq("household_id", p.household_id);
    await admin.from("aisles").delete().eq("household_id", p.household_id);
    await admin.from("profiles").delete().eq("id", u.id);
    await admin.from("households").delete().eq("id", p.household_id);
  }
  await admin.auth.admin.deleteUser(u.id);
}

/* ── Compte, foyer, profil ─────────────────────────────────────────────────── */
const { data: cree, error: eCompte } = await admin.auth.admin.createUser({
  email: EMAIL,
  email_confirm: true,
});
if (eCompte) throw eCompte;

const { data: foyer, error: eFoyer } = await admin
  .from("households")
  .insert({ name: "Maison" })
  .select("id")
  .single();
if (eFoyer) throw eFoyer;

const { error: eProfil } = await admin
  .from("profiles")
  .upsert({ id: cree.user.id, household_id: foyer.id, display_name: "Florian" });
if (eProfil) throw eProfil;

/* ── Rayons ────────────────────────────────────────────────────────────────
 * ⚠️ Posés à la main, PAS par `seed_default_aisles` : cette fonction est
 * `security definer` et recontrôle l'identité de son appelant — le rôle admin
 * n'étant membre d'aucun foyer, elle refuse (« Not your household »). C'est le
 * correctif de la revue de la story 2.1, et il fait son travail.
 *
 * ⚠️ « Alpha » et « Exaequo » partagent `sort_order = 20` : c'est le piège n°1
 * de la story 4.2 — deux rayons ex æquo font s'INTERCALER leurs articles dans le
 * flux de la vue. Le garder dans le semis, c'est garder le cas visible à l'œil.
 */
const { data: rayons, error: eRayons } = await admin
  .from("aisles")
  .insert([
    { household_id: foyer.id, name: "Fruits & Légumes", icon: "🥬", sort_order: 10 },
    { household_id: foyer.id, name: "Crèmerie", icon: "🧀", sort_order: 20 },
    { household_id: foyer.id, name: "Épicerie", icon: "🥫", sort_order: 30 },
    { household_id: foyer.id, name: "Boucherie", icon: "🥩", sort_order: 40 },
  ])
  .select("id, name");
if (eRayons) throw eRayons;
const R = Object.fromEntries(rayons.map((r) => [r.name, r.id]));

/* ── Articles ──────────────────────────────────────────────────────────────
 * Le jeu couvre les cas que seul l'œil attrape :
 *  · deux « Lait » d'unités différentes — AD-7, deux lignes légitimes ;
 *  · un rayon ENTIÈREMENT acheté (Épicerie) — pas de séparateur « panier » ;
 *  · un article sans quantité, un article sans unité, un « À classer » ;
 *  · l'accord en nombre (« 6 pièces », « 3 pincées »).
 */
const articles = [
  { name: "Pommes", quantity: 6, unit: "pièce", aisle_id: R["Fruits & Légumes"], status: "pending" },
  { name: "Salade", quantity: null, unit: null, aisle_id: R["Fruits & Légumes"], status: "pending" },
  { name: "Carottes", quantity: 1, unit: "kg", aisle_id: R["Fruits & Légumes"], status: "bought" },
  { name: "Lait", quantity: 1.5, unit: "L", aisle_id: R["Crèmerie"], status: "pending" },
  { name: "Lait", quantity: 2, unit: "pièce", aisle_id: R["Crèmerie"], status: "pending" },
  { name: "Beurre", quantity: 250, unit: "g", aisle_id: R["Crèmerie"], status: "bought" },
  { name: "Riz", quantity: 500, unit: "g", aisle_id: R["Épicerie"], status: "bought" },
  { name: "Huile d'olive", quantity: 1, unit: "L", aisle_id: R["Épicerie"], status: "bought" },
  { name: "Sel", quantity: 3, unit: "pincée", aisle_id: R["Épicerie"], status: "bought" },
  { name: "Poulet", quantity: 1.2, unit: "kg", aisle_id: R["Boucherie"], status: "pending" },
  { name: "Truc non classé", quantity: 3, unit: null, aisle_id: null, status: "pending" },
];
const { error: eArticles } = await admin
  .from("grocery_list_items")
  .insert(articles.map((a) => ({ ...a, household_id: foyer.id })));
if (eArticles) throw eArticles;

/* ── Le lien de connexion ──────────────────────────────────────────────────
 * ⚠️ On construit l'URL vers `/auth/callback` avec `token_hash`, PAS le lien
 * `action_link` que rend l'API : la route du dépôt vérifie un `token_hash`
 * (`verifyOtp`) et non un `?code=` PKCE — pour qu'un lien demandé sur
 * l'ordinateur et ouvert sur le téléphone fonctionne.
 */
const { data: lien, error: eLien } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: EMAIL,
  options: { redirectTo: `http://localhost:${PORT_APP}/auth/callback` },
});
if (eLien) throw eLien;

const aPrendre = articles.filter((a) => a.status === "pending").length;
console.log(`✅ Foyer « Maison » semé sur le stack LOCAL`);
console.log(`   ${rayons.length} rayons · ${articles.length} articles (${aPrendre} à prendre)`);
console.log(`   Compte : ${EMAIL}`);
console.log("");
console.log("Ouvre ce lien pour te connecter :");
console.log(
  `http://localhost:${PORT_APP}/auth/callback?token_hash=${lien.properties.hashed_token}&type=magiclink&next=%2Fcourses`
);
console.log("");
console.log(`(Les emails locaux arrivent dans Mailpit : ${etat.MAILPIT_URL})`);
