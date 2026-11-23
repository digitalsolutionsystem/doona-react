import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDateKey, formatNum, getFullDateLabel, hasVal } from '../domain/dateUtils';
import {
  getDayInputSummary,
  parseStockInput,
  type DayItemMovementRow,
} from '../domain/stockCalculations';
import type { InputHarianTab } from '../types/app';

type TileFilter = 'all' | 'unfilled' | 'filled' | 'issue';

interface WarningItem {
  id: string;
  severity: 'danger' | 'warn';
  title: string;
  detail: string;
  actions: Array<{ label: string; onClick: () => void }>;
}

export const InputHarianPage: React.FC = () => {
  const {
    state,
    ym,
    day,
    curYm,
    nowDay,
    inputTab,
    setInputTab,
    isViewer,
    hasUnsavedIn,
    sync,
    moveDay,
    selectDateStr,
    goToday,
    setStockCell,
    saveInputHarianNow,
    navigateTo,
  } = useApp();

  const [tileFilter, setTileFilter] = useState<TileFilter>('all');
  const [editingDrafts, setEditingDrafts] = useState<Record<string, string>>({});
  const [negativeAttemptId, setNegativeAttemptId] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const saveBtnRef = useRef<HTMLButtonElement | null>(null);
  const pendingFocusItemIdRef = useRef<string | null>(null);
  const warningsPopoverRef = useRef<HTMLDivElement | null>(null);

  const summary = useMemo(() => getDayInputSummary(state, ym, day), [state, ym, day]);

  const activeField: 'c' | 'd' = inputTab === 'datang' ? 'd' : 'c';
  const totalItems = summary.activeItems.length;
  const filledCount =
    inputTab === 'datang' ? summary.filledDatangCount : summary.filledClosingCount;
  const unfilledCount = Math.max(0, totalItems - filledCount);
  const isSelectedToday = ym === curYm && day === nowDay;

  useEffect(() => {
    setEditingDrafts({});
    setNegativeAttemptId(null);
  }, [ym, day, inputTab]);

  useEffect(() => {
    if (!saveFeedback) return;
    const t = window.setTimeout(() => setSaveFeedback(null), 3500);
    return () => window.clearTimeout(t);
  }, [saveFeedback]);

  useEffect(() => {
    if (!negativeAttemptId) return;
    const t = window.setTimeout(() => setNegativeAttemptId(null), 3000);
    return () => window.clearTimeout(t);
  }, [negativeAttemptId]);

  useEffect(() => {
    if (!showWarnings) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        warningsPopoverRef.current &&
        !warningsPopoverRef.current.contains(e.target as Node)
      ) {
        setShowWarnings(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowWarnings(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showWarnings]);

  const issueCount = useMemo(() => {
    return summary.activeItems.filter((item) => {
      const row = summary.rowsByItemId[item.id];
      return Boolean(
        row?.isNegativeUsage ||
          row?.isZeroClosing ||
          row?.isLowClosing ||
          (inputTab === 'closing' && row?.totalSiapJual === null)
      );
    }).length;
  }, [summary.activeItems, summary.rowsByItemId, inputTab]);

  useEffect(() => {
    if (issueCount === 0 && tileFilter === 'issue') {
      setTileFilter('all');
    }
  }, [issueCount, tileFilter]);

  const filteredGroups = useMemo(() => {
    return summary.groupedItems
      .map(([cat, items]) => {
        const filtered = items.filter((item) => {
          const row = summary.rowsByItemId[item.id];
          const val = activeField === 'c' ? row?.closing : row?.datang;
          const isFilled = hasVal(val);
          if (tileFilter === 'filled' && !isFilled) return false;
          if (tileFilter === 'unfilled' && isFilled) return false;
          if (tileFilter === 'issue') {
            const hasIssue = Boolean(
              row?.isNegativeUsage ||
                row?.isZeroClosing ||
                row?.isLowClosing ||
                (inputTab === 'closing' && row?.totalSiapJual === null)
            );
            if (!hasIssue) return false;
          }
          return true;
        });
        return [cat, filtered] as [string, typeof items];
      })
      .filter(([, list]) => list.length > 0);
  }, [summary.groupedItems, summary.rowsByItemId, tileFilter, activeField, inputTab]);

  const orderedVisibleIds = useMemo(
    () => filteredGroups.flatMap(([, list]) => list.map((i) => i.id)),
    [filteredGroups]
  );

  useEffect(() => {
    if (inputTab === 'pemakaian' || isViewer) return;

    if (pendingFocusItemIdRef.current) {
      const targetId = pendingFocusItemIdRef.current;
      pendingFocusItemIdRef.current = null;
      const el = inputRefs.current[targetId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.select();
      }
      return;
    }

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer:fine)').matches &&
      tileFilter === 'all' &&
      orderedVisibleIds.length > 0
    ) {
      const firstEmptyId =
        orderedVisibleIds.find((id) => {
          const row = summary.rowsByItemId[id];
          const val = activeField === 'c' ? row?.closing : row?.datang;
          return !hasVal(val);
        }) || orderedVisibleIds[0];

      const el = inputRefs.current[firstEmptyId];
      if (el) {
        el.focus();
        el.select();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym, day, inputTab]);

  const handleSave = useCallback(async () => {
    if (isViewer) return;
    const ok = await saveInputHarianNow();
    if (ok) {
      setSaveFeedback({
        type: 'ok',
        text: 'Data input harian berhasil disimpan.',
      });
    } else {
      setSaveFeedback({
        type: 'err',
        text: 'Gagal sinkron ke server. Perubahan tetap aman tersimpan di cache lokal.',
      });
    }
  }, [isViewer, saveInputHarianNow]);

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

  const getCellKey = (itemId: string) => `${ym}|${activeField}|${day}|${itemId}`;

  const handleInputChange = (itemId: string, raw: string) => {
    if (isViewer) return;
    const key = getCellKey(itemId);

    const sanitized = raw.replace(/[^0-9.,-]/g, '');
    setEditingDrafts((prev) => ({ ...prev, [key]: sanitized }));

    const parsed = parseStockInput(sanitized);
    if (parsed.negative || sanitized.includes('-')) {
      setNegativeAttemptId(itemId);
      return;
    }

    if (negativeAttemptId === itemId) {
      setNegativeAttemptId(null);
    }

    if (parsed.empty) {
      setStockCell(ym, activeField, day, itemId, '');
    } else if (parsed.valid && parsed.value !== undefined) {
      setStockCell(ym, activeField, day, itemId, parsed.value);
    }
  };

  const handleInputBlur = (itemId: string) => {
    const key = getCellKey(itemId);
    const raw = editingDrafts[key];

    if (raw !== undefined) {
      const parsed = parseStockInput(raw);
      if (parsed.negative) {
        setNegativeAttemptId(itemId);
      } else if (parsed.empty) {
        setStockCell(ym, activeField, day, itemId, '');
      } else if (parsed.valid && parsed.value !== undefined) {
        setStockCell(ym, activeField, day, itemId, parsed.value);
      }
      setEditingDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleSameAsStock = (row: DayItemMovementRow) => {
    if (isViewer || row.totalSiapJual === null) return;
    const rounded = Math.round(row.totalSiapJual * 1000) / 1000;
    const key = `${ym}|c|${day}|${row.item.id}`;
    setEditingDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setNegativeAttemptId(null);
    setStockCell(ym, 'c', day, row.item.id, rounded);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, itemId: string) => {
    const k = e.key;
    if (k !== 'Enter' && k !== 'ArrowDown' && k !== 'ArrowUp') return;
    e.preventDefault();
    const idx = orderedVisibleIds.indexOf(itemId);
    if (idx === -1) return;
    const back = k === 'ArrowUp' || (k === 'Enter' && e.shiftKey);
    const nextId = orderedVisibleIds[idx + (back ? -1 : 1)];
    if (nextId && inputRefs.current[nextId]) {
      inputRefs.current[nextId]?.focus();
      inputRefs.current[nextId]?.select();
    } else if (!back) {
      e.currentTarget.blur();
      saveBtnRef.current?.focus();
    }
  };

  const jumpToItemInput = useCallback(
    (itemId: string, targetTab: 'closing' | 'datang') => {
      setShowWarnings(false);
      setTileFilter('all');
      pendingFocusItemIdRef.current = itemId;
      if (inputTab !== targetTab) {
        setInputTab(targetTab);
      } else {
        const el = inputRefs.current[itemId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
          el.select();
          pendingFocusItemIdRef.current = null;
        }
      }
    },
    [inputTab, setInputTab]
  );

  const warnings = useMemo<WarningItem[]>(() => {
    const list: WarningItem[] = [];

    if (summary.negativeUsageRows.length > 0) {
      list.push({
        id: 'neg-usage',
        severity: 'danger',
        title: `${summary.negativeUsageRows.length} pemakaian bernilai negatif`,
        detail: summary.negativeUsageRows
          .slice(0, 4)
          .map((r) => `${r.item.nama} (${formatNum(r.pemakaian)})`)
          .join(', '),
        actions: [
          {
            label: 'Periksa Closing',
            onClick: () => jumpToItemInput(summary.negativeUsageRows[0].item.id, 'closing'),
          },
          {
            label: 'Cek Datang',
            onClick: () => jumpToItemInput(summary.negativeUsageRows[0].item.id, 'datang'),
          },
        ],
      });
    }

    if (inputTab === 'closing' && summary.missingPrevClosing) {
      list.push({
        id: 'missing-prev',
        severity: 'warn',
        title: `Closing tanggal ${day - 1} belum diisi`,
        detail: `Stok siap jual dan pemakaian tanggal ${day} belum dapat dihitung.`,
        actions: [
          {
            label: `Isi Closing Tgl ${day - 1}`,
            onClick: () => {
              setShowWarnings(false);
              navigateTo('in', { day: day - 1, inputTab: 'closing' });
            },
          },
        ],
      });
    }

    if (summary.missingAwalDay1) {
      list.push({
        id: 'missing-awal',
        severity: 'warn',
        title: 'Stok awal bulan ini belum diisi',
        detail: 'Lengkapi Stok Awal tanggal 1 agar stok siap jual akurat.',
        actions: [
          {
            label: 'Buka Stok Awal',
            onClick: () => {
              setShowWarnings(false);
              navigateTo('aw');
            },
          },
        ],
      });
    }

    if (
      inputTab === 'closing' &&
      (summary.zeroClosingRows.length > 0 || summary.lowClosingRows.length > 0)
    ) {
      const parts: string[] = [];
      if (summary.zeroClosingRows.length > 0) parts.push(`${summary.zeroClosingRows.length} kosong`);
      if (summary.lowClosingRows.length > 0)
        parts.push(`${summary.lowClosingRows.length} menipis`);
      const target = summary.zeroClosingRows[0] || summary.lowClosingRows[0];
      list.push({
        id: 'critical-stock',
        severity: summary.zeroClosingRows.length > 0 ? 'danger' : 'warn',
        title: `Stok kritis tgl ${day}: ${parts.join(' · ')}`,
        detail: [...summary.zeroClosingRows, ...summary.lowClosingRows]
          .slice(0, 4)
          .map((r) => `${r.item.nama}: ${formatNum(r.closing)}`)
          .join(', '),
        actions: target
          ? [
              {
                label: 'Input Barang Datang',
                onClick: () => jumpToItemInput(target.item.id, 'datang'),
              },
            ]
          : [],
      });
    }

    return list;
  }, [summary, inputTab, day, jumpToItemInput, navigateTo]);

  const hasDangerWarning = warnings.some((w) => w.severity === 'danger');

  return (
    <div className="dg-page">
      {/* STICKY FLOATING WHITE TOP BAR */}
      <div className="dg-sticky-header no-print px-4 pt-3 pb-1 md:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-[0_6px_22px_rgba(13,37,48,0.045)] md:px-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center rounded-xl bg-[#f3f7f5] p-0.5">
            <button
              type="button"
              onClick={() => moveDay(-1)}
              aria-label="Hari sebelumnya"
              title="Hari sebelumnya"
              className="flex h-7.5 w-7.5 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={formatDateKey(ym, day)}
              onChange={(e) => selectDateStr(e.target.value)}
              aria-label="Pilih tanggal input harian"
              className="font-mono-num h-7.5 bg-transparent px-2 text-[12.5px] font-bold text-[#13222b] outline-none"
            />
            <button
              type="button"
              onClick={() => moveDay(1)}
              aria-label="Hari berikutnya"
              title="Hari berikutnya"
              className="flex h-7.5 w-7.5 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {!isSelectedToday && (
            <button
              type="button"
              onClick={goToday}
              className="h-9 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] whitespace-nowrap shrink-0 transition hover:bg-[#e4ece8] cursor-pointer"
            >
              Hari ini
            </button>
          )}

          {inputTab !== 'pemakaian' ? (
            <span className="font-mono-num hidden rounded-lg bg-[#e6f7ee] px-2.5 py-1 text-xs font-bold text-[#15803d] sm:inline whitespace-nowrap">
              {filledCount}/{totalItems} terisi
            </span>
          ) : (
            <span className="hidden text-xs font-semibold text-[#64748b] sm:inline whitespace-nowrap">
              {getFullDateLabel(ym, day)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={inputTab}
            onChange={(e) => setInputTab(e.target.value as InputHarianTab)}
            aria-label="Pilih mode input harian"
            className="h-9 rounded-xl bg-[#f3f7f5] px-3 text-xs font-bold text-[#13222b] outline-none focus:ring-2 focus:ring-[#2eb86b] cursor-pointer"
          >
            <option value="closing">Closing</option>
            <option value="datang">Barang Datang</option>
            <option value="pemakaian">Pemakaian</option>
          </select>

          {inputTab !== 'pemakaian' && (
            <select
              value={tileFilter}
              onChange={(e) => setTileFilter(e.target.value as TileFilter)}
              aria-label="Filter item input harian"
              className="h-9 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] outline-none focus:ring-2 focus:ring-[#2eb86b] cursor-pointer"
            >
              <option value="all">Semua ({totalItems})</option>
              <option value="unfilled">Belum diisi ({unfilledCount})</option>
              <option value="filled">Terisi ({filledCount})</option>
              {issueCount > 0 && <option value="issue">Perlu cek ({issueCount})</option>}
            </select>
          )}

          {warnings.length > 0 && (
            <div ref={warningsPopoverRef} className="relative">
              <button
                type="button"
                onClick={() => setShowWarnings((prev) => !prev)}
                aria-expanded={showWarnings}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition cursor-pointer ${
                  hasDangerWarning
                    ? 'bg-[#ef4444] hover:bg-[#dc2626]'
                    : 'bg-[#f59e0b] hover:bg-[#d97706]'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Peringatan ({warnings.length})</span>
              </button>

              {showWarnings && (
                <div className="absolute right-0 z-40 mt-2 w-[340px] max-w-[90vw] overflow-hidden rounded-2xl bg-white shadow-[0_18px_42px_rgba(13,37,48,0.16)]">
                  <div className="flex items-center justify-between border-b border-[#e2ebe7] bg-[#f7faf9] px-4 py-3">
                    <span className="text-xs font-bold text-[#13222b]">
                      Peringatan · {getFullDateLabel(ym, day)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowWarnings(false)}
                      aria-label="Tutup peringatan"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#e8f0ed] hover:text-[#13222b] cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="divide-y divide-[#edf2f0]">
                    {warnings.map((w) => (
                      <div key={w.id} className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          {w.id === 'missing-awal' ? (
                            <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f59e0b]" />
                          ) : (
                            <AlertTriangle
                              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                w.severity === 'danger' ? 'text-[#ef4444]' : 'text-[#f59e0b]'
                              }`}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#13222b]">{w.title}</p>
                            <p className="mt-0.5 text-[11.5px] text-[#64748b]">{w.detail}</p>
                            {w.actions.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {w.actions.map((act) => (
                                  <button
                                    key={act.label}
                                    type="button"
                                    onClick={act.onClick}
                                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#f3f7f5] px-2.5 text-[11px] font-semibold text-[#13222b] hover:bg-[#e4ece8] cursor-pointer"
                                  >
                                    <span>{act.label}</span>
                                    <ArrowRight className="h-3 w-3 text-[#2eb86b]" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {isViewer ? (
            <div className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#475569] whitespace-nowrap">
              <Lock className="h-3.5 w-3.5 text-[#64748b]" />
              <span>Hanya Baca</span>
            </div>
          ) : (
            <button
              ref={saveBtnRef}
              type="button"
              onClick={handleSave}
              disabled={sync.isSyncing}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-white whitespace-nowrap transition disabled:opacity-60 cursor-pointer ${
                hasUnsavedIn
                  ? 'bg-[#f59e0b] hover:bg-[#d97706]'
                  : 'bg-[#2eb86b] hover:bg-[#259f5b]'
              }`}
            >
              {sync.isSyncing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>{sync.isSyncing ? 'Menyimpan…' : 'Simpan'}</span>
            </button>
          )}
        </div>
        </header>
      </div>

      {/* FEEDBACK BANNER */}
      {saveFeedback && (
        <div
          className={`mx-4 mt-3 shrink-0 flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-sm md:mx-6 ${
            saveFeedback.type === 'ok' ? 'bg-[#2eb86b]' : 'bg-[#ef4444]'
          }`}
        >
          <div className="flex items-center gap-2">
            {saveFeedback.type === 'ok' ? (
              <Check className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{saveFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveFeedback(null)}
            className="cursor-pointer"
            aria-label="Tutup pesan"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* MAIN BODY — FULL KIRI KANAN */}
      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {totalItems === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 text-center shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
            <p className="font-display text-sm font-bold text-[#13222b]">
              Belum ada item aktif di Master Item.
            </p>
            <p className="mt-1 text-xs text-[#64748b]">
              Tambahkan atau aktifkan barang di Master Item agar muncul di form Input Harian.
            </p>
            <button
              type="button"
              onClick={() => navigateTo('ms')}
              className="mt-4 h-9 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white hover:bg-[#259f5b] cursor-pointer"
            >
              Buka Master Item
            </button>
          </div>
        ) : inputTab === 'pemakaian' ? (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#edf2f0] bg-[#f7faf9] text-[11.5px] font-bold text-[#64748b] uppercase">
                  <th className="px-5 py-3">Item</th>
                  <th className="px-3 py-3">Satuan</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">
                    {day === 1 ? 'Stok Awal' : `Closing Tgl ${day - 1}`}
                  </th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Barang Datang</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Stok Siap</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Closing</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">Pemakaian</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map(([cat, items]) => (
                  <React.Fragment key={cat}>
                    <tr className="border-b border-[#edf2f0] bg-[#f3f7f5]">
                      <td
                        colSpan={8}
                        className="px-5 py-1.5 text-[11.5px] font-bold text-[#475569]"
                      >
                        {cat}
                      </td>
                    </tr>
                    {items.map((item) => {
                      const row = summary.rowsByItemId[item.id];
                      if (!row) return null;
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-[#edf2f0] transition hover:bg-[#f7faf9] ${
                            row.isNegativeUsage ? 'bg-[#fff5f5]' : ''
                          }`}
                        >
                          <td className="px-5 py-3 font-semibold text-[#13222b]">{item.nama}</td>
                          <td className="px-3 py-3 text-xs text-[#64748b]">
                            {item.sat || 'pcs'}
                          </td>
                          <td className="font-mono-num px-3 py-3 text-right text-[#475569]">
                            {hasVal(row.prevBase) ? formatNum(row.prevBase) : '–'}
                          </td>
                          <td className="font-mono-num px-3 py-3 text-right text-[#13222b]">
                            {hasVal(row.datang) ? formatNum(row.datang) : '–'}
                          </td>
                          <td className="font-mono-num px-3 py-3 text-right font-bold text-[#13222b]">
                            {row.totalSiapJual !== null ? formatNum(row.totalSiapJual) : '–'}
                          </td>
                          <td className="font-mono-num px-3 py-3 text-right font-bold">
                            {hasVal(row.closing) ? (
                              <span
                                className={
                                  row.isZeroClosing
                                    ? 'rounded-md bg-[#fee2e2] px-2 py-0.5 text-[#b91c1c]'
                                    : row.isLowClosing
                                      ? 'rounded-md bg-[#fef3c7] px-2 py-0.5 text-[#b45309]'
                                      : 'text-[#13222b]'
                                }
                              >
                                {formatNum(row.closing)}
                                {row.isZeroClosing
                                  ? ' · Kosong'
                                  : row.isLowClosing
                                    ? ' · Menipis'
                                    : ''}
                              </span>
                            ) : (
                              <span className="font-medium text-[#94a3b8]">Belum</span>
                            )}
                          </td>
                          <td className="font-mono-num px-3 py-3 text-right font-bold">
                            {row.pemakaian !== null ? (
                              <span
                                className={
                                  row.isNegativeUsage ? 'text-[#ef4444]' : 'text-[#2eb86b]'
                                }
                              >
                                {formatNum(row.pemakaian)}
                                {row.isNegativeUsage ? ' · Melebihi' : ''}
                              </span>
                            ) : (
                              <span className="font-medium text-[#94a3b8]">–</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => jumpToItemInput(item.id, 'closing')}
                              className="mr-1.5 text-xs font-bold text-[#2eb86b] hover:underline cursor-pointer"
                            >
                              Closing
                            </button>
                            <span aria-hidden="true" className="text-[#cbd5d1]">
                              ·
                            </span>
                            <button
                              type="button"
                              onClick={() => jumpToItemInput(item.id, 'datang')}
                              className="ml-1.5 text-xs font-semibold text-[#475569] hover:text-[#13222b] hover:underline cursor-pointer"
                            >
                              Datang
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#e2ebe7] bg-[#f7faf9] font-bold text-[#13222b]">
                  <td colSpan={3} className="px-5 py-3 text-xs">
                    Total Hari Ini ({summary.rows.length} item)
                  </td>
                  <td className="font-mono-num px-3 py-3 text-right">
                    {formatNum(summary.totalDatangDay)}
                  </td>
                  <td className="px-3 py-3 text-right text-[#94a3b8]">–</td>
                  <td className="font-mono-num px-3 py-3 text-right">
                    {summary.filledClosingCount > 0 ? formatNum(summary.totalClosingDay) : '–'}
                  </td>
                  <td className="font-mono-num px-3 py-3 text-right text-[#2eb86b]">
                    {summary.hasAnyPemakaian ? formatNum(summary.totalPemakaianDay) : '–'}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-14 text-center shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
            <p className="text-sm font-semibold text-[#13222b]">Tidak ada item pada filter ini.</p>
            <button
              type="button"
              onClick={() => setTileFilter('all')}
              className="mt-3 h-8.5 rounded-xl bg-[#f3f7f5] px-4 text-xs font-semibold text-[#13222b] hover:bg-[#e4ece8] cursor-pointer"
            >
              Tampilkan Semua
            </button>
          </div>
        ) : (
          /* GRID FULL KIRI KANAN (SERAGAM DENGAN SAMPLE) */
          <div className="grid w-full grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredGroups.flatMap(([cat, items]) =>
              items.map((item) => {
                const row = summary.rowsByItemId[item.id];
                const storedVal = activeField === 'c' ? row?.closing : row?.datang;
                const isFilled = hasVal(storedVal);
                const isNeg = inputTab === 'closing' && Boolean(row?.isNegativeUsage);
                const isNegAttempt = negativeAttemptId === item.id;
                const cellKey = getCellKey(item.id);
                const displayVal =
                  editingDrafts[cellKey] !== undefined
                    ? editingDrafts[cellKey]
                    : isFilled
                      ? String(storedVal)
                      : '';

                const subMeta =
                  inputTab === 'closing'
                    ? row?.totalSiapJual !== null && row?.totalSiapJual !== undefined
                      ? `${cat} · Siap ${formatNum(row.totalSiapJual)}`
                      : cat
                    : hasVal(row?.prevBase)
                      ? `${cat} · ${day === 1 ? 'Awal' : 'Kemarin'} ${formatNum(row?.prevBase)}`
                      : cat;

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl px-4 py-3.5 shadow-[0_6px_22px_rgba(13,37,48,0.045)] transition ${
                      isNeg || isNegAttempt
                        ? 'bg-[#fff5f5] ring-2 ring-[#ef4444]'
                        : isFilled
                          ? 'bg-white ring-2 ring-[#2eb86b]'
                          : 'bg-white'
                    }`}
                  >
                    <div className="mb-2.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <label
                          htmlFor={`input-harian-${item.id}`}
                          className="block truncate text-[14px] font-bold text-[#13222b] cursor-pointer"
                          title={item.nama}
                        >
                          {item.nama}
                        </label>
                        <span className="font-mono-num block truncate text-[11px] font-medium text-[#64748b]">
                          {subMeta}
                        </span>
                      </div>

                      {inputTab === 'closing' ? (
                        isNeg ? (
                          <span className="shrink-0 rounded-md bg-[#fee2e2] px-2 py-0.5 text-[11px] font-bold text-[#b91c1c]">
                            Melebihi
                          </span>
                        ) : row?.isZeroClosing ? (
                          <span className="shrink-0 rounded-md bg-[#fee2e2] px-2 py-0.5 text-[11px] font-bold text-[#b91c1c]">
                            Kosong
                          </span>
                        ) : row?.isLowClosing ? (
                          <span className="font-mono-num shrink-0 rounded-md bg-[#fef3c7] px-2 py-0.5 text-[11px] font-bold text-[#b45309]">
                            Min {formatNum(item.min)}
                          </span>
                        ) : row?.pemakaian !== null && row?.pemakaian !== undefined ? (
                          <span className="font-mono-num shrink-0 rounded-md bg-[#e6f7ee] px-2 py-0.5 text-[11px] font-bold text-[#15803d]">
                            Pakai {formatNum(row.pemakaian)}
                          </span>
                        ) : row && row.totalSiapJual !== null && !isViewer ? (
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => handleSameAsStock(row)}
                            title="Isi sama dengan stok siap jual (tidak ada pemakaian)"
                            className="shrink-0 rounded-md bg-[#e6f7ee] px-2 py-0.5 text-[11px] font-bold text-[#15803d] transition hover:bg-[#d1f2e0] cursor-pointer"
                          >
                            Samakan
                          </button>
                        ) : null
                      ) : hasVal(row?.datang) &&
                        row?.totalSiapJual !== null &&
                        row?.totalSiapJual !== undefined ? (
                        <span className="font-mono-num shrink-0 rounded-md bg-[#e6f7ee] px-2 py-0.5 text-[11px] font-bold text-[#15803d]">
                          Siap {formatNum(row.totalSiapJual)}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id={`input-harian-${item.id}`}
                        ref={(el) => {
                          inputRefs.current[item.id] = el;
                        }}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={isViewer}
                        placeholder="0"
                        value={displayVal}
                        aria-label={`${item.nama}, ${
                          inputTab === 'closing' ? 'closing' : 'barang datang'
                        } tanggal ${day}`}
                        onChange={(e) => handleInputChange(item.id, e.target.value)}
                        onBlur={() => handleInputBlur(item.id)}
                        onFocus={(e) => e.currentTarget.select()}
                        onKeyDown={(e) => handleInputKeyDown(e, item.id)}
                        className={`font-mono-num h-9.5 min-w-0 flex-1 rounded-xl border px-3 text-right text-sm font-bold text-[#13222b] placeholder:text-[#94a3b8] focus:bg-white focus:outline-none disabled:bg-[#f3f7f5] disabled:text-[#64748b] ${
                          isNeg || isNegAttempt
                            ? 'border-[#ef4444] bg-white focus:border-[#ef4444]'
                            : isFilled
                              ? 'border-[#2eb86b] bg-white focus:border-[#2eb86b]'
                              : 'border-[#dce6e2] bg-[#f7faf9] focus:border-[#2eb86b]'
                        }`}
                      />
                      <span className="w-11 shrink-0 text-xs font-semibold text-[#64748b]">
                        {item.sat || 'pcs'}
                      </span>
                    </div>

                    {isNegAttempt && (
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#ef4444]">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>Tidak boleh negatif</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
