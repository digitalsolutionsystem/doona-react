import { MONTH_NAMES } from '../constants/defaults';
import type {
  AppData,
  OmsetClosingRecord,
  OmsetDayRecord,
  OmsetState,
} from '../types/app';
import { getDailySalaryForDate } from './attendanceCalculations';
import { formatDateKey, getDaysInMonth, getMonth, getTodayParts, getYear } from './dateUtils';

const EMPTY_OMSET: OmsetState = { days: {}, closing: {} };

export function getOmsetState(state: AppData): OmsetState {
  if (!state.omset) return EMPTY_OMSET;
  return {
    days: state.omset.days || {},
    closing: state.omset.closing || {},
  };
}

const omN = (v: unknown): number => Number(v) || 0;
const omDef = (v: unknown): boolean => v !== undefined && v !== null && v !== '';

export function getPeriodOfDay(day: number): 1 | 2 {
  return day <= 15 ? 1 : 2;
}

export function getOmsetClosing(
  state: AppData,
  ym: string,
  period: 1 | 2
): OmsetClosingRecord | null {
  return getOmsetState(state).closing[`${ym}-P${period}`] || null;
}

export interface OmsetDayCalc {
  tn: number;
  qn: number;
  kx: number;
  bx: number;
  exp: number;
  selT: number | null;
  selQ: number | null;
  tl: number;
  qr: number;
  akhir: number;
  kotor: number;
  omset: number;
  filled: boolean;
}

/** Rumus perhitungan omset harian (identik dengan omCalc(r) di HTML lama) */
export function calcOmsetDay(r?: OmsetDayRecord): OmsetDayCalc {
  const rec = r || {};
  const kx = (rec.kx || []).reduce((acc, x) => acc + omN(x.v), 0);
  const bx = (rec.bx || []).reduce((acc, x) => acc + omN(x.v), 0);
  const tn = omN(rec.tn);
  const qn = omN(rec.qn);
  const exp = tn - kx;
  const selT = omDef(rec.tl) ? omN(rec.tl) - exp : null;
  const selQ = omDef(rec.qr) ? omN(rec.qr) - qn : null;
  const tl = omN(rec.tl);
  const qr = omN(rec.qr);

  return {
    tn,
    qn,
    kx,
    bx,
    exp,
    selT,
    selQ,
    tl,
    qr,
    akhir: tl - bx,
    kotor: tn + qn,
    omset: tl + qr,
    filled: omDef(rec.tn) || omDef(rec.qn) || omDef(rec.qr) || omDef(rec.tl) || kx > 0,
  };
}

export interface OmsetPeriodTotals {
  tn: number;
  qn: number;
  kx: number;
  bx: number;
  qr: number;
  tl: number;
  selT: number;
  selQ: number;
  omset: number;
  gaji: number;
  sisa: number;
  akhir: number;
  tunaiAkhir: number;
}

export interface OmsetPeriodRow {
  d: number;
  key: string;
  r: OmsetDayRecord;
  c: OmsetDayCalc;
  g: { tot: number; h: number; saved: boolean };
}

export interface OmsetPeriodStats {
  ym: string;
  period: 1 | 2;
  from: number;
  to: number;
  nd: number;
  rows: OmsetPeriodRow[];
  totals: OmsetPeriodTotals;
  noKet: number[];
  missing: number[];
  filled: number;
  days: number;
  label: string;
  closed: OmsetClosingRecord | null;
}

