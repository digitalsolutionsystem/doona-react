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
      className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-5 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
        <div className="flex items-start justify-between border-b border-[#edf2f0] px-6 py-4">
          <div>
            <h3 className="font-display text-base font-bold text-[#13222b]">
              Ganti Password Akses
            </h3>
            <p className="mt-0.5 text-xs text-[#64748b]">
              Perbarui kata sandi untuk masuk aplikasi
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-3.5 px-6 py-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                Password Saat Ini
              </label>
              <input
                type="password"
                value={curr}
                onChange={(e) => setCurr(e.target.value)}
                placeholder="Masukkan password lama"
                required
                className="h-9.5 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3.5 text-sm text-[#13222b] outline-none transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                Password Baru
              </label>
              <input
                type="password"
                value={nextPwd}
                onChange={(e) => setNextPwd(e.target.value)}
                placeholder="Minimal 6 karakter"
                required
                className="h-9.5 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3.5 text-sm text-[#13222b] outline-none transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                Konfirmasi Password Baru
              </label>
              <input
                type="password"
                value={conf}
                onChange={(e) => setConf(e.target.value)}
                placeholder="Ulangi password baru"
                required
                className="h-9.5 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3.5 text-sm text-[#13222b] outline-none transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
              />
            </div>

            {msg && (
              <div
                className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
                  msg.type === 'ok'
                    ? 'bg-[#e6f7ee] text-[#15803d]'
                    : 'bg-[#fee2e2] text-[#b91c1c]'
                }`}
              >
                {msg.text}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-6 py-3.5">
            <button
              type="button"
              onClick={handleClose}
              className="h-9 rounded-xl bg-[#eef3f1] px-4 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Menyimpan…' : 'Simpan Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
