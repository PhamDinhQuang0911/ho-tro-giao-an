import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { ScheduledLesson } from './types';

export class ExcelBuilder {
  static async exportSchedule(
    schedule: ScheduledLesson[], 
    weekRange: string, 
    teacherName: string,
    afternoonFormat: string = 'suffix',
    afternoonStartPeriod: number = 6
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Lịch báo giảng');

    // Cấu hình cột
    worksheet.columns = [
      { key: 'day', width: 15 },
      { key: 'period', width: 8 },
      { key: 'subject', width: 12 },
      { key: 'class', width: 10 },
      { key: 'ppct', width: 8 },
      { key: 'lesson', width: 70 },
      { key: 'note', width: 20 }
    ];

    // Merge title
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `Lịch báo giảng TUẦN (${weekRange})`;
    titleCell.font = { name: 'Times New Roman', size: 14, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Header row
    const headerRow = worksheet.getRow(3);
    headerRow.values = ['Thứ / Buổi', 'Tiết', 'Môn', 'Lớp', 'PPCT', 'TÊN BÀI', 'GHI CHÚ'];
    headerRow.font = { name: 'Times New Roman', size: 12, bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Group by Day and Session
    const grouped: Record<string, ScheduledLesson[]> = {};
    for (const lesson of schedule) {
      const key = `${lesson.day}\n${lesson.session}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(lesson);
    }

    let currentRow = 4;
    let isEvenDay = false; // To toggle background colors

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    // Prepare rows
    for (const [groupKey, lessons] of Object.entries(grouped)) {
      lessons.sort((a, b) => a.period - b.period);
      
      const startRow = currentRow;
      const isAfternoon = groupKey.includes('CHIỀU');
      
      for (let p = 1; p <= 5; p++) {
        const lesson = lessons.find(l => l.period === p);
        const row = worksheet.getRow(currentRow);
        
        row.getCell(1).value = p === 1 ? groupKey : ''; // Will be merged later
        
        let displayPeriod: string | number = p;
        if (isAfternoon) {
          if (afternoonFormat === 'suffix') displayPeriod = `${p}(c)`;
          else if (afternoonFormat === 'continuous') displayPeriod = p - 1 + afternoonStartPeriod;
        }
        
        row.getCell(2).value = displayPeriod;
        
        row.getCell(3).value = lesson ? lesson.subject : '';
        row.getCell(4).value = lesson ? lesson.class_name : '';
        row.getCell(5).value = lesson && lesson.ppct_period !== null ? lesson.ppct_period : '';
        row.getCell(6).value = lesson ? lesson.lesson_name : '';
        row.getCell(7).value = lesson ? lesson.note : '';
        
        // Font
        row.font = { name: 'Times New Roman', size: 12 };
        
        // Alignment
        for (let c = 1; c <= 7; c++) {
          row.getCell(c).alignment = { vertical: 'middle', horizontal: c === 6 ? 'left' : 'center', wrapText: true };
          row.getCell(c).border = borderStyle;
          
          if (isEvenDay) {
            row.getCell(c).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF2F2F2' } // Light gray
            };
          }
        }
        currentRow++;
      }
      
      // Merge Day column for 5 periods
      worksheet.mergeCells(`A${startRow}:A${startRow + 4}`);
      
      isEvenDay = !isEvenDay; // toggle color
    }
    
    // Apply borders to header
    for (let c = 1; c <= 7; c++) {
      headerRow.getCell(c).border = borderStyle;
    }

    // Xuất file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Lich_Bao_Giang_${teacherName.replace(/\s+/g, '_')}.xlsx`);
  }
}
