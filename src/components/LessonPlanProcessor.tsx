import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FileUp, FileDown, Calendar as CalendarIcon, Loader2, Info, CheckCircle2, 
  Sparkles, Key, Eye, EyeOff, Terminal, Layout, PenTool, Coffee, Youtube, 
  UserCheck, Columns2, Columns3, TableProperties,
  Files, Plus, Trash2, ArrowUpDown, RefreshCw, Archive, Download, FileText
} from 'lucide-react';
import JSZip from 'jszip';
import { SignatureModal } from './SignatureModal';
import { AppendixManager } from './AppendixManager';
import { CoffeeModal } from './CoffeeModal';
import { SubjectApproversModal } from './SubjectApproversModal';
import { processWordFile, signWordDocument, ScheduleItem, ProcessingOptions, HeaderFooterSettings } from '@/lib/word-utils';
import { toast } from 'sonner';
import { format, addDays, startOfWeek } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { vi } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SubjectType, GradeType, ReflectionSettings, SubjectApproversMap } from '@/types';
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

export interface LessonPlanFileItem {
  id: string;
  file: File;
  weekNumber: string;
  periodNumber: string;
  lessonCount: string;
  weekOffset: string;
  classOffsets: Record<string, number>;
  signingDateMode?: 'auto' | 'custom' | 'blank';
  customSigningDate?: string;
}

function computeNextFileConfig(
  prevConfig: LessonPlanFileItem,
  schedule: ScheduleItem[],
  selectedSubject: string,
  selectedClasses: string[],
  nextFile: File
): LessonPlanFileItem {
  const prevWeek = parseInt(prevConfig.weekNumber) || 0;
  const prevPeriod = parseInt(prevConfig.periodNumber) || 0;
  const prevCount = parseInt(prevConfig.lessonCount) || 1;
  const prevWeekOffset = parseInt(prevConfig.weekOffset) || 1;

  const nextPeriod = prevPeriod > 0 ? (prevPeriod + prevCount).toString() : '';
  const nextClassOffsets: Record<string, number> = {};
  let minWeeksAdvanced = 999;
  let hasClasses = false;

  const targetClasses = selectedClasses.length > 0 
    ? selectedClasses 
    : Array.from(new Set(schedule.filter(s => s.subject.toLowerCase().startsWith(selectedSubject.toLowerCase())).map(s => s.className)));

  targetClasses.forEach(className => {
    const classSessionsCount = schedule.filter(
      s => s.className === className && 
           s.subject.toLowerCase().startsWith(selectedSubject.toLowerCase())
    ).length;

    const startSession = (prevConfig.classOffsets && prevConfig.classOffsets[className]) || 1;
    if (classSessionsCount > 0) {
      hasClasses = true;
      const totalUsed = (startSession - 1) + prevCount;
      const weeksAdvanced = Math.floor(totalUsed / classSessionsCount);
      const nextSession = (totalUsed % classSessionsCount) + 1;
      nextClassOffsets[className] = nextSession;
      if (weeksAdvanced < minWeeksAdvanced) {
        minWeeksAdvanced = weeksAdvanced;
      }
    } else {
      nextClassOffsets[className] = 1;
    }
  });

  const weeksDelta = hasClasses ? (minWeeksAdvanced === 999 ? 1 : minWeeksAdvanced) : 1;
  const nextWeekOffset = (prevWeekOffset + (weeksDelta > 0 ? weeksDelta : 1)).toString();
  const nextWeek = prevWeek > 0 ? (prevWeek + (weeksDelta > 0 ? weeksDelta : 1)).toString() : '';

  return {
    id: Math.random().toString(36).substring(2, 9),
    file: nextFile,
    weekNumber: nextWeek,
    periodNumber: nextPeriod,
    lessonCount: prevConfig.lessonCount || '3',
    weekOffset: nextWeekOffset,
    classOffsets: nextClassOffsets,
  };
}

