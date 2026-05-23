// Données des compétences MELEC extraites de la grille d'évaluation
// Design: Dashboard Technique Compact — palette bleu MELEC, tableaux denses
//
// Règles de calcul :
//  1. Chaque compétence est notée sur 20 (ramené depuis son barème brut)
//  2. La note globale de l'évaluation est la moyenne pondérée des compétences
//     évaluées, ramenée sur 20 (coefficients définis ci-dessous)
//  3. Dans le fichier Excel : note /20 par compétence + note globale /20 sous C13

export interface Critere {
  id: string;
  libelle: string;
  noteMax: number;
  note: number | null;
}

export interface Competence {
  id: string;
  code: string;
  libelle: string;
  noteMax: number;       // Barème brut (ex: 60 pour C1)
  coef: number;          // Coefficient de pondération pour la note globale
  criteres: Critere[];
  couleur: string;
}

// Poids de chaque compétence sur le total de 240 points
// fournis par l'utilisateur : C1=18, C2=25.2, C3=12, C4=42...
// La note globale = Σ(pts_bruts_obtenus) / Σ(poids_compétences_évaluées) × 20
export const COMPETENCES: Competence[] = [
  {
    id: "c1",
    code: "C1",
    libelle: "ANALYSER LES CONDITIONS DE L'OPÉRATION ET SON CONTEXTE",
    noteMax: 60,
    coef: 18,   // poids sur 240
    couleur: "#2563EB",
    criteres: [
      { id: "c1_1", libelle: "Les symboles sont identifiés", noteMax: 10, note: null },
      { id: "c1_2", libelle: "La fonction des appareils est conforme", noteMax: 10, note: null },
      { id: "c1_3", libelle: "Les caractéristiques relevées sur la documentation sont conformes", noteMax: 10, note: null },
      { id: "c1_4", libelle: "Les informations relevées sur les plans ou schémas sont conformes", noteMax: 10, note: null },
      { id: "c1_5", libelle: "Les équipements et outillages sont correctement sélectionnés", noteMax: 10, note: null },
      { id: "c1_6", libelle: "Les mesures de prévention sont proposées", noteMax: 10, note: null },
    ],
  },
  {
    id: "c2",
    code: "C2",
    libelle: "ORGANISER L'OPÉRATION DANS SON CONTEXTE",
    noteMax: 60,
    coef: 25.2, // poids sur 240
    couleur: "#7C3AED",
    criteres: [
      { id: "c2_1", libelle: "Poste organisé pendant le câblage", noteMax: 10, note: null },
      { id: "c2_2", libelle: "Poste rangé après le câblage", noteMax: 10, note: null },
      { id: "c2_3", libelle: "Poste nettoyé", noteMax: 10, note: null },
      { id: "c2_4", libelle: "Outils adaptés", noteMax: 10, note: null },
      { id: "c2_5", libelle: "Respecter l'ordre logique de réalisation", noteMax: 20, note: null },
    ],
  },
  {
    id: "c3",
    code: "C3",
    libelle: "DÉFINIR UNE INSTALLATION À L'AIDE DE SOLUTIONS PRÉÉTABLIES",
    noteMax: 40,
    coef: 12,   // poids sur 240
    couleur: "#059669",
    criteres: [
      { id: "c3_1", libelle: "Le schéma proposé est conforme", noteMax: 10, note: null },
      { id: "c3_2", libelle: "La solution proposée est conforme", noteMax: 10, note: null },
      { id: "c3_3", libelle: "La modification proposée est conforme", noteMax: 10, note: null },
      { id: "c3_4", libelle: "Le matériel proposé est conforme", noteMax: 10, note: null },
    ],
  },
  {
    id: "c4",
    code: "C4",
    libelle: "RÉALISER UNE INSTALLATION DE MANIÈRE ÉCO-RESPONSABLE",
    noteMax: 100,
    coef: 42,   // poids sur 240
    couleur: "#D97706",
    criteres: [
      { id: "c4_1", libelle: "Esthétique industrielle", noteMax: 10, note: null },
      { id: "c4_2", libelle: "Peigne bornier, longueur de fils", noteMax: 10, note: null },
      { id: "c4_3", libelle: "Serrage connexion", noteMax: 10, note: null },
      { id: "c4_4", libelle: "Sertissage des embouts", noteMax: 10, note: null },
      { id: "c4_5", libelle: "Numérotation des conducteurs", noteMax: 10, note: null },
      { id: "c4_6", libelle: "Fonctionnement (-10pts par erreur de câblage)", noteMax: 50, note: null },
    ],
  },
  {
    id: "c5",
    code: "C5",
    libelle: "CONTRÔLER LES GRANDEURS CARACTÉRISTIQUES DE L'INSTALLATION",
    noteMax: 50,
    coef: 14,   // poids sur 240
    couleur: "#DC2626",
    criteres: [
      { id: "c5_1", libelle: "Choix de l'appareil de mesure", noteMax: 10, note: null },
      { id: "c5_2", libelle: "Utilisation des appareils de mesures (Raccordement)", noteMax: 10, note: null },
      { id: "c5_3", libelle: "Réglage des appareils de mesures (calibre, nature du signal, unités)", noteMax: 10, note: null },
      { id: "c5_4", libelle: "Lecture de l'appareil de mesure", noteMax: 10, note: null },
      { id: "c5_5", libelle: "Exploitation des mesures", noteMax: 10, note: null },
    ],
  },
  {
    id: "c6",
    code: "C6",
    libelle: "RÉGLER, PARAMÉTRER LES MATÉRIELS DE L'INSTALLATION",
    noteMax: 50,
    coef: 14,   // poids sur 240
    couleur: "#0891B2",
    criteres: [
      { id: "c6_1", libelle: "Réglage des protections thermiques, temporisations", noteMax: 10, note: null },
      { id: "c6_2", libelle: "Paramétrer un appareil simple (horloge, …)", noteMax: 10, note: null },
      { id: "c6_3", libelle: "Paramétrer un système numérique", noteMax: 10, note: null },
      { id: "c6_4", libelle: "Autonomie du réglage ou du paramétrage", noteMax: 10, note: null },
      { id: "c6_5", libelle: "Utilisation de la documentation", noteMax: 10, note: null },
    ],
  },
  {
    id: "c7",
    code: "C7",
    libelle: "VALIDER LE FONCTIONNEMENT DE L'INSTALLATION",
    noteMax: 50,
    coef: 14,   // poids sur 240
    couleur: "#7C3AED",
    criteres: [
      { id: "c7_1", libelle: "Mise en énergie maîtrisée", noteMax: 10, note: null },
      { id: "c7_2", libelle: "Mise en service maîtrisée", noteMax: 10, note: null },
      { id: "c7_3", libelle: "Mode manuel maîtrisé", noteMax: 10, note: null },
      { id: "c7_4", libelle: "Mode automatique maîtrisé", noteMax: 10, note: null },
      { id: "c7_5", libelle: "Sécurités et protections maîtrisées", noteMax: 10, note: null },
    ],
  },
  {
    id: "c8",
    code: "C8",
    libelle: "DIAGNOSTIQUER UN DYSFONCTIONNEMENT",
    noteMax: 140,
    coef: 28,   // poids sur 240
    couleur: "#BE185D",
    criteres: [
      { id: "c8_1", libelle: "Mise en évidence de la panne", noteMax: 10, note: null },
      { id: "c8_2", libelle: "Observation", noteMax: 20, note: null },
      { id: "c8_3", libelle: "Circuit défaillant", noteMax: 40, note: null },
      { id: "c8_4", libelle: "Relevé du circuit défaillant", noteMax: 10, note: null },
      { id: "c8_5", libelle: "Éléments à tester", noteMax: 10, note: null },
      { id: "c8_6", libelle: "Appareil utilisé", noteMax: 10, note: null },
      { id: "c8_7", libelle: "Condition de test", noteMax: 10, note: null },
      { id: "c8_8", libelle: "Critères de conformité", noteMax: 10, note: null },
      { id: "c8_9", libelle: "Point de mesure", noteMax: 10, note: null },
      { id: "c8_10", libelle: "Règles de sécurité respectées", noteMax: 10, note: null },
    ],
  },
  {
    id: "c9",
    code: "C9",
    libelle: "REMPLACER UN MATÉRIEL ÉLECTRIQUE",
    noteMax: 60,
    coef: 12,   // poids sur 240
    couleur: "#065F46",
    criteres: [
      { id: "c9_1", libelle: "Identification de l'appareil", noteMax: 10, note: null },
      { id: "c9_2", libelle: "Mise en sécurité de l'intervention", noteMax: 10, note: null },
      { id: "c9_3", libelle: "Relevé de la référence et confirmation de celle-ci", noteMax: 10, note: null },
      { id: "c9_4", libelle: "Relevé de câblage de l'appareil", noteMax: 10, note: null },
      { id: "c9_5", libelle: "Démontage et remontage avec méthode", noteMax: 20, note: null },
    ],
  },
  {
    id: "c10",
    code: "C10",
    libelle: "EXPLOITER LES OUTILS NUMÉRIQUES DANS LE CONTEXTE PRO",
    noteMax: 60,
    coef: 18,   // poids sur 240
    couleur: "#1D4ED8",
    criteres: [
      { id: "c10_1", libelle: "Utilisation See Electrical Expert", noteMax: 10, note: null },
      { id: "c10_2", libelle: "Utilisation site constructeur", noteMax: 10, note: null },
      { id: "c10_3", libelle: "Utilisation de Google Sheets", noteMax: 10, note: null },
      { id: "c10_4", libelle: "Gestion fichiers, sauvegarde, partage, Impression PDF, Drive", noteMax: 10, note: null },
      { id: "c10_5", libelle: "Utilisation Logiciel automatisme", noteMax: 10, note: null },
      { id: "c10_6", libelle: "Utilisation Messagerie, envoi pièce jointe", noteMax: 10, note: null },
    ],
  },
  {
    id: "c11",
    code: "C11",
    libelle: "COMPLÉTER LES DOCUMENTS LIÉS AUX OPÉRATIONS",
    noteMax: 40,
    coef: 12,   // poids sur 240
    couleur: "#92400E",
    criteres: [
      { id: "c11_1", libelle: "Les documents sont complétés totalement", noteMax: 10, note: null },
      { id: "c11_2", libelle: "Les documents sont complétés avec soin", noteMax: 10, note: null },
      { id: "c11_3", libelle: "Les documents sont correctement complétés", noteMax: 10, note: null },
      { id: "c11_4", libelle: "Les documents sont compris de façon autonome", noteMax: 10, note: null },
    ],
  },
  {
    id: "c12",
    code: "C12",
    libelle: "COMMUNIQUER ENTRE PROFESSIONNELS SUR L'OPÉRATION",
    noteMax: 40,
    coef: 16.8, // poids sur 240
    couleur: "#6D28D9",
    criteres: [
      { id: "c12_1", libelle: "Utilisation des bonnes terminologies", noteMax: 10, note: null },
      { id: "c12_2", libelle: "Communication à bon escient", noteMax: 10, note: null },
      { id: "c12_3", libelle: "S'exprime de façon claire et compréhensible", noteMax: 10, note: null },
      { id: "c12_4", libelle: "Est attentif lors de la communication de consigne", noteMax: 10, note: null },
    ],
  },
  {
    id: "c13",
    code: "C13",
    libelle: "COMMUNIQUER AVEC LE CLIENT/USAGER SUR L'OPÉRATION",
    noteMax: 50,
    coef: 14,   // poids sur 240
    couleur: "#0F766E",
    criteres: [
      { id: "c13_1", libelle: "Utilisation des bonnes terminologies", noteMax: 10, note: null },
      { id: "c13_2", libelle: "S'exprime de façon claire et compréhensible", noteMax: 10, note: null },
      { id: "c13_3", libelle: "La présentation est méthodique", noteMax: 10, note: null },
      { id: "c13_4", libelle: "La présentation est complète", noteMax: 10, note: null },
      { id: "c13_5", libelle: "Les règles de sécurité sont respectées", noteMax: 10, note: null },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
//  CALCUL DE LA NOTE D'UNE COMPÉTENCE SUR 20
// ─────────────────────────────────────────────────────────────

/**
 * Calcule la note brute obtenue et le barème max d'une compétence,
 * puis la ramène sur 20.
 */
export function calculerNoteCompetence(
  competence: Competence,
  notes: Record<string, number | null>
): { obtenu: number; max: number; sur20: number | null } {
  let obtenu = 0;
  let max = 0;
  for (const critere of competence.criteres) {
    const note = notes[critere.id];
    if (note !== null && note !== undefined) {
      obtenu += note;
    }
    max += critere.noteMax;
  }
  const sur20 = max > 0 ? Math.round((obtenu / max) * 20 * 100) / 100 : null;
  return { obtenu, max, sur20 };
}

// ─────────────────────────────────────────────────────────────
//  CALCUL DE LA NOTE GLOBALE SUR 20 (AVEC COEFFICIENTS)
// ─────────────────────────────────────────────────────────────

/**
 * Calcule la note globale de l'évaluation sur 20 avec la pondération exacte.
 *
 * Chaque compétence a un poids sur 240 (ex: C1=18, C4=42...).
 * Formule : noteGlobale = Σ(pts_bruts_obtenus_Ci) / Σ(poids_Ci_évalués) × 20
 *
 * Ainsi, si on évalue uniquement C1, C4 et C12 :
 *   - Le dénominateur = 18 + 42 + 16.8 = 76.8 (pas 240)
 *   - La note est ramenée sur ces seuls poids → toujours /20
 *
 * Seules les compétences ayant au moins un critère renseigné sont incluses.
 */
export function calculerNoteGlobale(
  competencesSelectionnees: string[],
  notes: Record<string, number | null>
): {
  noteGlobale: number | null;
  notesParComp: Array<{ code: string; sur20: number | null; coef: number; obtenu: number; max: number }>;
  totalCoefs: number;
} {
  if (competencesSelectionnees.length === 0) {
    return { noteGlobale: null, notesParComp: [], totalCoefs: 0 };
  }

  const notesParComp: Array<{ code: string; sur20: number | null; coef: number; obtenu: number; max: number }> = [];
  // pts_bruts_obtenus pondérés : pour chaque comp, on convertit le brut en fraction du poids
  // pts_pondérés_Ci = (obtenu_Ci / max_Ci) * poids_Ci
  let sommePtsPonderes = 0;
  let totalPoids = 0;

  for (const code of competencesSelectionnees) {
    const comp = COMPETENCES.find((c) => c.code === code);
    if (!comp) continue;

    const { obtenu, max, sur20 } = calculerNoteCompetence(comp, notes);
    notesParComp.push({ code, sur20, coef: comp.coef, obtenu, max });

    // N'inclure dans la moyenne que si au moins un critère a été noté
    if (sur20 !== null && max > 0) {
      // Points pondérés = fraction obtenue * poids de la compétence
      sommePtsPonderes += (obtenu / max) * comp.coef;
      totalPoids += comp.coef;
    }
  }

  // noteGlobale = (somme pts pondérés / total poids évalués) * 20
  const noteGlobale =
    totalPoids > 0
      ? Math.round((sommePtsPonderes / totalPoids) * 20 * 100) / 100
      : null;

  return { noteGlobale, notesParComp, totalCoefs: totalPoids };
}
