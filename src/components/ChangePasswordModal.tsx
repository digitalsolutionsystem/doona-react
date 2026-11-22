import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ChangePasswordModal: React.FC = () => {
  const { showChangePwdModal, setShowChangePwdModal, changePassword } = useApp();
  const [curr, setCurr] = useState('');
  const [nextPwd, setNextPwd] = useState('');
  const [conf, setConf] = useState('');
  const [msg, setMsg] = useState<{ type: 'err' | 'ok'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!showChangePwdModal) return null;

  const handleClose = () => {
    setCurr('');
    setNextPwd('');
    setConf('');
    setMsg(null);
    setShowChangePwdModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nextPwd !== conf) {
      setMsg({ type: 'err', text: 'Konfirmasi password baru tidak cocok.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    const res = await changePassword(curr.trim(), nextPwd.trim());
    setSaving(false);
    if (res.ok) {
      setMsg({ type: 'ok', text: res.message });
      window.setTimeout(handleClose, 1200);
    } else {
      setMsg({ type: 'err', text: res.message });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-[#dde2e6] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#1a9e94]/12 text-[#1a9e94]">
              <Lock className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#1f2a36]">Ganti Password Akses</h3>
              <p className="text-xs text-[#64748b]">Perbarui kata sandi untuk masuk aplikasi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-slate-100 hover:text-[#1f2a36] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-3.5 px-6 py-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#1f2a36]">
                Password Saat Ini
              </label>
              <input
                type="password"
                value={curr}
                onChange={(e) => setCurr(e.target.value)}
                placeholder="Masukkan password lama"
                required
                className="h-10 w-full rounded-lg border border-[#e2e8f0] px-3 text-sm text-[#1f2a36] outline-none focus:border-[#1a9e94]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#1f2a36]">
                Password Baru
              </label>
              <input
                type="password"
                value={nextPwd}
                onChange={(e) => setNextPwd(e.target.value)}
                placeholder="Minimal 3 karakter"
                required
                className="h-10 w-full rounded-lg border border-[#e2e8f0] px-3 text-sm text-[#1f2a36] outline-none focus:border-[#1a9e94]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#1f2a36]">
                Konfirmasi Password Baru
              </label>
              <input
                type="password"
                value={conf}
                onChange={(e) => setConf(e.target.value)}
                placeholder="Ulangi password baru"
                required
                className="h-10 w-full rounded-lg border border-[#e2e8f0] px-3 text-sm text-[#1f2a36] outline-none focus:border-[#1a9e94]"
              />
            </div>

            {msg && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  msg.type === 'ok'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-[#f9c9c5] bg-[#fff1f0] text-[#c93f38]'
                }`}
              >
                {msg.text}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3.5">
            <button
              type="button"
              onClick={handleClose}
              className="h-9 rounded-lg border border-[#e2e8f0] bg-white px-4 text-xs font-semibold text-[#1f2a36] hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-lg bg-[#1a9e94] px-4 text-xs font-semibold text-white hover:bg-[#12857c] disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Menyimpan…' : 'Simpan Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
