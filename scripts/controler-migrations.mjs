#!/usr/bin/env node
/**
 * Contrôle que chaque migration porte sa requête de contrôle en en-tête.
 *
 * ── POURQUOI CE SCRIPT EXISTE ───────────────────────────────────────────────
 *
 * « Aucune migration sans sa requête de contrôle en en-tête » est une règle
 * d'équipe issue de la rétrospective de l'Epic 1. Elle est restée une intention
 * pendant deux epics — inscrite dans `next-steps.md`, un document de
 * planification que personne ne charge au moment d'écrire du SQL.
 *
 * Ce qui l'a fait passer d'intention à mécanisme : la revue du 2026-07-29 a
 * mesuré que la règle voisine (« un commentaire explique un pourquoi, jamais un
 * état de la base ») avait été violée **par la passe de revue elle-même**, deux
 * fois. Une règle qu'on se rappelle est une règle qu'on oublie. Une règle qui
 * fait échouer la CI est une règle.
 *
 * ── CE QU'IL VÉRIFIE, ET CE QU'IL NE PEUT PAS VÉRIFIER ──────────────────────
 *
 * Il vérifie qu'une instruction de lecture (`select`, `show`, `\d`) figure dans
 * le bloc de commentaires **avant la première instruction exécutable**. C'est
 * une condition nécessaire, pas suffisante : il ne peut pas juger si la requête
 * interroge la bonne chose, ni si quelqu'un l'a exécutée. Ça reste au relecteur,
 * et le gabarit de PR le lui demande.
 *
 * Il ne remplace donc pas la revue — il rend impossible le seul cas qu'un
 * automate peut attraper : avoir oublié la requête tout court.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DOSSIER = "supabase/migrations";

/**
 * Migrations antérieures à la règle, exemptées **nommément**.
 *
 * ⚠️ Une exemption par motif (`glob`, `startsWith`, « les migrations d'avant
 * telle date ») serait un trou : elle couvrirait aussi les fichiers à venir.
 * Une liste nommée ne peut grandir que par un commit délibéré, visible en revue.
 */
const EXEMPTEES = new Map([
  [
    "20260502000000_initial_schema.sql",
    "Le squelette. Antérieur à la règle, et il n'y avait rien à contrôler avant lui — " +
      "c'est lui qui crée le schéma.",
  ],
  [
    "20260728133837_create_valid_invites_view.sql",
    "Déjà appliquée en production, et son en-tête n'a pas de requête de contrôle — " +
      "constaté le 2026-07-30, par ce script, à sa première exécution. Elle n'est PAS " +
      "corrigée : y écrire une requête maintenant reviendrait à consigner un contrôle " +
      "que personne n'a exécuté, ce qu'interdit la règle voisine. L'oubli est tracé ici " +
      "plutôt que réécrit en fiction.",
  ],
]);

/*
 * ⚠️ **Ne jamais étendre `EXEMPTEES` pour accommoder un oubli.** Les deux
 * entrées ci-dessus sont des migrations DÉJÀ APPLIQUÉES en production, donc
 * intouchables (AR-MIGRATIONS) et incorrigibles sans mentir. Une migration qui
 * n'est pas encore partie se corrige : c'est le but de ce script.
 */

/** Le bloc de commentaires et de lignes vides qui précède la première instruction. */
function entete(sql) {
  const lignes = [];
  for (const ligne of sql.split("\n")) {
    const net = ligne.trim();
    if (net === "" || net.startsWith("--")) {
      lignes.push(net);
      continue;
    }
    break;
  }
  return lignes.join("\n");
}

const fichiers = readdirSync(DOSSIER)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (fichiers.length === 0) {
  console.error(
    `[migrations] aucun fichier .sql dans ${DOSSIER}.\n` +
      "  Un contrôle qui ne trouve rien à contrôler doit échouer, pas rendre vert."
  );
  process.exit(1);
}

const fautives = [];
let exemptees = 0;

for (const fichier of fichiers) {
  if (EXEMPTEES.has(fichier)) {
    exemptees++;
    continue;
  }

  const sql = readFileSync(join(DOSSIER, fichier), "utf8");
  // `\\d` est la commande de description de psql ; `show` couvre les paramètres.
  if (!/\bselect\b|\bshow\b|\\d/i.test(entete(sql))) fautives.push(fichier);
}

console.log(
  `[migrations] ${fichiers.length} migration(s) : ` +
    `${fichiers.length - fautives.length - exemptees} avec requête de contrôle, ` +
    `${exemptees} exemptée(s) nommément, ${fautives.length} sans.`
);

if (fautives.length > 0) {
  console.error(
    "\n[migrations] ces migrations n'ont pas de requête de contrôle en en-tête :\n" +
      fautives.map((f) => `  · ${f}`).join("\n") +
      "\n\n  La règle vient de la rétrospective de l'Epic 1 : une migration s'applique\n" +
      "  maintenant PENDANT le déploiement de production, sans geste humain entre\n" +
      "  l'approbation et l'écriture. La requête de contrôle est ce qui permet au\n" +
      "  relecteur de savoir, AVANT de fusionner, si la migration va passer.\n\n" +
      "  Écrire en tête du fichier, en commentaire, la requête qui établit l'état\n" +
      "  attendu — et ce qu'on attend d'elle. Voir docs/migrations.md.\n"
  );
  process.exit(1);
}

for (const [fichier, raison] of EXEMPTEES) {
  console.log(`[migrations] exemptée : ${fichier}\n  → ${raison}`);
}
