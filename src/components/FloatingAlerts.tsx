import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getDayAttendanceSummary } from '../domain/attendanceCalculations';
import { formatNum } from '../domain/dateUtils';
import { getOmsetMonthSummary } from '../domain/omsetCalculations';
import { getDayInputSummary, getStockDashboardSummary } from '../domain/stockCalculations';

export const FloatingAlerts: React.FC = () => {
  const {
    state,
    activeMenu,
    inputTab,
    abSub,
    isViewer,
    ym,
    day,
    curYm,
    nowDay,
    absDraft,
    navigateTo,
  } = useApp();
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
        actionLabel: 'Buka Stok & Input',
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

    // 7. Draft absensi belum disimpan (tampilkan saat tidak sedang berada di layar input Absen Harian)
    if (dayAbs.hasDraft && !(activeMenu === 'ab' && abSub === 'harian')) {
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
  }, [state, activeMenu, inputTab, abSub, ym, day, curYm, nowDay, absDraft, navigateTo]);

  if (alerts.length === 0) return null;

  const bottomPositionClass =
    activeMenu === 'ab'
      ? 'right-6 bottom-[84px]'
      : isViewer
        ? 'right-5 bottom-16'
        : 'right-5 bottom-5';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`no-print fixed ${bottomPositionClass} z-50 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-2.5 text-xs font-semibold text-[#13222b] shadow-[0_10px_28px_rgba(13,37,48,0.12)] transition hover:bg-[#f7faf9] cursor-pointer`}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#fef3c7] text-[#b45309]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        </span>
        <span className="max-w-[210px] truncate">{alerts[0].title}</span>
        <span className="font-mono-num rounded-lg bg-[#ef4444] px-2 py-0.5 text-[11px] font-bold text-white">
          {alerts.length}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-5 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="flex items-start justify-between border-b border-[#edf2f0] px-6 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#13222b]">
                  Perhatian Operasional
                </h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  {alerts.length} catatan aktif pada stok, closing, OMSET &amp; absensi
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="dg-scroll max-h-[60vh] divide-y divide-[#edf2f0] overflow-y-auto bg-white">
              {alerts.map((a) => (
                <div key={a.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[13.5px] font-bold text-[#13222b]">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#fef3c7] text-[#b45309]">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                        <span>{a.title}</span>
                      </div>
                      <p className="mt-1.5 pl-8 text-[13px] leading-relaxed text-[#475569]">{a.desc}</p>
                    </div>
                  </div>
                  {a.actionLabel && a.onAction && (
                    <div className="mt-3 pl-8">
                      <button
                        type="button"
                        onClick={a.onAction}
                        className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e6f7ee] hover:text-[#15803d] cursor-pointer"
                      >
                        <span>{a.actionLabel}</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-[#edf2f0] bg-[#f7faf9] px-6 py-3.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8.5 rounded-xl bg-[#eef3f1] px-4 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
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
