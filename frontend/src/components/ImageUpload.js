import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import imageCompression from 'browser-image-compression';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { X, Upload, Loader2, Crop, Check, RotateCcw, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ImageUpload({ images = [], onChange, maxImages = 10 }) {
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  
  // Estado para o editor de crop
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [crop, setCrop] = useState({ unit: '%', width: 100, height: 100, x: 0, y: 0 });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [useOriginal, setUseOriginal] = useState(true);
  
  const imgRef = useRef(null);

  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 0.3,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/jpeg',
      preserveExif: false
    };

    try {
      const compressedFile = await imageCompression(file, options);
      console.log(
        `Imagem comprimida: ${(file.size / 1024).toFixed(2)}KB -> ${(compressedFile.size / 1024).toFixed(2)}KB`
      );
      return compressedFile;
    } catch (error) {
      console.error('Erro ao comprimir imagem:', error);
      throw error;
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    
    if (images.length + files.length > maxImages) {
      toast.error(`Máximo de ${maxImages} imagens permitido`);
      return;
    }

    if (files.length === 0) return;

    // Para múltiplas imagens, processar em sequência
    setPendingFiles(files.slice(1)); // Guardar as próximas
    openCropDialog(files[0]); // Abrir primeira para crop
  };

  const openCropDialog = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCurrentImage(reader.result);
      setCurrentFile(file);
      setCrop({ unit: '%', width: 100, height: 100, x: 0, y: 0 });
      setCompletedCrop(null);
      setUseOriginal(true);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const onImageLoad = useCallback((e) => {
    imgRef.current = e.currentTarget;
  }, []);

  const getCroppedImg = async (image, crop) => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    const pixelCrop = {
      x: crop.x * scaleX,
      y: crop.y * scaleY,
      width: crop.width * scaleX,
      height: crop.height * scaleY
    };
    
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], currentFile?.name || 'cropped.jpg', { type: 'image/jpeg' });
          resolve(file);
        }
      }, 'image/jpeg', 0.92);
    });
  };

  const handleConfirmCrop = async () => {
    if (!imgRef.current) return;

    setCompressing(true);
    setCropDialogOpen(false);
    
    try {
      let fileToUpload;
      
      if (useOriginal || !completedCrop || (completedCrop.width === 0 && completedCrop.height === 0)) {
        // Usar imagem original sem crop
        fileToUpload = currentFile;
      } else {
        // Aplicar o crop
        fileToUpload = await getCroppedImg(imgRef.current, completedCrop);
      }
      
      // Comprimir a imagem
      const compressedFile = await compressImage(fileToUpload);
      
      // Fazer upload
      await uploadSingleImage(compressedFile);
      
      // Processar próxima imagem se houver
      if (pendingFiles.length > 0) {
        const nextFile = pendingFiles[0];
        setPendingFiles(pendingFiles.slice(1));
        openCropDialog(nextFile);
      }
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      toast.error('Erro ao processar imagem');
    } finally {
      setCompressing(false);
    }
  };

  const handleSkipCrop = async () => {
    // Usar imagem original sem edição
    setCompressing(true);
    setCropDialogOpen(false);
    
    try {
      const compressedFile = await compressImage(currentFile);
      await uploadSingleImage(compressedFile);
      
      // Processar próxima imagem se houver
      if (pendingFiles.length > 0) {
        const nextFile = pendingFiles[0];
        setPendingFiles(pendingFiles.slice(1));
        openCropDialog(nextFile);
      }
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      toast.error('Erro ao processar imagem');
    } finally {
      setCompressing(false);
    }
  };

  const uploadSingleImage = async (file) => {
    setUploading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Usuário não autenticado. Por favor, faça login novamente.');
      }
      const user = session.user;

      const fileExt = 'jpg';
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('offer-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('offer-images')
        .getPublicUrl(data.path);

      onChange([...images, publicUrl]);
      toast.success('Imagem enviada com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (e, urlToRemove) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const path = urlToRemove.split('/offer-images/').pop();
      await supabase.storage.from('offer-images').remove([path]);
      onChange(images.filter(url => url !== urlToRemove));
      toast.success('Imagem removida');
    } catch (error) {
      console.error('Erro ao remover imagem:', error);
      toast.error('Erro ao remover imagem');
    }
  };

  const resetCrop = () => {
    setCrop({ unit: '%', width: 100, height: 100, x: 0, y: 0 });
    setCompletedCrop(null);
    setUseOriginal(true);
  };

  return (
    <div className="space-y-4" data-testid="image-upload-component">
      {/* Grid de Imagens */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((url, index) => (
            <Card key={index} className="relative group overflow-hidden rounded-xl">
              <div className="aspect-square bg-slate-100">
                <img
                  src={url}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-contain"
                />
              </div>
              <button
                type="button"
                data-testid={`btn-remove-image-${index}`}
                onClick={(e) => handleRemove(e, url)}
                className="absolute top-2 right-2 bg-destructive text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
              >
                <X className="h-4 w-4" />
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* Botão de Upload */}
      {images.length < maxImages && (
        <div>
          <input
            type="file"
            id="image-upload"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading || compressing}
          />
          <label htmlFor="image-upload">
            <Button
              data-testid="btn-select-images"
              type="button"
              variant="outline"
              className="w-full h-12 rounded-xl"
              disabled={uploading || compressing}
              asChild
            >
              <span>
                {compressing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Adicionar Fotos ({images.length}/{maxImages})
                  </>
                )}
              </span>
            </Button>
          </label>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Você poderá ajustar o enquadramento de cada imagem
          </p>
        </div>
      )}

      {/* Dialog de Crop/Ajuste */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crop className="h-5 w-5" />
              Ajustar Enquadramento
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto py-4">
            <div className="bg-slate-100 rounded-lg p-2 flex items-center justify-center min-h-[300px]">
              {currentImage && (
                <ReactCrop
                  crop={crop}
                  onChange={(c) => {
                    setCrop(c);
                    setUseOriginal(false);
                  }}
                  onComplete={(c) => setCompletedCrop(c)}
                  className="max-h-[50vh]"
                >
                  <img
                    ref={imgRef}
                    src={currentImage}
                    alt="Imagem para ajuste"
                    onLoad={onImageLoad}
                    className="max-h-[50vh] max-w-full object-contain"
                  />
                </ReactCrop>
              )}
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Arraste os cantos para selecionar a área desejada da imagem
              </p>
              <div className="flex justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetCrop}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Resetar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCrop({ unit: '%', width: 100, height: 100, x: 0, y: 0 });
                    setCompletedCrop(null);
                    setUseOriginal(true);
                  }}
                  className="text-xs"
                >
                  <Maximize2 className="h-3 w-3 mr-1" />
                  Imagem Completa
                </Button>
              </div>
            </div>

            {pendingFiles.length > 0 && (
              <p className="text-sm text-center text-muted-foreground mt-4 bg-blue-50 p-2 rounded-lg">
                + {pendingFiles.length} imagem(ns) na fila
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCropDialogOpen(false);
                setPendingFiles([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSkipCrop}
            >
              Usar Original
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCrop}
            >
              <Check className="h-4 w-4 mr-2" />
              {useOriginal ? 'Confirmar' : 'Aplicar Ajuste'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
