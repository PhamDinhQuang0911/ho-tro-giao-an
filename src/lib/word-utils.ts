import JSZip from 'jszip';
import { format, addDays, startOfWeek } from 'date-fns';
import { GeneratedNLSContent, NLSProcessingOptions, ReflectionSettings, NlsColumnMode } from '../types';
import { extractTextFromDocx, createIntegrationTextPrompt, generateCompetencyIntegration, injectNLSIntoDocx, extractBaseStyles } from './nls-utils';

export interface ScheduleItem {
  id: string;
  dayOfWeek: number; // 0 (Sun) to 6 (Sat)
  subject: string;
  className: string;
  period?: string;
}

export interface HeaderFooterSettings {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
}

export interface ProcessingOptions {
  weekNumber: string;
  periodNumber: string;
  prepDate: Date;
  schedule: ScheduleItem[];
  subject: string;
  lessonCount: number;
  createScheduleTable?: boolean;
  classOffsets: Record<string, number>;
  headerFooter?: HeaderFooterSettings;
  nlsOptions?: NlsOptions;
  reflection?: ReflectionSettings;
  weekOffset?: number;
  mergePeriods?: boolean;
}

interface NlsOptions extends NLSProcessingOptions {
  apiKey: string;
  addNlsColumn?: boolean;
  nlsColumnMode?: NlsColumnMode;
}

/**
 * Generates the XML for the lesson plan header table.
 */
function generateHeaderXml(options: ProcessingOptions, style: { font?: string, size?: string }) {
  const { weekNumber, periodNumber, prepDate, schedule, subject, lessonCount, classOffsets, weekOffset } = options;
  const formattedPrepDate = format(prepDate, 'dd/MM/yyyy');

  const fontXml = style.font ? `<w:rFonts w:ascii="${style.font}" w:hAnsi="${style.font}" w:cs="${style.font}"/>` : '';
  const sizeXml = style.size ? `<w:sz w:val="${style.size}"/><w:szCs w:val="${style.size}"/>` : '<w:sz w:val="28"/><w:szCs w:val="28"/>';

  // Calculate teaching dates
  const weekOffsetVal = weekOffset || 1;
  const startOfTargetWeek = addDays(startOfWeek(prepDate, { weekStartsOn: 1 }), 7 * weekOffsetVal);
  const weeksToCalculate = 4; // Look ahead 4 weeks to handle delays
  
  const allAvailableSessionsByClass: Record<string, any[]> = {};

  const isSubjectMatch = (sSub: string, targetSub: string) => {
    if (!sSub || !targetSub) return false;
    const a = sSub.trim().toLowerCase();
    const b = targetSub.trim().toLowerCase();
    return a === b || a.startsWith(b) || b.startsWith(a);
  };

  const getSessionsForWeek = (weekStart: Date, weekOffsetIdx: number) => {
    const currentWeekNum = (parseInt(weekNumber) || 0) + weekOffsetIdx;
    return schedule
      .filter(s => isSubjectMatch(s.subject, subject))
      .sort((a, b) => {
        const dayA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
        const dayB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
        if (dayA !== dayB) return dayA - dayB;
        return (a.period || '').localeCompare(b.period || '');
      })
      .map(s => {
        const date = addDays(weekStart, s.dayOfWeek === 0 ? 6 : s.dayOfWeek - 1);
        return { 
          className: s.className, 
          date: format(date, 'dd/MM/yyyy'), 
          rawDate: date,
          period: s.period,
          weekNum: currentWeekNum.toString()
        };
      });
  };

  let classes = Array.from(new Set(schedule
    .filter(s => isSubjectMatch(s.subject, subject))
    .map(s => s.className)
  ));
  if (classes.length === 0 && schedule.length > 0) {
    classes = Array.from(new Set(schedule.map(s => s.className)));
  }

  classes.forEach(className => {
    let classSessions: any[] = [];
    for (let i = 0; i < weeksToCalculate; i++) {
      const weekStart = addDays(startOfTargetWeek, i * 7);
      const sessions = getSessionsForWeek(weekStart, i);
      classSessions = [...classSessions, ...sessions.filter(s => s.className === className)];
    }
    allAvailableSessionsByClass[className] = classSessions;
  });

  let earliestTeachingDate: Date | null = null;

  const teachingSessions = classes.map(className => {
    const allAvailableSessions = allAvailableSessionsByClass[className] || [];
    
    // Use per-class offset or default to 1
    const startSessionIndex = classOffsets[className] || 1;
    const startIndex = startSessionIndex - 1;
    const selectedSessions = allAvailableSessions.slice(startIndex, startIndex + lessonCount);

    // Track earliest date
    selectedSessions.forEach(s => {
      if (!earliestTeachingDate || s.rawDate < earliestTeachingDate) {
        earliestTeachingDate = s.rawDate;
      }
    });

    // Calculate weeks involved for this class
    const weeksInvolved = new Set<string>();
    selectedSessions.forEach(s => {
      weeksInvolved.add(s.weekNum);
    });

    const dateToPeriods: Record<string, string[]> = {};
    selectedSessions.forEach(s => {
      if (!dateToPeriods[s.date]) dateToPeriods[s.date] = [];
      if (s.period) dateToPeriods[s.date].push(s.period);
    });

    const displayDates = Object.entries(dateToPeriods).map(([date, periods]) => {
      if (periods.length > 1) {
        // Multiple sessions of THIS lesson plan on this day
        return `${date} (${periods.join(', ')})`;
      }
      // Only one session of this lesson plan on this day, just show the date
      return date;
    });

    return { className, dates: displayDates.join(', ') || 'N/A', weeksInvolved };
  });

  // Calculate global week display
  const allWeeks = new Set<string>();
  teachingSessions.forEach(s => s.weeksInvolved.forEach(w => allWeeks.add(w)));
  const sortedWeeks = Array.from(allWeeks).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
  const weekDisplay = sortedWeeks.join(', ');

  // Calculate global period display
  const startPeriod = parseInt(periodNumber) || 0;
  const periodDisplay = lessonCount > 1 
    ? `${startPeriod} - ${startPeriod + lessonCount - 1}`
    : periodNumber;

  // Combine teaching dates
  let teachingDateText = '………………';
  const hasMultipleClasses = teachingSessions.length > 1;
  const dates = teachingSessions.filter(s => s.dates !== 'N/A').map(s => hasMultipleClasses ? `${s.className}: ${s.dates}` : s.dates).join(', ');
  if (dates) {
      teachingDateText = dates;
  }

  // Word XML for the header matching the user's sample
  let xml = `
    <w:tbl>
      <w:tblPr>
        <w:tblStyle w:val="TableGrid"/>
        <w:tblW w:w="0" w:type="auto"/>
        <w:jc w:val="center"/>
        <w:tblBorders>
          <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        </w:tblBorders>
      </w:tblPr>
      
    </w:tbl>
    <w:p><w:r><w:br w:type="textWrapping"/></w:r></w:p>
  `;
  
  // Append schedule table or inline text based on createScheduleTable option
  if (options.createScheduleTable !== false) {
    // Default: show detailed table
    const scheduleTableXml = generateScheduleTableXml(options, style);
    xml += scheduleTableXml;
  } else {
    // Simple inline text: Tiết X. Ngày dạy: ...
    const allDates = teachingSessions
      .flatMap(s => s.dates !== 'N/A' ? s.dates.split(', ') : []);
    const uniqueDates = Array.from(new Set(allDates)).join(', ');
    const startPeriodNum = parseInt(periodNumber) || 0;
    const periodText = lessonCount > 1
      ? 'Tiết ' + startPeriodNum + ' - ' + (startPeriodNum + lessonCount - 1) + '.'
      : 'Tiết ' + startPeriodNum + '.';
    xml = '<w:p><w:pPr><w:tabs><w:tab w:val="right" w:leader="none" w:pos="9360"/></w:tabs></w:pPr>'
        + '<w:r><w:rPr><w:b/>' + fontXml + sizeXml + '<w:color w:val="0070C0"/></w:rPr>'
        + '<w:t xml:space="preserve">' + periodText + '   </w:t></w:r>'
        + '<w:r><w:rPr><w:b/>' + fontXml + sizeXml + '<w:color w:val="0070C0"/></w:rPr>'
        + '<w:tab/><w:t>Ngày dạy: ' + uniqueDates + '</w:t></w:r></w:p>'
        + '<w:p><w:r><w:br w:type="textWrapping"/></w:r></w:p>';
  }

  return { xml, earliestTeachingDate };
}

