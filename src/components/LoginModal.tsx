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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#111614]/50 p-5 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLocked) setShowLoginModal(false);
      }}
    >
      <div className="relative w-full max-w-[396px] rounded-xl border border-[#e5e5df] bg-white px-7 pt-8 pb-6 shadow-[0_24px_60px_rgba(17,22,20,0.18)]">
        {!isLocked && (
          <button
            type="button"
            onClick={() => setShowLoginModal(false)}
            aria-label="Tutup dialog login"
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-md text-[#7c8580] transition hover:bg-[#f3f3ee] hover:text-[#141816] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="mb-6 flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#e5e5df] bg-[#14533c]">
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
            <h2 className="font-display text-lg font-semibold text-[#141816]">Doona Golf</h2>
            <p className="text-xs text-[#565e59]">
              {apiUrl ? 'Masuk ke Database Google Sheets' : 'Sistem Operasional & Stok (Mode Lokal)'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="text-left" autoComplete="off">
          <div className="mb-3.5">
            <label htmlFor="dg-login-user" className="mb-1.5 block text-xs font-medium text-[#141816]">
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
              className="h-10 w-full rounded-lg border border-[#e5e5df] bg-[#fafaf8] px-3 text-sm text-[#141816] outline-none transition focus:border-[#14533c] focus:bg-white focus:ring-2 focus:ring-[#14533c]/15"
            />
          </div>

          <div className="mb-3.5">
            <label htmlFor="dg-login-pwd" className="mb-1.5 block text-xs font-medium text-[#141816]">
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
                className="h-10 w-full rounded-lg border border-[#e5e5df] bg-[#fafaf8] pr-10 pl-3 text-sm text-[#141816] outline-none transition focus:border-[#14533c] focus:bg-white focus:ring-2 focus:ring-[#14533c]/15"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPwd((v) => !v)}
                title={showPwd ? 'Sembunyikan Password' : 'Lihat Password'}
                className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded text-[#7c8580] hover:text-[#141816] cursor-pointer"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-3.5 flex items-start gap-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]">
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
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#14533c] hover:underline cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset URL koneksi ke bawaan
              </button>
            </div>
          )}

          <label className="mb-5 flex items-center gap-2 text-xs text-[#565e59] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-[#14533c]"
            />
            <span>Ingat saya di perangkat ini</span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#14533c] text-sm font-medium text-white transition hover:bg-[#0f3f2d] disabled:opacity-60 cursor-pointer"
          >
            <span>{submitting ? 'Memverifikasi…' : 'Masuk ke Sistem'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#efefea] pt-3.5">
            <button
              type="button"
              onClick={enterLocalMode}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#565e59] hover:text-[#141816] cursor-pointer"
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
              className="text-xs font-medium text-[#14533c] hover:underline cursor-pointer"
            >
              Atur Koneksi Sheets
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
