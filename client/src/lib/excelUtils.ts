/**
 * Utilitaires Excel — Application MELEC Éval
 *
 * Structure du fichier généré "grilleévaluationApplication.xlsx" :
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  Onglet "TP26"  (onglet classe)                             │
 *  │  Colonnes : Nom | Prénom | Date | Équipement | Note /20     │
 *  │  1 ligne par évaluation enregistrée pour cette classe       │
 *  ├─────────────────────────────────────────────────────────────┤
 *  │  Onglet "1P2"   (onglet classe)                             │
 *  │  Même structure                                             │
 *  ├─────────────────────────────────────────────────────────────┤
 *  │  Onglet "ADAM Louis" (onglet élève)                         │
 *  │  Ligne 1 : Date | Équipement                                │
 *  │  Ligne 2 : C1  | note/20                                    │
 *  │  Ligne 3 : C2  | note/20                                    │
 *  │  ...                                                        │
 *  │  Ligne N : Note globale /20                                 │
 *  │  (bloc répété pour chaque nouvelle évaluation)              │
 *  └─────────────────────────────────────────────────────────────┘
 */
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────

export interface EleveInfo {
  nom: string;
  prenom: string;
  classe: string; // ex: "TP26"
  colIndex: number; // non utilisé dans la nouvelle structure mais conservé
}

export interface ClasseData {
  nom: string;
  eleves: EleveInfo[];
}

export interface FichierGrille {
  classes: ClasseData[];
  rawWorkbook: XLSX.WorkBook;
}

export interface EntreeEvaluation {
  date: string;
  equipement: string;
  nom: string;
  prenom: string;
  classe: string;
  notesParCompetence: Record<string, number | null>; // C1 -> note /20
  noteGlobale: number | null;
}

// ─────────────────────────────────────────────────────────────
//  LECTURE DU FICHIER EXISTANT
// ─────────────────────────────────────────────────────────────

/**
 * Lit le fichier Excel et extrait les classes + élèves depuis les onglets.
 * Détecte automatiquement les onglets "classe" (TP26, 1P2…) et "élève".
 */
