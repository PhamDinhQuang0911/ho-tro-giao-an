import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, CheckCircle2, Layout, Settings2, Sparkles, PenTool, Youtube, PlayCircle, ExternalLink } from 'lucide-react';

export function UserGuide() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4">
      
      <div className="text-center space-y-2 mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Hướng dẫn sử dụng chi tiết</h2>
        <p className="text-slate-500">Tìm hiểu cách tận dụng tối đa các chức năng của công cụ</p>
      </div>

      <Card className="border-red-200 bg-gradient-to-br from-red-50/50 to-amber-50/30 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-red-700">
            <Youtube className="w-5 h-5 text-red-600" />
            Video hướng dẫn sử dụng trực quan
          </CardTitle>
          <CardDescription>Bấm vào từng video bên dưới để xem hướng dẫn thao tác từng bước chi tiết trên YouTube.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a
              href="https://youtu.be/hr-jLaG35hM"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col p-4 rounded-xl border border-red-200/80 bg-white hover:border-red-400 hover:shadow-md transition-all relative overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <PlayCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 group-hover:text-red-700 transition-colors text-sm">
                    Video 1: Soạn giáo án & Tích hợp NLS/AI
                  </h4>
                  <p className="text-xs text-slate-500">Xem trên YouTube (Link: youtu.be/hr-jLaG35hM)</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Hướng dẫn điền ngày dạy, tuần, tiết, tích hợp Năng lực số, Năng lực AI theo phụ lục và xuất file Word hoàn chỉnh.
              </p>
              <div className="mt-3 flex items-center text-xs font-medium text-red-600 group-hover:translate-x-1 transition-transform">
                Mở video hướng dẫn <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </div>
            </a>

            <a
              href="https://youtu.be/MaOHaPQF4rg"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col p-4 rounded-xl border border-red-200/80 bg-white hover:border-red-400 hover:shadow-md transition-all relative overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <PlayCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 group-hover:text-red-700 transition-colors text-sm">
                    Video 2: Tạo Lịch Báo Giảng tự động
                  </h4>
                  <p className="text-xs text-slate-500">Xem trên YouTube (Link: youtu.be/MaOHaPQF4rg)</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Hướng dẫn cấu hình AI đọc Thời khóa biểu, tải tệp PPCT và tạo bảng Lịch Báo Giảng Excel theo tuần nhanh chóng.
              </p>
              <div className="mt-3 flex items-center text-xs font-medium text-red-600 group-hover:translate-x-1 transition-transform">
                Mở video hướng dẫn <ExternalLink className="w-3.5 h-3.5 ml-1" />
              </div>
            </a>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-100 bg-blue-50/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
            <Settings2 className="w-5 h-5" />
            1. Thiết lập Cài đặt Lịch giảng dạy (Tab Cài đặt lịch)
          </CardTitle>
          <CardDescription>Bước đầu tiên để phần mềm có thể tự động điền thời gian dạy vào giáo án.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-900">A. Nhập lịch dạy thủ công</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Chọn <strong>Thứ</strong>, <strong>Lớp</strong>, <strong>Môn học</strong> và <strong>Tiết</strong>.</li>
              <li>Bấm nút <strong>Thêm lịch</strong>. Lịch sẽ được thêm vào bảng danh sách bên dưới.</li>
              <li>Bảng này giúp phần mềm biết lớp nào học vào những ngày nào trong tuần.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-900">B. Lên lịch tự động bằng AI (Khuyên dùng)</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Bấm nút <strong>Lên lịch bằng AI</strong>.</li>
              <li>Tải lên ảnh chụp thời khóa biểu của bạn (ảnh rõ nét).</li>
              <li>Chọn tên cột chứa các ngày trong tuần (ví dụ: "Thứ").</li>
              <li>Bấm <strong>Phân tích bằng AI</strong>. Chờ một lát phần mềm sẽ tự động đọc toàn bộ ảnh và điền lịch vào bảng.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-primary">
            <Layout className="w-5 h-5" />
            2. Điền thông tin và Xử lý Giáo án (Tab Soạn giáo án)
          </CardTitle>
          <CardDescription>Quy trình xuất file Word giáo án hoàn chỉnh.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <ul className="list-decimal pl-5 space-y-3">
            <li>
              <strong>Nhập thông tin cơ bản:</strong> 
              <p className="text-slate-500 mt-1">Chọn Môn học, Tuần học hiện tại, và Ngày soạn. Phần mềm sẽ dựa vào Ngày soạn để tự động tính ngày dạy tương ứng trong tuần.</p>
            </li>
            <li>
              <strong>Tải file giáo án gốc:</strong>
              <p className="text-slate-500 mt-1">Bấm "Chọn file (.docx)" để tải lên file Word giáo án chưa có ngày tháng.</p>
            </li>
            <li>
              <strong>Cấu hình thứ tự tiết dạy (Xem trước & Cấu hình lớp):</strong>
              <p className="text-slate-500 mt-1">Nếu trong 1 lớp có nhiều tiết học (ví dụ: 1 tuần dạy 3 tiết Toán), bạn có thể cấu hình tiết học bắt đầu của file giáo án này (Bắt đầu từ tiết 1, tiết 2 hay tiết 3 trong tuần). Phần mềm sẽ tự động nội suy thời gian các tiết tiếp theo.</p>
            </li>
            <li>
              <strong>Bấm Xử lý & Tải xuống:</strong>
              <p className="text-slate-500 mt-1">Phần mềm sẽ chèn một Bảng lịch dạy hoàn chỉnh vào ngay đầu trang file Word và tự tải về máy của bạn.</p>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-teal-200 bg-teal-50/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-teal-700">
            <Sparkles className="w-5 h-5" />
            3. Tích hợp Năng lực số (Sử dụng AI)
          </CardTitle>
          <CardDescription>Tự động thêm mục tiêu NLS và hoạt động NLS vào giáo án.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <ul className="list-disc pl-5 space-y-2">
            <li>Bật công tắc <strong>Tích hợp Năng lực số</strong> ở góc phải.</li>
            <li><strong>Nhập API Key:</strong> Lấy API Key từ Google AI Studio (miễn phí) và nhập vào ô. Bấm "Lưu Key".</li>
            <li><strong>Mô hình AI:</strong> Bạn có thể chọn phiên bản Gemini. Nếu gặp lỗi quá tải (High demand), hãy chuyển sang mô hình thấp hơn (VD: Gemini 3.5 Flash).</li>
            <li><strong>Mức độ tích hợp:</strong> Kéo thanh trượt để chọn chỉ thêm Mục tiêu (Nhẹ), hoặc thêm cả Hoạt động dạy học (Sâu).</li>
            <li>Khi bấm "Xử lý", AI sẽ đọc giáo án và tự chèn nội dung Năng lực số vào đúng vị trí một cách thông minh.</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
            <PenTool className="w-5 h-5" />
            4. Thêm Rút kinh nghiệm & Chữ ký số
          </CardTitle>
          <CardDescription>Chèn tự động phần tổng kết ở cuối giáo án.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <ul className="list-decimal pl-5 space-y-3">
            <li>
              <strong>Bật chức năng:</strong> Bật công tắc "Thêm Rút kinh nghiệm".
            </li>
            <li>
              <strong>Tự động tính ngày ký:</strong> 
              <p className="text-slate-500 mt-1">Khi được bật, phần mềm tự lùi về ngày Thứ 7 của tuần liền trước tuần dạy để điền vào "Ngày... tháng... năm..." của người ký duyệt.</p>
            </li>
            <li>
              <strong>Chữ ký số:</strong>
              <p className="text-slate-500 mt-1">Bấm nút "Tạo". Tải lên một bức ảnh chụp chữ ký của bạn trên giấy trắng. Dùng khung lưới để cắt vùng chữ ký. Bấm "Xử lý & Tách nền", phần mềm sẽ lọc bỏ nền giấy trắng, giữ lại nét chữ mực xanh/đen. Bấm "Lưu chữ ký này". Mỗi khi xuất giáo án, chữ ký sẽ tự động đóng dấu vào dòng Giáo viên thực hiện.</p>
            </li>
          </ul>
        </CardContent>
      </Card>

    </div>
  );
}
