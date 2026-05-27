// Hook principal de gestion de l'évaluation MELEC
// Calcul : note /20 par compétence + note globale pondérée /20
import { useState, useCallback } from "react";
import { COMPETENCES, calculerNoteGlobale, calculerNoteCompetence } from "@/lib/competences";
import { type NotesSavoirEtre, calculerMoyenneSavoirEtre } from "@/lib/savoirEtre";

export interface Eleve {
  nom: string;
  prenom: string;
  classe?: string;
}

export interface EvaluationState {
  eleves: Eleve[];
  eleveSelectionne: Eleve | null;
  equipement: string;
  date: string;
  competencesSelectionnees: string[]; // codes C1, C2, ...
  notes: Record<string, number | null>; // critereId -> note brute saisie
  savoirEtre: NotesSavoirEtre; // id -> note 1-10
  commentairesPersonnalises: string[]; // liste des commentaires et observations
}

export function useEvaluation() {
  const [state, setState] = useState<EvaluationState>({
    eleves: [],
    eleveSelectionne: null,
    equipement: "",
    date: new Date().toISOString().split("T")[0],
    competencesSelectionnees: [],
    notes: {},
    savoirEtre: {},
    commentairesPersonnalises: [],
  });

  const setEleves = useCallback((eleves: Eleve[]) => {
    setState((s) => ({ ...s, eleves }));
  }, []);

  const setEleveSelectionne = useCallback((eleve: Eleve | null) => {
    setState((s) => ({ ...s, eleveSelectionne: eleve }));
  }, []);

  const setEquipement = useCallback((equipement: string) => {
    setState((s) => ({ ...s, equipement }));
  }, []);

  const setDate = useCallback((date: string) => {
    setState((s) => ({ ...s, date }));
  }, []);

  const toggleCompetence = useCallback((code: string) => {
    setState((s) => {
      const selected = s.competencesSelectionnees.includes(code)
        ? s.competencesSelectionnees.filter((c) => c !== code)
        : [...s.competencesSelectionnees, code];
      return { ...s, competencesSelectionnees: selected };
    });
  }, []);

  const setNote = useCallback((critereId: string, note: number | null) => {
    setState((s) => ({
      ...s,
      notes: { ...s.notes, [critereId]: note },
    }));
  }, []);

  const setSavoirEtre = useCallback((id: string, val: number | null) => {
    setState((s) => ({ ...s, savoirEtre: { ...s.savoirEtre, [id]: val } }));
  }, []);

  const setCommentairesPersonnalises = useCallback((commentaires: string[]) => {
    setState((s) => ({ ...s, commentairesPersonnalises: commentaires }));
  }, []);

  const resetNotes = useCallback(() => {
    setState((s) => ({ ...s, notes: {}, competencesSelectionnees: [], savoirEtre: {}, commentairesPersonnalises: [] }));
  }, []);

  const resetAll = useCallback(() => {
    setState((s) => ({
      ...s,
      eleveSelectionne: null,
      equipement: "",
      competencesSelectionnees: [],
      notes: {},
      savoirEtre: {},
      commentairesPersonnalises: [],
      date: new Date().toISOString().split("T")[0],
    }));
  }, []);

  // ── Calculs dérivés ──────────────────────────────────────────

  // Compétences actives (objets complets)
  const competencesActives = COMPETENCES.filter((c) =>
    state.competencesSelectionnees.includes(c.code)
  );

  // Note globale pondérée sur 20 + détails par compétence
  const { noteGlobale, notesParComp, totalCoefs } = calculerNoteGlobale(
    state.competencesSelectionnees,
    state.notes
  );

  // Détails enrichis par compétence (pour l'affichage)
  const notesParCompetence = competencesActives.map((comp) => {
    const detail = notesParComp.find((n) => n.code === comp.code);
    return {
      comp,
      obtenu: detail?.obtenu ?? 0,
      max: detail?.max ?? comp.noteMax,
      nbNotes: detail?.nbNotes ?? 0,
      sur20: detail?.sur20 ?? null,
      coef: comp.coef,
    };
  });

  // Totaux bruts (pour l'affichage de la barre de progression)
  const totalObtenu = notesParComp.reduce((s, n) => s + n.obtenu, 0);
  const totalMax = notesParComp.reduce((s, n) => s + n.max, 0);

  const moyenneSavoirEtre = calculerMoyenneSavoirEtre(state.savoirEtre);

  return {
    state,
    setEleves,
    setEleveSelectionne,
    setEquipement,
    setDate,
    toggleCompetence,
    setNote,
    setSavoirEtre,
    setCommentairesPersonnalises,
    resetNotes,
    resetAll,
    // Note globale pondérée sur 20
    noteSur20: noteGlobale,
    totalObtenu,
    totalMax,
    totalCoefs,
    competencesActives,
    notesParCompetence,
    moyenneSavoirEtre,
  };
}
