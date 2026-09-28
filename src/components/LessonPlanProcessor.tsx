import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUp, FileDown, Calendar as CalendarIcon, Loader2, Info, CheckCircle2, Sparkles, Key, Eye, EyeOff, Terminal, Layout, PenTool, Coffee, Youtube } from 'lucide-react';
import { SignatureModal } from './SignatureModal';
import { AppendixManager } from './AppendixManager';
import { CoffeeModal } from './CoffeeModal';
import { processWordFile, signWordDocument, ScheduleItem, ProcessingOptions, HeaderFooterSettings } from '@/lib/word-utils';
import { toast } from 'sonner';
import { format, addDays, startOfWeek } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { vi } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SubjectType, GradeType, ReflectionSettings } from '@/types';
import { Switch } from '@/components/ui/switch';

const SUBJECTS: SubjectType[] = [
  'Toán', 'Vật lý', 'Hóa học', 'Sinh học', 'Khoa học tự nhiên',
  'Ngữ văn', 'Tiếng Anh', 'Tin học', 'Lịch sử', 'Địa lý', 'GDCD',
  'Công nghệ', 'Âm nhạc', 'Mỹ thuật', 'Thể dục', 'Hoạt động trải nghiệm'
];

const GRADES: GradeType[] = [
  'Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5',
  'Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9',
  'Lớp 10', 'Lớp 11', 'Lớp 12'
];

const DAYS_OF_WEEK = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 4, label: 'Thứ 4' }, // Wait, Thứ 4 should be 3? Let me check ScheduleSettings
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 0, label: 'Chủ Nhật' },
];
// Correcting DAYS_OF_WEEK to match ScheduleSettings
const DAYS_OF_WEEK_MAP = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 0, label: 'Chủ Nhật' },
];

const DEFAULT_REFLECTION: ReflectionSettings = {
  enabled: true,
  title: 'Rút kinh nghiệm',
  contentLines: 3,
  approverTitle: 'TỔ TRƯỞNG KÝ DUYỆT',
  approverName: '',
  year: '2026',
  autoSigningDate: true,
  showReflection: true,
  showSigningDate: true,
  location: 'Đường Hào',
  teacherName: 'Phạm Đình Quang',
  insertSignature: false,
};

import { extractTextFromDocx } from '@/lib/nls-utils';

