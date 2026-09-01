import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUp, FileDown, Calendar as CalendarIcon, Loader2, Info, CheckCircle2, Sparkles, Key, Eye, EyeOff, Terminal, Layout } from 'lucide-react';
import { processWordFile, ScheduleItem, ProcessingOptions, HeaderFooterSettings } from '@/lib/word-utils';
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

import { extractTextFromDocx } from '@/lib/nls-utils';

export function LessonPlanProcessor() {
  const [file, setFile] = useState<File | null>(null);
  const [appendix1File, setAppendix1File] = useState<File | null>(null);
  const [appendix3File, setAppendix3File] = useState<File | null>(null);
  const [weekNumber, setWeekNumber] = useState('');
  const [periodNumber, setPeriodNumber] = useState('');
  const [prepDate, setPrepDate] = useState<Date>(new Date());
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [lessonCount, setLessonCount] = useState('1');
  const [weekOffset, setWeekOffset] = useState('1');
  const [classOffsets, setClassOffsets] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [hfSettings, setHfSettings] = useState<HeaderFooterSettings | null>(null);
  const [reflectionSettings, setReflectionSettings] = useState<ReflectionSettings | null>(null);

  // NLS State
  const [enableNLS, setEnableNLS] = useState(false);
  const [enableReflection, setEnableReflection] = useState(true);
  const [nlsApiKey, setNlsApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [nlsGrade, setNlsGrade] = useState<GradeType | ''>('');
  const [aiModel, setAiModel] = useState<string>('gemini-3.6-flash');
  const [mergePeriods, setMergePeriods] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

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

    const savedReflection = localStorage.getItem('lesson-plan-reflection-settings');
    if (savedReflection) {
      try {
        const parsed = JSON.parse(savedReflection);
        // Merge with defaults so new fields are always present
        setReflectionSettings({
          showReflection: true,
          showSigningDate: true,
          ...parsed,
        });
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
    return fromSchedule.length > 0 ? fromSchedule : SUBJECTS;
  }, [schedule]);

  const classes = useMemo(() => {
    if (!selectedSubject) return [];
    const allForSubject = Array.from(new Set(schedule
      .filter(s => s.subject.toLowerCase() === selectedSubject.toLowerCase())
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
        .filter(s => s.subject.toLowerCase() === selectedSubject.toLowerCase())
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
        .filter(s => s.subject.toLowerCase() === selectedSubject.toLowerCase() && s.className === className)
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
      const filteredSchedule = schedule.filter(s => selectedClasses.includes(s.className));

      let appendixText = '';
      if (enableNLS) {
        if (appendix1File) {
          setLogs(prev => [...prev, ">> Đọc Phụ lục 1..."]);
          const text1 = await extractTextFromDocx(appendix1File);
          appendixText += "--- PHỤ LỤC 1 ---\n" + text1 + "\n\n";
        }
        if (appendix3File) {
          setLogs(prev => [...prev, ">> Đọc Phụ lục 3..."]);
          const text3 = await extractTextFromDocx(appendix3File);
          appendixText += "--- PHỤ LỤC 3 ---\n" + text3 + "\n\n";
        }
      }

      const options: ProcessingOptions = {
        weekNumber,
        periodNumber,
        prepDate,
        schedule: filteredSchedule,
        subject: selectedSubject,
        lessonCount: parseInt(lessonCount) || 1,
        weekOffset: parseInt(weekOffset) || 1,
        classOffsets: classOffsets,
        mergePeriods: mergePeriods,
        headerFooter: hfSettings || undefined,
        reflection: enableReflection && reflectionSettings?.enabled ? reflectionSettings : undefined,
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
          }
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

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="w-5 h-5 text-primary" />
                Thông tin Giáo án
              </CardTitle>
              <CardDescription>
                Nhập các thông tin cơ bản để phần mềm tự động điền vào giáo án.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label htmlFor="lesson-count">Số tiết dạy</Label>
                  <select
                    id="lesson-count"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={lessonCount}
                    onChange={(e) => setLessonCount(e.target.value)}
                  >
                    <option value="1">1 tiết</option>
                    <option value="2">2 tiết</option>
                    <option value="3">3 tiết</option>
                    <option value="4">4 tiết</option>
                    <option value="5">5 tiết</option>
                    <option value="6">6 tiết</option>
                  </select>
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
                          {className}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    * Chỉ những lớp được tích chọn mới xuất hiện trong bảng lịch dạy của giáo án này.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <CardFooter>
              <Button 
                onClick={handleProcess} 
                className="w-full h-12 text-lg font-semibold" 
                disabled={isProcessing || !file || !weekNumber || !periodNumber || !selectedSubject}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <FileDown className="mr-2 h-5 w-5" />
                    Xử lý & Tải xuống
                  </>
                )}
              </Button>
            </CardFooter>
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
                  <div className="relative">
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

                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Phụ lục 1 (Tùy chọn)</Label>
                    <input 
                      type="file" 
                      accept=".docx"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs file:border-0 file:bg-transparent file:text-xs file:font-medium"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                           setAppendix1File(e.target.files[0]);
                        } else {
                           setAppendix1File(null);
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Phụ lục 3 (Tùy chọn)</Label>
                    <input 
                      type="file" 
                      accept=".docx"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs file:border-0 file:bg-transparent file:text-xs file:font-medium"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                           setAppendix3File(e.target.files[0]);
                        } else {
                           setAppendix3File(null);
                        }
                      }}
                    />
                  </div>
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
                  Thêm Rút kinh nghiệm
                </CardTitle>
                <Switch 
                  checked={enableReflection} 
                  onCheckedChange={setEnableReflection} 
                />
              </div>
              <CardDescription className="text-xs">
                Chèn phần rút kinh nghiệm và ký duyệt vào cuối giáo án.
              </CardDescription>
            </CardHeader>
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
      </div>
    </div>
  );
}
