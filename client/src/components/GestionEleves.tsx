/**
 * Composant GestionEleves — Modal de gestion des élèves
 * Permet d'ajouter/supprimer des élèves, des classes, et d'importer en masse via CSV
 * Design: Dashboard Technique Compact
 */
import { useState, useRef } from "react";
import { X, Plus, Trash2, UserPlus, Users, ChevronDown, ChevronRight, AlertTriangle, Upload, FileText } from "lucide-react";
import type { FichierGrille } from "@/lib/excelUtils";
import {
  ajouterEleve,
  supprimerEleve,
  ajouterClasse,
  supprimerClasse,
} from "@/lib/excelUtils";
import * as XLSX from "xlsx";

interface Props {
  fichierGrille: FichierGrille;
  fichierNom: string;
  onClose: () => void;
  onGrilleChange: (grille: FichierGrille) => void;
  onSyncDrive?: (blob: Blob) => Promise<void>;
  driveConnecte?: boolean;
}

export default function GestionEleves({
  fichierGrille,
  fichierNom,
  onClose,
  onGrilleChange,
  onSyncDrive,
  driveConnecte = false,
}: Props) {
  // Formulaire ajout élève
  const [nomNouvel, setNomNouvel] = useState("");
  const [prenomNouvel, setPrenomNouvel] = useState("");
  const [classeNouvel, setClasseNouvel] = useState(fichierGrille.classes[0]?.nom || "");

  // Formulaire ajout classe
  const [nomNouvelleClasse, setNomNouvelleClasse] = useState("");
  const [showAjoutClasse, setShowAjoutClasse] = useState(false);

  // Import CSV
  const [showImportCSV, setShowImportCSV] = useState(false);
  const [classeImport, setClasseImport] = useState(fichierGrille.classes[0]?.nom || "");
  const [csvPreview, setCsvPreview] = useState<Array<{ nom: string; prenom: string; valide: boolean; erreur?: string }>>([]);
  const [csvTexte, setCsvTexte] = useState("");
  const [syncAuto, setSyncAuto] = useState(true); // sync automatique après import
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputCsvRef = useRef<HTMLInputElement>(null);

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

  /** Parse le texte CSV/coller et génère un aperçu */
  const parserCSV = (texte: string) => {
    const lignes = texte.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const eleves: Array<{ nom: string; prenom: string; valide: boolean; erreur?: string }> = [];

    for (const ligne of lignes) {
      // Ignorer les lignes d'en-tête
      if (/^nom|^prénom|^name|^firstname/i.test(ligne)) continue;

      // Séparateurs : virgule, point-virgule, tabulation
      const parts = ligne.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));

      let nom = "";
      let prenom = "";

      if (parts.length >= 2) {
        nom = parts[0].toUpperCase();
        prenom = parts[1];
      } else if (parts.length === 1 && parts[0].includes(" ")) {
        // Format "NOM Prénom" en une seule colonne
        const mots = parts[0].split(" ");
        nom = mots[0].toUpperCase();
        prenom = mots.slice(1).join(" ");
      } else {
        nom = parts[0].toUpperCase();
      }

      if (!nom) continue;

      // Vérifier si déjà présent dans la classe
      const existe = fichierGrille.classes
        .find((c) => c.nom === classeImport)
        ?.eleves.some((e) => e.nom === nom && e.prenom.toLowerCase() === prenom.toLowerCase());

      eleves.push({
        nom,
        prenom,
        valide: !existe,
        erreur: existe ? "Déjà dans la classe" : undefined,
      });
    }

    setCsvPreview(eleves);
  };

  const handleCsvTexteChange = (texte: string) => {
    setCsvTexte(texte);
    parserCSV(texte);
  };

  /** Lecture d'un fichier CSV/Excel uploadé */
  const handleFichierCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      // Détecter si c'est un fichier Excel
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        try {
          const wb = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as string[][];
          const csv = rows.map((r) => r.slice(0, 2).join(";")).join("\n");
          setCsvTexte(csv);
          parserCSV(csv);
        } catch {
          showMsg("Impossible de lire le fichier Excel.", "error");
        }
      } else {
        setCsvTexte(text);
        parserCSV(text);
      }
    };
    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, "UTF-8");
    }
    e.target.value = "";
  };

  /** Importer tous les élèves valides et synchroniser si demandé */
  const handleImporterCSV = async () => {
    const valides = csvPreview.filter((e) => e.valide);
    if (valides.length === 0) {
      showMsg("Aucun élève valide à importer.", "error");
      return;
    }

    let wb = fichierGrille.rawWorkbook;
    let nbAjoutes = 0;

    for (const eleve of valides) {
      const result = ajouterEleve(wb, eleve.nom, eleve.prenom, classeImport);
      if (result.succes) {
        wb = result.wb;
        nbAjoutes++;
      }
    }

    appliquerChangement(wb);
    setCsvPreview([]);
    setCsvTexte("");
    setShowImportCSV(false);
    setClasseOuverte(classeImport);

    // Synchronisation automatique si activée
    if (syncAuto) {
      setIsSyncing(true);
      try {
        // Générer le blob du fichier mis à jour
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([wbout], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        if (driveConnecte && onSyncDrive) {
          // Synchroniser avec Google Drive
          await onSyncDrive(blob);
          showMsg(`✓ ${nbAjoutes} élève(s) importé(s) et synchronisés sur Google Drive.`, "success");
        } else {
          // Télécharger localement
          const { saveAs } = await import("file-saver");
          saveAs(blob, fichierNom);
          showMsg(`✓ ${nbAjoutes} élève(s) importé(s). Fichier téléchargé.`, "success");
        }
      } catch (err) {
        showMsg(`Import réussi mais erreur de synchronisation : ${String(err instanceof Error ? err.message : err)}`, "error");
      } finally {
        setIsSyncing(false);
      }
    } else {
      showMsg(`✓ ${nbAjoutes} élève(s) importé(s) dans la classe ${classeImport}.`, "success");
    }
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

          {/* ── Section import CSV ── */}
          <div className="px-6 py-4 border-b" style={{ borderColor: "#F5F5F4" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 flex items-center gap-2">
                <Upload size={12} /> Import en masse (CSV / Excel)
              </h3>
              <button
                onClick={() => { setShowImportCSV(!showImportCSV); setCsvPreview([]); setCsvTexte(""); }}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all"
                style={{ background: showImportCSV ? "#EFF6FF" : "#F5F5F4", color: showImportCSV ? "#2563EB" : "#57534E" }}
              >
                {showImportCSV ? "Fermer" : "Ouvrir"}
              </button>
            </div>

            {showImportCSV && (
              <div className="space-y-3">
                {/* Sélecteur de classe cible */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500 font-semibold">Classe cible :</span>
                  <select
                    value={classeImport}
                    onChange={(e) => { setClasseImport(e.target.value); if (csvTexte) parserCSV(csvTexte); }}
                    className="px-3 py-1.5 rounded-lg text-sm outline-none"
                    style={{ background: "white", border: "1.5px solid #E7E5E4", color: "#1C1917" }}
                  >
                    {fichierGrille.classes.map((c) => (
                      <option key={c.nom} value={c.nom}>{c.nom}</option>
                    ))}
                  </select>
                </div>

                {/* Zone de saisie / glisser-déposer */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileInputCsvRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}
                    >
                      <FileText size={12} /> Charger un fichier CSV / Excel
                    </button>
                    <span className="text-xs text-stone-400">ou coller directement ci-dessous</span>
                  </div>
                  <input
                    ref={fileInputCsvRef}
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFichierCSV}
                  />
                  <textarea
                    value={csvTexte}
                    onChange={(e) => handleCsvTexteChange(e.target.value)}
                    placeholder={`Coller votre liste ici :\nNOM;Prénom\nDUPONT;Jean\nMARTIN;Alice\n\nFormats acceptés : CSV (virgule, point-virgule, tabulation), ou \"NOM Prénom\" par ligne`}
                    rows={5}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none font-mono"
                    style={{ background: "#FAFAF9", border: "1.5px solid #E7E5E4", color: "#1C1917", lineHeight: "1.6" }}
                    onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
                    onBlur={(e) => (e.target.style.borderColor = "#E7E5E4")}
                  />
                </div>

                {/* Aperçu des élèves détectés */}
                {csvPreview.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E7E5E4" }}>
                    <div className="flex items-center justify-between px-3 py-2" style={{ background: "#F8FAFC", borderBottom: "1px solid #E7E5E4" }}>
                      <span className="text-xs font-semibold text-stone-500">
                        {csvPreview.filter((e) => e.valide).length} élève(s) à importer
                        {csvPreview.filter((e) => !e.valide).length > 0 && (
                          <span className="ml-2 text-orange-500">
                            · {csvPreview.filter((e) => !e.valide).length} ignoré(s)
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-stone-400">Aperçu</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {csvPreview.map((eleve, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-3 py-1.5 text-sm"
                          style={{
                            background: eleve.valide ? (i % 2 === 0 ? "white" : "#FAFAF9") : "#FEF9EC",
                            borderBottom: "1px solid #F5F5F4",
                            opacity: eleve.valide ? 1 : 0.6,
                          }}
                        >
                          <span>
                            <span className="font-semibold text-stone-800">{eleve.nom}</span>{" "}
                            <span className="text-stone-600">{eleve.prenom}</span>
                          </span>
                          {eleve.valide ? (
                            <span className="text-xs text-green-600 font-semibold">✓ À importer</span>
                          ) : (
                            <span className="text-xs text-orange-500">⚠ {eleve.erreur}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Option synchronisation automatique */}
                {csvPreview.filter((e) => e.valide).length > 0 && (
                  <div className="space-y-2">
                    {/* Toggle sync auto */}
                    <div
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                      style={{ background: syncAuto ? (driveConnecte ? "#f0fdf4" : "#EFF6FF") : "#FAFAF9", border: `1px solid ${syncAuto ? (driveConnecte ? "#86efac" : "#BFDBFE") : "#E7E5E4"}` }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{driveConnecte ? "☁️" : "💾"}</span>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: syncAuto ? (driveConnecte ? "#166534" : "#1d4ed8") : "#57534E" }}>
                            {driveConnecte
                              ? "Synchroniser sur Google Drive après import"
                              : "Télécharger le fichier Excel après import"}
                          </p>
                          <p className="text-xs" style={{ color: driveConnecte ? "#16a34a" : "#2563EB", opacity: 0.75 }}>
                            {driveConnecte
                              ? "Le fichier sera mis à jour sur votre Drive"
                              : "Le fichier mis à jour sera téléchargé localement"}
                          </p>
                        </div>
                      </div>
                      {/* Toggle switch */}
                      <button
                        onClick={() => setSyncAuto(!syncAuto)}
                        className="relative flex-shrink-0 w-10 h-5 rounded-full transition-all"
                        style={{ background: syncAuto ? (driveConnecte ? "#16a34a" : "#2563EB") : "#D1D5DB" }}
                      >
                        <div
                          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                          style={{ left: syncAuto ? "calc(100% - 18px)" : "2px" }}
                        />
                      </button>
                    </div>

                    {/* Bouton importer */}
                    <button
                      onClick={handleImporterCSV}
                      disabled={isSyncing}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
                      style={{ background: "#2563EB", color: "white" }}
                    >
                      {isSyncing ? (
                        <>
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
                          </svg>
                          Synchronisation en cours…
                        </>
                      ) : (
                        <>
                          <Upload size={14} />
                          Importer {csvPreview.filter((e) => e.valide).length} élève(s)
                          {syncAuto && (
                            <span className="text-xs opacity-80 ml-1">
                              + {driveConnecte ? "sync Drive" : "télécharger"}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
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
