import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Calendar as CalendarIcon, Settings2, Layout, Pencil, Check, X } from 'lucide-react';
import { ScheduleItem, HeaderFooterSettings } from '@/lib/word-utils';
import { ReflectionSettings } from '@/types';
import { toast } from 'sonner';
import { AiScheduleModal } from './AiScheduleModal';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 0, label: 'Chủ Nhật' },
];

const DEFAULT_HF: HeaderFooterSettings = {
  topLeft: 'Trường THCS Đường Hào',
  topRight: 'Năm học 2026-2027',
  bottomLeft: 'Giáo viên Phạm Đình Quang',
  bottomRight: 'Tổ Toán Tin Phân hiệu 4',
};

const DEFAULT_REFLECTION: ReflectionSettings = {
  enabled: true,
  title: 'Rút kinh nghiệm',
  contentLines: 3,
  approverTitle: 'TỔ TRƯỞNG KÝ DUYỆT',
  approverName: '',
  year: '2025',
  autoSigningDate: true,
  showReflection: true,
  showSigningDate: true,
  location: 'Đường Hào',
  teacherName: 'Phạm Đình Quang',
};

const SUBJECTS: string[] = [
  'Toán', 'Vật lý', 'Hóa học', 'Sinh học', 'Khoa học tự nhiên',
  'Ngữ văn', 'Tiếng Anh', 'Tin học', 'Lịch sử', 'Địa lý', 'GDCD',
  'Công nghệ', 'Âm nhạc', 'Mỹ thuật', 'Thể dục', 'Hoạt động trải nghiệm'
];

const PERIODS: string[] = [
  'Tiết 1', 'Tiết 2', 'Tiết 3', 'Tiết 4', 'Tiết 5',
  'Tiết 6', 'Tiết 7', 'Tiết 8', 'Tiết 9', 'Tiết 10'
];

