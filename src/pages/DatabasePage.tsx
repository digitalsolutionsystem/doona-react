import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FolderOpen,
  HardDrive,
  KeyRound,
  Lock,
  LogIn,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Terminal,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { summarizeAppData } from '../domain/reportCalculations';
import { getLocalCacheStats } from '../services/api';

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

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(0.1, Math.round((bytes / 1024) * 10) / 10)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface DatabasePageProps {
  headerLeft?: React.ReactNode;
}

export const DatabasePage: React.FC<DatabasePageProps> = ({ headerLeft }) => {
  const {
    state,
    dbMode,
    sqliteAvailable,
    sqliteInfo,
    sqliteEnvManaged,
    user,
    isViewer,
    sync,
    syncMeta,
    syncConflict,
    refreshSqliteInfo,
    checkAndSyncCloud,
    resolveSyncConflict,
    vacuumSqliteDb,
    downloadSqliteBackup,
    setShowLoginModal,
  } = useApp();

  const [busyAction, setBusyAction] = useState<'pull' | 'push' | 'vacuum' | 'backup' | null>(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: 'ok' | 'warn' | 'err';
    text: string;
  } | null>(null);

  const isSqliteConnected = dbMode === 'sqlite_connected';

  useEffect(() => {
    if (isSqliteConnected) {
      void refreshSqliteInfo();
    }
  }, [isSqliteConnected, refreshSqliteInfo]);

  const dataSummary = useMemo(() => summarizeAppData(state), [state]);
  const cacheStats = useMemo(() => getLocalCacheStats(), [state, syncMeta]);

  const handleSyncIntent = async (intent: 'pull' | 'push') => {
    if (busyAction) return;
    setBusyAction(intent);
    const res = await checkAndSyncCloud(intent);
    setBusyAction(null);

    if (res.ok) {
      setStatusMsg({ type: 'ok', text: res.message });
    } else if (res.status === 'conflict') {
      setStatusMsg({ type: 'warn', text: res.message });
    } else {
      setStatusMsg({ type: 'err', text: res.message });
    }
  };

  const handleVacuum = async () => {
    if (busyAction) return;
    setBusyAction('vacuum');
    const res = await vacuumSqliteDb();
    setBusyAction(null);
    setStatusMsg({ type: res.ok ? 'ok' : 'err', text: res.message });
  };

  const handleBackup = async () => {
    if (busyAction) return;
    setBusyAction('backup');
    const res = await downloadSqliteBackup();
    setBusyAction(null);
    setStatusMsg({ type: res.ok ? 'ok' : 'err', text: res.message });
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

  const connectionBadge = isSqliteConnected
    ? {
        title: 'Terhubung · SQLite 3 (WAL)',
        desc: 'Seluruh transaksi stok, omset, absensi, dan akun tersimpan secara relasional ke file SQLite lokal di Linux.',
        tone: 'bg-[#e6f7ee] text-[#15803d]',
        iconBg: 'bg-[#e6f7ee] text-[#15803d]',
        icon: Database,
      }
    : dbMode === 'sqlite_unauth'
      ? {
          title: 'SQLite Siap · Belum Login',
          desc: 'Server SQLite lokal aktif, namun sesi belum terverifikasi. Masuk dengan akun Admin agar perubahan langsung tersimpan ke file .sqlite.',
          tone: 'bg-[#fef3c7] text-[#b45309]',
          iconBg: 'bg-[#fef3c7] text-[#b45309]',
          icon: KeyRound,
        }
      : {
          title: 'Mode Cache Browser (Offline)',
          desc: 'Server SQLite lokal tidak terdeteksi. Perubahan sementara ditampung di cache browser hingga server lokal dijalankan.',
          tone: 'bg-[#f3f7f5] text-[#13222b]',
          iconBg: 'bg-[#f3f7f5] text-[#475569]',
          icon: HardDrive,
        };

  const ConnectionIcon = connectionBadge.icon;

  const tableRows = useMemo(() => {
    const c = sqliteInfo?.counts;
    return [
      { table: 'master_items', desc: 'Daftar master item & stok minimum', count: c?.items ?? dataSummary.totalItems },
      { table: 'stock_awal', desc: 'Saldo stok awal bulanan', count: c?.stockAwal ?? 0 },
      { table: 'stock_daily', desc: 'Catatan barang datang & closing harian', count: c?.stockDaily ?? 0 },
      { table: 'employees', desc: 'Data karyawan aktif & arsip', count: (c?.employees ?? dataSummary.employeeCount) + (c?.employeesArchived ?? 0) },
      { table: 'attendance_records', desc: 'Rekam absensi, shift & lembur', count: c?.attendance ?? 0 },
      { table: 'omset_days', desc: 'Transaksi tunai, QRIS & pengeluaran', count: c?.omsetDays ?? dataSummary.omsetDaysCount },
      { table: 'omset_closing', desc: 'Snapshot tutup periode omset', count: c?.omsetClosing ?? 0 },
      { table: 'users', desc: 'Akun autentikasi terenkripsi', count: c?.users ?? 0 },
    ];
  }, [sqliteInfo, dataSummary]);

  const totalDbRecords = useMemo(
    () => tableRows.reduce((acc, r) => acc + r.count, 0),
    [tableRows]
  );

  return (
    <div className="dg-page">
      {/* PERSISTENT STATIONARY HEADER */}
      <PageHeader>
        {headerLeft ? (
          headerLeft
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[17px] font-bold tracking-[-0.015em] text-[#13222b]">
              Database SQLite Lokal
            </h1>
            <span
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${connectionBadge.tone}`}
            >
              {connectionBadge.title}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {headerLeft && (
            <span
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${connectionBadge.tone}`}
            >
              {connectionBadge.title}
            </span>
          )}
          {dbMode === 'sqlite_unauth' && (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              Masuk Akun SQLite
            </button>
          )}
          {isSqliteConnected && !isViewer && (
            <button
              type="button"
              onClick={handleBackup}
              disabled={busyAction !== null}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] disabled:opacity-60 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              {busyAction === 'backup' ? 'Menyiapkan…' : 'Unduh Backup .sqlite'}
            </button>
          )}
        </div>
      </PageHeader>

      {/* Scrollable Body */}
      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="space-y-4">
          {/* 4 Floating KPI Status Cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64748b]">Engine Database</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${connectionBadge.iconBg}`}>
                  <ConnectionIcon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 text-[14.5px] font-bold text-[#13222b]">
                {sqliteInfo?.engine || (sqliteAvailable ? 'SQLite 3 (WAL)' : 'Cache Browser')}
              </div>
              <div className="mt-1 text-[11.5px] text-[#64748b]">
                Mode Jurnal ·{' '}
                <span className="font-mono-num uppercase">
                  {sqliteInfo?.journalMode || 'WAL'}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64748b]">Status Penyimpanan</span>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    syncConflict || sync.isError
                      ? 'bg-[#fee2e2] text-[#b91c1c]'
                      : syncMeta.pendingLocalChanges
                        ? 'bg-[#fef3c7] text-[#b45309]'
                        : 'bg-[#e6f7ee] text-[#15803d]'
                  }`}
                >
                  {syncConflict ? (
                    <ShieldAlert className="h-4 w-4" />
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
                {syncConflict ? 'Perlu Konfirmasi' : sync.text}
              </div>
              <div className="mt-1 text-[11.5px] text-[#64748b]">
                Simpan terakhir ·{' '}
                <span className="font-mono-num font-semibold text-[#13222b]">
                  {formatIsoTime(sqliteInfo?.lastSavedAt || syncMeta.lastCloudSyncAt)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64748b]">Ukuran File SQLite</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f7f5] text-[#475569]">
                  <HardDrive className="h-4 w-4" />
                </span>
              </div>
              <div className="font-mono-num mt-3 text-[14.5px] font-bold text-[#13222b]">
                {sqliteInfo
                  ? formatBytes(sqliteInfo.fileSizeBytes)
                  : cacheStats.hasCache
                    ? `${cacheStats.sizeKb} KB (cache)`
                    : '0 KB'}
              </div>
              <div className="mt-1 text-[11.5px] text-[#64748b]">
                {totalDbRecords} baris relasional · Skema v{sqliteInfo?.schemaVersion ?? 1}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64748b]">Akun &amp; Keamanan</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f7ee] text-[#15803d]">
                  <Lock className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 text-[14.5px] font-bold text-[#13222b]">
                {user?.nama || user?.username || 'Mode Cache'}
              </div>
              <div className="mt-1 text-[11.5px] text-[#64748b]">
                {isViewer ? 'Viewer · Hanya Baca' : 'Admin · Baca & Tulis'} ·{' '}
                {sqliteEnvManaged ? 'Env Managed' : 'Hash scrypt'}
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
                      Perbedaan Data Cache Browser vs SQLite Terdeteksi
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
                      Gunakan Versi SQLite
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
                      Simpan Versi Layar ke SQLite
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Main 2-Column Workspace */}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
            {/* LEFT COLUMN: File Location, Controls & Relational Tables */}
            <div className="space-y-4">
              <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                    Lokasi File &amp; Pemeliharaan SQLite
                  </h2>
                  <span className="font-mono-num rounded-lg bg-[#f3f7f5] px-2.5 py-1 text-[11px] font-medium text-[#64748b]">
                    {sqliteInfo?.fileName || 'doona-golf.sqlite'}
                  </span>
                </div>

                <div className={`rounded-xl px-4 py-3 text-xs ${connectionBadge.tone}`}>
                  <div className="font-bold">{connectionBadge.title}</div>
                  <p className="mt-0.5 leading-relaxed opacity-90">{connectionBadge.desc}</p>
                </div>

                <div className="rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-4 py-3">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#64748b]">
                    <FolderOpen className="h-3.5 w-3.5 text-[#15803d]" />
                    <span>Path File Database Aktif</span>
                  </div>
                  <div className="font-mono-num break-all text-xs font-semibold text-[#13222b]">
                    {sqliteInfo?.dbPath ||
                      (isSqliteConnected
                        ? 'Memuat lokasi file…'
                        : 'Masuk akun SQLite untuk menampilkan path file aktif')}
                  </div>
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
                      <span className="font-semibold">{statusMsg.text}</span>
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

                {syncMeta.lastError && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-[#fef3c7] px-3.5 py-2.5 text-xs text-[#b45309]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div>
                      <div className="font-bold">Catatan Terakhir</div>
                      <div>{syncMeta.lastError}</div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleSyncIntent('pull')}
                    disabled={!isSqliteConnected || busyAction !== null}
                    className="flex h-9.5 items-center justify-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e6f7ee] hover:text-[#15803d] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 text-[#2eb86b] ${busyAction === 'pull' ? 'animate-spin' : ''}`}
                    />
                    {busyAction === 'pull' ? 'Memuat…' : 'Muat Ulang dari SQLite'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSyncIntent('push')}
                    disabled={!isSqliteConnected || isViewer || busyAction !== null}
                    className="flex h-9.5 items-center justify-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e6f7ee] hover:text-[#15803d] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5 text-[#2eb86b]" />
                    {busyAction === 'push' ? 'Menyimpan…' : 'Simpan Paksa ke SQLite'}
                  </button>

                  <button
                    type="button"
                    onClick={handleBackup}
                    disabled={!isSqliteConnected || isViewer || busyAction !== null}
                    className="flex h-9.5 items-center justify-center gap-1.5 rounded-xl bg-[#2eb86b] px-3 text-xs font-semibold text-white transition hover:bg-[#259f5b] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {busyAction === 'backup' ? 'Mengunduh…' : 'Unduh Backup (.sqlite)'}
                  </button>

                  <button
                    type="button"
                    onClick={handleVacuum}
                    disabled={!isSqliteConnected || isViewer || busyAction !== null}
                    className="flex h-9.5 items-center justify-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#15803d]" />
                    {busyAction === 'vacuum' ? 'Mengoptimasi…' : 'Optimasi (VACUUM)'}
                  </button>
                </div>
              </section>

              {/* Relational Tables Breakdown */}
              <section className="flex flex-col gap-3.5 rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                      Struktur Tabel Relasional SQLite
                    </h2>
                    <p className="mt-0.5 text-xs text-[#64748b]">
                      Data dipecah ke tabel relasional native agar mudah di-query dengan DB Browser
                      for SQLite atau perintah <span className="font-mono-num">sqlite3</span>.
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-[#edf2f0]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f7faf9] text-[11px] font-bold tracking-[0.04em] text-[#64748b] uppercase">
                      <tr className="border-b border-[#edf2f0]">
                        <th className="px-3.5 py-2.5">Nama Tabel</th>
                        <th className="px-3.5 py-2.5">Keterangan</th>
                        <th className="px-3.5 py-2.5 text-right">Baris</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2f0]">
                      {tableRows.map((row) => (
                        <tr key={row.table} className="hover:bg-[#f9fcfa]">
                          <td className="font-mono-num px-3.5 py-2 font-semibold text-[#15803d]">
                            {row.table}
                          </td>
                          <td className="px-3.5 py-2 text-[#475569]">{row.desc}</td>
                          <td className="font-mono-num px-3.5 py-2 text-right font-bold text-[#13222b]">
                            {row.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN: Linux .deb / AppImage Guide & Local Security */}
            <div className="space-y-4">
              <section className="flex flex-col gap-3.5 rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-[#15803d]" />
                  <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                    Panduan Linux Lokal (.deb / AppImage)
                  </h2>
                </div>

                <div className="space-y-3 text-xs leading-relaxed text-[#475569]">
                  <p>
                    Backend Express &amp; SQLite sudah mendukung konvensi folder desktop Linux agar
                    tetap dapat menulis database walaupun paket <span className="font-mono-num">.deb</span>{' '}
                    atau <span className="font-mono-num">AppImage</span> terpasang di direktori
                    read-only (<span className="font-mono-num">/opt</span> atau{' '}
                    <span className="font-mono-num">/usr</span>).
                  </p>

                  <div className="rounded-xl bg-[#101316] p-3.5 font-mono text-[11.5px] leading-relaxed text-[#e2e8f0]">
                    <div className="text-[#94a3b8]"># 1. Build frontend + jalankan server SQLite lokal</div>
                    <div className="mt-1 text-[#4ade80]">npm run build &amp;&amp; NODE_ENV=production npm start</div>
                    <div className="mt-3 text-[#94a3b8]"># 2. Contoh lokasi database kustom untuk .deb / AppImage</div>
                    <div className="mt-1 text-[#e2e8f0]">
                      SQLITE_DB_PATH=~/.local/share/doona-golf/doona-golf.sqlite
                    </div>
                  </div>

                  <ul className="list-disc space-y-1.5 pl-4">
                    <li>
                      <strong className="text-[#13222b]">Prioritas Path Otomatis:</strong> Menggunakan{' '}
                      <span className="font-mono-num">SQLITE_DB_PATH</span> jika diisi, lalu{' '}
                      <span className="font-mono-num">$XDG_DATA_HOME/doona-golf/doona-golf.sqlite</span>{' '}
                      di mode produksi, atau <span className="font-mono-num">./data/doona-golf.sqlite</span>{' '}
                      di mode pengembangan.
                    </li>
                    <li>
                      <strong className="text-[#13222b]">Elektron / Tauri / Wrapper Linux:</strong>{' '}
                      Cukup jalankan proses Node server internal di port lokal dan arahkan WebView
                      ke <span className="font-mono-num">http://127.0.0.1:3000</span>.
                    </li>
                    <li>
                      <strong className="text-[#13222b]">Portabel &amp; Mudah Dibackup:</strong>{' '}
                      Seluruh histori tersimpan dalam satu file{' '}
                      <span className="font-mono-num">.sqlite</span> yang dapat diunduh kapan saja
                      dari tombol <strong>Unduh Backup (.sqlite)</strong>.
                    </li>
                  </ul>
                </div>
              </section>

              <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                  Arsitektur &amp; Keamanan Lokal
                </h2>

                <div className="space-y-2.5 text-xs leading-relaxed text-[#475569]">
                  <p>
                    <strong className="text-[#13222b]">Transaksi Atomik &amp; WAL Mode:</strong>{' '}
                    Setiap penyimpanan data dilakukan dalam satu transaksi SQLite dengan{' '}
                    <span className="font-mono-num">WAL</span> aktif sehingga aman dari korupsi
                    data bila listrik padam mendadak.
                  </p>
                  <p>
                    <strong className="text-[#13222b]">Autentikasi Terenkripsi:</strong> Password
                    disimpan menggunakan hash <span className="font-mono-num">scrypt</span> dengan
                    salt acak per akun. Token sesi hanya disimpan sementara di memori aplikasi dan
                    diverifikasi langsung oleh server lokal.
                  </p>
                  <p>
                    <strong className="text-[#13222b]">Backup Aman Tanpa Kunci File:</strong>{' '}
                    Fitur unduh backup memakai SQLite Online Backup API sehingga aman dijalankan
                    meski aplikasi sedang aktif mencatat transaksi.
                  </p>
                </div>

                <div className="border-t border-[#edf2f0] pt-3.5">
                  <div className="mb-1.5 text-[11.5px] font-semibold text-[#13222b]">
                    Modul terhubung ke SQLite
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

      {/* MODAL PENYELESAIAN KONFLIK DATA */}
      {syncConflict && (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="flex items-start justify-between gap-2 border-b border-[#edf2f0] px-6 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#13222b]">
                  Konfirmasi Sumber Data
                </h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  Pilih versi data yang ingin dipertahankan antara cache browser dan file SQLite
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
                  <thead className="bg-[#f7faf9] text-[11px] font-bold tracking-[0.04em] text-[#64748b] uppercase">
                    <tr className="border-b border-[#edf2f0]">
                      <th className="px-3.5 py-2.5">Data Modul</th>
                      <th className="px-3.5 py-2.5 text-right text-[#b45309]">Cache Browser</th>
                      <th className="px-3.5 py-2.5 text-right text-[#15803d]">SQLite</th>
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
                  </tbody>
                </table>
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
                  Gunakan Versi SQLite
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
                  Simpan Versi Layar ke SQLite
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
