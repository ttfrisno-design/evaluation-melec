/**
 * Utilitaires pour convertir un fichier Excel en PDF avec styles préservés
 * Utilise jsPDF directement pour éviter les problèmes avec html2pdf et les styles Tailwind
 */
import * as XLSX from "xlsx";

interface CellStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderStyle?: string;
  textAlign?: string;
  verticalAlign?: string;
  fontWeight?: string;
  fontSize?: string;
  fontFamily?: string;
  color?: string;
}

/**
 * Convertit une couleur RGB hexadécimale en format CSS
 */
function hexToRgb(hex: string): string {
  // Supprimer le préfixe FF si présent
  if (hex.startsWith("FF")) {
    hex = hex.substring(2);
  }
  
  // Convertir en RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Extrait les styles d'une cellule Excel
 */
function extractCellStyle(cell: any): CellStyle {
  const style: CellStyle = {};
  
  try {
    if (!cell) return style;
    
    // Couleur de fond
    if (cell.fill && typeof cell.fill === 'object' && cell.fill.patternType === "solid" && cell.fill.start_color) {
      const color = cell.fill.start_color;
      if (typeof color.rgb === "string") {
        style.backgroundColor = hexToRgb(color.rgb);
      }
    }
    
    // Police
    if (cell.font && typeof cell.font === 'object') {
      if (cell.font.bold) {
        style.fontWeight = "bold";
      }
      if (cell.font.size && typeof cell.font.size === 'number') {
        style.fontSize = `${cell.font.size}pt`;
      }
    }
  } catch (e) {
    // Ignorer silencieusement les erreurs
  }
  
  return style;
}

/**
 * Génère un PDF stylisé à partir d'un workbook Excel en utilisant jsPDF directement
 */
export async function workbookToStyledPdf(
  wb: XLSX.WorkBook,
  sheetName: string,
  filename: string
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(`Feuille "${sheetName}" non trouvée`);
  }
  
  // Créer un document PDF
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  
  // Obtenir les dimensions de la feuille
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  
  // Couleurs prédéfinies du template Excel
  const colorMap: Record<string, [number, number, number]> = {
    "FFBDD6EE": [189, 214, 238],  // Gris clair
    "FF9CC2E5": [156, 194, 229],  // Gris moyen
    "FFDEEAF6": [222, 234, 246],  // Gris foncé
    "FFC5E0B3": [197, 224, 179],  // Vert clair
    "FFFFFF99": [255, 255, 153],  // Jaune clair
  };
  
  // Paramètres de mise en page
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - 2 * margin;
  
  // Largeur de colonne moyenne
  const cellWidth = contentWidth / (range.e.c - range.s.c + 1);
  const cellHeight = 8;
  
  let yPos = margin;
  
  // Parcourir les lignes et colonnes
  for (let row = range.s.r; row <= range.e.r; row++) {
    let xPos = margin;
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = ws[cellAddress];
      
      let cellValue = "";
      let bgColor: [number, number, number] | null = null;
      let textColor: [number, number, number] = [0, 0, 0];
      let isBold = false;
      
      if (cell) {
        // Obtenir la valeur
        if (typeof cell.v === "string") {
          cellValue = cell.v;
        } else if (typeof cell.v === "number") {
          cellValue = String(cell.v);
        }
        
        // Couleur de fond
        if (cell.fill && cell.fill.start_color) {
          const color = cell.fill.start_color;
          if (typeof color.rgb === "string") {
            const rgb = color.rgb.toUpperCase();
            const mappedColor = colorMap[rgb];
            if (mappedColor) {
              bgColor = mappedColor;
            }
          }
        }
        
        // Police
        if (cell.font && cell.font.bold) {
          isBold = true;
        }
      }
      
      // Dessiner la cellule
      // Fond
      if (bgColor) {
        pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        pdf.rect(xPos, yPos, cellWidth, cellHeight, "F");
      }
      
      // Bordure
      pdf.setDrawColor(153, 153, 153);
      pdf.rect(xPos, yPos, cellWidth, cellHeight);
      
      // Texte
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      if (isBold) {
        pdf.setFont("Helvetica", "bold");
      } else {
        pdf.setFont("Helvetica", "normal");
      }
      pdf.setFontSize(10);
      
      // Afficher le texte avec wrapping
      const textX = xPos + 1;
      const textY = yPos + cellHeight / 2 + 1;
      pdf.text(cellValue.substring(0, 20), textX, textY, { maxWidth: cellWidth - 2 });
      
      xPos += cellWidth;
    }
    
    yPos += cellHeight;
    
    // Ajouter une nouvelle page si nécessaire
    if (yPos > pageHeight - margin) {
      pdf.addPage();
      yPos = margin;
    }
  }
  
  // Convertir en Blob
  const pdfBlob = pdf.output("blob");
  return pdfBlob;
}
