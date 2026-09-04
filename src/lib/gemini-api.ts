import { ScheduleItem } from './word-utils';

export async function getGeminiSchedule(
  base64Image: string, 
  teacherName: string, 
  mathLogic: string, 
  model: string, 
  apiKey: string
): Promise<ScheduleItem[]> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Remove data:image/...;base64, prefix
  const base64Data = base64Image.split(',')[1];

  const prompt = `
Bạn là một trợ lý ảo nhận diện thời khóa biểu của trường học.
Nhiệm vụ: Trích xuất lịch dạy của giáo viên tên là "${teacherName}" từ ảnh thời khóa biểu.

Chú ý đối với môn Toán:
- Nếu phân bổ là "danxen" (Đan xen): các tiết Toán của cùng một lớp trong tuần sẽ luân phiên là "Toán (Đại số)" và "Toán (Hình học)".
- Nếu "lientiep": 2 tiết đầu là "Toán (Đại số)", tiết 3 là "Toán (Hình học)".
- Nếu "all_dai": Tất cả là "Toán (Đại số)".
- Nếu "all_hinh": Tất cả là "Toán (Hình học)".
Người dùng đã chọn: "${mathLogic}".

Hãy trả về kết quả dưới dạng JSON theo đúng mảng các object như sau (không kèm theo văn bản nào khác):
[
  {
    "id": "random_string",
    "dayOfWeek": number, // 1 (Thứ 2) đến 6 (Thứ 7), 0 (Chủ nhật)
    "subject": "Tên môn học",
    "className": "Tên lớp",
    "period": "Tiết X" // Ví dụ: "Tiết 1"
  }
]
`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Data
            }
          }
        ]
      }
    ],
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
