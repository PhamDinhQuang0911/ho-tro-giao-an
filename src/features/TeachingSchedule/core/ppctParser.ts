import * as mammoth from 'mammoth';
import type { PPCTLesson } from './types';

export class PpctParser {
  static async parseFromDocx(file: File, subjectName: string): Promise<PPCTLesson[]> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(result.value, 'text/html');
    const tables = doc.querySelectorAll('table');
    
    const lessons: PPCTLesson[] = [];
    
    tables.forEach(table => {
      const rows = table.querySelectorAll('tr');
      if (rows.length < 2) return;

      const headerCells = Array.from(rows[0].querySelectorAll('th, td')).map(td => (td.textContent || '').toLowerCase().trim());
      
      let tietIndex = headerCells.findIndex(h => h === 'tiết' || h.includes('tiết học') || h.includes('tiết thứ') || h.includes('tuần'));
      let baiIndex = headerCells.findIndex(h => h.includes('bài') || h.includes('nội dung') || h.includes('chủ đề'));
      
      if (tietIndex === -1) tietIndex = 0; 
      if (baiIndex === -1) {
        baiIndex = headerCells.findIndex(h => h.length > 5) > -1 ? headerCells.findIndex(h => h.length > 5) : 1;
      }

      let currentMergedBaiText = '';

      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        if (cells.length > 0) {
          let tietText = '';
          let baiText = '';
          
          if (cells.length === 1) {
            continue;
          } else if (cells.length > Math.max(tietIndex, baiIndex)) {
            tietText = (cells[tietIndex]?.textContent || '').trim();
            baiText = (cells[baiIndex]?.textContent || '').trim();
          } else if (cells.length > 0) {
            tietText = (cells[0]?.textContent || '').trim();
            baiText = currentMergedBaiText;
          }
          
          if (baiText) currentMergedBaiText = baiText;
          if (!tietText) continue;

          const periods = this.extractPeriods(tietText);
          
          periods.forEach(p => {
            if (baiText && p > 0) {
              if (!lessons.find(l => l.ppct_period === p)) {
                lessons.push({
                  subject: subjectName,
                  grade: '', 
                  ppct_period: p,
                  lesson_name: baiText.replace(/\n/g, ' ')
                });
              }
            }
          });
        }
      }
    });

    return lessons.sort((a, b) => a.ppct_period - b.ppct_period);
  }

  private static extractPeriods(text: string): number[] {
    const cleanText = text.replace(/\s+/g, '');
    const nums: number[] = [];
    
    if (cleanText.includes('-')) {
      const parts = cleanText.split('-');
      const start = parseInt(parts[0]);
      const end = parseInt(parts[1]);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) nums.push(i);
      }
    } else if (cleanText.includes(',')) {
      const parts = cleanText.split(',');
      parts.forEach(p => {
        const n = parseInt(p);
        if (!isNaN(n)) nums.push(n);
      });
    } else {
      const n = parseInt(cleanText);
      if (!isNaN(n)) nums.push(n);
    }
    
    return nums;
  }
}