export function ScheduleSettings() {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [newDay, setNewDay] = useState<number>(1);
  const [newClass, setNewClass] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newPeriod, setNewPeriod] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDay, setEditDay] = useState<number>(1);
  const [editClass, setEditClass] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editPeriod, setEditPeriod] = useState('');

  const [hfSettings, setHfSettings] = useState<HeaderFooterSettings>(DEFAULT_HF);
  const [reflectionSettings, setReflectionSettings] = useState<ReflectionSettings>(DEFAULT_REFLECTION);

  useEffect(() => {
    const savedSchedule = localStorage.getItem('lesson-plan-schedule');
    if (savedSchedule) {
      try {
        setSchedule(JSON.parse(savedSchedule));
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
        setReflectionSettings(JSON.parse(savedReflection));
      } catch (e) {
        console.error('Failed to parse reflection settings', e);
      }
    }
  }, []);

  const saveSchedule = (newSchedule: ScheduleItem[]) => {
    setSchedule(newSchedule);
    localStorage.setItem('lesson-plan-schedule', JSON.stringify(newSchedule));
  };

  const saveHF = (newHF: HeaderFooterSettings) => {
    setHfSettings(newHF);
    localStorage.setItem('lesson-plan-hf-settings', JSON.stringify(newHF));
    toast.success('Đã lưu cài đặt Header/Footer');
  };

  const saveReflection = (newReflection: ReflectionSettings) => {
    setReflectionSettings(newReflection);
    localStorage.setItem('lesson-plan-reflection-settings', JSON.stringify(newReflection));
    toast.success('Đã lưu cài đặt Rút kinh nghiệm');
  };

  const addItem = () => {
    if (!newClass || !newSubject) {
      toast.error('Vui lòng nhập đầy đủ thông tin lớp và môn học');
      return;
    }

    const newItem: ScheduleItem = {
      id: crypto.randomUUID(),
      dayOfWeek: newDay,
      className: newClass,
      subject: newSubject,
      period: newPeriod || undefined,
    };

    const updated = [...schedule, newItem].sort((a, b) => {
      const dayA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
      const dayB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
      if (dayA !== dayB) return dayA - dayB;
      // If same day, sort by period if available
      return (a.period || '').localeCompare(b.period || '');
    });

    saveSchedule(updated);
    setNewClass('');
    setNewSubject('');
    setNewPeriod('');
    toast.success('Đã thêm lịch dạy');
  };

  const removeItem = (id: string) => {
    const updated = schedule.filter(item => item.id !== id);
    saveSchedule(updated);
    toast.success('Đã xóa lịch dạy');
  };

  const startEdit = (item: ScheduleItem) => {
    setEditingId(item.id);
    setEditDay(item.dayOfWeek);
    setEditClass(item.className);
    setEditSubject(item.subject);
    setEditPeriod(item.period || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    if (!editClass || !editSubject) {
      toast.error('Vui lòng nhập đầy đủ thông tin lớp và môn học');
      return;
    }

    const updated = schedule.map(item => {
      if (item.id === id) {
        return {
          ...item,
          dayOfWeek: editDay,
          className: editClass,
          subject: editSubject,
          period: editPeriod || undefined,
        };
      }
      return item;
    }).sort((a, b) => {
      const dayA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
      const dayB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
      if (dayA !== dayB) return dayA - dayB;
      return (a.period || '').localeCompare(b.period || '');
    });

    saveSchedule(updated);
    setEditingId(null);
    toast.success('Đã cập nhật lịch dạy');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Lịch báo giảng (Thời khóa biểu)
            </CardTitle>
            <CardDescription>
              Thiết lập các lớp bạn dạy trong tuần để phần mềm tự động tính toán ngày dạy.
            </CardDescription>
          </div>
          <AiScheduleModal onScheduleGenerated={saveSchedule} />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 items-end">
            <div className="space-y-2">
              <Label>Thứ</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={newDay}
                onChange={(e) => setNewDay(Number(e.target.value))}
              >
                {DAYS_OF_WEEK.map(day => (
                  <option key={day.value} value={day.value}>{day.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Lớp</Label>
              <Input 
                placeholder="VD: 9A1" 
                value={newClass} 
                onChange={(e) => setNewClass(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Môn học</Label>
              <div className="relative">
                <Input 
                  placeholder="VD: Toán" 
                  value={newSubject} 
                  onChange={(e) => setNewSubject(e.target.value)}
                  list="subject-list"
                />
                <datalist id="subject-list">
                  {SUBJECTS.map(s => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tiết (Tùy chọn)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value)}
              >
                <option value="">Chọn tiết</option>
                {PERIODS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <Button onClick={addItem} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Thêm
            </Button>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Thứ</TableHead>
                  <TableHead>Lớp</TableHead>
                  <TableHead>Môn học</TableHead>
                  <TableHead>Tiết</TableHead>
                  <TableHead className="w-[100px]">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                      Chưa có lịch dạy nào được thiết lập.
                    </TableCell>
                  </TableRow>
                ) : (
                  schedule.map((item) => (
                    <TableRow key={item.id}>
                      {editingId === item.id ? (
                        <>
                          <TableCell>
                            <select
                              className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                              value={editDay}
                              onChange={(e) => setEditDay(Number(e.target.value))}
                            >
                              {DAYS_OF_WEEK.map(day => (
                                <option key={day.value} value={day.value}>{day.label}</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input 
                              className="h-8 text-xs"
                              value={editClass} 
                              onChange={(e) => setEditClass(e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                              className="h-8 text-xs"
                              value={editSubject} 
                              onChange={(e) => setEditSubject(e.target.value)}
                              list="subject-list"
                            />
                          </TableCell>
                          <TableCell>
                            <select
                              className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                              value={editPeriod}
                              onChange={(e) => setEditPeriod(e.target.value)}
                            >
                              <option value="">Chọn tiết</option>
                              {PERIODS.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => saveEdit(item.id)}
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={cancelEdit}
                                className="h-8 w-8 text-slate-400 hover:text-slate-500 hover:bg-slate-50"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>{DAYS_OF_WEEK.find(d => d.value === item.dayOfWeek)?.label}</TableCell>
                          <TableCell className="font-medium">{item.className}</TableCell>
                          <TableCell>{item.subject}</TableCell>
                          <TableCell>{item.period || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => startEdit(item)}
                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => removeItem(item.id)}
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="w-5 h-5 text-primary" />
            Cài đặt Header & Footer
          </CardTitle>
          <CardDescription>
            Tùy chỉnh nội dung hiển thị ở đầu trang và chân trang của giáo án.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 p-4 border rounded-lg bg-slate-50/50">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> Đầu trang (Header)
              </h3>
              <div className="space-y-2">
                <Label>Bên trái</Label>
                <Input 
                  placeholder="VD: Trường THCS..." 
                  value={hfSettings.topLeft || ''}
                  onChange={(e) => setHfSettings({...hfSettings, topLeft: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Bên phải</Label>
                <Input 
                  placeholder="VD: Năm học 2023-2024" 
                  value={hfSettings.topRight || ''}
                  onChange={(e) => setHfSettings({...hfSettings, topRight: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-4 p-4 border rounded-lg bg-slate-50/50">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> Chân trang (Footer)
              </h3>
              <div className="space-y-2">
                <Label>Bên trái</Label>
                <Input 
                  placeholder="VD: Giáo viên: Nguyễn Văn A" 
                  value={hfSettings.bottomLeft || ''}
                  onChange={(e) => setHfSettings({...hfSettings, bottomLeft: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Bên phải</Label>
                <Input 
                  placeholder="VD: Ký tên" 
                  value={hfSettings.bottomRight || ''}
                  onChange={(e) => setHfSettings({...hfSettings, bottomRight: e.target.value})}
                />
              </div>
              <p className="text-[10px] text-slate-400 italic mt-2">
                * Mặc định ở giữa chân trang là số trang.
              </p>
            </div>
          </div>
          <Button onClick={() => saveHF(hfSettings)} className="w-full">
            Lưu cài đặt Header/Footer
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="w-5 h-5 text-primary" />
            Cài đặt Rút kinh nghiệm & Ký duyệt
          </CardTitle>
          <CardDescription>
            Tùy chỉnh phần "Rút kinh nghiệm" và thông tin người ký ở cuối giáo án.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-2 mb-4">
            <input 
              type="checkbox" 
              id="enable-reflection" 
              checked={reflectionSettings.enabled}
              onChange={(e) => setReflectionSettings({...reflectionSettings, enabled: e.target.checked})}
              className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
            />
            <Label htmlFor="enable-reflection" className="font-semibold">Hiển thị phần Rút kinh nghiệm & Ký duyệt</Label>
          </div>

          {reflectionSettings.enabled && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-2 p-2 bg-blue-50/50 rounded-md border border-blue-100">
                <input 
                  type="checkbox" 
                  id="auto-signing-date" 
                  checked={!!reflectionSettings.autoSigningDate}
                  onChange={(e) => setReflectionSettings({...reflectionSettings, autoSigningDate: e.target.checked})}
                  className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                />
                <Label htmlFor="auto-signing-date" className="text-sm font-medium text-blue-800">
                  Tự động tính ngày ký (Thứ 7 tuần trước ngày dạy đầu tiên)
                </Label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-4 p-4 border rounded-lg bg-slate-50/50">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Settings2 className="w-4 h-4" /> Nội dung Rút kinh nghiệm
                </h3>
                
                {/* Toggle: hiển thị phần rút kinh nghiệm */}
                <div className="flex items-center justify-between p-2 rounded-md border bg-white">
                  <div>
                    <p className="text-xs font-medium">Hiển thị phần Rút kinh nghiệm</p>
                    <p className="text-[10px] text-slate-400">Thêm tiêu đề + dòng kẻ rút kinh nghiệm vào cuối giáo án</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reflectionSettings.showReflection !== false}
                    onChange={(e) => setReflectionSettings({...reflectionSettings, showReflection: e.target.checked})}
                    className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                  />
                </div>

                {/* Toggle: hiển thị thời gian ký */}
                <div className="flex items-center justify-between p-2 rounded-md border bg-white">
                  <div>
                    <p className="text-xs font-medium">Hiển thị dòng thời gian ký</p>
                    <p className="text-[10px] text-slate-400">Thêm dòng "Ký duyệt, ngày... tháng... năm..."</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reflectionSettings.showSigningDate !== false}
                    onChange={(e) => setReflectionSettings({...reflectionSettings, showSigningDate: e.target.checked})}
                    className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tiêu đề phần</Label>
                  <Input 
                    placeholder="VD: RÚT KINH NGHIỆM" 
                    value={reflectionSettings.title || ''}
                    onChange={(e) => setReflectionSettings({...reflectionSettings, title: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Số dòng trống</Label>
                  <Input 
                    type="number"
                    min="1"
                    max="10"
                    value={reflectionSettings.contentLines}
                    onChange={(e) => setReflectionSettings({...reflectionSettings, contentLines: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="space-y-4 p-4 border rounded-lg bg-slate-50/50">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Settings2 className="w-4 h-4" /> Thông tin Ký duyệt
                </h3>
                <div className="space-y-2">
                  <Label>Người ký duyệt</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setReflectionSettings({...reflectionSettings, approverTitle: 'TỔ TRƯỞNG KÝ DUYỆT'})}
                      className={`flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-lg border-2 text-xs font-semibold transition-all
                        ${reflectionSettings.approverTitle === 'TỔ TRƯỞNG KÝ DUYỆT' || !reflectionSettings.approverTitle
                          ? 'border-primary bg-primary/10 text-primary shadow-sm'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                    >
                      <span className="text-base">👑</span>
                      Tổ trưởng
                    </button>
                    <button
                      type="button"
                      onClick={() => setReflectionSettings({...reflectionSettings, approverTitle: 'PHÓ TỔ TRƯỞNG KÝ DUYỆT'})}
                      className={`flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-lg border-2 text-xs font-semibold transition-all
                        ${reflectionSettings.approverTitle === 'PHÓ TỔ TRƯỞNG KÝ DUYỆT'
                          ? 'border-primary bg-primary/10 text-primary shadow-sm'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                    >
                      <span className="text-base">🏅</span>
                      Phó tổ trưởng
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    Hiện tại: <strong>{reflectionSettings.approverTitle || 'TỔ TRƯỞNG KÝ DUYỆT'}</strong>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Địa danh nơi dạy</Label>
                    <Input 
                      placeholder="VD: Đường Hào" 
                      value={reflectionSettings.location || ''}
                      onChange={(e) => setReflectionSettings({...reflectionSettings, location: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Họ tên giáo viên</Label>
                    <Input 
                      placeholder="VD: Nguyễn Thị A" 
                      value={reflectionSettings.teacherName || ''}
                      onChange={(e) => setReflectionSettings({...reflectionSettings, teacherName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Họ tên tổ trưởng/phó</Label>
                    <Input 
                      placeholder="VD: Đỗ Ngọc Phượng" 
                      value={reflectionSettings.approverName || ''}
                      onChange={(e) => setReflectionSettings({...reflectionSettings, approverName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Năm học</Label>
                    <Input 
                      placeholder="VD: 2025" 
                      value={reflectionSettings.year || ''}
                      onChange={(e) => setReflectionSettings({...reflectionSettings, year: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
          <Button onClick={() => saveReflection(reflectionSettings)} className="w-full">
            Lưu cài đặt Rút kinh nghiệm
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

