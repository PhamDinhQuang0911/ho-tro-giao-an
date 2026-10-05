import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";
import JSZip from "jszip";
import { GradeType, GeneratedNLSContent, NLSProcessingOptions, NlsColumnMode } from "../types";

export type { NlsColumnMode };

const LEVEL_MAPPING: Record<string, { ten: string, kyHieu: string, nhiemVu: string }> = {
  "Lớp 1": { ten: "Cơ bản 1", kyHieu: "CB1", nhiemVu: "Nhiệm vụ đơn giản, có hướng dẫn" },
  "Lớp 2": { ten: "Cơ bản 1", kyHieu: "CB1", nhiemVu: "Nhiệm vụ đơn giản, có hướng dẫn" },
  "Lớp 3": { ten: "Cơ bản 2", kyHieu: "CB2", nhiemVu: "Nhiệm vụ đơn giản, tự chủ hơn" },
  "Lớp 4": { ten: "Cơ bản 2", kyHieu: "CB2", nhiemVu: "Nhiệm vụ đơn giản, tự chủ hơn" },
  "Lớp 5": { ten: "Cơ bản 2", kyHieu: "CB2", nhiemVu: "Nhiệm vụ đơn giản, tự chủ hơn" },
  "Lớp 6": { ten: "Trung cấp 1", kyHieu: "TC1", nhiemVu: "Nhiệm vụ xác định rõ ràng, thường xuyên" },
  "Lớp 7": { ten: "Trung cấp 1", kyHieu: "TC1", nhiemVu: "Nhiệm vụ xác định rõ ràng, thường xuyên" },
  "Lớp 8": { ten: "Trung cấp 2", kyHieu: "TC2", nhiemVu: "Nhiệm vụ không thường xuyên, theo nhu cầu cá nhân" },
  "Lớp 9": { ten: "Trung cấp 2", kyHieu: "TC2", nhiemVu: "Nhiệm vụ không thường xuyên, theo nhu cầu cá nhân" },
  "Lớp 10": { ten: "Nâng cao 1", kyHieu: "NC1", nhiemVu: "Nhiệm vụ phức tạp, hướng dẫn người khác" },
  "Lớp 11": { ten: "Nâng cao 1", kyHieu: "NC1", nhiemVu: "Nhiệm vụ phức tạp, hướng dẫn người khác" },
  "Lớp 12": { ten: "Nâng cao 1", kyHieu: "NC1", nhiemVu: "Nhiệm vụ phức tạp, hướng dẫn người khác" },
};

const KHUNG_NLS_CONTEXT = `
KHUNG NĂNG LỰC SỐ (Tóm tắt cho AI):
1. Khai thác dữ liệu (I):
- 1.1. Tìm kiếm và lọc (TC1: Tìm theo quy trình; TC2: Tổ chức chiến lược tìm kiếm).
- 1.2. Đánh giá dữ liệu (TC1: So sánh độ tin cậy; TC2: Phân tích nguồn tin).
- 1.3. Quản lý dữ liệu (TC1: Lưu trữ có cấu trúc; TC2: Sắp xếp để dễ truy xuất).

2. Giao tiếp và hợp tác (II):
- 2.1. Tương tác (TC1: Tương tác thường xuyên; TC2: Chọn nhiều công cụ phù hợp bối cảnh như Zalo, Padlet, LMS).
- 2.2. Chia sẻ (TC1: Chọn công nghệ phù hợp; TC2: Vận dụng chia sẻ, trích dẫn nguồn).
- 2.3. Trách nhiệm công dân (TC1: Tham gia dịch vụ số; TC2: Đề xuất dịch vụ số).
- 2.4. Hợp tác (TC1: Chọn công cụ hợp tác; TC2: Đồng sáng tạo sản phẩm).
- 2.5. Netiquette (TC1: Ứng xử phù hợp; TC2: Điều chỉnh chiến lược giao tiếp).

3. Sáng tạo nội dung số (III):
- 3.1. Phát triển nội dung (TC1: Tạo định dạng cơ bản Word/PPT; TC2: Tạo đa định dạng Video/Infographic/Podcast).
- 3.2. Tích hợp nội dung (TC1: Sửa đổi cơ bản; TC2: Tích hợp, tạo cái mới độc đáo).
- 3.3. Bản quyền (TC1: Phân biệt giấy phép; TC2: Áp dụng quy định bản quyền).
- 3.4. Lập trình (TC1: Viết lệnh đơn giản; TC2: Hiểu nguyên lý, viết chuỗi lệnh).

4. An toàn (IV): Bảo vệ thiết bị, dữ liệu cá nhân, sức khỏe và môi trường.
5. Giải quyết vấn đề (V):
- 5.1. Vấn đề kỹ thuật (TC1: Xử lý lỗi cơ bản; TC2: Phân tích nguyên nhân lỗi).
- 5.2. Nhu cầu công nghệ (TC1: Chọn công cụ phù hợp; TC2: Tùy chỉnh môi trường số, chọn giải pháp tối ưu).
- 5.3. Sáng tạo công nghệ (TC1: Tạo sản phẩm mới; TC2: Đổi mới quy trình, giải quyết tình huống thực tế).
- 5.4. Lỗ hổng năng lực (TC1: Tìm cơ hội học tập; TC2: Lập kế hoạch tự học).

6. Trí tuệ nhân tạo (VI): Hiểu biết, sử dụng có đạo đức và đánh giá công cụ AI.
`;

function getNextElement(node: Node | null): Element | null {
  let curr = node ? node.nextSibling : null;
  while (curr) {
    if (curr.nodeType === 1) return curr as Element;
    curr = curr.nextSibling;
  }
  return null;
}

