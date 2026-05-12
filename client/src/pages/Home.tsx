/**
 * Page principale — Grille d'Évaluation MELEC
 * Design: Dashboard Technique Compact
 * Layout: Sidebar gauche (config) + Zone droite (tableaux de compétences)
 * Palette: Fond blanc cassé #FAFAF9, sidebar anthracite #292524, accents bleu MELEC #2563EB
 * Typo: Outfit (titres) + Inter (corps)
 */
import { useRef, useState, useEffect } from "react";
import { useEvaluation } from "@/hooks/useEvaluation";
import { COMPETENCES } from "@/lib/competences";
import {
  lireElevesDepuisExcel,
  exporterResultatsExcel,
  chargerEtMettreAJourExcel,
} from "@/lib/excelUtils";
import type { LigneResultat } from "@/lib/excelUtils";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  ChevronDown,
  Check,
  RotateCcw,
  Download,
  Zap,
  User,
  Wrench,
  Calendar,
  BookOpen,
  History,
  X,
  Info,
} from "lucide-react";
import TableauCompetence from "@/components/TableauCompetence";
import RecapitulatifNote from "@/components/RecapitulatifNote";

const STORAGE_KEY = "melec_historique";

interface EntreeHistorique extends LigneResultat {
  id: string;
}

export default function Home() {
  const {
    state,
    setEleves,
    setEleveSelectionne,
    setEquipement,
    setDate,
    toggleCompetence,
    setNote,
    resetAll,
    noteSur20,
    totalObtenu,
    totalMax,
    competencesActives,
    notesParCompetence,
  } = useEvaluation();

  const fileInputElevesRef = useRef<HTMLInputElement>(null);
  const fileInputResultatsRef = useRef<HTMLInputElement>(null);
  const [isEleveDropdownOpen, setIsEleveDropdownOpen] = useState(false);
  const [fichierResultatsExistant, setFichierResultatsExistant] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistorique, setShowHistorique] = useState(false);
  const [historique, setHistorique] = useState<EntreeHistorique[]>([]);
  const [showInfo, setShowInfo] = useState(false);

  // Charger l'historique depuis localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setHistorique(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const sauvegarderHistorique = (entries: EntreeHistorique[]) => {
    setHistorique(entries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  };

  // Import du fichier élèves
  const handleImportEleves = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const eleves = await lireElevesDepuisExcel(file);
      if (eleves.length === 0) {
        toast.error(
          "Aucun élève trouvé dans le fichier. Vérifiez le format (colonnes Nom, Prénom)."
        );
        return;
      }
      setEleves(eleves);
      toast.success(`${eleves.length} élève(s) chargé(s) avec succès.`);
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    }
    e.target.value = "";
  };

  // Sélection d'un fichier de résultats existant
  const handleSelectFichierResultats = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFichierResultatsExistant(file);
      toast.success(`Fichier de résultats chargé : ${file.name}`);
    }
    e.target.value = "";
  };

  // Construction de la ligne de résultat
  const construireLigneResultat = (): LigneResultat | null => {
    if (!state.eleveSelectionne) return null;
    const notesParComp: Record<string, number | null> = {};
    for (const comp of competencesActives) {
      const found = notesParCompetence.find((n) => n.comp.code === comp.code);
      notesParComp[comp.code] = found ? found.obtenu : null;
    }
    return {
      date: state.date,
      nom: state.eleveSelectionne.nom,
      prenom: state.eleveSelectionne.prenom,
      classe: state.eleveSelectionne.classe,
      equipement: state.equipement,
      notesParCompetence: notesParComp,
      noteSur20,
      notes: { ...state.notes },
    };
  };

  // Enregistrer et exporter
  const handleExport = async () => {
    if (!state.eleveSelectionne) {
      toast.error("Veuillez sélectionner un élève avant d'exporter.");
      return;
    }
    if (competencesActives.length === 0) {
      toast.error("Veuillez sélectionner au moins une compétence.");
      return;
    }

    const ligne = construireLigneResultat();
    if (!ligne) return;

    setIsSaving(true);
    try {
      // Sauvegarder dans l'historique local
      const nouvelleEntree: EntreeHistorique = {
        ...ligne,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
      const nouvelHistorique = [nouvelleEntree, ...historique];
      sauvegarderHistorique(nouvelHistorique);

      if (fichierResultatsExistant) {
        await chargerEtMettreAJourExcel(fichierResultatsExistant, ligne);
        toast.success("Note ajoutée au fichier de résultats existant et téléchargée.");
      } else {
        exporterResultatsExcel([ligne]);
        toast.success("Fichier Excel exporté avec succès.");
      }
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setIsSaving(false);
    }
  };

  // Exporter tout l'historique
  const handleExportHistorique = () => {
    if (historique.length === 0) {
      toast.error("Aucune évaluation dans l'historique.");
      return;
    }
    exporterResultatsExcel(historique, "historique_evaluations_melec.xlsx");
    toast.success(`${historique.length} évaluation(s) exportée(s).`);
  };

  // Supprimer une entrée de l'historique
  const supprimerEntree = (id: string) => {
    const updated = historique.filter((e) => e.id !== id);
    sauvegarderHistorique(updated);
    toast.success("Évaluation supprimée de l'historique.");
  };

  const eleveLabel = state.eleveSelectionne
    ? `${state.eleveSelectionne.nom} ${state.eleveSelectionne.prenom}`
    : "Sélectionner un élève";

  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: "'Inter', sans-serif", background: "#FAFAF9" }}
    >
      {/* ===== SIDEBAR GAUCHE ===== */}
      <aside
        className="w-80 flex-shrink-0 flex flex-col"
        style={{ background: "#292524", color: "#F5F5F4", minHeight: "100vh" }}
      >
        {/* Logo / Titre */}
        <div className="px-6 py-5 border-b border-stone-700">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#2563EB" }}
            >
              <Zap size={16} color="white" />
            </div>
            <span
              className="font-bold text-lg tracking-tight"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              MELEC Éval
            </span>
          </div>
          <p className="text-xs text-stone-400 ml-11">Grille d'évaluation professionnelle</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* === Import élèves === */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-2">
              <User size={12} /> Élèves
            </h3>
            <button
              onClick={() => fileInputElevesRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: state.eleves.length > 0 ? "#1c4a1a" : "#3C3836",
                color: state.eleves.length > 0 ? "#86efac" : "#D6D3D1",
                border: "1px solid",
                borderColor: state.eleves.length > 0 ? "#166534" : "#57534E",
              }}
            >
              <Upload size={14} />
              {state.eleves.length > 0
                ? `${state.eleves.length} élève(s) chargé(s)`
                : "Importer liste Excel"}
            </button>
            <input
              ref={fileInputElevesRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportEleves}
            />

            {/* Sélecteur élève */}
            {state.eleves.length > 0 && (
              <div className="relative mt-3">
                <button
                  onClick={() => setIsEleveDropdownOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all"
                  style={{
                    background: state.eleveSelectionne ? "#1e3a5f" : "#3C3836",
                    color: state.eleveSelectionne ? "#93C5FD" : "#D6D3D1",
                    border: "1px solid",
                    borderColor: state.eleveSelectionne ? "#1d4ed8" : "#57534E",
                  }}
                >
                  <span className="truncate font-medium">{eleveLabel}</span>
                  <ChevronDown
                    size={14}
                    style={{
                      transform: isEleveDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}
                  />
                </button>
                {isEleveDropdownOpen && (
                  <div
                    className="absolute z-50 w-full mt-1 rounded-lg shadow-xl overflow-hidden"
                    style={{
                      background: "#1C1917",
                      border: "1px solid #44403C",
                      maxHeight: "220px",
                      overflowY: "auto",
                    }}
                  >
                    {state.eleves.map((eleve, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setEleveSelectionne(eleve);
                          setIsEleveDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-stone-700 transition-colors flex items-center justify-between"
                        style={{ color: "#D6D3D1" }}
                      >
                        <span>
                          <span className="font-semibold">{eleve.nom}</span>{" "}
                          <span>{eleve.prenom}</span>
                          {eleve.classe && (
                            <span className="ml-2 text-xs text-stone-500">({eleve.classe})</span>
                          )}
                        </span>
                        {state.eleveSelectionne?.nom === eleve.nom &&
                          state.eleveSelectionne?.prenom === eleve.prenom && (
                            <Check size={12} color="#60A5FA" />
                          )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Saisie manuelle si pas de fichier */}
            {state.eleves.length === 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-stone-500 text-center">ou saisir manuellement :</p>
                <ManualEleveInput onAdd={(eleve) => setEleves([eleve])} />
              </div>
            )}
          </section>

          {/* === Équipement === */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-2">
              <Wrench size={12} /> Équipement / Support
            </h3>
            <input
              type="text"
              value={state.equipement}
              onChange={(e) => setEquipement(e.target.value)}
              placeholder="Ex : Coffret électrique n°3"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{
                background: "#3C3836",
                color: "#F5F5F4",
                border: "1px solid #57534E",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
              onBlur={(e) => (e.target.style.borderColor = "#57534E")}
            />
          </section>

          {/* === Date === */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-2">
              <Calendar size={12} /> Date d'évaluation
            </h3>
            <input
              type="date"
              value={state.date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{
                background: "#3C3836",
                color: "#F5F5F4",
                border: "1px solid #57534E",
                colorScheme: "dark",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
              onBlur={(e) => (e.target.style.borderColor = "#57534E")}
            />
          </section>

          {/* === Sélection des compétences === */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-2">
              <BookOpen size={12} /> Compétences à évaluer
            </h3>
            <div className="space-y-1.5">
              {COMPETENCES.map((comp) => {
                const selected = state.competencesSelectionnees.includes(comp.code);
                return (
                  <button
                    key={comp.id}
                    onClick={() => toggleCompetence(comp.code)}
                    className="w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-xs"
                    style={{
                      background: selected ? `${comp.couleur}22` : "#3C3836",
                      border: `1px solid ${selected ? comp.couleur : "#57534E"}`,
                      color: selected ? "#F5F5F4" : "#A8A29E",
                    }}
                  >
                    <div
                      className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5"
                      style={{
                        background: selected ? comp.couleur : "#57534E",
                      }}
                    >
                      {selected ? (
                        <Check size={10} color="white" />
                      ) : (
                        <span className="text-[9px] font-bold text-stone-300">{comp.code}</span>
                      )}
                    </div>
                    <span className="leading-tight">
                      <span
                        className="font-semibold"
                        style={{ color: selected ? comp.couleur : "#78716C" }}
                      >
                        {comp.code}
                      </span>{" "}
                      —{" "}
                      {comp.libelle.length > 45
                        ? comp.libelle.slice(0, 45) + "…"
                        : comp.libelle}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Actions bas de sidebar */}
        <div className="px-5 py-4 border-t border-stone-700 space-y-2">
          <button
            onClick={() => setShowHistorique(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: "#3C3836", color: "#A8A29E", border: "1px solid #57534E" }}
          >
            <History size={13} />
            Historique ({historique.length})
          </button>
          <button
            onClick={resetAll}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: "#3C3836", color: "#A8A29E", border: "1px solid #57534E" }}
          >
            <RotateCcw size={13} /> Réinitialiser
          </button>
        </div>
      </aside>

      {/* ===== ZONE PRINCIPALE ===== */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ background: "white", borderColor: "#E7E5E4" }}
        >
          <div>
            <h1
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}
            >
              Grille d'Évaluation
              {state.eleveSelectionne && (
                <span style={{ color: "#2563EB" }}>
                  {" "}
                  — {state.eleveSelectionne.nom} {state.eleveSelectionne.prenom}
                  {state.eleveSelectionne.classe && (
                    <span className="text-sm font-normal text-stone-400 ml-2">
                      ({state.eleveSelectionne.classe})
                    </span>
                  )}
                </span>
              )}
            </h1>
            <p className="text-xs text-stone-400 mt-0.5">
              {competencesActives.length === 0
                ? "Sélectionnez des compétences dans le panneau gauche pour commencer"
                : `${competencesActives.length} compétence(s) · ${state.equipement || "Équipement non renseigné"} · ${state.date}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Info */}
            <button
              onClick={() => setShowInfo(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ background: "#F5F5F4", color: "#78716C" }}
              title="Aide"
            >
              <Info size={15} />
            </button>

            {/* Charger fichier résultats existant */}
            <button
              onClick={() => fileInputResultatsRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: fichierResultatsExistant ? "#f0fdf4" : "#F5F5F4",
                color: fichierResultatsExistant ? "#166534" : "#57534E",
                border: `1px solid ${fichierResultatsExistant ? "#86efac" : "#D6D3D1"}`,
              }}
              title="Charger un fichier de résultats existant pour y ajouter la note"
            >
              <FileSpreadsheet size={14} />
              {fichierResultatsExistant
                ? fichierResultatsExistant.name.slice(0, 18) + "…"
                : "Fichier résultats"}
            </button>
            <input
              ref={fileInputResultatsRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleSelectFichierResultats}
            />

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={
                isSaving || !state.eleveSelectionne || competencesActives.length === 0
              }
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: "#2563EB", color: "white" }}
            >
              <Download size={14} />
              {isSaving ? "Export…" : "Enregistrer & Exporter"}
            </button>
          </div>
        </header>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {competencesActives.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-24 rounded-2xl"
              style={{ background: "white", border: "2px dashed #E7E5E4" }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "#EFF6FF" }}
              >
                <BookOpen size={28} color="#2563EB" />
              </div>
              <h2
                className="text-lg font-semibold mb-2"
                style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}
              >
                Aucune compétence sélectionnée
              </h2>
              <p className="text-sm text-stone-400 text-center max-w-sm">
                Cochez les compétences à évaluer dans le panneau de gauche. Les tableaux de
                saisie apparaîtront ici automatiquement.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-2 max-w-md">
                {COMPETENCES.slice(0, 6).map((comp) => (
                  <div
                    key={comp.id}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs"
                    style={{ background: `${comp.couleur}10`, color: comp.couleur }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: comp.couleur }}
                    />
                    <span className="font-semibold">{comp.code}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Récapitulatif note en haut */}
              <RecapitulatifNote
                noteSur20={noteSur20}
                totalObtenu={totalObtenu}
                totalMax={totalMax}
                notesParCompetence={notesParCompetence}
              />

              {/* Tableaux par compétence */}
              {competencesActives.map((comp) => (
                <TableauCompetence
                  key={comp.id}
                  competence={comp}
                  notes={state.notes}
                  onNoteChange={setNote}
                />
              ))}

              {/* Bouton export en bas aussi */}
              <div className="flex justify-end pb-4">
                <button
                  onClick={handleExport}
                  disabled={isSaving || !state.eleveSelectionne}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 shadow-lg"
                  style={{ background: "#2563EB", color: "white" }}
                >
                  <Download size={16} />
                  {isSaving ? "Export en cours…" : "Enregistrer & Exporter Excel"}
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* ===== MODAL HISTORIQUE ===== */}
      {showHistorique && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowHistorique(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: "white", maxHeight: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: "#E7E5E4" }}
            >
              <h2
                className="text-lg font-bold"
                style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}
              >
                Historique des évaluations ({historique.length})
              </h2>
              <div className="flex items-center gap-2">
                {historique.length > 0 && (
                  <button
                    onClick={handleExportHistorique}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: "#2563EB", color: "white" }}
                  >
                    <Download size={12} /> Tout exporter
                  </button>
                )}
                <button
                  onClick={() => setShowHistorique(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ background: "#F5F5F4", color: "#78716C" }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "calc(80vh - 80px)" }}>
              {historique.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-stone-400">
                  <History size={32} className="mb-3 opacity-30" />
                  <p className="text-sm">Aucune évaluation enregistrée.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#FAFAF9", borderBottom: "1px solid #E7E5E4" }}>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Élève</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Équipement</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Compétences</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Note /20</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {historique.map((entry) => (
                      <tr
                        key={entry.id}
                        style={{ borderBottom: "1px solid #F5F5F4" }}
                        className="hover:bg-stone-50"
                      >
                        <td className="px-4 py-3 text-stone-600">{entry.date}</td>
                        <td className="px-4 py-3 font-semibold text-stone-800">
                          {entry.nom} {entry.prenom}
                          {entry.classe && (
                            <span className="ml-1 text-xs text-stone-400">({entry.classe})</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-600 max-w-[150px] truncate">
                          {entry.equipement || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {Object.keys(entry.notesParCompetence).map((code) => {
                              const comp = COMPETENCES.find((c) => c.code === code);
                              return comp ? (
                                <span
                                  key={code}
                                  className="px-1.5 py-0.5 rounded text-xs font-bold"
                                  style={{ background: `${comp.couleur}15`, color: comp.couleur }}
                                >
                                  {code}
                                </span>
                              ) : null;
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className="font-bold text-base tabular-nums"
                            style={{
                              color:
                                entry.noteSur20 !== null && entry.noteSur20 >= 10
                                  ? "#2563EB"
                                  : "#dc2626",
                            }}
                          >
                            {entry.noteSur20 !== null ? entry.noteSur20.toFixed(2) : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => supprimerEntree(entry.id)}
                            className="w-6 h-6 flex items-center justify-center rounded opacity-40 hover:opacity-100 transition-opacity"
                            style={{ color: "#dc2626" }}
                          >
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL INFO ===== */}
      {showInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowInfo(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl shadow-2xl p-6"
            style={{ background: "white" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-lg font-bold"
                style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}
              >
                Guide d'utilisation
              </h2>
              <button
                onClick={() => setShowInfo(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg"
                style={{ background: "#F5F5F4", color: "#78716C" }}
              >
                <X size={15} />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-stone-700">
              {[
                { n: 1, t: "Importer la liste des élèves", d: "Cliquez sur « Importer liste Excel » et sélectionnez votre fichier. Le fichier doit avoir des colonnes Nom et Prénom (ou Prénom en 2e colonne)." },
                { n: 2, t: "Sélectionner l'élève", d: "Choisissez l'élève dans la liste déroulante." },
                { n: 3, t: "Renseigner l'équipement et la date", d: "Indiquez le nom du support/équipement évalué et la date." },
                { n: 4, t: "Choisir les compétences", d: "Cochez les compétences C1 à C13 à évaluer. Seules les compétences sélectionnées apparaissent." },
                { n: 5, t: "Saisir les notes", d: "Dans chaque tableau, entrez la note obtenue pour chaque critère. La note sur 20 est calculée automatiquement." },
                { n: 6, t: "Exporter", d: "Cliquez sur « Enregistrer & Exporter Excel ». Pour ajouter à un fichier existant, chargez-le d'abord via « Fichier résultats »." },
              ].map((step) => (
                <li key={step.n} className="flex gap-3">
                  <span
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: "#2563EB" }}
                  >
                    {step.n}
                  </span>
                  <div>
                    <p className="font-semibold text-stone-800">{step.t}</p>
                    <p className="text-stone-500 text-xs mt-0.5">{step.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

// Composant de saisie manuelle d'un élève
function ManualEleveInput({ onAdd }: { onAdd: (e: { nom: string; prenom: string; classe?: string }) => void }) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [classe, setClasse] = useState("");

  const handleAdd = () => {
    if (!nom.trim() && !prenom.trim()) return;
    onAdd({
      nom: nom.trim().toUpperCase(),
      prenom: prenom.trim(),
      classe: classe.trim() || undefined,
    });
    setNom("");
    setPrenom("");
    setClasse("");
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        placeholder="Nom"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: "#3C3836", color: "#F5F5F4", border: "1px solid #57534E" }}
      />
      <input
        type="text"
        value={prenom}
        onChange={(e) => setPrenom(e.target.value)}
        placeholder="Prénom"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: "#3C3836", color: "#F5F5F4", border: "1px solid #57534E" }}
      />
      <input
        type="text"
        value={classe}
        onChange={(e) => setClasse(e.target.value)}
        placeholder="Classe (optionnel)"
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{ background: "#3C3836", color: "#F5F5F4", border: "1px solid #57534E" }}
      />
      <button
        onClick={handleAdd}
        disabled={!nom.trim() && !prenom.trim()}
        className="w-full px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
        style={{ background: "#2563EB", color: "white" }}
      >
        Ajouter l'élève
      </button>
    </div>
  );
}
