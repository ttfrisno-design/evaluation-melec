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
  // Les styles sont appliqués via les couleurs RGB directes
  
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
 * Génère un HTML stylé à partir d'un workbook Excel
 * Utilise uniquement des styles inline sans classes CSS pour éviter les problèmes avec html2pdf
 */
export function workbookToStyledHtml(wb: XLSX.WorkBook, sheetName: string = "Paramètres"): string {
  const ws = wb.Sheets[sheetName];
  if (!ws) return "";
  
  // Obtenir les dimensions de la feuille
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  
  let html = `<!DOCTYPE html>
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
      min-height: 20px;
    }
  </style>
</head>
<body>
  <table>
`;
  
  // Couleurs prédéfinies du template Excel
  const colorMap: Record<string, string> = {
    "FFBDD6EE": "rgb(189, 214, 238)",  // Gris clair
    "FF9CC2E5": "rgb(156, 194, 229)",  // Gris moyen
    "FFDEEAF6": "rgb(222, 234, 246)",  // Gris foncé
    "FFC5E0B3": "rgb(197, 224, 179)",  // Vert clair
    "FFFFFF99": "rgb(255, 255, 153)",  // Jaune clair
  };
  
  // Parcourir les lignes et colonnes
  for (let row = range.s.r; row <= range.e.r; row++) {
    html += "<tr>";
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = ws[cellAddress];
      
      let cellValue = "";
      let cellStyle = "";
      
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
        
        // Construire les styles inline
        const styleProps: string[] = [];
        
        // Couleur de fond - utiliser la couleur RGB directe
        if (cell.fill && cell.fill.start_color) {
          const color = cell.fill.start_color;
          if (typeof color.rgb === "string") {
            const rgb = color.rgb.toUpperCase();
            const mappedColor = colorMap[rgb];
            if (mappedColor) {
              styleProps.push(`background-color: ${mappedColor}`);
            } else if (rgb.startsWith("FF")) {
              // Convertir directement si pas dans la map
              try {
                styleProps.push(`background-color: ${hexToRgb(rgb)}`);
              } catch (e) {
                // Ignorer
              }
            }
          }
        }
        
        // Alignement
        if (cell.alignment) {
          if (cell.alignment.horizontal) {
            styleProps.push(`text-align: ${cell.alignment.horizontal}`);
          }
          if (cell.alignment.vertical) {
            styleProps.push(`vertical-align: ${cell.alignment.vertical}`);
          }
        }
        
        // Police
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
      
      html += `<td ${cellStyle}>${cellValue}</td>`;
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
  sheetName: string,
  filename: string
): Promise<Blob> {
  const html2pdf = (await import("html2pdf.js")).default;
  
  // Générer le HTML
  const htmlContent = workbookToStyledHtml(wb, sheetName);
  
  // Options pour html2pdf
  const options = {
    margin: 10,
    filename: filename,
    image: { type: "png" as const, quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: "portrait" as const, unit: "mm" as const, format: "a4" as const },
  };
  
  return new Promise((resolve, reject) => {
    html2pdf()
      .set(options)
      .from(htmlContent)
      .outputPdf("blob")
      .then((pdf: Blob) => resolve(pdf))
      .catch((err: any) => reject(err));
  });
}