export function LessonPlanProcessor() {
  const [file, setFile] = useState<File | null>(null);
  const [appendix1Text, setAppendix1Text] = useState<string>('');
  const [appendix3Text, setAppendix3Text] = useState<string>('');
  const [weekNumber, setWeekNumber] = useState('');
  const [periodNumber, setPeriodNumber] = useState('');
  const [prepDate, setPrepDate] = useState<Date>(new Date());
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [lessonCount, setLessonCount] = useState('1');
  const [createScheduleTable, setCreateScheduleTable] = useState(true);
  const [weekOffset, setWeekOffset] = useState('1');
  const [classOffsets, setClassOffsets] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [hfSettings, setHfSettings] = useState<HeaderFooterSettings | null>(null);
  const [reflectionSettings, setReflectionSettings] = useState<ReflectionSettings>(DEFAULT_REFLECTION);

  // NLS State
  const [enableNLS, setEnableNLS] = useState(false);
  const [enableReflection, setEnableReflection] = useState(true);
  const [nlsApiKey, setNlsApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [nlsGrade, setNlsGrade] = useState<GradeType | ''>('');
  const [aiModel, setAiModel] = useState<string>('gemini-3.6-flash');
  const [addNlsColumn, setAddNlsColumn] = useState(true);
  const [mergePeriods, setMergePeriods] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showSigModal, setShowSigModal] = useState(false);
  const [savedSignatureUrl, setSavedSignatureUrl] = useState('');
  const [showCoffeeModal, setShowCoffeeModal] = useState(false);
  
  const updateReflection = (key: string, value: any) => {
    setReflectionSettings(prev => {
      const next = { ...prev, [key]: value, enabled: true };
      localStorage.setItem('lesson-plan-reflection-settings', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const savedSchedule = localStorage.getItem('lesson-plan-schedule');
    if (savedSchedule) {
      try {
        const parsed = JSON.parse(savedSchedule);
        setSchedule(parsed);
        if (parsed.length > 0 && !selectedSubject) {
          setSelectedSubject(parsed[0].subject);
        }
      } catch (e) {
        console.error('Failed to parse schedule', e);
      }
    }

    const savedHF = localStorage.getItem('lesson-plan-hf-settings');
    if (savedHF) {
      try {
        setHfSettings(JSON.parse(savedHF));
      } catch (e) {
        console.error('Failed to parse HF settings', e);
      }
    }

    const savedSig = localStorage.getItem('lesson-plan-signature-image');
    if (savedSig) {
      setSavedSignatureUrl(savedSig);
    }

    const savedReflection = localStorage.getItem('lesson-plan-reflection-settings');
    if (savedReflection) {
      try {
        const parsed = JSON.parse(savedReflection);
        // Merge with defaults so new fields are always present
        setReflectionSettings(prev => ({
          ...DEFAULT_REFLECTION,
          ...prev,
          ...parsed,
          enabled: true,
        }));
      } catch (e) {
        console.error('Failed to parse reflection settings', e);
      }
    }

    const savedKey = localStorage.getItem('USER_GEMINI_API_KEY');
    if (savedKey) setNlsApiKey(savedKey);
    
    const savedModel = localStorage.getItem('USER_GEMINI_AI_MODEL');
    if (savedModel) setAiModel(savedModel);
  }, []);

  const subjects = useMemo(() => {
    const fromSchedule = Array.from(new Set(schedule.map(s => s.subject)));
    return Array.from(new Set([...fromSchedule, ...SUBJECTS]));
  }, [schedule]);

  const classes = useMemo(() => {
    if (!selectedSubject) return [];
    const allForSubject = Array.from(new Set(schedule
      .filter(s => s.subject.toLowerCase().startsWith(selectedSubject.toLowerCase()))
      .map(s => s.className)
    ));
    return allForSubject;
  }, [schedule, selectedSubject]);

  useEffect(() => {
    if (classes.length > 0) {
      setSelectedClasses(classes);
    } else {
      setSelectedClasses([]);
    }
  }, [classes]);

  const calculatedDates = useMemo(() => {
    if (!prepDate || !selectedSubject || schedule.length === 0) return [];
    
    const startOfTargetWeek = addDays(startOfWeek(prepDate, { weekStartsOn: 1 }), 7);
    const weeksToCalculate = 4; // Look ahead 4 weeks
    const count = parseInt(lessonCount) || 1;
    
    const getSessionsForWeek = (weekStart: Date, weekOffset: number) => {
      const currentWeekNum = (parseInt(weekNumber) || 0) + weekOffset;
      return schedule
        .filter(s => s.subject.toLowerCase().startsWith(selectedSubject.toLowerCase()))
        .sort((a, b) => {
          const dayA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
          const dayB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
          if (dayA !== dayB) return dayA - dayB;
          return (a.period || '').localeCompare(b.period || '');
        })
        .map(s => {
          const date = addDays(weekStart, s.dayOfWeek === 0 ? 6 : s.dayOfWeek - 1);
          return { 
            className: s.className, 
            date: format(date, 'dd/MM/yyyy'),
            period: s.period,
            dayLabel: DAYS_OF_WEEK_MAP.find(d => d.value === s.dayOfWeek)?.label,
            weekNum: currentWeekNum
          };
        });
    };

    return selectedClasses.map(className => {
      let allAvailableSessions: any[] = [];
      for (let i = 0; i < weeksToCalculate; i++) {
        const weekStart = addDays(startOfTargetWeek, i * 7);
        const sessions = getSessionsForWeek(weekStart, i);
        allAvailableSessions = [...allAvailableSessions, ...sessions.filter(s => s.className === className)];
      }
      
      const startIndex = (classOffsets[className] || 1) - 1;
      const selectedSessions = allAvailableSessions.slice(startIndex, startIndex + count);

      const dateToPeriods: Record<string, string[]> = {};
      selectedSessions.forEach(s => {
        if (!dateToPeriods[s.date]) dateToPeriods[s.date] = [];
        if (s.period) dateToPeriods[s.date].push(s.period);
      });

      const displayDates = Object.entries(dateToPeriods).map(([date, periods]) => {
        if (periods.length > 1) {
          return `${date} (${periods.join(', ')})`;
        }
        return date;
      });

      return { className, date: displayDates.join(', ') || 'N/A' };
    });
  }, [prepDate, selectedSubject, schedule, lessonCount, classOffsets, selectedClasses, weekNumber]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.docx')) {
        setFile(selectedFile);
      } else {
        toast.error('Vui lòng chọn file Word (.docx)');
        e.target.value = '';
      }
    }
  };

  const getClassSessions = (className: string) => {
    const startOfTargetWeek = addDays(startOfWeek(prepDate, { weekStartsOn: 1 }), 7);
    const weeksToCalculate = 4;
    let allSessions: any[] = [];

    for (let i = 0; i < weeksToCalculate; i++) {
      const weekStart = addDays(startOfTargetWeek, i * 7);
      const currentWeekNum = (parseInt(weekNumber) || 0) + i;
      const sessions = schedule
        .filter(s => s.subject.toLowerCase().startsWith(selectedSubject.toLowerCase()) && s.className === className)
        .sort((a, b) => {
          const dayA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
          const dayB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
          if (dayA !== dayB) return dayA - dayB;
          return (a.period || '').localeCompare(b.period || '');
        })
        .map(s => ({
          ...s,
          dayLabel: DAYS_OF_WEEK_MAP.find(d => d.value === s.dayOfWeek)?.label,
          weekNum: currentWeekNum
        }));
      allSessions = [...allSessions, ...sessions];
    }
    return allSessions;
  };

  const handleOffsetChange = (className: string, offset: number) => {
    setClassOffsets(prev => ({
      ...prev,
      [className]: offset
    }));
  };

  const handleProcess = async () => {
    if (!file) {
      toast.error('Vui lòng tải lên file giáo án');
      return;
    }
    if (!weekNumber || !periodNumber) {
      toast.error('Vui lòng nhập đầy đủ thông tin tuần và tiết');
      return;
    }
    if (!selectedSubject) {
      toast.error('Vui lòng chọn môn học');
      return;
    }

    if (enableNLS) {
      if (!nlsApiKey) {
        toast.error('Vui lòng nhập Gemini API Key');
        return;
      }
      if (!nlsGrade) {
        toast.error('Vui lòng chọn khối lớp cho Năng lực số');
        return;
      }
      localStorage.setItem('USER_GEMINI_API_KEY', nlsApiKey);
    }

    setIsProcessing(true);
    setLogs(["🚀 Bắt đầu xử lý..."]);
    try {
      const filteredSchedule = schedule.filter(s => selectedClasses.includes(s.className) && s.subject.toLowerCase().startsWith(selectedSubject.toLowerCase()));

              let appendixText = '';
        if (enableNLS) {
          if (appendix1Text) appendixText += "--- PHỤ LỤC 1 ---\n" + appendix1Text + "\n\n";
          if (appendix3Text) appendixText += "--- PHỤ LỤC 3 ---\n" + appendix3Text + "\n\n";
        }

      const options: ProcessingOptions = {
        weekNumber,
        periodNumber,
        prepDate,
        schedule: filteredSchedule,
        subject: selectedSubject,
        lessonCount: parseInt(lessonCount) || 1,
          createScheduleTable: createScheduleTable,
        weekOffset: parseInt(weekOffset) || 1,
        classOffsets: classOffsets,
        mergePeriods: mergePeriods,
        headerFooter: hfSettings || undefined,
        reflection: enableReflection ? {
          ...reflectionSettings,
          enabled: true,
          signatureImage: (reflectionSettings?.insertSignature && savedSignatureUrl) ? savedSignatureUrl : undefined
        } : undefined,
        nlsOptions: enableNLS ? {
          apiKey: nlsApiKey,
          subject: selectedSubject as SubjectType,
          grade: nlsGrade as GradeType,
          appendixText: appendixText,
          aiModel: aiModel,
          config: {
            insertObjectives: true,
            insertMaterials: true,
            insertActivities: true,
            appendTable: true
          },
          addNlsColumn: addNlsColumn
        } : undefined
      };

      const outputBlob = await processWordFile(file, options, (msg) => {
        setLogs(prev => [...prev, msg]);
      });
      
      const url = URL.createObjectURL(outputBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `GiaoAn_Tuan${weekNumber}_Tiet${periodNumber}_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Đã xử lý và tải xuống thành công!');
      setLogs(prev => [...prev, "✨ Hoàn tất!"]);
    } catch (error) {
      console.error('Processing error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi xử lý file';
      toast.error(errorMsg);
      setLogs(prev => [...prev, `❌ Lỗi: ${errorMsg}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickSign = async () => {
    if (!file) {
      toast.error('Vui lòng chọn hoặc tải lên file giáo án (.docx) cần ký!');
      return;
    }

    if (!savedSignatureUrl) {
      toast.info('Bạn chưa có ảnh chữ ký. Vui lòng tạo hoặc tải lên chữ ký trước!');
      setShowSigModal(true);
      return;
    }

    setIsProcessing(true);
    setLogs(["🖋️ Bắt đầu ký giáo án..."]);

    try {
      const outputBlob = await signWordDocument(
        file,
        {
          teacherName: reflectionSettings.teacherName || 'Phạm Đình Quang',
          location: reflectionSettings.location || 'Đường Hào',
          approverTitle: reflectionSettings.approverTitle || 'TỔ TRƯỞNG KÝ DUYỆT',
          approverName: reflectionSettings.approverName || '',
          signatureImage: savedSignatureUrl,
          showReflection: reflectionSettings.showReflection ?? false,
          reflectionLines: reflectionSettings.contentLines || 3,
        },
        (msg) => setLogs(prev => [...prev, msg])
      );

      const url = URL.createObjectURL(outputBlob);
      const link = document.createElement('a');
      link.href = url;
      const originalName = file.name.replace(/\.docx$/i, '');
      link.download = `[DaKy]_${originalName}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Ký giáo án thành công và đã tải xuống!');
      setLogs(prev => [...prev, "✨ Đã chèn chữ ký vào đúng vị trí và tải xuống thành công!"]);
    } catch (error) {
      console.error('Quick sign error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi ký file';
      toast.error(errorMsg);
      setLogs(prev => [...prev, `❌ Lỗi ký giáo án: ${errorMsg}`]);
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileUp className="w-5 h-5 text-primary" />
                  Thông tin Giáo án
                </CardTitle>
                <CardDescription className="mt-1">
                  Nhập các thông tin cơ bản để phần mềm tự động điền vào giáo án.
                </CardDescription>
              </div>
              <a
                href="https://youtu.be/hr-jLaG35hM"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-full transition-all shadow-sm hover:scale-105 shrink-0 self-start sm:self-center"
                title="Xem video hướng dẫn Soạn giáo án trên YouTube"
              >
                <Youtube className="w-4 h-4 text-red-600" />
                Video hướng dẫn
              </a>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subject-select">Môn học</Label>
                  <select
                    id="subject-select"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                  >
                    <option value="">Chọn môn học...</option>
                    {subjects.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lesson-count">Số tiết dạy</Label>
                    <span className="text-[10px] text-slate-400 font-normal">(Nhập số tùy ý)</span>
                  </div>
                  <div className="relative">
                    <Input
                      id="lesson-count"
                      type="number"
                      min="1"
                      className="flex h-10 w-full pr-12 text-sm font-medium"
                      placeholder="VD: 1, 2, 6, 8..."
                      value={lessonCount}
                      onChange={(e) => setLessonCount(e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none select-none">
                      tiết
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="week-offset">Khoảng cách tuần dạy</Label>
                  <select
                    id="week-offset"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={weekOffset}
                    onChange={(e) => setWeekOffset(e.target.value)}
                  >
                    <option value="1">Tuần kế tiếp (Cách 1 tuần)</option>
                    <option value="2">Cách 2 tuần</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 py-2 px-1 bg-slate-50 rounded-md border mt-2">
                <Switch 
                  id="create-schedule-table"
                  checked={createScheduleTable}
                  onCheckedChange={setCreateScheduleTable}
                />
                <Label htmlFor="create-schedule-table" className="text-xs cursor-pointer">
                  <span className="font-medium">Tạo bảng lịch dạy chi tiết</span>
                  <span className="text-slate-400 ml-1">(Tắt = ghi dòng đơn giản: Tiết X. Ngày dạy: ...)</span>
                </Label>
              </div>

              {classes.length > 0 && (
                <div className="space-y-3 p-4 border rounded-lg bg-slate-50/50">
                  <Label className="text-sm font-semibold">Chọn lớp áp dụng giáo án này:</Label>
                  <div className="flex flex-wrap gap-4">
                    {classes.map(className => (
                      <div key={className} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`class-${className}`}
                          checked={selectedClasses.includes(className)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClasses(prev => [...prev, className]);
                            } else {
                              setSelectedClasses(prev => prev.filter(c => c !== className));
                            }
                          }}
                          className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                        />
                        <Label htmlFor={`class-${className}`} className="text-sm cursor-pointer">
                          {className} <span className="text-slate-500 text-xs ml-1">
                            ({schedule.filter(s => s.className === className && s.subject.toLowerCase().startsWith(selectedSubject.toLowerCase())).map(s => `Thứ ${s.dayOfWeek === 0 ? 'CN' : s.dayOfWeek + 1} (${s.period || '?'})`).join(', ')})
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    * Chỉ những lớp được tích chọn mới xuất hiện trong bảng lịch dạy của giáo án này.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="week">Tuần</Label>
                  <Input 
                    id="week" 
                    placeholder="VD: 25" 
                    value={weekNumber} 
                    onChange={(e) => setWeekNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="period">Tiết PPCT (Bắt đầu)</Label>
                  <Input 
                    id="period" 
                    placeholder="VD: 49" 
                    value={periodNumber} 
                    onChange={(e) => setPeriodNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ngày soạn</Label>
                <Popover>
                  <PopoverTrigger
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full justify-start text-left font-normal",
                      !prepDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {prepDate ? format(prepDate, 'dd/MM/yyyy') : <span>Chọn ngày soạn</span>}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={prepDate}
                      onSelect={(date) => date && setPrepDate(date)}
                      initialFocus
                      locale={vi}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Tải lên file giáo án (.docx)</Label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 border-slate-200 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileUp className="w-8 h-8 mb-3 text-slate-400" />
                      <p className="mb-2 text-sm text-slate-600">
                        <span className="font-semibold">{file ? file.name : 'Nhấp để tải lên file Word'}</span>
                      </p>
                      <p className="text-xs text-slate-400">Chỉ chấp nhận file .docx</p>
                    </div>
                    <input 
                      id="file" 
                      type="file" 
                      className="hidden" 
                      accept=".docx" 
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleQuickSign}
                disabled={isProcessing}
                className="w-full sm:w-1/2 h-12 text-sm sm:text-base font-bold border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/40 shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                title="Ký ngay vào đúng vị trí giáo viên mà không làm thay đổi các phần khác của giáo án"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <PenTool className="w-5 h-5 text-emerald-600" />
                )}
                <span>🖋️ Ký giáo án (Chỉ chèn chữ ký)</span>
              </Button>

              <Button 
                type="button"
                onClick={handleProcess} 
                className="w-full sm:w-1/2 h-12 text-sm sm:text-base font-semibold shadow-sm flex items-center justify-center gap-2" 
                disabled={isProcessing || !file || !weekNumber || !periodNumber || !selectedSubject}
                title="Soạn giáo án đầy đủ: Điền tuần, tiết, ngày dạy, năng lực số và ký duyệt"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <FileDown className="w-5 h-5" />
                    Xử lý toàn diện & Tải xuống
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                <CheckCircle2 className="w-4 h-4" />
                Xem trước & Cấu hình lớp
              </CardTitle>
              <CardDescription className="text-xs">
                Điều chỉnh tiết bắt đầu cho từng lớp nếu phân phối chương trình bị lệch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {calculatedDates.length > 0 ? (
                <div className="rounded-lg border bg-white overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[10px] h-8">Lớp</TableHead>
                        <TableHead className="text-[10px] h-8">Bắt đầu từ</TableHead>
                        <TableHead className="text-[10px] h-8">Lịch dạy dự kiến</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculatedDates.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="py-2 text-[10px] font-medium">{d.className}</TableCell>
                          <TableCell className="py-2">
                            <select
                              className="h-6 w-full rounded border bg-white text-[10px] px-1 focus:ring-1 focus:ring-primary outline-none"
                              value={classOffsets[d.className] || 1}
                              onChange={(e) => handleOffsetChange(d.className, parseInt(e.target.value))}
                            >
                              {getClassSessions(d.className).map((s, idx) => (
                                <option key={idx} value={idx + 1}>
                                  T.{s.weekNum} - {s.dayLabel} {s.period ? `(${s.period})` : `(Tiết ${idx + 1})`}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="py-2 text-[10px] text-primary font-medium">{d.date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400 italic">
                  {schedule.length === 0 
                    ? "Chưa có lịch dạy. Hãy vào Cài đặt." 
                    : "Chọn môn học và ngày soạn để xem trước."}
                </div>
              )}
              <p className="text-[9px] text-slate-400 mt-3 italic leading-tight">
                * "Bắt đầu từ" giúp xử lý trường hợp các lớp đang ở các tiết khác nhau trong tuần.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 border-amber-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-amber-800 flex items-center gap-2">
                <Info className="w-3 h-3" />
                Lưu ý quan trọng
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[11px] text-amber-700 space-y-2 leading-relaxed">
              <p>• Phần mềm sẽ tự động tìm <strong>Tuần tiếp theo</strong> kể từ ngày soạn để điền ngày dạy.</p>
              <p>• Đảm bảo bạn đã nhập đúng <strong>Môn học</strong> trong phần Cài đặt để bộ lọc hoạt động chính xác.</p>
              <p>• File Word sau khi xử lý sẽ có thêm bảng thông tin ở ngay đầu tài liệu.</p>
            </CardContent>
          </Card>
        </div>
<div className="lg:col-span-5 space-y-6">
          <Card className="border-teal-200 bg-teal-50/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-teal-700">
                  <Sparkles className="w-4 h-4" />
                  Tích hợp Năng lực số
                </CardTitle>
                <Switch 
                  checked={enableNLS} 
                  onCheckedChange={setEnableNLS} 
                />
              </div>
              <CardDescription className="text-xs">
                Sử dụng AI để tự động tích hợp các mục tiêu và hoạt động năng lực số.
              </CardDescription>
            </CardHeader>
            {enableNLS && (
              <CardContent className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="api-key" className="text-xs font-semibold">Gemini API Key</Label>
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-[10px] text-teal-600 hover:underline flex items-center gap-1"
                    >
                      Lấy Key miễn phí
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input 
                        id="api-key"
                        type={showApiKey ? "text" : "password"}
                        value={nlsApiKey}
                        onChange={(e) => setNlsApiKey(e.target.value)}
                        placeholder="AIza..."
                        className="pr-10 text-xs h-9"
                      />
                      <button 
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-9 px-3 text-xs bg-teal-100 hover:bg-teal-200 text-teal-800"
                      onClick={() => {
                        localStorage.setItem('USER_GEMINI_API_KEY', nlsApiKey);
                        toast.success('Đã lưu API Key');
                      }}
                    >
                      Lưu
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nls-grade" className="text-xs font-semibold">Khối lớp (cho NLS)</Label>
                  <select
                    id="nls-grade"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={nlsGrade}
                    onChange={(e) => setNlsGrade(e.target.value as GradeType)}
                  >
                    <option value="">Chọn khối lớp...</option>
                    {GRADES.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ai-model" className="text-xs font-semibold">Mô hình AI</Label>
                  <select
                    id="ai-model"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={aiModel}
                    onChange={(e) => {
                      setAiModel(e.target.value);
                      localStorage.setItem('USER_GEMINI_AI_MODEL', e.target.value);
                    }}
                  >
                    <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
                    <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                    <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite</option>
                    <option value="gemini-3.1-pro">Gemini 3.1 Pro</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  </select>
                </div>
                
                <div className="flex items-center space-x-2 pt-2 pb-2">
                  <Switch 
                    id="merge-periods"
                    checked={mergePeriods}
                    onCheckedChange={setMergePeriods}
                  />
                  <Label htmlFor="merge-periods" className="text-xs">
                    Gộp tiết (Bỏ "Tiết 1", "Tiết 2")
                  </Label>
                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <AppendixManager 
                    type="PL1" 
                    subject={selectedSubject as any} 
                    grade={nlsGrade as any} 
                    onAppendixLoaded={setAppendix1Text} 
                  />
                  <AppendixManager 
                    type="PL3" 
                    subject={selectedSubject as any} 
                    grade={nlsGrade as any} 
                    onAppendixLoaded={setAppendix3Text} 
                  />
                </div>

                <div className="flex items-center space-x-2 pt-2 border-t border-teal-100 mt-2">
                  <Switch 
                    id="add-nls-column"
                    checked={addNlsColumn}
                    onCheckedChange={(c) => {
                      setAddNlsColumn(c);
                      localStorage.setItem('USER_ADD_NLS_COL', c.toString());
                    }}
                  />
                  <Label htmlFor="add-nls-column" className="text-xs">
                    Thêm cột NLS-AI riêng (Tắt để chèn thẳng vào cột 2)
                  </Label>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-teal-100 text-xs">
                  <span className="text-teal-800 text-[11px] font-medium">Ủng hộ tác giả:</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCoffeeModal(true)}
                    className="h-7 px-2.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 font-medium flex items-center gap-1.5 rounded-full"
                  >
                    <Coffee className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                    Mời tác giả 1 ly cafe
                  </Button>
                </div>



                {logs.length > 0 && (
                  <div className="bg-slate-900 rounded-lg p-3 font-mono text-[10px] text-slate-300 space-y-1 max-h-32 overflow-y-auto">
                    <div className="flex items-center gap-2 text-slate-500 border-b border-slate-800 pb-1 mb-1 uppercase tracking-tighter">
                      <Terminal className="w-3 h-3" /> Console
                    </div>
                    {logs.map((log, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-teal-500 shrink-0 select-none">$</span>
                        <span className={cn(
                          log.startsWith("❌") ? "text-red-400" : 
                          log.startsWith("✓") || log.startsWith("✨") ? "text-emerald-400" : ""
                        )}>{log}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700">
                  <Layout className="w-4 h-4" />
                  Rút kinh nghiệm & Ký duyệt
                </CardTitle>
                <Switch 
                  checked={enableReflection} 
                  onCheckedChange={setEnableReflection} 
                />
              </div>
              <CardDescription className="text-xs">
                Chèn phần rút kinh nghiệm và chữ ký duyệt vào cuối giáo án.
              </CardDescription>
            </CardHeader>
            {enableReflection && (
              <CardContent className="space-y-3.5 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Họ tên giáo viên</Label>
                    <Input
                      value={reflectionSettings.teacherName || ''}
                      onChange={(e) => updateReflection('teacherName', e.target.value)}
                      placeholder="VD: Phạm Đình Quang"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Địa danh ký</Label>
                    <Input
                      value={reflectionSettings.location || ''}
                      onChange={(e) => updateReflection('location', e.target.value)}
                      placeholder="VD: Đường Hào"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Chức vụ duyệt</Label>
                    <select
                      value={reflectionSettings.approverTitle || 'TỔ TRƯỞNG KÝ DUYỆT'}
                      onChange={(e) => updateReflection('approverTitle', e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 text-xs"
                    >
                      <option value="TỔ TRƯỞNG KÝ DUYỆT">Tổ trưởng</option>
                      <option value="TỔ PHÓ KÝ DUYỆT">Tổ phó</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700">Tên người duyệt</Label>
                    <Input
                      value={reflectionSettings.approverName || ''}
                      onChange={(e) => updateReflection('approverName', e.target.value)}
                      placeholder="(Để trống nếu ký tay)"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Label htmlFor="auto-signing" className="text-xs">
                    Tự động tính ngày ký (Thứ 7 tuần trước)
                  </Label>
                  <Switch
                    id="auto-signing"
                    checked={reflectionSettings?.autoSigningDate !== false}
                    onCheckedChange={(c) => updateReflection('autoSigningDate', c)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="show-reflection" className="text-xs">
                    Thêm mục "Rút kinh nghiệm"
                  </Label>
                  <Switch
                    id="show-reflection"
                    checked={reflectionSettings?.showReflection !== false}
                    onCheckedChange={(c) => updateReflection('showReflection', c)}
                  />
                </div>
                
                <div className="border-t border-amber-200/80 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="insert-signature" className="text-xs font-semibold text-amber-900">
                      Chèn ảnh chữ ký giáo viên
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 bg-white" onClick={() => setShowSigModal(true)}>
                        <PenTool className="w-3 h-3 mr-1" /> {savedSignatureUrl ? 'Đổi chữ ký' : 'Tạo mới'}
                      </Button>
                      <Switch
                        id="insert-signature"
                        checked={reflectionSettings?.insertSignature === true}
                        onCheckedChange={(c) => updateReflection('insertSignature', c)}
                      />
                    </div>
                  </div>

                  {savedSignatureUrl ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border border-dashed border-amber-300 p-2.5 rounded-lg bg-white shadow-xs">
                        <div 
                          className="h-12 w-32 flex items-center justify-center p-1 rounded bg-slate-50 border border-slate-200"
                          style={{
                            backgroundImage: 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
                            backgroundSize: '10px 10px',
                            backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px'
                          }}
                        >
                          <img src={savedSignatureUrl} className="max-h-full max-w-full object-contain" alt="Chữ ký đã lưu" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[11px] px-2 text-slate-700 bg-white"
                            onClick={() => setShowSigModal(true)}
                          >
                            Ký lại
                          </Button>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-[11px] text-red-500 hover:text-red-700"
                            onClick={() => {
                              setSavedSignatureUrl('');
                              localStorage.removeItem('lesson-plan-signature-image');
                              toast.info('Đã xóa chữ ký');
                            }}
                          >
                            Xóa
                          </Button>
                        </div>
                      </div>

                      {/* Quick Sign shortcut right inside signature card */}
                      <Button
                        type="button"
                        onClick={handleQuickSign}
                        disabled={isProcessing}
                        className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        Ký ngay vào file giáo án đang chọn
                      </Button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-700 bg-amber-100/60 p-2.5 rounded-lg border border-amber-300 flex items-center justify-between">
                      <span>Chưa có ảnh chữ ký lưu sẵn.</span>
                      <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2 ml-2 bg-white" onClick={() => setShowSigModal(true)}>
                        <PenTool className="w-3 h-3 mr-1" /> Tạo / Tải lên ngay
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        </div>

      </div>
      <SignatureModal 
        open={showSigModal} 
        onOpenChange={setShowSigModal} 
        onSave={(img) => {
          setSavedSignatureUrl(img);
          localStorage.setItem('lesson-plan-signature-image', img);
          updateReflection('insertSignature', true);
        }}
      />
      <CoffeeModal 
        open={showCoffeeModal} 
        onOpenChange={setShowCoffeeModal} 
      />
    </div>
  );
}
