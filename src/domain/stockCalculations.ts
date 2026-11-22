import { DAY_NAMES, DEFAULT_CATEGORIES, MONTH_NAMES } from '../constants/defaults';
import type { AppData, MasterItem, MonthStock } from '../types/app';
import {
  formatNum,
  getDayOfWeek,
  getDaysInMonth,
  getMonth,
  getYear,
  hasVal,
} from './dateUtils';

const EMPTY_MONTH: MonthStock = { a: {}, d: {}, c: {} };

export function getMonthStock(state: AppData, ym: string): MonthStock {
  return state.m[ym] || EMPTY_MONTH;
}

export function getActiveItems(state: AppData): MasterItem[] {
  return state.items.filter((i) => i.aktif);
}

export function getGroupedItems(state: AppData): Array<[string, MasterItem[]]> {
  const active = getActiveItems(state);
  const categories: string[] = [...DEFAULT_CATEGORIES];
  active.forEach((item) => {
    if (!categories.includes(item.kat)) categories.push(item.kat);
  });
  return categories
    .map((kat): [string, MasterItem[]] => [kat, active.filter((i) => i.kat === kat)])
    .filter(([, list]) => list.length > 0);
}

/** Mengambil nilai stok (a = stok awal, d = barang datang, c = closing) */
export function getStockVal(
  state: AppData,
  ym: string,
  type: 'a' | 'd' | 'c',
  day: number,
  itemId: string
): number | undefined {
  const m = getMonthStock(state, ym);
  if (type === 'a') return m.a?.[itemId];
  return m[type]?.[day]?.[itemId];
}

/** Closing terakhir pada bulan tertentu */
export function getLastClosing(
  state: AppData,
  ym: string,
  itemId: string
): number | undefined {
  const closingMap = getMonthStock(state, ym).c || {};
  for (let d = 31; d >= 1; d--) {
    if (closingMap[d] && hasVal(closingMap[d][itemId])) {
      return closingMap[d][itemId];
    }
  }
  return undefined;
}

/**
 * Rumus Stok Total Siap Jual (identik dengan tot(d, id) pada HTML lama):
 * - Tgl 1: (Stok Awal || 0) + (Datang tgl 1 || 0)
 * - Tgl > 1: jika Closing(d-1) kosong -> null, selain itu Closing(d-1) + (Datang(d) || 0)
 */
export function getStockTotal(
  state: AppData,
  ym: string,
  day: number,
  itemId: string
): number | null {
  if (day === 1) {
    return (getStockVal(state, ym, 'a', 0, itemId) || 0) + (getStockVal(state, ym, 'd', 1, itemId) || 0);
  }
  const prevClosing = getStockVal(state, ym, 'c', day - 1, itemId);
  if (prevClosing === undefined) return null;
  return prevClosing + (getStockVal(state, ym, 'd', day, itemId) || 0);
}

/**
 * Rumus Pemakaian Harian (identik dengan use(d, id) pada HTML lama):
 * tot(d, id) - closing(d, id)
 */
export function getDailyUsage(
  state: AppData,
  ym: string,
  day: number,
  itemId: string
): number | null {
  const total = getStockTotal(state, ym, day, itemId);
  const closing = getStockVal(state, ym, 'c', day, itemId);
  if (total === null || closing === undefined) return null;
  return total - closing;
}

export type CurrentStockStatus = 'ok' | 'low' | 'zero' | 'na';

export interface CurrentStockInfo {
  item: MasterItem;
  val: number | null;
  base: number | null;
  from: string;
  datang: number;
  status: CurrentStockStatus;
}

/**
 * Rumus Stok Terkini (identik dengan stk(i) pada HTML lama):
 * Sisa closing kemarin (atau closing terakhir + datang antaranya / stok awal) + barang datang hari ini.
 */
export function getCurrentStock(
  state: AppData,
  ym: string,
  today: number,
  item: MasterItem
): CurrentStockInfo {
  const datang = Number(getStockVal(state, ym, 'd', today, item.id)) || 0;
  const awal = getStockVal(state, ym, 'a', 0, item.id);
  let base: number | null = null;
  let from = '';

  if (today === 1) {
    if (hasVal(awal) || datang) {
      base = Number(awal) || 0;
      from = 'Stok awal';
    }
  } else {
    const yesterdayClosing = getStockVal(state, ym, 'c', today - 1, item.id);
    if (hasVal(yesterdayClosing)) {
      base = Number(yesterdayClosing);
      from = 'Sisa kemarin';
    } else {
      let lastDay = 0;
      for (let x = today - 2; x >= 1; x--) {
        if (hasVal(getStockVal(state, ym, 'c', x, item.id))) {
          lastDay = x;
          break;
        }
      }
      const from0 = lastDay
        ? Number(getStockVal(state, ym, 'c', lastDay, item.id))
        : hasVal(awal)
          ? Number(awal)
          : null;
      if (from0 !== null) {
        let mid = 0;
        for (let x = lastDay + 1; x <= today - 1; x++) {
          mid += Number(getStockVal(state, ym, 'd', x, item.id)) || 0;
        }
        base = from0 + mid;
        from = lastDay ? `Closing tgl ${lastDay}` : 'Stok awal';
      }
    }
  }

  const val = base === null ? null : base + datang;
  const status: CurrentStockStatus =
    val === null
      ? 'na'
      : val <= 0
        ? 'zero'
        : item.min > 0 && val < item.min
          ? 'low'
          : 'ok';

  return { item, val, base, from, datang, status };
}