/** Rumus rekap periode omset (identik dengan omStats(y, p) di HTML lama) */
export function getOmsetPeriodStats(
  state: AppData,
  ym: string,
  period: 1 | 2
): OmsetPeriodStats {
  const mo = getMonth(ym);
  const yr = getYear(ym);
  const nd = getDaysInMonth(ym);
  const from = period === 1 ? 1 : 16;
  const to = period === 1 ? Math.min(15, nd) : nd;
  const todayKey = getTodayParts().dateKey;
  const daysMap = getOmsetState(state).days;

  const totals: OmsetPeriodTotals = {
    tn: 0,
    qn: 0,
    kx: 0,
    bx: 0,
    qr: 0,
    tl: 0,
    selT: 0,
    selQ: 0,
    omset: 0,
    gaji: 0,
    sisa: 0,
    akhir: 0,
    tunaiAkhir: 0,
  };

  const rows: OmsetPeriodRow[] = [];
  const noKet: number[] = [];
  const missing: number[] = [];
  let filled = 0;

  for (let d = from; d <= to; d++) {
    const key = formatDateKey(ym, d);
    const r = daysMap[key] || {};
    const c = calcOmsetDay(r);
    const g = getDailySalaryForDate(state, ym, d);

    rows.push({ d, key, r, c, g });
    totals.gaji += g.tot;
    totals.bx += c.bx;

    if (c.filled) {
      filled++;
      totals.tn += c.tn;
      totals.qn += c.qn;
      totals.kx += c.kx;
      totals.qr += c.qr;
      totals.tl += c.tl;
      totals.omset += c.omset;
      totals.selT += c.selT || 0;
      totals.selQ += c.selQ || 0;
      if (
        (c.selT && !String(r.kt || '').trim()) ||
        (c.selQ && !String(r.kq || '').trim())
      ) {
        noKet.push(d);
      }
    } else if (key <= todayKey) {
      missing.push(d);
    }
  }

  totals.sisa = totals.omset - totals.bx - totals.gaji;
  totals.akhir = totals.tl - totals.bx;
  totals.tunaiAkhir = totals.akhir - totals.gaji;

  return {
    ym,
    period,
    from,
    to,
    nd,
    rows,
    totals,
    noKet,
    missing,
    filled,
    days: to - from + 1,
    label: `Periode ${period} (${from}–${to} ${MONTH_NAMES[mo - 1]} ${yr})`,
    closed: getOmsetClosing(state, ym, period),
  };
}

export interface OmsetMonthSummary {
  p1: OmsetPeriodStats;
  p2: OmsetPeriodStats;
  omsetBersih: number;
  pengeluaranHarian: number;
  pengeluaranOmset: number;
  totalPengeluaran: number;
  totalGaji: number;
  sisaSetelahGaji: number;
  tunaiLaci: number;
  tunaiAkhirKepalaToko: number;
  selisihTunai: number;
  selisihQris: number;
  filledDays: number;
  totalDays: number;
  missingDays: number[];
  noKetDays: number[];
  todayCalc: OmsetDayCalc;
}

export function getOmsetMonthSummary(
  state: AppData,
  ym: string,
  today: number
): OmsetMonthSummary {
  const p1 = getOmsetPeriodStats(state, ym, 1);
  const p2 = getOmsetPeriodStats(state, ym, 2);

  const omsetBersih = p1.totals.omset + p2.totals.omset;
  const pengeluaranHarian = p1.totals.kx + p2.totals.kx;
  const pengeluaranOmset = p1.totals.bx + p2.totals.bx;
  const totalPengeluaran = pengeluaranHarian + pengeluaranOmset;
  const totalGaji = p1.totals.gaji + p2.totals.gaji;
  const tunaiLaci = p1.totals.tl + p2.totals.tl;
  const sisaSetelahGaji = omsetBersih - pengeluaranOmset - totalGaji;
  const tunaiAkhirKepalaToko = tunaiLaci - pengeluaranOmset - totalGaji;

  const todayRecord = getOmsetState(state).days[formatDateKey(ym, today)];
  const todayCalc = calcOmsetDay(todayRecord);

  return {
    p1,
    p2,
    omsetBersih,
    pengeluaranHarian,
    pengeluaranOmset,
    totalPengeluaran,
    totalGaji,
    sisaSetelahGaji,
    tunaiLaci,
    tunaiAkhirKepalaToko,
    selisihTunai: p1.totals.selT + p2.totals.selT,
    selisihQris: p1.totals.selQ + p2.totals.selQ,
    filledDays: p1.filled + p2.filled,
    totalDays: p1.nd,
    missingDays: [...p1.missing, ...p2.missing],
    noKetDays: [...p1.noKet, ...p2.noKet],
    todayCalc,
  };
}

export function formatSignedRp(v: number | null | undefined): string {
  if (v == null) return '–';
  if (v === 0) return 'Sesuai';
  return `${v > 0 ? '+' : '−'}Rp ${Math.abs(v).toLocaleString('id-ID')}`;
}

export function formatRpDigits(v: number | undefined | null): string {
  if (v === undefined || v === null) return '';
  return Number(v).toLocaleString('id-ID');
}

export function parseRpDigits(raw: string): number | undefined {
  const digits = String(raw || '')
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '');
  if (digits === '') return undefined;
  return Number(digits);
}

export function formatOmsetShort(v: number): string {
  const num = Number(v) || 0;
  const a = Math.abs(num);
  const sg = num < 0 ? '-' : '';
  if (a >= 1e6) {
    return `${sg}${(a / 1e6).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}jt`;
  }
  if (a >= 1e3) {
    return `${sg}${Math.round(a / 1e3)}rb`;
  }
  return `${sg}${a}`;
}

export interface OmsetExpenseHistoryEntry {
  day: number;
  dateKey: string;
  period: 1 | 2;
  kind: 'bx' | 'kx';
  keterangan: string;
  nominal: number;
}

