// Hook principal de gestion de l'évaluation MELEC
import { useState, useCallback } from "react";
import { COMPETENCES, calculerNoteSur20, calculerNoteCompetence } from "@/lib/competences";

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
  notes: Record<string, number | null>; // critereId -> note
}

export function useEvaluation() {
  const [state, setState] = useState<EvaluationState>({
    eleves: [],
    eleveSelectionne: null,
    equipement: "",
    date: new Date().toISOString().split("T")[0],
    competencesSelectionnees: [],
    notes: {},
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

  const resetNotes = useCallback(() => {
    setState((s) => ({ ...s, notes: {}, competencesSelectionnees: [] }));
  }, []);

  const resetAll = useCallback(() => {
    setState((s) => ({
      ...s,
      eleveSelectionne: null,
      equipement: "",
      competencesSelectionnees: [],
      notes: {},
      date: new Date().toISOString().split("T")[0],
    }));
  }, []);

  // Calculs dérivés
  const { noteSur20, totalObtenu, totalMax } = calculerNoteSur20(
    state.competencesSelectionnees,
    state.notes
  );

  const competencesActives = COMPETENCES.filter((c) =>
    state.competencesSelectionnees.includes(c.code)
  );

  const notesParCompetence = competencesActives.map((comp) => ({
    comp,
    ...calculerNoteCompetence(comp, state.notes),
  }));

  return {
    state,
    setEleves,
    setEleveSelectionne,
    setEquipement,
    setDate,
    toggleCompetence,
    setNote,
    resetNotes,
    resetAll,
    noteSur20,
    totalObtenu,
    totalMax,
    competencesActives,
    notesParCompetence,
  };
}
