import { DEFAULT_KARYAWAN, MONTH_NAMES } from '../constants/defaults';
import type {
  AppData,
  AttendanceDraftMap,
  AttendanceRecord,
  AttendanceStatus,
  Employee,
  PayrollCycle,
} from '../types/app';
import { formatRp, getDaysInMonth, getMonth, getYear } from './dateUtils';

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'Hadir',
  'Izin',
  'Sakit',
  'Alfa',
  'Libur',
];

export function getEmployees(state: AppData): Employee[] {
  return Array.isArray(state.karyawan) ? state.karyawan : DEFAULT_KARYAWAN;
}

export function getArchivedEmployees(state: AppData): Employee[] {
  return Array.isArray(state.karyawanArsip) ? state.karyawanArsip : [];
}

export function getActiveEmployees(state: AppData): Employee[] {
  return getEmployees(state).filter((k) => Boolean(k.aktif));
}

/**
 * Gabungan karyawan master + arsip dengan deduplikasi berdasarkan ID.
 * Digunakan oleh modul Penggajian, OMSET, dan Dashboard agar histori selalu konsisten.
 */
export function getAllEmployeesWithArchive(state: AppData): Employee[] {
  const seen = new Set<string>();
  const result: Employee[] = [];
  for (const emp of [...getEmployees(state), ...getArchivedEmployees(state)]) {
    if (!emp || !emp.id || seen.has(emp.id)) continue;
    seen.add(emp.id);
    result.push(emp);
  }
  return result;
}

export function isEmployeeArchived(state: AppData, empId: string): boolean {
  return (
    !getEmployees(state).some((e) => e.id === empId) &&
    getArchivedEmployees(state).some((e) => e.id === empId)
  );
}

/**
 * Menentukan tarif gaji harian & lembur per paket untuk 1 catatan absensi.
 * Jika catatan menyimpan snapshot tarif historis, gunakan snapshot tersebut agar
 * perubahan tarif baru tidak mengubah histori lama secara retroaktif.
 */
export function resolveAttendanceRates(
  emp: Employee,
  rec?: AttendanceRecord | null
): { gajiHarian: number; lemburPerPaket: number } {
  const gajiHarian =
    rec && rec.gajiHarian !== undefined && rec.gajiHarian !== null
      ? Number(rec.gajiHarian) || 0
      : Number(emp.gajiHarian) || 0;
  const lemburPerPaket =
    rec && rec.lemburPerPaket !== undefined && rec.lemburPerPaket !== null
      ? Number(rec.lemburPerPaket) || 0
      : Number(emp.lemburPerPaket) || 0;
  return { gajiHarian, lemburPerPaket };
}

/**
 * Rumus gaji harian tunggal (Single Source of Truth untuk Absensi, Rekap Gaji, Slip, OMSET & Beranda).
 * - Hanya status "Hadir" yang memperoleh gaji pokok harian.
 * - Status Libur, Izin, Sakit, Alfa = Rp 0 gaji pokok.
 * - Uang lembur = jumlah paket lembur × tarif lembur per paket.
 */
export function calcAttendanceRecordPay(
  emp: Employee,
  rec?: AttendanceRecord | null
): { gp: number; ul: number; tot: number; lm: number; rateGaji: number; rateLembur: number } {
  const { gajiHarian, lemburPerPaket } = resolveAttendanceRates(emp, rec);
  if (!rec) {
    return { gp: 0, ul: 0, tot: 0, lm: 0, rateGaji: gajiHarian, rateLembur: lemburPerPaket };
  }
  const lm = Math.max(0, Number(rec.lembur) || 0);
  const gp = rec.status === 'Hadir' ? gajiHarian : 0;
  const ul = lm * lemburPerPaket;
  return {
    gp,
    ul,
    tot: gp + ul,
    lm,
    rateGaji: gajiHarian,
    rateLembur: lemburPerPaket,
  };
}

export interface PayrollRange {
  start: number;
  end: number;
  label: string;
  shortLabel: string;
  isBiweekly: boolean;
  payDay: number;
  count: number;
}

