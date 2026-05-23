/**
 * Génération du bulletin PDF élève — Application MELEC Éval
 * Utilise l'API window.print() avec une page HTML stylée injectée dans un iframe
 * (pas de dépendance externe, fonctionne dans tous les navigateurs modernes)
 */

import { COMPETENCES } from "./competences";
import type { BlocEvaluation } from "./excelUtils";
import { calculerNotesEpreuves, calculerMoyenneBac, EPREUVES_BAC } from "./epreuvesBac";

export interface DonneesBulletin {
  nom: string;
  prenom: string;
  classe: string;
  evaluations: BlocEvaluation[];
  // Pour la dernière évaluation (ou celle sélectionnée)
  date?: string;
  equipement?: string;
  notesParCompetence?: Record<string, number | null>;
  noteGlobale?: number | null;
  commentaire?: string;
  totalCoefs?: number;
}

/** Couleur HSL dégradée rouge→vert selon la note /20 */
function noteColor(note: number | null): { bg: string; text: string; border: string } {
  if (note === null || note === undefined) {
    return { bg: "#F5F5F4", text: "#A8A29E", border: "#E7E5E4" };
  }
  const n = Math.max(0, Math.min(20, note));
  const ratio = n / 20;
  const hue = Math.round(ratio * 142);
  const bg = `hsl(${hue}, 85%, 92%)`;
  const text = `hsl(${hue}, 85%, 30%)`;
  const border = `hsl(${hue}, 85%, 78%)`;
  return { bg, text, border };
}

function getMention(note: number | null): string {
  if (note === null) return "";
  if (note >= 16) return "Très bien";
  if (note >= 14) return "Bien";
  if (note >= 12) return "Assez bien";
  if (note >= 10) return "Passable";
  return "Insuffisant";
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(2);
}

