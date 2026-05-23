/**
 * Page Dashboard — Tableau de bord récapitulatif de classe
 * Design: Dashboard Technique Compact
 * Affiche : tableau des notes par élève, moyennes par compétence, moyenne générale
 */
import { useMemo, useState } from "react";
import { COMPETENCES } from "@/lib/competences";
import { lireEvaluationsEleve, type FichierGrille } from "@/lib/excelUtils";
import {
  BarChart2,
  Users,
  TrendingUp,
  Award,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
} from "lucide-react";

interface Props {
  fichierGrille: FichierGrille | null;
  onRetour: () => void;
}

interface DonneeEleve {
  nom: string;
  prenom: string;
  classe: string;
  noteGlobale: number | null;
  notesParComp: Record<string, number | null>;
  nbEvaluations: number;
  derniereDate: string;
}

// Couleur selon la note
function couleurNote(note: number | null): string {
  if (note === null) return "#D1D5DB";
  if (note >= 16) return "#16a34a";
  if (note >= 14) return "#2563EB";
  if (note >= 12) return "#7C3AED";
  if (note >= 10) return "#d97706";
  return "#dc2626";
}

function bgNote(note: number | null): string {
  if (note === null) return "#F9FAFB";
  if (note >= 16) return "#F0FDF4";
  if (note >= 14) return "#EFF6FF";
  if (note >= 12) return "#F5F3FF";
  if (note >= 10) return "#FFFBEB";
  return "#FEF2F2";
}

