import React, { useState, useRef, useEffect } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sparkles, FileType2, Upload, Loader2, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ScheduleItem } from '@/lib/word-utils';
import { getGeminiSchedule, FileData } from '@/lib/gemini-api';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

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
  const [mathLogic, setMathLogic] = useState('Đại số và Hình học đan xen nhau');
  const [files, setFiles] = useState<{file: File, name: string}[]>([]);
  const [aiModel, setAiModel] = useState('gemini-3.6-flash');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedModel = localStorage.getItem('user_ai_model');
    if (savedModel) setAiModel(savedModel);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(f => ({
        file: f,
        name: files.length === 0 ? 'TKB Sáng' : 'TKB Chiều'
      }));
      setFiles(prev => [...prev, ...newFiles].slice(0, 2));
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const extractFileContent = async (file: File): Promise<FileData> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      return { type: 'text', data: csv, name: file.name };
    }
    
    if (ext === 'doc' || ext === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return { type: 'text', data: result.value, name: file.name };
    }
    
    // Assume image
    const reader = new FileReader();
    reader.readAsDataURL(file);
    const base64Image = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
    return { type: 'image', data: base64Image, name: file.name };
  };

  const handleGenerate = async () => {
    if (files.length === 0) {
      toast.error('Vui lòng tải lên ít nhất 1 file TKB!');
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
      const filesData = await Promise.all(files.map(f => extractFileContent(f.file)));
      // rename files logic for prompt
      filesData.forEach((fd, i) => fd.name = files[i].name);
      
      const result = await getGeminiSchedule(filesData, teacherName, mathLogic, aiModel, apiKey);
      
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
      <DialogTrigger className={buttonVariants({ variant: "outline", className: "gap-2 border-primary text-primary hover:bg-primary/5 cursor-pointer" })}>
        <Sparkles className="w-4 h-4" />
        Lên lịch bằng AI
      </DialogTrigger>
      <DialogContent className="max-w-xl font-sans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Phân tích Thời khóa biểu (AI)
          </DialogTitle>
          <DialogDescription>
            Hỗ trợ tải lên tối đa 2 file (Ảnh, Word, Excel) cho TKB Sáng và Chiều.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File Upload */}
          <div className="space-y-2">
            <Label>Files TKB (Tối đa 2 files)</Label>
            <div className="flex gap-2 mb-2">
              {files.map((f, i) => (
                <div key={i} className="relative flex-1 border rounded-md p-3 flex flex-col items-center bg-slate-50">
                  <button onClick={() => removeFile(i)} className="absolute top-1 right-1 p-1 hover:bg-red-100 text-red-500 rounded-full">
                    <X className="w-3 h-3" />
                  </button>
                  <FileType2 className="w-6 h-6 text-primary mb-1" />
                  <span className="text-xs font-semibold">{f.name}</span>
                  <span className="text-[10px] text-slate-500 max-w-full truncate">{f.file.name}</span>
                </div>
              ))}
              {files.length < 2 && (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 border-2 border-dashed border-slate-300 rounded-md p-3 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <Plus className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-xs text-slate-500">Thêm TKB</span>
                </div>
              )}
            </div>
            
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx"
              className="hidden" 
              multiple
              onChange={handleFileChange}
            />
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
            <Input 
              placeholder="VD: 3 Đại, 1 Hình hoặc Đan xen..." 
              value={mathLogic}
              onChange={(e) => setMathLogic(e.target.value)}
            />
            <p className="text-[10px] text-slate-500">Bạn có thể tự do nhập quy tắc để AI tự động sắp xếp (VD: 2 tiết Đại, 2 tiết Hình).</p>
          </div>
          
          <div className="space-y-2">
            <Label>Mô hình AI</Label>
            <select 
              className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
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
