import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageHeader } from '../components/PageHeader';
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  Database,
  Download,
  FileCode2,
  FileUp,
  HardDrive,
  History,
  LogIn,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  summarizeAppData,
  validateBackupPayload,
  type BackupValidationResult,
} from '../domain/reportCalculations';
import { getLocalCacheStats } from '../services/api';

interface BackupRestorePageProps {
  headerLeft?: React.ReactNode;
}

type PendingRestoreState =
  | {
      kind: 'json';
      fileName: string;
      fileSize: number;
      rawJson: string;
      validation: BackupValidationResult;
    }
  | {
      kind: 'sqlite';
      fileName: string;
      fileSize: number;
      file: File;
    };

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(0.1, Math.round((bytes / 1024) * 10) / 10)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatIsoTime(iso: string | null): string {
  if (!iso) return 'Belum ada';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const BackupRestorePage: React.FC<BackupRestorePageProps> = ({ headerLeft }) => {
  const {
    state,
    dbMode,
    sqliteInfo,
    isViewer,
    preRestoreBackup,
    refreshSqliteInfo,
    downloadSqliteBackup,
    vacuumSqliteDb,
    restoreBackupData,
    restoreSqliteFile,
    restoreFromPreRestoreBackup,
    setShowLoginModal,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busyAction, setBusyAction] = useState<'sqlite' | 'json' | 'vacuum' | 'restore' | 'rollback' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<PendingRestoreState | null>(null);
  const [autoDownloadOld, setAutoDownloadOld] = useState(true);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  const isSqliteConnected = dbMode === 'sqlite_connected';

  useEffect(() => {
    if (isSqliteConnected) {
      void refreshSqliteInfo();
    }
  }, [isSqliteConnected, refreshSqliteInfo]);

  const currentSummary = useMemo(() => summarizeAppData(state), [state]);
  const cacheStats = useMemo(() => getLocalCacheStats(), [state]);

  const totalRelationalRows = useMemo(() => {
    if (!sqliteInfo) return 0;
    const c = sqliteInfo.counts;
    return (
      c.items +
      c.stockAwal +
      c.stockDaily +
      c.employees +
      c.employeesArchived +
      c.attendance +
      c.omsetDays +
      c.omsetClosing
    );
  }, [sqliteInfo]);

  const handleDownloadSqlite = async () => {
    if (busyAction) return;
    setBusyAction('sqlite');
    const res = await downloadSqliteBackup();
    setBusyAction(null);
    setNotice({ type: res.ok ? 'ok' : 'err', text: res.message });
  };

  const handleDownloadJson = () => {
    if (busyAction) return;
    setBusyAction('json');
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `doona-golf-backup-${dateStr}.json`;
      const payload = JSON.stringify(state, null, 2);
      triggerFileDownload(payload, filename, 'application/json;charset=utf-8');
      setNotice({ type: 'ok', text: `File backup JSON "${filename}" berhasil diunduh.` });
    } catch {
      setNotice({ type: 'err', text: 'Gagal menyiapkan file backup JSON.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleVacuum = async () => {
    if (busyAction) return;
    setBusyAction('vacuum');
    const res = await vacuumSqliteDb();
    setBusyAction(null);
    setNotice({ type: res.ok ? 'ok' : 'err', text: res.message });
  };

  const processSelectedFile = async (file: File) => {
    if (isViewer) {
      setNotice({ type: 'err', text: 'Akun Viewer tidak memiliki izin untuk melakukan restore.' });
      return;
    }

    const lower = file.name.toLowerCase();
    const isSqliteExt =
      lower.endsWith('.sqlite') || lower.endsWith('.sqlite3') || lower.endsWith('.db');
    const isJsonExt = lower.endsWith('.json');

    if (!isSqliteExt && !isJsonExt) {
      setNotice({
        type: 'err',
        text: 'Format file tidak didukung. Pilih file backup .sqlite, .db, atau .json.',
      });
      return;
    }

    if (isSqliteExt) {
      if (!isSqliteConnected) {
        setNotice({
          type: 'err',
          text: 'Restore file .sqlite membutuhkan login ke server SQLite lokal. Silakan masuk terlebih dahulu.',
        });
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setNotice({ type: 'err', text: 'Ukuran file SQLite melebihi batas maksimal 25 MB.' });
        return;
      }
      setNotice(null);
      setPendingRestore({
        kind: 'sqlite',
        fileName: file.name,
        fileSize: file.size,
        file,
      });
      return;
    }

    try {
      const rawJson = await file.text();
      const validation = validateBackupPayload(rawJson);
      if (!validation.valid) {
        setNotice({
          type: 'err',
          text: validation.error || 'File JSON bukan format backup DOONA GOLF yang valid.',
        });
        return;
      }
      setNotice(null);
      setPendingRestore({
        kind: 'json',
        fileName: file.name,
        fileSize: file.size,
        rawJson,
        validation,
      });
    } catch {
      setNotice({ type: 'err', text: 'Gagal membaca isi file backup JSON.' });
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      void processSelectedFile(file);
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore || busyAction) return;
    setBusyAction('restore');

    if (pendingRestore.kind === 'sqlite') {
      const res = await restoreSqliteFile(pendingRestore.file);
      setBusyAction(null);
      if (!res.ok) {
        setNotice({ type: 'err', text: res.error || 'Gagal memulihkan file SQLite.' });
        setPendingRestore(null);
        return;
      }
      if (autoDownloadOld && res.preBackupJson && res.preBackupFilename) {
        triggerFileDownload(
          res.preBackupJson,
          res.preBackupFilename,
          'application/json;charset=utf-8'
        );
      }
      setNotice({
        type: 'ok',
        text: `Database SQLite "${pendingRestore.fileName}" berhasil dipulihkan (${res.summary?.totalItems ?? 0} item, ${res.summary?.omsetDaysCount ?? 0} hari omset). Akun login Anda tetap aman.`,
      });
      setPendingRestore(null);
      return;
    }

    const res = await restoreBackupData(pendingRestore.rawJson);
    setBusyAction(null);
    if (!res.ok) {
      setNotice({ type: 'err', text: res.error || 'Gagal memulihkan file backup JSON.' });
      setPendingRestore(null);
      return;
    }
    if (autoDownloadOld && res.preBackupJson && res.preBackupFilename) {
      triggerFileDownload(
        res.preBackupJson,
        res.preBackupFilename,
        'application/json;charset=utf-8'
      );
    }
    setNotice({
      type: 'ok',
      text: `Backup JSON "${pendingRestore.fileName}" berhasil dipulihkan${
        res.savedToCloud ? ' dan tersimpan ke SQLite.' : ' ke cache browser.'
      }`,
    });
    setPendingRestore(null);
  };

  const handleDownloadPreRestore = () => {
    if (!preRestoreBackup) return;
    const stamp = preRestoreBackup.savedAt.replace(/[:.]/g, '-').slice(0, 19);
    triggerFileDownload(
      JSON.stringify(preRestoreBackup.data, null, 2),
      `cadangan-pra-restore-${stamp}.json`,
      'application/json;charset=utf-8'
    );
    setNotice({ type: 'ok', text: 'File cadangan pra-restore berhasil diunduh.' });
  };

  const handleConfirmRollback = async () => {
    if (busyAction) return;
    setBusyAction('rollback');
    const res = await restoreFromPreRestoreBackup();
    setBusyAction(null);
    setShowRollbackModal(false);
    if (!res.ok) {
      setNotice({ type: 'err', text: res.error || 'Gagal memulihkan cadangan sebelumnya.' });
    } else {
      setNotice({
        type: 'ok',
        text: 'Data berhasil dikembalikan ke kondisi sebelum restore terakhir.',
      });
    }
  };

  return (
    <div className="dg-page">
      {/* Persistent Stationary Header */}
      <PageHeader>
        {headerLeft ? (
          headerLeft
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[17px] font-bold tracking-[-0.015em] text-[#13222b]">
              Backup &amp; Restore Database
            </h1>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
              isSqliteConnected
                ? 'bg-[#e6f7ee] text-[#15803d]'
                : dbMode === 'sqlite_unauth'
                  ? 'bg-[#fef3c7] text-[#b45309]'
                  : 'bg-[#f3f7f5] text-[#475569]'
            }`}
          >
            {isSqliteConnected
              ? 'SQLite 3 · Aktif'
              : dbMode === 'sqlite_unauth'
                ? 'SQLite · Belum Login'
                : 'Cache Browser'}
          </span>

          {dbMode === 'sqlite_unauth' && (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-3.5 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
            >
              <LogIn className="h-3.5 w-3.5" />
              Masuk SQLite
            </button>
          )}

          {isSqliteConnected && !isViewer && (
            <button
              type="button"
              onClick={handleDownloadSqlite}
              disabled={busyAction !== null}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-3.5 text-xs font-semibold text-white transition hover:bg-[#259f5b] disabled:opacity-60 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              {busyAction === 'sqlite' ? 'Menyiapkan…' : 'Backup .sqlite'}
            </button>
          )}
        </div>
      </PageHeader>

      {/* Scrollable Workspace */}
      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="space-y-4">
          {/* Status Notice Banner */}
          {notice && (
            <div
              className={`flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-xs shadow-[0_6px_24px_rgba(13,37,48,0.045)] ${
                notice.type === 'ok'
                  ? 'bg-[#e6f7ee] text-[#15803d]'
                  : notice.type === 'warn'
                    ? 'bg-[#fef3c7] text-[#b45309]'
                    : 'bg-[#fee2e2] text-[#b91c1c]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {notice.type === 'ok' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span className="leading-relaxed font-semibold">{notice.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Tutup pemberitahuan"
                className="rounded-lg p-1 opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* 4 KPI Summary Cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64748b]">Ukuran Database</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f7ee] text-[#15803d]">
                  <Database className="h-4 w-4" />
                </span>
              </div>
              <div className="font-mono-num mt-3 text-[15px] font-bold text-[#13222b]">
                {sqliteInfo
                  ? formatBytes(sqliteInfo.fileSizeBytes)
                  : cacheStats.hasCache
                    ? `${cacheStats.sizeKb} KB`
                    : '0 KB'}
              </div>
              <div className="mt-1 text-[11.5px] text-[#64748b]">
                {sqliteInfo
                  ? `${totalRelationalRows} baris · ${sqliteInfo.fileName}`
                  : 'Mode cache browser'}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64748b]">Cakupan Data Aktif</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f7f5] text-[#475569]">
                  <HardDrive className="h-4 w-4" />
                </span>
              </div>
              <div className="font-mono-num mt-3 text-[15px] font-bold text-[#13222b]">
                {currentSummary.totalItems} item · {currentSummary.employeeCount} staf
              </div>
              <div className="mt-1 text-[11.5px] text-[#64748b]">
                {currentSummary.stockMonths.length} bln stok · {currentSummary.omsetDaysCount} hr
                omset
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64748b]">Snapshot Pra-Restore</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3f7f5] text-[#15803d]">
                  <History className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 text-[14.5px] font-bold text-[#13222b]">
                {preRestoreBackup ? 'Tersedia (1-Klik)' : 'Otomatis saat restore'}
              </div>
              <div className="mt-1 text-[11.5px] text-[#64748b]">
                {preRestoreBackup
                  ? formatIsoTime(preRestoreBackup.savedAt)
                  : 'Dibuat otomatis sebelum menimpa'}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#64748b]">Proteksi Restore</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f7ee] text-[#15803d]">
                  <ShieldCheck className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 text-[14.5px] font-bold text-[#13222b]">
                Validasi &amp; Akun Aman
              </div>
              <div className="mt-1 text-[11.5px] text-[#64748b]">
                Cek integritas · Akun login tidak tertimpa
              </div>
            </div>
          </section>

          {/* Main 2-Column Workspace */}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {/* LEFT COLUMN: BACKUP DATABASE */}
            <div className="space-y-4">
              <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div>
                  <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                    Backup Database
                  </h2>
                  <p className="mt-0.5 text-xs text-[#64748b]">
                    Unduh salinan lengkap seluruh data stok, omset, absensi, karyawan, dan
                    pengaturan untuk arsip rutin atau migrasi perangkat Linux.
                  </p>
                </div>

                {/* Option 1: Native SQLite Backup */}
                <div className="rounded-xl border border-[#dce6e2] bg-[#f7faf9] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6f7ee] text-[#15803d]">
                        <Database className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#13222b]">
                          Backup File SQLite Asli (.sqlite)
                        </div>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-[#475569]">
                          Salinan biner SQLite 3 konsisten lewat Online Backup API. Aman diunduh
                          saat aplikasi sedang aktif, cocok dibuka di DB Browser for SQLite atau
                          dipindah antar komputer Linux.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#e2ebe7] pt-3">
                    <button
                      type="button"
                      onClick={handleVacuum}
                      disabled={!isSqliteConnected || isViewer || busyAction !== null}
                      className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-[#334155] ring-1 ring-[#dce6e2] transition hover:bg-[#edf4f1] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#15803d]" />
                      {busyAction === 'vacuum' ? 'Mengoptimasi…' : 'Optimasi (VACUUM)'}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadSqlite}
                      disabled={!isSqliteConnected || isViewer || busyAction !== null}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {busyAction === 'sqlite' ? 'Mengunduh…' : 'Unduh Backup (.sqlite)'}
                    </button>
                  </div>
                </div>

                {/* Option 2: Portable JSON Backup */}
                <div className="rounded-xl border border-[#dce6e2] bg-[#f7faf9] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#475569] ring-1 ring-[#dce6e2]">
                      <FileCode2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#13222b]">
                        Backup Portabel JSON (.json)
                      </div>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-[#475569]">
                        Format teks terstruktur yang ringan dan mudah dibaca. Tetap dapat diunduh
                        meskipun sedang dalam mode cache browser (offline).
                      </p>
                    </div>
                  </div>
                  <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-[#e2ebe7] pt-3">
                    <span className="font-mono-num text-[11px] text-[#64748b]">
                      {currentSummary.totalItems} item · {currentSummary.stockMonths.length} bln
                      stok · {currentSummary.omsetDaysCount} hr omset
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadJson}
                      disabled={busyAction !== null}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0d2530] px-4 text-xs font-semibold text-white transition hover:bg-[#173a4a] disabled:opacity-50 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Unduh Backup (.json)
                    </button>
                  </div>
                </div>
              </section>

              {/* Pre-Restore Rollback Card */}
              <section className="flex flex-col gap-3.5 rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-[#15803d]" />
                    <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                      Cadangan Otomatis Pra-Restore (Rollback)
                    </h2>
                  </div>
                </div>

                {preRestoreBackup ? (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-[#f7faf9] px-4 py-3 text-xs text-[#475569]">
                      <div className="font-bold text-[#13222b]">{preRestoreBackup.reason}</div>
                      <div className="font-mono-num mt-1 text-[11.5px] text-[#64748b]">
                        Disimpan pada {formatIsoTime(preRestoreBackup.savedAt)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadPreRestore}
                        className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Unduh Snapshot
                      </button>
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => setShowRollbackModal(true)}
                          disabled={busyAction !== null}
                          className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#f59e0b] px-3.5 text-xs font-semibold text-white transition hover:bg-[#d97706] disabled:opacity-50 cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Pulihkan Data Sebelumnya
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs leading-relaxed text-[#64748b]">
                    Belum ada snapshot rollback tersimpan. Setiap kali Anda menjalankan restore
                    (baik dari file <span className="font-mono-num">.sqlite</span> maupun{' '}
                    <span className="font-mono-num">.json</span>), sistem otomatis menyimpan
                    salinan data lama di sini agar bisa dikembalikan dalam 1 klik jika diperlukan.
                  </p>
                )}
              </section>
            </div>

            {/* RIGHT COLUMN: RESTORE DATABASE */}
            <div className="space-y-4">
              <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div>
                  <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                    Restore Database
                  </h2>
                  <p className="mt-0.5 text-xs text-[#64748b]">
                    Unggah file backup <span className="font-mono-num font-semibold">.sqlite</span>,{' '}
                    <span className="font-mono-num font-semibold">.db</span>, atau{' '}
                    <span className="font-mono-num font-semibold">.json</span> untuk memulihkan
                    seluruh data operasional.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sqlite,.sqlite3,.db,.json,application/json,application/vnd.sqlite3,application/x-sqlite3"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {/* Drag & Drop Restore Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!isViewer) setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (isViewer) return;
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) void processSelectedFile(dropped);
                  }}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
                    isDragging
                      ? 'border-[#2eb86b] bg-[#e6f7ee]/70'
                      : 'border-[#cfdcd7] bg-[#f7faf9]'
                  }`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#15803d] shadow-xs ring-1 ring-[#dce6e2]">
                    <FileUp className="h-5 w-5" />
                  </div>
                  <div className="mt-3 text-sm font-bold text-[#13222b]">
                    Tarik &amp; lepaskan file backup di sini
                  </div>
                  <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#64748b]">
                    Mendukung file <span className="font-mono-num font-semibold">.sqlite</span> /{' '}
                    <span className="font-mono-num font-semibold">.db</span> (maks. 25 MB) dan{' '}
                    <span className="font-mono-num font-semibold">.json</span> hasil ekspor DOONA
                    GOLF.
                  </p>

                  <button
                    type="button"
                    disabled={isViewer || busyAction !== null}
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 inline-flex h-9.5 items-center gap-2 rounded-xl bg-[#2eb86b] px-5 text-xs font-semibold text-white transition hover:bg-[#259f5b] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Pilih File Backup (.sqlite / .json)
                  </button>

                  {isViewer && (
                    <p className="mt-2.5 text-[11px] font-semibold text-[#b45309]">
                      Akun Viewer hanya memiliki akses baca dan tidak dapat merestore database.
                    </p>
                  )}
                </div>

                {/* Safety Checklist */}
                <div className="space-y-2.5 rounded-xl bg-[#f7faf9] p-4 text-xs leading-relaxed text-[#475569]">
                  <div className="flex items-center gap-1.5 font-bold text-[#13222b]">
                    <ShieldCheck className="h-4 w-4 text-[#2eb86b]" />
                    <span>Mekanisme Pengaman Restore</span>
                  </div>
                  <ul className="list-disc space-y-1.5 pl-5">
                    <li>
                      <strong className="text-[#13222b]">Validasi Sebelum Menimpa:</strong> File{' '}
                      <span className="font-mono-num">.sqlite</span> diperiksa header biner,
                      integritas (<span className="font-mono-num">PRAGMA quick_check</span>), dan
                      kelengkapan 8 tabel inti sebelum ditulis ke database aktif.
                    </li>
                    <li>
                      <strong className="text-[#13222b]">Akun &amp; Sesi Tetap Aman:</strong> Proses
                      restore hanya memulihkan tabel operasional tanpa menimpa akun admin atau
                      mengeluarkan sesi login Anda.
                    </li>
                    <li>
                      <strong className="text-[#13222b]">Cadangan Otomatis:</strong> Data saat ini
                      selalu dicadangkan otomatis sebelum diganti, plus opsi unduh cadangan lokal
                      sebelum konfirmasi.
                    </li>
                  </ul>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* PORTAL MODAL: KONFIRMASI RESTORE */}
      {pendingRestore &&
        createPortal(
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
              <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[#edf2f0] px-6 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f7ee] text-[#15803d]">
                    <ArchiveRestore className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-[#13222b]">
                      Konfirmasi Restore{' '}
                      {pendingRestore.kind === 'sqlite' ? 'Database SQLite' : 'Backup JSON'}
                    </h3>
                    <p className="font-mono-num mt-0.5 text-xs text-[#64748b]">
                      {pendingRestore.fileName} · {formatBytes(pendingRestore.fileSize)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingRestore(null)}
                  disabled={busyAction === 'restore'}
                  aria-label="Tutup dialog"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="dg-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {pendingRestore.kind === 'json' && pendingRestore.validation.summary ? (
                  <div className="overflow-hidden rounded-xl border border-[#edf2f0]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#f7faf9] text-[11px] font-bold tracking-[0.04em] text-[#64748b] uppercase">
                        <tr className="border-b border-[#edf2f0]">
                          <th className="px-3.5 py-2.5">Modul Data</th>
                          <th className="px-3.5 py-2.5 text-right text-[#64748b]">Saat Ini</th>
                          <th className="px-3.5 py-2.5 text-right text-[#15803d]">File Backup</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono-num divide-y divide-[#edf2f0]">
                        <tr>
                          <td className="px-3.5 py-2 font-sans text-[#475569]">Master Item</td>
                          <td className="px-3.5 py-2 text-right font-semibold text-[#13222b]">
                            {currentSummary.totalItems}
                          </td>
                          <td className="px-3.5 py-2 text-right font-bold text-[#15803d]">
                            {pendingRestore.validation.summary.totalItems}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3.5 py-2 font-sans text-[#475569]">Periode Stok</td>
                          <td className="px-3.5 py-2 text-right font-semibold text-[#13222b]">
                            {currentSummary.stockMonths.length} bln
                          </td>
                          <td className="px-3.5 py-2 text-right font-bold text-[#15803d]">
                            {pendingRestore.validation.summary.stockMonths.length} bln
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3.5 py-2 font-sans text-[#475569]">Transaksi OMSET</td>
                          <td className="px-3.5 py-2 text-right font-semibold text-[#13222b]">
                            {currentSummary.omsetDaysCount} hr
                          </td>
                          <td className="px-3.5 py-2 text-right font-bold text-[#15803d]">
                            {pendingRestore.validation.summary.omsetDaysCount} hr
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3.5 py-2 font-sans text-[#475569]">Karyawan</td>
                          <td className="px-3.5 py-2 text-right font-semibold text-[#13222b]">
                            {currentSummary.employeeCount}
                          </td>
                          <td className="px-3.5 py-2 text-right font-bold text-[#15803d]">
                            {pendingRestore.validation.summary.employeeCount}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3.5 py-2 font-sans text-[#475569]">Periode Absensi</td>
                          <td className="px-3.5 py-2 text-right font-semibold text-[#13222b]">
                            {currentSummary.attendanceMonths.length} bln
                          </td>
                          <td className="px-3.5 py-2 text-right font-bold text-[#15803d]">
                            {pendingRestore.validation.summary.attendanceMonths.length} bln
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#dce6e2] bg-[#f7faf9] p-4 text-xs leading-relaxed text-[#475569]">
                    <div className="font-bold text-[#13222b]">
                      Pemulihan Database Biner SQLite 3
                    </div>
                    <p className="mt-1">
                      Server lokal akan memverifikasi header SQLite, menjalankan pemeriksaan
                      integritas, lalu mengimpor seluruh tabel operasional secara atomik ke
                      database aktif. Akun pengguna dan sesi login Anda tidak akan diubah.
                    </p>
                  </div>
                )}

                <div className="rounded-xl bg-[#fef3c7] px-3.5 py-2.5 text-xs leading-relaxed text-[#92400e]">
                  Data operasional saat ini akan diganti dengan isi file backup. Snapshot otomatis
                  akan disimpan sehingga Anda tetap dapat melakukan rollback bila diperlukan.
                </div>

                <label className="flex items-center gap-2.5 text-xs font-medium text-[#334155] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoDownloadOld}
                    onChange={(e) => setAutoDownloadOld(e.target.checked)}
                    className="h-4 w-4 rounded border-[#cfd8d4] accent-[#2eb86b]"
                  />
                  <span>Unduh otomatis file cadangan data lama (.json) sebelum restore</span>
                </label>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-6 py-3.5">
                <button
                  type="button"
                  disabled={busyAction === 'restore'}
                  onClick={() => setPendingRestore(null)}
                  className="h-9 rounded-xl bg-[#eef3f1] px-4 text-xs font-semibold text-[#13222b] hover:bg-[#e1ebe7] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={busyAction === 'restore'}
                  onClick={handleConfirmRestore}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white hover:bg-[#259f5b] disabled:opacity-60 cursor-pointer"
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                  {busyAction === 'restore'
                    ? 'Memulihkan Database…'
                    : pendingRestore.kind === 'sqlite'
                      ? 'Terapkan Restore SQLite'
                      : 'Terapkan Restore JSON'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* PORTAL MODAL: KONFIRMASI ROLLBACK */}
      {showRollbackModal &&
        preRestoreBackup &&
        createPortal(
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
              <div className="flex shrink-0 items-start justify-between border-b border-[#edf2f0] px-6 py-4">
                <div>
                  <h3 className="font-display text-base font-bold text-[#13222b]">
                    Pulihkan Data Sebelumnya?
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748b]">
                    Snapshot {formatIsoTime(preRestoreBackup.savedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRollbackModal(false)}
                  aria-label="Tutup dialog"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f3f7f5] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-6 py-5 text-xs leading-relaxed text-[#475569]">
                Data operasional saat ini akan dikembalikan ke kondisi sebelum proses restore
                terakhir dan langsung disimpan kembali ke database SQLite.
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-6 py-3.5">
                <button
                  type="button"
                  disabled={busyAction === 'rollback'}
                  onClick={() => setShowRollbackModal(false)}
                  className="h-9 rounded-xl bg-[#eef3f1] px-4 text-xs font-semibold text-[#13222b] hover:bg-[#e1ebe7] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={busyAction === 'rollback'}
                  onClick={handleConfirmRollback}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#f59e0b] px-4 text-xs font-semibold text-white hover:bg-[#d97706] disabled:opacity-60 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {busyAction === 'rollback' ? 'Memulihkan…' : 'Ya, Pulihkan'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
