import React, { useRef, useState } from 'react';
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
  onPhoto: (photoData: string) => void;
}

export function ModalPhotoTampon({ open, onClose, onPhoto }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Erreur accès caméra:', err);
      alert('Impossible d\'accéder à la caméra. Utilisez l\'option d\'import de fichier.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const photoData = canvasRef.current.toDataURL('image/jpeg');
        setCapturedPhoto(photoData);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const photoData = event.target?.result as string;
        setCapturedPhoto(photoData);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (capturedPhoto) {
      onPhoto(capturedPhoto);
      stopCamera();
      setCapturedPhoto(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { stopCamera(); onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Photo du Tampon de l'Entreprise</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!capturedPhoto ? (
            <>
              {!stream ? (
                <Button onClick={startCamera} className="w-full bg-green-500 hover:bg-green-600">
                  📷 Ouvrir la caméra
                </Button>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg border-2 border-gray-300"
                  />
                  <div className="flex gap-2">
                    <Button onClick={capturePhoto} className="flex-1 bg-blue-500 hover:bg-blue-600">
                      Prendre une photo
                    </Button>
                    <Button onClick={stopCamera} variant="outline" className="flex-1">
                      Fermer caméra
                    </Button>
                  </div>
                </>
              )}

              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full"
                >
                  📁 Importer une photo
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border-2 border-gray-300 overflow-hidden">
                <img src={capturedPhoto} alt="Tampon" className="w-full" />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setCapturedPhoto(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Reprendre
                </Button>
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-green-500 hover:bg-green-600"
                >
                  Valider
                </Button>
              </div>
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        <DialogFooter>
          <Button onClick={() => { stopCamera(); onClose(); }} variant="outline">
            Annuler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