export interface NegativeUsageItem {
  day: number;
  item: MasterItem;
  usage: number;
}

export interface TopUsageItem {
  item: MasterItem;
  totalUsage: number;
}

export interface StockDashboardSummary {
  activeItems: MasterItem[];
  nd: number;
  today: number;
  cap: number;
  lastClosingDay: number;
  filledDatangToday: number;
  filledClosingToday: number;
  filledAwalCount: number;
  currentStocks: CurrentStockInfo[];
  lowStockItems: CurrentStockInfo[];
  emptyStockItems: CurrentStockInfo[];
  lowClosingItems: Array<{ item: MasterItem; lastClosing: number }>;
  negativeUsageEntries: NegativeUsageItem[];
  missingClosingDays: number[];
  isTodayClosingIncomplete: boolean;
  dailyUsageSeries: number[];
  topUsageItems: TopUsageItem[];
  isMonthEmpty: boolean;
}

/**
 * Ringkasan operasional stok yang diambil langsung dari Stok Awal, Input Harian, dan Master Item.
 */
export function getStockDashboardSummary(
  state: AppData,
  ym: string,
  curYm: string,
  nowDay: number
): StockDashboardSummary {
  const activeItems = getActiveItems(state);
  const nd = getDaysInMonth(ym);
  const isCur = ym === curYm;
  const today = isCur ? Math.min(nowDay, nd) : 1;
  const cap = isCur ? Math.min(nowDay, nd) : nd;

  let lastClosingDay = 0;
  for (let d = cap; d >= 1; d--) {
    if (activeItems.some((i) => hasVal(getStockVal(state, ym, 'c', d, i.id)))) {
      lastClosingDay = d;
      break;
    }
  }

  const filledDatangToday = activeItems.filter((i) =>
    hasVal(getStockVal(state, ym, 'd', today, i.id))
  ).length;
  const filledClosingToday = activeItems.filter((i) =>
    hasVal(getStockVal(state, ym, 'c', today, i.id))
  ).length;
  const filledAwalCount = activeItems.filter((i) =>
    hasVal(getStockVal(state, ym, 'a', 0, i.id))
  ).length;

  const grouped = getGroupedItems(state);
  const orderedActive = grouped.flatMap(([, list]) => list);
  const currentStocks = orderedActive.map((item) => getCurrentStock(state, ym, today, item));

  const emptyStockItems = currentStocks.filter((s) => s.status === 'zero');
  const lowStockItems = currentStocks.filter((s) => s.status === 'low');

  const lowClosingItems: Array<{ item: MasterItem; lastClosing: number }> = [];
  activeItems.forEach((item) => {
    const lc = getLastClosing(state, ym, item.id);
    if (item.min > 0 && hasVal(lc) && lc < item.min) {
      lowClosingItems.push({ item, lastClosing: lc });
    }
  });

  const negativeUsageEntries: NegativeUsageItem[] = [];
  for (let d = 1; d <= cap; d++) {
    activeItems.forEach((item) => {
      const u = getDailyUsage(state, ym, d, item.id);
      if (u !== null && u < 0) {
        negativeUsageEntries.push({ day: d, item, usage: u });
      }
    });
  }

  const missingClosingDays: number[] = [];
  for (let d = 1; d <= Math.min(lastClosingDay, cap); d++) {
    if (!activeItems.some((i) => hasVal(getStockVal(state, ym, 'c', d, i.id)))) {
      missingClosingDays.push(d);
    }
  }

  const dailyUsageSeries = Array.from({ length: nd }, (_, idx) => {
    const d = idx + 1;
    let sum = 0;
    activeItems.forEach((item) => {
      const u = getDailyUsage(state, ym, d, item.id);
      if (u !== null && u > 0) sum += u;
    });
    return sum;
  });

  const topUsageItems: TopUsageItem[] = activeItems
    .map((item) => {
      let totalUsage = 0;
      for (let d = 1; d <= nd; d++) {
        totalUsage += getDailyUsage(state, ym, d, item.id) || 0;
      }
      return { item, totalUsage };
    })
    .filter((entry) => entry.totalUsage > 0)
    .sort((a, b) => b.totalUsage - a.totalUsage)
    .slice(0, 5);

  const isMonthEmpty =
    !lastClosingDay &&
    !filledAwalCount &&
    !activeItems.some((i) => hasVal(getStockVal(state, ym, 'd', today, i.id)));

  const isTodayClosingIncomplete =
    activeItems.length > 0 && filledClosingToday < activeItems.length;

  return {
    activeItems,
    nd,
    today,
    cap,
    lastClosingDay,
    filledDatangToday,
    filledClosingToday,
    filledAwalCount,
    currentStocks,
    lowStockItems,
    emptyStockItems,
    lowClosingItems,
    negativeUsageEntries,
    missingClosingDays,
    isTodayClosingIncomplete,
    dailyUsageSeries,
    topUsageItems,
    isMonthEmpty,
  };
}

