import { useState, useEffect } from "react";
import { Trash2, Download, Upload } from "lucide-react";
import {
  listerEvaluationsSauvegardees,
  supprimerEvaluation,
  exporterEvaluation,
  importerEvaluation,
} from "@/lib/evaluationStorage";
import { EvaluationSauvegardee } from "@/lib/excelUtils";
import { toast } from "sonner";

interface ChargerEvaluationSauvegardeeProps {
  onCharger: (evaluation: EvaluationSauvegardee) => void;
  onClose: () => void;
}

export default function ChargerEvaluationSauvegardee({
  onCharger,
  onClose,
}: ChargerEvaluationSauvegardeeProps) {
  const [evaluations, setEvaluations] = useState<EvaluationSauvegardee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    chargerListe();
  }, []);

  const chargerListe = () => {
    const liste = listerEvaluationsSauvegardees();
    setEvaluations(liste);
  };

  const handleCharger = () => {
    if (!selectedId) {
      toast.error("Veuillez sélectionner une évaluation");
      return;
    }

    const evaluation = evaluations.find((e) => e.id === selectedId);
    if (evaluation) {
      onCharger(evaluation);
      toast.success("Évaluation chargée");
      onClose();
    }
  };

  const handleSupprimer = (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette évaluation ?")) {
      if (supprimerEvaluation(id)) {
        toast.success("Évaluation supprimée");
        chargerListe();
        if (selectedId === id) {
          setSelectedId(null);
        }
      }
    }
  };

  const handleExporter = (id: string) => {
    const json = exporterEvaluation(id);
    if (json) {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evaluation_${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Évaluation exportée");
    }
  };

  const handleImporter = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          const json = event.target.result;
          const nouvelId = importerEvaluation(json);
          if (nouvelId) {
            toast.success("Évaluation importée");
            chargerListe();
          } else {
            toast.error("Erreur lors de l'import");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Charger une évaluation sauvegardée</h2>

        {evaluations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Aucune évaluation sauvegardée</p>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {evaluations.map((evaluation) => (
              <div
                key={evaluation.id}
                onClick={() => setSelectedId(evaluation.id)}
                className={`p-4 border-2 rounded cursor-pointer transition-colors ${
                  selectedId === evaluation.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{evaluation.nomFichier}</h3>
                    <p className="text-sm text-gray-600">
                      Classe: <strong>{evaluation.classe}</strong> • Élèves:{" "}
                      <strong>{Object.keys(evaluation.eleves).length}</strong>
                    </p>
                    <p className="text-xs text-gray-500">
                      Modifiée:{" "}
                      {new Date(evaluation.dateModification).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExporter(evaluation.id);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Exporter"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSupprimer(evaluation.id);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 justify-between">
          <button
            onClick={handleImporter}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            <Upload size={16} />
            Importer une évaluation
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleCharger}
              disabled={!selectedId}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Charger
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