export interface OmsetExpenseHistorySummary {
  bxEntries: OmsetExpenseHistoryEntry[];
  kxEntries: OmsetExpenseHistoryEntry[];
  bxP1: number;
  bxP2: number;
  kxP1: number;
  kxP2: number;
}

/** Mengambil seluruh riwayat pengeluaran OMSET (bx dan kx) dalam 1 bulan */
export function getOmsetMonthlyExpenseHistory(
  state: AppData,
  ym: string
): OmsetExpenseHistorySummary {
  const nd = getDaysInMonth(ym);
  const daysMap = getOmsetState(state).days;
  const bxEntries: OmsetExpenseHistoryEntry[] = [];
  const kxEntries: OmsetExpenseHistoryEntry[] = [];

  for (let d = 1; d <= nd; d++) {
    const dateKey = formatDateKey(ym, d);
    const rec = daysMap[dateKey];
    if (!rec) continue;
    const period = getPeriodOfDay(d);

    (rec.bx || []).forEach((e) => {
      const val = Number(e.v) || 0;
      const ket = String(e.k || '').trim();
      if (val > 0 || ket) {
        bxEntries.push({ day: d, dateKey, period, kind: 'bx', keterangan: ket, nominal: val });
      }
    });

    (rec.kx || []).forEach((e) => {
      const val = Number(e.v) || 0;
      const ket = String(e.k || '').trim();
      if (val > 0 || ket) {
        kxEntries.push({ day: d, dateKey, period, kind: 'kx', keterangan: ket, nominal: val });
      }
    });
  }

  const p1 = getOmsetPeriodStats(state, ym, 1).totals;
  const p2 = getOmsetPeriodStats(state, ym, 2).totals;

  return {
    bxEntries,
    kxEntries,
    bxP1: p1.bx,
    bxP2: p2.bx,
    kxP1: p1.kx,
    kxP2: p2.kx,
  };
}

export interface OmsetClosingValidation {
  stats: OmsetPeriodStats;
  noKetDays: number[];
  missingDays: number[];
  unlabelledExpenses: Array<{ day: number; kind: 'kx' | 'bx'; nominal: number }>;
  isPeriodNotEnded: boolean;
  canClose: boolean;
}

/** Validasi kelengkapan data sebelum closing periode OMSET */
export function getOmsetClosingValidation(
  state: AppData,
  ym: string,
  period: 1 | 2
): OmsetClosingValidation {
  const stats = getOmsetPeriodStats(state, ym, period);
  const unlabelledExpenses: Array<{ day: number; kind: 'kx' | 'bx'; nominal: number }> = [];

  stats.rows.forEach(({ d, r }) => {
    (r.kx || []).forEach((e) => {
      const val = Number(e.v) || 0;
      if (val > 0 && !String(e.k || '').trim()) {
        unlabelledExpenses.push({ day: d, kind: 'kx', nominal: val });
      }
    });
    (r.bx || []).forEach((e) => {
      const val = Number(e.v) || 0;
      if (val > 0 && !String(e.k || '').trim()) {
        unlabelledExpenses.push({ day: d, kind: 'bx', nominal: val });
      }
    });
  });

  const yr = getYear(ym);
  const mo = getMonth(ym);
  const periodEnd = new Date(yr, mo - 1, stats.to, 23, 59, 59);
  const isPeriodNotEnded = new Date() < periodEnd;

  return {
    stats,
    noKetDays: stats.noKet,
    missingDays: stats.missing,
    unlabelledExpenses,
    isPeriodNotEnded,
    canClose: stats.noKet.length === 0 && unlabelledExpenses.length === 0,
  };
}

export type OmsetChartMetricKey = 'omset' | 'nota' | 'keluar' | 'gaji' | 'bx' | 'selisih';

export interface OmsetChartMetricDef {
  key: OmsetChartMetricKey;
  label: string;
  diverging?: boolean;
  series: Array<{ k: 'tl' | 'qr' | 'tn' | 'qn' | 'kx' | 'bx' | 'gaji' | 'selT' | 'selQ'; l: string; c: string }>;
}

