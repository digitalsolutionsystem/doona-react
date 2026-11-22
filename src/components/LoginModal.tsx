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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLocked) setShowLoginModal(false);
      }}
    >
      <div className="relative w-full max-w-[400px] rounded-[20px] border border-[#dde2e6] bg-white px-7 pt-9 pb-7 text-center shadow-2xl">
        {!isLocked && (
          <button
            type="button"
            onClick={() => setShowLoginModal(false)}
            aria-label="Tutup dialog login"
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[18px] border border-black/10 bg-[#3b4a56] shadow-md">
          {!logoErr ? (
            <img
              src={DOONA_LOGO_URL}
              alt="Doona Golf"
              referrerPolicy="no-referrer"
              onError={() => setLogoErr(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xl font-bold text-white">DG</span>
          )}
        </div>

        <h2 className="text-xl font-bold tracking-tight text-[#1f2a36]">DOONA GOLF</h2>
        <p className="mt-1 mb-6 text-xs text-[#64748b]">
          {apiUrl ? 'Masuk ke Database Google Sheets' : 'Sistem Manajemen Stok Harian (Mode Lokal)'}
        </p>

        <form onSubmit={handleSubmit} className="text-left" autoComplete="off">
          <div className="mb-3.5">
            <label htmlFor="dg-login-user" className="mb-1.5 block text-xs font-semibold text-[#1f2a36]">
              Username
            </label>
            <input
              id="dg-login-user"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username..."
              autoComplete="username"
              required
              className="h-11 w-full rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-3.5 text-sm text-[#1f2a36] outline-none focus:border-[#1a9e94] focus:bg-white focus:ring-3 focus:ring-[#1a9e94]/20"
            />
          </div>

          <div className="mb-3.5">
            <label htmlFor="dg-login-pwd" className="mb-1.5 block text-xs font-semibold text-[#1f2a36]">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                id="dg-login-pwd"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password..."
                autoComplete="current-password"
                required
                className="h-11 w-full rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] pr-11 pl-3.5 text-sm text-[#1f2a36] outline-none focus:border-[#1a9e94] focus:bg-white focus:ring-3 focus:ring-[#1a9e94]/20"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPwd((v) => !v)}
                title={showPwd ? 'Sembunyikan Password' : 'Lihat Password'}
                className="absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-md text-[#64748b] hover:text-[#1f2a36] cursor-pointer"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-3.5 flex items-start gap-2 rounded-lg border border-[#f9c9c5] bg-[#fff1f0] px-3 py-2.5 text-xs text-[#c93f38]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {connError && (
            <div className="mb-3 text-center">
              <button
                type="button"
                onClick={() => {
                  resetConnectionUrl();
                  setError('');
                  setConnError(false);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a9e94] hover:underline cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset URL koneksi ke bawaan
              </button>
            </div>
          )}

          <label className="mb-5 flex items-center gap-2 text-xs text-[#64748b] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded accent-[#1a9e94]"
            />
            <span>Ingat saya di perangkat ini</span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#1a9e94] text-sm font-semibold text-white shadow-md shadow-[#1a9e94]/30 transition hover:bg-[#12857c] disabled:opacity-60 cursor-pointer"
          >
            <span>{submitting ? 'Memverifikasi…' : 'Masuk ke Sistem'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={enterLocalMode}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748b] hover:text-[#1f2a36] cursor-pointer"
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
              className="text-xs font-semibold text-[#1a9e94] hover:underline cursor-pointer"
            >
              Atur Koneksi Sheets
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
