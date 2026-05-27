import { EvaluationSauvegardee, EleveEvaluationSauvegardee, BlocEvaluation } from "./excelUtils";

const STORAGE_KEY_PREFIX = "melec_eval_";

/**
 * Génère un ID unique pour une évaluation sauvegardée
 */
function genererIdEvaluation(): string {
  return `eval_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sauvegarde une évaluation en cours dans le localStorage
 */
export function sauvegarderEvaluation(
  classe: string,
  eleves: Record<string, EleveEvaluationSauvegardee>,
  nomFichier: string
): string {
  const id = genererIdEvaluation();
  const evaluation: EvaluationSauvegardee = {
    id,
    nomFichier,
    dateCreation: Date.now(),
    dateModification: Date.now(),
    classe,
    eleves,
  };

  try {
    const key = `${STORAGE_KEY_PREFIX}${id}`;
    localStorage.setItem(key, JSON.stringify(evaluation));
    return id;
  } catch (e) {
    console.error("Erreur lors de la sauvegarde:", e);
    throw new Error("Impossible de sauvegarder l'évaluation");
  }
}

/**
 * Charge une évaluation sauvegardée depuis le localStorage
 */
export function chargerEvaluation(id: string): EvaluationSauvegardee | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}${id}`;
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as EvaluationSauvegardee;
  } catch (e) {
    console.error("Erreur lors du chargement:", e);
    return null;
  }
}

/**
 * Liste toutes les évaluations sauvegardées
 */
export function listerEvaluationsSauvegardees(): EvaluationSauvegardee[] {
  const evaluations: EvaluationSauvegardee[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          evaluations.push(JSON.parse(data) as EvaluationSauvegardee);
        }
      }
    }
  } catch (e) {
    console.error("Erreur lors de la lecture des évaluations:", e);
  }

  // Trier par date de modification (plus récentes d'abord)
  return evaluations.sort((a, b) => b.dateModification - a.dateModification);
}

/**
 * Supprime une évaluation sauvegardée
 */
export function supprimerEvaluation(id: string): boolean {
  try {
    const key = `${STORAGE_KEY_PREFIX}${id}`;
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error("Erreur lors de la suppression:", e);
    return false;
  }
}

/**
 * Met à jour la date de modification d'une évaluation
 */
export function mettreAJourEvaluation(
  id: string,
  eleves: Record<string, EleveEvaluationSauvegardee>
): boolean {
  const evaluation = chargerEvaluation(id);
  if (!evaluation) return false;

  evaluation.eleves = eleves;
  evaluation.dateModification = Date.now();

  try {
    const key = `${STORAGE_KEY_PREFIX}${id}`;
    localStorage.setItem(key, JSON.stringify(evaluation));
    return true;
  } catch (e) {
    console.error("Erreur lors de la mise à jour:", e);
    return false;
  }
}

/**
 * Exporte une évaluation sauvegardée en JSON
 */
export function exporterEvaluation(id: string): string | null {
  const evaluation = chargerEvaluation(id);
  if (!evaluation) return null;

  try {
    return JSON.stringify(evaluation, null, 2);
  } catch (e) {
    console.error("Erreur lors de l'export:", e);
    return null;
  }
}

/**
 * Importe une évaluation depuis un JSON
 */
export function importerEvaluation(jsonData: string): string | null {
  try {
    const evaluation = JSON.parse(jsonData) as EvaluationSauvegardee;
    
    // Valider la structure
    if (!evaluation.classe || !evaluation.eleves || !evaluation.nomFichier) {
      throw new Error("Structure d'évaluation invalide");
    }

    // Générer un nouvel ID pour éviter les conflits
    const nouvelId = genererIdEvaluation();
    evaluation.id = nouvelId;
    evaluation.dateCreation = Date.now();
    evaluation.dateModification = Date.now();

    const key = `${STORAGE_KEY_PREFIX}${nouvelId}`;
    localStorage.setItem(key, JSON.stringify(evaluation));
    return nouvelId;
  } catch (e) {
    console.error("Erreur lors de l'import:", e);
    return null;
  }
}
