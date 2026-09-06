import * as XLSX from 'xlsx';

/** 
 * Normalize subject name same way as ScheduleEngine.cleanString + findMatchingPpctSubject
 * Returns a stable key that can match against availableSubjects
 */
function normalizeSubjectKey(subjectRaw: string): string {
  let s = subjectRaw.toLowerCase().trim();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/đ/g, 'd').replace(/[()（）\[\]]/g, '').replace(/\s+/g, '');
  return s;
}

/** 
 * Match a raw subject string from the old file to one of the available PPCT subject keys.
 * This mirrors ScheduleEngine.findMatchingPpctSubject logic.
 */
function matchSubject(raw: string, availableSubjects: string[]): string {
  const s = normalizeSubjectKey(raw);
  
  // Exact match
  if (availableSubjects.includes(s)) return s;

  // Math branch matching (Đại / Hình)
  if (s.includes('toan') || s.includes('toán')) {
    if (s.includes('dai') || s.includes('d') && s.includes('toan')) {
      const m = availableSubjects.find(a => a.includes('toan') && (a.includes('dai') || a.includes('ds')));
      if (m) return m;
    }
    if (s.includes('hinh') || s.includes('h') && s.includes('toan')) {
      const m = availableSubjects.find(a => a.includes('toan') && (a.includes('hinh') || a.includes('hh')));
      if (m) return m;
    }
    // generic math fallback
    const m = availableSubjects.find(a => a.includes('toan'));
    if (m) return m;
  }

  // Alias-based matching
  const aliasGroups: [string, string[]][] = [
    ['tin', ['tin', 'tinhoc']],
    ['hdtn', ['hdtn', 'trainghiem', 'tnhn']],
    ['van', ['van', 'nguvan']],
    ['anh', ['anh', 'tienganh']],
    ['ly', ['ly', 'vatly']],
    ['hoa', ['hoa', 'hoahoc']],
    ['sinh', ['sinh', 'sinhhoc']],
    ['su', ['su', 'lichsu']],
    ['dia', ['dia', 'dialy']],
    ['gdcd', ['gdcd', 'congdan']],
  ];

  for (const [, aliases] of aliasGroups) {
    if (aliases.some(a => s.includes(a))) {
      const m = availableSubjects.find(sub => aliases.some(a => sub.includes(a)));
      if (m) return m;
    }
  }

  // Loose substring
  const loose = availableSubjects.find(a => s.includes(a) || a.includes(s));
  if (loose) return loose;

  return s; // fallback to normalized raw
}

export class ExcelParser {
  /**
   * Read old schedule file and extract the highest PPCT period taught per (subject, class) pair.
   * Keys are normalized to match ScheduleEngine's progressKey format: "${matchedPpctSubject}-${class}".
   * 
   * @param file  The old .xlsx schedule file
   * @param availableSubjects  Cleaned subject keys from PPCT cache (e.g. ["toandai", "toanhinh", "tin"])
   */
  static async parseOldScheduleProgress(
    file: File, 
    availableSubjects: string[] = []
  ): Promise<Record<string, number>> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
    
    const progress: Record<string, number> = {};

    // Find header row containing Môn, Lớp, PPCT columns
    let headerRowIndex = -1;
    let colMon = -1;
    let colLop = -1;
    let colPpct = -1;

    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (!row) continue;
      
      const monIdx = row.findIndex((cell: any) => typeof cell === 'string' && cell.toLowerCase().includes('môn'));
      const lopIdx = row.findIndex((cell: any) => typeof cell === 'string' && cell.toLowerCase().includes('lớp'));
      const ppctIdx = row.findIndex((cell: any) => typeof cell === 'string' && cell.toLowerCase().includes('ppct'));
      
      if (monIdx !== -1 && lopIdx !== -1 && ppctIdx !== -1) {
        headerRowIndex = i;
        colMon = monIdx;
        colLop = lopIdx;
        colPpct = ppctIdx;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error("Không tìm thấy các cột 'Môn', 'Lớp', 'PPCT' trong file lịch báo giảng cũ.");
    }

    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const monRaw = row[colMon]?.toString().trim();
      const lopRaw = row[colLop]?.toString().trim();
      const ppctRaw = row[colPpct];

      if (!monRaw || !lopRaw || ppctRaw === undefined || ppctRaw === null || ppctRaw === '') continue;

      const ppctVal = parseInt(ppctRaw.toString(), 10);
      if (isNaN(ppctVal) || ppctVal <= 0) continue;

      // Normalize to match scheduleEngine progressKey format
      const normSubject = matchSubject(monRaw, availableSubjects);
      const normClass = lopRaw.toLowerCase();
      const key = `${normSubject}-${normClass}`;

      if (!progress[key] || progress[key] < ppctVal) {
        progress[key] = ppctVal;
      }
    }

    return progress;
  }
}


