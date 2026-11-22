import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  Database,
  FileText,
  HardDrive,
  Lock,
  Package,
  PenLine,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
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

    // 1. Stok kosong
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

    // 2. Stok menipis (dibawah batas min Master Item)
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

    // 3. Pemakaian negatif
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

    // 4. Hari belum closing stok
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

    // 5. Closing hari ini belum lengkap
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

    // 6. OMSET selisih tanpa keterangan
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

    // 7. OMSET hari ini belum diisi
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

    // 8. Absensi belum tersimpan / ada draf
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
          bg: 'bg-[#ecfaf8] border-[#9ad8d2]',
          icon: Cloud,
        };
      case 'cloud_connected':
        return {
          title: 'Terhubung ke Google Sheets',
          sub: sync.lastSyncAt ? `Sinkron terakhir pukul ${sync.lastSyncAt}` : sync.text,
          tone: 'text-[#15803d]',
          bg: 'bg-[#ecfaf8] border-[#9ad8d2]',
          icon: Cloud,
        };
      case 'cloud_unauth':
        return {
          title: 'Cloud Terkonfigurasi · Belum Login',
          sub: 'Membaca cache lokal; login untuk sinkron Google Sheets',
          tone: 'text-[#b45309]',
          bg: 'bg-[#fffbeb] border-[#f0c869]',
          icon: CloudOff,
        };
      default:
        return {
          title: 'Mode Lokal (Browser)',
          sub: 'Data disimpan di localStorage perangkat ini',
          tone: 'text-[#475569]',
          bg: 'bg-[#f8fafc] border-[#cbd5e1]',
          icon: HardDrive,
        };
    }
  }, [dbMode, sync]);

  const DbIcon = dbMeta.icon;

  const statusCardTone: Record<CurrentStockStatus, string> = {
    ok: 'bg-[#1a9e94] text-white',
    low: 'bg-[#e0a030] text-white',
    zero: 'bg-[#dc5a6b] text-white',
    na: 'bg-[#5b7083] text-white',
  };

  const statusTextLabel: Record<CurrentStockStatus, string> = {
    ok: 'Aman',
    low: 'Menipis',
    zero: 'Kosong',
    na: 'Belum ada data',
  };

  return (
    <div className="dg-scroll flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-4">
      {/* Header Toolbar: Periode + Quick Actions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-1.5 py-1">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="Bulan sebelumnya"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#1f2a36] hover:bg-[#f4f6f7] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[120px] text-center text-[13px] font-semibold text-[#1f2a36] whitespace-nowrap">
              {getMonthLabel(ym)}
            </span>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="Bulan berikutnya"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#1f2a36] hover:bg-[#f4f6f7] cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {ym !== curYm && (
            <button
              type="button"
              onClick={goToday}
              className="h-9 rounded-lg border border-[#e2e8f0] bg-white px-3 text-xs font-semibold text-[#1f2a36] hover:bg-[#f4f6f7] whitespace-nowrap cursor-pointer"
            >
              Bulan Ini
            </button>
          )}
        </div>

        {/* Quick Action Buttons (konsisten dengan HTML lama) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigateTo('in', { day: stock.today, inputTab: 'closing' })}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-[#1a9e94] px-3.5 text-[13px] font-medium text-white transition hover:bg-[#12857c] whitespace-nowrap cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Mulai Closing</span>
          </button>
          <button
            type="button"
            onClick={() => navigateTo('in', { day: stock.today, inputTab: 'datang' })}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[#e2e8f0] bg-white px-3.5 text-[13px] font-medium text-[#1f2a36] transition hover:border-[#1a9e94] hover:bg-[#1a9e94] hover:text-white whitespace-nowrap cursor-pointer"
          >
            <Package className="h-3.5 w-3.5" />
            <span>Barang Datang</span>
          </button>
          <button
            type="button"
            onClick={() => navigateTo('aw')}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[#e2e8f0] bg-white px-3.5 text-[13px] font-medium text-[#1f2a36] transition hover:border-[#1a9e94] hover:bg-[#1a9e94] hover:text-white whitespace-nowrap cursor-pointer"
          >
            <PenLine className="h-3.5 w-3.5" />
            <span>Stok Awal</span>
          </button>
          <button
            type="button"
            onClick={() => navigateTo('lp')}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[#e2e8f0] bg-white px-3.5 text-[13px] font-medium text-[#1f2a36] transition hover:border-[#1a9e94] hover:bg-[#1a9e94] hover:text-white whitespace-nowrap cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Laporan</span>
          </button>

          {/* Peringatan kompak saat data stok bulan ini masih kosong (mirip ep-chip HTML lama) */}
          {stock.isMonthEmpty && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setEmptyPopOpen((v) => !v)}
                aria-expanded={emptyPopOpen}
                className="inline-flex h-9 items-center gap-2 rounded-[9px] border border-[#e0a030] bg-[#fffbeb] px-3 text-xs font-semibold text-[#8a5d00] hover:bg-[#fef3c7] whitespace-nowrap cursor-pointer"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-[#d98e04]" />
                <span>Data bulan ini kosong</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${emptyPopOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {emptyPopOpen && (
                <div className="absolute right-0 z-30 mt-2 w-[300px] max-w-[calc(100vw-32px)] rounded-xl border-2 border-[#6b7f99] bg-white p-4 shadow-xl">
                  <p className="text-[13px] font-bold text-[#0f172a]">
                    Belum ada data {getMonthLabel(ym)}
                  </p>
                  <p className="mt-1.5 mb-3 text-xs leading-relaxed text-[#475569]">
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
                      className="h-8 rounded-lg bg-[#0f172a] px-3 text-xs font-semibold text-white hover:bg-[#1e293b] cursor-pointer"
                    >
                      Isi Stok Awal
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmptyPopOpen(false)}
                      className="h-8 rounded-lg px-2.5 text-xs font-medium text-[#475569] hover:bg-slate-100 cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: 6 KARTU STATISTIK STOK & INPUT HARIAN (Semua klik menuju detail relevan) */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <button
          type="button"
          onClick={() => navigateTo('in', { day: stock.today, inputTab: 'datang' })}
          className="group rounded-xl bg-[#1a9e94] px-3.5 py-2.5 text-left text-white shadow-xs transition hover:brightness-105 cursor-pointer"
        >
          <div className="mb-1 flex items-center justify-between gap-1 text-[11px] font-semibold tracking-wide text-white/85 uppercase">
            <span className="truncate">Barang Datang</span>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="font-mono-num text-[22px] leading-none font-bold">
            {stock.filledDatangToday}
            <span className="text-[13px] opacity-70">/{stock.activeItems.length}</span>
          </div>
          <div className="mt-1 text-[11px] text-white/80">Input tgl {stock.today}</div>
        </button>

        <button
          type="button"
          onClick={() => navigateTo('in', { day: stock.today, inputTab: 'closing' })}
          className="group rounded-xl bg-[#158a81] px-3.5 py-2.5 text-left text-white shadow-xs transition hover:brightness-105 cursor-pointer"
        >
          <div className="mb-1 flex items-center justify-between gap-1 text-[11px] font-semibold tracking-wide text-white/85 uppercase">
            <span className="truncate">Closing Stok</span>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="font-mono-num text-[22px] leading-none font-bold">
            {stock.filledClosingToday}
            <span className="text-[13px] opacity-70">/{stock.activeItems.length}</span>
          </div>
          <div className="mt-1 text-[11px] text-white/80">
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
          className="group rounded-xl bg-[#e0a030] px-3.5 py-2.5 text-left text-white shadow-xs transition hover:brightness-105 cursor-pointer"
        >
          <div className="mb-1 flex items-center justify-between gap-1 text-[11px] font-semibold tracking-wide text-white/90 uppercase">
            <span className="truncate">Stok Menipis</span>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-75 transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="font-mono-num text-[22px] leading-none font-bold">
            {stock.lowStockItems.length}
          </div>
          <div className="mt-1 text-[11px] text-white/85">Di bawah batas min.</div>
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
          className="group rounded-xl bg-[#dc5a6b] px-3.5 py-2.5 text-left text-white shadow-xs transition hover:brightness-105 cursor-pointer"
        >
          <div className="mb-1 flex items-center justify-between gap-1 text-[11px] font-semibold tracking-wide text-white/90 uppercase">
            <span className="truncate">Stok Kosong</span>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-75 transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="font-mono-num text-[22px] leading-none font-bold">
            {stock.emptyStockItems.length}
          </div>
          <div className="mt-1 text-[11px] text-white/85">Sisa 0 / perlu restock</div>
        </button>

        <button
          type="button"
          onClick={() =>
            navigateTo('in', {
              day: stock.missingClosingDays[0] ?? stock.today,
              inputTab: 'closing',
            })
          }
          className="group rounded-xl bg-[#5b7083] px-3.5 py-2.5 text-left text-white shadow-xs transition hover:brightness-105 cursor-pointer"
        >
          <div className="mb-1 flex items-center justify-between gap-1 text-[11px] font-semibold tracking-wide text-white/85 uppercase">
            <span className="truncate">Belum Closing</span>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="font-mono-num text-[22px] leading-none font-bold">
            {stock.missingClosingDays.length}
          </div>
          <div className="mt-1 text-[11px] text-white/80">
            {stock.missingClosingDays.length > 0
              ? `Tgl ${stock.missingClosingDays.slice(0, 3).join(', ')}`
              : 'Tidak ada hari tertunda'}
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
          className="group rounded-xl bg-[#334155] px-3.5 py-2.5 text-left text-white shadow-xs transition hover:brightness-110 cursor-pointer"
        >
          <div className="mb-1 flex items-center justify-between gap-1 text-[11px] font-semibold tracking-wide text-white/85 uppercase">
            <span className="truncate">
              {stock.negativeUsageEntries.length > 0 ? 'Pemakaian Negatif' : 'Item Aktif'}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-70 transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="font-mono-num text-[22px] leading-none font-bold">
            {stock.negativeUsageEntries.length > 0
              ? stock.negativeUsageEntries.length
              : stock.activeItems.length}
          </div>
          <div className="mt-1 text-[11px] text-white/80">
            {stock.negativeUsageEntries.length > 0
              ? `Cek tgl ${stock.negativeUsageEntries[0].day}`
              : `${state.items.length} total di Master`}
          </div>
        </button>
      </div>

      {/* SECTION 2: DOMAIN KEUANGAN (OMSET & PENGELUARAN), KARYAWAN (ABSENSI & GAJI), DAN DATABASE */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Panel Ringkasan OMSET & Pengeluaran */}
        <section className="flex flex-col rounded-xl border-[1.5px] border-[#dde2e6] bg-white shadow-xs">
          <div className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <Wallet className="h-4 w-4 shrink-0 text-[#1a9e94]" />
              <h2 className="truncate text-sm font-semibold text-[#1f2a36]">
                Ringkasan OMSET &amp; Pengeluaran
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('om', { day: stock.today, omSub: 'harian' })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a9e94] hover:underline whitespace-nowrap cursor-pointer"
            >
              <span>Buka OMSET</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-1 flex-col justify-between p-4">
            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
              <button
                type="button"
                onClick={() => navigateTo('om', { omSub: 'rekap', omPeriod: activePeriodNum })}
                className="rounded-lg bg-[#f1fbfa] p-2.5 text-left transition hover:bg-[#e3f6f4] cursor-pointer"
              >
                <span className="block text-[11px] font-medium text-[#475569]">
                  Omset Bersih ({getMonthLabel(ym)})
                </span>
                <strong className="font-mono-num mt-0.5 block text-base font-bold text-[#0f766e]">
                  {omset.filledDays > 0 ? formatRp(omset.omsetBersih) : '–'}
                </strong>
                <span className="mt-0.5 block text-[11px] text-[#64748b]">
                  {omset.filledDays}/{omset.totalDays} hari terisi
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('om', { day: stock.today, omSub: 'pengeluaran' })}
                className="rounded-lg bg-[#f8fafc] p-2.5 text-left transition hover:bg-slate-100 cursor-pointer"
              >
                <span className="block text-[11px] font-medium text-[#475569]">
                  Total Pengeluaran
                </span>
                <strong className="font-mono-num mt-0.5 block text-base font-bold text-[#1f2a36]">
                  {omset.totalPengeluaran > 0 ? formatRp(omset.totalPengeluaran) : '–'}
                </strong>
                <span className="mt-0.5 block text-[11px] text-[#64748b]">
                  Harian {formatRp(omset.pengeluaranHarian)} · Omset{' '}
                  {formatRp(omset.pengeluaranOmset)}
                </span>
              </button>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#475569]">Tunai akhir dibawa kepala toko</span>
                <strong
                  className={`font-mono-num font-semibold ${
                    omset.tunaiAkhirKepalaToko < 0 ? 'text-[#c93f38]' : 'text-[#1f2a36]'
                  }`}
                >
                  {omset.filledDays > 0 || omset.totalGaji > 0
                    ? formatRp(omset.tunaiAkhirKepalaToko)
                    : '–'}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#475569]">Selisih Tunai / QRIS</span>
                <span className="font-mono-num font-semibold text-[#1f2a36]">
                  {omset.filledDays > 0
                    ? `${formatSignedRp(omset.selisihTunai)} / ${formatSignedRp(omset.selisihQris)}`
                    : '–'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <span className="text-[#475569]">Closing Periode</span>
                <div className="flex items-center gap-2 font-medium">
                  <button
                    type="button"
                    onClick={() => navigateTo('om', { omSub: 'rekap', omPeriod: 1 })}
                    className={`inline-flex items-center gap-1 hover:underline cursor-pointer ${
                      omset.p1.closed ? 'text-[#15803d]' : 'text-[#b45309]'
                    }`}
                  >
                    {omset.p1.closed && <Lock className="h-3 w-3" />}
                    <span>P1: {omset.p1.closed ? 'Closed' : 'Terbuka'}</span>
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => navigateTo('om', { omSub: 'rekap', omPeriod: 2 })}
                    className={`inline-flex items-center gap-1 hover:underline cursor-pointer ${
                      omset.p2.closed ? 'text-[#15803d]' : 'text-[#b45309]'
                    }`}
                  >
                    {omset.p2.closed && <Lock className="h-3 w-3" />}
                    <span>P2: {omset.p2.closed ? 'Closed' : 'Terbuka'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Panel Ringkasan Absensi & Total Gaji */}
        <section className="flex flex-col rounded-xl border-[1.5px] border-[#dde2e6] bg-white shadow-xs">
          <div className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <Users className="h-4 w-4 shrink-0 text-[#1a9e94]" />
              <h2 className="truncate text-sm font-semibold text-[#1f2a36]">
                Absensi &amp; Total Gaji
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('ab', { day: stock.today, abSub: 'harian' })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a9e94] hover:underline whitespace-nowrap cursor-pointer"
            >
              <span>Buka Absensi</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-1 flex-col justify-between p-4">
            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
              <button
                type="button"
                onClick={() => navigateTo('ab', { day: stock.today, abSub: 'harian' })}
                className="rounded-lg bg-[#f8fafc] p-2.5 text-left transition hover:bg-slate-100 cursor-pointer"
              >
                <span className="block text-[11px] font-medium text-[#475569]">
                  Absensi Tgl {stock.today}
                </span>
                <strong className="font-mono-num mt-0.5 block text-base font-bold text-[#1f2a36]">
                  {dayAbs.savedCount > 0 ? `${dayAbs.hadir}/${dayAbs.totalActive}` : 'Belum'}
                </strong>
                <span
                  className={`mt-0.5 block text-[11px] font-medium ${
                    dayAbs.pendingCount > 0 || dayAbs.hasDraft
                      ? 'text-[#b45309]'
                      : 'text-[#15803d]'
                  }`}
                >
                  {dayAbs.hasDraft
                    ? 'Ada draf belum disimpan'
                    : dayAbs.pendingCount > 0
                      ? `${dayAbs.pendingCount} karyawan belum tersimpan`
                      : 'Semua tersimpan'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigateTo('ab', { abSub: 'rekap', abCycle: activeCycle })
                }
                className="rounded-lg bg-[#f1fbfa] p-2.5 text-left transition hover:bg-[#e3f6f4] cursor-pointer"
              >
                <span className="block text-[11px] font-medium text-[#475569]">
                  Total Gaji ({activeCycle === 'p1' ? 'Tahap 1' : 'Tahap 2'})
                </span>
                <strong className="font-mono-num mt-0.5 block text-base font-bold text-[#0f766e]">
                  {periodPayroll.totalGaji > 0 ? formatRp(periodPayroll.totalGaji) : '–'}
                </strong>
                <span className="mt-0.5 block text-[11px] text-[#64748b]">
                  {periodPayroll.totalHadir} hadir · {periodPayroll.totalLemburPaket} lembur
                </span>
              </button>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#475569]">Total gaji sebulan ({getMonthLabel(ym)})</span>
                <strong className="font-mono-num font-semibold text-[#1f2a36]">
                  {monthPayroll.totalGaji > 0 ? formatRp(monthPayroll.totalGaji) : '–'}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#475569]">Komposisi bulan ini</span>
                <span className="font-mono-num text-[#475569]">
                  Pokok {formatRp(monthPayroll.totalGapok)} · Lembur{' '}
                  {formatRp(monthPayroll.totalLemburRp)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <span className="text-[#475569]">Karyawan aktif</span>
                <button
                  type="button"
                  onClick={() => navigateTo('ab', { abSub: 'karyawan' })}
                  className="font-semibold text-[#1f2a36] hover:text-[#1a9e94] hover:underline cursor-pointer"
                >
                  {dayAbs.totalActive} orang · {monthPayroll.filledDays} hari terisi
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Panel Status Koneksi Database & Hak Akses */}
        <section className="flex flex-col rounded-xl border-[1.5px] border-[#dde2e6] bg-white shadow-xs">
          <div className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <Database className="h-4 w-4 shrink-0 text-[#1a9e94]" />
              <h2 className="truncate text-sm font-semibold text-[#1f2a36]">
                Status Koneksi Database
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('db')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a9e94] hover:underline whitespace-nowrap cursor-pointer"
            >
              <span>Kelola</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-1 flex-col justify-between p-4">
            <div className={`rounded-lg border p-3 ${dbMeta.bg}`}>
              <div className="flex items-start gap-2.5">
                <DbIcon className={`mt-0.5 h-4 w-4 shrink-0 ${dbMeta.tone}`} />
                <div className="min-w-0">
                  <div className={`text-xs font-bold ${dbMeta.tone}`}>{dbMeta.title}</div>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-[#475569]">{dbMeta.sub}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#475569]">Hak akses sesi</span>
                <span className="inline-flex items-center gap-1 font-semibold text-[#1f2a36]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#1a9e94]" />
                  {isViewer ? 'Viewer (Hanya Baca)' : 'Admin (Akses Penuh)'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#475569]">Pengguna aktif</span>
                <span className="truncate font-medium text-[#1f2a36]">
                  {user?.nama || user?.username || 'Mode Lokal'}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                {dbMode === 'cloud_unauth' ? (
                  <button
                    type="button"
                    onClick={() => setShowLoginModal(true)}
                    className="h-8 flex-1 rounded-lg bg-[#1a9e94] px-3 text-xs font-semibold text-white hover:bg-[#12857c] cursor-pointer"
                  >
                    Login Google Sheets
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void reloadFromCloud()}
                    disabled={sync.isSyncing}
                    className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#cbd5e1] bg-white px-3 text-xs font-semibold text-[#1f2a36] hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${sync.isSyncing ? 'animate-spin' : ''}`} />
                    <span>{sync.isSyncing ? 'Menyinkronkan…' : 'Muat Ulang Data'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigateTo('db')}
                  className="h-8 rounded-lg border border-[#cbd5e1] bg-white px-3 text-xs font-semibold text-[#1f2a36] hover:bg-slate-50 cursor-pointer"
                >
                  Pengaturan
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* SECTION 3: STOK TERKINI – TGL TODAY (Mirip .sk-grid HTML lama dengan filter cepat) */}
      <section
        id="stok-terkini-section"
        className="mb-4 rounded-xl border-[1.5px] border-[#dde2e6] bg-white shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] px-4 py-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[#64748b]" />
            <h2 className="text-sm font-semibold text-[#1f2a36]">
              Stok Terkini – Tgl {stock.today} {getMonthLabel(ym)}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-[11.5px] text-[#64748b] xl:inline">
              Sisa closing kemarin / stok awal + barang datang
            </span>
            <div className="inline-flex items-center gap-1 rounded-lg bg-[#eef2f6] p-0.5 text-xs">
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
                  className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition whitespace-nowrap cursor-pointer ${
                    stockFilter === key
                      ? 'bg-white text-[#1f2a36] shadow-xs'
                      : 'text-[#64748b] hover:text-[#1f2a36]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4">
          {filteredCurrentStocks.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#64748b]">
              Tidak ada item pada kategori filter ini.{' '}
              {stockFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setStockFilter('all')}
                  className="font-semibold text-[#1a9e94] hover:underline cursor-pointer"
                >
                  Tampilkan semua item
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {filteredCurrentStocks.map((entry) => {
                const subText =
                  entry.base === null
                    ? 'Belum ada data'
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
                    className={`rounded-xl px-3 py-2.5 text-left shadow-xs transition hover:-translate-y-0.5 hover:brightness-105 cursor-pointer ${statusCardTone[entry.status]}`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-1 text-[10px] font-semibold tracking-wide text-white/85 uppercase">
                      <span className="truncate">{entry.item.nama}</span>
                    </div>
                    <div className="font-mono-num text-[19px] leading-none font-bold">
                      {formatNum(entry.val)}
                      <span className="ml-1 text-[11px] font-semibold opacity-85">
                        {entry.item.sat || 'pcs'}
                      </span>
                    </div>
                    <div className="mt-1.5 truncate text-[10px] leading-tight text-white/85">
                      {subText} · {statusTextLabel[entry.status]}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 4: GRAFIK PEMAKAIAN HARIAN + PANEL PERLU PERHATIAN */}
      <div className="mb-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_340px]">
        {/* Grafik Pemakaian Harian */}
        <section className="flex flex-col rounded-xl border-[1.5px] border-[#dde2e6] bg-white shadow-xs">
          <div className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] px-4 py-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#64748b]" />
              <h2 className="text-sm font-semibold text-[#1f2a36]">
                Pemakaian Harian – {getMonthLabel(ym)}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('tb')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a9e94] hover:underline whitespace-nowrap cursor-pointer"
            >
              <span>Tabel Bulanan</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-1 flex-col justify-end p-4">
            <div className="flex h-[152px] items-end gap-[3px] pt-2">
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
                    className={`flex-1 rounded-t-[3px] transition-opacity cursor-pointer ${
                      val > 0
                        ? isTodayBar
                          ? 'bg-[#0f766e] opacity-100'
                          : 'bg-[#1a9e94] opacity-75 hover:opacity-100'
                        : 'bg-[#cbd5e1] opacity-60 hover:opacity-100'
                    }`}
                  />
                );
              })}
            </div>
            <div className="font-mono-num mt-2 flex justify-between text-[10.5px] text-[#64748b]">
              <span>1</span>
              <span>{Math.round(stock.nd / 4)}</span>
              <span>{Math.round(stock.nd / 2)}</span>
              <span>{Math.round((stock.nd * 3) / 4)}</span>
              <span>{stock.nd}</span>
            </div>
          </div>
        </section>

        {/* Perlu Perhatian (Lintas Modul) */}
        <section className="flex flex-col rounded-xl border-[1.5px] border-[#dde2e6] bg-white shadow-xs">
          <div className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#64748b]" />
              <h2 className="text-sm font-semibold text-[#1f2a36]">Perlu Perhatian</h2>
            </div>
            <span className="font-mono-num text-xs font-semibold text-[#64748b]">
              {attentionItems.length} item
            </span>
          </div>
          <div className="p-3">
            {attentionItems.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg px-2.5 py-3 text-[13px] font-medium text-[#15803d]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Semua stok, closing, OMSET &amp; absensi terpantau aman.</span>
              </div>
            ) : (
              <div className="dg-scroll max-h-[210px] space-y-1 overflow-y-auto pr-1">
                {attentionItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-[#f4f6f7] cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                        <span
                          className={
                            item.severity === 'red' ? 'text-[#c93f38]' : 'text-[#b45309]'
                          }
                        >
                          {item.domain}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-[#64748b]">{item.actionLabel}</span>
                      </div>
                      <div className="truncate text-[12.5px] font-medium text-[#1f2a36]">
                        {item.title}
                      </div>
                    </div>
                    <span
                      className={`font-mono-num shrink-0 text-xs font-semibold ${
                        item.severity === 'red' ? 'text-[#c93f38]' : 'text-[#b45309]'
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
      <section className="rounded-xl border-[1.5px] border-[#dde2e6] bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] px-4 py-3">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-[#64748b]" />
            <h2 className="text-sm font-semibold text-[#1f2a36]">
              Pemakaian Terbanyak – {getMonthLabel(ym)}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('tb')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a9e94] hover:underline whitespace-nowrap cursor-pointer"
          >
            <span>Lihat Rekap</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-4">
          {stock.topUsageItems.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs text-[#64748b]">
              <span>
                Belum ada catatan pemakaian pada bulan {getMonthLabel(ym)}. Pemakaian dihitung
                otomatis setelah Stok Awal dan Closing Harian diisi.
              </span>
              <button
                type="button"
                onClick={() => navigateTo('in', { day: stock.today, inputTab: 'closing' })}
                className="font-semibold text-[#1a9e94] hover:underline whitespace-nowrap cursor-pointer"
              >
                Buka Input Harian →
              </button>
            </div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <tbody>
                {stock.topUsageItems.map((row, idx) => (
                  <tr
                    key={row.item.id}
                    onClick={() => navigateTo('tb')}
                    className="border-b border-slate-100 last:border-none hover:bg-[#f8fafc] cursor-pointer"
                  >
                    <td className="font-mono-num w-8 py-2.5 text-xs font-semibold text-[#64748b]">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 font-medium text-[#1f2a36]">
                      {row.item.nama}{' '}
                      <span className="text-xs font-normal text-[#64748b]">· {row.item.kat}</span>
                    </td>
                    <td className="hidden w-40 py-2.5 sm:table-cell">
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#f1f5f9]">
                        <div
                          className="h-full rounded-full bg-[#1a9e94]"
                          style={{ width: `${Math.round((row.totalUsage / topMax) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="font-mono-num py-2.5 text-right text-xs font-semibold text-[#1f2a36] whitespace-nowrap">
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
  );
};
