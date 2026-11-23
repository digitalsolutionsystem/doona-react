import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
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
  const [onlyActiveDays, setOnlyActiveDays] = useState<boolean>(false);

  const [selectedTextDay, setSelectedTextDay] = useState<number | null>(null);
  const [plainFilter, setPlainFilter] = useState<PlainTextFilter>('all');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [detailShowAllDays, setDetailShowAllDays] = useState<boolean>(false);

  const matrixScrollRef = useRef<HTMLDivElement | null>(null);
  const matrixTableRef = useRef<HTMLTableElement | null>(null);
  const [fillerColWidths, setFillerColWidths] = useState<number[]>([]);
  const [fillerRowCount, setFillerRowCount] = useState<number>(0);

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
    return summary.groupedItems
      .filter(([cat]) => catFilter === 'ALL' || cat === catFilter)
      .filter(([, list]) => list.length > 0);
  }, [summary.groupedItems, catFilter]);

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

  const recomputeMatrixFillers = useCallback(() => {
    const wrapEl = matrixScrollRef.current;
    const tableEl = matrixTableRef.current;
    if (!wrapEl || !tableEl || subMode !== 'table' || filteredItems.length === 0) {
      setFillerColWidths((prev) => (prev.length === 0 ? prev : []));
      setFillerRowCount((prev) => (prev === 0 ? prev : 0));
      return;
    }

    const wrapW = wrapEl.clientWidth;
    const realColEls = tableEl.querySelectorAll<HTMLElement>('th[data-matrix-real-col="true"]');
    let realColsW = 0;
    realColEls.forEach((el) => {
      realColsW += el.getBoundingClientRect().width;
    });

    const remainingW = Math.floor(wrapW - realColsW);
    let nextColWidths: number[] = [];
    if (remainingW > 2) {
      const count = Math.max(1, Math.round(remainingW / 68));
      const baseW = Math.floor(remainingW / count);
      nextColWidths = Array.from({ length: count }, (_, idx) =>
        idx === count - 1 ? remainingW - baseW * (count - 1) : baseW
      );
    }

    setFillerColWidths((prev) => {
      if (prev.length === nextColWidths.length && prev.every((w, i) => w === nextColWidths[i])) {
        return prev;
      }
      return nextColWidths;
    });

    const wrapH = wrapEl.clientHeight;
    const theadH = tableEl.querySelector('thead')?.getBoundingClientRect().height || 0;
    const tfootH = tableEl.querySelector('tfoot')?.getBoundingClientRect().height || 0;
    const realRowEls = tableEl.querySelectorAll<HTMLElement>('tr[data-matrix-real-row="true"]');
    let realRowsH = 0;
    realRowEls.forEach((el) => {
      realRowsH += el.getBoundingClientRect().height;
    });

    const remainingH = Math.floor(wrapH - theadH - tfootH - realRowsH);
    const nextRowCount =
      visibleDays.length > 0 && remainingH > 24 ? Math.ceil(remainingH / 34) : 0;

    setFillerRowCount((prev) => (prev === nextRowCount ? prev : nextRowCount));
  }, [subMode, filteredItems.length, visibleDays.length]);

  useLayoutEffect(() => {
    recomputeMatrixFillers();
    const raf = window.requestAnimationFrame(recomputeMatrixFillers);
    return () => window.cancelAnimationFrame(raf);
  }, [recomputeMatrixFillers, ym, metric, catFilter, onlyActiveDays, state]);

  useEffect(() => {
    const wrapEl = matrixScrollRef.current;
    if (!wrapEl) return;
    const ro = new ResizeObserver(() => recomputeMatrixFillers());
    ro.observe(wrapEl);
    window.addEventListener('resize', recomputeMatrixFillers);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recomputeMatrixFillers);
    };
  }, [recomputeMatrixFillers]);

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
    <div className="dg-page">
      {/* PERSISTENT STATIONARY TOP HEADER BAR */}
      <PageHeader>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-base font-bold text-[#13222b] whitespace-nowrap">
              Tabel Bulanan
            </h1>

            <div className="inline-flex items-center rounded-xl bg-[#f3f7f5] p-0.5">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                aria-label="Bulan sebelumnya"
                title="Bulan sebelumnya"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <input
                type="month"
                value={ym}
                onChange={(e) => handleMonthInputChange(e.target.value)}
                aria-label="Pilih bulan dan tahun"
                className="font-mono-num h-7 bg-transparent px-2 text-xs font-semibold text-[#13222b] outline-none"
              />

              <button
                type="button"
                onClick={() => moveMonth(1)}
                aria-label="Bulan berikutnya"
                title="Bulan berikutnya"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {!summary.isCur && (
              <button
                type="button"
                onClick={goToday}
                className="h-8 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] whitespace-nowrap transition hover:bg-[#e1ebe7] cursor-pointer"
              >
                Bulan Ini
              </button>
            )}

            {subMode === 'table' && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as MonthlyMetricMode)}
                  aria-label="Pilih metrik tabel bulanan"
                  className="h-8 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] outline-none transition hover:bg-[#e7efec] focus:ring-2 focus:ring-[#2eb86b] cursor-pointer"
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
                  className="h-8 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#475569] outline-none transition hover:bg-[#e7efec] focus:ring-2 focus:ring-[#2eb86b] cursor-pointer"
                >
                  <option value="ALL">Semua Kategori ({categories.length})</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setOnlyActiveDays((v) => !v)}
                  className={`h-8 rounded-xl px-3 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    onlyActiveDays
                      ? 'bg-[#2eb86b] text-white shadow-xs'
                      : 'bg-[#f3f7f5] text-[#475569] hover:bg-[#e1ebe7] hover:text-[#13222b]'
                  }`}
                >
                  {onlyActiveDays ? 'Hari Bertransaksi Saja' : 'Semua Tanggal (1–' + summary.nd + ')'}
                </button>
              </div>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Mode tampilan tabel bulanan"
            className="flex shrink-0 items-center gap-1 rounded-xl bg-[#f3f7f5] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={subMode === 'table'}
              onClick={() => setSubMode('table')}
              className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                subMode === 'table'
                  ? 'bg-[#2eb86b] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#13222b]'
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
              className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                subMode === 'text'
                  ? 'bg-[#2eb86b] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#13222b]'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Mode Plain Text</span>
            </button>
          </div>
      </PageHeader>

      {/* FLOATING COMPACT SUMMARY STRIP */}
      <div className="no-print mx-4 mt-3 shrink-0 rounded-2xl border border-[#cddad5] bg-white px-4 py-2.5 shadow-[0_6px_22px_rgba(13,37,48,0.055)] md:mx-6 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748b]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Pemakaian Bulan{' '}
              <strong className="font-mono-num font-bold text-[#15803d]">
                {formatNum(summary.totalPemakaianAll)}
              </strong>
            </span>
            <span aria-hidden="true" className="text-[#cbd5e1]">
              ·
            </span>
            <span>
              Barang Datang{' '}
              <strong className="font-mono-num font-bold text-[#13222b]">
                {formatNum(summary.totalDatangAll)}
              </strong>
            </span>
            <span aria-hidden="true" className="text-[#cbd5e1]">
              ·
            </span>
            <span>
              Hari Closing{' '}
              <strong className="font-mono-num font-bold text-[#13222b]">
                {summary.daysWithClosing}/{summary.nd}
              </strong>
            </span>
            <span aria-hidden="true" className="text-[#cbd5e1]">
              ·
            </span>
            <span>
              Item Tampil{' '}
              <strong className="font-mono-num font-bold text-[#13222b]">
                {summary.orderedItems.length}
              </strong>
              {summary.archivedWithHistoryCount > 0 && (
                <span className="text-[#64748b]">
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#fee2e2] px-2.5 py-1 text-xs font-semibold text-[#b91c1c] transition hover:bg-[#fecaca] whitespace-nowrap cursor-pointer"
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

      {/* FLOATING FEEDBACK BANNER */}
      {copyFeedback && (
        <div className="no-print mx-4 mt-3 shrink-0 flex items-center justify-between gap-2 rounded-xl bg-[#2eb86b] px-4 py-2.5 text-xs font-semibold text-white shadow-sm md:mx-6">
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            {copyFeedback}
          </span>
          <button
            type="button"
            onClick={() => setCopyFeedback(null)}
            aria-label="Tutup notifikasi"
            className="opacity-80 hover:opacity-100 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* MAIN BODY */}
      {subMode === 'table' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 md:px-6 md:py-4">
          {filteredItems.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl bg-white p-10 text-center shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <p className="font-display text-sm font-bold text-[#13222b]">
                {summary.orderedItems.length === 0
                  ? 'Belum ada item di Master Item.'
                  : 'Tidak ada item yang cocok dengan filter.'}
              </p>
              <p className="mt-1 text-xs text-[#64748b]">
                {summary.orderedItems.length === 0
                  ? 'Tambahkan item terlebih dahulu di menu Master Item.'
                  : 'Pilih kategori lain atau tampilkan semua kategori.'}
              </p>
              {summary.orderedItems.length === 0 ? (
                <button
                  type="button"
                  onClick={() => navigateTo('ms')}
                  className="mt-4 h-9 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                >
                  Buka Master Item
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCatFilter('ALL')}
                  className="mt-4 h-9 rounded-xl bg-[#f3f7f5] px-4 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#c0d0ca] bg-white shadow-[0_10px_28px_rgba(13,37,48,0.08)]">
              {/* Compact info + actions row */}
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#c9d7d2] bg-[#f7faf9] px-4 py-3 md:px-5">
                <span className="text-xs text-[#475569]">
                  Matriks{' '}
                  <strong className="font-semibold text-[#0d2530]">{currentMetricLabel}</strong>{' '}
                  {monthName} {yearNum}. Klik tanggal untuk mengedit, atau klik nama item untuk
                  detail.
                  <span className="hidden xl:inline">
                    {' '}
                    · Tanda &ldquo;–&rdquo; berarti belum diinput.
                  </span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#cfdcd7] bg-white px-3 text-xs font-semibold text-[#13222b] whitespace-nowrap transition hover:bg-[#eaf2ef] cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 text-[#2eb86b]" />
                    <span>Unduh CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('in', { ym, day: summary.defaultDay })}
                    className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-3.5 text-xs font-semibold text-white whitespace-nowrap transition hover:bg-[#259f5b] cursor-pointer"
                  >
                    <span>Buka Stok &amp; Input</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div
                ref={matrixScrollRef}
                className="dg-scroll relative min-h-0 flex-1 overflow-auto bg-white"
              >
                <table
                  ref={matrixTableRef}
                  className="dg-matrix-table table-auto w-max border-collapse text-[13px]"
                >
                  <thead>
                    <tr>
                      <th
                        rowSpan={2}
                        data-matrix-real-col="true"
                        className="sticky top-0 left-0 z-30 border-r-2 border-b-2 border-[#b2c4bd] bg-[#d8e5e0] px-2.5 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.05em] text-[#0d2530] whitespace-nowrap shadow-[3px_0_8px_rgba(13,37,48,0.07)]"
                      >
                        Tanggal
                      </th>
                      {filteredGroups.map(([cat, items]) => (
                        <th
                          key={cat}
                          colSpan={items.length}
                          className="sticky top-0 z-20 border-b border-l-2 border-[#b7c8c2] bg-[#e2ece8] px-2 py-2 text-center text-[11.5px] font-bold tracking-[0.01em] text-[#0d2530] whitespace-nowrap"
                        >
                          {cat}
                        </th>
                      ))}
                      {fillerColWidths.length > 0 && (
                        <th
                          aria-hidden="true"
                          colSpan={fillerColWidths.length}
                          className="print:hidden sticky top-0 z-20 border-b border-l-2 border-[#b7c8c2] bg-[#e2ece8] py-2"
                        >
                          &nbsp;
                        </th>
                      )}
                    </tr>

                    <tr>
                      {filteredItems.map((item, idx) => {
                        const isFirstInCat = idx === 0 || filteredItems[idx - 1].kat !== item.kat;
                        return (
                          <th
                            key={item.id}
                            data-matrix-real-col="true"
                            className={`sticky top-[33px] z-20 border-b-2 border-b-[#b2c4bd] bg-[#edf3f1] px-2 py-2 text-right whitespace-nowrap ${
                              isFirstInCat
                                ? 'border-l-2 border-l-[#b7c8c2]'
                                : 'border-l border-l-[#d4e0dc]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItemId(item.id);
                                setDetailShowAllDays(false);
                              }}
                              title={`Lihat detail bulanan ${item.nama} (ID: ${item.id})`}
                              className="group inline-flex flex-col items-end text-right whitespace-nowrap cursor-pointer"
                            >
                              <span className="text-[11.5px] font-bold text-[#0f232d] group-hover:text-[#15803d] group-hover:underline">
                                {item.nama}
                              </span>
                              <span className="text-[10.5px] font-medium text-[#475569]">
                                {item.sat || 'pcs'}
                                {!item.aktif ? ' · Arsip' : ''}
                              </span>
                            </button>
                          </th>
                        );
                      })}
                      {fillerColWidths.map((colW, idx) => (
                        <th
                          key={`filler-h-${idx}`}
                          aria-hidden="true"
                          style={{ width: `${colW}px`, minWidth: `${colW}px` }}
                          className={`print:hidden sticky top-[33px] z-20 border-b-2 border-b-[#b2c4bd] bg-[#edf3f1] py-2 ${
                            idx === 0
                              ? 'border-l-2 border-l-[#b7c8c2]'
                              : 'border-l border-l-[#d4e0dc]'
                          }`}
                        >
                          &nbsp;
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    <tr
                      data-matrix-real-row="true"
                      className="group border-b-2 border-[#b2d3c0] bg-[#e9f6ef] transition hover:bg-[#dcf0e5]"
                    >
                      <td className="sticky left-0 z-10 border-r-2 border-[#b2c4bd] bg-[#e9f6ef] px-3 py-2 text-left whitespace-nowrap shadow-[3px_0_8px_rgba(13,37,48,0.05)] transition group-hover:bg-[#dcf0e5]">
                        <button
                          type="button"
                          onClick={() => navigateTo('aw', { ym })}
                          title="Buka menu Stok Awal"
                          className="text-xs font-bold text-[#14533c] hover:underline cursor-pointer"
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
                            className={`font-mono-num cursor-pointer px-2 py-2 text-right text-xs whitespace-nowrap ${
                              isFirstInCat
                                ? 'border-l-2 border-l-[#bdd0c8]'
                                : 'border-l border-l-[#d1e3da]'
                            } ${hasVal(awal) ? 'font-bold text-[#0d2530]' : 'text-[#7c9099]'}`}
                          >
                            {hasVal(awal) ? formatNum(awal) : '–'}
                          </td>
                        );
                      })}
                      {fillerColWidths.map((colW, idx) => (
                        <td
                          key={`filler-aw-${idx}`}
                          aria-hidden="true"
                          style={{ width: `${colW}px`, minWidth: `${colW}px` }}
                          className={`print:hidden pointer-events-none py-2 ${
                            idx === 0
                              ? 'border-l-2 border-l-[#bdd0c8]'
                              : 'border-l border-l-[#d1e3da]'
                          }`}
                        />
                      ))}
                    </tr>

                    {visibleDays.length === 0 ? (
                      <tr>
                        <td
                          colSpan={filteredItems.length + 1 + fillerColWidths.length}
                          className="py-12 text-center text-xs text-[#64748b]"
                        >
                          Belum ada transaksi stok pada bulan {monthName} {yearNum}.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {visibleDays.map((d, rowIndex) => {
                          const dow = getDayOfWeek(ym, d);
                          const isSunday = dow === 0;
                          const isToday = summary.isCur && d === summary.today;
                          const shortDay = (DAY_NAMES[dow] || '').slice(0, 3);
                          const rowBg = isToday
                            ? 'bg-[#e3f6ec]'
                            : isSunday
                              ? 'bg-[#eef8f2]'
                              : rowIndex % 2 === 1
                                ? 'bg-[#f6faf8]'
                                : 'bg-white';

                          return (
                            <tr
                              key={d}
                              data-matrix-real-row="true"
                              className={`group border-b border-[#d4e0dc] transition hover:bg-[#e4f2eb] ${rowBg}`}
                            >
                              <td
                                className={`sticky left-0 z-10 border-r-2 border-[#c0d0ca] px-3 py-2 text-left whitespace-nowrap shadow-[3px_0_8px_rgba(13,37,48,0.05)] transition group-hover:bg-[#e4f2eb] ${rowBg} ${
                                  isToday ? 'shadow-[inset_3px_0_0_#2eb86b,3px_0_8px_rgba(13,37,48,0.05)]' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => openDayInInputHarian(d)}
                                  title={`Buka Input Harian tanggal ${d} ${monthName} ${yearNum}`}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#13222b] hover:text-[#15803d] hover:underline cursor-pointer"
                                >
                                  <span className="font-mono-num w-5 text-right font-bold">{d}</span>
                                  <span
                                    className={
                                      isSunday ? 'font-bold text-[#15803d]' : 'text-[#475569]'
                                    }
                                  >
                                    {shortDay}
                                  </span>
                                  {isToday && (
                                    <span className="rounded bg-[#2eb86b] px-1.5 py-0.5 text-[10px] font-bold text-white">
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
                                    className={`font-mono-num cursor-pointer px-2 py-2 text-right text-xs whitespace-nowrap ${
                                      isFirstInCat
                                        ? 'border-l-2 border-l-[#c4d3ce]'
                                        : 'border-l border-l-[#e1eae7]'
                                    }`}
                                  >
                                    {isMissing ? (
                                      <span className="text-[#8a9ca6]">–</span>
                                    ) : isNeg ? (
                                      <span className="inline-block rounded-md bg-[#fee2e2] px-1.5 py-0.5 font-bold text-[#b91c1c]">
                                        {formatNum(val)}
                                      </span>
                                    ) : (
                                      <span
                                        className={
                                          isZeroExplicit
                                            ? 'text-[#64748b]'
                                            : 'font-semibold text-[#0f232d]'
                                        }
                                      >
                                        {formatNum(val)}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}

                              {fillerColWidths.map((colW, idx) => (
                                <td
                                  key={`filler-d-${d}-${idx}`}
                                  aria-hidden="true"
                                  style={{ width: `${colW}px`, minWidth: `${colW}px` }}
                                  className={`print:hidden pointer-events-none py-2 ${
                                    idx === 0
                                      ? 'border-l-2 border-l-[#c4d3ce]'
                                      : 'border-l border-l-[#e1eae7]'
                                  }`}
                                />
                              ))}
                            </tr>
                          );
                        })}

                        {Array.from({ length: fillerRowCount }, (_, rIdx) => {
                          const rowBg =
                            (visibleDays.length + rIdx) % 2 === 1 ? 'bg-[#f6faf8]' : 'bg-white';
                          return (
                            <tr
                              key={`filler-row-${rIdx}`}
                              aria-hidden="true"
                              className={`print:hidden pointer-events-none border-b border-[#d4e0dc] ${rowBg}`}
                            >
                              <td
                                className={`sticky left-0 z-10 h-[34px] border-r-2 border-[#c0d0ca] px-3 py-2 shadow-[3px_0_8px_rgba(13,37,48,0.05)] ${rowBg}`}
                              >
                                &nbsp;
                              </td>
                              {filteredItems.map((item, idx) => {
                                const isFirstInCat =
                                  idx === 0 || filteredItems[idx - 1].kat !== item.kat;
                                return (
                                  <td
                                    key={`filler-rc-${rIdx}-${item.id}`}
                                    className={`h-[34px] py-2 ${
                                      isFirstInCat
                                        ? 'border-l-2 border-l-[#c4d3ce]'
                                        : 'border-l border-l-[#e1eae7]'
                                    }`}
                                  />
                                );
                              })}
                              {fillerColWidths.map((colW, idx) => (
                                <td
                                  key={`filler-rf-${rIdx}-${idx}`}
                                  style={{ width: `${colW}px`, minWidth: `${colW}px` }}
                                  className={`h-[34px] py-2 ${
                                    idx === 0
                                      ? 'border-l-2 border-l-[#c4d3ce]'
                                      : 'border-l border-l-[#e1eae7]'
                                  }`}
                                />
                              ))}
                            </tr>
                          );
                        })}
                      </>
                    )}
                  </tbody>

                  <tfoot>
                    <tr className="bg-[#0d2530] text-white">
                      <td className="sticky bottom-0 left-0 z-30 border-t-2 border-r-2 border-[#2a4f61] bg-[#0d2530] px-3 py-2.5 text-left text-xs font-bold whitespace-nowrap shadow-[3px_0_8px_rgba(0,0,0,0.2)]">
                        {metric === 'd' || metric === 'p'
                          ? 'Total Bulan'
                          : metric === 't'
                            ? 'Siap Jual Akhir'
                            : 'Closing Akhir'}
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
                        } else if (metric === 't') {
                          text =
                            st && hasVal(st.lastStockTotal) ? formatNum(st.lastStockTotal) : '–';
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
                            className={`font-mono-num sticky bottom-0 z-20 cursor-pointer border-t-2 border-t-[#2a4f61] bg-[#0d2530] px-2 py-2.5 text-right text-xs font-bold whitespace-nowrap ${
                              isFirstInCat
                                ? 'border-l-2 border-l-[#2a4f61]'
                                : 'border-l border-l-[#1b3c4b]'
                            } ${isNegTotal ? 'text-[#fca5a5]' : 'text-white'}`}
                          >
                            {text}
                          </td>
                        );
                      })}
                      {fillerColWidths.map((colW, idx) => (
                        <td
                          key={`filler-f-${idx}`}
                          aria-hidden="true"
                          style={{ width: `${colW}px`, minWidth: `${colW}px` }}
                          className={`print:hidden pointer-events-none sticky bottom-0 z-20 border-t-2 border-t-[#2a4f61] bg-[#0d2530] py-2.5 ${
                            idx === 0
                              ? 'border-l-2 border-l-[#2a4f61]'
                              : 'border-l border-l-[#1b3c4b]'
                          }`}
                        />
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 md:px-6 md:py-4">
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white p-4 shadow-[0_6px_24px_rgba(13,37,48,0.045)] md:p-5">
            <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center rounded-xl bg-[#f3f7f5] p-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTextDay(Math.max(1, curTextDay - 1))}
                    disabled={curTextDay <= 1}
                    aria-label="Hari sebelumnya"
                    title="Hari sebelumnya"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] hover:bg-white hover:text-[#13222b] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex h-7 items-center gap-1.5 px-2.5 text-xs font-semibold text-[#13222b] whitespace-nowrap">
                    <Calendar className="h-3.5 w-3.5 text-[#2eb86b]" />
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
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] hover:bg-white hover:text-[#13222b] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {summary.isCur && (
                  <button
                    type="button"
                    onClick={() => setSelectedTextDay(summary.today)}
                    className={`h-8 rounded-xl px-3 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      curTextDay === summary.today
                        ? 'bg-[#2eb86b] text-white shadow-xs'
                        : 'bg-[#f3f7f5] text-[#475569] hover:bg-[#e1ebe7] hover:text-[#13222b]'
                    }`}
                  >
                    Hari Ini
                  </button>
                )}

                {(!summary.isCur || summary.defaultDay !== summary.today) && (
                  <button
                    type="button"
                    onClick={() => setSelectedTextDay(summary.defaultDay)}
                    className={`h-8 rounded-xl px-3 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      curTextDay === summary.defaultDay
                        ? 'bg-[#2eb86b] text-white shadow-xs'
                        : 'bg-[#f3f7f5] text-[#475569] hover:bg-[#e1ebe7] hover:text-[#13222b]'
                    }`}
                  >
                    Data Terakhir (Tgl {summary.defaultDay})
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={plainFilter}
                  onChange={(e) => setPlainFilter(e.target.value as PlainTextFilter)}
                  aria-label="Filter isi plain text"
                  className="h-8 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] outline-none transition hover:bg-[#e7efec] focus:ring-2 focus:ring-[#2eb86b] cursor-pointer"
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
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-3.5 text-xs font-semibold text-white whitespace-nowrap transition hover:bg-[#259f5b] cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Salin Text</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] whitespace-nowrap transition hover:bg-[#e1ebe7] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-[#2eb86b]" />
                  <span>Unduh TXT</span>
                </button>
              </div>
            </div>

            {isFallbackTextDay && (
              <div className="mb-3 flex shrink-0 items-center gap-2 rounded-xl bg-[#f59e0b] px-3.5 py-2 text-xs font-semibold text-white">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-white" />
                <span>
                  Hari ini belum diisi — menampilkan data terakhir Tgl {curTextDay} {monthName}.
                </span>
              </div>
            )}

            <pre className="dg-scroll font-mono-num min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#edf2f0] bg-[#f7faf9] p-4 text-[12.5px] leading-[1.65] whitespace-pre-wrap text-[#13222b] select-text">
              {plainTextContent}
            </pre>

            <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#64748b]">
                Format plain text siap dibaca dan disalin ke WhatsApp atau catatan operasional toko.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDayInInputHarian(curTextDay, 'closing')}
                  className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#e6f7ee] px-3 text-xs font-semibold text-[#15803d] transition hover:bg-[#d1f0e0] cursor-pointer"
                >
                  <span>Buka Tgl {curTextDay} di Input Harian</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Cetak Text</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ITEM MONTHLY DETAIL MODAL */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-[950] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedItemId(null);
          }}
        >
          <div className="flex max-h-[86vh] w-full max-w-[740px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#edf2f0] px-5 py-4">
              <div>
                <h2 className="font-display text-base font-bold text-[#13222b]">
                  {selectedItem.nama}
                  {!selectedItem.aktif && (
                    <span className="ml-2 rounded-md bg-[#fef3c7] px-2 py-0.5 text-[11px] font-semibold text-[#b45309]">
                      Arsip
                    </span>
                  )}
                </h2>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#64748b]">
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
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
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
                  <div className="grid shrink-0 grid-cols-2 divide-x divide-[#edf2f0] border-b border-[#edf2f0] bg-[#f7faf9] sm:grid-cols-4">
                    <div className="px-4 py-3">
                      <div className="text-[11px] font-medium text-[#64748b]">Stok Awal</div>
                      <div className="font-mono-num mt-0.5 text-[15px] font-bold text-[#13222b]">
                        {st && hasVal(st.awal) ? `${formatNum(st.awal)} ${sat}` : '–'}
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-[11px] font-medium text-[#64748b]">Total Datang</div>
                      <div className="font-mono-num mt-0.5 text-[15px] font-bold text-[#13222b]">
                        {st && st.datangDaysCount > 0 ? `+${formatNum(st.totalDatang)} ${sat}` : '–'}
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-[11px] font-medium text-[#64748b]">Total Pemakaian</div>
                      <div
                        className={`font-mono-num mt-0.5 text-[15px] font-bold ${
                          st && st.totalPemakaian < 0 ? 'text-[#dc2626]' : 'text-[#15803d]'
                        }`}
                      >
                        {st && st.pemakaianDaysCount > 0
                          ? `${formatNum(st.totalPemakaian)} ${sat}`
                          : '–'}
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-[11px] font-medium text-[#64748b]">
                        Closing Terakhir{st?.lastClosingDay ? ` (Tgl ${st.lastClosingDay})` : ''}
                      </div>
                      <div className="font-mono-num mt-0.5 text-[15px] font-bold text-[#13222b]">
                        {st && hasVal(st.lastClosing) ? `${formatNum(st.lastClosing)} ${sat}` : '–'}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#edf2f0] px-5 py-2.5 text-xs">
                    <span className="text-[#64748b]">
                      Menampilkan{' '}
                      <strong className="font-mono-num font-bold text-[#13222b]">
                        {displayRows.length}
                      </strong>{' '}
                      dari {summary.nd} tanggal
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailShowAllDays((v) => !v)}
                        className="h-7.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                      >
                        {detailShowAllDays ? 'Hari Bertransaksi Saja' : 'Tampilkan Semua Tanggal'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemId(null);
                          navigateTo('aw', { ym });
                        }}
                        className="h-7.5 rounded-xl bg-[#e6f7ee] px-3 text-xs font-semibold text-[#15803d] transition hover:bg-[#d1f0e0] cursor-pointer"
                      >
                        Stok Awal
                      </button>
                    </div>
                  </div>

                  <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-5 py-3">
                    {displayRows.length === 0 ? (
                      <div className="py-10 text-center text-xs text-[#64748b]">
                        Belum ada transaksi barang datang atau closing untuk item ini pada{' '}
                        {getMonthLabel(ym)}.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-[#c3d3cd]">
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="border-b-2 border-[#b5c7c0] bg-[#e5efec] text-[11px] font-bold uppercase tracking-[0.04em] text-[#0d2530]">
                              <th className="px-3 py-2.5 text-left">Tanggal</th>
                              <th className="px-3 py-2.5 text-right">Barang Datang</th>
                              <th className="px-3 py-2.5 text-right">Stok Siap Jual</th>
                              <th className="px-3 py-2.5 text-right">Closing Fisik</th>
                              <th className="px-3 py-2.5 text-right">Pemakaian</th>
                              <th className="px-3 py-2.5 text-right">Input Harian</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#d5e1dd]">
                            {displayRows.map((r, rowIdx) => {
                              const dow = getDayOfWeek(ym, r.d);
                              const isNeg = r.usage !== null && r.usage < 0;
                              return (
                                <tr
                                  key={r.d}
                                  className={
                                    isNeg
                                      ? 'bg-[#fef2f2]'
                                      : `${rowIdx % 2 === 1 ? 'bg-[#f6faf8]' : 'bg-white'} hover:bg-[#e7f4ed]`
                                  }
                                >
                                  <td className="px-3 py-2 font-semibold text-[#13222b] whitespace-nowrap">
                                    <span className="font-mono-num">{r.d}</span>{' '}
                                    <span className="font-medium text-[#64748b]">
                                      {DAY_NAMES[dow]}
                                    </span>
                                  </td>
                                  <td className="font-mono-num px-3 py-2 text-right text-[#13222b]">
                                    {hasVal(r.datang) ? formatNum(r.datang) : '–'}
                                  </td>
                                  <td className="font-mono-num px-3 py-2 text-right text-[#475569]">
                                    {r.total !== null ? formatNum(r.total) : '–'}
                                  </td>
                                  <td className="font-mono-num px-3 py-2 text-right font-bold text-[#13222b]">
                                    {hasVal(r.closing) ? formatNum(r.closing) : '–'}
                                  </td>
                                  <td
                                    className={`font-mono-num px-3 py-2 text-right font-bold ${
                                      isNeg ? 'text-[#dc2626]' : 'text-[#15803d]'
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
                                      className="font-semibold text-[#15803d] hover:underline cursor-pointer"
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

                  <div className="flex shrink-0 items-center justify-between border-t border-[#edf2f0] bg-[#f7faf9] px-5 py-3">
                    <span className="text-xs text-[#64748b]">
                      Seluruh angka dihitung langsung dari Stok Awal dan Input Harian.
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedItemId(null)}
                      className="h-8.5 rounded-xl bg-white px-4 text-xs font-semibold text-[#13222b] shadow-xs transition hover:bg-[#e1ebe7] cursor-pointer"
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
