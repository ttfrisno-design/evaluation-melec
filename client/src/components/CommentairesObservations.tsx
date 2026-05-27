import { useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { COMMENTAIRES_PRESETS } from "@/lib/excelUtils";

interface CommentairesObservationsProps {
  observations: string[];
  commentairesPersonnalises: string[];
  onObservationsChange: (observations: string[]) => void;
  onCommentairesPersonnalisesChange: (commentaires: string[]) => void;
}

export default function CommentairesObservations({
  observations,
  commentairesPersonnalises,
  onObservationsChange,
  onCommentairesPersonnalisesChange,
}: CommentairesObservationsProps) {
  const [nouveauCommentaire, setNouveauCommentaire] = useState("");
  const [showInput, setShowInput] = useState(false);

  const tousLesCommentaires = [...COMMENTAIRES_PRESETS, ...commentairesPersonnalises];

  const toggleObservation = (observation: string) => {
    if (observations.includes(observation)) {
      onObservationsChange(observations.filter((o) => o !== observation));
    } else {
      onObservationsChange([...observations, observation]);
    }
  };

  const ajouterCommentaire = () => {
    if (nouveauCommentaire.trim() && !tousLesCommentaires.includes(nouveauCommentaire)) {
      onCommentairesPersonnalisesChange([...commentairesPersonnalises, nouveauCommentaire]);
      setNouveauCommentaire("");
      setShowInput(false);
    }
  };

  const supprimerCommentaire = (commentaire: string) => {
    if (commentairesPersonnalises.includes(commentaire)) {
      onCommentairesPersonnalisesChange(
        commentairesPersonnalises.filter((c) => c !== commentaire)
      );
      // Supprimer aussi des observations
      onObservationsChange(observations.filter((o) => o !== commentaire));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Observations et commentaires</h3>
        <div className="space-y-2">
          {tousLesCommentaires.map((commentaire) => (
            <div key={commentaire} className="flex items-center gap-2">
              <button
                onClick={() => toggleObservation(commentaire)}
                className={`flex-1 text-left px-3 py-2 rounded border-2 transition-colors ${
                  observations.includes(commentaire)
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      observations.includes(commentaire)
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300"
                    }`}
                  >
                    {observations.includes(commentaire) && (
                      <Check size={16} className="text-white" />
                    )}
                  </div>
                  <span className="text-sm">{commentaire}</span>
                </div>
              </button>
              {commentairesPersonnalises.includes(commentaire) && (
                <button
                  onClick={() => supprimerCommentaire(commentaire)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        {!showInput ? (
          <button
            onClick={() => setShowInput(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded border border-blue-200"
          >
            <Plus size={16} />
            Ajouter un commentaire personnalisé
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={nouveauCommentaire}
              onChange={(e) => setNouveauCommentaire(e.target.value)}
              placeholder="Nouveau commentaire..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => {
                if (e.key === "Enter") ajouterCommentaire();
              }}
              autoFocus
            />
            <button
              onClick={ajouterCommentaire}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Ajouter
            </button>
            <button
              onClick={() => {
                setShowInput(false);
                setNouveauCommentaire("");
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
