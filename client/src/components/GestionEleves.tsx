/**
 * Composant GestionEleves — Modal de gestion des élèves
 * Permet d'ajouter/supprimer des élèves et des classes
 * Design: Dashboard Technique Compact
 */
import { useState } from "react";
import { X, Plus, Trash2, UserPlus, Users, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import type { FichierGrille } from "@/lib/excelUtils";
import {
  ajouterEleve,
  supprimerEleve,
  ajouterClasse,
  supprimerClasse,
  lireFichierGrille,
} from "@/lib/excelUtils";
import * as XLSX from "xlsx";

interface Props {
  fichierGrille: FichierGrille;
  onClose: () => void;
  onGrilleChange: (grille: FichierGrille) => void;
}

export default function GestionEleves({ fichierGrille, onClose, onGrilleChange }: Props) {
  // Formulaire ajout élève
  const [nomNouvel, setNomNouvel] = useState("");
  const [prenomNouvel, setPrenomNouvel] = useState("");
  const [classeNouvel, setClasseNouvel] = useState(fichierGrille.classes[0]?.nom || "");

  // Formulaire ajout classe
  const [nomNouvelleClasse, setNomNouvelleClasse] = useState("");
  const [showAjoutClasse, setShowAjoutClasse] = useState(false);

  // UI
  const [classeOuverte, setClasseOuverte] = useState<string>(fichierGrille.classes[0]?.nom || "");
  const [confirmSupprEleve, setConfirmSupprEleve] = useState<{ nom: string; prenom: string; classe: string } | null>(null);
  const [confirmSupprClasse, setConfirmSupprClasse] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showMsg = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  /** Met à jour le workbook et reconstruit la grille */
  const appliquerChangement = async (wb: XLSX.WorkBook) => {
    // Reconstruire la FichierGrille depuis le workbook mis à jour
    // Conserver toutes les classes, même vides
    const classes = wb.SheetNames
      .filter((name) => !name.includes(" ") || /^(TP|1P|2P|BTS|CAP|BAC|Term)/i.test(name))
      .map((sheetName) => {
        const ws = wb.Sheets[sheetName];
        if (!ws) return null;
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as (string | null)[][];
        const eleves = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || (!row[0] && !row[1])) continue;
          const nom = String(row[0] || "").trim().toUpperCase();
          const prenom = String(row[1] || "").trim();
          if (nom) eleves.push({ nom, prenom, classe: sheetName, colIndex: i - 1 });
        }
        return { nom: sheetName, eleves }; // conserver même si vide
      })
      .filter(Boolean) as FichierGrille["classes"];

    const nouvelleGrille: FichierGrille = { classes, rawWorkbook: wb };
    onGrilleChange(nouvelleGrille);
  };

  const handleAjouterEleve = () => {
    if (!nomNouvel.trim()) { showMsg("Le nom est obligatoire.", "error"); return; }
    if (!classeNouvel) { showMsg("Sélectionnez une classe.", "error"); return; }

    const { wb, succes, message: msg } = ajouterEleve(
      fichierGrille.rawWorkbook,
      nomNouvel,
      prenomNouvel,
      classeNouvel
    );

    if (!succes) { showMsg(msg, "error"); return; }

    appliquerChangement(wb);
    showMsg(msg, "success");
    setNomNouvel("");
    setPrenomNouvel("");
    setClasseOuverte(classeNouvel);
  };

  const handleSupprimerEleve = (nom: string, prenom: string, classe: string) => {
    const { wb, succes, message: msg } = supprimerEleve(
      fichierGrille.rawWorkbook,
      nom,
      prenom,
      classe
    );
    setConfirmSupprEleve(null);
    if (!succes) { showMsg(msg, "error"); return; }
    appliquerChangement(wb);
    showMsg(msg, "success");
  };

  const handleAjouterClasse = () => {
    if (!nomNouvelleClasse.trim()) { showMsg("Le nom de la classe est obligatoire.", "error"); return; }

    const { wb, succes, message: msg } = ajouterClasse(
      fichierGrille.rawWorkbook,
      nomNouvelleClasse
    );

    if (!succes) { showMsg(msg, "error"); return; }

    appliquerChangement(wb);
    showMsg(msg, "success");
    setNomNouvelleClasse("");
    setShowAjoutClasse(false);
    setClasseOuverte(nomNouvelleClasse.trim());
    setClasseNouvel(nomNouvelleClasse.trim());
  };

  const handleSupprimerClasse = (nom: string) => {
    const { wb, succes, message: msg } = supprimerClasse(
      fichierGrille.rawWorkbook,
      nom
    );
    setConfirmSupprClasse(null);
    if (!succes) { showMsg(msg, "error"); return; }
    appliquerChangement(wb);
    showMsg(msg, "success");
  };

  const totalEleves = fichierGrille.classes.reduce((s, c) => s + c.eleves.length, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "white", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#E7E5E4" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#2563EB" }}>
              <Users size={16} color="white" />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
                Gestion des élèves
              </h2>
              <p className="text-xs text-stone-400">
                {fichierGrille.classes.length} classe(s) · {totalEleves} élève(s)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: "#F5F5F4", color: "#78716C" }}>
            <X size={15} />
          </button>
        </div>

        {/* Message flash */}
        {message && (
          <div
            className="mx-6 mt-3 px-3 py-2 rounded-lg text-sm font-medium"
            style={{
              background: message.type === "success" ? "#f0fdf4" : "#FEF2F2",
              color: message.type === "success" ? "#166534" : "#DC2626",
              border: `1px solid ${message.type === "success" ? "#86efac" : "#FECACA"}`,
            }}
          >
            {message.text}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* ── Formulaire ajout élève ── */}
          <div className="px-6 py-4 border-b" style={{ borderColor: "#F5F5F4", background: "#FAFAF9" }}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-2">
              <UserPlus size={12} /> Ajouter un élève
            </h3>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={nomNouvel}
                onChange={(e) => setNomNouvel(e.target.value.toUpperCase())}
                placeholder="NOM *"
                className="flex-1 min-w-[120px] px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "white", border: "1.5px solid #E7E5E4", color: "#1C1917" }}
                onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
                onBlur={(e) => (e.target.style.borderColor = "#E7E5E4")}
                onKeyDown={(e) => e.key === "Enter" && handleAjouterEleve()}
              />
              <input
                type="text"
                value={prenomNouvel}
                onChange={(e) => setPrenomNouvel(e.target.value)}
                placeholder="Prénom"
                className="flex-1 min-w-[120px] px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "white", border: "1.5px solid #E7E5E4", color: "#1C1917" }}
                onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
                onBlur={(e) => (e.target.style.borderColor = "#E7E5E4")}
                onKeyDown={(e) => e.key === "Enter" && handleAjouterEleve()}
              />
              <select
                value={classeNouvel}
                onChange={(e) => setClasseNouvel(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "white", border: "1.5px solid #E7E5E4", color: "#1C1917", minWidth: "100px" }}
              >
                {fichierGrille.classes.map((c) => (
                  <option key={c.nom} value={c.nom}>{c.nom}</option>
                ))}
              </select>
              <button
                onClick={handleAjouterEleve}
                disabled={!nomNouvel.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 transition-all"
                style={{ background: "#2563EB", color: "white" }}
              >
                <Plus size={14} /> Ajouter
              </button>
            </div>
          </div>

          {/* ── Liste des classes et élèves ── */}
          <div className="px-6 py-4 space-y-3">
            {fichierGrille.classes.map((classe) => (
              <div key={classe.nom} className="rounded-xl overflow-hidden" style={{ border: "1px solid #E7E5E4" }}>
                {/* En-tête classe */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
                  style={{ background: classeOuverte === classe.nom ? "#EFF6FF" : "#FAFAF9" }}
                  onClick={() => setClasseOuverte(classeOuverte === classe.nom ? "" : classe.nom)}
                >
                  <div className="flex items-center gap-2">
                    {classeOuverte === classe.nom
                      ? <ChevronDown size={14} color="#2563EB" />
                      : <ChevronRight size={14} color="#A8A29E" />}
                    <span
                      className="font-bold text-sm"
                      style={{ color: classeOuverte === classe.nom ? "#2563EB" : "#1C1917" }}
                    >
                      {classe.nom}
                    </span>
                    <span className="text-xs text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                      {classe.eleves.length} élève(s)
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmSupprClasse(classe.nom); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all opacity-0 group-hover:opacity-100"
                    style={{ color: "#dc2626", background: "#FEF2F2", border: "1px solid #FECACA" }}
                    title={`Supprimer la classe ${classe.nom}`}
                  >
                    <Trash2 size={11} /> Supprimer la classe
                  </button>
                </div>

                {/* Liste des élèves */}
                {classeOuverte === classe.nom && (
                  <div>
                    {classe.eleves.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-stone-400 italic">Aucun élève dans cette classe.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: "#F8FAFC", borderTop: "1px solid #E7E5E4" }}>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wide">Nom</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wide">Prénom</th>
                            <th className="px-4 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {classe.eleves.map((eleve, i) => (
                            <tr
                              key={i}
                              style={{
                                borderTop: "1px solid #F5F5F4",
                                background: i % 2 === 0 ? "white" : "#FAFAF9",
                              }}
                            >
                              <td className="px-4 py-2.5 font-semibold text-stone-800">{eleve.nom}</td>
                              <td className="px-4 py-2.5 text-stone-600">{eleve.prenom}</td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => setConfirmSupprEleve({ nom: eleve.nom, prenom: eleve.prenom, classe: classe.nom })}
                                  className="w-6 h-6 flex items-center justify-center rounded transition-all ml-auto"
                                  style={{ color: "#dc2626", background: "transparent" }}
                                  title="Supprimer cet élève"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Ajout d'une nouvelle classe */}
            {showAjoutClasse ? (
              <div className="flex gap-2 items-center p-3 rounded-xl" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <input
                  type="text"
                  value={nomNouvelleClasse}
                  onChange={(e) => setNomNouvelleClasse(e.target.value)}
                  placeholder="Nom de la classe (ex: TP28)"
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: "white", border: "1.5px solid #BFDBFE", color: "#1C1917" }}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleAjouterClasse(); if (e.key === "Escape") setShowAjoutClasse(false); }}
                />
                <button onClick={handleAjouterClasse} disabled={!nomNouvelleClasse.trim()}
                  className="px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                  style={{ background: "#2563EB", color: "white" }}>
                  Créer
                </button>
                <button onClick={() => setShowAjoutClasse(false)}
                  className="px-3 py-2 rounded-lg text-sm"
                  style={{ background: "#F5F5F4", color: "#78716C" }}>
                  Annuler
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAjoutClasse(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "#FAFAF9", color: "#57534E", border: "2px dashed #E7E5E4" }}
              >
                <Plus size={14} /> Ajouter une nouvelle classe
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t flex justify-end" style={{ borderColor: "#E7E5E4", background: "#FAFAF9" }}>
          <button onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "#2563EB", color: "white" }}>
            Fermer
          </button>
        </div>
      </div>

      {/* Confirmation suppression élève */}
      {confirmSupprEleve && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setConfirmSupprEleve(null)}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl p-6" style={{ background: "white" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#FEF2F2" }}>
                <AlertTriangle size={18} color="#dc2626" />
              </div>
              <div>
                <p className="font-bold text-stone-800">Supprimer cet élève ?</p>
                <p className="text-sm text-stone-500">
                  {confirmSupprEleve.nom} {confirmSupprEleve.prenom} — {confirmSupprEleve.classe}
                </p>
              </div>
            </div>
            <p className="text-xs text-stone-400 mb-4">
              Toutes les évaluations enregistrées pour cet élève seront également supprimées du fichier Excel.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmSupprEleve(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#F5F5F4", color: "#57534E" }}>
                Annuler
              </button>
              <button
                onClick={() => handleSupprimerEleve(confirmSupprEleve.nom, confirmSupprEleve.prenom, confirmSupprEleve.classe)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#dc2626", color: "white" }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression classe */}
      {confirmSupprClasse && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setConfirmSupprClasse(null)}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl p-6" style={{ background: "white" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#FEF2F2" }}>
                <AlertTriangle size={18} color="#dc2626" />
              </div>
              <div>
                <p className="font-bold text-stone-800">Supprimer la classe ?</p>
                <p className="text-sm text-stone-500">{confirmSupprClasse}</p>
              </div>
            </div>
            <p className="text-xs text-stone-400 mb-4">
              Tous les élèves et leurs évaluations seront supprimés du fichier Excel.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmSupprClasse(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#F5F5F4", color: "#57534E" }}>
                Annuler
              </button>
              <button onClick={() => handleSupprimerClasse(confirmSupprClasse)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#dc2626", color: "white" }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