export function isOldNlsOrAiHeading(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;

  // Old NLS Headings:
  // "2.3. Các NLS được phát triển:", "2.3. NLS được phát triển:", "2.3. Năng lực số:", "Năng lực số:", "2.3. NLS:", "Các NLS:", "Mục tiêu NLS:"
  if (/^(\d+(\.\d+)*\s*[\.:]?)?\s*(các\s+)?(nls|năng\s+lực\s+số)(\s+được\s+phát\s+triển)?\s*[:\.]?$/i.test(lower)) {
    return true;
  }
  if (lower.startsWith("mục tiêu nls") || lower.startsWith("mục tiêu năng lực số") || lower.startsWith("các nls")) {
    return true;
  }

  // Old AI Headings:
  // "2.4. Năng lực AI:", "2.3. Năng lực AI:", "Năng lực AI:", "Năng lực trí tuệ nhân tạo:", "Trí tuệ nhân tạo (AI):"
  if (/^(\d+(\.\d+)*\s*[\.:]?)?\s*(năng\s+lực\s+ai|trí\s+tuệ\s+nhân\s+tạo(\s*\(ai\))?|năng\s+lực\s+trí\s+tuệ\s+nhân\s+tạo)\s*[:\.]?$/i.test(lower)) {
    return true;
  }
  if (lower.startsWith("mục tiêu năng lực ai") || lower.startsWith("mục tiêu trí tuệ nhân tạo")) {
    return true;
  }

  return false;
}

export function isSectionBoundary(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;

  // Section 3: Phẩm chất (e.g., "3. Về phẩm chất:", "3. Phẩm chất:", "III. Phẩm chất:")
  if (/^\s*(3\.\s*(về\s*)?phẩm\s*chất|iii\.\s*(về\s*)?phẩm\s*chất|phẩm\s*chất\s*[:\.])/i.test(lower)) return true;
  if (/^\s*3\.\s+[A-ZĐ]/i.test(text.trim())) return true;

  // Section II: Thiết bị dạy học và học liệu
  if (/^\s*([ivx]+\.|ii\.)\s*(thiết\s*bị|chuẩn\s*bị|học\s*liệu)/i.test(lower)) return true;
  if (/^[ivx]+\.\s+[A-ZĐ]/i.test(text.trim())) return true;

  // Next top sections or activities
  if (/^\s*(iii\.|b\.)\s*(tiến\s*trình|hoạt\s*động)/i.test(lower)) return true;

  return false;
}

export function isAppendixOrSummaryHeading(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return (
    lower.includes("bảng tổng hợp mã năng lực số") ||
    lower.includes("bảng tổng hợp mã nls") ||
    lower.includes("bảng phân tích phát triển nls") ||
    lower.includes("bảng phân tích nls") ||
    lower.includes("bảng tổng hợp nls") ||
    lower.includes("bảng năng lực số") ||
    lower.includes("phụ lục: bảng tổng hợp") ||
    (lower.startsWith("phụ lục") && (lower.includes("nls") || lower.includes("năng lực số") || lower.includes("ai")))
  );
}

export function stripExistingNLSFromText(text: string): string {
  if (!text) return "";
  const lines = text.split('\n');
  const cleaned: string[] = [];
  let inOldNlsObjectives = false;
  let inOldAppendix = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    // Check if entered appendix or summary table at the end
    if (isAppendixOrSummaryHeading(trimmed)) {
      inOldAppendix = true;
      continue;
    }
    if (inOldAppendix) continue;

    // Check if entered old NLS/AI objectives header
    if (isOldNlsOrAiHeading(trimmed)) {
      inOldNlsObjectives = true;
      continue;
    }

    if (inOldNlsObjectives) {
      if (
        isSectionBoundary(trimmed) ||
        /^\s*2\.[12]\.\s*/i.test(lower) ||
        /^\s*năng\s+lực\s+(chung|đặc\s+thù|riêng)/i.test(lower)
      ) {
        inOldNlsObjectives = false;
      } else {
        continue;
      }
    }

    // Skip lines starting with or containing old NLS markers or codes
    if (
      lower.startsWith("học liệu số:") ||
      trimmed.startsWith("[NLS]") ||
      trimmed.startsWith("[AI]") ||
      /^\s*\d+\.\d+\.(tc|cb|nc)[a-z0-9]*\s*:/i.test(trimmed)
    ) {
      continue;
    }

    if (trimmed.includes("►") && (trimmed.includes("TC") || trimmed.includes("CB") || trimmed.includes("NC") || lower.includes("nls") || lower.includes("ai"))) {
      continue;
    }

    cleaned.push(line);
  }

  return cleaned.join('\n');
}

