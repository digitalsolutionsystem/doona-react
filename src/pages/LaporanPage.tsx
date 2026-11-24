import React, { useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import {
  AlertTriangle,
  ArchiveRestore,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Info,
  Layers,
  ListChecks,
  Pencil,
  Printer,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDateKey, getFullDateLabel, getMonthLabel } from '../domain/dateUtils';
import {
  buildReportByPreset,
  generateDailyUsageCsv,
  generateFullMonthlyStockCsv,
  generateOmsetMonthlyCsv,
  generatePayrollMonthlyCsv,
  getReportItemConfig,
  getReportSummaryStats,
  summarizeAppData,
  validateBackupPayload,
  type BackupValidationResult,
  type ReportPresetMode,
} from '../domain/reportCalculations';
import { getGroupedItems } from '../domain/stockCalculations';

type LaporanSubTab = 'preview' | 'edit' | 'setting' | 'export';

interface ToastBanner {
  type: 'success' | 'error' | 'info';
  message: string;
}

const PRESET_OPTIONS: Array<{
  id: ReportPresetMode;
  label: string;
  shortDesc: string;
  scope: 'day' | 'month';
}> = [
  {
    id: 'closing_harian',
    label: 'Closing Harian',
    shortDesc: 'Format standar harian: barang datang, sisa stok, & pemakaian',
    scope: 'day',
  },
  {
    id: 'rekap_bulanan',
    label: 'Rekap Stok Bulanan',
    shortDesc: 'Total barang datang, pemakaian, & sisa akhir 1 bulan',
    scope: 'month',
  },
  {
    id: 'operasional_harian',
    label: 'Operasional Harian',
    shortDesc: 'Gabungan Stok + OMSET + Absensi & Gaji tanggal terpilih',
    scope: 'day',
  },
  {
    id: 'operasional_bulanan',
    label: 'Operasional Bulanan',
    shortDesc: 'Gabungan Rekap Stok + OMSET + Penggajian 1 bulan',
    scope: 'month',
  },
];

function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export const LaporanPage: React.FC = () => {
  const {
    state,
    ym,
    day,
    curYm,
    nowDay,
    isViewer,
    dbMode,
    moveMonth,
    moveDay,
    selectDateStr,
    goToday,
    navigateTo,
    preRestoreBackup,
    setReportItemConfig,
    setAllReportItemConfig,
    sendReportTelegram,
    restoreBackupData,
    restoreFromPreRestoreBackup,
  } = useApp();

  const [subTab, setSubTab] = useState<LaporanSubTab>('preview');
  const [preset, setPreset] = useState<ReportPresetMode>('closing_harian');
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});
  const [settingSearch, setSettingSearch] = useState('');
  const [toast, setToast] = useState<ToastBanner | null>(null);

  const [showTgModal, setShowTgModal] = useState(false);
  const [tgSending, setTgSending] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{
    fileName: string;
    rawJson: string;
    validation: BackupValidationResult;
  } | null>(null);
  const [autoDownloadOldBackup, setAutoDownloadOldBackup] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);

  const showNotice = (type: ToastBanner['type'], message: string) => {
    setToast({ type, message });
  };

  const activePresetMeta =
    PRESET_OPTIONS.find((p) => p.id === preset) ?? PRESET_OPTIONS[0];
  const isMonthScoped = activePresetMeta.scope === 'month';

  const dateKey = formatDateKey(ym, day);
  const fullDateLabel = getFullDateLabel(ym, day);
  const monthLabel = getMonthLabel(ym);

  const reportKey = `${preset}::${isMonthScoped ? ym : `${ym}-${day}`}`;

  const generatedReportText = useMemo(
    () => buildReportByPreset(preset, state, ym, day, curYm, nowDay),
    [preset, state, ym, day, curYm, nowDay]
  );

  const isCustomEdited = Object.prototype.hasOwnProperty.call(customTexts, reportKey);
  const currentReportText = isCustomEdited ? customTexts[reportKey] : generatedReportText;

  const stats = useMemo(() => getReportSummaryStats(state, ym, day), [state, ym, day]);
  const currentDataSummary = useMemo(() => summarizeAppData(state), [state]);
  const groupedItems = useMemo(() => getGroupedItems(state), [state]);

  const filteredGroupedItems = useMemo(() => {
    const q = settingSearch.trim().toLowerCase();
    if (!q) return groupedItems;
    return groupedItems
      .map(([kat, list]): [string, typeof list] => [
        kat,
        list.filter(
          (item) =>
            item.nama.toLowerCase().includes(q) ||
            item.kat.toLowerCase().includes(q) ||
            (item.sat || '').toLowerCase().includes(q)
        ),
      ])
      .filter(([, list]) => list.length > 0);
  }, [groupedItems, settingSearch]);

  const isCloudConnected = dbMode === 'gas' || dbMode === 'cloud_connected';

  const handleManualTextChange = (val: string) => {
    setCustomTexts((prev) => ({ ...prev, [reportKey]: val }));
  };

  const handleResetToOriginal = () => {
    setCustomTexts((prev) => {
      const next = { ...prev };
      delete next[reportKey];
      return next;
    });
    showNotice('info', 'Teks laporan dikembalikan ke format asli otomatis.');
  };

  const handleCopyWhatsApp = async () => {
    const text = currentReportText.trim();
    if (!text) {
      showNotice('error', 'Teks laporan masih kosong.');
      return;
    }
    const ok = await copyTextToClipboard(text);
    if (ok) {
      showNotice('success', 'Laporan berhasil disalin ke clipboard (siap tempel ke WhatsApp).');
    } else {
      showNotice('error', 'Gagal menyalin otomatis. Silakan salin manual dari kotak pratinjau.');
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleConfirmSendTelegram = async () => {
    if (tgSending) return;
    setTgSending(true);
    const res = await sendReportTelegram(currentReportText);
    setTgSending(false);
    setShowTgModal(false);
    if (res.ok) {
      showNotice('success', 'Laporan berhasil dikirim ke bot Telegram.');
    } else {
      showNotice('error', res.error || 'Gagal mengirim laporan ke Telegram.');
    }
  };

  const handleExportDailyUsageCsv = () => {
    const csv = generateDailyUsageCsv(state, ym);
    triggerFileDownload(`pemakaian-${ym}.csv`, csv, 'text/csv;charset=utf-8');
    showNotice('success', `CSV Pemakaian Harian (${monthLabel}) berhasil diunduh.`);
  };

  const handleExportMonthlyRecapCsv = () => {
    const csv = generateFullMonthlyStockCsv(state, ym, curYm, nowDay);
    triggerFileDownload(`rekap-stok-${ym}.csv`, csv, 'text/csv;charset=utf-8');
    showNotice('success', `CSV Rekap Stok Bulanan (${monthLabel}) berhasil diunduh.`);
  };

  const handleExportOmsetCsv = () => {
    const csv = generateOmsetMonthlyCsv(state, ym);
    triggerFileDownload(`omset-${ym}.csv`, csv, 'text/csv;charset=utf-8');
    showNotice('success', `CSV OMSET Bulanan (${monthLabel}) berhasil diunduh.`);
  };

  const handleExportPayrollCsv = () => {
    const csv = generatePayrollMonthlyCsv(state, ym);
    triggerFileDownload(`absensi-gaji-${ym}.csv`, csv, 'text/csv;charset=utf-8');
    showNotice('success', `CSV Absensi & Gaji (${monthLabel}) berhasil diunduh.`);
  };

  const handleDownloadBackupJson = () => {
    const todayStamp = new Date().toISOString().slice(0, 10);
    const payload = JSON.stringify(state, null, 2);
    triggerFileDownload(
      `backup-doona-stok-${todayStamp}.json`,
      payload,
      'application/json;charset=utf-8'
    );
    showNotice('success', 'File Backup JSON lengkap berhasil diunduh.');
  };

  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (isViewer) {
      showNotice('error', 'Mode Viewer tidak diizinkan melakukan restore backup.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showNotice('error', 'Ukuran file melebihi batas aman 20 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rawJson = typeof reader.result === 'string' ? reader.result : '';
      const validation = validateBackupPayload(rawJson);
      if (!validation.valid) {
        showNotice(
          'error',
          `Restore ditolak — data lama tetap aman: ${validation.error || 'File tidak valid.'}`
        );
        return;
      }
      setPendingRestore({
        fileName: file.name,
        rawJson,
        validation,
      });
    };
    reader.onerror = () => {
      showNotice('error', 'Gagal membaca file backup. Data lama tidak diubah.');
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!pendingRestore || restoring) return;
    setRestoring(true);
    const result = await restoreBackupData(pendingRestore.rawJson);
    setRestoring(false);

    if (!result.ok) {
      showNotice(
        'error',
        `Restore gagal — data lama tetap utuh: ${result.error || 'Terjadi kesalahan.'}`
      );
      return;
    }

    if (autoDownloadOldBackup && result.preBackupJson && result.preBackupFilename) {
      triggerFileDownload(
        result.preBackupFilename,
        result.preBackupJson,
        'application/json;charset=utf-8'
      );
    }

    setPendingRestore(null);
    setCustomTexts({});
    showNotice(
      'success',
      `Backup "${pendingRestore.fileName}" berhasil dipulihkan. Cadangan data sebelumnya telah disimpan otomatis.${
        result.savedToCloud ? ' Tersimpan ke database SQLite.' : ''
      }`
    );
  };

  const handleDownloadPreRestoreSnapshot = () => {
    if (!preRestoreBackup) return;
    const stamp = preRestoreBackup.savedAt.replace(/[:.]/g, '-').slice(0, 19);
    triggerFileDownload(
      `cadangan-pra-restore-${stamp}.json`,
      JSON.stringify(preRestoreBackup.data, null, 2),
      'application/json;charset=utf-8'
    );
    showNotice('success', 'File cadangan pra-restore berhasil diunduh.');
  };

  const handleConfirmRollback = async () => {
    const res = await restoreFromPreRestoreBackup();
    setShowRollbackModal(false);
    if (res.ok) {
      setCustomTexts({});
      showNotice('success', 'Data berhasil dikembalikan ke cadangan sebelum restore.');
    } else {
      showNotice('error', res.error || 'Gagal memulihkan cadangan sebelumnya.');
    }
  };

  const preRestoreSummary = useMemo(
    () => (preRestoreBackup ? summarizeAppData(preRestoreBackup.data) : null),
    [preRestoreBackup]
  );

  const lineCount = currentReportText.split('\n').length;
  const charCount = currentReportText.length;

  return (
    <div className="dg-page print:bg-white">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleSelectRestoreFile}
      />

      {/* Persistent Stationary Top Bar */}
      <PageHeader>
        <div>
          <h1 className="font-display text-base font-bold text-[#13222b]">
            Laporan &amp; Ekspor
          </h1>
          <p className="text-[11.5px] text-[#64748b]">
            Sumber terpadu dari Input Harian, Tabel Bulanan, OMSET, dan Absensi &amp; Gaji
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#f3f7f5] p-1">
          {(
            [
              { id: 'preview', label: 'Teks Laporan', icon: FileText },
              { id: 'edit', label: 'Edit Teks', icon: Pencil },
              { id: 'setting', label: 'Atur Format Item', icon: SlidersHorizontal },
              { id: 'export', label: 'Ekspor & Backup', icon: FileJson },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  active
                    ? 'bg-[#2eb86b] text-white shadow-xs'
                    : 'text-[#64748b] hover:text-[#13222b]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
                {t.id === 'edit' && isCustomEdited && (
                  <span className={active ? 'text-[#fef08a]' : 'text-[#b45309]'}>·</span>
                )}
              </button>
            );
          })}
        </div>
      </PageHeader>

      {/* Floating Toast / Feedback Banner */}
      {toast && (
        <div
          className={`no-print mx-4 mt-3 flex shrink-0 items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm md:mx-6 ${
            toast.type === 'success'
              ? 'bg-[#2eb86b] text-white'
              : toast.type === 'error'
                ? 'bg-[#ef4444] text-white'
                : 'bg-white text-[#13222b]'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Info className="h-3.5 w-3.5 shrink-0 text-[#2eb86b]" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-lg p-0.5 opacity-80 transition hover:opacity-100 cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="dg-scroll flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 md:px-6 md:py-4 print:overflow-visible print:p-0">
        {/* TAB 1: PRATINJAU */}
        {subTab === 'preview' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_6px_24px_rgba(13,37,48,0.045)] md:p-5 print:rounded-none print:bg-white print:p-0 print:shadow-none">
            <div className="no-print flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {isMonthScoped ? (
                  <>
                    <div className="inline-flex items-center rounded-xl bg-[#f3f7f5] p-0.5">
                      <button
                        type="button"
                        onClick={() => moveMonth(-1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] hover:bg-white hover:text-[#13222b] cursor-pointer"
                        title="Bulan sebelumnya"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <div className="flex h-7 items-center gap-1.5 px-2.5 text-xs font-semibold text-[#13222b]">
                        <Calendar className="h-3.5 w-3.5 text-[#2eb86b]" />
                        <span>{monthLabel}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => moveMonth(1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] hover:bg-white hover:text-[#13222b] cursor-pointer"
                        title="Bulan berikutnya"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={goToday}
                      className="h-8 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                    >
                      Bulan Ini
                    </button>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center rounded-xl bg-[#f3f7f5] p-0.5">
                      <button
                        type="button"
                        onClick={() => moveDay(-1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] hover:bg-white hover:text-[#13222b] cursor-pointer"
                        title="Hari sebelumnya"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <input
                        type="date"
                        value={dateKey}
                        onChange={(e) => {
                          if (e.target.value) selectDateStr(e.target.value);
                        }}
                        className="font-mono-num h-7 bg-transparent px-2 text-xs font-semibold text-[#13222b] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => moveDay(1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] hover:bg-white hover:text-[#13222b] cursor-pointer"
                        title="Hari berikutnya"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={goToday}
                      className="h-8 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                    >
                      Hari ini
                    </button>
                  </>
                )}

                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value as ReportPresetMode)}
                  aria-label="Pilih jenis laporan"
                  title={activePresetMeta.shortDesc}
                  className="h-8 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] outline-none transition hover:bg-[#e7efec] focus:ring-2 focus:ring-[#2eb86b] cursor-pointer"
                >
                  {PRESET_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {!isMonthScoped && (
                  <span className="text-xs font-semibold text-[#13222b]">{fullDateLabel}</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isCustomEdited && (
                  <button
                    type="button"
                    onClick={handleResetToOriginal}
                    className="flex h-8 items-center gap-1.5 rounded-xl bg-[#f59e0b] px-3 text-xs font-semibold text-white transition hover:bg-[#d97706] cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Kembalikan Teks Asli
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSubTab('edit')}
                  className="flex h-8 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Teks Ini
                </button>
              </div>
            </div>

            {/* Compact Live Metadata Strip */}
            <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7faf9] px-3.5 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#64748b]">
                <span>
                  Item dilaporkan{' '}
                  <strong className="font-mono-num text-[#13222b]">
                    {stats.selectedItemsCount}/{stats.activeItemsCount}
                  </strong>
                </span>
                {!isMonthScoped && (
                  <>
                    <span className="text-[#cbd5e1]">·</span>
                    <span>
                      Barang datang tgl {day}{' '}
                      <strong className="font-mono-num text-[#15803d]">
                        {stats.datangCount} item
                      </strong>
                    </span>
                    <span className="text-[#cbd5e1]">·</span>
                    <span>
                      Closing terisi{' '}
                      <strong className="font-mono-num text-[#13222b]">
                        {stats.closingFilledCount}/{stats.activeItemsCount}
                      </strong>
                    </span>
                    {stats.negativeUsageCount > 0 && (
                      <>
                        <span className="text-[#cbd5e1]">·</span>
                        <span className="font-semibold text-[#dc2626]">
                          {stats.negativeUsageCount} pemakaian negatif
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11.5px] text-[#64748b]">
                <span className={isCustomEdited ? 'font-semibold text-[#b45309]' : 'font-semibold text-[#15803d]'}>
                  {isCustomEdited ? 'Diedit manual' : 'Otomatis dari data asli'}
                </span>
                <span className="text-[#cbd5e1]">·</span>
                <span className="font-mono-num">
                  {lineCount} baris · {charCount} kar
                </span>
              </div>
            </div>

            {/* Printable Header */}
            <div className="hidden print:mb-4 print:block print:border-b print:border-[#cbd5e1] print:pb-3">
              <div className="font-display text-lg font-bold text-[#13222b]">
                DOONA GOLF — {activePresetMeta.label}
              </div>
              <div className="text-xs text-[#475569]">
                Periode: {isMonthScoped ? monthLabel : fullDateLabel} · Dicetak pada{' '}
                {new Date().toLocaleString('id-ID')}
              </div>
            </div>

            {/* Preview Box */}
            <pre className="dg-scroll dg-print-report font-mono-num min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#edf2f0] bg-[#f7faf9] p-4 text-[13px] leading-relaxed whitespace-pre-wrap text-[#13222b] print:overflow-visible print:border-none print:bg-white print:p-0">
              {currentReportText}
            </pre>

            {/* Bottom Action Bar */}
            <div className="no-print flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                Salin WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setShowTgModal(true)}
                disabled={tgSending}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] disabled:opacity-60 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5 text-[#2eb86b]" />
                {tgSending ? 'Mengirim…' : 'Kirim Telegram'}
              </button>

              <button
                type="button"
                onClick={handlePrintPdf}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-[#475569]" />
                Cetak / PDF
              </button>

              <button
                type="button"
                onClick={handleExportDailyUsageCsv}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#2eb86b]" />
                Ekspor CSV
              </button>

              <button
                type="button"
                onClick={handleDownloadBackupJson}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-[#475569]" />
                Backup JSON
              </button>

              <button
                type="button"
                disabled={isViewer}
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5 text-[#b45309]" />
                Restore Backup
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: EDIT TEKS */}
        {subTab === 'edit' && (
          <div className="no-print flex min-h-0 flex-1 flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_6px_24px_rgba(13,37,48,0.045)] md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                  Edit Teks Laporan — {activePresetMeta.label} (
                  {isMonthScoped ? monthLabel : fullDateLabel})
                </h2>
                <p className="text-xs text-[#64748b]">
                  Sesuaikan teks atau catatan khusus sebelum disalin. Tidak mengubah angka pada
                  database asli.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToOriginal}
                  disabled={!isCustomEdited}
                  className="flex h-8.5 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Kembalikan ke Teks Asli
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('preview')}
                  className="flex h-8.5 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-3.5 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                >
                  Selesai &amp; Pratinjau →
                </button>
              </div>
            </div>

            <textarea
              value={currentReportText}
              onChange={(e) => handleManualTextChange(e.target.value)}
              spellCheck={false}
              className="dg-scroll font-mono-num min-h-0 flex-1 resize-none rounded-xl border border-[#dce6e2] bg-[#f7faf9] p-4 text-[13px] leading-relaxed text-[#13222b] outline-none transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#64748b]">
                {isCustomEdited
                  ? 'Perubahan manual aktif — teks ini yang akan disalin/dikirim.'
                  : 'Menampilkan teks otomatis asli dari sistem.'}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Salin WhatsApp Sekarang
                </button>
                <button
                  type="button"
                  onClick={() => setShowTgModal(true)}
                  disabled={tgSending}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] disabled:opacity-60 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5 text-[#2eb86b]" />
                  Kirim Telegram
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ATUR FORMAT ITEM */}
        {subTab === 'setting' && (
          <div className="no-print flex min-h-0 flex-1 flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_6px_24px_rgba(13,37,48,0.045)] md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div>
                <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                  Atur Isi Laporan per Item
                </h2>
                <p className="text-xs text-[#64748b]">
                  Pilih item dan kolom (Sisa Stok / Pemakaian) yang dimasukkan ke laporan. Item
                  dengan kedua centang kosong akan otomatis dilewati.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isViewer}
                  onClick={() => {
                    setAllReportItemConfig('both', true);
                    showNotice('success', 'Semua item dicentang untuk Sisa Stok & Pemakaian.');
                  }}
                  className="flex h-8.5 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] disabled:opacity-50 cursor-pointer"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-[#2eb86b]" />
                  Centang Semua
                </button>
                <button
                  type="button"
                  disabled={isViewer}
                  onClick={() => {
                    setAllReportItemConfig('both', false);
                    showNotice('info', 'Semua centang item pada laporan telah dihapus.');
                  }}
                  className="flex h-8.5 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#e1ebe7] disabled:opacity-50 cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5 text-[#64748b]" />
                  Hapus Semua Centang
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('preview')}
                  className="flex h-8.5 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-3.5 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                >
                  Lihat Teks Laporan →
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#e6f7ee] px-3.5 py-2.5 text-xs text-[#15803d]">
              <div>
                <strong>Barang Datang Otomatis:</strong> Item dengan barang datang (&gt; 0) pada
                tanggal terpilih selalu disertakan di bagian atas laporan.
              </div>
              <span className="font-mono-num font-bold">
                Sisa {stats.sisaCheckedCount} · Pakai {stats.pakaiCheckedCount} /{' '}
                {stats.activeItemsCount} item
              </span>
            </div>

            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#64748b]" />
              <input
                type="text"
                value={settingSearch}
                onChange={(e) => setSettingSearch(e.target.value)}
                placeholder="Cari item atau kategori…"
                className="h-8.5 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] pr-8 pl-8.5 text-xs text-[#13222b] outline-none transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
              />
              {settingSearch && (
                <button
                  type="button"
                  onClick={() => setSettingSearch('')}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[#64748b] hover:text-[#13222b] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="dg-scroll min-h-0 flex-1 overflow-auto rounded-xl border border-[#edf2f0]">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-[#edf2f0] bg-[#f7faf9] text-[11px] font-bold uppercase tracking-[0.04em] text-[#64748b]">
                  <tr>
                    <th className="px-4 py-2.5">Nama Item</th>
                    <th className="px-3 py-2.5">Kategori</th>
                    <th className="w-24 px-3 py-2.5">Satuan</th>
                    <th className="w-36 px-3 py-2.5 text-center normal-case tracking-normal">
                      <div className="text-[11px] font-bold uppercase tracking-[0.04em]">
                        Laporkan Sisa Stok
                      </div>
                      <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold">
                        <button
                          type="button"
                          disabled={isViewer}
                          onClick={() => setAllReportItemConfig('sisa', true)}
                          className="text-[#15803d] hover:underline disabled:opacity-50 cursor-pointer"
                        >
                          Semua
                        </button>
                        <span className="text-[#cbd5e1]">·</span>
                        <button
                          type="button"
                          disabled={isViewer}
                          onClick={() => setAllReportItemConfig('sisa', false)}
                          className="text-[#64748b] hover:underline disabled:opacity-50 cursor-pointer"
                        >
                          Kosong
                        </button>
                      </div>
                    </th>
                    <th className="w-36 px-3 py-2.5 text-center normal-case tracking-normal">
                      <div className="text-[11px] font-bold uppercase tracking-[0.04em]">
                        Laporkan Pemakaian
                      </div>
                      <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold">
                        <button
                          type="button"
                          disabled={isViewer}
                          onClick={() => setAllReportItemConfig('pakai', true)}
                          className="text-[#15803d] hover:underline disabled:opacity-50 cursor-pointer"
                        >
                          Semua
                        </button>
                        <span className="text-[#cbd5e1]">·</span>
                        <button
                          type="button"
                          disabled={isViewer}
                          onClick={() => setAllReportItemConfig('pakai', false)}
                          className="text-[#64748b] hover:underline disabled:opacity-50 cursor-pointer"
                        >
                          Kosong
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf2f0]">
                  {filteredGroupedItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-[#64748b]">
                        Tidak ada item aktif yang cocok dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredGroupedItems.map(([kat, list]) => (
                      <React.Fragment key={kat}>
                        <tr className="bg-[#f3f7f5]/80">
                          <td
                            colSpan={5}
                            className="px-4 py-1.5 text-xs font-bold text-[#13222b]"
                          >
                            {kat} <span className="font-medium text-[#64748b]">· {list.length}</span>
                          </td>
                        </tr>
                        {list.map((item) => {
                          const cfg = getReportItemConfig(state, item.id);
                          const hiddenInReport = !cfg.sisa && !cfg.pakai;
                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors hover:bg-[#f7faf9] ${
                                hiddenInReport ? 'bg-[#f8fafc] text-[#94a3b8]' : ''
                              }`}
                            >
                              <td className="px-4 py-2 font-semibold text-[#13222b]">
                                <span className={hiddenInReport ? 'text-[#94a3b8] line-through' : ''}>
                                  {item.nama}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-[#475569]">{item.kat}</td>
                              <td className="px-3 py-2 font-mono-num text-[#475569]">
                                {item.sat || 'pcs'}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={cfg.sisa}
                                  disabled={isViewer}
                                  onChange={(e) =>
                                    setReportItemConfig(item.id, 'sisa', e.target.checked)
                                  }
                                  className="h-4 w-4 cursor-pointer accent-[#2eb86b] disabled:cursor-not-allowed"
                                  aria-label={`Laporkan sisa stok ${item.nama}`}
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={cfg.pakai}
                                  disabled={isViewer}
                                  onChange={(e) =>
                                    setReportItemConfig(item.id, 'pakai', e.target.checked)
                                  }
                                  className="h-4 w-4 cursor-pointer accent-[#2eb86b] disabled:cursor-not-allowed"
                                  aria-label={`Laporkan pemakaian ${item.nama}`}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: EKSPOR CSV, BACKUP & RESTORE */}
        {subTab === 'export' && (
          <div className="dg-scroll no-print min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-5 py-4 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div>
                <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                  Ekspor Data CSV per Bulan
                </h2>
                <p className="text-xs text-[#64748b]">
                  Semua file CSV dibangkitkan langsung dari transaksi asli bulan terpilih (tanpa
                  mengubah data kosong menjadi 0).
                </p>
              </div>
              <div className="inline-flex items-center rounded-xl bg-[#f3f7f5] p-0.5">
                <button
                  type="button"
                  onClick={() => moveMonth(-1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] hover:bg-white hover:text-[#13222b] cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[116px] px-2 text-center text-xs font-semibold text-[#13222b]">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={() => moveMonth(1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] hover:bg-white hover:text-[#13222b] cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 4 Multi-module CSV Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div>
                  <div className="flex items-center gap-2.5 text-[13.5px] font-bold text-[#13222b]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e6f7ee] text-[#15803d]">
                      <FileSpreadsheet className="h-4 w-4" />
                    </span>
                    CSV Pemakaian Harian (Standar)
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#64748b]">
                    Matriks Tanggal × Item Aktif untuk seluruh hari di bulan {monthLabel}. Sama
                    persis dengan ekspor CSV aplikasi lama.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportDailyUsageCsv}
                  className="mt-4 flex h-8.5 w-fit items-center gap-1.5 rounded-xl bg-[#2eb86b] px-3.5 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh pemakaian-{ym}.csv
                </button>
              </div>

              <div className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div>
                  <div className="flex items-center gap-2.5 text-[13.5px] font-bold text-[#13222b]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e6f7ee] text-[#15803d]">
                      <Layers className="h-4 w-4" />
                    </span>
                    CSV Rekap Stok Bulanan Lengkap
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#64748b]">
                    Mencakup Stok Awal, Total Datang, Total Pemakaian, Sisa Akhir, dan rincian per
                    tanggal termasuk item arsip berhistori.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportMonthlyRecapCsv}
                  className="mt-4 flex h-8.5 w-fit items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-[#2eb86b]" />
                  Unduh rekap-stok-{ym}.csv
                </button>
              </div>

              <div className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div>
                  <div className="flex items-center gap-2.5 text-[13.5px] font-bold text-[#13222b]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fef3c7] text-[#b45309]">
                      <FileSpreadsheet className="h-4 w-4" />
                    </span>
                    CSV Laporan OMSET &amp; Pengeluaran
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#64748b]">
                    Tunai &amp; QRIS Nota, Real Laci &amp; mBanking, Selisih, Pengeluaran Nota/Besar,
                    Gaji Harian, hingga Tunai Akhir bulan {monthLabel}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportOmsetCsv}
                  className="mt-4 flex h-8.5 w-fit items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-[#2eb86b]" />
                  Unduh omset-{ym}.csv
                </button>
              </div>

              <div className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div>
                  <div className="flex items-center gap-2.5 text-[13.5px] font-bold text-[#13222b]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#0d2530]">
                      <ListChecks className="h-4 w-4" />
                    </span>
                    CSV Rekap Absensi &amp; Gaji Karyawan
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#64748b]">
                    Rekap kehadiran (Hadir/Libur/Izin/Sakit/Alfa), paket lembur, tarif, dan total
                    gaji karyawan bulan {monthLabel}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportPayrollCsv}
                  className="mt-4 flex h-8.5 w-fit items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-[#2eb86b]" />
                  Unduh absensi-gaji-{ym}.csv
                </button>
              </div>
            </div>

            {/* Backup & Restore JSON Section */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <h3 className="font-display text-[15px] font-bold text-[#13222b]">
                  Backup Database JSON
                </h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  Simpan salinan utuh seluruh modul DOONA GOLF
                </p>

                <div className="mt-3.5 grid grid-cols-3 gap-x-4 gap-y-2.5 border-y border-[#edf2f0] py-3 text-xs">
                  <div>
                    <div className="text-[11px] text-[#64748b]">Master Item</div>
                    <div className="font-mono-num font-bold text-[#13222b]">
                      {currentDataSummary.totalItems} ({currentDataSummary.activeItems} aktif)
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#64748b]">Bulan Stok</div>
                    <div className="font-mono-num font-bold text-[#13222b]">
                      {currentDataSummary.stockMonths.length} bulan
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#64748b]">Hari OMSET</div>
                    <div className="font-mono-num font-bold text-[#13222b]">
                      {currentDataSummary.omsetDaysCount} hari
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#64748b]">Karyawan</div>
                    <div className="font-mono-num font-bold text-[#13222b]">
                      {currentDataSummary.employeeCount} (+{currentDataSummary.archivedEmployeeCount}{' '}
                      arsip)
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#64748b]">Bulan Absensi</div>
                    <div className="font-mono-num font-bold text-[#13222b]">
                      {currentDataSummary.attendanceMonths.length} bulan
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#64748b]">Satuan</div>
                    <div className="font-mono-num font-bold text-[#13222b]">
                      {currentDataSummary.satuanCount} satuan
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadBackupJson}
                  className="mt-4 flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh Backup JSON Lengkap
                </button>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <h3 className="font-display text-[15px] font-bold text-[#13222b]">
                  Restore Backup JSON (Tervalidasi)
                </h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  Validasi struktur ketat + cadangan otomatis sebelum data diganti
                </p>

                <ul className="mt-3.5 space-y-1.5 border-y border-[#edf2f0] py-3 text-xs text-[#475569]">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2eb86b]" />
                    Struktur JSON, Master Item, dan periode stok divalidasi sebelum restore.
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2eb86b]" />
                    File tidak valid ditolak otomatis tanpa menghapus atau mengubah data lama.
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2eb86b]" />
                    Sistem otomatis membuat cadangan data lama sebelum menimpa database.
                  </li>
                </ul>

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={isViewer}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-[#fef3c7] px-4 text-xs font-semibold text-[#b45309] transition hover:bg-[#fde68a] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Pilih File Backup (.json)
                  </button>
                  {isViewer && (
                    <span className="text-xs text-[#64748b]">
                      Restore dinonaktifkan pada mode Viewer.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {preRestoreBackup && preRestoreSummary && (
              <div className="rounded-2xl bg-[#e6f7ee] p-4 shadow-[0_6px_24px_rgba(13,37,48,0.04)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <ArchiveRestore className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#15803d]" />
                    <div>
                      <div className="text-xs font-bold text-[#15803d]">
                        Cadangan Otomatis Pra-Restore Tersimpan
                      </div>
                      <p className="mt-0.5 text-xs text-[#13222b]">
                        Dibuat otomatis pada{' '}
                        <strong className="font-bold">
                          {new Date(preRestoreBackup.savedAt).toLocaleString('id-ID')}
                        </strong>{' '}
                        ({preRestoreSummary.totalItems} item, {preRestoreSummary.stockMonths.length}{' '}
                        bulan stok, {preRestoreSummary.omsetDaysCount} hari OMSET).
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadPreRestoreSnapshot}
                      className="flex h-8.5 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-[#15803d] shadow-xs transition hover:bg-[#f7faf9] cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Unduh Cadangan Lama
                    </button>
                    {!isViewer && (
                      <button
                        type="button"
                        onClick={() => setShowRollbackModal(true)}
                        className="flex h-8.5 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-3.5 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Pulihkan Cadangan Ini
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL KIRIM TELEGRAM */}
      {showTgModal && (
        <div className="no-print fixed inset-0 z-120 flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="flex items-start justify-between gap-2 border-b border-[#edf2f0] px-5 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#13222b]">
                  Kirim Laporan ke Telegram
                </h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  {activePresetMeta.label} · {isMonthScoped ? monthLabel : fullDateLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTgModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!isCloudConnected ? (
              <div className="p-5">
                <div className="rounded-xl bg-[#fef3c7] p-3.5 text-xs text-[#92400e]">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Database className="h-3.5 w-3.5 text-[#b45309]" />
                    Mode Database SQLite Lokal (Offline)
                  </div>
                  <p className="mt-1 leading-relaxed">
                    Aplikasi berjalan dengan database SQLite lokal tanpa jembatan bot Telegram.
                    Gunakan tombol Salin Laporan untuk mengirim teks langsung ke WhatsApp atau
                    Telegram desktop Anda.
                  </p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTgModal(false)}
                    className="h-9 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTgModal(false);
                      navigateTo('db');
                    }}
                    className="h-9 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                  >
                    Buka Koneksi Database
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-5">
                  <div className="rounded-xl border border-[#edf2f0] bg-[#f7faf9] p-3">
                    <div className="mb-1 text-[11px] font-semibold text-[#64748b]">
                      Cuplikan teks yang akan dikirim ({charCount} karakter):
                    </div>
                    <pre className="font-mono-num max-h-40 overflow-y-auto text-[11px] whitespace-pre-wrap text-[#13222b]">
                      {currentReportText.slice(0, 650)}
                      {currentReportText.length > 650 ? '\n…' : ''}
                    </pre>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setShowTgModal(false)}
                    disabled={tgSending}
                    className="h-9 rounded-xl bg-white px-3.5 text-xs font-semibold text-[#13222b] shadow-xs transition hover:bg-[#e1ebe7] cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSendTelegram}
                    disabled={tgSending}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] disabled:opacity-60 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {tgSending ? 'Mengirim…' : 'Ya, Kirim Sekarang'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL RESTORE BACKUP JSON */}
      {pendingRestore && pendingRestore.validation.summary && (
        <div className="no-print fixed inset-0 z-120 flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="flex items-start justify-between gap-2 border-b border-[#edf2f0] px-5 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#13222b]">
                  Konfirmasi Restore Backup JSON
                </h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  File tervalidasi: {pendingRestore.fileName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                disabled={restoring}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="overflow-hidden rounded-xl border border-[#edf2f0]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f7faf9] text-[11px] font-bold uppercase tracking-[0.04em] text-[#64748b]">
                    <tr className="border-b border-[#edf2f0]">
                      <th className="px-3 py-2">Komponen Data</th>
                      <th className="px-3 py-2 text-right">Data Saat Ini</th>
                      <th className="px-3 py-2 text-right text-[#15803d]">File Backup</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono-num divide-y divide-[#edf2f0]">
                    <tr>
                      <td className="px-3 py-1.5 font-sans text-[#475569]">Master Item</td>
                      <td className="px-3 py-1.5 text-right">{currentDataSummary.totalItems}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-[#15803d]">
                        {pendingRestore.validation.summary.totalItems}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-sans text-[#475569]">Periode Stok</td>
                      <td className="px-3 py-1.5 text-right">
                        {currentDataSummary.stockMonths.length} bulan
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold text-[#15803d]">
                        {pendingRestore.validation.summary.stockMonths.length} bulan
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-sans text-[#475569]">Transaksi OMSET</td>
                      <td className="px-3 py-1.5 text-right">
                        {currentDataSummary.omsetDaysCount} hari
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold text-[#15803d]">
                        {pendingRestore.validation.summary.omsetDaysCount} hari
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-sans text-[#475569]">Karyawan</td>
                      <td className="px-3 py-1.5 text-right">{currentDataSummary.employeeCount}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-[#15803d]">
                        {pendingRestore.validation.summary.employeeCount}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-sans text-[#475569]">Periode Absensi</td>
                      <td className="px-3 py-1.5 text-right">
                        {currentDataSummary.attendanceMonths.length} bulan
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold text-[#15803d]">
                        {pendingRestore.validation.summary.attendanceMonths.length} bulan
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {pendingRestore.validation.warnings.length > 0 && (
                <div className="mt-3 rounded-xl bg-[#fef3c7] p-2.5 text-[11px] text-[#92400e]">
                  {pendingRestore.validation.warnings.map((w, idx) => (
                    <div key={idx}>• {w}</div>
                  ))}
                </div>
              )}

              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl bg-[#e6f7ee] p-3 text-xs text-[#15803d]">
                <input
                  type="checkbox"
                  checked={autoDownloadOldBackup}
                  onChange={(e) => setAutoDownloadOldBackup(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#2eb86b]"
                />
                <span>
                  <strong>Unduh otomatis cadangan data lama (.json)</strong> sebelum menimpa data.
                  (Cadangan juga selalu disimpan di penyimpanan lokal browser sebagai pengaman.)
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-5 py-3">
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                disabled={restoring}
                className="h-9 rounded-xl bg-white px-3.5 text-xs font-semibold text-[#13222b] shadow-xs transition hover:bg-[#e1ebe7] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={restoring}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] disabled:opacity-60 cursor-pointer"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {restoring ? 'Memulihkan…' : 'Buat Cadangan & Restore Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ROLLBACK */}
      {showRollbackModal && preRestoreBackup && (
        <div className="no-print fixed inset-0 z-120 flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="px-5 py-4">
              <h3 className="font-display text-base font-bold text-[#13222b]">
                Pulihkan Cadangan Pra-Restore?
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">
                Data aplikasi akan dikembalikan ke kondisi sebelum restore terakhir (
                <strong className="text-[#13222b]">
                  {new Date(preRestoreBackup.savedAt).toLocaleString('id-ID')}
                </strong>
                ). Data saat ini tetap dicadangkan terlebih dahulu.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-5 py-3">
              <button
                type="button"
                onClick={() => setShowRollbackModal(false)}
                className="h-9 rounded-xl bg-white px-3.5 text-xs font-semibold text-[#13222b] shadow-xs transition hover:bg-[#e1ebe7] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmRollback}
                className="h-9 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
              >
                Ya, Pulihkan Cadangan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
