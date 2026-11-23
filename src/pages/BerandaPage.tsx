import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CloudOff,
  LayoutGrid,
  MoreVertical,
  Package,
  PackagePlus,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  getDayAttendanceSummary,
  getPeriodPayrollSummary,
} from '../domain/attendanceCalculations';
import { formatNum, formatRp, getMonthLabel } from '../domain/dateUtils';
import { getOmsetMonthSummary } from '../domain/omsetCalculations';
import {
  getDayInputSummary,
  getStockDashboardSummary,
  type CurrentStockStatus,
} from '../domain/stockCalculations';

type StockFilter = 'all' | 'low' | 'zero';

const GAUGE_TICKS = 26;
const GAUGE_COLORS = [
  '#bfead0',
  '#b2e6c7',
  '#a4e2be',
  '#96deb5',
  '#88daac',
  '#7bd6a3',
  '#6ed19a',
  '#61cd91',
  '#54c988',
  '#48c57f',
  '#3dc077',
  '#34bc71',
  '#2eb86b',
  '#2bb065',
  '#28a860',
  '#25a15b',
  '#229956',
  '#209251',
  '#1d8b4d',
  '#1b8549',
  '#197f45',
  '#177941',
  '#15733e',
  '#146e3a',
  '#126937',
  '#116434',
];