export async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export function createIntegrationTextPrompt(keHoachText: string, monHoc: string, khoiLop: string, appendixText?: string): string {
  const mucDoInfo = LEVEL_MAPPING[khoiLop];
  if (!mucDoInfo) throw new Error(`Chưa hỗ trợ ${khoiLop}`);

  const appendixInstruction = appendixText ? `\n\nNỘI DUNG PHỤ LỤC (Căn cứ bắt buộc - ưu tiên tuyệt đối):\n"""\n${appendixText.substring(0, 15000)}\n"""\nQUY TẮC BẮT BUỘC VỀ PHỤ LỤC & GIÁO ÁN CŨ:\n- Nếu giáo án gốc ĐÃ CÓ sẵn các mã NLS hoặc năng lực AI cũ: BẠN PHẢI BỎ QUA HOÀN TOÀN CÁC MÃ CŨ ĐÓ, KHÔNG giữ lại bất kỳ mã NLS/AI cũ nào.\n- BẮT BUỘC CHỈ CĂN CỨ VÀO PHỤ LỤC (Phụ lục 1 / Phụ lục 3): Xác định đúng bài học trong phụ lục để gán lại các mã NLS/AI mới theo phụ lục quy định.\n- Nếu bài học KHÔNG có trong phụ lục: để trống toàn bộ phần hoạt động, không tự bịa mã mới.\n- Nếu bài học CÓ trong phụ lục: PHẢI tích hợp TẤT CẢ các mã NLS/AI được quy định trong phụ lục, không bỏ sót mã nào, không tự bịa mã mới.` : `\n\nQUY TẮC VỀ GIÁO ÁN ĐÃ CÓ NLS/AI CŨ:\n- Nếu giáo án gốc đã có sẵn các mã NLS hoặc năng lực AI cũ: BỎ QUA HOÀN TOÀN các mã cũ đó và tạo lại chuẩn xác theo khung năng lực số quy định.`;

  const cleanKeHoachText = stripExistingNLSFromText(keHoachText);

  return `Bạn là Chuyên gia Sư phạm số. Nhiệm vụ: Tích hợp Năng lực số (NLS) và Năng lực AI vào giáo án ${monHoc} ${khoiLop}.

Cấp độ NLS: ${mucDoInfo.ten} (${mucDoInfo.kyHieu}). Đặc điểm: ${mucDoInfo.nhiemVu}.

KHUNG NLS THAM CHIẾU:
${KHUNG_NLS_CONTEXT}${appendixInstruction}

NỘI DUNG GIÁO ÁN GỐC (Đã làm sạch mã cũ):
"""
${cleanKeHoachText.substring(0, 30000)} 
"""

===== HƯỚNG DẪN TẠO ĐẦU RA =====

Phân tích toàn bộ giáo án và tích hợp NLS/AI vào TẤT CẢ các hoạt động phù hợp (không giới hạn số lượng).
Mọi nội dung NLS dán nhãn [NLS], Năng lực AI dán nhãn [AI].

===BAT_DAU_MUC_TIEU===
Liệt kê các mục tiêu NLS/AI cần thêm vào phần "Mục tiêu":
[NLS] Mã.Cấp: Mô tả mục tiêu cụ thể
[AI] Mô tả mục tiêu AI cụ thể
===KET_THUC_MUC_TIEU===

===BAT_DAU_HOC_LIEU===
Liệt kê thiết bị/học liệu số cần thêm:
[NLS] Tên thiết bị/phần mềm
[AI] Tên công cụ AI
===KET_THUC_HOC_LIEU===

===BAT_DAU_HOAT_DONG===
Với MỖI hoạt động trong giáo án có thể tích hợp NLS/AI, tạo 1 khối theo định dạng SAU (tuyệt đối KHÔNG viết từ ANCHOR hay CONTENT vào phần nội dung chèn):

NEO: (Chép nguyên văn 1 câu/cụm từ ngắn từ giáo án gốc để xác định vị trí - tối đa 10 từ)
TICH_HOP: ([NLS] hoặc [AI]) ► Mã.Cấp: Mô tả hành động cụ thể của HS/GV, tối đa 20 từ
---PHAN_CACH_HOAT_DONG---
NEO: (Câu/cụm từ từ giáo án cho hoạt động tiếp theo)
TICH_HOP: ([NLS] hoặc [AI]) ► Mã.Cấp: Mô tả...
===KET_THUC_HOAT_DONG===

===BAT_DAU_PHU_LUC===
| Mã NLS/AI | Yêu cầu cần đạt | Học sinh thực hiện |
|---|---|---|
| Mã | Mô tả yêu cầu | Hành động cụ thể |
===KET_THUC_PHU_LUC===
`;
}

export async function generateCompetencyIntegration(prompt: string, apiKey: string, aiModel: string = "gemini-3.6-flash"): Promise<GeneratedNLSContent> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: aiModel });

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return parseStructuredResponse(text);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(`Lỗi AI: ${error.message}`);
  }
}

function parseStructuredResponse(text: string): GeneratedNLSContent {
  const result: GeneratedNLSContent = {
    objectives_addition: "",
    materials_addition: "",
    activities_integration: [],
    appendix_table: ""
  };

  const objectivesMatch = text.match(/===BAT_DAU_MUC_TIEU===([\s\S]*?)===KET_THUC_MUC_TIEU===/);
  if (objectivesMatch) result.objectives_addition = objectivesMatch[1].trim();

  const materialsMatch = text.match(/===BAT_DAU_HOC_LIEU===([\s\S]*?)===KET_THUC_HOC_LIEU===/);
  if (materialsMatch) result.materials_addition = materialsMatch[1].trim();

  const appendixMatch = text.match(/===BAT_DAU_PHU_LUC===([\s\S]*?)===KET_THUC_PHU_LUC===/);
  if (appendixMatch) result.appendix_table = appendixMatch[1].trim();

  const activitiesBlockMatch = text.match(/===BAT_DAU_HOAT_DONG===([\s\S]*?)===KET_THUC_HOAT_DONG===/);
  if (activitiesBlockMatch) {
    const rawActivities = activitiesBlockMatch[1].split('---PHAN_CACH_HOAT_DONG---');
    rawActivities.forEach(block => {
      // Support both old format (ANCHOR/CONTENT) and new format (NEO/TICH_HOP)
      const anchorMatch = block.match(/(?:ANCHOR|NEO):\s*([\s\S]*?)(?=(?:CONTENT|TICH_HOP):|$)/);
      const contentMatch = block.match(/(?:CONTENT|TICH_HOP):\s*([\s\S]*?)$/);
      if (anchorMatch && contentMatch) {
        let content = contentMatch[1].trim();
        // Strip any leaked ANCHOR/CONTENT/NEO/TICH_HOP keywords from inside content
        content = content.replace(/\n?(ANCHOR|NEO|CONTENT|TICH_HOP):\s*/g, ' ').trim();
        
        let type: 'nls' | 'ai' = 'nls';
        if (content.toLowerCase().includes('[ai]')) {
            type = 'ai';
            content = content.replace(/^\[AI\]\s*/i, '');
        } else if (content.toLowerCase().includes('[nls]')) {
            type = 'nls';
            content = content.replace(/^\[NLS\]\s*/i, '');
        }

        const anchorText = anchorMatch[1].trim();
        // Only add if anchor text is non-empty and content is non-empty
        if (anchorText && content) {
          result.activities_integration.push({
            anchor_text: anchorText,
            content: content,
            type: type
          });
        }
      }
    });
  }

  return result;
}