function generateReflectionXml(
  settings: ReflectionSettings, 
  style: { font?: string, size?: string }, 
  earliestTeachingDate: Date | null,
  fallbackPrepDate?: Date,
  weekOffset?: number
) {
  if (!settings.enabled) return '';

  const showReflection = settings.showReflection !== false;  // default true
  const showSigningDate = settings.showSigningDate !== false; // default true

  const fontXml = style.font ? `<w:rFonts w:ascii="${style.font}" w:hAnsi="${style.font}" w:cs="${style.font}"/>` : '';
  const sizeXml = style.size ? `<w:sz w:val="${style.size}"/><w:szCs w:val="${style.size}"/>` : '<w:sz w:val="28"/><w:szCs w:val="28"/>';
  const smallSizeXml = style.size ? `<w:sz w:val="${Math.max(20, parseInt(style.size) - 4)}"/><w:szCs w:val="${Math.max(20, parseInt(style.size) - 4)}"/>` : '<w:sz w:val="24"/><w:szCs w:val="24"/>';

  let signingDateStr = `ngày ...... tháng ...... năm ${settings.year || '2026'}`;
  
  const mode = settings.signingDateMode || 
    (settings.autoSigningDate === false 
      ? (settings.customSigningDate ? 'custom' : 'blank') 
      : 'auto');

  if (mode === 'custom' && settings.customSigningDate) {
    try {
      const parts = settings.customSigningDate.split('-');
      let d: Date;
      if (parts.length === 3) {
        d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else {
        d = new Date(settings.customSigningDate);
      }
      if (!isNaN(d.getTime())) {
        signingDateStr = `ngày ${format(d, 'dd')} tháng ${format(d, 'MM')} năm ${format(d, 'yyyy')}`;
      }
    } catch (e) {
      console.error('Failed to parse customSigningDate', e);
    }
  } else if (mode === 'auto') {
    let targetDate = earliestTeachingDate;
    if (!targetDate && fallbackPrepDate) {
      const offset = weekOffset || 1;
      const startOfTargetWeek = addDays(startOfWeek(fallbackPrepDate, { weekStartsOn: 1 }), 7 * offset);
      targetDate = startOfTargetWeek;
    } else if (!targetDate) {
      const startOfTargetWeek = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7);
      targetDate = startOfTargetWeek;
    }

    if (targetDate) {
      const startOfTeachingWeek = startOfWeek(targetDate, { weekStartsOn: 1 });
      const signingDate = addDays(startOfTeachingWeek, -2);
      signingDateStr = `ngày ${format(signingDate, 'dd')} tháng ${format(signingDate, 'MM')} năm ${format(signingDate, 'yyyy')}`;
    }
  }

  // Build reflection content lines
  const dotLine = "..........................................................................................";
  let reflectionXml = '';
  if (showReflection) {
    let linesXml = '';
    for (let i = 0; i < settings.contentLines; i++) {
      linesXml += `
      <w:p>
        <w:pPr><w:jc w:val="both"/></w:pPr>
        <w:r>${fontXml}${sizeXml}<w:t>${dotLine}</w:t></w:r>
      </w:p>`;
    }
    reflectionXml = `
    <w:p><w:pPr><w:jc w:val="both"/></w:pPr></w:p>
    <w:p>
      <w:pPr><w:jc w:val="left"/></w:pPr>
      <w:r>
        <w:rPr><w:b/>${fontXml}${sizeXml}</w:rPr>
        <w:t>${settings.title.toUpperCase()}</w:t>
      </w:r>
    </w:p>
    ${linesXml}`;
  }

  // Build 2-column signature table
  const loc = settings.location || 'Đường Hào';
  const teacher = settings.teacherName || 'Nguyễn Thị A';
  const approverTitleStr = settings.approverTitle === 'TỔ TRƯỞNG KÝ DUYỆT' ? 'Tổ trưởng' : 'Tổ phó';
  const titleLine = settings.approverTitle === 'TỔ TRƯỞNG KÝ DUYỆT' ? 'Tổ trưởng' : 'Tổ phó';
  const dateLine = showSigningDate ? `${loc}, ${signingDateStr}` : '';


  let cx = 1500000; // ~4.1 cm default width
  let cy = 750000;  // ~2.0 cm default height
  if (settings.signatureImage) {
    try {
      const clean = settings.signatureImage.replace(/^data:image\/\w+;base64,/, '');
      const binary = atob(clean.slice(0, 50));
      if (binary.length >= 24) {
        const width = ((binary.charCodeAt(16) << 24) |
                      (binary.charCodeAt(17) << 16) |
                      (binary.charCodeAt(18) << 8) |
                      binary.charCodeAt(19)) >>> 0;
        const height = ((binary.charCodeAt(20) << 24) |
                       (binary.charCodeAt(21) << 16) |
                       (binary.charCodeAt(22) << 8) |
                       binary.charCodeAt(23)) >>> 0;
        if (width > 0 && height > 0) {
          const ratio = width / height;
          const maxW = 1500000;
          const maxH = 750000;
          if (ratio >= maxW / maxH) {
            cx = maxW;
            cy = Math.round(maxW / ratio);
          } else {
            cy = maxH;
            cx = Math.round(maxH * ratio);
          }
        }
      }
    } catch (e) {}
  }

  let signatureDrawing = `
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p>
  `;

  if (settings.signatureImage) {
    signatureDrawing = `
      <w:p>
        <w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="60"/></w:pPr>
        <w:r>
          <w:drawing>
            <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
              <wp:extent cx="${cx}" cy="${cy}"/>
              <wp:effectExtent l="0" t="0" r="0" b="0"/>
              <wp:docPr id="99999" name="Signature"/>
              <wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>
              <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                    <pic:nvPicPr>
                      <pic:cNvPr id="99999" name="signature.png"/>
                      <pic:cNvPicPr/>
                    </pic:nvPicPr>
                    <pic:blipFill>
                      <a:blip r:embed="rIdSig" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                      <a:stretch><a:fillRect/></a:stretch>
                    </pic:blipFill>
                    <pic:spPr>
                      <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                    </pic:spPr>
                  </pic:pic>
                </a:graphicData>
              </a:graphic>
            </wp:inline>
          </w:drawing>
        </w:r>
      </w:p>
    `;
  }

  const dateSpacer = dateLine ? `
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:i/>${fontXml}${smallSizeXml}</w:rPr><w:t></w:t></w:r>
    </w:p>
  ` : '';

  const signatureTableXml = `
    <w:p><w:pPr><w:jc w:val="both"/></w:pPr></w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:jc w:val="center"/>
        <w:tblBorders>
          <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        </w:tblBorders>
        <w:tblLayout w:type="fixed"/>
      </w:tblPr>
      <w:tblGrid>
        <w:gridCol w:w="4800"/>
        <w:gridCol w:w="4800"/>
      </w:tblGrid>

      <!-- HÀNG 1: TIÊU ĐỀ KÝ DUYỆT -->
      <w:tr>
        <!-- Cột trái: Phê duyệt -->
        <w:tc>
          <w:tcPr><w:tcW w:w="2500" w:type="pct"/><w:vAlign w:val="top"/></w:tcPr>
          ${dateLine ? `
          <w:p>
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:i/>${fontXml}${smallSizeXml}</w:rPr>
              <w:t>${dateLine}</w:t>
            </w:r>
          </w:p>` : ''}
          <w:p>
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr>${fontXml}${smallSizeXml}</w:rPr>
              <w:t>TM tổ chuyên môn phê duyệt</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr>${fontXml}${smallSizeXml}</w:rPr>
              <w:t>${titleLine}</w:t>
            </w:r>
          </w:p>
        </w:tc>

        <!-- Cột phải: Giáo viên thực hiện -->
        <w:tc>
          <w:tcPr><w:tcW w:w="2500" w:type="pct"/><w:vAlign w:val="top"/></w:tcPr>
          ${dateSpacer}
          <w:p>
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr><w:b/>${fontXml}${smallSizeXml}</w:rPr>
              <w:t>GIÁO VIÊN THỰC HIỆN</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr>${fontXml}${smallSizeXml}</w:rPr>
              <w:t></w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>

      <!-- HÀNG 2: CHỮ KÝ (ẢNH HOẶC KHOẢNG TRỐNG KÝ TAY) -->
      <w:tr>
        <!-- Cột trái: Khoảng trống ký tay -->
        <w:tc>
          <w:tcPr><w:tcW w:w="2500" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p>
          <w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p>
        </w:tc>

        <!-- Cột phải: Chữ ký giáo viên -->
        <w:tc>
          <w:tcPr><w:tcW w:w="2500" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>
          ${signatureDrawing}
        </w:tc>
      </w:tr>

      <!-- HÀNG 3: HỌ VÀ TÊN (CĂN BẰNG NHAU 100%) -->
      <w:tr>
        <!-- Cột trái: Tên tổ trưởng/tổ phó -->
        <w:tc>
          <w:tcPr><w:tcW w:w="2500" w:type="pct"/><w:vAlign w:val="bottom"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr>${fontXml}${smallSizeXml}</w:rPr>
              <w:t>${settings.approverName}</w:t>
            </w:r>
          </w:p>
        </w:tc>

        <!-- Cột phải: Tên giáo viên -->
        <w:tc>
          <w:tcPr><w:tcW w:w="2500" w:type="pct"/><w:vAlign w:val="bottom"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/></w:pPr>
            <w:r>
              <w:rPr>${fontXml}${smallSizeXml}</w:rPr>
              <w:t>${teacher}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
  `;

  return `
    ${reflectionXml}
    ${signatureTableXml}
  `;
}


