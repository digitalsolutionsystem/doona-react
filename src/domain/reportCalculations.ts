import { MONTH_NAMES } from '../constants/defaults';
import type { AppData, ReportItemConfig } from '../types/app';
import {
  calcEmployeePayroll,
  getDailySalaryForDate,
  getDayAttendanceSummary,
  getEmployeesForPayrollPeriod,
  getPeriodPayrollSummary,
} from './attendanceCalculations';
import {
  formatDateKey,
  formatNum,
  formatRp,
  getDaysInMonth,
  getFullDateLabel,
  getMonth,
  getMonthLabel,
  getYear,
  hasVal,
} from './dateUtils';
import {
  calcOmsetDay,
  formatSignedRp,
  getOmsetMonthSummary,
  getOmsetState,
} from './omsetCalculations';
import {
  generateMonthlyCsv,
  getActiveItems,
  getDailyUsage,
  getGroupedItems,
  getMonthlyTableSummary,
  getStockVal,
} from './stockCalculations';

export type ReportPresetMode =
  | 'closing_harian'
  | 'rekap_bulanan'
  | 'operasional_harian'
  | 'operasional_bulanan';

export interface ReportSummaryStats {
  selectedItemsCount: number;
  sisaCheckedCount: number;
  pakaiCheckedCount: number;
  activeItemsCount: number;
  datangCount: number;
  closingFilledCount: number;
  negativeUsageCount: number;
}

export interface BackupDataSummary {
  totalItems: number;
  activeItems: number;
  archivedItems: number;
  satuanCount: number;
  stockMonths: string[];
  omsetDaysCount: number;
  omsetClosingCount: number;
  employeeCount: number;
  archivedEmployeeCount: number;
  attendanceMonths: string[];
}

export interface BackupValidationResult {
  valid: boolean;
  error?: string;
  warnings: string[];
  parsed?: Partial<AppData>;
  summary?: BackupDataSummary;
}

/**
 * Mengambil konfigurasi laporan per item (default: sisa=true, pakai=true)
 * sesuai fungsi getRepCfg() pada aplikasi lama tanpa memutasi state.
 */
export function getReportItemConfig(state: AppData, itemId: string): ReportItemConfig {
  const existing = state.repCfg?.[itemId];
  if (!existing) {
    return { sisa: true, pakai: true };
  }
  return {
    sisa: existing.sisa !== false,
    pakai: existing.pakai !== false,
  };
}

/**
 * Statistik ringkas untuk tanggal terpilih pada halaman Laporan.
 */
export function getReportSummaryStats(
  state: AppData,
  ym: string,
  day: number
): ReportSummaryStats {
  const active = getActiveItems(state);
  let selectedItemsCount = 0;
  let sisaCheckedCount = 0;
  let pakaiCheckedCount = 0;
  let datangCount = 0;
  let closingFilledCount = 0;
  let negativeUsageCount = 0;

  active.forEach((item) => {
    const cfg = getReportItemConfig(state, item.id);
    if (cfg.sisa || cfg.pakai) selectedItemsCount += 1;
    if (cfg.sisa) sisaCheckedCount += 1;
    if (cfg.pakai) pakaiCheckedCount += 1;

    const dVal = getStockVal(state, ym, 'd', day, item.id);
    if (hasVal(dVal) && dVal > 0) datangCount += 1;

    const cVal = getStockVal(state, ym, 'c', day, item.id);
    if (hasVal(cVal)) closingFilledCount += 1;

    const usage = getDailyUsage(state, ym, day, item.id);
    if (usage !== null && usage < 0) negativeUsageCount += 1;
  });

  return {
    selectedItemsCount,
    sisaCheckedCount,
    pakaiCheckedCount,
    activeItemsCount: active.length,
    datangCount,
    closingFilledCount,
    negativeUsageCount,
  };
}

/**
 * 1. LAPORAN CLOSING HARIAN (100% identik dengan fungsi rep() aplikasi lama)
 * - Barang datang otomatis tampil di bagian atas bila qty > 0 pada tanggal terpilih.
 * - Daftar item per kategori mengikuti centang repCfg (sisa & pakai).
 * - Peringatan pemakaian negatif tampil otomatis bila ada item dengan pemakaian < 0.
 */
