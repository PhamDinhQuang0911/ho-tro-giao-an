import { ScheduleItem } from './word-utils';

export interface FileData {
  type: 'image' | 'text';
  data: string; // Base64 for image, raw string for text
  name: string; // File name (e.g. Sáng, Chiều)
}

export async function getGeminiSchedule(
  filesData: FileData[], 
  teacherName: string, 
  mathLogic: string, 
  model: string, 
  apiKey: string
): Promise<ScheduleItem[]> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `
Bạn là một trợ lý ảo nhận diện thời khóa biểu của trường học.
Nhiệm vụ: Trích xuất lịch dạy của giáo viên tên là "${teacherName}" từ dữ liệu thời khóa biểu được cung cấp.

Chú ý đối với môn Toán (nếu có chia phân môn):
Người dùng đã chọn quy tắc: "${mathLogic}". Hãy phân bổ tên môn thành "Toán (Đại số)" hoặc "Toán (Hình học)" theo đúng quy tắc đó.
Ví dụ nếu quy tắc là "3 Đại, 1 Hình", hãy lặp lại chuỗi: Đại, Đại, Đại, Hình cho các tiết Toán của cùng 1 lớp trong tuần.

Dữ liệu có thể bao gồm TKB Sáng và Chiều (dưới dạng ảnh hoặc text). Hãy tổng hợp tất cả.

Hãy trả về kết quả dưới dạng JSON theo đúng mảng các object như sau (không kèm theo văn bản nào khác):
[
  {
    "id": "random_string",
    "dayOfWeek": number, // 1 (Thứ 2) đến 6 (Thứ 7), 0 (Chủ nhật)
    "subject": "Tên môn học",
    "className": "Tên lớp",
    "period": "Tiết X" // Ví dụ: "Tiết 1" (lưu ý: số tiết tính theo buổi, sáng tiết 1-5, chiều tiết 1-5, bạn cứ ghi đúng số tiết trong TKB)
  }
]
`;

  const parts: any[] = [{ text: prompt }];

  for (const file of filesData) {
    if (file.type === 'image') {
      const base64Data = file.data.split(',')[1];
      parts.push({ text: `\nDữ liệu TKB (${file.name}): [Hình ảnh đính kèm]\n` });
      parts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: base64Data
        }
      });
    } else {
      parts.push({ text: `\nDữ liệu TKB (${file.name}):\n${file.data}\n` });
    }
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Lỗi kết nối đến Gemini API');
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) throw new Error('AI không trả về kết quả hợp lệ.');

  try {
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    
    // Generate unique IDs if missing
    return parsed.map((item: any) => ({
      ...item,
      id: item.id || Math.random().toString(36).substr(2, 9)
    }));
  } catch (e) {
    throw new Error('Không thể phân tích dữ liệu JSON từ AI.');
  }
}
