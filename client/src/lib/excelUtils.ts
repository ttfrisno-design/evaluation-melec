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
import { calculerNotesEpreuves, calculerMoyenneBac } from "./epreuvesBac";

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────

export interface EleveInfo {
  nom: string;
  prenom: string;
  classe: string;
  colIndex: number; // conservé pour compatibilité
  numeroCandidat?: string; // numéro de candidat (optionnel)
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
  savoirEtre?: Record<string, number | null>; // id -> note 1-10
}

export interface BlocEvaluation {
  date: string;
  equipement: string;
  notes: Record<string, number | null>;
  noteGlobale: number | null;
  commentaire?: string;
  savoirEtre?: Record<string, number | null>;
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
              // Lire le numéro de candidat en colonne C
              const numeroCandidat = row[2] ? String(row[2]).trim() : undefined;
              eleves.push({ nom, prenom, classe: sheetName, colIndex: i - 1, numeroCandidat });
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
 * Clone profond d'un workbook XLSX pour éviter les mutations React.
 * Passe par une sérialisation/désérialisation binaire.
 */
function _clonerWorkbook(wb: XLSX.WorkBook): XLSX.WorkBook {
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return XLSX.read(buf, { type: "array" });
}

/**
 * Enregistre une évaluation dans le workbook :
 *  1. Clone le workbook pour éviter les mutations d'état React
 *  2. Met à jour l'onglet classe : col A=Nom, col B=Prénom, col C=Note/20
 *  3. Met à jour l'onglet élève : blocs Date + C1..C13 + Note globale
 *  4. Met à jour l'onglet Récap Bac
 */
export function enregistrerEvaluation(
  wb: XLSX.WorkBook,
  entree: EntreeEvaluation
): XLSX.WorkBook {
  // Cloner pour garantir que le workbook modifié est un nouvel objet
  // et ne mute pas l'état React existant
  let wbClone = _clonerWorkbook(wb);
  wbClone = _mettreAJourOngletClasse(wbClone, entree);
  wbClone = _mettreAJourOngletEleve(wbClone, entree);
  wbClone = _mettreAJourOngletEpreuves(wbClone, entree);
  return wbClone;
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
  const { classe, nom, prenom, noteGlobale, date, equipement } = entree;

  let rows: (string | number | null)[][] = [];

  // Lire l'onglet classe existant
  if (wb.Sheets[classe]) {
    rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[classe], {
      header: 1,
      defval: null,
    }) as (string | number | null)[][];
  }

  // En-tête avec date et équipement
  if (rows.length === 0) {
    rows.push(["Nom", "Prénom", "Dernière date", "Dernier équipement", "Note /20"]);
  } else {
    rows[0] = ["Nom", "Prénom", "Dernière date", "Dernier équipement", "Note /20"];
  }

  // Chercher si l'élève existe déjà
  let ligneEleve = -1;
  for (let i = 1; i < rows.length; i++) {
    const a = String(rows[i][0] || "").toUpperCase().trim();
    const b = String(rows[i][1] || "").toUpperCase().trim();
    if (a === nom.toUpperCase() && b === prenom.toUpperCase()) {
      ligneEleve = i;
      break;
    }
  }

  const noteVal = noteGlobale !== null ? noteGlobale : "";
  const ligne: (string | number | null)[] = [
    nom,
    prenom,
    date,
    equipement || "",
    noteVal,
  ];

  if (ligneEleve >= 0) {
    rows[ligneEleve] = ligne;
  } else {
    rows.push(ligne);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 24 }, { wch: 10 }];

  wb.Sheets[classe] = ws;
  if (!wb.SheetNames.includes(classe)) {
    wb.SheetNames.unshift(classe);
  }

  return wb;
}

/**
 * Onglet élève (ex: "DUPONT Jean") — Format TABLEAU :
 *
 *  Ligne 1 : "Compétence" | "Éval 1" | "Éval 2" | ...
 *  Ligne 2 : "Date"       | date1    | date2    | ...
 *  Ligne 3 : "Équipement" | equip1   | equip2   | ...
 *  Ligne 4 : "Commentaire"| com1     | com2     | ...
 *  Ligne 5 : "C1"         | note1    | note2    | ...
 *  ...
 *  Ligne 17: "C13"        | note1    | note2    | ...
 *  Ligne 18: "Note /20"   | glob1    | glob2    | ...
 *  Ligne 19: "E2 /20"     | e2_1     | e2_2     | ...
 *  Ligne 20: "E31 /20"    | e31_1    | e31_2    | ...
 *  Ligne 21: "E32 /20"    | e32_1    | e32_2    | ...
 *  Ligne 22: "Moy. Bac"   | bac1     | bac2     | ...
 *
 * Chaque nouvelle évaluation ajoute une colonne à droite.
 */
