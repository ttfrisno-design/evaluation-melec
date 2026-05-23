/**
 * Calcul des notes d'épreuves du Bac Pro MELEC
 *
 * Structure des épreuves :
 *
 *  E2  (coef 3) — Préparation d'un ouvrage
 *    C1  /6    C3  /4    C10 /6    C11 /4
 *    Total barème E2 = 20 pts
 *
 *  E31 (coef 7) — Réalisation d'un équipement
 *    C2  /3,6  C4  /6    C5  /2    C6  /2
 *    C7  /2    C12 /2,4  C13 /2
 *    Total barème E31 = 20 pts
 *
 *  E32 (coef 2) — Livraison / Maintenance
 *    C8  /14   C9  /6
 *    Total barème E32 = 20 pts
 *
 * Formule pour chaque épreuve :
 *   note_épreuve = Σ(note_Ci/20 × poids_Ci) / Σ(poids_Ci disponibles) × 20
 *   → seules les compétences ayant une note sont incluses
 *   → la note est toujours ramenée sur 20
 */

export interface ConfigCompetenceEpreuve {
  code: string;   // ex: "C1"
  poids: number;  // poids dans l'épreuve (ex: 6 pour C1 dans E2)
}

export interface ConfigEpreuve {
  id: string;           // "E2", "E31", "E32"
  libelle: string;
  coefBac: number;      // coefficient au bac
  couleur: string;
  competences: ConfigCompetenceEpreuve[];
  totalBareme: number;  // somme des poids (= 20 pour chaque épreuve)
}

export const EPREUVES_BAC: ConfigEpreuve[] = [
  {
    id: "E2",
    libelle: "Préparation d'un ouvrage",
    coefBac: 3,
    couleur: "#2563EB",
    totalBareme: 20,
    competences: [
      { code: "C1",  poids: 6 },
      { code: "C3",  poids: 4 },
      { code: "C10", poids: 6 },
      { code: "C11", poids: 4 },
    ],
  },
  {
    id: "E31",
    libelle: "Réalisation d'un équipement",
    coefBac: 7,
    couleur: "#7C3AED",
    totalBareme: 20,
    competences: [
      { code: "C2",  poids: 3.6 },
      { code: "C4",  poids: 6   },
      { code: "C5",  poids: 2   },
      { code: "C6",  poids: 2   },
      { code: "C7",  poids: 2   },
      { code: "C12", poids: 2.4 },
      { code: "C13", poids: 2   },
    ],
  },
  {
    id: "E32",
    libelle: "Livraison / Maintenance",
    coefBac: 2,
    couleur: "#BE185D",
    totalBareme: 20,
    competences: [
      { code: "C8", poids: 14 },
      { code: "C9", poids: 6  },
    ],
  },
];

export interface ResultatEpreuve {
  id: string;
  libelle: string;
  coefBac: number;
  couleur: string;
  note: number | null;          // note /20
  nbCompDisponibles: number;    // nb de compétences avec une note
  nbCompTotal: number;          // nb total de compétences de l'épreuve
  poidsDisponibles: number;     // somme des poids des compétences notées
  poidsTotal: number;           // somme totale des poids (= 20)
  detailComps: Array<{
    code: string;
    poids: number;
    noteSur20: number | null;
  }>;
}

/**
 * Calcule les notes E2, E31, E32 à partir des notes de compétences /20.
 *
 * @param notesParCompetence  Map code → note /20 (ex: { "C1": 16.5, "C4": 14 })
 * @returns tableau des résultats par épreuve
 */
export function calculerNotesEpreuves(
  notesParCompetence: Record<string, number | null>
): ResultatEpreuve[] {
  return EPREUVES_BAC.map((epreuve) => {
    let sommeNotesXPoids = 0;
    let poidsDisponibles = 0;
    let nbCompDisponibles = 0;

    const detailComps = epreuve.competences.map((comp) => {
      const note = notesParCompetence[comp.code];
      const noteSur20 = note !== null && note !== undefined ? note : null;

      if (noteSur20 !== null) {
        sommeNotesXPoids += noteSur20 * comp.poids;
        poidsDisponibles += comp.poids;
        nbCompDisponibles++;
      }

      return { code: comp.code, poids: comp.poids, noteSur20 };
    });

    // note = Σ(note_Ci × poids_Ci) / Σ(poids disponibles)
    // → ramenée sur 20 (les poids sont déjà calibrés pour donner /20)
    const note =
      poidsDisponibles > 0
        ? Math.round((sommeNotesXPoids / poidsDisponibles) * 100) / 100
        : null;

    return {
      id: epreuve.id,
      libelle: epreuve.libelle,
      coefBac: epreuve.coefBac,
      couleur: epreuve.couleur,
      note,
      nbCompDisponibles,
      nbCompTotal: epreuve.competences.length,
      poidsDisponibles,
      poidsTotal: epreuve.totalBareme,
      detailComps,
    };
  });
}

/**
 * Calcule la moyenne générale du bac pondérée par les coefficients.
 * Seules les épreuves avec une note sont incluses.
 */
export function calculerMoyenneBac(resultats: ResultatEpreuve[]): number | null {
  let somme = 0;
  let totalCoef = 0;

  for (const r of resultats) {
    if (r.note !== null) {
      somme += r.note * r.coefBac;
      totalCoef += r.coefBac;
    }
  }

  return totalCoef > 0 ? Math.round((somme / totalCoef) * 100) / 100 : null;
}
