/**
 * Utilitaires Excel — Application MELEC Éval
 * Structure du fichier grilleévaluationApplication.xlsx :
 *   - Une feuille par classe (ex: TP26, TP27)
 *   - Ligne 1 : "Nom" + noms des élèves en colonnes B, C, D...
 *   - Ligne 2 : "Prénom" + prénoms des élèves
 *   - Blocs de 13 lignes (C1 à C13) séparés par une ligne vide
 *     Bloc 1 : lignes 3-15 (évaluation 1)
 *     Bloc 2 : lignes 17-29 (évaluation 2)
 *     Bloc 3 : lignes 31-43 (évaluation 3)
 *   - Chaque cellule [ligne compétence][colonne élève] = note sur 20
 */
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export interface EleveInfo {
  nom: string;
  prenom: string;
  classe: string; // nom de la feuille (ex: "TP26")
  colIndex: number; // index de colonne dans la feuille (0-based, 0 = col B)
}

export interface ClasseData {
  nom: string; // ex: "TP26"
  eleves: EleveInfo[];
}

export interface FichierGrille {
  classes: ClasseData[];
  rawWorkbook: XLSX.WorkBook;
}

// Codes des compétences dans l'ordre
const CODES_COMPETENCES = ["C1","C2","C3","C4","C5","C6","C7","C8","C9","C10","C11","C12","C13"];

// Lire le fichier Excel de grille et extraire les classes + élèves
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

          const nomRow = rows[0]; // Ligne 1 : Nom + noms
          const prenomRow = rows[1]; // Ligne 2 : Prénom + prénoms

          const eleves: EleveInfo[] = [];
          // Colonnes à partir de l'index 1 (colonne B)
          for (let col = 1; col < nomRow.length; col++) {
            const nom = String(nomRow[col] || "").trim();
            const prenom = String(prenomRow[col] || "").trim();
            if (nom || prenom) {
              eleves.push({
                nom: nom.toUpperCase(),
                prenom: prenom.charAt(0).toUpperCase() + prenom.slice(1).toLowerCase(),
                classe: sheetName,
                colIndex: col - 1, // 0-based depuis colonne B
              });
            }
          }

          if (eleves.length > 0) {
            classes.push({ nom: sheetName, eleves });
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

// Trouver le prochain bloc disponible (non rempli) pour un élève dans une feuille
// Structure : blocs de 13 lignes (C1-C13) séparés par 1 ligne vide
// Bloc 1 : lignes index 2-14 (rows[2] à rows[14])
// Bloc 2 : lignes index 16-28
// Bloc 3 : lignes index 30-42
const BLOCS_START = [2, 16, 30]; // index 0-based dans le tableau de lignes

function trouverBlocDisponible(
  ws: XLSX.WorkSheet,
  colIndex: number // 0-based depuis colonne B → colonne réelle = colIndex + 1
): number {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
  }) as (string | number | null)[][];

  const colReelle = colIndex + 1; // +1 car col 0 = "Nom"

  for (const blocStart of BLOCS_START) {
    // Vérifier si le bloc est vide pour cet élève
    let blocVide = true;
    for (let i = 0; i < 13; i++) {
      const rowIdx = blocStart + i;
      if (rows[rowIdx] && rows[rowIdx][colReelle] !== null && rows[rowIdx][colReelle] !== undefined && rows[rowIdx][colReelle] !== "") {
        blocVide = false;
        break;
      }
    }
    if (blocVide) return blocStart;
  }

  // Tous les blocs sont remplis → écraser le dernier
  return BLOCS_START[BLOCS_START.length - 1];
}

