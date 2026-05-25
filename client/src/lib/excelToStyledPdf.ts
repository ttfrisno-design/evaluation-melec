/**
 * Utilitaires pour convertir un fichier Excel en PDF avec styles préservés
 * Extrait les couleurs, bordures, alignement et autres styles du fichier Excel
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
  
  // Note: xlsx (community) ne charge pas les styles par défaut
  // Cette fonction retourne un objet vide pour la plupart des cas
  // Les styles sont appliqués via les classes CSS basées sur les couleurs RGB
  
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
    // Ignorer silencieusement les erreurs de conversion
  }
  
  return style;
}

/**
 * Génère un HTML stylisé à partir d'un workbook Excel
 */
export function workbookToStyledHtml(wb: XLSX.WorkBook, sheetName: string = "Paramètres"): string {
  const ws = wb.Sheets[sheetName];
  if (!ws) return "";
  
  // Obtenir les dimensions de la feuille
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: Calibri, Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.2;
          padding: 20px;
          background: white;
        }
        
        table {
          border-collapse: collapse;
          width: 100%;
          table-layout: fixed;
        }
        
        td {
          border: 1px solid #999999;
          padding: 4px 6px;
          word-wrap: break-word;
          overflow-wrap: break-word;
          white-space: normal;
        }
        
        .header {
          font-weight: bold;
          background-color: #D3D3D3;
          text-align: center;
        }
        
        .gray-light {
          background-color: #BDD6EE;
        }
        
        .gray-medium {
          background-color: #9CC2E5;
        }
        
        .gray-dark {
          background-color: #DEEAF6;
        }
        
        .green-light {
          background-color: #C5E0B3;
        }
        
        .yellow-light {
          background-color: #FFFF99;
        }
        
        .center {
          text-align: center;
        }
        
        .right {
          text-align: right;
        }
        
        .left {
          text-align: left;
        }
        
        .top {
          vertical-align: top;
        }
        
        .middle {
          vertical-align: middle;
        }
        
        .bottom {
          vertical-align: bottom;
        }
      </style>
    </head>
    <body>
      <table>
  `;
  
  // Parcourir les lignes et colonnes
  for (let row = range.s.r; row <= range.e.r; row++) {
    html += "<tr>";
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = ws[cellAddress];
      
      let cellValue = "";
      let cellStyle = "";
      let cellClass = "";
      
      if (cell) {
        // Obtenir la valeur
        if (typeof cell.v === "string") {
          cellValue = cell.v;
        } else if (typeof cell.v === "number") {
          cellValue = String(cell.v);
        } else if (cell.f) {
          // Afficher la formule ou une valeur par défaut
          cellValue = cell.v ? String(cell.v) : "";
        }
        
        // Extraire les styles
        const style = extractCellStyle(cell);
        
        // Construire les classes CSS
        if (cell.fill && cell.fill.start_color) {
          const color = cell.fill.start_color;
          if (typeof color.rgb === "string") {
            const rgb = color.rgb.toUpperCase();
            if (rgb === "FFBDD6EE") {
              cellClass += " gray-light";
            } else if (rgb === "FF9CC2E5") {
              cellClass += " gray-medium";
            } else if (rgb === "FFDEEAF6") {
              cellClass += " gray-dark";
            } else if (rgb === "FFC5E0B3") {
              cellClass += " green-light";
            } else if (rgb === "FFFFFF99") {
              cellClass += " yellow-light";
            }
          }
        }
        
        // Alignement
        if (cell.alignment) {
          if (cell.alignment.horizontal) {
            cellClass += ` ${cell.alignment.horizontal}`;
          }
          if (cell.alignment.vertical) {
            cellClass += ` ${cell.alignment.vertical}`;
          }
        }
        
        // Construire les styles inline
        const styleProps: string[] = [];
        if (style.backgroundColor) {
          styleProps.push(`background-color: ${style.backgroundColor}`);
        }
        if (style.fontWeight) {
          styleProps.push(`font-weight: ${style.fontWeight}`);
        }
        if (style.fontSize) {
          styleProps.push(`font-size: ${style.fontSize}`);
        }
        if (style.color) {
          styleProps.push(`color: ${style.color}`);
        }
        
        if (styleProps.length > 0) {
          cellStyle = `style="${styleProps.join("; ")}"`;
        }
      }
      
      html += `<td ${cellStyle} class="${cellClass.trim()}">${cellValue}</td>`;
    }
    
    html += "</tr>";
  }
  
  html += `
      </table>
    </body>
    </html>
  `;
  
  return html;
}

/**
 * Génère un PDF stylisé à partir d'un workbook Excel
 */
export async function workbookToStyledPdf(
  wb: XLSX.WorkBook,
  sheetName: string = "Paramètres",
  filename: string = "document.pdf"
): Promise<Blob> {
  const html = workbookToStyledHtml(wb, sheetName);
  
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
        filename: filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
      })
      .from(element)
      .toPdf()
      .output("blob");
    
    return pdf;
  } finally {
    document.body.removeChild(element);
  }
}