export function removeExistingNLSFromDocx(xmlDoc: Document, log?: (msg: string) => void, addNlsColumn: boolean = true): void {
  const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  let cleanedCount = 0;

  // 1. Remove Old Appendix / Summary tables from body
  const body = xmlDoc.getElementsByTagNameNS(w, "body")[0];
  if (body) {
    const bodyChildren = Array.from(body.childNodes);
    let appendixFound = false;
    for (let i = 0; i < bodyChildren.length; i++) {
      const node = bodyChildren[i];
      const text = (node.textContent || "").trim();
      if (isAppendixOrSummaryHeading(text)) {
        appendixFound = true;
      }
      if (appendixFound) {
        body.removeChild(node);
        cleanedCount++;
      }
    }
  }

  // Also scan all tables for standalone NLS summary tables
  const allTables = Array.from(xmlDoc.getElementsByTagName("w:tbl"));
  allTables.forEach(table => {
    const trs = Array.from(table.getElementsByTagName("w:tr"));
    if (trs.length === 0) return;
    const headerText = (trs[0].textContent || "").toLowerCase();
    if (
      (headerText.includes("năng lực số") || headerText.includes("nls")) &&
      (headerText.includes("tổ chức dạy học") || headerText.includes("yêu cầu cần đạt") || headerText.includes("tên hoạt động") || headerText.includes("bảng phân tích"))
    ) {
      const prev = table.previousSibling;
      if (prev && prev.nodeType === 1 && isAppendixOrSummaryHeading(prev.textContent || "")) {
        prev.parentNode?.removeChild(prev);
        cleanedCount++;
      }
      table.parentNode?.removeChild(table);
      cleanedCount++;
    }
  });

  // 2. Remove Old NLS/AI from Objectives (Mục tiêu)
  const allParas = Array.from(xmlDoc.getElementsByTagName("w:p"));
  const parasToRemove: Element[] = [];

  for (let i = 0; i < allParas.length; i++) {
    const p = allParas[i];
    let isInsideTable = false;
    let parent = p.parentNode;
    while (parent && parent.nodeName !== "w:body") {
      if (parent.nodeName === "w:tbl") {
        isInsideTable = true;
        break;
      }
      parent = parent.parentNode;
    }
    if (isInsideTable) continue;

    const text = (p.textContent || "").trim();

    // Detect NLS / AI heading in Objectives:
    if (isOldNlsOrAiHeading(text)) {
      if (!parasToRemove.includes(p)) parasToRemove.push(p);

      let nextElem = getNextElement(p);
      while (nextElem && nextElem.nodeName === "w:p") {
        const nextText = (nextElem.textContent || "").trim();

        // Stop if we hit a boundary: next section header or another NLS/AI heading
        if (isSectionBoundary(nextText) || isOldNlsOrAiHeading(nextText)) {
          break;
        }

        if (!parasToRemove.includes(nextElem)) {
          parasToRemove.push(nextElem);
        }
        nextElem = getNextElement(nextElem);
      }
    }

    const lower = text.toLowerCase();
    if (
      lower.startsWith("học liệu số:") ||
      text.startsWith("[NLS]") ||
      text.startsWith("[AI]") ||
      /^\s*\d+\.\d+\.(tc|cb|nc)[a-z0-9]*\s*:/i.test(text)
    ) {
      if (!parasToRemove.includes(p)) parasToRemove.push(p);
    }
  }

  parasToRemove.forEach(p => {
    p.parentNode?.removeChild(p);
    cleanedCount++;
  });

  // 3. Remove Old Materials Additions ("Học liệu số: ...", etc.)
  const remainingParas = Array.from(xmlDoc.getElementsByTagName("w:p"));
  remainingParas.forEach(p => {
    let isInsideTable = false;
    let parent = p.parentNode;
    while (parent && parent.nodeName !== "w:body") {
      if (parent.nodeName === "w:tbl") {
        isInsideTable = true;
        break;
      }
      parent = parent.parentNode;
    }
    if (isInsideTable) return;

    const text = (p.textContent || "").trim();
    const lower = text.toLowerCase();
    if (
      lower.startsWith("học liệu số:") ||
      text.startsWith("[NLS]") ||
      text.startsWith("[AI]") ||
      /^\s*\d+\.\d+\.(tc|cb|nc)[a-z0-9]*\s*:/i.test(text)
    ) {
      p.parentNode?.removeChild(p);
      cleanedCount++;
    }
  });

  // 4. Remove Old NLS/AI from Activities (Tables and paragraphs)
  const activityTables = Array.from(xmlDoc.getElementsByTagName("w:tbl"));
  activityTables.forEach(table => {
    const trs = Array.from(table.getElementsByTagName("w:tr"));
    if (trs.length === 0) return;

    // Check if table has an NLS column in header row
    const firstRow = trs[0];
    const headerTcs = Array.from(firstRow.getElementsByTagName("w:tc"));
    let nlsColIndex = -1;
    for (let c = 0; c < headerTcs.length; c++) {
      const txt = (headerTcs[c].textContent || "").trim().toLowerCase();
      if (txt.includes("nls") || txt.includes("năng lực số")) {
        nlsColIndex = c;
        break;
      }
    }

    if (nlsColIndex !== -1) {
      if (addNlsColumn) {
        // Clear all data cells in that column
        for (let r = 1; r < trs.length; r++) {
          const rowTcs = Array.from(trs[r].getElementsByTagName("w:tc"));
          if (rowTcs.length > nlsColIndex) {
            const tc = rowTcs[nlsColIndex];
            const tcParas = Array.from(tc.getElementsByTagName("w:p"));
            tcParas.forEach((p, idx) => {
              if (idx === 0) {
                const ts = Array.from(p.getElementsByTagName("w:t"));
                ts.forEach(t => { t.textContent = ""; });
              } else {
                tc.removeChild(p);
              }
            });
            cleanedCount++;
          }
        }
      } else {
        // Remove the column completely
        const tblGrid = table.getElementsByTagName("w:tblGrid")[0];
        if (tblGrid) {
          const gridCols = Array.from(tblGrid.getElementsByTagName("w:gridCol"));
          if (gridCols.length > nlsColIndex) {
            gridCols[nlsColIndex].parentNode?.removeChild(gridCols[nlsColIndex]);
          }
        }
        trs.forEach(tr => {
          const tcs = Array.from(tr.getElementsByTagName("w:tc"));
          if (tcs.length > nlsColIndex) {
            tcs[nlsColIndex].parentNode?.removeChild(tcs[nlsColIndex]);
          }
        });
        cleanedCount++;
      }
    }

    // Also remove inline injected paragraphs from any other cells in the table
    trs.forEach(tr => {
      const tcs = Array.from(tr.getElementsByTagName("w:tc"));
      tcs.forEach((tc, cIdx) => {
        if (addNlsColumn && cIdx === nlsColIndex) return;
        const paras = Array.from(tc.getElementsByTagName("w:p"));
        paras.forEach(p => {
          const pText = (p.textContent || "").trim();
          const pLower = pText.toLowerCase();
          if (
            (pText.includes("►") && (pText.includes("TC") || pText.includes("CB") || pText.includes("NC") || pLower.includes("nls") || pLower.includes("ai"))) ||
            pText.startsWith("[NLS]") ||
            pText.startsWith("[AI]") ||
            /^\s*\d+\.\d+\.(tc|cb|nc)[a-z0-9]*\s*:/i.test(pText)
          ) {
            if (paras.length === 1) {
              const ts = Array.from(p.getElementsByTagName("w:t"));
              ts.forEach(t => { t.textContent = ""; });
            } else {
              tc.removeChild(p);
            }
            cleanedCount++;
          }
        });
      });
    });
  });

  // Paragraphs outside tables in body
  const allFinalParas = Array.from(xmlDoc.getElementsByTagName("w:p"));
  allFinalParas.forEach(p => {
    let isInsideTable = false;
    let parent = p.parentNode;
    while (parent && parent.nodeName !== "w:body") {
      if (parent.nodeName === "w:tbl") {
        isInsideTable = true;
        break;
      }
      parent = parent.parentNode;
    }
    if (isInsideTable) return;

    const text = (p.textContent || "").trim();
    const pLower = text.toLowerCase();
    if (
      (text.includes("►") && (text.includes("TC") || text.includes("CB") || text.includes("NC") || pLower.includes("nls") || pLower.includes("ai"))) ||
      text.startsWith("[NLS]") ||
      text.startsWith("[AI]") ||
      /^\s*\d+\.\d+\.(tc|cb|nc)[a-z0-9]*\s*:/i.test(text)
    ) {
      p.parentNode?.removeChild(p);
      cleanedCount++;
    }
  });

  if (cleanedCount > 0 && log) {
    log(`>> Đã phát hiện và xóa ${cleanedCount} mục mã NLS / AI cũ trong giáo án.`);
  }
}