/** Rumus periode gaji (identik dengan getPayrollRange di HTML lama) */
export function getPayrollRange(ym: string, cycle: PayrollCycle): PayrollRange {
  const nd = getDaysInMonth(ym);
  const bln = `${MONTH_NAMES[getMonth(ym) - 1]} ${getYear(ym)}`;

  if (cycle === 'p1') {
    const end = Math.min(15, nd);
    return {
      start: 1,
      end,
      shortLabel: `Gaji Tahap 1 (Tgl 1 - ${end})`,
      label: `Tahap 1 (1 - ${end} ${bln})`,
      isBiweekly: true,
      payDay: end,
      count: end,
    };
  }
  if (cycle === 'p2') {
    return {
      start: 16,
      end: nd,
      shortLabel: `Gaji Tahap 2 (Tgl 16 - ${nd})`,
      label: `Tahap 2 (16 - ${nd} ${bln})`,
      isBiweekly: true,
      payDay: nd,
      count: nd - 16 + 1,
    };
  }
  return {
    start: 1,
    end: nd,
    shortLabel: '1 Bulan Penuh',
    label: `1 Bulan Penuh (1 - ${nd} ${bln})`,
    isBiweekly: false,
    payDay: nd,
    count: nd,
  };
}

export interface EmployeePayrollCalc {
  h: number;
  l: number;
  iz: number;
  s: number;
  a: number;
  lm: number;
  gp: number;
  ul: number;
  tot: number;
  off: number;
  hasMixedRates: boolean;
  effectiveGajiRate: number;
  effectiveLemburRate: number;
}

/** Perhitungan gaji satu karyawan dalam rentang tanggal (identik dengan calc(k) di HTML lama) */
export function calcEmployeePayroll(
  state: AppData,
  ym: string,
  emp: Employee,
  range: PayrollRange
): EmployeePayrollCalc {
  const absMonth = state.absensi?.[ym] || {};
  const c: EmployeePayrollCalc = {
    h: 0,
    l: 0,
    iz: 0,
    s: 0,
    a: 0,
    lm: 0,
    gp: 0,
    ul: 0,
    tot: 0,
    off: 0,
    hasMixedRates: false,
    effectiveGajiRate: Number(emp.gajiHarian) || 0,
    effectiveLemburRate: Number(emp.lemburPerPaket) || 0,
  };

  const gajiRatesSeen = new Set<number>();
  const lemburRatesSeen = new Set<number>();

  for (let d = range.start; d <= range.end; d++) {
    const r = absMonth[d]?.[emp.id];
    if (!r) continue;
    if (r.status === 'Hadir') c.h++;
    else if (r.status === 'Libur') c.l++;
    else if (r.status === 'Izin') c.iz++;
    else if (r.status === 'Sakit') c.s++;
    else if (r.status === 'Alfa') c.a++;

    const pay = calcAttendanceRecordPay(emp, r);
    c.lm += pay.lm;
    c.gp += pay.gp;
    c.ul += pay.ul;
    if (r.status === 'Hadir') gajiRatesSeen.add(pay.rateGaji);
    if (pay.lm > 0) lemburRatesSeen.add(pay.rateLembur);
  }

  c.tot = c.gp + c.ul;
  c.off = c.l + c.iz + c.s + c.a;
  c.hasMixedRates = gajiRatesSeen.size > 1 || lemburRatesSeen.size > 1;
  if (gajiRatesSeen.size === 1) {
    c.effectiveGajiRate = Array.from(gajiRatesSeen)[0];
  }
  if (lemburRatesSeen.size === 1) {
    c.effectiveLemburRate = Array.from(lemburRatesSeen)[0];
  }
  return c;
}

/**
 * Daftar karyawan yang muncul pada rekap gaji suatu periode:
 * seluruh karyawan master + karyawan arsip yang memiliki catatan absensi pada periode tsb.
 * Menjamin total Rekap Gaji 100% sama dengan total gaji yang dibaca modul OMSET.
 */
export function getEmployeesForPayrollPeriod(
  state: AppData,
  ym: string,
  range: PayrollRange
): Array<{ emp: Employee; isArchived: boolean }> {
  const master = getEmployees(state);
  const archived = getArchivedEmployees(state);
  const absMonth = state.absensi?.[ym] || {};
  const masterIds = new Set(master.map((e) => e.id));

  const list: Array<{ emp: Employee; isArchived: boolean }> = master.map((emp) => ({
    emp,
    isArchived: false,
  }));

  archived.forEach((emp) => {
    if (masterIds.has(emp.id)) return;
    let hasRecordInRange = false;
    for (let d = range.start; d <= range.end; d++) {
      if (absMonth[d]?.[emp.id]) {
        hasRecordInRange = true;
        break;
      }
    }
    if (hasRecordInRange) {
      list.push({ emp, isArchived: true });
    }
  });

  return list;
}

/**
 * Total gaji pada 1 tanggal tertentu (identik dengan omGaji(y, d) pada HTML lama).
 * Dipakai langsung oleh modul OMSET dan Dashboard agar 100% sinkron dengan modul Penggajian.
 */