function generateHeaderFooterXmls(settings: HeaderFooterSettings) {
  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:p>
        <w:pPr>
          <w:pBdr>
            <w:bottom w:val="single" w:sz="6" w:space="1" w:color="0000FF"/>
          </w:pBdr>
          <w:tabs><w:tab w:val="right" w:pos="9000"/></w:tabs>
          <w:jc w:val="both"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:i/><w:iCs/>
            <w:color w:val="0000FF"/>
            <w:sz w:val="26"/><w:szCs w:val="26"/>
          </w:rPr>
          <w:t xml:space="preserve">${settings.topLeft || ''}</w:t>
        </w:r>
        <w:r>
          <w:tab/>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:i/><w:iCs/>
            <w:color w:val="0000FF"/>
            <w:sz w:val="26"/><w:szCs w:val="26"/>
          </w:rPr>
          <w:t xml:space="preserve">${settings.topRight || ''}</w:t>
        </w:r>
      </w:p>
    </w:hdr>`;

  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:p>
        <w:pPr>
          <w:pBdr>
            <w:top w:val="single" w:sz="6" w:space="1" w:color="0000FF"/>
          </w:pBdr>
          <w:tabs>
            <w:tab w:val="center" w:pos="4500"/>
            <w:tab w:val="right" w:pos="9000"/>
          </w:tabs>
          <w:jc w:val="both"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:i/><w:iCs/>
            <w:color w:val="0000FF"/>
            <w:sz w:val="26"/><w:szCs w:val="26"/>
          </w:rPr>
          <w:t xml:space="preserve">${settings.bottomLeft || ''}</w:t>
        </w:r>
        <w:r>
          <w:tab/>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:i/><w:iCs/>
            <w:color w:val="0000FF"/>
            <w:sz w:val="26"/><w:szCs w:val="26"/>
          </w:rPr>
          <w:fldSimple w:instr=" PAGE "/>
        </w:r>
        <w:r>
          <w:tab/>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:i/><w:iCs/>
            <w:color w:val="0000FF"/>
            <w:sz w:val="26"/><w:szCs w:val="26"/>
          </w:rPr>
          <w:t xml:space="preserve">${settings.bottomRight || ''}</w:t>
        </w:r>
      </w:p>
    </w:ftr>`;

  return { headerXml, footerXml };
}

