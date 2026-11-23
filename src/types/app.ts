export type MenuId =
  | 'home'
  | 'in'
  | 'tb'
  | 'om'
  | 'ab'
  | 'aw'
  | 'ms'
  | 'st'
  | 'lp'
  | 'db';

export type InputHarianTab = 'closing' | 'datang' | 'pemakaian';
export type OmsetSubTab = 'harian' | 'pengeluaran' | 'kalender' | 'grafik' | 'rekap';
export type AbsensiSubTab = 'harian' | 'kalender' | 'karyawan' | 'rekap' | 'detail';
export type PayrollCycle = 'p1' | 'p2' | 'full';
export type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alfa' | 'Libur';
export type AttendanceShift = 'Pagi' | 'Siang' | 'Full' | 'Fleksibel';

export interface MasterItem {
  id: string;
  kat: string;
  nama: string;
  sat: string;
  min: number;
  aktif: number; // 1 = aktif, 0 = arsip
}

export interface ReportItemConfig {
  sisa: boolean;
  pakai: boolean;
}

export interface MonthStock {
  /** Stok awal bulan (tgl 1): { [itemId]: number } */
  a: Record<string, number>;
  /** Barang datang per tanggal: { [day]: { [itemId]: number } } */
  d: Record<number, Record<string, number>>;
  /** Sisa fisik closing per tanggal: { [day]: { [itemId]: number } } */
  c: Record<number, Record<string, number>>;
}

export interface Employee {
  id: string;
  nama: string;
  foto?: string;
  jabatan?: string;
  shiftDefault?: AttendanceShift;
  gajiHarian: number;
  lemburPerPaket: number;
  siklusGaji?: '14hari' | 'bulanan';
  aktif: number; // 1 = aktif, 0 = nonaktif
}

export interface AttendanceRecord {
  status: AttendanceStatus;
  lembur: number;
  /** Snapshot tarif saat absensi disimpan agar perubahan tarif tidak mengubah histori lama secara retroaktif */
  gajiHarian?: number;
  lemburPerPaket?: number;
  /** Field HRIS opsional (100% kompatibel dengan data lama) */
  shift?: AttendanceShift;
  checkIn?: string; // HH:mm
  checkOut?: string; // HH:mm
  catatan?: string;
  updatedAt?: string;
}

export interface OmsetExpenseItem {
  k: string;
  v: number;
}

export interface OmsetDayRecord {
  /** Tunai nota kasir */
  tn?: number;
  /** QRIS nota kasir */
  qn?: number;
  /** QRIS real mBanking */
  qr?: number;
  /** Tunai real di laci */
  tl?: number;
  /** Pengeluaran harian kecil */
  kx?: OmsetExpenseItem[];
  /** Pengeluaran besar dari omset tunai */
  bx?: OmsetExpenseItem[];
  /** Keterangan selisih tunai */
  kt?: string;
  /** Keterangan selisih QRIS */
  kq?: string;
  /** Catatan opsional */
  cn?: string;
}

export interface OmsetClosingSnapshot {
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

export interface OmsetClosingRecord {
  at: string;
  by: string;
  snap: OmsetClosingSnapshot;
}

export interface OmsetState {
  days: Record<string, OmsetDayRecord>;
  closing: Record<string, OmsetClosingRecord>;
}

export interface AppData {
  items: MasterItem[];
  satuan: string[];
  repCfg: Record<string, ReportItemConfig>;
  m: Record<string, MonthStock>;
  karyawan: Employee[];
  karyawanArsip?: Employee[];
  absensi: Record<string, Record<number, Record<string, AttendanceRecord>>>;
  omset?: OmsetState;
}

export interface UserProfile {
  username: string;
  nama?: string;
  foto?: string;
  role?: 'admin' | 'viewer' | string;
}

export type DbConnectionMode =
  | 'gas'
  | 'cloud_connected'
  | 'cloud_unauth'
  | 'local';

export interface NavigationOptions {
  day?: number;
  ym?: string;
  inputTab?: InputHarianTab;
  omSub?: OmsetSubTab;
  omPeriod?: 0 | 1 | 2;
  abSub?: AbsensiSubTab;
  abCycle?: PayrollCycle;
}

export type AttendanceDraftMap = Record<string, Record<string, AttendanceRecord>>;
