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

  // Quick Add form state (matches legacy top bar)
  const [newNama, setNewNama] = useState('');
  const [newKat, setNewKat] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [newSat, setNewSat] = useState<string>('');
  const [newMin, setNewMin] = useState<string>('');

  // Search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Inline feedback banner
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(
    null
  );

  // Inline min-stock draft values (for smooth numeric editing)
  const [minDrafts, setMinDrafts] = useState<Record<string, string>>({});

  // Edit Item Modal state
  const [editTarget, setEditTarget] = useState<MasterItem | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editKat, setEditKat] = useState('');
  const [editSat, setEditSat] = useState('');
  const [editMin, setEditMin] = useState('0');
  const [editError, setEditError] = useState<string | null>(null);

  // Safe Delete / Archive Modal state
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

  // Precompute transaction stats per item ID across all months
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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f4f6f7] p-3 sm:p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#dde2e6] bg-white">
        {/* TOP HEADER TOOLBAR */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3 sm:px-5">
          <div>
            <h1 className="text-[15px] font-bold text-[#1f2a36]">Master Item</h1>
            <p className="text-[11.5px] text-[#64748b]">
              Sumber identitas utama seluruh barang persediaan · ID item bersifat tetap
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo('st')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dde2e6] bg-white px-3.5 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Box className="h-3.5 w-3.5 text-[#147d75]" />
              <span>Setting Satuan</span>
            </button>
          </div>
        </div>

        {/* QUICK ADD FORM BAR (ADMIN ONLY) */}
        {!isViewer && (
          <form
            onSubmit={handleQuickAdd}
            className="no-print flex flex-wrap items-end gap-2 border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 sm:px-5"
          >
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-[11px] font-semibold text-[#64748b]">
                Nama Item Baru
              </label>
              <input
                type="text"
                value={newNama}
                onChange={(e) => setNewNama(e.target.value)}
                placeholder="Contoh: Dimsum Udang"
                className="h-9 w-full rounded-lg border border-[#dde2e6] bg-white px-3 text-[13px] text-[#1f2a36] placeholder:text-[#94a3b8] focus:border-[#1a9e94] focus:outline-none"
              />
            </div>

            <div className="w-40">
              <label className="mb-1 block text-[11px] font-semibold text-[#64748b]">
                Kategori
              </label>
              <input
                type="text"
                list="master-kat-list"
                value={newKat}
                onChange={(e) => setNewKat(e.target.value)}
                placeholder="Kategori"
                className="h-9 w-full rounded-lg border border-[#dde2e6] bg-white px-2.5 text-[13px] text-[#1f2a36] focus:border-[#1a9e94] focus:outline-none"
              />
              <datalist id="master-kat-list">
                {categories.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </div>

            <div className="w-28">
              <label className="mb-1 block text-[11px] font-semibold text-[#64748b]">
                Satuan
              </label>
              <select
                value={newSat}
                onChange={(e) => setNewSat(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#dde2e6] bg-white px-2.5 text-[13px] text-[#1f2a36] focus:border-[#1a9e94] focus:outline-none"
              >
                {satuanList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-28">
              <label className="mb-1 block text-[11px] font-semibold text-[#64748b]">
                Stok Min.
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={newMin}
                onChange={(e) => setNewMin(e.target.value)}
                placeholder="0"
                className="font-mono-num h-9 w-full rounded-lg border border-[#dde2e6] bg-white px-2.5 text-[13px] text-[#1f2a36] focus:border-[#1a9e94] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-4 text-xs font-semibold text-white hover:bg-[#14857c] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Item</span>
            </button>
          </form>
        )}

        {/* SEARCH & FILTER BAR */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e2e8f0] px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, ID, kategori, satuan…"
                aria-label="Cari Master Item"
                className="h-8 w-60 rounded-lg border border-[#dde2e6] bg-white pr-7 pl-8 text-xs text-[#1f2a36] placeholder:text-[#94a3b8] focus:border-[#1a9e94] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Bersihkan pencarian"
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              aria-label="Filter kategori"
              className="h-8 rounded-lg border border-[#dde2e6] bg-white px-2.5 text-xs font-medium text-[#334155] focus:border-[#1a9e94] focus:outline-none"
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
            className="flex items-center gap-0.5 rounded-lg border border-[#e2e8f0] bg-[#f1f5f9] p-0.5"
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
                  className={`h-7 rounded-md px-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    on ? 'bg-white text-[#147d75] shadow-xs' : 'text-[#64748b] hover:text-[#1f2a36]'
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
          <div className="no-print border-b border-[#e2e8f0] px-4 py-2.5 sm:px-5">
            <div
              className={`flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium ${
                feedback.tone === 'err'
                  ? 'border-[#fecdd3] bg-[#fff1f2] text-[#9f1239]'
                  : feedback.tone === 'info'
                    ? 'border-[#bae6fd] bg-[#f0f9ff] text-[#075985]'
                    : 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.tone === 'err' ? (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                ) : (
                  <Check className="h-4 w-4 shrink-0" />
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
          </div>
        )}

        {/* ITEM TABLE */}
        <div className="dg-scroll min-h-0 flex-1 overflow-auto">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <Package className="mb-3 h-9 w-9 text-[#94a3b8]" />
              <p className="text-sm font-semibold text-[#334155]">
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
                  className="mt-3 h-8 rounded-lg border border-[#dde2e6] bg-white px-3.5 text-xs font-semibold text-[#475569] hover:bg-[#f8fafc] cursor-pointer"
                >
                  Reset filter
                </button>
              )}
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="sticky top-0 z-10 border-b border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-[#64748b]">
                <tr>
                  <th className="px-4 py-3 sm:px-5">Item &amp; ID</th>
                  <th className="px-3 py-3">Kategori</th>
                  <th className="px-3 py-3">Satuan</th>
                  <th className="px-3 py-3 text-right">Stok Min.</th>
                  <th className="px-3 py-3">Status</th>
                  {!isViewer && <th className="px-4 py-3 text-right sm:px-5">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {filteredItems.map((item) => {
                  const stats = itemStatsMap[item.id];
                  const isCustomSat = Boolean(item.sat && !satuanList.includes(item.sat));
                  const minValue =
                    minDrafts[item.id] !== undefined ? minDrafts[item.id] : String(item.min ?? 0);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-[#f8fafc] ${
                        item.aktif ? '' : 'bg-[#f8fafc]/60 opacity-65'
                      }`}
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <div className="font-semibold text-[#1f2a36]">{item.nama}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[#64748b]">
                          <span className="font-mono-num">ID: {item.id}</span>
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

                      <td className="px-3 py-3 text-[#475569] whitespace-nowrap">{item.kat}</td>

                      <td className="px-3 py-3 whitespace-nowrap">
                        {isViewer ? (
                          <span className="text-[#334155]">{item.sat || 'pcs'}</span>
                        ) : (
                          <select
                            value={item.sat || 'pcs'}
                            onChange={(e) => handleInlineSatChange(item, e.target.value)}
                            aria-label={`Satuan ${item.nama}`}
                            className="h-8 rounded-md border border-[#dde2e6] bg-white px-2 text-xs font-medium text-[#1f2a36] focus:border-[#1a9e94] focus:outline-none"
                          >
                            {satuanList.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                            {isCustomSat && (
                              <option value={item.sat}>{item.sat} (kustom)</option>
                            )}
                          </select>
                        )}
                      </td>

                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {isViewer ? (
                          <span className="font-mono-num font-semibold text-[#1f2a36]">
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
                            className="font-mono-num h-8 w-20 rounded-md border border-[#dde2e6] bg-white px-2 text-right text-xs font-semibold text-[#1f2a36] focus:border-[#1a9e94] focus:outline-none"
                          />
                        )}
                      </td>

                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            item.aktif ? 'text-[#15803d]' : 'text-[#64748b]'
                          }`}
                        >
                          {item.aktif ? 'Aktif' : 'Arsip'}
                        </span>
                      </td>

                      {!isViewer && (
                        <td className="px-4 py-3 text-right whitespace-nowrap sm:px-5">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#dde2e6] bg-white px-2.5 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc] cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleActive(item)}
                              className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold cursor-pointer ${
                                item.aktif
                                  ? 'border-[#dde2e6] bg-white text-[#475569] hover:bg-[#f8fafc]'
                                  : 'border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d] hover:bg-[#dcfce7]'
                              }`}
                            >
                              {item.aktif ? (
                                <>
                                  <Archive className="h-3.5 w-3.5" />
                                  <span>Arsipkan</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="h-3.5 w-3.5" />
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
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border cursor-pointer ${
                                stats?.hasHistory
                                  ? 'border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8] hover:text-[#64748b]'
                                  : 'border-[#fecdd3] bg-white text-[#dc2626] hover:bg-[#fff1f2]'
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

        {/* BOTTOM FOOTER BAR */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 text-xs sm:px-5">
          <p className="text-[#64748b]">
            Item yang diarsipkan tidak tampil di Stok Awal &amp; Input Harian, tetapi seluruh
            histori transaksi tetap tersimpan dan terbaca di Tabel Bulanan.
          </p>
          <div className="font-mono-num text-[#475569] whitespace-nowrap">
            <strong>{counts.aktif}</strong> aktif · <strong>{counts.arsip}</strong> arsip ·{' '}
            <span className="font-sans text-[#15803d]">{sync.text}</span>
          </div>
        </div>
      </div>

      {/* ─────────────────── MODAL: EDIT ITEM (ID IMMUTABLE) ─────────────────── */}
      {editTarget && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditTarget(null);
          }}
        >
          <div className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-[#dde2e6] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-[#1f2a36]">Edit Master Item</h3>
                <p className="font-mono-num text-xs text-[#64748b]">
                  ID Item: {editTarget.id} (tetap, histori transaksi tetap terhubung)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit}>
              <div className="space-y-3.5 px-5 py-4">
                {editError && (
                  <div className="rounded-lg border border-[#fecdd3] bg-[#fff1f2] px-3 py-2 text-xs font-medium text-[#9f1239]">
                    {editError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#1f2a36]">
                    Nama Item <span className="text-[#dc2626]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#dde2e6] px-3 text-sm text-[#1f2a36] focus:border-[#1a9e94] focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-[#64748b]">
                    Mengubah nama item tidak memutus histori transaksi karena seluruh transaksi
                    menggunakan ID <span className="font-mono-num font-semibold">{editTarget.id}</span>.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#1f2a36]">
                    Kategori
                  </label>
                  <input
                    type="text"
                    list="edit-kat-list"
                    value={editKat}
                    onChange={(e) => setEditKat(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#dde2e6] px-3 text-sm text-[#1f2a36] focus:border-[#1a9e94] focus:outline-none"
                  />
                  <datalist id="edit-kat-list">
                    {categories.map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#1f2a36]">
                      Satuan
                    </label>
                    <select
                      value={editSat}
                      onChange={(e) => setEditSat(e.target.value)}
                      className="h-10 w-full rounded-lg border border-[#dde2e6] bg-white px-3 text-sm text-[#1f2a36] focus:border-[#1a9e94] focus:outline-none"
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
                    <label className="mb-1.5 block text-xs font-semibold text-[#1f2a36]">
                      Stok Minimum
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={editMin}
                      onChange={(e) => setEditMin(e.target.value)}
                      className="font-mono-num h-10 w-full rounded-lg border border-[#dde2e6] px-3 text-sm font-semibold text-[#1f2a36] focus:border-[#1a9e94] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="h-9 rounded-lg border border-[#dde2e6] bg-white px-4 text-xs font-semibold text-[#475569] hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-4 text-xs font-semibold text-white hover:bg-[#14857c] cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Simpan perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────── MODAL: HAPUS AMAN / PERLINDUNGAN HISTORI ─────────────────── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-[#dde2e6] bg-white shadow-2xl">
            <div className="px-5 py-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    deleteTarget.stats.hasHistory
                      ? 'bg-[#fffbeb] text-[#d97706]'
                      : 'bg-[#fff1f2] text-[#dc2626]'
                  }`}
                >
                  {deleteTarget.stats.hasHistory ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <Trash2 className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1f2a36]">
                    {deleteTarget.stats.hasHistory
                      ? 'Item Memiliki Histori Transaksi'
                      : 'Hapus Item Permanen'}
                  </h3>
                  <p className="font-mono-num text-xs text-[#64748b]">
                    {deleteTarget.item.nama} · ID: {deleteTarget.item.id}
                  </p>
                </div>
              </div>

              {deleteTarget.stats.hasHistory ? (
                <div className="mt-3.5 space-y-2.5 text-sm leading-relaxed text-[#334155]">
                  <p>
                    Item <strong>{deleteTarget.item.nama}</strong> tidak dapat dihapus permanen
                    karena masih terhubung dengan{' '}
                    <strong className="font-mono-num">{deleteTarget.stats.totalEntries}</strong>{' '}
                    catatan transaksi pada{' '}
                    <strong className="font-mono-num">{deleteTarget.stats.monthsCount}</strong>{' '}
                    bulan ({deleteTarget.stats.awalCount} stok awal, {deleteTarget.stats.datangCount}{' '}
                    barang datang, {deleteTarget.stats.closingCount} closing).
                  </p>
                  <p className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs text-[#475569]">
                    Gunakan <strong>Arsipkan Item</strong> agar item tidak muncul pada input baru,
                    sementara seluruh laporan dan histori Tabel Bulanan tetap akurat.
                  </p>
                </div>
              ) : (
                <p className="mt-3.5 text-sm leading-relaxed text-[#334155]">
                  Item <strong>{deleteTarget.item.nama}</strong> belum memiliki histori transaksi di
                  bulan manapun. Hapus item ini secara permanen dari Master Item?
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-5 py-3.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-9 rounded-lg border border-[#dde2e6] bg-white px-4 text-xs font-semibold text-[#475569] hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              {deleteTarget.stats.hasHistory ? (
                deleteTarget.item.aktif ? (
                  <button
                    type="button"
                    onClick={handleArchiveFromDeleteModal}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#d97706] px-4 text-xs font-semibold text-white hover:bg-[#b45309] cursor-pointer"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span>Arsipkan Item</span>
                  </button>
                ) : null
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#dc2626] px-4 text-xs font-semibold text-white hover:bg-[#b91c1c] cursor-pointer"
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
