import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2, X } from 'lucide-react';

export function ModalConfirm({ isOpen, onClose, onConfirm, safeInfo }) {
  const [overrideChecked, setOverrideChecked] = useState(false);
  const [step, setStep] = useState(1);

  if (!isOpen) return null;

  const isSafeToOpen = safeInfo.safeDuration >= safeInfo.requiredDuration;

  const handleExecute = () => {
    onConfirm({ force: !isSafeToOpen });
    onClose();
    setStep(1);
    setOverrideChecked(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl relative text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 1 ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-xl ${isSafeToOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {isSafeToOpen ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-lg font-bold">Xác nhận An toàn & Mở lại Barie</h3>
                <p className="text-xs text-slate-400">Quy trình kiểm tra điều kiện hiện trường 2 bước</p>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-2.5 text-sm mb-5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Ngưỡng góc nghiêng an toàn:</span>
                <span className="font-mono text-slate-200">&lt; {safeInfo.thresholdDeg}°</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Độ lệch góc hiện tại (smoothed):</span>
                <span className="font-mono text-sky-400 font-bold">{safeInfo.currentTiltDelta}°</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Thời gian duy trì ổn định yêu cầu:</span>
                <span className="font-mono text-slate-200">&gt;= {safeInfo.requiredDuration} giây</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800">
                <span className="text-slate-400">Thời gian ổn định ghi nhận:</span>
                <span className={`font-mono font-bold ${isSafeToOpen ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {safeInfo.safeDuration.toFixed(1)} giây
                </span>
              </div>
            </div>

            {!isSafeToOpen && (
              <div className="bg-red-950/50 border border-red-800/60 rounded-lg p-3 text-xs text-red-300 mb-4 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <strong>CẢNH BÁO NGUY HIỂM:</strong> Mái dốc chưa đủ thời gian ổn định an toàn theo tiêu chuẩn ({safeInfo.safeDuration.toFixed(1)}s / {safeInfo.requiredDuration}s). Việc mở barie sớm có thể gây nguy hiểm cho phương tiện!
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition shadow-md ${
                  isSafeToOpen
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                {isSafeToOpen ? 'Tiếp tục bước xác thực' : 'Xem xét ghi đè (Override)'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/20 text-red-400 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-400">Bước 2: Cam kết trách nhiệm an toàn</h3>
                <p className="text-xs text-slate-400">Hành động này sẽ được ghi vĩnh viễn vào Nhật ký Giám sát (Audit Log)</p>
              </div>
            </div>

            {!isSafeToOpen ? (
              <label className="flex items-start gap-3 p-3 bg-slate-950 border border-red-800/80 rounded-lg cursor-pointer mb-5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={overrideChecked}
                  onChange={(e) => setOverrideChecked(e.target.checked)}
                  className="mt-0.5 rounded text-red-600 focus:ring-red-500"
                />
                <span>
                  Tôi đã quan sát thực địa mô hình, xác nhận khu vực mái dốc đã an toàn và chịu hoàn toàn trách nhiệm khi <strong>CƯỠNG CHẾ GHI ĐÈ (FORCE OVERRIDE)</strong> mở barie.
                </span>
              </label>
            ) : (
              <p className="text-sm text-slate-300 mb-5">
                Hệ thống xác nhận các chỉ số cảm biến đã trở về dải an toàn hoàn toàn. Bạn có chắc chắn muốn phát lệnh nâng barie và reset cảnh báo?
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={!isSafeToOpen && !overrideChecked}
                onClick={handleExecute}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition shadow-md ${
                  !isSafeToOpen && !overrideChecked
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                Xác nhận & Nâng Barie
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
