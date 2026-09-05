import { GoogleGenerativeAI } from "@google/generative-ai";
import type { PPCTLesson, TimetablePeriod } from "./types";

// LƯU Ý: Trong thực tế không nên hardcode API KEY ở client. 
// Chức năng này nên được gọi từ backend hoặc yêu cầu user nhập API KEY.
export class AIExtractor {
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = "gemini-3.6-flash") {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  /**
   * Đọc hình ảnh thời khóa biểu và trích xuất lịch dạy
   */
  async extractTimetableFromImage(
    file: File, 
    teacherName: string,
    session: 'SÁNG' | 'CHIỀU',
    specialRules: string = ''
  ): Promise<TimetablePeriod[]> {
    const model = this.genAI.getGenerativeModel({ model: this.modelName });
    
    // Convert file to base64
    const base64Data = await this.fileToBase64(file);
    
    const prompt = `
      Đây là thời khóa biểu buổi ${session}.
      Hãy tìm TẤT CẢ các tiết dạy của giáo viên có tên là "${teacherName}".
      
      QUAN TRỌNG VỀ ĐÁNH SỐ TIẾT:
      - Trường "period" BẮT BUỘC phải là các số 1, 2, 3, 4, 5.
      - Nếu ảnh là buổi CHIỀU và các tiết được đánh số tiếp nối từ sáng (ví dụ: 6, 7, 8, 9, 10 hoặc 5, 6, 7, 8), bạn PHẢI tự động quy đổi về 1, 2, 3, 4, 5 tương ứng (Ví dụ: Tiết đầu tiên của buổi chiều phải là 1).
      
      ${specialRules ? `QUY TẮC ĐẶC BIỆT TỪ NGƯỜI DÙNG (BẠN PHẢI ÁP DỤNG VÀ THAY ĐỔI KẾT QUẢ THEO ĐÚNG YÊU CẦU NÀY):
      ${specialRules}
      (Ví dụ: Nếu yêu cầu "3 Toán Đại, 1 Toán Hình", mà trong ảnh chỉ ghi "Toán", bạn CẦN TỰ ĐỘNG ĐỔI TÊN MÔN "Toán" thành "Toán Đại" và "Toán Hình" sao cho đúng tỷ lệ yêu cầu. Nếu yêu cầu "3 tiết HĐTN", mà ảnh chỉ có 1 tiết, bạn PHẢI TỰ ĐỘNG ĐIỀN THÊM 2 tiết HĐTN liền kề vào danh sách kết quả).` : ''}
      
      Trả về định dạng mảng JSON thuần túy (không có markdown \`\`\`json):
      [
        {
          "day": "Thứ 2", // Thứ 2, Thứ 3, ...
          "session": "${session}",
          "period": 1, // Bắt buộc là số nguyên 1, 2, 3, 4, 5
          "subject": "Tên môn (đã áp dụng quy tắc nếu có)",
          "class_name": "Tên lớp (vd 9D2)"
        }
      ]
    `;

    const imageParts = [
      {
        inlineData: {
          data: base64Data.split(',')[1],
          mimeType: file.type
        },
      },
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      return JSON.parse(text) as TimetablePeriod[];
    } catch (e) {
      console.error("Lỗi parse JSON từ Gemini:", text);
      throw new Error(`Không thể trích xuất dữ liệu từ ảnh TKB ${session}.`);
    }
  }

  /**
   * Đọc văn bản thô từ file Word (đã qua mammoth) và trích xuất PPCT
   */
  async extractPPCTFromText(rawText: string): Promise<PPCTLesson[]> {
    const model = this.genAI.getGenerativeModel({ model: this.modelName });
    
    const prompt = `
      Dưới đây là nội dung văn bản phân phối chương trình (PPCT).
      Hãy trích xuất danh sách các tiết học.
      Trả về định dạng mảng JSON thuần túy (không có markdown \`\`\`json):
      [
        {
          "subject": "Tên môn",
          "grade": "Tên khối/lớp (vd 9)",
          "ppct_period": 1,
          "lesson_name": "Tên bài học"
        }
      ]
      
      Nội dung:
      ${rawText.substring(0, 30000)} // Giới hạn ký tự để không vượt quá token
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      return JSON.parse(text) as PPCTLesson[];
    } catch (e) {
      console.error("Lỗi parse JSON từ Gemini:", text);
      throw new Error("Không thể trích xuất PPCT từ văn bản.");
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }
}
