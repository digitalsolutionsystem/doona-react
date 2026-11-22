import React, { useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getDayAttendanceSummary } from '../domain/attendanceCalculations';
import { formatNum } from '../domain/dateUtils';
import { getOmsetMonthSummary } from '../domain/omsetCalculations';
import { getDayInputSummary, getStockDashboardSummary } from '../domain/stockCalculations';

export const FloatingAlerts: React.FC = () => {
  const { state, activeMenu, inputTab, ym, day, curYm, nowDay, absDraft, navigateTo } = useApp();
  const [open, setOpen] = useState(false);

  const alerts = useMemo(() => {
    const stock = getStockDashboardSummary(state, ym, curYm, nowDay);
    const dayInput = getDayInputSummary(state, ym, day);
    const omset = getOmsetMonthSummary(state, ym, stock.today);
    const dayAbs = getDayAttendanceSummary(state, ym, stock.today, absDraft);

    const items: Array<{
      id: string;
      title: string;
      desc: string;
      actionLabel?: string;
      onAction?: () => void;
    }> = [];

    // 1. Closing tanggal sebelumnya belum diisi (saat berada di Input Harian)
    if (activeMenu === 'in' && inputTab === 'closing' && dayInput.missingPrevClosing) {
      items.push({
        id: 'closing-prev',
        title: `Closing tgl ${day - 1} belum diisi`,
        desc: `Closing tanggal ${day - 1} belum lengkap, sehingga stok siap jual hari ini (tgl ${day}) belum bisa dihitung secara akurat.`,
        actionLabel: `Isi Closing Tgl ${day - 1}`,
        onAction: () => {
          setOpen(false);
          navigateTo('in', { day: day - 1, inputTab: 'closing' });
        },
      });
    }

    // 2. Pemakaian bernilai negatif
    if (activeMenu === 'in' && dayInput.negativeUsageRows.length > 0) {
      items.push({
        id: 'neg-usage-day',
        title: `${dayInput.negativeUsageRows.length} pemakaian bernilai negatif (Tgl ${day})`,
        desc: `Closing melebihi stok siap jual untuk: ${dayInput.negativeUsageRows
          .map((r) => `${r.item.nama} (${formatNum(r.pemakaian)})`)
          .join(', ')}.`,
        actionLabel: 'Periksa Closing',
        onAction: () => {
          setOpen(false);
          navigateTo('in', { day, inputTab: 'closing' });
        },
      });
    } else if (stock.negativeUsageEntries.length > 0) {
      const firstNeg = stock.negativeUsageEntries[0];
      items.push({
        id: 'neg-usage-month',
        title: `${stock.negativeUsageEntries.length} catatan pemakaian negatif`,
        desc: `Closing melebihi stok siap jual, misalnya ${firstNeg.item.nama} pada Tgl ${firstNeg.day} (${formatNum(firstNeg.usage)}).`,
        actionLabel: `Periksa Tgl ${firstNeg.day}`,
        onAction: () => {
          setOpen(false);
          navigateTo('in', { day: firstNeg.day, inputTab: 'closing' });
        },
      });
    }

    // 3. Stok kosong
    if (stock.emptyStockItems.length > 0) {
      items.push({
        id: 'empty-stock',
        title: `${stock.emptyStockItems.length} item stok kosong`,
        desc: `Item dengan sisa 0: ${stock.emptyStockItems.map((s) => s.item.nama).join(', ')}.`,
        actionLabel: 'Input Barang Datang',
        onAction: () => {
          setOpen(false);
          navigateTo('in', { day: stock.today, inputTab: 'datang' });
        },
      });
    }

    // 4. Stok menipis
    if (stock.lowStockItems.length > 0) {
      items.push({
        id: 'low-stock',
        title: `${stock.lowStockItems.length} item stok menipis`,
        desc: `Di bawah batas minimum: ${stock.lowStockItems
          .map((s) => `${s.item.nama} (sisa ${formatNum(s.val)}, min ${formatNum(s.item.min)})`)
          .join(', ')}.`,
        actionLabel: 'Buka Input Harian',
        onAction: () => {
          setOpen(false);
          navigateTo('in', { day: stock.today, inputTab: 'datang' });
        },
      });
    }

    // 5. Hari belum closing
    if (stock.missingClosingDays.length > 0) {
      const firstMiss = stock.missingClosingDays[0];
      items.push({
        id: 'miss-closing',
        title: `${stock.missingClosingDays.length} hari belum closing stok`,
        desc: `Tanggal yang belum diisi closing: ${stock.missingClosingDays
          .slice(0, 5)
          .map((d) => `Tgl ${d}`)
          .join(', ')}${stock.missingClosingDays.length > 5 ? ', dll.' : '.'}`,
        actionLabel: `Isi Tgl ${firstMiss}`,
        onAction: () => {
          setOpen(false);
          navigateTo('in', { day: firstMiss, inputTab: 'closing' });
        },
      });
    }

    // 6. Selisih OMSET tanpa keterangan
    if (omset.noKetDays.length > 0) {
      const firstDay = omset.noKetDays[0];
      items.push({
        id: 'om-noket',
        title: `${omset.noKetDays.length} hari selisih OMSET tanpa keterangan`,
        desc: `Keterangan selisih wajib dilengkapi pada tanggal: ${omset.noKetDays.join(', ')}.`,
        actionLabel: `Buka OMSET Tgl ${firstDay}`,
        onAction: () => {
          setOpen(false);
          navigateTo('om', { day: firstDay, omSub: 'harian' });
        },
      });
    }

    // 7. Draft absensi belum disimpan
    if (dayAbs.hasDraft) {
      items.push({
        id: 'abs-draft',
        title: 'Perubahan absensi belum disimpan',
        desc: 'Terdapat draf absensi karyawan yang belum disimpan ke database.',
        actionLabel: 'Simpan di Absensi',
        onAction: () => {
          setOpen(false);
          navigateTo('ab', { day: stock.today, abSub: 'harian' });
        },
      });
    }

    return items;
  }, [state, activeMenu, inputTab, ym, day, curYm, nowDay, absDraft, navigateTo]);

  if (alerts.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="no-print fixed right-5 bottom-5 z-50 flex items-center gap-2 rounded-full border-[1.5px] border-[#f0b429] bg-[#fff6df] px-4 py-2.5 text-[13px] font-semibold text-[#8a5d00] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#fdf0cf] cursor-pointer"
      >
        <AlertTriangle className="h-4 w-4 text-[#d4900f]" />
        <span className="max-w-[200px] truncate">{alerts[0].title}</span>
        <span className="font-mono-num flex h-5 w-5 items-center justify-center rounded-full bg-[#e0a030] text-[11px] font-bold text-white">
          {alerts.length}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-[500px] overflow-hidden rounded-2xl border border-[#dde2e6] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#fdf0cf] text-[#b07a0a]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1f2a36]">Detail Peringatan</h3>
                  <p className="text-xs text-[#64748b]">
                    Informasi status stok, closing, OMSET &amp; absensi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-slate-100 hover:text-[#1f2a36] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="dg-scroll max-h-[60vh] space-y-2.5 overflow-y-auto bg-[#f8fafc] p-5">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-[10px] border border-[#e2e8f0] bg-white p-4 shadow-xs"
                >
                  <div className="mb-1.5 flex items-center gap-2 text-[13.5px] font-bold text-[#1f2a36]">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-[#d4900f]" />
                    <span>{a.title}</span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-[#475569]">{a.desc}</p>
                  {a.actionLabel && a.onAction && (
                    <div className="mt-3 text-right">
                      <button
                        type="button"
                        onClick={a.onAction}
                        className="h-8 rounded-lg bg-[#1f2a36] px-3.5 text-xs font-semibold text-white hover:bg-[#334155] cursor-pointer"
                      >
                        {a.actionLabel}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-[#e2e8f0] bg-white px-6 py-3.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 rounded-lg border border-[#e2e8f0] bg-white px-4 text-xs font-semibold text-[#1f2a36] hover:bg-slate-50 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
