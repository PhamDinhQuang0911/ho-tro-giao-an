import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coffee, QrCode } from 'lucide-react';

interface CoffeeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoffeeModal({ open, onOpenChange }: CoffeeModalProps) {
  const bankInfo = {
    bankCode: "tpbank",
    accountNumber: "0337820847",
    accountName: "PHAM DINH QUANG",
    amount: "100000",
    content: "ủng hộ phần mềm tích hợp nls-AI"
  };

  // VietQR standard URL
  const qrUrl = `https://img.vietqr.io/image/${bankInfo.bankCode}-${bankInfo.accountNumber}-compact2.png?amount=${bankInfo.amount}&addInfo=${encodeURIComponent(bankInfo.content)}&accountName=${encodeURIComponent(bankInfo.accountName)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-white rounded-2xl shadow-2xl border border-amber-100">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-2 shadow-inner">
            <Coffee className="w-6 h-6 text-amber-700" />
          </div>
          <DialogTitle className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
            Mời tác giả 1 ly cafe ☕
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 text-center">
            Ủng hộ tác giả phát triển & duy trì phần mềm Hỗ trợ soạn giáo án tích hợp NLS - AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center bg-gradient-to-b from-amber-50/60 to-orange-50/60 p-4 rounded-xl border border-amber-200/70 shadow-inner">
            <div className="p-2 bg-white rounded-lg shadow-md border border-amber-200">
              <img 
                src={qrUrl} 
                alt="Mã QR Chuyển khoản TPBank" 
                className="w-64 h-auto object-contain rounded"
              />
            </div>
            <p className="text-xs text-amber-900 mt-2.5 font-medium flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5" /> Quét mã VietQR bằng bất kỳ ứng dụng Ngân hàng nào
            </p>
          </div>
        </div>

        <div className="flex justify-center pt-1">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="w-full text-xs hover:bg-slate-100"
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
