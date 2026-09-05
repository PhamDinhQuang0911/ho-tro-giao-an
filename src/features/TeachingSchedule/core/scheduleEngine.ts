import type { PPCTLesson, TimetablePeriod, OffPeriod, ScheduledLesson } from "./types";

/**
 * Thuật toán lõi để ghép Lịch dạy (TKB) và Phụ lục (PPCT)
 */
export class ScheduleEngine {
  /**
   * Tạo lịch báo giảng tuần
   * @param timetable Các tiết dạy trong tuần (đã được sort theo thứ/tiết)
   * @param curriculum Danh sách các bài dạy theo PPCT (đã được sort theo tiết PPCT)
   * @param lastProgress Mảng hoặc Map lưu trữ tiết PPCT cuối cùng đã dạy (vd: { "Toán-9D2": 15 })
   * @param offPeriods Danh sách các tiết xin nghỉ
   */
  private static cleanString(str: string): string {
    let s = str.toLowerCase().trim();
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    s = s.replace(/đ/g, 'd');
    return s.replace(/\s+/g, '');
  }

  private static findMatchingPpctSubject(tkbSubject: string, availableSubjects: string[]): string | null {
    const s = this.cleanString(tkbSubject);
    
    // 1. Exact match
    if (availableSubjects.includes(s)) return s;
    
    // 2. Math specific logic
    if (s.includes('toan')) {
      if (s.includes('dai') || s.includes('ds')) {
        const daiMatch = availableSubjects.find(sub => sub.includes('toan') && (sub.includes('dai') || sub.includes('ds')));
        if (daiMatch) return daiMatch;
      }
      if (s.includes('hinh') || s.includes('hh')) {
        const hinhMatch = availableSubjects.find(sub => sub.includes('toan') && (sub.includes('hinh') || sub.includes('hh')));
        if (hinhMatch) return hinhMatch;
      }
      // Fallback to generic math if specific not found
      const genericToan = availableSubjects.find(sub => sub.includes('toan'));
      if (genericToan) return genericToan;
    }

    // 3. Known aliases
    const aliases: Record<string, string[]> = {
      'tin': ['tin', 'tinhoc'],
      'hdtn': ['hdtn', 'trainghiem', 'tnhn', 'hoatdongtrainghiem'],
      'van': ['van', 'nguvan'],
      'anh': ['anh', 'tienganh', 'ngoaiNgu'],
      'ly': ['ly', 'vatly'],
      'hoa': ['hoa', 'hoahoc'],
      'sinh': ['sinh', 'sinhhoc'],
      'su': ['su', 'lichsu'],
      'dia': ['dia', 'dialy'],
      'gdcd': ['gdcd', 'congdan', 'giaoduccongdan'],
      'td': ['theduc', 'td'],
      'cn': ['congnghe', 'cn'],
      'nhac': ['nhac', 'amnhac'],
      'mt': ['mythuat', 'mt']
    };

    for (const [key, aliasList] of Object.entries(aliases)) {
      if (aliasList.some(alias => s.includes(alias))) {
        // Find a matching PPCT subject that also falls in this alias category
        const match = availableSubjects.find(sub => aliasList.some(a => sub.includes(a)));
        if (match) return match;
      }
    }
    
    // 4. Loose substring match
    const looseMatch = availableSubjects.find(sub => sub.includes(s) || s.includes(sub));
    if (looseMatch) return looseMatch;
    
    return null;
  }

  static buildWeeklySchedule(
    timetable: TimetablePeriod[],
    curriculum: PPCTLesson[],
    lastProgress: Record<string, number>,
    offPeriods: OffPeriod[]
  ): ScheduledLesson[] {
    
    const schedule: ScheduledLesson[] = [];
    
    // Convert curriculum subject names to cleaned versions once
    const cleanedCurriculum = curriculum.map(l => ({
      ...l,
      cleanSubject: this.cleanString(l.subject)
    }));

    const availableSubjects = Array.from(new Set(cleanedCurriculum.map(l => l.cleanSubject)));
    const currentProgress = { ...lastProgress };

    // Sắp xếp timetable
    const dayMap: Record<string, number> = {
      'Thứ 2': 2, 'Thứ 3': 3, 'Thứ 4': 4, 'Thứ 5': 5, 'Thứ 6': 6, 'Thứ 7': 7, 'Chủ nhật': 8
    };
    
    const sortedTimetable = [...timetable].sort((a, b) => {
      const dayDiff = (dayMap[a.day] || 9) - (dayMap[b.day] || 9);
      if (dayDiff !== 0) return dayDiff;
      
      const sessionDiff = (a.session === 'SÁNG' ? 0 : 1) - (b.session === 'SÁNG' ? 0 : 1);
      if (sessionDiff !== 0) return sessionDiff;
      
      return a.period - b.period;
    });

    for (const period of sortedTimetable) {
      // Kiểm tra xem tiết này có được đánh dấu nghỉ không
      const isOff = offPeriods.find(
        (off) =>
          off.day === period.day &&
          off.session === period.session &&
          off.period === period.period
      );

      if (isOff) {
        schedule.push({
          ...period,
          ppct_period: null,
          lesson_name: "",
          note: isOff.reason,
        });
        continue;
      }

      // Find which PPCT subject this TKB period maps to
      const matchedPpctSubject = this.findMatchingPpctSubject(period.subject, availableSubjects);

      if (!matchedPpctSubject) {
        // No PPCT found for this subject at all
        schedule.push({
          ...period,
          ppct_period: null,
          lesson_name: "--- (Chưa tìm thấy trong PPCT) ---",
          note: "",
        });
        continue;
      }

      // Create progress key using the matched PPCT subject so it tracks correctly
      const progressKey = `${matchedPpctSubject}-${period.class_name.toLowerCase()}`;
      
      const nextPpctPeriod = (currentProgress[progressKey] || 0) + 1;

      // Find the specific lesson
      const lesson = cleanedCurriculum.find(
        (l) =>
          l.cleanSubject === matchedPpctSubject &&
          l.ppct_period === nextPpctPeriod
      );

      schedule.push({
        ...period,
        ppct_period: nextPpctPeriod,
        lesson_name: lesson ? lesson.lesson_name : "--- (Chưa tìm thấy tiết này trong PPCT) ---",
        note: "",
      });

      // Cập nhật tiến độ
      currentProgress[progressKey] = nextPpctPeriod;
    }

    return schedule;
  }
}
