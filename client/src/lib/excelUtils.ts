/**
 * Utilitaires Excel — Application MELEC Éval
 *
 * Structure exacte du fichier "grille_melec_structuree.xlsx" :
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Onglet classe (ex: "TP2", "1P2")                           │
 * │  Col A : Nom | Col B : Prénom | Col C : Note /20            │
 * │  Ligne 1 : En-tête ("Élève", "Date", "Note sur 20")         │
 * │  Ligne 2+ : 1 ligne par élève                               │
 * ├─────────────────────────────────────────────────────────────┤
 * │  Onglet élève (ex: "DUPONT Jean")                           │
 * │  Col A : Libellé | Col B : Valeur                           │
 * │  L1 : "Évaluation" | "Détail"                               │
 * │  L2 : "Date"       | date                                   │
 * │  L3 : "C1"         | note /20                               │
 * │  ...                                                        │
 * │  L15: "C13"        | note /20                               │
 * │  (bloc répété à partir de L17 pour la 2e évaluation, etc.)  │
 * └─────────────────────────────────────────────────────────────┘
 */
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────

export interface EleveInfo {
  nom: string;
  prenom: string;
  classe: string;
  colIndex: number; // conservé pour compatibilité
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
  commentaire?: string; // commentaire optionnel
}

export interface BlocEvaluation {
  date: string;
  equipement: string;
  notes: Record<string, number | null>;
  noteGlobale: number | null;
  commentaire?: string;
}

const CODES_COMPETENCES = [
  "C1","C2","C3","C4","C5","C6","C7",
  "C8","C9","C10","C11","C12","C13",
];

// Taille d'un bloc élève : 1 ligne date + 13 compétences + 1 note globale = 15 lignes
// + 1 ligne vide séparateur = 16 lignes par bloc
const BLOC_SIZE = 16;

// ─────────────────────────────────────────────────────────────
//  LECTURE DU FICHIER
// ─────────────────────────────────────────────────────────────

/**
 * Lit le fichier Excel et extrait les classes + élèves.
 * Structure attendue :
 *  - Onglets classe : ligne 1 = en-tête, lignes 2+ = élèves
 *    Col A = Nom (ou "Élève" = "NOM Prénom"), Col B = Prénom, Col C = Note
 *  - Onglets élève : nom de l'onglet = "NOM Prénom"
 */
