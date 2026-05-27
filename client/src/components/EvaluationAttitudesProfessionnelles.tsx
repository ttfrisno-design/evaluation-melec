import React from 'react';
import { ATTITUDES_PROFESSIONNELLES } from '@/lib/excelUtils';
import { Card } from '@/components/ui/card';

interface Props {
  attitudes: Record<string, number | null>;
  onChange: (id: string, note: number | null) => void;
}

export function EvaluationAttitudesProfessionnelles({ attitudes, onChange }: Props) {
  return (
    <Card className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
      <h3 className="text-lg font-bold text-amber-900 mb-4">Évaluation des Attitudes Professionnelles</h3>
      <p className="text-sm text-amber-700 mb-6">Cocher une seule case par aptitude évaluée (1 = Insuffisant, 5 = Excellent)</p>
      
      <div className="space-y-4">
        {ATTITUDES_PROFESSIONNELLES.map((attitude) => (
          <div key={attitude.id} className="border border-amber-200 rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-amber-900">{attitude.nom}</h4>
                <p className="text-sm text-amber-700">{attitude.description}</p>
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5].map((note) => (
                <button
                  key={note}
                  onClick={() => onChange(attitude.id, attitudes[attitude.id] === note ? null : note)}
                  className={`w-12 h-12 rounded-lg font-semibold transition-all ${
                    attitudes[attitude.id] === note
                      ? 'bg-amber-500 text-white shadow-lg scale-105'
                      : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  }`}
                >
                  {note}
                </button>
              ))}
            </div>
            
            {attitudes[attitude.id] && (
              <div className="mt-2 text-sm text-amber-700">
                Note sélectionnée: {attitudes[attitude.id]}/5
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
