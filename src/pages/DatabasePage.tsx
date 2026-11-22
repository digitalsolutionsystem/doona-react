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
          tone: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]',
          icon: Cloud,
        }
      : dbMode === 'cloud_connected'
        ? {
            title: 'Terhubung ke Google Sheets',
            desc: 'Terhubung via Web App Deploy URL dengan sesi token terverifikasi server.',
            tone: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]',
            icon: Wifi,
          }
        : dbMode === 'cloud_unauth'
          ? {
              title: 'URL Terpasang · Belum Login',
              desc: 'Web App URL sudah tersimpan, namun sesi token belum aktif. Data sementara memakai cache lokal hingga Anda login.',
              tone: 'border-[#f3d692] bg-[#fffcf2] text-[#92400e]',
              icon: KeyRound,
            }
          : {
              title: 'Mode Lokal (localStorage)',
              desc: 'Aplikasi berjalan mandiri tanpa cloud. Seluruh transaksi tersimpan aman di browser dan dapat disinkronkan saat URL dipasang.',
              tone: 'border-[#e5e5df] bg-[#fafaf8] text-[#141816]',
              icon: HardDrive,
            };

  const ConnectionIcon = connectionBadge.icon;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f7f4]">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e5e5df] bg-white px-5 py-3.5 md:px-6">
        <div>
          <h1 className="font-display text-lg font-semibold text-[#141816]">Koneksi Database</h1>
          <p className="text-xs text-[#7c8580]">
            Pusat koneksi Google Apps Script, cache lokal, sinkronisasi, &amp; pengaman konflik
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dbMode === 'cloud_unauth' && (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-[#14533c] px-3.5 text-xs font-medium text-white hover:bg-[#0f3f2d] cursor-pointer"
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
              className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-[#b45309] px-3.5 text-xs font-medium text-white hover:bg-[#92400e] disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncActionBusy === 'retry' ? 'animate-spin' : ''}`}
              />
              Coba Sinkronisasi Ulang
            </button>
          )}
        </div>
      </header>

      {/* Scrollable Body */}
      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
        <div className="mx-auto max-w-[1360px] space-y-5">
          {/* Unified 4-Column Status Strip */}
          <section className="grid grid-cols-1 divide-y divide-[#efefea] overflow-hidden rounded-xl border border-[#e5e5df] bg-white sm:grid-cols-2 sm:divide-y-0 sm:divide-x xl:grid-cols-4">
            <div className="px-5 py-4">
              <div className="flex items-center justify-between text-xs text-[#565e59]">
                <span>Mode Koneksi</span>
                <ConnectionIcon className="h-3.5 w-3.5 text-[#14533c]" />
              </div>
              <div className="mt-1.5 text-[13.5px] font-semibold text-[#141816]">
                {connectionBadge.title}
              </div>
              <div className="mt-1 text-[11.5px] text-[#7c8580]">
                Kontrak API · <span className="font-mono-num">Google Apps Script</span>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center justify-between text-xs text-[#565e59]">
                <span>Status Sinkronisasi</span>
                {syncConflict ? (
                  <ShieldAlert className="h-3.5 w-3.5 text-[#b91c1c]" />
                ) : syncMeta.pendingLocalChanges ? (
                  <WifiOff className="h-3.5 w-3.5 text-[#b45309]" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#15803d]" />
                )}
              </div>
              <div
                className={`mt-1.5 text-[13.5px] font-semibold ${
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
                    ? 'Ada Perubahan Lokal Tertunda'
                    : sync.text}
              </div>
              <div className="mt-1 text-[11.5px] text-[#7c8580]">
                Sinkron terakhir ·{' '}
                <span className="font-mono-num font-medium text-[#141816]">
                  {formatIsoTime(syncMeta.lastCloudSyncAt)}
                </span>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center justify-between text-xs text-[#565e59]">
                <span>Cache Lokal</span>
                <HardDrive className="h-3.5 w-3.5 text-[#7c8580]" />
              </div>
              <div className="font-mono-num mt-1.5 text-[13.5px] font-semibold text-[#141816]">
                {cacheStats.hasCache ? `${cacheStats.sizeKb} KB tersimpan` : 'Belum ada cache'}
              </div>
              <div className="mt-1 text-[11.5px] text-[#7c8580]">
                {dataSummary.totalItems} item · {dataSummary.stockMonths.length} bln stok ·{' '}
                {dataSummary.omsetDaysCount} hr omset
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center justify-between text-xs text-[#565e59]">
                <span>Hak Akses &amp; Otorisasi</span>
                <Lock className="h-3.5 w-3.5 text-[#14533c]" />
              </div>
              <div className="mt-1.5 text-[13.5px] font-semibold text-[#141816]">
                {user?.nama || user?.username || 'Mode Lokal'}
              </div>
              <div className="mt-1 text-[11.5px] text-[#7c8580]">
                {isViewer ? 'Viewer · Hanya Baca' : 'Admin · Baca & Tulis'} · Validasi server GAS
              </div>
            </div>
          </section>

          {/* Conflict Warning Banner */}
          {syncConflict && (
            <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#b91c1c]" />
                  <div>
                    <div className="text-xs font-semibold text-[#991b1b]">
                      Konflik Sinkronisasi Terdeteksi — Penimpaan Otomatis Dicegah
                    </div>
                    <p className="mt-0.5 text-xs text-[#991b1b]/90">{syncConflict.message}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {syncConflict.cloudData && (
                    <button
                      type="button"
                      disabled={resolvingConflict}
                      onClick={() => handleResolveConflict('use_cloud')}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] hover:bg-[#f3f3ee] cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 text-[#14533c]" />
                      Gunakan Data Cloud
                    </button>
                  )}
                  {!isViewer && (
                    <button
                      type="button"
                      disabled={resolvingConflict}
                      onClick={() => handleResolveConflict('use_local')}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#14533c] px-3 text-xs font-medium text-white hover:bg-[#0f3f2d] cursor-pointer"
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
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.15fr_1fr]">
            {/* LEFT COLUMN */}
            <div className="space-y-5">
              <section className="flex flex-col gap-4 rounded-xl border border-[#e5e5df] bg-white p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-[15px] font-semibold text-[#141816]">
                    Pengaturan Web App URL
                  </h2>
                  {apiUrl && (
                    <span className="font-mono-num text-[11px] text-[#7c8580]">
                      Global API Service
                    </span>
                  )}
                </div>

                <div className={`rounded-lg border px-3.5 py-2.5 text-xs ${connectionBadge.tone}`}>
                  <div className="font-semibold">{connectionBadge.title}</div>
                  <p className="mt-0.5 leading-relaxed opacity-90">{connectionBadge.desc}</p>
                </div>

                <div>
                  <label
                    htmlFor="db-url-input"
                    className="mb-1.5 block text-xs font-medium text-[#141816]"
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
                      className={`font-mono-num h-9 min-w-0 flex-1 rounded-md border bg-white px-3 text-xs text-[#141816] outline-none focus:border-[#14533c] disabled:bg-[#fafaf8] ${
                        !urlValidation.valid ? 'border-[#dc2626]' : 'border-[#e5e5df]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleTest}
                      disabled={testing || !urlInput.trim() || !urlValidation.valid}
                      className="h-9 rounded-md border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#141816] hover:bg-[#f3f3ee] whitespace-nowrap disabled:opacity-50 cursor-pointer"
                    >
                      {testing ? 'Menguji…' : 'Tes Koneksi'}
                    </button>
                  </div>
                  {!urlValidation.valid ? (
                    <p className="mt-1 text-[11px] font-medium text-[#b91c1c]">
                      {urlValidation.error}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[11.5px] text-[#7c8580]">
                      Kosongkan URL untuk menjalankan aplikasi di Mode Lokal (localStorage).
                      Mengganti URL akan meminta login ulang ke database tujuan.
                    </p>
                  )}
                </div>

                {statusMsg && (
                  <div
                    className={`rounded-lg border px-3.5 py-2.5 text-xs ${
                      statusMsg.type === 'ok'
                        ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
                        : statusMsg.type === 'warn'
                          ? 'border-[#f3d692] bg-[#fffcf2] text-[#92400e]'
                          : 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="font-medium">{statusMsg.text}</div>
                        {statusMsg.spreadsheetName && (
                          <div>
                            Spreadsheet: <strong>{statusMsg.spreadsheetName}</strong>
                          </div>
                        )}
                        {statusMsg.sheets && statusMsg.sheets.length > 0 && (
                          <div className="font-mono-num pt-1 text-[11px] opacity-85">
                            {statusMsg.sheets.join(' · ')}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setStatusMsg(null)}
                        className="rounded p-0.5 hover:bg-black/5 cursor-pointer"
                        aria-label="Tutup pesan"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#efefea] pt-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetDefaultUrl}
                      disabled={isViewer}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#565e59] hover:bg-[#f3f3ee] hover:text-[#141816] disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset Bawaan
                    </button>
                    {apiUrl && !isViewer && (
                      <button
                        type="button"
                        onClick={handleSwitchLocalMode}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#565e59] hover:bg-[#f3f3ee] hover:text-[#141816] cursor-pointer"
                      >
                        <CloudOff className="h-3.5 w-3.5 text-[#7c8580]" />
                        Pakai Mode Lokal
                      </button>
                    )}
                  </div>

                  {!isViewer && (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!urlValidation.valid}
                      className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-[#14533c] px-4 text-xs font-medium text-white hover:bg-[#0f3f2d] disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {hasUnsavedUrlEdit ? 'Simpan URL & Sinkronisasi' : 'Simpan & Sinkronisasi'}
                    </button>
                  )}
                </div>
              </section>

              {/* Sync Control Center */}
              <section className="flex flex-col gap-3.5 rounded-xl border border-[#e5e5df] bg-white p-5">
                <div>
                  <h2 className="font-display text-[15px] font-semibold text-[#141816]">
                    Kontrol Sinkronisasi &amp; Pengaman Konflik
                  </h2>
                  <p className="mt-0.5 text-xs text-[#7c8580]">
                    Membandingkan fingerprint data Lokal vs Cloud sebelum menarik atau mengunggah
                    agar perubahan tidak tertimpa secara tidak sengaja.
                  </p>
                </div>

                {syncMeta.lastError && (
                  <div className="flex items-start gap-2 rounded-lg border border-[#f3d692] bg-[#fffcf2] px-3 py-2 text-xs text-[#92400e]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b45309]" />
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
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
                      syncMeta.pendingLocalChanges
                        ? 'bg-[#b45309] text-white hover:bg-[#92400e]'
                        : 'border border-[#e5e5df] bg-[#fafaf8] text-[#141816] hover:bg-[#f3f3ee]'
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
                    className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] hover:bg-[#f3f3ee] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 text-[#14533c]" />
                    {syncActionBusy === 'pull' ? 'Memeriksa…' : 'Tarik Data Cloud'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSyncIntent('push')}
                    disabled={!isCloudReady || isViewer || syncActionBusy !== null}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] hover:bg-[#f3f3ee] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5 text-[#14533c]" />
                    {syncActionBusy === 'push' ? 'Mengunggah…' : 'Unggah ke Sheets'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#efefea] pt-3 text-xs text-[#565e59]">
                  <span>
                    Simpan lokal terakhir:{' '}
                    <strong className="font-mono-num font-medium text-[#141816]">
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
            <div className="space-y-5">
              <section className="flex flex-col gap-3.5 rounded-xl border border-[#e5e5df] bg-white p-5">
                <h2 className="font-display text-[15px] font-semibold text-[#141816]">
                  Cara Menghubungkan Google Sheets
                </h2>
                <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-[#565e59]">
                  {SETUP_STEPS.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>

                <div className="border-t border-[#efefea] pt-3">
                  <div className="mb-1 text-[11.5px] font-medium text-[#565e59]">
                    13 Sheet otomatis yang dikelola backend Code.gs
                  </div>
                  <p className="font-mono-num text-[11.5px] leading-relaxed text-[#7c8580]">
                    {SHEETS_LIST.join(' · ')}
                  </p>
                </div>
              </section>

              <section className="flex flex-col gap-3 rounded-xl border border-[#e5e5df] bg-white p-5">
                <h2 className="font-display text-[15px] font-semibold text-[#141816]">
                  Arsitektur Global, Mode Lokal &amp; Keamanan Server
                </h2>

                <div className="space-y-2.5 text-xs leading-relaxed text-[#565e59]">
                  <p>
                    <strong className="text-[#141816]">Satu Service API Global:</strong> Seluruh 9
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
                    <strong className="text-[#141816]">Ketahanan Mode Lokal:</strong> Saat koneksi
                    internet atau Google Apps Script tidak tersedia, seluruh perubahan disimpan
                    otomatis ke <span className="font-mono-num">localStorage</span> agar data tidak
                    hilang dan dapat disinkronisasi ulang saat koneksi aktif kembali.
                  </p>
                  <p>
                    <strong className="text-[#141816]">Validasi Hak Akses di Backend:</strong>{' '}
                    Setiap permintaan baca/tulis menyertakan{' '}
                    <span className="font-mono-num">token</span> sesi untuk diverifikasi autentikasi
                    (<span className="font-mono-num">AUTH</span>) dan otorisasi peran (
                    <span className="font-mono-num">FORBIDDEN</span> untuk Viewer) langsung oleh
                    server Google Apps Script.
                  </p>
                </div>

                <div className="border-t border-[#efefea] pt-3">
                  <div className="mb-1 text-[11.5px] font-medium text-[#565e59]">
                    Modul terhubung
                  </div>
                  <p className="text-xs leading-relaxed text-[#14533c]">
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
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-[#111614]/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#e5e5df] bg-white shadow-[0_24px_60px_rgba(17,22,20,0.18)]">
            <div className="flex items-start justify-between gap-2 border-b border-[#e5e5df] px-5 py-4">
              <div>
                <h3 className="font-display text-base font-semibold text-[#141816]">
                  Konfirmasi Penyelesaian Konflik Data
                </h3>
                <p className="mt-0.5 text-xs text-[#565e59]">
                  Mencegah penimpaan data lokal maupun Google Sheets secara tidak sengaja
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleResolveConflict('cancel')}
                disabled={resolvingConflict}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#7c8580] hover:bg-[#f3f3ee] hover:text-[#141816] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="text-xs leading-relaxed text-[#565e59]">{syncConflict.message}</p>

              <div className="mt-3 overflow-hidden rounded-lg border border-[#e5e5df]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#fafaf8] text-[11px] font-medium text-[#565e59]">
                    <tr className="border-b border-[#e5e5df]">
                      <th className="px-3 py-2">Data Modul</th>
                      <th className="px-3 py-2 text-right text-[#b45309]">Lokal (Perangkat Ini)</th>
                      <th className="px-3 py-2 text-right text-[#14533c]">Google Sheets (Cloud)</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono-num divide-y divide-[#efefea]">
                    <tr>
                      <td className="px-3 py-1.5 font-sans text-[#565e59]">Master Item</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-[#141816]">
                        {syncConflict.localSummary.totalItems}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold text-[#141816]">
                        {syncConflict.cloudSummary ? syncConflict.cloudSummary.totalItems : 'Kosong'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-sans text-[#565e59]">Periode Stok</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-[#141816]">
                        {syncConflict.localSummary.stockMonths.length} bln
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold text-[#141816]">
                        {syncConflict.cloudSummary
                          ? `${syncConflict.cloudSummary.stockMonths.length} bln`
                          : 'Kosong'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-sans text-[#565e59]">Transaksi OMSET</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-[#141816]">
                        {syncConflict.localSummary.omsetDaysCount} hr
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold text-[#141816]">
                        {syncConflict.cloudSummary
                          ? `${syncConflict.cloudSummary.omsetDaysCount} hr`
                          : 'Kosong'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-sans text-[#565e59]">Karyawan</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-[#141816]">
                        {syncConflict.localSummary.employeeCount}
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold text-[#141816]">
                        {syncConflict.cloudSummary
                          ? syncConflict.cloudSummary.employeeCount
                          : 'Kosong'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-sans text-[#565e59]">Periode Absensi</td>
                      <td className="px-3 py-1.5 text-right font-semibold text-[#141816]">
                        {syncConflict.localSummary.attendanceMonths.length} bln
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold text-[#141816]">
                        {syncConflict.cloudSummary
                          ? `${syncConflict.cloudSummary.attendanceMonths.length} bln`
                          : 'Kosong'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-3 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-[11.5px] text-[#15803d]">
                Jika Anda memilih <strong>Gunakan Data Cloud</strong>, sistem otomatis menyimpan
                cadangan data lokal saat ini sebelum menggantinya (dapat dipulihkan dari menu
                Laporan &amp; Ekspor).
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e5e5df] bg-[#fafaf8] px-5 py-3">
              <button
                type="button"
                disabled={resolvingConflict}
                onClick={() => handleResolveConflict('cancel')}
                className="h-8.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#565e59] hover:bg-[#f3f3ee] cursor-pointer"
              >
                Batal
              </button>
              {syncConflict.cloudData && (
                <button
                  type="button"
                  disabled={resolvingConflict}
                  onClick={() => handleResolveConflict('use_cloud')}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-md border border-[#e5e5df] bg-[#141816] px-3.5 text-xs font-medium text-white hover:bg-[#2a312d] disabled:opacity-60 cursor-pointer"
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
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-[#14533c] px-3.5 text-xs font-medium text-white hover:bg-[#0f3f2d] disabled:opacity-60 cursor-pointer"
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