export const OMSET_CHART_METRICS: Record<OmsetChartMetricKey, OmsetChartMetricDef> = {
  omset: {
    key: 'omset',
    label: 'Omset Bersih',
    series: [
      { k: 'tl', l: 'Tunai laci', c: '#158a81' },
      { k: 'qr', l: 'QRIS real', c: '#2563eb' },
    ],
  },
  nota: {
    key: 'nota',
    label: 'Nota Kasir',
    series: [
      { k: 'tn', l: 'Tunai nota', c: '#158a81' },
      { k: 'qn', l: 'QRIS nota', c: '#2563eb' },
    ],
  },
  keluar: {
    key: 'keluar',
    label: 'Pengeluaran',
    series: [{ k: 'kx', l: 'Pengeluaran', c: '#b8730b' }],
  },
  gaji: {
    key: 'gaji',
    label: 'Gaji',
    series: [{ k: 'gaji', l: 'Gaji karyawan', c: '#5b7083' }],
  },
  bx: {
    key: 'bx',
    label: 'Peng. Omset',
    series: [{ k: 'bx', l: 'Pengeluaran dari omset', c: '#c94a5b' }],
  },
  selisih: {
    key: 'selisih',
    label: 'Selisih +/−',
    diverging: true,
    series: [
      { k: 'selT', l: 'Selisih tunai', c: '#b8730b' },
      { k: 'selQ', l: 'Selisih QRIS', c: '#2563eb' },
    ],
  },
};

export interface OmsetChartDayPoint {
  d: number;
  v: Record<'tl' | 'qr' | 'tn' | 'qn' | 'kx' | 'bx' | 'gaji' | 'selT' | 'selQ', number>;
  has: boolean;
  tot: number | null;
}

export interface OmsetChartData {
  metric: OmsetChartMetricDef;
  nd: number;
  days: OmsetChartDayPoint[];
  validCount: number;
  avg: number;
  maxDay: OmsetChartDayPoint | null;
  minDay: OmsetChartDayPoint | null;
  cv: number;
  avgP1: number;
  avgP2: number;
  hasP1: boolean;
  hasP2: boolean;
  sumTotal: number;
  nonZeroDiffDays: number;
}

/** Menghitung data grafik OMSET 1 bulan persis seperti omChartHtml() di HTML lama */
export function getOmsetChartData(
  state: AppData,
  ym: string,
  metricKey: OmsetChartMetricKey
): OmsetChartData {
  const metric = OMSET_CHART_METRICS[metricKey] || OMSET_CHART_METRICS.omset;
  const nd = getDaysInMonth(ym);
  const div = Boolean(metric.diverging);
  const daysMap = getOmsetState(state).days;

  const days: OmsetChartDayPoint[] = [];
  for (let d = 1; d <= nd; d++) {
    const r = daysMap[formatDateKey(ym, d)] || {};
    const c = calcOmsetDay(r);
    const g = getDailySalaryForDate(state, ym, d);
    const v = {
      tl: c.tl,
      qr: c.qr,
      tn: c.tn,
      qn: c.qn,
      kx: c.kx,
      bx: c.bx,
      gaji: g.tot,
      selT: c.selT || 0,
      selQ: c.selQ || 0,
    };
    const has =
      metricKey === 'gaji'
        ? g.saved
        : metricKey === 'bx'
          ? c.filled || c.bx > 0
          : div
            ? c.filled && (c.selT !== null || c.selQ !== null)
            : c.filled;
    const tot = has ? metric.series.reduce((acc, s) => acc + v[s.k], 0) : null;
    days.push({ d, v, has, tot });
  }

  const vals = days.filter((x): x is OmsetChartDayPoint & { tot: number } => x.has && x.tot !== null);
  const validCount = vals.length;
  const sum = (arr: Array<{ tot: number }>) => arr.reduce((a, b) => a + b.tot, 0);
  const avgOf = (arr: Array<{ tot: number }>) => (arr.length ? sum(arr) / arr.length : 0);

  const sumTotal = sum(vals);
  const avg = avgOf(vals);
  const maxDay = validCount ? vals.reduce((a, b) => (b.tot > a.tot ? b : a)) : null;
  const minDay = validCount ? vals.reduce((a, b) => (b.tot < a.tot ? b : a)) : null;
  const sd =
    validCount > 1
      ? Math.sqrt(vals.reduce((a, x) => a + Math.pow(x.tot - avg, 2), 0) / validCount)
      : 0;
  const cv = avg ? Math.round((sd / Math.abs(avg)) * 100) : 0;

  const p1Vals = vals.filter((x) => x.d <= 15);
  const p2Vals = vals.filter((x) => x.d > 15);

  return {
    metric,
    nd,
    days,
    validCount,
    avg,
    maxDay,
    minDay,
    cv,
    avgP1: avgOf(p1Vals),
    avgP2: avgOf(p2Vals),
    hasP1: p1Vals.length > 0,
    hasP2: p2Vals.length > 0,
    sumTotal,
    nonZeroDiffDays: vals.filter((x) => x.tot !== 0).length,
  };
}

