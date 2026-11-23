import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  Download,
  HardDrive,
  KeyRound,
  Lock,
  LogIn,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Upload,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { DEFAULT_API_URL, SHEETS_LIST } from '../constants/defaults';
import { useApp } from '../context/AppContext';
import { summarizeAppData } from '../domain/reportCalculations';
import { getLocalCacheStats, validateApiUrlFormat } from '../services/api';

const SETUP_STEPS = [
  'Buat file Spreadsheet kosong di Google Drive Anda.',
  'Buka menu Ekstensi > Apps Script.',
  'Salin seluruh kode dari file Code.gs lalu simpan.',
  'Klik Deploy > New deployment, lalu pilih Web app.',
  'Pilih Execute as: Me dan Who has access: Anyone.',
  'Salin URL Web App, tempel di kolom URL, lalu klik Simpan & Sinkronisasi.',
];

const CONNECTED_MODULES = [
  'Beranda',
  'Input Harian',
  'Tabel Bulanan',
  'OMSET',
  'Absensi & Gaji',
  'Stok Awal',
  'Master Item',
  'Setting Satuan',
  'Laporan & Ekspor',
];

function formatIsoTime(iso: string | null): string {
  if (!iso) return 'Belum pernah';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const DatabasePage: React.FC = () => {
  const {
    state,
    apiUrl,
    dbMode,
    user,
    isViewer,
    sync,
    syncMeta,
    syncConflict,
    updateApiUrl,
    resetConnectionUrl,
    pingConnection,
    checkAndSyncCloud,
    resolveSyncConflict,
    setShowLoginModal,
  } = useApp();

  const [urlInput, setUrlInput] = useState(apiUrl);
  const [testing, setTesting] = useState(false);
  const [syncActionBusy, setSyncActionBusy] = useState<'pull' | 'push' | 'retry' | null>(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: 'ok' | 'warn' | 'err';
    text: string;
    sheets?: string[];
    spreadsheetName?: string;
  } | null>(null);

  useEffect(() => {
    setUrlInput(apiUrl);
  }, [apiUrl]);

  const dataSummary = useMemo(() => summarizeAppData(state), [state]);
  const cacheStats = useMemo(() => getLocalCacheStats(), [state, syncMeta]);
  const urlValidation = useMemo(() => validateApiUrlFormat(urlInput), [urlInput]);

  const isCloudReady = dbMode === 'gas' || dbMode === 'cloud_connected';
  const hasUnsavedUrlEdit = urlInput.trim() !== apiUrl.trim();

  const handleTest = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setStatusMsg({ type: 'err', text: 'Masukkan Web App URL terlebih dahulu.' });
      return;
    }
    const check = validateApiUrlFormat(trimmed);
    if (!check.valid) {
      setStatusMsg({ type: 'err', text: check.error || 'Format URL tidak valid.' });
      return;
    }

    setTesting(true);
    setStatusMsg({ type: 'warn', text: 'Menghubungkan ke Google Sheets… Mohon tunggu.' });
    const res = await pingConnection(trimmed);
    setTesting(false);

    if (res.success) {
      setStatusMsg({
        type: 'ok',
        text: `Berhasil terhubung ke Google Sheets!`,
        spreadsheetName: res.spreadsheetName || 'Spreadsheet Aktif',
        sheets: res.sheets,
      });
    } else {
      setStatusMsg({
        type: 'err',
        text: `Gagal terhubung: ${
          res.error || 'Pastikan opsi "Who has access" diset ke "Anyone" saat deploy Web App.'
        }`,
      });
    }
  };

  const handleSave = async () => {
    const trimmed = urlInput.trim();
    const res = await updateApiUrl(trimmed);
    if (!res.ok) {
      setStatusMsg({ type: 'err', text: res.message });
      return;
    }
    setStatusMsg({ type: 'ok', text: res.message });
    if (trimmed) {
      setShowLoginModal(true);
    }
  };

  const handleSwitchLocalMode = async () => {
    setUrlInput('');
    const res = await updateApiUrl('');
    setStatusMsg({ type: 'ok', text: res.message });
  };

  const handleResetDefaultUrl = () => {
    resetConnectionUrl();
    setUrlInput(DEFAULT_API_URL);
    setStatusMsg({
      type: 'ok',
      text: 'URL koneksi dikembalikan ke bawaan. Klik Login Google Sheets untuk menyinkronkan data.',
    });
  };

  const handleSyncIntent = async (intent: 'pull' | 'push' | 'retry') => {
    if (syncActionBusy) return;
    setSyncActionBusy(intent);
    const res = await checkAndSyncCloud(intent);
    setSyncActionBusy(null);

    if (res.ok) {
      setStatusMsg({ type: 'ok', text: res.message });
    } else if (res.status === 'conflict') {
      setStatusMsg({ type: 'warn', text: res.message });
    } else {
      setStatusMsg({ type: 'err', text: res.message });
    }
  };

  const handleResolveConflict = async (choice: 'use_cloud' | 'use_local' | 'cancel') => {
    if (resolvingConflict) return;
    setResolvingConflict(true);
    const res = await resolveSyncConflict(choice);
    setResolvingConflict(false);
    setStatusMsg({
      type: res.ok ? 'ok' : 'err',
      text: res.message,
    });
  };

  const connectionBadge =
    dbMode === 'gas'
      ? {
          title: 'Google Apps Script (Internal Host)',
          desc: 'Terhubung langsung melalui runtime internal Google Apps Script. Tidak perlu mengatur Web App URL eksternal.',
          tone: 'bg-[#e6f7ee] text-[#15803d]',
          iconBg: 'bg-[#e6f7ee] text-[#15803d]',
          icon: Cloud,
        }
      : dbMode === 'cloud_connected'
        ? {
            title: 'Terhubung ke Google Sheets',
            desc: 'Terhubung via Web App Deploy URL dengan sesi token terverifikasi server.',
            tone: 'bg-[#e6f7ee] text-[#15803d]',
            iconBg: 'bg-[#e6f7ee] text-[#15803d]',
            icon: Wifi,
          }
        : dbMode === 'cloud_unauth'
          ? {
              title: 'URL Terpasang · Belum Login',
              desc: 'Web App URL sudah tersimpan, namun sesi token belum aktif. Data sementara memakai cache lokal hingga Anda login.',
              tone: 'bg-[#fef3c7] text-[#b45309]',
              iconBg: 'bg-[#fef3c7] text-[#b45309]',
              icon: KeyRound,
            }
          : {
              title: 'Mode Lokal (localStorage)',
              desc: 'Aplikasi berjalan mandiri tanpa cloud. Seluruh transaksi tersimpan aman di browser dan dapat disinkronkan saat URL dipasang.',
              tone: 'bg-[#f3f7f5] text-[#13222b]',
              iconBg: 'bg-[#f3f7f5] text-[#475569]',
              icon: HardDrive,
            };

  const ConnectionIcon = connectionBadge.icon;

  return (
    <div className="dg-page">
      {/* STICKY FLOATING HEADER */}
      <div className="dg-sticky-header no-print px-4 pt-3 pb-1 md:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-[0_6px_22px_rgba(13,37,48,0.045)] md:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[17px] font-bold tracking-[-0.015em] text-[#13222b]">
            Koneksi Database
          </h1>
          <span
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${connectionBadge.tone}`}
          >
            {connectionBadge.title}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dbMode === 'cloud_unauth' && (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              Login Google Sheets
            </button>
          )}
          {isCloudReady && syncMeta.pendingLocalChanges && !isViewer && (
            <button
              type="button"
              onClick={() => handleSyncIntent('retry')}
              disabled={syncActionBusy !== null}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#f59e0b] px-4 text-xs font-semibold text-white transition hover:bg-[#d97706] disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncActionBusy === 'retry' ? 'animate-spin' : ''}`}
              />
              Coba Sinkronisasi Ulang
            </button>
          )}
        </div>
        </header>
      </div>

      {/* Scrollable Body */}
      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="space-y-4">
          {/* 4 Floating KPI Status Cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64748b]">Mode Koneksi</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${connectionBadge.iconBg}`}>
                  <ConnectionIcon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 text-[14.5px] font-bold text-[#13222b]">
                {connectionBadge.title}
              </div>
              <div className="mt-1 text-[11.5px] text-[#64748b]">
                Kontrak API · <span className="font-mono-num">Google Apps Script</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64748b]">Status Sinkronisasi</span>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    syncConflict
                      ? 'bg-[#fee2e2] text-[#b91c1c]'
                      : syncMeta.pendingLocalChanges
                        ? 'bg-[#fef3c7] text-[#b45309]'
                        : 'bg-[#e6f7ee] text-[#15803d]'
                  }`}
                >
                  {syncConflict ? (
                    <ShieldAlert className="h-4 w-4" />
                  ) : syncMeta.pendingLocalChanges ? (
                    <WifiOff className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                </span>
              </div>
              <div
                className={`mt-3 text-[14.5px] font-bold ${
                  syncConflict || sync.isError
                    ? 'text-[#b91c1c]'
                    : syncMeta.pendingLocalChanges
                      ? 'text-[#b45309]'
                      : 'text-[#15803d]'
                }`}
              >
                {syncConflict
                  ? 'Konflik — Perlu Konfirmasi'
                  : syncMeta.pendingLocalChanges
                    ? 'Perubahan Lokal Tertunda'
                    : sync.text}
              </div>
              <div className="mt-1 text-[11.5px] text-[#64748b]">
                Sinkron terakhir ·{' '}
                <span className="font-mono-num font-semibold text-[#13222b]">
                  {formatIsoTime(syncMeta.lastCloudSyncAt)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64748b]">Cache Lokal</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f7f5] text-[#475569]">
                  <HardDrive className="h-4 w-4" />
                </span>
              </div>
              <div className="font-mono-num mt-3 text-[14.5px] font-bold text-[#13222b]">
                {cacheStats.hasCache ? `${cacheStats.sizeKb} KB tersimpan` : 'Belum ada cache'}
              </div>
              <div className="mt-1 text-[11.5px] text-[#64748b]">
                {dataSummary.totalItems} item · {dataSummary.stockMonths.length} bln stok ·{' '}
                {dataSummary.omsetDaysCount} hr omset
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64748b]">Hak Akses &amp; Otorisasi</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f7ee] text-[#15803d]">
                  <Lock className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 text-[14.5px] font-bold text-[#13222b]">
                {user?.nama || user?.username || 'Mode Lokal'}
              </div>
              <div className="mt-1 text-[11.5px] text-[#64748b]">
                {isViewer ? 'Viewer · Hanya Baca' : 'Admin · Baca & Tulis'} · Validasi server GAS
              </div>
            </div>
          </section>

          {/* Conflict Warning Banner */}
          {syncConflict && (
            <div className="rounded-2xl bg-[#fee2e2] p-4 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#b91c1c]" />
                  <div>
                    <div className="text-xs font-bold text-[#991b1b]">
                      Konflik Sinkronisasi Terdeteksi — Penimpaan Otomatis Dicegah
                    </div>
                    <p className="mt-0.5 text-xs text-[#991b1b]">{syncConflict.message}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {syncConflict.cloudData && (
                    <button
                      type="button"
                      disabled={resolvingConflict}
                      onClick={() => handleResolveConflict('use_cloud')}
                      className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-semibold text-[#13222b] shadow-xs hover:bg-[#f7faf9] cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 text-[#15803d]" />
                      Gunakan Data Cloud
                    </button>
                  )}
                  {!isViewer && (
                    <button
                      type="button"
                      disabled={resolvingConflict}
                      onClick={() => handleResolveConflict('use_local')}
                      className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-3.5 text-xs font-semibold text-white hover:bg-[#259f5b] cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Unggah Data Lokal ke Cloud
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Main 2-Column Workspace */}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
            {/* LEFT COLUMN */}
            <div className="space-y-4">
              <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                    Pengaturan Web App URL
                  </h2>
                  {apiUrl && (
                    <span className="font-mono-num rounded-lg bg-[#f3f7f5] px-2.5 py-1 text-[11px] font-medium text-[#64748b]">
                      Global API Service
                    </span>
                  )}
                </div>

                <div className={`rounded-xl px-4 py-3 text-xs ${connectionBadge.tone}`}>
                  <div className="font-bold">{connectionBadge.title}</div>
                  <p className="mt-0.5 leading-relaxed opacity-90">{connectionBadge.desc}</p>
                </div>

                <div>
                  <label
                    htmlFor="db-url-input"
                    className="mb-1.5 block text-xs font-semibold text-[#13222b]"
                  >
                    URL Google Apps Script (Deploy)
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="db-url-input"
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      disabled={isViewer}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className={`font-mono-num h-9.5 min-w-0 flex-1 rounded-xl border bg-[#f7faf9] px-3.5 text-xs text-[#13222b] outline-none transition focus:bg-white focus:ring-2 disabled:opacity-60 ${
                        !urlValidation.valid
                          ? 'border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/20'
                          : 'border-[#dce6e2] focus:border-[#2eb86b] focus:ring-[#2eb86b]/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleTest}
                      disabled={testing || !urlInput.trim() || !urlValidation.valid}
                      className="h-9.5 rounded-xl bg-[#f3f7f5] px-4 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] whitespace-nowrap disabled:opacity-50 cursor-pointer"
                    >
                      {testing ? 'Menguji…' : 'Tes Koneksi'}
                    </button>
                  </div>
                  {!urlValidation.valid ? (
                    <p className="mt-1.5 text-[11px] font-semibold text-[#b91c1c]">
                      {urlValidation.error}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[11.5px] text-[#64748b]">
                      Kosongkan URL untuk menjalankan aplikasi di Mode Lokal (localStorage).
                      Mengganti URL akan meminta login ulang ke database tujuan.
                    </p>
                  )}
                </div>

                {statusMsg && (
                  <div
                    className={`rounded-xl px-4 py-3 text-xs ${
                      statusMsg.type === 'ok'
                        ? 'bg-[#e6f7ee] text-[#15803d]'
                        : statusMsg.type === 'warn'
                          ? 'bg-[#fef3c7] text-[#b45309]'
                          : 'bg-[#fee2e2] text-[#b91c1c]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="font-semibold">{statusMsg.text}</div>
                        {statusMsg.spreadsheetName && (
                          <div>
                            Spreadsheet: <strong>{statusMsg.spreadsheetName}</strong>
                          </div>
                        )}
                        {statusMsg.sheets && statusMsg.sheets.length > 0 && (
                          <div className="font-mono-num pt-1 text-[11px]">
                            {statusMsg.sheets.join(' · ')}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setStatusMsg(null)}
                        className="rounded-lg p-1 opacity-75 hover:opacity-100 cursor-pointer"
                        aria-label="Tutup pesan"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf2f0] pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetDefaultUrl}
                      disabled={isViewer}
                      className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#e1ebe7] hover:text-[#13222b] disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset Bawaan
                    </button>
                    {apiUrl && !isViewer && (
                      <button
                        type="button"
                        onClick={handleSwitchLocalMode}
                        className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#e1ebe7] hover:text-[#13222b] cursor-pointer"
                      >
                        <CloudOff className="h-3.5 w-3.5" />
                        Pakai Mode Lokal
                      </button>
                    )}
                  </div>

                  {!isViewer && (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!urlValidation.valid}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {hasUnsavedUrlEdit ? 'Simpan URL & Sinkronisasi' : 'Simpan & Sinkronisasi'}
                    </button>
                  )}
                </div>
              </section>

              {/* Sync Control Center */}
              <section className="flex flex-col gap-3.5 rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div>
                  <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                    Kontrol Sinkronisasi &amp; Pengaman Konflik
                  </h2>
                  <p className="mt-0.5 text-xs text-[#64748b]">
                    Membandingkan fingerprint data Lokal vs Cloud sebelum menarik atau mengunggah
                    agar perubahan tidak tertimpa secara tidak sengaja.
                  </p>
                </div>

                {syncMeta.lastError && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-[#fef3c7] px-3.5 py-2.5 text-xs text-[#b45309]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div>
                      <div className="font-bold">Catatan Sinkronisasi Terakhir</div>
                      <div>{syncMeta.lastError}</div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => handleSyncIntent('retry')}
                    disabled={!isCloudReady || isViewer || syncActionBusy !== null}
                    className={`flex h-9.5 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
                      syncMeta.pendingLocalChanges
                        ? 'bg-[#f59e0b] text-white hover:bg-[#d97706]'
                        : 'bg-[#f3f7f5] text-[#13222b] hover:bg-[#e1ebe7]'
                    }`}
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${syncActionBusy === 'retry' ? 'animate-spin' : ''}`}
                    />
                    {syncActionBusy === 'retry' ? 'Menyinkronkan…' : 'Coba Sinkron Ulang'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSyncIntent('pull')}
                    disabled={!isCloudReady || syncActionBusy !== null}
                    className="flex h-9.5 items-center justify-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e6f7ee] hover:text-[#15803d] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 text-[#2eb86b]" />
                    {syncActionBusy === 'pull' ? 'Memeriksa…' : 'Tarik Data Cloud'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSyncIntent('push')}
                    disabled={!isCloudReady || isViewer || syncActionBusy !== null}
                    className="flex h-9.5 items-center justify-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e6f7ee] hover:text-[#15803d] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5 text-[#2eb86b]" />
                    {syncActionBusy === 'push' ? 'Mengunggah…' : 'Unggah ke Sheets'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edf2f0] pt-3.5 text-xs text-[#64748b]">
                  <span>
                    Simpan lokal terakhir:{' '}
                    <strong className="font-mono-num font-semibold text-[#13222b]">
                      {formatIsoTime(syncMeta.lastLocalWriteAt)}
                    </strong>
                  </span>
                  <span>
                    Status antrean:{' '}
                    <strong
                      className={
                        syncMeta.pendingLocalChanges ? 'text-[#b45309]' : 'text-[#15803d]'
                      }
                    >
                      {syncMeta.pendingLocalChanges
                        ? 'Menunggu unggah ke Cloud'
                        : 'Tidak ada antrean tertunda'}
                    </strong>
                  </span>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              <section className="flex flex-col gap-3.5 rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                  Cara Menghubungkan Google Sheets
                </h2>
                <ol className="list-decimal space-y-2 pl-5 text-xs leading-relaxed text-[#475569]">
                  {SETUP_STEPS.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>

                <div className="border-t border-[#edf2f0] pt-3.5">
                  <div className="mb-1.5 text-[11.5px] font-semibold text-[#13222b]">
                    13 Sheet otomatis yang dikelola backend Code.gs
                  </div>
                  <p className="font-mono-num text-[11.5px] leading-relaxed text-[#64748b]">
                    {SHEETS_LIST.join(' · ')}
                  </p>
                </div>
              </section>

              <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                  Arsitektur Global, Mode Lokal &amp; Keamanan Server
                </h2>

                <div className="space-y-2.5 text-xs leading-relaxed text-[#475569]">
                  <p>
                    <strong className="text-[#13222b]">Satu Service API Global:</strong> Seluruh 9
                    modul operasional membaca dan menulis melalui satu layanan API terpusat dengan
                    kontrak aksi resmi (<span className="font-mono-num">getData</span>,{' '}
                    <span className="font-mono-num">saveData</span>,{' '}
                    <span className="font-mono-num">ping</span>,{' '}
                    <span className="font-mono-num">login</span>,{' '}
                    <span className="font-mono-num">me</span>,{' '}
                    <span className="font-mono-num">changePwd</span>,{' '}
                    <span className="font-mono-num">sendTelegram</span>).
                  </p>
                  <p>
                    <strong className="text-[#13222b]">Ketahanan Mode Lokal:</strong> Saat koneksi
                    internet atau Google Apps Script tidak tersedia, seluruh perubahan disimpan
                    otomatis ke <span className="font-mono-num">localStorage</span> agar data tidak
                    hilang dan dapat disinkronisasi ulang saat koneksi aktif kembali.
                  </p>
                  <p>
                    <strong className="text-[#13222b]">Validasi Hak Akses di Backend:</strong>{' '}
                    Setiap permintaan baca/tulis menyertakan{' '}
                    <span className="font-mono-num">token</span> sesi untuk diverifikasi autentikasi
                    (<span className="font-mono-num">AUTH</span>) dan otorisasi peran (
                    <span className="font-mono-num">FORBIDDEN</span> untuk Viewer) langsung oleh
                    server Google Apps Script.
                  </p>
                </div>

                <div className="border-t border-[#edf2f0] pt-3.5">
                  <div className="mb-1.5 text-[11.5px] font-semibold text-[#13222b]">
                    Modul terhubung
                  </div>
                  <p className="text-xs leading-relaxed text-[#15803d]">
                    {CONNECTED_MODULES.join(' · ')}
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL PENYELESAIAN KONFLIK SINKRONISASI */}
      {syncConflict && (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="flex items-start justify-between gap-2 border-b border-[#edf2f0] px-6 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#13222b]">
                  Konfirmasi Penyelesaian Konflik Data
                </h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  Mencegah penimpaan data lokal maupun Google Sheets secara tidak sengaja
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleResolveConflict('cancel')}
                disabled={resolvingConflict}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5">
              <p className="text-xs leading-relaxed text-[#475569]">{syncConflict.message}</p>

              <div className="mt-3.5 overflow-hidden rounded-xl border border-[#edf2f0]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f7faf9] text-[11px] font-bold uppercase tracking-[0.04em] text-[#64748b]">
                    <tr className="border-b border-[#edf2f0]">
                      <th className="px-3.5 py-2.5">Data Modul</th>
                      <th className="px-3.5 py-2.5 text-right text-[#b45309]">Lokal</th>
                      <th className="px-3.5 py-2.5 text-right text-[#15803d]">Cloud</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono-num divide-y divide-[#edf2f0]">
                    <tr>
                      <td className="px-3.5 py-2 font-sans text-[#475569]">Master Item</td>
                      <td className="px-3.5 py-2 text-right font-bold text-[#13222b]">
                        {syncConflict.localSummary.totalItems}
                      </td>
                      <td className="px-3.5 py-2 text-right font-bold text-[#13222b]">
                        {syncConflict.cloudSummary ? syncConflict.cloudSummary.totalItems : 'Kosong'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3.5 py-2 font-sans text-[#475569]">Periode Stok</td>
                      <td className="px-3.5 py-2 text-right font-bold text-[#13222b]">
                        {syncConflict.localSummary.stockMonths.length} bln
                      </td>
                      <td className="px-3.5 py-2 text-right font-bold text-[#13222b]">
                        {syncConflict.cloudSummary
                          ? `${syncConflict.cloudSummary.stockMonths.length} bln`
                          : 'Kosong'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3.5 py-2 font-sans text-[#475569]">Transaksi OMSET</td>
                      <td className="px-3.5 py-2 text-right font-bold text-[#13222b]">
                        {syncConflict.localSummary.omsetDaysCount} hr
                      </td>
                      <td className="px-3.5 py-2 text-right font-bold text-[#13222b]">
                        {syncConflict.cloudSummary
                          ? `${syncConflict.cloudSummary.omsetDaysCount} hr`
                          : 'Kosong'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3.5 py-2 font-sans text-[#475569]">Karyawan</td>
                      <td className="px-3.5 py-2 text-right font-bold text-[#13222b]">
                        {syncConflict.localSummary.employeeCount}
                      </td>
                      <td className="px-3.5 py-2 text-right font-bold text-[#13222b]">
                        {syncConflict.cloudSummary
                          ? syncConflict.cloudSummary.employeeCount
                          : 'Kosong'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3.5 py-2 font-sans text-[#475569]">Periode Absensi</td>
                      <td className="px-3.5 py-2 text-right font-bold text-[#13222b]">
                        {syncConflict.localSummary.attendanceMonths.length} bln
                      </td>
                      <td className="px-3.5 py-2 text-right font-bold text-[#13222b]">
                        {syncConflict.cloudSummary
                          ? `${syncConflict.cloudSummary.attendanceMonths.length} bln`
                          : 'Kosong'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-3.5 rounded-xl bg-[#e6f7ee] px-3.5 py-2.5 text-[11.5px] text-[#15803d]">
                Jika Anda memilih <strong>Gunakan Data Cloud</strong>, sistem otomatis menyimpan
                cadangan data lokal saat ini sebelum menggantinya (dapat dipulihkan dari menu
                Laporan &amp; Ekspor).
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-6 py-3.5">
              <button
                type="button"
                disabled={resolvingConflict}
                onClick={() => handleResolveConflict('cancel')}
                className="h-9 rounded-xl bg-[#eef3f1] px-4 text-xs font-semibold text-[#13222b] hover:bg-[#e1ebe7] cursor-pointer"
              >
                Batal
              </button>
              {syncConflict.cloudData && (
                <button
                  type="button"
                  disabled={resolvingConflict}
                  onClick={() => handleResolveConflict('use_cloud')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0d2530] px-4 text-xs font-semibold text-white hover:bg-[#173a4a] disabled:opacity-60 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Gunakan Data Cloud
                </button>
              )}
              {!isViewer && (
                <button
                  type="button"
                  disabled={resolvingConflict}
                  onClick={() => handleResolveConflict('use_local')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white hover:bg-[#259f5b] disabled:opacity-60 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Unggah Data Lokal ke Cloud
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
