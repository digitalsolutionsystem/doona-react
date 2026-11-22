import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  FileText,
  HardDrive,
  Lock,
  Package,
  PenLine,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  getDayAttendanceSummary,
  getPeriodPayrollSummary,
} from '../domain/attendanceCalculations';
import {
  formatNum,
  formatRp,
  getMonthLabel,
} from '../domain/dateUtils';
import {
  formatSignedRp,
  getOmsetMonthSummary,
  getPeriodOfDay,
} from '../domain/omsetCalculations';
import {
  getStockDashboardSummary,
  type CurrentStockStatus,
} from '../domain/stockCalculations';

type StockFilter = 'all' | 'low' | 'zero' | 'na';

export const BerandaPage: React.FC = () => {
  const {
    state,
    ym,
    curYm,
    nowDay,
    absDraft,
    dbMode,
    user,
    isViewer,
    sync,
    moveMonth,
    goToday,
    navigateTo,
    setShowLoginModal,
    reloadFromCloud,
  } = useApp();

  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [emptyPopOpen, setEmptyPopOpen] = useState(false);

  // Semua angka diambil langsung dari modul perhitungan sumber (Single Source of Truth)
  const stock = useMemo(
    () => getStockDashboardSummary(state, ym, curYm, nowDay),
    [state, ym, curYm, nowDay]
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
  const monthPayroll = useMemo(
    () => getPeriodPayrollSummary(state, ym, 'full'),
    [state, ym]
  );

  const maxDailyUsage = Math.max(1, ...stock.dailyUsageSeries);
  const topMax = stock.topUsageItems[0]?.totalUsage || 1;
  const activePeriodNum = getPeriodOfDay(stock.today);

  const filteredCurrentStocks = useMemo(() => {
    if (stockFilter === 'all') return stock.currentStocks;
    return stock.currentStocks.filter((s) => s.status === stockFilter);
  }, [stock.currentStocks, stockFilter]);

  const stockCounts = useMemo(() => {
    let low = 0;
    let zero = 0;
    let na = 0;
    stock.currentStocks.forEach((s) => {
      if (s.status === 'low') low++;
      else if (s.status === 'zero') zero++;
      else if (s.status === 'na') na++;
    });
    return { all: stock.currentStocks.length, low, zero, na };
  }, [stock.currentStocks]);

  // Daftar item perhatian lintas modul (Stok, Closing, OMSET, Absensi)
  const attentionItems = useMemo(() => {
    const list: Array<{
      id: string;
      severity: 'red' | 'amber';
      domain: string;
      title: string;
      metric: string;
      actionLabel: string;
      onClick: () => void;
    }> = [];

    stock.emptyStockItems.forEach((s) => {
      list.push({
        id: `empty-${s.item.id}`,
        severity: 'red',
        domain: 'Stok Kosong',
        title: s.item.nama,
        metric: `${formatNum(s.val)} ${s.item.sat}`,
        actionLabel: 'Input Datang',
        onClick: () => navigateTo('in', { day: stock.today, inputTab: 'datang' }),
      });
    });

    stock.lowStockItems.forEach((s) => {
      list.push({
        id: `low-${s.item.id}`,
        severity: 'amber',
        domain: 'Stok Menipis',
        title: s.item.nama,
        metric: `${formatNum(s.val)} / min ${formatNum(s.item.min)}`,
        actionLabel: 'Input Harian',
        onClick: () => navigateTo('in', { day: stock.today, inputTab: 'datang' }),
      });
    });

    stock.negativeUsageEntries.slice(0, 4).forEach((entry) => {
      list.push({
        id: `neg-${entry.day}-${entry.item.id}`,
        severity: 'red',
        domain: 'Pemakaian Negatif',
        title: `${entry.item.nama} · Tgl ${entry.day}`,
        metric: formatNum(entry.usage),
        actionLabel: 'Periksa',
        onClick: () => navigateTo('in', { day: entry.day, inputTab: 'closing' }),
      });
    });

    stock.missingClosingDays.slice(0, 4).forEach((d) => {
      list.push({
        id: `miss-closing-${d}`,
        severity: 'amber',
        domain: 'Closing Stok',
        title: `Closing tgl ${d} belum diisi`,
        metric: `Tgl ${d}`,
        actionLabel: 'Isi Closing',
        onClick: () => navigateTo('in', { day: d, inputTab: 'closing' }),
      });
    });

    if (
      ym === curYm &&
      stock.isTodayClosingIncomplete &&
      !stock.missingClosingDays.includes(stock.today)
    ) {
      list.push({
        id: 'today-closing',
        severity: 'amber',
        domain: 'Closing Hari Ini',
        title: `Closing stok tgl ${stock.today} belum lengkap`,
        metric: `${stock.filledClosingToday}/${stock.activeItems.length}`,
        actionLabel: 'Lanjutkan',
        onClick: () => navigateTo('in', { day: stock.today, inputTab: 'closing' }),
      });
    }

    omset.noKetDays.slice(0, 3).forEach((d) => {
      list.push({
        id: `om-noket-${d}`,
        severity: 'red',
        domain: 'OMSET Selisih',
        title: `Keterangan selisih tgl ${d} belum diisi`,
        metric: `Tgl ${d}`,
        actionLabel: 'Buka OMSET',
        onClick: () => navigateTo('om', { day: d, omSub: 'harian' }),
      });
    });

    if (ym === curYm && !omset.todayCalc.filled) {
      list.push({
        id: 'om-today-empty',
        severity: 'amber',
        domain: 'OMSET Harian',
        title: `Input OMSET tgl ${stock.today} belum diisi`,
        metric: 'Belum diisi',
        actionLabel: 'Buka OMSET',
        onClick: () => navigateTo('om', { day: stock.today, omSub: 'harian' }),
      });
    }

    if (dayAbs.totalActive > 0 && (dayAbs.pendingCount > 0 || dayAbs.hasDraft)) {
      list.push({
        id: 'abs-pending',
        severity: 'amber',
        domain: 'Absensi',
        title: dayAbs.hasDraft
          ? 'Ada draf absensi belum disimpan ke database'
          : `Absensi tgl ${stock.today} belum tersimpan`,
        metric: `${dayAbs.savedCount}/${dayAbs.totalActive}`,
        actionLabel: 'Buka Absensi',
        onClick: () => navigateTo('ab', { day: stock.today, abSub: 'harian' }),
      });
    }

    return list;
  }, [stock, omset, dayAbs, ym, curYm, navigateTo]);

  const dbMeta = useMemo(() => {
    switch (dbMode) {
      case 'gas':
        return {
          title: 'Google Apps Script (Internal)',
          sub: 'Terhubung langsung ke Spreadsheet aktif',
          tone: 'text-[#15803d]',
          icon: Cloud,
        };
      case 'cloud_connected':
        return {
          title: 'Terhubung ke Google Sheets',
          sub: sync.lastSyncAt ? `Sinkron terakhir pukul ${sync.lastSyncAt}` : sync.text,
          tone: 'text-[#15803d]',
          icon: Cloud,
        };
      case 'cloud_unauth':
        return {
          title: 'Cloud Terkonfigurasi · Belum Login',
          sub: 'Membaca cache lokal; login untuk sinkron Google Sheets',
          tone: 'text-[#b45309]',
          icon: CloudOff,
        };
      default:
        return {
          title: 'Mode Lokal (Browser)',
          sub: 'Data disimpan di localStorage perangkat ini',
          tone: 'text-[#565e59]',
          icon: HardDrive,
        };
    }
  }, [dbMode, sync]);

  const DbIcon = dbMeta.icon;

  const statusTileSurface: Record<CurrentStockStatus, string> = {
    ok: 'border-[#e5e5df] bg-white hover:border-[#14533c]/40',
    low: 'border-[#f3d692] bg-[#fffcf2] hover:border-[#d97706]',
    zero: 'border-[#f5b8b8] bg-[#fff7f7] hover:border-[#b91c1c]',
    na: 'border-[#e5e5df] bg-[#fafaf8] hover:border-[#c8c8be]',
  };

  const statusTextTone: Record<CurrentStockStatus, string> = {
    ok: 'text-[#15803d]',
    low: 'text-[#b45309]',
    zero: 'text-[#b91c1c]',
    na: 'text-[#7c8580]',
  };

  const statusTextLabel: Record<CurrentStockStatus, string> = {
    ok: 'Aman',
    low: 'Menipis',
    zero: 'Kosong',
    na: 'Belum ada',
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f7f4]">
      {/* TOP BAR */}
      <header className="shrink-0 border-b border-[#e5e5df] bg-white px-5 py-3.5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="font-display text-lg font-semibold text-[#141816] whitespace-nowrap">
              Beranda
            </h1>

            <div className="inline-flex items-center rounded-lg border border-[#e5e5df] bg-[#fafaf8] p-0.5">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                aria-label="Bulan sebelumnya"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#565e59] transition hover:bg-white hover:text-[#141816] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[126px] px-2 text-center text-[13px] font-medium text-[#141816] whitespace-nowrap">
                {getMonthLabel(ym)}
              </span>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                aria-label="Bulan berikutnya"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#565e59] transition hover:bg-white hover:text-[#141816] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {ym !== curYm && (
              <button
                type="button"
                onClick={goToday}
                className="h-8 rounded-md border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#141816] transition hover:bg-[#f3f3ee] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Bulan Ini
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {stock.isMonthEmpty && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setEmptyPopOpen((v) => !v)}
                  aria-expanded={emptyPopOpen}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-md border border-[#f3d692] bg-[#fffcf2] px-3 text-xs font-medium text-[#92400e] transition hover:bg-[#fef6dc] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-[#b45309]" />
                  <span>Data bulan ini kosong</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${emptyPopOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {emptyPopOpen && (
                  <div className="absolute right-0 z-30 mt-2 w-[300px] max-w-[calc(100vw-32px)] rounded-xl border border-[#e5e5df] bg-white p-4 shadow-[0_14px_34px_rgba(17,22,20,0.12)]">
                    <p className="font-display text-sm font-semibold text-[#141816]">
                      Belum ada data {getMonthLabel(ym)}
                    </p>
                    <p className="mt-1.5 mb-3.5 text-xs leading-relaxed text-[#565e59]">
                      Stok awal dan closing bulan ini belum diisi, jadi stok terkini dan pemakaian
                      belum bisa dihitung. Mulai dari Stok Awal atau login Google Sheets.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEmptyPopOpen(false);
                          navigateTo('aw');
                        }}
                        className="h-8 rounded-md bg-[#14533c] px-3 text-xs font-medium text-white transition hover:bg-[#0f3f2d] cursor-pointer"
                      >
                        Isi Stok Awal
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmptyPopOpen(false)}
                        className="h-8 rounded-md px-2.5 text-xs font-medium text-[#565e59] hover:bg-[#f3f3ee] cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => navigateTo('in', { day: stock.today, inputTab: 'datang' })}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] transition hover:bg-[#f3f3ee] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Package className="h-3.5 w-3.5 text-[#565e59]" />
              <span>Barang Datang</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('aw')}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] transition hover:bg-[#f3f3ee] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PenLine className="h-3.5 w-3.5 text-[#565e59]" />
              <span>Stok Awal</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('lp')}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] transition hover:bg-[#f3f3ee] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 text-[#565e59]" />
              <span>Laporan</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('in', { day: stock.today, inputTab: 'closing' })}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-[#14533c] px-3.5 text-xs font-medium text-white transition hover:bg-[#0f3f2d] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Mulai Closing</span>
            </button>
          </div>
        </div>
      </header>

      {/* SCROLLABLE WORKSPACE BODY */}
      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
        <div className="mx-auto max-w-[1440px] space-y-5">
          {/* SECTION 1: UNIFIED ARCHITECTURAL KPI LEDGER STRIP */}
          <section
            aria-label="Ringkasan operasional hari ini"
            className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#e5e5df] bg-white sm:grid-cols-3 lg:grid-cols-6 divide-y divide-[#efefea] sm:divide-y-0 sm:divide-x"
          >
            <button
              type="button"
              onClick={() => navigateTo('in', { day: stock.today, inputTab: 'datang' })}
              className="group flex flex-col justify-between px-4 py-4 text-left transition hover:bg-[#fafaf8] cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#565e59]">
                <span className="truncate">Barang Datang</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#9aa39e] transition-transform group-hover:translate-x-0.5 group-hover:text-[#14533c]" />
              </div>
              <div className="font-mono-num mt-2 text-[22px] leading-none font-semibold text-[#141816]">
                {stock.filledDatangToday}
                <span className="text-[13px] font-normal text-[#7c8580]">
                  /{stock.activeItems.length}
                </span>
              </div>
              <div className="mt-1.5 text-[11.5px] text-[#7c8580]">Input tgl {stock.today}</div>
            </button>

            <button
              type="button"
              onClick={() => navigateTo('in', { day: stock.today, inputTab: 'closing' })}
              className="group flex flex-col justify-between px-4 py-4 text-left transition hover:bg-[#fafaf8] cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#565e59]">
                <span className="truncate">Closing Stok</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#9aa39e] transition-transform group-hover:translate-x-0.5 group-hover:text-[#14533c]" />
              </div>
              <div className="font-mono-num mt-2 text-[22px] leading-none font-semibold text-[#14533c]">
                {stock.filledClosingToday}
                <span className="text-[13px] font-normal text-[#7c8580]">
                  /{stock.activeItems.length}
                </span>
              </div>
              <div className="mt-1.5 truncate text-[11.5px] text-[#7c8580]">
                {stock.filledClosingToday === stock.activeItems.length && stock.activeItems.length > 0
                  ? `Lengkap · Tgl ${stock.today}`
                  : `Tgl ${stock.today} · ${stock.lastClosingDay ? `Akhir tgl ${stock.lastClosingDay}` : 'Belum ada'}`}
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setStockFilter('low');
                document.getElementById('stok-terkini-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group flex flex-col justify-between px-4 py-4 text-left transition hover:bg-[#fafaf8] cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#565e59]">
                <span className="truncate">Stok Menipis</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#9aa39e] transition-transform group-hover:translate-x-0.5 group-hover:text-[#b45309]" />
              </div>
              <div
                className={`font-mono-num mt-2 text-[22px] leading-none font-semibold ${
                  stock.lowStockItems.length > 0 ? 'text-[#b45309]' : 'text-[#141816]'
                }`}
              >
                {stock.lowStockItems.length}
              </div>
              <div className="mt-1.5 text-[11.5px] text-[#7c8580]">Di bawah batas min.</div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (stock.emptyStockItems.length > 0) {
                  setStockFilter('zero');
                  document
                    .getElementById('stok-terkini-section')
                    ?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigateTo('in', { day: stock.today, inputTab: 'datang' });
                }
              }}
              className="group flex flex-col justify-between px-4 py-4 text-left transition hover:bg-[#fafaf8] cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#565e59]">
                <span className="truncate">Stok Kosong</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#9aa39e] transition-transform group-hover:translate-x-0.5 group-hover:text-[#b91c1c]" />
              </div>
              <div
                className={`font-mono-num mt-2 text-[22px] leading-none font-semibold ${
                  stock.emptyStockItems.length > 0 ? 'text-[#b91c1c]' : 'text-[#141816]'
                }`}
              >
                {stock.emptyStockItems.length}
              </div>
              <div className="mt-1.5 text-[11.5px] text-[#7c8580]">Sisa 0 · perlu restock</div>
            </button>

            <button
              type="button"
              onClick={() =>
                navigateTo('in', {
                  day: stock.missingClosingDays[0] ?? stock.today,
                  inputTab: 'closing',
                })
              }
              className="group flex flex-col justify-between px-4 py-4 text-left transition hover:bg-[#fafaf8] cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#565e59]">
                <span className="truncate">Belum Closing</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#9aa39e] transition-transform group-hover:translate-x-0.5 group-hover:text-[#141816]" />
              </div>
              <div
                className={`font-mono-num mt-2 text-[22px] leading-none font-semibold ${
                  stock.missingClosingDays.length > 0 ? 'text-[#b45309]' : 'text-[#141816]'
                }`}
              >
                {stock.missingClosingDays.length}
              </div>
              <div className="mt-1.5 truncate text-[11.5px] text-[#7c8580]">
                {stock.missingClosingDays.length > 0
                  ? `Tgl ${stock.missingClosingDays.slice(0, 3).join(', ')}`
                  : 'Tidak ada tertunda'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (stock.negativeUsageEntries.length > 0) {
                  navigateTo('in', {
                    day: stock.negativeUsageEntries[0].day,
                    inputTab: 'closing',
                  });
                } else {
                  navigateTo('ms');
                }
              }}
              className="group flex flex-col justify-between px-4 py-4 text-left transition hover:bg-[#fafaf8] cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#565e59]">
                <span className="truncate">
                  {stock.negativeUsageEntries.length > 0 ? 'Pemakaian Negatif' : 'Item Aktif'}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#9aa39e] transition-transform group-hover:translate-x-0.5 group-hover:text-[#141816]" />
              </div>
              <div
                className={`font-mono-num mt-2 text-[22px] leading-none font-semibold ${
                  stock.negativeUsageEntries.length > 0 ? 'text-[#b91c1c]' : 'text-[#141816]'
                }`}
              >
                {stock.negativeUsageEntries.length > 0
                  ? stock.negativeUsageEntries.length
                  : stock.activeItems.length}
              </div>
              <div className="mt-1.5 truncate text-[11.5px] text-[#7c8580]">
                {stock.negativeUsageEntries.length > 0
                  ? `Cek tgl ${stock.negativeUsageEntries[0].day}`
                  : `${state.items.length} total di Master`}
              </div>
            </button>
          </section>

          {/* SECTION 2: OPERATIONS LEDGER TRIO (OMSET · ABSENSI & GAJI · DATABASE) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* OMSET & Pengeluaran */}
            <section className="flex flex-col rounded-xl border border-[#e5e5df] bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-[#efefea] px-5 py-3.5">
                <h2 className="font-display text-[14.5px] font-semibold text-[#141816]">
                  OMSET &amp; Pengeluaran
                </h2>
                <button
                  type="button"
                  onClick={() => navigateTo('om', { day: stock.today, omSub: 'harian' })}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#14533c] hover:underline whitespace-nowrap cursor-pointer"
                >
                  <span>Buka OMSET</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 divide-x divide-[#efefea] border-b border-[#efefea]">
                <button
                  type="button"
                  onClick={() => navigateTo('om', { omSub: 'rekap', omPeriod: activePeriodNum })}
                  className="px-5 py-4 text-left transition hover:bg-[#fafaf8] cursor-pointer"
                >
                  <span className="block text-[11.5px] text-[#565e59]">Omset Bersih</span>
                  <strong className="font-mono-num mt-1 block text-[17px] font-semibold text-[#14533c]">
                    {omset.filledDays > 0 ? formatRp(omset.omsetBersih) : '–'}
                  </strong>
                  <span className="mt-1 block text-[11px] text-[#7c8580]">
                    {omset.filledDays}/{omset.totalDays} hari terisi
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('om', { day: stock.today, omSub: 'pengeluaran' })}
                  className="px-5 py-4 text-left transition hover:bg-[#fafaf8] cursor-pointer"
                >
                  <span className="block text-[11.5px] text-[#565e59]">Total Pengeluaran</span>
                  <strong className="font-mono-num mt-1 block text-[17px] font-semibold text-[#141816]">
                    {omset.totalPengeluaran > 0 ? formatRp(omset.totalPengeluaran) : '–'}
                  </strong>
                  <span className="mt-1 block truncate text-[11px] text-[#7c8580]">
                    Harian {formatRp(omset.pengeluaranHarian)} · Omset{' '}
                    {formatRp(omset.pengeluaranOmset)}
                  </span>
                </button>
              </div>

              <div className="flex flex-1 flex-col justify-between divide-y divide-[#efefea] px-5 text-xs">
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <span className="text-[#565e59]">Tunai akhir kepala toko</span>
                  <strong
                    className={`font-mono-num font-semibold ${
                      omset.tunaiAkhirKepalaToko < 0 ? 'text-[#b91c1c]' : 'text-[#141816]'
                    }`}
                  >
                    {omset.filledDays > 0 || omset.totalGaji > 0
                      ? formatRp(omset.tunaiAkhirKepalaToko)
                      : '–'}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <span className="text-[#565e59]">Selisih Tunai / QRIS</span>
                  <span className="font-mono-num font-medium text-[#141816]">
                    {omset.filledDays > 0
                      ? `${formatSignedRp(omset.selisihTunai)} / ${formatSignedRp(omset.selisihQris)}`
                      : '–'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <span className="text-[#565e59]">Closing Periode</span>
                  <div className="flex items-center gap-2 font-medium">
                    <button
                      type="button"
                      onClick={() => navigateTo('om', { omSub: 'rekap', omPeriod: 1 })}
                      className={`inline-flex items-center gap-1 hover:underline cursor-pointer ${
                        omset.p1.closed ? 'text-[#15803d]' : 'text-[#b45309]'
                      }`}
                    >
                      {omset.p1.closed && <Lock className="h-3 w-3" />}
                      <span>P1 {omset.p1.closed ? 'Closed' : 'Terbuka'}</span>
                    </button>
                    <span className="text-[#d4d4cc]">·</span>
                    <button
                      type="button"
                      onClick={() => navigateTo('om', { omSub: 'rekap', omPeriod: 2 })}
                      className={`inline-flex items-center gap-1 hover:underline cursor-pointer ${
                        omset.p2.closed ? 'text-[#15803d]' : 'text-[#b45309]'
                      }`}
                    >
                      {omset.p2.closed && <Lock className="h-3 w-3" />}
                      <span>P2 {omset.p2.closed ? 'Closed' : 'Terbuka'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Absensi & Gaji */}
            <section className="flex flex-col rounded-xl border border-[#e5e5df] bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-[#efefea] px-5 py-3.5">
                <h2 className="font-display text-[14.5px] font-semibold text-[#141816]">
                  Absensi &amp; Gaji
                </h2>
                <button
                  type="button"
                  onClick={() => navigateTo('ab', { day: stock.today, abSub: 'harian' })}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#14533c] hover:underline whitespace-nowrap cursor-pointer"
                >
                  <span>Buka Absensi</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 divide-x divide-[#efefea] border-b border-[#efefea]">
                <button
                  type="button"
                  onClick={() => navigateTo('ab', { day: stock.today, abSub: 'harian' })}
                  className="px-5 py-4 text-left transition hover:bg-[#fafaf8] cursor-pointer"
                >
                  <span className="block text-[11.5px] text-[#565e59]">
                    Absensi Tgl {stock.today}
                  </span>
                  <strong className="font-mono-num mt-1 block text-[17px] font-semibold text-[#141816]">
                    {dayAbs.savedCount > 0 ? `${dayAbs.hadir}/${dayAbs.totalActive}` : 'Belum'}
                  </strong>
                  <span
                    className={`mt-1 block truncate text-[11px] font-medium ${
                      dayAbs.pendingCount > 0 || dayAbs.hasDraft
                        ? 'text-[#b45309]'
                        : 'text-[#15803d]'
                    }`}
                  >
                    {dayAbs.hasDraft
                      ? 'Ada draf belum disimpan'
                      : dayAbs.pendingCount > 0
                        ? `${dayAbs.pendingCount} belum tersimpan`
                        : 'Semua tersimpan'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('ab', { abSub: 'rekap', abCycle: activeCycle })}
                  className="px-5 py-4 text-left transition hover:bg-[#fafaf8] cursor-pointer"
                >
                  <span className="block text-[11.5px] text-[#565e59]">
                    Gaji ({activeCycle === 'p1' ? 'Tahap 1' : 'Tahap 2'})
                  </span>
                  <strong className="font-mono-num mt-1 block text-[17px] font-semibold text-[#14533c]">
                    {periodPayroll.totalGaji > 0 ? formatRp(periodPayroll.totalGaji) : '–'}
                  </strong>
                  <span className="mt-1 block text-[11px] text-[#7c8580]">
                    {periodPayroll.totalHadir} hadir · {periodPayroll.totalLemburPaket} lembur
                  </span>
                </button>
              </div>

              <div className="flex flex-1 flex-col justify-between divide-y divide-[#efefea] px-5 text-xs">
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <span className="text-[#565e59]">Total gaji sebulan</span>
                  <strong className="font-mono-num font-semibold text-[#141816]">
                    {monthPayroll.totalGaji > 0 ? formatRp(monthPayroll.totalGaji) : '–'}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <span className="text-[#565e59]">Komposisi</span>
                  <span className="font-mono-num text-[#565e59]">
                    Pokok {formatRp(monthPayroll.totalGapok)} · Lembur{' '}
                    {formatRp(monthPayroll.totalLemburRp)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <span className="text-[#565e59]">Karyawan aktif</span>
                  <button
                    type="button"
                    onClick={() => navigateTo('ab', { abSub: 'karyawan' })}
                    className="font-medium text-[#141816] hover:text-[#14533c] hover:underline cursor-pointer"
                  >
                    {dayAbs.totalActive} orang · {monthPayroll.filledDays} hari terisi
                  </button>
                </div>
              </div>
            </section>

            {/* Status Koneksi Database */}
            <section className="flex flex-col rounded-xl border border-[#e5e5df] bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-[#efefea] px-5 py-3.5">
                <h2 className="font-display text-[14.5px] font-semibold text-[#141816]">
                  Database &amp; Akses
                </h2>
                <button
                  type="button"
                  onClick={() => navigateTo('db')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#14533c] hover:underline whitespace-nowrap cursor-pointer"
                >
                  <span>Kelola</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="border-b border-[#efefea] px-5 py-4">
                <div className="flex items-start gap-2.5">
                  <DbIcon className={`mt-0.5 h-4 w-4 shrink-0 ${dbMeta.tone}`} />
                  <div className="min-w-0">
                    <div className={`text-[13px] font-semibold ${dbMeta.tone}`}>{dbMeta.title}</div>
                    <p className="mt-0.5 text-xs leading-snug text-[#565e59]">{dbMeta.sub}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-between px-5 py-2.5 text-xs">
                <div className="divide-y divide-[#efefea]">
                  <div className="flex items-center justify-between gap-2 py-2">
                    <span className="text-[#565e59]">Hak akses</span>
                    <span className="font-medium text-[#141816]">
                      {isViewer ? 'Viewer (Hanya Baca)' : 'Admin (Akses Penuh)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 py-2">
                    <span className="text-[#565e59]">Pengguna aktif</span>
                    <span className="truncate font-medium text-[#141816]">
                      {user?.nama || user?.username || 'Mode Lokal'}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-2 pt-2.5 border-t border-[#efefea]">
                  {dbMode === 'cloud_unauth' ? (
                    <button
                      type="button"
                      onClick={() => setShowLoginModal(true)}
                      className="h-8 flex-1 rounded-md bg-[#14533c] px-3 text-xs font-medium text-white transition hover:bg-[#0f3f2d] cursor-pointer"
                    >
                      Login Google Sheets
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void reloadFromCloud()}
                      disabled={sync.isSyncing}
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] transition hover:bg-[#f3f3ee] disabled:opacity-60 cursor-pointer"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${sync.isSyncing ? 'animate-spin' : ''}`} />
                      <span>{sync.isSyncing ? 'Menyinkronkan…' : 'Muat Ulang'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigateTo('db')}
                    className="h-8 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#565e59] transition hover:bg-[#f3f3ee] hover:text-[#141816] cursor-pointer"
                  >
                    Pengaturan
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* SECTION 3: STOK TERKINI — CLEAN ARCHITECTURAL LEDGER GRID */}
          <section
            id="stok-terkini-section"
            className="rounded-xl border border-[#e5e5df] bg-white"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efefea] px-5 py-3.5">
              <div>
                <h2 className="font-display text-[15px] font-semibold text-[#141816]">
                  Stok Terkini — Tgl {stock.today} {getMonthLabel(ym)}
                </h2>
                <p className="mt-0.5 text-xs text-[#7c8580]">
                  Sisa closing kemarin atau stok awal ditambah barang datang hari ini
                </p>
              </div>

              <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#e5e5df] bg-[#f7f7f4] p-0.5 text-xs">
                {(
                  [
                    ['all', `Semua (${stockCounts.all})`],
                    ['low', `Menipis (${stockCounts.low})`],
                    ['zero', `Kosong (${stockCounts.zero})`],
                    ['na', `Belum Ada (${stockCounts.na})`],
                  ] as Array<[StockFilter, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStockFilter(key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition whitespace-nowrap cursor-pointer ${
                      stockFilter === key
                        ? 'bg-white text-[#141816] shadow-[0_1px_2px_rgba(17,22,20,0.06)]'
                        : 'text-[#565e59] hover:text-[#141816]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {filteredCurrentStocks.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#565e59]">
                  Tidak ada item pada kategori filter ini.{' '}
                  {stockFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setStockFilter('all')}
                      className="font-medium text-[#14533c] hover:underline cursor-pointer"
                    >
                      Tampilkan semua item
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {filteredCurrentStocks.map((entry) => {
                    const subText =
                      entry.base === null
                        ? 'Belum diisi'
                        : `${entry.from.replace('Sisa kemarin', 'Kemarin')} ${formatNum(entry.base)}${
                            entry.datang ? ` + ${formatNum(entry.datang)}` : ''
                          }${entry.status === 'low' ? ` · min ${formatNum(entry.item.min)}` : ''}`;

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
                        } (${subText})`}
                        className={`rounded-lg border px-3 py-2.5 text-left transition cursor-pointer ${statusTileSurface[entry.status]}`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="truncate text-[12.5px] font-medium text-[#141816]">
                            {entry.item.nama}
                          </span>
                          <span
                            className={`shrink-0 text-[10.5px] font-semibold ${statusTextTone[entry.status]}`}
                          >
                            {statusTextLabel[entry.status]}
                          </span>
                        </div>
                        <div className="font-mono-num mt-1.5 text-[18px] leading-none font-semibold text-[#141816]">
                          {formatNum(entry.val)}
                          <span className="ml-1 text-[11px] font-normal text-[#7c8580]">
                            {entry.item.sat || 'pcs'}
                          </span>
                        </div>
                        <div className="mt-1.5 truncate text-[11px] text-[#7c8580]">{subText}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* SECTION 4: GRAFIK PEMAKAIAN HARIAN + PERLU PERHATIAN */}
          <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[1fr_360px]">
            {/* Grafik Pemakaian Harian */}
            <section className="flex flex-col rounded-xl border border-[#e5e5df] bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-[#efefea] px-5 py-3.5">
                <div>
                  <h2 className="font-display text-[14.5px] font-semibold text-[#141816]">
                    Pemakaian Harian — {getMonthLabel(ym)}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#7c8580]">
                    Klik batang tanggal untuk memeriksa input closing hari tersebut
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('tb')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#14533c] hover:underline whitespace-nowrap cursor-pointer"
                >
                  <span>Tabel Bulanan</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-1 flex-col justify-end px-5 py-4">
                <div className="flex h-[156px] items-end gap-[3px] border-b border-[#efefea] pb-1 pt-2">
                  {stock.dailyUsageSeries.map((val, idx) => {
                    const d = idx + 1;
                    const heightPct = val > 0 ? Math.max(4, (val / maxDailyUsage) * 100) : 2;
                    const isTodayBar = ym === curYm && d === stock.today;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => navigateTo('in', { day: d, inputTab: 'closing' })}
                        title={`Tgl ${d}: ${formatNum(val)} pemakaian (klik untuk cek input)`}
                        style={{ height: `${heightPct}%` }}
                        className={`flex-1 rounded-t-[2px] transition-opacity cursor-pointer ${
                          val > 0
                            ? isTodayBar
                              ? 'bg-[#14533c] opacity-100'
                              : 'bg-[#2a7b5c] opacity-75 hover:opacity-100'
                            : 'bg-[#e5e5df] opacity-70 hover:opacity-100'
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="font-mono-num mt-2 flex justify-between text-[11px] text-[#7c8580]">
                  <span>1</span>
                  <span>{Math.round(stock.nd / 4)}</span>
                  <span>{Math.round(stock.nd / 2)}</span>
                  <span>{Math.round((stock.nd * 3) / 4)}</span>
                  <span>{stock.nd}</span>
                </div>
              </div>
            </section>

            {/* Perlu Perhatian (Lintas Modul) */}
            <section className="flex flex-col rounded-xl border border-[#e5e5df] bg-white">
              <div className="flex items-center justify-between gap-2 border-b border-[#efefea] px-5 py-3.5">
                <h2 className="font-display text-[14.5px] font-semibold text-[#141816]">
                  Perlu Perhatian
                </h2>
                <span className="font-mono-num text-xs font-medium text-[#7c8580]">
                  {attentionItems.length} catatan
                </span>
              </div>
              <div className="flex-1">
                {attentionItems.length === 0 ? (
                  <div className="flex items-center gap-2 px-5 py-6 text-xs font-medium text-[#15803d]">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Semua stok, closing, OMSET &amp; absensi terpantau aman.</span>
                  </div>
                ) : (
                  <div className="dg-scroll max-h-[228px] divide-y divide-[#efefea] overflow-y-auto">
                    {attentionItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={item.onClick}
                        className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left transition hover:bg-[#fafaf8] cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span
                              className={`font-semibold ${
                                item.severity === 'red' ? 'text-[#b91c1c]' : 'text-[#b45309]'
                              }`}
                            >
                              {item.domain}
                            </span>
                            <span className="text-[#d4d4cc]">·</span>
                            <span className="text-[#7c8580]">{item.actionLabel}</span>
                          </div>
                          <div className="truncate text-[12.5px] font-medium text-[#141816]">
                            {item.title}
                          </div>
                        </div>
                        <span
                          className={`font-mono-num shrink-0 text-xs font-semibold ${
                            item.severity === 'red' ? 'text-[#b91c1c]' : 'text-[#b45309]'
                          }`}
                        >
                          {item.metric}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* SECTION 5: PEMAKAIAN TERBANYAK BULAN BERJALAN */}
          <section className="rounded-xl border border-[#e5e5df] bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-[#efefea] px-5 py-3.5">
              <h2 className="font-display text-[14.5px] font-semibold text-[#141816]">
                Pemakaian Terbanyak — {getMonthLabel(ym)}
              </h2>
              <button
                type="button"
                onClick={() => navigateTo('tb')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#14533c] hover:underline whitespace-nowrap cursor-pointer"
              >
                <span>Lihat Rekap</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="px-5 py-2">
              {stock.topUsageItems.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 py-4 text-xs text-[#565e59]">
                  <span>
                    Belum ada catatan pemakaian pada bulan {getMonthLabel(ym)}. Pemakaian dihitung
                    otomatis setelah Stok Awal dan Closing Harian diisi.
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateTo('in', { day: stock.today, inputTab: 'closing' })}
                    className="font-medium text-[#14533c] hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Buka Input Harian →
                  </button>
                </div>
              ) : (
                <table className="w-full border-collapse text-[13px]">
                  <tbody className="divide-y divide-[#efefea]">
                    {stock.topUsageItems.map((row, idx) => (
                      <tr
                        key={row.item.id}
                        onClick={() => navigateTo('tb')}
                        className="transition hover:bg-[#fafaf8] cursor-pointer"
                      >
                        <td className="font-mono-num w-8 py-2.5 text-xs font-medium text-[#7c8580]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 font-medium text-[#141816]">
                          {row.item.nama}{' '}
                          <span className="text-xs font-normal text-[#7c8580]">
                            · {row.item.kat}
                          </span>
                        </td>
                        <td className="hidden w-44 py-2.5 sm:table-cell">
                          <div className="h-1.5 overflow-hidden rounded-full bg-[#efefea]">
                            <div
                              className="h-full rounded-full bg-[#14533c]"
                              style={{ width: `${Math.round((row.totalUsage / topMax) * 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="font-mono-num py-2.5 text-right text-xs font-semibold text-[#141816] whitespace-nowrap">
                          {formatNum(row.totalUsage)} {row.item.sat}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