export interface ParsedStockInput {
  valid: boolean;
  empty: boolean;
  negative: boolean;
  value?: number;
}

/**
 * Validasi angka desimal stok sesuai aturan aplikasi lama:
 * - Koma (,) dikonversi menjadi titik (.)
 * - Kosong -> empty: true (dihapus dari penyimpanan, BUKAN dianggap 0)
 * - Negatif (< 0) -> ditolak (negative: true, valid: false)
 */
export function parseStockInput(raw: string): ParsedStockInput {
  const cleaned = String(raw ?? '').replace(',', '.').trim();
  if (cleaned === '') {
    return { valid: true, empty: true, negative: false, value: undefined };
  }
  const num = Number(cleaned);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return { valid: false, empty: false, negative: false, value: undefined };
  }
  if (num < 0) {
    return { valid: false, empty: false, negative: true, value: undefined };
  }
  return { valid: true, empty: false, negative: false, value: num };
}

export interface DayItemMovementRow {
  item: MasterItem;
  prevBase: number | undefined;
  prevLabel: string;
  datang: number | undefined;
  totalSiapJual: number | null;
  closing: number | undefined;
  pemakaian: number | null;
  isNegativeUsage: boolean;
  isLowClosing: boolean;
  isZeroClosing: boolean;
}

export interface DayInputSummary {
  day: number;
  activeItems: MasterItem[];
  groupedItems: Array<[string, MasterItem[]]>;
  rows: DayItemMovementRow[];
  rowsByItemId: Record<string, DayItemMovementRow>;
  filledClosingCount: number;
  filledDatangCount: number;
  missingPrevClosing: boolean;
  missingAwalDay1: boolean;
  totalDatangDay: number;
  totalPemakaianDay: number;
  totalClosingDay: number;
  hasAnyPemakaian: boolean;
  negativeUsageRows: DayItemMovementRow[];
  lowClosingRows: DayItemMovementRow[];
  zeroClosingRows: DayItemMovementRow[];
}

/**
 * Ringkasan transaksi stok harian untuk tanggal tertentu.
 * Seluruh rumus menggunakan getStockVal, getStockTotal, dan getDailyUsage (Single Source of Truth).
 */
export function getDayInputSummary(
  state: AppData,
  ym: string,
  day: number
): DayInputSummary {
  const activeItems = getActiveItems(state);
  const groupedItems = getGroupedItems(state);
  const orderedItems = groupedItems.flatMap(([, list]) => list);

  const missingPrevClosing =
    day > 1 &&
    activeItems.length > 0 &&
    !activeItems.some((i) => hasVal(getStockVal(state, ym, 'c', day - 1, i.id)));

  const missingAwalDay1 =
    day === 1 &&
    activeItems.length > 0 &&
    !activeItems.some((i) => hasVal(getStockVal(state, ym, 'a', 0, i.id)));

  const rowsByItemId: Record<string, DayItemMovementRow> = {};
  let filledClosingCount = 0;
  let filledDatangCount = 0;
  let totalDatangDay = 0;
  let totalPemakaianDay = 0;
  let totalClosingDay = 0;
  let hasAnyPemakaian = false;

  const rows: DayItemMovementRow[] = orderedItems.map((item) => {
    const prevBase =
      day === 1
        ? getStockVal(state, ym, 'a', 0, item.id)
        : getStockVal(state, ym, 'c', day - 1, item.id);
    const prevLabel = day === 1 ? 'Stok awal' : `Closing tgl ${day - 1}`;
    const datang = getStockVal(state, ym, 'd', day, item.id);
    const closing = getStockVal(state, ym, 'c', day, item.id);
    const totalSiapJual = getStockTotal(state, ym, day, item.id);
    const pemakaian = getDailyUsage(state, ym, day, item.id);

    if (hasVal(datang)) {
      filledDatangCount += 1;
      totalDatangDay += datang;
    }
    if (hasVal(closing)) {
      filledClosingCount += 1;
      totalClosingDay += closing;
    }
    if (pemakaian !== null) {
      hasAnyPemakaian = true;
      totalPemakaianDay += pemakaian;
    }

    const isNegativeUsage = pemakaian !== null && pemakaian < 0;
    const isZeroClosing = hasVal(closing) && closing <= 0;
    const isLowClosing = hasVal(closing) && closing > 0 && item.min > 0 && closing < item.min;

    const row: DayItemMovementRow = {
      item,
      prevBase,
      prevLabel,
      datang,
      totalSiapJual,
      closing,
      pemakaian,
      isNegativeUsage,
      isLowClosing,
      isZeroClosing,
    };
    rowsByItemId[item.id] = row;
    return row;
  });

  return {
    day,
    activeItems,
    groupedItems,
    rows,
    rowsByItemId,
    filledClosingCount,
    filledDatangCount,
    missingPrevClosing,
    missingAwalDay1,
    totalDatangDay,
    totalPemakaianDay,
    totalClosingDay,
    hasAnyPemakaian,
    negativeUsageRows: rows.filter((r) => r.isNegativeUsage),
    lowClosingRows: rows.filter((r) => r.isLowClosing),
    zeroClosingRows: rows.filter((r) => r.isZeroClosing),
  };
}

