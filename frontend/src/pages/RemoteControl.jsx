import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Radio,
  SlidersHorizontal,
  VolumeX,
  Volume2,
  RefreshCw,
  Send,
  CheckCircle,
  XCircle,
  AlertOctagon,
  Clock,
  History
} from 'lucide-react';
import { ModalConfirm } from '../components/ModalConfirm';

export function RemoteControl({ nodeStatus, latestData }) {
  const [controlMode, setControlMode] = useState('AUTO');
  const [barrierState, setBarrierState] = useState('OPEN');
  const [buzzerState, setBuzzerState] = useState(false);
  const [isLatched, setIsLatched] = useState(false);

  // Safe reset state
  const [safeInfo, setSafeInfo] = useState({
    safeDuration: 0,
    requiredDuration: 10,
    thresholdDeg: 0.8,
    currentTiltDelta: 0.1
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Command in flight status
  const [pendingAction, setPendingAction] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Command history table
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isBottomOnline = nodeStatus?.node_bottom?.status === 'online';

  // Load initial status and history
  const loadInitialData = async () => {
    try {
      const res = await fetch('/api/telemetry/latest');
      if (res.ok) {
        const json = await res.json();
        setControlMode(json.runtime.control_mode || 'AUTO');
        setBarrierState(json.runtime.barrier || 'OPEN');
        setBuzzerState(Boolean(json.runtime.buzzer));
        setIsLatched(Boolean(json.runtime.is_latched));
        setSafeInfo({
          safeDuration: json.latest.safe_duration_sec || 0,
          requiredDuration: 10,
          thresholdDeg: 0.8,
          currentTiltDelta: json.latest.tilt_delta_smoothed || 0.1
        });
      }

      fetchHistory();
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/control/history?limit=30');
      if (res.ok) {
        const json = await res.json();
        setHistory(json.commands || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Update real-time via WS
  useEffect(() => {
    if (!latestData) return;

    if (latestData.type === 'TELEMETRY_BOTTOM') {
      if (latestData.data.barrier) setBarrierState(latestData.data.barrier);
      if (latestData.data.buzzer !== undefined) setBuzzerState(Boolean(latestData.data.buzzer));
    }

    if (latestData.type === 'ALGORITHM_EVALUATION') {
      setIsLatched(Boolean(latestData.data.is_latched));
      const snap = latestData.data.proposed?.snapshot;
      if (snap) {
        setSafeInfo((prev) => ({
          ...prev,
          safeDuration: snap.safe_duration_sec ?? prev.safeDuration,
          currentTiltDelta: snap.tilt_delta_smoothed ?? prev.currentTiltDelta
        }));
      }
    }

    if (latestData.type === 'CMD_ACK') {
      fetchHistory();
    }
  }, [latestData]);

  // Dispatch Command API
  const sendCommand = async (action, value = null, force = false) => {
    if (!isBottomOnline) {
      setActionFeedback({
        type: 'error',
        message: 'Lỗi: ESP8266 điều khiển (node_bottom) đang OFFLINE! Không thể phát lệnh.'
      });
      return;
    }

    setPendingAction(action);
    setActionFeedback(null);

    try {
      const res = await fetch('/api/control/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value, force })
      });

      const json = await res.json();

      if (res.ok) {
        setActionFeedback({
          type: 'success',
          message: json.message || 'Thiết bị đã thực thi và gửi phản hồi ACK thành công!'
        });
        if (action === 'set_mode') setControlMode(value);
        if (action === 'barrier_close') setBarrierState('CLOSED');
        if (action === 'barrier_open' || action === 'reset_alarm') {
          setBarrierState('OPEN');
          setIsLatched(false);
          setBuzzerState(false);
        }
        if (action === 'buzzer_mute') setBuzzerState(false);
      } else {
        setActionFeedback({
          type: 'error',
          message: json.error || 'Lệnh thất bại.'
        });
      }
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: 'Lỗi mạng hoặc server không phản hồi: ' + err.message
      });
    } finally {
      setPendingAction(null);
      fetchHistory();
    }
  };

  return (
    <div className="space-y-6">
      {/* Node Bottom Offline Warning Banner */}
      {!isBottomOnline && (
        <div className="bg-red-500/20 border-2 border-red-500 text-red-200 p-4 rounded-xl flex items-center gap-3">
          <AlertOctagon className="w-6 h-6 text-red-400 shrink-0" />
          <div className="text-sm">
            <strong className="font-bold">CẢNH BÁO: VI ĐIỀU KHIỂN CHẤP HÀNH (ESP #2) ĐANG OFFLINE!</strong>
            <p className="text-xs text-red-300 mt-0.5">
              Toàn bộ các nút bấm điều khiển bị khóa tạm thời để ngăn ngừa tình trạng nhận lệnh ảo. Vui lòng cấp điện và kết nối Wi-Fi cho ESP8266 chân dốc.
            </p>
          </div>
        </div>
      )}

      {/* Action feedback banner */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300'
              : 'bg-red-500/20 border border-red-500 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <span>{actionFeedback.message}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-xs underline hover:opacity-80">
            Đóng
          </button>
        </div>
      )}

      {/* Main Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Chế độ điều khiển & Trạng thái hiện hành */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-sky-400" />
            Chế Độ Hoạt Động (Mode)
          </h2>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
              <button
                type="button"
                disabled={!isBottomOnline || pendingAction === 'set_mode'}
                onClick={() => sendCommand('set_mode', 'AUTO')}
                className={`py-2 px-3 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  controlMode === 'AUTO'
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>TỰ ĐỘNG (AUTO)</span>
              </button>
              <button
                type="button"
                disabled={!isBottomOnline || pendingAction === 'set_mode'}
                onClick={() => sendCommand('set_mode', 'MANUAL')}
                className={`py-2 px-3 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  controlMode === 'MANUAL'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>THỦ CÔNG (MANUAL)</span>
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {controlMode === 'AUTO'
                ? '• Chế độ AUTO: Khi phát hiện MOVEMENT, hệ thống tự động hạ Barie chặn đường ngay lập tức.'
                : '• Chế độ MANUAL: Người vận hành tự chịu trách nhiệm đóng/mở barie theo quyết định riêng.'}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-3">
            <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
              Trạng thái Thiết bị Ngoại vi
            </h3>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 text-sm">
              <span className="text-slate-300">Barie Servo SG90:</span>
              <span className={`font-mono font-bold ${barrierState === 'CLOSED' ? 'text-red-400' : 'text-emerald-400'}`}>
                {barrierState === 'CLOSED' ? 'ĐANG ĐÓNG' : 'ĐANG MỞ'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 text-sm">
              <span className="text-slate-300">Còi Buzzer Cảnh Báo:</span>
              <span className={`font-mono font-bold ${buzzerState ? 'text-red-400' : 'text-slate-400'}`}>
                {buzzerState ? 'ĐANG KÊU' : 'TẮT'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 text-sm">
              <span className="text-slate-300">Khóa Latch An Toàn:</span>
              <span className={`font-mono font-bold ${isLatched ? 'text-red-400' : 'text-emerald-400'}`}>
                {isLatched ? 'LATCHED (KHÓA)' : 'UNLATCHED (MỞ)'}
              </span>
            </div>
          </div>
        </div>

        {/* Middle Column: Bảng Nút Lệnh Điều Khiển Trực Tiếp */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Radio className="w-5 h-5 text-sky-400" />
              Lệnh Điều Khiển Chấp Hành Từ Xa (Chỉ Admin)
            </h2>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md font-mono">
              QoS 1 • Timeout 5s
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nút 1: Hạ Barie Khẩn Cấp */}
            <button
              type="button"
              disabled={!isBottomOnline || pendingAction === 'barrier_close'}
              onClick={() => sendCommand('barrier_close')}
              className="p-4 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-left transition disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-red-300 group-hover:text-red-200">
                  Hạ Barie Đóng Đường
                </span>
                <AlertOctagon className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-xs text-slate-400">
                Lập tức điều khiển Servo SG90 quay 90° để hạ thanh chắn ngăn phương tiện đi vào sườn dốc.
              </p>
              {pendingAction === 'barrier_close' && (
                <span className="text-xs text-sky-400 mt-2 block animate-pulse">Đang gửi lệnh & chờ ACK...</span>
              )}
            </button>

            {/* Nút 2: Tắt Còi Cảnh Báo */}
            <button
              type="button"
              disabled={!isBottomOnline || pendingAction === 'buzzer_mute'}
              onClick={() => sendCommand('buzzer_mute')}
              className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-left transition disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-slate-200 group-hover:text-white">
                  Tắt Còi Buzzer
                </span>
                <VolumeX className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-xs text-slate-400">
                Tạm dừng còi báo động tại mô hình sau khi người giám sát đã tiếp nhận thông tin hiện trường.
              </p>
              {pendingAction === 'buzzer_mute' && (
                <span className="text-xs text-sky-400 mt-2 block animate-pulse">Đang gửi lệnh & chờ ACK...</span>
              )}
            </button>

            {/* Nút 3: Test Đèn LED / Còi */}
            <button
              type="button"
              disabled={!isBottomOnline || pendingAction === 'set_led_test'}
              onClick={() => sendCommand('set_led_test', 'TEST_CYCLE')}
              className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-left transition disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-slate-200 group-hover:text-white">
                  Kiểm Tra Đèn & Còi (Test)
                </span>
                <Radio className="w-5 h-5 text-sky-400" />
              </div>
              <p className="text-xs text-slate-400">
                Kích hoạt nhấp nháy đèn LED Xanh/Vàng/Đỏ và bíp còi 1 lần để nghiệm thu phần cứng tại chỗ.
              </p>
              {pendingAction === 'set_led_test' && (
                <span className="text-xs text-sky-400 mt-2 block animate-pulse">Đang gửi lệnh & chờ ACK...</span>
              )}
            </button>

            {/* Nút 4: Mở Barie Bình Thường (Ở chế độ Manual) */}
            <button
              type="button"
              disabled={!isBottomOnline || isLatched || pendingAction === 'barrier_open'}
              onClick={() => sendCommand('barrier_open')}
              className="p-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-left transition disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-emerald-300 group-hover:text-emerald-200">
                  Mở Barie (Thủ công)
                </span>
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-xs text-slate-400">
                Nâng thanh chắn barie lên khi không ở trong trạng thái khóa chốt nguy hiểm.
              </p>
            </button>
          </div>

          {/* NÚT QUAN TRỌNG NHẤT: XÁC NHẬN AN TOÀN VÀ MỞ LẠI (2-STEP MODAL) */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border-2 border-emerald-500/60 shadow-xl space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  XÁC NHẬN AN TOÀN VÀ MỞ LẠI BARIE (LATCH RESET)
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Quy trình an toàn bắt buộc: Hệ thống sẽ tự động đối chiếu độ ổn định góc nghiêng (&lt; 0.8° trong &gt;= 10 giây). Hộp thoại xác nhận 2 bước ngăn chặn thao tác nhầm lẫn.
                </p>
              </div>

              <button
                type="button"
                disabled={!isBottomOnline}
                onClick={() => setIsModalOpen(true)}
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg whitespace-nowrap transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Xác Nhận &amp; Mở Lại
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Lịch Sử Lệnh Điều Khiển (Command Audit Log) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm sm:text-base">
            <History className="w-5 h-5 text-sky-400" />
            Lịch Sử Lệnh Điều Khiển &amp; Phản Hồi ACK
          </h3>
          <button
            onClick={fetchHistory}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Thời điểm</th>
                <th className="p-3">Người gửi</th>
                <th className="p-3">IP Nguồn</th>
                <th className="p-3">Hành động</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Phản hồi thiết bị (ACK)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-slate-500 font-sans">
                    Chưa có lệnh điều khiển nào được ghi lại.
                  </td>
                </tr>
              ) : (
                history.map((cmd) => (
                  <tr key={cmd.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 text-slate-400 whitespace-nowrap">
                      {new Date(cmd.created_at).toLocaleTimeString()}
                    </td>
                    <td className="p-3 font-semibold text-slate-200">{cmd.username}</td>
                    <td className="p-3 text-slate-400">{cmd.client_ip}</td>
                    <td className="p-3 text-sky-400 font-bold">{cmd.action}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          cmd.status === 'acked'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : cmd.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}
                      >
                        {cmd.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300 font-sans max-w-xs truncate">
                      {cmd.ack_msg || (cmd.status === 'pending' ? 'Đang chờ vi điều khiển phản hồi...' : '--')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2-Step Confirmation Modal */}
      <ModalConfirm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={({ force }) => sendCommand('reset_alarm', null, force)}
        safeInfo={safeInfo}
      />
    </div>
  );
}
