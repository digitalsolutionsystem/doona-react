import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, RotateCcw, WifiOff, X } from 'lucide-react';
import { DOONA_LOGO_URL } from '../constants/defaults';
import { useApp } from '../context/AppContext';

export const LoginModal: React.FC = () => {
  const {
    showLoginModal,
    setShowLoginModal,
    isLocked,
    apiUrl,
    loginWithCredentials,
    enterLocalMode,
    resetConnectionUrl,
    navigateTo,
  } = useApp();

  const [username, setUsername] = useState(() => localStorage.getItem('dg_last_user') || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [connError, setConnError] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  if (!showLoginModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setConnError(false);
    const res = await loginWithCredentials(username, password, remember);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Username atau password salah.');
      setConnError(Boolean(res.connError));
    } else {
      setPassword('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0d2530]/45 p-5 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLocked) setShowLoginModal(false);
      }}
    >
      <div className="relative w-full max-w-[400px] rounded-2xl bg-white px-7 pt-7 pb-6 shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
        {!isLocked && (
          <button
            type="button"
            onClick={() => setShowLoginModal(false)}
            aria-label="Tutup dialog login"
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="mb-6 flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#2eb86b] shadow-[0_6px_16px_rgba(46,184,107,0.28)]">
            {!logoErr ? (
              <img
                src={DOONA_LOGO_URL}
                alt="Doona Golf"
                referrerPolicy="no-referrer"
                onError={() => setLogoErr(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-display text-base font-bold text-white">DG</span>
            )}
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[#13222b]">Doona Golf</h2>
            <p className="text-xs text-[#64748b]">
              {apiUrl ? 'Masuk ke Database Google Sheets' : 'Sistem Operasional & Stok (Mode Lokal)'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="text-left" autoComplete="off">
          <div className="mb-3.5">
            <label htmlFor="dg-login-user" className="mb-1.5 block text-xs font-semibold text-[#13222b]">
              Username
            </label>
            <input
              id="dg-login-user"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              autoComplete="username"
              required
              className="h-10 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3.5 text-sm text-[#13222b] outline-none transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
            />
          </div>

          <div className="mb-3.5">
            <label htmlFor="dg-login-pwd" className="mb-1.5 block text-xs font-semibold text-[#13222b]">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                id="dg-login-pwd"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
                required
                className="h-10 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] pr-10 pl-3.5 text-sm text-[#13222b] outline-none transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPwd((v) => !v)}
                title={showPwd ? 'Sembunyikan Password' : 'Lihat Password'}
                className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#edf2f0] hover:text-[#13222b] cursor-pointer"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-3.5 flex items-start gap-2 rounded-xl bg-[#fee2e2] px-3.5 py-2.5 text-xs font-medium text-[#b91c1c]">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {connError && (
            <div className="mb-3 text-left">
              <button
                type="button"
                onClick={() => {
                  resetConnectionUrl();
                  setError('');
                  setConnError(false);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803d] hover:underline cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset URL koneksi ke bawaan
              </button>
            </div>
          )}

          <label className="mb-5 flex items-center gap-2 text-xs text-[#475569] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-[#2eb86b]"
            />
            <span>Ingat saya di perangkat ini</span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#2eb86b] text-sm font-semibold text-white shadow-[0_6px_16px_rgba(46,184,107,0.28)] transition hover:bg-[#259f5b] disabled:opacity-60 cursor-pointer"
          >
            <span>{submitting ? 'Memverifikasi…' : 'Masuk ke Sistem'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#edf2f0] pt-3.5">
            <button
              type="button"
              onClick={enterLocalMode}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748b] hover:text-[#13222b] cursor-pointer"
            >
              <WifiOff className="h-3.5 w-3.5" />
              Lanjut Mode Lokal
            </button>
            <button
              type="button"
              onClick={() => {
                enterLocalMode();
                navigateTo('db');
              }}
              className="text-xs font-semibold text-[#15803d] hover:underline cursor-pointer"
            >
              Atur Koneksi Sheets
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