export async function lireFichierGrille(file: File): Promise<FichierGrille> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const classes: ClasseData[] = [];

        // Identifier les onglets classe (ceux qui ne contiennent pas d'espace
        // ou qui correspondent à un pattern de classe)
        const ongletsClasse = wb.SheetNames.filter((name) => {
          // Un onglet élève a le format "NOM Prénom" (contient un espace)
          // Un onglet classe est court et sans espace ou suit un pattern
          return !name.includes(" ") || /^(TP|1P|2P|BTS|CAP|BAC|Term)/i.test(name);
        });

        for (const sheetName of ongletsClasse) {
          const ws = wb.Sheets[sheetName];
          if (!ws) continue;

          const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
            header: 1,
            defval: null,
          }) as (string | null)[][];

          if (rows.length < 2) continue;

          const eleves: EleveInfo[] = [];

          // Ligne 1 = en-tête → commencer à la ligne 2 (index 1)
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || (!row[0] && !row[1])) continue;

            let nom = "";
            let prenom = "";

            // Cas 1 : Col A = "NOM Prénom" (format compact), Col B vide
            const colA = String(row[0] || "").trim();
            const colB = String(row[1] || "").trim();

            if (colA && !colB) {
              // Format "NOM Prénom" dans la colonne A
              const parts = colA.split(" ");
              nom = parts[0].toUpperCase();
              prenom = parts.slice(1).join(" ");
            } else if (colA && colB) {
              // Col A = Nom, Col B = Prénom
              nom = colA.toUpperCase();
              prenom = colB;
            }

            if (nom) {
              eleves.push({ nom, prenom, classe: sheetName, colIndex: i - 1 });
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

// ─────────────────────────────────────────────────────────────
//  ENREGISTREMENT D'UNE ÉVALUATION
// ─────────────────────────────────────────────────────────────

/**
 * Nom de l'onglet élève = "NOM Prénom" (max 31 caractères, règle Excel)
 */
function nomOngletEleve(nom: string, prenom: string): string {
  const raw = `${nom} ${prenom}`.replace(/[\\/*?[\]:]/g, "").trim();
  return raw.slice(0, 31);
}

/**
 * Enregistre une évaluation dans le workbook :
 *  1. Met à jour l'onglet classe : col A=Nom, col B=Prénom, col C=Note/20
 *  2. Met à jour l'onglet élève : blocs Date + C1..C13 + Note globale
 */
export function enregistrerEvaluation(
  wb: XLSX.WorkBook,
  entree: EntreeEvaluation
): XLSX.WorkBook {
  wb = _mettreAJourOngletClasse(wb, entree);
  wb = _mettreAJourOngletEleve(wb, entree);
  return wb;
}

/**
 * Onglet classe :
 *  Ligne 1 : "Nom" | "Prénom" | "Note /20"
 *  Lignes 2+ : une ligne par élève (mise à jour si existe, sinon ajout)
 */
function _mettreAJourOngletClasse(
  wb: XLSX.WorkBook,
  entree: EntreeEvaluation
): XLSX.WorkBook {
  const { classe, nom, prenom, noteGlobale, date } = entree;

  let rows: (string | number | null)[][] = [];

  if (wb.Sheets[classe]) {
    rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[classe], {
      header: 1,
      defval: null,
    }) as (string | number | null)[][];
  }

  // En-tête
  if (rows.length === 0) {
    rows.push(["Nom", "Prénom", "Note /20"]);
  } else {
    // Normaliser l'en-tête
    rows[0] = ["Nom", "Prénom", "Note /20"];
  }

  // Chercher si l'élève existe déjà dans le tableau
  const nomComplet = `${nom} ${prenom}`.toUpperCase();
  let ligneEleve = -1;
  for (let i = 1; i < rows.length; i++) {
    const a = String(rows[i][0] || "").toUpperCase().trim();
    const b = String(rows[i][1] || "").toUpperCase().trim();
    if (
      a === nom.toUpperCase() && b === prenom.toUpperCase() ||
      a === nomComplet
    ) {
      ligneEleve = i;
      break;
    }
  }

  const noteVal = noteGlobale !== null ? noteGlobale : "";

  if (ligneEleve >= 0) {
    // Mettre à jour la note de l'élève existant
    rows[ligneEleve][0] = nom;
    rows[ligneEleve][1] = prenom;
    rows[ligneEleve][2] = noteVal;
  } else {
    // Ajouter l'élève
    rows.push([nom, prenom, noteVal]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 10 }];

  wb.Sheets[classe] = ws;
  if (!wb.SheetNames.includes(classe)) {
    wb.SheetNames.unshift(classe); // classes en premier
  }

  return wb;
}

/**
 * Onglet élève (ex: "DUPONT Jean") :
 *  Structure par bloc (16 lignes) :
 *   L1 : "Évaluation" | "Détail"
 *   L2 : "Date"       | date
 *   L3 : "C1"         | note /20
 *   ...
 *   L15: "C13"        | note /20
 *   L16: "Note /20"   | noteGlobale
 *   (ligne vide séparateur entre blocs)
 *
 * Si l'onglet existe déjà, ajouter un nouveau bloc à la suite.
 * Si l'onglet n'existe pas, le créer.
 */
function _mettreAJourOngletEleve(
  wb: XLSX.WorkBook,
  entree: EntreeEvaluation
): XLSX.WorkBook {
  const { nom, prenom, date, equipement, notesParCompetence, noteGlobale } = entree;
  const nomOnglet = nomOngletEleve(nom, prenom);

  let rows: (string | number | null)[][] = [];

  if (wb.Sheets[nomOnglet]) {
    rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomOnglet], {
      header: 1,
      defval: null,
    }) as (string | number | null)[][];
  }

  // Si l'onglet est vide ou nouveau, initialiser l'en-tête
  if (rows.length === 0) {
    rows.push(["Évaluation", "Détail"]);
    rows.push([]); // ligne vide
  }

  // Construire le nouveau bloc
  const bloc: (string | number | null)[][] = [];
  bloc.push(["Date", date]);
  if (equipement) bloc.push(["Équipement", equipement]);
  if (entree.commentaire?.trim()) bloc.push(["Commentaire", entree.commentaire.trim()]);

  for (const code of CODES_COMPETENCES) {
    const note = notesParCompetence[code];
    bloc.push([code, note !== null && note !== undefined ? note : ""]);
  }

  bloc.push(["Note /20", noteGlobale !== null ? noteGlobale : ""]);
  bloc.push([]); // ligne vide séparateur

  rows.push(...bloc);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 16 }, { wch: 12 }];

  wb.Sheets[nomOnglet] = ws;
  if (!wb.SheetNames.includes(nomOnglet)) {
    wb.SheetNames.push(nomOnglet);
  }

  return wb;
}

