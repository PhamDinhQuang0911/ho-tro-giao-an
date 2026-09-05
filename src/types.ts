export type SubjectType = 
  | 'Tin học' 
  | 'Toán' | 'Vật lý' | 'Hóa học' | 'Sinh học' | 'Khoa học tự nhiên'
  | 'Ngữ văn' | 'Tiếng Anh' | 'Lịch sử' | 'Địa lý' | 'GDCD' | 'Khoa học xã hội'
  | 'Công nghệ' | 'Âm nhạc' | 'Mỹ thuật' | 'Thể dục' | 'Hoạt động trải nghiệm';

export type GradeType = 
  | 'Lớp 1' | 'Lớp 2' 
  | 'Lớp 3' | 'Lớp 4' | 'Lớp 5' 
  | 'Lớp 6' | 'Lớp 7' 
  | 'Lớp 8' | 'Lớp 9' 
  | 'Lớp 10' | 'Lớp 11' | 'Lớp 12';

export interface ReflectionSettings {
  enabled: boolean;
  title: string;
  contentLines: number;
  approverTitle: string;
  approverName: string;
  year: string;
  autoSigningDate?: boolean;
  showReflection?: boolean;   // hiển thị phần Rút kinh nghiệm (dòng kẻ)
  showSigningDate?: boolean;  // hiển thị dòng "Ký duyệt, ngày..."
  location?: string;          // e.g. "Đường Hào"
  teacherName?: string;       // e.g. "Nguyễn Thị A"
  insertSignature?: boolean;
  signatureImage?: string;
}

export interface ProcessingConfig {
  insertObjectives: boolean;
  insertMaterials: boolean;
  insertActivities: boolean;
  appendTable: boolean;
  mergePeriods?: boolean;
}

export interface GeneratedNLSContent {
  objectives_addition: string;
  materials_addition: string;
  activities_integration: Array<{
    anchor_text: string;
    content: string;
    type?: 'nls' | 'ai';
  }>;
  appendix_table: string;
}

export interface NLSProcessingOptions {
  subject: SubjectType;
  createScheduleTable?: boolean;
  grade: GradeType;
  apiKey: string;
  config: ProcessingConfig;
  addNlsColumn?: boolean;
  appendixText?: string;
  aiModel?: string;
}
