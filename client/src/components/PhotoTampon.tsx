import React, { useRef, useState } from 'react';
import { Camera, X, Download } from 'lucide-react';

interface PhotoTamponProps {
  onPhotoChange: (photo: string) => void;
}

export const PhotoTampon: React.FC<PhotoTamponProps> = ({ onPhotoChange }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [photoCapture, setPhotoCapture] = useState<string>('');

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error('Erreur accès caméra:', err);
      alert('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);

    const photo = canvasRef.current.toDataURL('image/jpeg');
    setPhotoCapture(photo);
    onPhotoChange(photo);
    stopCamera();
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsCameraActive(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const photo = event.target?.result as string;
      setPhotoCapture(photo);
      onPhotoChange(photo);
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotoCapture('');
    onPhotoChange('');
  };

  return (
    <div className="space-y-3">
      {!photoCapture ? (
        <>
          {!isCameraActive ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={startCamera}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <Camera size={18} />
                Ouvrir la caméra
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                <Download size={18} />
                Importer une photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg bg-black"
                style={{ maxHeight: '300px' }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  <Camera size={18} />
                  Capturer la photo
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  <X size={18} />
                  Annuler
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100">
            <img src={photoCapture} alt="Tampon" className="w-full max-h-64 object-contain" />
          </div>
          <button
            type="button"
            onClick={clearPhoto}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg font-medium hover:bg-gray-400 transition-colors"
          >
            <X size={18} />
            Supprimer la photo
          </button>
        </div>
      )}
    </div>
  );
};
