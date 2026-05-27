import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AttestationPFMP } from '@/lib/excelUtils';

interface Props {
  attestation: Partial<AttestationPFMP>;
  onChange: (attestation: Partial<AttestationPFMP>) => void;
  onSignature: () => void;
  onPhotoTampon: () => void;
}

export function FormulairePFMP({ attestation, onChange, onSignature, onPhotoTampon }: Props) {
  return (
    <div className="space-y-6">
      {/* En-tête */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
        <h2 className="text-2xl font-bold text-blue-900 mb-2">ATTESTATION DE PFMP</h2>
        <p className="text-sm text-blue-700">
          Conformément à l'article D. 124-9 du code de l'Éducation, une attestation de stage est délivrée par l'organisme d'accueil à tout élève.
        </p>
      </Card>

      {/* L'entreprise */}
      <Card className="p-6 border-l-4 border-l-blue-500">
        <h3 className="text-lg font-bold text-gray-900 mb-4">L'entreprise :</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nom :</label>
            <Input
              value={attestation.entrepriseNom || ''}
              onChange={(e) => onChange({ ...attestation, entrepriseNom: e.target.value })}
              placeholder="Nom de l'entreprise"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Adresse :</label>
            <Input
              value={attestation.entrepriseAdresse || ''}
              onChange={(e) => onChange({ ...attestation, entrepriseAdresse: e.target.value })}
              placeholder="Adresse"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Représenté(e) par :</label>
            <Input
              value={attestation.entrepriseRepresentant || ''}
              onChange={(e) => onChange({ ...attestation, entrepriseRepresentant: e.target.value })}
              placeholder="Nom du représentant"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Fonction :</label>
            <Input
              value={attestation.entrepriseFonction || ''}
              onChange={(e) => onChange({ ...attestation, entrepriseFonction: e.target.value })}
              placeholder="Fonction"
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Élève */}
      <Card className="p-6 border-l-4 border-l-green-500">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Atteste que l'élève désigné ci-dessous :</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nom :</label>
            <Input
              value={attestation.eleveNom || ''}
              onChange={(e) => onChange({ ...attestation, eleveNom: e.target.value })}
              placeholder="Nom de l'élève"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Prénom :</label>
            <Input
              value={attestation.elevePrenom || ''}
              onChange={(e) => onChange({ ...attestation, elevePrenom: e.target.value })}
              placeholder="Prénom"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Né le :</label>
            <Input
              value={attestation.eleveNumero || ''}
              onChange={(e) => onChange({ ...attestation, eleveNumero: e.target.value })}
              placeholder="Numéro candidat"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Classe :</label>
            <Input
              value={attestation.eleveClasse || ''}
              onChange={(e) => onChange({ ...attestation, eleveClasse: e.target.value })}
              placeholder="Classe"
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Établissement */}
      <Card className="p-6 border-l-4 border-l-purple-500">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Scolarisé dans l'établissement ci-après :</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nom :</label>
            <Input
              value={attestation.ecoleNom || ''}
              onChange={(e) => onChange({ ...attestation, ecoleNom: e.target.value })}
              placeholder="Nom de l'établissement"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Adresse :</label>
            <Input
              value={attestation.ecoleAdresse || ''}
              onChange={(e) => onChange({ ...attestation, ecoleAdresse: e.target.value })}
              placeholder="Adresse"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Représenté par :</label>
            <Input
              value={attestation.ecoleRepresentant || ''}
              onChange={(e) => onChange({ ...attestation, ecoleRepresentant: e.target.value })}
              placeholder="Nom du représentant"
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Dates */}
      <Card className="p-6 border-l-4 border-l-orange-500">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Période de formation :</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Date de début :</label>
            <Input
              type="date"
              value={attestation.dateDebut || ''}
              onChange={(e) => onChange({ ...attestation, dateDebut: e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Date de fin :</label>
            <Input
              type="date"
              value={attestation.dateFin || ''}
              onChange={(e) => onChange({ ...attestation, dateFin: e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Durée (jours) :</label>
            <Input
              type="number"
              value={attestation.dureeJours || ''}
              onChange={(e) => onChange({ ...attestation, dureeJours: parseInt(e.target.value) || 0 })}
              placeholder="Nombre de jours"
              className="w-full"
            />
          </div>
        </div>
      </Card>

      {/* Observations */}
      <Card className="p-6 border-l-4 border-l-red-500">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Observations :</h3>
        <Textarea
          value={attestation.observations || ''}
          onChange={(e) => onChange({ ...attestation, observations: e.target.value })}
          placeholder="Observations et remarques"
          className="w-full min-h-24"
        />
      </Card>

      {/* Signature et tampon */}
      <Card className="p-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300">
        <h3 className="text-lg font-bold text-yellow-900 mb-4">Signature et tampon :</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={onSignature}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3"
          >
            ✍️ Signer (Écran ou PAD)
          </Button>
          <Button
            onClick={onPhotoTampon}
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3"
          >
            📷 Prendre photo du tampon
          </Button>
        </div>
        {attestation.signatureData && (
          <div className="mt-4 p-3 bg-white rounded border border-yellow-200">
            <p className="text-sm text-yellow-900 font-semibold">✓ Signature capturée</p>
          </div>
        )}
        {attestation.tamponPhoto && (
          <div className="mt-4 p-3 bg-white rounded border border-yellow-200">
            <p className="text-sm text-yellow-900 font-semibold">✓ Photo du tampon capturée</p>
          </div>
        )}
      </Card>
    </div>
  );
}
