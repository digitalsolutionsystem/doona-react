import React, { useState } from 'react';
import { X } from 'lucide-react';
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
      className="fixed inset-0 z-[999] flex items-center justify-center bg-[#111614]/45 p-5 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-[420px] overflow-hidden rounded-xl border border-[#e5e5df] bg-white shadow-[0_20px_50px_rgba(17,22,20,0.16)]">
        <div className="flex items-start justify-between border-b border-[#e5e5df] px-6 py-4">
          <div>
            <h3 className="font-display text-base font-semibold text-[#141816]">
              Ganti Password Akses
            </h3>
            <p className="mt-0.5 text-xs text-[#565e59]">
              Perbarui kata sandi untuk masuk aplikasi
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#7c8580] transition hover:bg-[#f3f3ee] hover:text-[#141816] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-3.5 px-6 py-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#141816]">
                Password Saat Ini
              </label>
              <input
                type="password"
                value={curr}
                onChange={(e) => setCurr(e.target.value)}
                placeholder="Masukkan password lama"
                required
                className="h-9.5 w-full rounded-lg border border-[#e5e5df] bg-[#fafaf8] px-3 text-sm text-[#141816] outline-none transition focus:border-[#14533c] focus:bg-white focus:ring-2 focus:ring-[#14533c]/15"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#141816]">
                Password Baru
              </label>
              <input
                type="password"
                value={nextPwd}
                onChange={(e) => setNextPwd(e.target.value)}
                placeholder="Minimal 3 karakter"
                required
                className="h-9.5 w-full rounded-lg border border-[#e5e5df] bg-[#fafaf8] px-3 text-sm text-[#141816] outline-none transition focus:border-[#14533c] focus:bg-white focus:ring-2 focus:ring-[#14533c]/15"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#141816]">
                Konfirmasi Password Baru
              </label>
              <input
                type="password"
                value={conf}
                onChange={(e) => setConf(e.target.value)}
                placeholder="Ulangi password baru"
                required
                className="h-9.5 w-full rounded-lg border border-[#e5e5df] bg-[#fafaf8] px-3 text-sm text-[#141816] outline-none transition focus:border-[#14533c] focus:bg-white focus:ring-2 focus:ring-[#14533c]/15"
              />
            </div>

            {msg && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  msg.type === 'ok'
                    ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
                    : 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
                }`}
              >
                {msg.text}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-[#e5e5df] bg-[#fafaf8] px-6 py-3">
            <button
              type="button"
              onClick={handleClose}
              className="h-8.5 rounded-md border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#141816] transition hover:bg-[#f3f3ee] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-8.5 rounded-md bg-[#14533c] px-4 text-xs font-medium text-white transition hover:bg-[#0f3f2d] disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Menyimpan…' : 'Simpan Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