// Écrire les notes d'un élève dans le fichier Excel
export function ecrireNotesEleve(
  wb: XLSX.WorkBook,
  eleve: EleveInfo,
  notesParCompetence: Record<string, number | null>, // C1 -> note sur 20
  equipement: string,
  date: string
): XLSX.WorkBook {
  const ws = wb.Sheets[eleve.classe];
  if (!ws) return wb;

  // Lire les données existantes
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
  }) as (string | number | null)[][];

  // S'assurer que les lignes existent jusqu'à la ligne 43 (index 42)
  while (rows.length < 43) {
    rows.push(new Array(rows[0]?.length || 15).fill(null));
  }

  const colReelle = eleve.colIndex + 1; // colonne réelle dans le tableau

  // Trouver le bloc disponible
  const blocStart = trouverBlocDisponible(ws, eleve.colIndex);

  // Écrire les notes dans le bloc
  for (let i = 0; i < CODES_COMPETENCES.length; i++) {
    const code = CODES_COMPETENCES[i];
    const rowIdx = blocStart + i;
    
    // S'assurer que la ligne existe
    while (rows.length <= rowIdx) {
      rows.push(new Array(rows[0]?.length || 15).fill(null));
    }
    
    // S'assurer que la colonne "Cx" est bien en col 0
    if (!rows[rowIdx][0]) {
      rows[rowIdx][0] = code;
    }

    const note = notesParCompetence[code];
    rows[rowIdx][colReelle] = note !== null && note !== undefined ? note : null;
  }

  // Ajouter une ligne de métadonnées (date + équipement) dans la ligne vide avant le bloc si possible
  // On utilise la ligne vide juste avant le bloc pour stocker date/équipement
  const metaRowIdx = blocStart - 1;
  if (metaRowIdx >= 0) {
    while (rows.length <= metaRowIdx) {
      rows.push(new Array(rows[0]?.length || 15).fill(null));
    }
    // Stocker date + équipement dans la cellule de l'élève sur la ligne vide
    rows[metaRowIdx][colReelle] = `${date} | ${equipement}`;
  }

  // Reconstruire la feuille
  const newWs = XLSX.utils.aoa_to_sheet(rows);
  
  // Copier les propriétés de mise en forme si elles existent
  if (ws["!cols"]) newWs["!cols"] = ws["!cols"];
  if (ws["!rows"]) newWs["!rows"] = ws["!rows"];
  if (ws["!merges"]) newWs["!merges"] = ws["!merges"];

  wb.Sheets[eleve.classe] = newWs;
  return wb;
}

// Télécharger le fichier Excel modifié
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

// Lire les notes existantes d'un élève dans le fichier
export function lireNotesEleve(
  wb: XLSX.WorkBook,
  eleve: EleveInfo
): Array<{ bloc: number; notes: Record<string, number | null>; meta: string | null }> {
  const ws = wb.Sheets[eleve.classe];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
  }) as (string | number | null)[][];

  const colReelle = eleve.colIndex + 1;
  const resultats = [];

  for (let b = 0; b < BLOCS_START.length; b++) {
    const blocStart = BLOCS_START[b];
    const notes: Record<string, number | null> = {};
    let hasData = false;

    for (let i = 0; i < CODES_COMPETENCES.length; i++) {
      const code = CODES_COMPETENCES[i];
      const rowIdx = blocStart + i;
      const val = rows[rowIdx]?.[colReelle];
      if (val !== null && val !== undefined && val !== "") {
        notes[code] = Number(val);
        hasData = true;
      } else {
        notes[code] = null;
      }
    }

    // Lire la métadonnée (ligne vide avant le bloc)
    const metaRowIdx = blocStart - 1;
    const meta = metaRowIdx >= 0 ? String(rows[metaRowIdx]?.[colReelle] || "") || null : null;

    if (hasData) {
      resultats.push({ bloc: b + 1, notes, meta });
    }
  }

  return resultats;
}

// Ancienne fonction conservée pour compatibilité
export async function lireElevesDepuisExcel(file: File): Promise<Array<{ nom: string; prenom: string; classe?: string }>> {
  const grille = await lireFichierGrille(file);
  const eleves: Array<{ nom: string; prenom: string; classe?: string }> = [];
  for (const classe of grille.classes) {
    for (const eleve of classe.eleves) {
      eleves.push({ nom: eleve.nom, prenom: eleve.prenom, classe: eleve.classe });
    }
  }
  return eleves;
}

export type { XLSX };