export async function applyHeaderFooterToZip(zip: JSZip, settings: HeaderFooterSettings): Promise<void> {
  const hasHeaderContent = !!(settings.topLeft || settings.topRight);
  const hasFooterContent = !!(settings.bottomLeft || settings.bottomRight);

  if (!hasHeaderContent && !hasFooterContent) return;

  const { headerXml, footerXml } = generateHeaderFooterXmls(settings);

  // 1. Manage header & footer files in zip
  const files = Object.keys(zip.files);
  const existingHeaders = files.filter(f => f.startsWith('word/header'));
  const existingFooters = files.filter(f => f.startsWith('word/footer'));

  if (hasHeaderContent) {
    if (existingHeaders.length > 0) {
      existingHeaders.forEach(fileName => zip.file(fileName, headerXml));
    } else {
      zip.file('word/header1.xml', headerXml);
    }
  }

  if (hasFooterContent) {
    if (existingFooters.length > 0) {
      existingFooters.forEach(fileName => zip.file(fileName, footerXml));
    } else {
      zip.file('word/footer1.xml', footerXml);
    }
  }

  const allHeaderFiles = Object.keys(zip.files).filter(f => f.startsWith('word/header'));
  const allFooterFiles = Object.keys(zip.files).filter(f => f.startsWith('word/footer'));

  // 2. Ensure [Content_Types].xml has overrides
  const contentTypesPath = '[Content_Types].xml';
  let contentTypesXml = await zip.file(contentTypesPath)?.async('string');
  if (contentTypesXml) {
    let ctModified = false;
    for (const hf of allHeaderFiles) {
      const partName = '/' + hf;
      if (!contentTypesXml.includes(partName)) {
        const override = `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>`;
        contentTypesXml = contentTypesXml.replace('</Types>', `${override}</Types>`);
        ctModified = true;
      }
    }
    for (const ff of allFooterFiles) {
      const partName = '/' + ff;
      if (!contentTypesXml.includes(partName)) {
        const override = `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`;
        contentTypesXml = contentTypesXml.replace('</Types>', `${override}</Types>`);
        ctModified = true;
      }
    }
    if (ctModified) {
      zip.file(contentTypesPath, contentTypesXml);
    }
  }

  // 3. Ensure word/_rels/document.xml.rels has relationships
  const relsPath = 'word/_rels/document.xml.rels';
  let relsXml = await zip.file(relsPath)?.async('string');
  let headerRId = 'rIdHeaderCustom';
  let footerRId = 'rIdFooterCustom';

  if (relsXml) {
    let relsModified = false;

    if (hasHeaderContent) {
      const hdrRelMatch = relsXml.match(/<Relationship[^>]+Type="[^"]*relationships\/header"[^>]*>/i);
      if (hdrRelMatch) {
        const idMatch = hdrRelMatch[0].match(/Id="([^"]+)"/i);
        if (idMatch) headerRId = idMatch[1];
      } else {
        const primaryHeader = allHeaderFiles[0] ? allHeaderFiles[0].replace('word/', '') : 'header1.xml';
        const relNode = `<Relationship Id="${headerRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="${primaryHeader}"/>`;
        relsXml = relsXml.replace('</Relationships>', `${relNode}</Relationships>`);
        relsModified = true;
      }
    }

    if (hasFooterContent) {
      const ftrRelMatch = relsXml.match(/<Relationship[^>]+Type="[^"]*relationships\/footer"[^>]*>/i);
      if (ftrRelMatch) {
        const idMatch = ftrRelMatch[0].match(/Id="([^"]+)"/i);
        if (idMatch) footerRId = idMatch[1];
      } else {
        const primaryFooter = allFooterFiles[0] ? allFooterFiles[0].replace('word/', '') : 'footer1.xml';
        const relNode = `<Relationship Id="${footerRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="${primaryFooter}"/>`;
        relsXml = relsXml.replace('</Relationships>', `${relNode}</Relationships>`);
        relsModified = true;
      }
    }

    if (relsModified) {
      zip.file(relsPath, relsXml);
    }
  }

  // 4. Update word/document.xml to reference headers and footers in all w:sectPr
  const documentXmlPath = 'word/document.xml';
  let docXml = await zip.file(documentXmlPath)?.async('string');
  if (docXml) {
    if (!docXml.includes('xmlns:r=')) {
      docXml = docXml.replace('<w:document ', '<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
    }

    if (docXml.includes('<w:sectPr')) {
      docXml = docXml.replace(/<w:sectPr([^>]*)>([\s\S]*?)<\/w:sectPr>/g, (_match, attrs, inner) => {
        let newInner = inner;

        if (hasHeaderContent) {
          if (newInner.includes('headerReference')) {
            newInner = newInner.replace(/<w:headerReference[^>]*w:type="default"[^>]*\/>/gi, 
              `<w:headerReference w:type="default" r:id="${headerRId}"/>`);
            newInner = newInner.replace(/<w:headerReference[^>]*w:type="first"[^>]*\/>/gi, 
              `<w:headerReference w:type="first" r:id="${headerRId}"/>`);
          } else {
            newInner = `<w:headerReference w:type="default" r:id="${headerRId}"/>` + newInner;
          }

          if (newInner.includes('<w:titlePg') && !newInner.includes('w:type="first"')) {
            newInner = `<w:headerReference w:type="first" r:id="${headerRId}"/>` + newInner;
          }
        }

        if (hasFooterContent) {
          if (newInner.includes('footerReference')) {
            newInner = newInner.replace(/<w:footerReference[^>]*w:type="default"[^>]*\/>/gi, 
              `<w:footerReference w:type="default" r:id="${footerRId}"/>`);
            newInner = newInner.replace(/<w:footerReference[^>]*w:type="first"[^>]*\/>/gi, 
              `<w:footerReference w:type="first" r:id="${footerRId}"/>`);
          } else {
            const selfCloseHdrEnd = newInner.lastIndexOf('w:headerReference');
            if (selfCloseHdrEnd !== -1) {
              const tagClose = newInner.indexOf('/>', selfCloseHdrEnd);
              if (tagClose !== -1) {
                newInner = newInner.substring(0, tagClose + 2) + `<w:footerReference w:type="default" r:id="${footerRId}"/>` + newInner.substring(tagClose + 2);
              } else {
                newInner = `<w:footerReference w:type="default" r:id="${footerRId}"/>` + newInner;
              }
            } else {
              newInner = `<w:footerReference w:type="default" r:id="${footerRId}"/>` + newInner;
            }
          }

          if (newInner.includes('<w:titlePg') && !newInner.includes('w:type="first"')) {
            newInner = `<w:footerReference w:type="first" r:id="${footerRId}"/>` + newInner;
          }
        }

        return `<w:sectPr${attrs}>${newInner}</w:sectPr>`;
      });
    } else {
      let refs = '';
      if (hasHeaderContent) refs += `<w:headerReference w:type="default" r:id="${headerRId}"/>`;
      if (hasFooterContent) refs += `<w:footerReference w:type="default" r:id="${footerRId}"/>`;
      const sectPr = `<w:sectPr>${refs}</w:sectPr>`;
      docXml = docXml.replace('</w:body>', `${sectPr}</w:body>`);
    }

    zip.file(documentXmlPath, docXml);
  }
}

/**
 * Extract plain text from a Word XML paragraph/table node string.
 * Works on raw XML strings — avoids browser DOMParser namespace issues.
 */
function extractTextFromXmlNode(nodeXml: string): string {
  const texts: string[] = [];
  const regex = /<w:t[^>]*>([^<]*)<\/w:t>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(nodeXml)) !== null) {
    texts.push(m[1]);
  }
  return texts.join('').normalize('NFC').replace(/[\s\u200B\uFEFF]+/g, ' ').trim().toLowerCase();
}

/**
 * Merge multi-period lesson plan into a single continuous flow.
 * Operates on the raw XML string to avoid browser DOMParser namespace problems.
 *
 * Logic:
 * - Remove all "Tiết X" labels
 * - For Tiết 2+: delete "Hoạt động 1: Mở đầu/Khởi động" and all its content
 *                delete the "Hoạt động 2: Hình thành kiến thức" heading (keep content after)
 * - Keep only the LAST period's "Hướng dẫn về nhà"
 * - Renumber ALL top-level activity headings sequentially across all periods
 */