export const BerandaPage: React.FC = () => {
  const {
    state,
    ym,
    curYm,
    nowDay,
    absDraft,
    dbMode,
    user,
    moveMonth,
    goToday,
    navigateTo,
    setShowLoginModal,
  } = useApp();

  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [attentionPopOpen, setAttentionPopOpen] = useState(false);
  const [emptyPopOpen, setEmptyPopOpen] = useState(false);
  const headerActionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!attentionPopOpen && !emptyPopOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (headerActionsRef.current && !headerActionsRef.current.contains(e.target as Node)) {
        setAttentionPopOpen(false);
        setEmptyPopOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAttentionPopOpen(false);
        setEmptyPopOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [attentionPopOpen, emptyPopOpen]);

  const stock = useMemo(
    () => getStockDashboardSummary(state, ym, curYm, nowDay),
    [state, ym, curYm, nowDay]
  );

  const dayInput = useMemo(
    () => getDayInputSummary(state, ym, stock.today),
    [state, ym, stock.today]
  );

  const omset = useMemo(
    () => getOmsetMonthSummary(state, ym, stock.today),
    [state, ym, stock.today]
  );

  const activeCycle = stock.today <= 15 ? 'p1' : 'p2';
  const dayAbs = useMemo(
    () => getDayAttendanceSummary(state, ym, stock.today, absDraft),
    [state, ym, stock.today, absDraft]
  );
  const periodPayroll = useMemo(
    () => getPeriodPayrollSummary(state, ym, activeCycle),
    [state, ym, activeCycle]
  );

  const stockCounts = useMemo(() => {
    let ok = 0;
    let low = 0;
    let zero = 0;
    let na = 0;
    stock.currentStocks.forEach((s) => {
      if (s.status === 'ok') ok++;
      else if (s.status === 'low') low++;
      else if (s.status === 'zero') zero++;
      else na++;
    });
    return { all: stock.currentStocks.length, ok, low, zero, na };
  }, [stock.currentStocks]);

  const filteredCurrentStocks = useMemo(() => {
    if (stockFilter === 'all') return stock.currentStocks;
    return stock.currentStocks.filter((s) => s.status === stockFilter);
  }, [stock.currentStocks, stockFilter]);

  const attentionItems = useMemo(() => {
    const list: Array<{
      id: string;
      severity: 'red' | 'amber';
      label: string;
      title: string;
      detail: string;
      onClick: () => void;
    }> = [];

    stock.emptyStockItems.forEach((s) => {
      list.push({
        id: `empty-${s.item.id}`,
        severity: 'red',
        label: 'Kosong',
        title: s.item.nama,
        detail: `0 ${s.item.sat}`,
        onClick: () => navigateTo('in', { day: stock.today, inputTab: 'datang' }),
      });
    });

    stock.lowStockItems.forEach((s) => {
      list.push({
        id: `low-${s.item.id}`,
        severity: 'amber',
        label: 'Menipis',
        title: s.item.nama,
        detail: `${formatNum(s.val)} / min ${formatNum(s.item.min)}`,
        onClick: () => navigateTo('in', { day: stock.today, inputTab: 'datang' }),
      });
    });

    stock.negativeUsageEntries.slice(0, 3).forEach((entry) => {
      list.push({
        id: `neg-${entry.day}-${entry.item.id}`,
        severity: 'red',
        label: 'Negatif',
        title: `${entry.item.nama} · Tgl ${entry.day}`,
        detail: formatNum(entry.usage),
        onClick: () => navigateTo('in', { day: entry.day, inputTab: 'closing' }),
      });
    });

    if (ym === curYm && stock.isTodayClosingIncomplete) {
      list.push({
        id: 'today-closing',
        severity: 'amber',
        label: 'Closing',
        title: `Closing stok tgl ${stock.today} belum lengkap`,
        detail: `${stock.filledClosingToday}/${stock.activeItems.length}`,
        onClick: () => navigateTo('in', { day: stock.today, inputTab: 'closing' }),
      });
    } else if (stock.missingClosingDays.length > 0) {
      const d = stock.missingClosingDays[0];
      list.push({
        id: `miss-closing-${d}`,
        severity: 'amber',
        label: 'Closing',
        title: `${stock.missingClosingDays.length} hari belum closing`,
        detail: `Tgl ${d}`,
        onClick: () => navigateTo('in', { day: d, inputTab: 'closing' }),
      });
    }

    omset.noKetDays.slice(0, 2).forEach((d) => {
      list.push({
        id: `om-noket-${d}`,
        severity: 'red',
        label: 'OMSET',
        title: `Ket. selisih tgl ${d} kosong`,
        detail: `Tgl ${d}`,
        onClick: () => navigateTo('om', { day: d, omSub: 'harian' }),
      });
    });

    if (ym === curYm && !omset.todayCalc.filled) {
      list.push({
        id: 'om-today-empty',
        severity: 'amber',
        label: 'OMSET',
        title: `OMSET tgl ${stock.today} belum diisi`,
        detail: 'Isi sekarang',
        onClick: () => navigateTo('om', { day: stock.today, omSub: 'harian' }),
      });
    }

    if (dayAbs.totalActive > 0 && (dayAbs.pendingCount > 0 || dayAbs.hasDraft)) {
      list.push({
        id: 'abs-pending',
        severity: 'amber',
        label: 'Absensi',
        title: dayAbs.hasDraft
          ? 'Draf absensi belum disimpan'
          : `Absensi tgl ${stock.today} belum disimpan`,
        detail: `${dayAbs.savedCount}/${dayAbs.totalActive}`,
        onClick: () => navigateTo('ab', { day: stock.today, abSub: 'harian' }),
      });
    }

    return list;
  }, [stock, omset, dayAbs, ym, curYm, navigateTo]);

  const hasRedAttention = useMemo(
    () => attentionItems.some((item) => item.severity === 'red'),
    [attentionItems]
  );

  const statusBarFill: Record<CurrentStockStatus, string> = {
    ok: 'bg-[#2eb86b]',
    low: 'bg-[#f59e0b]',
    zero: 'bg-[#ef4444]',
    na: 'bg-[#cbd5d1]',
  };

  const statusTextTone: Record<CurrentStockStatus, string> = {
    ok: 'text-[#13222b]',
    low: 'text-[#b45309]',
    zero: 'text-[#b91c1c]',
    na: 'text-[#64748b]',
  };

  const chartMaxVal = useMemo(() => {
    let max = 0;
    filteredCurrentStocks.forEach((entry) => {
      if (entry.val !== null && entry.val > max) max = entry.val;
    });
    return max > 0 ? max : 1;
  }, [filteredCurrentStocks]);

  const hasAnyStockData = useMemo(
    () => stock.currentStocks.some((entry) => entry.val !== null),
    [stock.currentStocks]
  );

  const totalActive = stock.activeItems.length;
  const closingPct =
    totalActive > 0 ? Math.min(100, Math.round((stock.filledClosingToday / totalActive) * 100)) : 0;
  const datangPct =
    totalActive > 0 ? Math.min(100, Math.round((stock.filledDatangToday / totalActive) * 100)) : 0;
  const omsetGross = omset.omsetBersih + omset.totalPengeluaran;
  const expenseRatioPct =
    omsetGross > 0
      ? Math.min(100, Math.round((omset.totalPengeluaran / omsetGross) * 100))
      : omset.totalPengeluaran > 0
        ? 100
        : 0;

  const readinessScore =
    !hasAnyStockData || totalActive === 0
      ? 0
      : Math.round((stockCounts.ok / totalActive) * 100);
  const activeGaugeTicks = Math.round((readinessScore / 100) * GAUGE_TICKS);

  const readinessHeadline = !hasAnyStockData
    ? 'Belum ada data'
    : readinessScore >= 80
      ? 'Sangat Baik!'
      : readinessScore >= 50
        ? 'Perlu Pantau'
        : 'Butuh Restock';

  const greetingName = (user?.nama || user?.username || 'Admin').split(' ')[0];

  return (
    <div className="dg-page">
      {/* STICKY FLOATING TOP WHITE BAR (Sample Style) */}
      <div className="dg-sticky-header no-print px-4 pt-3 pb-1 md:px-6">
        <header className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-[0_6px_22px_rgba(13,37,48,0.045)] md:px-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center rounded-xl bg-[#f3f7f5] p-0.5">
                <button
                  type="button"
                  onClick={() => moveMonth(-1)}
                  aria-label="Bulan sebelumnya"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[124px] px-2 text-center text-[13.5px] font-bold text-[#13222b] whitespace-nowrap">
                  {getMonthLabel(ym)}
                </span>
                <button
                  type="button"
                  onClick={() => moveMonth(1)}
                  aria-label="Bulan berikutnya"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {ym !== curYm && (
                <button
                  type="button"
                  onClick={goToday}
                  className="h-8.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e4ece8] whitespace-nowrap cursor-pointer"
                >
                  Bulan Ini
                </button>
              )}

              {stock.isMonthEmpty && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setEmptyPopOpen((v) => !v);
                      setAttentionPopOpen(false);
                    }}
                    aria-expanded={emptyPopOpen}
                    className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#f59e0b] px-3 text-xs font-semibold text-white transition hover:bg-[#d97706] whitespace-nowrap cursor-pointer"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Bulan ini kosong</span>
                  </button>
                  {emptyPopOpen && (
                    <div className="absolute left-0 z-30 mt-2 w-[290px] max-w-[calc(100vw-32px)] rounded-2xl bg-white p-4 shadow-[0_16px_40px_rgba(13,37,48,0.16)]">
                      <p className="font-display text-sm font-bold text-[#13222b]">
                        Belum ada data {getMonthLabel(ym)}
                      </p>
                      <p className="mt-1.5 mb-3.5 text-xs leading-relaxed text-[#64748b]">
                        Mulai dengan mengisi Stok Awal bulan ini agar stok terkini dapat dihitung.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEmptyPopOpen(false);
                            navigateTo('aw');
                          }}
                          className="h-8 rounded-lg bg-[#2eb86b] px-3.5 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                        >
                          Isi Stok Awal
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmptyPopOpen(false)}
                          className="h-8 rounded-lg px-2.5 text-xs font-semibold text-[#64748b] hover:bg-[#f3f7f5] cursor-pointer"
                        >
                          Tutup
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Utility Controls (Sample Icons + Notification Bell) */}
            <div ref={headerActionsRef} className="flex items-center gap-1.5">
              {dbMode === 'cloud_unauth' && (
                <button
                  type="button"
                  onClick={() => setShowLoginModal(true)}
                  className="mr-1 inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#b45309] px-3 text-xs font-semibold text-white transition hover:bg-[#92400e] whitespace-nowrap cursor-pointer"
                >
                  <CloudOff className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Login Cloud</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => navigateTo('aw')}
                title="Stok Awal"
                aria-label="Stok Awal"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#475569] transition hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
              >
                <Package className="h-[18px] w-[18px]" />
              </button>

              <button
                type="button"
                onClick={() => navigateTo('tb')}
                title="Tabel Bulanan"
                aria-label="Tabel Bulanan"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#475569] transition hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
              >
                <LayoutGrid className="h-[18px] w-[18px]" />
              </button>

              {/* Notification Bell with Solid Badge (Sample Top-Right) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setAttentionPopOpen((v) => !v);
                    setEmptyPopOpen(false);
                  }}
                  aria-expanded={attentionPopOpen}
                  aria-label="Peringatan operasional"
                  title={
                    attentionItems.length > 0
                      ? `${attentionItems.length} peringatan perlu perhatian`
                      : 'Semua operasional aman'
                  }
                  className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[#475569] transition hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
                >
                  <Bell className="h-[19px] w-[19px]" />
                  {attentionItems.length > 0 && (
                    <span
                      className={`font-mono-num absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
                        hasRedAttention ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'
                      }`}
                    >
                      {attentionItems.length}
                    </span>
                  )}
                </button>

                {attentionPopOpen && (
                  <div className="absolute right-0 z-30 mt-2 w-[360px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl bg-white shadow-[0_18px_42px_rgba(13,37,48,0.16)]">
                    <div className="flex items-center justify-between gap-2 border-b border-[#e2ebe7] bg-[#f7faf9] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-sm font-bold text-[#13222b]">
                          Perlu Perhatian
                        </h2>
                        <span
                          className={`font-mono-num text-xs font-bold ${
                            attentionItems.length > 0
                              ? hasRedAttention
                                ? 'text-[#ef4444]'
                                : 'text-[#d97706]'
                              : 'text-[#2eb86b]'
                          }`}
                        >
                          {attentionItems.length > 0 ? `${attentionItems.length} item` : 'Aman'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttentionPopOpen(false)}
                        aria-label="Tutup daftar peringatan"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#64748b] transition hover:bg-[#e8f0ed] hover:text-[#13222b] cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {attentionItems.length === 0 ? (
                      <div className="flex items-center gap-2.5 px-4 py-5 text-xs font-semibold text-[#15803d]">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2eb86b]" />
                        <span>Semua operasional tgl {stock.today} berjalan normal.</span>
                      </div>
                    ) : (
                      <div className="dg-scroll max-h-[380px] divide-y divide-[#edf2f0] overflow-y-auto">
                        {attentionItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setAttentionPopOpen(false);
                              item.onClick();
                            }}
                            className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#f7faf9] cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[11px] font-bold ${
                                    item.severity === 'red' ? 'text-[#ef4444]' : 'text-[#d97706]'
                                  }`}
                                >
                                  {item.label}
                                </span>
                                <span className="text-[#cbd5d1]">·</span>
                                <span className="font-mono-num text-[11px] font-semibold text-[#64748b]">
                                  {item.detail}
                                </span>
                              </div>
                              <div className="mt-0.5 truncate text-[12.5px] font-bold text-[#13222b] group-hover:text-[#14533c]">
                                {item.title}
                              </div>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#94a3b8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#2eb86b]" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>
      </div>

      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4 md:px-6 md:pt-3 md:pb-5">
        <div className="mx-auto max-w-[1380px] space-y-4">

          {/* ROW 1: 4 FLOATING KPI CARDS (Sample Top Grid) */}
          <section
            aria-label="Ringkasan utama"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {/* Card 1: Greeting + Omset Bersih + Primary Green CTA */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="relative z-10 pr-12">
                <h1 className="font-display text-[16px] font-bold text-[#13222b]">
                  Halo, {greetingName}!
                </h1>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  Omset bersih {getMonthLabel(ym)}
                </p>

                <div className="font-mono-num mt-3.5 text-[24px] leading-tight font-bold text-[#2eb86b]">
                  {omset.filledDays > 0 ? formatRp(omset.omsetBersih) : 'Rp 0'}
                </div>
                <p className="mt-1 text-[11.5px] text-[#64748b]">
                  {omset.filledDays}/{omset.totalDays} hari tercatat
                </p>

                <button
                  type="button"
                  onClick={() => navigateTo('in', { day: stock.today, inputTab: 'closing' })}
                  className="mt-4 inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                >
                  <span>Mulai Closing</span>
                </button>
              </div>

              {/* Minimal Architectural Golf Flag & Trend Accent */}
              <svg
                aria-hidden="true"
                viewBox="0 0 96 112"
                className="pointer-events-none absolute right-2 bottom-2 h-24 w-20"
              >
                <rect x="14" y="68" width="12" height="32" rx="4" fill="#e6f7ee" />
                <rect x="34" y="50" width="12" height="50" rx="4" fill="#c7f0da" />
                <rect x="54" y="34" width="12" height="66" rx="4" fill="#2eb86b" />
                <path
                  d="M72 16V98"
                  stroke="#0d2530"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path d="M72 18L92 26L72 34Z" fill="#2eb86b" />
                <ellipse cx="72" cy="100" rx="14" ry="4" fill="#dceae3" />
              </svg>
            </div>

            {/* Card 2: Closing Stok */}
            <button
              type="button"
              onClick={() => navigateTo('in', { day: stock.today, inputTab: 'closing' })}
              className="group flex flex-col justify-between rounded-2xl bg-white p-5 text-left shadow-[0_6px_24px_rgba(13,37,48,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(13,37,48,0.08)] cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1f6f4] text-[#475569]">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                  <span className="text-[13.5px] font-medium text-[#64748b]">Closing Stok</span>
                </div>
                <MoreVertical className="h-4 w-4 text-[#94a3b8] group-hover:text-[#13222b]" />
              </div>

              <div className="mt-4 flex items-center gap-2.5">
                <span className="font-mono-num text-[26px] leading-none font-bold text-[#13222b]">
                  {stock.filledClosingToday}/{totalActive}
                </span>
                <span className="rounded-md bg-[#e6f7ee] px-2 py-0.5 text-[11px] font-bold text-[#15803d]">
                  Tgl {stock.today}
                </span>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 text-[11.5px] font-medium text-[#94a3b8]">Progres</div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e6eeea]">
                    <div
                      className="h-full rounded-full bg-[#2eb86b] transition-all duration-300"
                      style={{ width: `${closingPct}%` }}
                    />
                  </div>
                  <span className="font-mono-num text-xs font-bold text-[#475569]">
                    {closingPct}%
                  </span>
                </div>
              </div>
            </button>

            {/* Card 3: Barang Datang */}
            <button
              type="button"
              onClick={() => navigateTo('in', { day: stock.today, inputTab: 'datang' })}
              className="group flex flex-col justify-between rounded-2xl bg-white p-5 text-left shadow-[0_6px_24px_rgba(13,37,48,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(13,37,48,0.08)] cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1f6f4] text-[#475569]">
                    <PackagePlus className="h-5 w-5" />
                  </div>
                  <span className="text-[13.5px] font-medium text-[#64748b]">Barang Datang</span>
                </div>
                <MoreVertical className="h-4 w-4 text-[#94a3b8] group-hover:text-[#13222b]" />
              </div>

              <div className="mt-4 flex items-center gap-2.5">
                <span className="font-mono-num text-[26px] leading-none font-bold text-[#13222b]">
                  {formatNum(dayInput.totalDatangDay)}
                </span>
                <span className="rounded-md bg-[#e6f7ee] px-2 py-0.5 text-[11px] font-bold text-[#15803d]">
                  {stock.filledDatangToday} item
                </span>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 text-[11.5px] font-medium text-[#94a3b8]">Cakupan item</div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e6eeea]">
                    <div
                      className="h-full rounded-full bg-[#2eb86b] transition-all duration-300"
                      style={{ width: `${datangPct}%` }}
                    />
                  </div>
                  <span className="font-mono-num text-xs font-bold text-[#475569]">
                    {datangPct}%
                  </span>
                </div>
              </div>
            </button>

            {/* Card 4: Pengeluaran */}
            <button
              type="button"
              onClick={() => navigateTo('om', { day: stock.today, omSub: 'pengeluaran' })}
              className="group flex flex-col justify-between rounded-2xl bg-white p-5 text-left shadow-[0_6px_24px_rgba(13,37,48,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(13,37,48,0.08)] cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1f6f4] text-[#475569]">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <span className="text-[13.5px] font-medium text-[#64748b]">Pengeluaran</span>
                </div>
                <MoreVertical className="h-4 w-4 text-[#94a3b8] group-hover:text-[#13222b]" />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="font-mono-num truncate text-[22px] leading-none font-bold text-[#13222b]">
                  {omset.totalPengeluaran > 0 ? formatRp(omset.totalPengeluaran) : 'Rp 0'}
                </span>
                {expenseRatioPct > 0 && (
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                      expenseRatioPct > 60
                        ? 'bg-[#fee2e2] text-[#b91c1c]'
                        : 'bg-[#fef3c7] text-[#b45309]'
                    }`}
                  >
                    {expenseRatioPct}%
                  </span>
                )}
              </div>

              <div className="mt-4">
                <div className="mb-1.5 text-[11.5px] font-medium text-[#94a3b8]">Rasio omset</div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e6eeea]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        expenseRatioPct > 60 ? 'bg-[#ef4444]' : 'bg-[#2eb86b]'
                      }`}
                      style={{ width: `${expenseRatioPct}%` }}
                    />
                  </div>
                  <span className="font-mono-num text-xs font-bold text-[#475569]">
                    {expenseRatioPct}%
                  </span>
                </div>
              </div>
            </button>
          </section>

          {/* ROW 2: RADIAL GAUGE CARD + OPERATIONAL SUMMARY CARD (Sample Middle Split) */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr] xl:grid-cols-[350px_1fr]">
            {/* Left Card: Segmented Radial Stock Readiness Gauge */}
            <div className="flex flex-col items-center justify-between rounded-2xl bg-white p-6 text-center shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="text-sm text-[#64748b]">
                Kesiapan stok{' '}
                <strong className="font-display text-[17px] font-bold text-[#13222b]">
                  {readinessHeadline}
                </strong>
              </div>

              {/* 26-Tick Segmented Radial Gauge SVG */}
              <div className="relative my-2 flex items-center justify-center">
                <svg viewBox="0 0 200 176" className="h-[168px] w-[196px]">
                  {Array.from({ length: GAUGE_TICKS }).map((_, i) => {
                    const angleDeg = 140 + (i / (GAUGE_TICKS - 1)) * 260;
                    const rad = (angleDeg * Math.PI) / 180;
                    const x1 = 100 + 62 * Math.cos(rad);
                    const y1 = 100 + 62 * Math.sin(rad);
                    const x2 = 100 + 82 * Math.cos(rad);
                    const y2 = 100 + 82 * Math.sin(rad);
                    const isActive = i < activeGaugeTicks;
                    return (
                      <line
                        key={i}
                        x1={x1.toFixed(2)}
                        y1={y1.toFixed(2)}
                        x2={x2.toFixed(2)}
                        y2={y2.toFixed(2)}
                        stroke={isActive ? GAUGE_COLORS[i] : '#e4ece8'}
                        strokeWidth="5"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                  <span className="font-mono-num text-[38px] leading-none font-bold text-[#13222b]">
                    {readinessScore}
                  </span>
                  <span className="mt-1 text-xs font-medium text-[#94a3b8]">dari 100</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-[#64748b]">
                  Berdasarkan <strong className="text-[#13222b]">{totalActive} item aktif</strong>
                </p>
                <p className="font-mono-num text-[11.5px] font-semibold text-[#475569]">
                  {stockCounts.ok} Aman · {stockCounts.low} Menipis · {stockCounts.zero} Kosong
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigateTo('in', { day: stock.today, inputTab: 'datang' })}
                className="mt-5 w-full rounded-xl bg-[#2eb86b] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#259f5b] cursor-pointer"
              >
                Input Barang Datang
              </button>
            </div>

            {/* Right Card: Ringkasan Operasional & Keuangan (Sample Finance Summary Style) */}
            <div className="flex flex-col justify-between rounded-2xl bg-white p-6 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e6f7ee] text-[#2eb86b]">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-[17px] font-bold text-[#13222b]">
                    Ringkasan Operasional
                  </h2>
                  <p className="text-xs text-[#64748b]">
                    Ikhtisar stok, keuangan, dan SDM bulan {getMonthLabel(ym)}
                  </p>
                </div>
              </div>

              <div className="my-6 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-[#64748b]">Pemakaian Tgl {stock.today}</div>
                  <div className="font-mono-num mt-1 text-[17px] font-bold text-[#13222b]">
                    {dayInput.hasAnyPemakaian ? `${formatNum(dayInput.totalPemakaianDay)} unit` : '–'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[#64748b]">
                    Gaji Periode {activeCycle === 'p1' ? '1 (1–15)' : '2 (16–Akhir)'}
                  </div>
                  <div className="font-mono-num mt-1 text-[17px] font-bold text-[#13222b]">
                    {periodPayroll.totalGaji > 0 ? formatRp(periodPayroll.totalGaji) : '–'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[#64748b]">Absensi Tgl {stock.today}</div>
                  <div className="font-mono-num mt-1 text-[17px] font-bold text-[#13222b]">
                    {dayAbs.savedCount > 0 ? (
                      `${dayAbs.hadir}/${dayAbs.totalActive} Hadir`
                    ) : (
                      <span className="text-[#d97706]">Belum diisi</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[#64748b]">Stok Perlu Restock</div>
                  <div className="font-mono-num mt-1 text-[17px] font-bold text-[#13222b]">
                    {stockCounts.low + stockCounts.zero > 0 ? (
                      <span className={stockCounts.zero > 0 ? 'text-[#ef4444]' : 'text-[#d97706]'}>
                        {stockCounts.low + stockCounts.zero} item
                      </span>
                    ) : (
                      <span className="text-[#2eb86b]">Semua Aman</span>
                    )}
                  </div>
                </div>

                {/* Striped Emerald Progress Bar (Sample Satisfaction Rate Bar) */}
                <div className="sm:col-span-2">
                  <div className="text-xs text-[#64748b]">Kelengkapan Closing Harian</div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#e6eeea]">
                      <div
                        className="dg-striped-bar h-full rounded-full transition-all duration-300"
                        style={{ width: `${closingPct}%` }}
                      />
                    </div>
                    <span className="font-mono-num text-sm font-bold text-[#13222b]">
                      {closingPct}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf2f0] pt-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-[#e6f7ee] px-2.5 py-1 font-semibold text-[#15803d]">
                    Aman {stockCounts.ok}
                  </span>
                  {stockCounts.low > 0 && (
                    <span className="rounded-md bg-[#fef3c7] px-2.5 py-1 font-semibold text-[#b45309]">
                      Menipis {stockCounts.low}
                    </span>
                  )}
                  {stockCounts.zero > 0 && (
                    <span className="rounded-md bg-[#fee2e2] px-2.5 py-1 font-semibold text-[#b91c1c]">
                      Kosong {stockCounts.zero}
                    </span>
                  )}
                  <span className="font-mono-num text-[11.5px] font-medium text-[#64748b]">
                    · Tgl {stock.today} {getMonthLabel(ym)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => navigateTo('lp')}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                >
                  <span>Lihat Laporan</span>
                </button>
              </div>
            </div>
          </section>

          {/* ROW 3: FULL-WIDTH STOK TERKINI SOLID VERTICAL BAR CHART */}
          <section
            id="stok-terkini-section"
            className="rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f0] px-5 py-4">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-[16px] font-bold text-[#13222b]">
                  Stok Terkini — Tgl {stock.today}
                </h2>
                <button
                  type="button"
                  onClick={() => navigateTo('tb')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#2eb86b] hover:underline whitespace-nowrap cursor-pointer"
                >
                  <span>Tabel Bulanan</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as StockFilter)}
                aria-label="Filter status stok terkini"
                className="h-8.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] outline-none focus:ring-2 focus:ring-[#2eb86b] cursor-pointer"
              >
                <option value="all">Semua ({stockCounts.all})</option>
                <option value="low">Menipis ({stockCounts.low})</option>
                <option value="zero">Kosong ({stockCounts.zero})</option>
              </select>
            </div>

            <div className="px-5 py-4">
              {filteredCurrentStocks.length === 0 ? (
                <div className="py-10 text-center text-xs font-medium text-[#64748b]">
                  Tidak ada item pada filter ini.{' '}
                  {stockFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setStockFilter('all')}
                      className="font-bold text-[#2eb86b] hover:underline cursor-pointer"
                    >
                      Lihat semua
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {!hasAnyStockData && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f3f7f5] px-4 py-2.5 text-xs font-medium text-[#475569]">
                      <span>
                        Belum ada data stok pada {getMonthLabel(ym)} — batang grafik akan naik
                        otomatis setelah Stok Awal atau Input Harian diisi.
                      </span>
                      <button
                        type="button"
                        onClick={() => navigateTo('aw')}
                        className="shrink-0 rounded-lg bg-[#2eb86b] px-3 py-1.5 text-[11.5px] font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                      >
                        Isi Stok Awal
                      </button>
                    </div>
                  )}

                  <div className="dg-scroll overflow-x-auto pb-2">
                    <div className="relative flex min-w-max items-end gap-1.5 pt-2">
                      {/* Horizontal background guide lines behind bars */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute right-0 left-0 top-2 flex h-[196px] flex-col justify-between"
                      >
                        <div className="border-t border-dashed border-[#e4ece8]" />
                        <div className="border-t border-dashed border-[#e4ece8]" />
                        <div className="border-t border-dashed border-[#e4ece8]" />
                        <div className="border-b border-[#cfd8d4]" />
                      </div>

                      {filteredCurrentStocks.map((entry) => {
                        const tooltipDetail =
                          entry.base === null
                            ? 'Belum diisi'
                            : `${entry.from} ${formatNum(entry.base)}${
                                entry.datang ? ` + ${formatNum(entry.datang)}` : ''
                              }`;
                        const valNum = entry.val ?? 0;
                        const maxBarPx = 166;
                        const barPx =
                          entry.val === null
                            ? 0
                            : entry.val <= 0
                              ? 0
                              : Math.max(14, Math.round((valNum / chartMaxVal) * maxBarPx));

                        return (
                          <button
                            key={entry.item.id}
                            type="button"
                            onClick={() =>
                              navigateTo('in', {
                                day: stock.today,
                                inputTab:
                                  entry.status === 'low' || entry.status === 'zero'
                                    ? 'datang'
                                    : 'closing',
                              })
                            }
                            title={`${entry.item.kat} · ${entry.item.nama}: ${
                              entry.val === null
                                ? 'belum ada data'
                                : `${formatNum(entry.val)} ${entry.item.sat}`
                            }${entry.item.min > 0 ? ` · Min ${formatNum(entry.item.min)}` : ''} (${tooltipDetail})`}
                            className="group relative z-10 flex min-w-[64px] flex-1 flex-col items-center rounded-xl px-1 pt-0 pb-1.5 transition hover:bg-[#f3f7f5] cursor-pointer"
                          >
                            {/* Vertical Solid Bar + Nominal at Tip */}
                            <div className="relative flex h-[196px] w-full flex-col items-center justify-end">
                              <span
                                className={`font-mono-num mb-1.5 text-[11.5px] leading-none font-bold whitespace-nowrap ${statusTextTone[entry.status]}`}
                              >
                                {entry.val === null ? '–' : formatNum(entry.val)}
                              </span>

                              {entry.val !== null && entry.val > 0 ? (
                                <div
                                  className={`w-8 rounded-t-lg transition-all duration-300 sm:w-9 ${statusBarFill[entry.status]}`}
                                  style={{ height: `${barPx}px` }}
                                />
                              ) : entry.status === 'zero' ? (
                                <div className="h-3 w-8 rounded-t-md bg-[#ef4444] sm:w-9" />
                              ) : (
                                <div className="h-2.5 w-8 rounded-t-sm bg-[#cbd5d1] sm:w-9" />
                              )}
                            </div>

                            {/* Item Name & Unit below baseline */}
                            <div className="mt-2 flex min-h-[44px] w-full flex-col items-center justify-start text-center">
                              <span className="line-clamp-2 text-[11px] leading-[1.25] font-bold text-[#13222b] group-hover:text-[#14533c]">
                                {entry.item.nama}
                              </span>
                              <span className="mt-0.5 text-[10px] leading-none font-medium text-[#64748b]">
                                {entry.item.sat || 'pcs'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-[#edf2f0] pt-3 text-[11.5px] font-semibold text-[#475569]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-xs bg-[#2eb86b]" />
                      Aman
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-xs bg-[#f59e0b]" />
                      Menipis
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-xs bg-[#ef4444]" />
                      Kosong
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-xs bg-[#cbd5d1]" />
                      Belum ada
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