function _mettreAJourOngletEleve(
  wb: XLSX.WorkBook,
  entree: EntreeEvaluation
): XLSX.WorkBook {
  const { nom, prenom, date, equipement, notesParCompetence, noteGlobale } = entree;
  const nomOnglet = nomOngletEleve(nom, prenom);

  // Calculer les notes E2/E31/E32 pour cette évaluation
  const epreuves = calculerNotesEpreuves(notesParCompetence);
  const moyBac = calculerMoyenneBac(epreuves);
  const noteE2  = epreuves.find((r) => r.id === "E2")?.note ?? null;
  const noteE31 = epreuves.find((r) => r.id === "E31")?.note ?? null;
  const noteE32 = epreuves.find((r) => r.id === "E32")?.note ?? null;

  // Identifiants savoir-être
  const CODES_SE = ["autonomie", "efforts", "rythme", "rigueur", "attentif"];
  const LABELS_SE = ["🧭 Autonomie", "💪 Efforts", "⏱ Rythme", "🎯 Rigueur", "👁 Attentif"];

  // Définition des lignes fixes (index 0-based)
  const LIGNES_LABELS = [
    "Compétence",   // 0 : en-tête
    "Date",          // 1
    "Équipement",   // 2
    "Commentaire",   // 3
    ...CODES_COMPETENCES, // 4..16 (C1..C13)
    "Note /20",      // 17
    "E2 /20",        // 18
    "E31 /20",       // 19
    "E32 /20",       // 20
    "Moy. Bac",      // 21
    "--- Savoir-être ---", // 22 : séparateur
    ...LABELS_SE,    // 23..27 : autonomie, efforts, rythme, rigueur, attentif
    "Moy. Savoir-être", // 28
  ];

  // Lire le tableau existant ou initialiser
  let rows: (string | number | null)[][] = [];

  if (wb.Sheets[nomOnglet]) {
    rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nomOnglet], {
      header: 1,
      defval: null,
    }) as (string | number | null)[][];
  }

  // Initialiser le tableau si vide
  if (rows.length === 0 || String(rows[0]?.[0] || "").trim() !== "Compétence") {
    rows = LIGNES_LABELS.map((label) => [label]);
  }

  // S'assurer que toutes les lignes existent
  while (rows.length < LIGNES_LABELS.length) {
    rows.push([LIGNES_LABELS[rows.length]]);
  }

  // Numéro de la nouvelle évaluation = nb de colonnes existantes (col 0 = labels)
  const numEval = (rows[0]?.length ?? 1); // col 0 = labels, col 1 = éval 1, etc.
  const evalLabel = `Éval ${numEval}`;

  // Construire les valeurs de la nouvelle colonne
  const valeurs: (string | number | null)[] = [
    evalLabel,                                    // 0 : en-tête
    date,                                          // 1 : date
    equipement || "",                              // 2 : équipement
    entree.commentaire?.trim() || "",              // 3 : commentaire
    ...CODES_COMPETENCES.map((code) => {           // 4..16 : C1..C13
      const note = notesParCompetence[code];
      return note !== null && note !== undefined ? note : "";
    }),
    noteGlobale !== null ? noteGlobale : "",        // 17 : Note /20
    noteE2  !== null ? noteE2  : "",               // 18 : E2
    noteE31 !== null ? noteE31 : "",               // 19 : E31
    noteE32 !== null ? noteE32 : "",               // 20 : E32
    moyBac  !== null ? moyBac  : "",               // 21 : Moy. Bac
    "",                                             // 22 : séparateur
    ...CODES_SE.map((id) => {                       // 23..27 : savoir-être
      const v = entree.savoirEtre?.[id];
      return v !== null && v !== undefined ? v : "";
    }),
    (() => {                                         // 28 : moyenne savoir-être
      const vals = CODES_SE.map((id) => entree.savoirEtre?.[id]).filter((v): v is number => v !== null && v !== undefined);
      return vals.length > 0 ? Math.round((vals.reduce((s,v)=>s+v,0)/vals.length)*100)/100 : "";
    })(),
  ];

  // Ajouter la colonne à chaque ligne
  for (let i = 0; i < LIGNES_LABELS.length; i++) {
    if (!rows[i]) rows[i] = [LIGNES_LABELS[i]];
    rows[i].push(valeurs[i] ?? "");
  }

  // Largeurs de colonnes
  const cols: XLSX.ColInfo[] = [{ wch: 14 }]; // col labels
  for (let c = 1; c <= numEval; c++) cols.push({ wch: 12 });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = cols;

  wb.Sheets[nomOnglet] = ws;
  if (!wb.SheetNames.includes(nomOnglet)) {
    wb.SheetNames.push(nomOnglet);
  }

  return wb;
}