export function getDailySalaryForDate(
  state: AppData,
  ym: string,
  day: number
): { tot: number; h: number; saved: boolean } {
  const ymKey = ym.slice(0, 7);
  const absDay = state.absensi?.[ymKey]?.[day];
  if (!absDay || Object.keys(absDay).length === 0) {
    return { tot: 0, h: 0, saved: false };
  }

  const allEmps = getAllEmployeesWithArchive(state);
  let tot = 0;
  let h = 0;

  Object.keys(absDay).forEach((id) => {
    const rec = absDay[id];
    const emp = allEmps.find((e) => e.id === id);
    if (!rec || !emp) return;
    const pay = calcAttendanceRecordPay(emp, rec);
    if (rec.status === 'Hadir') {
      h++;
    }
    tot += pay.tot;
  });

  return { tot, h, saved: true };
}

export interface DayAttendanceSummary {
  totalActive: number;
  hadir: number;
  izin: number;
  sakit: number;
  alfa: number;
  libur: number;
  lemburPaket: number;
  totalGajiHariIni: number;
  savedCount: number;
  pendingCount: number;
  hasDraft: boolean;
}

export function getDayAttendanceSummary(
  state: AppData,
  ym: string,
  day: number,
  draftMap: AttendanceDraftMap = {}
): DayAttendanceSummary {
  const activeEmps = getActiveEmployees(state);
  const absDay = state.absensi?.[ym]?.[day] || {};
  const draftKey = `${ym}|${day}`;
  const draftDay = draftMap[draftKey] || {};

  let hadir = 0;
  let izin = 0;
  let sakit = 0;
  let alfa = 0;
  let libur = 0;
  let lemburPaket = 0;
  let totalGajiHariIni = 0;
  let savedCount = 0;

  activeEmps.forEach((emp) => {
    const committed = absDay[emp.id];
    const draftRec = draftDay[emp.id];
    const effective = draftRec || committed;
    const isSaved = Boolean(committed) && !draftRec;

    if (isSaved) savedCount++;
    if (!effective) return;

    if (effective.status === 'Hadir') hadir++;
    else if (effective.status === 'Izin') izin++;
    else if (effective.status === 'Sakit') sakit++;
    else if (effective.status === 'Alfa') alfa++;
    else if (effective.status === 'Libur') libur++;

    const pay = calcAttendanceRecordPay(emp, effective);
    lemburPaket += pay.lm;
    totalGajiHariIni += pay.tot;
  });

  const hasDraft = Object.keys(draftMap).some(
    (k) => Object.keys(draftMap[k] || {}).length > 0
  );

  return {
    totalActive: activeEmps.length,
    hadir,
    izin,
    sakit,
    alfa,
    libur,
    lemburPaket,
    totalGajiHariIni,
    savedCount,
    pendingCount: activeEmps.length - savedCount,
    hasDraft,
  };
}

/**
 * Row model siap render untuk tab Harian Absensi (identik dengan logika views.ab() harian di HTML lama:
 * karyawan yang belum disimpan ditampilkan dengan default pratinjau status 'Hadir' & lembur 0).
 */
export interface DailyAttendanceRow {
  emp: Employee;
  committed?: AttendanceRecord;
  draft?: AttendanceRecord;
  effective: AttendanceRecord;
  isSaved: boolean;
  gp: number;
  ul: number;
  tot: number;
}

export function getDailyAttendanceViewModel(
  state: AppData,
  ym: string,
  day: number,
  draftMap: AttendanceDraftMap = {}
): {
  rows: DailyAttendanceRow[];
  hadir: number;
  lembur: number;
  gaji: number;
  saved: number;
  pending: number;
  draftDayCount: number;
} {
  const activeEmps = getActiveEmployees(state);
  const absDay = state.absensi?.[ym]?.[day] || {};
  const draftKey = `${ym}|${day}`;
  const draftDay = draftMap[draftKey] || {};

  let hadir = 0;
  let lembur = 0;
  let gaji = 0;
  let saved = 0;

  const rows: DailyAttendanceRow[] = activeEmps.map((emp) => {
    const committed = absDay[emp.id];
    const draft = draftDay[emp.id];
    const effective: AttendanceRecord = draft || committed || { status: 'Hadir', lembur: 0 };
    const isSaved = Boolean(committed) && !draft;
    const pay = calcAttendanceRecordPay(emp, effective);

    if (isSaved) saved++;
    if (effective.status === 'Hadir') hadir++;
    lembur += pay.lm;
    gaji += pay.tot;

    return {
      emp,
      committed,
      draft,
      effective,
      isSaved,
      gp: pay.gp,
      ul: pay.ul,
      tot: pay.tot,
    };
  });

  const draftDayCount = Object.keys(draftMap).filter(
    (k) => Object.keys(draftMap[k] || {}).length > 0
  ).length;

  return {
    rows,
    hadir,
    lembur,
    gaji,
    saved,
    pending: activeEmps.length - saved,
    draftDayCount,
  };
}

