/**
 * TableauSuiviEleve — Vue de suivi longitudinal d'un élève
 *
 * Structure :
 *  - Colonne 1 (sticky) : libellé de la ligne (Date, Équipement, C1…C13, Note globale, E2, E31, E32, Moy. Bac)
 *  - Colonnes 2…N : une colonne par évaluation
 *    - Ligne 1 : date
 *    - Ligne 2 : équipement
 *    - Lignes 3…15 : notes C1…C13 /20
 *    - Ligne 16 : note globale /20
 *    - Ligne 17 : E2 /20
 *    - Ligne 18 : E31 /20
 *    - Ligne 19 : E32 /20
 *    - Ligne 20 : Moy. Bac /20
 */
import { useMemo } from "react";
import { COMPETENCES } from "@/lib/competences";
import { noteGradientColor } from "@/lib/noteColor";
import { calculerNotesEpreuves, calculerMoyenneBac, EPREUVES_BAC } from "@/lib/epreuvesBac";
import type { BlocEvaluation } from "@/lib/excelUtils";

interface Props {
  nom: string;
  prenom: string;
  classe: string;
  evaluations: BlocEvaluation[];
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(2);
}

// Définition des lignes du tableau
const LIGNES_COMPS = COMPETENCES.map((c) => ({
  id: c.code,
  label: c.code,
  sublabel: c.libelle.length > 32 ? c.libelle.slice(0, 32) + "…" : c.libelle,
  type: "comp" as const,
  couleur: c.couleur,
}));

const LIGNES_EPREUVES = EPREUVES_BAC.map((ep) => ({
  id: ep.id,
  label: ep.id,
  sublabel: `coef ${ep.coefBac}`,
  type: "epreuve" as const,
  couleur: ep.couleur,
}));

const LIGNES = [
  ...LIGNES_COMPS,
  { id: "global", label: "Note /20", sublabel: "Note globale pondérée", type: "global" as const, couleur: "#1C1917" },
  ...LIGNES_EPREUVES,
  { id: "moyBac", label: "Moy. Bac", sublabel: "E2×3 + E31×7 + E32×2", type: "moyBac" as const, couleur: "#1C1917" },
];

export default function TableauSuiviEleve({ nom, prenom, classe, evaluations }: Props) {
  // Calculer les notes E2/E31/E32 pour chaque évaluation
  const colonnes = useMemo(() => {
    return evaluations.map((ev, i) => {
      const epreuves = calculerNotesEpreuves(ev.notes);
      const moyBac = calculerMoyenneBac(epreuves);
      return {
        index: i + 1,
        date: ev.date,
        equipement: ev.equipement,
        notes: ev.notes,
        noteGlobale: ev.noteGlobale,
        epreuves,
        moyBac,
        commentaire: ev.commentaire,
      };
    });
  }, [evaluations]);

  if (evaluations.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-stone-400 text-sm italic">
        Aucune évaluation enregistrée pour {nom} {prenom}.
      </div>
    );
  }

  const getValeur = (col: typeof colonnes[0], ligneId: string): number | null => {
    if (ligneId === "global") return col.noteGlobale;
    if (ligneId === "moyBac") return col.moyBac;
    const ep = EPREUVES_BAC.find((e) => e.id === ligneId);
    if (ep) return col.epreuves.find((r) => r.id === ligneId)?.note ?? null;
    return col.notes[ligneId] ?? null;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse" style={{ minWidth: `${220 + colonnes.length * 120}px` }}>
        <thead>
          {/* Ligne 1 : Date */}
          <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E7E5E4" }}>
            <th
              className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide sticky left-0 z-10"
              style={{ background: "#F8FAFC", color: "#57534E", minWidth: "200px", borderRight: "2px solid #E7E5E4" }}
            >
              Évaluation
            </th>
            {colonnes.map((col) => (
              <th key={col.index} className="text-center px-3 py-2.5" style={{ minWidth: "110px" }}>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-bold text-stone-700">Éval {col.index}</span>
                  <span className="text-[11px] font-semibold text-stone-500">{col.date}</span>
                </div>
              </th>
            ))}
          </tr>
          {/* Ligne 2 : Équipement */}
          <tr style={{ background: "#FAFAF9", borderBottom: "2px solid #E7E5E4" }}>
            <td
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wide sticky left-0 z-10"
              style={{ background: "#FAFAF9", color: "#78716C", borderRight: "2px solid #E7E5E4" }}
            >
              Équipement
            </td>
            {colonnes.map((col) => (
              <td key={col.index} className="text-center px-3 py-2">
                <span className="text-xs text-stone-500 truncate block max-w-[100px] mx-auto" title={col.equipement}>
                  {col.equipement || "—"}
                </span>
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {LIGNES.map((ligne, ligneIdx) => {
            const isSeparateur = ligne.id === "global" || ligne.id === "E2";
            const isMoyBac = ligne.id === "moyBac";
            const isGlobal = ligne.id === "global";

            return (
              <tr
                key={ligne.id}
                style={{
                  background: isGlobal || isMoyBac
                    ? "#F8FAFC"
                    : ligneIdx % 2 === 0 ? "white" : "#FAFAF9",
                  borderTop: isSeparateur ? "2px solid #E7E5E4" : "1px solid #F5F5F4",
                  borderBottom: isGlobal ? "2px solid #E7E5E4" : undefined,
                }}
              >
                {/* Colonne libellé */}
                <td
                  className="px-4 py-2.5 sticky left-0 z-10"
                  style={{
                    background: isGlobal || isMoyBac ? "#F8FAFC" : ligneIdx % 2 === 0 ? "white" : "#FAFAF9",
                    borderRight: "2px solid #E7E5E4",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: ligne.couleur }}
                    />
                    <div>
                      <span
                        className="font-bold text-xs"
                        style={{ color: ligne.couleur }}
                      >
                        {ligne.label}
                      </span>
                      {ligne.sublabel && (
                        <p className="text-[10px] text-stone-400 leading-tight">{ligne.sublabel}</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Colonnes évaluations */}
                {colonnes.map((col) => {
                  const val = getValeur(col, ligne.id);
                  const { bg, text, border } = noteGradientColor(val);
                  const isImportant = isGlobal || isMoyBac;

                  return (
                    <td key={col.index} className="text-center px-2 py-2">
                      {val !== null ? (
                        <span
                          className={`inline-block tabular-nums font-bold rounded-lg px-2 py-1 ${isImportant ? "text-sm" : "text-xs"}`}
                          style={{
                            background: bg,
                            color: text,
                            border: `1px solid ${border}`,
                            fontFamily: isImportant ? "'Outfit', sans-serif" : undefined,
                          }}
                        >
                          {fmt(val)}
                        </span>
                      ) : (
                        <span className="text-stone-200 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
