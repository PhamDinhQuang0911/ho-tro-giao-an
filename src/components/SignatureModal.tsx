import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { FileUp, Wand2, Check, PenTool, Eraser, RotateCcw, Sliders, Image as ImageIcon, Sparkles, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
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

  // --- TAB 3: Direct PNG Upload State ---
  const [directPngUrl, setDirectPngUrl] = useState('');

  // Checkerboard background style for transparency
  const checkerboardStyle = {
    backgroundImage:
      'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
  };

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

      // Sample border pixels (edges)
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
        const computed = Math.max(50, Math.min(235, Math.round(avgBgBrightness - 24)));
        setAutoDetectedThreshold(computed);
        setThreshold(computed);
      }
    } catch (e) {
      console.error('Failed to auto-detect background threshold', e);
    }
  }, []);

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

  // Process photo signature with soft alpha blending & color mapping
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

    const blueR = 12, blueG = 42, blueB = 120; // Bút bi xanh chuẩn
    const vibR = 18, vibG = 75, vibB = 195;   // Xanh tươi
    const blackR = 22, blackG = 24, blackB = 28; // Đen mực

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

      if (brightness >= threshold + halfSoft) {
        data[i + 3] = 0;
      } else if (brightness <= threshold - halfSoft) {
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
  const onSelectDirectPng = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setDirectPngUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl lg:max-w-5xl w-[95vw] font-sans max-h-[92vh] overflow-y-auto p-5 sm:p-7 rounded-2xl shadow-2xl">
        {/* HEADER */}
        <DialogHeader className="pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-3 text-lg sm:text-xl font-bold text-slate-800">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
              <PenTool className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span>Tạo & Quản lý chữ ký giáo viên</span>
              <p className="text-xs font-normal text-slate-400 mt-0.5">
                Tự động tách nền trong suốt hoặc vẽ chữ ký trực tiếp để chèn vào giáo án Word
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* MODERN SEGMENTED TABS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200/80 my-2">
          <button
            type="button"
            onClick={() => setActiveTab('photo')}
            className={cn(
              "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all",
              activeTab === 'photo'
                ? "bg-white text-primary shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <Wand2 className="w-4 h-4 text-primary shrink-0" />
            <span className="whitespace-nowrap">Tách nền ảnh chụp</span>
            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-full shrink-0">
              Khuyên dùng
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('draw')}
            className={cn(
              "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all",
              activeTab === 'draw'
                ? "bg-white text-primary shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <PenTool className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="whitespace-nowrap">Ký tay trực tiếp</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full shrink-0">
              Nét siêu mịn
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload_png')}
            className={cn(
              "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all",
              activeTab === 'upload_png'
                ? "bg-white text-primary shadow-xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <ImageIcon className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="whitespace-nowrap">Tải ảnh PNG có sẵn</span>
          </button>
        </div>

        {/* TAB 1: TÁCH NỀN ẢNH CHỤP */}
        {activeTab === 'photo' && (
          <div className="pt-2">
            {!imgSrc && (
              <div className="border-2 border-dashed border-primary/30 hover:border-primary/70 rounded-2xl p-10 sm:p-14 text-center hover:bg-primary/5 transition-all cursor-pointer relative bg-slate-50/50">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onSelectFile}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 shadow-xs">
                  <FileUp className="w-8 h-8 text-primary" />
                </div>
                <h4 className="text-base sm:text-lg font-bold text-slate-800">Tải ảnh chụp chữ ký lên</h4>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  Chụp chữ ký trên giấy trắng bằng điện thoại. Hệ thống sẽ tự động tách nền trong suốt và chuyển nét bút sang màu mực chuẩn giáo viên.
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 px-3.5 py-1.5 rounded-full border border-amber-200/80 font-medium">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Tự động nhận diện độ sáng giấy, khử bóng mờ và làm mịn nét mực
                </div>
              </div>
            )}

            {imgSrc && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
                {/* Left Column: Crop Viewer (7 cols) */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Scissors className="w-4 h-4 text-primary" /> 1. Kéo khung để cắt chữ ký
                    </Label>
                    <Button variant="outline" size="sm" className="h-7 text-xs bg-white" onClick={() => setImgSrc('')}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Chọn ảnh khác
                    </Button>
                  </div>

                  <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 max-h-[380px] overflow-auto flex justify-center items-center">
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
                        alt="Signature"
                        onLoad={onImageLoaded}
                        style={{ maxHeight: '340px' }}
                        className="max-w-full rounded shadow-sm select-none"
                      />
                    </ReactCrop>
                  </div>
                </div>

                {/* Right Column: Controls & Preview (5 cols) */}
                <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
                  {/* Fine-Tuning Controls */}
                  <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-primary" /> 2. Tinh chỉnh nét mực
                      </span>
                      <button
                        type="button"
                        onClick={() => setThreshold(autoDetectedThreshold)}
                        className="text-[11px] text-primary hover:underline font-semibold"
                      >
                        Khôi phục ({autoDetectedThreshold})
                      </button>
                    </div>

                    {/* Threshold Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium text-slate-700">
                        <span>Độ nhạy tách nền:</span>
                        <span className="font-mono text-primary font-bold px-1.5 py-0.5 rounded bg-primary/10 text-xs">
                          {threshold}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="240"
                        step="2"
                        value={threshold}
                        onChange={e => setThreshold(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Sang trái: bớt nền giấy</span>
                        <span>Sang phải: giữ nét đậm</span>
                      </div>
                    </div>

                    {/* Ink Color Picker */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-700">Màu nét mực:</Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInkColor('blue')}
                          className={cn(
                            "py-1.5 px-2.5 text-xs rounded-lg border font-medium flex items-center justify-center gap-1.5 transition-all",
                            inkColor === 'blue'
                              ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-900 border border-white shrink-0" />
                          <span>Xanh bút bi</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInkColor('vibrant_blue')}
                          className={cn(
                            "py-1.5 px-2.5 text-xs rounded-lg border font-medium flex items-center justify-center gap-1.5 transition-all",
                            inkColor === 'vibrant_blue'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white shrink-0" />
                          <span>Xanh tươi</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInkColor('black')}
                          className={cn(
                            "py-1.5 px-2.5 text-xs rounded-lg border font-medium flex items-center justify-center gap-1.5 transition-all",
                            inkColor === 'black'
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-white shrink-0" />
                          <span>Mực đen</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInkColor('original')}
                          className={cn(
                            "py-1.5 px-2.5 text-xs rounded-lg border font-medium flex items-center justify-center gap-1.5 transition-all",
                            inkColor === 'original'
                              ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          <span>🌈 Màu gốc</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Live Checkerboard Preview & Action */}
                  {previewUrl && (
                    <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
                      <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                        <span>3. Xem trước nền trong suốt:</span>
                        <span className="text-[10px] text-emerald-600 font-semibold lowercase">✓ Đã gọt viền sát nét</span>
                      </Label>
                      <div
                        className="p-3 rounded-lg border border-dashed border-primary/30 h-28 flex items-center justify-center relative overflow-hidden bg-white shadow-inner"
                        style={checkerboardStyle}
                      >
                        <img src={previewUrl} className="max-w-full max-h-full object-contain" alt="Preview" />
                      </div>
                      <Button
                        onClick={() => {
                          onSave(previewUrl);
                          toast.success('Đã lưu chữ ký thành công!');
                          onOpenChange(false);
                        }}
                        className="w-full h-10 bg-primary hover:bg-primary/90 text-white font-bold gap-2 shadow-md"
                      >
                        <Check className="w-4 h-4" />
                        Lưu & Sử dụng chữ ký này
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: KÝ TAY TRỰC TIẾP */}
        {activeTab === 'draw' && (
          <div className="space-y-4 pt-2">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-700">Chọn màu mực & nét vẽ:</span>
              <div className="flex items-center gap-3">
                {/* Ink Color Picker */}
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setDrawInkColor('blue')}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition-all",
                      drawInkColor === 'blue' ? "bg-blue-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-900 border border-white" />
                    <span>Xanh bút bi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawInkColor('vibrant_blue')}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition-all",
                      drawInkColor === 'vibrant_blue' ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" />
                    <span>Xanh tươi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawInkColor('black')}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition-all",
                      drawInkColor === 'black' ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-white" />
                    <span>Đen</span>
                  </button>
                </div>

                {/* Stroke Width Selector */}
                <select
                  value={drawLineWidth}
                  onChange={e => setDrawLineWidth(Number(e.target.value))}
                  className="text-xs h-8 px-2.5 border rounded-lg bg-white font-medium shadow-xs"
                >
                  <option value={2.5}>Nét thanh (2.5px)</option>
                  <option value={3.5}>Nét vừa (3.5px)</option>
                  <option value={5.0}>Nét đậm (5.0px)</option>
                </select>

                <Button variant="outline" size="sm" onClick={clearDrawing} className="h-8 text-xs text-red-600 hover:text-red-700 bg-white shadow-xs">
                  <Eraser className="w-3.5 h-3.5 mr-1" /> Ký lại
                </Button>
              </div>
            </div>

            {/* Drawing Canvas */}
            <div
              className="w-full h-72 border-2 border-dashed border-slate-300 rounded-2xl relative overflow-hidden bg-white shadow-inner flex items-center justify-center"
              style={{
                touchAction: 'none',
                ...checkerboardStyle
              }}
            >
              {!hasDrawn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-300">
                  <PenTool className="w-10 h-10 mb-2 opacity-40 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-400">Dùng chuột, bút cảm ứng hoặc ngón tay để ký vào đây</span>
                  <span className="text-xs text-slate-400 mt-1">Chữ ký sẽ tự động được gọt sát nét và lưu với nền trong suốt 100%</span>
                </div>
              )}
              <canvas
                ref={drawCanvasRef}
                width={800}
                height={320}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                className="w-full h-full cursor-crosshair"
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-1">
              <span className="text-xs text-slate-500 text-center sm:text-left">
                Chữ ký tự vẽ có độ nét vector siêu mịn và độ trong suốt hoàn hảo khi in ấn.
              </span>
              <Button
                onClick={saveDrawnSignature}
                disabled={!hasDrawn}
                className="w-full sm:w-auto h-10 px-6 bg-primary hover:bg-primary/90 text-white font-bold gap-2 shadow-md"
              >
                <Check className="w-4 h-4" />
                Lưu & Sử dụng chữ ký này
              </Button>
            </div>
          </div>
        )}

        {/* TAB 3: TẢI ẢNH PNG CÓ SẴN */}
        {activeTab === 'upload_png' && (
          <div className="space-y-4 pt-2">
            <div className="border-2 border-dashed border-primary/30 hover:border-primary/70 rounded-2xl p-10 sm:p-14 text-center hover:bg-primary/5 transition-all cursor-pointer relative bg-slate-50/50">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={onSelectDirectPng}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
                <ImageIcon className="w-8 h-8 text-indigo-600" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-slate-800">Chọn file ảnh chữ ký</h4>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Dành cho thầy cô đã có sẵn file ảnh chữ ký tách nền PNG hoặc file ảnh đã chuẩn bị từ trước.
              </p>
            </div>

            {directPngUrl && (
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row items-center gap-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div
                    className="p-3 rounded-lg border border-dashed border-primary/40 w-64 h-32 flex items-center justify-center relative overflow-hidden shrink-0 bg-white"
                    style={checkerboardStyle}
                  >
                    <img src={directPngUrl} className="max-w-full max-h-full object-contain" alt="Direct signature" />
                  </div>
                  <div className="flex-1 space-y-2.5 text-center sm:text-left">
                    <h5 className="text-sm font-bold text-slate-800">Ảnh chữ ký đã sẵn sàng</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Ảnh này sẽ được lưu cố định vào trình duyệt của bạn và dùng để chèn vào giáo án mỗi khi bấm "Ký giáo án".
                    </p>
                    <Button
                      onClick={() => {
                        onSave(directPngUrl);
                        toast.success('Đã lưu chữ ký thành công!');
                        onOpenChange(false);
                      }}
                      className="h-10 px-6 bg-primary hover:bg-primary/90 text-white font-bold gap-2 shadow-md"
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
