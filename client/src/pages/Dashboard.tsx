/**
 * Page Dashboard — Tableau de bord récapitulatif de classe
 * Design: Dashboard Technique Compact
 * Fonctionnalités :
 *  - Barre de recherche instantanée (nom, prénom)
 *  - Fiche détaillée d'un élève au clic
 *  - Tableau des notes par élève, colonnes triables
 *  - Filtre des compétences affichées
 *  - Moyennes de classe par compétence
 *  - Barres de progression
 */
import { useMemo, useState, useRef, useEffect } from "react";
import { COMPETENCES } from "@/lib/competences";
import { lireEvaluationsEleve, type FichierGrille, type BlocEvaluation } from "@/lib/excelUtils";
import {
  Users,
  TrendingUp,
  Award,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Search,
  X,
  User,
  Calendar,
  Wrench,
  FileText,
} from "lucide-react";
import { noteGradientColor } from "@/lib/noteColor";
import { exporterBulletinPDF } from "@/lib/pdfBulletin";
import { calculerNotesEpreuves, calculerMoyenneBac, EPREUVES_BAC, type ResultatEpreuve } from "@/lib/epreuvesBac";

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
  dernierCommentaire?: string;
  toutesEvaluations: BlocEvaluation[];
}

function couleurNote(note: number | null): string {
  return noteGradientColor(note).text;
}

function bgNote(note: number | null): string {
  return noteGradientColor(note).bg;
}

