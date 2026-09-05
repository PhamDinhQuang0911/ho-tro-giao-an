export interface PPCTLesson {
  subject: string;
  grade: string;
  ppct_period: number;
  lesson_name: string;
}

export interface TimetablePeriod {
  day: string; // e.g., "Thứ 2"
  session: 'SÁNG' | 'CHIỀU';
  period: number;
  subject: string;
  class_name: string;
}

export interface OffPeriod {
  day: string;
  session: 'SÁNG' | 'CHIỀU';
  period: number;
  reason: string;
}

export interface ScheduledLesson {
  day: string;
  session: 'SÁNG' | 'CHIỀU';
  period: number;
  subject: string;
  class_name: string;
  ppct_period: number | null;
  lesson_name: string;
  note: string;
}
