import React, { useMemo, useRef, useState } from 'react';
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
  ShieldAlert,
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
      // Fallback ke textarea copy di bawah
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

  // Telegram modal state
  const [showTgModal, setShowTgModal] = useState(false);
  const [tgSending, setTgSending] = useState(false);

  // Restore JSON modal & validation state
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

  // Kunci unik untuk menjaga teks editan manual tetap terikat ke tanggal/bulan & jenis laporan
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

  // Handlers
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
        result.savedToCloud ? ' Tersinkron ke database cloud.' : ''
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
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Hidden shared file input for Restore Backup JSON */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleSelectRestoreFile}
      />

      {/* Panel Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e6f6f4] text-[#1a9e94]">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight text-[#1f2a36]">
              Laporan &amp; Ekspor
            </h1>
            <p className="text-[11px] text-slate-500">
              Sumber terpadu dari Input Harian, Tabel Bulanan, OMSET, dan Absensi &amp; Gaji
            </p>
          </div>
        </div>

        {/* Sub-tab Navigation (preserving legacy 3 tabs + dedicated Export & Backup tab) */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
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
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-white text-[#1f2a36] shadow-xs'
                    : 'text-slate-600 hover:text-[#1f2a36]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
                {t.id === 'edit' && isCustomEdited && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toast / Feedback Banner */}
      {toast && (
        <div className="no-print border-b border-slate-200 px-5 py-2">
          <div
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : toast.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-teal-200 bg-[#e6f6f4] text-[#12857c]'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : toast.type === 'error' ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <Info className="h-4 w-4 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded p-0.5 hover:bg-black/5"
              aria-label="Tutup notifikasi"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="dg-scroll flex min-h-0 flex-1 flex-col overflow-hidden p-5">
        {/* ================= TAB 1: TEKS LAPORAN (PRATINJAU) ================= */}
        {subTab === 'preview' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {/* Toolbar: Period/Date Selector + Report Preset */}
            <div className="no-print flex flex-wrap items-center justify-between gap-2.5">
              {/* Date or Month Navigator */}
              <div className="flex flex-wrap items-center gap-1.5">
                {isMonthScoped ? (
                  <>
                    <button
                      type="button"
                      onClick={() => moveMonth(-1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      title="Bulan sebelumnya"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-[#1f2a36]">
                      <Calendar className="h-3.5 w-3.5 text-[#1a9e94]" />
                      <span>{monthLabel}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => moveMonth(1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      title="Bulan berikutnya"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={goToday}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Bulan Ini
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => moveDay(-1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#1f2a36] outline-none focus:border-[#1a9e94]"
                    />
                    <button
                      type="button"
                      onClick={() => moveDay(1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      title="Hari berikutnya"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={goToday}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Hari ini
                    </button>
                    <span className="ml-1 text-xs font-semibold text-[#1f2a36]">
                      {fullDateLabel}
                    </span>
                  </>
                )}
              </div>

              {/* Right Quick Edit Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {isCustomEdited && (
                  <button
                    type="button"
                    onClick={handleResetToOriginal}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Kembalikan Teks Asli
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSubTab('edit')}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Teks Ini
                </button>
              </div>
            </div>

            {/* Report Mode Selector Strip */}
            <div className="no-print grid grid-cols-2 gap-2 lg:grid-cols-4">
              {PRESET_OPTIONS.map((opt) => {
                const selected = preset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPreset(opt.id)}
                    className={`flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-all ${
                      selected
                        ? 'border-[#1a9e94] bg-[#eefaf8] ring-1 ring-[#1a9e94]/30'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-1">
                      <span
                        className={`text-xs font-bold ${
                          selected ? 'text-[#12857c]' : 'text-[#1f2a36]'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          opt.scope === 'day'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-teal-100/70 text-[#12857c]'
                        }`}
                      >
                        {opt.scope === 'day' ? 'Harian' : 'Bulanan'}
                      </span>
                    </div>
                    <span className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                      {opt.shortDesc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Compact Live Telemetry Strip (Read-Only from Actual Data) */}
            <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
                <span>
                  Item dilaporkan:{' '}
                  <strong className="font-mono-num text-[#1f2a36]">
                    {stats.selectedItemsCount}/{stats.activeItemsCount}
                  </strong>
                </span>
                {!isMonthScoped && (
                  <>
                    <span>
                      Barang datang tgl {day}:{' '}
                      <strong className="font-mono-num text-emerald-700">
                        {stats.datangCount} item
                      </strong>
                    </span>
                    <span>
                      Closing terisi:{' '}
                      <strong className="font-mono-num text-[#1f2a36]">
                        {stats.closingFilledCount}/{stats.activeItemsCount}
                      </strong>
                    </span>
                    {stats.negativeUsageCount > 0 && (
                      <span className="font-semibold text-rose-600">
                        {stats.negativeUsageCount} pemakaian negatif
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                {isCustomEdited ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                    Diedit Manual
                  </span>
                ) : (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">
                    Otomatis dari Data Asli
                  </span>
                )}
                <span className="font-mono-num">
                  {lineCount} baris · {charCount} kar
                </span>
              </div>
            </div>

            {/* Printable Report Header (Only shown on Print / PDF) */}
            <div className="hidden print:block print:border-b print:border-slate-300 print:pb-3 print:mb-4">
              <div className="text-lg font-extrabold text-slate-900">
                DOONA GOLF — {activePresetMeta.label.toUpperCase()}
              </div>
              <div className="text-xs text-slate-600">
                Periode: {isMonthScoped ? monthLabel : fullDateLabel} · Dicetak pada{' '}
                {new Date().toLocaleString('id-ID')}
              </div>
            </div>

            {/* Preview Box */}
            <pre className="dg-scroll dg-print-report min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-[#f8fafc] p-4 font-mono-num text-[13px] leading-relaxed whitespace-pre-wrap text-[#1f2a36] print:overflow-visible print:border-none print:bg-white print:p-0">
              {currentReportText}
            </pre>

            {/* Bottom Action Bar (Exact legacy parity + safe restore trigger) */}
            <div className="no-print flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-3.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#12857c]"
              >
                <Copy className="h-3.5 w-3.5" />
                Salin WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setShowTgModal(true)}
                disabled={tgSending}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-[#0088cc] px-3.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#0073ad] disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                {tgSending ? 'Mengirim…' : 'Kirim Telegram'}
              </button>

              <button
                type="button"
                onClick={handlePrintPdf}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak / PDF
              </button>

              <button
                type="button"
                onClick={handleExportDailyUsageCsv}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                Ekspor CSV
              </button>

              <button
                type="button"
                onClick={handleDownloadBackupJson}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5 text-[#1a9e94]" />
                Backup JSON
              </button>

              <button
                type="button"
                disabled={isViewer}
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5 text-amber-600" />
                Restore Backup
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 2: EDIT TEKS MANUAL ================= */}
        {subTab === 'edit' && (
          <div className="no-print flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#1f2a36]">
                  Edit Teks Laporan — {activePresetMeta.label} (
                  {isMonthScoped ? monthLabel : fullDateLabel})
                </h2>
                <p className="text-xs text-slate-500">
                  Ubah, tambah catatan khusus, atau sesuaikan kata-kata sebelum disalin atau dikirim.
                  Tidak mengubah angka pada database asli.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToOriginal}
                  disabled={!isCustomEdited}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Kembalikan ke Teks Asli
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('preview')}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-3 text-xs font-bold text-white hover:bg-[#12857c]"
                >
                  Selesai &amp; Pratinjau →
                </button>
              </div>
            </div>

            <textarea
              value={currentReportText}
              onChange={(e) => handleManualTextChange(e.target.value)}
              spellCheck={false}
              className="dg-scroll min-h-0 flex-1 resize-none rounded-xl border border-slate-300 bg-white p-4 font-mono-num text-[13px] leading-relaxed text-[#1f2a36] outline-none focus:border-[#1a9e94] focus:ring-2 focus:ring-[#1a9e94]/15"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                {isCustomEdited
                  ? 'Perubahan manual aktif — teks ini yang akan disalin/dikirim.'
                  : 'Menampilkan teks otomatis asli dari sistem.'}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-3.5 text-xs font-bold text-white hover:bg-[#12857c]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Salin WhatsApp Sekarang
                </button>
                <button
                  type="button"
                  onClick={() => setShowTgModal(true)}
                  disabled={tgSending}
                  className="flex h-9 items-center gap-1.5 rounded-lg bg-[#0088cc] px-3.5 text-xs font-bold text-white hover:bg-[#0073ad] disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  Kirim Telegram
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: ATUR FORMAT ITEM ================= */}
        {subTab === 'setting' && (
          <div className="no-print flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div>
                <h2 className="text-sm font-bold text-[#1f2a36]">
                  Atur Isi Laporan per Item
                </h2>
                <p className="text-xs text-slate-500">
                  Pilih item dan kolom (Sisa Stok dan/atau Pemakaian) yang dimasukkan ke laporan stok.
                  Item dengan kedua centang kosong akan otomatis dilewati.
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
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-[#1a9e94]" />
                  Centang Semua
                </button>
                <button
                  type="button"
                  disabled={isViewer}
                  onClick={() => {
                    setAllReportItemConfig('both', false);
                    showNotice('info', 'Semua centang item pada laporan telah dihapus.');
                  }}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Square className="h-3.5 w-3.5 text-slate-400" />
                  Hapus Semua Centang
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('preview')}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-3 text-xs font-bold text-white hover:bg-[#12857c]"
                >
                  Lihat Teks Laporan →
                </button>
              </div>
            </div>

            {/* Info Banner: Barang Datang Otomatis (exact legacy callout) */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-[#eefaf3] px-3.5 py-2.5 text-xs text-[#1f8a5b]">
              <div>
                <strong>Barang Datang Otomatis:</strong> Item yang memiliki barang datang (&gt; 0)
                pada tanggal terpilih akan selalu disertakan di bagian paling atas laporan setelah
                informasi tanggal/hari.
              </div>
              <span className="font-mono-num font-bold">
                Sisa: {stats.sisaCheckedCount} · Pakai: {stats.pakaiCheckedCount} /{' '}
                {stats.activeItemsCount} item
              </span>
            </div>

            {/* Search Filter */}
            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={settingSearch}
                onChange={(e) => setSettingSearch(e.target.value)}
                placeholder="Cari item atau kategori..."
                className="h-8 w-full rounded-lg border border-slate-200 bg-white pr-8 pl-8 text-xs text-[#1f2a36] outline-none focus:border-[#1a9e94]"
              />
              {settingSearch && (
                <button
                  type="button"
                  onClick={() => setSettingSearch('')}
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Item Config Table */}
            <div className="dg-scroll min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold tracking-wide text-slate-600 uppercase">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2.5">Nama Item</th>
                    <th className="px-3 py-2.5">Kategori</th>
                    <th className="w-24 px-3 py-2.5">Satuan</th>
                    <th className="w-36 px-3 py-2.5 text-center">
                      <div>Laporkan Sisa Stok</div>
                      <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] font-semibold normal-case">
                        <button
                          type="button"
                          disabled={isViewer}
                          onClick={() => setAllReportItemConfig('sisa', true)}
                          className="text-[#1a9e94] hover:underline disabled:opacity-50"
                        >
                          Semua
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          disabled={isViewer}
                          onClick={() => setAllReportItemConfig('sisa', false)}
                          className="text-slate-500 hover:underline disabled:opacity-50"
                        >
                          Kosong
                        </button>
                      </div>
                    </th>
                    <th className="w-36 px-3 py-2.5 text-center">
                      <div>Laporkan Pemakaian</div>
                      <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] font-semibold normal-case">
                        <button
                          type="button"
                          disabled={isViewer}
                          onClick={() => setAllReportItemConfig('pakai', true)}
                          className="text-[#1a9e94] hover:underline disabled:opacity-50"
                        >
                          Semua
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          disabled={isViewer}
                          onClick={() => setAllReportItemConfig('pakai', false)}
                          className="text-slate-500 hover:underline disabled:opacity-50"
                        >
                          Kosong
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGroupedItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                        Tidak ada item aktif yang cocok dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredGroupedItems.map(([kat, list]) => (
                      <React.Fragment key={kat}>
                        <tr className="bg-slate-100/80">
                          <td
                            colSpan={5}
                            className="px-4 py-1.5 text-[11px] font-bold tracking-wider text-slate-600 uppercase"
                          >
                            {kat} ({list.length})
                          </td>
                        </tr>
                        {list.map((item) => {
                          const cfg = getReportItemConfig(state, item.id);
                          const hiddenInReport = !cfg.sisa && !cfg.pakai;
                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors hover:bg-slate-50/80 ${
                                hiddenInReport ? 'bg-slate-50/40 text-slate-400' : ''
                              }`}
                            >
                              <td className="px-4 py-2 font-semibold text-[#1f2a36]">
                                <span className={hiddenInReport ? 'text-slate-400 line-through' : ''}>
                                  {item.nama}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-500">{item.kat}</td>
                              <td className="px-3 py-2">
                                <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono-num text-[11px] font-semibold text-slate-700">
                                  {item.sat || 'pcs'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={cfg.sisa}
                                  disabled={isViewer}
                                  onChange={(e) =>
                                    setReportItemConfig(item.id, 'sisa', e.target.checked)
                                  }
                                  className="h-4 w-4 cursor-pointer accent-[#1a9e94] disabled:cursor-not-allowed"
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
                                  className="h-4 w-4 cursor-pointer accent-[#1a9e94] disabled:cursor-not-allowed"
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

        {/* ================= TAB 4: EKSPOR CSV, BACKUP & RESTORE ================= */}
        {subTab === 'export' && (
          <div className="dg-scroll no-print min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            {/* Period Selector for CSV */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-[#1f2a36]">Ekspor Data CSV per Bulan</h2>
                <p className="text-xs text-slate-500">
                  Semua file CSV dibangkitkan langsung dari transaksi asli bulan terpilih (tanpa
                  mengubah data kosong menjadi 0).
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => moveMonth(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-[#1f2a36]">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={() => moveMonth(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 4 Multi-module CSV Cards */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#1f2a36]">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    CSV Pemakaian Harian (Format Standar)
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Matriks Tanggal × Item Aktif untuk seluruh hari di bulan {monthLabel}. Sama
                    persis dengan ekspor CSV aplikasi lama.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportDailyUsageCsv}
                  className="mt-3 flex h-8 w-fit items-center gap-1.5 rounded-lg bg-[#1a9e94] px-3 text-xs font-bold text-white hover:bg-[#12857c]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh pemakaian-{ym}.csv
                </button>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#1f2a36]">
                    <Layers className="h-4 w-4 text-teal-600" />
                    CSV Rekap Stok Bulanan Lengkap
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Mencakup Stok Awal, Total Datang, Total Pemakaian, Sisa Akhir, dan rincian per
                    tanggal termasuk item arsip berhistori.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportMonthlyRecapCsv}
                  className="mt-3 flex h-8 w-fit items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh rekap-stok-{ym}.csv
                </button>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#1f2a36]">
                    <FileSpreadsheet className="h-4 w-4 text-amber-600" />
                    CSV Laporan OMSET &amp; Pengeluaran
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Tunai &amp; QRIS Nota, Real Laci &amp; mBanking, Selisih, Pengeluaran Nota/Besar,
                    Gaji Harian, hingga Tunai Akhir bulan {monthLabel}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportOmsetCsv}
                  className="mt-3 flex h-8 w-fit items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh omset-{ym}.csv
                </button>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-[#1f2a36]">
                    <ListChecks className="h-4 w-4 text-indigo-600" />
                    CSV Rekap Absensi &amp; Gaji Karyawan
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Rekap kehadiran (Hadir/Libur/Izin/Sakit/Alfa), paket lembur, tarif, dan total
                    gaji karyawan bulan {monthLabel}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportPayrollCsv}
                  className="mt-3 flex h-8 w-fit items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh absensi-gaji-{ym}.csv
                </button>
              </div>
            </div>

            {/* Backup & Restore JSON Section */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Backup JSON Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e6f6f4] text-[#1a9e94]">
                      <FileJson className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1f2a36]">Backup Database JSON</h3>
                      <p className="text-[11px] text-slate-500">
                        Simpan salinan utuh seluruh modul DOONA GOLF
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500">Master Item</div>
                    <div className="font-mono-num font-bold text-[#1f2a36]">
                      {currentDataSummary.totalItems} ({currentDataSummary.activeItems} aktif)
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Bulan Stok</div>
                    <div className="font-mono-num font-bold text-[#1f2a36]">
                      {currentDataSummary.stockMonths.length} bulan
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Hari OMSET</div>
                    <div className="font-mono-num font-bold text-[#1f2a36]">
                      {currentDataSummary.omsetDaysCount} hari
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Karyawan</div>
                    <div className="font-mono-num font-bold text-[#1f2a36]">
                      {currentDataSummary.employeeCount} (+{currentDataSummary.archivedEmployeeCount}{' '}
                      arsip)
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Bulan Absensi</div>
                    <div className="font-mono-num font-bold text-[#1f2a36]">
                      {currentDataSummary.attendanceMonths.length} bulan
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Satuan</div>
                    <div className="font-mono-num font-bold text-[#1f2a36]">
                      {currentDataSummary.satuanCount} satuan
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadBackupJson}
                  className="mt-3.5 flex h-9 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-4 text-xs font-bold text-white hover:bg-[#12857c]"
                >
                  <Download className="h-4 w-4" />
                  Unduh Backup JSON Lengkap
                </button>
              </div>

              {/* Restore JSON Card with Strict Security Notice */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1f2a36]">
                      Restore Backup JSON (Tervalidasi)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Validasi struktur ketat + cadangan otomatis sebelum data diganti
                    </p>
                  </div>
                </div>

                <ul className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    Struktur JSON, Master Item, dan periode stok divalidasi sebelum restore.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    File tidak valid ditolak otomatis tanpa menghapus atau mengubah data lama.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    Sistem otomatis membuat cadangan data lama sebelum menimpa database.
                  </li>
                </ul>

                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isViewer}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    Pilih File Backup (.json)
                  </button>
                  {isViewer && (
                    <span className="text-[11px] text-slate-500">
                      Restore dinonaktifkan pada mode Viewer.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Automatic Pre-Restore Safety Backup Banner */}
            {preRestoreBackup && preRestoreSummary && (
              <div className="rounded-xl border border-teal-200 bg-[#eefaf8] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <ArchiveRestore className="mt-0.5 h-5 w-5 shrink-0 text-[#1a9e94]" />
                    <div>
                      <div className="text-xs font-bold text-[#12857c]">
                        Cadangan Otomatis Pra-Restore Tersimpan
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Dibuat otomatis pada{' '}
                        <strong>
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
                      className="flex h-8 items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 text-xs font-semibold text-[#12857c] hover:bg-teal-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Unduh Cadangan Lama
                    </button>
                    {!isViewer && (
                      <button
                        type="button"
                        onClick={() => setShowRollbackModal(true)}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-3 text-xs font-bold text-white hover:bg-[#12857c]"
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

      {/* ================= MODAL KONFIRMASI KIRIM TELEGRAM ================= */}
      {showTgModal && (
        <div className="no-print fixed inset-0 z-120 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e0f2fe] text-[#0088cc]">
                  <Send className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1f2a36]">Kirim Laporan ke Telegram</h3>
                  <p className="text-xs text-slate-500">
                    {activePresetMeta.label} · {isMonthScoped ? monthLabel : fullDateLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTgModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!isCloudConnected ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-bold">
                  <Database className="h-4 w-4 text-amber-600" />
                  Koneksi Google Apps Script Belum Aktif
                </div>
                <p className="mt-1 leading-relaxed text-amber-800">
                  Integrasi bot Telegram berjalan aman melalui Google Apps Script (token bot
                  tersimpan di Code.gs). Hubungkan dan login ke database Google Sheets terlebih
                  dahulu untuk mengirim laporan langsung ke Telegram.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTgModal(false)}
                    className="h-8 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTgModal(false);
                      navigateTo('db');
                    }}
                    className="h-8 rounded-lg bg-[#1a9e94] px-3 text-xs font-bold text-white hover:bg-[#12857c]"
                  >
                    Buka Koneksi Database
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-1 text-[11px] font-semibold text-slate-500">
                    Cuplikan teks yang akan dikirim ({charCount} karakter):
                  </div>
                  <pre className="max-h-40 overflow-y-auto font-mono-num text-[11px] whitespace-pre-wrap text-slate-700">
                    {currentReportText.slice(0, 650)}
                    {currentReportText.length > 650 ? '\n…' : ''}
                  </pre>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTgModal(false)}
                    disabled={tgSending}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSendTelegram}
                    disabled={tgSending}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-[#0088cc] px-4 text-xs font-bold text-white hover:bg-[#0073ad] disabled:opacity-60"
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

      {/* ================= MODAL KONFIRMASI RESTORE BACKUP JSON ================= */}
      {pendingRestore && pendingRestore.validation.summary && (
        <div className="no-print fixed inset-0 z-120 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1f2a36]">
                    Konfirmasi Restore Backup JSON
                  </h3>
                  <p className="text-xs text-slate-500">File tervalidasi: {pendingRestore.fileName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                disabled={restoring}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Comparison Table: Data Saat Ini vs File Backup */}
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2">Komponen Data</th>
                    <th className="px-3 py-2 text-right">Data Saat Ini</th>
                    <th className="px-3 py-2 text-right text-[#12857c]">File Backup</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-num">
                  <tr>
                    <td className="px-3 py-1.5 font-sans text-slate-700">Master Item</td>
                    <td className="px-3 py-1.5 text-right">{currentDataSummary.totalItems}</td>
                    <td className="px-3 py-1.5 text-right font-bold text-[#12857c]">
                      {pendingRestore.validation.summary.totalItems}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 font-sans text-slate-700">Periode Stok</td>
                    <td className="px-3 py-1.5 text-right">
                      {currentDataSummary.stockMonths.length} bulan
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold text-[#12857c]">
                      {pendingRestore.validation.summary.stockMonths.length} bulan
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 font-sans text-slate-700">Transaksi OMSET</td>
                    <td className="px-3 py-1.5 text-right">
                      {currentDataSummary.omsetDaysCount} hari
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold text-[#12857c]">
                      {pendingRestore.validation.summary.omsetDaysCount} hari
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 font-sans text-slate-700">Karyawan</td>
                    <td className="px-3 py-1.5 text-right">{currentDataSummary.employeeCount}</td>
                    <td className="px-3 py-1.5 text-right font-bold text-[#12857c]">
                      {pendingRestore.validation.summary.employeeCount}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 font-sans text-slate-700">Periode Absensi</td>
                    <td className="px-3 py-1.5 text-right">
                      {currentDataSummary.attendanceMonths.length} bulan
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold text-[#12857c]">
                      {pendingRestore.validation.summary.attendanceMonths.length} bulan
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {pendingRestore.validation.warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                {pendingRestore.validation.warnings.map((w, idx) => (
                  <div key={idx}>• {w}</div>
                ))}
              </div>
            )}

            {/* Pre-restore Safety Backup Checkbox */}
            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
              <input
                type="checkbox"
                checked={autoDownloadOldBackup}
                onChange={(e) => setAutoDownloadOldBackup(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#1a9e94]"
              />
              <span>
                <strong>Unduh otomatis cadangan data lama (.json)</strong> sebelum menimpa data.
                (Cadangan juga selalu disimpan di penyimpanan lokal browser sebagai pengaman.)
              </span>
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                disabled={restoring}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={restoring}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-4 text-xs font-bold text-white hover:bg-[#12857c] disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                {restoring ? 'Memulihkan…' : 'Buat Cadangan & Restore Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL KONFIRMASI ROLLBACK CADANGAN PRA-RESTORE ================= */}
      {showRollbackModal && preRestoreBackup && (
        <div className="no-print fixed inset-0 z-120 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-sm font-bold text-[#1f2a36]">
              Pulihkan Cadangan Pra-Restore?
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Data aplikasi akan dikembalikan ke kondisi sebelum restore terakhir (
              <strong>{new Date(preRestoreBackup.savedAt).toLocaleString('id-ID')}</strong>). Data
              saat ini tetap dicadangkan terlebih dahulu.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRollbackModal(false)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmRollback}
                className="h-9 rounded-lg bg-[#1a9e94] px-4 text-xs font-bold text-white hover:bg-[#12857c]"
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
