/**
 * Utilitaires pour générer un PDF du document Bac Pro MELEC
 * Convertit le fichier Excel en PDF avec les données remplies
 */
import * as XLSX from "xlsx";
import { FichierGrille, BlocEvaluation } from "./excelUtils";
import { calculerNotesEpreuves } from "./epreuvesBac";

export interface DonneesBacElevePdf {
  nom: string;
  prenom: string;
  numeroCandidat: string;
  etablissement: string;
  session: string;
  anneeScolaire: string;
  evaluations: BlocEvaluation[];
}

/**
 * Récupère les données d'un élève depuis la grille
 */
export function extraireDonneesBacElevePdf(
  grille: FichierGrille,
  classe: string,
  nom: string,
  prenom: string,
  numeroCandidat: string,
  etablissement: string = "Lycée Raymond QUENEAU",
  session: string = "juin 2026",
  anneeScolaire: string = "2025-26"
): DonneesBacElevePdf {
  // Lire les évaluations de l'élève depuis son onglet
  const nomOnglet = `${nom.toUpperCase()} ${prenom}`.slice(0, 31);
  const ws = grille.rawWorkbook.Sheets[nomOnglet];
  
  const evaluations: BlocEvaluation[] = [];
  if (ws) {
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null }) as any[][];
    
    // Parser les blocs d'évaluation (chaque bloc = 16 lignes)
    for (let i = 0; i < rows.length; i += 16) {
      const bloc = rows.slice(i, i + 16);
      if (bloc.length > 0 && bloc[0] && bloc[0][1]) {
        const date = String(bloc[0][1] || "");
        const equipement = String(bloc[1]?.[1] || "");
        
        const notes: Record<string, number | null> = {};
        let noteGlobale: number | null = null;
        
        for (let j = 2; j < Math.min(15, bloc.length); j++) {
          const label = String(bloc[j][0] || "").trim();
          const valeur = bloc[j][1];
          
          if (label.match(/^C\d+$/)) {
            notes[label] = typeof valeur === "number" ? valeur : null;
          } else if (label === "Note globale") {
            noteGlobale = typeof valeur === "number" ? valeur : null;
          }
        }
        
        if (date) {
          evaluations.push({
            date,
            equipement,
            notes,
            noteGlobale,
          });
        }
      }
    }
  }
  
  return {
    nom,
    prenom,
    numeroCandidat,
    etablissement,
    session,
    anneeScolaire,
    evaluations,
  };
}

/**
 * Remplit le template Excel avec les données et retourne le workbook
 */
export async function remplirTemplateExcelBac(
  templatePath: string,
  donnees: DonneesBacElevePdf
): Promise<XLSX.WorkBook> {
  // Charger le template
  const response = await fetch(templatePath);
  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const wbTemplate = XLSX.read(data, { type: "array" });
  
  // Cloner le workbook
  const wb = XLSX.utils.book_new();
  wb.SheetNames = [...wbTemplate.SheetNames];
  
  for (const sheetName of wbTemplate.SheetNames) {
    const wsSource = wbTemplate.Sheets[sheetName];
    if (!wsSource) continue;
    
    const aoa = XLSX.utils.sheet_to_json(wsSource, { header: 1, defval: null }) as any[][];
    const wsNew = XLSX.utils.aoa_to_sheet(aoa);
    
    // Copier les propriétés de mise en forme
    if (wsSource["!cols"]) wsNew["!cols"] = [...wsSource["!cols"]];
    if (wsSource["!rows"]) wsNew["!rows"] = [...wsSource["!rows"]];
    if (wsSource["!merges"]) wsNew["!merges"] = [...wsSource["!merges"]];
    
    wb.Sheets[sheetName] = wsNew;
  }
  
  // Remplir les paramètres dans l'onglet Paramètres
  const wsParams = wb.Sheets["Paramètres"];
  if (wsParams) {
    // Les cellules gris clair à remplir
    if (!wsParams["E9"]) wsParams["E9"] = {};
    wsParams["E9"].v = donnees.anneeScolaire;
    wsParams["E9"].t = "s";
    
    if (!wsParams["E11"]) wsParams["E11"] = {};
    wsParams["E11"].v = donnees.session;
    wsParams["E11"].t = "s";
    
    if (!wsParams["E13"]) wsParams["E13"] = {};
    wsParams["E13"].v = donnees.prenom;
    wsParams["E13"].t = "s";
    
    if (!wsParams["E15"]) wsParams["E15"] = {};
    wsParams["E15"].v = donnees.nom;
    wsParams["E15"].t = "s";
    
    if (!wsParams["E17"]) wsParams["E17"] = {};
    wsParams["E17"].v = donnees.numeroCandidat;
    wsParams["E17"].t = "s";
    
    if (!wsParams["E19"]) wsParams["E19"] = {};
    wsParams["E19"].v = donnees.etablissement;
    wsParams["E19"].t = "s";
  }
  
  // Remplir les notes E2, E31, E32 si des évaluations existent
  if (donnees.evaluations.length > 0) {
    const dernierEval = donnees.evaluations[donnees.evaluations.length - 1];
    const resultatsEpreuves = calculerNotesEpreuves(dernierEval.notes);
    
    // Remplir les notes dans les onglets E2, E31, E32
    for (const resultat of resultatsEpreuves) {
      if (resultat.note === null) continue;
      
      const ws = wb.Sheets[resultat.id];
      if (ws) {
        // Placer la note dans la cellule J18
        if (!ws["J18"]) ws["J18"] = {};
        ws["J18"].v = resultat.note;
        ws["J18"].t = "n";
      }
    }
  }
  
  return wb;
}

