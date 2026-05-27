import { useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { toast } from "sonner";

// Présets de commentaires
const PRESETS = [
  "Travail satisfaisant",
  "Travail insuffisant",
  "Méthode maîtrisée",
  "Méthode non maîtrisée",
  "Manque de connaissances",
  "Respecte les consignes de sécurité",
  "Consignes de sécurité respectées mais en cours d'évaluation",
];

interface CommentairesObservationsInlineProps {
  commentaires: string[];
  onCommentairesChange: (commentaires: string[]) => void;
}

export default function CommentairesObservationsInline({
  commentaires,
  onCommentairesChange,
}: CommentairesObservationsInlineProps) {
  const [newCommentaire, setNewCommentaire] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleAjouterPreset = (preset: string) => {
    if (!commentaires.includes(preset)) {
      const updated = [...commentaires, preset];
      onCommentairesChange(updated);
      toast.success(`"${preset}" ajouté`);
    } else {
      toast.info(`"${preset}" est déjà présent`);
    }
  };

  const handleAjouterPersonnalise = () => {
    if (newCommentaire.trim()) {
      if (!commentaires.includes(newCommentaire.trim())) {
        const updated = [...commentaires, newCommentaire.trim()];
        onCommentairesChange(updated);
        setNewCommentaire("");
        setShowInput(false);
        toast.success("Commentaire ajouté");
      } else {
        toast.info("Ce commentaire existe déjà");
      }
    }
  };

  const handleSupprimer = (index: number) => {
    const updated = commentaires.filter((_, i) => i !== index);
    onCommentairesChange(updated);
    toast.success("Commentaire supprimé");
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Commentaires & Observations</h3>

      {/* Commentaires actuels */}
      {commentaires.length > 0 && (
        <div className="space-y-2">
          {commentaires.map((commentaire, index) => (
            <div
              key={index}
              className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg"
            >
              <span className="text-sm text-gray-700">{commentaire}</span>
              <button
                onClick={() => handleSupprimer(index)}
                className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Ajouter un commentaire personnalisé */}
      {showInput ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newCommentaire}
            onChange={(e) => setNewCommentaire(e.target.value)}
            placeholder="Saisir un commentaire..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAjouterPersonnalise();
              } else if (e.key === "Escape") {
                setShowInput(false);
                setNewCommentaire("");
              }
            }}
            autoFocus
          />
          <button
            onClick={handleAjouterPersonnalise}
            className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors"
          >
            <Check size={16} />
          </button>
          <button
            onClick={() => {
              setShowInput(false);
              setNewCommentaire("");
            }}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
        >
          <Plus size={14} /> Ajouter un commentaire personnalisé
        </button>
      )}

      {/* Présets */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase">Présets</p>
        <div className="grid grid-cols-1 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => handleAjouterPreset(preset)}
              disabled={commentaires.includes(preset)}
              className="text-left px-3 py-2 text-sm border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