export async function injectNLSIntoDocx(
  zip: JSZip, 
  nlsContent: GeneratedNLSContent, 
  log: (msg: string) => void, 
  columnMode: NlsColumnMode | boolean = 'col1'
): Promise<void> {
  const resolvedMode: NlsColumnMode = 
    typeof columnMode === 'boolean'
      ? (columnMode ? 'col3' : 'col1')
      : (columnMode || 'col1');
  const isAddCol3 = resolvedMode === 'col3';

  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) throw new Error("File word/document.xml không tồn tại.");

  if (log) {
    if (resolvedMode === 'col3') {
      log(">> Chế độ NLS: Tạo thêm Cột 3 riêng (Cột NLS / AI)");
    } else if (resolvedMode === 'col2') {
      log(">> Chế độ NLS: Tích hợp trực tiếp vào Cột 2 (Dự kiến sản phẩm)");
    } else {
      log(">> Chế độ NLS: Tích hợp trực tiếp vào Cột 1 (Hoạt động của GV & HS - Chuẩn CV 5512)");
    }
  }

  let docXmlStr = await docXmlFile.async("string");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXmlStr, "application/xml");
  const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

  // Clean old NLS/AI first before injecting fresh content
  removeExistingNLSFromDocx(xmlDoc, log, isAddCol3);

  const baseStyle = extractBaseStyles(xmlDoc);

  const getColorForText = (text: string) => {
      if (text.startsWith('[AI]')) return "FF0000"; // Red
      return "000000"; // Black for NLS
  };

  const cleanPrefix = (text: string) => text.replace(/^\[(NLS|AI)\]\s*/i, '');

  // 1. Insert Objectives
  if (nlsContent.objectives_addition) {
    const allParas = Array.from(xmlDoc.getElementsByTagName("w:p"));
    let objectivesPara: Element | null = null;
    for (let i = 0; i < allParas.length; i++) {
      const txt = (allParas[i].textContent || "").trim().toLowerCase();
      if (
        txt.includes("về năng lực") ||
        txt.includes("2. năng lực") ||
        txt === "năng lực:" ||
        txt === "năng lực" ||
        txt.match(/^2\.\s*năng\s+lực/i)
      ) {
        objectivesPara = allParas[i];
        break;
      }
    }

    if (objectivesPara) {
      const style = getParaStyle(objectivesPara);
      const font = style.font || baseStyle.font || "Times New Roman";
      const size = style.size || baseStyle.size || "28";

      const lines = nlsContent.objectives_addition.split('\n').filter(l => l.trim() !== '');
      const nlsLines = lines.filter(l => l.toUpperCase().includes('[NLS]'));
      const aiLines = lines.filter(l => l.toUpperCase().includes('[AI]'));

      // Find targetNode: boundary paragraph of section 2 (e.g. "3. Về phẩm chất:" or "II. Thiết bị dạy học")
      let targetNode: Element | null = null;
      const objIndex = allParas.indexOf(objectivesPara);
      if (objIndex !== -1) {
        for (let i = objIndex + 1; i < allParas.length; i++) {
          const txt = (allParas[i].textContent || "").trim();
          if (isSectionBoundary(txt)) {
            targetNode = allParas[i];
            break;
          }
        }
      }

      if (!targetNode) {
        // Fallback: search before first table or end of body
        const tables = Array.from(xmlDoc.getElementsByTagName("w:tbl"));
        if (tables.length > 0) {
          targetNode = tables[0];
        }
      }

      // Detect subheadings in Section 2
      let hasChung = false;
      let hasRieng = false;
      let chungHeadingPara: Element | null = null;
      let riengHeadingPara: Element | null = null;

      const searchEndIdx = targetNode ? allParas.indexOf(targetNode) : allParas.length;
      for (let i = objIndex + 1; i < searchEndIdx; i++) {
        const p = allParas[i];
        const txt = (p.textContent || "").trim();
        const lower = txt.toLowerCase();

        const isBullet = txt.startsWith('-') || txt.startsWith('+') || txt.startsWith('•') || txt.startsWith('*');

        if (lower.includes("năng lực chung") && !lower.includes("năng lực chung và")) {
          hasChung = true;
          chungHeadingPara = p;
        } else if (!isBullet) {
          if (
            lower.match(/^2\.2\.\s*năng\s+lực/i) ||
            lower.match(/^b\)\s*năng\s+lực/i) ||
            lower.match(/^năng\s+lực\s+(đặc\s+thù|riêng|chuyên\s+biệt|tin\s+học|toán|văn|ngữ\s+văn|khoa\s+học|vật\s+lí|hóa\s+học|sinh\s+học|lịch\s+sử|địa\s+l(í|ý)|tiếng\s+anh|công\s+nghệ|âm\s+nhạc|mĩ\s+thuật|thể\s+dục|gdcd|gdqp|hđtn)/i)
          ) {
            hasRieng = true;
            riengHeadingPara = p;
          }
        }
      }

      // Normalize 2.1. Năng lực chung:
      if (chungHeadingPara) {
        const cText = (chungHeadingPara.textContent || "").trim();
        if (cText.toLowerCase() === "năng lực chung" || cText.toLowerCase() === "năng lực chung:") {
          replaceParagraphText(chungHeadingPara, "2.1. Năng lực chung:");
        }
      }

      // Normalize 2.2. Năng lực ...:
      if (riengHeadingPara) {
        const rText = (riengHeadingPara.textContent || "").trim();
        if (!rText.startsWith("2.2.")) {
          const cleanHeading = rText.replace(/^[a-z0-9\.\)\-\:]+\s*/i, '').trim();
          replaceParagraphText(riengHeadingPara, `2.2. ${cleanHeading}`);
        }
      }

      let nlsHeaderTitle = "2.3. Năng lực số:";
      let aiHeaderTitle = "2.4. Năng lực AI:";

      if (!hasRieng) {
        nlsHeaderTitle = "2.2. Năng lực số:";
        aiHeaderTitle = "2.3. Năng lực AI:";
        if (!hasChung) {
          const existingChungRieng = allParas.find(p => (p.textContent || "").toLowerCase().includes("năng lực chung và riêng"));
          if (!existingChungRieng) {
            const chungRiengHeader = createParagraphNode(xmlDoc, "2.1. Năng lực chung và riêng:", true, "000000", font, size, false);
            objectivesPara.parentNode?.insertBefore(chungRiengHeader, objectivesPara.nextSibling);
          }
        }
      }

      // Insert NLS
      if (nlsLines.length > 0) {
        const nlsHeader = createParagraphNode(xmlDoc, nlsHeaderTitle, true, "000000", font, size, false);
        if (targetNode) {
          targetNode.parentNode?.insertBefore(nlsHeader, targetNode);
        } else {
          objectivesPara.parentNode?.appendChild(nlsHeader);
        }
        nlsLines.forEach(line => {
          const cleanedLine = cleanPrefix(line.trim()).replace(/^-/, '').trim();
          const newPara = createParagraphNode(xmlDoc, "- " + cleanedLine, false, "000000", font, size);
          if (targetNode) {
            targetNode.parentNode?.insertBefore(newPara, targetNode);
          } else {
            objectivesPara.parentNode?.appendChild(newPara);
          }
        });
      }

      // Insert AI
      if (aiLines.length > 0) {
        const aiHeader = createParagraphNode(xmlDoc, aiHeaderTitle, true, "FF0000", font, size, false);
        if (targetNode) {
          targetNode.parentNode?.insertBefore(aiHeader, targetNode);
        } else {
          objectivesPara.parentNode?.appendChild(aiHeader);
        }
        aiLines.forEach(line => {
          const cleanedLine = cleanPrefix(line.trim()).replace(/^-/, '').trim();
          const newPara = createParagraphNode(xmlDoc, "- " + cleanedLine, false, "FF0000", font, size);
          if (targetNode) {
            targetNode.parentNode?.insertBefore(newPara, targetNode);
          } else {
            objectivesPara.parentNode?.appendChild(newPara);
          }
        });
      }
    }
  }

  // 2. Insert Materials
  if (nlsContent.materials_addition) {
    const materialsPara = findParagraphByText(xmlDoc, ["Thiết bị dạy học", "Học liệu", "Chuẩn bị của giáo viên"]);
    if (materialsPara) {
      const style = getParaStyle(materialsPara);
      const font = style.font || baseStyle.font;
      const size = style.size || baseStyle.size;

      const lines = nlsContent.materials_addition.split('\n').reverse();
      lines.forEach((line, index) => {
        if (line.trim()) {
          const color = getColorForText(line.trim());
          const cleanedLine = cleanPrefix(line.trim());
          const prefix = index === lines.length - 1 ? "Học liệu số: " : "";
          const newPara = createParagraphNode(xmlDoc, prefix + cleanedLine, false, color, font, size);
          materialsPara.parentNode?.insertBefore(newPara, materialsPara.nextSibling);
        }
      });
    }
  }

  // 3. Insert Activities
  if (nlsContent.activities_integration.length > 0) {
    for (const item of nlsContent.activities_integration) {
      const anchorPara = findParagraphByFuzzyText(xmlDoc, item.anchor_text);
      if (anchorPara) {
        const style = getParaStyle(anchorPara);
        const font = style.font || baseStyle.font;
        const size = style.size || baseStyle.size;
        const color = item.type === 'ai' ? "FF0000" : "000000";
        // When inserting directly into column 1 or column 2, format with italics so it stands out nicely
        const isInline = resolvedMode !== 'col3';
        const newPara = createParagraphNode(xmlDoc, item.content, false, color, font, size, isInline);

        // Find parent row if inside a table
        let node: Node | null = anchorPara;
        let rowNode: Element | null = null;
        let tableNode: Element | null = null;
        while (node && node.nodeName !== "w:body") {
          if (node.nodeName === "w:tr") rowNode = node as Element;
          if (node.nodeName === "w:tbl") {
            tableNode = node as Element;
            break;
          }
          node = node.parentNode;
        }

        if (tableNode && rowNode) {
          // Check if table has NLS column by looking at the first row
          const trs = tableNode.getElementsByTagName("w:tr");
          if (trs.length > 0) {
            const firstRow = trs[0];
            const firstRowText = firstRow.textContent || "";
            let hasNlsCol = firstRowText.toLowerCase().includes("nls") || firstRowText.toLowerCase().includes("năng lực số");
            
            if (resolvedMode === 'col3') {
              // Add column if missing
              if (!hasNlsCol) {
                const tblGrid = tableNode.getElementsByTagName("w:tblGrid")[0];
                if (tblGrid) {
                  const newCol = xmlDoc.createElementNS(w, "w:gridCol");
                  newCol.setAttribute("w:w", "2500");
                  tblGrid.appendChild(newCol);
                }
                for (let i = 0; i < trs.length; i++) {
                  const tr = trs[i];
                  const newTc = xmlDoc.createElementNS(w, "w:tc");
                  const tcPr = xmlDoc.createElementNS(w, "w:tcPr");
                  const tcW = xmlDoc.createElementNS(w, "w:tcW");
                  tcW.setAttribute("w:w", "2500");
                  tcW.setAttribute("w:type", "dxa");
                  tcPr.appendChild(tcW);
                  newTc.appendChild(tcPr);
                  if (i === 0) {
                    const shd = xmlDoc.createElementNS(w, "w:shd");
                    shd.setAttribute("w:val", "clear");
                    shd.setAttribute("w:color", "auto");
                    shd.setAttribute("w:fill", "FFF2CC");
                    tcPr.appendChild(shd);
                    newTc.appendChild(createParagraphNode(xmlDoc, "NLS / AI", true, "000000", "Times New Roman", "26"));
                  } else {
                    newTc.appendChild(createParagraphNode(xmlDoc, "", false, "000000", "Times New Roman", "26"));
                  }
                  tr.appendChild(newTc);
                }
                hasNlsCol = true;
              }

              // Append content to the last cell of the current row (Column 3)
              const tcs = rowNode.getElementsByTagName("w:tc");
              if (tcs.length > 0) {
                const lastTc = tcs[tcs.length - 1];
                const existingParas = Array.from(lastTc.getElementsByTagName("w:p"));
                if (existingParas.length === 1 && (existingParas[0].textContent || "").trim() === "") {
                  lastTc.removeChild(existingParas[0]);
                }
                lastTc.appendChild(newPara);
              }
            } else {
              // Direct insertion into existing column: 'col1' (default) or 'col2'
              const tcs = Array.from(rowNode.getElementsByTagName("w:tc"));
              if (tcs.length > 0) {
                let targetTc: Element;
                if (resolvedMode === 'col2') {
                  // Column 2 (or last cell if < 2)
                  targetTc = tcs.length >= 2 ? tcs[1] : tcs[0];
                } else {
                  // Column 1 (first cell: Hoạt động của GV & HS)
                  targetTc = tcs[0];
                }

                const existingParas = Array.from(targetTc.getElementsByTagName("w:p"));
                if (existingParas.length === 1 && (existingParas[0].textContent || "").trim() === "") {
                  targetTc.removeChild(existingParas[0]);
                }

                // Check if anchorPara is inside targetTc
                let isAnchorInTargetTc = false;
                let checkNode: Node | null = anchorPara;
                while (checkNode && checkNode !== rowNode) {
                  if (checkNode === targetTc) {
                    isAnchorInTargetTc = true;
                    break;
                  }
                  checkNode = checkNode.parentNode;
                }

                if (isAnchorInTargetTc) {
                  if (anchorPara.parentNode === targetTc) {
                    targetTc.insertBefore(newPara, anchorPara.nextSibling);
                  } else {
                    let directChild: Node = anchorPara;
                    while (directChild.parentNode && directChild.parentNode !== targetTc) {
                      directChild = directChild.parentNode;
                    }
                    targetTc.insertBefore(newPara, directChild.nextSibling);
                  }
                } else {
                  // If anchorPara was in another column, append to targetTc
                  targetTc.appendChild(newPara);
                }
              }
            }
          }
        } else {
          // If not in a table, just insert before the anchor
          anchorPara.parentNode?.insertBefore(newPara, anchorPara.nextSibling);
        }
      }
    }
  }

  // 4. Append Appendix Table
  const body = xmlDoc.getElementsByTagNameNS(w, "body")[0];
  if (body) {
    const headerPara = createParagraphNode(xmlDoc, "PHỤ LỤC: BẢNG TỔNG HỢP MÃ NĂNG LỰC SỐ", true, "000000", baseStyle.font, baseStyle.size);
    body.appendChild(headerPara);
    const lines = nlsContent.appendix_table.split('\n');
    lines.forEach(line => {
      if (line.trim()) body.appendChild(createParagraphNode(xmlDoc, line, false, "000000", baseStyle.font, baseStyle.size));
    });
  }

  const serializer = new XMLSerializer();
  const newDocXmlStr = serializer.serializeToString(xmlDoc);
  zip.file("word/document.xml", newDocXmlStr);
}

