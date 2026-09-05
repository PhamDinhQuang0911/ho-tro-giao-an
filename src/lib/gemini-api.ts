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
  apiKey: string,
  useAfternoonSuffix: boolean = true
): Promise<ScheduleItem[]> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const afternoonNote = useAfternoonSuffix
    ? `QUAN TRỌNG về ký hiệu tiết chiều:
- Buổi sáng: tiết 1, 2, 3, 4, 5 → ghi đúng như vậy: "Tiết 1", "Tiết 2"...
- Buổi chiều: tiết 1 chiều → ghi "Tiết 1(c)", tiết 2 chiều → "Tiết 2(c)", tiết 3 chiều → "Tiết 3(c)"... (thêm hậu tố "(c)" vào cuối)
Ví dụ: Thứ 2 buổi chiều tiết 2 → period = "Tiết 2(c)"`
    : `QUAN TRỌNG về số tiết chiều:
- Buổi sáng: tiết 1-5 giữ nguyên.
- Buổi chiều: tiết 1 chiều = tiết 6, tiết 2 chiều = tiết 7, tiết 3 chiều = tiết 8, tiết 4 chiều = tiết 9, tiết 5 chiều = tiết 10. Hãy cộng thêm 5 vào số tiết chiều.`;

  const prompt = `Bạn là một trợ lý ảo nhận diện thời khóa biểu của trường học.
Nhiệm vụ: Trích xuất lịch dạy của giáo viên tên là "${teacherName}" từ dữ liệu thời khóa biểu được cung cấp.

Chú ý đối với môn Toán (nếu có chia phân môn):
Người dùng đã chọn quy tắc: "${mathLogic}". Hãy phân bổ tên môn thành "Toán (Đại số)" hoặc "Toán (Hình học)" theo đúng quy tắc đó.
Ví dụ nếu quy tắc là "3 Đại, 1 Hình", hãy lặp lại chuỗi: Đại, Đại, Đại, Hình cho các tiết Toán của cùng 1 lớp trong tuần.

Dữ liệu có thể bao gồm TKB Sáng và Chiều. Hãy tổng hợp tất cả.

${afternoonNote}

Hãy trả về kết quả dưới dạng JSON theo đúng mảng các object sau (không kèm văn bản nào khác):
[
  {
    "id": "random_string",
    "dayOfWeek": number, // 1 (Thứ 2) đến 6 (Thứ 7), 0 (Chủ nhật)
    "subject": "Tên môn học",
    "className": "Tên lớp",
    "period": "Tiết X" // Ví dụ: "Tiết 3" hoặc "Tiết 2(c)"
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
    return parsed.map((item: any) => ({
      ...item,
      id: item.id || Math.random().toString(36).substr(2, 9)
    }));
  } catch (e) {
    throw new Error('Không thể phân tích dữ liệu JSON từ AI.');
  }
}