export function buildDailyClosingReport(state: AppData, ym: string, day: number): string {
  const dateLabel = getFullDateLabel(ym, day);
  let s = `LAPORAN CLOSING - DOONA GOLF\n${dateLabel}\n`;

  const active = getActiveItems(state);

  // 1. Barang Datang Otomatis (hanya item dengan barang datang > 0 pada tanggal ini)
  const datangItems: Array<{ nama: string; qty: number; sat: string }> = [];
  active.forEach((item) => {
    const datangVal = getStockVal(state, ym, 'd', day, item.id);
    if (hasVal(datangVal) && datangVal > 0) {
      datangItems.push({
        nama: item.nama,
        qty: datangVal,
        sat: item.sat || 'pcs',
      });
    }
  });

  if (datangItems.length > 0) {
    s += `\n📦 BARANG DATANG:\n`;
    datangItems.forEach((item) => {
      s += `- ${item.nama}: +${formatNum(item.qty)} ${item.sat}\n`;
    });
  }

  // 2. Laporan Stok & Pemakaian per Kategori berdasarkan centang repCfg
  getGroupedItems(state).forEach(([kat, items]) => {
    let catText = '';
    items.forEach((item) => {
      const cfg = getReportItemConfig(state, item.id);
      if (!cfg.sisa && !cfg.pakai) return;

      const c = getStockVal(state, ym, 'c', day, item.id);
      const u = getDailyUsage(state, ym, day, item.id);
      const sat = item.sat || 'pcs';
      const parts: string[] = [];

      if (cfg.sisa) {
        parts.push(`sisa ${hasVal(c) ? `${formatNum(c)} ${sat}` : 'belum diisi'}`);
      }
      if (cfg.pakai) {
        parts.push(`pakai ${u !== null ? `${formatNum(u)} ${sat}` : '–'}`);
      }

      catText += `${item.nama}: ${parts.join(' | ')}\n`;
    });

    if (catText) {
      s += `\n[${kat}]\n${catText}`;
    }
  });

  // 3. Peringatan pemakaian negatif
  const negItems = active.filter((item) => {
    const u = getDailyUsage(state, ym, day, item.id);
    return u !== null && u < 0;
  });
  if (negItems.length > 0) {
    s += `\n⚠️ Cek: pemakaian negatif pada ${negItems.map((i) => i.nama).join(', ')}\n`;
  }

  return s;
}

/**
 * 2. LAPORAN REKAP STOK BULANAN
 * Membaca langsung dari getMonthlyTableSummary (sumber yang sama dengan Tabel Bulanan).
 * Mematuhi konfigurasi item pada repCfg dan tetap menampilkan item arsip yang punya histori bulan ini.
 */
export function buildMonthlyStockReport(
  state: AppData,
  ym: string,
  curYm: string,
  nowDay: number
): string {
  const summary = getMonthlyTableSummary(state, ym, curYm, nowDay);
  const monthLabel = getMonthLabel(ym);
  let s = `LAPORAN REKAP STOK BULANAN - DOONA GOLF\nPeriode: ${monthLabel}\n`;

  // Barang datang total bulan ini
  const datangBulan: Array<{ nama: string; qty: number; sat: string }> = [];
  summary.orderedItems.forEach((item) => {
    const st = summary.itemSummaries[item.id];
    if (st && st.totalDatang > 0) {
      datangBulan.push({
        nama: item.nama,
        qty: st.totalDatang,
        sat: item.sat || 'pcs',
      });
    }
  });

  if (datangBulan.length > 0) {
    s += `\n📦 TOTAL BARANG DATANG (${monthLabel.toUpperCase()}):\n`;
    datangBulan.forEach((item) => {
      s += `- ${item.nama}: +${formatNum(item.qty)} ${item.sat}\n`;
    });
  }

  // Rekap per kategori mengikuti repCfg (item arsip berhistori tetap tampil)
  summary.groupedItems.forEach(([kat, items]) => {
    let catText = '';
    items.forEach((item) => {
      const cfg = item.aktif ? getReportItemConfig(state, item.id) : { sisa: true, pakai: true };
      if (!cfg.sisa && !cfg.pakai) return;

      const st = summary.itemSummaries[item.id];
      if (!st) return;

      const sat = item.sat || 'pcs';
      const parts: string[] = [];

      if (cfg.sisa) {
        parts.push(
          `sisa akhir ${hasVal(st.lastClosing) ? `${formatNum(st.lastClosing)} ${sat}` : 'belum diisi'}`
        );
      }
      if (cfg.pakai) {
        parts.push(`pakai bulan ${formatNum(st.totalPemakaian)} ${sat}`);
      }
      if (st.totalDatang > 0) {
        parts.push(`datang +${formatNum(st.totalDatang)} ${sat}`);
      }

      const tag = item.aktif ? '' : ' (Arsip)';
      catText += `${item.nama}${tag}: ${parts.join(' | ')}\n`;
    });

    if (catText) {
      s += `\n[${kat}]\n${catText}`;
    }
  });

  if (summary.totalNegativeCells > 0) {
    s += `\n⚠️ Catatan: terdeteksi ${summary.totalNegativeCells} sel pemakaian negatif pada bulan ${monthLabel}.\n`;
  }

  return s;
}

