import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sparkles, Image as ImageIcon, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ScheduleItem } from '@/lib/word-utils';
import { getGeminiSchedule } from '@/lib/gemini-api';

const MODELS = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite' },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

interface AiScheduleModalProps {
  onScheduleGenerated: (items: ScheduleItem[]) => void;
}

export function AiScheduleModal({ onScheduleGenerated }: AiScheduleModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [mathLogic, setMathLogic] = useState('danxen'); // danxen, lientiep, all_dai, all_hinh
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [aiModel, setAiModel] = useState('gemini-3.6-flash');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedModel = localStorage.getItem('user_ai_model');
    if (savedModel) setAiModel(savedModel);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!imageFile) {
      toast.error('Vui lòng chọn ảnh thời khóa biểu!');
      return;
    }
    if (!teacherName) {
      toast.error('Vui lòng nhập tên giáo viên!');
      return;
    }

    const apiKey = localStorage.getItem('USER_GEMINI_API_KEY');
    if (!apiKey) {
      toast.error('Chưa cấu hình API Key trong phần Tạo Giáo Án!');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Convert image to base64
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      
      const base64Image = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });

      // 2. Call API
      const result = await getGeminiSchedule(base64Image, teacherName, mathLogic, aiModel, apiKey);
      
      if (result && result.length > 0) {
        onScheduleGenerated(result);
        toast.success(`Đã tạo thành công ${result.length} tiết dạy từ AI!`);
        setIsOpen(false);
      } else {
        toast.error('Không tìm thấy tiết dạy nào của giáo viên này trong TKB.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Có lỗi xảy ra khi phân tích TKB.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
          <Sparkles className="w-4 h-4" />
          Lên lịch bằng AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Nhận diện Thời khóa biểu
          </DialogTitle>
          <DialogDescription>
            Tải lên ảnh thời khóa biểu, AI sẽ tự động tìm các tiết của bạn và lên lịch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>Ảnh thời khóa biểu</Label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
            >
              {imageFile ? (
                <div className="text-center">
                  <ImageIcon className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium">{imageFile.name}</p>
                </div>
              ) : (
                <div className="text-center text-slate-500">
                  <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nhấn để tải ảnh lên (JPG, PNG)</p>
                </div>
              )}
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*"
                className="hidden" 
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tên giáo viên (viết đúng như trong TKB)</Label>
            <Input 
              placeholder="VD: Quang, Nguyễn Thị A..." 
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Phân bổ môn Toán (Đại số / Hình học)</Label>
            <select 
              className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={mathLogic}
              onChange={(e) => setMathLogic(e.target.value)}
            >
              <option value="danxen">Đại số và Hình học đan xen nhau</option>
              <option value="lientiep">Liên tiếp 2 tiết Đại - 1 tiết Hình</option>
              <option value="all_dai">Toàn bộ là Đại số</option>
              <option value="all_hinh">Toàn bộ là Hình học</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <Label>Mô hình AI</Label>
            <select 
              className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={aiModel}
              onChange={(e) => {
                setAiModel(e.target.value);
                localStorage.setItem('user_ai_model', e.target.value);
              }}
            >
              {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleGenerate} disabled={isLoading} className="w-full gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isLoading ? 'Đang phân tích...' : 'Phân tích và tạo lịch'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
