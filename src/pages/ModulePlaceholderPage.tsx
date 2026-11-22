import React from 'react';
import { ArrowLeft, Calendar, Layers } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getFullDateLabel, getMonthLabel } from '../domain/dateUtils';
import type { MenuId } from '../types/app';

const MENU_DESCRIPTIONS: Record<Exclude<MenuId, 'home' | 'db'>, { title: string; summary: string }> = {
  in: {
    title: 'Input Harian',
    summary: 'Pencatatan Closing Fisik dan Barang Datang harian per kategori item.',
  },
  tb: {
    title: 'Tabel Bulanan',
    summary: 'Matriks pemakaian, barang datang, stok total siap jual, sisa closing, dan mode plain text.',
  },
  om: {
    title: 'OMSET',
    summary: 'Pencatatan Tunai/QRIS nota vs real, pengeluaran harian & omset, kalender, grafik, dan closing periode.',
  },
  ab: {
    title: 'Absensi & Gaji',
    summary: 'Input absensi harian karyawan, kalender kehadiran, manajemen karyawan, dan rekap slip gaji.',
  },
  aw: {
    title: 'Stok Awal',
    summary: 'Saldo awal persediaan tanggal 1 tiap bulan dan impor otomatis dari closing terakhir bulan lalu.',
  },
  ms: {
    title: 'Master Item',
    summary: 'Sumber daftar barang aktif/arsip, kategori, satuan aktif, dan batas stok minimum.',
  },
  st: {
    title: 'Setting Satuan',
    summary: 'Daftar satuan standar/kustom dan penyesuaian satuan per item yang sinkron ke seluruh modul.',
  },
  lp: {
    title: 'Laporan & Ekspor',
    summary: 'Pratinjau teks laporan closing WhatsApp/Telegram, editor teks, format item, ekspor CSV, dan backup JSON.',
  },
};

export const ModulePlaceholderPage: React.FC<{ menu: Exclude<MenuId, 'home' | 'db'> }> = ({
  menu,
}) => {
  const { ym, day, inputTab, omSub, omPeriod, abSub, abCycle, navigateTo } = useApp();
  const meta = MENU_DESCRIPTIONS[menu];

  const contextInfo =
    menu === 'in'
      ? `Tanggal aktif: ${getFullDateLabel(ym, day)} · Tab: ${inputTab === 'closing' ? 'Closing Fisik' : 'Barang Datang'}`
      : menu === 'om'
        ? `Tanggal aktif: ${getFullDateLabel(ym, day)} · Tab: ${omSub}${omPeriod ? ` · Periode ${omPeriod}` : ''}`
        : menu === 'ab'
          ? `Tanggal aktif: ${getFullDateLabel(ym, day)} · Tab: ${abSub} · Siklus: ${abCycle}`
          : `Periode aktif: ${getMonthLabel(ym)}`;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] px-5 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <Layers className="h-4 w-4 text-[#1a9e94]" />
          <h2 className="text-[15px] font-semibold text-[#1f2a36]">{meta.title}</h2>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('home')}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 text-xs font-semibold text-[#1f2a36] hover:bg-[#f4f6f7] cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Beranda</span>
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#e6f6f4] text-[#1a9e94]">
            <Calendar className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-[#1f2a36]">Modul {meta.title}</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-[#64748b]">{meta.summary}</p>
          <div className="mt-4 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-xs font-medium text-[#1f2a36]">
            {contextInfo}
          </div>
          <p className="mt-3 text-[11.5px] text-[#64748b]">
            Konteks navigasi dari Beranda sudah terhubung ke Single Source of Truth. Modul ini siap
            dibangun pada tahap berikutnya.
          </p>
        </div>
      </div>
    </div>
  );
};