function mergePeriodsByString(xml: string): string {
  // ── Step 1: Split body into top-level nodes ──────────────────────────────
  const bodyMatch = xml.match(/(<w:body[^>]*>)([\s\S]*?)(<\/w:body>)/);
  if (!bodyMatch) return xml;

  const beforeBody = xml.substring(0, xml.indexOf(bodyMatch[0]));
  const bodyOpen   = bodyMatch[1];
  const bodyContent = bodyMatch[2];
  const bodyClose  = bodyMatch[3];
  const afterBody  = xml.substring(xml.indexOf(bodyMatch[0]) + bodyMatch[0].length);

  const nodes: string[] = [];
  let pos = 0;
  const bodyLen = bodyContent.length;

  while (pos < bodyLen) {
    const nextOpen = bodyContent.indexOf('<', pos);
    if (nextOpen === -1) break;
    if (bodyContent[nextOpen + 1] === '/' || bodyContent[nextOpen + 1] === '?') {
      pos = bodyContent.indexOf('>', nextOpen) + 1;
      continue;
    }
    const tagMatch = bodyContent.substring(nextOpen).match(/^<(w:p|w:tbl|w:sectPr)[\s>]/);
    if (!tagMatch) {
      pos = bodyContent.indexOf('>', nextOpen) + 1;
      if (pos <= 0) break;
      continue;
    }
    const tagName = tagMatch[1];
    let depth = 0, scanPos = nextOpen, nodeEnd = -1;
    while (scanPos < bodyLen) {
      const lt = bodyContent.indexOf('<', scanPos);
      if (lt === -1) break;
      const gt = bodyContent.indexOf('>', lt);
      if (gt === -1) break;
      const tag = bodyContent.substring(lt + 1, gt + 1);
      const isSelfClose = tag.endsWith('/>');
      const isClose = tag.startsWith('/');
      const thisTag = tag.replace(/^\//, '').split(/[\s>/]/)[0];
      if (!isSelfClose) {
        if (!isClose && thisTag === tagName) depth++;
        if (isClose && thisTag === tagName) { depth--; if (depth === 0) { nodeEnd = gt + 1; break; } }
      }
      scanPos = gt + 1;
    }
    if (nodeEnd === -1) break;
    nodes.push(bodyContent.substring(nextOpen, nodeEnd));
    pos = nodeEnd;
  }

  // Helper: get plain text from a node's XML string
  const getText = (nodeXml: string): string => {
    const texts: string[] = [];
    const re = /<w:t[^>]*>([^<]*)<\/w:t>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(nodeXml)) !== null) texts.push(m[1]);
    return texts.join('').normalize('NFC').replace(/[\s\u200B\uFEFF]+/g, ' ').trim().toLowerCase();
  };

  // Helper: is this a top-level activity heading "N. Hoạt động N: ..."?
  const isTopActivity = (t: string) =>
    /^\d+\s*\.\s*ho[ạa]t\s*đ[ộo]ng\s*\d+/i.test(t);

  // Helper: is this the "Hoạt động 1: Mở đầu / Khởi động" heading?
  const isKhoiDong = (t: string) =>
    /^\d+\s*\.\s*ho[ạa]t\s*đ[ộo]ng\s*1/i.test(t) &&
    (t.includes('mở đầu') || t.includes('khởi động') || t.includes('mo dau') || /ho[ạa]t\s*đ[ộo]ng\s*1/i.test(t));

  // Helper: is this the "Hoạt động 2: Hình thành kiến thức" heading?
  const isHTKT = (t: string) =>
    /^\d+\s*\.\s*ho[ạa]t\s*đ[ộo]ng\s*\d+/i.test(t) &&
    t.includes('hình thành kiến thức');

  // ── Step 2: State machine ─────────────────────────────────────────────────
  let tierCount      = 0;
  let deleteMode: 'NONE' | 'VENHA' | 'KHOIDONG' = 'NONE';
  let venhaBuffer: string[] = [];
  let activityCounter = 1; // global counter across all periods
  const outputNodes: string[] = [];

  for (const node of nodes) {
    const text = getText(node);

    // ── "Tiết X" label ──
    if (/^ti[ếe]t\s*\d+/i.test(text) && text.length < 80) {
      tierCount++;
      if (tierCount > 1) {
        // Discard previous period's "về nhà" and enter KHOIDONG
        venhaBuffer = [];
        deleteMode = 'KHOIDONG';
      }
      // Always skip the "Tiết X" label itself
      continue;
    }

    // ── "Hướng dẫn về nhà" ── (only in NONE mode)
    if (deleteMode === 'NONE' &&
        (text.includes('tự học ở nhà') || text.includes('hướng dẫn về nhà') ||
         (text.includes('hướng dẫn') && text.includes('nhà')))) {
      deleteMode = 'VENHA';
      venhaBuffer = [node];
      continue;
    }

    // ── Collect VENHA buffer ──
    if (deleteMode === 'VENHA') {
      venhaBuffer.push(node);
      continue;
    }

    // ── KHOIDONG: delete Mở đầu section and its content ──
    if (deleteMode === 'KHOIDONG') {
      // Exit KHOIDONG when we reach "Hoạt động 2: Hình thành kiến thức"
      if (isHTKT(text)) {
        deleteMode = 'NONE';
        // Skip the HTKT heading itself (it's already in Tiết 1), continue to keep content below
      }
      // Always delete nodes while in KHOIDONG (including HTKT heading)
      continue;
    }

    // ── NONE mode: keep node, but renumber top-level activity headings ──
    if (isTopActivity(text)) {
      const myCounter = activityCounter;
      activityCounter++;
      // Replace the leading "N." and "Hoạt động N" in the XML
      const updatedNode = node.replace(
        /(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/gi,
        (_match: string, open: string, content: string, close: string) => {
          // Replace "N. Hoạt động N" pattern
          const newContent = content.replace(
            /(\d+)\s*\.\s*(Ho[ạa]t\s*đ[ộo]ng)\s*\d+/gi,
            (_m: string, _n: string, actWord: string) => `${myCounter}. ${actWord} ${myCounter}`
          );
          return open + newContent + close;
        }
      );
      outputNodes.push(updatedNode);
      continue;
    }

    outputNodes.push(node);
  }

  // Keep the last period's "về nhà" section
  for (const n of venhaBuffer) outputNodes.push(n);

  return beforeBody + bodyOpen + outputNodes.join('') + bodyClose + afterBody;
}