// ─────────────────────────────────────────────────────────────
//  LECTURE DES ÉVALUATIONS D'UN ÉLÈVE
// ─────────────────────────────────────────────────────────────

export function lireEvaluationsEleve(
  wb: XLSX.WorkBook,
  nom: string,
  prenom: string
): BlocEvaluation[] {
  const nomOnglet = nomOngletEleve(nom, prenom);
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
    const label = String(row?.[0] || "").trim().toLowerCase();

    if (label === "date") {
      const date = String(row[1] || "");
      let equipement = "";
      let commentaireBloc = "";
      const notes: Record<string, number | null> = {};
      let noteGlobale: number | null = null;
      i++;

      while (i < rows.length) {
        const r = rows[i];
        if (!r || (r[0] === null && r[1] === null)) break;
        const lbl = String(r[0] || "").trim();
        const val = r[1];

        if (lbl.toLowerCase() === "équipement") {
          equipement = String(val || "");
        } else if (lbl.toLowerCase() === "commentaire") {
          // lire le commentaire pour l'afficher dans le tableau de bord
          if (val !== null && val !== "") commentaireBloc = String(val);
        } else if (lbl.toLowerCase() === "note /20") {
          noteGlobale = val !== null && val !== "" ? Number(val) : null;
        } else if (CODES_COMPETENCES.includes(lbl)) {
          notes[lbl] = val !== null && val !== "" ? Number(val) : null;
        }
        i++;
      }

      if (date) blocs.push({
        date,
        equipement,
        notes,
        noteGlobale,
        commentaire: commentaireBloc || undefined,
      });
    } else {
      i++;
    }
  }

  return blocs;
}

// ─────────────────────────────────────────────────────────────
//  TÉLÉCHARGEMENT
// ─────────────────────────────────────────────────────────────

export function telechargerFichierGrille(
  wb: XLSX.WorkBook,
  nomFichier = "grille_melec_structuree.xlsx"
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
    const ws = XLSX.utils.aoa_to_sheet([["Nom", "Prénom", "Note /20"]]);
    ws["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, classe);
  }
  return wb;
}

// ─────────────────────────────────────────────────────────────
//  GESTION DES ÉLÈVES ET DES CLASSES
// ─────────────────────────────────────────────────────────────

/**
 * Ajoute un élève dans l'onglet classe du workbook.
 * Crée l'onglet classe s'il n'existe pas encore.
 * Retourne false si l'élève existe déjà dans la classe.
 */
export function ajouterEleve(
  wb: XLSX.WorkBook,
  nom: string,
  prenom: string,
  classe: string
): { wb: XLSX.WorkBook; succes: boolean; message: string } {
  const nomNorm = nom.trim().toUpperCase();
  const prenomNorm = prenom.trim();

  if (!nomNorm) {
    return { wb, succes: false, message: "Le nom est obligatoire." };
  }
  if (!classe.trim()) {
    return { wb, succes: false, message: "La classe est obligatoire." };
  }

  let rows: (string | number | null)[][] = [];

  if (wb.Sheets[classe]) {
    rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[classe], {
      header: 1,
      defval: null,
    }) as (string | number | null)[][];
  }

  // En-tête si absent
  if (rows.length === 0) {
    rows.push(["Nom", "Prénom", "Note /20"]);
  }

  // Vérifier si l'élève existe déjà
  for (let i = 1; i < rows.length; i++) {
    const a = String(rows[i][0] || "").toUpperCase().trim();
    const b = String(rows[i][1] || "").toLowerCase().trim();
    if (a === nomNorm && b === prenomNorm.toLowerCase()) {
      return { wb, succes: false, message: `${nomNorm} ${prenomNorm} existe déjà dans la classe ${classe}.` };
    }
  }

  // Ajouter l'élève
  rows.push([nomNorm, prenomNorm, null]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 10 }];
  wb.Sheets[classe] = ws;

  if (!wb.SheetNames.includes(classe)) {
    // Insérer la classe en premier (avant les onglets élèves)
    const premierOngletEleve = wb.SheetNames.findIndex((n) => n.includes(" "));
    if (premierOngletEleve >= 0) {
      wb.SheetNames.splice(premierOngletEleve, 0, classe);
    } else {
      wb.SheetNames.unshift(classe);
    }
  }

  return { wb, succes: true, message: `${nomNorm} ${prenomNorm} ajouté(e) à la classe ${classe}.` };
}

