/**
 * Savoir-être — Évaluation comportementale
 * 5 critères notés de 1 à 10
 */

export interface CritereSavoirEtre {
  id: string;
  libelle: string;
  description: string;
  emoji: string;
  couleur: string;
}

export const CRITERES_SAVOIR_ETRE: CritereSavoirEtre[] = [
  {
    id: "autonomie",
    libelle: "Autonomie",
    description: "Capacité à travailler seul, à prendre des initiatives",
    emoji: "🧭",
    couleur: "#2563EB",
  },
  {
    id: "efforts",
    libelle: "Efforts",
    description: "Investissement personnel, persévérance dans la tâche",
    emoji: "💪",
    couleur: "#7C3AED",
  },
  {
    id: "rythme",
    libelle: "Rythme",
    description: "Rapidité d'exécution, respect des délais",
    emoji: "⏱",
    couleur: "#059669",
  },
  {
    id: "rigueur",
    libelle: "Rigueur et précision",
    description: "Soin apporté au travail, respect des consignes",
    emoji: "🎯",
    couleur: "#D97706",
  },
  {
    id: "attentif",
    libelle: "Attentif",
    description: "Écoute, concentration, réactivité aux consignes",
    emoji: "👁",
    couleur: "#BE185D",
  },
];

export type NotesSavoirEtre = Record<string, number | null>;

/**
 * Calcule la moyenne du savoir-être sur 10
 */
export function calculerMoyenneSavoirEtre(notes: NotesSavoirEtre): number | null {
  const vals = CRITERES_SAVOIR_ETRE
    .map((c) => notes[c.id])
    .filter((v): v is number => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
}

/**
 * Couleur selon la note /10
 */
export function couleurSavoirEtre(note: number | null): { bg: string; text: string; border: string } {
  if (note === null || note === undefined) {
    return { bg: "#F5F5F4", text: "#A8A29E", border: "#E7E5E4" };
  }
  const ratio = note / 10;
  const hue = Math.round(ratio * 142);
  return {
    bg: `hsl(${hue}, 85%, 92%)`,
    text: `hsl(${hue}, 85%, 30%)`,
    border: `hsl(${hue}, 85%, 78%)`,
  };
}