export type MonthlyMetricMode = 'p' | 'd' | 't' | 'c';
export type PlainTextFilter = 'all' | 'p' | 'd' | 't' | 'c' | 'month_summary';

export interface MonthlyItemSummary {
  item: MasterItem;
  isArchived: boolean;
  awal: number | undefined;
  totalDatang: number;
  datangDaysCount: number;
  totalPemakaian: number;
  pemakaianDaysCount: number;
  negativeDaysCount: number;
  closingDaysCount: number;
  lastClosing: number | undefined;
  lastClosingDay: number | null;
}

export interface MonthlyDayMeta {
  day: number;
  hasDatang: boolean;
  hasClosing: boolean;
  hasNegative: boolean;
  filledClosingCount: number;
}

export interface MonthlyTableSummary {
  ym: string;
  nd: number;
  isCur: boolean;
  today: number;
  cap: number;
  defaultDay: number;
  hasTodayData: boolean;
  groupedItems: Array<[string, MasterItem[]]>;
  orderedItems: MasterItem[];
  archivedWithHistoryCount: number;
  itemSummaries: Record<string, MonthlyItemSummary>;
  dayMeta: Record<number, MonthlyDayMeta>;
  totalDatangAll: number;
  totalPemakaianAll: number;
  totalNegativeCells: number;
  daysWithClosing: number;
}

/**
 * Mengecek apakah suatu item memiliki data historis pada bulan ym
 * (Stok Awal, Barang Datang, atau Closing pada tanggal manapun).
 */
export function hasItemHistoryInMonth(state: AppData, ym: string, itemId: string): boolean {
  const m = getMonthStock(state, ym);
  if (hasVal(m.a?.[itemId])) return true;
  const nd = getDaysInMonth(ym);
  for (let d = 1; d <= nd; d++) {
    if (hasVal(m.d?.[d]?.[itemId]) || hasVal(m.c?.[d]?.[itemId])) {
      return true;
    }
  }
  return false;
}

/**
 * Mengambil seluruh item yang relevan untuk Tabel Bulanan pada bulan ym:
 * - Seluruh item aktif dari Master Item
 * - Item nonaktif (arsip) yang memiliki histori transaksi di bulan ym
 * - ID historis lama yang mungkin tidak lagi terdaftar di Master Item agar data lama tetap terbaca
 */
export function getMonthlyTableGroupedItems(
  state: AppData,
  ym: string
): {
  groupedItems: Array<[string, MasterItem[]]>;
  orderedItems: MasterItem[];
  archivedWithHistoryCount: number;
} {
  const included: MasterItem[] = [];
  const knownIds = new Set<string>();
  let archivedWithHistoryCount = 0;

  state.items.forEach((item) => {
    knownIds.add(item.id);
    if (item.aktif) {
      included.push(item);
    } else if (hasItemHistoryInMonth(state, ym, item.id)) {
      included.push(item);
      archivedWithHistoryCount += 1;
    }
  });

  // Baca juga ID historis jika ada data lama yang ID-nya sudah tidak di Master Item
  const m = getMonthStock(state, ym);
  const orphanIds = new Set<string>();
  Object.keys(m.a || {}).forEach((id) => {
    if (!knownIds.has(id) && hasVal(m.a[id])) orphanIds.add(id);
  });
  Object.values(m.d || {}).forEach((dayMap) => {
    Object.keys(dayMap || {}).forEach((id) => {
      if (!knownIds.has(id) && hasVal(dayMap[id])) orphanIds.add(id);
    });
  });
  Object.values(m.c || {}).forEach((dayMap) => {
    Object.keys(dayMap || {}).forEach((id) => {
      if (!knownIds.has(id) && hasVal(dayMap[id])) orphanIds.add(id);
    });
  });

  orphanIds.forEach((id) => {
    included.push({
      id,
      kat: 'Histori Lama',
      nama: `Item #${id}`,
      sat: 'pcs',
      min: 0,
      aktif: 0,
    });
    archivedWithHistoryCount += 1;
  });

  const categories: string[] = [...DEFAULT_CATEGORIES];
  included.forEach((item) => {
    if (!categories.includes(item.kat)) categories.push(item.kat);
  });

  const groupedItems = categories
    .map((kat): [string, MasterItem[]] => [kat, included.filter((i) => i.kat === kat)])
    .filter(([, list]) => list.length > 0);

  return {
    groupedItems,
    orderedItems: groupedItems.flatMap(([, list]) => list),
    archivedWithHistoryCount,
  };
}

/**
 * Menghitung rekap lengkap Tabel Bulanan menggunakan rumus identik dengan Input Harian
 * (getStockVal, getStockTotal, getDailyUsage) tanpa penghitungan ganda.
 */
