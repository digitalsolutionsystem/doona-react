import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Box,
  Check,
  Edit3,
  Package,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { DEFAULT_CATEGORIES, DEFAULT_SATUAN } from '../constants/defaults';
import { useApp } from '../context/AppContext';
import { formatNum } from '../domain/dateUtils';
import {
  getAllCategories,
  getItemTransactionStats,
  type ItemTransactionStats,
} from '../domain/stockCalculations';
import type { MasterItem } from '../types/app';

type StatusFilter = 'all' | 'aktif' | 'arsip';

export const MasterItemPage: React.FC = () => {
  const {
    state,
    isViewer,
    sync,
    addMasterItem,
    updateMasterItem,
    toggleMasterItemActive,
    deleteMasterItem,
    navigateTo,
  } = useApp();

  const [newNama, setNewNama] = useState('');
  const [newKat, setNewKat] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [newSat, setNewSat] = useState<string>('');
  const [newMin, setNewMin] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(
    null
  );

  const [minDrafts, setMinDrafts] = useState<Record<string, string>>({});

  const [editTarget, setEditTarget] = useState<MasterItem | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editKat, setEditKat] = useState('');
  const [editSat, setEditSat] = useState('');
  const [editMin, setEditMin] = useState('0');
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    item: MasterItem;
    stats: ItemTransactionStats;
  } | null>(null);

  const satuanList = useMemo(
    () => (state.satuan && state.satuan.length > 0 ? state.satuan : [...DEFAULT_SATUAN]),
    [state.satuan]
  );

  const categories = useMemo(() => getAllCategories(state), [state]);

  useEffect(() => {
    if (!newSat || !satuanList.includes(newSat)) {
      setNewSat(satuanList[0] || 'pcs');
    }
  }, [satuanList, newSat]);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 3800);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const itemStatsMap = useMemo(() => {
    const map: Record<string, ItemTransactionStats> = {};
    state.items.forEach((item) => {
      map[item.id] = getItemTransactionStats(state, item.id);
    });
    return map;
  }, [state]);

  const counts = useMemo(() => {
    const total = state.items.length;
    const aktif = state.items.filter((i) => Boolean(i.aktif)).length;
    return { total, aktif, arsip: total - aktif };
  }, [state.items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.items.filter((item) => {
      if (statusFilter === 'aktif' && !item.aktif) return false;
      if (statusFilter === 'arsip' && item.aktif) return false;
      if (catFilter !== 'all' && item.kat !== catFilter) return false;
      if (q) {
        const hit =
          item.nama.toLowerCase().includes(q) ||
          item.kat.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          (item.sat || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [state.items, searchQuery, catFilter, statusFilter]);

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) return;
    const minVal = Math.max(0, Number(String(newMin).replace(',', '.')) || 0);
    const res = addMasterItem({
      nama: newNama,
      kat: newKat || 'Lain-Lain',
      sat: newSat || satuanList[0] || 'pcs',
      min: minVal,
    });
    if (!res.ok) {
      setFeedback({ tone: 'err', text: res.error || 'Gagal menambah item.' });
      return;
    }
    setNewNama('');
    setNewMin('');
    setFeedback({
      tone: 'ok',
      text: `Item "${res.item?.nama}" (ID: ${res.item?.id}) berhasil ditambahkan ke Master Item.`,
    });
  };

  const openEditModal = (item: MasterItem) => {
    setEditTarget(item);
    setEditNama(item.nama);
    setEditKat(item.kat || 'Lain-Lain');
    setEditSat(item.sat || satuanList[0] || 'pcs');
    setEditMin(String(item.min ?? 0));
    setEditError(null);
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || isViewer) return;
    const minNum = Number(String(editMin).replace(',', '.'));
    if (Number.isNaN(minNum) || minNum < 0) {
      setEditError('Stok minimum harus berupa angka 0 atau lebih.');
      return;
    }
    const res = updateMasterItem(editTarget.id, {
      nama: editNama,
      kat: editKat,
      sat: editSat,
      min: minNum,
    });
    if (!res.ok) {
      setEditError(res.error || 'Gagal menyimpan perubahan item.');
      return;
    }
    const updatedName = editNama.trim();
    setEditTarget(null);
    setFeedback({
      tone: 'ok',
      text: `Item "${updatedName}" (ID: ${editTarget.id}) berhasil diperbarui dan sinkron ke seluruh modul.`,
    });
  };

  const handleInlineSatChange = (item: MasterItem, nextSat: string) => {
    if (isViewer) return;
    const res = updateMasterItem(item.id, { sat: nextSat });
    if (res.ok) {
      setFeedback({
        tone: 'ok',
        text: `Satuan "${item.nama}" diubah menjadi ${nextSat}.`,
      });
    }
  };

  const handleInlineMinBlur = (item: MasterItem) => {
    const raw = minDrafts[item.id];
    if (raw === undefined) return;
    const parsed = Number(String(raw).replace(',', '.').trim());
    setMinDrafts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    if (Number.isNaN(parsed) || parsed < 0) {
      setFeedback({ tone: 'err', text: 'Stok minimum tidak boleh negatif.' });
      return;
    }
    if (parsed !== item.min) {
      updateMasterItem(item.id, { min: parsed });
      setFeedback({
        tone: 'ok',
        text: `Stok minimum "${item.nama}" diperbarui menjadi ${formatNum(parsed)} ${item.sat}.`,
      });
    }
  };

  const handleToggleActive = (item: MasterItem) => {
    if (isViewer) return;
    toggleMasterItemActive(item.id);
    setFeedback({
      tone: 'info',
      text: item.aktif
        ? `"${item.nama}" diarsipkan. Tidak tampil di input baru, tetapi histori tetap terjaga.`
        : `"${item.nama}" diaktifkan kembali dan tampil di Stok Awal & Input Harian.`,
    });
  };

  const handleOpenDeleteModal = (item: MasterItem) => {
    if (isViewer) return;
    const stats = itemStatsMap[item.id] || getItemTransactionStats(state, item.id);
    setDeleteTarget({ item, stats });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget || isViewer) return;
    const { item } = deleteTarget;
    const res = deleteMasterItem(item.id);
    setDeleteTarget(null);
    if (!res.ok) {
      setFeedback({ tone: 'err', text: res.error || 'Gagal menghapus item.' });
      return;
    }
    setFeedback({
      tone: 'ok',
      text: `Item "${item.nama}" (tanpa histori transaksi) telah dihapus permanen.`,
    });
  };

  const handleArchiveFromDeleteModal = () => {
    if (!deleteTarget || isViewer) return;
    const { item } = deleteTarget;
    if (item.aktif) {
      toggleMasterItemActive(item.id);
    }
    setDeleteTarget(null);
    setFeedback({
      tone: 'info',
      text: `"${item.nama}" diarsipkan dengan aman. Seluruh ${deleteTarget.stats.totalEntries} catatan histori tetap tersimpan.`,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
      {/* TOP HEADER */}
      <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e5df] px-5 py-3.5 md:px-6">
        <div>
          <h1 className="font-display text-lg font-semibold text-[#141816]">Master Item</h1>
          <p className="text-xs text-[#7c8580]">
            Sumber identitas utama seluruh barang persediaan · ID item bersifat tetap
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('st')}
          className="inline-flex h-8.5 items-center gap-1.5 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] hover:bg-[#f3f3ee] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Box className="h-3.5 w-3.5 text-[#14533c]" />
          <span>Setting Satuan</span>
        </button>
      </header>

      {/* QUICK ADD FORM BAR */}
      {!isViewer && (
        <form
          onSubmit={handleQuickAdd}
          className="no-print flex flex-wrap items-end gap-2.5 border-b border-[#e5e5df] bg-[#fafaf8] px-5 py-3 md:px-6"
        >
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-[11px] font-medium text-[#565e59]">
              Nama Item Baru
            </label>
            <input
              type="text"
              value={newNama}
              onChange={(e) => setNewNama(e.target.value)}
              placeholder="Contoh: Dimsum Udang"
              className="h-8.5 w-full rounded-md border border-[#e5e5df] bg-white px-3 text-[13px] text-[#141816] placeholder:text-[#9aa39e] focus:border-[#14533c] focus:outline-none"
            />
          </div>

          <div className="w-40">
            <label className="mb-1 block text-[11px] font-medium text-[#565e59]">Kategori</label>
            <input
              type="text"
              list="master-kat-list"
              value={newKat}
              onChange={(e) => setNewKat(e.target.value)}
              placeholder="Kategori"
              className="h-8.5 w-full rounded-md border border-[#e5e5df] bg-white px-2.5 text-[13px] text-[#141816] focus:border-[#14533c] focus:outline-none"
            />
            <datalist id="master-kat-list">
              {categories.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </div>

          <div className="w-28">
            <label className="mb-1 block text-[11px] font-medium text-[#565e59]">Satuan</label>
            <select
              value={newSat}
              onChange={(e) => setNewSat(e.target.value)}
              className="h-8.5 w-full rounded-md border border-[#e5e5df] bg-white px-2.5 text-[13px] text-[#141816] focus:border-[#14533c] focus:outline-none"
            >
              {satuanList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="w-28">
            <label className="mb-1 block text-[11px] font-medium text-[#565e59]">Stok Min.</label>
            <input
              type="number"
              min={0}
              step="any"
              value={newMin}
              onChange={(e) => setNewMin(e.target.value)}
              placeholder="0"
              className="font-mono-num h-8.5 w-full rounded-md border border-[#e5e5df] bg-white px-2.5 text-[13px] text-[#141816] focus:border-[#14533c] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-[#14533c] px-3.5 text-xs font-medium text-white hover:bg-[#0f3f2d] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah Item</span>
          </button>
        </form>
      )}

      {/* SEARCH & FILTER BAR */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e5e5df] px-5 py-2.5 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#9aa39e]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, ID, kategori, satuan…"
              aria-label="Cari Master Item"
              className="h-8 w-60 rounded-md border border-[#e5e5df] bg-white pr-7 pl-8 text-xs text-[#141816] placeholder:text-[#9aa39e] focus:border-[#14533c] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Bersihkan pencarian"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-[#9aa39e] hover:text-[#141816] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            aria-label="Filter kategori"
            className="h-8 rounded-md border border-[#e5e5df] bg-white px-2.5 text-xs text-[#565e59] focus:border-[#14533c] focus:outline-none"
          >
            <option value="all">Semua kategori ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div
          className="flex items-center gap-0.5 rounded-md border border-[#e5e5df] bg-[#f7f7f4] p-0.5"
          role="tablist"
          aria-label="Filter status item"
        >
          {(
            [
              { id: 'all', label: 'Semua', count: counts.total },
              { id: 'aktif', label: 'Aktif', count: counts.aktif },
              { id: 'arsip', label: 'Arsip', count: counts.arsip },
            ] as Array<{ id: StatusFilter; label: string; count: number }>
          ).map((tab) => {
            const on = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setStatusFilter(tab.id)}
                className={`h-6.5 rounded px-2.5 text-xs font-medium transition whitespace-nowrap shrink-0 cursor-pointer ${
                  on ? 'bg-white text-[#141816] shadow-[0_1px_2px_rgba(17,22,20,0.06)]' : 'text-[#565e59] hover:text-[#141816]'
                }`}
              >
                {tab.label} <span className="font-mono-num opacity-75">({tab.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`no-print flex items-center justify-between gap-2 border-b px-5 py-2 text-xs font-medium md:px-6 ${
            feedback.tone === 'err'
              ? 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
              : feedback.tone === 'info'
                ? 'border-[#e5e5df] bg-[#fafaf8] text-[#141816]'
                : 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.tone === 'err' ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Check className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Tutup pesan"
            className="opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ITEM TABLE */}
      <div className="dg-scroll min-h-0 flex-1 overflow-auto">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <Package className="mb-3 h-8 w-8 text-[#9aa39e]" />
            <p className="text-sm font-medium text-[#141816]">
              {state.items.length === 0
                ? 'Belum ada item di Master Item.'
                : 'Tidak ada item yang cocok dengan pencarian atau filter.'}
            </p>
            {(searchQuery || catFilter !== 'all' || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCatFilter('all');
                  setStatusFilter('all');
                }}
                className="mt-3 h-8 rounded-md border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#565e59] hover:bg-[#f3f3ee] cursor-pointer"
              >
                Reset filter
              </button>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 z-10 border-b border-[#e5e5df] bg-[#fafaf8] text-xs font-medium text-[#565e59]">
              <tr>
                <th className="px-5 py-2.5 md:px-6">Item &amp; ID</th>
                <th className="px-3 py-2.5">Kategori</th>
                <th className="px-3 py-2.5">Satuan</th>
                <th className="px-3 py-2.5 text-right">Stok Min.</th>
                <th className="px-3 py-2.5">Status</th>
                {!isViewer && <th className="px-5 py-2.5 text-right md:px-6">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefea]">
              {filteredItems.map((item) => {
                const stats = itemStatsMap[item.id];
                const isCustomSat = Boolean(item.sat && !satuanList.includes(item.sat));
                const minValue =
                  minDrafts[item.id] !== undefined ? minDrafts[item.id] : String(item.min ?? 0);

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-[#fafaf8] ${
                      item.aktif ? '' : 'bg-[#fafaf8]/70 opacity-65'
                    }`}
                  >
                    <td className="px-5 py-2.5 md:px-6">
                      <div className="font-medium text-[#141816]">{item.nama}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[#7c8580]">
                        <span className="font-mono-num">{item.id}</span>
                        {stats?.hasHistory && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-num">
                              {stats.totalEntries} catatan ({stats.monthsCount} bln)
                            </span>
                          </>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-[#565e59] whitespace-nowrap">{item.kat}</td>

                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {isViewer ? (
                        <span className="text-[#141816]">{item.sat || 'pcs'}</span>
                      ) : (
                        <select
                          value={item.sat || 'pcs'}
                          onChange={(e) => handleInlineSatChange(item, e.target.value)}
                          aria-label={`Satuan ${item.nama}`}
                          className="h-7.5 rounded-md border border-[#e5e5df] bg-white px-2 text-xs font-medium text-[#141816] focus:border-[#14533c] focus:outline-none"
                        >
                          {satuanList.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                          {isCustomSat && <option value={item.sat}>{item.sat} (kustom)</option>}
                        </select>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {isViewer ? (
                        <span className="font-mono-num font-medium text-[#141816]">
                          {formatNum(item.min)}
                        </span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={minValue}
                          aria-label={`Stok minimum ${item.nama}`}
                          onChange={(e) =>
                            setMinDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          onBlur={() => handleInlineMinBlur(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                          }}
                          className="font-mono-num h-7.5 w-20 rounded-md border border-[#e5e5df] bg-white px-2 text-right text-xs font-medium text-[#141816] focus:border-[#14533c] focus:outline-none"
                        />
                      )}
                    </td>

                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium ${
                          item.aktif ? 'text-[#15803d]' : 'text-[#7c8580]'
                        }`}
                      >
                        {item.aktif ? 'Aktif' : 'Arsip'}
                      </span>
                    </td>

                    {!isViewer && (
                      <td className="px-5 py-2.5 text-right whitespace-nowrap md:px-6">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="inline-flex h-7.5 items-center gap-1 rounded-md border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#141816] hover:bg-[#f3f3ee] cursor-pointer"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleActive(item)}
                            className={`inline-flex h-7.5 items-center gap-1 rounded-md border px-2.5 text-xs font-medium cursor-pointer ${
                              item.aktif
                                ? 'border-[#e5e5df] bg-white text-[#565e59] hover:bg-[#f3f3ee]'
                                : 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d] hover:bg-[#dcfce7]'
                            }`}
                          >
                            {item.aktif ? (
                              <>
                                <Archive className="h-3 w-3" />
                                <span>Arsipkan</span>
                              </>
                            ) : (
                              <>
                                <RotateCcw className="h-3 w-3" />
                                <span>Aktifkan</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(item)}
                            aria-label={`Hapus ${item.nama}`}
                            title={
                              stats?.hasHistory
                                ? 'Memiliki histori transaksi — dilindungi dari penghapusan permanen'
                                : 'Hapus item permanen'
                            }
                            className={`inline-flex h-7.5 w-7.5 items-center justify-center rounded-md border cursor-pointer ${
                              stats?.hasHistory
                                ? 'border-[#e5e5df] bg-[#fafaf8] text-[#9aa39e] hover:text-[#565e59]'
                                : 'border-[#fecaca] bg-white text-[#b91c1c] hover:bg-[#fef2f2]'
                            }`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* BOTTOM FOOTER */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-[#e5e5df] bg-[#fafaf8] px-5 py-2 text-xs md:px-6">
        <p className="text-[#7c8580]">
          Item yang diarsipkan tidak tampil di Stok Awal &amp; Input Harian, tetapi seluruh histori
          tetap terjaga di Tabel Bulanan.
        </p>
        <div className="font-mono-num text-[#565e59] whitespace-nowrap">
          <strong className="font-semibold text-[#141816]">{counts.aktif}</strong> aktif ·{' '}
          <strong className="font-semibold text-[#141816]">{counts.arsip}</strong> arsip ·{' '}
          <span className="font-sans text-[#15803d]">{sync.text}</span>
        </div>
      </div>

      {/* MODAL: EDIT ITEM */}
      {editTarget && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#111614]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditTarget(null);
          }}
        >
          <div className="w-full max-w-[460px] overflow-hidden rounded-xl border border-[#e5e5df] bg-white shadow-[0_24px_60px_rgba(17,22,20,0.18)]">
            <div className="flex items-start justify-between border-b border-[#e5e5df] px-5 py-4">
              <div>
                <h3 className="font-display text-base font-semibold text-[#141816]">
                  Edit Master Item
                </h3>
                <p className="font-mono-num mt-0.5 text-xs text-[#7c8580]">
                  ID: {editTarget.id} · histori transaksi tetap terhubung
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#7c8580] hover:bg-[#f3f3ee] hover:text-[#141816] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit}>
              <div className="space-y-3.5 px-5 py-4">
                {editError && (
                  <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs font-medium text-[#b91c1c]">
                    {editError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#141816]">
                    Nama Item <span className="text-[#b91c1c]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="h-9.5 w-full rounded-md border border-[#e5e5df] px-3 text-sm text-[#141816] focus:border-[#14533c] focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-[#7c8580]">
                    Mengubah nama tidak memutus histori karena seluruh transaksi menggunakan ID{' '}
                    <span className="font-mono-num font-medium text-[#141816]">{editTarget.id}</span>.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#141816]">Kategori</label>
                  <input
                    type="text"
                    list="edit-kat-list"
                    value={editKat}
                    onChange={(e) => setEditKat(e.target.value)}
                    className="h-9.5 w-full rounded-md border border-[#e5e5df] px-3 text-sm text-[#141816] focus:border-[#14533c] focus:outline-none"
                  />
                  <datalist id="edit-kat-list">
                    {categories.map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#141816]">Satuan</label>
                    <select
                      value={editSat}
                      onChange={(e) => setEditSat(e.target.value)}
                      className="h-9.5 w-full rounded-md border border-[#e5e5df] bg-white px-3 text-sm text-[#141816] focus:border-[#14533c] focus:outline-none"
                    >
                      {satuanList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      {editSat && !satuanList.includes(editSat) && (
                        <option value={editSat}>{editSat} (kustom)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#141816]">
                      Stok Minimum
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={editMin}
                      onChange={(e) => setEditMin(e.target.value)}
                      className="font-mono-num h-9.5 w-full rounded-md border border-[#e5e5df] px-3 text-sm font-medium text-[#141816] focus:border-[#14533c] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#e5e5df] bg-[#fafaf8] px-5 py-3">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="h-8.5 rounded-md border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#565e59] hover:bg-[#f3f3ee] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-[#14533c] px-4 text-xs font-medium text-white hover:bg-[#0f3f2d] cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HAPUS AMAN */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#111614]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="w-full max-w-[440px] overflow-hidden rounded-xl border border-[#e5e5df] bg-white shadow-[0_24px_60px_rgba(17,22,20,0.18)]">
            <div className="border-b border-[#e5e5df] px-5 py-4">
              <h3 className="font-display text-base font-semibold text-[#141816]">
                {deleteTarget.stats.hasHistory
                  ? 'Item Memiliki Histori Transaksi'
                  : 'Hapus Item Permanen'}
              </h3>
              <p className="font-mono-num mt-0.5 text-xs text-[#7c8580]">
                {deleteTarget.item.nama} · {deleteTarget.item.id}
              </p>
            </div>

            <div className="px-5 py-4">
              {deleteTarget.stats.hasHistory ? (
                <div className="space-y-2.5 text-[13px] leading-relaxed text-[#565e59]">
                  <p>
                    Item <strong className="text-[#141816]">{deleteTarget.item.nama}</strong> tidak
                    dapat dihapus permanen karena masih terhubung dengan{' '}
                    <strong className="font-mono-num text-[#141816]">
                      {deleteTarget.stats.totalEntries}
                    </strong>{' '}
                    catatan transaksi pada{' '}
                    <strong className="font-mono-num text-[#141816]">
                      {deleteTarget.stats.monthsCount}
                    </strong>{' '}
                    bulan ({deleteTarget.stats.awalCount} stok awal, {deleteTarget.stats.datangCount}{' '}
                    barang datang, {deleteTarget.stats.closingCount} closing).
                  </p>
                  <p className="rounded-lg border border-[#e5e5df] bg-[#fafaf8] px-3 py-2 text-xs text-[#565e59]">
                    Gunakan <strong className="text-[#141816]">Arsipkan Item</strong> agar item
                    tidak muncul pada input baru, sementara histori Tabel Bulanan tetap akurat.
                  </p>
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed text-[#565e59]">
                  Item <strong className="text-[#141816]">{deleteTarget.item.nama}</strong> belum
                  memiliki histori transaksi di bulan manapun. Hapus item ini secara permanen dari
                  Master Item?
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#e5e5df] bg-[#fafaf8] px-5 py-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-8.5 rounded-md border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#565e59] hover:bg-[#f3f3ee] cursor-pointer"
              >
                Batal
              </button>
              {deleteTarget.stats.hasHistory ? (
                deleteTarget.item.aktif ? (
                  <button
                    type="button"
                    onClick={handleArchiveFromDeleteModal}
                    className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-[#b45309] px-4 text-xs font-medium text-white hover:bg-[#92400e] cursor-pointer"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span>Arsipkan Item</span>
                  </button>
                ) : null
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-[#b91c1c] px-4 text-xs font-medium text-white hover:bg-[#991b1b] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Ya, Hapus Permanen</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