/**
 * Convertit un workbook Excel en HTML pour générer un PDF
 */
export function workbookToHtml(wb: XLSX.WorkBook, sheetName: string = "Paramètres"): string {
  const ws = wb.Sheets[sheetName];
  if (!ws) return "";
  
  // Convertir la feuille en HTML
  const html = XLSX.utils.sheet_to_html(ws);
  
  // Ajouter du CSS pour améliorer la mise en forme
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 10px;
          font-size: 12px;
        }
        table {
          border-collapse: collapse;
          width: 100%;
        }
        td, th {
          border: 1px solid #999;
          padding: 4px;
          text-align: left;
        }
        .gray-bg {
          background-color: #D3D3D3;
        }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `;
}

/**
 * Génère un PDF pour un élève en remplissant le template Excel
 */
export async function genererPdfBacEleve(
  templatePath: string,
  donnees: DonneesBacElevePdf,
  sheetName: string = "Paramètres"
): Promise<Blob> {
  // Remplir le template
  const wb = await remplirTemplateExcelBac(templatePath, donnees);
  
  // Convertir en HTML
  const html = workbookToHtml(wb, sheetName);
  
  // Générer le PDF avec html2pdf
  const html2pdf = (await import("html2pdf.js")).default;
  
  const element = document.createElement("div");
  element.innerHTML = html;
  
  return new Promise((resolve, reject) => {
    html2pdf()
      .set({
        margin: 10,
        filename: `Bac_${donnees.nom}_${donnees.prenom}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
      })
      .from(element)
      .toPdf()
      .output("blob")
      .then((blob: Blob) => resolve(blob))
      .catch((err: any) => reject(err));
  });
}

/**
 * Génère et télécharge les PDF pour toute une classe
 */
export async function genererPdfsBacClasse(
  grille: FichierGrille,
  classe: string,
  templatePath: string,
  numeroCandidats: Record<string, string>
): Promise<void> {
  const { saveAs } = await import("file-saver");
  
  // Récupérer les élèves de la classe
  const classeData = grille.classes.find((c) => c.nom === classe);
  if (!classeData) {
    throw new Error(`Classe "${classe}" non trouvée`);
  }
  
  // Pour chaque élève, générer un PDF
  for (let i = 0; i < classeData.eleves.length; i++) {
    const eleve = classeData.eleves[i];
    const key = `${eleve.nom.toUpperCase()} ${eleve.prenom}`;
    const numeroCandidat = numeroCandidats[key] || `A2026 0000 ${String(i + 1).padStart(4, "0")}`;
    
    const donnees = extraireDonneesBacElevePdf(
      grille,
      classe,
      eleve.nom,
      eleve.prenom,
      numeroCandidat
    );
    
    // Remplir le template
    const wb = await remplirTemplateExcelBac(templatePath, donnees);
    
    // Convertir en HTML et générer PDF pour chaque onglet (E2, E31, E32)
    for (const sheetName of ["E2", "E31", "E32"]) {
      if (!wb.Sheets[sheetName]) continue;
      
      const html = workbookToHtml(wb, sheetName);
      
      // Créer un élément DOM temporaire
      const element = document.createElement("div");
      element.innerHTML = html;
      element.style.display = "none";
      document.body.appendChild(element);
      
      try {
        // Générer le PDF avec html2pdf
        const html2pdf = (await import("html2pdf.js")).default;
        
        const pdf = await html2pdf()
          .set({
            margin: 5,
            filename: `Bac_${classe}_${eleve.nom}_${eleve.prenom}_${sheetName}.pdf`,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
          })
          .from(element)
          .toPdf()
          .output("blob");
        
        // Télécharger le PDF
        saveAs(pdf, `Bac_${classe}_${eleve.nom}_${eleve.prenom}_${sheetName}.pdf`);
      } finally {
        document.body.removeChild(element);
      }
      
      // Petit délai pour éviter les problèmes
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