export function getMonthlyTableSummary(
  state: AppData,
  ym: string,
  curYm: string,
  nowDay: number
): MonthlyTableSummary {
  const nd = getDaysInMonth(ym);
  const isCur = ym === curYm;
  const today = isCur ? Math.min(nowDay, nd) : 1;
  const cap = isCur ? Math.min(nowDay, nd) : nd;

  const { groupedItems, orderedItems, archivedWithHistoryCount } = getMonthlyTableGroupedItems(
    state,
    ym
  );

  // Default day (identik dengan getTbDefaultDay() pada aplikasi lama)
  const hasTodayData = orderedItems.some(
    (i) =>
      hasVal(getStockVal(state, ym, 'c', today, i.id)) ||
      hasVal(getStockVal(state, ym, 'd', today, i.id))
  );

  let defaultDay = today;
  if (!(hasTodayData && isCur)) {
    for (let d = cap; d >= 1; d--) {
      if (
        orderedItems.some(
          (i) =>
            hasVal(getStockVal(state, ym, 'c', d, i.id)) ||
            hasVal(getStockVal(state, ym, 'd', d, i.id))
        )
      ) {
        defaultDay = d;
        break;
      }
    }
  }

  const itemSummaries: Record<string, MonthlyItemSummary> = {};
  const dayMeta: Record<number, MonthlyDayMeta> = {};

  for (let d = 1; d <= nd; d++) {
    dayMeta[d] = {
      day: d,
      hasDatang: false,
      hasClosing: false,
      hasNegative: false,
      filledClosingCount: 0,
    };
  }

  let totalDatangAll = 0;
  let totalPemakaianAll = 0;
  let totalNegativeCells = 0;

  orderedItems.forEach((item) => {
    const awal = getStockVal(state, ym, 'a', 0, item.id);
    let totalDatang = 0;
    let datangDaysCount = 0;
    let totalPemakaian = 0;
    let pemakaianDaysCount = 0;
    let negativeDaysCount = 0;
    let closingDaysCount = 0;
    let lastClosing: number | undefined;
    let lastClosingDay: number | null = null;

    for (let d = 1; d <= nd; d++) {
      const datang = getStockVal(state, ym, 'd', d, item.id);
      const closing = getStockVal(state, ym, 'c', d, item.id);
      const usage = getDailyUsage(state, ym, d, item.id);

      if (hasVal(datang)) {
        totalDatang += datang;
        datangDaysCount += 1;
        totalDatangAll += datang;
        dayMeta[d].hasDatang = true;
      }
      if (hasVal(closing)) {
        closingDaysCount += 1;
        lastClosing = closing;
        lastClosingDay = d;
        dayMeta[d].hasClosing = true;
        dayMeta[d].filledClosingCount += 1;
      }
      if (usage !== null) {
        totalPemakaian += usage;
        pemakaianDaysCount += 1;
        totalPemakaianAll += usage;
        if (usage < 0) {
          negativeDaysCount += 1;
          totalNegativeCells += 1;
          dayMeta[d].hasNegative = true;
        }
      }
    }

    itemSummaries[item.id] = {
      item,
      isArchived: !item.aktif,
      awal,
      totalDatang,
      datangDaysCount,
      totalPemakaian,
      pemakaianDaysCount,
      negativeDaysCount,
      closingDaysCount,
      lastClosing,
      lastClosingDay,
    };
  });

  const daysWithClosing = Object.values(dayMeta).filter((dm) => dm.hasClosing).length;

  return {
    ym,
    nd,
    isCur,
    today,
    cap,
    defaultDay,
    hasTodayData,
    groupedItems,
    orderedItems,
    archivedWithHistoryCount,
    itemSummaries,
    dayMeta,
    totalDatangAll,
    totalPemakaianAll,
    totalNegativeCells,
    daysWithClosing,
  };
}

/**
 * Generator Plain Text Tabel Bulanan (identik dengan genTbPlainText() pada HTML lama).
 */
