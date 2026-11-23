import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  HelpCircle,
  Lock,
  LockOpen,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { OMSET_CHART_METRIC_KEYS, OmsetChartPanel } from '../components/OmsetChartPanel';
import { DAY_NAMES, MONTH_NAMES } from '../constants/defaults';
import { useApp } from '../context/AppContext';
import { getDailySalaryForDate } from '../domain/attendanceCalculations';
import {
  formatDateKey,
  formatNum,
  formatRp,
  getDayOfWeek,
  getDaysInMonth,
  getFullDateLabel,
  getMonth,
  getMonthLabel,
  getTodayParts,
  getYear,
} from '../domain/dateUtils';
import {
  calcOmsetDay,
  formatOmsetShort,
  formatRpDigits,
  formatSignedRp,
  getOmsetClosing,
  getOmsetClosingValidation,
  getOmsetMonthlyExpenseHistory,
  getOmsetPeriodStats,
  getOmsetState,
  getPeriodOfDay,
  OMSET_CHART_METRICS,
  parseRpDigits,
  type OmsetChartMetricKey,
} from '../domain/omsetCalculations';
import type { OmsetDayRecord, OmsetExpenseItem, OmsetSubTab } from '../types/app';

const SUB_TABS: Array<{ id: OmsetSubTab; label: string }> = [
  { id: 'harian', label: 'Harian' },
  { id: 'pengeluaran', label: 'Pengeluaran' },
  { id: 'kalender', label: 'Kalender' },
  { id: 'grafik', label: 'Grafik' },
  { id: 'rekap', label: 'Rekap & Closing' },
];

type ExpenseHistoryFilter = 'bx' | 'kx' | 'all';

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const DiffStatusText: React.FC<{ val: number | null }> = ({ val }) => {
  if (val === null) {
    return <span className="text-xs font-semibold text-[#64748b]">Belum diisi</span>;
  }
  if (val === 0) {
    return <span className="font-mono-num text-xs font-bold text-[#15803d]">Sesuai</span>;
  }
  return (
    <span
      className={`font-mono-num text-xs font-bold ${
        val > 0 ? 'text-[#b45309]' : 'text-[#dc2626]'
      }`}
    >
      {formatSignedRp(val)}
    </span>
  );
};