/**
 * Supprime un élève de l'onglet classe et supprime son onglet dédié.
 * Retourne false si l'élève n'est pas trouvé.
 */
export function supprimerEleve(
  wb: XLSX.WorkBook,
  nom: string,
  prenom: string,
  classe: string
): { wb: XLSX.WorkBook; succes: boolean; message: string } {
  const nomNorm = nom.trim().toUpperCase();
  const prenomNorm = prenom.trim();

  // Supprimer de l'onglet classe
  if (wb.Sheets[classe]) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[classe], {
      header: 1,
      defval: null,
    }) as (string | number | null)[][];

    const ligneIdx = rows.findIndex((row, i) => {
      if (i === 0) return false;
      const a = String(row[0] || "").toUpperCase().trim();
      const b = String(row[1] || "").toLowerCase().trim();
      return a === nomNorm && b === prenomNorm.toLowerCase();
    });

    if (ligneIdx < 0) {
      return { wb, succes: false, message: `${nomNorm} ${prenomNorm} introuvable dans la classe ${classe}.` };
    }

    rows.splice(ligneIdx, 1);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 10 }];
    wb.Sheets[classe] = ws;
  }

  // Supprimer l'onglet élève s'il existe
  const nomOnglet = `${nomNorm} ${prenomNorm}`.slice(0, 31);
  if (wb.Sheets[nomOnglet]) {
    delete wb.Sheets[nomOnglet];
    wb.SheetNames = wb.SheetNames.filter((n) => n !== nomOnglet);
  }

  return { wb, succes: true, message: `${nomNorm} ${prenomNorm} supprimé(e) de la classe ${classe}.` };
}

/**
 * Ajoute une nouvelle classe (onglet) dans le workbook.
 * Retourne false si la classe existe déjà.
 */
export function ajouterClasse(
  wb: XLSX.WorkBook,
  nomClasse: string
): { wb: XLSX.WorkBook; succes: boolean; message: string } {
  const nom = nomClasse.trim();
  if (!nom) return { wb, succes: false, message: "Le nom de la classe est obligatoire." };
  if (wb.SheetNames.includes(nom)) {
    return { wb, succes: false, message: `La classe "${nom}" existe déjà.` };
  }

  const ws = XLSX.utils.aoa_to_sheet([["Nom", "Prénom", "Note /20"]]);
  ws["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 10 }];

  // Insérer avant les onglets élèves
  const premierOngletEleve = wb.SheetNames.findIndex((n) => n.includes(" "));
  if (premierOngletEleve >= 0) {
    wb.SheetNames.splice(premierOngletEleve, 0, nom);
  } else {
    wb.SheetNames.push(nom);
  }
  wb.Sheets[nom] = ws;

  return { wb, succes: true, message: `Classe "${nom}" créée.` };
}

/**
 * Supprime une classe et tous ses élèves du workbook.
 */
export function supprimerClasse(
  wb: XLSX.WorkBook,
  nomClasse: string
): { wb: XLSX.WorkBook; succes: boolean; message: string } {
  if (!wb.SheetNames.includes(nomClasse)) {
    return { wb, succes: false, message: `La classe "${nomClasse}" n'existe pas.` };
  }

  // Récupérer les élèves de la classe pour supprimer leurs onglets
  const ws = wb.Sheets[nomClasse];
  if (ws) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as (string | null)[][];
    for (let i = 1; i < rows.length; i++) {
      const nom = String(rows[i][0] || "").toUpperCase().trim();
      const prenom = String(rows[i][1] || "").trim();
      if (nom) {
        const nomOnglet = `${nom} ${prenom}`.slice(0, 31);
        if (wb.Sheets[nomOnglet]) {
          delete wb.Sheets[nomOnglet];
          wb.SheetNames = wb.SheetNames.filter((n) => n !== nomOnglet);
        }
      }
    }
  }

  delete wb.Sheets[nomClasse];
  wb.SheetNames = wb.SheetNames.filter((n) => n !== nomClasse);

  return { wb, succes: true, message: `Classe "${nomClasse}" et ses élèves supprimés.` };
}
