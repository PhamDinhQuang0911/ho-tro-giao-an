import * as XLSX from 'xlsx';

export class ExcelParser {
  /**
   * Đọc file lịch báo giảng cũ để tìm số tiết PPCT lớn nhất đã dạy cho từng môn-lớp.
   * Cấu trúc file Excel giả định giống mẫu đã xuất (Cột: Thứ, Tiết, Môn, Lớp, PPCT, Tên bài, Ghi chú)
   */
  static async parseOldScheduleProgress(file: File): Promise<Record<string, number>> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Giả sử dữ liệu nằm ở sheet đầu tiên
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Chuyển sheet thành mảng JSON
    const data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
    
    const progress: Record<string, number> = {};

    // Tìm vị trí các cột dựa trên Header
    // Header thường nằm ở dòng thứ 2 hoặc 3 (có chữ 'Môn', 'Lớp', 'PPCT')
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

    // Duyệt qua các dòng dữ liệu bên dưới header
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const mon = row[colMon]?.toString().trim();
      const lop = row[colLop]?.toString().trim();
      const ppctRaw = row[colPpct];

      if (!mon || !lop || ppctRaw === undefined || ppctRaw === null || ppctRaw === '') continue;

      const ppctVal = parseInt(ppctRaw.toString(), 10);
      if (isNaN(ppctVal)) continue;

      const key = `${mon}-${lop}`;
      if (!progress[key] || progress[key] < ppctVal) {
        progress[key] = ppctVal;
      }
    }

    return progress;
  }
}
