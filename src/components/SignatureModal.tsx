import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { FileUp, Scissors, Wand2, Check } from 'lucide-react';

interface SignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (base64Image: string) => void;
}

export function SignatureModal({ open, onOpenChange, onSave }: SignatureModalProps) {
  const [imgSrc, setImgSrc] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 50,
    height: 50,
    x: 25,
    y: 25
  });
  const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined as any); 
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
    }
  }

  function processSignature() {
    if (!completedCrop || !imgRef.current) return;
    
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Enhance and remove background
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    const threshold = 160; // Adjust as needed
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      const brightness = (r + g + b) / 3;
      
      if (brightness > threshold) {
        // Make background transparent
        data[i+3] = 0;
      } else {
        // Darken signature to dark blue ink
        data[i] = 10;
        data[i+1] = 20;
        data[i+2] = 120;
        data[i+3] = 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    const resultBase64 = canvas.toDataURL('image/png');
    setPreviewUrl(resultBase64);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl font-sans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Scissors className="w-5 h-5" />
            Tạo chữ ký tự động
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {!imgSrc && (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept="image/*"
                onChange={onSelectFile}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <FileUp className="w-10 h-10 text-slate-300 mx-auto mb-4" />
              <p className="text-sm font-medium text-slate-700">Tải ảnh chữ ký lên</p>
              <p className="text-xs text-slate-500 mt-2">Nên chụp chữ ký trên giấy trắng, đủ sáng</p>
            </div>
          )}

          {imgSrc && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Cắt ảnh cho khớp
                </Label>
                <Button variant="outline" size="sm" onClick={() => setImgSrc('')}>
                  Tải ảnh khác
                </Button>
              </div>
              
              <div className="bg-slate-100 p-2 rounded-lg max-h-[300px] overflow-auto flex justify-center">
                <ReactCrop
                  crop={crop}
                  onChange={c => setCrop(c)}
                  onComplete={c => setCompletedCrop(c)}
                  aspect={undefined}
                >
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    alt="Upload"
                    style={{ maxHeight: '280px' }}
                    className="max-w-full rounded shadow-sm"
                  />
                </ReactCrop>
              </div>
              
              <div className="flex justify-center">
                <Button onClick={processSignature} className="gap-2">
                  <Wand2 className="w-4 h-4" />
                  Xử lý & Tách nền
                </Button>
              </div>
            </div>
          )}

          {previewUrl && (
            <div className="space-y-3 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-4">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Kết quả (Nền trong suốt)
              </Label>
              <div className="flex flex-col items-center gap-4">
                <div 
                  className="p-4 rounded-xl border border-dashed border-primary/30 w-64 h-32 flex items-center justify-center relative overflow-hidden"
                  style={{
                    backgroundImage: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                  }}
                >
                  <img src={previewUrl} className="max-w-full max-h-full object-contain" alt="Signature preview" />
                </div>
                
                <Button 
                  onClick={() => {
                    onSave(previewUrl);
                    onOpenChange(false);
                  }} 
                  variant="default"
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Lưu chữ ký này
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