// ─────────────────────────────────────────────────────────────
//  ONGLET RÉCAPITULATIF DES ÉPREUVES DU BAC
// ─────────────────────────────────────────────────────────────

/**
 * Onglet "Récap Bac" (créé ou mis à jour) :
 *  Colonnes : Classe | Nom | Prénom | Date | Équipement | E2 /20 | E31 /20 | E32 /20 | Moy. Bac /20
 *  1 ligne par élève, mise à jour à chaque enregistrement
 */
function _mettreAJourOngletEpreuves(
  wb: XLSX.WorkBook,
  entree: EntreeEvaluation
): XLSX.WorkBook {
  const NOM_ONGLET = "Récap Bac";
  const { classe, nom, prenom, notesParCompetence, noteGlobale, date, equipement } = entree;

  // Calculer les notes E2, E31, E32
  const resultats = calculerNotesEpreuves(notesParCompetence);
  const moyBac = calculerMoyenneBac(resultats);
  const noteE2  = resultats.find((r) => r.id === "E2")?.note ?? null;
  const noteE31 = resultats.find((r) => r.id === "E31")?.note ?? null;
  const noteE32 = resultats.find((r) => r.id === "E32")?.note ?? null;

  let rows: (string | number | null)[][] = [];

  if (wb.Sheets[NOM_ONGLET]) {
    rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[NOM_ONGLET], {
      header: 1,
      defval: null,
    }) as (string | number | null)[][];
  }

  // En-tête
  const header = ["Classe", "Nom", "Prénom", "Date", "Équipement",
    "E2 /20", "E31 /20", "E32 /20", "Moy. Bac /20", "Note globale /20"];
  if (rows.length === 0) {
    rows.push(header);
  } else {
    rows[0] = header;
  }

  // Chercher si l'élève existe déjà
  let ligneEleve = -1;
  for (let i = 1; i < rows.length; i++) {
    const a = String(rows[i][1] || "").toUpperCase().trim();
    const b = String(rows[i][2] || "").toUpperCase().trim();
    const c = String(rows[i][0] || "").trim();
    if (a === nom.toUpperCase() && b === prenom.toUpperCase() && c === classe) {
      ligneEleve = i;
      break;
    }
  }

  const ligne: (string | number | null)[] = [
    classe,
    nom,
    prenom,
    date,
    equipement || "",
    noteE2  !== null ? noteE2  : "",
    noteE31 !== null ? noteE31 : "",
    noteE32 !== null ? noteE32 : "",
    moyBac  !== null ? moyBac  : "",
    noteGlobale !== null ? noteGlobale : "",
  ];

  if (ligneEleve >= 0) {
    rows[ligneEleve] = ligne;
  } else {
    rows.push(ligne);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 8  }, // Classe
    { wch: 18 }, // Nom
    { wch: 16 }, // Prénom
    { wch: 12 }, // Date
    { wch: 24 }, // Équipement
    { wch: 10 }, // E2
    { wch: 10 }, // E31
    { wch: 10 }, // E32
    { wch: 12 }, // Moy. Bac
    { wch: 14 }, // Note globale
  ];

  wb.Sheets[NOM_ONGLET] = ws;
  if (!wb.SheetNames.includes(NOM_ONGLET)) {
    // Insérer après les onglets classes, avant les onglets élèves
    const premierOngletEleve = wb.SheetNames.findIndex((n) => n.includes(" ") && !n.startsWith("Récap"));
    if (premierOngletEleve >= 0) {
      wb.SheetNames.splice(premierOngletEleve, 0, NOM_ONGLET);
    } else {
      wb.SheetNames.push(NOM_ONGLET);
    }
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

  if (rows.length === 0) return [];

  // Détecter le format :
  // Nouveau format tableau : row[0][0] === "Compétence"
  // Ancien format blocs : row[0][0] === "Évaluation" ou row[0][0] === "Date"
  const premierLabel = String(rows[0]?.[0] || "").trim();

  if (premierLabel === "Compétence") {
    // ===== NOUVEAU FORMAT TABLEAU =====
    // Ligne 0 : "Compétence" | "Éval 1" | "Éval 2" | ...
    // Ligne 1 : "Date"       | date1    | date2    | ...
    // Ligne 2 : "Équipement" | equip1   | equip2   | ...
    // Ligne 3 : "Commentaire"| com1     | com2     | ...
    // Ligne 4+ : C1..C13, Note /20, E2 /20, E31 /20, E32 /20, Moy. Bac

    const nbCols = rows[0]?.length ?? 1;
    const nbEvals = nbCols - 1; // col 0 = labels

    // Construire un index label -> index de ligne
    const rowIndex: Record<string, number> = {};
    rows.forEach((row, i) => {
      const lbl = String(row[0] || "").trim();
      if (lbl) rowIndex[lbl] = i;
    });

    const blocs: BlocEvaluation[] = [];

    for (let col = 1; col <= nbEvals; col++) {
      const getVal = (label: string): string | number | null => {
        const ri = rowIndex[label];
        if (ri === undefined) return null;
        const v = rows[ri]?.[col];
        return v !== undefined ? v : null;
      };

      const dateVal = String(getVal("Date") || "");
      if (!dateVal) continue;

      const equipement = String(getVal("Équipement") || "");
      const commentaire = String(getVal("Commentaire") || "");
      const noteGlobaleRaw = getVal("Note /20");
      const noteGlobale = noteGlobaleRaw !== null && noteGlobaleRaw !== "" ? Number(noteGlobaleRaw) : null;

      const notes: Record<string, number | null> = {};
      for (const code of CODES_COMPETENCES) {
        const v = getVal(code);
        notes[code] = v !== null && v !== "" ? Number(v) : null;
      }

      blocs.push({
        date: dateVal,
        equipement,
        notes,
        noteGlobale,
        commentaire: commentaire || undefined,
      });
    }

    return blocs;
  }

  // ===== ANCIEN FORMAT BLOCS (compatibilité ascendante) =====
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
  wb = _clonerWorkbook(wb);

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
  wb = _clonerWorkbook(wb);

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
  wb = _clonerWorkbook(wb);
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
  wb = _clonerWorkbook(wb);
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

// ─────────────────────────────────────────────────────────────
//  ARCHIVAGE DE CLASSE
// ─────────────────────────────────────────────────────────────

/**
 * Archive une classe : crée un fichier de sauvegarde et réinitialise les notes de la classe.
 * - Génère un fichier "Archive_[Classe]_[Date].xlsx" avec toutes les données actuelles
 * - Réinitialise les notes de la classe dans le workbook principal
 * - Retourne la grille mise à jour
 */
export async function archiverClasse(
  grille: FichierGrille,
  nomClasse: string
): Promise<FichierGrille> {
  // Cloner le workbook pour éviter les mutations
  let wb = _clonerWorkbook(grille.rawWorkbook);

  if (!wb.SheetNames.includes(nomClasse)) {
    throw new Error(`La classe "${nomClasse}" n'existe pas.`);
  }

  // 1. Créer une copie du workbook pour la sauvegarde
  const wbArchive = _clonerWorkbook(wb);

  // 2. Générer le nom du fichier d'archive avec timestamp
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // HH-MM-SS
  const archiveName = `Archive_${nomClasse}_${dateStr}_${timeStr}.xlsx`;

  // 3. Télécharger le fichier d'archive
  const wbout = XLSX.write(wbArchive, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, archiveName);

  // 4. Réinitialiser les notes dans le workbook principal
  // Pour chaque élève de la classe, supprimer son onglet (sauf l'en-tête de classe)
  const wsClasse = wb.Sheets[nomClasse];
  if (wsClasse) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wsClasse, { header: 1, defval: null }) as (string | null)[][];
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

  // 5. Réinitialiser l'onglet classe (garder l'en-tête, vider les notes)
  if (wsClasse) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wsClasse, { header: 1, defval: null }) as (string | null)[][];
    // Garder l'en-tête (ligne 0)
    const newRows = [rows[0]]; // En-tête
    // Ajouter les élèves sans notes
    for (let i = 1; i < rows.length; i++) {
      newRows.push([rows[i][0], rows[i][1], null]); // Nom, Prénom, Note vide
    }
    const newWs = XLSX.utils.aoa_to_sheet(newRows);
    wb.Sheets[nomClasse] = newWs;
  }

  // 6. Retourner la grille mise à jour
  return {
    classes: grille.classes,
    rawWorkbook: wb,
  };
}