function getMention(note: number | null): string {
  if (note === null) return "—";
  if (note >= 16) return "Très bien";
  if (note >= 14) return "Bien";
  if (note >= 12) return "Assez bien";
  if (note >= 10) return "Passable";
  return "Insuffisant";
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

  // Recherche
  const [recherche, setRecherche] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [eleveSelectionne, setEleveSelectionne] = useState<DonneeEleve | null>(null);
  const rechercheRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fermer les suggestions au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        rechercheRef.current &&
        !rechercheRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Données de tous les élèves de la classe active
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
      const derniere = evaluations[evaluations.length - 1] || null;
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
        dernierCommentaire: derniere?.commentaire || undefined,
        toutesEvaluations: evaluations,
      };
    });
  }, [fichierGrille, classeActive]);

  // Suggestions de recherche (toutes classes)
  const tousEleves: DonneeEleve[] = useMemo(() => {
    if (!fichierGrille) return [];
    const result: DonneeEleve[] = [];
    for (const classe of fichierGrille.classes) {
      for (const eleve of classe.eleves) {
        const evaluations = lireEvaluationsEleve(
          fichierGrille.rawWorkbook,
          eleve.nom,
          eleve.prenom
        );
        const derniere = evaluations[evaluations.length - 1] || null;
        const notesParComp: Record<string, number | null> = {};
        if (derniere) {
          for (const code of COMPETENCES.map((c) => c.code)) {
            notesParComp[code] = derniere.notes[code] ?? null;
          }
        }
        result.push({
          nom: eleve.nom,
          prenom: eleve.prenom,
          classe: eleve.classe,
          noteGlobale: derniere?.noteGlobale ?? null,
          notesParComp,
          nbEvaluations: evaluations.length,
          derniereDate: derniere?.date || "—",
          dernierCommentaire: derniere?.commentaire || undefined,
          toutesEvaluations: evaluations,
        });
      }
    }
    return result;
  }, [fichierGrille]);

  const suggestions = useMemo(() => {
    if (!recherche.trim() || recherche.length < 2) return [];
    const q = recherche.toLowerCase();
    return tousEleves.filter(
      (e) =>
        e.nom.toLowerCase().includes(q) ||
        e.prenom.toLowerCase().includes(q) ||
        `${e.nom} ${e.prenom}`.toLowerCase().includes(q) ||
        `${e.prenom} ${e.nom}`.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [recherche, tousEleves]);

  // Élèves filtrés dans le tableau (par recherche si active)
  const elevesFiltres = useMemo(() => {
    if (!recherche.trim()) return donneesEleves;
    const q = recherche.toLowerCase();
    return donneesEleves.filter(
      (e) =>
        e.nom.toLowerCase().includes(q) ||
        e.prenom.toLowerCase().includes(q)
    );
  }, [donneesEleves, recherche]);

  // Tri
  const elevesTriés = useMemo(() => {
    return [...elevesFiltres].sort((a, b) => {
      let va: number | string | null;
      let vb: number | string | null;
      if (triColonne === "nom") { va = a.nom + a.prenom; vb = b.nom + b.prenom; }
      else if (triColonne === "global") { va = a.noteGlobale; vb = b.noteGlobale; }
      else { va = a.notesParComp[triColonne]; vb = b.notesParComp[triColonne]; }
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "string" && typeof vb === "string")
        return triAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return triAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [elevesFiltres, triColonne, triAsc]);

  // Moyennes (sur élèves filtrés)
  const moyennesComp = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const code of COMPETENCES.map((c) => c.code)) {
      const vals = elevesFiltres
        .map((e) => e.notesParComp[code])
        .filter((v): v is number => v !== null && v !== undefined);
      result[code] = vals.length > 0
        ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
        : null;
    }
    return result;
  }, [elevesFiltres]);

  const moyenneGenerale = useMemo(() => {
    const vals = elevesFiltres.map((e) => e.noteGlobale).filter((v): v is number => v !== null);
    return vals.length > 0
      ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
      : null;
  }, [elevesFiltres]);

  // Notes E2, E31, E32 par élève (calculées depuis les notes de compétences)
  const epreuvesParEleve = useMemo(() => {
    const result: Record<string, ResultatEpreuve[]> = {};
    for (const eleve of elevesFiltres) {
      const key = `${eleve.nom}|${eleve.prenom}`;
      result[key] = calculerNotesEpreuves(eleve.notesParComp);
    }
    return result;
  }, [elevesFiltres]);

  // Moyennes de classe pour E2, E31, E32
  const moyennesEpreuves = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const ep of EPREUVES_BAC) {
      const vals = elevesFiltres
        .map((e) => {
          const key = `${e.nom}|${e.prenom}`;
          return epreuvesParEleve[key]?.find((r) => r.id === ep.id)?.note ?? null;
        })
        .filter((v): v is number => v !== null);
      result[ep.id] = vals.length > 0
        ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
        : null;
    }
    return result;
  }, [elevesFiltres, epreuvesParEleve]);

  const stats = useMemo(() => {
    const notes = elevesFiltres.map((e) => e.noteGlobale).filter((v): v is number => v !== null);
    if (notes.length === 0) return null;
    return {
      nb: notes.length,
      min: Math.min(...notes),
      max: Math.max(...notes),
      au_dessus_10: notes.filter((n) => n >= 10).length,
      en_dessous_10: notes.filter((n) => n < 10).length,
    };
  }, [elevesFiltres]);

  const handleTri = (col: string) => {
    if (triColonne === col) setTriAsc((v) => !v);
    else { setTriColonne(col); setTriAsc(true); }
  };

  const toggleComp = (code: string) => {
    setCompActives((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSelectSuggestion = (eleve: DonneeEleve) => {
    setRecherche(`${eleve.nom} ${eleve.prenom}`);
    setShowSuggestions(false);
    setEleveSelectionne(eleve);
    // Basculer sur la classe de l'élève si nécessaire
    if (eleve.classe !== classeActive) setClasseActive(eleve.classe);
  };

  const handleClearRecherche = () => {
    setRecherche("");
    setEleveSelectionne(null);
    setShowSuggestions(false);
    rechercheRef.current?.focus();
  };

  const colonnesComp = COMPETENCES.filter((c) => compActives.includes(c.code));

  if (!fichierGrille) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-stone-400 text-sm">Chargez un fichier de grille pour accéder au tableau de bord.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-stone-50" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white gap-4" style={{ borderColor: "#E7E5E4" }}>
        <div className="flex items-center gap-4 flex-shrink-0">
          <button onClick={onRetour} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
          <div className="w-px h-5 bg-stone-200" />
          <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
            Tableau de bord —{" "}
            <span style={{ color: "#2563EB" }}>{classeActive}</span>
          </h1>
        </div>

        {/* ── Barre de recherche ── */}
        <div className="flex-1 max-w-md relative">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
            style={{
              background: "white",
              border: `1.5px solid ${recherche ? "#2563EB" : "#E7E5E4"}`,
              boxShadow: recherche ? "0 0 0 3px #2563EB18" : "none",
            }}
          >
            <Search size={15} color={recherche ? "#2563EB" : "#A8A29E"} className="flex-shrink-0" />
            <input
              ref={rechercheRef}
              type="text"
              value={recherche}
              onChange={(e) => { setRecherche(e.target.value); setShowSuggestions(true); setEleveSelectionne(null); }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Rechercher un élève (nom, prénom)…"
              className="flex-1 text-sm outline-none bg-transparent"
              style={{ color: "#1C1917" }}
            />
            {recherche && (
              <button onClick={handleClearRecherche} className="flex-shrink-0 text-stone-400 hover:text-stone-600 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-xl z-30 overflow-hidden"
              style={{ background: "white", border: "1px solid #E7E5E4" }}
            >
              {suggestions.map((eleve, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectSuggestion(eleve)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-stone-50 transition-colors text-left"
                  style={{ borderBottom: i < suggestions.length - 1 ? "1px solid #F5F5F4" : "none" }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: "#2563EB" }}>
                      {eleve.nom[0]}{eleve.prenom[0]}
                    </div>
                    <div>
                      <span className="font-semibold text-stone-800">{eleve.nom}</span>{" "}
                      <span className="text-stone-600">{eleve.prenom}</span>
                      <span className="ml-2 text-xs text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">{eleve.classe}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {eleve.noteGlobale !== null ? (
                      <span className="text-sm font-bold tabular-nums px-2 py-0.5 rounded-lg"
                        style={{ background: bgNote(eleve.noteGlobale), color: couleurNote(eleve.noteGlobale) }}>
                        {eleve.noteGlobale.toFixed(2)}/20
                      </span>
                    ) : (
                      <span className="text-xs text-stone-300">Non évalué</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sélecteur de classe */}
        <div className="flex rounded-lg overflow-hidden border flex-shrink-0" style={{ borderColor: "#E7E5E4" }}>
          {fichierGrille.classes.map((c) => (
            <button key={c.nom} onClick={() => { setClasseActive(c.nom); setRecherche(""); setEleveSelectionne(null); }}
              className="px-3 py-1.5 text-sm font-semibold transition-all"
              style={{ background: classeActive === c.nom ? "#2563EB" : "white", color: classeActive === c.nom ? "white" : "#57534E" }}>
              {c.nom}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── Fiche élève (si sélectionné via recherche) ── */}
        {eleveSelectionne && (
          <div className="rounded-xl bg-white shadow-sm overflow-hidden" style={{ border: "2px solid #2563EB" }}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: "#2563EB" }}>
                  {eleveSelectionne.nom[0]}{eleveSelectionne.prenom[0]}
                </div>
                <div>
                  <h3 className="font-bold text-base" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
                    {eleveSelectionne.nom} {eleveSelectionne.prenom}
                  </h3>
                  <p className="text-xs text-stone-500">
                    Classe {eleveSelectionne.classe} · {eleveSelectionne.nbEvaluations} évaluation(s)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {eleveSelectionne.noteGlobale !== null && (
                  <div className="text-center">
                    <p className="text-3xl font-black tabular-nums" style={{ fontFamily: "'Outfit', sans-serif", color: couleurNote(eleveSelectionne.noteGlobale) }}>
                      {eleveSelectionne.noteGlobale.toFixed(2)}
                    </p>
                    <p className="text-xs text-stone-400">/ 20 — {getMention(eleveSelectionne.noteGlobale)}</p>
                  </div>
                )}
                {/* Bouton export PDF */}
                <button
                  onClick={() => exporterBulletinPDF({
                    nom: eleveSelectionne.nom,
                    prenom: eleveSelectionne.prenom,
                    classe: eleveSelectionne.classe,
                    evaluations: eleveSelectionne.toutesEvaluations,
                    notesParCompetence: eleveSelectionne.notesParComp,
                    noteGlobale: eleveSelectionne.noteGlobale,
                    commentaire: eleveSelectionne.dernierCommentaire,
                    date: eleveSelectionne.derniereDate,
                  })}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}
                  title="Exporter le bulletin PDF"
                >
                  <FileText size={12} /> PDF
                </button>
                <button onClick={() => { setEleveSelectionne(null); setRecherche(""); }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg"
                  style={{ background: "#DBEAFE", color: "#2563EB" }}>
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Notes par compétence de l'élève */}
            <div className="p-5">
              <div className="flex flex-wrap gap-2 mb-4">
                {COMPETENCES.map((comp) => {
                  const note = eleveSelectionne.notesParComp[comp.code];
                  if (note === null || note === undefined) return null;
                  return (
                    <div key={comp.code} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: bgNote(note), border: `1px solid ${couleurNote(note)}30` }}>
                      <span style={{ color: comp.couleur }}>{comp.code}</span>
                      <span className="text-stone-400">:</span>
                      <span className="tabular-nums font-bold" style={{ color: couleurNote(note) }}>
                        {note.toFixed(2)}/20
                      </span>
                    </div>
                  );
                })}
                {Object.values(eleveSelectionne.notesParComp).every((v) => v === null) && (
                  <p className="text-sm text-stone-400 italic">Aucune note enregistrée pour cet élève.</p>
                )}
              </div>

              {/* Dernier commentaire */}
              {eleveSelectionne.dernierCommentaire && (
                <div
                  className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-4"
                  style={{ background: "#FAFAF9", border: "1px solid #E7E5E4" }}
                >
                  <span className="text-base flex-shrink-0 mt-0.5">💬</span>
                  <div>
                    <p className="text-xs font-semibold text-stone-400 mb-0.5">Dernier commentaire</p>
                    <p className="text-sm text-stone-700">{eleveSelectionne.dernierCommentaire}</p>
                  </div>
                </div>
              )}

              {/* Graphique d'évolution E2 / E31 / E32 */}
              {eleveSelectionne.toutesEvaluations.length >= 1 && (() => {
                const evals = eleveSelectionne.toutesEvaluations;
                // Calculer E2/E31/E32 pour chaque évaluation
                const series = evals.map((ev, i) => ({
                  label: ev.date || `Éval ${i + 1}`,
                  resultats: calculerNotesEpreuves(ev.notes),
                  noteGlobale: ev.noteGlobale,
                }));

                const W = 480, H = 140, PAD_L = 32, PAD_R = 16, PAD_T = 12, PAD_B = 28;
                const chartW = W - PAD_L - PAD_R;
                const chartH = H - PAD_T - PAD_B;
                const n = series.length;
                const xStep = n > 1 ? chartW / (n - 1) : chartW / 2;

                const toY = (val: number | null) =>
                  val === null ? null : PAD_T + chartH - (val / 20) * chartH;

                const couleurs: Record<string, string> = { E2: "#2563EB", E31: "#7C3AED", E32: "#BE185D", global: "#d97706" };
                const series_lines = [
                  { id: "E2",     label: "E2",      vals: series.map((s) => s.resultats.find((r) => r.id === "E2")?.note ?? null) },
                  { id: "E31",    label: "E31",     vals: series.map((s) => s.resultats.find((r) => r.id === "E31")?.note ?? null) },
                  { id: "E32",    label: "E32",     vals: series.map((s) => s.resultats.find((r) => r.id === "E32")?.note ?? null) },
                  { id: "global", label: "Globale", vals: series.map((s) => s.noteGlobale) },
                ];

                const buildPath = (vals: (number | null)[]) => {
                  const pts = vals.map((v, i) => ({ x: PAD_L + i * xStep, y: toY(v) })).filter((p) => p.y !== null);
                  if (pts.length < 2) return null;
                  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${(p.y as number).toFixed(1)}`).join(" ");
                };

                const gridLines = [0, 5, 10, 15, 20];

                return (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Progression E2 / E31 / E32</p>
                    <div className="rounded-xl p-3" style={{ background: "#FAFAF9", border: "1px solid #E7E5E4" }}>
                      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
                        {/* Grille horizontale */}
                        {gridLines.map((v) => {
                          const y = toY(v) as number;
                          return (
                            <g key={v}>
                              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#E7E5E4" strokeWidth="0.5" strokeDasharray={v === 10 ? "4,2" : "2,2"} />
                              <text x={PAD_L - 4} y={y + 3.5} textAnchor="end" fontSize="8" fill="#A8A29E">{v}</text>
                            </g>
                          );
                        })}

                        {/* Lignes verticales (une par évaluation) */}
                        {series.map((_, i) => (
                          <line key={i} x1={PAD_L + i * xStep} y1={PAD_T} x2={PAD_L + i * xStep} y2={PAD_T + chartH} stroke="#F5F5F4" strokeWidth="1" />
                        ))}

                        {/* Courbes */}
                        {series_lines.map((line) => {
                          const path = buildPath(line.vals);
                          if (!path) return null;
                          return (
                            <g key={line.id}>
                              <path d={path} fill="none" stroke={couleurs[line.id]} strokeWidth={line.id === "global" ? 1.5 : 2}
                                strokeDasharray={line.id === "global" ? "4,2" : undefined} strokeLinecap="round" strokeLinejoin="round" />
                              {/* Points */}
                              {line.vals.map((v, i) => {
                                if (v === null) return null;
                                const cx = PAD_L + i * xStep;
                                const cy = toY(v) as number;
                                return (
                                  <g key={i}>
                                    <circle cx={cx} cy={cy} r={3.5} fill={couleurs[line.id]} stroke="white" strokeWidth={1.5} />
                                    <text x={cx} y={cy - 6} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={couleurs[line.id]}>
                                      {v.toFixed(1)}
                                    </text>
                                  </g>
                                );
                              })}
                            </g>
                          );
                        })}

                        {/* Labels axe X */}
                        {series.map((s, i) => (
                          <text key={i} x={PAD_L + i * xStep} y={H - 4} textAnchor="middle" fontSize="8" fill="#78716C">
                            {s.label.length > 10 ? s.label.slice(5) : s.label}
                          </text>
                        ))}
                      </svg>

                      {/* Légende */}
                      <div className="flex flex-wrap gap-3 mt-2 justify-center">
                        {series_lines.map((line) => (
                          <div key={line.id} className="flex items-center gap-1.5">
                            <div className="w-5 h-0.5 rounded" style={{ background: couleurs[line.id], borderTop: line.id === "global" ? `2px dashed ${couleurs[line.id]}` : undefined }} />
                            <span className="text-xs font-semibold" style={{ color: couleurs[line.id] }}>{line.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Historique des évaluations */}
              {eleveSelectionne.toutesEvaluations.length > 1 && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Historique des évaluations</p>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {eleveSelectionne.toutesEvaluations.map((eval_, i) => (
                      <div key={i} className="flex-shrink-0 rounded-lg p-3 min-w-[140px]"
                        style={{ background: "#FAFAF9", border: "1px solid #E7E5E4" }}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Calendar size={11} color="#A8A29E" />
                          <span className="text-xs text-stone-500">{eval_.date}</span>
                        </div>
                        {eval_.equipement && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <Wrench size={11} color="#A8A29E" />
                            <span className="text-xs text-stone-400 truncate max-w-[110px]">{eval_.equipement}</span>
                          </div>
                        )}
                        {eval_.noteGlobale !== null ? (
                          <span className="text-lg font-black tabular-nums" style={{ fontFamily: "'Outfit', sans-serif", color: couleurNote(eval_.noteGlobale) }}>
                            {eval_.noteGlobale.toFixed(2)}<span className="text-xs font-normal text-stone-400">/20</span>
                          </span>
                        ) : (
                          <span className="text-xs text-stone-300">—</span>
                        )}
                        {eval_.commentaire && (
                          <p className="text-xs text-stone-400 mt-1.5 leading-tight line-clamp-2" title={eval_.commentaire}>
                            💬 {eval_.commentaire}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Cartes statistiques ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl p-4 bg-white shadow-sm" style={{ border: "1px solid #E7E5E4" }}>
            <div className="flex items-center gap-2 mb-2">
              <Users size={16} color="#2563EB" />
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Élèves</span>
            </div>
            <p className="text-3xl font-black" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
              {stats?.nb ?? 0}<span className="text-sm font-normal text-stone-400 ml-1">/ {donneesEleves.length}</span>
            </p>
            <p className="text-xs text-stone-400 mt-1">
              {recherche ? "correspondants" : "évalués"}
            </p>
          </div>
          <div className="rounded-xl p-4 bg-white shadow-sm" style={{ border: "1px solid #E7E5E4" }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} color="#2563EB" />
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Moyenne</span>
            </div>
            <p className="text-3xl font-black tabular-nums" style={{ fontFamily: "'Outfit', sans-serif", color: couleurNote(moyenneGenerale) }}>
              {moyenneGenerale !== null ? moyenneGenerale.toFixed(2) : "—"}
            </p>
            <p className="text-xs text-stone-400 mt-1">/ 20 {recherche ? "(sélection)" : "(classe)"}</p>
          </div>
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

        {/* ── Notes d'épreuves du Bac E2 / E31 / E32 ── */}
        <div className="rounded-xl bg-white shadow-sm overflow-hidden" style={{ border: "1px solid #E7E5E4" }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: "#F5F5F4", background: "#FAFAF9" }}>
            <h2 className="text-sm font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
              Notes d'épreuves du Bac Pro MELEC
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Calculées automatiquement à partir des compétences évaluées — se mettent à jour en temps réel
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E7E5E4" }}>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide sticky left-0 z-10" style={{ color: "#57534E", background: "#F8FAFC", minWidth: "160px" }}>Élève</th>
                  {EPREUVES_BAC.map((ep) => (
                    <th key={ep.id} className="text-center px-4 py-3" style={{ minWidth: "120px" }}>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-sm font-black" style={{ color: ep.couleur }}>{ep.id}</span>
                        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">coef {ep.coefBac}</span>
                      </div>
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: "#1C1917", minWidth: "100px", borderLeft: "2px solid #E7E5E4" }}>Moy. Bac</th>
                </tr>
              </thead>
              <tbody>
                {elevesTriés.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-stone-400 text-sm">Aucune évaluation disponible.</td></tr>
                ) : (
                  elevesTriés.map((eleve, idx) => {
                    const key = `${eleve.nom}|${eleve.prenom}`;
                    const epreuves = epreuvesParEleve[key] || [];
                    const moyBac = calculerMoyenneBac(epreuves);
                    const { bg: bgBac, text: textBac } = noteGradientColor(moyBac);

                    return (
                      <tr key={key} style={{ background: idx % 2 === 0 ? "white" : "#FAFAF9", borderBottom: "1px solid #F5F5F4" }}>
                        <td className="px-4 py-2.5 sticky left-0 z-10" style={{ background: idx % 2 === 0 ? "white" : "#FAFAF9" }}>
                          <span className="font-semibold text-stone-800">{eleve.nom}</span>{" "}
                          <span className="text-stone-600">{eleve.prenom}</span>
                        </td>
                        {epreuves.map((ep) => {
                          const { bg, text } = noteGradientColor(ep.note);
                          return (
                            <td key={ep.id} className="px-4 py-2.5 text-center">
                              {ep.note !== null ? (
                                <div className="inline-flex flex-col items-center">
                                  <span
                                    className="px-2.5 py-1 rounded-lg text-sm font-black tabular-nums"
                                    style={{ background: bg, color: text, fontFamily: "'Outfit', sans-serif" }}
                                    title={`${ep.nbCompDisponibles}/${ep.nbCompTotal} compétences évaluées`}
                                  >
                                    {ep.note.toFixed(2)}
                                  </span>
                                  <span className="text-[10px] text-stone-400 mt-0.5">
                                    {ep.nbCompDisponibles}/{ep.nbCompTotal} comp.
                                  </span>
                                </div>
                              ) : (
                                <span className="text-stone-200 text-xs">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2.5 text-center" style={{ borderLeft: "2px solid #F5F5F4" }}>
                          {moyBac !== null ? (
                            <span
                              className="px-2.5 py-1 rounded-lg text-sm font-black tabular-nums"
                              style={{ background: bgBac, color: textBac, fontFamily: "'Outfit', sans-serif" }}
                            >
                              {moyBac.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-stone-200 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {/* Ligne des moyennes de classe */}
              {Object.values(moyennesEpreuves).some((v) => v !== null) && (
                <tfoot>
                  <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E7E5E4" }}>
                    <td className="px-4 py-2.5 sticky left-0 z-10 font-bold text-sm" style={{ background: "#F8FAFC", color: "#1C1917" }}>Moyenne classe</td>
                    {EPREUVES_BAC.map((ep) => {
                      const moy = moyennesEpreuves[ep.id];
                      const { bg, text } = noteGradientColor(moy);
                      return (
                        <td key={ep.id} className="px-4 py-2.5 text-center">
                          {moy !== null ? (
                            <span className="px-2.5 py-1 rounded-lg text-sm font-black tabular-nums" style={{ background: bg, color: text, fontFamily: "'Outfit', sans-serif" }}>
                              {moy.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-stone-300 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-center" style={{ borderLeft: "2px solid #E7E5E4" }}>
                      {(() => {
                        const moyBacClasse = calculerMoyenneBac(
                          EPREUVES_BAC.map((ep) => ({ ...ep, note: moyennesEpreuves[ep.id] ?? null, nbCompDisponibles: 0, nbCompTotal: 0, poidsDisponibles: 0, poidsTotal: 0, detailComps: [] }))
                        );
                        const { bg, text } = noteGradientColor(moyBacClasse);
                        return moyBacClasse !== null ? (
                          <span className="px-2.5 py-1 rounded-lg text-sm font-black tabular-nums" style={{ background: bg, color: text, fontFamily: "'Outfit', sans-serif" }}>
                            {moyBacClasse.toFixed(2)}
                          </span>
                        ) : <span className="text-stone-300 text-xs">—</span>;
                      })()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Légende des épreuves */}
          <div className="px-5 py-3 border-t" style={{ borderColor: "#F5F5F4", background: "#FAFAF9" }}>
            <div className="flex flex-wrap gap-4 text-xs text-stone-500">
              {EPREUVES_BAC.map((ep) => (
                <div key={ep.id} className="flex items-center gap-1.5">
                  <span className="font-bold" style={{ color: ep.couleur }}>{ep.id}</span>
                  <span>({ep.libelle})</span>
                  <span className="px-1.5 py-0.5 rounded font-semibold" style={{ background: `${ep.couleur}15`, color: ep.couleur }}>coef {ep.coefBac}</span>
                  <span className="text-stone-400">— {ep.competences.map((c) => `${c.code}/${c.poids}`).join(" + ")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tableau principal ── */}
        <div className="rounded-xl bg-white shadow-sm overflow-hidden" style={{ border: "1px solid #E7E5E4" }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#F5F5F4", background: "#FAFAF9" }}>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
                Notes par élève — {classeActive}
              </h2>
              {recherche && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#EFF6FF", color: "#2563EB" }}>
                  {elevesTriés.length} résultat(s) pour « {recherche} »
                </span>
              )}
            </div>
            <div className="relative">
              <button onClick={() => setShowCompFilter((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: "#F5F5F4", color: "#57534E", border: "1px solid #E7E5E4" }}>
                Compétences ({compActives.length}/{COMPETENCES.length})
                {showCompFilter ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showCompFilter && (
                <div className="absolute right-0 top-full mt-1 z-20 rounded-xl shadow-xl p-3 w-64"
                  style={{ background: "white", border: "1px solid #E7E5E4" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-stone-500">Filtrer les colonnes</span>
                    <div className="flex gap-2">
                      <button onClick={() => setCompActives(COMPETENCES.map((c) => c.code))} className="text-xs text-blue-600 hover:underline">Tout</button>
                      <button onClick={() => setCompActives([])} className="text-xs text-stone-400 hover:underline">Aucun</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COMPETENCES.map((comp) => (
                      <button key={comp.code} onClick={() => toggleComp(comp.code)}
                        className="px-2 py-1 rounded text-xs font-bold transition-all"
                        style={{ background: compActives.includes(comp.code) ? comp.couleur : "#F5F5F4", color: compActives.includes(comp.code) ? "white" : "#A8A29E" }}>
                        {comp.code}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: `${300 + colonnesComp.length * 70}px` }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E7E5E4" }}>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide cursor-pointer select-none sticky left-0 z-10"
                    style={{ color: "#57534E", background: "#F8FAFC", minWidth: "160px" }}
                    onClick={() => handleTri("nom")}>
                    <div className="flex items-center gap-1">
                      Élève {triColonne === "nom" && (triAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                    </div>
                  </th>
                  {colonnesComp.map((comp) => (
                    <th key={comp.code} className="text-center px-2 py-3 text-xs font-bold cursor-pointer select-none"
                      style={{ color: comp.couleur, minWidth: "65px" }}
                      onClick={() => handleTri(comp.code)} title={comp.libelle}>
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{comp.code}</span>
                        {triColonne === comp.code && (triAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                      </div>
                    </th>
                  ))}
                  <th className="text-center px-3 py-3 text-xs font-bold cursor-pointer select-none"
                    style={{ color: "#1C1917", minWidth: "80px", borderLeft: "2px solid #E7E5E4" }}
                    onClick={() => handleTri("global")}>
                    <div className="flex flex-col items-center gap-0.5">
                      <span>Note /20</span>
                      {triColonne === "global" && (triAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                    </div>
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-stone-400" style={{ minWidth: "60px" }}>Évals</th>
                </tr>
              </thead>
              <tbody>
                {elevesTriés.length === 0 ? (
                  <tr>
                    <td colSpan={colonnesComp.length + 3} className="text-center py-12 text-stone-400 text-sm">
                      {recherche
                        ? `Aucun élève trouvé pour « ${recherche} » dans la classe ${classeActive}.`
                        : "Aucune évaluation enregistrée pour cette classe."}
                    </td>
                  </tr>
                ) : (
                  elevesTriés.map((eleve, idx) => {
                    const isSelected = eleveSelectionne?.nom === eleve.nom && eleveSelectionne?.prenom === eleve.prenom;
                    return (
                      <tr key={`${eleve.nom}-${eleve.prenom}`}
                        onClick={() => setEleveSelectionne(isSelected ? null : eleve)}
                        className="cursor-pointer transition-colors"
                        style={{
                          background: isSelected ? "#EFF6FF" : idx % 2 === 0 ? "white" : "#FAFAF9",
                          borderBottom: "1px solid #F5F5F4",
                          outline: isSelected ? "2px solid #2563EB" : "none",
                        }}>
                        <td className="px-4 py-2.5 sticky left-0 z-10"
                          style={{ background: isSelected ? "#EFF6FF" : idx % 2 === 0 ? "white" : "#FAFAF9" }}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                              style={{ background: isSelected ? "#2563EB" : "#D1D5DB" }}>
                              {eleve.nom[0]}{eleve.prenom[0]}
                            </div>
                            <div>
                              <span className="font-semibold text-stone-800">{eleve.nom}</span>{" "}
                              <span className="text-stone-600">{eleve.prenom}</span>
                              {eleve.derniereDate !== "—" && (
                                <span className="block text-xs text-stone-400">{eleve.derniereDate}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        {colonnesComp.map((comp) => {
                          const note = eleve.notesParComp[comp.code];
                          return (
                            <td key={comp.code} className="text-center px-2 py-2.5">
                              {note !== null && note !== undefined ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-xs font-bold tabular-nums"
                                  style={{ background: bgNote(note), color: couleurNote(note) }}>
                                  {note.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-stone-200 text-xs">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="text-center px-3 py-2.5" style={{ borderLeft: "2px solid #F5F5F4" }}>
                          {eleve.noteGlobale !== null ? (
                            <div className="relative inline-block group">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-black tabular-nums cursor-default"
                                style={{ background: bgNote(eleve.noteGlobale), color: couleurNote(eleve.noteGlobale), fontFamily: "'Outfit', sans-serif" }}
                              >
                                {eleve.noteGlobale.toFixed(2)}
                                {eleve.dernierCommentaire && (
                                  <span className="text-[10px] opacity-60">💬</span>
                                )}
                              </span>
                              {/* Infobulle commentaire */}
                              {eleve.dernierCommentaire && (
                                <div
                                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30
                                             opacity-0 group-hover:opacity-100 pointer-events-none
                                             transition-opacity duration-150"
                                  style={{ minWidth: "180px", maxWidth: "260px" }}
                                >
                                  <div
                                    className="rounded-xl px-3 py-2 text-xs shadow-xl"
                                    style={{
                                      background: "#1C1917",
                                      color: "#F5F5F4",
                                      lineHeight: "1.5",
                                    }}
                                  >
                                    <p className="font-semibold text-stone-300 mb-0.5">Commentaire</p>
                                    <p>{eleve.dernierCommentaire}</p>
                                    {eleve.derniereDate !== "—" && (
                                      <p className="text-stone-500 mt-1 text-[10px]">{eleve.derniereDate}</p>
                                    )}
                                  </div>
                                  {/* Flèche */}
                                  <div
                                    className="absolute left-1/2 -translate-x-1/2 top-full"
                                    style={{
                                      width: 0, height: 0,
                                      borderLeft: "6px solid transparent",
                                      borderRight: "6px solid transparent",
                                      borderTop: "6px solid #1C1917",
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-stone-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="text-center px-3 py-2.5">
                          {eleve.nbEvaluations > 0 ? (
                            <span className="text-xs font-semibold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">{eleve.nbEvaluations}</span>
                          ) : (
                            <span className="text-stone-200 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {elevesTriés.some((e) => e.noteGlobale !== null) && (
                <tfoot>
                  <tr style={{ background: "#EFF6FF", borderTop: "2px solid #2563EB" }}>
                    <td className="px-4 py-2.5 sticky left-0 z-10 font-bold text-sm" style={{ background: "#EFF6FF", color: "#1C1917" }}>
                      Moyenne {recherche ? "sélection" : "classe"}
                    </td>
                    {colonnesComp.map((comp) => {
                      const moy = moyennesComp[comp.code];
                      return (
                        <td key={comp.code} className="text-center px-2 py-2.5">
                          {moy !== null ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-xs font-bold tabular-nums"
                              style={{ background: bgNote(moy), color: couleurNote(moy) }}>
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
                        <span className="inline-block px-2 py-1 rounded-lg text-sm font-black tabular-nums"
                          style={{ background: bgNote(moyenneGenerale), color: couleurNote(moyenneGenerale), fontFamily: "'Outfit', sans-serif" }}>
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
              Moyennes par compétence{recherche ? ` — sélection « ${recherche} »` : ` — ${classeActive}`}
            </h2>
            <div className="space-y-2.5">
              {COMPETENCES.map((comp) => {
                const moy = moyennesComp[comp.code];
                if (moy === null) return null;
                const pct = (moy / 20) * 100;
                return (
                  <div key={comp.code} className="flex items-center gap-3">
                    <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: `${comp.couleur}15`, color: comp.couleur, minWidth: "36px", textAlign: "center" }}>
                      {comp.code}
                    </span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#F5F5F4" }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: couleurNote(moy) }} />
                    </div>
                    <span className="flex-shrink-0 text-sm font-bold tabular-nums"
                      style={{ color: couleurNote(moy), minWidth: "48px", textAlign: "right" }}>
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
