import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Printer,
  Search,
  Table2,
  X,
} from 'lucide-react';
import { DAY_NAMES, MONTH_NAMES } from '../constants/defaults';
import { useApp } from '../context/AppContext';
import {
  formatNum,
  getDayOfWeek,
  getMonth,
  getMonthLabel,
  getYear,
  hasVal,
} from '../domain/dateUtils';
import {
  generateMonthlyCsv,
  generateMonthlyPlainText,
  getDailyUsage,
  getMonthlyTableSummary,
  getStockTotal,
  getStockVal,
  type MonthlyMetricMode,
  type PlainTextFilter,
} from '../domain/stockCalculations';
import type { MasterItem } from '../types/app';

type TableSubMode = 'table' | 'text';

const METRIC_OPTIONS: Array<{ value: MonthlyMetricMode; label: string; shortLabel: string }> = [
  { value: 'p', label: 'Pemakaian', shortLabel: 'Pemakaian' },
  { value: 'd', label: 'Barang Datang', shortLabel: 'Barang Datang' },
  { value: 't', label: 'Stok Total (Siap Jual)', shortLabel: 'Stok Total' },
  { value: 'c', label: 'Sisa Closing', shortLabel: 'Sisa Closing' },
];

const PLAIN_FILTER_OPTIONS: Array<{ value: PlainTextFilter; label: string }> = [
  { value: 'all', label: 'Semua Data (Lengkap)' },
  { value: 'p', label: 'Pemakaian Saja' },
  { value: 'd', label: 'Barang Datang Saja' },
  { value: 't', label: 'Stok Total (Siap Jual)' },
  { value: 'c', label: 'Sisa Closing Saja' },
  { value: 'month_summary', label: 'Rekap Total 1 Bulan Penuh' },
];