export interface PeriodPayrollSummary {
  range: PayrollRange;
  totalGaji: number;
  totalGapok: number;
  totalLemburRp: number;
  totalHadir: number;
  totalLemburPaket: number;
  filledDays: number;
}

export function getPeriodPayrollSummary(
  state: AppData,
  ym: string,
  cycle: PayrollCycle
): PeriodPayrollSummary {
  const range = getPayrollRange(ym, cycle);
  const allEmps = getAllEmployeesWithArchive(state);
  const absMonth = state.absensi?.[ym] || {};

  let totalGaji = 0;
  let totalGapok = 0;
  let totalLemburRp = 0;
  let totalHadir = 0;
  let totalLemburPaket = 0;
  let filledDays = 0;

  for (let d = range.start; d <= range.end; d++) {
    if (absMonth[d] && Object.keys(absMonth[d]).length > 0) {
      filledDays++;
    }
  }

  allEmps.forEach((emp) => {
    const c = calcEmployeePayroll(state, ym, emp, range);
    totalGaji += c.tot;
    totalGapok += c.gp;
    totalLemburRp += c.ul;
    totalHadir += c.h;
    totalLemburPaket += c.lm;
  });

  return {
    range,
    totalGaji,
    totalGapok,
    totalLemburRp,
    totalHadir,
    totalLemburPaket,
    filledDays,
  };
}

export interface AttendanceCalendarDayInfo {
  day: number;
  people: Array<{ emp: Employee; record?: AttendanceRecord; isArchived: boolean }>;
  hadirCount: number;
  absentCount: number;
  pendingCount: number;
  recordedCount: number;
  status: 'none' | 'full' | 'part' | 'zero';
}

export function getAttendanceCalendarMonth(
  state: AppData,
  ym: string
): {
  days: AttendanceCalendarDayInfo[];
  filledDays: number;
  totalHadir: number;
  totalAbsent: number;
} {
  const nd = getDaysInMonth(ym);
  const absMonth = state.absensi?.[ym] || {};
  const allEmps = getAllEmployeesWithArchive(state);

  const days: AttendanceCalendarDayInfo[] = [];
  let filledDays = 0;
  let totalHadir = 0;
  let totalAbsent = 0;

  for (let d = 1; d <= nd; d++) {
    const dayMap = absMonth[d] || {};
    const people = allEmps
      .filter((emp) => Boolean(emp.aktif) || Boolean(dayMap[emp.id]))
      .map((emp) => ({
        emp,
        record: dayMap[emp.id],
        isArchived: isEmployeeArchived(state, emp.id),
      }));

    const recorded = people.filter((p) => Boolean(p.record));
    const hadirCount = recorded.filter((p) => p.record?.status === 'Hadir').length;
    const absentCount = recorded.length - hadirCount;
    const pendingCount = people.length - recorded.length;

    totalHadir += hadirCount;
    totalAbsent += absentCount;
    if (recorded.length > 0) filledDays++;

    const status: AttendanceCalendarDayInfo['status'] =
      recorded.length === 0
        ? 'none'
        : hadirCount === recorded.length
          ? 'full'
          : hadirCount === 0
            ? 'zero'
            : 'part';

    days.push({
      day: d,
      people,
      hadirCount,
      absentCount,
      pendingCount,
      recordedCount: recorded.length,
      status,
    });
  }

  return { days, filledDays, totalHadir, totalAbsent };
}

/**
 * Format teks WhatsApp rekap penggajian seluruh karyawan pada periode terpilih
 * (identik dengan copyRekapSlipWA pada HTML lama, termasuk karyawan arsip yg punya histori).
 */