export async function lireFichierGrille(file: File): Promise<FichierGrille> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const classes: ClasseData[] = [];

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
            header: 1,
            defval: null,
          }) as (string | null)[][];

          if (rows.length < 2) continue;

          const header = rows[0];
          // Détecter un onglet "classe" : première colonne = "Nom"
          const isClasseSheet =
            header &&
            String(header[0] || "").toLowerCase().includes("nom") &&
            !String(sheetName).includes(" "); // onglet élève a un espace

          if (isClasseSheet) {
            // Extraire les élèves depuis les lignes de données
            const eleves: EleveInfo[] = [];
            const seen = new Set<string>();
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              const nom = String(row[0] || "").trim().toUpperCase();
              const prenom = String(row[1] || "").trim();
              if (nom && prenom) {
                const key = `${nom}|${prenom}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  eleves.push({ nom, prenom, classe: sheetName, colIndex: 0 });
                }
              }
            }
            if (eleves.length > 0) {
              classes.push({ nom: sheetName, eleves });
            }
          }
        }

        // Si aucun onglet classe détecté, créer des classes vides par défaut
        if (classes.length === 0) {
          // Chercher des onglets qui ressemblent à des classes (TP, 1P, BTS…)
          for (const sheetName of wb.SheetNames) {
            if (/^(TP|1P|2P|BTS|CAP|BAC)/i.test(sheetName)) {
              classes.push({ nom: sheetName, eleves: [] });
            }
          }
        }

        resolve({ classes, rawWorkbook: wb });
      } catch (err) {
        reject(new Error("Impossible de lire le fichier Excel : " + String(err)));
      }
    };
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier."));
    reader.readAsArrayBuffer(file);
  });
}

// ─────────────────────────────────────────────────────────────
//  CRÉATION / MISE À JOUR DU FICHIER EXCEL
// ─────────────────────────────────────────────────────────────

const CODES_COMPETENCES = [
  "C1","C2","C3","C4","C5","C6","C7",
  "C8","C9","C10","C11","C12","C13",
];

// Couleurs de fond pour les en-têtes (format ARGB pour XLSX)
const COULEUR_ENTETE = "FF2563EB";   // Bleu MELEC
const COULEUR_NOTE   = "FF1E3A5F";   // Bleu foncé
const COULEUR_GLOBAL = "FFEF4444";   // Rouge pour note globale

/**
 * Enregistre une évaluation dans le workbook :
 *  1. Met à jour l'onglet classe (1 ligne : Nom | Prénom | Date | Équipement | Note/20)
 *  2. Met à jour l'onglet élève (bloc : Date/Équipement + C1..C13 + Note globale)
 *  3. Crée les onglets s'ils n'existent pas
 */
export function enregistrerEvaluation(
  wb: XLSX.WorkBook,
  entree: EntreeEvaluation
): XLSX.WorkBook {
  const { date, equipement, nom, prenom, classe, notesParCompetence, noteGlobale } = entree;

  // ── 1. Onglet CLASSE ──────────────────────────────────────
  wb = _mettreAJourOngletClasse(wb, classe, nom, prenom, date, equipement, noteGlobale);

  // ── 2. Onglet ÉLÈVE ───────────────────────────────────────
  const nomOngletEleve = _nomOngletEleve(nom, prenom);
  wb = _mettreAJourOngletEleve(wb, nomOngletEleve, nom, prenom, classe, date, equipement, notesParCompetence, noteGlobale);

  return wb;
}

/**
 * Met à jour l'onglet classe.
 * Structure : Nom | Prénom | Date | Équipement | Note /20
 */
function _mettreAJourOngletClasse(
  wb: XLSX.WorkBook,
  classe: string,
  nom: string,
  prenom: string,
  date: string,
  equipement: string,
  noteGlobale: number | null
): XLSX.WorkBook {
  let rows: (string | number | null)[][] = [];

  // Charger l'onglet existant ou créer
  if (wb.Sheets[classe]) {
    rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[classe], {
      header: 1,
      defval: null,
    }) as (string | number | null)[][];
  }

  // En-tête si absent
  if (rows.length === 0 || String(rows[0][0] || "").toLowerCase() !== "nom") {
    rows.unshift(["Nom", "Prénom", "Date", "Équipement", "Note /20"]);
  }

  // Ajouter la nouvelle ligne
  rows.push([
    nom,
    prenom,
    date,
    equipement || "",
    noteGlobale !== null ? noteGlobale : "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Largeurs de colonnes
  ws["!cols"] = [
    { wch: 18 }, // Nom
    { wch: 16 }, // Prénom
    { wch: 12 }, // Date
    { wch: 28 }, // Équipement
    { wch: 10 }, // Note /20
  ];

  wb.Sheets[classe] = ws;
  if (!wb.SheetNames.includes(classe)) {
    wb.SheetNames.push(classe);
  }

  return wb;
}

/**
 * Met à jour l'onglet élève.
 * Structure par bloc d'évaluation :
 *   Ligne 1 : "Date"       | valeur date  | "Équipement" | valeur équipement
 *   Ligne 2 : "C1"         | note /20
 *   ...
 *   Ligne 14: "C13"        | note /20
 *   Ligne 15: "Note /20"   | noteGlobale
 *   Ligne 16: (vide séparateur)
 */
function _mettreAJourOngletEleve(
  wb: XLSX.WorkBook,
  nomOnglet: string,
  nom: string,
  prenom: string,
  classe: string,
  date: string,
  equipement: string,
  notesParCompetence: Record<string, number | null>,
  noteGlobale: number | null
): XLSX.WorkBook {
  let rows: (string | number | null)[][] = [];

  // Charger l'onglet existant ou créer
  if (wb.Sheets[nomOnglet]) {
    rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomOnglet], {
      header: 1,
      defval: null,
    }) as (string | number | null)[][];
  }

  // En-tête élève si absent
  if (rows.length === 0) {
    rows.push([`Élève : ${nom} ${prenom}`, "", `Classe : ${classe}`]);
    rows.push([]); // ligne vide
  }

  // Construire le bloc de cette évaluation
  const bloc: (string | number | null)[][] = [];

  // Ligne date + équipement
  bloc.push(["Date", date, "Équipement", equipement || ""]);

  // 1 ligne par compétence évaluée
  for (const code of CODES_COMPETENCES) {
    const note = notesParCompetence[code];
    if (note !== null && note !== undefined) {
      bloc.push([code, note]);
    }
  }

  // Ligne note globale
  bloc.push(["Note globale /20", noteGlobale !== null ? noteGlobale : ""]);

  // Ligne vide séparateur
  bloc.push([]);

  // Ajouter le bloc à la suite
  rows.push(...bloc);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Largeurs de colonnes
  ws["!cols"] = [
    { wch: 20 }, // Libellé
    { wch: 12 }, // Valeur
    { wch: 14 }, // Libellé 2
    { wch: 28 }, // Valeur 2
  ];

  wb.Sheets[nomOnglet] = ws;
  if (!wb.SheetNames.includes(nomOnglet)) {
    wb.SheetNames.push(nomOnglet);
  }

  return wb;
}

/**
 * Génère le nom de l'onglet élève (max 31 caractères, règle Excel).
 */
function _nomOngletEleve(nom: string, prenom: string): string {
  const raw = `${nom} ${prenom}`.replace(/[\\/*?[\]:]/g, "").trim();
  return raw.slice(0, 31);
}

// ─────────────────────────────────────────────────────────────
//  TÉLÉCHARGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Télécharge le workbook sous forme de fichier .xlsx.
 */
export function telechargerFichierGrille(
  wb: XLSX.WorkBook,
  nomFichier = "grilleévaluationApplication.xlsx"
): Blob {
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, nomFichier);
  return blob;
}

/**
 * Crée un workbook vide avec les onglets de classes pré-créés.
 */
export function creerWorkbookVide(classes: string[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const classe of classes) {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nom", "Prénom", "Date", "Équipement", "Note /20"],
    ]);
    ws["!cols"] = [
      { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, classe);
  }
  return wb;
}

// ─────────────────────────────────────────────────────────────
//  LECTURE DES ÉVALUATIONS EXISTANTES D'UN ÉLÈVE
// ─────────────────────────────────────────────────────────────

export interface BlocEvaluation {
  date: string;
  equipement: string;
  notes: Record<string, number | null>;
  noteGlobale: number | null;
}

/**
 * Lit l'historique des évaluations d'un élève depuis son onglet dédié.
 */
export function lireEvaluationsEleve(
  wb: XLSX.WorkBook,
  nom: string,
  prenom: string
): BlocEvaluation[] {
  const nomOnglet = _nomOngletEleve(nom, prenom);
  const ws = wb.Sheets[nomOnglet];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
  }) as (string | number | null)[][];

  const blocs: BlocEvaluation[] = [];
  let i = 0;

  while (i < rows.length) {
    const row = rows[i];
    // Détecter une ligne "Date"
    if (row && String(row[0] || "").toLowerCase() === "date") {
      const date = String(row[1] || "");
      const equipement = String(row[3] || "");
      const notes: Record<string, number | null> = {};
      let noteGlobale: number | null = null;
      i++;

      // Lire les lignes suivantes jusqu'à la ligne vide
      while (i < rows.length) {
        const r = rows[i];
        if (!r || (r[0] === null && r[1] === null)) break;

        const label = String(r[0] || "").trim();
        const val = r[1];

        if (label === "Note globale /20") {
          noteGlobale = val !== null && val !== "" ? Number(val) : null;
        } else if (CODES_COMPETENCES.includes(label)) {
          notes[label] = val !== null && val !== "" ? Number(val) : null;
        }
        i++;
      }

      if (date) {
        blocs.push({ date, equipement, notes, noteGlobale });
      }
    } else {
      i++;
    }
  }

  return blocs;
}

// ─────────────────────────────────────────────────────────────
//  COMPATIBILITÉ — fonctions conservées pour l'import élèves
// ─────────────────────────────────────────────────────────────

export async function lireElevesDepuisExcel(
  file: File
): Promise<Array<{ nom: string; prenom: string; classe?: string }>> {
  const grille = await lireFichierGrille(file);
  const eleves: Array<{ nom: string; prenom: string; classe?: string }> = [];
  for (const classe of grille.classes) {
    for (const eleve of classe.eleves) {
      eleves.push({ nom: eleve.nom, prenom: eleve.prenom, classe: eleve.classe });
    }
  }
  return eleves;
}