export default function Dashboard({ fichierGrille, onRetour }: Props) {
  const [classeActive, setClasseActive] = useState<string>(
    fichierGrille?.classes[0]?.nom || ""
  );
  const [triColonne, setTriColonne] = useState<string>("nom");
  const [triAsc, setTriAsc] = useState(true);
  const [compActives, setCompActives] = useState<string[]>(
    COMPETENCES.map((c) => c.code)
  );
  const [showCompFilter, setShowCompFilter] = useState(false);

  // Extraire les données de tous les élèves de la classe active
  const donneesEleves: DonneeEleve[] = useMemo(() => {
    if (!fichierGrille || !classeActive) return [];
    const classe = fichierGrille.classes.find((c) => c.nom === classeActive);
    if (!classe) return [];

    return classe.eleves.map((eleve) => {
      const evaluations = lireEvaluationsEleve(
        fichierGrille.rawWorkbook,
        eleve.nom,
        eleve.prenom
      );

      // Prendre la dernière évaluation disponible
      const derniere = evaluations[evaluations.length - 1] || null;

      // Agréger les notes par compétence (dernière évaluation)
      const notesParComp: Record<string, number | null> = {};
      if (derniere) {
        for (const code of COMPETENCES.map((c) => c.code)) {
          notesParComp[code] = derniere.notes[code] ?? null;
        }
      }

      return {
        nom: eleve.nom,
        prenom: eleve.prenom,
        classe: eleve.classe,
        noteGlobale: derniere?.noteGlobale ?? null,
        notesParComp,
        nbEvaluations: evaluations.length,
        derniereDate: derniere?.date || "—",
      };
    });
  }, [fichierGrille, classeActive]);

  // Trier les élèves
  const elevesTriés = useMemo(() => {
    return [...donneesEleves].sort((a, b) => {
      let va: number | string | null;
      let vb: number | string | null;
      if (triColonne === "nom") {
        va = a.nom + a.prenom;
        vb = b.nom + b.prenom;
      } else if (triColonne === "global") {
        va = a.noteGlobale;
        vb = b.noteGlobale;
      } else {
        va = a.notesParComp[triColonne];
        vb = b.notesParComp[triColonne];
      }
      // Nulls en dernier
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "string" && typeof vb === "string") {
        return triAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return triAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [donneesEleves, triColonne, triAsc]);

  // Moyennes par compétence
  const moyennesComp = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const code of COMPETENCES.map((c) => c.code)) {
      const vals = donneesEleves
        .map((e) => e.notesParComp[code])
        .filter((v): v is number => v !== null && v !== undefined);
      result[code] = vals.length > 0
        ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
        : null;
    }
    return result;
  }, [donneesEleves]);

  // Moyenne générale de la classe
  const moyenneGenerale = useMemo(() => {
    const vals = donneesEleves
      .map((e) => e.noteGlobale)
      .filter((v): v is number => v !== null);
    return vals.length > 0
      ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
      : null;
  }, [donneesEleves]);

  // Stats globales
  const stats = useMemo(() => {
    const notes = donneesEleves.map((e) => e.noteGlobale).filter((v): v is number => v !== null);
    if (notes.length === 0) return null;
    return {
      nb: notes.length,
      min: Math.min(...notes),
      max: Math.max(...notes),
      au_dessus_10: notes.filter((n) => n >= 10).length,
      en_dessous_10: notes.filter((n) => n < 10).length,
    };
  }, [donneesEleves]);

  const handleTri = (col: string) => {
    if (triColonne === col) setTriAsc((v) => !v);
    else { setTriColonne(col); setTriAsc(true); }
  };

  const toggleComp = (code: string) => {
    setCompActives((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const colonnesComp = COMPETENCES.filter((c) => compActives.includes(c.code));

  if (!fichierGrille) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <BarChart2 size={40} color="#D1D5DB" className="mx-auto mb-3" />
          <p className="text-stone-400 text-sm">Chargez un fichier de grille pour accéder au tableau de bord.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-stone-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white" style={{ borderColor: "#E7E5E4" }}>
        <div className="flex items-center gap-4">
          <button
            onClick={onRetour}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            <ArrowLeft size={15} /> Retour
          </button>
          <div className="w-px h-5 bg-stone-200" />
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
            Tableau de bord — Classe{" "}
            <span style={{ color: "#2563EB" }}>{classeActive}</span>
          </h1>
        </div>

        {/* Sélecteur de classe */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "#E7E5E4" }}>
            {fichierGrille.classes.map((c) => (
              <button
                key={c.nom}
                onClick={() => setClasseActive(c.nom)}
                className="px-3 py-1.5 text-sm font-semibold transition-all"
                style={{
                  background: classeActive === c.nom ? "#2563EB" : "white",
                  color: classeActive === c.nom ? "white" : "#57534E",
                }}
              >
                {c.nom}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── Cartes statistiques ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Élèves évalués */}
          <div className="rounded-xl p-4 bg-white shadow-sm" style={{ border: "1px solid #E7E5E4" }}>
            <div className="flex items-center gap-2 mb-2">
              <Users size={16} color="#2563EB" />
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Élèves</span>
            </div>
            <p className="text-3xl font-black" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
              {stats?.nb ?? 0}
              <span className="text-sm font-normal text-stone-400 ml-1">/ {donneesEleves.length}</span>
            </p>
            <p className="text-xs text-stone-400 mt-1">évalués</p>
          </div>

          {/* Moyenne générale */}
          <div className="rounded-xl p-4 bg-white shadow-sm" style={{ border: "1px solid #E7E5E4" }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} color="#2563EB" />
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Moyenne</span>
            </div>
            <p className="text-3xl font-black tabular-nums" style={{ fontFamily: "'Outfit', sans-serif", color: couleurNote(moyenneGenerale) }}>
              {moyenneGenerale !== null ? moyenneGenerale.toFixed(2) : "—"}
            </p>
            <p className="text-xs text-stone-400 mt-1">/ 20 (classe)</p>
          </div>

          {/* Au-dessus de 10 */}
          <div className="rounded-xl p-4 bg-white shadow-sm" style={{ border: "1px solid #E7E5E4" }}>
            <div className="flex items-center gap-2 mb-2">
              <Award size={16} color="#16a34a" />
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">≥ 10/20</span>
            </div>
            <p className="text-3xl font-black" style={{ fontFamily: "'Outfit', sans-serif", color: "#16a34a" }}>
              {stats?.au_dessus_10 ?? 0}
            </p>
            <p className="text-xs text-stone-400 mt-1">élèves validants</p>
          </div>

          {/* En dessous de 10 */}
          <div className="rounded-xl p-4 bg-white shadow-sm" style={{ border: "1px solid #E7E5E4" }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} color="#dc2626" />
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">&lt; 10/20</span>
            </div>
            <p className="text-3xl font-black" style={{ fontFamily: "'Outfit', sans-serif", color: "#dc2626" }}>
              {stats?.en_dessous_10 ?? 0}
            </p>
            <p className="text-xs text-stone-400 mt-1">en difficulté</p>
          </div>
        </div>

        {/* ── Tableau principal ── */}
        <div className="rounded-xl bg-white shadow-sm overflow-hidden" style={{ border: "1px solid #E7E5E4" }}>
          {/* Barre d'outils du tableau */}
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#F5F5F4", background: "#FAFAF9" }}>
            <h2 className="text-sm font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
              Notes par élève — {classeActive}
            </h2>
            <div className="relative">
              <button
                onClick={() => setShowCompFilter((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: "#F5F5F4", color: "#57534E", border: "1px solid #E7E5E4" }}
              >
                Compétences ({compActives.length}/{COMPETENCES.length})
                {showCompFilter ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showCompFilter && (
                <div
                  className="absolute right-0 top-full mt-1 z-20 rounded-xl shadow-xl p-3 w-64"
                  style={{ background: "white", border: "1px solid #E7E5E4" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-stone-500">Filtrer les colonnes</span>
                    <div className="flex gap-2">
                      <button onClick={() => setCompActives(COMPETENCES.map((c) => c.code))} className="text-xs text-blue-600 hover:underline">Tout</button>
                      <button onClick={() => setCompActives([])} className="text-xs text-stone-400 hover:underline">Aucun</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COMPETENCES.map((comp) => (
                      <button
                        key={comp.code}
                        onClick={() => toggleComp(comp.code)}
                        className="px-2 py-1 rounded text-xs font-bold transition-all"
                        style={{
                          background: compActives.includes(comp.code) ? comp.couleur : "#F5F5F4",
                          color: compActives.includes(comp.code) ? "white" : "#A8A29E",
                        }}
                      >
                        {comp.code}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tableau scrollable horizontalement */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: `${300 + colonnesComp.length * 70}px` }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E7E5E4" }}>
                  {/* Colonne Élève */}
                  <th
                    className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide cursor-pointer select-none sticky left-0 z-10"
                    style={{ color: "#57534E", background: "#F8FAFC", minWidth: "160px" }}
                    onClick={() => handleTri("nom")}
                  >
                    <div className="flex items-center gap-1">
                      Élève
                      {triColonne === "nom" && (triAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                    </div>
                  </th>
                  {/* Colonnes compétences */}
                  {colonnesComp.map((comp) => (
                    <th
                      key={comp.code}
                      className="text-center px-2 py-3 text-xs font-bold cursor-pointer select-none"
                      style={{ color: comp.couleur, minWidth: "65px" }}
                      onClick={() => handleTri(comp.code)}
                      title={comp.libelle}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{comp.code}</span>
                        {triColonne === comp.code && (triAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                      </div>
                    </th>
                  ))}
                  {/* Colonne Note globale */}
                  <th
                    className="text-center px-3 py-3 text-xs font-bold cursor-pointer select-none"
                    style={{ color: "#1C1917", minWidth: "80px", borderLeft: "2px solid #E7E5E4" }}
                    onClick={() => handleTri("global")}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span>Note /20</span>
                      {triColonne === "global" && (triAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                    </div>
                  </th>
                  {/* Nb évals */}
                  <th className="text-center px-3 py-3 text-xs font-semibold text-stone-400" style={{ minWidth: "60px" }}>
                    Évals
                  </th>
                </tr>
              </thead>

              <tbody>
                {elevesTriés.length === 0 ? (
                  <tr>
                    <td colSpan={colonnesComp.length + 3} className="text-center py-12 text-stone-400 text-sm">
                      Aucune évaluation enregistrée pour cette classe.
                    </td>
                  </tr>
                ) : (
                  elevesTriés.map((eleve, idx) => (
                    <tr
                      key={`${eleve.nom}-${eleve.prenom}`}
                      style={{
                        background: idx % 2 === 0 ? "white" : "#FAFAF9",
                        borderBottom: "1px solid #F5F5F4",
                      }}
                    >
                      {/* Nom élève */}
                      <td className="px-4 py-2.5 sticky left-0 z-10" style={{ background: idx % 2 === 0 ? "white" : "#FAFAF9" }}>
                        <div>
                          <span className="font-semibold text-stone-800">{eleve.nom}</span>{" "}
                          <span className="text-stone-600">{eleve.prenom}</span>
                        </div>
                        {eleve.derniereDate !== "—" && (
                          <span className="text-xs text-stone-400">{eleve.derniereDate}</span>
                        )}
                      </td>

                      {/* Notes par compétence */}
                      {colonnesComp.map((comp) => {
                        const note = eleve.notesParComp[comp.code];
                        return (
                          <td key={comp.code} className="text-center px-2 py-2.5">
                            {note !== null && note !== undefined ? (
                              <span
                                className="inline-block px-1.5 py-0.5 rounded text-xs font-bold tabular-nums"
                                style={{ background: bgNote(note), color: couleurNote(note) }}
                              >
                                {note.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-stone-200 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Note globale */}
                      <td className="text-center px-3 py-2.5" style={{ borderLeft: "2px solid #F5F5F4" }}>
                        {eleve.noteGlobale !== null ? (
                          <span
                            className="inline-block px-2 py-1 rounded-lg text-sm font-black tabular-nums"
                            style={{
                              background: bgNote(eleve.noteGlobale),
                              color: couleurNote(eleve.noteGlobale),
                              fontFamily: "'Outfit', sans-serif",
                            }}
                          >
                            {eleve.noteGlobale.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-stone-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Nb évaluations */}
                      <td className="text-center px-3 py-2.5">
                        {eleve.nbEvaluations > 0 ? (
                          <span className="text-xs font-semibold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                            {eleve.nbEvaluations}
                          </span>
                        ) : (
                          <span className="text-stone-200 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Ligne des moyennes */}
              {elevesTriés.some((e) => e.noteGlobale !== null) && (
                <tfoot>
                  <tr style={{ background: "#EFF6FF", borderTop: "2px solid #2563EB" }}>
                    <td className="px-4 py-2.5 sticky left-0 z-10 font-bold text-sm" style={{ background: "#EFF6FF", color: "#1C1917" }}>
                      Moyenne classe
                    </td>
                    {colonnesComp.map((comp) => {
                      const moy = moyennesComp[comp.code];
                      return (
                        <td key={comp.code} className="text-center px-2 py-2.5">
                          {moy !== null ? (
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-xs font-bold tabular-nums"
                              style={{ background: bgNote(moy), color: couleurNote(moy) }}
                            >
                              {moy.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-stone-300 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center px-3 py-2.5" style={{ borderLeft: "2px solid #BFDBFE" }}>
                      {moyenneGenerale !== null ? (
                        <span
                          className="inline-block px-2 py-1 rounded-lg text-sm font-black tabular-nums"
                          style={{
                            background: bgNote(moyenneGenerale),
                            color: couleurNote(moyenneGenerale),
                            fontFamily: "'Outfit', sans-serif",
                          }}
                        >
                          {moyenneGenerale.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-stone-300 text-xs">—</span>
                      )}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── Barres de progression par compétence ── */}
        {Object.values(moyennesComp).some((v) => v !== null) && (
          <div className="rounded-xl bg-white shadow-sm p-5" style={{ border: "1px solid #E7E5E4" }}>
            <h2 className="text-sm font-bold mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
              Moyennes par compétence — {classeActive}
            </h2>
            <div className="space-y-2.5">
              {COMPETENCES.map((comp) => {
                const moy = moyennesComp[comp.code];
                if (moy === null) return null;
                const pct = (moy / 20) * 100;
                return (
                  <div key={comp.code} className="flex items-center gap-3">
                    <span
                      className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: `${comp.couleur}15`, color: comp.couleur, minWidth: "36px", textAlign: "center" }}
                    >
                      {comp.code}
                    </span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#F5F5F4" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: couleurNote(moy) }}
                      />
                    </div>
                    <span
                      className="flex-shrink-0 text-sm font-bold tabular-nums"
                      style={{ color: couleurNote(moy), minWidth: "48px", textAlign: "right" }}
                    >
                      {moy.toFixed(2)}/20
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