function generateScheduleTableXml(options: ProcessingOptions, style: { font?: string, size?: string }) {
  const { schedule, prepDate, classOffsets, weekOffset = 1, weekNumber, lessonCount = 1 } = options;
  if (!schedule || schedule.length === 0) return '';

  const fontXml = style.font ? `<w:rFonts w:ascii="${style.font}" w:hAnsi="${style.font}" w:cs="${style.font}"/>` : '';
  const sizeXml = style.size ? `<w:sz w:val="${style.size}"/><w:szCs w:val="${style.size}"/>` : '<w:sz w:val="24"/><w:szCs w:val="24"/>';

  const wTcPr = (width: number, vMerge: 'restart' | 'continue' | null = null, gridSpan: number | null = null) => {
    let xml = `<w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="center"/>`;
    if (gridSpan) xml += `<w:gridSpan w:val="${gridSpan}"/>`;
    if (vMerge) xml += `<w:vMerge w:val="${vMerge}"/>`;
    xml += `</w:tcPr>`;
    return xml;
  };

  const wP = (text: string, bold = false, color = 'auto') => `
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:rPr>${bold ? '<w:b/>' : ''}<w:color w:val="${color}"/>${fontXml}${sizeXml}</w:rPr>
        <w:t>${text}</w:t>
      </w:r>
    </w:p>
  `;

  const sorted = [...schedule].sort((a, b) => {
    if (a.className !== b.className) return a.className.localeCompare(b.className);
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return (a.period || '').localeCompare(b.period || '');
  });

  const grouped: Record<string, ScheduleItem[]> = {};
  sorted.forEach(item => {
    if (!grouped[item.className]) grouped[item.className] = [];
    grouped[item.className].push(item);
  });

  // Apply weekOffset so table dates match the preview (same as generateHeaderXml)
  const weekStart = addDays(startOfWeek(new Date(prepDate), { weekStartsOn: 1 }), 7 * weekOffset);
  let rowsXml = '';
  
  const baseWeek = (parseInt(weekNumber) || 1) + (weekOffset - 1);

  for (const [className, classItems] of Object.entries(grouped)) {
    let startPPCT = classOffsets[className] || parseInt(options.periodNumber) || 1;
    const n = classItems.length;
    const startIndex = (startPPCT - 1) % n;
    
    const sessions: any[] = [];
    for (let i = 0; i < lessonCount; i++) {
       const currentIndex = (startIndex + i) % n;
       const wrapCount = Math.floor((startIndex + i) / n);
       
       const item = classItems[currentIndex];
       const daysToAdd = item.dayOfWeek === 0 ? 6 : item.dayOfWeek - 1;
       const itemDate = addDays(weekStart, daysToAdd + wrapCount * 7);
       
       sessions.push({
          ...item,
          date: itemDate,
          weekIndex: wrapCount
       });
    }

    sessions.forEach((session, index) => {
      const dateStr = format(session.date, 'dd/MM/yyyy');
      const thuStr = session.dayOfWeek === 0 ? 'Chủ nhật' : `Thứ ${session.dayOfWeek + 1}`;
      
      const tkbNum = session.period ? session.period.replace(/\D/g, '') : '';
      const ppctNum = startPPCT + index;
      
      const isFirstOfClass = index === 0;
      
      const sessionsInThisWeek = sessions.filter(s => s.weekIndex === session.weekIndex);
      const isFirstOfWeekForClass = sessionsInThisWeek[0] === session;
      
      const tuanStr = isFirstOfWeekForClass ? `Tuần ${baseWeek + session.weekIndex}` : '';

      rowsXml += `
        <w:tr>
          <w:tc>${wTcPr(1000, isFirstOfClass ? 'restart' : 'continue')} ${isFirstOfClass ? wP(className, true) : '<w:p/>'}</w:tc>
          <w:tc>${wTcPr(1500)} ${wP(thuStr, true)}</w:tc>
          <w:tc>${wTcPr(2000)} ${wP(dateStr)}</w:tc>
          <w:tc>${wTcPr(1500)} ${wP(ppctNum.toString())}</w:tc>
          <w:tc>${wTcPr(1500)} ${wP(tkbNum.toString())}</w:tc>
          <w:tc>${wTcPr(1500, isFirstOfWeekForClass ? 'restart' : 'continue')} ${isFirstOfWeekForClass ? wP(tuanStr, true, 'FF0000') : '<w:p/>'}</w:tc>
        </w:tr>
      `;
    });
  }

  return `
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:jc w:val="center"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>${wTcPr(1000, 'restart')} ${wP('Lớp', true)}</w:tc>
        <w:tc>${wTcPr(3500, null, 2)} ${wP('Ngày dạy', true)}</w:tc>
        <w:tc>${wTcPr(1500, 'restart')} ${wP('Tiết (KHGD)', true)}</w:tc>
        <w:tc>${wTcPr(1500, 'restart')} ${wP('Tiết(TKB)', true)}</w:tc>
        <w:tc>${wTcPr(1500, 'restart')} ${wP('Ghi chú', true)}</w:tc>
      </w:tr>
      <w:tr>
        <w:tc>${wTcPr(1000, 'continue')} <w:p/></w:tc>
        <w:tc>${wTcPr(1500)} ${wP('Thứ', true)}</w:tc>
        <w:tc>${wTcPr(2000)} ${wP('Ngày', true)}</w:tc>
        <w:tc>${wTcPr(1500, 'continue')} <w:p/></w:tc>
        <w:tc>${wTcPr(1500, 'continue')} <w:p/></w:tc>
        <w:tc>${wTcPr(1500, 'continue')} <w:p/></w:tc>
      </w:tr>
      ${rowsXml}
    </w:tbl>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p>
  `;
}

function cleanTrailingSignatureAndReflection(bodyContent: string): { cleanBody: string; sectPrXml: string } {
  let content = bodyContent.trimEnd();

  // 1. Extract trailing sectPr first so reflection/signatures are at the end
  let sectPrXml = '';
  const sectPrMatch = content.match(/<w:sectPr[^>]*>[\s\S]*?<\/w:sectPr>\s*$/);
  if (sectPrMatch) {
    sectPrXml = sectPrMatch[0];
    content = content.slice(0, content.length - sectPrMatch[0].length).trimEnd();
  }

  // 2. Clean trailing empty paragraphs and previous signature/reflection tables
  const patterns = [
    /Rút\s*kinh\s*nghiệm/i,
    /Ký\s*duyệt/i,
    /Tổ\s*trưởng/i,
    /Tổ\s*phó/i,
    /GIÁO\s*VIÊN\s*THỰC\s*HIỆN/i,
    /Người\s*soạn/i,
    /Giáo\s*viên\s*giảng\s*dạy/i,
    /Hiệu\s*trưởng/i,
    /\.{10,}/
  ];

  let changed = true;
  while (changed) {
    changed = false;
    content = content.trimEnd();

    if (content.endsWith('</w:p>')) {
      const pStart = Math.max(content.lastIndexOf('<w:p '), content.lastIndexOf('<w:p>'));
      if (pStart !== -1) {
        const pXml = content.slice(pStart);
        const text = pXml.replace(/<[^>]+>/g, '').trim();
        if (text === '' || patterns.some(p => p.test(text))) {
          content = content.slice(0, pStart);
          changed = true;
          continue;
        }
      }
    } else if (content.endsWith('</w:tbl>')) {
      const tblStart = Math.max(content.lastIndexOf('<w:tbl '), content.lastIndexOf('<w:tbl>'));
      if (tblStart !== -1) {
        const tblXml = content.slice(tblStart);
        const text = tblXml.replace(/<[^>]+>/g, '').trim();
        if (text === '' || patterns.some(p => p.test(text))) {
          content = content.slice(0, tblStart);
          changed = true;
          continue;
        }
      }
    }
  }

  return { cleanBody: content, sectPrXml };
}

