/**
 * Libellés de validité d'une invitation.
 *
 * **Pourquoi l'instant brut plutôt qu'un nombre de jours.** La lecture rendait
 * auparavant `joursRestants: Math.ceil(restant / 86_400_000)`, c'est-à-dire
 * qu'une fonction d'accès à la donnée décidait de l'unité d'affichage et jetait
 * l'instant réel. Deux conséquences, toutes deux vérifiables :
 *
 *  - un code expirant dans deux minutes annonçait « Encore 1 jour. » — et
 *    quelqu'un le dictait au téléphone en disant « tu as jusqu'à demain » ;
 *  - la branche écrite pour ce cas (« Il expire aujourd'hui. ») était
 *    **inatteignable**, la requête filtrant déjà `expires_at > maintenant`,
 *    donc `ceil(...)` valant toujours au moins 1.
 *
 * L'unité est une décision de vue. Elle vit donc ici, avec l'instant comme
 * entrée et l'horloge en paramètre — ce qui la rend testable sur ses bornes.
 */

const MS_PAR_HEURE = 3_600_000;
const MS_PAR_JOUR = 86_400_000;

export function validite(expiresAt: string, maintenant: Date): string {
  const restant = new Date(expiresAt).getTime() - maintenant.getTime();

  if (restant <= 0) return "Il a expiré.";

  if (restant < MS_PAR_HEURE) {
    const minutes = Math.max(1, Math.round(restant / 60_000));
    return minutes === 1 ? "Il expire dans 1 minute." : `Il expire dans ${minutes} minutes.`;
  }

  if (restant < MS_PAR_JOUR) {
    const heures = Math.floor(restant / MS_PAR_HEURE);
    return heures === 1 ? "Il expire dans 1 heure." : `Il expire dans ${heures} heures.`;
  }

  const jours = Math.floor(restant / MS_PAR_JOUR);
  return jours === 1 ? "Encore 1 jour." : `Encore ${jours} jours.`;
}

export function usages(n: number): string {
  if (n <= 0) return "Il n'a plus d'usage disponible.";
  return n === 1
    ? "1 personne peut encore s'en servir."
    : `${n} personnes peuvent encore s'en servir.`;
}