export function buildRekapSlipWA(
  state: AppData,
  ym: string,
  cycle: PayrollCycle
): string {
  const rng = getPayrollRange(ym, cycle);
  const emps = getEmployeesForPayrollPeriod(state, ym, rng);

  let totalPeriodeGaji = 0;
  let totalPeriodeHadir = 0;
  let totalPeriodeLembur = 0;

  let txt = `📋 *REKAP PENGGAJIAN KARYAWAN*\n`;
  txt += `🏢 *DOONA GOLF – STOK & PAYROLL*\n`;
  txt += `⏱️ *Siklus:* ${rng.shortLabel}\n`;
  txt += `📅 *Periode:* ${rng.label}\n`;
  txt += `========================================\n\n`;

  emps.forEach(({ emp: k, isArchived }, idx) => {
    const c = calcEmployeePayroll(state, ym, k, rng);
    totalPeriodeGaji += c.tot;
    totalPeriodeHadir += c.h;
    totalPeriodeLembur += c.lm;

    const cycleTag = k.siklusGaji === 'bulanan' ? '_(Bulanan)_' : '_(2x Sebulan)_';
    const arsipTag = isArchived ? ' [Arsip]' : '';
    txt += `${idx + 1}. *${k.nama}*${arsipTag} ${cycleTag}\n`;
    txt += `   • Gaji Harian : ${formatRp(c.effectiveGajiRate)}/hari${c.hasMixedRates ? ' (tarif bervariasi)' : ''}\n`;
    txt += `   • Kehadiran   : ${c.h} hari (${formatRp(c.gp)})\n`;
    txt += `   • Lembur      : ${c.lm} paket (${formatRp(c.ul)})\n`;
    if (c.l || c.iz || c.s || c.a) {
      txt += `   • Ket. Lain   : Libur: ${c.l}, Izin: ${c.iz}, Sakit: ${c.s}, Alfa: ${c.a}\n`;
    }
    txt += `   👉 *TOTAL GAJI: ${formatRp(c.tot)}*\n\n`;
  });

  txt += `========================================\n`;
  txt += `💰 *TOTAL PENGELUARAN GAJI: ${formatRp(totalPeriodeGaji)}*\n`;
  txt += `👥 Total Hari Kehadiran: ${totalPeriodeHadir} hari\n`;
  txt += `⏱️ Total Paket Lembur: ${totalPeriodeLembur} paket\n`;
  txt += `========================================\n`;
  txt += `Dicatat otomatis oleh Sistem Manajemen Doona Golf.`;

  return txt;
}

/**
 * Format teks WhatsApp slip rincian gaji 1 karyawan (identik dengan copySingleEmpSlipWA pada HTML lama).
 */
export function buildSingleEmpSlipWA(
  state: AppData,
  ym: string,
  cycle: PayrollCycle,
  empId: string
): string | null {
  const k = getAllEmployeesWithArchive(state).find((x) => x.id === empId);
  if (!k) return null;

  const rng = getPayrollRange(ym, cycle);
  const c = calcEmployeePayroll(state, ym, k, rng);
  const archived = isEmployeeArchived(state, k.id);
  const statusLabel = archived
    ? 'Diarsipkan'
    : k.aktif
      ? 'Karyawan Aktif'
      : 'Nonaktif';

  let txt = `🧾 *SLIP RINCIAN GAJI KARYAWAN*\n`;
  txt += `🏢 *DOONA GOLF – STOK & PAYROLL*\n`;
  txt += `⏱️ *Siklus Gaji:* ${rng.shortLabel}\n`;
  txt += `📅 *Periode:* ${rng.label}\n`;
  txt += `========================================\n`;
  txt += `👤 *Nama Karyawan:* ${k.nama}\n`;
  txt += `📌 *Status:* ${statusLabel} ${k.siklusGaji === 'bulanan' ? '(Bulanan)' : '(2x Sebulan)'}\n`;
  txt += `----------------------------------------\n`;
  txt += `💵 *Tarif Gaji Pokok:* ${formatRp(c.effectiveGajiRate)} / hari${c.hasMixedRates ? ' (tarif bervariasi)' : ''}\n`;
  txt += `⏱️ *Tarif Lembur:* ${formatRp(c.effectiveLemburRate)} / paket\n`;
  txt += `----------------------------------------\n`;
  txt += `📊 *RINCIAN KEHADIRAN & GAJI:*\n`;
  txt += `• Hari Masuk/Hadir : ${c.h} hari (dari ${rng.count} hari)  ➔  ${formatRp(c.gp)}\n`;
  txt += `• Paket Lembur     : ${c.lm} paket  ➔  ${formatRp(c.ul)}\n`;
  if (c.l || c.iz || c.s || c.a) {
    txt += `• Keterangan Lain  : Libur (${c.l}), Izin (${c.iz}), Sakit (${c.s}), Alfa (${c.a})\n`;
  }
  txt += `========================================\n`;
  txt += `💰 *TOTAL GAJI DITERIMA: ${formatRp(c.tot)}*\n`;
  txt += `========================================\n`;
  txt += `_Dicatat otomatis oleh Sistem Manajemen Doona Golf._`;

  return txt;
}