export async function processWordFile(file: File, options: ProcessingOptions, onLog?: (msg: string) => void): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const documentXmlPath = 'word/document.xml';
  const documentXml = await zip.file(documentXmlPath)?.async('string');
  
  if (!documentXml) {
    throw new Error('Không tìm thấy nội dung tài liệu Word.');
  }

  // Apply string-based merge BEFORE DOM parsing
  const rawXmlToProcess = options.mergePeriods ? mergePeriodsByString(documentXml) : documentXml;

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(rawXmlToProcess, "application/xml");
  const baseStyle = extractBaseStyles(xmlDoc);
    

  
    // Insert Signature image if provided
    if (options.reflection?.signatureImage) {
      const base64 = options.reflection.signatureImage.replace(/^data:image\/\w+;base64,/, '');
      zip.file('word/media/signature.png', base64, {base64: true});
      
      const contentTypesPath = '[Content_Types].xml';
      let contentTypesXml = await zip.file(contentTypesPath)?.async('string');
      if (contentTypesXml && !/Extension="png"/i.test(contentTypesXml)) {
        const pngType = '<Default Extension="png" ContentType="image/png"/>';
        contentTypesXml = contentTypesXml.replace('</Types>', pngType + '</Types>');
        zip.file(contentTypesPath, contentTypesXml);
      }
      
      const relsPath = 'word/_rels/document.xml.rels';
      let relsXml = await zip.file(relsPath)?.async('string');
      if (relsXml) {
        if (!relsXml.includes('Id="rIdSig"')) {
          const relNode = '<Relationship Id="rIdSig" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.png"/>';
          relsXml = relsXml.replace('</Relationships>', relNode + '</Relationships>');
          zip.file(relsPath, relsXml);
        }
      } else {
        const newRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdSig" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.png"/>
</Relationships>`;
        zip.file(relsPath, newRels);
      }
    }


  // Handle NLS Integration if options provided
  if (options.nlsOptions) {
    onLog?.(">> Đang trích xuất nội dung văn bản...");
    const textContext = await extractTextFromDocx(file);
    
    onLog?.(">> Đang kết nối AI để thiết kế Năng lực số...");
    const prompt = createIntegrationTextPrompt(textContext, options.nlsOptions.subject, options.nlsOptions.grade, options.nlsOptions.appendixText);
    const nlsContent = await generateCompetencyIntegration(prompt, options.nlsOptions.apiKey, options.nlsOptions.aiModel);
    
    onLog?.(">> Đang tích hợp Năng lực số vào file Word...");
    const colMode: NlsColumnMode = options.nlsOptions?.nlsColumnMode || (options.nlsOptions?.addNlsColumn ? 'col3' : 'col1');
    await injectNLSIntoDocx(zip, nlsContent, (msg) => onLog?.(msg), colMode);
  }

  const { xml: headerXml, earliestTeachingDate } = generateHeaderXml(options, baseStyle);
  const reflectionXml = options.reflection 
    ? generateReflectionXml(options.reflection, baseStyle, earliestTeachingDate, options.prepDate, options.weekOffset) 
    : '';
  
  // Re-read documentXml because NLS might have changed it
  let currentDocXml = await zip.file(documentXmlPath)?.async('string') || documentXml;
  
  // Find the start and end of the body
  const bodyStartTag = '<w:body>';
  const bodyEndTag = '</w:body>';
  const bodyStartIndex = currentDocXml.indexOf(bodyStartTag);
  const bodyEndIndex = currentDocXml.lastIndexOf(bodyEndTag);
  
  if (bodyStartIndex === -1 || bodyEndIndex === -1) {
    throw new Error('Định dạng file Word không hợp lệ.');
  }

  let bodyContent = currentDocXml.slice(bodyStartIndex + bodyStartTag.length, bodyEndIndex);

  // IMPROVED CLEANUP LOGIC:
  // We want to remove all leading paragraphs and tables that look like the old header.
  // We'll loop through elements at the beginning and remove them if they match header patterns.
  
  const headerPatterns = [
    /Tuần\s*:/i,
    /Tiết\s*PPCT\s*:/i,
    /Ngày\s*soạn\s*:/i,
    /Lớp/i,
    /Ngày\s*dạy/i
  ];

  let cleanBodyContent = bodyContent;
  let changed = true;

  while (changed) {
    changed = false;
    
    // Find the first element (paragraph or table)
    const pStart = cleanBodyContent.indexOf('<w:p');
    const tblStart = cleanBodyContent.indexOf('<w:tbl>');
    
    // Determine which comes first
    let elementStart = -1;
    let elementEnd = -1;

    if (pStart !== -1 && (tblStart === -1 || pStart < tblStart)) {
      elementStart = pStart;
      elementEnd = cleanBodyContent.indexOf('</w:p>', pStart) + 6;
    } else if (tblStart !== -1) {
      elementStart = tblStart;
      elementEnd = cleanBodyContent.indexOf('</w:tbl>', tblStart) + 8;
    }

    // If we found an element near the beginning (within first 100 chars of current start)
    if (elementStart !== -1 && elementStart < 100) {
      const elementContent = cleanBodyContent.slice(elementStart, elementEnd);
      
      // Check if this element contains any header keywords
      // We strip XML tags for better matching
      const plainText = elementContent.replace(/<[^>]+>/g, '');
      
      if (headerPatterns.some(pattern => pattern.test(plainText)) || plainText.trim() === '') {
        // It's a header element or empty, remove it
        cleanBodyContent = cleanBodyContent.slice(elementEnd);
        changed = true;
      }
    }
  }

  // Clean trailing signature / reflection using robust tag matching
  const { cleanBody: finalCleanBody, sectPrXml } = cleanTrailingSignatureAndReflection(cleanBodyContent);

  let newDocumentXml = 
    currentDocXml.slice(0, bodyStartIndex + bodyStartTag.length) + 
    headerXml + 
    finalCleanBody + 
    reflectionXml + 
    sectPrXml + 
    currentDocXml.slice(bodyEndIndex);

  // If signature image is embedded, ensure namespaces exist on w:document
  if (options.reflection?.signatureImage) {
    const namespacesToAdd = [
      { prefix: 'xmlns:r', uri: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships' },
      { prefix: 'xmlns:wp', uri: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing' },
      { prefix: 'xmlns:a', uri: 'http://schemas.openxmlformats.org/drawingml/2006/main' },
      { prefix: 'xmlns:pic', uri: 'http://schemas.openxmlformats.org/drawingml/2006/picture' },
    ];

    for (const ns of namespacesToAdd) {
      if (!newDocumentXml.includes(`${ns.prefix}=`)) {
        newDocumentXml = newDocumentXml.replace('<w:document ', `<w:document ${ns.prefix}="${ns.uri}" `);
      }
    }
  }

  zip.file(documentXmlPath, newDocumentXml);
  
  // Handle Header/Footer (applies to zip, [Content_Types].xml, rels, and document.xml)
  if (options.headerFooter && 
     (options.headerFooter.topLeft || options.headerFooter.topRight || 
      options.headerFooter.bottomLeft || options.headerFooter.bottomRight)) {
    await applyHeaderFooterToZip(zip, options.headerFooter);
  }

  const output = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  return output;
}

export function calculateSignatureDimensions(signatureImage?: string, maxW = 1500000, maxH = 750000): { cx: number; cy: number } {
  let cx = maxW;
  let cy = maxH;
  if (!signatureImage) return { cx, cy };
  try {
    const clean = signatureImage.replace(/^data:image\/\w+;base64,/, '');
    const binary = atob(clean.slice(0, 50));
    if (binary.length >= 24) {
      const width = ((binary.charCodeAt(16) << 24) |
                    (binary.charCodeAt(17) << 16) |
                    (binary.charCodeAt(18) << 8) |
                    binary.charCodeAt(19)) >>> 0;
      const height = ((binary.charCodeAt(20) << 24) |
                     (binary.charCodeAt(21) << 16) |
                     (binary.charCodeAt(22) << 8) |
                     binary.charCodeAt(23)) >>> 0;
      if (width > 0 && height > 0) {
        const ratio = width / height;
        if (ratio >= maxW / maxH) {
          cx = maxW;
          cy = Math.round(maxW / ratio);
        } else {
          cy = maxH;
          cx = Math.round(maxH * ratio);
        }
      }
    }
  } catch (e) {}
  return { cx, cy };
}

export async function embedSignatureToZip(zip: JSZip, signatureImage: string): Promise<void> {
  const base64 = signatureImage.replace(/^data:image\/\w+;base64,/, '');
  zip.file('word/media/signature.png', base64, { base64: true });

  const contentTypesPath = '[Content_Types].xml';
  let contentTypesXml = await zip.file(contentTypesPath)?.async('string');
  if (contentTypesXml && !/Extension="png"/i.test(contentTypesXml)) {
    const pngType = '<Default Extension="png" ContentType="image/png"/>';
    contentTypesXml = contentTypesXml.replace('</Types>', pngType + '</Types>');
    zip.file(contentTypesPath, contentTypesXml);
  }

  const relsPath = 'word/_rels/document.xml.rels';
  let relsXml = await zip.file(relsPath)?.async('string');
  if (relsXml) {
    if (!relsXml.includes('Id="rIdSig"')) {
      const relNode = '<Relationship Id="rIdSig" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.png"/>';
      relsXml = relsXml.replace('</Relationships>', relNode + '</Relationships>');
      zip.file(relsPath, relsXml);
    }
  } else {
    const newRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdSig" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.png"/>
</Relationships>`;
    zip.file(relsPath, newRels);
  }
}