function downloadBlob(filename: string, content: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const TabelBulananPage: React.FC = () => {
  const { state, ym, curYm, nowDay, moveMonth, setMonthAndDay, goToday, navigateTo } = useApp();

  const [subMode, setSubMode] = useState<TableSubMode>('table');
  const [metric, setMetric] = useState<MonthlyMetricMode>('p');
  const [catFilter, setCatFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyActiveDays, setOnlyActiveDays] = useState<boolean>(false);

  const [selectedTextDay, setSelectedTextDay] = useState<number | null>(null);
  const [plainFilter, setPlainFilter] = useState<PlainTextFilter>('all');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [detailShowAllDays, setDetailShowAllDays] = useState<boolean>(false);

  const summary = useMemo(
    () => getMonthlyTableSummary(state, ym, curYm, nowDay),
    [state, ym, curYm, nowDay]
  );

  useEffect(() => {
    setSelectedTextDay(null);
  }, [ym]);

  useEffect(() => {
    if (!copyFeedback) return;
    const t = window.setTimeout(() => setCopyFeedback(null), 2800);
    return () => window.clearTimeout(t);
  }, [copyFeedback]);

  const curTextDay =
    selectedTextDay !== null
      ? Math.min(Math.max(1, selectedTextDay), summary.nd)
      : summary.defaultDay;

  const isFallbackTextDay =
    summary.isCur && !summary.hasTodayData && curTextDay === summary.defaultDay;

  const categories = useMemo(
    () => summary.groupedItems.map(([cat]) => cat),
    [summary.groupedItems]
  );

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return summary.groupedItems
      .filter(([cat]) => catFilter === 'ALL' || cat === catFilter)
      .map(([cat, items]): [string, MasterItem[]] => {
        if (!q) return [cat, items];
        const matched = items.filter(
          (i) =>
            i.nama.toLowerCase().includes(q) ||
            i.kat.toLowerCase().includes(q) ||
            i.id.toLowerCase().includes(q) ||
            (i.sat || '').toLowerCase().includes(q)
        );
        return [cat, matched];
      })
      .filter(([, list]) => list.length > 0);
  }, [summary.groupedItems, catFilter, searchQuery]);

  const filteredItems = useMemo(
    () => filteredGroups.flatMap(([, list]) => list),
    [filteredGroups]
  );

  const visibleDays = useMemo(() => {
    const allDays = Array.from({ length: summary.nd }, (_, idx) => idx + 1);
    if (!onlyActiveDays) return allDays;
    return allDays.filter((d) => {
      const dm = summary.dayMeta[d];
      return Boolean(dm && (dm.hasClosing || dm.hasDatang));
    });
  }, [summary.nd, summary.dayMeta, onlyActiveDays]);

  const plainTextContent = useMemo(
    () =>
      subMode === 'text'
        ? generateMonthlyPlainText(state, ym, curYm, nowDay, curTextDay, plainFilter)
        : '',
    [subMode, state, ym, curYm, nowDay, curTextDay, plainFilter]
  );

  const selectedItem = useMemo(
    () => (selectedItemId ? summary.orderedItems.find((i) => i.id === selectedItemId) || null : null),
    [selectedItemId, summary.orderedItems]
  );

  const firstNegativeDay = useMemo(() => {
    for (let d = 1; d <= summary.nd; d++) {
      if (summary.dayMeta[d]?.hasNegative) return d;
    }
    return null;
  }, [summary.nd, summary.dayMeta]);

  const handleCopyPlainText = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(plainTextContent);
        setCopyFeedback('Plain text berhasil disalin ke clipboard.');
      } else {
        setCopyFeedback('Browser tidak mendukung salin otomatis. Silakan blok dan salin teks di bawah.');
      }
    } catch {
      setCopyFeedback('Gagal menyalin otomatis. Silakan blok teks di area pratinjau lalu salin.');
    }
  };

  const handleDownloadTxt = () => {
    downloadBlob(`tabel-bulanan-${ym}-tgl${curTextDay}.txt`, plainTextContent, 'text/plain;charset=utf-8');
    setCopyFeedback(`File tabel-bulanan-${ym}-tgl${curTextDay}.txt diunduh.`);
  };

  const handleDownloadCsv = () => {
    const csvContent = generateMonthlyCsv(state, ym, curYm, nowDay, metric);
    const suffix =
      metric === 'd'
        ? 'datang'
        : metric === 't'
          ? 'stok-total'
          : metric === 'c'
            ? 'closing'
            : 'pemakaian';
    downloadBlob(`${suffix}-${ym}.csv`, csvContent, 'text/csv;charset=utf-8');
    setCopyFeedback(`File ${suffix}-${ym}.csv berhasil diunduh.`);
  };

  const handleMonthInputChange = (val: string) => {
    if (!val || val.length < 7) return;
    setMonthAndDay(val.slice(0, 7), 1);
  };

  const openDayInInputHarian = (d: number, preferredTab?: 'closing' | 'datang') => {
    const targetTab = preferredTab || (metric === 'd' ? 'datang' : 'closing');
    navigateTo('in', { ym, day: d, inputTab: targetTab });
  };

  const monthName = MONTH_NAMES[getMonth(ym) - 1] || '';
  const yearNum = getYear(ym);
  const currentMetricLabel =
    METRIC_OPTIONS.find((m) => m.value === metric)?.label || 'Pemakaian';

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
      {/* TOP HEADER BAR */}
      <header className="shrink-0 border-b border-[#e5e5df] bg-white px-5 py-3.5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="font-display text-lg font-semibold text-[#141816] whitespace-nowrap">
              Tabel Bulanan
            </h1>

            <div className="inline-flex items-center rounded-lg border border-[#e5e5df] bg-[#fafaf8] p-0.5">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                aria-label="Bulan sebelumnya"
                title="Bulan sebelumnya"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#565e59] transition hover:bg-white hover:text-[#141816] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <input
                type="month"
                value={ym}
                onChange={(e) => handleMonthInputChange(e.target.value)}
                aria-label="Pilih bulan dan tahun"
                className="font-mono-num h-7 bg-transparent px-2 text-xs font-medium text-[#141816] outline-none"
              />

              <button
                type="button"
                onClick={() => moveMonth(1)}
                aria-label="Bulan berikutnya"
                title="Bulan berikutnya"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#565e59] transition hover:bg-white hover:text-[#141816] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {!summary.isCur && (
              <button
                type="button"
                onClick={goToday}
                className="h-8 rounded-md border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#141816] whitespace-nowrap hover:bg-[#f3f3ee] cursor-pointer"
              >
                Bulan Ini
              </button>
            )}

            <span className="hidden text-xs text-[#7c8580] whitespace-nowrap md:inline">
              {getMonthLabel(ym)}
            </span>
          </div>

          <div
            role="tablist"
            aria-label="Mode tampilan tabel bulanan"
            className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[#e5e5df] bg-[#f7f7f4] p-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={subMode === 'table'}
              onClick={() => setSubMode('table')}
              className={`flex h-7.5 items-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap shrink-0 transition cursor-pointer ${
                subMode === 'table'
                  ? 'bg-[#14533c] text-white'
                  : 'text-[#565e59] hover:bg-white hover:text-[#141816]'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
              <span>Mode Tabel</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subMode === 'text'}
              onClick={() => setSubMode('text')}
              className={`flex h-7.5 items-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap shrink-0 transition cursor-pointer ${
                subMode === 'text'
                  ? 'bg-[#14533c] text-white'
                  : 'text-[#565e59] hover:bg-white hover:text-[#141816]'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Mode Plain Text</span>
            </button>
          </div>
        </div>
      </header>

      {/* MONTHLY SUMMARY STRIP */}
      <div className="shrink-0 border-b border-[#e5e5df] bg-[#fafaf8] px-5 py-2 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#565e59]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Pemakaian Bulan{' '}
              <strong className="font-mono-num font-semibold text-[#14533c]">
                {formatNum(summary.totalPemakaianAll)}
              </strong>
            </span>
            <span aria-hidden="true" className="text-[#d4d4cc]">
              ·
            </span>
            <span>
              Barang Datang{' '}
              <strong className="font-mono-num font-semibold text-[#141816]">
                {formatNum(summary.totalDatangAll)}
              </strong>
            </span>
            <span aria-hidden="true" className="text-[#d4d4cc]">
              ·
            </span>
            <span>
              Hari Closing{' '}
              <strong className="font-mono-num font-semibold text-[#141816]">
                {summary.daysWithClosing}/{summary.nd}
              </strong>
            </span>
            <span aria-hidden="true" className="text-[#d4d4cc]">
              ·
            </span>
            <span>
              Item Tampil{' '}
              <strong className="font-mono-num font-semibold text-[#141816]">
                {summary.orderedItems.length}
              </strong>
              {summary.archivedWithHistoryCount > 0 && (
                <span className="text-[#7c8580]">
                  {' '}
                  (termasuk {summary.archivedWithHistoryCount} arsip berhistori)
                </span>
              )}
            </span>
          </div>

          {summary.totalNegativeCells > 0 && firstNegativeDay !== null && (
            <button
              type="button"
              onClick={() => openDayInInputHarian(firstNegativeDay, 'closing')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#b91c1c] hover:underline whitespace-nowrap cursor-pointer"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>
                {summary.totalNegativeCells} sel pemakaian negatif — Periksa Tgl {firstNegativeDay}
              </span>
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {copyFeedback && (
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-[#bbf7d0] bg-[#f0fdf4] px-5 py-2 text-xs font-medium text-[#15803d] md:px-6">
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            {copyFeedback}
          </span>
          <button
            type="button"
            onClick={() => setCopyFeedback(null)}
            aria-label="Tutup notifikasi"
            className="opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* MAIN BODY */}
      {subMode === 'table' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4 md:px-6">
          {/* Controls bar */}
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as MonthlyMetricMode)}
                aria-label="Pilih metrik tabel bulanan"
                className="h-8.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] outline-none focus:border-[#14533c] cursor-pointer"
              >
                {METRIC_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                aria-label="Filter kategori"
                className="h-8.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs text-[#565e59] outline-none focus:border-[#14533c] cursor-pointer"
              >
                <option value="ALL">Semua Kategori ({categories.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#9aa39e]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari item…"
                  aria-label="Cari item di tabel bulanan"
                  className="h-8.5 w-40 rounded-md border border-[#e5e5df] bg-white pr-7 pl-8 text-xs text-[#141816] outline-none placeholder:text-[#9aa39e] focus:border-[#14533c]"
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

              <button
                type="button"
                onClick={() => setOnlyActiveDays((v) => !v)}
                className={`h-8.5 rounded-md border px-3 text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  onlyActiveDays
                    ? 'border-[#14533c] bg-[#ecf5f1] text-[#14533c]'
                    : 'border-[#e5e5df] bg-white text-[#565e59] hover:bg-[#f3f3ee]'
                }`}
              >
                {onlyActiveDays ? 'Hari Bertransaksi Saja' : 'Semua Tanggal (1–' + summary.nd + ')'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] whitespace-nowrap hover:bg-[#f3f3ee] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-[#14533c]" />
                <span>Unduh CSV</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('in', { ym, day: summary.defaultDay })}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-[#14533c] px-3.5 text-xs font-medium text-white whitespace-nowrap hover:bg-[#0f3f2d] cursor-pointer"
              >
                <span>Buka Input Harian</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs text-[#7c8580]">
            <span>
              Matriks <strong className="font-medium text-[#141816]">{currentMetricLabel}</strong>{' '}
              {monthName} {yearNum}. Klik tanggal untuk mengedit, atau klik nama item untuk detail.
            </span>
            <span>Tanda &ldquo;–&rdquo; berarti belum diinput (berbeda dengan 0).</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-[#e5e5df] bg-[#fafaf8] p-10 text-center">
              <p className="font-display text-sm font-semibold text-[#141816]">
                {summary.orderedItems.length === 0
                  ? 'Belum ada item di Master Item.'
                  : 'Tidak ada item yang cocok dengan filter.'}
              </p>
              <p className="mt-1 text-xs text-[#565e59]">
                {summary.orderedItems.length === 0
                  ? 'Tambahkan item terlebih dahulu di menu Master Item.'
                  : 'Ubah kata kunci pencarian atau pilih kategori lain.'}
              </p>
              {summary.orderedItems.length === 0 ? (
                <button
                  type="button"
                  onClick={() => navigateTo('ms')}
                  className="mt-4 h-8.5 rounded-md bg-[#14533c] px-4 text-xs font-medium text-white hover:bg-[#0f3f2d] cursor-pointer"
                >
                  Buka Master Item
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCatFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="mt-4 h-8 rounded-md border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#141816] hover:bg-[#f3f3ee] cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            <div className="dg-scroll relative min-h-0 flex-1 overflow-auto rounded-lg border border-[#e5e5df] bg-white">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th
                      rowSpan={2}
                      className="sticky top-0 left-0 z-30 min-w-[98px] border-r border-b border-[#e5e5df] bg-[#fafaf8] px-3 py-2.5 text-left text-xs font-medium text-[#565e59] whitespace-nowrap"
                    >
                      Tanggal
                    </th>
                    {filteredGroups.map(([cat, items]) => (
                      <th
                        key={cat}
                        colSpan={items.length}
                        className="sticky top-0 z-20 border-b border-l border-[#e5e5df] bg-[#f4f4ef] px-3 py-2 text-center text-xs font-semibold text-[#141816] whitespace-nowrap"
                      >
                        {cat}
                      </th>
                    ))}
                  </tr>

                  <tr>
                    {filteredItems.map((item, idx) => {
                      const isFirstInCat = idx === 0 || filteredItems[idx - 1].kat !== item.kat;
                      return (
                        <th
                          key={item.id}
                          className={`sticky top-[33px] z-20 min-w-[92px] border-b border-[#e5e5df] bg-[#fafaf8] px-2.5 py-2 text-right whitespace-nowrap ${
                            isFirstInCat ? 'border-l border-[#e5e5df]' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setDetailShowAllDays(false);
                            }}
                            title={`Lihat detail bulanan ${item.nama} (ID: ${item.id})`}
                            className="group inline-flex max-w-[150px] flex-col items-end text-right cursor-pointer"
                          >
                            <span className="truncate text-[11.5px] font-medium text-[#141816] group-hover:text-[#14533c] group-hover:underline">
                              {item.nama}
                            </span>
                            <span className="text-[10px] font-normal text-[#7c8580]">
                              {item.sat || 'pcs'}
                              {!item.aktif ? ' · Arsip' : ''}
                            </span>
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  <tr className="border-b border-[#e5e5df] bg-[#fafaf8] hover:bg-[#f4f4ef]">
                    <td className="sticky left-0 z-10 border-r border-[#e5e5df] bg-[#fafaf8] px-3 py-2 text-left whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => navigateTo('aw', { ym })}
                        title="Buka menu Stok Awal"
                        className="text-xs font-semibold text-[#14533c] hover:underline cursor-pointer"
                      >
                        Stok Awal
                      </button>
                    </td>
                    {filteredItems.map((item, idx) => {
                      const isFirstInCat = idx === 0 || filteredItems[idx - 1].kat !== item.kat;
                      const awal = getStockVal(state, ym, 'a', 0, item.id);
                      return (
                        <td
                          key={item.id}
                          onClick={() => navigateTo('aw', { ym })}
                          title={`Stok awal ${item.nama} — klik untuk buka Stok Awal`}
                          className={`font-mono-num cursor-pointer px-2.5 py-2 text-right text-xs whitespace-nowrap ${
                            isFirstInCat ? 'border-l border-[#efefea]' : ''
                          } ${hasVal(awal) ? 'font-medium text-[#141816]' : 'text-[#c7ccc9]'}`}
                        >
                          {hasVal(awal) ? formatNum(awal) : '–'}
                        </td>
                      );
                    })}
                  </tr>

                  {visibleDays.length === 0 ? (
                    <tr>
                      <td
                        colSpan={filteredItems.length + 1}
                        className="py-12 text-center text-xs text-[#7c8580]"
                      >
                        Belum ada transaksi stok pada bulan {monthName} {yearNum}.
                      </td>
                    </tr>
                  ) : (
                    visibleDays.map((d) => {
                      const dow = getDayOfWeek(ym, d);
                      const isSunday = dow === 0;
                      const isToday = summary.isCur && d === summary.today;
                      const shortDay = (DAY_NAMES[dow] || '').slice(0, 3);
                      const rowBg = isSunday ? 'bg-[#f4faf7]' : 'bg-white';

                      return (
                        <tr
                          key={d}
                          className={`group border-b border-[#efefea] transition hover:bg-[#fafaf8] ${rowBg}`}
                        >
                          <td
                            className={`sticky left-0 z-10 border-r border-[#e5e5df] px-3 py-2 text-left whitespace-nowrap transition group-hover:bg-[#fafaf8] ${rowBg} ${
                              isToday ? 'shadow-[inset_3px_0_0_#14533c]' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => openDayInInputHarian(d)}
                              title={`Buka Input Harian tanggal ${d} ${monthName} ${yearNum}`}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#141816] hover:text-[#14533c] hover:underline cursor-pointer"
                            >
                              <span className="font-mono-num w-5 text-right">{d}</span>
                              <span
                                className={
                                  isSunday ? 'font-medium text-[#14533c]' : 'text-[#7c8580]'
                                }
                              >
                                {shortDay}
                              </span>
                              {isToday && (
                                <span className="text-[10px] font-semibold text-[#14533c]">
                                  Hari ini
                                </span>
                              )}
                            </button>
                          </td>

                          {filteredItems.map((item, idx) => {
                            const isFirstInCat =
                              idx === 0 || filteredItems[idx - 1].kat !== item.kat;
                            const val =
                              metric === 'd'
                                ? getStockVal(state, ym, 'd', d, item.id)
                                : metric === 't'
                                  ? getStockTotal(state, ym, d, item.id)
                                  : metric === 'c'
                                    ? getStockVal(state, ym, 'c', d, item.id)
                                    : getDailyUsage(state, ym, d, item.id);

                            const isMissing = val === null || val === undefined;
                            const isNeg = !isMissing && val < 0;
                            const isZeroExplicit = !isMissing && val === 0;

                            return (
                              <td
                                key={item.id}
                                onClick={() => openDayInInputHarian(d)}
                                title={`${item.nama} · Tgl ${d} ${monthName}: ${
                                  isMissing ? 'Belum diisi' : `${formatNum(val)} ${item.sat || 'pcs'}`
                                } (klik untuk buka Input Harian)`}
                                className={`font-mono-num cursor-pointer px-2.5 py-2 text-right text-xs whitespace-nowrap ${
                                  isFirstInCat ? 'border-l border-[#efefea]' : ''
                                }`}
                              >
                                {isMissing ? (
                                  <span className="text-[#c7ccc9]">–</span>
                                ) : isNeg ? (
                                  <span className="inline-block rounded bg-[#fef2f2] px-1.5 py-0.5 font-semibold text-[#b91c1c]">
                                    {formatNum(val)}
                                  </span>
                                ) : (
                                  <span
                                    className={
                                      isZeroExplicit
                                        ? 'text-[#7c8580]'
                                        : 'font-medium text-[#141816]'
                                    }
                                  >
                                    {formatNum(val)}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>

                <tfoot>
                  <tr className="bg-[#111614] text-white">
                    <td className="sticky bottom-0 left-0 z-30 border-r border-[#232c28] bg-[#111614] px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">
                      {metric === 'd' || metric === 'p' ? 'Total Bulan' : 'Closing Akhir'}
                    </td>
                    {filteredItems.map((item, idx) => {
                      const isFirstInCat = idx === 0 || filteredItems[idx - 1].kat !== item.kat;
                      const st = summary.itemSummaries[item.id];
                      let text = '–';
                      let isNegTotal = false;

                      if (metric === 'd') {
                        text = st && st.datangDaysCount > 0 ? formatNum(st.totalDatang) : '–';
                      } else if (metric === 'p') {
                        if (st && st.pemakaianDaysCount > 0) {
                          text = formatNum(st.totalPemakaian);
                          isNegTotal = st.totalPemakaian < 0;
                        }
                      } else {
                        text = st && hasVal(st.lastClosing) ? formatNum(st.lastClosing) : '–';
                      }

                      return (
                        <td
                          key={item.id}
                          onClick={() => {
                            setSelectedItemId(item.id);
                            setDetailShowAllDays(false);
                          }}
                          title={`Klik untuk lihat detail ${item.nama}`}
                          className={`font-mono-num sticky bottom-0 z-20 cursor-pointer bg-[#111614] px-2.5 py-2.5 text-right text-xs font-semibold whitespace-nowrap ${
                            isFirstInCat ? 'border-l border-[#232c28]' : ''
                          } ${isNegTotal ? 'text-[#fca5a5]' : 'text-white'}`}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4 md:px-6">
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-lg border border-[#e5e5df] bg-[#fafaf8] p-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedTextDay(Math.max(1, curTextDay - 1))}
                  disabled={curTextDay <= 1}
                  aria-label="Hari sebelumnya"
                  title="Hari sebelumnya"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[#565e59] hover:bg-white hover:text-[#141816] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex h-7 items-center gap-1.5 px-2.5 text-xs font-medium text-[#141816] whitespace-nowrap">
                  <Calendar className="h-3.5 w-3.5 text-[#14533c]" />
                  <span>
                    {DAY_NAMES[getDayOfWeek(ym, curTextDay)]}, {curTextDay} {monthName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTextDay(Math.min(summary.nd, curTextDay + 1))}
                  disabled={curTextDay >= summary.nd}
                  aria-label="Hari berikutnya"
                  title="Hari berikutnya"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[#565e59] hover:bg-white hover:text-[#141816] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {summary.isCur && (
                <button
                  type="button"
                  onClick={() => setSelectedTextDay(summary.today)}
                  className={`h-8 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                    curTextDay === summary.today
                      ? 'border-[#14533c] bg-[#ecf5f1] text-[#14533c]'
                      : 'border-[#e5e5df] bg-white text-[#565e59] hover:bg-[#f3f3ee]'
                  }`}
                >
                  Hari Ini (Tgl {summary.today})
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedTextDay(summary.defaultDay)}
                className={`h-8 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  curTextDay === summary.defaultDay
                    ? 'border-[#14533c] bg-[#ecf5f1] text-[#14533c]'
                    : 'border-[#e5e5df] bg-white text-[#565e59] hover:bg-[#f3f3ee]'
                }`}
              >
                Data Terakhir (Tgl {summary.defaultDay})
              </button>

              {isFallbackTextDay && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#92400e]">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#b45309]" />
                  <span>Hari ini belum diisi · Menampilkan data terakhir Tgl {curTextDay}</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={plainFilter}
                onChange={(e) => setPlainFilter(e.target.value as PlainTextFilter)}
                aria-label="Filter isi plain text"
                className="h-8.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] outline-none focus:border-[#14533c] cursor-pointer"
              >
                {PLAIN_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleCopyPlainText}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-[#14533c] px-3.5 text-xs font-medium text-white whitespace-nowrap hover:bg-[#0f3f2d] cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Salin Text</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTxt}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] whitespace-nowrap hover:bg-[#f3f3ee] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh TXT</span>
              </button>
            </div>
          </div>

          <pre className="dg-scroll font-mono-num min-h-0 flex-1 overflow-y-auto rounded-lg border border-[#e5e5df] bg-[#fafaf8] p-4 text-[12.5px] leading-[1.65] whitespace-pre-wrap text-[#141816] select-text">
            {plainTextContent}
          </pre>

          <div className="mt-2.5 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-[#7c8580]">
              Format plain text siap dibaca dan disalin ke WhatsApp atau catatan operasional toko.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openDayInInputHarian(curTextDay, 'closing')}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#14533c] hover:bg-[#ecf5f1] cursor-pointer"
              >
                <span>Buka Tgl {curTextDay} di Input Harian</span>
                <ArrowRight className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] hover:bg-[#f3f3ee] cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak Text</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ITEM MONTHLY DETAIL MODAL */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-[950] flex items-center justify-center bg-[#111614]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedItemId(null);
          }}
        >
          <div className="flex max-h-[86vh] w-full max-w-[740px] flex-col overflow-hidden rounded-xl border border-[#e5e5df] bg-white shadow-[0_24px_60px_rgba(17,22,20,0.18)]">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#e5e5df] px-5 py-4">
              <div>
                <h2 className="font-display text-base font-semibold text-[#141816]">
                  {selectedItem.nama}
                  {!selectedItem.aktif && (
                    <span className="ml-2 text-xs font-medium text-[#b45309]">(Arsip)</span>
                  )}
                </h2>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#7c8580]">
                  <span className="font-mono-num">{selectedItem.id}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedItem.kat}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedItem.sat || 'pcs'}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Min{' '}
                    {selectedItem.min > 0
                      ? `${formatNum(selectedItem.min)} ${selectedItem.sat || 'pcs'}`
                      : '–'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{getMonthLabel(ym)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemId(null)}
                aria-label="Tutup detail item"
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#7c8580] hover:bg-[#f3f3ee] hover:text-[#141816] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {(() => {
              const st = summary.itemSummaries[selectedItem.id];
              const sat = selectedItem.sat || 'pcs';
              const rows = Array.from({ length: summary.nd }, (_, idx) => {
                const d = idx + 1;
                const datang = getStockVal(state, ym, 'd', d, selectedItem.id);
                const total = getStockTotal(state, ym, d, selectedItem.id);
                const closing = getStockVal(state, ym, 'c', d, selectedItem.id);
                const usage = getDailyUsage(state, ym, d, selectedItem.id);
                const hasTx = hasVal(datang) || hasVal(closing);
                return { d, datang, total, closing, usage, hasTx };
              });
              const displayRows = detailShowAllDays ? rows : rows.filter((r) => r.hasTx);

              return (
                <>
                  <div className="grid shrink-0 grid-cols-2 divide-x divide-[#efefea] border-b border-[#e5e5df] bg-[#fafaf8] sm:grid-cols-4">
                    <div className="px-4 py-3">
                      <div className="text-[11px] text-[#7c8580]">Stok Awal</div>
                      <div className="font-mono-num mt-0.5 text-[15px] font-semibold text-[#141816]">
                        {st && hasVal(st.awal) ? `${formatNum(st.awal)} ${sat}` : '–'}
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-[11px] text-[#7c8580]">Total Datang</div>
                      <div className="font-mono-num mt-0.5 text-[15px] font-semibold text-[#141816]">
                        {st && st.datangDaysCount > 0 ? `+${formatNum(st.totalDatang)} ${sat}` : '–'}
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-[11px] text-[#7c8580]">Total Pemakaian</div>
                      <div
                        className={`font-mono-num mt-0.5 text-[15px] font-semibold ${
                          st && st.totalPemakaian < 0 ? 'text-[#b91c1c]' : 'text-[#14533c]'
                        }`}
                      >
                        {st && st.pemakaianDaysCount > 0
                          ? `${formatNum(st.totalPemakaian)} ${sat}`
                          : '–'}
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-[11px] text-[#7c8580]">
                        Closing Terakhir{st?.lastClosingDay ? ` (Tgl ${st.lastClosingDay})` : ''}
                      </div>
                      <div className="font-mono-num mt-0.5 text-[15px] font-semibold text-[#141816]">
                        {st && hasVal(st.lastClosing) ? `${formatNum(st.lastClosing)} ${sat}` : '–'}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#e5e5df] px-5 py-2.5 text-xs">
                    <span className="text-[#565e59]">
                      Menampilkan{' '}
                      <strong className="font-mono-num font-semibold text-[#141816]">
                        {displayRows.length}
                      </strong>{' '}
                      dari {summary.nd} tanggal
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailShowAllDays((v) => !v)}
                        className="h-7 rounded-md border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#141816] hover:bg-[#f3f3ee] cursor-pointer"
                      >
                        {detailShowAllDays ? 'Hari Bertransaksi Saja' : 'Tampilkan Semua Tanggal'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemId(null);
                          navigateTo('aw', { ym });
                        }}
                        className="h-7 rounded-md border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#14533c] hover:bg-[#ecf5f1] cursor-pointer"
                      >
                        Stok Awal
                      </button>
                    </div>
                  </div>

                  <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-5 py-3">
                    {displayRows.length === 0 ? (
                      <div className="py-10 text-center text-xs text-[#7c8580]">
                        Belum ada transaksi barang datang atau closing untuk item ini pada{' '}
                        {getMonthLabel(ym)}.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-[#e5e5df]">
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-[#e5e5df] bg-[#fafaf8] text-[11px] font-medium text-[#565e59]">
                              <th className="px-3 py-2 text-left">Tanggal</th>
                              <th className="px-3 py-2 text-right">Barang Datang</th>
                              <th className="px-3 py-2 text-right">Stok Siap Jual</th>
                              <th className="px-3 py-2 text-right">Closing Fisik</th>
                              <th className="px-3 py-2 text-right">Pemakaian</th>
                              <th className="px-3 py-2 text-right">Input Harian</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#efefea]">
                            {displayRows.map((r) => {
                              const dow = getDayOfWeek(ym, r.d);
                              const isNeg = r.usage !== null && r.usage < 0;
                              return (
                                <tr key={r.d} className={isNeg ? 'bg-[#fff5f5]' : ''}>
                                  <td className="px-3 py-2 font-medium text-[#141816] whitespace-nowrap">
                                    <span className="font-mono-num">{r.d}</span>{' '}
                                    <span className="font-normal text-[#7c8580]">
                                      {DAY_NAMES[dow]}
                                    </span>
                                  </td>
                                  <td className="font-mono-num px-3 py-2 text-right text-[#141816]">
                                    {hasVal(r.datang) ? formatNum(r.datang) : '–'}
                                  </td>
                                  <td className="font-mono-num px-3 py-2 text-right text-[#565e59]">
                                    {r.total !== null ? formatNum(r.total) : '–'}
                                  </td>
                                  <td className="font-mono-num px-3 py-2 text-right font-semibold text-[#141816]">
                                    {hasVal(r.closing) ? formatNum(r.closing) : '–'}
                                  </td>
                                  <td
                                    className={`font-mono-num px-3 py-2 text-right font-semibold ${
                                      isNeg ? 'text-[#b91c1c]' : 'text-[#14533c]'
                                    }`}
                                  >
                                    {r.usage !== null ? formatNum(r.usage) : '–'}
                                  </td>
                                  <td className="px-3 py-2 text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedItemId(null);
                                        openDayInInputHarian(r.d, 'closing');
                                      }}
                                      className="font-medium text-[#14533c] hover:underline cursor-pointer"
                                    >
                                      Buka Tgl {r.d}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center justify-between border-t border-[#e5e5df] bg-[#fafaf8] px-5 py-3">
                    <span className="text-xs text-[#7c8580]">
                      Seluruh angka dihitung langsung dari Stok Awal dan Input Harian.
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedItemId(null)}
                      className="h-8 rounded-md border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#141816] hover:bg-[#f3f3ee] cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