function findParagraphByText(xmlDoc: Document, searchPhrases: string[]): Element | null {
  const paragraphs = xmlDoc.getElementsByTagName("w:p");
  for (let i = 0; i < paragraphs.length; i++) {
    const textContent = paragraphs[i].textContent || "";
    for (const phrase of searchPhrases) {
      if (textContent.toLowerCase().includes(phrase.toLowerCase())) return paragraphs[i];
    }
  }
  return null;
}

function findParagraphByFuzzyText(xmlDoc: Document, anchor: string): Element | null {
  const paragraphs = xmlDoc.getElementsByTagName("w:p");
  const cleanAnchor = anchor.trim().toLowerCase().substring(0, 30);
  for (let i = 0; i < paragraphs.length; i++) {
    if ((paragraphs[i].textContent || "").trim().toLowerCase().includes(cleanAnchor)) return paragraphs[i];
  }
  return null;
}

function createParagraphNode(
  xmlDoc: Document, 
  text: string, 
  isBold: boolean = false, 
  colorHex: string = "000000",
  font?: string,
  size?: string,
  isItalic: boolean = false
): Element {
  const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const p = xmlDoc.createElementNS(w, "w:p");
  const r = xmlDoc.createElementNS(w, "w:r");
  const rPr = xmlDoc.createElementNS(w, "w:rPr");
  
  if (isBold) rPr.appendChild(xmlDoc.createElementNS(w, "w:b"));
  if (isItalic) {
    rPr.appendChild(xmlDoc.createElementNS(w, "w:i"));
    rPr.appendChild(xmlDoc.createElementNS(w, "w:iCs"));
  }
  
  const color = xmlDoc.createElementNS(w, "w:color");
  color.setAttribute("w:val", colorHex);
  rPr.appendChild(color);

  if (font) {
    const rFonts = xmlDoc.createElementNS(w, "w:rFonts");
    rFonts.setAttribute("w:ascii", font);
    rFonts.setAttribute("w:hAnsi", font);
    rFonts.setAttribute("w:cs", font);
    rPr.appendChild(rFonts);
  }

  if (size) {
    const sz = xmlDoc.createElementNS(w, "w:sz");
    sz.setAttribute("w:val", size);
    rPr.appendChild(sz);
    
    const szCs = xmlDoc.createElementNS(w, "w:szCs");
    szCs.setAttribute("w:val", size);
    rPr.appendChild(szCs);
  }

  const t = xmlDoc.createElementNS(w, "w:t");
  t.setAttribute("xml:space", "preserve");
  t.textContent = text;
  r.appendChild(rPr);
  r.appendChild(t);
  p.appendChild(r);
  return p;
}