export function generateMonthlyPlainText(
  state: AppData,
  ym: string,
  curYm: string,
  nowDay: number,
  targetDay: number,
  filterType: PlainTextFilter
): string {
  const summary = getMonthlyTableSummary(state, ym, curYm, nowDay);
  const d = Math.min(Math.max(1, targetDay), summary.nd);
  const monthName = MONTH_NAMES[getMonth(ym) - 1] || '';
  const yearNum = getYear(ym);
  const dayName = DAY_NAMES[getDayOfWeek(ym, d)] || '';
  const isFallback = summary.isCur && !summary.hasTodayData && d === summary.defaultDay;

  let out = `DATA TABEL BULANAN (PLAIN TEXT) - DOONA GOLF\n`;
  out += `Bulan: ${monthName} ${yearNum} | Tanggal: ${dayName}, ${d} ${monthName} ${yearNum}\n`;
  if (isFallback) {
    out += `[Catatan: Hari ini (Tgl ${summary.today}) belum diisi. Otomatis menampilkan data terakhir Tgl ${d}]\n`;
  }
  out += `============================================================\n\n`;

  if (filterType === 'p') {
    out += `REKAP PEMAKAIAN (Tgl ${d} & Akumulasi Bulan Ini):\n`;
    out += `------------------------------------------------------------\n`;
    let totalPakaiHari = 0;
    summary.groupedItems.forEach(([kat, items]) => {
      out += `\n[${kat.toUpperCase()}]\n`;
      items.forEach((i) => {
        const u = getDailyUsage(state, ym, d, i.id);
        const sat = i.sat || 'pcs';
        const blnTotal = summary.itemSummaries[i.id]?.totalPemakaian || 0;
        if (u !== null && u > 0) totalPakaiHari += u;
        const label = i.aktif ? i.nama : `${i.nama} (Arsip)`;
        out += `• ${label.padEnd(24, ' ')} : ${u !== null ? `${formatNum(u)} ${sat}` : '–'} (Total Sebulan: ${formatNum(blnTotal)} ${sat})\n`;
      });
    });
    out += `\n------------------------------------------------------------\n`;
    out += `Total Pemakaian Hari Ini : ${formatNum(totalPakaiHari)}\n`;
  } else if (filterType === 'd') {
    out += `REKAP BARANG DATANG (Tgl ${d} & Akumulasi Bulan Ini):\n`;
    out += `------------------------------------------------------------\n`;
    let totalDatangHari = 0;
    summary.groupedItems.forEach(([kat, items]) => {
      out += `\n[${kat.toUpperCase()}]\n`;
      items.forEach((i) => {
        const v = getStockVal(state, ym, 'd', d, i.id);
        const sat = i.sat || 'pcs';
        const blnTotal = summary.itemSummaries[i.id]?.totalDatang || 0;
        if (hasVal(v) && v > 0) totalDatangHari += v;
        const label = i.aktif ? i.nama : `${i.nama} (Arsip)`;
        out += `• ${label.padEnd(24, ' ')} : ${hasVal(v) ? `+${formatNum(v)} ${sat}` : '–'} (Total Sebulan: +${formatNum(blnTotal)} ${sat})\n`;
      });
    });
    out += `\n------------------------------------------------------------\n`;
    out += `Total Barang Masuk Hari Ini : ${formatNum(totalDatangHari)}\n`;
  } else if (filterType === 'c') {
    out += `REKAP SISA STOK FISIK (CLOSING) - Tgl ${d}:\n`;
    out += `------------------------------------------------------------\n`;
    summary.groupedItems.forEach(([kat, items]) => {
      out += `\n[${kat.toUpperCase()}]\n`;
      items.forEach((i) => {
        const c = getStockVal(state, ym, 'c', d, i.id);
        const sat = i.sat || 'pcs';
        const label = i.aktif ? i.nama : `${i.nama} (Arsip)`;
        out += `• ${label.padEnd(24, ' ')} : ${hasVal(c) ? `${formatNum(c)} ${sat}` : 'Belum diisi'}\n`;
      });
    });
  } else if (filterType === 't') {
    out += `REKAP TOTAL STOK SIAP JUAL - Tgl ${d}:\n`;
    out += `------------------------------------------------------------\n`;
    summary.groupedItems.forEach(([kat, items]) => {
      out += `\n[${kat.toUpperCase()}]\n`;
      items.forEach((i) => {
        const t = getStockTotal(state, ym, d, i.id);
        const sat = i.sat || 'pcs';
        const label = i.aktif ? i.nama : `${i.nama} (Arsip)`;
        out += `• ${label.padEnd(24, ' ')} : ${formatNum(t)} ${sat}\n`;
      });
    });
  } else if (filterType === 'month_summary') {
    out += `RINGKASAN TOTAL BULANAN - ${monthName.toUpperCase()} ${yearNum}:\n`;
    out += `------------------------------------------------------------\n`;
    out += `Item                       | Datang     | Pemakaian  | Sisa Akhir\n`;
    out += `------------------------------------------------------------\n`;
    summary.groupedItems.forEach(([kat, items]) => {
      out += `\n[${kat.toUpperCase()}]\n`;
      items.forEach((i) => {
        const sat = i.sat || 'pcs';
        const st = summary.itemSummaries[i.id];
        const sumD = st?.totalDatang || 0;
        const sumP = st?.totalPemakaian || 0;
        const sisa = st?.lastClosing;
        const rawName = i.aktif ? i.nama : `${i.nama} (Arsip)`;
        const nameCol =
          rawName.length > 25 ? `${rawName.slice(0, 22)}...` : rawName.padEnd(26, ' ');
        const dCol = `${formatNum(sumD)} ${sat}`.padEnd(10, ' ');
        const pCol = `${formatNum(sumP)} ${sat}`.padEnd(10, ' ');
        const sCol = hasVal(sisa) ? `${formatNum(sisa)} ${sat}` : '–';
        out += `${nameCol} | ${dCol} | ${pCol} | ${sCol}\n`;
      });
    });
  } else {
    // Mode Lengkap (Semua Data Tgl d)
    const datangItems: Array<{ nama: string; qty: number; sat: string }> = [];
    summary.orderedItems.forEach((i) => {
      const v = getStockVal(state, ym, 'd', d, i.id);
      if (hasVal(v) && v > 0) {
        datangItems.push({
          nama: i.aktif ? i.nama : `${i.nama} (Arsip)`,
          qty: v,
          sat: i.sat || 'pcs',
        });
      }
    });

    if (datangItems.length > 0) {
      out += `BARANG DATANG (TGL ${d}):\n`;
      datangItems.forEach((item) => {
        out += `  + ${item.nama.padEnd(22, ' ')} : ${formatNum(item.qty)} ${item.sat}\n`;
      });
      out += `\n`;
    }

    out += `RINCIAN STOK & PEMAKAIAN (TGL ${d}):\n`;
    out += `------------------------------------------------------------\n`;
    summary.groupedItems.forEach(([kat, items]) => {
      out += `\n[${kat.toUpperCase()}]\n`;
      items.forEach((i) => {
        const sat = i.sat || 'pcs';
        const t = getStockTotal(state, ym, d, i.id);
        const c = getStockVal(state, ym, 'c', d, i.id);
        const u = getDailyUsage(state, ym, d, i.id);
        const dVal = getStockVal(state, ym, 'd', d, i.id);
        const label = i.aktif ? i.nama : `${i.nama} (Arsip)`;

        let line = `• ${label.padEnd(22, ' ')} : `;
        line += `Siap Jual: ${formatNum(t)} ${sat} | `;
        line += `Closing: ${hasVal(c) ? formatNum(c) : '–'} ${sat} | `;
        line += `Pakai: ${u !== null ? formatNum(u) : '–'} ${sat}`;
        if (hasVal(dVal) && dVal > 0) {
          line += ` | (Masuk: +${formatNum(dVal)})`;
        }
        out += `${line}\n`;
      });
    });
  }

  out += `\n============================================================\n`;
  out += `DOONA GOLF Inventory System - Digenerate otomatis\n`;
  return out;
}

