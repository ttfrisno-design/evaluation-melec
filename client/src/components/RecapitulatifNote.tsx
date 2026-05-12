/**
 * Composant RecapitulatifNote — Grille d'Évaluation MELEC
 * Affiche la note finale sur 20 et le récapitulatif par compétence
 * Design: Dashboard Technique Compact — encadré proéminent, animation de la note
 */
import type { Competence } from "@/lib/competences";

interface NoteCompetence {
  comp: Competence;
  obtenu: number;
  max: number;
}

interface Props {
  noteSur20: number | null;
  totalObtenu: number;
  totalMax: number;
  notesParCompetence: NoteCompetence[];
}

export default function RecapitulatifNote({
  noteSur20,
  totalObtenu,
  totalMax,
  notesParCompetence,
}: Props) {
  const getMention = (note: number | null) => {
    if (note === null) return null;
    if (note >= 16) return { label: "Très bien", color: "#16a34a" };
    if (note >= 14) return { label: "Bien", color: "#2563EB" };
    if (note >= 12) return { label: "Assez bien", color: "#7C3AED" };
    if (note >= 10) return { label: "Passable", color: "#d97706" };
    return { label: "Insuffisant", color: "#dc2626" };
  };

  const mention = getMention(noteSur20);
  const pourcentageGlobal = totalMax > 0 ? (totalObtenu / totalMax) * 100 : 0;

  return (
    <div
      className="rounded-xl p-5 shadow-sm"
      style={{ background: "white", border: "1px solid #E7E5E4" }}
    >
      <div className="flex items-start gap-6">
        {/* Note sur 20 — élément central */}
        <div
          className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl px-8 py-5"
          style={{
            background: noteSur20 !== null ? "#EFF6FF" : "#F5F5F4",
            border: `2px solid ${noteSur20 !== null ? "#2563EB" : "#E7E5E4"}`,
            minWidth: "140px",
          }}
        >
          <span
            className="text-5xl font-black tabular-nums leading-none"
            style={{
              fontFamily: "'Outfit', sans-serif",
              color: noteSur20 !== null ? "#2563EB" : "#D6D3D1",
            }}
          >
            {noteSur20 !== null ? noteSur20.toFixed(2) : "—"}
          </span>
          <span className="text-sm font-semibold mt-1" style={{ color: "#78716C" }}>
            / 20
          </span>
          {mention && (
            <span
              className="mt-2 text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${mention.color}15`, color: mention.color }}
            >
              {mention.label}
            </span>
          )}
        </div>

        {/* Détails */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-base font-bold"
              style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}
            >
              Note finale calculée automatiquement
            </h2>
            <span className="text-sm text-stone-400 tabular-nums">
              {totalObtenu} pts / {totalMax} pts
            </span>
          </div>

          {/* Barre de progression globale */}
          <div className="w-full h-2 rounded-full overflow-hidden mb-4" style={{ background: "#F5F5F4" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pourcentageGlobal}%`,
                background:
                  pourcentageGlobal >= 80
                    ? "#16a34a"
                    : pourcentageGlobal >= 50
                    ? "#d97706"
                    : pourcentageGlobal > 0
                    ? "#dc2626"
                    : "#E7E5E4",
              }}
            />
          </div>

          {/* Récapitulatif par compétence */}
          <div className="flex flex-wrap gap-2">
            {notesParCompetence.map(({ comp, obtenu, max }) => {
              const pct = max > 0 ? (obtenu / max) * 100 : 0;
              return (
                <div
                  key={comp.id}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                  style={{
                    background: `${comp.couleur}10`,
                    border: `1px solid ${comp.couleur}30`,
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: comp.couleur }}
                  />
                  <span style={{ color: comp.couleur }}>{comp.code}</span>
                  <span className="text-stone-500">:</span>
                  <span className="tabular-nums" style={{ color: "#1C1917" }}>
                    {obtenu}/{max}
                  </span>
                  <span
                    className="tabular-nums"
                    style={{
                      color: pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626",
                    }}
                  >
                    ({Math.round(pct)}%)
                  </span>
                </div>
              );
            })}
            {notesParCompetence.length === 0 && (
              <span className="text-xs text-stone-400 italic">
                Saisissez des notes dans les tableaux ci-dessous pour voir le récapitulatif.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
