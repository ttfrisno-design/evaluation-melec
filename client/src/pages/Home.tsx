/**
 * Page principale — Grille d'Évaluation MELEC
 * Design: Dashboard Technique Compact
 * Palette: Fond blanc cassé #FAFAF9, sidebar anthracite #292524, accents bleu MELEC #2563EB
 * Typo: Outfit (titres) + Inter (corps)
 *
 * Workflow :
 * 1. Charger le fichier grilleévaluationApplication.xlsx (local ou depuis Drive)
 * 2. Sélectionner la classe (feuille) puis l'élève
 * 3. Choisir les compétences, saisir les notes
 * 4. Enregistrer → met à jour le fichier Excel + propose téléchargement + sync Drive
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { useEvaluation } from "@/hooks/useEvaluation";
import { COMPETENCES } from "@/lib/competences";
import {
  lireFichierGrille,
  ecrireNotesEleve,
  telechargerFichierGrille,
  lireNotesEleve,
  type FichierGrille,
  type EleveInfo,
} from "@/lib/excelUtils";
import {
  loadDriveState,
  saveDriveState,
  loadGoogleScript,
  uploadToDrive,
  findFileOnDrive,
  downloadFromDrive,
  type DriveState,
} from "@/lib/googleDrive";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Upload,
  ChevronDown,
  Check,
  RotateCcw,
  Download,
  Zap,
  Wrench,
  Calendar,
  BookOpen,
  X,
  Info,
  Cloud,
  CloudOff,
  History,
  Users,
  RefreshCw,
} from "lucide-react";
import TableauCompetence from "@/components/TableauCompetence";
import RecapitulatifNote from "@/components/RecapitulatifNote";

// Client ID Google OAuth2 — à renseigner par l'utilisateur dans les paramètres
const GOOGLE_CLIENT_ID_KEY = "melec_google_client_id";

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

  // Fichier grille
  const [fichierGrille, setFichierGrille] = useState<FichierGrille | null>(null);
  const [fichierNom, setFichierNom] = useState<string>("grilleévaluationApplication.xlsx");
  const [classeSelectionnee, setClasseSelectionnee] = useState<string>("");
  const [eleveSelectionneInfo, setEleveSelectionneInfo] = useState<EleveInfo | null>(null);

  // Google Drive
  const [driveState, setDriveState] = useState<DriveState>(loadDriveState());
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(
    localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || ""
  );
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);

  // UI
  const [isEleveDropdownOpen, setIsEleveDropdownOpen] = useState(false);
  const [isClasseDropdownOpen, setIsClasseDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showHistoEleve, setShowHistoEleve] = useState(false);
  const [histoEleve, setHistoEleve] = useState<ReturnType<typeof lireNotesEleve>>([]);

  const fileInputGrilleRef = useRef<HTMLInputElement>(null);

  // Charger le fichier grille
  const handleImportGrille = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const grille = await lireFichierGrille(file);
      setFichierGrille(grille);
      setFichierNom(file.name);
      // Sélectionner automatiquement la première classe
      if (grille.classes.length > 0) {
        const premiereClasse = grille.classes[0];
        setClasseSelectionnee(premiereClasse.nom);
        setEleves(premiereClasse.eleves.map((e) => ({ nom: e.nom, prenom: e.prenom, classe: e.classe })));
      }
      toast.success(`Fichier chargé : ${grille.classes.length} classe(s), ${grille.classes.reduce((s, c) => s + c.eleves.length, 0)} élève(s).`);
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    }
    e.target.value = "";
  };

  // Changer de classe
  const handleClasseChange = (classeNom: string) => {
    setClasseSelectionnee(classeNom);
    setIsClasseDropdownOpen(false);
    setEleveSelectionneInfo(null);
    setEleveSelectionne(null);
    resetAll();
    if (fichierGrille) {
      const classe = fichierGrille.classes.find((c) => c.nom === classeNom);
      if (classe) {
        setEleves(classe.eleves.map((e) => ({ nom: e.nom, prenom: e.prenom, classe: e.classe })));
      }
    }
  };

  // Sélectionner un élève
  const handleEleveChange = (eleve: EleveInfo) => {
    setEleveSelectionneInfo(eleve);
    setEleveSelectionne({ nom: eleve.nom, prenom: eleve.prenom, classe: eleve.classe });
    setIsEleveDropdownOpen(false);
    // Charger l'historique de l'élève
    if (fichierGrille) {
      const histo = lireNotesEleve(fichierGrille.rawWorkbook, eleve);
      setHistoEleve(histo);
    }
  };

  // Enregistrer les notes dans le fichier Excel
  const handleEnregistrer = async () => {
    if (!eleveSelectionneInfo) {
      toast.error("Veuillez sélectionner un élève.");
      return;
    }
    if (competencesActives.length === 0) {
      toast.error("Veuillez sélectionner au moins une compétence.");
      return;
    }
    if (!fichierGrille) {
      toast.error("Veuillez d'abord charger le fichier de grille Excel.");
      return;
    }

    setIsSaving(true);
    try {
      // Construire les notes par compétence (note sur 20 pour chaque compétence évaluée)
      const notesParComp: Record<string, number | null> = {};
      for (const comp of competencesActives) {
        const found = notesParCompetence.find((n) => n.comp.code === comp.code);
        if (found && found.max > 0) {
          // Convertir en note sur 20
          const sur20 = Math.round((found.obtenu / found.max) * 20 * 100) / 100;
          notesParComp[comp.code] = sur20;
        } else {
          notesParComp[comp.code] = null;
        }
      }

      // Mettre à jour le workbook
      const wbMaj = ecrireNotesEleve(
        fichierGrille.rawWorkbook,
        eleveSelectionneInfo,
        notesParComp,
        state.equipement,
        state.date
      );

      // Mettre à jour l'état local
      setFichierGrille({ ...fichierGrille, rawWorkbook: wbMaj });

      // Télécharger le fichier mis à jour
      const blob = telechargerFichierGrille(wbMaj, fichierNom);

      toast.success(`Notes enregistrées pour ${eleveSelectionneInfo.nom} ${eleveSelectionneInfo.prenom}. Fichier téléchargé.`);

      // Synchroniser avec Google Drive si connecté
      if (driveState.connected && driveState.accessToken) {
        await syncWithDrive(blob);
      }

      // Mettre à jour l'historique affiché
      const histo = lireNotesEleve(wbMaj, eleveSelectionneInfo);
      setHistoEleve(histo);

    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setIsSaving(false);
    }
  };

  // Synchroniser avec Google Drive
  const syncWithDrive = async (blob: Blob) => {
    if (!driveState.accessToken) return;
    setIsSyncingDrive(true);
    try {
      // Chercher le fichier existant sur Drive
      let fileId = driveState.fileId;
      if (!fileId) {
        fileId = await findFileOnDrive(driveState.accessToken, fichierNom);
      }
      const newFileId = await uploadToDrive(driveState.accessToken, blob, fichierNom, fileId);
      const newState = { ...driveState, fileId: newFileId };
      setDriveState(newState);
      saveDriveState(newState);
      toast.success("Fichier synchronisé avec Google Drive ✓");
    } catch (err) {
      toast.error("Erreur Drive : " + String(err instanceof Error ? err.message : err));
      // Token expiré → déconnecter
      if (String(err).includes("401") || String(err).includes("403")) {
        const newState = { ...driveState, connected: false, accessToken: null };
        setDriveState(newState);
        saveDriveState(newState);
      }
    } finally {
      setIsSyncingDrive(false);
    }
  };

  // Connexion Google Drive via OAuth2 (Google Identity Services)
  const handleConnectDrive = useCallback(async () => {
    const clientId = googleClientId.trim();
    if (!clientId) {
      toast.error("Veuillez saisir votre Client ID Google OAuth2.");
      return;
    }
    try {
      await loadGoogleScript();
      // Utiliser l'API Google Identity Services chargée dynamiquement
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const googleGIS = (window as any).google?.accounts?.oauth2;
      if (!googleGIS) {
        toast.error("Impossible de charger l'API Google. Vérifiez votre connexion.");
        return;
      }
      const tokenClient = googleGIS.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: async (response: { access_token?: string; error?: string }) => {
          if (response.error || !response.access_token) {
            toast.error("Connexion Google Drive annulée ou échouée.");
            return;
          }
          // Récupérer l'email via l'API userinfo
          try {
            const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${response.access_token}` },
            });
            const userInfo = await userRes.json();
            const newState: DriveState = {
              connected: true,
              email: userInfo.email || "Compte Google",
              accessToken: response.access_token,
              fileId: driveState.fileId,
            };
            setDriveState(newState);
            saveDriveState(newState);
            localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId);
            setShowDriveModal(false);
            toast.success(`Connecté à Google Drive : ${userInfo.email}`);
          } catch {
            const newState: DriveState = {
              connected: true,
              email: "Compte Google",
              accessToken: response.access_token,
              fileId: driveState.fileId,
            };
            setDriveState(newState);
            saveDriveState(newState);
            setShowDriveModal(false);
            toast.success("Connecté à Google Drive.");
          }
        },
      });
      tokenClient.requestAccessToken();
    } catch (err) {
      toast.error("Erreur de connexion : " + String(err instanceof Error ? err.message : err));
    }
  }, [googleClientId, driveState.fileId]);

  // Déconnexion Drive
  const handleDisconnectDrive = () => {
    const newState: DriveState = { connected: false, email: null, accessToken: null, fileId: null };
    setDriveState(newState);
    saveDriveState(newState);
    toast.success("Déconnecté de Google Drive.");
  };

  // Charger le fichier depuis Drive
  const handleLoadFromDrive = async () => {
    if (!driveState.accessToken) {
      toast.error("Connectez-vous d'abord à Google Drive.");
      return;
    }
    setIsSyncingDrive(true);
    try {
      let fileId = driveState.fileId;
      if (!fileId) {
        fileId = await findFileOnDrive(driveState.accessToken, fichierNom);
        if (!fileId) {
          toast.error(`Fichier "${fichierNom}" introuvable sur Drive. Chargez-le d'abord localement.`);
          return;
        }
      }
      const buffer = await downloadFromDrive(driveState.accessToken, fileId);
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
      // Reconstruire la grille
      const grille = await lireFichierGrille(
        new File([new Blob([buffer])], fichierNom, {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
      setFichierGrille(grille);
      if (grille.classes.length > 0) {
        const premiereClasse = grille.classes[0];
        setClasseSelectionnee(premiereClasse.nom);
        setEleves(premiereClasse.eleves.map((e) => ({ nom: e.nom, prenom: e.prenom, classe: e.classe })));
      }
      const newState = { ...driveState, fileId };
      setDriveState(newState);
      saveDriveState(newState);
      toast.success("Fichier chargé depuis Google Drive.");
    } catch (err) {
      toast.error("Erreur Drive : " + String(err instanceof Error ? err.message : err));
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const elevesClasse = fichierGrille?.classes.find((c) => c.nom === classeSelectionnee)?.eleves || [];
  const eleveLabel = eleveSelectionneInfo
    ? `${eleveSelectionneInfo.nom} ${eleveSelectionneInfo.prenom}`
    : "Sélectionner un élève";

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif", background: "#FAFAF9" }}>
      {/* ===== SIDEBAR GAUCHE ===== */}
      <aside className="w-80 flex-shrink-0 flex flex-col" style={{ background: "#292524", color: "#F5F5F4", minHeight: "100vh" }}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-stone-700">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#2563EB" }}>
              <Zap size={16} color="white" />
            </div>
            <span className="font-bold text-lg tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
              MELEC Éval
            </span>
          </div>
          <p className="text-xs text-stone-400 ml-11">Grille d'évaluation professionnelle</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* === Fichier de grille === */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-2">
              <Upload size={12} /> Fichier de grille
            </h3>
            <button
              onClick={() => fileInputGrilleRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: fichierGrille ? "#1c4a1a" : "#3C3836",
                color: fichierGrille ? "#86efac" : "#D6D3D1",
                border: `1px solid ${fichierGrille ? "#166534" : "#57534E"}`,
              }}
            >
              <Upload size={14} />
              {fichierGrille ? fichierNom.slice(0, 28) : "Charger fichier Excel"}
            </button>
            <input ref={fileInputGrilleRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportGrille} />

            {/* Bouton charger depuis Drive */}
            {driveState.connected && (
              <button
                onClick={handleLoadFromDrive}
                disabled={isSyncingDrive}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mt-2 transition-all disabled:opacity-50"
                style={{ background: "#1e3a5f", color: "#93C5FD", border: "1px solid #1d4ed8" }}
              >
                <RefreshCw size={11} className={isSyncingDrive ? "animate-spin" : ""} />
                Charger depuis Drive
              </button>
            )}
          </section>

          {/* === Classe === */}
          {fichierGrille && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-2">
                <Users size={12} /> Classe
              </h3>
              <div className="relative">
                <button
                  onClick={() => setIsClasseDropdownOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all"
                  style={{
                    background: classeSelectionnee ? "#1e3a5f" : "#3C3836",
                    color: classeSelectionnee ? "#93C5FD" : "#D6D3D1",
                    border: `1px solid ${classeSelectionnee ? "#1d4ed8" : "#57534E"}`,
                  }}
                >
                  <span className="font-medium">{classeSelectionnee || "Sélectionner une classe"}</span>
                  <ChevronDown size={14} style={{ transform: isClasseDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                </button>
                {isClasseDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 rounded-lg shadow-xl overflow-hidden" style={{ background: "#1C1917", border: "1px solid #44403C" }}>
                    {fichierGrille.classes.map((c) => (
                      <button key={c.nom} onClick={() => handleClasseChange(c.nom)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-stone-700 transition-colors flex items-center justify-between"
                        style={{ color: "#D6D3D1" }}
                      >
                        <span><span className="font-semibold">{c.nom}</span> <span className="text-xs text-stone-500">({c.eleves.length} élèves)</span></span>
                        {classeSelectionnee === c.nom && <Check size={12} color="#60A5FA" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* === Élève === */}
          {classeSelectionnee && elevesClasse.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-2">
                <Users size={12} /> Élève
              </h3>
              <div className="relative">
                <button
                  onClick={() => setIsEleveDropdownOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all"
                  style={{
                    background: eleveSelectionneInfo ? "#1e3a5f" : "#3C3836",
                    color: eleveSelectionneInfo ? "#93C5FD" : "#D6D3D1",
                    border: `1px solid ${eleveSelectionneInfo ? "#1d4ed8" : "#57534E"}`,
                  }}
                >
                  <span className="truncate font-medium">{eleveLabel}</span>
                  <ChevronDown size={14} style={{ transform: isEleveDropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                </button>
                {isEleveDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 rounded-lg shadow-xl overflow-hidden" style={{ background: "#1C1917", border: "1px solid #44403C", maxHeight: "220px", overflowY: "auto" }}>
                    {elevesClasse.map((eleve, i) => (
                      <button key={i} onClick={() => handleEleveChange(eleve)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-stone-700 transition-colors flex items-center justify-between"
                        style={{ color: "#D6D3D1" }}
                      >
                        <span>
                          <span className="font-semibold">{eleve.nom}</span> <span>{eleve.prenom}</span>
                        </span>
                        {eleveSelectionneInfo?.nom === eleve.nom && eleveSelectionneInfo?.prenom === eleve.prenom && <Check size={12} color="#60A5FA" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Historique élève */}
              {eleveSelectionneInfo && histoEleve.length > 0 && (
                <button
                  onClick={() => setShowHistoEleve(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mt-2 transition-all"
                  style={{ background: "#3C3836", color: "#A8A29E", border: "1px solid #57534E" }}
                >
                  <History size={11} />
                  {histoEleve.length} évaluation(s) existante(s)
                </button>
              )}
            </section>
          )}

          {/* === Équipement === */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-2">
              <Wrench size={12} /> Équipement / Support
            </h3>
            <input
              type="text" value={state.equipement} onChange={(e) => setEquipement(e.target.value)}
              placeholder="Ex : Coffret électrique n°3"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{ background: "#3C3836", color: "#F5F5F4", border: "1px solid #57534E" }}
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
              type="date" value={state.date} onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={{ background: "#3C3836", color: "#F5F5F4", border: "1px solid #57534E", colorScheme: "dark" }}
              onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
              onBlur={(e) => (e.target.style.borderColor = "#57534E")}
            />
          </section>

          {/* === Compétences === */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3 flex items-center gap-2">
              <BookOpen size={12} /> Compétences à évaluer
            </h3>
            <div className="space-y-1.5">
              {COMPETENCES.map((comp) => {
                const selected = state.competencesSelectionnees.includes(comp.code);
                return (
                  <button key={comp.id} onClick={() => toggleCompetence(comp.code)}
                    className="w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-xs"
                    style={{ background: selected ? `${comp.couleur}22` : "#3C3836", border: `1px solid ${selected ? comp.couleur : "#57534E"}`, color: selected ? "#F5F5F4" : "#A8A29E" }}
                  >
                    <div className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5" style={{ background: selected ? comp.couleur : "#57534E" }}>
                      {selected ? <Check size={10} color="white" /> : <span className="text-[9px] font-bold text-stone-300">{comp.code}</span>}
                    </div>
                    <span className="leading-tight">
                      <span className="font-semibold" style={{ color: selected ? comp.couleur : "#78716C" }}>{comp.code}</span>{" "}
                      — {comp.libelle.length > 42 ? comp.libelle.slice(0, 42) + "…" : comp.libelle}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Actions bas */}
        <div className="px-5 py-4 border-t border-stone-700 space-y-2">
          {/* Statut Drive */}
          <button
            onClick={() => setShowDriveModal(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{
              background: driveState.connected ? "#1c4a1a" : "#3C3836",
              color: driveState.connected ? "#86efac" : "#A8A29E",
              border: `1px solid ${driveState.connected ? "#166534" : "#57534E"}`,
            }}
          >
            <div className="flex items-center gap-2">
              {driveState.connected ? <Cloud size={12} /> : <CloudOff size={12} />}
              {driveState.connected ? driveState.email?.split("@")[0] || "Drive connecté" : "Connecter Google Drive"}
            </div>
            {isSyncingDrive && <RefreshCw size={11} className="animate-spin" />}
          </button>
          <button onClick={resetAll}
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
        <header className="flex items-center justify-between px-6 py-4 border-b" style={{ background: "white", borderColor: "#E7E5E4" }}>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
              Grille d'Évaluation
              {eleveSelectionneInfo && (
                <span style={{ color: "#2563EB" }}>
                  {" "}— {eleveSelectionneInfo.nom} {eleveSelectionneInfo.prenom}
                  <span className="text-sm font-normal text-stone-400 ml-2">({classeSelectionnee})</span>
                </span>
              )}
            </h1>
            <p className="text-xs text-stone-400 mt-0.5">
              {competencesActives.length === 0
                ? fichierGrille ? "Sélectionnez un élève et des compétences" : "Chargez le fichier de grille Excel pour commencer"
                : `${competencesActives.length} compétence(s) · ${state.equipement || "Équipement non renseigné"} · ${state.date}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowInfo(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ background: "#F5F5F4", color: "#78716C" }}
            >
              <Info size={15} />
            </button>
            <button
              onClick={handleEnregistrer}
              disabled={isSaving || !eleveSelectionneInfo || competencesActives.length === 0 || !fichierGrille}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: "#2563EB", color: "white" }}
            >
              <Download size={14} />
              {isSaving ? "Enregistrement…" : driveState.connected ? "Enregistrer & Sync Drive" : "Enregistrer Excel"}
            </button>
          </div>
        </header>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!fichierGrille ? (
            /* État initial — pas de fichier */
            <div className="flex flex-col items-center justify-center py-24 rounded-2xl" style={{ background: "white", border: "2px dashed #E7E5E4" }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#EFF6FF" }}>
                <Upload size={28} color="#2563EB" />
              </div>
              <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
                Chargez votre fichier de grille
              </h2>
              <p className="text-sm text-stone-400 text-center max-w-sm mb-6">
                Cliquez sur <strong>« Charger fichier Excel »</strong> dans le panneau gauche pour charger votre fichier <code>grilleévaluationApplication.xlsx</code>.
              </p>
              <div className="flex gap-3">
                <button onClick={() => fileInputGrilleRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: "#2563EB", color: "white" }}
                >
                  <Upload size={14} /> Charger le fichier Excel
                </button>
                {driveState.connected && (
                  <button onClick={handleLoadFromDrive} disabled={isSyncingDrive}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: "#F5F5F4", color: "#292524" }}
                  >
                    <Cloud size={14} /> Charger depuis Drive
                  </button>
                )}
              </div>
            </div>
          ) : competencesActives.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-2xl" style={{ background: "white", border: "2px dashed #E7E5E4" }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#EFF6FF" }}>
                <BookOpen size={28} color="#2563EB" />
              </div>
              <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
                {eleveSelectionneInfo ? "Sélectionnez les compétences à évaluer" : "Sélectionnez un élève"}
              </h2>
              <p className="text-sm text-stone-400 text-center max-w-sm">
                {eleveSelectionneInfo
                  ? "Cochez les compétences dans le panneau gauche. Les tableaux apparaîtront ici."
                  : "Choisissez d'abord une classe puis un élève dans le panneau gauche."}
              </p>
            </div>
          ) : (
            <>
              <RecapitulatifNote noteSur20={noteSur20} totalObtenu={totalObtenu} totalMax={totalMax} notesParCompetence={notesParCompetence} />
              {competencesActives.map((comp) => (
                <TableauCompetence key={comp.id} competence={comp} notes={state.notes} onNoteChange={setNote} />
              ))}
              <div className="flex justify-end pb-4">
                <button onClick={handleEnregistrer} disabled={isSaving || !eleveSelectionneInfo}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 shadow-lg"
                  style={{ background: "#2563EB", color: "white" }}
                >
                  <Download size={16} />
                  {isSaving ? "Enregistrement…" : driveState.connected ? "Enregistrer & Synchroniser Drive" : "Enregistrer Excel"}
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* ===== MODAL GOOGLE DRIVE ===== */}
      {showDriveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowDriveModal(false)}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl p-6" style={{ background: "white" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
                Connexion Google Drive
              </h2>
              <button onClick={() => setShowDriveModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: "#F5F5F4", color: "#78716C" }}>
                <X size={15} />
              </button>
            </div>

            {driveState.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#f0fdf4", border: "1px solid #86efac" }}>
                  <Cloud size={20} color="#16a34a" />
                  <div>
                    <p className="font-semibold text-sm text-green-800">Connecté</p>
                    <p className="text-xs text-green-600">{driveState.email}</p>
                  </div>
                </div>
                {driveState.fileId && (
                  <p className="text-xs text-stone-500">Fichier Drive ID : <code className="bg-stone-100 px-1 rounded">{driveState.fileId.slice(0, 20)}…</code></p>
                )}
                <button onClick={handleDisconnectDrive}
                  className="w-full px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}
                >
                  Se déconnecter
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-xl text-sm" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                  <p className="font-semibold text-blue-800 mb-1">Configuration requise</p>
                  <p className="text-blue-600 text-xs">
                    Pour synchroniser avec Google Drive, vous devez créer un projet Google Cloud et obtenir un Client ID OAuth2. 
                    Consultez le guide d'utilisation (ℹ️) pour les étapes détaillées.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5">Client ID Google OAuth2</label>
                  <input
                    type="text" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)}
                    placeholder="xxxxxxx.apps.googleusercontent.com"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "#F5F5F4", border: "1px solid #E7E5E4", color: "#1C1917" }}
                  />
                </div>
                <button onClick={handleConnectDrive} disabled={!googleClientId.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
                  style={{ background: "#2563EB", color: "white" }}
                >
                  <Cloud size={15} /> Se connecter à Google Drive
                </button>
                <p className="text-xs text-stone-400 text-center">
                  Une fenêtre Google s'ouvrira pour autoriser l'accès à votre Drive.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== MODAL HISTORIQUE ÉLÈVE ===== */}
      {showHistoEleve && eleveSelectionneInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowHistoEleve(false)}>
          <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" style={{ background: "white", maxHeight: "80vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#E7E5E4" }}>
              <h2 className="text-lg font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
                Historique — {eleveSelectionneInfo.nom} {eleveSelectionneInfo.prenom}
              </h2>
              <button onClick={() => setShowHistoEleve(false)} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: "#F5F5F4", color: "#78716C" }}>
                <X size={15} />
              </button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4" style={{ maxHeight: "calc(80vh - 80px)" }}>
              {histoEleve.map((entry) => (
                <div key={entry.bloc} className="rounded-xl p-4" style={{ background: "#FAFAF9", border: "1px solid #E7E5E4" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-sm" style={{ color: "#1C1917" }}>Évaluation n°{entry.bloc}</span>
                    {entry.meta && <span className="text-xs text-stone-400">{entry.meta}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(entry.notes).map(([code, note]) => {
                      if (note === null) return null;
                      const comp = COMPETENCES.find((c) => c.code === code);
                      return (
                        <div key={code} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: `${comp?.couleur || "#2563EB"}10`, border: `1px solid ${comp?.couleur || "#2563EB"}30` }}
                        >
                          <span style={{ color: comp?.couleur || "#2563EB" }}>{code}</span>
                          <span className="text-stone-500">:</span>
                          <span className="tabular-nums text-stone-800">{note}/20</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL INFO ===== */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowInfo(false)}>
          <div className="w-full max-w-lg rounded-2xl shadow-2xl p-6 overflow-y-auto" style={{ background: "white", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>Guide d'utilisation</h2>
              <button onClick={() => setShowInfo(false)} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: "#F5F5F4", color: "#78716C" }}>
                <X size={15} />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-stone-700 mb-5">
              {[
                { n: 1, t: "Charger le fichier Excel", d: "Cliquez sur « Charger fichier Excel » et sélectionnez votre fichier grilleévaluationApplication.xlsx. Les classes (TP26, TP27…) et les élèves sont chargés automatiquement." },
                { n: 2, t: "Sélectionner la classe et l'élève", d: "Choisissez la classe (TP26 ou TP27) puis l'élève dans la liste déroulante." },
                { n: 3, t: "Renseigner l'équipement et la date", d: "Indiquez le nom du support évalué et la date." },
                { n: 4, t: "Choisir les compétences", d: "Cochez les compétences C1 à C13 à évaluer." },
                { n: 5, t: "Saisir les notes", d: "Entrez la note obtenue pour chaque critère. La note sur 20 est calculée automatiquement." },
                { n: 6, t: "Enregistrer", d: "Cliquez sur « Enregistrer Excel ». Le fichier mis à jour (avec les notes dans la bonne colonne de l'élève) est téléchargé. Si Drive est connecté, il est aussi synchronisé." },
              ].map((step) => (
                <li key={step.n} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "#2563EB" }}>{step.n}</span>
                  <div>
                    <p className="font-semibold text-stone-800">{step.t}</p>
                    <p className="text-stone-500 text-xs mt-0.5">{step.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="p-3 rounded-xl text-xs" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
              <p className="font-bold text-blue-800 mb-1">Configuration Google Drive</p>
              <ol className="text-blue-700 space-y-1 list-decimal list-inside">
                <li>Allez sur <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">console.cloud.google.com</a></li>
                <li>Créez un projet, activez l'API Google Drive</li>
                <li>Créez des identifiants OAuth2 (type : Application Web)</li>
                <li>Ajoutez l'URL de l'application dans les origines autorisées</li>
                <li>Copiez le Client ID et collez-le dans « Connecter Google Drive »</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