/**
 * 3. LAPORAN OPERASIONAL HARIAN TERPADU
 * Menggabungkan data Stok (Input Harian), OMSET, dan Absensi & Gaji khusus untuk tanggal terpilih.
 */
export function buildDailyOperationalReport(state: AppData, ym: string, day: number): string {
  const dateLabel = getFullDateLabel(ym, day);
  const dateKey = formatDateKey(ym, day);
  const omState = getOmsetState(state);
  const omRecord = omState.days[dateKey];
  const omCalc = calcOmsetDay(omRecord);
  const gajiHari = getDailySalaryForDate(state, ym, day);
  const attSummary = getDayAttendanceSummary(state, ym, day);
  const stockReport = buildDailyClosingReport(state, ym, day);

  const lines: string[] = [
    `LAPORAN OPERASIONAL HARIAN - DOONA GOLF`,
    `${dateLabel}`,
    `========================================`,
    ``,
    `💰 RINGKASAN OMSET & KAS HARIAN`,
  ];

  if (!omCalc.filled) {
    lines.push(`- Status: Belum ada input OMSET pada tanggal ini.`);
  } else {
    const tunaiAkhir = omCalc.tl - omCalc.bx - gajiHari.tot;
    lines.push(`- Total Nota (Tunai + QRIS): ${formatRp(omCalc.kotor)}`);
    lines.push(`  • Tunai Nota: ${formatRp(omCalc.tn)} | QRIS Nota: ${formatRp(omCalc.qn)}`);
    lines.push(`- Total Real (Laci + mBanking): ${formatRp(omCalc.omset)}`);
    lines.push(`  • Tunai Laci: ${formatRp(omCalc.tl)} | QRIS Real: ${formatRp(omCalc.qr)}`);
    lines.push(`- Pengeluaran Harian (Nota): ${formatRp(omCalc.kx)}`);
    if (omCalc.bx > 0) {
      lines.push(`- Pengeluaran Besar (Omset): ${formatRp(omCalc.bx)}`);
    }
    lines.push(`- Omset Bersih (Real): ${formatRp(omCalc.omset)}`);
    lines.push(
      `- Selisih Tunai: ${formatSignedRp(omCalc.selT)}${omRecord?.kt ? ` (${omRecord.kt})` : ''}`
    );
    lines.push(
      `- Selisih QRIS: ${formatSignedRp(omCalc.selQ)}${omRecord?.kq ? ` (${omRecord.kq})` : ''}`
    );
    lines.push(`- Gaji Karyawan Harian: ${formatRp(gajiHari.tot)}`);
    lines.push(`- Estimasi Tunai Akhir (Laci - Pengeluaran Besar - Gaji): ${formatRp(tunaiAkhir)}`);
    if (omRecord?.cn) {
      lines.push(`- Catatan OMSET: ${omRecord.cn}`);
    }
  }

  lines.push(``);
  lines.push(`👥 RINGKASAN ABSENSI & GAJI HARIAN`);
  if (!gajiHari.saved && attSummary.savedCount === 0) {
    lines.push(`- Status: Absensi tanggal ini belum disimpan (${attSummary.totalActive} karyawan aktif).`);
  } else {
    lines.push(
      `- Hadir: ${attSummary.hadir} | Libur: ${attSummary.libur} | Izin: ${attSummary.izin} | Sakit: ${attSummary.sakit} | Alfa: ${attSummary.alfa}`
    );
    lines.push(`- Total Paket Lembur: ${formatNum(attSummary.lemburPaket)} paket`);
    lines.push(`- Total Beban Gaji Tanggal Ini: ${formatRp(gajiHari.tot)}`);
  }

  lines.push(``);
  lines.push(`========================================`);
  lines.push(stockReport.trim());

  return lines.join('\n') + '\n';
}