export interface QuickSignOptions {
  teacherName?: string;
  location?: string;
  approverTitle?: string;
  approverName?: string;
  signingDate?: Date | string;
  autoSigningDate?: boolean;
  signingDateMode?: 'auto' | 'custom' | 'blank';
  customSigningDate?: string;
  prepDate?: Date;
  earliestTeachingDate?: Date | null;
  signatureImage: string;
  showReflection?: boolean;
  reflectionLines?: number;
  showSigningDate?: boolean;
}

/**
 * Directly signs a Word document (.docx) at the teacher's signature slot:
 * - Detects existing signature table with 'GIÁO VIÊN THỰC HIỆN' / 'Người soạn' / 'Giáo viên giảng dạy' and inserts signature.
 * - If not found, appends the standardized 2-column signature table before the final sectPr.
 * - Does not modify headers, timetable tables, or document body text.
 */
export async function signWordDocument(
  file: File | Blob,
  options: QuickSignOptions,
  onLog?: (msg: string) => void
): Promise<Blob> {
  onLog?.(">> Đang mở file Word...");
  const zip = await JSZip.loadAsync(file);

  onLog?.(">> Đang nhúng ảnh chữ ký...");
  await embedSignatureToZip(zip, options.signatureImage);

  const { cx, cy } = calculateSignatureDimensions(options.signatureImage);

  const signatureDrawingXml = `
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="60"/></w:pPr>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
            <wp:extent cx="${cx}" cy="${cy}"/>
            <wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="99999" name="Signature"/>
            <wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="99999" name="signature.png"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="rIdSig" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                    <a:stretch><a:fillRect/></a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
  `;

  const documentXmlPath = 'word/document.xml';
  let docXml = await zip.file(documentXmlPath)?.async('string');
  if (!docXml) throw new Error('Không đọc được nội dung văn bản (word/document.xml).');

  // Ensure namespaces exist on w:document
  const namespacesToAdd = [
    { prefix: 'xmlns:r', uri: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships' },
    { prefix: 'xmlns:wp', uri: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing' },
    { prefix: 'xmlns:a', uri: 'http://schemas.openxmlformats.org/drawingml/2006/main' },
    { prefix: 'xmlns:pic', uri: 'http://schemas.openxmlformats.org/drawingml/2006/picture' },
  ];
  for (const ns of namespacesToAdd) {
    if (!docXml.includes(`${ns.prefix}=`)) {
      docXml = docXml.replace('<w:document ', `<w:document ${ns.prefix}="${ns.uri}" `);
    }
  }

  const bodyStartTag = '<w:body>';
  const bodyEndTag = '</w:body>';
  const bodyStartIndex = docXml.indexOf(bodyStartTag);
  const bodyEndIndex = docXml.lastIndexOf(bodyEndTag);

  if (bodyStartIndex === -1 || bodyEndIndex === -1) {
    throw new Error('Định dạng file Word không hợp lệ (không tìm thấy w:body).');
  }

  const rawBody = docXml.slice(bodyStartIndex + bodyStartTag.length, bodyEndIndex);

  onLog?.(">> Đang dọn dẹp và chuẩn bị vị trí ký...");
  const { cleanBody, sectPrXml } = cleanTrailingSignatureAndReflection(rawBody);

  const reflectionConfig: ReflectionSettings = {
    enabled: true,
    title: 'Rút kinh nghiệm',
    contentLines: options.reflectionLines || 3,
    approverTitle: (options.approverTitle as any) || 'TỔ TRƯỞNG KÝ DUYỆT',
    approverName: options.approverName || '',
    year: (options.signingDate instanceof Date ? format(options.signingDate, 'yyyy') : null) || '2026',
    autoSigningDate: options.autoSigningDate !== false,
    signingDateMode: options.signingDateMode || (options.autoSigningDate === false ? (options.customSigningDate ? 'custom' : 'blank') : 'auto'),
    customSigningDate: options.customSigningDate,
    showReflection: options.showReflection ?? false,
    showSigningDate: options.showSigningDate !== false,
    location: options.location || 'Đường Hào',
    teacherName: options.teacherName || 'Phạm Đình Quang',
    insertSignature: true,
    signatureImage: options.signatureImage
  };

  const sigBlockXml = generateReflectionXml(
    reflectionConfig, 
    { font: 'Times New Roman', size: '28' },
    options.earliestTeachingDate || (options.signingDate instanceof Date ? options.signingDate : null),
    options.prepDate || new Date()
  );

  const newDocXml = docXml.slice(0, bodyStartIndex + bodyStartTag.length) +
                    cleanBody +
                    sigBlockXml +
                    sectPrXml +
                    docXml.slice(bodyEndIndex);

  zip.file(documentXmlPath, newDocXml);

  onLog?.(">> Hoàn tất ký giáo án!");
  const output = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  return output;
}

