import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { CalendarRange, Loader2, Upload, Download, FileSpreadsheet, Settings2, CheckCircle2, Trash2, CheckCircle, PlusCircle } from 'lucide-react';
import localforage from 'localforage';

import { AIExtractor } from '../core/aiExtractor';
import { ScheduleEngine } from '../core/scheduleEngine';
import { ExcelBuilder } from '../core/excelBuilder';
import { ExcelParser } from '../core/excelParser';
import { PpctParser } from '../core/ppctParser';
import type { ScheduledLesson, PPCTLesson } from '../core/types';

const MODELS = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite' },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

interface CachedPpctFile {
  id: string;
  fileName: string;
  subjectName: string;
  lessons: PPCTLesson[];
}

export function ScheduleBuilder() {
  const [apiKey, setApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gemini-3.6-flash');

  const [teacherName, setTeacherName] = useState('');
  const [weekRange, setWeekRange] = useState('7/9/26-12/9/26');
  
  const [cachedFiles, setCachedFiles] = useState<CachedPpctFile[]>([]);
  
  const [tkbSangFile, setTkbSangFile] = useState<File | null>(null);
  const [tkbChieuFile, setTkbChieuFile] = useState<File | null>(null);
  const [tkbRules, setTkbRules] = useState('');
  
  const [oldScheduleFile, setOldScheduleFile] = useState<File | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [scheduleData, setScheduleData] = useState<ScheduledLesson[]>([]);
  
  const [afternoonFormat, setAfternoonFormat] = useState('suffix'); // 'suffix' | 'continuous' | 'normal'
  const [afternoonStartPeriod, setAfternoonStartPeriod] = useState(6);
  
  const [progress, setProgress] = useState({
    ppct: 'pending',
    tkb: 'pending',
    schedule: 'pending'
  });

  useEffect(() => {
    const savedKey = localStorage.getItem('USER_GEMINI_API_KEY');
    if (savedKey) setApiKey(savedKey);

    const savedModel = localStorage.getItem('user_ai_model');
    if (savedModel) setAiModel(savedModel);
    
    const savedTeacherName = localStorage.getItem('teacherName');
    if (savedTeacherName) setTeacherName(savedTeacherName);
    
    const savedTkbRules = localStorage.getItem('tkbRules');
    if (savedTkbRules) setTkbRules(savedTkbRules);

    // Load cached PPCT files
    localforage.getItem<CachedPpctFile[]>('cached_ppct_files').then(data => {
      if (data && data.length > 0) {
        setCachedFiles(data);
      }
    });

    // Load cached TKB files
    localforage.getItem<File>('tkb_sang_file').then(f => { if (f) setTkbSangFile(f); });
    localforage.getItem<File>('tkb_chieu_file').then(f => { if (f) setTkbChieuFile(f); });
  }, []);

  const handleSaveConfig = () => {
    localStorage.setItem('USER_GEMINI_API_KEY', apiKey);
    localStorage.setItem('user_ai_model', aiModel);
    localStorage.setItem('teacherName', teacherName);
    localStorage.setItem('tkbRules', tkbRules);
    toast.success('Đã lưu cấu hình!');
  };

  const handlePpctFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    toast.info('Đang phân tích định dạng các file PPCT (Không dùng AI)...');
    const newCachedFiles = [...cachedFiles];

    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      if (file.name.endsWith('.docx')) {
        try {
          let suggestedSubject = file.name.replace('.docx', '').replace('PL3', '').trim();
          
          const lessons = await PpctParser.parseFromDocx(file, suggestedSubject);
          
          newCachedFiles.push({
            id: Date.now().toString() + Math.random().toString(),
            fileName: file.name,
            subjectName: suggestedSubject,
            lessons: lessons
          });
        } catch (err: any) {
          toast.error(`Lỗi khi đọc file ${file.name}: ${err.message}`);
        }
      } else {
        toast.error(`File ${file.name} bỏ qua do chỉ hỗ trợ chuẩn .docx`);
      }
    }
    
    setCachedFiles(newCachedFiles);
    await localforage.setItem('cached_ppct_files', newCachedFiles);
    e.target.value = ''; // reset input
  };

  const handleDeleteCachedFile = async (id: string) => {
    const updated = cachedFiles.filter(f => f.id !== id);
    setCachedFiles(updated);
    await localforage.setItem('cached_ppct_files', updated);
  };

  const handleSubjectNameChange = async (id: string, newSubject: string) => {
    const updated = cachedFiles.map(f => {
      if (f.id === id) {
        const updatedLessons = f.lessons.map(l => ({ ...l, subject: newSubject }));
        return { ...f, subjectName: newSubject, lessons: updatedLessons };
      }
      return f;
    });
    setCachedFiles(updated);
    await localforage.setItem('cached_ppct_files', updated);
  };

  const handleTkbSangChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setTkbSangFile(file);
    if (file) await localforage.setItem('tkb_sang_file', file);
  };

  const clearTkbSang = async () => {
    setTkbSangFile(null);
    await localforage.removeItem('tkb_sang_file');
  };

  const handleTkbChieuChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setTkbChieuFile(file);
    if (file) await localforage.setItem('tkb_chieu_file', file);
  };

  const clearTkbChieu = async () => {
    setTkbChieuFile(null);
    await localforage.removeItem('tkb_chieu_file');
  };

  const getDisplayPeriod = (period: number, session: string) => {
    if (session !== 'CHIỀU') return period;
    
    if (afternoonFormat === 'suffix') return `${period}(c)`;
    if (afternoonFormat === 'continuous') return period - 1 + afternoonStartPeriod;
    return period; // 'normal'
  };

  const handleProcess = async () => {
    if (!apiKey) {
      toast.error('Vui lòng điền API Key Gemini!');
      return;
    }
    if (!teacherName) {
      toast.error('Vui lòng nhập tên giáo viên');
      return;
    }
    if (cachedFiles.length === 0) {
      toast.error('Vui lòng tải lên ít nhất 1 Phụ lục (PPCT)');
      return;
    }
    if (!tkbSangFile && !tkbChieuFile) {
      toast.error('Vui lòng tải lên ít nhất 1 Thời khóa biểu (Sáng hoặc Chiều)');
      return;
    }

    localStorage.setItem('USER_GEMINI_API_KEY', apiKey);
    localStorage.setItem('user_ai_model', aiModel);
    localStorage.setItem('teacherName', teacherName);
    localStorage.setItem('tkbRules', tkbRules);

    setIsProcessing(true);
    setProgress({ ppct: 'loading', tkb: 'pending', schedule: 'pending' });
    setScheduleData([]);

    try {
      const extractor = new AIExtractor(apiKey, aiModel);
      
      let lastProgress: Record<string, number> = {};
      if (oldScheduleFile) {
        toast.info('Đang phân tích Lịch báo giảng cũ...');
        lastProgress = await ExcelParser.parseOldScheduleProgress(oldScheduleFile);
      }

      let allCurriculum: PPCTLesson[] = [];
      cachedFiles.forEach(cf => {
        allCurriculum = [...allCurriculum, ...cf.lessons];
      });
      
      if (allCurriculum.length === 0) {
        throw new Error('Không có tiết PPCT nào được trích xuất!');
      }
      setProgress(p => ({ ...p, ppct: 'done', tkb: 'loading' }));

      toast.info('Đang đọc TKB bằng AI...');
      let timetable: any[] = [];
      if (tkbSangFile) {
        const sang = await extractor.extractTimetableFromImage(tkbSangFile, teacherName, 'SÁNG', tkbRules);
        timetable = [...timetable, ...sang];
      }
      if (tkbChieuFile) {
        const chieu = await extractor.extractTimetableFromImage(tkbChieuFile, teacherName, 'CHIỀU', tkbRules);
        timetable = [...timetable, ...chieu];
      }
      setProgress(p => ({ ...p, tkb: 'done', schedule: 'loading' }));

      const schedule = ScheduleEngine.buildWeeklySchedule(
        timetable,
        allCurriculum,
        lastProgress,
        [] 
      );

      setScheduleData(schedule);
      setProgress(p => ({ ...p, schedule: 'done' }));
      toast.success('Xếp lịch thành công!');

    } catch (error: any) {
      console.error(error);
      setProgress({ ppct: 'pending', tkb: 'pending', schedule: 'pending' });
      
      const errMsg = error.message || '';
      if (errMsg.includes('429') && errMsg.includes('Quota exceeded')) {
        if (errMsg.includes('PerDay')) {
          toast.error('Mô hình AI này đã hết lượt sử dụng miễn phí trong ngày. Vui lòng đổi sang mô hình khác (ví dụ: Gemini 3.5 Flash).');
        } else {
          toast.error('Hệ thống AI đang bị quá tải. Vui lòng chờ 1 phút rồi thử lại.');
        }
      } else {
        toast.error(errMsg || 'Có lỗi xảy ra trong quá trình xử lý');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (scheduleData.length === 0) return;
    await ExcelBuilder.exportSchedule(scheduleData, weekRange, teacherName, afternoonFormat, afternoonStartPeriod);
    toast.success('Đã tải xuống file Lịch Báo Giảng!');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Cấu hình AI (Đọc TKB)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Gemini API Key</Label>
              <Input 
                type="password"
                placeholder="Nhập API Key của Google Gemini..." 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Mô hình AI (Nên dùng: 3.5 Flash hoặc 3.1 Flash-Lite)</Label>
              <div className="flex gap-2">
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                >
                  {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <Button onClick={handleSaveConfig} variant="secondary">Lưu</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary" />
            Lịch Báo Giảng Tự Động
          </CardTitle>
          <CardDescription>
            - Đọc PPCT bằng Code cục bộ (Nhanh & Chính xác 100%).<br/>
            - Đọc TKB bằng AI (Hỗ trợ cấu hình luật xếp lịch).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Tên giáo viên (đúng như trong TKB)</Label>
              <Input 
                placeholder="Ví dụ: Quang" 
                value={teacherName} 
                onChange={(e) => setTeacherName(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Thời gian (Tuần)</Label>
              <Input 
                placeholder="Ví dụ: 7/9/26-12/9/26" 
                value={weekRange} 
                onChange={(e) => setWeekRange(e.target.value)} 
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-semibold">1. Quản lý Phụ lục (PPCT) đã tải</Label>
            
            {cachedFiles.length > 0 && (
              <div className="space-y-3">
                {cachedFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-3 bg-slate-50 border p-3 rounded-md">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">{file.fileName}</p>
                      <p className="text-xs text-slate-500">Đã đọc {file.lessons.length} tiết</p>
                    </div>
                    <div className="w-1/3">
                      <Label className="text-xs text-slate-500 mb-1 block">Tên môn (Phải khớp với TKB)</Label>
                      <Input 
                        value={file.subjectName} 
                        onChange={(e) => handleSubjectNameChange(file.id, e.target.value)}
                        className="h-8 text-sm font-medium"
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteCachedFile(file.id)} className="text-red-500 hover:text-red-700 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors">
              <PlusCircle className="w-6 h-6 mb-2 text-primary" />
              <input type="file" accept=".docx" multiple className="hidden" id="ppct-upload" onChange={handlePpctFilesChange} />
              <Label htmlFor="ppct-upload" className="cursor-pointer text-primary font-medium hover:underline text-center text-sm">
                Tải lên thêm file Phụ lục (.docx)
              </Label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            {/* TKB Sang */}
            <div className="space-y-2">
              <Label>2. TKB Buổi SÁNG (Ảnh)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors h-32 relative group">
                {tkbSangFile ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle2 className="w-6 h-6 mb-2 text-green-500" />
                    <span className="text-xs font-medium text-center truncate max-w-full px-2">{tkbSangFile.name}</span>
                    <Button variant="ghost" size="sm" onClick={clearTkbSang} className="mt-2 text-red-500 h-6 text-xs">Xóa</Button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 mb-1 text-slate-400" />
                    <input type="file" accept="image/*,.xlsx,.xls" className="hidden" id="tkb-sang-upload" onChange={handleTkbSangChange} />
                    <Label htmlFor="tkb-sang-upload" className="cursor-pointer text-primary font-medium hover:underline text-center text-xs">Chọn TKB Sáng</Label>
                  </>
                )}
              </div>
            </div>

            {/* TKB Chieu */}
            <div className="space-y-2">
              <Label>3. TKB Buổi CHIỀU (Ảnh)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors h-32 relative group">
                {tkbChieuFile ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle2 className="w-6 h-6 mb-2 text-green-500" />
                    <span className="text-xs font-medium text-center truncate max-w-full px-2">{tkbChieuFile.name}</span>
                    <Button variant="ghost" size="sm" onClick={clearTkbChieu} className="mt-2 text-red-500 h-6 text-xs">Xóa</Button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 mb-1 text-slate-400" />
                    <input type="file" accept="image/*,.xlsx,.xls" className="hidden" id="tkb-chieu-upload" onChange={handleTkbChieuChange} />
                    <Label htmlFor="tkb-chieu-upload" className="cursor-pointer text-primary font-medium hover:underline text-center text-xs">Chọn TKB Chiều</Label>
                  </>
                )}
              </div>
            </div>

            {/* Old Schedule */}
            <div className="space-y-2">
              <Label>4. Lịch cũ (Tùy chọn, .xlsx)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors h-32 relative group">
                {oldScheduleFile ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle2 className="w-6 h-6 mb-2 text-green-500" />
                    <span className="text-xs font-medium text-center truncate max-w-full px-2">{oldScheduleFile.name}</span>
                    <Button variant="ghost" size="sm" onClick={() => setOldScheduleFile(null)} className="mt-2 text-red-500 h-6 text-xs">Xóa</Button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 mb-1 text-slate-400" />
                    <input type="file" accept=".xlsx" className="hidden" id="old-schedule-upload" onChange={(e) => setOldScheduleFile(e.target.files?.[0] || null)} />
                    <Label htmlFor="old-schedule-upload" className="cursor-pointer text-primary font-medium hover:underline text-center text-xs">Chọn lịch tuần trước</Label>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Lưu ý / Quy tắc đặc biệt cho AI khi đọc TKB (Tùy chọn)</Label>
            <textarea 
              placeholder="VD: Môn Toán tách làm 2 môn: Toán Đại và Toán Hình. Hoặc: Môn HĐTN xếp 3 tiết liên tiếp bắt đầu từ tiết trên TKB..."
              value={tkbRules}
              onChange={e => setTkbRules(e.target.value)}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          
          <div className="p-4 bg-slate-50 rounded-lg border space-y-3">
            <Label className="font-semibold text-primary">Cấu hình Đánh số tiết Buổi CHIỀU</Label>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <input 
                  type="radio" 
                  id="fmt-suffix" 
                  name="afternoonFormat"
                  checked={afternoonFormat === 'suffix'} 
                  onChange={() => setAfternoonFormat('suffix')}
                />
                <Label htmlFor="fmt-suffix" className="cursor-pointer">Ký hiệu 1(c), 2(c)...</Label>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="radio" 
                  id="fmt-continuous" 
                  name="afternoonFormat"
                  checked={afternoonFormat === 'continuous'} 
                  onChange={() => setAfternoonFormat('continuous')}
                />
                <Label htmlFor="fmt-continuous" className="cursor-pointer">Tiếp nối Sáng (VD: 6, 7, 8...)</Label>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="radio" 
                  id="fmt-normal" 
                  name="afternoonFormat"
                  checked={afternoonFormat === 'normal'} 
                  onChange={() => setAfternoonFormat('normal')}
                />
                <Label htmlFor="fmt-normal" className="cursor-pointer">Bình thường (1, 2, 3...)</Label>
              </div>
            </div>
            
            {afternoonFormat === 'continuous' && (
              <div className="flex items-center gap-2 mt-2 pl-6 border-l-2 border-primary/20">
                <Label>Tiết đầu tiên của buổi chiều là tiết số:</Label>
                <Input 
                  type="number" 
                  className="w-20 h-8" 
                  value={afternoonStartPeriod} 
                  onChange={(e) => setAfternoonStartPeriod(parseInt(e.target.value) || 6)} 
                />
              </div>
            )}
          </div>
          
          {/* Progress Indicators */}
          {isProcessing || scheduleData.length > 0 ? (
            <div className="flex gap-4 justify-center items-center py-4 bg-slate-50 rounded-lg border">
              <div className={`flex items-center gap-2 ${progress.ppct === 'done' ? 'text-green-600' : progress.ppct === 'loading' ? 'text-primary' : 'text-slate-400'}`}>
                {progress.ppct === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                <span className="text-sm font-medium">1. Phân tích PPCT</span>
              </div>
              <div className="w-8 h-px bg-slate-300"></div>
              <div className={`flex items-center gap-2 ${progress.tkb === 'done' ? 'text-green-600' : progress.tkb === 'loading' ? 'text-primary' : 'text-slate-400'}`}>
                {progress.tkb === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                <span className="text-sm font-medium">2. Đọc TKB</span>
              </div>
              <div className="w-8 h-px bg-slate-300"></div>
              <div className={`flex items-center gap-2 ${progress.schedule === 'done' ? 'text-green-600' : progress.schedule === 'loading' ? 'text-primary' : 'text-slate-400'}`}>
                {progress.schedule === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                <span className="text-sm font-medium">3. Ghép lịch</span>
              </div>
            </div>
          ) : null}

          <div className="flex gap-4 pt-4">
            <Button 
              onClick={handleProcess} 
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang xử lý...</>
              ) : (
                <><FileSpreadsheet className="mr-2 h-4 w-4" /> Bắt đầu xếp lịch</>
              )}
            </Button>

            {scheduleData.length > 0 && (
              <Button 
                onClick={handleDownload}
                variant="outline"
                className="flex-1 border-primary text-primary hover:bg-primary/10"
              >
                <Download className="mr-2 h-4 w-4" /> Tải File Excel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {scheduleData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kết quả Lịch Báo Giảng (Xem trước)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border p-2">Thứ / Buổi</th>
                    <th className="border p-2 text-center">Tiết</th>
                    <th className="border p-2">Môn</th>
                    <th className="border p-2">Lớp</th>
                    <th className="border p-2 text-center">PPCT</th>
                    <th className="border p-2">Tên bài</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.map((lesson, idx) => (
                    <tr key={idx} className="border-b hover:bg-slate-50">
                      <td className="border p-2 whitespace-pre-wrap font-medium">{`${lesson.day}\n${lesson.session}`}</td>
                      <td className="border p-2 text-center">
                        {getDisplayPeriod(lesson.period, lesson.session)}
                      </td>
                      <td className="border p-2">{lesson.subject}</td>
                      <td className="border p-2">{lesson.class_name}</td>
                      <td className="border p-2 text-center">{lesson.ppct_period || '-'}</td>
                      <td className="border p-2">{lesson.lesson_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