/**
 * 4. LAPORAN OPERASIONAL BULANAN TERPADU
 * Menggabungkan Rekap Stok Bulanan, Rekap OMSET Bulanan, dan Rekap Gaji Bulanan.
 */
export function buildMonthlyOperationalReport(
  state: AppData,
  ym: string,
  curYm: string,
  nowDay: number
): string {
  const monthLabel = getMonthLabel(ym);
  const nd = getDaysInMonth(ym);
  const refDay = ym === curYm ? Math.min(nowDay, nd) : nd;
  const omMonth = getOmsetMonthSummary(state, ym, refDay);
  const totalQrisReal = omMonth.p1.totals.qr + omMonth.p2.totals.qr;
  const payrollFull = getPeriodPayrollSummary(state, ym, 'full');
  const payrollEmps = getEmployeesForPayrollPeriod(state, ym, payrollFull.range);
  const stockMonthly = buildMonthlyStockReport(state, ym, curYm, nowDay);

  const lines: string[] = [
    `LAPORAN OPERASIONAL BULANAN - DOONA GOLF`,
    `Periode: ${monthLabel}`,
    `========================================`,
    ``,
    `💰 REKAP KEUANGAN (OMSET)`,
    `- Hari Terisi: ${omMonth.filledDays} hari (P1: ${omMonth.p1.closed ? 'Sudah Closing' : 'Terbuka'} | P2: ${omMonth.p2.closed ? 'Sudah Closing' : 'Terbuka'})`,
    `- Total Omset Real: ${formatRp(omMonth.omsetBersih)}`,
    `- Total Tunai Laci: ${formatRp(omMonth.tunaiLaci)} | Total QRIS Real: ${formatRp(totalQrisReal)}`,
    `- Pengeluaran Kecil (Nota): ${formatRp(omMonth.pengeluaranHarian)}`,
    `- Pengeluaran Besar (Omset): ${formatRp(omMonth.pengeluaranOmset)}`,
    `- Total Pengeluaran: ${formatRp(omMonth.totalPengeluaran)}`,
    `- Total Selisih Tunai: ${formatSignedRp(omMonth.selisihTunai)} | Selisih QRIS: ${formatSignedRp(omMonth.selisihQris)}`,
    `- Total Gaji (Sinkron Absensi): ${formatRp(omMonth.totalGaji)}`,
    `- Total Tunai Akhir: ${formatRp(omMonth.tunaiAkhirKepalaToko)}`,
    ``,
    `👥 REKAP ABSENSI & PENGGAJIAN (${payrollFull.range.label})`,
    `- Jumlah Karyawan Terhitung: ${payrollEmps.length} orang`,
    `- Total Hari Hadir: ${payrollFull.totalHadir} hari | Total Paket Lembur: ${formatNum(payrollFull.totalLemburPaket)} paket`,
    `- Total Gaji Pokok: ${formatRp(payrollFull.totalGapok)}`,
    `- Total Lembur: ${formatRp(payrollFull.totalLemburRp)}`,
    `- Total Penggajian Bulan Ini: ${formatRp(payrollFull.totalGaji)}`,
    ``,
    `========================================`,
    stockMonthly.trim(),
  ];

  return lines.join('\n') + '\n';
}

/**
 * Dispatcher tunggal pembangkit teks laporan sesuai preset aktif.
 */
export function buildReportByPreset(
  preset: ReportPresetMode,
  state: AppData,
  ym: string,
  day: number,
  curYm: string,
  nowDay: number
): string {
  switch (preset) {
    case 'closing_harian':
      return buildDailyClosingReport(state, ym, day);
    case 'rekap_bulanan':
      return buildMonthlyStockReport(state, ym, curYm, nowDay);
    case 'operasional_harian':
      return buildDailyOperationalReport(state, ym, day);
    case 'operasional_bulanan':
      return buildMonthlyOperationalReport(state, ym, curYm, nowDay);
    default:
      return buildDailyClosingReport(state, ym, day);
  }
}

