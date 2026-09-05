import * as mammoth from 'mammoth';
import type { PPCTLesson } from './types';

// Keywords to identify Geometry chapters
const HINH_KEYWORDS = ['hình học', 'hệ thức lượng', 'đường tròn', 'tứ giác', 'tam giác', 'góc nội tiếp', 'cung và dây', 'đa giác', 'nội tiếp', 'ngoại tiếp'];
// Keywords to identify Algebra / General chapters
const DAI_KEYWORDS = ['đại số', 'phương trình', 'bất phương trình', 'hàm số', 'tần số', 'bất đẳng thức', 'căn bậc', 'thống kê', 'xác suất', 'viète'];

function isHinhChapter(text: string): boolean {
  const s = text.toLowerCase();
  return HINH_KEYWORDS.some(k => s.includes(k));
}

function isDaiChapter(text: string): boolean {
  const s = text.toLowerCase();
  return DAI_KEYWORDS.some(k => s.includes(k));
}

function cleanName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, '');
}

export class PpctParser {
  /**
   * Parse a PPCT .docx file.
   * subjectName: user label e.g. "Toán Đại", "Toán Hình", "Tin học"
   *
   * For math files that contain both Đại and Hình chapters, the parser
   * automatically selects only the tables belonging to the requested branch.
   */
  static async parseFromDocx(file: File, subjectName: string): Promise<PPCTLesson[]> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(result.value, 'text/html');
    const tables = doc.querySelectorAll('table');
    
    const cn = cleanName(subjectName);
    const wantHinh = cn.includes('hinh') || cn.includes('hh');
    const wantDai = !wantHinh && (cn.includes('dai') || cn.includes('ds') || cn.includes('toan'));
    const isMathSplit = wantHinh || wantDai;

    const lessons: PPCTLesson[] = [];

    tables.forEach(table => {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length < 2) return;

      // Identify header row (must have tiết/PPCT + lesson columns)
      const headerCells = Array.from(rows[0].querySelectorAll('th, td'))
        .map(td => (td.textContent || '').toLowerCase().trim());
      
      const hasPpct = headerCells.some(h => h.includes('tiết'));
      const hasLesson = headerCells.some(h => h.includes('bài') || h.includes('nội dung') || h.includes('chủ đề'));
      if (!hasPpct || !hasLesson) return;

      // Find column indices
      let tietIdx = headerCells.findIndex(h => h.includes('tiết ppct'));
      if (tietIdx === -1) tietIdx = headerCells.findIndex(h => h.includes('tiết'));
      if (tietIdx === -1) tietIdx = 3;

      let baiIdx = headerCells.findIndex(h => h.includes('bài học'));
      if (baiIdx === -1) baiIdx = headerCells.findIndex(h => h.includes('bài') || h.includes('nội dung') || h.includes('chủ đề'));
      if (baiIdx === -1) baiIdx = 1;

      // For math split files: determine if this table is Đại or Hình
      // by scanning for a chapter heading row (spans full width with chapter name)
      if (isMathSplit) {
        let tableType: 'dai' | 'hinh' | 'unknown' = 'unknown';
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          // Chapter heading rows typically have 1 long cell
          if (cells.length <= 2) {
            const rowText = (row.textContent || '').trim();
            if (rowText.length > 8) {
              if (isHinhChapter(rowText)) { tableType = 'hinh'; break; }
              if (isDaiChapter(rowText)) { tableType = 'dai'; break; }
            }
          }
        }
        
        if (wantHinh && tableType !== 'hinh') return;
        if (wantDai && tableType !== 'dai') return;
      }

      // Parse the table rows
      let prevBai = '';
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        if (cells.length === 0) continue;

        // Skip chapter heading rows inside the table (merged cell with chapter name)
        if (cells.length <= 2) {
          const t = (rows[i].textContent || '').trim();
          if (t.length > 10 && isNaN(Number(t.trim()[0]))) continue;
        }

        let tietText = '';
        let baiText = '';

        if (cells.length > Math.max(tietIdx, baiIdx)) {
          tietText = (cells[tietIdx]?.textContent || '').trim();
          baiText = (cells[baiIdx]?.textContent || '').trim();
        } else {
          // Continuation row (only period number in first column)
          tietText = (cells[0]?.textContent || '').trim();
          baiText = prevBai;
        }

        if (baiText) prevBai = baiText;
        if (!tietText) continue;

        const periods = this.extractPeriods(tietText);
        const lessonName = (baiText || prevBai).replace(/\n/g, ' ').trim();

        periods.forEach(p => {
          if (p > 0 && lessonName) {
            if (!lessons.find(l => l.ppct_period === p)) {
              lessons.push({
                subject: subjectName,
                grade: '',
                ppct_period: p,
                lesson_name: lessonName
              });
            }
          }
        });
      }
    });

    return lessons.sort((a, b) => a.ppct_period - b.ppct_period);
  }

  private static extractPeriods(text: string): number[] {
    const clean = text.replace(/\s+/g, '').replace(/;/g, ',');
    const nums: number[] = [];
    
    if (clean.includes('-')) {
      const [s, e] = clean.split('-').map(Number);
      if (!isNaN(s) && !isNaN(e) && s <= e && e - s < 50) {
        for (let i = s; i <= e; i++) nums.push(i);
      }
    } else if (clean.includes(',')) {
      clean.split(',').forEach(p => {
        const n = parseInt(p);
        if (!isNaN(n) && n > 0) nums.push(n);
      });
    } else {
      const n = parseInt(clean);
      if (!isNaN(n) && n > 0) nums.push(n);
    }
    
    return nums;
  }
}