export function LessonPlanProcessor() {
  const [files, setFiles] = useState<LessonPlanFileItem[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [processedResults, setProcessedResults] = useState<{
    files: { name: string; blob: Blob; url: string }[];
    zipBlob?: Blob;
    zipUrl?: string;
  } | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [appendix1Text, setAppendix1Text] = useState<string>('');
  const [appendix3Text, setAppendix3Text] = useState<string>('');
  const [weekNumber, setWeekNumber] = useState('');
  const [periodNumber, setPeriodNumber] = useState('');
  const [prepDate, setPrepDate] = useState<Date>(new Date());
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [lessonCount, setLessonCount] = useState('3');
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
  const [addNlsColumn, setAddNlsColumn] = useState(false);
  const [mergePeriods, setMergePeriods] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showSigModal, setShowSigModal] = useState(false);
  const [savedSignatureUrl, setSavedSignatureUrl] = useState('');
  const [showCoffeeModal, setShowCoffeeModal] = useState(false);
  const [showApproverModal, setShowApproverModal] = useState(false);
  const [subjectApprovers, setSubjectApprovers] = useState<SubjectApproversMap>({});
  
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

    const savedApprovers = localStorage.getItem('lesson-plan-subject-approvers');
    if (savedApprovers) {
      try {
        setSubjectApprovers(JSON.parse(savedApprovers));
      } catch (e) {
        console.error('Failed to parse subject approvers', e);
      }
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

    const savedAddNlsCol = localStorage.getItem('USER_ADD_NLS_COL');
    if (savedAddNlsCol !== null) {
      setAddNlsColumn(savedAddNlsCol === 'true');
    }
  }, []);

  // Auto sync approver title and name when selectedSubject or subjectApprovers change
  useEffect(() => {
    if (!selectedSubject) return;
    const normSub = selectedSubject.trim().toLowerCase();

    let map = subjectApprovers;
    if (Object.keys(map).length === 0) {
      const saved = localStorage.getItem('lesson-plan-subject-approvers');
      if (saved) {
        try { map = JSON.parse(saved); } catch (e) {}
      }
    }

    const matchedKey = Object.keys(map).find(k => {
      const normK = k.trim().toLowerCase();
      return normK === normSub || normSub.startsWith(normK) || normK.startsWith(normSub);
    });

    if (matchedKey && map[matchedKey]) {
      const cfg = map[matchedKey];
      setReflectionSettings(prev => {
        if (prev.approverTitle === cfg.approverTitle && prev.approverName === cfg.approverName) {
          return prev;
        }
        const next = {
          ...prev,
          approverTitle: cfg.approverTitle,
          approverName: cfg.approverName || prev.approverName
        };
        localStorage.setItem('lesson-plan-reflection-settings', JSON.stringify(next));
        return next;
      });
    }
  }, [selectedSubject, subjectApprovers]);

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

  const activeSigningMode = reflectionSettings.signingDateMode || 
    (reflectionSettings.autoSigningDate !== false ? 'auto' : (reflectionSettings.customSigningDate ? 'custom' : 'blank'));

  const customSigningDateObj = useMemo(() => {
    if (!reflectionSettings.customSigningDate) return undefined;
    try {
      const parts = reflectionSettings.customSigningDate.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
      return new Date(reflectionSettings.customSigningDate);
    } catch {
      return undefined;
    }
  }, [reflectionSettings.customSigningDate]);

  const activeFile = files[activeFileIndex] || files[0] || null;

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  };

  const getFileSigningDate = (fileItem?: LessonPlanFileItem | null) => {
    const item = fileItem || activeFile;
    const mode = item?.signingDateMode || activeSigningMode;

    if (mode === 'blank') {
      return `ngày ...... tháng ...... năm ${reflectionSettings.year || '2026'}`;
    }

    if (mode === 'custom') {
      let customDate = item?.customSigningDate;
      if (!customDate && reflectionSettings.customSigningDate) {
        if (item && files.length > 1) {
          const file0Offset = parseInt(files[0]?.weekOffset || '1') || 1;
          const currentOffset = parseInt(item.weekOffset || '1') || 1;
          const weekDiff = currentOffset - file0Offset;
          if (weekDiff !== 0) {
            try {
              const parts = reflectionSettings.customSigningDate.split('-');
              const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
              customDate = format(addDays(d, weekDiff * 7), 'yyyy-MM-dd');
            } catch {
              customDate = reflectionSettings.customSigningDate;
            }
          } else {
            customDate = reflectionSettings.customSigningDate;
          }
        } else {
          customDate = reflectionSettings.customSigningDate;
        }
      }

      if (!customDate) {
        return `ngày ...... tháng ...... năm ${reflectionSettings.year || '2026'}`;
      }
      try {
        const parts = customDate.split('-');
        let d: Date;
        if (parts.length === 3) {
          d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          d = new Date(customDate);
        }
        if (!isNaN(d.getTime())) {
          return `ngày ${format(d, 'dd')} tháng ${format(d, 'MM')} năm ${format(d, 'yyyy')}`;
        }
      } catch (e) {
        return `ngày ...... tháng ...... năm ${reflectionSettings.year || '2026'}`;
      }
    }

    // mode === 'auto'
    const offset = parseInt(item?.weekOffset || weekOffset || '1') || 1;
    let targetDate: Date | null = null;
    if (prepDate && selectedSubject && schedule.length > 0) {
      const startOfTargetWeek = addDays(startOfWeek(prepDate, { weekStartsOn: 1 }), 7 * offset);
      const sessions = schedule
        .filter(s => s.subject.toLowerCase().startsWith(selectedSubject.toLowerCase()))
        .sort((a, b) => {
          const dayA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
          const dayB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
          return dayA - dayB;
        });
      if (sessions.length > 0) {
        const s = sessions[0];
        targetDate = addDays(startOfTargetWeek, s.dayOfWeek === 0 ? 6 : s.dayOfWeek - 1);
      } else {
        targetDate = startOfTargetWeek;
      }
    } else if (prepDate) {
      targetDate = addDays(startOfWeek(prepDate, { weekStartsOn: 1 }), 7 * offset);
    } else {
      targetDate = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7 * offset);
    }

    if (targetDate) {
      const startOfTeachingWeek = startOfWeek(targetDate, { weekStartsOn: 1 });
      const signingDate = addDays(startOfTeachingWeek, -2);
      return `ngày ${format(signingDate, 'dd')} tháng ${format(signingDate, 'MM')} năm ${format(signingDate, 'yyyy')}`;
    }

    return `ngày ...... tháng ...... năm ${reflectionSettings.year || '2026'}`;
  };

  const previewSigningDate = useMemo(() => {
    return getFileSigningDate(activeFile);
  }, [files, activeFileIndex, activeFile, activeSigningMode, reflectionSettings.customSigningDate, reflectionSettings.year, prepDate, selectedSubject, schedule, weekOffset]);

  const calculatedDates = useMemo(() => {
    if (!prepDate || !selectedSubject || schedule.length === 0) return [];
    
    const offset = parseInt(activeFile ? activeFile.weekOffset : weekOffset) || 1;
    const startOfTargetWeek = addDays(startOfWeek(prepDate, { weekStartsOn: 1 }), 7 * offset);
    const weeksToCalculate = 4; // Look ahead 4 weeks
    const count = parseInt(activeFile ? activeFile.lessonCount : lessonCount) || 1;
    const currentWeekNumBase = parseInt(activeFile ? activeFile.weekNumber : weekNumber) || 0;
    
    const getSessionsForWeek = (weekStart: Date, weekOffsetIdx: number) => {
      const currentWeekNum = currentWeekNumBase + weekOffsetIdx;
      return schedule
        .filter(s => s.subject.toLowerCase().startsWith(selectedSubject.toLowerCase()))
        .sort((a, b) => {
          const dayA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
          const dayB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
          return dayA - dayB;
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
      
      const currentOffsets = (activeFile ? activeFile.classOffsets : classOffsets) || {};
      const startIndex = (currentOffsets[className] || 1) - 1;
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
  }, [files, activeFileIndex, activeFile, prepDate, selectedSubject, schedule, selectedClasses, weekOffset, lessonCount, weekNumber, classOffsets]);

  const handleFilesSelected = (selectedFiles: FileList | File[]) => {
    const docxFiles = Array.from(selectedFiles).filter(f => f.name.toLowerCase().endsWith('.docx'));
    if (docxFiles.length === 0) {
      toast.error('Vui lòng chọn file Word định dạng .docx');
      return;
    }

    const sorted = docxFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    setFiles(prev => {
      let currentItems = [...prev];

      sorted.forEach(f => {
        if (currentItems.length === 0) {
          let detectedWeek = weekNumber || '';
          let detectedPeriod = periodNumber || '';
          const matchWeek = f.name.match(/(?:tu[aà]n|w)\s*(\d+)/i);
          if (matchWeek && !detectedWeek) detectedWeek = matchWeek[1];
          const matchPeriod = f.name.match(/(?:ti[eế]t|p)\s*(\d+)/i);
          if (matchPeriod && !detectedPeriod) detectedPeriod = matchPeriod[1];

          currentItems.push({
            id: Math.random().toString(36).substring(2, 9),
            file: f,
            weekNumber: detectedWeek,
            periodNumber: detectedPeriod,
            lessonCount: lessonCount || '3',
            weekOffset: weekOffset || '1',
            classOffsets: { ...classOffsets },
          });
        } else {
          const lastItem = currentItems[currentItems.length - 1];
          const nextItem = computeNextFileConfig(lastItem, schedule, selectedSubject, selectedClasses, f);
          currentItems.push(nextItem);
        }
      });

      return currentItems;
    });

    toast.success(`Đã thêm ${sorted.length} file giáo án`);
  };

  const handleFileChangeField = (index: number, field: keyof LessonPlanFileItem, value: any) => {
    setFiles(prev => {
      const updated = [...prev];
      const oldItem = updated[index];
      if (!oldItem) return prev;

      updated[index] = { ...oldItem, [field]: value };

      if (index === 0 && updated.length > 1) {
        const file1 = updated[0];
        const nextCalc = computeNextFileConfig(file1, schedule, selectedSubject, selectedClasses, updated[1].file);
        updated[1] = {
          ...updated[1],
          weekNumber: nextCalc.weekNumber,
          periodNumber: nextCalc.periodNumber,
          weekOffset: nextCalc.weekOffset,
          classOffsets: nextCalc.classOffsets,
          lessonCount: updated[1].lessonCount || file1.lessonCount
        };
      }

      return updated;
    });
  };

  const rechainFile = (targetIndex: number) => {
    if (targetIndex <= 0 || !files[targetIndex - 1]) return;
    const prevItem = files[targetIndex - 1];
    const chained = computeNextFileConfig(prevItem, schedule, selectedSubject, selectedClasses, files[targetIndex].file);
    setFiles(prev => {
      const next = [...prev];
      next[targetIndex] = {
        ...next[targetIndex],
        weekNumber: chained.weekNumber,
        periodNumber: chained.periodNumber,
        lessonCount: chained.lessonCount,
        weekOffset: chained.weekOffset,
        classOffsets: chained.classOffsets,
      };
      return next;
    });
    toast.success(`Đã tự động tính lại thông tin File ${targetIndex + 1} tiếp nối từ File ${targetIndex}`);
  };

  const swapFiles = () => {
    if (files.length !== 2) return;
    setFiles(prev => {
      const [f1, f2] = prev;
      const newF1: LessonPlanFileItem = { ...f1, file: f2.file };
      const newF2: LessonPlanFileItem = { ...f2, file: f1.file };
      return [newF1, newF2];
    });
    toast.success('Đã đảo thứ tự 2 file giáo án');
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (activeFileIndex >= index) {
      setActiveFileIndex(Math.max(0, activeFileIndex - 1));
    }
    toast.info('Đã xóa file');
  };

  const getClassSessions = (className: string) => {
    const offset = parseInt(activeFile ? activeFile.weekOffset : weekOffset) || 1;
    const startOfTargetWeek = addDays(startOfWeek(prepDate, { weekStartsOn: 1 }), 7 * offset);
    const weeksToCalculate = 4;
    const currentWeekNumBase = parseInt(activeFile ? activeFile.weekNumber : weekNumber) || 0;
    let allSessions: any[] = [];

    for (let i = 0; i < weeksToCalculate; i++) {
      const weekStart = addDays(startOfTargetWeek, i * 7);
      const currentWeekNum = currentWeekNumBase + i;
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
    if (files.length > 0) {
      setFiles(prev => {
        const next = [...prev];
        const idx = activeFileIndex < next.length ? activeFileIndex : 0;
        next[idx] = {
          ...next[idx],
          classOffsets: {
            ...next[idx].classOffsets,
            [className]: offset
          }
        };
        return next;
      });
    } else {
      setClassOffsets(prev => ({
        ...prev,
        [className]: offset
      }));
    }
  };

  const getResolvedCustomSigningDate = (item: LessonPlanFileItem, index: number) => {
    if (item.customSigningDate) return item.customSigningDate;
    if (!reflectionSettings.customSigningDate) return undefined;
    if (index > 0 && files.length > 1) {
      try {
        const file0Offset = parseInt(files[0]?.weekOffset || '1') || 1;
        const curOffset = parseInt(item.weekOffset || '1') || (index + 1);
        const diff = curOffset - file0Offset;
        const parts = reflectionSettings.customSigningDate.split('-');
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return format(addDays(d, diff * 7), 'yyyy-MM-dd');
      } catch {
        return reflectionSettings.customSigningDate;
      }
    }
    return reflectionSettings.customSigningDate;
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      toast.error('Vui lòng tải lên file giáo án');
      return;
    }
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.weekNumber || !f.periodNumber) {
        toast.error(`File ${i + 1} (${f.file.name}) chưa nhập tuần hoặc tiết!`);
        setActiveFileIndex(i);
        return;
      }
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
    setLogs([`🚀 Bắt đầu xử lý ${files.length} file giáo án...`]);
    setProcessedResults(null);

    const generatedBlobs: { name: string; blob: Blob; url: string }[] = [];

    try {
      const filteredSchedule = schedule.filter(s => 
        selectedClasses.includes(s.className) && 
        s.subject.toLowerCase().startsWith(selectedSubject.toLowerCase())
      );

      let appendixText = '';
      if (enableNLS) {
        if (appendix1Text) appendixText += "--- PHỤ LỤC 1 ---\n" + appendix1Text + "\n\n";
        if (appendix3Text) appendixText += "--- PHỤ LỤC 3 ---\n" + appendix3Text + "\n\n";
      }

      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        setLogs(prev => [...prev, `📂 [${i + 1}/${files.length}] Đang xử lý: ${item.file.name} (Tuần ${item.weekNumber}, Tiết ${item.periodNumber})...`]);

        const options: ProcessingOptions = {
          weekNumber: item.weekNumber,
          periodNumber: item.periodNumber,
          prepDate,
          schedule: filteredSchedule,
          subject: selectedSubject,
          lessonCount: parseInt(item.lessonCount) || 1,
          createScheduleTable: createScheduleTable,
          weekOffset: parseInt(item.weekOffset) || (i + 1),
          classOffsets: item.classOffsets,
          mergePeriods: mergePeriods,
          headerFooter: hfSettings || undefined,
          reflection: enableReflection ? {
            ...reflectionSettings,
            enabled: true,
            signingDateMode: item.signingDateMode || activeSigningMode,
            customSigningDate: getResolvedCustomSigningDate(item, i),
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

        const outputBlob = await processWordFile(item.file, options, (msg) => {
          setLogs(prev => [...prev, `[File ${i + 1}] ${msg}`]);
        });

        const downloadName = `GiaoAn_Tuan${item.weekNumber}_Tiet${item.periodNumber}_${item.file.name}`;
        const blobUrl = URL.createObjectURL(outputBlob);
        generatedBlobs.push({ name: downloadName, blob: outputBlob, url: blobUrl });

        downloadBlob(outputBlob, downloadName);
        setLogs(prev => [...prev, `✓ [${i + 1}/${files.length}] Đã hoàn tất & tải xuống: ${downloadName}`]);

        if (i < files.length - 1) {
          await new Promise(r => setTimeout(r, 600));
        }
      }

      let zipBlob: Blob | undefined;
      let zipUrl: string | undefined;
      if (generatedBlobs.length > 1) {
        const zip = new JSZip();
        generatedBlobs.forEach(g => zip.file(g.name, g.blob));
        zipBlob = await zip.generateAsync({ type: 'blob' });
        zipUrl = URL.createObjectURL(zipBlob);
      }

      setProcessedResults({
        files: generatedBlobs,
        zipBlob,
        zipUrl
      });

      toast.success(`Đã xử lý và tải xuống thành công ${files.length} file giáo án!`);
      setLogs(prev => [...prev, `✨ Hoàn tất xử lý ${files.length} file giáo án!`]);
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
    if (files.length === 0) {
      toast.error('Vui lòng tải lên file giáo án (.docx) cần ký!');
      return;
    }

    if (!savedSignatureUrl) {
      toast.info('Bạn chưa có ảnh chữ ký. Vui lòng tạo hoặc tải lên chữ ký trước!');
      setShowSigModal(true);
      return;
    }

    setIsProcessing(true);
    setLogs([`🖋️ Bắt đầu ký ${files.length} file giáo án...`]);
    setProcessedResults(null);

    const generatedBlobs: { name: string; blob: Blob; url: string }[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        setLogs(prev => [...prev, `🖋️ [${i + 1}/${files.length}] Đang ký: ${item.file.name}...`]);

        let earliestTeachingDate: Date | null = null;
        if (prepDate && selectedSubject && schedule.length > 0) {
          const offset = parseInt(item.weekOffset) || (i + 1);
          const startOfTargetWeek = addDays(startOfWeek(prepDate, { weekStartsOn: 1 }), 7 * offset);
          const sessions = schedule
            .filter(s => s.subject.toLowerCase().startsWith(selectedSubject.toLowerCase()))
            .sort((a, b) => {
              const dayA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
              const dayB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
              return dayA - dayB;
            });
          if (sessions.length > 0) {
            const s = sessions[0];
            earliestTeachingDate = addDays(startOfTargetWeek, s.dayOfWeek === 0 ? 6 : s.dayOfWeek - 1);
          }
        }

        const mode = item.signingDateMode || activeSigningMode;

        const outputBlob = await signWordDocument(
          item.file,
          {
            teacherName: reflectionSettings.teacherName || 'Phạm Đình Quang',
            location: reflectionSettings.location || 'Đường Hào',
            approverTitle: reflectionSettings.approverTitle || 'TỔ TRƯỞNG KÝ DUYỆT',
            approverName: reflectionSettings.approverName || '',
            signatureImage: savedSignatureUrl,
            showReflection: reflectionSettings.showReflection ?? false,
            reflectionLines: reflectionSettings.contentLines || 3,
            showSigningDate: reflectionSettings.showSigningDate !== false,
            autoSigningDate: mode === 'auto',
            signingDateMode: mode,
            customSigningDate: getResolvedCustomSigningDate(item, i),
            prepDate: prepDate,
            earliestTeachingDate: earliestTeachingDate,
          },
          (msg) => setLogs(prev => [...prev, `[File ${i + 1}] ${msg}`])
        );

        const originalName = item.file.name.replace(/\.docx$/i, '');
        const downloadName = `[DaKy]_${originalName}.docx`;
        const blobUrl = URL.createObjectURL(outputBlob);
        generatedBlobs.push({ name: downloadName, blob: outputBlob, url: blobUrl });

        downloadBlob(outputBlob, downloadName);
        setLogs(prev => [...prev, `✓ [${i + 1}/${files.length}] Đã ký & tải xuống: ${downloadName}`]);

        if (i < files.length - 1) {
          await new Promise(r => setTimeout(r, 600));
        }
      }

      let zipBlob: Blob | undefined;
      let zipUrl: string | undefined;
      if (generatedBlobs.length > 1) {
        const zip = new JSZip();
        generatedBlobs.forEach(g => zip.file(g.name, g.blob));
        zipBlob = await zip.generateAsync({ type: 'blob' });
        zipUrl = URL.createObjectURL(zipBlob);
      }

      setProcessedResults({
        files: generatedBlobs,
        zipBlob,
        zipUrl
      });

      toast.success(`Đã ký và tải xuống thành công ${files.length} file giáo án!`);
      setLogs(prev => [...prev, `✨ Hoàn tất ký ${files.length} file giáo án!`]);
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
            <CardContent className="space-y-5">
              {/* PHẦN 1: THÔNG TIN CHUNG MÔN HỌC & NGÀY SOẠN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="space-y-2">
                  <Label htmlFor="subject-select" className="text-xs font-semibold text-slate-700">Môn học</Label>
                  <select
                    id="subject-select"
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                    <Label className="text-xs font-semibold text-slate-700">Ngày soạn</Label>
                    <span className="text-[10px] text-slate-500 font-medium">(Chung cho các tuần soạn)</span>
                  </div>
                  <Popover>
                    <PopoverTrigger
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "w-full justify-start text-left font-normal bg-white h-10 text-sm",
                        !prepDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                      {prepDate ? format(prepDate, 'dd/MM/yyyy') : <span>Chọn ngày soạn</span>}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
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

                <div className="md:col-span-2 flex items-center space-x-2 py-2 px-3 bg-white rounded-lg border border-slate-200">
                  <Switch 
                    id="create-schedule-table"
                    checked={createScheduleTable}
                    onCheckedChange={setCreateScheduleTable}
                  />
                  <Label htmlFor="create-schedule-table" className="text-xs cursor-pointer">
                    <span className="font-semibold text-slate-800">Tạo bảng lịch dạy chi tiết</span>
                    <span className="text-slate-500 ml-1">(Tắt = ghi dòng đơn giản: Tiết X. Ngày dạy: ...)</span>
                  </Label>
                </div>
              </div>

              {classes.length > 0 && (
                <div className="space-y-3 p-4 border rounded-xl bg-slate-50/70">
                  <Label className="text-xs font-bold text-slate-800">Chọn lớp áp dụng giáo án này:</Label>
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
                        <Label htmlFor={`class-${className}`} className="text-xs font-medium cursor-pointer">
                          {className} <span className="text-slate-500 text-[11px] ml-0.5">
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

              {/* PHẦN 2: DANH SÁCH FILE GIÁO ÁN */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Files className="w-4 h-4 text-primary" />
                      Danh sách File giáo án cần soạn:
                    </Label>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                      {files.length} file
                    </span>
                  </div>

                  {files.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      {files.length === 2 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={swapFiles}
                          className="h-7 px-2.5 text-xs text-slate-700 bg-white border-slate-200 hover:bg-slate-50 gap-1 cursor-pointer"
                          title="Đổi thứ tự File 1 và File 2"
                        >
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                          <span>Đổi thứ tự</span>
                        </Button>
                      )}
                      <label
                        htmlFor="add-more-files-btn"
                        className="h-7 px-2.5 text-xs inline-flex items-center gap-1 text-primary bg-primary/10 hover:bg-primary/20 rounded-md font-semibold cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm file tuần sau</span>
                      </label>
                      <input
                        id="add-more-files-btn"
                        type="file"
                        className="hidden"
                        accept=".docx"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) handleFilesSelected(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  )}
                </div>

                {files.length === 0 ? (
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 border-primary/30 hover:border-primary transition-all group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                        <FileUp className="w-9 h-9 mb-2 text-primary group-hover:scale-110 transition-transform" />
                        <p className="mb-1 text-sm text-slate-700 font-semibold">
                          Nhấp hoặc kéo thả file Word (.docx) vào đây
                        </p>
                        <p className="text-xs text-slate-500 font-medium">
                          💡 Có thể chọn cùng lúc 2 file cho 2 tuần liên tiếp (hoặc tải thêm file sau)
                        </p>
                      </div>
                      <input 
                        id="file" 
                        type="file" 
                        className="hidden" 
                        accept=".docx" 
                        multiple
                        onChange={(e) => {
                          if (e.target.files) handleFilesSelected(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {files.map((f, idx) => (
                      <div
                        key={f.id}
                        className={cn(
                          "p-3.5 rounded-xl border-2 transition-all space-y-3 relative",
                          activeFileIndex === idx
                            ? "border-primary/50 bg-primary/5/30 ring-2 ring-primary/10 shadow-xs"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md font-bold text-xs shrink-0",
                              idx === 0 ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                            )}>
                              File {idx + 1}
                            </span>
                            <span className="font-bold text-xs text-slate-800 truncate" title={f.file.name}>
                              {f.file.name}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              ({Math.round(f.file.size / 1024)} KB)
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {idx > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => rechainFile(idx)}
                                className="h-6 text-[10px] px-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-semibold cursor-pointer"
                                title="Tự động tính lại tuần và tiết tiếp nối từ File trước"
                              >
                                <RefreshCw className="w-3 h-3 mr-1" /> Đồng bộ từ File {idx}
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(idx)}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                              title="Xóa file này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {idx > 0 && (
                          <div className="px-2.5 py-1 rounded-md bg-purple-50/80 border border-purple-100 flex items-center justify-between text-[11px] text-purple-900 font-medium">
                            <span className="flex items-center gap-1 font-semibold">
                              <span>✨</span> Tiếp nối tuần &amp; tiết từ File 1
                            </span>
                            <span className="text-[10px] text-purple-600">Thầy/cô có thể sửa lại các ô dưới nếu muốn</span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-700">Tuần</Label>
                            <Input
                              placeholder="VD: 25"
                              value={f.weekNumber}
                              onChange={(e) => handleFileChangeField(idx, 'weekNumber', e.target.value)}
                              className="h-8 text-xs font-semibold bg-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-700">Tiết PPCT (Bắt đầu)</Label>
                            <Input
                              placeholder="VD: 49"
                              value={f.periodNumber}
                              onChange={(e) => handleFileChangeField(idx, 'periodNumber', e.target.value)}
                              className="h-8 text-xs font-semibold bg-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-700">Số tiết dạy</Label>
                            <Input
                              type="number"
                              min="1"
                              placeholder="VD: 3"
                              value={f.lessonCount}
                              onChange={(e) => handleFileChangeField(idx, 'lessonCount', e.target.value)}
                              className="h-8 text-xs font-semibold bg-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-slate-700">Khoảng cách tuần</Label>
                            <select
                              className="flex h-8 w-full rounded-md border border-input bg-white px-2 text-xs"
                              value={f.weekOffset}
                              onChange={(e) => handleFileChangeField(idx, 'weekOffset', e.target.value)}
                            >
                              <option value="1">Tuần kế tiếp (Cách 1 tuần)</option>
                              <option value="2">Cách 2 tuần</option>
                              <option value="3">Cách 3 tuần</option>
                              <option value="4">Cách 4 tuần</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="pt-1">
                      <label 
                        htmlFor="add-extra-file"
                        className="w-full py-2.5 px-4 border-2 border-dashed border-primary/40 hover:border-primary rounded-xl text-xs font-semibold text-primary hover:bg-primary/5 cursor-pointer transition-all flex items-center justify-center gap-2 text-center"
                      >
                        <Plus className="w-4 h-4" />
                        Thêm file giáo án tuần tiếp theo (.docx)
                      </label>
                      <input
                        id="add-extra-file"
                        type="file"
                        className="hidden"
                        accept=".docx"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) handleFilesSelected(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleQuickSign}
                disabled={isProcessing || files.length === 0}
                className="w-full sm:w-1/2 h-12 text-sm sm:text-base font-bold border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/40 shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                title="Ký ngay vào đúng vị trí giáo viên mà không làm thay đổi các phần khác của giáo án"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <PenTool className="w-5 h-5 text-emerald-600" />
                )}
                <span>
                  {files.length > 1 ? `🖋️ Ký cả ${files.length} giáo án` : '🖋️ Ký giáo án (Chỉ chèn chữ ký)'}
                </span>
              </Button>

              <Button 
                type="button"
                onClick={handleProcess} 
                className="w-full sm:w-1/2 h-12 text-sm sm:text-base font-semibold shadow-sm flex items-center justify-center gap-2" 
                disabled={isProcessing || files.length === 0 || !selectedSubject || files.some(f => !f.weekNumber || !f.periodNumber)}
                title="Soạn giáo án đầy đủ: Điền tuần, tiết, ngày dạy, năng lực số và ký duyệt"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang xử lý {files.length} file...
                  </>
                ) : (
                  <>
                    <FileDown className="w-5 h-5" />
                    {files.length > 1 ? `Xử lý toàn diện (${files.length} file)` : 'Xử lý toàn diện & Tải xuống'}
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* BANNER KẾT QUẢ TẢI XUỐNG */}
          {processedResults && (
            <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎉</span>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">
                      Đã xử lý &amp; Tải xuống thành công {processedResults.files.length} file giáo án!
                    </h4>
                    <p className="text-xs text-emerald-700">
                      Nếu trình duyệt chặn tải tự động, thầy/cô có thể bấm tải trực tiếp bên dưới:
                    </p>
                  </div>
                </div>
                {processedResults.zipUrl && (
                  <a
                    href={processedResults.zipUrl}
                    download="GiaoAn_CacTuan.zip"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm shrink-0 self-start sm:self-center"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Tải file nén .ZIP
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1 border-t border-emerald-200">
                {processedResults.files.map((res, i) => (
                  <a
                    key={i}
                    href={res.url}
                    download={res.name}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="truncate max-w-[200px]">File {i + 1}: {res.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                    <CheckCircle2 className="w-4 h-4" />
                    Xem trước & Cấu hình lớp
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Điều chỉnh tiết bắt đầu cho từng lớp nếu phân phối chương trình bị lệch.
                  </CardDescription>
                </div>
                {files.length > 1 && (
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-primary/20 shadow-xs self-start">
                    {files.map((f, idx) => (
                      <button
                        key={f.id || idx}
                        type="button"
                        onClick={() => setActiveFileIndex(idx)}
                        className={cn(
                          "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
                          activeFileIndex === idx
                            ? "bg-primary text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        )}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>File {idx + 1}</span>
                        {f.weekNumber && <span className="text-[10px] opacity-80">(Tuần {f.weekNumber})</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {calculatedDates.length > 0 ? (
                <div className="rounded-lg border bg-white overflow-hidden shadow-xs">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[10px] h-8">Lớp</TableHead>
                        <TableHead className="text-[10px] h-8">Bắt đầu từ</TableHead>
                        <TableHead className="text-[10px] h-8">Lịch dạy dự kiến</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculatedDates.map((d, i) => {
                        const currentVal = (activeFile ? activeFile.classOffsets[d.className] : classOffsets[d.className]) || 1;
                        return (
                          <TableRow key={i}>
                            <TableCell className="py-2 text-[10px] font-medium">{d.className}</TableCell>
                            <TableCell className="py-2">
                              <select
                                className="h-6 w-full rounded border bg-white text-[10px] px-1 focus:ring-1 focus:ring-primary outline-none"
                                value={currentVal}
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
                        );
                      })}
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
                * "Bắt đầu từ" giúp xử lý trường hợp các lớp đang ở các tiết khác nhau trong tuần{files.length > 1 ? ` (đang cấu hình File ${activeFileIndex + 1}: ${activeFile?.weekNumber ? `Tuần ${activeFile.weekNumber}` : ''})` : ''}.
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

                {/* TÙY CHỌN VỊ TRÍ TÍCH HỢP NĂNG LỰC SỐ */}
                <div className="space-y-2 pt-2.5 border-t border-teal-200/70 mt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                      <TableProperties className="w-3.5 h-3.5 text-teal-600" />
                      Vị trí tích hợp vào Bảng hoạt động:
                    </Label>
                    <span className="text-[10px] text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full font-semibold border border-teal-200">
                      {!addNlsColumn ? 'Cột 2 (Bảng 2 cột)' : 'Cột 3 (Tạo cột mới)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Option 1: Tích hợp trực tiếp vào Cột 2 */}
                    <div
                      onClick={() => {
                        setAddNlsColumn(false);
                        localStorage.setItem('USER_ADD_NLS_COL', 'false');
                        toast.success('Đã chọn: Tích hợp trực tiếp vào Cột 2 (Bảng 2 cột)');
                      }}
                      className={cn(
                        "p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none",
                        !addNlsColumn
                          ? "border-teal-600 bg-teal-50/90 ring-2 ring-teal-500/20 shadow-xs"
                          : "border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white text-slate-600"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 rounded-lg shrink-0",
                            !addNlsColumn ? "bg-teal-600 text-white shadow-2xs" : "bg-slate-100 text-slate-500"
                          )}>
                            <Columns2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className={cn("text-xs font-bold block", !addNlsColumn ? "text-teal-950" : "text-slate-700")}>
                              Vào Cột 2 (Sẵn có)
                            </span>
                            <span className="text-[10px] text-emerald-600 font-semibold">Khuyên dùng</span>
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="nls-column-mode"
                          checked={!addNlsColumn}
                          onChange={() => {}}
                          className="w-4 h-4 text-teal-600 accent-teal-600 cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                        Chèn trực tiếp mã NLS/AI vào <strong>Cột số 2</strong> (Nội dung/Hoạt động). <strong>Giữ nguyên bảng 2 cột</strong> sẵn có của giáo án.
                      </p>
                    </div>

                    {/* Option 2: Tạo thêm Cột 3 riêng */}
                    <div
                      onClick={() => {
                        setAddNlsColumn(true);
                        localStorage.setItem('USER_ADD_NLS_COL', 'true');
                        toast.success('Đã chọn: Tạo thêm Cột 3 riêng (NLS / AI)');
                      }}
                      className={cn(
                        "p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none",
                        addNlsColumn
                          ? "border-teal-600 bg-teal-50/90 ring-2 ring-teal-500/20 shadow-xs"
                          : "border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white text-slate-600"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 rounded-lg shrink-0",
                            addNlsColumn ? "bg-teal-600 text-white shadow-2xs" : "bg-slate-100 text-slate-500"
                          )}>
                            <Columns3 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className={cn("text-xs font-bold block", addNlsColumn ? "text-teal-950" : "text-slate-700")}>
                              Tạo Cột 3 riêng
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">Thêm cột NLS</span>
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="nls-column-mode"
                          checked={addNlsColumn}
                          onChange={() => {}}
                          className="w-4 h-4 text-teal-600 accent-teal-600 cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                        Tự động tạo thêm <strong>Cột số 3 riêng</strong> bên phải bảng với tiêu đề "NLS / AI" để ghi mã năng lực số.
                      </p>
                    </div>
                  </div>
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

                {/* Cài đặt người ký theo môn học */}
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-50/90 to-purple-50/90 border border-indigo-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                      Ký duyệt theo môn học
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowApproverModal(true)}
                      className="h-6 text-[10px] px-2 text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100 font-semibold cursor-pointer"
                    >
                      ⚙️ Cài đặt theo môn
                    </Button>
                  </div>
                  {selectedSubject ? (
                    <div className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100 shadow-2xs">
                      <span className="text-slate-600 font-medium">Môn <strong>{selectedSubject}</strong>:</span>
                      <span className="font-bold text-indigo-700 flex items-center gap-1">
                        {reflectionSettings.approverTitle === 'TỔ TRƯỞNG KÝ DUYỆT' ? '👑 Tổ trưởng' : '🏅 Tổ phó'}
                        {reflectionSettings.approverName ? ` - ${reflectionSettings.approverName}` : ' (Chưa có tên)'}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic">Chọn môn học ở cột bên trái để tự động nhận Tổ trưởng/Tổ phó</p>
                  )}
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

                {/* CÀI ĐẶT THỜI GIAN KÝ DUYỆT GIÁO ÁN */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                      Thời gian ký duyệt:
                    </Label>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {activeSigningMode === 'auto' && '⚡ Tự động tính'}
                      {activeSigningMode === 'custom' && '📅 Tự chọn ngày'}
                      {activeSigningMode === 'blank' && '📝 Để trống'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 bg-slate-200/60 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        updateReflection('signingDateMode', 'auto');
                        updateReflection('autoSigningDate', true);
                      }}
                      className={cn(
                        "py-1.5 px-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1",
                        activeSigningMode === 'auto'
                          ? "bg-white text-primary shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <span>⚡</span>
                      <span>Tự động</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        updateReflection('signingDateMode', 'custom');
                        updateReflection('autoSigningDate', false);
                        if (!reflectionSettings.customSigningDate) {
                          updateReflection('customSigningDate', format(new Date(), 'yyyy-MM-dd'));
                        }
                      }}
                      className={cn(
                        "py-1.5 px-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1",
                        activeSigningMode === 'custom'
                          ? "bg-white text-primary shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <span>📅</span>
                      <span>Tự chọn</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        updateReflection('signingDateMode', 'blank');
                        updateReflection('autoSigningDate', false);
                      }}
                      className={cn(
                        "py-1.5 px-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1",
                        activeSigningMode === 'blank'
                          ? "bg-white text-primary shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <span>📝</span>
                      <span>Để trống</span>
                    </button>
                  </div>

                  {/* Detail for Custom Date Picker */}
                  {activeSigningMode === 'custom' && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                      <Label className="text-[11px] text-slate-600 font-medium">Chọn ngày ký duyệt theo ý bạn:</Label>
                      <Popover>
                        <PopoverTrigger
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "w-full justify-start text-left font-normal text-xs h-8 bg-white border-primary/40 text-slate-800 hover:border-primary"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />
                          {customSigningDateObj ? (
                            <span className="font-semibold text-primary">{format(customSigningDateObj, 'dd/MM/yyyy')}</span>
                          ) : (
                            <span className="text-muted-foreground">Chọn ngày ký duyệt...</span>
                          )}
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customSigningDateObj}
                            onSelect={(date) => {
                              if (date) {
                                updateReflection('customSigningDate', format(date, 'yyyy-MM-dd'));
                              }
                            }}
                            initialFocus
                            locale={vi}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {activeSigningMode === 'auto' && (
                    <p className="text-[10px] text-slate-500 italic leading-tight">
                      * Tự động tính Thứ 7 trước tuần dạy (chuẩn CV 5512 Bộ GD&amp;ĐT).
                    </p>
                  )}

                  {/* Live preview banner */}
                  {files.length <= 1 ? (
                    <div className="flex items-center gap-1.5 text-[11px] bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200/70 text-amber-900">
                      <span className="font-semibold shrink-0">✍️ Sẽ ghi:</span>
                      <span className="font-bold text-amber-800">
                        {reflectionSettings.location || 'Đường Hào'}, {previewSigningDate}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-[11px] bg-amber-50/90 p-2.5 rounded-lg border border-amber-200/70 text-amber-900">
                      <div className="font-semibold text-amber-950 flex items-center gap-1.5">
                        <span>✍️ Ngày ký duyệt dự kiến cho {files.length} file:</span>
                      </div>
                      <div className="space-y-1 pl-1">
                        {files.map((f, idx) => (
                          <div key={f.id || idx} className="flex items-baseline gap-2">
                            <span className="font-semibold text-amber-900 shrink-0">File {idx + 1} {f.weekNumber ? `(Tuần ${f.weekNumber})` : ''}:</span>
                            <span className="font-bold text-amber-800">
                              {reflectionSettings.location || 'Đường Hào'}, {getFileSigningDate(f)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
      <SubjectApproversModal 
        open={showApproverModal}
        onOpenChange={setShowApproverModal}
        subjects={subjects}
        currentSubject={selectedSubject}
        onSave={(map) => {
          setSubjectApprovers(map);
          if (selectedSubject) {
            const normSub = selectedSubject.trim().toLowerCase();
            const matchedKey = Object.keys(map).find(k => {
              const normK = k.trim().toLowerCase();
              return normK === normSub || normSub.startsWith(normK) || normK.startsWith(normSub);
            });
            if (matchedKey && map[matchedKey]) {
              const conf = map[matchedKey];
              updateReflection('approverTitle', conf.approverTitle);
              updateReflection('approverName', conf.approverName);
            }
          }
        }}
      />
      <CoffeeModal 
        open={showCoffeeModal} 
        onOpenChange={setShowCoffeeModal} 
      />
    </div>
  );
}