/**
 * Menghasilkan CSV matriks bulanan untuk metrik yang dipilih.
 */
export function generateMonthlyCsv(
  state: AppData,
  ym: string,
  curYm: string,
  nowDay: number,
  metric: MonthlyMetricMode
): string {
  const summary = getMonthlyTableSummary(state, ym, curYm, nowDay);
  const escCsv = (val: string) =>
    val.includes(',') || val.includes('"') || val.includes('\n')
      ? `"${val.replace(/"/g, '""')}"`
      : val;

  const headers = [
    'Tanggal',
    ...summary.orderedItems.map(
      (i) => `${i.nama}${i.aktif ? '' : ' (Arsip)'} (${i.sat || 'pcs'})`
    ),
  ];
  const lines = [headers.map(escCsv).join(',')];

  // Baris Stok Awal
  const awalRow = [
    'Stok Awal',
    ...summary.orderedItems.map((i) => {
      const a = getStockVal(state, ym, 'a', 0, i.id);
      return hasVal(a) ? String(a) : '';
    }),
  ];
  lines.push(awalRow.map(escCsv).join(','));

  for (let d = 1; d <= summary.nd; d++) {
    const dayName = (DAY_NAMES[getDayOfWeek(ym, d)] || '').slice(0, 3);
    const row = [
      `${d} ${dayName}`,
      ...summary.orderedItems.map((i) => {
        const val =
          metric === 'd'
            ? getStockVal(state, ym, 'd', d, i.id)
            : metric === 't'
              ? getStockTotal(state, ym, d, i.id)
              : metric === 'c'
                ? getStockVal(state, ym, 'c', d, i.id)
                : getDailyUsage(state, ym, d, i.id);
        return val === null || val === undefined ? '' : String(val);
      }),
    ];
    lines.push(row.map(escCsv).join(','));
  }

  if (metric === 'd' || metric === 'p') {
    const totalRow = [
      'Total',
      ...summary.orderedItems.map((i) => {
        const s = summary.itemSummaries[i.id];
        return String(metric === 'd' ? s?.totalDatang || 0 : s?.totalPemakaian || 0);
      }),
    ];
    lines.push(totalRow.map(escCsv).join(','));
  }

  return lines.join('\n');
}

export interface StokAwalItemRow {
  item: MasterItem;
  awal: number | undefined;
  prevClosing: number | undefined;
  isFilled: boolean;
  canCopyPrev: boolean;
  differsFromPrev: boolean;
}

export interface StokAwalSummary {
  ym: string;
  prevYm: string;
  activeItems: MasterItem[];
  groupedItems: Array<[string, MasterItem[]]>;
  rows: StokAwalItemRow[];
  rowsByItemId: Record<string, StokAwalItemRow>;
  filledCount: number;
  emptyCount: number;
  prevAvailableCount: number;
  differsFromPrevCount: number;
  hasPrevMonthData: boolean;
  isComplete: boolean;
  progressPct: number;
}

/**
 * Ringkasan Stok Awal bulan terpilih (identik dengan logika aw(), awFoot(), dan imp() pada HTML lama).
 * Membaca item aktif dari Master Item, nilai saldo awal dari state.m[ym].a, dan
 * referensi closing terakhir bulan sebelumnya dari state.m[prevYm].c secara read-only.
 */
