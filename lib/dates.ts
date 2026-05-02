// Locale-naive date helpers — week starts on Monday (ISO 8601).
// All dates are passed as "YYYY-MM-DD" strings to avoid TZ surprises.

export type ISODate = string;

export function toISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function startOfWeekMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = date.getDay(); // 0=Sun..6=Sat
  const diff = (dow + 6) % 7; // 0=Mon..6=Sun
  date.setDate(date.getDate() - diff);
  return date;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function weekDates(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const FULL_DAY_LABELS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];
const MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

export function dayShortLabel(d: Date): string {
  return DAY_LABELS[(d.getDay() + 6) % 7];
}
export function dayLongLabel(d: Date): string {
  return FULL_DAY_LABELS[(d.getDay() + 6) % 7];
}
export function dateShortLabel(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function dateLongLabel(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
