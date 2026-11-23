import type { AppData, Employee, MasterItem } from '../types/app';

export const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export const DAY_NAMES = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

export const DEFAULT_CATEGORIES = [
  'Dimsum',
  'Saos',
  'Toping & Ads On',
  'Packaging',
  'Lain-Lain',
] as const;

export const DEFAULT_SATUAN = [
  'pcs',
  'porsi',
  'botol',
  'pak',
  'box',
  'cup',
  'gram',
  'kg',
  'liter',
] as const;

export const SEED_ITEMS: ReadonlyArray<[string, string, string, number]> = [
  ['Dimsum', 'Dimsum', 'porsi', 30],
  ['Saos', 'Mentai', 'botol', 3],
  ['Saos', 'Fina', 'botol', 3],
  ['Toping & Ads On', 'Chili Oil', 'botol', 3],
  ['Toping & Ads On', 'Keju', 'pcs', 10],
  ['Toping & Ads On', 'Nori', 'pak', 5],
  ['Toping & Ads On', 'Tobiko', 'pak', 3],
  ['Packaging', 'Tray 6', 'pcs', 200],
  ['Packaging', 'Tray 8', 'pcs', 200],
  ['Packaging', 'Tray 16', 'pcs', 100],
  ['Packaging', 'Outer', 'pcs', 100],
  ['Packaging', 'Plastik Kecil', 'pak', 5],
  ['Packaging', 'Plastik Besar', 'pak', 5],
  ['Lain-Lain', 'Torch', 'pcs', 2],
  ['Lain-Lain', 'Sumpit', 'pak', 5],
];

export const DEFAULT_KARYAWAN: Employee[] = [
  { id: 'k1', nama: 'Budi Santoso', gajiHarian: 75000, lemburPerPaket: 25000, aktif: 1 },
  { id: 'k2', nama: 'Siti Rahma', gajiHarian: 75000, lemburPerPaket: 25000, aktif: 1 },
];

export const DEFAULT_API_URL =
  'https://script.google.com/macros/s/AKfycbwXCCAq45-oXnr-V4rsZvpFJmzCiDqqabHZG0E20Te7ACZ9ytJUKdMx0nN5WuK53U4BMg/exec';

export const DOONA_LOGO_URL =
  'https://lh3.googleusercontent.com/d/1boKc0wRaiXcixOiykC-aG97weXTUi6ul';

export const SHEETS_LIST = [
  'STOK_TERKINI',
  'BARANG_DATANG',
  'CLOSING_FISIK',
  'PEMAKAIAN',
  'STOK_TOTAL',
  'INPUT_HARIAN',
  'REKAP_ABSENSI',
  'KARYAWAN',
  'USERS',
  'DATA_STATE',
  'OMSET_REKAP',
  'OMSET_HARIAN',
  'OMSET_PENGELUARAN',
] as const;

export function createDefaultState(): AppData {
  const items: MasterItem[] = SEED_ITEMS.map((r, i) => ({
    id: `i${i}`,
    kat: r[0],
    nama: r[1],
    sat: r[2],
    min: r[3],
    aktif: 1,
  }));

  return {
    items,
    satuan: [...DEFAULT_SATUAN],
    repCfg: {},
    m: {},
    karyawan: DEFAULT_KARYAWAN.map((k) => ({ ...k })),
    absensi: {},
    omset: { days: {}, closing: {} },
  };
}

export function normalizeAppData(raw: Partial<AppData> | null | undefined): AppData {
  if (!raw || !Array.isArray(raw.items)) {
    return createDefaultState();
  }
  return {
    items: raw.items,
    satuan: Array.isArray(raw.satuan) ? raw.satuan : [...DEFAULT_SATUAN],
    repCfg: raw.repCfg && typeof raw.repCfg === 'object' ? raw.repCfg : {},
    m: raw.m && typeof raw.m === 'object' ? raw.m : {},
    karyawan: Array.isArray(raw.karyawan)
      ? raw.karyawan
      : DEFAULT_KARYAWAN.map((k) => ({ ...k })),
    karyawanArsip: Array.isArray(raw.karyawanArsip) ? raw.karyawanArsip : undefined,
    absensi: raw.absensi && typeof raw.absensi === 'object' ? raw.absensi : {},
    shiftConfig:
      raw.shiftConfig && typeof raw.shiftConfig === 'object' ? raw.shiftConfig : undefined,
    omset:
      raw.omset && typeof raw.omset === 'object'
        ? {
            days: raw.omset.days || {},
            closing: raw.omset.closing || {},
          }
        : { days: {}, closing: {} },
  };
}
