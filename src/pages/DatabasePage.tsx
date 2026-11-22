import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  Database,
  Download,
  HardDrive,
  KeyRound,
  Lock,
  LogIn,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
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
          tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
          icon: Cloud,
        }
      : dbMode === 'cloud_connected'
        ? {
            title: 'Terhubung ke Google Sheets',
            desc: 'Terhubung via Web App Deploy URL dengan sesi token terverifikasi server.',
            tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
            icon: Wifi,
          }
        : dbMode === 'cloud_unauth'
          ? {
              title: 'URL Terpasang · Belum Login',
              desc: 'Web App URL sudah tersimpan, namun sesi token belum aktif. Data sementara memakai cache lokal hingga Anda login.',
              tone: 'border-amber-200 bg-amber-50 text-amber-900',
              icon: KeyRound,
            }
          : {
              title: 'Mode Lokal (localStorage)',
              desc: 'Aplikasi berjalan mandiri tanpa cloud. Seluruh transaksi tersimpan aman di browser dan dapat disinkronkan saat URL dipasang.',
              tone: 'border-teal-200 bg-[#e6f6f4] text-[#12857c]',
              icon: HardDrive,
            };

  const ConnectionIcon = connectionBadge.icon;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 px-5 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e6f6f4] text-[#1a9e94]">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight text-[#1f2a36]">
              Koneksi Database
            </h1>
            <p className="text-[11px] text-slate-500">
              Pusat koneksi Google Apps Script, cache lokal, sinkronisasi, &amp; pengaman konflik
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dbMode === 'cloud_unauth' && (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0f172a] px-3 text-xs font-bold text-white hover:bg-[#1e293b]"
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
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncActionBusy === 'retry' ? 'animate-spin' : ''}`}
              />
              Coba Sinkronisasi Ulang
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="dg-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {/* Top 4-Card Status Summary */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Mode Koneksi</span>
              <ConnectionIcon className="h-4 w-4 text-[#1a9e94]" />
            </div>
            <div className="mt-1 text-xs font-bold text-[#1f2a36]">{connectionBadge.title}</div>
            <div className="mt-1 text-[11px] text-slate-500">
              Kontrak API: <code className="font-mono-num">Google Apps Script</code>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Status Sinkronisasi</span>
              {syncConflict ? (
                <ShieldAlert className="h-4 w-4 text-rose-500" />
              ) : syncMeta.pendingLocalChanges ? (
                <WifiOff className="h-4 w-4 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
            </div>
            <div
              className={`mt-1 text-xs font-bold ${
                syncConflict || sync.isError
                  ? 'text-rose-700'
                  : syncMeta.pendingLocalChanges
                    ? 'text-amber-700'
                    : 'text-emerald-700'
              }`}
            >
              {syncConflict
                ? 'Konflik — Perlu Konfirmasi'
                : syncMeta.pendingLocalChanges
                  ? 'Ada Perubahan Lokal Tertunda'
                  : sync.text}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Sinkron cloud terakhir:{' '}
              <span className="font-mono-num font-semibold text-slate-700">
                {formatIsoTime(syncMeta.lastCloudSyncAt)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Cache Lokal (localStorage)</span>
              <HardDrive className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-1 font-mono-num text-xs font-bold text-[#1f2a36]">
              {cacheStats.hasCache ? `${cacheStats.sizeKb} KB tersimpan` : 'Belum ada cache'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {dataSummary.totalItems} item · {dataSummary.stockMonths.length} bln stok ·{' '}
              {dataSummary.omsetDaysCount} hr omset
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Hak Akses &amp; Otorisasi</span>
              <Lock className="h-4 w-4 text-[#1a9e94]" />
            </div>
            <div className="mt-1 text-xs font-bold text-[#1f2a36]">
              {user?.nama || user?.username || 'Mode Lokal'} (
              {isViewer ? 'Viewer · Hanya Baca' : 'Admin · Baca & Tulis'})
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Validasi token &amp; peran aktif di server GAS
            </div>
          </div>
        </div>

        {/* Conflict Warning Banner (Always Prominent if Conflict Detected) */}
        {syncConflict && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                <div>
                  <div className="text-xs font-bold text-rose-900">
                    Konflik Sinkronisasi Terdeteksi — Penimpaan Otomatis Dicegah
                  </div>
                  <p className="mt-0.5 text-xs text-rose-800">{syncConflict.message}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {syncConflict.cloudData && (
                  <button
                    type="button"
                    disabled={resolvingConflict}
                    onClick={() => handleResolveConflict('use_cloud')}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5 text-[#1a9e94]" />
                    Gunakan Data Cloud
                  </button>
                )}
                {!isViewer && (
                  <button
                    type="button"
                    disabled={resolvingConflict}
                    onClick={() => handleResolveConflict('use_local')}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-3 text-xs font-bold text-white hover:bg-[#12857c]"
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
          {/* LEFT COLUMN: URL Config + Sync Controls */}
          <div className="space-y-4">
            <section className="flex flex-col gap-3.5 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[#1f2a36]">Pengaturan Web App URL</h2>
                {apiUrl && (
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono-num text-[10px] font-semibold text-slate-600">
                    Global API Service
                  </span>
                )}
              </div>

              <div className={`rounded-lg border px-3.5 py-2.5 text-xs ${connectionBadge.tone}`}>
                <div className="font-bold">{connectionBadge.title}</div>
                <p className="mt-0.5 leading-relaxed opacity-90">{connectionBadge.desc}</p>
              </div>

              <div>
                <label
                  htmlFor="db-url-input"
                  className="mb-1.5 block text-xs font-bold text-[#1f2a36]"
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
                    className={`h-9 min-w-0 flex-1 rounded-lg border bg-white px-3 font-mono-num text-xs text-[#1f2a36] outline-none focus:border-[#1a9e94] disabled:bg-slate-100 ${
                      !urlValidation.valid ? 'border-rose-400' : 'border-slate-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing || !urlInput.trim() || !urlValidation.valid}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-[#1f2a36] hover:bg-slate-50 whitespace-nowrap disabled:opacity-50"
                  >
                    {testing ? 'Menguji…' : 'Tes Koneksi'}
                  </button>
                </div>
                {!urlValidation.valid ? (
                  <p className="mt-1 text-[11px] font-medium text-rose-600">
                    {urlValidation.error}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Kosongkan URL untuk menjalankan aplikasi di Mode Lokal (localStorage). Mengganti
                    URL akan meminta login ulang ke database tujuan.
                  </p>
                )}
              </div>

              {/* Action Status Feedback */}
              {statusMsg && (
                <div
                  className={`rounded-lg border px-3.5 py-2.5 text-xs ${
                    statusMsg.type === 'ok'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : statusMsg.type === 'warn'
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
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
                        <div className="flex flex-wrap gap-1 pt-1">
                          {statusMsg.sheets.map((s) => (
                            <code
                              key={s}
                              className="rounded border border-emerald-200 bg-white px-1.5 py-0.5 font-mono-num text-[10px] text-emerald-900"
                            >
                              {s}
                            </code>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setStatusMsg(null)}
                      className="rounded p-0.5 hover:bg-black/5"
                      aria-label="Tutup pesan"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* URL Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetDefaultUrl}
                    disabled={isViewer}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Bawaan
                  </button>
                  {apiUrl && !isViewer && (
                    <button
                      type="button"
                      onClick={handleSwitchLocalMode}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <CloudOff className="h-3.5 w-3.5 text-slate-500" />
                      Pakai Mode Lokal
                    </button>
                  )}
                </div>

                {!isViewer && (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!urlValidation.valid}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-4 text-xs font-bold text-white hover:bg-[#12857c] disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {hasUnsavedUrlEdit ? 'Simpan URL & Sinkronisasi' : 'Simpan & Sinkronisasi'}
                  </button>
                )}
              </div>
            </section>

            {/* Sync Control Center Card */}
            <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-[#1f2a36]">
                    Kontrol Sinkronisasi &amp; Pengaman Konflik
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Membandingkan fingerprint data Lokal vs Cloud sebelum menarik atau mengunggah
                    agar perubahan tidak tertimpa secara tidak sengaja.
                  </p>
                </div>
              </div>

              {syncMeta.lastError && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <div className="font-semibold">Catatan Sinkronisasi Terakhir</div>
                    <div>{syncMeta.lastError}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => handleSyncIntent('retry')}
                  disabled={!isCloudReady || isViewer || syncActionBusy !== null}
                  className={`flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    syncMeta.pendingLocalChanges
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
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
                  className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#1f2a36] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5 text-[#1a9e94]" />
                  {syncActionBusy === 'pull' ? 'Memeriksa…' : 'Tarik Data Cloud'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSyncIntent('push')}
                  disabled={!isCloudReady || isViewer || syncActionBusy !== null}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-[#1f2a36] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5 text-[#1a9e94]" />
                  {syncActionBusy === 'push' ? 'Mengunggah…' : 'Unggah ke Sheets'}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                <span>
                  Simpan lokal terakhir:{' '}
                  <strong className="font-mono-num text-slate-800">
                    {formatIsoTime(syncMeta.lastLocalWriteAt)}
                  </strong>
                </span>
                <span>
                  Status antrean:{' '}
                  <strong
                    className={
                      syncMeta.pendingLocalChanges ? 'text-amber-700' : 'text-emerald-700'
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

          {/* RIGHT COLUMN: Setup Guide, Sheets, Architecture & Security */}
          <div className="space-y-4">
            <section className="flex flex-col gap-3.5 rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold text-[#1f2a36]">Cara Menghubungkan Google Sheets</h2>
              <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-700">
                {SETUP_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              <div className="border-t border-slate-200 pt-3">
                <div className="mb-1.5 text-[11px] font-semibold text-slate-500">
                  13 Sheet otomatis yang dikelola oleh backend Code.gs:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SHEETS_LIST.map((sheet) => (
                    <code
                      key={sheet}
                      className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono-num text-[11px] text-slate-700"
                    >
                      {sheet}
                    </code>
                  ))}
                </div>
              </div>
            </section>

            {/* Unified Architecture & Backend Auth Info */}
            <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#1a9e94]" />
                <h2 className="text-sm font-bold text-[#1f2a36]">
                  Integrasi Global, Mode Lokal &amp; Keamanan Server
                </h2>
              </div>

              <div className="space-y-2 text-xs leading-relaxed text-slate-600">
                <p>
                  <strong className="text-[#1f2a36]">Satu Service API Global:</strong> Seluruh 9
                  modul operasional membaca dan menulis melalui satu layanan API terpusat dengan
                  kontrak aksi resmi (<code className="font-mono-num">getData</code>,{' '}
                  <code className="font-mono-num">saveData</code>,{' '}
                  <code className="font-mono-num">ping</code>,{' '}
                  <code className="font-mono-num">login</code>,{' '}
                  <code className="font-mono-num">me</code>,{' '}
                  <code className="font-mono-num">changePwd</code>,{' '}
                  <code className="font-mono-num">sendTelegram</code>).
                </p>
                <p>
                  <strong className="text-[#1f2a36]">Ketahanan Mode Lokal:</strong> Saat koneksi
                  internet atau Google Apps Script tidak tersedia, seluruh perubahan tetap disimpan
                  otomatis ke <code className="font-mono-num">localStorage</code> agar data tidak
                  hilang dan dapat disinkronisasi ulang saat koneksi kembali aktif.
                </p>
                <p>
                  <strong className="text-[#1f2a36]">Validasi Hak Akses di Backend:</strong> Selain
                  pengaturan antarmuka berdasarkan peran, setiap permintaan baca/tulis selalu
                  menyertakan <code className="font-mono-num">token</code> sesi untuk diverifikasi
                  autentikasi (<code className="font-mono-num">AUTH</code>) dan otorisasi peran (
                  <code className="font-mono-num">FORBIDDEN</code> untuk akun Viewer) langsung oleh
                  server Google Apps Script.
                </p>
              </div>

              <div className="border-t border-slate-200 pt-2.5">
                <div className="mb-1.5 text-[11px] font-semibold text-slate-500">
                  Modul yang terhubung ke sistem database ini:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CONNECTED_MODULES.map((mod) => (
                    <span
                      key={mod}
                      className="rounded-md bg-[#eefaf8] px-2 py-0.5 text-[11px] font-semibold text-[#12857c]"
                    >
                      {mod}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ================= MODAL PENYELESAIAN KONFLIK SINKRONISASI ================= */}
      {syncConflict && (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1f2a36]">
                    Konfirmasi Penyelesaian Konflik Data
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mencegah penimpaan data lokal maupun Google Sheets secara tidak sengaja
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleResolveConflict('cancel')}
                disabled={resolvingConflict}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-600">{syncConflict.message}</p>

            {/* Side-by-side Data Comparison */}
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">Data Modul</th>
                    <th className="px-3 py-2 text-right text-amber-800">Lokal (Perangkat Ini)</th>
                    <th className="px-3 py-2 text-right text-[#12857c]">Google Sheets (Cloud)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-num">
                  <tr>
                    <td className="px-3 py-1.5 font-sans text-slate-700">Master Item</td>
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {syncConflict.localSummary.totalItems}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {syncConflict.cloudSummary ? syncConflict.cloudSummary.totalItems : 'Kosong'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 font-sans text-slate-700">Periode Stok</td>
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {syncConflict.localSummary.stockMonths.length} bln
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {syncConflict.cloudSummary
                        ? `${syncConflict.cloudSummary.stockMonths.length} bln`
                        : 'Kosong'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 font-sans text-slate-700">Transaksi OMSET</td>
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {syncConflict.localSummary.omsetDaysCount} hr
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {syncConflict.cloudSummary
                        ? `${syncConflict.cloudSummary.omsetDaysCount} hr`
                        : 'Kosong'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 font-sans text-slate-700">Karyawan</td>
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {syncConflict.localSummary.employeeCount}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {syncConflict.cloudSummary
                        ? syncConflict.cloudSummary.employeeCount
                        : 'Kosong'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 font-sans text-slate-700">Periode Absensi</td>
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {syncConflict.localSummary.attendanceMonths.length} bln
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {syncConflict.cloudSummary
                        ? `${syncConflict.cloudSummary.attendanceMonths.length} bln`
                        : 'Kosong'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900">
              Jika Anda memilih <strong>Gunakan Data Cloud</strong>, sistem otomatis menyimpan
              cadangan data lokal saat ini sebelum menggantinya (dapat dipulihkan kapan saja dari
              menu Laporan &amp; Ekspor).
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={resolvingConflict}
                onClick={() => handleResolveConflict('cancel')}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              {syncConflict.cloudData && (
                <button
                  type="button"
                  disabled={resolvingConflict}
                  onClick={() => handleResolveConflict('use_cloud')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-800 px-3.5 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-60"
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
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-3.5 text-xs font-bold text-white hover:bg-[#12857c] disabled:opacity-60"
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
