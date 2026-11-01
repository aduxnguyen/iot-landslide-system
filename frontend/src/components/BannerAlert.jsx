import React from 'react';
import { AlertOctagon, AlertTriangle, ShieldCheck } from 'lucide-react';

export function BannerAlert({ state, isLatched, reason }) {
  if (state === 'MOVEMENT') {
    return (
      <div className="bg-red-600/90 border-b-2 border-red-500 text-white px-4 py-3 shadow-lg animate-pulse-fast">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-red-700 rounded-lg">
              <AlertOctagon className="w-6 h-6 animate-bounce" />
            </span>
            <div>
              <p className="font-bold text-sm sm:text-base tracking-wide uppercase">
                🚨 BÁO ĐỘNG ĐỎ: PHÁT HIỆN DỊCH CHUYỂN MÁI DỐC! BARIE ĐANG TỰ ĐỘNG ĐÓNG!
              </p>
              <p className="text-xs sm:text-sm text-red-100 opacity-90 mt-0.5">
                {reason || 'Biến thiên góc nghiêng vượt ngưỡng bền vững. Toàn bộ phương tiện bị ngăn vào khu vực sạt lở.'}
                {isLatched && ' (Trạng thái đang được CHỐT CỨNG. Cần người vận hành xác nhận an toàn để mở lại)'}
              </p>
            </div>
          </div>
          <span className="bg-white/20 px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
            CẤP NGUY HIỂM: CỰC KỲ CAO
          </span>
        </div>
      </div>
    );
  }

  if (state === 'WATCH') {
    return (
      <div className="bg-amber-600/90 border-b border-amber-500 text-white px-4 py-2.5 shadow">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="p-1.5 bg-amber-700 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-200" />
            </span>
            <div>
              <p className="font-semibold text-xs sm:text-sm tracking-wide">
                ⚠️ CẢNH BÁO MỨC ĐỘ 2: ĐIỀU KIỆN MƯA KÉO DÀI & ĐẤT ĐANG NGẤM NƯỚC NHANH
              </p>
              <p className="text-xs text-amber-100">
                {reason || 'Lượng mưa và độ ẩm tăng cao. Hệ thống chuyển sang chế độ giám sát cao độ. Barie vẫn mở.'}
              </p>
            </div>
          </div>
          <span className="bg-amber-800/80 px-2.5 py-1 rounded text-xs font-medium">
            CẦN THEO DÕI
          </span>
        </div>
      </div>
    );
  }

  return null;
}
