import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Lock,
  PackagePlus,
  RefreshCw,
  Search,
  Table2,
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

  const [searchQuery, setSearchQuery] = useState('');
  const [tileFilter, setTileFilter] = useState<TileFilter>('all');
  const [editingDrafts, setEditingDrafts] = useState<Record<string, string>>({});
  const [negativeAttemptId, setNegativeAttemptId] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const saveBtnRef = useRef<HTMLButtonElement | null>(null);
  const pendingFocusItemIdRef = useRef<string | null>(null);

  const summary = useMemo(() => getDayInputSummary(state, ym, day), [state, ym, day]);

  const activeField: 'c' | 'd' = inputTab === 'datang' ? 'd' : 'c';
  const totalItems = summary.activeItems.length;
  const filledCount =
    inputTab === 'datang' ? summary.filledDatangCount : summary.filledClosingCount;
  const isComplete = totalItems > 0 && filledCount === totalItems;
  const progressPct = totalItems > 0 ? Math.round((filledCount / totalItems) * 100) : 0;
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

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return summary.groupedItems
      .map(([cat, items]) => {
        const filtered = items.filter((item) => {
          const row = summary.rowsByItemId[item.id];
          if (q) {
            const matchesText =
              item.nama.toLowerCase().includes(q) ||
              item.kat.toLowerCase().includes(q) ||
              item.id.toLowerCase().includes(q) ||
              (item.sat || '').toLowerCase().includes(q);
            if (!matchesText) return false;
          }

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
  }, [summary.groupedItems, summary.rowsByItemId, searchQuery, tileFilter, activeField, inputTab]);

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
      !searchQuery &&
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

  const jumpToItemInput = (itemId: string, targetTab: 'closing' | 'datang') => {
    setSearchQuery('');
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
  };

  const tabOptions: Array<{ id: InputHarianTab; label: string; icon: React.ReactNode }> = [
    { id: 'closing', label: 'Closing', icon: <CheckSquare className="h-3.5 w-3.5" /> },
    { id: 'datang', label: 'Barang Datang', icon: <PackagePlus className="h-3.5 w-3.5" /> },
    { id: 'pemakaian', label: 'Pemakaian', icon: <ClipboardList className="h-3.5 w-3.5" /> },
  ];

  const issueCount =
    summary.negativeUsageRows.length +
    summary.zeroClosingRows.length +
    summary.lowClosingRows.length;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
      {/* TOP OPERATIONAL HEADER */}
      <div className="shrink-0 border-b border-[#e5e5df] bg-white px-5 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date navigation */}
          <div className="flex min-w-[260px] flex-1 flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center rounded-lg border border-[#e5e5df] bg-[#fafaf8] p-0.5">
              <button
                type="button"
                onClick={() => moveDay(-1)}
                aria-label="Hari sebelumnya"
                title="Hari sebelumnya"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#565e59] transition hover:bg-white hover:text-[#141816] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="date"
                value={formatDateKey(ym, day)}
                onChange={(e) => selectDateStr(e.target.value)}
                aria-label="Pilih tanggal input harian"
                className="font-mono-num h-7 bg-transparent px-2 text-[12.5px] font-medium text-[#141816] outline-none"
              />
              <button
                type="button"
                onClick={() => moveDay(1)}
                aria-label="Hari berikutnya"
                title="Hari berikutnya"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#565e59] transition hover:bg-white hover:text-[#141816] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={goToday}
              disabled={isSelectedToday}
              className={`h-8.5 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap shrink-0 transition ${
                isSelectedToday
                  ? 'border-[#efefea] bg-[#fafaf8] text-[#9aa39e] cursor-default'
                  : 'border-[#e5e5df] bg-white text-[#141816] hover:bg-[#f3f3ee] cursor-pointer'
              }`}
            >
              Hari ini
            </button>
            <span className="ml-1 text-[13px] font-medium text-[#141816] whitespace-nowrap">
              {getFullDateLabel(ym, day)}
            </span>
          </div>

          {/* Mode tabs */}
          <div
            role="tablist"
            aria-label="Mode input harian"
            className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[#e5e5df] bg-[#f7f7f4] p-0.5"
          >
            {tabOptions.map((t) => {
              const active = inputTab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setInputTab(t.id)}
                  className={`flex h-7.5 items-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap shrink-0 transition cursor-pointer ${
                    active
                      ? 'bg-[#14533c] text-white'
                      : 'text-[#565e59] hover:bg-white hover:text-[#141816]'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Progress */}
          {inputTab !== 'pemakaian' && (
            <div className="flex min-w-[104px] shrink-0 flex-col gap-1">
              <span className="font-mono-num text-[11px] font-medium text-[#565e59] whitespace-nowrap">
                {isComplete ? 'Lengkap' : `${filledCount}/${totalItems} terisi`}
              </span>
              <div className="h-[4px] w-full overflow-hidden rounded-full bg-[#efefea]">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    isComplete ? 'bg-[#15803d]' : 'bg-[#14533c]'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Save */}
          {isViewer ? (
            <div className="flex h-8.5 shrink-0 items-center gap-1.5 rounded-md border border-[#e5e5df] bg-[#fafaf8] px-3 text-xs font-medium text-[#565e59] whitespace-nowrap">
              <Lock className="h-3.5 w-3.5 text-[#7c8580]" />
              <span>Hanya Baca</span>
            </div>
          ) : (
            <button
              ref={saveBtnRef}
              type="button"
              onClick={handleSave}
              disabled={sync.isSyncing}
              className={`flex h-8.5 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-xs font-medium text-white whitespace-nowrap transition disabled:opacity-60 cursor-pointer ${
                hasUnsavedIn
                  ? 'bg-[#b45309] hover:bg-[#92400e]'
                  : 'bg-[#14533c] hover:bg-[#0f3f2d]'
              }`}
            >
              {sync.isSyncing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>{hasUnsavedIn ? 'Simpan Perubahan' : 'Simpan'}</span>
            </button>
          )}
        </div>
      </div>

      {/* SUMMARY METRICS & FILTER UTILITY BAR */}
      <div className="shrink-0 border-b border-[#e5e5df] bg-[#fafaf8] px-5 py-2 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#565e59]">
            <span>
              Barang Datang{' '}
              <strong className="font-mono-num font-semibold text-[#141816]">
                {formatNum(summary.totalDatangDay)}
              </strong>{' '}
              <span className="text-[#7c8580]">({summary.filledDatangCount} item)</span>
            </span>
            <span aria-hidden="true" className="text-[#d4d4cc]">
              ·
            </span>
            <span>
              Pemakaian{' '}
              <strong className="font-mono-num font-semibold text-[#14533c]">
                {summary.hasAnyPemakaian ? formatNum(summary.totalPemakaianDay) : '–'}
              </strong>
            </span>
            <span aria-hidden="true" className="text-[#d4d4cc]">
              ·
            </span>
            <span>
              Closing{' '}
              <strong className="font-mono-num font-semibold text-[#141816]">
                {summary.filledClosingCount}/{totalItems}
              </strong>
            </span>
            {hasUnsavedIn && !isViewer && (
              <>
                <span aria-hidden="true" className="text-[#d4d4cc]">
                  ·
                </span>
                <span className="font-medium text-[#b45309]">Belum disimpan</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#9aa39e]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari item atau kategori…"
                aria-label="Cari item atau kategori"
                className="h-8 w-44 rounded-md border border-[#e5e5df] bg-white pr-7 pl-8 text-xs text-[#141816] outline-none placeholder:text-[#9aa39e] focus:border-[#14533c]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Hapus pencarian"
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-[#9aa39e] hover:text-[#141816] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {inputTab !== 'pemakaian' && (
              <div className="flex items-center gap-0.5 rounded-md border border-[#e5e5df] bg-white p-0.5">
                {(
                  [
                    { id: 'all', label: 'Semua' },
                    { id: 'unfilled', label: 'Belum' },
                    { id: 'filled', label: 'Terisi' },
                    {
                      id: 'issue',
                      label: issueCount > 0 ? `Perlu Cek (${issueCount})` : 'Perlu Cek',
                    },
                  ] as Array<{ id: TileFilter; label: string }>
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTileFilter(f.id)}
                    className={`h-6.5 rounded px-2.5 text-[11.5px] font-medium whitespace-nowrap transition cursor-pointer ${
                      tileFilter === f.id
                        ? 'bg-[#141816] text-white'
                        : 'text-[#565e59] hover:bg-[#f3f3ee] hover:text-[#141816]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => navigateTo('tb')}
              className="hidden h-8 items-center gap-1.5 rounded-md border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#141816] whitespace-nowrap transition hover:bg-[#f3f3ee] sm:inline-flex cursor-pointer"
            >
              <Table2 className="h-3.5 w-3.5 text-[#14533c]" />
              <span>Tabel Bulanan</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONTEXTUAL WARNINGS & FEEDBACK */}
      {saveFeedback && (
        <div
          className={`shrink-0 flex items-center justify-between gap-3 border-b px-5 py-2 text-xs font-medium md:px-6 ${
            saveFeedback.type === 'ok'
              ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
              : 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
          }`}
        >
          <span>{saveFeedback.text}</span>
          <button
            type="button"
            onClick={() => setSaveFeedback(null)}
            className="text-current opacity-70 hover:opacity-100 cursor-pointer"
            aria-label="Tutup pesan"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {inputTab === 'closing' && summary.missingPrevClosing && (
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-[#f3d692] bg-[#fffcf2] px-5 py-2 text-xs text-[#92400e] md:px-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#b45309]" />
            <span>
              Closing tanggal <strong>{day - 1}</strong> belum diisi, sehingga stok siap jual dan
              pemakaian tanggal {day} belum bisa dihitung.
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('in', { day: day - 1, inputTab: 'closing' })}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#e5c06d] bg-white px-2.5 text-[11.5px] font-medium text-[#92400e] whitespace-nowrap hover:bg-[#fef6dc] cursor-pointer"
          >
            <span>Isi Closing Tgl {day - 1}</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {summary.missingAwalDay1 && (
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-[#f3d692] bg-[#fffcf2] px-5 py-2 text-xs text-[#92400e] md:px-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#b45309]" />
            <span>
              Stok awal bulan ini (tanggal 1) belum diisi. Lengkapi Stok Awal agar stok siap jual
              akurat.
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('aw')}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#e5c06d] bg-white px-2.5 text-[11.5px] font-medium text-[#92400e] whitespace-nowrap hover:bg-[#fef6dc] cursor-pointer"
          >
            <span>Buka Stok Awal</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {summary.negativeUsageRows.length > 0 && (
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-[#fecaca] bg-[#fef2f2] px-5 py-2 text-xs text-[#991b1b] md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#b91c1c]" />
            <span className="truncate">
              <strong>{summary.negativeUsageRows.length} pemakaian bernilai negatif</strong>{' '}
              (closing melebihi stok siap jual):{' '}
              {summary.negativeUsageRows
                .slice(0, 4)
                .map((r) => `${r.item.nama} (${formatNum(r.pemakaian)})`)
                .join(', ')}
              {summary.negativeUsageRows.length > 4 ? ', dll.' : ''}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => jumpToItemInput(summary.negativeUsageRows[0].item.id, 'closing')}
              className="h-7 rounded-md border border-[#fca5a5] bg-white px-2.5 text-[11.5px] font-medium text-[#991b1b] whitespace-nowrap hover:bg-[#fee2e2] cursor-pointer"
            >
              Periksa Closing
            </button>
            <button
              type="button"
              onClick={() => jumpToItemInput(summary.negativeUsageRows[0].item.id, 'datang')}
              className="h-7 rounded-md border border-[#fca5a5] bg-white px-2.5 text-[11.5px] font-medium text-[#991b1b] whitespace-nowrap hover:bg-[#fee2e2] cursor-pointer"
            >
              Cek Barang Datang
            </button>
          </div>
        </div>
      )}

      {inputTab === 'closing' &&
        (summary.zeroClosingRows.length > 0 || summary.lowClosingRows.length > 0) && (
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-[#f3d692] bg-[#fffaf0] px-5 py-1.5 text-xs text-[#92400e] md:px-6">
            <span className="truncate">
              Stok kritis tgl {day}:{' '}
              {summary.zeroClosingRows.length > 0 && (
                <strong>{summary.zeroClosingRows.length} kosong</strong>
              )}
              {summary.zeroClosingRows.length > 0 && summary.lowClosingRows.length > 0 && ' · '}
              {summary.lowClosingRows.length > 0 && (
                <strong>{summary.lowClosingRows.length} di bawah minimum</strong>
              )}{' '}
              (
              {[...summary.zeroClosingRows, ...summary.lowClosingRows]
                .slice(0, 4)
                .map((r) => `${r.item.nama}: ${formatNum(r.closing)}`)
                .join(', ')}
              {summary.zeroClosingRows.length + summary.lowClosingRows.length > 4 ? ', dll.' : ''})
            </span>
            <button
              type="button"
              onClick={() => {
                const target = summary.zeroClosingRows[0] || summary.lowClosingRows[0];
                if (target) jumpToItemInput(target.item.id, 'datang');
              }}
              className="inline-flex h-6 items-center gap-1 text-[11.5px] font-medium text-[#92400e] underline underline-offset-2 whitespace-nowrap hover:text-[#78350f] cursor-pointer"
            >
              <span>Input Barang Datang</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}

      {/* MAIN BODY */}
      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-5 py-3 md:px-6">
        {totalItems === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-display text-sm font-semibold text-[#141816]">
              Belum ada item aktif di Master Item.
            </p>
            <p className="mt-1 text-xs text-[#565e59]">
              Tambahkan atau aktifkan barang di Master Item agar muncul di form Input Harian.
            </p>
            <button
              type="button"
              onClick={() => navigateTo('ms')}
              className="mt-4 h-9 rounded-md bg-[#14533c] px-4 text-xs font-medium text-white hover:bg-[#0f3f2d] cursor-pointer"
            >
              Buka Master Item
            </button>
          </div>
        ) : inputTab === 'pemakaian' ? (
          <div className="py-2">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-[#141816]">
                  Rekap Pergerakan &amp; Pemakaian — {getFullDateLabel(ym, day)}
                </h2>
                <p className="mt-0.5 text-xs text-[#7c8580]">
                  Dihitung otomatis dari {day === 1 ? 'Stok Awal' : `Closing Tgl ${day - 1}`},
                  Barang Datang, dan Closing Fisik.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInputTab('datang')}
                  className="h-8 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] hover:bg-[#f3f3ee] cursor-pointer"
                >
                  Edit Barang Datang
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab('closing')}
                  className="h-8 rounded-md bg-[#14533c] px-3 text-xs font-medium text-white hover:bg-[#0f3f2d] cursor-pointer"
                >
                  Edit Closing
                </button>
              </div>
            </div>

            {filteredGroups.length === 0 ? (
              <div className="rounded-xl border border-[#e5e5df] py-12 text-center text-xs text-[#565e59]">
                Tidak ada item yang cocok dengan pencarian &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#e5e5df]">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#e5e5df] bg-[#fafaf8] text-[11.5px] font-medium text-[#565e59]">
                      <th className="px-4 py-2.5">Item</th>
                      <th className="px-3 py-2.5">Satuan</th>
                      <th className="px-3 py-2.5 text-right">
                        {day === 1 ? 'Stok Awal' : `Closing Tgl ${day - 1}`}
                      </th>
                      <th className="px-3 py-2.5 text-right">Barang Datang</th>
                      <th className="px-3 py-2.5 text-right">Stok Siap Jual</th>
                      <th className="px-3 py-2.5 text-right">Closing Fisik</th>
                      <th className="px-3 py-2.5 text-right">Pemakaian</th>
                      <th className="px-4 py-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroups.map(([cat, items]) => (
                      <React.Fragment key={cat}>
                        <tr className="border-y border-[#e5e5df] bg-[#f4f4ef]">
                          <td
                            colSpan={8}
                            className="px-4 py-1.5 text-xs font-semibold text-[#141816]"
                          >
                            {cat}{' '}
                            <span className="font-normal text-[#7c8580]">
                              · {items.length} item
                            </span>
                          </td>
                        </tr>
                        {items.map((item) => {
                          const row = summary.rowsByItemId[item.id];
                          if (!row) return null;
                          return (
                            <tr
                              key={item.id}
                              className={`border-b border-[#efefea] transition hover:bg-[#fafaf8] ${
                                row.isNegativeUsage ? 'bg-[#fff5f5]' : ''
                              }`}
                            >
                              <td className="px-4 py-2.5">
                                <div className="font-medium text-[#141816]">{item.nama}</div>
                                <div className="font-mono-num text-[11px] text-[#7c8580]">
                                  {item.id}
                                  {item.min > 0 ? ` · min ${formatNum(item.min)}` : ''}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-[#7c8580]">
                                {item.sat || 'pcs'}
                              </td>
                              <td className="font-mono-num px-3 py-2.5 text-right text-[#565e59]">
                                {hasVal(row.prevBase) ? formatNum(row.prevBase) : '–'}
                              </td>
                              <td className="font-mono-num px-3 py-2.5 text-right text-[#141816]">
                                {hasVal(row.datang) ? formatNum(row.datang) : '–'}
                              </td>
                              <td className="font-mono-num px-3 py-2.5 text-right font-semibold text-[#141816]">
                                {row.totalSiapJual !== null ? formatNum(row.totalSiapJual) : '–'}
                              </td>
                              <td className="font-mono-num px-3 py-2.5 text-right font-semibold">
                                {hasVal(row.closing) ? (
                                  <span
                                    className={
                                      row.isZeroClosing
                                        ? 'text-[#b91c1c]'
                                        : row.isLowClosing
                                          ? 'text-[#b45309]'
                                          : 'text-[#141816]'
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
                                  <span className="font-normal text-[#9aa39e]">Belum</span>
                                )}
                              </td>
                              <td className="font-mono-num px-3 py-2.5 text-right font-semibold">
                                {row.pemakaian !== null ? (
                                  <span
                                    className={
                                      row.isNegativeUsage ? 'text-[#b91c1c]' : 'text-[#14533c]'
                                    }
                                  >
                                    {formatNum(row.pemakaian)}
                                    {row.isNegativeUsage ? ' · Melebihi' : ''}
                                  </span>
                                ) : (
                                  <span className="font-normal text-[#9aa39e]">–</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => jumpToItemInput(item.id, 'closing')}
                                  className="mr-1.5 text-xs font-medium text-[#14533c] hover:underline cursor-pointer"
                                >
                                  Closing
                                </button>
                                <span aria-hidden="true" className="text-[#d4d4cc]">
                                  ·
                                </span>
                                <button
                                  type="button"
                                  onClick={() => jumpToItemInput(item.id, 'datang')}
                                  className="ml-1.5 text-xs font-medium text-[#565e59] hover:text-[#141816] hover:underline cursor-pointer"
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
                    <tr className="border-t border-[#d8d8d0] bg-[#fafaf8] font-semibold text-[#141816]">
                      <td colSpan={3} className="px-4 py-2.5 text-xs">
                        Total Hari Ini ({summary.rows.length} item aktif)
                      </td>
                      <td className="font-mono-num px-3 py-2.5 text-right">
                        {formatNum(summary.totalDatangDay)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#9aa39e]">–</td>
                      <td className="font-mono-num px-3 py-2.5 text-right">
                        {summary.filledClosingCount > 0 ? formatNum(summary.totalClosingDay) : '–'}
                      </td>
                      <td className="font-mono-num px-3 py-2.5 text-right text-[#14533c]">
                        {summary.hasAnyPemakaian ? formatNum(summary.totalPemakaianDay) : '–'}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <p className="text-sm font-medium text-[#141816]">Tidak ada item pada filter ini.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTileFilter('all');
              }}
              className="mt-3 h-8 rounded-md border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#141816] hover:bg-[#f3f3ee] cursor-pointer"
            >
              Tampilkan Semua Item
            </button>
          </div>
        ) : (
          /* FAST ENTRY GRID PER CATEGORY */
          <div className="divide-y divide-[#e5e5df]">
            {filteredGroups.map(([cat, items]) => {
              const allCatItems = summary.groupedItems.find(([c]) => c === cat)?.[1] || items;
              const catFilled = allCatItems.filter((it) => {
                const r = summary.rowsByItemId[it.id];
                return hasVal(activeField === 'c' ? r?.closing : r?.datang);
              }).length;

              return (
                <section
                  key={cat}
                  className="grid grid-cols-1 gap-3 py-3.5 md:grid-cols-[124px_1fr] md:gap-4"
                >
                  <div className="flex items-baseline gap-2 md:block md:pt-1">
                    <h2 className="font-display text-[13.5px] font-semibold text-[#141816]">
                      {cat}
                    </h2>
                    <span className="font-mono-num text-xs text-[#7c8580]">
                      {catFilled}/{allCatItems.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {items.map((item) => {
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

                      let tileTone = 'border-[#dcdcd4] bg-white hover:border-[#b5b5aa]';
                      if (isNeg || isNegAttempt) {
                        tileTone = 'border-[#dc2626] bg-[#fff5f5]';
                      } else if (isFilled) {
                        tileTone = 'border-[#14533c]/45 bg-[#f4faf7]';
                      }

                      return (
                        <label
                          key={item.id}
                          className={`block rounded-lg border px-3 pt-2 pb-2 transition focus-within:border-[#14533c] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#14533c]/15 ${tileTone} ${
                            isViewer ? 'cursor-default opacity-95' : 'cursor-text'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              title={`${item.nama} (${item.kat} · ID: ${item.id})`}
                              className="block min-w-0 truncate text-[12.5px] font-medium text-[#141816]"
                            >
                              {item.nama}
                            </span>
                            {inputTab === 'closing' && row?.isZeroClosing && (
                              <span className="shrink-0 text-[10.5px] font-semibold text-[#b91c1c]">
                                Kosong
                              </span>
                            )}
                            {inputTab === 'closing' && row?.isLowClosing && (
                              <span className="shrink-0 text-[10.5px] font-semibold text-[#b45309]">
                                Min {formatNum(item.min)}
                              </span>
                            )}
                          </div>

                          <div className="mt-0.5 flex items-baseline gap-1.5">
                            <input
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
                              className="font-mono-num block w-full min-w-0 flex-1 border-none bg-transparent pt-0.5 text-[20px] leading-[1.35] font-semibold text-[#141816] outline-none placeholder:font-normal placeholder:text-[#c7ccc9] disabled:cursor-default disabled:text-[#565e59]"
                            />
                            <span className="shrink-0 text-[11px] text-[#7c8580]">
                              {item.sat || 'pcs'}
                            </span>
                          </div>

                          {isNegAttempt ? (
                            <div className="mt-0.5 text-[10.5px] font-semibold text-[#b91c1c]">
                              Tidak boleh negatif
                            </div>
                          ) : (
                            <div className="mt-0.5 flex min-h-[20px] items-center justify-between gap-1 text-[11px] whitespace-nowrap text-[#7c8580]">
                              {inputTab === 'closing' ? (
                                <>
                                  <span
                                    title={
                                      row?.totalSiapJual === null
                                        ? 'Closing hari sebelumnya belum diisi'
                                        : 'Stok siap jual'
                                    }
                                    className="truncate"
                                  >
                                    Stok{' '}
                                    <strong className="font-mono-num font-semibold text-[#141816]">
                                      {row?.totalSiapJual !== null
                                        ? formatNum(row.totalSiapJual)
                                        : '–'}
                                    </strong>
                                  </span>

                                  {row?.pemakaian !== null ? (
                                    <span
                                      title={
                                        row.isNegativeUsage
                                          ? `Closing lebih besar ${formatNum(-row.pemakaian)} dari stok siap jual`
                                          : `Pemakaian ${formatNum(row.pemakaian)} ${item.sat || 'pcs'}`
                                      }
                                      className={`font-mono-num shrink-0 font-semibold ${
                                        row.isNegativeUsage ? 'text-[#b91c1c]' : 'text-[#14533c]'
                                      }`}
                                    >
                                      {row.isNegativeUsage
                                        ? 'Melebihi'
                                        : `Pakai ${formatNum(row.pemakaian)}`}
                                    </span>
                                  ) : row?.totalSiapJual !== null && !isViewer ? (
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleSameAsStock(row);
                                      }}
                                      title="Isi sama dengan stok siap jual (tidak ada pemakaian)"
                                      className="shrink-0 rounded border border-[#e5e5df] bg-[#fafaf8] px-1.5 py-0.5 text-[10.5px] font-medium text-[#565e59] transition hover:border-[#14533c] hover:bg-[#ecf5f1] hover:text-[#14533c] cursor-pointer"
                                    >
                                      Sama
                                    </button>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  {hasVal(row?.prevBase) ? (
                                    <span className="truncate">
                                      {day === 1 ? 'Awal' : 'Kemarin'}{' '}
                                      <strong className="font-mono-num font-semibold text-[#141816]">
                                        {formatNum(row.prevBase)}
                                      </strong>
                                    </span>
                                  ) : (
                                    <span className="text-[#9aa39e]">
                                      {day === 1 ? 'Awal –' : 'Kemarin –'}
                                    </span>
                                  )}
                                  {hasVal(row?.datang) && row?.totalSiapJual !== null && (
                                    <span className="font-mono-num shrink-0 font-semibold text-[#14533c]">
                                      Siap {formatNum(row.totalSiapJual)}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* BOTTOM KEYBOARD HINT & SYNC FOOTER */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-[#e5e5df] bg-[#fafaf8] px-5 py-2 text-xs text-[#7c8580] md:px-6">
        <span>
          <strong className="font-medium text-[#565e59]">Enter</strong> /{' '}
          <strong className="font-medium text-[#565e59]">↓</strong> berikutnya ·{' '}
          <strong className="font-medium text-[#565e59]">Shift+Enter</strong> /{' '}
          <strong className="font-medium text-[#565e59]">↑</strong> kembali ·{' '}
          <strong className="font-medium text-[#565e59]">Ctrl+S</strong> simpan
        </span>
        <span className={`font-medium ${sync.isError ? 'text-[#b91c1c]' : 'text-[#7c8580]'}`}>
          {sync.text}
          {sync.lastSyncAt ? ` · ${sync.lastSyncAt}` : ''}
        </span>
      </div>
    </div>
  );
};
