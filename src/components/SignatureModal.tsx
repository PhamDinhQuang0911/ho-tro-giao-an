import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { FileUp, Wand2, Check, PenTool, Eraser, RotateCcw, Palette, Sliders, Image as ImageIcon, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface SignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (base64Image: string) => void;
}

type TabType = 'photo' | 'draw' | 'upload_png';
type InkColorType = 'blue' | 'vibrant_blue' | 'black' | 'original';

export function SignatureModal({ open, onOpenChange, onSave }: SignatureModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('photo');

  // --- TAB 1: Photo & Background Removal State ---
  const [imgSrc, setImgSrc] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 80,
    height: 60,
    x: 10,
    y: 20
  });
  const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);
  const [threshold, setThreshold] = useState<number>(140);
  const [autoDetectedThreshold, setAutoDetectedThreshold] = useState<number>(140);
  const [contrast, setContrast] = useState<number>(1.2);
  const [softness, setSoftness] = useState<number>(24);
  const [inkColor, setInkColor] = useState<InkColorType>('blue');
  const [previewUrl, setPreviewUrl] = useState('');

  // --- TAB 2: Direct Canvas Drawing State ---
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawInkColor, setDrawInkColor] = useState<'blue' | 'vibrant_blue' | 'black'>('blue');
  const [drawLineWidth, setDrawLineWidth] = useState<number>(3.5);
  const [hasDrawn, setHasDrawn] = useState(false);

  // --- Auto-detect background brightness from image borders ---
  const detectBackgroundThreshold = useCallback((img: HTMLImageElement, cropArea?: Crop | null) => {
    try {
      const canvas = document.createElement('canvas');
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      const sx = cropArea ? cropArea.x * scaleX : 0;
      const sy = cropArea ? cropArea.y * scaleY : 0;
      const sw = cropArea ? cropArea.width * scaleX : img.naturalWidth;
      const sh = cropArea ? cropArea.height * scaleY : img.naturalHeight;

      if (sw <= 0 || sh <= 0) return;

      canvas.width = Math.min(sw, 400);
      canvas.height = Math.min(sh, 300);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Sample border pixels (top, bottom, left, right edges)
      let sumBrightness = 0;
      let count = 0;
      const w = canvas.width;
      const h = canvas.height;
      const borderSize = Math.max(2, Math.floor(Math.min(w, h) * 0.08));

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (x < borderSize || x >= w - borderSize || y < borderSize || y >= h - borderSize) {
            const idx = (y * w + x) * 4;
            const b = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            sumBrightness += b;
            count++;
          }
        }
      }

      if (count > 0) {
        const avgBgBrightness = sumBrightness / count;
        // Background paper threshold should be comfortably below average background brightness
        const computed = Math.max(50, Math.min(235, Math.round(avgBgBrightness - 24)));
        setAutoDetectedThreshold(computed);
        setThreshold(computed);
      }
    } catch (e) {
      console.error('Failed to auto-detect background threshold', e);
    }
  }, []);

  // When crop completes or image changes, auto-detect threshold and process
  const onImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    detectBackgroundThreshold(e.currentTarget);
  };

  // Helper to trim transparent whitespace around ink
  const trimCanvas = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 12) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      return canvas;
    }

    const padding = 6;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding);
    maxY = Math.min(height - 1, maxY + padding);

    const trimW = maxX - minX + 1;
    const trimH = maxY - minY + 1;

    const trimmed = document.createElement('canvas');
    trimmed.width = trimW;
    trimmed.height = trimH;
    const tCtx = trimmed.getContext('2d');
    if (tCtx) {
      tCtx.drawImage(canvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);
    }
    return trimmed;
  };

  // Process photo signature with advanced alpha blending & color mapping
  const processSignature = useCallback(() => {
    if (!imgRef.current) return;
    const image = imgRef.current;

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const cropX = completedCrop ? completedCrop.x * scaleX : 0;
    const cropY = completedCrop ? completedCrop.y * scaleY : 0;
    const cropW = completedCrop ? completedCrop.width * scaleX : image.naturalWidth;
    const cropH = completedCrop ? completedCrop.height * scaleY : image.naturalHeight;

    if (cropW <= 0 || cropH <= 0) return;

    canvas.width = cropW;
    canvas.height = cropH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const halfSoft = Math.max(4, softness / 2);

    // Color definitions
    const blueR = 12, blueG = 42, blueB = 120; // Bút bi xanh chuẩn
    const vibR = 18, vibG = 75, vibB = 195;   // Xanh tươi
    const blackR = 22, blackG = 24, blackB = 28; // Đen mực

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

      if (brightness >= threshold + halfSoft) {
        // Paper background: 100% transparent
        data[i + 3] = 0;
      } else if (brightness <= threshold - halfSoft) {
        // Definite ink: full opacity
        data[i + 3] = 255;
        if (inkColor === 'blue') {
          data[i] = blueR; data[i + 1] = blueG; data[i + 2] = blueB;
        } else if (inkColor === 'vibrant_blue') {
          data[i] = vibR; data[i + 1] = vibG; data[i + 2] = vibB;
        } else if (inkColor === 'black') {
          data[i] = blackR; data[i + 1] = blackG; data[i + 2] = blackB;
        } else if (contrast > 1) {
          data[i] = Math.max(0, Math.min(255, (r - 128) * contrast + 128));
          data[i + 1] = Math.max(0, Math.min(255, (g - 128) * contrast + 128));
          data[i + 2] = Math.max(0, Math.min(255, (b - 128) * contrast + 128));
        }
      } else {
        // Soft anti-aliased edge
        const alphaFraction = (threshold + halfSoft - brightness) / (2 * halfSoft);
        data[i + 3] = Math.round(Math.max(0, Math.min(255, alphaFraction * 255)));

        if (inkColor === 'blue') {
          data[i] = blueR; data[i + 1] = blueG; data[i + 2] = blueB;
        } else if (inkColor === 'vibrant_blue') {
          data[i] = vibR; data[i + 1] = vibG; data[i + 2] = vibB;
        } else if (inkColor === 'black') {
          data[i] = blackR; data[i + 1] = blackG; data[i + 2] = blackB;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const trimmed = trimCanvas(canvas);
    setPreviewUrl(trimmed.toDataURL('image/png'));
  }, [completedCrop, threshold, softness, inkColor, contrast]);

  // Re-process when sliders change
  useEffect(() => {
    if (imgSrc && imgRef.current) {
      processSignature();
    }
  }, [threshold, softness, inkColor, contrast, processSignature, imgSrc]);

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const res = reader.result?.toString() || '';
        setImgSrc(res);
        setPreviewUrl('');
      });
      reader.readAsDataURL(file);
    }
  }

  // --- TAB 2: Canvas Drawing Logic ---
  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e);

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = drawLineWidth;

    if (drawInkColor === 'blue') ctx.strokeStyle = 'rgb(12, 42, 120)';
    else if (drawInkColor === 'vibrant_blue') ctx.strokeStyle = 'rgb(18, 75, 195)';
    else ctx.strokeStyle = 'rgb(22, 24, 28)';

    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
      setIsDrawing(false);
    }
  };

  const clearDrawing = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  };

  const saveDrawnSignature = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas || !hasDrawn) {
      toast.error('Vui lòng ký vào khung vẽ trước khi lưu');
      return;
    }
    const trimmed = trimCanvas(canvas);
    const dataUrl = trimmed.toDataURL('image/png');
    onSave(dataUrl);
    toast.success('Đã lưu chữ ký thành công!');
    onOpenChange(false);
  };

  // --- TAB 3: Direct PNG Upload Logic ---
  const [directPngUrl, setDirectPngUrl] = useState('');
  const [autoRemoveWhite, setAutoRemoveWhite] = useState(false);

  const onSelectDirectPng = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        if (autoRemoveWhite) {
          // Process white removal quickly
          const img = new Image();
          img.onload = () => {
            const cvs = document.createElement('canvas');
            cvs.width = img.width;
            cvs.height = img.height;
            const c = cvs.getContext('2d');
            if (c) {
              c.drawImage(img, 0, 0);
              const imgData = c.getImageData(0, 0, cvs.width, cvs.height);
              const d = imgData.data;
              for (let i = 0; i < d.length; i += 4) {
                const b = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                if (b > 215) d[i + 3] = 0;
              }
              c.putImageData(imgData, 0, 0);
              const tr = trimCanvas(cvs);
              setDirectPngUrl(tr.toDataURL('image/png'));
            }
          };
          img.src = url;
        } else {
          setDirectPngUrl(url);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl font-sans max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary text-base sm:text-lg">
            <PenTool className="w-5 h-5 text-primary" />
            Tạo & Tách nền chữ ký giáo viên
          </DialogTitle>
        </DialogHeader>

        {/* TAB NAVIGATION */}
        <div className="flex border-b border-slate-200 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab('photo')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'photo'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Tách nền ảnh chụp (Khuyên dùng)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('draw')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'draw'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <PenTool className="w-4 h-4" />
            Ký tay trực tiếp
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload_png')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'upload_png'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Tải ảnh PNG có sẵn
          </button>
        </div>

        {/* TAB 1: TÁCH NỀN ẢNH CHỤP */}
        {activeTab === 'photo' && (
          <div className="space-y-4 pt-3">
            {!imgSrc && (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onSelectFile}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <FileUp className="w-10 h-10 text-primary/60 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">Tải ảnh chụp chữ ký lên</p>
                <p className="text-xs text-slate-500 mt-1">Chụp chữ ký trên giấy trắng bằng điện thoại hoặc máy scan</p>
                <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                  <Sparkles className="w-3 h-3 text-amber-600" /> Hệ thống tự động khử nền xám, bóng mờ và giữ nét chữ trong suốt
                </div>
              </div>
            )}

            {imgSrc && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    1. Cắt vùng chứa chữ ký:
                  </Label>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setImgSrc('')}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Chọn ảnh khác
                  </Button>
                </div>

                <div className="bg-slate-100 p-2 rounded-lg max-h-[260px] overflow-auto flex justify-center border border-slate-200">
                  <ReactCrop
                    crop={crop}
                    onChange={c => setCrop(c)}
                    onComplete={c => {
                      setCompletedCrop(c);
                      if (imgRef.current) {
                        detectBackgroundThreshold(imgRef.current, c);
                      }
                    }}
                    aspect={undefined}
                  >
                    <img
                      ref={imgRef}
                      src={imgSrc}
                      alt="Upload signature"
                      onLoad={onImageLoaded}
                      style={{ maxHeight: '240px' }}
                      className="max-w-full rounded shadow-sm select-none"
                    />
                  </ReactCrop>
                </div>

                {/* SLIDERS & FINE TUNING */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-primary" /> 2. Tinh chỉnh tách nền (Kéo thanh trượt xem trực tiếp)
                    </span>
                    <button
                      type="button"
                      onClick={() => setThreshold(autoDetectedThreshold)}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Khôi phục tự động ({autoDetectedThreshold})
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Slider: Ngưỡng tách nền */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <Label htmlFor="threshold-slider" className="text-xs font-medium text-slate-700">
                          Độ nhạy tách nền:
                        </Label>
                        <span className="font-mono text-primary font-bold text-xs">{threshold}</span>
                      </div>
                      <input
                        id="threshold-slider"
                        type="range"
                        min="50"
                        max="240"
                        step="2"
                        value={threshold}
                        onChange={e => setThreshold(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <p className="text-[10px] text-slate-400">Kéo sang trái nếu bị dính nền, kéo sang phải nếu bị mất nét</p>
                    </div>

                    {/* Màu nét mực */}
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-700">Màu nét mực:</Label>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInkColor('blue')}
                          className={`flex-1 py-1 px-2 text-[11px] rounded border font-medium transition-all ${
                            inkColor === 'blue'
                              ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Xanh bút bi
                        </button>
                        <button
                          type="button"
                          onClick={() => setInkColor('vibrant_blue')}
                          className={`flex-1 py-1 px-2 text-[11px] rounded border font-medium transition-all ${
                            inkColor === 'vibrant_blue'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Xanh tươi
                        </button>
                        <button
                          type="button"
                          onClick={() => setInkColor('black')}
                          className={`flex-1 py-1 px-2 text-[11px] rounded border font-medium transition-all ${
                            inkColor === 'black'
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Đen
                        </button>
                        <button
                          type="button"
                          onClick={() => setInkColor('original')}
                          className={`flex-1 py-1 px-2 text-[11px] rounded border font-medium transition-all ${
                            inkColor === 'original'
                              ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Màu gốc
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PREVIEW BOX */}
                {previewUrl && (
                  <div className="space-y-3 pt-2">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                      <span>3. Kết quả xem trước (Nền trong suốt):</span>
                      <span className="text-[10px] text-emerald-600 font-normal">✓ Tự động gọt viền gọn gàng</span>
                    </Label>
                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div
                        className="p-3 rounded-lg border border-dashed border-primary/40 w-56 h-28 flex items-center justify-center relative overflow-hidden shrink-0 bg-white"
                        style={{
                          backgroundImage:
                            'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
                          backgroundSize: '16px 16px',
                          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                        }}
                      >
                        <img src={previewUrl} className="max-w-full max-h-full object-contain" alt="Signature preview" />
                      </div>

                      <div className="flex-1 space-y-2 text-center sm:text-left">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Chữ ký đã được tách nền trong suốt 100%. Khi lưu, hệ thống sẽ tự động lưu vào máy để dùng cho mọi giáo án lần sau.
                        </p>
                        <Button
                          onClick={() => {
                            onSave(previewUrl);
                            toast.success('Đã lưu chữ ký thành công!');
                            onOpenChange(false);
                          }}
                          className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-semibold gap-2 shadow-sm"
                        >
                          <Check className="w-4 h-4" />
                          Lưu chữ ký này & Sử dụng
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: KÝ TAY TRỰC TIẾP */}
        {activeTab === 'draw' && (
          <div className="space-y-4 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-600">Dùng chuột, bút cảm ứng hoặc ngón tay để ký vào khung bên dưới:</span>
              <div className="flex items-center gap-2">
                {/* Ink Color Picker */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
                  <button
                    type="button"
                    onClick={() => setDrawInkColor('blue')}
                    className={`w-5 h-5 rounded-full bg-blue-900 border transition-all ${
                      drawInkColor === 'blue' ? 'ring-2 ring-blue-500 scale-110' : 'opacity-70'
                    }`}
                    title="Xanh bút bi"
                  />
                  <button
                    type="button"
                    onClick={() => setDrawInkColor('vibrant_blue')}
                    className={`w-5 h-5 rounded-full bg-blue-600 border transition-all ${
                      drawInkColor === 'vibrant_blue' ? 'ring-2 ring-blue-500 scale-110' : 'opacity-70'
                    }`}
                    title="Xanh tươi"
                  />
                  <button
                    type="button"
                    onClick={() => setDrawInkColor('black')}
                    className={`w-5 h-5 rounded-full bg-slate-900 border transition-all ${
                      drawInkColor === 'black' ? 'ring-2 ring-slate-500 scale-110' : 'opacity-70'
                    }`}
                    title="Mực đen"
                  />
                </div>

                {/* Line width */}
                <select
                  value={drawLineWidth}
                  onChange={e => setDrawLineWidth(Number(e.target.value))}
                  className="text-xs h-7 px-2 border rounded bg-white"
                >
                  <option value={2.5}>Nét thanh (2.5px)</option>
                  <option value={3.5}>Nét vừa (3.5px)</option>
                  <option value={5.0}>Nét đậm (5.0px)</option>
                </select>

                <Button variant="outline" size="sm" onClick={clearDrawing} className="h-7 text-xs text-red-600 hover:text-red-700">
                  <Eraser className="w-3.5 h-3.5 mr-1" /> Ký lại
                </Button>
              </div>
            </div>

            {/* Drawing Canvas */}
            <div
              className="w-full h-52 border-2 border-dashed border-slate-300 rounded-xl relative overflow-hidden bg-white shadow-inner flex items-center justify-center"
              style={{
                touchAction: 'none',
                backgroundImage:
                  'linear-gradient(45deg, #f8fafc 25%, transparent 25%), linear-gradient(-45deg, #f8fafc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f8fafc 75%), linear-gradient(-45deg, transparent 75%, #f8fafc 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
              }}
            >
              {!hasDrawn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-300">
                  <PenTool className="w-8 h-8 mb-1 opacity-50" />
                  <span className="text-xs font-medium">Ký tên vào đây</span>
                </div>
              )}
              <canvas
                ref={drawCanvasRef}
                width={600}
                height={260}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                className="w-full h-full cursor-crosshair"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-slate-500">Chữ ký tự vẽ sẽ có độ trong suốt 100% không tì vết.</span>
              <Button
                onClick={saveDrawnSignature}
                disabled={!hasDrawn}
                className="bg-primary hover:bg-primary/90 text-white font-semibold gap-1.5"
              >
                <Check className="w-4 h-4" />
                Lưu chữ ký này
              </Button>
            </div>
          </div>
        )}

        {/* TAB 3: TẢI ẢNH PNG CÓ SẴN */}
        {activeTab === 'upload_png' && (
          <div className="space-y-4 pt-3">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={onSelectDirectPng}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <ImageIcon className="w-10 h-10 text-primary/60 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">Chọn file ảnh chữ ký</p>
              <p className="text-xs text-slate-500 mt-1">Dành cho thầy cô đã có sẵn file PNG trong suốt</p>
            </div>

            {directPngUrl && (
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div
                    className="p-3 rounded-lg border border-dashed border-primary/40 w-56 h-28 flex items-center justify-center relative overflow-hidden shrink-0 bg-white"
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                    }}
                  >
                    <img src={directPngUrl} className="max-w-full max-h-full object-contain" alt="Direct signature" />
                  </div>
                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <p className="text-xs text-slate-600">Ảnh chữ ký sẵn sàng sử dụng.</p>
                    <Button
                      onClick={() => {
                        onSave(directPngUrl);
                        toast.success('Đã lưu chữ ký thành công!');
                        onOpenChange(false);
                      }}
                      className="bg-primary hover:bg-primary/90 text-white font-semibold gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Lưu và Sử dụng chữ ký này
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