/**
 * CSV 1: Format Pemakaian Harian (100% identik dengan fungsi csv() aplikasi lama)
 * Kolom: Tanggal, "Item 1", "Item 2", ...
 * Nilai yang belum diinput tetap kosong (''), tidak diubah menjadi 0.
 */
export function generateDailyUsageCsv(state: AppData, ym: string): string {
  const items = getActiveItems(state);
  const nd = getDaysInMonth(ym);
  const monthName = MONTH_NAMES[getMonth(ym) - 1] || '';
  const year = getYear(ym);

  const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
  const lines: string[] = ['Tanggal,' + items.map((i) => escapeCsv(i.nama)).join(',')];

  for (let d = 1; d <= nd; d++) {
    const cells = items.map((i) => {
      const u = getDailyUsage(state, ym, d, i.id);
      return u === null ? '' : String(u);
    });
    lines.push(`${d} ${monthName} ${year},${cells.join(',')}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * CSV 2: Rekap Stok Bulanan Lengkap (memanfaatkan sumber Tabel Bulanan)
 */
export function generateFullMonthlyStockCsv(
  state: AppData,
  ym: string,
  curYm: string,
  nowDay: number
): string {
  return generateMonthlyCsv(state, ym, curYm, nowDay, 'p');
}

/**
 * CSV 3: Rekap OMSET Harian Bulan Terpilih
 */
export function generateOmsetMonthlyCsv(state: AppData, ym: string): string {
  const nd = getDaysInMonth(ym);
  const omState = getOmsetState(state);
  const esc = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`;

  const header = [
    'Tanggal',
    'Tunai Nota',
    'QRIS Nota',
    'Total Nota',
    'Pengeluaran Nota',
    'QRIS Real',
    'Tunai Laci',
    'Total Real',
    'Selisih Tunai',
    'Keterangan Selisih Tunai',
    'Selisih QRIS',
    'Keterangan Selisih QRIS',
    'Omset Real',
    'Pengeluaran Besar',
    'Gaji Harian',
    'Tunai Akhir',
    'Catatan',
  ];

  const lines: string[] = [header.join(',')];

  for (let d = 1; d <= nd; d++) {
    const key = formatDateKey(ym, d);
    const rec = omState.days[key];
    const calc = calcOmsetDay(rec);
    const gaji = getDailySalaryForDate(state, ym, d);
    const tunaiAkhir = calc.filled ? calc.tl - calc.bx - gaji.tot : '';

    lines.push(
      [
        key,
        calc.filled ? calc.tn : '',
        calc.filled ? calc.qn : '',
        calc.filled ? calc.kotor : '',
        calc.filled ? calc.kx : '',
        calc.filled ? calc.qr : '',
        calc.filled ? calc.tl : '',
        calc.filled ? calc.omset : '',
        calc.filled ? (calc.selT ?? '') : '',
        esc(rec?.kt || ''),
        calc.filled ? (calc.selQ ?? '') : '',
        esc(rec?.kq || ''),
        calc.filled ? calc.omset : '',
        calc.filled ? calc.bx : '',
        gaji.saved ? gaji.tot : '',
        tunaiAkhir,
        esc(rec?.cn || ''),
      ].join(',')
    );
  }

  return lines.join('\n') + '\n';
}

/**
 * CSV 4: Rekap Absensi & Gaji Bulanan
 */
export function generatePayrollMonthlyCsv(state: AppData, ym: string): string {
  const summary = getPeriodPayrollSummary(state, ym, 'full');
  const emps = getEmployeesForPayrollPeriod(state, ym, summary.range);
  const esc = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`;

  const header = [
    'ID Karyawan',
    'Nama',
    'Status',
    'Siklus Gaji',
    'Hadir',
    'Libur',
    'Izin',
    'Sakit',
    'Alfa',
    'Paket Lembur',
    'Gaji Harian',
    'Tarif Lembur',
    'Total Gaji Pokok',
    'Total Lembur',
    'Total Gaji',
  ];

  const lines: string[] = [header.join(',')];

  emps.forEach(({ emp, isArchived }) => {
    const c = calcEmployeePayroll(state, ym, emp, summary.range);
    lines.push(
      [
        esc(emp.id),
        esc(emp.nama),
        isArchived ? 'Arsip' : emp.aktif ? 'Aktif' : 'Nonaktif',
        emp.siklusGaji === 'bulanan' ? 'Bulanan' : '14 Hari',
        c.h,
        c.l,
        c.iz,
        c.s,
        c.a,
        c.lm,
        c.effectiveGajiRate,
        c.effectiveLemburRate,
        c.gp,
        c.ul,
        c.tot,
      ].join(',')
    );
  });

  return lines.join('\n') + '\n';
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Ringkasan isi AppData (digunakan untuk tampilan Backup saat ini & pratinjau Restore).
 */
export function summarizeAppData(data: Partial<AppData>): BackupDataSummary {
  const items = Array.isArray(data.items) ? data.items : [];
  const activeItems = items.filter((i) => i && i.aktif).length;
  const archivedItems = items.length - activeItems;
  const satuanCount = Array.isArray(data.satuan) ? data.satuan.length : 0;
  const stockMonths = isPlainObject(data.m) ? Object.keys(data.m).sort() : [];
  const omsetDaysCount =
    isPlainObject(data.omset) && isPlainObject(data.omset.days)
      ? Object.keys(data.omset.days).length
      : 0;
  const omsetClosingCount =
    isPlainObject(data.omset) && isPlainObject(data.omset.closing)
      ? Object.keys(data.omset.closing).length
      : 0;
  const employeeCount = Array.isArray(data.karyawan) ? data.karyawan.length : 0;
  const archivedEmployeeCount = Array.isArray(data.karyawanArsip) ? data.karyawanArsip.length : 0;
  const attendanceMonths = isPlainObject(data.absensi) ? Object.keys(data.absensi).sort() : [];

  return {
    totalItems: items.length,
    activeItems,
    archivedItems,
    satuanCount,
    stockMonths,
    omsetDaysCount,
    omsetClosingCount,
    employeeCount,
    archivedEmployeeCount,
    attendanceMonths,
  };
}

/**
 * Validasi ketat file Backup JSON sebelum proses Restore.
 * Menolak file rusak / format salah tanpa pernah menyentuh data aplikasi yang sedang aktif.
 */
export function validateBackupPayload(rawJson: string): BackupValidationResult {
  const warnings: string[] = [];

  if (!rawJson || !rawJson.trim()) {
    return { valid: false, error: 'File JSON kosong.', warnings };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      valid: false,
      error: 'Format JSON tidak valid atau file rusak. Pastikan file berasal dari Backup DOONA GOLF.',
      warnings,
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      valid: false,
      error: 'Struktur root JSON tidak valid (harus berupa objek data DOONA GOLF).',
      warnings,
    };
  }

  // Validasi Master Items (wajib ada dan berupa array)
  if (!Array.isArray(parsed.items)) {
    return {
      valid: false,
      error: 'Struktur backup tidak valid: field "items" (Master Item) tidak ditemukan atau bukan array.',
      warnings,
    };
  }

  if (parsed.items.length === 0) {
    return {
      valid: false,
      error: 'File backup tidak memiliki Master Item sama sekali (daftar items kosong). Restore ditolak demi keamanan data.',
      warnings,
    };
  }

  const seenItemIds = new Set<string>();
  for (let idx = 0; idx < parsed.items.length; idx++) {
    const it = parsed.items[idx];
    if (!isPlainObject(it)) {
      return {
        valid: false,
        error: `Item pada urutan #${idx + 1} tidak valid (bukan objek).`,
        warnings,
      };
    }
    if (typeof it.id !== 'string' || !it.id.trim()) {
      return {
        valid: false,
        error: `Item pada urutan #${idx + 1} tidak memiliki ID item yang valid.`,
        warnings,
      };
    }
    if (seenItemIds.has(it.id)) {
      return {
        valid: false,
        error: `Terdapat ID item duplikat ("${it.id}") pada file backup.`,
        warnings,
      };
    }
    seenItemIds.add(it.id);

    if (typeof it.nama !== 'string' || !it.nama.trim()) {
      return {
        valid: false,
        error: `Item "${it.id}" tidak memiliki nama item yang valid.`,
        warnings,
      };
    }
    if (it.min !== undefined && (typeof it.min !== 'number' || Number.isNaN(it.min))) {
      return {
        valid: false,
        error: `Nilai stok minimum pada item "${it.nama}" bukan angka yang valid.`,
        warnings,
      };
    }
  }

  // Validasi data stok bulanan "m" (wajib berupa objek)
  if (!isPlainObject(parsed.m)) {
    return {
      valid: false,
      error: 'Struktur backup tidak valid: field "m" (data stok bulanan) tidak ditemukan atau bukan objek.',
      warnings,
    };
  }

  const ymRe = /^\d{4}-\d{2}$/;
  for (const [ymKey, monthVal] of Object.entries(parsed.m)) {
    if (!ymRe.test(ymKey)) {
      return {
        valid: false,
        error: `Kunci periode stok "${ymKey}" tidak valid (harus berformat YYYY-MM).`,
        warnings,
      };
    }
    if (!isPlainObject(monthVal)) {
      return {
        valid: false,
        error: `Data stok bulan "${ymKey}" bukan objek yang valid.`,
        warnings,
      };
    }
    if (monthVal.a !== undefined && !isPlainObject(monthVal.a)) {
      return {
        valid: false,
        error: `Data Stok Awal ("a") pada bulan "${ymKey}" tidak valid.`,
        warnings,
      };
    }
    if (monthVal.d !== undefined && !isPlainObject(monthVal.d)) {
      return {
        valid: false,
        error: `Data Barang Datang ("d") pada bulan "${ymKey}" tidak valid.`,
        warnings,
      };
    }
    if (monthVal.c !== undefined && !isPlainObject(monthVal.c)) {
      return {
        valid: false,
        error: `Data Closing ("c") pada bulan "${ymKey}" tidak valid.`,
        warnings,
      };
    }
  }

  // Validasi field opsional jika tersedia
  if (parsed.satuan !== undefined) {
    if (!Array.isArray(parsed.satuan) || parsed.satuan.some((s) => typeof s !== 'string' || !s.trim())) {
      return {
        valid: false,
        error: 'Field "satuan" pada file backup tidak valid (harus array teks satuan).',
        warnings,
      };
    }
  } else {
    warnings.push('Field "satuan" tidak ada di backup; satuan default akan digunakan.');
  }

  if (parsed.repCfg !== undefined && !isPlainObject(parsed.repCfg)) {
    return {
      valid: false,
      error: 'Field "repCfg" (konfigurasi laporan) tidak valid.',
      warnings,
    };
  }

  if (parsed.karyawan !== undefined) {
    if (!Array.isArray(parsed.karyawan)) {
      return {
        valid: false,
        error: 'Field "karyawan" harus berupa array.',
        warnings,
      };
    }
    for (let idx = 0; idx < parsed.karyawan.length; idx++) {
      const emp = parsed.karyawan[idx];
      if (!isPlainObject(emp) || typeof emp.id !== 'string' || typeof emp.nama !== 'string') {
        return {
          valid: false,
          error: `Data karyawan #${idx + 1} tidak valid (wajib memiliki id dan nama).`,
          warnings,
        };
      }
    }
  } else {
    warnings.push('Field "karyawan" tidak ada di backup (kemungkinan backup versi lama); data default karyawan akan dipakai.');
  }

  if (parsed.karyawanArsip !== undefined && !Array.isArray(parsed.karyawanArsip)) {
    return {
      valid: false,
      error: 'Field "karyawanArsip" harus berupa array.',
      warnings,
    };
  }

  if (parsed.absensi !== undefined && !isPlainObject(parsed.absensi)) {
    return {
      valid: false,
      error: 'Field "absensi" harus berupa objek.',
      warnings,
    };
  }

  if (parsed.omset !== undefined) {
    if (!isPlainObject(parsed.omset)) {
      return {
        valid: false,
        error: 'Field "omset" harus berupa objek.',
        warnings,
      };
    }
    if (parsed.omset.days !== undefined && !isPlainObject(parsed.omset.days)) {
      return {
        valid: false,
        error: 'Field "omset.days" tidak valid.',
        warnings,
      };
    }
    if (parsed.omset.closing !== undefined && !isPlainObject(parsed.omset.closing)) {
      return {
        valid: false,
        error: 'Field "omset.closing" tidak valid.',
        warnings,
      };
    }
  }

  const typed = parsed as Partial<AppData>;
  return {
    valid: true,
    warnings,
    parsed: typed,
    summary: summarizeAppData(typed),
  };
}
