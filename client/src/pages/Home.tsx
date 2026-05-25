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
  enregistrerEvaluation,
  telechargerFichierGrille,
  lireEvaluationsEleve,
  creerWorkbookVide,
  archiverClasse,
  type FichierGrille,
  type EleveInfo,
  type BlocEvaluation,
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
  BarChart2,
  FileText,
  UserPlus,
  Archive,
  AlertTriangle,
} from "lucide-react";
import TableauCompetence from "@/components/TableauCompetence";
import RecapitulatifNote from "@/components/RecapitulatifNote";
import { exporterBulletinPDF } from "@/lib/pdfBulletin";
import GestionEleves from "@/components/GestionEleves";
import SavoirEtre from "@/components/SavoirEtre";
import { CRITERES_SAVOIR_ETRE, couleurSavoirEtre } from "@/lib/savoirEtre";
import { genererDocumentsBacClasse } from "@/lib/bacProMelecExport";

// Client ID Google OAuth2 — à renseigner par l'utilisateur dans les paramètres
const GOOGLE_CLIENT_ID_KEY = "melec_google_client_id";
// Client ID Google OAuth2 pré-configuré pour RMQUENEAU@gmail.com
const GOOGLE_CLIENT_ID_DEFAULT = "481482019199-v7c87meflc0ns2b7985nq37c96t66djf.apps.googleusercontent.com";

interface HomeProps {
  onShowDashboard?: () => void;
  onFichierGrilleChange?: (grille: FichierGrille | null) => void;
  fichierGrilleExternal?: FichierGrille | null;
}

