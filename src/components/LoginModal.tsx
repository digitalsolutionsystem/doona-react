import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  HardDrive,
  Loader2,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import hrisLoginVisual from '../assets/images/hris_login_visual_1795435752223.jpg';
import { DOONA_LOGO_URL } from '../constants/defaults';
import { useApp } from '../context/AppContext';

export const LoginModal: React.FC = () => {
  const {
    showLoginModal,
    sqliteAvailable,
    sqliteChecking,
    sqliteNeedsSetup,
    setupInitialAdmin,
    loginWithCredentials,
    enterLocalMode,
  } = useApp();

  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem('dg_last_user') || 'admin';
    } catch {
      return 'admin';
    }
  });
  const [displayName, setDisplayName] = useState('Admin Doona Golf');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [logoErr, setLogoErr] = useState(false);
  const [heroImgErr, setHeroImgErr] = useState(false);

  if (!showLoginModal) return null;

  const isSetupMode = sqliteAvailable && sqliteNeedsSetup;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const res = await loginWithCredentials(username, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Username atau password salah.');
    } else {
      setPassword('');
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim().length < 6) {
      setError('Password admin minimal 6 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    setSubmitting(true);
    setError('');
    const res = await setupInitialAdmin(username, displayName, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Gagal membuat akun admin SQLite.');
    } else {
      setPassword('');
      setConfirmPassword('');
    }
  };

  const handleKeyState = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  return (
    <div className="fixed inset-0 z-[9999] min-h-dvh w-full overflow-y-auto bg-[#101316] text-[#13222b]">
      {/* Full-bleed Architectural Backdrop */}
      <div className="pointer-events-none fixed inset-0">
        {!heroImgErr ? (
          <img
            src={hrisLoginVisual}
            alt="Ruang kerja operasional Doona Golf"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgErr(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#161c22] via-[#101316] to-[#0a0d10]" />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-[#0c1014]/70 via-[#10151b]/45 to-[#0c1014]/65"
        />
      </div>

      {/* Right-Aligned Floating Login Surface with Comfortable Edge Margin */}
      <div className="relative z-10 flex min-h-dvh w-full items-center justify-center px-5 py-8 sm:px-8 md:justify-end md:pr-12 lg:pr-20 xl:pr-24">
        <div className="w-full max-w-[560px] rounded-2xl border-[1.5px] border-[#4a535e] bg-[#fbfaf2]/97 p-7 shadow-[0_32px_80px_rgba(8,13,18,0.48)] backdrop-blur-md sm:p-9 md:ml-auto lg:p-11">
          {/* Brand Header */}
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#2eb86b] shadow-[0_6px_16px_rgba(13,37,48,0.16)]">
                {!logoErr ? (
                  <img
                    src={DOONA_LOGO_URL}
                    alt="Logo Doona Golf"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoErr(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-display text-sm font-bold text-white">DG</span>
                )}
              </div>
              <div>
                <div className="font-display text-base leading-tight font-bold tracking-tight text-[#13222b]">
                  DOONA GOLF
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[#64748b]">
                  <span>{sqliteAvailable ? 'Database SQLite' : 'Mode Offline'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{sqliteAvailable ? 'Lokal Linux' : 'Cache Browser'}</span>
                </div>
              </div>
            </div>
          </div>

          {sqliteChecking ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#2eb86b]" />
              <div className="text-sm font-semibold text-[#13222b]">
                Menghubungkan ke Database SQLite…
              </div>
              <p className="text-xs text-[#64748b]">
                Memeriksa status file database lokal di perangkat Anda.
              </p>
            </div>
          ) : isSetupMode ? (
            <>
              {/* First-Run SQLite Admin Setup Heading */}
              <div className="mb-5">
                <h1 className="font-display text-[24px] leading-tight font-bold tracking-[-0.02em] text-[#13222b]">
                  Buat Akun Admin SQLite
                </h1>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748b]">
                  Database SQLite baru telah dibuat. Tetapkan akun administrator pertama untuk
                  mengamankan seluruh data stok, omset, dan absensi di perangkat ini.
                </p>
              </div>

              <form onSubmit={handleSetupSubmit} className="space-y-4" autoComplete="off">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="dg-setup-user"
                      className="mb-1.5 block text-[13px] font-semibold text-[#13222b]"
                    >
                      Username Admin
                    </label>
                    <input
                      id="dg-setup-user"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      autoComplete="username"
                      autoFocus
                      required
                      className="h-11 w-full rounded-xl border border-[#cfd8d4] bg-white px-3.5 text-sm text-[#13222b] outline-none transition duration-150 focus:border-[#2eb86b] focus:ring-2 focus:ring-[#2eb86b]/20"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="dg-setup-name"
                      className="mb-1.5 block text-[13px] font-semibold text-[#13222b]"
                    >
                      Nama Tampilan
                    </label>
                    <input
                      id="dg-setup-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Admin Doona Golf"
                      required
                      className="h-11 w-full rounded-xl border border-[#cfd8d4] bg-white px-3.5 text-sm text-[#13222b] outline-none transition duration-150 focus:border-[#2eb86b] focus:ring-2 focus:ring-[#2eb86b]/20"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label
                      htmlFor="dg-setup-pwd"
                      className="block text-[13px] font-semibold text-[#13222b]"
                    >
                      Password Admin
                    </label>
                    {capsLockOn && (
                      <span className="text-[11.5px] font-semibold text-[#b45309]">
                        Caps Lock aktif
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <input
                      id="dg-setup-pwd"
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={handleKeyState}
                      onKeyDown={handleKeyState}
                      placeholder="Minimal 6 karakter"
                      autoComplete="new-password"
                      required
                      className="h-11 w-full rounded-xl border border-[#cfd8d4] bg-white pr-11 pl-3.5 text-sm text-[#13222b] outline-none transition duration-150 focus:border-[#2eb86b] focus:ring-2 focus:ring-[#2eb86b]/20"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPwd((v) => !v)}
                      aria-label={showPwd ? 'Sembunyikan password' : 'Tampilkan password'}
                      className="absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-[#64748b] transition hover:bg-[#edf2ef] hover:text-[#13222b] cursor-pointer"
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="dg-setup-pwd-conf"
                    className="mb-1.5 block text-[13px] font-semibold text-[#13222b]"
                  >
                    Konfirmasi Password
                  </label>
                  <input
                    id="dg-setup-pwd-conf"
                    type={showPwd ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyUp={handleKeyState}
                    onKeyDown={handleKeyState}
                    placeholder="Ulangi password admin"
                    autoComplete="new-password"
                    required
                    className="h-11 w-full rounded-xl border border-[#cfd8d4] bg-white px-3.5 text-sm text-[#13222b] outline-none transition duration-150 focus:border-[#2eb86b] focus:ring-2 focus:ring-[#2eb86b]/20"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-[#fecaca] bg-[#fee2e2] px-3.5 py-3 text-xs leading-relaxed font-medium text-[#b91c1c]"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="min-w-0 flex-1">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2eb86b] px-5 text-sm font-semibold text-white transition duration-150 hover:bg-[#259f5b] active:scale-[0.99] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Menyiapkan Database SQLite…</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Buat Akun &amp; Masuk</span>
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Standard SQLite Login Heading */}
              <div className="mb-6">
                <h1 className="font-display text-[24px] leading-tight font-bold tracking-[-0.02em] text-[#13222b]">
                  Masuk ke Portal Kerja
                </h1>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748b]">
                  {sqliteAvailable
                    ? 'Masuk menggunakan akun SQLite lokal Anda untuk mengelola data operasional secara aman.'
                    : 'Server SQLite lokal sedang tidak aktif. Anda dapat melanjutkan sementara menggunakan cache browser.'}
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4" autoComplete="off">
                <div>
                  <label
                    htmlFor="dg-login-user"
                    className="mb-1.5 block text-[13px] font-semibold text-[#13222b]"
                  >
                    Username
                  </label>
                  <input
                    id="dg-login-user"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username Anda"
                    autoComplete="username"
                    autoFocus
                    required
                    disabled={!sqliteAvailable}
                    className="h-11 w-full rounded-xl border border-[#cfd8d4] bg-white px-3.5 text-sm text-[#13222b] outline-none transition duration-150 focus:border-[#2eb86b] focus:ring-2 focus:ring-[#2eb86b]/20 disabled:opacity-60"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label
                      htmlFor="dg-login-pwd"
                      className="block text-[13px] font-semibold text-[#13222b]"
                    >
                      Password
                    </label>
                    {capsLockOn && (
                      <span className="text-[11.5px] font-semibold text-[#b45309]">
                        Caps Lock aktif
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <input
                      id="dg-login-pwd"
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={handleKeyState}
                      onKeyDown={handleKeyState}
                      placeholder="Masukkan password"
                      autoComplete="current-password"
                      required
                      disabled={!sqliteAvailable}
                      className="h-11 w-full rounded-xl border border-[#cfd8d4] bg-white pr-11 pl-3.5 text-sm text-[#13222b] outline-none transition duration-150 focus:border-[#2eb86b] focus:ring-2 focus:ring-[#2eb86b]/20 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPwd((v) => !v)}
                      aria-label={showPwd ? 'Sembunyikan password' : 'Tampilkan password'}
                      title={showPwd ? 'Sembunyikan password' : 'Tampilkan password'}
                      className="absolute right-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-[#64748b] transition hover:bg-[#edf2ef] hover:text-[#13222b] cursor-pointer"
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-[#fecaca] bg-[#fee2e2] px-3.5 py-3 text-xs leading-relaxed font-medium text-[#b91c1c]"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="min-w-0 flex-1">{error}</p>
                  </div>
                )}

                {sqliteAvailable && (
                  <div className="flex items-center gap-2 pt-0.5 text-xs text-[#475569]">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[#2eb86b]" />
                    <span>Autentikasi lokal terenkripsi · Penyimpanan SQLite 3 (WAL)</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !sqliteAvailable}
                  className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2eb86b] px-5 text-sm font-semibold text-white transition duration-150 hover:bg-[#259f5b] active:scale-[0.99] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Memverifikasi akun…</span>
                    </>
                  ) : (
                    <>
                      <span>Masuk ke Sistem</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* Hairline Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#dce4e0]" />
            <span className="text-xs font-medium text-[#64748b]">atau akses sementara</span>
            <div className="h-px flex-1 bg-[#dce4e0]" />
          </div>

          {/* Secondary Action */}
          <button
            type="button"
            onClick={enterLocalMode}
            className="flex h-10.5 w-full items-center justify-center gap-2 rounded-xl border border-[#cfd8d4] bg-white px-4 text-[13px] font-semibold text-[#13222b] transition duration-150 hover:bg-[#f2f6f4] active:scale-[0.99] cursor-pointer whitespace-nowrap"
          >
            <HardDrive className="h-4 w-4 text-[#64748b]" />
            <span>Lanjut Mode Cache Browser</span>
          </button>
        </div>
      </div>
    </div>
  );
};
