/**
 * Utilitaires pour l'export vers le document Bac Pro MELEC
 * Complète le fichier template avec les données des élèves de la classe
 */
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { FichierGrille, BlocEvaluation } from "./excelUtils";
import { calculerNotesEpreuves } from "./epreuvesBac";

export interface DonneesBacEleve {
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
export function extraireDonneesBacEleve(
  grille: FichierGrille,
  classe: string,
  nom: string,
  prenom: string,
  numeroCandidat: string,
  etablissement: string = "Lycée Raymond QUENEAU",
  session: string = "juin 2026",
  anneeScolaire: string = "2025-26"
): DonneesBacEleve {
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
 * Remplit les paramètres du template Bac Pro MELEC
 */
export function remplirParametres(
  wb: XLSX.WorkBook,
  donnees: DonneesBacEleve
): void {
  const wsParams = wb.Sheets["Paramètres"];
  if (!wsParams) return;
  
  // Remplir les champs bleus du template (ligne 9, 11, 13, 15, 17, 19 colonne E)
  const cellsToFill: Array<[string, string]> = [
    ["E9", donnees.anneeScolaire],   // Année scolaire
    ["E11", donnees.session],         // Session
    ["E13", donnees.prenom],          // Prénom
    ["E15", donnees.nom],             // Nom
    ["E17", donnees.numeroCandidat],  // N° candidat
    ["E19", donnees.etablissement],   // Établissement
  ];
  
  for (const [cellAddr, value] of cellsToFill) {
    if (!wsParams[cellAddr]) {
      wsParams[cellAddr] = {};
    }
    wsParams[cellAddr].v = value;
    wsParams[cellAddr].t = "s"; // type string
  }
}

/**
 * Remplit les notes E2, E31, E32 pour un élève
 */
export function remplirNotesEpreuves(
  wb: XLSX.WorkBook,
  donnees: DonneesBacEleve
): void {
  // Pour chaque évaluation, calculer les notes E2, E31, E32
  if (donnees.evaluations.length === 0) {
    return;
  }
  
  // Prendre la dernière évaluation comme référence
  const dernierEval = donnees.evaluations[donnees.evaluations.length - 1];
  const resultatsEpreuves = calculerNotesEpreuves(dernierEval.notes);
  
  // Remplir les notes dans les onglets E2, E31, E32
  // resultatsEpreuves est un tableau de ResultatEpreuve
  for (const resultat of resultatsEpreuves) {
    if (resultat.note === null) continue;
    
    const ws = wb.Sheets[resultat.id];
    if (ws) {
      // Placer la note dans la cellule J18 (à adapter selon la structure réelle)
      if (!ws["J18"]) ws["J18"] = {};
      ws["J18"].v = resultat.note;
      ws["J18"].t = "n"; // type number
    }
  }
}

/**
 * Clône un workbook en profondeur pour éviter les mutations
 */
function clonerWorkbookBac(wb: XLSX.WorkBook): XLSX.WorkBook {
  const wbNew = XLSX.utils.book_new();
  wbNew.SheetNames = [...wb.SheetNames];
  
  for (const sheetName of wb.SheetNames) {
    const wsSource = wb.Sheets[sheetName];
    if (!wsSource) continue;
    
    // Convertir en AOA, puis reconvertir pour créer une copie indépendante
    const aoa = XLSX.utils.sheet_to_json(wsSource, { header: 1, defval: null }) as any[][];
    const wsNew = XLSX.utils.aoa_to_sheet(aoa);
    
    // Copier les propriétés de mise en forme si disponibles
    if (wsSource["!cols"]) wsNew["!cols"] = [...wsSource["!cols"]];
    if (wsSource["!rows"]) wsNew["!rows"] = [...wsSource["!rows"]];
    if (wsSource["!merges"]) wsNew["!merges"] = [...wsSource["!merges"]];
    
    wbNew.Sheets[sheetName] = wsNew;
  }
  
  return wbNew;
}

/**
 * Génère un document Bac Pro MELEC complété pour un élève
 */
export async function genererDocumentBacEleve(
  templatePath: string,
  donnees: DonneesBacEleve
): Promise<XLSX.WorkBook> {
  // Charger le template
  const response = await fetch(templatePath);
  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const wbTemplate = XLSX.read(data, { type: "array" });
  
  // Cloner le workbook pour éviter les mutations
  const wb = clonerWorkbookBac(wbTemplate);
  
  // Remplir les paramètres
  remplirParametres(wb, donnees);
  
  // Remplir les notes des épreuves
  remplirNotesEpreuves(wb, donnees);
  
  return wb;
}

/**
 * Génère et télécharge les documents Bac Pro MELEC pour toute une classe
 */
export async function genererDocumentsBacClasse(
  grille: FichierGrille,
  classe: string,
  templatePath: string
): Promise<void> {
  // Récupérer les élèves de la classe
  const classeData = grille.classes.find((c) => c.nom === classe);
  if (!classeData) {
    throw new Error(`Classe "${classe}" non trouvée`);
  }
  
  // Pour chaque élève, générer un document
  for (let i = 0; i < classeData.eleves.length; i++) {
    const eleve = classeData.eleves[i];
    const donnees = extraireDonneesBacEleve(
      grille,
      classe,
      eleve.nom,
      eleve.prenom,
      `A2026 0000 ${String(i + 1).padStart(4, "0")}` // Numéro candidat fictif
    );
    
    const wb = await genererDocumentBacEleve(templatePath, donnees);
    
    // Télécharger le fichier
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const filename = `Bac_${classe}_${eleve.nom}_${eleve.prenom}.xlsx`;
    saveAs(blob, filename);
    
    // Petit délai pour éviter les problèmes de téléchargement simultané
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