export function getParaStyle(para: Element | null): { font?: string, size?: string } {
  if (!para) return {};
  const runs = para.getElementsByTagName("w:r");
  for (let i = 0; i < runs.length; i++) {
    const rPr = runs[i].getElementsByTagName("w:rPr")[0];
    if (rPr) {
      const rFonts = rPr.getElementsByTagName("w:rFonts")[0];
      const sz = rPr.getElementsByTagName("w:sz")[0];
      const font = rFonts?.getAttribute("w:ascii");
      const size = sz?.getAttribute("w:val");
      if (font || size) return { font: font || undefined, size: size || undefined };
    }
  }
  const pPr = para.getElementsByTagName("w:pPr")[0];
  if (pPr) {
    const rPr = pPr.getElementsByTagName("w:rPr")[0];
    if (rPr) {
      const rFonts = rPr.getElementsByTagName("w:rFonts")[0];
      const sz = rPr.getElementsByTagName("w:sz")[0];
      const font = rFonts?.getAttribute("w:ascii");
      const size = sz?.getAttribute("w:val");
      if (font || size) return { font: font || undefined, size: size || undefined };
    }
  }
  return {};
}

export function extractBaseStyles(xmlDoc: Document): { font?: string, size?: string } {
  const paragraphs = xmlDoc.getElementsByTagName("w:p");
  for (let i = 0; i < Math.min(paragraphs.length, 50); i++) {
    const style = getParaStyle(paragraphs[i]);
    if (style.font && style.size) return style;
  }
  return { font: "Times New Roman", size: "26" };
}

function replaceParagraphText(para: Element, newText: string) {
  const ts = para.getElementsByTagName("w:t");
  if (ts.length > 0) {
    ts[0].textContent = newText;
    for (let j = 1; j < ts.length; j++) {
      ts[j].textContent = "";
    }
  }
}
