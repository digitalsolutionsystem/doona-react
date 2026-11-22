import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Package,
  Save,
  Search,
  Table2,
  X,
} from 'lucide-react';
import { MONTH_NAMES } from '../constants/defaults';
import { useApp } from '../context/AppContext';
import {
  formatNum,
  getMonth,
  getYear,
  hasVal,
  shiftMonth,
} from '../domain/dateUtils';
import {
  getStokAwalSummary,
  parseStockInput,
  type StokAwalItemRow,
} from '../domain/stockCalculations';

type StokAwalFilter = 'all' | 'empty' | 'filled' | 'diff_prev';

export const StokAwalPage: React.FC = () => {
  const {
    state,
    ym,
    isViewer,
    hasUnsavedAwal,
    sync,
    moveMonth,
    setStockCell,
    saveStokAwalNow,
    importStokAwalFromPrevMonth,
    navigateTo,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<StokAwalFilter>('all');
  const [editingDrafts, setEditingDrafts] = useState<Record<string, string>>({});
  const [invalidHint, setInvalidHint] = useState<{ itemId: string; text: string } | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(
    null
  );
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const prevYm = useMemo(() => shiftMonth(ym, -1), [ym]);
  const monthLabel = `${MONTH_NAMES[getMonth(ym) - 1]} ${getYear(ym)}`;
  const prevMonthLabel = `${MONTH_NAMES[getMonth(prevYm) - 1]} ${getYear(prevYm)}`;

  const summary = useMemo(
    () => getStokAwalSummary(state, ym, prevYm),
    [state, ym, prevYm]
  );

  // Reset buffer ketik saat pindah bulan
  useEffect(() => {
    setEditingDrafts({});
    setInvalidHint(null);
  }, [ym]);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(t);
  }, [feedback]);

  useEffect(() => {
    if (!invalidHint) return;
    const t = window.setTimeout(() => setInvalidHint(null), 3200);
    return () => window.clearTimeout(t);
  }, [invalidHint]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return summary.groupedItems
      .map(([cat, items]) => {
        const list = items.filter((item) => {
          const row = summary.rowsByItemId[item.id];
          if (!row) return false;
          if (q) {
            const matches =
              item.nama.toLowerCase().includes(q) ||
              item.kat.toLowerCase().includes(q) ||
              item.id.toLowerCase().includes(q) ||
              (item.sat || '').toLowerCase().includes(q);
            if (!matches) return false;
          }
          if (filterMode === 'filled' && !row.isFilled) return false;
          if (filterMode === 'empty' && row.isFilled) return false;
          if (filterMode === 'diff_prev' && !row.differsFromPrev) return false;
          return true;
        });
        return [cat, list] as [string, typeof items];
      })
      .filter(([, list]) => list.length > 0);
  }, [summary.groupedItems, summary.rowsByItemId, searchQuery, filterMode]);

  const orderedVisibleIds = useMemo(
    () => filteredGroups.flatMap(([, list]) => list.map((i) => i.id)),
    [filteredGroups]
  );

  // Auto-focus item kosong pertama pada desktop saat membuka halaman / ganti bulan (identik qFocus)
  useEffect(() => {
    if (isViewer || searchQuery || filterMode !== 'all' || orderedVisibleIds.length === 0) return;
    if (typeof window !== 'undefined' && window.matchMedia('(pointer:fine)').matches) {
      const firstEmptyId =
        orderedVisibleIds.find((id) => !summary.rowsByItemId[id]?.isFilled) ||
        orderedVisibleIds[0];
      const el = inputRefs.current[firstEmptyId];
      if (el) {
        el.focus();
        el.select();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym]);

  const getCellKey = (itemId: string) => `${ym}|a|${itemId}`;

  const handleSave = useCallback(async () => {
    if (isViewer || isSaving) return;
    setIsSaving(true);
    const ok = await saveStokAwalNow();
    setIsSaving(false);
    if (ok) {
      setFeedback({
        tone: 'ok',
        text: `Stok awal ${monthLabel} berhasil disimpan.`,
      });
    } else {
      setFeedback({
        tone: 'err',
        text: 'Gagal sinkron ke server. Data stok awal tetap tersimpan aman di cache lokal.',
      });
    }
  }, [isViewer, isSaving, saveStokAwalNow, monthLabel]);

  // Shortcut Ctrl+S / Cmd+S untuk simpan langsung
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!isViewer) void handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, isViewer]);

  const handleInputChange = (itemId: string, raw: string) => {
    if (isViewer) return;
    const key = getCellKey(itemId);

    // Cek karakter non-numerik
    const cleanedChars = raw.replace(/[^0-9.,-]/g, '');
    if (cleanedChars !== raw) {
      setInvalidHint({
        itemId,
        text: 'Hanya angka desimal yang diperbolehkan.',
      });
    }

    setEditingDrafts((prev) => ({ ...prev, [key]: cleanedChars }));

    const parsed = parseStockInput(cleanedChars);
    if (parsed.negative || cleanedChars.includes('-')) {
      setInvalidHint({
        itemId,
        text: 'Stok awal tidak boleh bernilai negatif.',
      });
      return;
    }

    if (invalidHint?.itemId === itemId && cleanedChars === raw) {
      setInvalidHint(null);
    }

    if (parsed.empty) {
      setStockCell(ym, 'a', 0, itemId, '');
    } else if (parsed.valid && parsed.value !== undefined) {
      setStockCell(ym, 'a', 0, itemId, parsed.value);
    }
  };

  const handleInputBlur = (itemId: string) => {
    const key = getCellKey(itemId);
    const raw = editingDrafts[key];
    if (raw === undefined) return;

    const parsed = parseStockInput(raw);
    if (parsed.negative || raw.includes('-')) {
      setInvalidHint({
        itemId,
        text: 'Nilai negatif ditolak dan dikembalikan ke nilai sebelumnya.',
      });
    } else if (parsed.empty) {
      setStockCell(ym, 'a', 0, itemId, '');
    } else if (parsed.valid && parsed.value !== undefined) {
      setStockCell(ym, 'a', 0, itemId, parsed.value);
    } else {
      setInvalidHint({
        itemId,
        text: 'Format angka tidak valid.',
      });
    }

    setEditingDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, itemId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const idx = orderedVisibleIds.indexOf(itemId);
      if (idx === -1) return;
      const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
      const targetId = orderedVisibleIds[nextIdx];
      if (targetId) {
        const el = inputRefs.current[targetId];
        if (el) {
          el.focus();
          el.select();
        }
      }
    }
  };

  const handleCopyPrevSingle = (row: StokAwalItemRow) => {
    if (isViewer || !hasVal(row.prevClosing)) return;
    const key = getCellKey(row.item.id);
    setEditingDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setStockCell(ym, 'a', 0, row.item.id, row.prevClosing);
  };

  const executeImportPrevMonth = async (mode: 'all' | 'empty_only') => {
    if (isViewer || isImporting) return;
    setShowImportModal(false);
    setIsImporting(true);
    setEditingDrafts({});
    const res = await importStokAwalFromPrevMonth(ym, mode);
    setIsImporting(false);

    if (!res.hadPrevData) {
      setFeedback({
        tone: 'info',
        text: `Data closing bulan lalu (${prevMonthLabel}) belum tersedia.`,
      });
      return;
    }

    if (res.importedCount === 0) {
      setFeedback({
        tone: 'info',
        text:
          mode === 'empty_only'
            ? 'Semua item yang memiliki closing bulan lalu sudah terisi.'
            : 'Tidak ada item yang diperbarui dari closing bulan lalu.',
      });
      return;
    }

    setFeedback({
      tone: res.savedToDb ? 'ok' : 'err',
      text: res.savedToDb
        ? `${res.importedCount} item diambil dari closing terakhir ${prevMonthLabel} dan berhasil disimpan.`
        : `${res.importedCount} item diambil ke cache lokal, namun gagal sinkron ke server. Klik Simpan untuk mengirim ulang.`,
    });
  };

  const handleClickImportPrev = () => {
    if (isViewer || isImporting) return;
    if (!summary.hasPrevMonthData) {
      setFeedback({
        tone: 'info',
        text: `Data closing bulan lalu (${prevMonthLabel}) belum ada.`,
      });
      return;
    }
    if (summary.filledCount > 0) {
      setShowImportModal(true);
      return;
    }
    void executeImportPrevMonth('all');
  };

  const filterTabs: Array<{ id: StokAwalFilter; label: string; count: number }> = [
    { id: 'all', label: 'Semua', count: summary.activeItems.length },
    { id: 'empty', label: 'Belum diisi', count: summary.emptyCount },
    { id: 'filled', label: 'Terisi', count: summary.filledCount },
    { id: 'diff_prev', label: 'Beda bln lalu', count: summary.differsFromPrevCount },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f4f6f7] p-3 sm:p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#dde2e6] bg-white">
        {/* TOP HEADER TOOLBAR */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-[15px] font-bold text-[#1f2a36] whitespace-nowrap">Stok Awal</h1>
              <p className="text-[11.5px] text-[#64748b]">
                Saldo fisik awal periode (tanggal 1)
              </p>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                aria-label="Bulan sebelumnya"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#dde2e6] bg-white text-[#1f2a36] hover:bg-[#f8fafc] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[136px] text-center text-[13.5px] font-bold text-[#1f2a36] whitespace-nowrap">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                aria-label="Bulan berikutnya"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#dde2e6] bg-white text-[#1f2a36] hover:bg-[#f8fafc] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* PROGRESS INDICATOR */}
            <div className="flex items-center gap-2.5 pr-1">
              <div className="text-right">
                <div className="font-mono-num text-xs font-semibold text-[#1f2a36] whitespace-nowrap">
                  {summary.isComplete
                    ? 'Lengkap'
                    : `${summary.filledCount} dari ${summary.activeItems.length} terisi`}
                </div>
                <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-[#e2e8f0]">
                  <div
                    className={`h-full transition-all duration-200 ${
                      summary.isComplete ? 'bg-[#16a34a]' : 'bg-[#1a9e94]'
                    }`}
                    style={{ width: `${summary.progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {!isViewer && (
              <>
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleClickImportPrev}
                  title={`Ambil nilai dari closing terakhir ${prevMonthLabel} (${summary.prevAvailableCount} item tersedia)`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dde2e6] bg-white px-3 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc] hover:text-[#1f2a36] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5 text-[#147d75]" />
                  <span>
                    {isImporting ? 'Mengambil…' : 'Ambil dari closing bulan lalu'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSave()}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                    hasUnsavedAwal
                      ? 'bg-[#d97706] hover:bg-[#b45309]'
                      : 'bg-[#1a9e94] hover:bg-[#14857c]'
                  }`}
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSaving ? 'Menyimpan…' : 'Simpan'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* SEARCH, FILTER & WORKFLOW LINKS BAR */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari item, kategori, satuan…"
                aria-label="Cari item stok awal"
                className="h-8 w-56 rounded-lg border border-[#dde2e6] bg-white pr-7 pl-8 text-xs text-[#1f2a36] placeholder:text-[#94a3b8] focus:border-[#1a9e94] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Bersihkan pencarian"
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div
              className="flex items-center gap-0.5 rounded-lg border border-[#e2e8f0] bg-white p-0.5"
              role="tablist"
              aria-label="Filter status stok awal"
            >
              {filterTabs.map((tab) => {
                const active = filterMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilterMode(tab.id)}
                    className={`h-7 rounded-md px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#e6f5f3] text-[#147d75]'
                        : 'text-[#64748b] hover:text-[#1f2a36]'
                    }`}
                  >
                    {tab.label}{' '}
                    <span className="font-mono-num opacity-75">({tab.count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => navigateTo('in', { ym, day: 1, inputTab: 'closing' })}
              className="inline-flex items-center gap-1 font-semibold text-[#147d75] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Input Harian Tgl 1</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <span aria-hidden="true" className="text-[#cbd5e1]">
              ·
            </span>
            <button
              type="button"
              onClick={() => navigateTo('tb', { ym })}
              className="inline-flex items-center gap-1 font-semibold text-[#475569] hover:text-[#1f2a36] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Table2 className="h-3.5 w-3.5" />
              <span>Tabel Bulanan</span>
            </button>
          </div>
        </div>

        {/* FEEDBACK BANNER */}
        {feedback && (
          <div className="no-print border-b border-[#e2e8f0] px-4 py-2.5 sm:px-5">
            <div
              className={`flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium ${
                feedback.tone === 'err'
                  ? 'border-[#fecdd3] bg-[#fff1f2] text-[#9f1239]'
                  : feedback.tone === 'info'
                    ? 'border-[#bae6fd] bg-[#f0f9ff] text-[#075985]'
                    : 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.tone === 'err' ? (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                ) : (
                  <Check className="h-4 w-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                aria-label="Tutup pesan"
                className="opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* SCROLLABLE CATEGORY & ITEM TILE GRID */}
        <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          {summary.activeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] py-16 text-center">
              <Package className="mb-3 h-9 w-9 text-[#94a3b8]" />
              <p className="text-sm font-semibold text-[#334155]">
                Belum ada item aktif di Master Item.
              </p>
              <p className="mt-1 text-xs text-[#64748b]">
                Tambahkan atau aktifkan item terlebih dahulu agar dapat mencatat stok awal.
              </p>
              <button
                type="button"
                onClick={() => navigateTo('ms')}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-4 text-xs font-semibold text-white hover:bg-[#14857c] cursor-pointer"
              >
                <span>Buka Master Item</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] py-14 text-center">
              <p className="text-sm font-semibold text-[#334155]">
                Tidak ada item yang cocok dengan filter saat ini.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterMode('all');
                }}
                className="mt-3 h-8 rounded-lg border border-[#dde2e6] bg-white px-3.5 text-xs font-semibold text-[#475569] hover:bg-[#f8fafc] cursor-pointer"
              >
                Reset filter
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredGroups.map(([cat, items]) => {
                const catFilled = items.filter((i) => summary.rowsByItemId[i.id]?.isFilled).length;
                return (
                  <section key={cat}>
                    <div className="mb-2.5 flex items-baseline justify-between border-b border-[#e2e8f0] pb-1.5">
                      <h2 className="text-xs font-bold tracking-wide text-[#334155]">{cat}</h2>
                      <span className="font-mono-num text-xs font-medium text-[#64748b]">
                        {catFilled}/{items.length} terisi
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items.map((item) => {
                        const row = summary.rowsByItemId[item.id];
                        if (!row) return null;

                        const cellKey = getCellKey(item.id);
                        const draftStr = editingDrafts[cellKey];
                        const displayValue =
                          draftStr !== undefined
                            ? draftStr
                            : row.isFilled && row.awal !== undefined
                              ? String(row.awal)
                              : '';
                        const hasInvalid = invalidHint?.itemId === item.id;

                        return (
                          <div
                            key={item.id}
                            className={`flex flex-col justify-between rounded-xl border p-3 transition-colors ${
                              hasInvalid
                                ? 'border-[#fca5a5] bg-[#fff1f2]/60'
                                : row.isFilled
                                  ? 'border-[#b7e4df] bg-[#f4fbfa]'
                                  : 'border-[#e2e8f0] bg-white hover:border-[#cbd5e1]'
                            }`}
                          >
                            {/* ITEM TITLE + STATUS TEXT */}
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <span
                                className="truncate text-[13px] font-semibold text-[#1f2a36]"
                                title={item.nama}
                              >
                                {item.nama}
                              </span>
                              <span
                                className={`shrink-0 text-[11px] font-semibold whitespace-nowrap ${
                                  row.isFilled ? 'text-[#147d75]' : 'text-[#94a3b8]'
                                }`}
                              >
                                {row.isFilled ? 'Terisi' : 'Kosong'}
                              </span>
                            </div>

                            {/* NUMERIC INPUT + UNIT */}
                            <div className="flex items-center gap-2">
                              <input
                                ref={(el) => {
                                  inputRefs.current[item.id] = el;
                                }}
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                disabled={isViewer}
                                placeholder="Belum diisi"
                                value={displayValue}
                                aria-label={`Stok awal ${item.nama}`}
                                onChange={(e) => handleInputChange(item.id, e.target.value)}
                                onBlur={() => handleInputBlur(item.id)}
                                onFocus={(e) => e.currentTarget.select()}
                                onKeyDown={(e) => handleKeyDown(e, item.id)}
                                className={`font-mono-num h-9 min-w-0 flex-1 rounded-lg border px-2.5 text-sm font-semibold text-[#1f2a36] placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder:text-[#94a3b8] focus:outline-none disabled:bg-[#f8fafc] disabled:text-[#64748b] ${
                                  hasInvalid
                                    ? 'border-[#dc2626] bg-white focus:border-[#dc2626]'
                                    : 'border-[#cbd5e1] bg-white focus:border-[#1a9e94]'
                                }`}
                              />
                              <span className="shrink-0 text-xs font-medium text-[#64748b]">
                                {item.sat || 'pcs'}
                              </span>
                            </div>

                            {/* VALIDATION HINT OR PREV MONTH FOOTER */}
                            {hasInvalid ? (
                              <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[#dc2626]">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span>{invalidHint.text}</span>
                              </div>
                            ) : (
                              <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px]">
                                <span className="text-[#64748b]">
                                  Bulan lalu:{' '}
                                  <strong className="font-mono-num text-[#334155]">
                                    {hasVal(row.prevClosing) ? formatNum(row.prevClosing) : '–'}
                                  </strong>
                                </span>
                                {!isViewer && row.canCopyPrev && (
                                  <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => handleCopyPrevSingle(row)}
                                    title={`Isi sama dengan closing terakhir ${prevMonthLabel} (${formatNum(row.prevClosing)})`}
                                    className="rounded-md border border-[#b7e4df] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#147d75] hover:bg-[#e6f5f3] whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    Sama
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTTOM STATUS & KEYBOARD HINT BAR */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 text-xs sm:px-5">
          <div className="text-[#64748b]">
            Isi stok fisik saat toko buka tanggal 1. Tekan{' '}
            <strong className="text-[#334155]">Enter</strong> untuk item berikutnya,{' '}
            <strong className="text-[#334155]">Shift+Enter</strong> untuk kembali,{' '}
            <strong className="text-[#334155]">Ctrl+S</strong> untuk simpan.
          </div>
          <div className="font-medium whitespace-nowrap">
            {hasUnsavedAwal ? (
              <span className="font-semibold text-[#b45309]">
                Ada perubahan stok awal belum disimpan
              </span>
            ) : (
              <span className="text-[#15803d]">{sync.text}</span>
            )}
          </div>
        </div>
      </div>

      {/* MODAL KONFIRMASI IMPORT CLOSING BULAN LALU (JIKA SUDAH ADA DATA TERISI) */}
      {showImportModal && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowImportModal(false);
          }}
        >
          <div className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-[#dde2e6] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e6f5f3] text-[#147d75]">
                  <Download className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1f2a36]">
                    Ambil dari Closing {prevMonthLabel}
                  </h3>
                  <p className="text-xs text-[#64748b]">
                    {summary.prevAvailableCount} item memiliki data closing bulan lalu
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4 text-sm text-[#334155]">
              <p className="leading-relaxed">
                Bulan <strong>{monthLabel}</strong> sudah memiliki{' '}
                <strong>{summary.filledCount} item</strong> stok awal terisi. Pilih cara pengisian
                dari closing terakhir <strong>{prevMonthLabel}</strong>:
              </p>
              <p className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs text-[#64748b]">
                Histori bulan lalu tidak akan diubah, dan item yang belum memiliki closing di bulan
                lalu akan tetap dibiarkan kosong (tidak otomatis diisi 0).
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-5 py-3.5">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="h-9 rounded-lg border border-[#dde2e6] bg-white px-3.5 text-xs font-semibold text-[#475569] hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              {summary.emptyCount > 0 && (
                <button
                  type="button"
                  onClick={() => void executeImportPrevMonth('empty_only')}
                  className="h-9 rounded-lg border border-[#1a9e94] bg-white px-3.5 text-xs font-semibold text-[#147d75] hover:bg-[#f0fdfa] cursor-pointer"
                >
                  Hanya isi item kosong
                </button>
              )}
              <button
                type="button"
                onClick={() => void executeImportPrevMonth('all')}
                className="h-9 rounded-lg bg-[#1a9e94] px-4 text-xs font-semibold text-white hover:bg-[#14857c] cursor-pointer"
              >
                Timpa semua ({summary.prevAvailableCount} item)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
