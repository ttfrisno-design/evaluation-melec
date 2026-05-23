/**
 * Composant TableauCompetence — Grille d'Évaluation MELEC
 * Affiche un tableau de saisie des notes pour une compétence donnée.
 * Le pied de tableau affiche :
 *   - Le total brut (obtenu / max)
 *   - La note ramenée sur 20
 * Design: Dashboard Technique Compact
 */
import { useState } from "react";
import type { Competence } from "@/lib/competences";
import { calculerNoteCompetence } from "@/lib/competences";
import { noteGradientColor } from "@/lib/noteColor";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  competence: Competence;
  notes: Record<string, number | null>;
  onNoteChange: (critereId: string, note: number | null) => void;
}

export default function TableauCompetence({ competence, notes, onNoteChange }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { obtenu, max, nbNotes, sur20 } = calculerNoteCompetence(competence, notes);
  // Pourcentage basé sur la note /20 pour la barre de progression
  const pourcentage = sur20 !== null ? (sur20 / 20) * 100 : 0;

  const getBarColor = (pct: number) => {
    if (pct >= 80) return "#16a34a";
    if (pct >= 50) return "#d97706";
    return "#dc2626";
  };

  const getNoteColor = (note: number | null) => {
    if (note === null) return "#A8A29E";
    if (note >= 16) return "#16a34a";
    if (note >= 10) return "#2563EB";
    return "#dc2626";
  };

  const handleNoteInput = (critereId: string, value: string, noteMax: number) => {
    if (value === "" || value === null) {
      onNoteChange(critereId, null);
      return;
    }
    let num = parseFloat(value);
    if (isNaN(num)) {
      onNoteChange(critereId, null);
      return;
    }
    if (num < 0) num = 0;
    if (num > noteMax) num = noteMax;
    onNoteChange(critereId, num);
  };

  return (
    <div
      className="rounded-xl overflow-hidden shadow-sm"
      style={{ background: "white", border: "1px solid #E7E5E4" }}
    >
      {/* En-tête */}
      <div
        className="flex items-center justify-between px-5 py-3 cursor-pointer select-none"
        style={{
          background: `${competence.couleur}0F`,
          borderBottom: collapsed ? "none" : `1px solid ${competence.couleur}30`,
        }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-bold tracking-wide"
            style={{ background: competence.couleur, color: "white" }}
          >
            {competence.code}
          </div>
          <span
            className="font-semibold text-sm truncate"
            style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}
          >
            {competence.libelle}
          </span>
          {/* Poids sur 240 */}
          <span
            className="flex-shrink-0 text-xs font-bold px-1.5 py-0.5 rounded"
            style={{ background: `${competence.couleur}20`, color: competence.couleur }}
          >
            {competence.coef} pts/240
          </span>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
          {/* Note /20 en en-tête */}
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "#F5F5F4" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pourcentage}%`, background: getBarColor(pourcentage) }}
              />
            </div>
            {/* Affichage note /20 */}
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: getNoteColor(sur20), minWidth: "80px", textAlign: "right" }}
            >
              {sur20 !== null ? (
                <>{sur20.toFixed(2)}<span className="text-xs font-normal text-stone-400">/20</span></>
              ) : (
                <span className="text-stone-400 text-xs font-normal">{obtenu}/{max} pts</span>
              )}
            </span>
          </div>
          {collapsed ? <ChevronDown size={16} color="#A8A29E" /> : <ChevronUp size={16} color="#A8A29E" />}
        </div>
      </div>

      {/* Corps du tableau */}
      {!collapsed && (
        <div className="overflow-x-auto -mx-3 lg:mx-0">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#FAFAF9", borderBottom: "1px solid #E7E5E4" }}>
                <th className="text-left px-5 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: "#78716C", width: "55%" }}>
                  Critère d'évaluation
                </th>
                <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: "#78716C", width: "15%" }}>
                  Note max
                </th>
                <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: "#78716C", width: "15%" }}>
                  Note obtenue
                </th>
                <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: "#78716C", width: "15%" }}>
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {competence.criteres.map((critere, index) => {
                const note = notes[critere.id];
                const pct = note !== null && note !== undefined
                  ? Math.round((note / critere.noteMax) * 100)
                  : null;
                const isEven = index % 2 === 0;

                return (
                  <tr
                    key={critere.id}
                    style={{
                      background: isEven ? "white" : "#FAFAF9",
                      borderBottom: "1px solid #F5F5F4",
                    }}
                  >
                    <td className="px-5 py-3 text-sm" style={{ color: "#292524" }}>
                      {critere.libelle}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ background: `${competence.couleur}15`, color: competence.couleur }}
                      >
                        /{critere.noteMax}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        // Convertir la note brute en note /20 pour la couleur
                        const noteSur20 = note !== null && note !== undefined && critere.noteMax > 0
                          ? (note / critere.noteMax) * 20
                          : null;
                        const { bg, text, border } = noteGradientColor(noteSur20);
                        return (
                          <input
                            type="number"
                            min={0}
                            max={critere.noteMax}
                            step={0.5}
                            value={note !== null && note !== undefined ? note : ""}
                            onChange={(e) => handleNoteInput(critere.id, e.target.value, critere.noteMax)}
                            placeholder="—"
                            className="w-16 text-center rounded-lg px-2 py-1.5 text-sm font-semibold outline-none transition-all"
                            style={{
                              background: note !== null && note !== undefined ? bg : "#F5F5F4",
                              border: `1.5px solid ${note !== null && note !== undefined ? border : "#E7E5E4"}`,
                              color: note !== null && note !== undefined ? text : "#A8A29E",
                            }}
                            onFocus={(e) => { e.target.style.borderColor = note !== null ? border : competence.couleur; }}
                            onBlur={(e) => { e.target.style.borderColor = note !== null ? border : "#E7E5E4"; }}
                          />
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pct !== null ? (
                        <span
                          className="text-xs font-semibold tabular-nums"
                          style={{ color: pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626" }}
                        >
                          {pct}%
                        </span>
                      ) : (
                        <span className="text-xs text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Pied de tableau — total brut + note /20 */}
            <tfoot>
              <tr style={{ background: `${competence.couleur}08`, borderTop: `2px solid ${competence.couleur}30` }}>
                <td className="px-5 py-3 text-sm font-bold" style={{ color: "#1C1917" }}>
                  Total {competence.code}
                </td>
                <td className="px-4 py-3 text-center text-sm font-bold" style={{ color: "#57534E" }}>
                  /{max}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-bold tabular-nums" style={{ color: competence.couleur }}>
                    {obtenu}
                  </span>
                  <span className="text-xs text-stone-400 ml-0.5">pts</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-xs font-bold" style={{ color: getBarColor(pourcentage) }}>
                    {max > 0 ? Math.round(pourcentage) : 0}%
                  </span>
                </td>
              </tr>
              {/* Ligne note /20 mise en évidence avec dégradé */}
              {(() => {
                const { bg, text, border } = noteGradientColor(sur20);
                return (
                  <tr style={{ background: sur20 !== null ? bg : `${competence.couleur}12`, borderTop: `2px solid ${sur20 !== null ? border : competence.couleur}30` }}>
                    <td className="px-5 py-2.5 text-sm font-bold" style={{ color: sur20 !== null ? text : competence.couleur }}>
                      Note {competence.code} ramenée sur 20
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs" style={{ color: sur20 !== null ? text : "#78716C", opacity: 0.7 }} colSpan={2}>
                      {nbNotes > 0 ? `Σ${obtenu} / ${nbNotes} critère(s)` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className="text-xl font-black tabular-nums"
                        style={{ fontFamily: "'Outfit', sans-serif", color: sur20 !== null ? text : "#D1D5DB" }}
                      >
                        {sur20 !== null ? sur20.toFixed(2) : "—"}
                      </span>
                      <span className="text-xs font-semibold ml-0.5" style={{ color: sur20 !== null ? text : "#D1D5DB", opacity: 0.7 }}>/20</span>
                    </td>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