export default function Home({ onShowDashboard, onFichierGrilleChange, fichierGrilleExternal }: HomeProps = {}) {
  const {
    state,
    setEleves,
    setEleveSelectionne,
    setEquipement,
    setDate,
    toggleCompetence,
    setNote,
    setSavoirEtre,
    resetNotes,
    resetAll,
    noteSur20,
    totalObtenu,
    totalMax,
    totalCoefs,
    competencesActives,
    notesParCompetence,
    moyenneSavoirEtre,
  } = useEvaluation();

  // Fichier grille — synchronisé avec l'état externe (App.tsx)
  const [fichierGrille, setFichierGrilleLocal] = useState<FichierGrille | null>(
    fichierGrilleExternal ?? null
  );

  const setFichierGrille = (grille: FichierGrille | null) => {
    setFichierGrilleLocal(grille);
    onFichierGrilleChange?.(grille);
  };
  const [fichierNom, setFichierNom] = useState<string>("grille_melec_structuree.xlsx");
  const [classeSelectionnee, setClasseSelectionnee] = useState<string>("");
  const [eleveSelectionneInfo, setEleveSelectionneInfo] = useState<EleveInfo | null>(null);

  // Google Drive
  const [driveState, setDriveState] = useState<DriveState>(loadDriveState());
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(
    localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || GOOGLE_CLIENT_ID_DEFAULT
  );
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);

  // UI
  const [isEleveDropdownOpen, setIsEleveDropdownOpen] = useState(false);
  const [isClasseDropdownOpen, setIsClasseDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showHistoEleve, setShowHistoEleve] = useState(false);
  const [showGestionEleves, setShowGestionEleves] = useState(false);
  const [showArchiver, setShowArchiver] = useState(false);
  const [showDocBac, setShowDocBac] = useState(false);
  const [showNumCandidats, setShowNumCandidats] = useState(false);
  const [numeroCandidats, setNumeroCandidats] = useState<Record<string, string>>({}); // key: "NOM Prenom", value: numero
  const [sidebarOpen, setSidebarOpen] = useState(false); // drawer mobile
  const [histoEleve, setHistoEleve] = useState<BlocEvaluation[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [commentaire, setCommentaire] = useState("");
  // Données pré-calculées pour la modale de confirmation
  const [confirmData, setConfirmData] = useState<{
    notesParComp: Record<string, number | null>;
    savoirEtre: Record<string, number | null>;
  } | null>(null);

  const fileInputGrilleRef = useRef<HTMLInputElement>(null);
  const [autoLoadStatus, setAutoLoadStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [autoLoadMessage, setAutoLoadMessage] = useState<string>("");
  const hasAutoLoaded = useRef(false);

  // ===== CHARGEMENT AUTOMATIQUE AU DÉMARRAGE =====
  // Si Drive est connecté (token en mémoire), charger le fichier automatiquement
  useEffect(() => {
    if (hasAutoLoaded.current) return;
    if (!driveState.connected || !driveState.accessToken) return;
    hasAutoLoaded.current = true;

    const autoLoad = async () => {
      setAutoLoadStatus("loading");
      setAutoLoadMessage("Connexion à Google Drive…");
      try {
        // Chercher le fichier sur Drive
        let fileId = driveState.fileId;
        if (!fileId) {
          setAutoLoadMessage(`Recherche de "${fichierNom}" sur Drive…`);
          fileId = await findFileOnDrive(driveState.accessToken!, fichierNom);
          if (!fileId) {
            setAutoLoadStatus("error");
            setAutoLoadMessage(`Fichier "${fichierNom}" introuvable sur Drive. Chargez-le manuellement.`);
            return;
          }
        }
        setAutoLoadMessage("Téléchargement du fichier…");
        const buffer = await downloadFromDrive(driveState.accessToken!, fileId);
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
        setAutoLoadStatus("done");
        setAutoLoadMessage(``);
        toast.success(
          `☁️ Fichier chargé automatiquement depuis Drive (${grille.classes.reduce((s, c) => s + c.eleves.length, 0)} élèves).`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Token expiré : déconnecter silencieusement
        if (msg.includes("401") || msg.includes("403") || msg.includes("invalid_token")) {
          const newState = { ...driveState, connected: false, accessToken: null };
          setDriveState(newState);
          saveDriveState(newState);
          setAutoLoadStatus("idle");
          setAutoLoadMessage("");
        } else {
          setAutoLoadStatus("error");
          setAutoLoadMessage(`Erreur Drive : ${msg}`);
        }
      }
    };

    autoLoad();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Sélectionner un élève — remet à zéro les notes et les compétences sélectionnées
  const handleEleveChange = (eleve: EleveInfo) => {
    // Réinitialiser les notes et compétences avant de charger le nouvel élève
    resetNotes();
    setEleveSelectionneInfo(eleve);
    setEleveSelectionne({ nom: eleve.nom, prenom: eleve.prenom, classe: eleve.classe });
    setIsEleveDropdownOpen(false);
    // Charger l'historique de l'élève depuis son onglet dédié
    if (fichierGrille) {
      const histo = lireEvaluationsEleve(fichierGrille.rawWorkbook, eleve.nom, eleve.prenom);
      setHistoEleve(histo);
    }
    toast.success(`Élève sélectionné : ${eleve.nom} ${eleve.prenom} — notes remises à zéro.`);
  };

  // Étape 1 : vérifier et préparer les données, puis afficher la modale de confirmation
  const handleEnregistrer = () => {
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
    // Pré-calculer les notes pour la modale
    const notesParComp: Record<string, number | null> = {};
    for (const n of notesParCompetence) {
      notesParComp[n.comp.code] = n.sur20;
    }
    setConfirmData({ notesParComp, savoirEtre: { ...state.savoirEtre } });
    setCommentaire(""); // réinitialiser le commentaire à chaque ouverture
    setShowConfirmation(true);
  };

  // Étape 2 : confirmer et exécuter l'enregistrement réel
  const handleConfirmerEnregistrement = useCallback(async () => {
    if (!eleveSelectionneInfo || !fichierGrille || !confirmData) return;
    setShowConfirmation(false);
    setIsSaving(true);
    try {
      const wbMaj = enregistrerEvaluation(fichierGrille.rawWorkbook, {
        date: state.date,
        equipement: state.equipement,
        nom: eleveSelectionneInfo.nom,
        prenom: eleveSelectionneInfo.prenom,
        classe: eleveSelectionneInfo.classe,
        notesParCompetence: confirmData.notesParComp,
        noteGlobale: noteSur20,
        commentaire: commentaire.trim() || undefined,
        savoirEtre: confirmData.savoirEtre,
      });

      // Mettre à jour l'état local ET notifier App.tsx (pour le tableau de bord)
      const grilleMAJ = { ...fichierGrille, rawWorkbook: wbMaj };
      setFichierGrilleLocal(grilleMAJ);
      onFichierGrilleChange?.(grilleMAJ);
      const blob = telechargerFichierGrille(wbMaj, fichierNom);

      toast.success(`✓ Notes enregistrées pour ${eleveSelectionneInfo.nom} ${eleveSelectionneInfo.prenom}.`);

      if (driveState.connected && driveState.accessToken) {
        await syncWithDrive(blob);
      }

      const histo = lireEvaluationsEleve(wbMaj, eleveSelectionneInfo.nom, eleveSelectionneInfo.prenom);
      setHistoEleve(histo);
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setIsSaving(false);
      setConfirmData(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eleveSelectionneInfo, fichierGrille, confirmData, noteSur20, commentaire, fichierNom, driveState.connected, driveState.accessToken]);

  // ===== RACCOURCIS CLAVIER MODALE DE CONFIRMATION =====
  // Entrée = confirmer (sauf dans le textarea), Échap = annuler
  useEffect(() => {
    if (!showConfirmation) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isSaving) handleConfirmerEnregistrement();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowConfirmation(false);
        setConfirmData(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showConfirmation, isSaving, handleConfirmerEnregistrement]);

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

      {/* ===== OVERLAY MOBILE ===== */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ===== SIDEBAR GAUCHE ===== */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-80 flex-shrink-0 flex flex-col
          transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:z-auto
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ background: "#292524", color: "#F5F5F4", minHeight: "100vh" }}
      >
        {/* Logo */}
        <div className="px-5 py-4 border-b border-stone-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#2563EB" }}>
                <Zap size={16} color="white" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  MELEC Éval
                </span>
                <p className="text-xs text-stone-400">Grille d'évaluation</p>
              </div>
            </div>
            {/* Bouton fermeture mobile */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg"
              style={{ background: "#3C3836", color: "#A8A29E" }}
            >
              <X size={15} />
            </button>
          </div>
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
          {/* Bouton gérer les élèves */}
          {fichierGrille && (
            <button
              onClick={() => setShowGestionEleves(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: "#3C3836", color: "#D6D3D1", border: "1px solid #57534E" }}
            >
              <UserPlus size={13} /> Gérer les élèves
            </button>
          )}
          {fichierGrille && classeSelectionnee && (
            <>
              <button
                onClick={() => setShowDocBac(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: "#3C3836", color: "#EC4899", border: "1px solid #BE185D" }}
              >
                <FileText size={13} /> Document Bac
              </button>
              <button
                onClick={() => setShowArchiver(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: "#3C3836", color: "#FBBF24", border: "1px solid #78350F" }}
              >
                <Archive size={13} /> Archiver la classe
              </button>
            </>
          )}
          <button
            onClick={() => {
              // Réinitialiser TOUT : fichier, élèves, classe, notes, savoir-être
              setFichierGrille(null);
              setFichierNom("grille_melec_structuree.xlsx");
              setClasseSelectionnee("");
              setEleveSelectionneInfo(null);
              setHistoEleve([]);
              setEleves([]);
              resetAll();
              // Réinitialiser l'input fichier
              if (fileInputGrilleRef.current) fileInputGrilleRef.current.value = "";
              toast.success("Application réinitialisée.");
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: "#3C3836", color: "#A8A29E", border: "1px solid #57534E" }}
          >
            <RotateCcw size={13} /> Réinitialiser
          </button>
        </div>
      </aside>

      {/* ===== ZONE PRINCIPALE ===== */}
      <main className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4 border-b" style={{ background: "white", borderColor: "#E7E5E4" }}>
          <div className="flex items-center gap-3 min-w-0">
            {/* Bouton hamburger mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg"
              style={{ background: "#292524", color: "white" }}
            >
              <BookOpen size={16} />
            </button>
            <div className="min-w-0">
              <h1 className="text-base lg:text-xl font-bold tracking-tight truncate" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
                {eleveSelectionneInfo
                  ? `${eleveSelectionneInfo.nom} ${eleveSelectionneInfo.prenom}`
                  : "Grille d'Évaluation"}
              </h1>
              <p className="text-xs text-stone-400 mt-0.5 truncate">
                {competencesActives.length === 0
                  ? fichierGrille
                    ? "Sélectionnez un élève et des compétences"
                    : autoLoadStatus === "loading"
                    ? autoLoadMessage
                    : "Chargez le fichier de grille Excel"
                  : `${competencesActives.length} comp. · ${state.equipement || "Équipement"} · ${state.date}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Bouton tableau de bord */}
            {/* Bouton export PDF */}
            {eleveSelectionneInfo && competencesActives.length > 0 && (
              <button
                onClick={() => exporterBulletinPDF({
                  nom: eleveSelectionneInfo.nom,
                  prenom: eleveSelectionneInfo.prenom,
                  classe: eleveSelectionneInfo.classe,
                  evaluations: histoEleve,
                  date: state.date,
                  equipement: state.equipement,
                  notesParCompetence: Object.fromEntries(
                    notesParCompetence.map((n) => [n.comp.code, n.sur20])
                  ),
                  noteGlobale: noteSur20,
                  commentaire: commentaire,
                  totalCoefs: totalCoefs,
                })}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ background: "#F5F5F4", color: "#292524", border: "1px solid #E7E5E4" }}
                title="Exporter le bulletin PDF de l'élève"
              >
                <FileText size={14} />
                <span className="hidden sm:inline">Bulletin PDF</span>
              </button>
            )}
            {fichierGrille && onShowDashboard && (
              <button
                onClick={onShowDashboard}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ background: "#F5F5F4", color: "#292524", border: "1px solid #E7E5E4" }}
                title="Tableau de bord de la classe"
              >
                <BarChart2 size={14} />
                <span className="hidden sm:inline">Tableau de bord</span>
              </button>
            )}
            <button onClick={() => setShowInfo(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ background: "#F5F5F4", color: "#78716C" }}
            >
              <Info size={15} />
            </button>
            <button
              onClick={handleEnregistrer}
              disabled={isSaving || !eleveSelectionneInfo || competencesActives.length === 0 || !fichierGrille}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: "#2563EB", color: "white" }}
            >
              <Download size={14} />
              <span className="hidden sm:inline">{isSaving ? "Enregistrement…" : driveState.connected ? "Enregistrer & Sync" : "Enregistrer Excel"}</span>
              <span className="sm:hidden">{isSaving ? "…" : "Sauver"}</span>
            </button>
          </div>
        </header>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-3 lg:p-6 space-y-4 lg:space-y-6">
          {!fichierGrille ? (
            /* État initial — chargement automatique ou invitation manuelle */
            <div className="flex flex-col items-center justify-center py-24 rounded-2xl" style={{ background: "white", border: "2px dashed #E7E5E4" }}>
              {autoLoadStatus === "loading" ? (
                /* Chargement automatique en cours */
                <>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#EFF6FF" }}>
                    <RefreshCw size={28} color="#2563EB" className="animate-spin" />
                  </div>
                  <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
                    Chargement depuis Google Drive…
                  </h2>
                  <p className="text-sm text-stone-400 text-center max-w-sm">
                    {autoLoadMessage}
                  </p>
                </>
              ) : autoLoadStatus === "error" ? (
                /* Erreur de chargement automatique */
                <>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#FEF2F2" }}>
                    <CloudOff size={28} color="#DC2626" />
                  </div>
                  <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
                    Chargement automatique échoué
                  </h2>
                  <p className="text-sm text-center max-w-sm mb-4" style={{ color: "#DC2626" }}>
                    {autoLoadMessage}
                  </p>
                  <div className="flex gap-3">
                    <button onClick={handleLoadFromDrive}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                      style={{ background: "#2563EB", color: "white" }}
                    >
                      <RefreshCw size={14} /> Réessayer depuis Drive
                    </button>
                    <button onClick={() => fileInputGrilleRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
                      style={{ background: "#F5F5F4", color: "#292524" }}
                    >
                      <Upload size={14} /> Charger localement
                    </button>
                  </div>
                </>
              ) : (
                /* Pas de Drive connecté — invitation manuelle */
                <>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#EFF6FF" }}>
                    <Upload size={28} color="#2563EB" />
                  </div>
                  <h2 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
                    Chargez votre fichier de grille
                  </h2>
                  <p className="text-sm text-stone-400 text-center max-w-sm mb-6">
                    Connectez Google Drive pour un chargement automatique, ou chargez le fichier <code>grilleévaluationApplication.xlsx</code> manuellement.
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
                </>
              )}
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
              <RecapitulatifNote noteSur20={noteSur20} totalObtenu={totalObtenu} totalMax={totalMax} totalCoefs={totalCoefs} notesParCompetence={notesParCompetence} />
              {competencesActives.map((comp) => (
                <TableauCompetence key={comp.id} competence={comp} notes={state.notes} onNoteChange={setNote} />
              ))}
              {/* Savoir-être */}
              <SavoirEtre notes={state.savoirEtre} onChange={setSavoirEtre} />
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
                {/* Indicateur Client ID pré-configuré */}
                <div className="p-3 rounded-xl text-sm" style={{ background: "#f0fdf4", border: "1px solid #86efac" }}>
                  <p className="font-semibold text-green-800 mb-0.5 flex items-center gap-1.5">
                    <Check size={13} /> Client ID pré-configuré
                  </p>
                  <p className="text-green-700 text-xs font-mono break-all">
                    {GOOGLE_CLIENT_ID_DEFAULT.slice(0, 30)}…
                  </p>
                </div>
                <button onClick={handleConnectDrive}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold shadow-sm"
                  style={{ background: "#2563EB", color: "white" }}
                >
                  <Cloud size={16} /> Se connecter à Google Drive
                </button>
                <p className="text-xs text-stone-400 text-center">
                  Une fenêtre Google s'ouvrira — connectez-vous avec <strong>RMQUENEAU@gmail.com</strong>.
                </p>
                {/* Option avanceée : modifier le Client ID */}
                <details className="text-xs">
                  <summary className="text-stone-400 cursor-pointer hover:text-stone-600 transition-colors">
                    Modifier le Client ID (avancé)
                  </summary>
                  <div className="mt-2">
                    <input
                      type="text" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)}
                      placeholder="xxxxxxx.apps.googleusercontent.com"
                      className="w-full px-3 py-2 rounded-lg text-xs outline-none mt-1"
                      style={{ background: "#F5F5F4", border: "1px solid #E7E5E4", color: "#1C1917" }}
                    />
                  </div>
                </details>
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
              {histoEleve.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-8">Aucune évaluation enregistrée pour cet élève.</p>
              ) : (
                histoEleve.map((entry: BlocEvaluation, idx: number) => (
                  <div key={idx} className="rounded-xl p-4" style={{ background: "#FAFAF9", border: "1px solid #E7E5E4" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-sm" style={{ color: "#1C1917" }}>Évaluation n°{idx + 1} — {entry.date}</span>
                      <div className="flex items-center gap-3">
                        {entry.equipement && <span className="text-xs text-stone-400">{entry.equipement}</span>}
                        {entry.noteGlobale !== null && (
                          <span className="text-sm font-bold tabular-nums" style={{ color: entry.noteGlobale >= 10 ? "#2563EB" : "#dc2626" }}>
                            {entry.noteGlobale.toFixed(2)}/20
                          </span>
                        )}
                      </div>
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
                            <span className="tabular-nums text-stone-800">{(note as number).toFixed(2)}/20</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
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
      {/* ===== MODALE DE CONFIRMATION ===== */}
      {showConfirmation && eleveSelectionneInfo && confirmData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setShowConfirmation(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ background: "white", maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="px-6 py-4 border-b" style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#2563EB" }}>
                    <Download size={16} color="white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: "#1C1917" }}>
                      Confirmer l'enregistrement
                    </h2>
                    <p className="text-xs text-stone-500">Vérifiez les informations avant de valider</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg"
                  style={{ background: "#DBEAFE", color: "#2563EB" }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Corps */}
            <div className="px-4 lg:px-6 py-4 lg:py-5 space-y-4 overflow-y-auto flex-1">

              {/* Informations élève */}
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#FAFAF9", border: "1px solid #E7E5E4" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: "#2563EB" }}>
                  {eleveSelectionneInfo.nom[0]}{eleveSelectionneInfo.prenom[0]}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-stone-800">{eleveSelectionneInfo.nom} {eleveSelectionneInfo.prenom}</p>
                  <p className="text-xs text-stone-500">Classe {eleveSelectionneInfo.classe}</p>
                </div>
              </div>

              {/* Date et équipement */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl" style={{ background: "#FAFAF9", border: "1px solid #E7E5E4" }}>
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Calendar size={11} /> Date
                  </p>
                  <p className="text-sm font-semibold text-stone-800">{state.date}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: "#FAFAF9", border: "1px solid #E7E5E4" }}>
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Wrench size={11} /> Équipement
                  </p>
                  <p className="text-sm font-semibold text-stone-800 truncate">{state.equipement || <span className="italic text-stone-400">Non renseigné</span>}</p>
                </div>
              </div>

              {/* Notes par compétence */}
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Notes par compétence</p>
                <div className="flex flex-wrap gap-2">
                  {COMPETENCES.filter((c) => confirmData.notesParComp[c.code] !== null && confirmData.notesParComp[c.code] !== undefined)
                    .map((comp) => {
                      const note = confirmData.notesParComp[comp.code]!;
                      const couleur = note >= 16 ? "#16a34a" : note >= 10 ? "#2563EB" : "#dc2626";
                      return (
                        <div key={comp.code}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: `${comp.couleur}10`, border: `1px solid ${comp.couleur}30` }}
                        >
                          <span style={{ color: comp.couleur }}>{comp.code}</span>
                          <span className="text-stone-400">:</span>
                          <span className="tabular-nums font-bold" style={{ color: couleur }}>
                            {note.toFixed(2)}/20
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Savoir-être dans la confirmation */}
              {Object.values(confirmData.savoirEtre).some((v) => v !== null && v !== undefined) && (
                <div>
                  <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Savoir-être</p>
                  <div className="flex flex-wrap gap-2">
                    {CRITERES_SAVOIR_ETRE.filter((c) => confirmData.savoirEtre[c.id] !== null && confirmData.savoirEtre[c.id] !== undefined)
                      .map((critere) => {
                        const note = confirmData.savoirEtre[critere.id]!;
                        const { bg, text, border } = couleurSavoirEtre(note);
                        return (
                          <div key={critere.id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: bg, border: `1px solid ${border}` }}
                          >
                            <span>{critere.emoji}</span>
                            <span style={{ color: critere.couleur }}>{critere.libelle}</span>
                            <span className="text-stone-400">:</span>
                            <span className="tabular-nums font-bold" style={{ color: text }}>{note}/10</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Commentaire optionnel */}
              <div>
                <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
                  Commentaire <span className="normal-case font-normal text-stone-300">(optionnel)</span>
                </label>

                {/* Boutons de commentaires rapides */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { label: "✓ Travail soigné",     couleur: "#16a34a" },
                    { label: "✓ Progrès notable",    couleur: "#2563EB" },
                    { label: "✓ Bon comportement",   couleur: "#7C3AED" },
                    { label: "⚠ À revoir",            couleur: "#d97706" },
                    { label: "⚠ Manque de rigueur",  couleur: "#d97706" },
                    { label: "✗ Non validé",          couleur: "#dc2626" },
                    { label: "✗ Absent",              couleur: "#dc2626" },
                    { label: "→ Encouragements",     couleur: "#0891B2" },
                  ].map(({ label, couleur }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setCommentaire((prev) =>
                          prev.trim()
                            ? prev.trim() + " — " + label
                            : label
                        )
                      }
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-80 active:scale-95"
                      style={{
                        background: `${couleur}12`,
                        color: couleur,
                        border: `1px solid ${couleur}30`,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  placeholder="Ex : Bon travail sur la sécurité, à revoir le schéma…"
                  rows={2}
                  maxLength={300}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none transition-all"
                  style={{
                    background: "#FAFAF9",
                    border: `1.5px solid ${commentaire ? "#2563EB" : "#E7E5E4"}`,
                    color: "#1C1917",
                    lineHeight: "1.5",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
                  onBlur={(e) => (e.target.style.borderColor = commentaire ? "#2563EB" : "#E7E5E4")}
                />
                {commentaire && (
                  <p className="text-xs text-stone-400 mt-1 text-right">{commentaire.length}/300</p>
                )}
              </div>

              {/* Note globale */}
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{
                  background: noteSur20 !== null && noteSur20 >= 10 ? "#EFF6FF" : "#FEF2F2",
                  border: `2px solid ${noteSur20 !== null && noteSur20 >= 10 ? "#2563EB" : "#dc2626"}`,
                }}>
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Note globale finale</p>
                  <p className="text-xs text-stone-400 mt-0.5">Moyenne pondérée sur {state.competencesSelectionnees.length} compétence(s)</p>
                </div>
                <div className="text-right">
                  <span
                    className="text-4xl font-black tabular-nums"
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      color: noteSur20 !== null && noteSur20 >= 10 ? "#2563EB" : "#dc2626",
                    }}
                  >
                    {noteSur20 !== null ? noteSur20.toFixed(2) : "—"}
                  </span>
                  <span className="text-sm font-semibold text-stone-400 ml-1">/20</span>
                </div>
              </div>

              {/* Destination */}
              <div className="flex items-center gap-2 text-xs text-stone-500">
                {driveState.connected ? (
                  <>
                    <Cloud size={13} color="#16a34a" />
                    <span>Sera enregistré dans <strong>{fichierNom}</strong> et synchronisé sur Google Drive ({driveState.email})</span>
                  </>
                ) : (
                  <>
                    <Download size={13} color="#57534E" />
                    <span>Sera enregistré dans <strong>{fichierNom}</strong> et téléchargé localement</span>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: "#E7E5E4", background: "#FAFAF9" }}>
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "#F5F5F4", color: "#57534E", border: "1px solid #E7E5E4" }}
              >
                <span>Annuler</span>
                <kbd className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "#E7E5E4", color: "#78716C" }}>Échap</kbd>
              </button>
              <button
                onClick={handleConfirmerEnregistrement}
                disabled={isSaving}
                className="flex-1 flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-60"
                style={{ background: "#2563EB", color: "white" }}
              >
                <div className="flex items-center gap-2">
                  <Check size={15} />
                  {driveState.connected ? "Confirmer & Sync Drive" : "Confirmer & Télécharger"}
                </div>
                <kbd className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>↵ Entrée</kbd>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL GESTION ÉLÈVES ===== */}
      {showGestionEleves && fichierGrille && (
        <GestionEleves
          fichierGrille={fichierGrille}
          fichierNom={fichierNom}
          driveConnecte={driveState.connected}
          onSyncDrive={driveState.connected && driveState.accessToken ? syncWithDrive : undefined}
          onClose={() => setShowGestionEleves(false)}
          onGrilleChange={(nouvelleGrille) => {
            setFichierGrilleLocal(nouvelleGrille);
            onFichierGrilleChange?.(nouvelleGrille);
            const classe = nouvelleGrille.classes.find((c) => c.nom === classeSelectionnee);
            if (classe) {
              setEleves(classe.eleves.map((e) => ({ nom: e.nom, prenom: e.prenom, classe: e.classe })));
            }
          }}
        />
      )}

      {/* ===== MODAL ARCHIVAGE ===== */}
      {showArchiver && fichierGrille && classeSelectionnee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b" style={{ borderColor: "#E7E5E4", background: "#FAFAF9" }}>
              <h2 className="text-lg font-bold" style={{ color: "#78350F" }}>Archiver la classe</h2>
              <p className="text-sm text-stone-600 mt-1">Sauvegarde les données actuelles et réinitialise les notes</p>
            </div>

            {/* Contenu */}
            <div className="px-6 py-4 space-y-3">
              <div className="p-3 rounded-lg" style={{ background: "#FEF3C7", borderLeft: "4px solid #FBBF24" }}>
                <p className="text-sm font-semibold" style={{ color: "#78350F" }}>Classe : <strong>{classeSelectionnee}</strong></p>
                <p className="text-xs text-stone-700 mt-1">• Un fichier de sauvegarde sera créé</p>
                <p className="text-xs text-stone-700">• Les notes actuelles seront conservées dans le fichier Excel</p>
                <p className="text-xs text-stone-700">• Les notes de la classe seront réinitialisées</p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: "#E7E5E4", background: "#FAFAF9" }}>
              <button
                onClick={() => setShowArchiver(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "#F5F5F4", color: "#57534E", border: "1px solid #E7E5E4" }}
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (!fichierGrille || !classeSelectionnee) return;
                  setIsSaving(true);
                  try {
                    const grilleArchivee = await archiverClasse(fichierGrille, classeSelectionnee);
                    setFichierGrilleLocal(grilleArchivee);
                    onFichierGrilleChange?.(grilleArchivee);
                    setShowArchiver(false);
                    toast.success(`Classe "${classeSelectionnee}" archivée avec succès`);
                  } catch (err) {
                    console.error("Erreur lors de l'archivage:", err);
                    toast.error("Erreur lors de l'archivage");
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: "#FBBF24", color: "#78350F", border: "1px solid #F59E0B" }}
              >
                {isSaving ? "Archivage..." : "Archiver"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL DOCUMENT BAC ===== */}
      {showDocBac && fichierGrille && classeSelectionnee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b" style={{ borderColor: "#E7E5E4", background: "#FAFAF9" }}>
              <h2 className="text-lg font-bold" style={{ color: "#BE185D" }}>Générer les documents Bac</h2>
              <p className="text-sm text-stone-600 mt-1">Crée un fichier Excel pour chaque élève de la classe</p>
            </div>

            {/* Contenu */}
            <div className="px-6 py-4 space-y-3">
              <div className="p-3 rounded-lg" style={{ background: "#FCE7F3", borderLeft: "4px solid #EC4899" }}>
                <p className="text-sm font-semibold" style={{ color: "#BE185D" }}>Classe : <strong>{classeSelectionnee}</strong></p>
                <p className="text-xs text-stone-700 mt-1">• Un fichier par élève sera téléchargé</p>
                <p className="text-xs text-stone-700">• Les données seront insérées dans le template Bac Pro MELEC</p>
                <p className="text-xs text-stone-700">• Les notes des épreuves E2, E31, E32 seront calculées</p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: "#E7E5E4", background: "#FAFAF9" }}>
              <button
                onClick={() => setShowDocBac(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "#F5F5F4", color: "#57534E", border: "1px solid #E7E5E4" }}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowDocBac(false);
                  setShowNumCandidats(true);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "#EC4899", color: "white", border: "1px solid #BE185D" }}
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL NUMÉROS DE CANDIDATS ===== */}
      {showNumCandidats && fichierGrille && classeSelectionnee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b" style={{ borderColor: "#E7E5E4", background: "#FAFAF9" }}>
              <h2 className="text-lg font-bold" style={{ color: "#BE185D" }}>Numéros de candidats</h2>
              <p className="text-sm text-stone-600 mt-1">Saisir le numéro de candidat pour chaque élève</p>
            </div>

            {/* Contenu */}
            <div className="px-6 py-4 space-y-3 max-h-96 overflow-y-auto">
              {fichierGrille.classes
                .find((c) => c.nom === classeSelectionnee)
                ?.eleves.map((eleve) => {
                  const key = `${eleve.nom.toUpperCase()} ${eleve.prenom}`;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-stone-900">{eleve.prenom} {eleve.nom}</p>
                      </div>
                      <input
                        type="text"
                        placeholder="Ex: A2026 0001 0001"
                        value={numeroCandidats[key] || ""}
                        onChange={(e) => {
                          setNumeroCandidats({
                            ...numeroCandidats,
                            [key]: e.target.value,
                          });
                        }}
                        className="flex-1 px-3 py-2 rounded-lg text-sm border"
                        style={{ borderColor: "#E7E5E4", background: "#FAFAF9" }}
                      />
                    </div>
                  );
                }) || []}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: "#E7E5E4", background: "#FAFAF9" }}>
              <button
                onClick={() => setShowNumCandidats(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "#F5F5F4", color: "#57534E", border: "1px solid #E7E5E4" }}
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  if (!fichierGrille || !classeSelectionnee) return;
                  setIsSaving(true);
                  try {
                    // Récupérer les élèves de la classe
                    const classeData = fichierGrille.classes.find((c) => c.nom === classeSelectionnee);
                    if (!classeData) throw new Error("Classe non trouvée");

                    // Générer les documents avec les numéros de candidats saisis
                    for (let i = 0; i < classeData.eleves.length; i++) {
                      const eleve = classeData.eleves[i];
                      const key = `${eleve.nom.toUpperCase()} ${eleve.prenom}`;
                      const numeroCandidat = numeroCandidats[key] || `A2026 0000 ${String(i + 1).padStart(4, "0")}`;

                      const { extraireDonneesBacEleve, genererDocumentBacEleve } = await import("@/lib/bacProMelecExport");
                      const donnees = extraireDonneesBacEleve(
                        fichierGrille,
                        classeSelectionnee,
                        eleve.nom,
                        eleve.prenom,
                        numeroCandidat
                      );

                      const wb = await genererDocumentBacEleve("/bac-pro-melec-template.xlsx", donnees);

                      // Télécharger le fichier
                      const { saveAs } = await import("file-saver");
                      const XLSX = await import("xlsx");
                      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
                      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                      const filename = `Bac_${classeSelectionnee}_${eleve.nom}_${eleve.prenom}.xlsx`;
                      saveAs(blob, filename);

                      // Petit délai pour éviter les problèmes de téléchargement simultané
                      await new Promise((resolve) => setTimeout(resolve, 500));
                    }

                    setShowNumCandidats(false);
                    toast.success(`Documents Bac générés pour la classe "${classeSelectionnee}"`);
                  } catch (err) {
                    console.error("Erreur lors de la génération:", err);
                    toast.error("Erreur lors de la génération des documents");
                  } finally {
                    setIsSaving(false);
                  }
                }}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: "#EC4899", color: "white", border: "1px solid #BE185D" }}
              >
                {isSaving ? "Génération..." : "Générer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
