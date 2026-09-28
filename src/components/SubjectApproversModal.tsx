import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubjectApproversMap, SubjectApproverConfig } from '@/types';
import { toast } from 'sonner';
import { UserCheck, Crown, Medal, Search, Plus, Sparkles, Check, BookOpen, Trash2, CheckCircle2, Users, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_SUBJECTS = [
  'Toán', 'Tin học', 'Khoa học tự nhiên', 'Vật lý', 'Hóa học', 'Sinh học',
  'Công nghệ', 'Ngữ văn', 'Tiếng Anh', 'Lịch sử', 'Địa lý', 'GDCD',
  'Âm nhạc', 'Mỹ thuật', 'Thể dục', 'Hoạt động trải nghiệm'
];

interface SubjectApproversModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects?: string[];
  currentSubject?: string;
  onSave?: (map: SubjectApproversMap) => void;
}

export function SubjectApproversModal({
  open,
  onOpenChange,
  subjects = [],
  currentSubject,
  onSave
}: SubjectApproversModalProps) {
  const [headName, setHeadName] = useState('');
  const [deputyName, setDeputyName] = useState('');
  const [approversMap, setApproversMap] = useState<SubjectApproversMap>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'head' | 'deputy'>('all');

  // Combine default subjects with schedule subjects and custom configured subjects
  const allSubjectNames = useMemo(() => {
    const fromMap = Object.keys(approversMap);
    const set = new Set([...subjects, ...fromMap, ...DEFAULT_SUBJECTS]);
    return Array.from(set).filter(Boolean);
  }, [subjects, approversMap]);

  // Load from localStorage on open
  useEffect(() => {
    if (open) {
      const savedHead = localStorage.getItem('lesson-plan-default-head-name') || '';
      const savedDeputy = localStorage.getItem('lesson-plan-default-deputy-name') || '';
      setHeadName(savedHead);
      setDeputyName(savedDeputy);

      const savedMapStr = localStorage.getItem('lesson-plan-subject-approvers');
      if (savedMapStr) {
        try {
          const parsed = JSON.parse(savedMapStr);
          setApproversMap(parsed);
        } catch (e) {
          console.error('Failed to parse subject approvers', e);
        }
      } else {
        // Initialize with default
        const init: SubjectApproversMap = {};
        allSubjectNames.forEach(sub => {
          init[sub] = {
            approverTitle: 'TỔ TRƯỞNG KÝ DUYỆT',
            approverName: savedHead
          };
        });
        setApproversMap(init);
      }
    }
  }, [open]);

  // Statistics
  const stats = useMemo(() => {
    let headCount = 0;
    let deputyCount = 0;
    allSubjectNames.forEach(sub => {
      const config = approversMap[sub];
      if (config?.approverTitle === 'TỔ PHÓ KÝ DUYỆT') {
        deputyCount++;
      } else {
        headCount++;
      }
    });
    return { headCount, deputyCount, total: allSubjectNames.length };
  }, [allSubjectNames, approversMap]);

  // Quick action: update approver type for a subject
  const setSubjectApproverType = (subject: string, title: 'TỔ TRƯỞNG KÝ DUYỆT' | 'TỔ PHÓ KÝ DUYỆT') => {
    setApproversMap(prev => {
      const current = prev[subject] || { approverTitle: 'TỔ TRƯỞNG KÝ DUYỆT', approverName: '' };
      let newName = current.approverName;
      if (title === 'TỔ TRƯỞNG KÝ DUYỆT') {
        if (!newName || newName === deputyName) newName = headName;
      } else {
        if (!newName || newName === headName) newName = deputyName;
      }
      return {
        ...prev,
        [subject]: {
          approverTitle: title,
          approverName: newName
        }
      };
    });
  };

  const setSubjectApproverName = (subject: string, name: string) => {
    setApproversMap(prev => {
      const current = prev[subject] || { approverTitle: 'TỔ TRƯỞNG KÝ DUYỆT', approverName: '' };
      return {
        ...prev,
        [subject]: {
          ...current,
          approverName: name
        }
      };
    });
  };

  // Bulk actions: apply headName to all Head subjects
  const applyHeadNameToAll = () => {
    if (!headName.trim()) {
      toast.error('Vui lòng nhập họ tên Tổ trưởng trước');
      return;
    }
    setApproversMap(prev => {
      const next = { ...prev };
      allSubjectNames.forEach(sub => {
        const cur = next[sub] || { approverTitle: 'TỔ TRƯỞNG KÝ DUYỆT', approverName: '' };
        if (cur.approverTitle === 'TỔ TRƯỞNG KÝ DUYỆT') {
          next[sub] = { ...cur, approverName: headName };
        }
      });
      return next;
    });
    toast.success('Đã áp dụng tên Tổ trưởng cho các môn do Tổ trưởng ký duyệt');
  };

  // Bulk actions: apply deputyName to all Deputy subjects
  const applyDeputyNameToAll = () => {
    if (!deputyName.trim()) {
      toast.error('Vui lòng nhập họ tên Tổ phó trước');
      return;
    }
    setApproversMap(prev => {
      const next = { ...prev };
      allSubjectNames.forEach(sub => {
        const cur = next[sub] || { approverTitle: 'TỔ TRƯỞNG KÝ DUYỆT', approverName: '' };
        if (cur.approverTitle !== 'TỔ TRƯỞNG KÝ DUYỆT') {
          next[sub] = { ...cur, approverName: deputyName };
        }
      });
      return next;
    });
    toast.success('Đã áp dụng tên Tổ phó cho các môn do Tổ phó ký duyệt');
  };

  // Bulk: assign ALL to Head
  const assignAllToHead = () => {
    setApproversMap(prev => {
      const next: SubjectApproversMap = {};
      allSubjectNames.forEach(sub => {
        next[sub] = {
          approverTitle: 'TỔ TRƯỞNG KÝ DUYỆT',
          approverName: headName || prev[sub]?.approverName || ''
        };
      });
      return next;
    });
    toast.success('Đã chuyển tất cả môn cho Tổ trưởng ký duyệt');
  };

  // Bulk: assign ALL to Deputy
  const assignAllToDeputy = () => {
    setApproversMap(prev => {
      const next: SubjectApproversMap = {};
      allSubjectNames.forEach(sub => {
        next[sub] = {
          approverTitle: 'TỔ PHÓ KÝ DUYỆT',
          approverName: deputyName || prev[sub]?.approverName || ''
        };
      });
      return next;
    });
    toast.success('Đã chuyển tất cả môn cho Tổ phó ký duyệt');
  };

  const handleAddCustomSubject = () => {
    const trimmed = customSubject.trim();
    if (!trimmed) return;
    if (allSubjectNames.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.info('Môn học này đã có trong danh sách');
      return;
    }
    setApproversMap(prev => ({
      ...prev,
      [trimmed]: {
        approverTitle: 'TỔ TRƯỞNG KÝ DUYỆT',
        approverName: headName
      }
    }));
    setCustomSubject('');
    setShowAddSubject(false);
    toast.success(`Đã thêm môn "${trimmed}" vào cấu hình`);
  };

  const handleRemoveCustomSubject = (sub: string) => {
    setApproversMap(prev => {
      const next = { ...prev };
      delete next[sub];
      return next;
    });
    toast.info(`Đã xóa môn "${sub}"`);
  };

  const handleSave = () => {
    localStorage.setItem('lesson-plan-subject-approvers', JSON.stringify(approversMap));
    localStorage.setItem('lesson-plan-default-head-name', headName);
    localStorage.setItem('lesson-plan-default-deputy-name', deputyName);

    onSave?.(approversMap);
    toast.success('Đã lưu cấu hình người ký duyệt theo môn học!');
    onOpenChange(false);
  };

  const filteredSubjects = useMemo(() => {
    let list = allSubjectNames;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.toLowerCase().includes(q));
    }
    if (activeFilter === 'head') {
      list = list.filter(s => (approversMap[s]?.approverTitle ?? 'TỔ TRƯỞNG KÝ DUYỆT') === 'TỔ TRƯỞNG KÝ DUYỆT');
    } else if (activeFilter === 'deputy') {
      list = list.filter(s => approversMap[s]?.approverTitle === 'TỔ PHÓ KÝ DUYỆT');
    }
    return list;
  }, [allSubjectNames, searchQuery, activeFilter, approversMap]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-6xl xl:max-w-7xl font-sans max-h-[92vh] flex flex-col p-5 sm:p-7 rounded-3xl shadow-2xl bg-white border border-slate-200 overflow-hidden">
        {/* HEADER */}
        <DialogHeader className="pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl shadow-md">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2.5">
                  <span>Cài đặt Người ký duyệt theo Môn học</span>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-semibold border border-indigo-200/60 hidden sm:inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {stats.total} môn học
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-slate-500 mt-1">
                  Chỉ định rõ môn nào do <strong>Tổ trưởng</strong> ký duyệt, môn nào do <strong>Tổ phó</strong> ký duyệt kèm họ tên tương ứng.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* SCROLLABLE BODY */}
        <div className="overflow-y-auto pr-1 space-y-5 flex-1 py-2">
          {/* TWO BIG CARDS FOR HEAD & DEPUTY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Tổ trưởng */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50/80 via-amber-50/40 to-white border-2 border-amber-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
                      Tổ Trưởng chuyên môn
                    </h4>
                    <p className="text-[11px] text-amber-800">Ký duyệt các môn chính / môn được phân công</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full font-bold text-xs border border-amber-300/80">
                  {stats.headCount} môn phụ trách
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Họ tên Tổ trưởng:
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={headName}
                    onChange={e => setHeadName(e.target.value)}
                    placeholder="VD: Đỗ Ngọc Phượng"
                    className="h-10 text-xs sm:text-sm bg-white font-medium border-amber-200 focus:border-amber-400"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyHeadNameToAll}
                    className="h-10 px-3.5 text-xs whitespace-nowrap bg-white hover:bg-amber-100/60 text-amber-900 border-amber-300 font-semibold shrink-0 cursor-pointer"
                    title="Cập nhật tên này cho tất cả môn do Tổ trưởng duyệt"
                  >
                    ⚡ Áp dụng tên
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] border-t border-amber-100">
                <span className="text-amber-800/80 italic">Chức danh trên giáo án: <strong>TỔ TRƯỞNG</strong></span>
                <button
                  type="button"
                  onClick={assignAllToHead}
                  className="text-amber-800 hover:text-amber-950 font-semibold underline cursor-pointer"
                >
                  Gán tất cả môn cho Tổ trưởng
                </button>
              </div>
            </div>

            {/* Card 2: Tổ phó */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-50/80 via-blue-50/40 to-white border-2 border-blue-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                    <Medal className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-950 uppercase tracking-wide">
                      Tổ Phó chuyên môn
                    </h4>
                    <p className="text-[11px] text-blue-800">Ký duyệt các môn được giao phụ trách</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-blue-100 text-blue-900 rounded-full font-bold text-xs border border-blue-300/80">
                  {stats.deputyCount} môn phụ trách
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Họ tên Tổ phó:
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={deputyName}
                    onChange={e => setDeputyName(e.target.value)}
                    placeholder="VD: Nguyễn Văn Hùng"
                    className="h-10 text-xs sm:text-sm bg-white font-medium border-blue-200 focus:border-blue-400"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyDeputyNameToAll}
                    className="h-10 px-3.5 text-xs whitespace-nowrap bg-white hover:bg-blue-100/60 text-blue-900 border-blue-300 font-semibold shrink-0 cursor-pointer"
                    title="Cập nhật tên này cho tất cả môn do Tổ phó duyệt"
                  >
                    ⚡ Áp dụng tên
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] border-t border-blue-100">
                <span className="text-blue-800/80 italic">Chức danh trên giáo án: <strong>TỔ PHÓ</strong></span>
                <button
                  type="button"
                  onClick={assignAllToDeputy}
                  className="text-blue-800 hover:text-blue-950 font-semibold underline cursor-pointer"
                >
                  Gán tất cả môn cho Tổ phó
                </button>
              </div>
            </div>
          </div>

          {/* FILTER & TOOLBAR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            {/* Filter segmented buttons */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                  activeFilter === 'all'
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Tất cả môn ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('head')}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all",
                  activeFilter === 'head'
                    ? "bg-amber-500 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Tổ trưởng duyệt ({stats.headCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('deputy')}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all",
                  activeFilter === 'deputy'
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Medal className="w-3.5 h-3.5" />
                <span>Tổ phó duyệt ({stats.deputyCount})</span>
              </button>
            </div>

            {/* Search & Custom Subject */}
            <div className="flex items-center gap-2 flex-1 sm:max-w-md justify-end">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm môn học..."
                  className="pl-9 h-9 text-xs bg-white"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddSubject(!showAddSubject)}
                className="h-9 text-xs gap-1.5 bg-white text-slate-700 whitespace-nowrap cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm môn khác
              </Button>
            </div>
          </div>

          {/* Add custom subject input inline */}
          {showAddSubject && (
            <div className="flex items-center gap-2 p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 animate-in fade-in">
              <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
              <Input
                value={customSubject}
                onChange={e => setCustomSubject(e.target.value)}
                placeholder="Nhập tên môn học mới (VD: Khoa học máy tính, Hoạt động GD...)"
                className="h-9 text-xs sm:text-sm bg-white flex-1"
                onKeyDown={e => e.key === 'Enter' && handleAddCustomSubject()}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddCustomSubject}
                className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 font-semibold cursor-pointer"
              >
                Thêm môn
              </Button>
            </div>
          )}

          {/* MAIN SUBJECTS TABLE */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
            <div className="max-h-[460px] overflow-y-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-100/90 border-b border-slate-200 sticky top-0 z-10 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 text-center w-14">STT</th>
                    <th className="py-3 px-4 text-left w-52 sm:w-64">Môn học</th>
                    <th className="py-3 px-4 text-center w-64 sm:w-72">Người ký duyệt</th>
                    <th className="py-3 px-4 text-left">Họ tên người ký duyệt</th>
                    <th className="py-3 px-4 text-center w-36">Chức danh ký</th>
                    <th className="py-3 px-3 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                        Không tìm thấy môn học nào khớp với tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    filteredSubjects.map((sub, idx) => {
                      const config: SubjectApproverConfig = approversMap[sub] || {
                        approverTitle: 'TỔ TRƯỞNG KÝ DUYỆT',
                        approverName: headName || ''
                      };
                      const isHead = config.approverTitle === 'TỔ TRƯỞNG KÝ DUYỆT';
                      const isSelectedCurrent = currentSubject && sub.toLowerCase() === currentSubject.toLowerCase();
                      const isCustom = !DEFAULT_SUBJECTS.includes(sub);

                      return (
                        <tr
                          key={sub}
                          className={cn(
                            "hover:bg-slate-50/80 transition-colors",
                            isSelectedCurrent && "bg-indigo-50/40"
                          )}
                        >
                          {/* STT */}
                          <td className="py-3 px-4 text-center text-slate-400 text-xs font-mono">
                            {idx + 1}
                          </td>

                          {/* MÔN HỌC */}
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                                isHead ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                              )}>
                                {sub.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs sm:text-sm">{sub}</span>
                              {isSelectedCurrent && (
                                <span className="text-[10px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full font-bold border border-indigo-200 shrink-0">
                                  Đang soạn
                                </span>
                              )}
                            </div>
                          </td>

                          {/* BỘ CHUYỂN TỔ TRƯỞNG / TỔ PHÓ */}
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/90 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => setSubjectApproverType(sub, 'TỔ TRƯỞNG KÝ DUYỆT')}
                                className={cn(
                                  "px-3.5 py-1.5 text-xs rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                                  isHead
                                    ? "bg-amber-500 text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                                )}
                              >
                                <Crown className="w-3.5 h-3.5" />
                                <span>Tổ trưởng</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSubjectApproverType(sub, 'TỔ PHÓ KÝ DUYỆT')}
                                className={cn(
                                  "px-3.5 py-1.5 text-xs rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                                  !isHead
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                                )}
                              >
                                <Medal className="w-3.5 h-3.5" />
                                <span>Tổ phó</span>
                              </button>
                            </div>
                          </td>

                          {/* HỌ TÊN NGƯỜI DUYỆT */}
                          <td className="py-3 px-4">
                            <Input
                              value={config.approverName || ''}
                              onChange={e => setSubjectApproverName(sub, e.target.value)}
                              placeholder={isHead ? (headName || 'Nhập tên Tổ trưởng...') : (deputyName || 'Nhập tên Tổ phó...')}
                              className="h-9 text-xs sm:text-sm bg-white font-medium border-slate-200 focus:border-indigo-400 w-full"
                            />
                          </td>

                          {/* CHỨC DANH KÝ HIỂN THỊ */}
                          <td className="py-3 px-4 text-center">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border",
                              isHead
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-blue-50 text-blue-800 border-blue-200"
                            )}>
                              {isHead ? <Crown className="w-3 h-3 text-amber-500" /> : <Medal className="w-3 h-3 text-blue-500" />}
                              {isHead ? 'Tổ trưởng' : 'Tổ phó'}
                            </span>
                          </td>

                          {/* XÓA MÔN TÙY CHỌN */}
                          <td className="py-3 px-3 text-center">
                            {isCustom && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomSubject(sub)}
                                className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-colors"
                                title="Xóa môn tùy chọn này"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <DialogFooter className="pt-4 border-t border-slate-100 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          <p className="text-xs text-slate-500 italic">
            * Khi chọn môn học ở trang Soạn giáo án, hệ thống sẽ tự động gán đúng chức vụ và tên người ký duyệt đã cấu hình.
          </p>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs h-10 px-4 cursor-pointer"
            >
              Hủy bỏ
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 text-xs sm:text-sm h-10 px-6 shadow-md cursor-pointer"
            >
              <Check className="w-4 h-4" /> Lưu cấu hình phân công
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