export const OmsetPage: React.FC = () => {
  const {
    state,
    ym,
    day,
    curYm,
    nowDay,
    omSub,
    setOmSub,
    omPeriod,
    setOmPeriod,
    isViewer,
    hasUnsavedOmset,
    sync,
    moveMonth,
    moveDay,
    selectDateStr,
    setMonthAndDay,
    goToday,
    updateOmsetDay,
    saveOmsetNow,
    closeOmsetPeriod,
    reopenOmsetPeriod,
    navigateTo,
  } = useApp();

  const [calSelDay, setCalSelDay] = useState<number>(day);
  const [chartMetric, setChartMetric] = useState<OmsetChartMetricKey>('omset');
  const [historyFilter, setHistoryFilter] = useState<ExpenseHistoryFilter>('bx');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [closingModalPeriod, setClosingModalPeriod] = useState<1 | 2 | null>(null);
  const [reopenModalPeriod, setReopenModalPeriod] = useState<1 | 2 | null>(null);
  const [expenseDetailPopover, setExpenseDetailPopover] = useState<{
    day: number;
    kind: 'kx' | 'bx';
  } | null>(null);

  const nd = useMemo(() => getDaysInMonth(ym), [ym]);
  const monthName = MONTH_NAMES[getMonth(ym) - 1] || '';
  const yearNum = getYear(ym);
  const todayParts = useMemo(() => getTodayParts(), []);
  const isSelectedToday = ym === curYm && day === nowDay;

  useEffect(() => {
    setCalSelDay((prev) => Math.min(Math.max(1, prev), nd));
  }, [ym, nd]);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(t);
  }, [feedback]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedOmset) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedOmset]);

  const activePeriod: 1 | 2 = omPeriod === 1 || omPeriod === 2 ? omPeriod : getPeriodOfDay(day);
  const dayPeriod: 1 | 2 = getPeriodOfDay(day);
  const dayKey = formatDateKey(ym, day);
  const omState = useMemo(() => getOmsetState(state), [state]);
  const dayRecord: OmsetDayRecord = omState.days[dayKey] || {};
  const dayCalc = useMemo(() => calcOmsetDay(dayRecord), [dayRecord]);
  const daySalary = useMemo(() => getDailySalaryForDate(state, ym, day), [state, ym, day]);

  const dayClosingRec = useMemo(
    () => getOmsetClosing(state, ym, dayPeriod),
    [state, ym, dayPeriod]
  );
  const isDayLocked = Boolean(dayClosingRec) || isViewer;

  const p1Stats = useMemo(() => getOmsetPeriodStats(state, ym, 1), [state, ym]);
  const p2Stats = useMemo(() => getOmsetPeriodStats(state, ym, 2), [state, ym]);
  const activeStats = activePeriod === 1 ? p1Stats : p2Stats;
  const dayPeriodStats = dayPeriod === 1 ? p1Stats : p2Stats;
  const expenseHistory = useMemo(() => getOmsetMonthlyExpenseHistory(state, ym), [state, ym]);

  const closingValidation = useMemo(
    () => (closingModalPeriod ? getOmsetClosingValidation(state, ym, closingModalPeriod) : null),
    [closingModalPeriod, state, ym]
  );

  const setMoneyField = (field: 'tn' | 'qn' | 'qr' | 'tl', raw: string) => {
    const val = parseRpDigits(raw);
    updateOmsetDay(ym, day, (prev) => {
      const next = { ...prev };
      if (val === undefined) {
        delete next[field];
      } else {
        next[field] = val;
      }
      return next;
    });
  };

  const setTextField = (field: 'kt' | 'kq' | 'cn', raw: string) => {
    updateOmsetDay(ym, day, (prev) => {
      const next = { ...prev };
      if (field === 'cn') {
        if (raw.trim()) next.cn = raw;
        else delete next.cn;
      } else {
        next[field] = raw;
      }
      return next;
    });
  };

  const addExpenseRow = (kind: 'kx' | 'bx') => {
    updateOmsetDay(ym, day, (prev) => ({
      ...prev,
      [kind]: [...(prev[kind] || []), { k: '', v: 0 }],
    }));
  };

  const updateExpenseRow = (
    kind: 'kx' | 'bx',
    idx: number,
    patch: Partial<OmsetExpenseItem>
  ) => {
    updateOmsetDay(ym, day, (prev) => {
      const list = [...(prev[kind] || [])];
      if (!list[idx]) return prev;
      list[idx] = { ...list[idx], ...patch };
      return { ...prev, [kind]: list };
    });
  };

  const removeExpenseRow = (kind: 'kx' | 'bx', idx: number) => {
    updateOmsetDay(ym, day, (prev) => {
      const list = [...(prev[kind] || [])];
      list.splice(idx, 1);
      const next = { ...prev };
      if (list.length === 0 && kind === 'bx') {
        delete next.bx;
      } else {
        next[kind] = list;
      }
      return next;
    });
  };

  const handleSaveOmset = async () => {
    if (isViewer) return;
    const ok = await saveOmsetNow();
    setFeedback(
      ok
        ? { type: 'ok', text: 'Data OMSET berhasil disimpan.' }
        : {
            type: 'err',
            text: 'Gagal sinkron ke database cloud. Data tetap aman tersimpan di perangkat ini.',
          }
    );
  };

  const handleConfirmClose = async () => {
    if (!closingModalPeriod || !closingValidation || !closingValidation.canClose) return;
    const p = closingModalPeriod;
    const ok = await closeOmsetPeriod(ym, p);
    setClosingModalPeriod(null);
    setFeedback(
      ok
        ? { type: 'ok', text: `Periode ${p} (${monthName} ${yearNum}) berhasil di-closing dan dikunci.` }
        : {
            type: 'err',
            text: `Periode ${p} dikunci di perangkat lokal, tetapi gagal sinkron ke server.`,
          }
    );
  };

  const handleConfirmReopen = async () => {
    if (!reopenModalPeriod) return;
    const p = reopenModalPeriod;
    const ok = await reopenOmsetPeriod(ym, p);
    setReopenModalPeriod(null);
    setFeedback(
      ok
        ? { type: 'ok', text: `Closing Periode ${p} dibuka kembali. Data dapat diubah lagi.` }
        : {
            type: 'err',
            text: `Closing Periode ${p} dibuka di lokal, tetapi gagal sinkron ke server.`,
          }
    );
  };

  const handleExportPeriodCsv = (p: 1 | 2) => {
    const st = p === 1 ? p1Stats : p2Stats;
    const t = st.totals;
    const escCsv = (s: string) =>
      s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;

    const lines = [
      [
        'Tanggal',
        'Tunai Nota',
        'QRIS Nota',
        'Pengeluaran Harian',
        'QRIS Real',
        'Tunai Laci',
        'Selisih Tunai',
        'Ket Selisih Tunai',
        'Selisih QRIS',
        'Ket Selisih QRIS',
        'Omset Bersih',
        'Pengeluaran Omset',
        'Gaji Karyawan',
        'Tunai Akhir Hari',
        'Catatan',
      ].join(','),
    ];

    st.rows.forEach(({ d, r, c, g }) => {
      if (!c.filled && !c.bx && !g.tot) return;
      lines.push(
        [
          `${ym}-${String(d).padStart(2, '0')}`,
          String(c.tn),
          String(c.qn),
          String(c.kx),
          String(c.qr),
          String(c.tl),
          c.selT === null ? '' : String(c.selT),
          escCsv(String(r.kt || '')),
          c.selQ === null ? '' : String(c.selQ),
          escCsv(String(r.kq || '')),
          String(c.omset),
          String(c.bx),
          String(g.tot),
          String(c.akhir),
          escCsv(String(r.cn || '')),
        ].join(',')
      );
    });

    lines.push(
      [
        `TOTAL PERIODE ${p}`,
        String(t.tn),
        String(t.qn),
        String(t.kx),
        String(t.qr),
        String(t.tl),
        String(t.selT),
        '',
        String(t.selQ),
        '',
        String(t.omset),
        String(t.bx),
        String(t.gaji),
        String(t.tunaiAkhir),
        '',
      ].join(',')
    );

    downloadCsv(`omset-${ym}-P${p}.csv`, lines.join('\n'));
    setFeedback({ type: 'ok', text: `File omset-${ym}-P${p}.csv berhasil diunduh.` });
  };

  const monthTotals = useMemo(() => {
    const omset = p1Stats.totals.omset + p2Stats.totals.omset;
    const bx = p1Stats.totals.bx + p2Stats.totals.bx;
    const kx = p1Stats.totals.kx + p2Stats.totals.kx;
    const gaji = p1Stats.totals.gaji + p2Stats.totals.gaji;
    const tl = p1Stats.totals.tl + p2Stats.totals.tl;
    const selT = p1Stats.totals.selT + p2Stats.totals.selT;
    const selQ = p1Stats.totals.selQ + p2Stats.totals.selQ;
    const filled = p1Stats.filled + p2Stats.filled;
    return {
      omset,
      bx,
      kx,
      gaji,
      tl,
      selT,
      selQ,
      filled,
      sisa: omset - bx - gaji,
      tunaiAkhir: tl - bx - gaji,
      dibawaBeforeGaji: tl - bx,
    };
  }, [p1Stats, p2Stats]);

  const displayedExpenseHistory = useMemo(() => {
    if (historyFilter === 'bx') return expenseHistory.bxEntries;
    if (historyFilter === 'kx') return expenseHistory.kxEntries;
    return [...expenseHistory.bxEntries, ...expenseHistory.kxEntries].sort((a, b) => a.day - b.day);
  }, [expenseHistory, historyFilter]);

  const gajiPctToday =
    dayCalc.omset > 0 && daySalary.tot > 0
      ? Math.round((daySalary.tot / dayCalc.omset) * 100)
      : null;

  const sisaHariIniSetelahGaji = dayCalc.omset - dayCalc.bx - daySalary.tot;

  const renderDateNav = () => (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center rounded-xl bg-[#f3f7f5] p-0.5">
        <button
          type="button"
          onClick={() => moveDay(-1)}
          aria-label="Hari sebelumnya"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="date"
          value={dayKey}
          onChange={(e) => selectDateStr(e.target.value)}
          aria-label="Pilih tanggal OMSET"
          className="font-mono-num h-7 bg-transparent px-2 text-xs font-semibold text-[#13222b] outline-none"
        />
        <button
          type="button"
          onClick={() => moveDay(1)}
          aria-label="Hari berikutnya"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={goToday}
        disabled={isSelectedToday}
        className={`h-8 shrink-0 rounded-xl px-3 text-xs font-semibold whitespace-nowrap transition ${
          isSelectedToday
            ? 'bg-[#f3f7f5] text-[#94a3b8] cursor-default'
            : 'bg-[#f3f7f5] text-[#13222b] hover:bg-[#e1ebe7] cursor-pointer'
        }`}
      >
        Hari ini
      </button>
      <span className="text-xs font-semibold text-[#475569] whitespace-nowrap">
        {getFullDateLabel(ym, day)}
      </span>
    </div>
  );

  const renderMonthNav = () => (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center rounded-xl bg-[#f3f7f5] p-0.5">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          aria-label="Bulan sebelumnya"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="month"
          value={ym}
          onChange={(e) => {
            if (e.target.value && e.target.value.length >= 7) {
              setMonthAndDay(e.target.value.slice(0, 7), 1);
            }
          }}
          aria-label="Pilih bulan OMSET"
          className="font-mono-num h-7 bg-transparent px-2 text-xs font-semibold text-[#13222b] outline-none"
        />
        <button
          type="button"
          onClick={() => moveMonth(1)}
          aria-label="Bulan berikutnya"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <span className="hidden text-xs font-semibold text-[#475569] sm:inline whitespace-nowrap">
        {getMonthLabel(ym)}
      </span>
    </div>
  );

  const calRecord = omState.days[formatDateKey(ym, calSelDay)] || {};
  const calCalc = calcOmsetDay(calRecord);
  const calSalary = getDailySalaryForDate(state, ym, calSelDay);
  const calPeriod = getPeriodOfDay(calSelDay);
  const calClosed = getOmsetClosing(state, ym, calPeriod);

  const activeValidation = useMemo(
    () => getOmsetClosingValidation(state, ym, activePeriod),
    [state, ym, activePeriod]
  );

  return (
    <div className="dg-page">
      {/* ── STICKY FLOATING TOP HEADER BAR ── */}
      <div className="dg-sticky-header no-print px-4 pt-3 pb-1 md:px-6">
        <header className="rounded-2xl bg-white px-4 py-2.5 shadow-[0_6px_22px_rgba(13,37,48,0.045)] md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Date or Month Navigation + Period Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            {omSub === 'harian' || omSub === 'pengeluaran' ? renderDateNav() : renderMonthNav()}

            {omSub === 'rekap' && (
              <div className="flex items-center gap-1 rounded-xl bg-[#f3f7f5] p-1">
                <button
                  type="button"
                  onClick={() => setOmPeriod(1)}
                  className={`h-7 shrink-0 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    activePeriod === 1
                      ? 'bg-[#0d2530] text-white shadow-xs'
                      : 'text-[#64748b] hover:text-[#13222b]'
                  }`}
                >
                  Periode 1 (1–15)
                </button>
                <button
                  type="button"
                  onClick={() => setOmPeriod(2)}
                  className={`h-7 shrink-0 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    activePeriod === 2
                      ? 'bg-[#0d2530] text-white shadow-xs'
                      : 'text-[#64748b] hover:text-[#13222b]'
                  }`}
                >
                  Periode 2 (16–{nd})
                </button>
              </div>
            )}

            {omSub === 'kalender' && (
              <div className="flex items-center gap-1.5">
                {([1, 2] as const).map((pp) => {
                  const st = pp === 1 ? p1Stats : p2Stats;
                  const cl = st.closed;
                  return (
                    <button
                      key={pp}
                      type="button"
                      onClick={() => {
                        setOmPeriod(pp);
                        setOmSub('rekap');
                      }}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] whitespace-nowrap cursor-pointer"
                    >
                      {cl ? (
                        <Lock className="h-3 w-3 text-[#2eb86b]" />
                      ) : (
                        <LockOpen className="h-3 w-3 text-[#f59e0b]" />
                      )}
                      <span>
                        P{pp} ({st.from}–{st.to})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Metric Dropdown (when Grafik) + Submenu Dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            {omSub === 'grafik' && (
              <select
                value={chartMetric}
                onChange={(e) => setChartMetric(e.target.value as OmsetChartMetricKey)}
                aria-label="Pilih metrik grafik OMSET"
                className="h-8.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] outline-none transition hover:bg-[#e7efec] focus:ring-2 focus:ring-[#2eb86b] cursor-pointer"
              >
                {OMSET_CHART_METRIC_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {OMSET_CHART_METRICS[k].label}
                  </option>
                ))}
              </select>
            )}

            <select
              value={omSub}
              onChange={(e) => {
                const next = e.target.value as OmsetSubTab;
                if (next === 'rekap') setOmPeriod(0);
                setOmSub(next);
              }}
              aria-label="Submenu OMSET"
              className="h-8.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] outline-none transition hover:bg-[#e7efec] focus:ring-2 focus:ring-[#2eb86b] cursor-pointer"
            >
              {SUB_TABS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        </header>
      </div>

      {/* ── FLOATING FEEDBACK BANNER ── */}
      {feedback && (
        <div
          className={`no-print mx-4 mt-3 shrink-0 flex items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-sm md:mx-6 ${
            feedback.type === 'ok' ? 'bg-[#2eb86b]' : 'bg-[#ef4444]'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Tutup pesan"
            className="opacity-80 hover:opacity-100 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── MAIN SCROLLABLE CONTENT ── */}
      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {/* ═══════════════════ TAB 1: HARIAN ═══════════════════ */}
        {omSub === 'harian' && (
          <div className="mx-auto max-w-[1180px] space-y-4">
            {dayClosingRec && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#e6f7ee] px-4 py-3 text-xs text-[#15803d] shadow-[0_6px_22px_rgba(13,37,48,0.03)]">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-[#15803d]" />
                  <span>
                    <strong>{dayPeriodStats.label}</strong> sudah di-closing oleh{' '}
                    <strong>{dayClosingRec.by}</strong>. Data terkunci dan tidak dapat diubah tanpa
                    membuka closing.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOmPeriod(dayPeriod);
                    setOmSub('rekap');
                  }}
                  className="font-bold text-[#15803d] underline underline-offset-2 hover:text-[#166534] whitespace-nowrap cursor-pointer"
                >
                  Lihat Rekap &amp; Closing
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* LEFT CARD: INPUT HARI INI */}
              <section className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div className="mb-4 flex items-center justify-between gap-2 border-b border-[#edf2f0] pb-3">
                  <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                    Input Hari Ini
                  </h2>
                  <span
                    className={`rounded-lg px-2.5 py-0.5 text-[11px] font-semibold ${
                      dayClosingRec
                        ? 'bg-[#e6f7ee] text-[#15803d]'
                        : 'bg-[#fef3c7] text-[#b45309]'
                    }`}
                  >
                    Periode {dayPeriod} · {dayClosingRec ? 'Closed (Terkunci)' : 'Terbuka'}
                  </span>
                </div>

                <div className="space-y-3">
                  {(
                    [
                      { f: 'tn', label: 'Tunai Nota', sub: 'dari nota kasir' },
                      { f: 'qn', label: 'QRIS Nota', sub: 'dari nota kasir' },
                      { f: 'qr', label: 'QRIS Real', sub: 'saldo masuk di mBanking' },
                    ] as const
                  ).map(({ f, label, sub }) => (
                    <label
                      key={f}
                      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div>
                        <div className="text-[13px] font-semibold text-[#13222b]">{label}</div>
                        <div className="text-[11px] text-[#64748b]">{sub}</div>
                      </div>
                      <div className="flex h-10 w-full items-center overflow-hidden rounded-xl border border-[#dce6e2] bg-[#f7faf9] transition focus-within:border-[#2eb86b] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#2eb86b]/20 sm:w-[220px]">
                        <span className="border-r border-[#edf2f0] bg-[#f3f7f5] px-2.5 text-xs font-semibold leading-10 text-[#64748b]">
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          disabled={isDayLocked}
                          placeholder="0"
                          value={
                            dayRecord[f] !== undefined ? formatRpDigits(dayRecord[f]) : ''
                          }
                          onChange={(e) => setMoneyField(f, e.target.value)}
                          className="font-mono-num h-full w-full bg-transparent px-3 text-right text-sm font-bold text-[#13222b] outline-none disabled:text-[#64748b]"
                        />
                      </div>
                    </label>
                  ))}

                  {/* Pengeluaran Harian (kx) */}
                  <div className="pt-2">
                    <div className="mb-2 flex items-center justify-between border-t border-[#edf2f0] pt-3">
                      <span className="text-[13px] font-semibold text-[#13222b]">
                        Pengeluaran Harian (Pada Nota)
                      </span>
                      <strong className="font-mono-num text-sm font-bold text-[#13222b]">
                        {formatRp(dayCalc.kx)}
                      </strong>
                    </div>

                    <div className="space-y-2">
                      {(dayRecord.kx || []).map((item, idx) => {
                        const missingKet = (Number(item.v) || 0) > 0 && !String(item.k || '').trim();
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                disabled={isDayLocked}
                                placeholder="Keterangan pengeluaran (wajib diisi)"
                                value={item.k || ''}
                                onChange={(e) =>
                                  updateExpenseRow('kx', idx, { k: e.target.value })
                                }
                                className={`h-9 min-w-0 flex-1 rounded-xl border px-3 text-xs text-[#13222b] outline-none transition disabled:bg-[#f3f7f5] ${
                                  missingKet
                                    ? 'border-[#ef4444] bg-[#fef2f2] focus:border-[#ef4444]'
                                    : 'border-[#dce6e2] bg-[#f7faf9] focus:border-[#2eb86b] focus:bg-white'
                                }`}
                              />
                              <div className="flex h-9 w-[132px] shrink-0 items-center overflow-hidden rounded-xl border border-[#dce6e2] bg-[#f7faf9] focus-within:border-[#2eb86b] focus-within:bg-white">
                                <span className="px-2 text-[11px] font-semibold text-[#64748b]">
                                  Rp
                                </span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  disabled={isDayLocked}
                                  placeholder="0"
                                  value={item.v ? formatRpDigits(item.v) : ''}
                                  onChange={(e) =>
                                    updateExpenseRow('kx', idx, {
                                      v: parseRpDigits(e.target.value) || 0,
                                    })
                                  }
                                  className="font-mono-num h-full w-full bg-transparent pr-2.5 text-right text-xs font-bold text-[#13222b] outline-none disabled:text-[#64748b]"
                                />
                              </div>
                              {!isDayLocked && (
                                <button
                                  type="button"
                                  onClick={() => removeExpenseRow('kx', idx)}
                                  aria-label="Hapus pengeluaran harian"
                                  className="flex h-9 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f3f7f5] text-[#64748b] transition hover:bg-[#fee2e2] hover:text-[#dc2626] cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            {missingKet && (
                              <p className="text-[11px] font-semibold text-[#dc2626]">
                                Keterangan pengeluaran wajib diisi sebelum closing.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {!isDayLocked && (
                      <button
                        type="button"
                        onClick={() => addExpenseRow('kx')}
                        className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f7faf9] px-3 text-xs font-semibold text-[#475569] transition hover:border-[#2eb86b] hover:bg-[#e6f7ee] hover:text-[#15803d] cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Tambah pengeluaran harian</span>
                      </button>
                    )}
                  </div>

                  {/* Divider + Tunai Real di Laci */}
                  <div className="border-t border-[#edf2f0] pt-3">
                    <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div>
                        <div className="text-[13px] font-bold text-[#13222b]">
                          Tunai Real di Laci
                        </div>
                        <div className="text-[11px] text-[#64748b]">
                          uang fisik setelah pengeluaran harian
                        </div>
                      </div>
                      <div className="flex h-10 w-full items-center overflow-hidden rounded-xl border-[1.5px] border-[#2eb86b] bg-white transition focus-within:ring-2 focus-within:ring-[#2eb86b]/25 sm:w-[220px]">
                        <span className="border-r border-[#d1f0e0] bg-[#e6f7ee] px-2.5 text-xs font-bold leading-10 text-[#15803d]">
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          disabled={isDayLocked}
                          placeholder="0"
                          value={
                            dayRecord.tl !== undefined ? formatRpDigits(dayRecord.tl) : ''
                          }
                          onChange={(e) => setMoneyField('tl', e.target.value)}
                          className="font-mono-num h-full w-full px-3 text-right text-sm font-bold text-[#13222b] outline-none disabled:bg-[#f3f7f5] disabled:text-[#64748b]"
                        />
                      </div>
                    </label>
                  </div>

                  {/* Catatan */}
                  <div className="pt-1">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-[#13222b]">
                        Catatan <span className="font-medium text-[#64748b]">(opsional)</span>
                      </span>
                      <textarea
                        rows={2}
                        maxLength={500}
                        disabled={isDayLocked}
                        placeholder="Informasi tambahan hari ini…"
                        value={dayRecord.cn || ''}
                        onChange={(e) => setTextField('cn', e.target.value)}
                        className="w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3 py-2 text-xs text-[#13222b] outline-none transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20 disabled:bg-[#f3f7f5]"
                      />
                    </label>
                  </div>
                </div>
              </section>

              {/* RIGHT CARD: RINGKASAN & PERBANDINGAN */}
              <section className="overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div className="flex items-center justify-between border-b border-[#edf2f0] px-5 py-4">
                  <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                    Ringkasan &amp; Perbandingan
                  </h2>
                  <span className="text-xs text-[#64748b]">Otomatis dari input tanggal {day}</span>
                </div>

                {/* Perbandingan Tunai & QRIS */}
                <div className="divide-y divide-[#edf2f0] px-5">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-[13px] font-semibold text-[#13222b]">
                        Tunai seharusnya
                      </div>
                      <div className="text-[11px] text-[#64748b]">
                        Tunai nota ({formatRp(dayCalc.tn)}) − pengeluaran ({formatRp(dayCalc.kx)})
                      </div>
                    </div>
                    <strong className="font-mono-num text-sm font-bold text-[#13222b]">
                      {formatRp(dayCalc.exp)}
                    </strong>
                  </div>

                  {/* Selisih Tunai + Mandatory Keterangan */}
                  <div className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-semibold text-[#13222b]">Selisih tunai</div>
                        <div className="text-[11px] text-[#64748b]">
                          Tunai laci vs tunai seharusnya
                        </div>
                      </div>
                      <DiffStatusText val={dayCalc.selT} />
                    </div>
                    {Boolean(dayCalc.selT) && (
                      <div className="mt-2">
                        <input
                          type="text"
                          disabled={isDayLocked}
                          placeholder="Keterangan selisih tunai (wajib diisi sebelum closing)"
                          value={dayRecord.kt || ''}
                          onChange={(e) => setTextField('kt', e.target.value)}
                          className={`h-9 w-full rounded-xl border px-3 text-xs outline-none transition disabled:bg-[#f3f7f5] ${
                            !String(dayRecord.kt || '').trim()
                              ? 'border-[#ef4444] bg-[#fef2f2] text-[#991b1b] focus:border-[#ef4444]'
                              : 'border-[#dce6e2] bg-[#f7faf9] text-[#13222b] focus:border-[#2eb86b] focus:bg-white'
                          }`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Selisih QRIS + Mandatory Keterangan */}
                  <div className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-semibold text-[#13222b]">Selisih QRIS</div>
                        <div className="text-[11px] text-[#64748b]">
                          QRIS real mBanking vs QRIS nota
                        </div>
                      </div>
                      <DiffStatusText val={dayCalc.selQ} />
                    </div>
                    {Boolean(dayCalc.selQ) && (
                      <div className="mt-2">
                        <input
                          type="text"
                          disabled={isDayLocked}
                          placeholder="Keterangan selisih QRIS (wajib diisi sebelum closing)"
                          value={dayRecord.kq || ''}
                          onChange={(e) => setTextField('kq', e.target.value)}
                          className={`h-9 w-full rounded-xl border px-3 text-xs outline-none transition disabled:bg-[#f3f7f5] ${
                            !String(dayRecord.kq || '').trim()
                              ? 'border-[#ef4444] bg-[#fef2f2] text-[#991b1b] focus:border-[#ef4444]'
                              : 'border-[#dce6e2] bg-[#f7faf9] text-[#13222b] focus:border-[#2eb86b] focus:bg-white'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Flush 2-Column Hero Ledger Band */}
                <div className="grid grid-cols-1 divide-y divide-[#edf2f0] border-y border-[#edf2f0] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="bg-[#f7faf9] px-5 py-4">
                    <div className="text-[11.5px] font-semibold text-[#64748b]">Omset Bersih</div>
                    <div className="font-mono-num mt-1 text-lg font-bold text-[#13222b]">
                      {formatRp(dayCalc.omset)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#64748b]">
                      Tunai laci + QRIS real
                    </div>
                  </div>
                  <div
                    className={`px-5 py-4 ${
                      dayCalc.akhir < 0 ? 'bg-[#fef2f2]' : 'bg-[#f2fbf6]'
                    }`}
                  >
                    <div
                      className={`text-[11.5px] font-semibold ${
                        dayCalc.akhir < 0 ? 'text-[#dc2626]' : 'text-[#15803d]'
                      }`}
                    >
                      Dibawa Kepala Toko
                    </div>
                    <div
                      className={`font-mono-num mt-1 text-lg font-bold ${
                        dayCalc.akhir < 0 ? 'text-[#dc2626]' : 'text-[#15803d]'
                      }`}
                    >
                      {formatRp(dayCalc.akhir)}
                    </div>
                    <div
                      className={`mt-0.5 text-[11px] ${
                        dayCalc.akhir < 0 ? 'font-semibold text-[#dc2626]' : 'text-[#475569]'
                      }`}
                    >
                      {dayCalc.akhir < 0
                        ? 'Negatif: pengeluaran omset melebihi tunai di laci'
                        : dayCalc.bx > 0
                          ? 'Tunai laci − pengeluaran omset'
                          : 'Tunai bersih di laci'}
                    </div>
                  </div>
                </div>

                {/* Pengeluaran Omset + Gaji Absensi + Sisa Setelah Gaji */}
                <div className="divide-y divide-[#edf2f0] px-5">
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-[13px] font-semibold text-[#13222b]">
                        Pengeluaran dari omset
                      </div>
                      <div className="text-[11px] text-[#64748b]">
                        diambil dari tunai ·{' '}
                        <button
                          type="button"
                          onClick={() => setOmSub('pengeluaran')}
                          className="font-bold text-[#15803d] hover:underline cursor-pointer"
                        >
                          atur di tab Pengeluaran
                        </button>
                      </div>
                    </div>
                    <strong className="font-mono-num text-sm font-bold text-[#13222b]">
                      {formatRp(dayCalc.bx)}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-[13px] font-semibold text-[#13222b]">Gaji hari ini</div>
                      <div className="text-[11px] text-[#64748b]">
                        {daySalary.saved
                          ? `${daySalary.h} karyawan hadir · otomatis dari Absensi`
                          : 'Absensi hari ini belum diisi'}{' '}
                        ·{' '}
                        <button
                          type="button"
                          onClick={() => navigateTo('ab', { ym, day, abSub: 'harian' })}
                          className="font-bold text-[#15803d] hover:underline cursor-pointer"
                        >
                          buka Absensi
                        </button>
                      </div>
                    </div>
                    <strong className="font-mono-num text-sm font-bold text-[#13222b]">
                      {formatRp(daySalary.tot)}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-[13px] font-semibold text-[#13222b]">
                        Sisa setelah gaji
                      </div>
                      <div className="text-[11px] text-[#64748b]">
                        {gajiPctToday !== null
                          ? `Gaji = ${gajiPctToday}% dari omset bersih`
                          : 'Omset − pengeluaran omset − gaji'}
                      </div>
                    </div>
                    <strong
                      className={`font-mono-num text-sm font-bold ${
                        sisaHariIniSetelahGaji < 0 ? 'text-[#dc2626]' : 'text-[#13222b]'
                      }`}
                    >
                      {formatRp(sisaHariIniSetelahGaji)}
                    </strong>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ═══════════════════ TAB 2: PENGELUARAN ═══════════════════ */}
        {omSub === 'pengeluaran' && (
          <div className="mx-auto max-w-[1180px] space-y-4">
            {dayClosingRec && (
              <div className="flex items-center gap-2 rounded-2xl bg-[#e6f7ee] px-4 py-3 text-xs text-[#15803d]">
                <Lock className="h-3.5 w-3.5 shrink-0 text-[#15803d]" />
                <span>
                  <strong>{dayPeriodStats.label}</strong> sudah di-closing ({dayClosingRec.by}).
                  Pengeluaran periode ini terkunci.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* LEFT: Input Pengeluaran dari Omset (bx) */}
              <section className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div className="mb-3 flex items-center justify-between border-b border-[#edf2f0] pb-3">
                  <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                    Pengeluaran dari Omset
                  </h2>
                  <span
                    className={`rounded-lg px-2.5 py-0.5 text-[11px] font-semibold ${
                      dayClosingRec
                        ? 'bg-[#e6f7ee] text-[#15803d]'
                        : 'bg-[#fef3c7] text-[#b45309]'
                    }`}
                  >
                    Periode {dayPeriod} · {dayClosingRec ? 'Closed' : 'Terbuka'}
                  </span>
                </div>

                <p className="mb-4 text-xs leading-relaxed text-[#475569]">
                  Untuk belanja bernilai besar atau kebutuhan operasional yang diambil langsung dari{' '}
                  <strong className="text-[#13222b]">uang tunai omset</strong>. Pengeluaran ini
                  mengurangi uang tunai yang dibawa kepala toko. Belanja kecil harian pada nota
                  tetap diisi di tab{' '}
                  <button
                    type="button"
                    onClick={() => setOmSub('harian')}
                    className="font-bold text-[#15803d] underline underline-offset-2 cursor-pointer"
                  >
                    Harian
                  </button>
                  .
                </p>

                <div className="mb-2.5 flex items-center justify-between border-t border-[#edf2f0] pt-3">
                  <span className="text-xs font-semibold text-[#475569]">
                    Daftar pengeluaran tanggal {day} {monthName}
                  </span>
                  <strong className="font-mono-num text-sm font-bold text-[#13222b]">
                    {formatRp(dayCalc.bx)}
                  </strong>
                </div>

                <div className="space-y-2">
                  {(dayRecord.bx || []).length === 0 && (
                    <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f7faf9] py-6 text-center text-xs text-[#64748b]">
                      Belum ada pengeluaran dari omset pada tanggal {day}.
                    </div>
                  )}
                  {(dayRecord.bx || []).map((item, idx) => {
                    const missingKet = (Number(item.v) || 0) > 0 && !String(item.k || '').trim();
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            disabled={isDayLocked}
                            placeholder="Untuk apa? (mis. beli peralatan, bayar supplier)"
                            value={item.k || ''}
                            onChange={(e) =>
                              updateExpenseRow('bx', idx, { k: e.target.value })
                            }
                            className={`h-9 min-w-0 flex-1 rounded-xl border px-3 text-xs text-[#13222b] outline-none transition disabled:bg-[#f3f7f5] ${
                              missingKet
                                ? 'border-[#ef4444] bg-[#fef2f2] focus:border-[#ef4444]'
                                : 'border-[#dce6e2] bg-[#f7faf9] focus:border-[#2eb86b] focus:bg-white'
                            }`}
                          />
                          <div className="flex h-9 w-[140px] shrink-0 items-center overflow-hidden rounded-xl border border-[#dce6e2] bg-[#f7faf9] focus-within:border-[#2eb86b] focus-within:bg-white">
                            <span className="px-2 text-[11px] font-semibold text-[#64748b]">Rp</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={isDayLocked}
                              placeholder="0"
                              value={item.v ? formatRpDigits(item.v) : ''}
                              onChange={(e) =>
                                updateExpenseRow('bx', idx, {
                                  v: parseRpDigits(e.target.value) || 0,
                                })
                              }
                              className="font-mono-num h-full w-full bg-transparent pr-2.5 text-right text-xs font-bold text-[#13222b] outline-none disabled:text-[#64748b]"
                            />
                          </div>
                          {!isDayLocked && (
                            <button
                              type="button"
                              onClick={() => removeExpenseRow('bx', idx)}
                              aria-label="Hapus pengeluaran omset"
                              className="flex h-9 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f3f7f5] text-[#64748b] transition hover:bg-[#fee2e2] hover:text-[#dc2626] cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {missingKet && (
                          <p className="text-[11px] font-semibold text-[#dc2626]">
                            Keterangan pengeluaran wajib diisi sebelum closing.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!isDayLocked && (
                  <button
                    type="button"
                    onClick={() => addExpenseRow('bx')}
                    className="mt-3 inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f7faf9] px-3 text-xs font-semibold text-[#475569] transition hover:border-[#2eb86b] hover:bg-[#e6f7ee] hover:text-[#15803d] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tambah pengeluaran dari omset</span>
                  </button>
                )}
              </section>

              {/* RIGHT: Tunai Dibawa Kepala Toko (Hari Ini & Periode P) */}
              <section className="overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div className="border-b border-[#edf2f0] px-5 py-4">
                  <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                    Tunai Dibawa Kepala Toko
                  </h2>
                </div>

                <div className="divide-y divide-[#edf2f0] px-5 text-[13px]">
                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="font-semibold text-[#13222b]">Tunai real di laci</div>
                      <div className="text-[11px] text-[#64748b]">
                        {dayRecord.tl !== undefined
                          ? 'dari input harian'
                          : 'belum diisi di tab Harian'}
                      </div>
                    </div>
                    <strong className="font-mono-num font-bold text-[#13222b]">
                      {dayRecord.tl !== undefined ? formatRp(dayCalc.tl) : '–'}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="font-semibold text-[#13222b]">Pengeluaran dari omset (−)</div>
                      <div className="text-[11px] text-[#64748b]">diambil dari tunai</div>
                    </div>
                    <strong className="font-mono-num font-bold text-[#dc2626]">
                      {formatRp(dayCalc.bx)}
                    </strong>
                  </div>
                </div>

                <div
                  className={`border-y border-[#edf2f0] px-5 py-3.5 ${
                    dayCalc.akhir < 0 ? 'bg-[#fef2f2]' : 'bg-[#f2fbf6]'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div
                      className={`text-xs font-semibold ${
                        dayCalc.akhir < 0 ? 'text-[#dc2626]' : 'text-[#15803d]'
                      }`}
                    >
                      Tunai Akhir Hari Ini
                    </div>
                    <div
                      className={`font-mono-num text-lg font-bold ${
                        dayCalc.akhir < 0 ? 'text-[#dc2626]' : 'text-[#15803d]'
                      }`}
                    >
                      {formatRp(dayCalc.akhir)}
                    </div>
                  </div>
                  <div
                    className={`mt-0.5 text-[11px] ${
                      dayCalc.akhir < 0 ? 'font-semibold text-[#dc2626]' : 'text-[#475569]'
                    }`}
                  >
                    {dayCalc.akhir < 0
                      ? 'Pengeluaran melebihi tunai di laci hari ini'
                      : 'Tunai laci − pengeluaran omset'}
                  </div>
                </div>

                <div className="px-5 pt-4 pb-1">
                  <h3 className="text-xs font-bold text-[#475569]">
                    Akumulasi Periode {dayPeriod} · Tanggal {dayPeriodStats.from}–
                    {dayPeriodStats.to} {monthName}
                  </h3>
                </div>

                <div className="divide-y divide-[#edf2f0] px-5 text-[13px]">
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[#475569]">Tunai di laci</span>
                    <strong className="font-mono-num font-bold text-[#13222b]">
                      {formatRp(dayPeriodStats.totals.tl)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-[#475569]">Pengeluaran dari omset (−)</span>
                    <strong className="font-mono-num font-bold text-[#dc2626]">
                      {formatRp(dayPeriodStats.totals.bx)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <span className="text-[#475569]">Gaji karyawan (−)</span>
                      <div className="text-[11px] text-[#64748b]">otomatis dari Absensi</div>
                    </div>
                    <strong className="font-mono-num font-bold text-[#dc2626]">
                      {formatRp(dayPeriodStats.totals.gaji)}
                    </strong>
                  </div>
                </div>

                <div
                  className={`border-t border-[#edf2f0] px-5 py-3.5 ${
                    dayPeriodStats.totals.tunaiAkhir < 0 ? 'bg-[#fef2f2]' : 'bg-[#f2fbf6]'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div
                      className={`text-xs font-semibold ${
                        dayPeriodStats.totals.tunaiAkhir < 0 ? 'text-[#dc2626]' : 'text-[#15803d]'
                      }`}
                    >
                      Tunai Akhir Periode {dayPeriod}
                    </div>
                    <div
                      className={`font-mono-num text-lg font-bold ${
                        dayPeriodStats.totals.tunaiAkhir < 0 ? 'text-[#dc2626]' : 'text-[#15803d]'
                      }`}
                    >
                      {formatRp(dayPeriodStats.totals.tunaiAkhir)}
                    </div>
                  </div>
                  <div
                    className={`mt-0.5 text-[11px] ${
                      dayPeriodStats.totals.tunaiAkhir < 0
                        ? 'font-semibold text-[#dc2626]'
                        : 'text-[#475569]'
                    }`}
                  >
                    {dayPeriodStats.totals.tunaiAkhir < 0
                      ? 'Negatif: pengeluaran omset & gaji melebihi tunai laci periode ini'
                      : 'Setelah pengeluaran omset & gaji periode ini'}
                  </div>
                </div>
              </section>
            </div>

            {/* RIWAYAT PENGELUARAN BULAN INI */}
            <section className="overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf2f0] px-5 py-4">
                <div>
                  <h2 className="font-display text-[15px] font-bold text-[#13222b]">
                    Riwayat Pengeluaran — {monthName} {yearNum}
                  </h2>
                  <p className="text-xs text-[#64748b]">
                    Klik baris untuk langsung membuka tanggal tersebut.
                  </p>
                </div>

                <div className="flex items-center gap-1 rounded-xl bg-[#f3f7f5] p-1">
                  {(
                    [
                      { id: 'bx', label: `Dari Omset (${expenseHistory.bxEntries.length})` },
                      { id: 'kx', label: `Harian Nota (${expenseHistory.kxEntries.length})` },
                      {
                        id: 'all',
                        label: `Semua (${expenseHistory.bxEntries.length + expenseHistory.kxEntries.length})`,
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setHistoryFilter(opt.id)}
                      className={`h-7 shrink-0 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                        historyFilter === opt.id
                          ? 'bg-[#2eb86b] text-white shadow-xs'
                          : 'text-[#64748b] hover:text-[#13222b]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {displayedExpenseHistory.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#64748b]">
                  Belum ada catatan pengeluaran untuk filter ini pada {monthName} {yearNum}.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#edf2f0] bg-[#f7faf9] text-[11px] font-bold uppercase tracking-[0.04em] text-[#64748b]">
                        <th className="w-16 px-4 py-2.5 text-center">Tgl</th>
                        <th className="w-36 px-4 py-2.5 text-left">Jenis</th>
                        <th className="px-4 py-2.5 text-left">Keterangan</th>
                        <th className="w-36 px-4 py-2.5 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2f0]">
                      {displayedExpenseHistory.map((e, i) => (
                        <tr
                          key={`${e.dateKey}-${e.kind}-${i}`}
                          onClick={() => {
                            setMonthAndDay(ym, e.day);
                            if (e.kind === 'kx') setOmSub('harian');
                          }}
                          title={`Buka tanggal ${e.day}`}
                          className="cursor-pointer transition hover:bg-[#f7faf9]"
                        >
                          <td className="font-mono-num px-4 py-2.5 text-center font-bold text-[#13222b]">
                            {e.day}
                          </td>
                          <td className="px-4 py-2.5 text-[#475569]">
                            {e.kind === 'bx' ? 'Dari Omset' : 'Harian (Nota)'}
                          </td>
                          <td className="px-4 py-2.5 text-[#13222b]">
                            {e.keterangan || (
                              <span className="font-semibold text-[#dc2626]">
                                (tanpa keterangan)
                              </span>
                            )}
                          </td>
                          <td className="font-mono-num px-4 py-2.5 text-right font-bold text-[#13222b]">
                            {formatRp(e.nominal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#f7faf9] font-semibold text-[#13222b]">
                      <tr className="border-t border-[#edf2f0]">
                        <td colSpan={3} className="px-4 py-2 text-right text-[#475569]">
                          Periode 1 (1–15)
                        </td>
                        <td className="font-mono-num px-4 py-2 text-right">
                          {formatRp(
                            historyFilter === 'bx'
                              ? expenseHistory.bxP1
                              : historyFilter === 'kx'
                                ? expenseHistory.kxP1
                                : expenseHistory.bxP1 + expenseHistory.kxP1
                          )}
                        </td>
                      </tr>
                      <tr className="border-t border-[#edf2f0]">
                        <td colSpan={3} className="px-4 py-2 text-right text-[#475569]">
                          Periode 2 (16–{nd})
                        </td>
                        <td className="font-mono-num px-4 py-2 text-right">
                          {formatRp(
                            historyFilter === 'bx'
                              ? expenseHistory.bxP2
                              : historyFilter === 'kx'
                                ? expenseHistory.kxP2
                                : expenseHistory.bxP2 + expenseHistory.kxP2
                          )}
                        </td>
                      </tr>
                      <tr className="bg-[#0d2530] text-white">
                        <td colSpan={3} className="px-4 py-2.5 text-right font-bold">
                          Total Bulan {monthName} {yearNum}
                        </td>
                        <td className="font-mono-num px-4 py-2.5 text-right font-bold">
                          {formatRp(
                            historyFilter === 'bx'
                              ? expenseHistory.bxP1 + expenseHistory.bxP2
                              : historyFilter === 'kx'
                                ? expenseHistory.kxP1 + expenseHistory.kxP2
                                : expenseHistory.bxP1 +
                                    expenseHistory.bxP2 +
                                    expenseHistory.kxP1 +
                                    expenseHistory.kxP2
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ═══════════════════ TAB 3: KALENDER ═══════════════════ */}
        {omSub === 'kalender' && (
          <div className="mx-auto max-w-[1180px] space-y-4">
            {/* Floating 5-Column Monthly KPI Strip */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="grid grid-cols-2 divide-x divide-y divide-[#edf2f0] sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
                <div className="bg-[#f2fbf6] px-4 py-3.5">
                  <div className="text-[11.5px] font-semibold text-[#15803d]">
                    Omset bersih bulan ini
                  </div>
                  <div className="font-mono-num mt-1 text-base font-bold text-[#15803d]">
                    {formatRp(monthTotals.omset)}
                  </div>
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[11.5px] font-semibold text-[#64748b]">Dibawa kepala toko</div>
                  <div className="font-mono-num mt-1 text-base font-bold text-[#13222b]">
                    {formatRp(monthTotals.dibawaBeforeGaji)}
                  </div>
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[11.5px] font-semibold text-[#64748b]">Hari terisi</div>
                  <div className="font-mono-num mt-1 text-base font-bold text-[#13222b]">
                    {monthTotals.filled}{' '}
                    <span className="text-xs font-medium text-[#64748b]">/ {nd}</span>
                  </div>
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[11.5px] font-semibold text-[#64748b]">Selisih tunai</div>
                  <div
                    className={`font-mono-num mt-1 text-base font-bold ${
                      monthTotals.selT === 0
                        ? 'text-[#15803d]'
                        : monthTotals.selT < 0
                          ? 'text-[#dc2626]'
                          : 'text-[#b45309]'
                    }`}
                  >
                    {formatSignedRp(monthTotals.selT)}
                  </div>
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[11.5px] font-semibold text-[#64748b]">Selisih QRIS</div>
                  <div
                    className={`font-mono-num mt-1 text-base font-bold ${
                      monthTotals.selQ === 0
                        ? 'text-[#15803d]'
                        : monthTotals.selQ < 0
                          ? 'text-[#dc2626]'
                          : 'text-[#b45309]'
                    }`}
                  >
                    {formatSignedRp(monthTotals.selQ)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
              {/* Calendar Grid */}
              <div className="rounded-2xl bg-white p-4 shadow-[0_6px_24px_rgba(13,37,48,0.045)] sm:p-5">
                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_NAMES.map((dn, idx) => (
                    <div
                      key={dn}
                      className={`pb-1.5 text-center text-[11px] font-bold uppercase tracking-[0.04em] ${
                        idx === 0 ? 'text-[#dc2626]' : 'text-[#64748b]'
                      }`}
                    >
                      {dn.slice(0, 3)}
                    </div>
                  ))}

                  {Array.from({ length: getDayOfWeek(ym, 1) }, (_, idx) => (
                    <div key={`blank-${idx}`} className="h-[62px]" />
                  ))}

                  {Array.from({ length: nd }, (_, idx) => {
                    const d = idx + 1;
                    const key = formatDateKey(ym, d);
                    const rec = omState.days[key] || {};
                    const c = calcOmsetDay(rec);
                    const hasWarn = c.filled && ((c.selT || 0) !== 0 || (c.selQ || 0) !== 0);
                    const isSel = d === calSelDay;
                    const isTodayCell = key === todayParts.dateKey;
                    const hasNote = Boolean(String(rec.cn || '').trim());

                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setCalSelDay(d)}
                        title={`Tgl ${d}${c.filled ? `: ${formatRp(c.omset)}` : ''}`}
                        className={`relative flex h-[62px] flex-col items-center justify-center rounded-xl border px-1 text-center transition cursor-pointer ${
                          isSel
                            ? 'border-[#2eb86b] bg-[#e6f7ee] ring-2 ring-[#2eb86b]'
                            : c.filled
                              ? hasWarn
                                ? 'border-[#fcd34d] bg-[#fffbeb] hover:border-[#f59e0b]'
                                : 'border-[#bbf7d0] bg-[#f2fbf6] hover:border-[#2eb86b]'
                              : 'border-[#edf2f0] bg-[#f7faf9]/60 hover:border-[#cbd5e1] hover:bg-white'
                        }`}
                      >
                        <span
                          className={`font-mono-num text-xs font-bold ${
                            isTodayCell ? 'text-[#15803d] underline underline-offset-2' : 'text-[#13222b]'
                          }`}
                        >
                          {d}
                        </span>
                        <span className="font-mono-num mt-0.5 text-[11px] font-semibold text-[#475569]">
                          {c.filled ? formatOmsetShort(c.omset) : '–'}
                        </span>
                        {hasWarn && (
                          <span
                            className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#f59e0b]"
                            title="Ada selisih"
                          />
                        )}
                        {hasNote && (
                          <span
                            className="absolute top-1 left-1.5 text-[10px] text-[#475569]"
                            title="Ada catatan"
                          >
                            ✎
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[#edf2f0] pt-3 text-xs text-[#64748b]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded border border-[#bbf7d0] bg-[#f2fbf6]" />
                    Ada data
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded border border-[#fcd34d] bg-[#fffbeb]" />
                    Ada selisih
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded border border-[#edf2f0] bg-[#f7faf9]" />
                    Kosong
                  </span>
                  <span>✎ Ada catatan</span>
                </div>
              </div>

              {/* Right Panel: Selected Day Detail */}
              <aside className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                <div className="border-b border-[#edf2f0] px-5 py-4">
                  <h3 className="font-display text-[15px] font-bold text-[#13222b]">
                    {getFullDateLabel(ym, calSelDay)}
                  </h3>
                  <span
                    className={`mt-1 inline-block rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                      calClosed ? 'bg-[#e6f7ee] text-[#15803d]' : 'bg-[#fef3c7] text-[#b45309]'
                    }`}
                  >
                    Periode {calPeriod} · {calClosed ? 'Closed' : 'Terbuka'}
                  </span>
                </div>

                <div className="flex-1">
                  {!calCalc.filled ? (
                    <div className="px-5 py-8 text-center text-xs text-[#64748b]">
                      Belum ada data omset pada tanggal {calSelDay}.
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-[#edf2f0] px-5 text-xs">
                        <div className="flex justify-between py-2">
                          <span className="text-[#475569]">Tunai nota</span>
                          <strong className="font-mono-num text-[#13222b]">
                            {formatRp(calCalc.tn)}
                          </strong>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-[#475569]">QRIS nota</span>
                          <strong className="font-mono-num text-[#13222b]">
                            {formatRp(calCalc.qn)}
                          </strong>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-[#475569]">Pengeluaran harian</span>
                          <strong className="font-mono-num text-[#13222b]">
                            {formatRp(calCalc.kx)}
                          </strong>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-[#475569]">QRIS real (mBanking)</span>
                          <strong className="font-mono-num text-[#13222b]">
                            {calRecord.qr !== undefined ? formatRp(calCalc.qr) : '–'}
                          </strong>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-[#475569]">Tunai real di laci</span>
                          <strong className="font-mono-num text-[#13222b]">
                            {calRecord.tl !== undefined ? formatRp(calCalc.tl) : '–'}
                          </strong>
                        </div>
                        <div className="py-2">
                          <div className="flex justify-between">
                            <span className="text-[#475569]">Selisih tunai</span>
                            <DiffStatusText val={calCalc.selT} />
                          </div>
                          {Boolean(calCalc.selT) && calRecord.kt && (
                            <p className="mt-0.5 text-[11px] text-[#64748b]">{calRecord.kt}</p>
                          )}
                          <div className="mt-1.5 flex justify-between">
                            <span className="text-[#475569]">Selisih QRIS</span>
                            <DiffStatusText val={calCalc.selQ} />
                          </div>
                          {Boolean(calCalc.selQ) && calRecord.kq && (
                            <p className="mt-0.5 text-[11px] text-[#64748b]">{calRecord.kq}</p>
                          )}
                        </div>
                      </div>

                      {/* Flush 2-col summary strip */}
                      <div className="grid grid-cols-2 divide-x divide-[#edf2f0] border-y border-[#edf2f0]">
                        <div className="bg-[#f7faf9] px-4 py-3">
                          <div className="text-[11px] text-[#64748b]">Omset Bersih</div>
                          <div className="font-mono-num mt-0.5 text-sm font-bold text-[#13222b]">
                            {formatRp(calCalc.omset)}
                          </div>
                        </div>
                        <div
                          className={`px-4 py-3 ${
                            calCalc.akhir < 0 ? 'bg-[#fef2f2]' : 'bg-[#f2fbf6]'
                          }`}
                        >
                          <div
                            className={`text-[11px] ${
                              calCalc.akhir < 0 ? 'text-[#dc2626]' : 'text-[#15803d]'
                            }`}
                          >
                            Dibawa Kep. Toko
                          </div>
                          <div
                            className={`font-mono-num mt-0.5 text-sm font-bold ${
                              calCalc.akhir < 0 ? 'text-[#dc2626]' : 'text-[#15803d]'
                            }`}
                          >
                            {formatRp(calCalc.akhir)}
                          </div>
                        </div>
                      </div>

                      <div className="divide-y divide-[#edf2f0] px-5 text-xs">
                        <div className="flex justify-between py-2">
                          <span className="text-[#475569]">
                            Gaji ({calSalary.saved ? `${calSalary.h} hadir` : 'belum isi'})
                          </span>
                          <strong className="font-mono-num text-[#13222b]">
                            {formatRp(calSalary.tot)}
                          </strong>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-[#475569]">Sisa setelah gaji</span>
                          <strong className="font-mono-num text-[#13222b]">
                            {formatRp(calCalc.omset - calCalc.bx - calSalary.tot)}
                          </strong>
                        </div>
                      </div>
                    </>
                  )}

                  {calCalc.bx > 0 && (
                    <div className="border-t border-[#edf2f0] px-5 py-3 text-xs">
                      <div className="flex justify-between font-semibold text-[#13222b]">
                        <span>Pengeluaran dari omset</span>
                        <span className="font-mono-num text-[#dc2626]">
                          {formatRp(calCalc.bx)}
                        </span>
                      </div>
                      <ul className="mt-1 space-y-0.5 text-[11px] text-[#475569]">
                        {(calRecord.bx || []).map((e, i) => (
                          <li key={i} className="flex justify-between">
                            <span>{e.k || '(tanpa keterangan)'}</span>
                            <span className="font-mono-num">{formatRp(Number(e.v) || 0)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {String(calRecord.cn || '').trim() && (
                    <div className="border-t border-[#edf2f0] bg-[#f7faf9] px-5 py-3 text-xs text-[#475569]">
                      <strong className="block text-[11px] font-semibold text-[#64748b]">
                        Catatan
                      </strong>
                      {calRecord.cn}
                    </div>
                  )}
                </div>

                <div className="border-t border-[#edf2f0] p-4">
                  <button
                    type="button"
                    onClick={() => {
                      setMonthAndDay(ym, calSelDay);
                      setOmSub('harian');
                    }}
                    className="h-9 w-full rounded-xl bg-[#2eb86b] text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                  >
                    {calClosed
                      ? `Lihat Tanggal ${calSelDay}`
                      : calCalc.filled
                        ? `Buka / Ubah Tanggal ${calSelDay}`
                        : `Isi Data Tanggal ${calSelDay}`}
                  </button>
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* ═══════════════════ TAB 4: GRAFIK ═══════════════════ */}
        {omSub === 'grafik' && (
          <div className="mx-auto max-w-[1180px]">
            <OmsetChartPanel
              state={state}
              ym={ym}
              metricKey={chartMetric}
              onSelectDay={(d) => {
                setCalSelDay(d);
                setOmSub('kalender');
              }}
            />
          </div>
        )}

        {/* ═══════════════════ TAB 5: REKAP & CLOSING ═══════════════════ */}
        {omSub === 'rekap' && (
          <div className="mx-auto max-w-[1220px] space-y-4">
            {/* Status & Validation Banner */}
            {activeStats.closed ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#e6f7ee] px-4 py-3 text-xs text-[#15803d]">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#15803d]" />
                  <span>
                    <strong>Closed</strong> · {activeStats.label} dikunci pada{' '}
                    {new Date(activeStats.closed.at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}{' '}
                    oleh <strong>{activeStats.closed.by}</strong>.
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#fef3c7] px-4 py-3 text-xs text-[#92400e]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    <strong>{activeStats.label}</strong> · Terisi{' '}
                    <strong className="font-mono-num">
                      {activeStats.filled}/{activeStats.days}
                    </strong>{' '}
                    hari · Belum di-closing.
                  </span>
                  {activeValidation.noKetDays.length > 0 && (
                    <span className="font-bold text-[#b91c1c]">
                      · Keterangan selisih kosong: Tgl {activeValidation.noKetDays.join(', ')}
                    </span>
                  )}
                  {activeValidation.unlabelledExpenses.length > 0 && (
                    <span className="font-bold text-[#b91c1c]">
                      · {activeValidation.unlabelledExpenses.length} pengeluaran tanpa keterangan
                    </span>
                  )}
                </div>
                {activeValidation.noKetDays.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMonthAndDay(ym, activeValidation.noKetDays[0]);
                      setOmSub('harian');
                    }}
                    className="inline-flex items-center gap-1 font-bold text-[#b91c1c] underline underline-offset-2 whitespace-nowrap cursor-pointer"
                  >
                    <span>Lengkapi Tgl {activeValidation.noKetDays[0]}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* Floating 7-Column Period KPI Strip */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="grid grid-cols-2 divide-x divide-y divide-[#edf2f0] sm:grid-cols-4 lg:grid-cols-7 lg:divide-y-0">
                {[
                  {
                    label: 'Omset bersih',
                    val: formatRp(activeStats.totals.omset),
                    bg: 'bg-[#f2fbf6]',
                    text: 'text-[#15803d]',
                    lbl: 'text-[#15803d]',
                  },
                  {
                    label: 'Peng. omset',
                    val: formatRp(activeStats.totals.bx),
                    bg: '',
                    text: activeStats.totals.bx ? 'text-[#b45309]' : 'text-[#13222b]',
                    lbl: 'text-[#64748b]',
                  },
                  {
                    label: 'Selisih tunai',
                    val: formatSignedRp(activeStats.totals.selT),
                    bg: '',
                    text:
                      activeStats.totals.selT === 0
                        ? 'text-[#15803d]'
                        : activeStats.totals.selT < 0
                          ? 'text-[#dc2626]'
                          : 'text-[#b45309]',
                    lbl: 'text-[#64748b]',
                  },
                  {
                    label: 'Selisih QRIS',
                    val: formatSignedRp(activeStats.totals.selQ),
                    bg: '',
                    text:
                      activeStats.totals.selQ === 0
                        ? 'text-[#15803d]'
                        : activeStats.totals.selQ < 0
                          ? 'text-[#dc2626]'
                          : 'text-[#b45309]',
                    lbl: 'text-[#64748b]',
                  },
                  {
                    label: 'Total gaji',
                    val: formatRp(activeStats.totals.gaji),
                    bg: '',
                    text: 'text-[#13222b]',
                    lbl: 'text-[#64748b]',
                  },
                  {
                    label: 'Bersih stlh gaji',
                    val: formatRp(activeStats.totals.sisa),
                    bg: '',
                    text: activeStats.totals.sisa < 0 ? 'text-[#dc2626]' : 'text-[#15803d]',
                    lbl: 'text-[#64748b]',
                  },
                  {
                    label: 'Tunai akhir dibawa',
                    val: formatRp(activeStats.totals.tunaiAkhir),
                    bg: activeStats.totals.tunaiAkhir < 0 ? 'bg-[#fef2f2]' : 'bg-[#f2fbf6]',
                    text: activeStats.totals.tunaiAkhir < 0 ? 'text-[#dc2626]' : 'text-[#15803d]',
                    lbl: activeStats.totals.tunaiAkhir < 0 ? 'text-[#dc2626]' : 'text-[#15803d]',
                  },
                ].map((card) => (
                  <div key={card.label} className={`px-3.5 py-3.5 ${card.bg}`}>
                    <div className={`truncate text-[11px] font-semibold ${card.lbl}`}>
                      {card.label}
                    </div>
                    <div className={`font-mono-num mt-1 truncate text-[13.5px] font-bold ${card.text}`}>
                      {card.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expense Detail Inspector (when user clicks ? icon in table) */}
            {expenseDetailPopover && (() => {
              const targetRow = activeStats.rows.find((x) => x.d === expenseDetailPopover.day);
              const list = targetRow ? targetRow.r[expenseDetailPopover.kind] || [] : [];
              const filtered = list.filter((e) => (Number(e.v) || 0) > 0 || String(e.k || '').trim());
              return (
                <div className="rounded-2xl bg-white p-4 text-xs shadow-[0_6px_24px_rgba(13,37,48,0.06)]">
                  <div className="mb-2 flex items-center justify-between border-b border-[#edf2f0] pb-2">
                    <strong className="font-bold text-[#13222b]">
                      Rincian{' '}
                      {expenseDetailPopover.kind === 'bx'
                        ? 'Pengeluaran dari Omset'
                        : 'Pengeluaran Harian'}{' '}
                      — Tgl {expenseDetailPopover.day} {monthName}
                    </strong>
                    <button
                      type="button"
                      onClick={() => setExpenseDetailPopover(null)}
                      className="text-[#64748b] hover:text-[#13222b] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {filtered.map((e, i) => (
                      <div key={i} className="flex justify-between text-[#475569]">
                        <span>{String(e.k || '').trim() || '(tanpa keterangan)'}</span>
                        <span className="font-mono-num font-bold text-[#13222b]">
                          {formatRp(Number(e.v) || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Daily Table for Active Period */}
            <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#edf2f0] bg-[#f7faf9] text-[11px] font-bold uppercase tracking-[0.04em] text-[#64748b]">
                    <th className="w-14 px-2.5 py-3 text-center">Tgl</th>
                    <th className="px-2.5 py-3 text-right">Tunai nota</th>
                    <th className="px-2.5 py-3 text-right">QRIS nota</th>
                    <th className="px-2.5 py-3 text-right">Pengeluaran</th>
                    <th className="px-2.5 py-3 text-right">Peng. omset</th>
                    <th className="px-2.5 py-3 text-right">Sel. tunai</th>
                    <th className="px-2.5 py-3 text-right">Sel. QRIS</th>
                    <th className="px-2.5 py-3 text-right">Omset bersih</th>
                    <th className="px-2.5 py-3 text-right">Gaji</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf2f0]">
                  {activeStats.rows.map(({ d, r, c, g }) => {
                    const hasKxDetail = (r.kx || []).some(
                      (e) => (Number(e.v) || 0) > 0 || String(e.k || '').trim()
                    );
                    const hasBxDetail = (r.bx || []).some(
                      (e) => (Number(e.v) || 0) > 0 || String(e.k || '').trim()
                    );
                    return (
                      <tr
                        key={d}
                        onClick={() => {
                          setMonthAndDay(ym, d);
                          setOmSub('harian');
                        }}
                        title={`Klik untuk buka Tgl ${d}`}
                        className={`cursor-pointer transition hover:bg-[#f7faf9] ${
                          !c.filled && !c.bx ? 'text-[#94a3b8]' : 'text-[#13222b]'
                        }`}
                      >
                        <td className="px-2.5 py-2.5 text-center font-bold">
                          <span className="font-mono-num">{d}</span>
                          {String(r.cn || '').trim() && (
                            <span title={r.cn} className="ml-1 text-[10px] text-[#475569]">
                              ✎
                            </span>
                          )}
                        </td>
                        <td className="font-mono-num px-2.5 py-2.5 text-right">
                          {c.filled ? formatNum(c.tn) : '–'}
                        </td>
                        <td className="font-mono-num px-2.5 py-2.5 text-right">
                          {c.filled ? formatNum(c.qn) : '–'}
                        </td>
                        <td className="font-mono-num px-2.5 py-2.5 text-right">
                          <span className="inline-flex items-center justify-end gap-1">
                            {hasKxDetail && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpenseDetailPopover({ day: d, kind: 'kx' });
                                }}
                                title="Lihat rincian pengeluaran harian"
                                className="text-[#2eb86b] hover:text-[#15803d] cursor-pointer"
                              >
                                <HelpCircle className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <span>{c.filled ? formatNum(c.kx) : '–'}</span>
                          </span>
                        </td>
                        <td className="font-mono-num px-2.5 py-2.5 text-right">
                          <span className="inline-flex items-center justify-end gap-1">
                            {hasBxDetail && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpenseDetailPopover({ day: d, kind: 'bx' });
                                }}
                                title="Lihat rincian pengeluaran omset"
                                className="text-[#f59e0b] hover:text-[#b45309] cursor-pointer"
                              >
                                <HelpCircle className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <span>{c.bx ? formatNum(c.bx) : '–'}</span>
                          </span>
                        </td>
                        <td
                          className={`font-mono-num px-2.5 py-2.5 text-right ${
                            (c.selT || 0) > 0
                              ? 'font-bold text-[#b45309]'
                              : (c.selT || 0) < 0
                                ? 'font-bold text-[#dc2626]'
                                : ''
                          }`}
                        >
                          <div>
                            {c.selT === null ? '–' : formatSignedRp(c.selT).replace('Rp ', '')}
                          </div>
                          {Boolean(c.selT) && r.kt && (
                            <div className="ml-auto max-w-[140px] truncate font-sans text-[10px] font-medium text-[#64748b]">
                              {r.kt}
                            </div>
                          )}
                        </td>
                        <td
                          className={`font-mono-num px-2.5 py-2.5 text-right ${
                            (c.selQ || 0) > 0
                              ? 'font-bold text-[#b45309]'
                              : (c.selQ || 0) < 0
                                ? 'font-bold text-[#dc2626]'
                                : ''
                          }`}
                        >
                          <div>
                            {c.selQ === null ? '–' : formatSignedRp(c.selQ).replace('Rp ', '')}
                          </div>
                          {Boolean(c.selQ) && r.kq && (
                            <div className="ml-auto max-w-[140px] truncate font-sans text-[10px] font-medium text-[#64748b]">
                              {r.kq}
                            </div>
                          )}
                        </td>
                        <td className="font-mono-num px-2.5 py-2.5 text-right font-bold">
                          {c.filled ? formatNum(c.omset) : '–'}
                        </td>
                        <td className="font-mono-num px-2.5 py-2.5 text-right">
                          {g.tot ? formatNum(g.tot) : '–'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#0d2530] font-bold text-white">
                    <td className="px-2.5 py-3 text-center">Total</td>
                    <td className="font-mono-num px-2.5 py-3 text-right">
                      {formatNum(activeStats.totals.tn)}
                    </td>
                    <td className="font-mono-num px-2.5 py-3 text-right">
                      {formatNum(activeStats.totals.qn)}
                    </td>
                    <td className="font-mono-num px-2.5 py-3 text-right">
                      {formatNum(activeStats.totals.kx)}
                    </td>
                    <td className="font-mono-num px-2.5 py-3 text-right">
                      {formatNum(activeStats.totals.bx)}
                    </td>
                    <td className="font-mono-num px-2.5 py-3 text-right">
                      {formatSignedRp(activeStats.totals.selT).replace('Rp ', '')}
                    </td>
                    <td className="font-mono-num px-2.5 py-3 text-right">
                      {formatSignedRp(activeStats.totals.selQ).replace('Rp ', '')}
                    </td>
                    <td className="font-mono-num px-2.5 py-3 text-right">
                      {formatNum(activeStats.totals.omset)}
                    </td>
                    <td className="font-mono-num px-2.5 py-3 text-right">
                      {formatNum(activeStats.totals.gaji)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Side-by-Side Comparison Panels: Active Period vs Full Month (P1 + P2) */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[
                {
                  title: activeStats.label,
                  accent: false,
                  data: {
                    omset: activeStats.totals.omset,
                    bx: activeStats.totals.bx,
                    gaji: activeStats.totals.gaji,
                    sisa: activeStats.totals.sisa,
                    tl: activeStats.totals.tl,
                    tunaiAkhir: activeStats.totals.tunaiAkhir,
                  },
                },
                {
                  title: `Total Bulan ${monthName} ${yearNum} (P1 + P2)`,
                  accent: true,
                  data: {
                    omset: monthTotals.omset,
                    bx: monthTotals.bx,
                    gaji: monthTotals.gaji,
                    sisa: monthTotals.sisa,
                    tl: monthTotals.tl,
                    tunaiAkhir: monthTotals.tunaiAkhir,
                  },
                },
              ].map((box) => (
                <div
                  key={box.title}
                  className={`rounded-2xl p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)] ${
                    box.accent ? 'bg-[#f2fbf6]' : 'bg-white'
                  }`}
                >
                  <h3 className="font-display mb-3 text-[15px] font-bold text-[#13222b]">
                    {box.title}
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#475569]">Omset bersih</span>
                      <strong className="font-mono-num font-bold text-[#13222b]">
                        {formatRp(box.data.omset)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#475569]">Pengeluaran omset (−)</span>
                      <strong className="font-mono-num font-bold text-[#13222b]">
                        {formatRp(box.data.bx)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#475569]">Gaji karyawan (−)</span>
                      <strong className="font-mono-num font-bold text-[#13222b]">
                        {formatRp(box.data.gaji)}
                      </strong>
                    </div>
                    <div className="flex justify-between border-t border-[#dce6e2] pt-2 text-[13px] font-bold">
                      <span className="text-[#13222b]">Nilai bersih setelah gaji</span>
                      <span
                        className={`font-mono-num ${
                          box.data.sisa < 0 ? 'text-[#dc2626]' : 'text-[#15803d]'
                        }`}
                      >
                        {formatRp(box.data.sisa)}
                      </span>
                    </div>

                    <div className="flex justify-between pt-3">
                      <span className="text-[#475569]">Tunai di laci</span>
                      <strong className="font-mono-num font-bold text-[#13222b]">
                        {formatRp(box.data.tl)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#475569]">Pengeluaran omset (−)</span>
                      <strong className="font-mono-num font-bold text-[#13222b]">
                        {formatRp(box.data.bx)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#475569]">Gaji karyawan (−)</span>
                      <strong className="font-mono-num font-bold text-[#13222b]">
                        {formatRp(box.data.gaji)}
                      </strong>
                    </div>
                    <div className="flex items-start justify-between border-t border-[#dce6e2] pt-2 text-[13px] font-bold">
                      <div>
                        <span className="text-[#13222b]">Tunai akhir dibawa kepala toko</span>
                        <span
                          className={`block text-[11px] font-medium ${
                            box.data.tunaiAkhir < 0
                              ? 'font-semibold text-[#dc2626]'
                              : 'text-[#64748b]'
                          }`}
                        >
                          {box.data.tunaiAkhir < 0
                            ? 'Negatif: pengeluaran omset & gaji melebihi tunai laci'
                            : 'setelah pengeluaran omset & gaji'}
                        </span>
                      </div>
                      <span
                        className={`font-mono-num ${
                          box.data.tunaiAkhir < 0 ? 'text-[#dc2626]' : 'text-[#15803d]'
                        }`}
                      >
                        {formatRp(box.data.tunaiAkhir)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── FLOATING BOTTOM ACTION FOOTER BAR ── */}
      {(omSub === 'harian' || omSub === 'pengeluaran' || omSub === 'rekap') && (
        <div className="no-print mx-4 mb-3 shrink-0 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-2.5 shadow-[0_6px_22px_rgba(13,37,48,0.06)] md:mx-6 md:px-5">
          {omSub === 'rekap' ? (
            <>
              <span className="text-xs text-[#64748b]">
                Klik baris tanggal untuk membuka rincian di tab Harian.
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportPeriodCsv(activePeriod)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] whitespace-nowrap cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-[#2eb86b]" />
                  <span>Unduh CSV P{activePeriod}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] whitespace-nowrap cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Cetak</span>
                </button>
                {!isViewer &&
                  (activeStats.closed ? (
                    <button
                      type="button"
                      onClick={() => setReopenModalPeriod(activePeriod)}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#fee2e2] px-3.5 text-xs font-semibold text-[#b91c1c] transition hover:bg-[#fecaca] whitespace-nowrap cursor-pointer"
                    >
                      <LockOpen className="h-3.5 w-3.5" />
                      <span>Buka Closing</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setClosingModalPeriod(activePeriod)}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] whitespace-nowrap cursor-pointer"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>Closing Periode {activePeriod}</span>
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <>
              <span
                className={`text-xs font-semibold ${
                  hasUnsavedOmset
                    ? 'text-[#b45309]'
                    : sync.isError
                      ? 'text-[#dc2626]'
                      : 'text-[#64748b]'
                }`}
              >
                {hasUnsavedOmset
                  ? 'Ada perubahan omset belum disimpan'
                  : dayClosingRec
                    ? 'Periode ini sudah closing (terkunci)'
                    : sync.text}
              </span>
              <div className="flex items-center gap-2">
                {omSub === 'harian' && (
                  <button
                    type="button"
                    onClick={() => {
                      setOmPeriod(dayPeriod);
                      setOmSub('rekap');
                    }}
                    className="h-9 shrink-0 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] whitespace-nowrap cursor-pointer"
                  >
                    Rekap Periode {dayPeriod}
                  </button>
                )}
                {!isDayLocked && (
                  <button
                    type="button"
                    disabled={sync.isSyncing}
                    onClick={handleSaveOmset}
                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-white transition disabled:opacity-65 whitespace-nowrap cursor-pointer ${
                      hasUnsavedOmset
                        ? 'bg-[#f59e0b] hover:bg-[#d97706]'
                        : 'bg-[#2eb86b] hover:bg-[#259f5b]'
                    }`}
                  >
                    {sync.isSyncing ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    <span>{hasUnsavedOmset ? 'Simpan Perubahan' : 'Simpan Omset'}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MODAL: KONFIRMASI & VALIDASI CLOSING PERIODE ── */}
      {closingModalPeriod && closingValidation && (
        <div
          className="fixed inset-0 z-[960] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setClosingModalPeriod(null);
          }}
        >
          <div className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="flex items-center justify-between border-b border-[#edf2f0] px-5 py-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-[#2eb86b]" />
                <h3 className="font-display text-base font-bold text-[#13222b]">
                  Closing {closingValidation.stats.label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setClosingModalPeriod(null)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 p-5 text-xs">
              {!closingValidation.canClose && (
                <div className="rounded-xl bg-[#fee2e2] p-3.5 text-[#991b1b]">
                  <div className="mb-1.5 flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Closing belum dapat dilakukan</span>
                  </div>
                  {closingValidation.noKetDays.length > 0 && (
                    <div className="mb-2">
                      <p>
                        Keterangan selisih tunai/QRIS belum diisi pada tanggal:{' '}
                        <strong>{closingValidation.noKetDays.join(', ')}</strong>.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const targetDay = closingValidation.noKetDays[0];
                          setClosingModalPeriod(null);
                          setMonthAndDay(ym, targetDay);
                          setOmSub('harian');
                        }}
                        className="mt-1 font-bold underline cursor-pointer"
                      >
                        Buka Tanggal {closingValidation.noKetDays[0]} untuk melengkapi
                      </button>
                    </div>
                  )}
                  {closingValidation.unlabelledExpenses.length > 0 && (
                    <div>
                      <p>
                        Terdapat {closingValidation.unlabelledExpenses.length} pengeluaran tanpa
                        keterangan (mis. Tgl {closingValidation.unlabelledExpenses[0].day}).
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const first = closingValidation.unlabelledExpenses[0];
                          setClosingModalPeriod(null);
                          setMonthAndDay(ym, first.day);
                          setOmSub(first.kind === 'bx' ? 'pengeluaran' : 'harian');
                        }}
                        className="mt-1 font-bold underline cursor-pointer"
                      >
                        Lengkapi Keterangan Tgl {closingValidation.unlabelledExpenses[0].day}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {closingValidation.canClose &&
                (closingValidation.isPeriodNotEnded || closingValidation.missingDays.length > 0) && (
                  <div className="rounded-xl bg-[#fef3c7] p-3.5 text-[#92400e]">
                    <div className="mb-1 flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Perhatian sebelum mengunci periode</span>
                    </div>
                    <ul className="list-disc space-y-1 pl-4">
                      {closingValidation.isPeriodNotEnded && (
                        <li>Periode ini belum berakhir secara kalender.</li>
                      )}
                      {closingValidation.missingDays.length > 0 && (
                        <li>
                          {closingValidation.missingDays.length} hari belum diisi (Tgl{' '}
                          {closingValidation.missingDays.join(', ')}).
                        </li>
                      )}
                    </ul>
                  </div>
                )}

              <div className="space-y-1.5 rounded-xl border border-[#edf2f0] bg-[#f7faf9] p-3.5">
                <div className="flex justify-between">
                  <span className="text-[#475569]">Omset bersih</span>
                  <strong className="font-mono-num text-[#13222b]">
                    {formatRp(closingValidation.stats.totals.omset)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#475569]">Pengeluaran dari omset</span>
                  <strong className="font-mono-num text-[#13222b]">
                    {formatRp(closingValidation.stats.totals.bx)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#475569]">Gaji karyawan (dari Absensi)</span>
                  <strong className="font-mono-num text-[#13222b]">
                    {formatRp(closingValidation.stats.totals.gaji)}
                  </strong>
                </div>
                <div className="flex justify-between border-t border-[#dce6e2] pt-2 text-[13px] font-bold">
                  <span className="text-[#13222b]">Tunai akhir dibawa kepala toko</span>
                  <span
                    className={`font-mono-num ${
                      closingValidation.stats.totals.tunaiAkhir < 0
                        ? 'text-[#dc2626]'
                        : 'text-[#15803d]'
                    }`}
                  >
                    {formatRp(closingValidation.stats.totals.tunaiAkhir)}
                  </span>
                </div>
              </div>

              <p className="text-[#475569]">
                Setelah di-closing, seluruh input pada periode ini akan{' '}
                <strong className="text-[#13222b]">dikunci</strong> agar tidak dapat diubah tanpa
                mekanisme Buka Closing.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-5 py-3.5">
              <button
                type="button"
                onClick={() => setClosingModalPeriod(null)}
                className="h-9 rounded-xl bg-white px-4 text-xs font-semibold text-[#13222b] shadow-xs transition hover:bg-[#e1ebe7] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!closingValidation.canClose}
                onClick={handleConfirmClose}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Kunci &amp; Closing Periode {closingModalPeriod}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: KONFIRMASI BUKA CLOSING (REOPEN) ── */}
      {reopenModalPeriod && (
        <div
          className="fixed inset-0 z-[960] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReopenModalPeriod(null);
          }}
        >
          <div className="w-full max-w-[440px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="flex items-center justify-between border-b border-[#edf2f0] px-5 py-4">
              <div className="flex items-center gap-2">
                <LockOpen className="h-4 w-4 text-[#ef4444]" />
                <h3 className="font-display text-base font-bold text-[#13222b]">
                  Buka Kembali Closing Periode {reopenModalPeriod}?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReopenModalPeriod(null)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 text-xs leading-relaxed text-[#475569]">
              Membuka kembali closing akan melepas kunci pada{' '}
              <strong className="text-[#13222b]">
                Periode {reopenModalPeriod} ({monthName} {yearNum})
              </strong>{' '}
              sehingga data harian dan pengeluaran periode ini dapat diubah kembali. Pastikan untuk
              melakukan closing ulang setelah selesai koreksi.
            </div>

            <div className="flex justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-5 py-3.5">
              <button
                type="button"
                onClick={() => setReopenModalPeriod(null)}
                className="h-9 rounded-xl bg-white px-4 text-xs font-semibold text-[#13222b] shadow-xs transition hover:bg-[#e1ebe7] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReopen}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#ef4444] px-4 text-xs font-semibold text-white transition hover:bg-[#dc2626] cursor-pointer"
              >
                <LockOpen className="h-3.5 w-3.5" />
                <span>Ya, Buka Closing</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