/** Génère le HTML du bulletin */
function genererHTML(data: DonneesBulletin): string {
  const { nom, prenom, classe, evaluations, date, equipement,
    notesParCompetence, noteGlobale, commentaire, totalCoefs } = data;

  // Utiliser la dernière évaluation si pas de données directes
  const derniere = evaluations[evaluations.length - 1] || null;
  const evalDate = date || derniere?.date || "—";
  const evalEquipement = equipement || derniere?.equipement || "—";
  const evalNotes = notesParCompetence || derniere?.notes || {};
  const evalNoteGlobale = noteGlobale !== undefined ? noteGlobale : derniere?.noteGlobale ?? null;
  const evalCommentaire = commentaire || derniere?.commentaire || "";

  // Compétences évaluées (avec au moins une note)
  const compsEvaluees = COMPETENCES.filter((c) => {
    const note = evalNotes[c.code];
    return note !== null && note !== undefined;
  });

  const { bg: globalBg, text: globalText, border: globalBorder } = noteColor(evalNoteGlobale);
  const mention = getMention(evalNoteGlobale);

  // Calcul des notes d'épreuves du Bac
  const resultatsEpreuves = calculerNotesEpreuves(evalNotes);
  const moyenneBac = calculerMoyenneBac(resultatsEpreuves);
  const { bg: bacBg, text: bacText } = noteColor(moyenneBac);

  // Tableau HTML des épreuves
  const lignesEpreuves = resultatsEpreuves.map((ep) => {
    const { bg, text, border } = noteColor(ep.note);
    const detailComps = ep.detailComps
      .filter((c) => c.noteSur20 !== null)
      .map((c) => `${c.code}:${fmt(c.noteSur20)}`)
      .join(" · ");
    return `
      <tr>
        <td style="font-weight:900; font-size:13pt; color:${ep.couleur}; padding:8px 12px; white-space:nowrap">${ep.id}</td>
        <td style="padding:8px 12px; color:#57534E; font-size:9pt">${ep.libelle}</td>
        <td style="padding:8px 12px; text-align:center; white-space:nowrap">
          <span style="font-size:8pt; font-weight:600; background:${ep.couleur}18; color:${ep.couleur}; padding:2px 8px; border-radius:20px">coef ${ep.coefBac}</span>
        </td>
        <td style="padding:8px 12px; text-align:center">
          ${ep.note !== null
            ? `<span style="background:${bg}; color:${text}; border:1px solid ${border}; padding:4px 10px; border-radius:8px; font-weight:900; font-size:12pt; font-family:'Segoe UI',Arial">${fmt(ep.note)}<span style="font-size:8pt;font-weight:400;opacity:0.7">/20</span></span>`
            : `<span style="color:#D1D5DB">—</span>`
          }
        </td>
        <td style="padding:8px 12px; font-size:8pt; color:#A8A29E">
          ${ep.nbCompDisponibles}/${ep.nbCompTotal} comp.
          ${detailComps ? `<br><span style="color:#78716C">${detailComps}</span>` : ""}
        </td>
      </tr>`;
  }).join("");

  // Lignes des compétences
  const lignesComps = compsEvaluees.map((comp) => {
    const note = evalNotes[comp.code];
    const { bg, text, border } = noteColor(note ?? null);
    return `
      <tr>
        <td class="comp-code" style="color:${comp.couleur}; border-left: 3px solid ${comp.couleur}">
          ${comp.code}
        </td>
        <td class="comp-libelle">${comp.libelle}</td>
        <td class="comp-poids">${comp.coef} pts</td>
        <td class="comp-note" style="background:${bg}; color:${text}; border:1px solid ${border}">
          ${note !== null && note !== undefined ? fmt(note) : "—"}<span class="sur20">/20</span>
        </td>
      </tr>`;
  }).join("");

  // Historique des évaluations précédentes
  const historiqueRows = evaluations.slice(0, -1).map((ev, i) => {
    const { bg, text } = noteColor(ev.noteGlobale);
    return `
      <tr>
        <td>${evaluations.length - 1 - i}</td>
        <td>${ev.date}</td>
        <td>${ev.equipement || "—"}</td>
        <td style="background:${bg}; color:${text}; font-weight:bold; text-align:center">
          ${fmt(ev.noteGlobale)}/20
        </td>
        <td style="color:#78716C; font-style:italic">${ev.commentaire || "—"}</td>
      </tr>`;
  }).reverse().join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Bulletin — ${nom} ${prenom}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      color: #1C1917;
      background: white;
      padding: 20mm 18mm;
    }

    /* En-tête */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 3px solid #2563EB;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .header-left { flex: 1; }
    .app-name {
      font-size: 9pt;
      font-weight: 700;
      color: #2563EB;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 4px;
    }
    .eleve-nom {
      font-size: 20pt;
      font-weight: 900;
      color: #1C1917;
      line-height: 1.1;
    }
    .eleve-info {
      font-size: 10pt;
      color: #78716C;
      margin-top: 4px;
    }
    .header-right {
      text-align: right;
    }
    .note-globale-box {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 20px;
      border-radius: 12px;
      border: 2px solid ${globalBorder};
      background: ${globalBg};
    }
    .note-globale-value {
      font-size: 28pt;
      font-weight: 900;
      color: ${globalText};
      line-height: 1;
    }
    .note-globale-label {
      font-size: 9pt;
      color: ${globalText};
      opacity: 0.75;
      margin-top: 2px;
    }
    .mention-badge {
      font-size: 8pt;
      font-weight: 700;
      color: ${globalText};
      background: ${globalBorder}60;
      padding: 2px 8px;
      border-radius: 20px;
      margin-top: 4px;
    }

    /* Infos évaluation */
    .eval-info {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .eval-info-item {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #FAFAF9;
      border: 1px solid #E7E5E4;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 10pt;
    }
    .eval-info-label {
      font-weight: 600;
      color: #78716C;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .eval-info-value {
      color: #1C1917;
      font-weight: 500;
    }

    /* Commentaire */
    .commentaire-box {
      background: #FAFAF9;
      border: 1px solid #E7E5E4;
      border-left: 3px solid #2563EB;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
      font-size: 10pt;
    }
    .commentaire-label {
      font-size: 8pt;
      font-weight: 700;
      color: #78716C;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .commentaire-text {
      color: #292524;
      line-height: 1.5;
    }

    /* Section titre */
    .section-title {
      font-size: 10pt;
      font-weight: 700;
      color: #57534E;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
      margin-top: 16px;
    }

    /* Tableau compétences */
    table.comps {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    table.comps thead tr {
      background: #F8FAFC;
      border-bottom: 2px solid #E7E5E4;
    }
    table.comps thead th {
      padding: 7px 10px;
      font-size: 8.5pt;
      font-weight: 700;
      color: #78716C;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
    }
    table.comps thead th:last-child { text-align: center; }
    table.comps tbody tr {
      border-bottom: 1px solid #F5F5F4;
    }
    table.comps tbody tr:nth-child(even) { background: #FAFAF9; }
    td.comp-code {
      padding: 7px 10px;
      font-weight: 800;
      font-size: 10pt;
      padding-left: 8px;
      white-space: nowrap;
    }
    td.comp-libelle {
      padding: 7px 10px;
      font-size: 9.5pt;
      color: #292524;
    }
    td.comp-poids {
      padding: 7px 10px;
      font-size: 9pt;
      color: #A8A29E;
      white-space: nowrap;
      text-align: center;
    }
    td.comp-note {
      padding: 5px 10px;
      font-size: 11pt;
      font-weight: 800;
      text-align: center;
      border-radius: 6px;
      white-space: nowrap;
    }
    .sur20 { font-size: 8pt; font-weight: 400; opacity: 0.7; margin-left: 1px; }

    /* Formule */
    .formule {
      font-size: 8.5pt;
      color: #A8A29E;
      text-align: right;
      margin-bottom: 16px;
      font-style: italic;
    }

    /* Tableau historique */
    table.histo {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
    }
    table.histo thead tr {
      background: #F8FAFC;
      border-bottom: 2px solid #E7E5E4;
    }
    table.histo thead th {
      padding: 6px 10px;
      font-size: 8.5pt;
      font-weight: 700;
      color: #78716C;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
    }
    table.histo tbody tr { border-bottom: 1px solid #F5F5F4; }
    table.histo tbody td { padding: 6px 10px; }

    /* Pied de page */
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #E7E5E4;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #A8A29E;
    }

    @media print {
      body { padding: 10mm 12mm; }
      @page { margin: 10mm; size: A4 portrait; }
    }
  </style>
</head>
<body>

  <!-- En-tête -->
  <div class="header">
    <div class="header-left">
      <div class="app-name">MELEC Éval — Bulletin d'évaluation</div>
      <div class="eleve-nom">${nom} ${prenom}</div>
      <div class="eleve-info">Classe : <strong>${classe}</strong></div>
    </div>
    <div class="header-right">
      <div class="note-globale-box">
        <div class="note-globale-value">${fmt(evalNoteGlobale)}</div>
        <div class="note-globale-label">/ 20</div>
        ${mention ? `<div class="mention-badge">${mention}</div>` : ""}
      </div>
    </div>
  </div>

  <!-- Infos évaluation -->
  <div class="eval-info">
    <div class="eval-info-item">
      <span class="eval-info-label">Date</span>
      <span class="eval-info-value">${evalDate}</span>
    </div>
    <div class="eval-info-item">
      <span class="eval-info-label">Équipement</span>
      <span class="eval-info-value">${evalEquipement}</span>
    </div>
    <div class="eval-info-item">
      <span class="eval-info-label">Compétences évaluées</span>
      <span class="eval-info-value">${compsEvaluees.length} / 13</span>
    </div>
    ${totalCoefs ? `<div class="eval-info-item">
      <span class="eval-info-label">Poids total</span>
      <span class="eval-info-value">${totalCoefs.toFixed(1)} / 240 pts</span>
    </div>` : ""}
  </div>

  <!-- Commentaire -->
  ${evalCommentaire ? `
  <div class="commentaire-box">
    <div class="commentaire-label">💬 Commentaire de l'enseignant</div>
    <div class="commentaire-text">${evalCommentaire}</div>
  </div>` : ""}

  <!-- Tableau des compétences -->
  <div class="section-title">Détail des compétences évaluées</div>
  <table class="comps">
    <thead>
      <tr>
        <th>Code</th>
        <th>Compétence</th>
        <th style="text-align:center">Poids</th>
        <th style="text-align:center">Note /20</th>
      </tr>
    </thead>
    <tbody>
      ${lignesComps || '<tr><td colspan="4" style="text-align:center;color:#A8A29E;padding:16px">Aucune compétence évaluée</td></tr>'}
    </tbody>
  </table>

  <!-- Formule de calcul -->
  ${compsEvaluees.length > 0 && evalNoteGlobale !== null ? `
  <div class="formule">
    Note globale = Σ(note_Ci × poids_Ci) ÷ Σpoids_évalués
    = ${compsEvaluees.map(c => {
      const n = evalNotes[c.code];
      return n !== null && n !== undefined ? `${fmt(n)}×${c.coef}` : null;
    }).filter(Boolean).join(" + ")}
    ÷ ${totalCoefs?.toFixed(1) || compsEvaluees.reduce((s, c) => s + c.coef, 0).toFixed(1)}
    = <strong>${fmt(evalNoteGlobale)}/20</strong>
  </div>` : ""}

  <!-- Notes d'épreuves du Bac -->
  ${resultatsEpreuves.some((ep) => ep.note !== null) ? `
  <div class="section-title">Notes d'épreuves du Bac Pro MELEC</div>
  <table style="width:100%; border-collapse:collapse; margin-bottom:8px">
    <thead>
      <tr style="background:#F8FAFC; border-bottom:2px solid #E7E5E4">
        <th style="text-align:left; padding:7px 12px; font-size:9pt; font-weight:700; color:#78716C; text-transform:uppercase; letter-spacing:0.5px">Épreuve</th>
        <th style="text-align:left; padding:7px 12px; font-size:9pt; font-weight:700; color:#78716C; text-transform:uppercase; letter-spacing:0.5px">Intitulé</th>
        <th style="text-align:center; padding:7px 12px; font-size:9pt; font-weight:700; color:#78716C; text-transform:uppercase; letter-spacing:0.5px">Coef Bac</th>
        <th style="text-align:center; padding:7px 12px; font-size:9pt; font-weight:700; color:#78716C; text-transform:uppercase; letter-spacing:0.5px">Note /20</th>
        <th style="text-align:left; padding:7px 12px; font-size:9pt; font-weight:700; color:#78716C; text-transform:uppercase; letter-spacing:0.5px">Compétences</th>
      </tr>
    </thead>
    <tbody>${lignesEpreuves}</tbody>
    ${moyenneBac !== null ? `
    <tfoot>
      <tr style="background:${bacBg}; border-top:2px solid ${bacText}30">
        <td colspan="3" style="padding:8px 12px; font-weight:700; font-size:10pt; color:${bacText}">Moyenne Bac pondérée (E2×3 + E31×7 + E32×2)</td>
        <td style="padding:8px 12px; text-align:center">
          <span style="font-weight:900; font-size:14pt; color:${bacText}; font-family:'Segoe UI',Arial">${fmt(moyenneBac)}<span style="font-size:9pt;font-weight:400;opacity:0.7">/20</span></span>
        </td>
        <td></td>
      </tr>
    </tfoot>` : ""}
  </table>
  <div style="font-size:8pt; color:#A8A29E; text-align:right; margin-bottom:12px; font-style:italic">
    ${EPREUVES_BAC.map((ep) => `${ep.id} = ${ep.competences.map((c) => `${c.code}/${c.poids}`).join("+")}`).join(" · ")}
  </div>` : ""}

  <!-- Historique -->
  ${evaluations.length > 1 ? `
  <div class="section-title">Historique des évaluations précédentes</div>
  <table class="histo">
    <thead>
      <tr>
        <th>#</th>
        <th>Date</th>
        <th>Équipement</th>
        <th style="text-align:center">Note /20</th>
        <th>Commentaire</th>
      </tr>
    </thead>
    <tbody>${historiqueRows}</tbody>
  </table>` : ""}

  <!-- Pied de page -->
  <div class="footer">
    <span>MELEC Éval — Grille d'évaluation professionnelle</span>
    <span>Imprimé le ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</span>
  </div>

</body>
</html>`;
}

/**
 * Génère et imprime le bulletin PDF de l'élève.
 * Ouvre une fenêtre d'impression du navigateur.
 */
export function exporterBulletinPDF(data: DonneesBulletin): void {
  const html = genererHTML(data);

  // Ouvrir dans un nouvel onglet et déclencher l'impression
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Veuillez autoriser les popups pour ce site afin d'exporter le PDF.");
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();

  // Attendre que les styles soient chargés avant d'imprimer
  win.onload = () => {
    setTimeout(() => {
      win.focus();
      win.print();
    }, 300);
  };
}
