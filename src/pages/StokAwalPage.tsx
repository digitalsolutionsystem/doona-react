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
    moveMonth,
    setStockCell,
    saveStokAwalNow,
    importStokAwalFromPrevMonth,
    navigateTo,
  } = useApp();

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

  useEffect(() => {
    setEditingDrafts({});
    setInvalidHint(null);
  }, [ym]);

  useEffect(() => {
    if (!summary.hasPrevMonthData && filterMode === 'diff_prev') {
      setFilterMode('all');
    }
  }, [summary.hasPrevMonthData, filterMode]);

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
    return summary.groupedItems
      .map(([cat, items]) => {
        const list = items.filter((item) => {
          const row = summary.rowsByItemId[item.id];
          if (!row) return false;
          if (filterMode === 'filled' && !row.isFilled) return false;
          if (filterMode === 'empty' && row.isFilled) return false;
          if (filterMode === 'diff_prev' && !row.differsFromPrev) return false;
          return true;
        });
        return [cat, list] as [string, typeof items];
      })
      .filter(([, list]) => list.length > 0);
  }, [summary.groupedItems, summary.rowsByItemId, filterMode]);

  const orderedVisibleIds = useMemo(
    () => filteredGroups.flatMap(([, list]) => list.map((i) => i.id)),
    [filteredGroups]
  );

  useEffect(() => {
    if (isViewer || filterMode !== 'all' || orderedVisibleIds.length === 0) return;
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
        text: 'Stok awal tidak boleh negatif.',
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
        ? `${res.importedCount} item diambil dari closing ${prevMonthLabel} dan disimpan.`
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

  return (
    <div className="dg-page">
      {/* STICKY FLOATING WHITE TOP BAR */}
      <div className="dg-sticky-header no-print px-4 pt-3 pb-1 md:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-[0_6px_22px_rgba(13,37,48,0.045)] md:px-5">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-[17px] font-bold text-[#13222b] whitespace-nowrap">
            Stok Awal
          </h1>

          <div className="inline-flex items-center rounded-xl bg-[#f3f7f5] p-0.5">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="Bulan sebelumnya"
              className="flex h-7.5 w-7.5 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[120px] px-2 text-center text-[13px] font-bold text-[#13222b] whitespace-nowrap">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="Bulan berikutnya"
              className="flex h-7.5 w-7.5 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <span className="font-mono-num hidden rounded-lg bg-[#e6f7ee] px-2.5 py-1 text-xs font-bold text-[#15803d] sm:inline whitespace-nowrap">
            {summary.filledCount}/{summary.activeItems.length} terisi
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as StokAwalFilter)}
            aria-label="Filter status stok awal"
            className="h-9 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] outline-none focus:ring-2 focus:ring-[#2eb86b] cursor-pointer"
          >
            <option value="all">Semua ({summary.activeItems.length})</option>
            <option value="empty">Belum diisi ({summary.emptyCount})</option>
            <option value="filled">Terisi ({summary.filledCount})</option>
            {summary.hasPrevMonthData && (
              <option value="diff_prev">Beda bln lalu ({summary.differsFromPrevCount})</option>
            )}
          </select>

          {!isViewer && (
            <>
              <button
                type="button"
                disabled={isImporting}
                onClick={handleClickImportPrev}
                title={`Ambil nilai dari closing terakhir ${prevMonthLabel} (${summary.prevAvailableCount} item tersedia)`}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e4ece8] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-[#2eb86b]" />
                <span>{isImporting ? 'Mengambil…' : 'Ambil Bln Lalu'}</span>
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSave()}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-white transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                  hasUnsavedAwal
                    ? 'bg-[#f59e0b] hover:bg-[#d97706]'
                    : 'bg-[#2eb86b] hover:bg-[#259f5b]'
                }`}
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? 'Menyimpan…' : 'Simpan'}</span>
              </button>
            </>
          )}
        </div>
        </header>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`no-print mx-4 mt-3 flex items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm md:mx-6 ${
            feedback.tone === 'err'
              ? 'bg-[#ef4444] text-white'
              : feedback.tone === 'info'
                ? 'bg-white text-[#13222b]'
                : 'bg-[#2eb86b] text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.tone === 'err' ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Check className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Tutup pesan"
            className="cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* FORM INPUT GRID FULL KIRI KANAN */}
      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {summary.activeItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 text-center shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
            <Package className="mb-3 h-8 w-8 text-[#94a3b8]" />
            <p className="font-display text-sm font-bold text-[#13222b]">
              Belum ada item aktif di Master Item.
            </p>
            <p className="mt-1 text-xs text-[#64748b]">
              Tambahkan atau aktifkan item terlebih dahulu agar dapat mencatat stok awal.
            </p>
            <button
              type="button"
              onClick={() => navigateTo('ms')}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white hover:bg-[#259f5b] cursor-pointer"
            >
              <span>Buka Master Item</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-14 text-center shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
            <p className="text-sm font-semibold text-[#13222b]">
              Tidak ada item pada filter ini.
            </p>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className="mt-3 h-8.5 rounded-xl bg-[#f3f7f5] px-4 text-xs font-semibold text-[#13222b] hover:bg-[#e4ece8] cursor-pointer"
            >
              Tampilkan Semua
            </button>
          </div>
        ) : (
          <div className="grid w-full grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredGroups.flatMap(([cat, items]) =>
              items.map((item) => {
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
                    className={`rounded-2xl px-4 py-3.5 shadow-[0_6px_22px_rgba(13,37,48,0.045)] transition ${
                      hasInvalid
                        ? 'bg-[#fff5f5] ring-2 ring-[#ef4444]'
                        : row.isFilled
                          ? 'bg-white ring-2 ring-[#2eb86b]'
                          : 'bg-white'
                    }`}
                  >
                    <div className="mb-2.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <label
                          htmlFor={`stok-awal-${item.id}`}
                          className="block truncate text-[14px] font-bold text-[#13222b] cursor-pointer"
                          title={item.nama}
                        >
                          {item.nama}
                        </label>
                        <span className="block truncate text-[11px] font-medium text-[#64748b]">
                          {cat}
                        </span>
                      </div>

                      {hasVal(row.prevClosing) &&
                        (!isViewer && row.canCopyPrev ? (
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => handleCopyPrevSingle(row)}
                            title="Klik untuk samakan dengan bulan lalu"
                            className="font-mono-num shrink-0 rounded-md bg-[#e6f7ee] px-2 py-0.5 text-[11px] font-bold text-[#15803d] transition hover:bg-[#d1f2e0] cursor-pointer"
                          >
                            Bln lalu {formatNum(row.prevClosing)}
                          </button>
                        ) : (
                          <span className="font-mono-num shrink-0 text-[11px] font-medium text-[#64748b]">
                            Bln lalu {formatNum(row.prevClosing)}
                          </span>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id={`stok-awal-${item.id}`}
                        ref={(el) => {
                          inputRefs.current[item.id] = el;
                        }}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={isViewer}
                        placeholder="0"
                        value={displayValue}
                        onChange={(e) => handleInputChange(item.id, e.target.value)}
                        onBlur={() => handleInputBlur(item.id)}
                        onFocus={(e) => e.currentTarget.select()}
                        onKeyDown={(e) => handleKeyDown(e, item.id)}
                        className={`font-mono-num h-9.5 min-w-0 flex-1 rounded-xl border px-3 text-right text-sm font-bold text-[#13222b] placeholder:text-[#94a3b8] focus:bg-white focus:outline-none disabled:bg-[#f3f7f5] disabled:text-[#64748b] ${
                          hasInvalid
                            ? 'border-[#ef4444] bg-white focus:border-[#ef4444]'
                            : row.isFilled
                              ? 'border-[#2eb86b] bg-white focus:border-[#2eb86b]'
                              : 'border-[#dce6e2] bg-[#f7faf9] focus:border-[#2eb86b]'
                        }`}
                      />
                      <span className="w-11 shrink-0 text-xs font-semibold text-[#64748b]">
                        {item.sat || 'pcs'}
                      </span>
                    </div>

                    {hasInvalid && (
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#ef4444]">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>{invalidHint.text}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* MODAL KONFIRMASI IMPORT CLOSING BULAN LALU */}
      {showImportModal && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowImportModal(false);
          }}
        >
          <div className="w-full max-w-[440px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="flex items-start justify-between border-b border-[#edf2f0] px-5 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#13222b]">
                  Ambil dari Closing {prevMonthLabel}
                </h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  {summary.prevAvailableCount} item memiliki data closing bulan lalu
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-4 text-[13px] text-[#475569]">
              <p className="leading-relaxed">
                Bulan <strong className="text-[#13222b]">{monthLabel}</strong> sudah memiliki{' '}
                <strong className="text-[#13222b]">{summary.filledCount} item</strong> stok awal
                terisi. Pilih cara pengisian dari closing terakhir{' '}
                <strong className="text-[#13222b]">{prevMonthLabel}</strong>:
              </p>
              <p className="rounded-xl bg-[#f3f7f5] px-3.5 py-2.5 text-xs text-[#475569]">
                Histori bulan lalu tidak akan diubah, dan item yang belum memiliki closing di bulan
                lalu akan tetap dibiarkan kosong.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-5 py-3">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="h-9 rounded-xl bg-white px-3.5 text-xs font-semibold text-[#475569] shadow-xs hover:bg-[#eef3f1] cursor-pointer"
              >
                Batal
              </button>
              {summary.emptyCount > 0 && (
                <button
                  type="button"
                  onClick={() => void executeImportPrevMonth('empty_only')}
                  className="h-9 rounded-xl bg-[#e6f7ee] px-3.5 text-xs font-bold text-[#15803d] hover:bg-[#d1f2e0] cursor-pointer"
                >
                  Hanya isi item kosong
                </button>
              )}
              <button
                type="button"
                onClick={() => void executeImportPrevMonth('all')}
                className="h-9 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white hover:bg-[#259f5b] cursor-pointer"
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
