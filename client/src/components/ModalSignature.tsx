import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  onSignature: (signatureData: string, isPad: boolean) => void;
}

export function ModalSignature({ open, onClose, onSignature }: Props) {
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const [isPad, setIsPad] = useState(false);

  const handleClear = () => {
    sigCanvasRef.current?.clear();
  };

  const handleSave = () => {
    const signatureData = sigCanvasRef.current?.toDataURL('image/png');
    if (signatureData) {
      onSignature(signatureData, isPad);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Signature Numérique</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => setIsPad(false)}
              variant={!isPad ? 'default' : 'outline'}
              className="flex-1"
            >
              🖱️ Signature à l'écran
            </Button>
            <Button
              onClick={() => setIsPad(true)}
              variant={isPad ? 'default' : 'outline'}
              className="flex-1"
            >
              📱 Signature au PAD
            </Button>
          </div>

          <div className="border-2 border-gray-300 rounded-lg bg-white overflow-hidden">
            <SignatureCanvas
              ref={sigCanvasRef}
              canvasProps={{
                width: 600,
                height: 300,
                className: 'w-full cursor-crosshair',
              }}
              backgroundColor="white"
              penColor="black"
              velocityFilterWeight={0.7}
              minWidth={1}
              maxWidth={2}
            />
          </div>

          <p className="text-sm text-gray-600">
            {isPad ? 'Signez sur votre PAD' : 'Signez avec votre souris'}
          </p>
        </div>

        <DialogFooter>
          <Button onClick={handleClear} variant="outline">
            Effacer
          </Button>
          <Button onClick={handleSave} className="bg-blue-500 hover:bg-blue-600">
            Valider la signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
