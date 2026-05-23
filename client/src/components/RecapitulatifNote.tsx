/**
 * Composant RecapitulatifNote — Grille d'Évaluation MELEC
 * Affiche :
 *  - La note de chaque compétence ramenée sur 20 (avec son coefficient)
 *  - La note globale pondérée sur 20
 * Design: Dashboard Technique Compact
 */
import type { Competence } from "@/lib/competences";
import { noteGradientColor } from "@/lib/noteColor";

interface NoteCompetence {
  comp: Competence;
  obtenu: number;
  max: number;
  sur20: number | null;
  coef: number;
}

interface Props {
  noteSur20: number | null;        // Note globale pondérée /20
  totalObtenu: number;             // Total brut obtenu (pour la barre)
  totalMax: number;                // Total brut max (pour la barre)
  totalCoefs: number;              // Somme des coefficients
  notesParCompetence: NoteCompetence[];
}

export default function RecapitulatifNote({
  noteSur20,
  totalObtenu,
  totalMax,
  totalCoefs,
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
      className="rounded-2xl p-4 lg:p-5 shadow-sm"
      style={{ background: "white", border: "1px solid #E7E5E4" }}
    >
      <div className="flex flex-col sm:flex-row items-start gap-4 lg:gap-6">
        {/* Note globale sur 20 */}
        {(() => {
          const { bg, text, border } = noteGradientColor(noteSur20);
          return (
            <div
              className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl px-6 sm:px-8 py-4 sm:py-5 w-full sm:w-auto"
              style={{
                background: noteSur20 !== null ? bg : "#F5F5F4",
                border: `2px solid ${noteSur20 !== null ? border : "#E7E5E4"}`,
                minWidth: "140px",
              }}
            >
              <span
                className="text-5xl font-black tabular-nums leading-none"
                style={{ fontFamily: "'Outfit', sans-serif", color: noteSur20 !== null ? text : "#D6D3D1" }}
              >
                {noteSur20 !== null ? noteSur20.toFixed(2) : "—"}
              </span>
              <span className="text-sm font-semibold mt-1" style={{ color: noteSur20 !== null ? text : "#78716C", opacity: 0.75 }}>
                / 20
              </span>
              {mention && (
                <span
                  className="mt-2 text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${border}40`, color: text }}
                >
                  {mention.label}
                </span>
              )}
              {totalCoefs > 0 && (
                <span className="mt-1 text-xs" style={{ color: text, opacity: 0.6 }}>
                  Σ coef = {totalCoefs}
                </span>
              )}
            </div>
          );
        })()}

        {/* Détails par compétence */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h2
              className="text-base font-bold"
              style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}
            >
              Note globale pondérée sur 20
            </h2>
            <span className="text-xs text-stone-400">
              Moyenne pondérée par coefficients
            </span>
          </div>

          {/* Barre de progression globale */}
          <div className="w-full h-1.5 rounded-full overflow-hidden mb-4" style={{ background: "#F5F5F4" }}>
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

          {/* Grille des notes par compétence sur 20 */}
          {notesParCompetence.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {notesParCompetence.map(({ comp, sur20, coef }) => {
                const couleur = comp.couleur;
                    const { bg: noteBg, text: noteText, border: noteBorder } = noteGradientColor(sur20);
                    return (
                      <div
                        key={comp.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                        style={{
                          background: sur20 !== null ? noteBg : `${couleur}08`,
                          border: `1px solid ${sur20 !== null ? noteBorder : `${couleur}25`}`,
                        }}
                      >
                        {/* Pastille couleur compétence */}
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: couleur }} />
                        {/* Code */}
                        <span style={{ color: couleur }}>{comp.code}</span>
                        {/* Poids */}
                        <span className="px-1 rounded text-[10px] font-bold" style={{ background: `${couleur}20`, color: couleur }}>
                          {coef}pts
                        </span>
                        <span className="text-stone-400">:</span>
                        {/* Note sur 20 avec dégradé */}
                        {sur20 !== null ? (
                          <span className="tabular-nums font-bold" style={{ color: noteText }}>
                            {sur20.toFixed(2)}<span style={{ opacity: 0.7 }}>/20</span>
                          </span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </div>
                    );
              })}
            </div>
          ) : (
            <p className="text-xs text-stone-400 italic">
              Saisissez des notes dans les tableaux ci-dessous pour voir le récapitulatif.
            </p>
          )}

          {/* Formule de calcul */}
          {notesParCompetence.length > 0 && totalCoefs > 0 && (
            <p className="text-xs text-stone-400 mt-3">
              Formule : Σ(note_Ci/20 × poids_Ci) ÷ Σpoids_évalués — pondération sur {totalCoefs.toFixed(1)} pts/{240}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
