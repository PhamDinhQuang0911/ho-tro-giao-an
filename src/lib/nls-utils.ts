import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";
import JSZip from "jszip";
import { GradeType, GeneratedNLSContent, NLSProcessingOptions } from "../types";

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

export async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export function createIntegrationTextPrompt(keHoachText: string, monHoc: string, khoiLop: string, appendixText?: string): string {
  const mucDoInfo = LEVEL_MAPPING[khoiLop];
  if (!mucDoInfo) throw new Error(`Chưa hỗ trợ ${khoiLop}`);

  const appendixInstruction = appendixText ? `\n\nNỘI DUNG PHỤ LỤC (Căn cứ bắt buộc - ưu tiên tuyệt đối):\n"""\n${appendixText.substring(0, 15000)}\n"""\nQUY TẮC VỀ PHỤ LỤC:\n- Nếu bài học KHÔNG có trong phụ lục: để trống toàn bộ phần hoạt động.\n- Nếu bài học CÓ trong phụ lục: PHẢI tích hợp TẤT CẢ các mã NLS/AI được quy định, không bỏ sót mã nào, không tự bịa mã mới.` : '';

  return `Bạn là Chuyên gia Sư phạm số. Nhiệm vụ: Tích hợp Năng lực số (NLS) và Năng lực AI vào giáo án ${monHoc} ${khoiLop}.

Cấp độ NLS: ${mucDoInfo.ten} (${mucDoInfo.kyHieu}). Đặc điểm: ${mucDoInfo.nhiemVu}.

KHUNG NLS THAM CHIẾU:
${KHUNG_NLS_CONTEXT}${appendixInstruction}

NỘI DUNG GIÁO ÁN GỐC:
"""
${keHoachText.substring(0, 30000)} 
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


export async function injectNLSIntoDocx(zip: JSZip, nlsContent: GeneratedNLSContent, log: (msg: string) => void, addNlsColumn: boolean = true): Promise<void> {
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) throw new Error("File word/document.xml không tồn tại.");

  let docXmlStr = await docXmlFile.async("string");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXmlStr, "application/xml");
  const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

  const baseStyle = extractBaseStyles(xmlDoc);

  const getColorForText = (text: string) => {
      if (text.startsWith('[AI]')) return "FF0000"; // Red
      return "000000"; // Black for NLS
  };

  const cleanPrefix = (text: string) => text.replace(/^\[(NLS|AI)\]\s*/i, '');

  // 1. Insert Objectives
  if (nlsContent.objectives_addition) {
    const objectivesPara = findParagraphByText(xmlDoc, ["Về năng lực", "Năng lực:", "2. Năng lực", "Năng lực đặc thù", "Năng lực riêng"]);
    if (objectivesPara) {
      const style = getParaStyle(objectivesPara);
      const font = style.font || baseStyle.font;
      const size = style.size || baseStyle.size;
      
      const lines = nlsContent.objectives_addition.split('\n').filter(l => l.trim() !== '');
      const nlsLines = lines.filter(l => l.toUpperCase().includes('[NLS]'));
      const aiLines = lines.filter(l => l.toUpperCase().includes('[AI]'));
      
      let targetNode: Element | null = null;
      const allParas = Array.from(xmlDoc.getElementsByTagName("w:p"));
      const objIndex = allParas.indexOf(objectivesPara);
      if (objIndex !== -1) {
          for (let i = objIndex + 1; i < allParas.length; i++) {
              const txt = (allParas[i].textContent || "").trim().toLowerCase();
              if (txt.includes("thiết bị") || txt.includes("học liệu") || txt.includes("phẩm chất") || txt.match(/^[ivx]+\./) || txt.match(/^3\./)) {
                  targetNode = allParas[i];
                  break;
              }
          }
      }
      
      let hasChung = false;
      let hasRieng = false;
      
      // Rename existing paragraphs if they match exactly
      for (let i = 0; i < allParas.length; i++) {
        const textContent = (allParas[i].textContent || "").trim().toLowerCase();
        if (textContent === "năng lực chung" || textContent === "năng lực chung:") {
           replaceParagraphText(allParas[i], "2.1. Năng lực chung:");
           hasChung = true;
        } else if (textContent === "năng lực riêng" || textContent === "năng lực riêng:" || textContent === "năng lực đặc thù" || textContent === "năng lực đặc thù:") {
           replaceParagraphText(allParas[i], "2.2. Năng lực riêng:");
           hasRieng = true;
        }
      }

      let nlsHeaderTitle = "2.3. Năng lực số:";
      let aiHeaderTitle = "2.4. Năng lực AI:";
      
      if (!hasChung && !hasRieng) {
          nlsHeaderTitle = "2.2. Năng lực số:";
          aiHeaderTitle = "2.3. Năng lực AI:";
          const chungRiengHeader = createParagraphNode(xmlDoc, "2.1. Năng lực chung và riêng:", true, "000000", "Times New Roman", "26", true);
          objectivesPara.parentNode?.insertBefore(chungRiengHeader, objectivesPara.nextSibling);
      }
      
      if (nlsLines.length > 0) {
          const nlsHeader = createParagraphNode(xmlDoc, nlsHeaderTitle, true, "FF0000", "Times New Roman", "26", true);
          if (targetNode) targetNode.parentNode?.insertBefore(nlsHeader, targetNode);
          nlsLines.forEach(line => {
              const cleanedLine = cleanPrefix(line.trim()).replace(/^-/, '').trim();
              const newPara = createParagraphNode(xmlDoc, "- " + cleanedLine, false, "000000", "Times New Roman", "26");
              if (targetNode) targetNode.parentNode?.insertBefore(newPara, targetNode);
          });
      }
      
      if (aiLines.length > 0) {
          const aiHeader = createParagraphNode(xmlDoc, aiHeaderTitle, true, "FF0000", "Times New Roman", "26", true);
          if (targetNode) targetNode.parentNode?.insertBefore(aiHeader, targetNode);
          aiLines.forEach(line => {
              const cleanedLine = cleanPrefix(line.trim()).replace(/^-/, '').trim();
              const newPara = createParagraphNode(xmlDoc, "- " + cleanedLine, false, "FF0000", "Times New Roman", "26");
              if (targetNode) targetNode.parentNode?.insertBefore(newPara, targetNode);
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
        const newPara = createParagraphNode(xmlDoc, item.content, false, color, font, size);

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
            
            if (addNlsColumn) {
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

              // Append content to the last cell of the current row
              const tcs = rowNode.getElementsByTagName("w:tc");
              if (tcs.length > 0) {
                const lastTc = tcs[tcs.length - 1];
                lastTc.appendChild(newPara);
              }
            } else {
              // Insert directly into the 2nd cell (or the last cell if there are < 2 cells)
              const tcs = rowNode.getElementsByTagName("w:tc");
              if (tcs.length > 0) {
                const targetTc = tcs.length >= 2 ? tcs[1] : tcs[0];
                targetTc.appendChild(newPara);
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