export function getStokAwalSummary(
  state: AppData,
  ym: string,
  prevYm: string
): StokAwalSummary {
  const activeItems = getActiveItems(state);
  const groupedItems = getGroupedItems(state);
  const orderedItems = groupedItems.flatMap(([, list]) => list);

  const rowsByItemId: Record<string, StokAwalItemRow> = {};
  let filledCount = 0;
  let prevAvailableCount = 0;
  let differsFromPrevCount = 0;

  const rows: StokAwalItemRow[] = orderedItems.map((item) => {
    const awal = getStockVal(state, ym, 'a', 0, item.id);
    const prevClosing = getLastClosing(state, prevYm, item.id);
    const isFilled = hasVal(awal);
    const hasPrev = hasVal(prevClosing);
    const canCopyPrev = hasPrev && awal !== prevClosing;
    const differsFromPrev = isFilled && hasPrev && awal !== prevClosing;

    if (isFilled) filledCount += 1;
    if (hasPrev) prevAvailableCount += 1;
    if (differsFromPrev) differsFromPrevCount += 1;

    const row: StokAwalItemRow = {
      item,
      awal,
      prevClosing,
      isFilled,
      canCopyPrev,
      differsFromPrev,
    };
    rowsByItemId[item.id] = row;
    return row;
  });

  const total = orderedItems.length;
  const emptyCount = total - filledCount;
  const isComplete = total > 0 && filledCount === total;
  const progressPct = total > 0 ? Math.round((filledCount / total) * 100) : 0;

  return {
    ym,
    prevYm,
    activeItems,
    groupedItems,
    rows,
    rowsByItemId,
    filledCount,
    emptyCount,
    prevAvailableCount,
    differsFromPrevCount,
    hasPrevMonthData: prevAvailableCount > 0,
    isComplete,
    progressPct,
  };
}

/**
 * Daftar seluruh kategori unik (5 kategori default + kategori kustom yang sudah ada di Master Item).
 */
export function getAllCategories(state: AppData): string[] {
  const categories: string[] = [...DEFAULT_CATEGORIES];
  state.items.forEach((item) => {
    const kat = (item.kat || '').trim();
    if (kat && !categories.includes(kat)) {
      categories.push(kat);
    }
  });
  return categories;
}

export interface ItemTransactionStats {
  hasHistory: boolean;
  monthsCount: number;
  awalCount: number;
  datangCount: number;
  closingCount: number;
  totalEntries: number;
  months: string[];
}

/**
 * Memeriksa apakah suatu item (berdasarkan ID) memiliki riwayat transaksi di seluruh bulan
 * pada state.m (Stok Awal, Barang Datang, atau Closing).
 * Digunakan oleh Master Item untuk mencegah penghapusan permanen item yang masih punya histori.
 */
export function getItemTransactionStats(
  state: AppData,
  itemId: string
): ItemTransactionStats {
  const monthsMap = state.m || {};
  let awalCount = 0;
  let datangCount = 0;
  let closingCount = 0;
  const touchedMonths: string[] = [];

  Object.keys(monthsMap).forEach((mKey) => {
    const m = monthsMap[mKey];
    if (!m) return;
    let monthTouched = false;

    if (m.a && hasVal(m.a[itemId])) {
      awalCount += 1;
      monthTouched = true;
    }

    if (m.d) {
      Object.values(m.d).forEach((dayMap) => {
        if (dayMap && hasVal(dayMap[itemId])) {
          datangCount += 1;
          monthTouched = true;
        }
      });
    }

    if (m.c) {
      Object.values(m.c).forEach((dayMap) => {
        if (dayMap && hasVal(dayMap[itemId])) {
          closingCount += 1;
          monthTouched = true;
        }
      });
    }

    if (monthTouched) {
      touchedMonths.push(mKey);
    }
  });

  touchedMonths.sort();
  const totalEntries = awalCount + datangCount + closingCount;

  return {
    hasHistory: totalEntries > 0,
    monthsCount: touchedMonths.length,
    awalCount,
    datangCount,
    closingCount,
    totalEntries,
    months: touchedMonths,
  };
}

export interface UnitUsageInfo {
  unit: string;
  isDefault: boolean;
  items: MasterItem[];
  activeItems: MasterItem[];
  archivedItems: MasterItem[];
  itemsWithHistoryCount: number;
  totalCount: number;
  canDelete: boolean;
}

/**
 * Daftar satuan tersedia dari state utama (fallback ke 9 satuan default aplikasi lama).
 */
export function getSatuanList(state: AppData, defaultSatuan: readonly string[]): string[] {
  return Array.isArray(state.satuan) && state.satuan.length > 0
    ? state.satuan
    : [...defaultSatuan];
}

/**
 * Menghitung relasi penggunaan suatu satuan terhadap Master Item (aktif, arsip, & yang memiliki histori).
 * Menjamin satuan yang masih digunakan item aktif atau histori tidak dapat dihapus permanen
 * sebelum relasi item dipindahkan.
 */
export function getUnitUsageInfo(
  state: AppData,
  unit: string,
  defaultSatuan: readonly string[]
): UnitUsageInfo {
  const norm = unit.trim().toLowerCase();
  const items = state.items.filter(
    (item) => (item.sat || '').trim().toLowerCase() === norm
  );
  const activeItems = items.filter((i) => Boolean(i.aktif));
  const archivedItems = items.filter((i) => !i.aktif);
  const itemsWithHistoryCount = items.filter(
    (i) => getItemTransactionStats(state, i.id).hasHistory
  ).length;

  return {
    unit,
    isDefault: defaultSatuan.some((d) => d.toLowerCase() === norm),
    items,
    activeItems,
    archivedItems,
    itemsWithHistoryCount,
    totalCount: items.length,
    canDelete: items.length === 0,
  };
}





