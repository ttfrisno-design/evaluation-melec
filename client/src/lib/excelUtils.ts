// Utilitaires pour import/export Excel — Application MELEC
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type { Eleve } from "@/hooks/useEvaluation";
import { COMPETENCES } from "./competences";

// Lire la liste des élèves depuis un fichier Excel
export async function lireElevesDepuisExcel(file: File): Promise<Eleve[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: "",
        }) as string[][];

        if (rows.length === 0) {
          resolve([]);
          return;
        }

        // Détection automatique des colonnes
        const header = rows[0].map((h) => String(h).toLowerCase().trim());
        
        // Chercher les colonnes nom et prénom
        let nomIdx = header.findIndex((h) =>
          h.includes("nom") && !h.includes("prenom") && !h.includes("prénom")
        );
        let prenomIdx = header.findIndex((h) =>
          h.includes("prenom") || h.includes("prénom")
        );
        let classeIdx = header.findIndex((h) =>
          h.includes("classe") || h.includes("group")
        );

        // Si pas de header détecté, essayer col 0 = nom, col 1 = prénom
        if (nomIdx === -1) nomIdx = 0;
        if (prenomIdx === -1) prenomIdx = 1;

        const eleves: Eleve[] = [];
        const startRow = header.some((h) => h.includes("nom") || h.includes("prenom")) ? 1 : 0;

        for (let i = startRow; i < rows.length; i++) {
          const row = rows[i];
          const nom = String(row[nomIdx] || "").trim();
          const prenom = String(row[prenomIdx] || "").trim();
          if (nom || prenom) {
            eleves.push({
              nom: nom.toUpperCase(),
              prenom: prenom.charAt(0).toUpperCase() + prenom.slice(1).toLowerCase(),
              classe: classeIdx >= 0 ? String(row[classeIdx] || "").trim() : undefined,
            });
          }
        }

        resolve(eleves);
      } catch (err) {
        reject(new Error("Impossible de lire le fichier Excel. Vérifiez le format."));
      }
    };
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier."));
    reader.readAsArrayBuffer(file);
  });
}

export interface LigneResultat {
  date: string;
  nom: string;
  prenom: string;
  classe?: string;
  equipement: string;
  notesParCompetence: Record<string, number | null>; // C1 -> note obtenue / note max
  noteSur20: number | null;
  notes: Record<string, number | null>; // critereId -> note
}

// Exporter ou mettre à jour le fichier Excel des résultats
export function exporterResultatsExcel(
  resultats: LigneResultat[],
  nomFichier = "resultats_evaluation_melec.xlsx"
) {
  const wb = XLSX.utils.book_new();

  // Construire les en-têtes dynamiquement
  const codesCompetences = COMPETENCES.map((c) => c.code);

  const headers = [
    "Date",
    "Nom",
    "Prénom",
    "Classe",
    "Équipement",
    ...codesCompetences.map((c) => `${c} (obtenu/max)`),
    "Note /20",
  ];

  const rows = resultats.map((r) => {
    const row: (string | number | null)[] = [
      r.date,
      r.nom,
      r.prenom,
      r.classe || "",
      r.equipement,
    ];

    for (const code of codesCompetences) {
      const val = r.notesParCompetence[code];
      row.push(val !== null && val !== undefined ? val : "");
    }

    row.push(r.noteSur20 !== null ? r.noteSur20 : "");
    return row;
  });

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Largeurs de colonnes
  ws["!cols"] = [
    { wch: 12 }, // Date
    { wch: 18 }, // Nom
    { wch: 18 }, // Prénom
    { wch: 12 }, // Classe
    { wch: 25 }, // Équipement
    ...codesCompetences.map(() => ({ wch: 16 })),
    { wch: 10 }, // Note /20
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Résultats");

  // Onglet détail par compétence
  const wsDetailHeaders = [
    "Date",
    "Nom",
    "Prénom",
    "Classe",
    "Équipement",
    "Compétence",
    "Critère",
    "Note obtenue",
    "Note max",
  ];

  const wsDetailRows: (string | number | null)[][] = [];
  for (const r of resultats) {
    for (const comp of COMPETENCES) {
      const noteComp = r.notesParCompetence[comp.code];
      if (noteComp !== null && noteComp !== undefined) {
        for (const critere of comp.criteres) {
          const noteCritere = r.notes[critere.id];
          if (noteCritere !== null && noteCritere !== undefined) {
            wsDetailRows.push([
              r.date,
              r.nom,
              r.prenom,
              r.classe || "",
              r.equipement,
              `${comp.code} - ${comp.libelle}`,
              critere.libelle,
              noteCritere,
              critere.noteMax,
            ]);
          }
        }
      }
    }
  }

  if (wsDetailRows.length > 0) {
    const wsDetail = XLSX.utils.aoa_to_sheet([wsDetailHeaders, ...wsDetailRows]);
    wsDetail["!cols"] = [
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 25 },
      { wch: 50 },
      { wch: 50 },
      { wch: 14 },
      { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDetail, "Détail par critère");
  }

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, nomFichier);
}

// Charger un fichier Excel existant de résultats et ajouter une nouvelle ligne
export async function chargerEtMettreAJourExcel(
  file: File,
  nouvelleEntree: LigneResultat
): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        // Convertir en tableau de LigneResultat existants
        const existants = rows.map((r) => {
          const notesParComp: Record<string, number | null> = {};
          for (const comp of COMPETENCES) {
            const val = r[`${comp.code} (obtenu/max)`];
            notesParComp[comp.code] = val !== undefined && val !== "" ? Number(val) : null;
          }
          return {
            date: String(r["Date"] || ""),
            nom: String(r["Nom"] || ""),
            prenom: String(r["Prénom"] || ""),
            classe: String(r["Classe"] || ""),
            equipement: String(r["Équipement"] || ""),
            notesParCompetence: notesParComp,
            noteSur20: r["Note /20"] !== undefined && r["Note /20"] !== "" ? Number(r["Note /20"]) : null,
            notes: {},
          } as LigneResultat;
        });

        exporterResultatsExcel([...existants, nouvelleEntree]);
        resolve();
      } catch {
        reject(new Error("Impossible de lire le fichier Excel existant."));
      }
    };
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier."));
    reader.readAsArrayBuffer(file);
  });
}
