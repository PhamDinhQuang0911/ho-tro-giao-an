import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubjectApproversMap, SubjectApproverConfig } from '@/types';
import { toast } from 'sonner';
import { UserCheck, Crown, Medal, Search, Plus, Sparkles, Check, BookOpen } from 'lucide-react';
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

  // Quick action: update approver type for a subject
  const setSubjectApproverType = (subject: string, title: 'TỔ TRƯỞNG KÝ DUYỆT' | 'TỔ PHÓ KÝ DUYỆT') => {
    setApproversMap(prev => {
      const current = prev[subject] || { approverTitle: 'TỔ TRƯỞNG KÝ DUYỆT', approverName: '' };
      let newName = current.approverName;
      // Auto fill name if current is empty or matches the other title's default
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
      toast.error('Vui lòng nhập tên Tổ trưởng trước');
      return;
    }
    setApproversMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(sub => {
        if (next[sub]?.approverTitle === 'TỔ TRƯỞNG KÝ DUYỆT') {
          next[sub] = { ...next[sub], approverName: headName };
        }
      });
      return next;
    });
    toast.success('Đã áp dụng tên Tổ trưởng cho các môn do Tổ trưởng ký duyệt');
  };

  // Bulk actions: apply deputyName to all Deputy subjects
  const applyDeputyNameToAll = () => {
    if (!deputyName.trim()) {
      toast.error('Vui lòng nhập tên Tổ phó trước');
      return;
    }
    setApproversMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(sub => {
        if (next[sub]?.approverTitle !== 'TỔ TRƯỞNG KÝ DUYỆT') {
          next[sub] = { ...next[sub], approverName: deputyName };
        }
      });
      return next;
    });
    toast.success('Đã áp dụng tên Tổ phó cho các môn do Tổ phó ký duyệt');
  };

  const handleAddCustomSubject = () => {
    const trimmed = customSubject.trim();
    if (!trimmed) return;
    if (approversMap[trimmed]) {
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

  const handleSave = () => {
    localStorage.setItem('lesson-plan-subject-approvers', JSON.stringify(approversMap));
    localStorage.setItem('lesson-plan-default-head-name', headName);
    localStorage.setItem('lesson-plan-default-deputy-name', deputyName);

    onSave?.(approversMap);
    toast.success('Đã lưu cấu hình người ký duyệt theo môn học!');
    onOpenChange(false);
  };

  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return allSubjectNames;
    const q = searchQuery.toLowerCase();
    return allSubjectNames.filter(s => s.toLowerCase().includes(q));
  }, [allSubjectNames, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] font-sans max-h-[92vh] overflow-y-auto p-5 sm:p-7 rounded-2xl shadow-2xl">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-slate-800">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span>Cài đặt Người ký duyệt theo Môn học</span>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Chỉ định môn nào do Tổ trưởng duyệt, môn nào do Tổ phó duyệt kèm họ tên tương ứng
              </DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* DEFAULT NAMES SETUP */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3 mt-1">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Thông tin Tổ trưởng & Tổ phó của Tổ chuyên môn:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-500" /> Họ tên Tổ trưởng:
              </Label>
              <div className="flex gap-2">
                <Input
                  value={headName}
                  onChange={e => setHeadName(e.target.value)}
                  placeholder="VD: Đỗ Ngọc Phượng"
                  className="h-9 text-xs bg-white font-medium"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyHeadNameToAll}
                  className="h-9 text-[11px] whitespace-nowrap bg-white hover:bg-slate-50 text-slate-700 shrink-0"
                  title="Cập nhật tên này cho tất cả môn do Tổ trưởng duyệt"
                >
                  Áp dụng
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Medal className="w-4 h-4 text-blue-500" /> Họ tên Tổ phó:
              </Label>
              <div className="flex gap-2">
                <Input
                  value={deputyName}
                  onChange={e => setDeputyName(e.target.value)}
                  placeholder="VD: Nguyễn Văn Hùng"
                  className="h-9 text-xs bg-white font-medium"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyDeputyNameToAll}
                  className="h-9 text-[11px] whitespace-nowrap bg-white hover:bg-slate-50 text-slate-700 shrink-0"
                  title="Cập nhật tên này cho tất cả môn do Tổ phó duyệt"
                >
                  Áp dụng
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH & ADD CUSTOM SUBJECT */}
        <div className="flex items-center justify-between gap-3 pt-2">
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
            className="h-9 text-xs gap-1.5 bg-white text-slate-700"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm môn khác
          </Button>
        </div>

        {showAddSubject && (
          <div className="flex items-center gap-2 p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-200 animate-in fade-in">
            <Input
              value={customSubject}
              onChange={e => setCustomSubject(e.target.value)}
              placeholder="Nhập tên môn học mới..."
              className="h-8 text-xs bg-white flex-1"
              onKeyDown={e => e.key === 'Enter' && handleAddCustomSubject()}
            />
            <Button
              type="button"
              size="sm"
              onClick={handleAddCustomSubject}
              className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Thêm
            </Button>
          </div>
        )}

        {/* SUBJECTS LIST TABLE */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white max-h-[380px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 sticky top-0 z-10 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3.5 text-left w-36 sm:w-44">Môn học</th>
                <th className="py-2.5 px-3.5 text-left w-48 sm:w-56">Người ký duyệt</th>
                <th className="py-2.5 px-3.5 text-left">Họ tên người duyệt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubjects.map(sub => {
                const config: SubjectApproverConfig = approversMap[sub] || {
                  approverTitle: 'TỔ TRƯỞNG KÝ DUYỆT',
                  approverName: headName || ''
                };
                const isHead = config.approverTitle === 'TỔ TRƯỞNG KÝ DUYỆT';
                const isSelectedCurrent = currentSubject && sub.toLowerCase() === currentSubject.toLowerCase();

                return (
                  <tr
                    key={sub}
                    className={cn(
                      "hover:bg-slate-50/70 transition-colors",
                      isSelectedCurrent && "bg-indigo-50/30"
                    )}
                  >
                    <td className="py-2.5 px-3.5 font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>{sub}</span>
                        {isSelectedCurrent && (
                          <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">
                            Đang soạn
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-3.5">
                      <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
                        <button
                          type="button"
                          onClick={() => setSubjectApproverType(sub, 'TỔ TRƯỞNG KÝ DUYỆT')}
                          className={cn(
                            "px-2.5 py-1 text-[11px] rounded-md font-semibold flex items-center gap-1 transition-all",
                            isHead
                              ? "bg-amber-500 text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <Crown className="w-3 h-3" />
                          <span>Tổ trưởng</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubjectApproverType(sub, 'TỔ PHÓ KÝ DUYỆT')}
                          className={cn(
                            "px-2.5 py-1 text-[11px] rounded-md font-semibold flex items-center gap-1 transition-all",
                            !isHead
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <Medal className="w-3 h-3" />
                          <span>Tổ phó</span>
                        </button>
                      </div>
                    </td>

                    <td className="py-2.5 px-3.5">
                      <Input
                        value={config.approverName || ''}
                        onChange={e => setSubjectApproverName(sub, e.target.value)}
                        placeholder={isHead ? headName || 'Tên Tổ trưởng...' : deputyName || 'Tên Tổ phó...'}
                        className="h-8 text-xs bg-white max-w-xs"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-between sm:justify-between w-full">
          <p className="text-xs text-slate-400">
            * Khi chọn môn ở trang Soạn giáo án, hệ thống sẽ tự động điền đúng người duyệt.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Đóng
            </Button>
            <Button
              onClick={handleSave}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-white font-bold gap-1.5 text-xs shadow-md"
            >
              <Check className="w-4 h-4" /> Lưu cấu hình
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
