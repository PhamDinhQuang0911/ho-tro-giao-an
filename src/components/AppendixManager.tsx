import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X, Upload, Save, CheckCircle2 } from 'lucide-react';
import { SubjectType, GradeType } from '@/types';
import localforage from 'localforage';
import { extractTextFromDocx } from '@/lib/nls-utils';
import { toast } from 'sonner';

interface SavedAppendix {
  id: string;
  subject: SubjectType;
  grade: GradeType;
  type: 'PL1' | 'PL3';
  text: string;
  name: string;
}

interface AppendixManagerProps {
  type: 'PL1' | 'PL3';
  subject: SubjectType | '';
  grade: GradeType | '';
  onAppendixLoaded: (text: string) => void;
}

export function AppendixManager({ type, subject, grade, onAppendixLoaded }: AppendixManagerProps) {
  const [savedDocs, setSavedDocs] = useState<SavedAppendix[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSavedDocs();
  }, []);

  useEffect(() => {
    if (selectedDocId) {
      const doc = savedDocs.find(d => d.id === selectedDocId);
      if (doc) onAppendixLoaded(doc.text);
    } else {
      onAppendixLoaded('');
    }
  }, [selectedDocId, savedDocs]);

  // Auto-select if there is an exact match for current subject and grade
  useEffect(() => {
    if (subject && grade && savedDocs.length > 0) {
      const match = savedDocs.find(d => d.subject === subject && d.grade === grade && d.type === type);
      if (match) {
         setSelectedDocId(match.id);
      } else {
         setSelectedDocId('');
      }
    }
  }, [subject, grade, savedDocs, type]);

  const loadSavedDocs = async () => {
    const docs = await localforage.getItem<SavedAppendix[]>('saved_appendices') || [];
    setSavedDocs(docs);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    if (!subject || !grade) {
      toast.error('Vui lòng chọn Môn học và Khối lớp trước khi tải Phụ lục lên!');
      e.target.value = '';
      return;
    }

    setIsLoading(true);
    try {
      const text = await extractTextFromDocx(file);
      
      const newDoc: SavedAppendix = {
        id: Math.random().toString(36).substring(7),
        subject: subject as SubjectType,
        grade: grade as GradeType,
        type,
        text,
        name: file.name
      };

      const existingDocs = await localforage.getItem<SavedAppendix[]>('saved_appendices') || [];
      // Remove older ones of the same subject/grade/type
      const filtered = existingDocs.filter(d => !(d.subject === subject && d.grade === grade && d.type === type));
      const updated = [...filtered, newDoc];
      
      await localforage.setItem('saved_appendices', updated);
      setSavedDocs(updated);
      setSelectedDocId(newDoc.id);
      toast.success(`Đã lưu ${type} cho ${subject} ${grade}`);
    } catch (err: any) {
      console.error(err);
      toast.error('Không thể đọc file Phụ lục. Vui lòng đảm bảo đây là file Word (.docx)');
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    const existingDocs = await localforage.getItem<SavedAppendix[]>('saved_appendices') || [];
    const updated = existingDocs.filter(d => d.id !== id);
    await localforage.setItem('saved_appendices', updated);
    setSavedDocs(updated);
    if (selectedDocId === id) setSelectedDocId('');
    toast.success('Đã xóa phụ lục');
  };

  const matchingDocs = savedDocs.filter(d => d.type === type);

  return (
    <div className="space-y-2 border rounded-md p-2 bg-slate-50/50">
      <Label className="text-xs font-semibold flex items-center justify-between">
        {type === 'PL1' ? 'Phụ lục 1 (Khung Kế hoạch)' : 'Phụ lục 3 (Kế hoạch bài dạy)'}
      </Label>
      
      {matchingDocs.length > 0 && (
        <select 
          className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
          value={selectedDocId}
          onChange={(e) => setSelectedDocId(e.target.value)}
        >
          <option value="">-- Không sử dụng phụ lục --</option>
          {matchingDocs.map(doc => (
            <option key={doc.id} value={doc.id}>
              {doc.subject} {doc.grade} - {doc.name}
            </option>
          ))}
        </select>
      )}

      {selectedDocId && (
        <div className="flex items-center justify-between text-[10px] bg-teal-50 text-teal-700 px-2 py-1 rounded">
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Đang dùng phụ lục lưu sẵn</span>
          <button onClick={() => handleDelete(selectedDocId)} className="text-red-500 hover:underline">Xóa bản lưu này</button>
        </div>
      )}

      <div className="relative">
        <input 
          type="file" 
          accept=".docx"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileUpload}
          disabled={isLoading}
        />
        <div className="flex items-center justify-center gap-1 h-8 border border-dashed border-slate-300 rounded text-xs text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer">
          <Upload className="w-3 h-3" />
          {isLoading ? 'Đang xử lý...' : 'Tải lên & Lưu bản mới'}
        </div>
      </div>
    </div>
  );
}
