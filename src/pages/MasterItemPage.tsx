import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
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
    addMasterItem,
    updateMasterItem,
    toggleMasterItemActive,
    deleteMasterItem,
    navigateTo,
  } = useApp();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newNama, setNewNama] = useState('');
  const [newKat, setNewKat] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [newSat, setNewSat] = useState<string>('');
  const [newMin, setNewMin] = useState<string>('');
  const [addError, setAddError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!addModalOpen && !editTarget && !deleteTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteTarget) setDeleteTarget(null);
        else if (editTarget) setEditTarget(null);
        else if (addModalOpen) setAddModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addModalOpen, editTarget, deleteTarget]);

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

  const openAddModal = () => {
    if (isViewer) return;
    setNewNama('');
    setNewKat((prev) => prev || DEFAULT_CATEGORIES[0]);
    setNewSat((prev) => (prev && satuanList.includes(prev) ? prev : satuanList[0] || 'pcs'));
    setNewMin('');
    setAddError(null);
    setAddModalOpen(true);
  };

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
      setAddError(res.error || 'Gagal menambah item.');
      return;
    }
    setNewNama('');
    setNewMin('');
    setAddError(null);
    setAddModalOpen(false);
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
    <div className="dg-page">
      {/* PERSISTENT STATIONARY TOP HEADER */}
      <PageHeader>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[17px] font-bold tracking-[-0.015em] text-[#13222b]">
            Master Item
          </h1>
          <span className="font-mono-num rounded-lg bg-[#e6f7ee] px-2.5 py-1 text-[11px] font-semibold text-[#15803d]">
            {counts.aktif} aktif
          </span>
          {counts.arsip > 0 && (
            <span className="font-mono-num rounded-lg bg-[#f3f7f5] px-2.5 py-1 text-[11px] font-semibold text-[#64748b]">
              {counts.arsip} arsip
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigateTo('st')}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e6f7ee] hover:text-[#15803d] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Box className="h-3.5 w-3.5 text-[#2eb86b]" />
            <span>Setting Satuan</span>
          </button>

          {!isViewer && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-3.5 text-xs font-semibold text-white transition hover:bg-[#259f5b] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Item</span>
            </button>
          )}
        </div>
      </PageHeader>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`no-print mx-4 mt-3 flex shrink-0 items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm md:mx-6 ${
            feedback.tone === 'err'
              ? 'bg-[#ef4444] text-white'
              : feedback.tone === 'info'
                ? 'bg-white text-[#13222b]'
                : 'bg-[#2eb86b] text-white'
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
            className="opacity-80 hover:opacity-100 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* MAIN SCROLLABLE WORKSPACE */}
      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="space-y-4">
          {/* TABLE CARD */}
          <section className="overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
            {/* SEARCH & FILTER TOOLBAR */}
            <div className="no-print flex flex-wrap items-center justify-between gap-2.5 border-b border-[#edf2f0] px-4 py-3 md:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#94a3b8]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama, ID, kategori, satuan…"
                    aria-label="Cari Master Item"
                    className="h-8.5 w-60 rounded-xl bg-[#f3f7f5] pr-7 pl-8.5 text-xs text-[#13222b] placeholder:text-[#94a3b8] outline-none transition focus:bg-white focus:ring-2 focus:ring-[#2eb86b]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Bersihkan pencarian"
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[#94a3b8] hover:text-[#13222b] cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  aria-label="Filter kategori"
                  className="h-8.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-medium text-[#13222b] outline-none transition focus:ring-2 focus:ring-[#2eb86b]"
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
                className="flex items-center gap-1 rounded-xl bg-[#f3f7f5] p-1"
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
                      className={`h-7 rounded-lg px-3 text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                        on
                          ? 'bg-[#2eb86b] text-white shadow-xs'
                          : 'text-[#64748b] hover:text-[#13222b]'
                      }`}
                    >
                      {tab.label} <span className="font-mono-num opacity-85">({tab.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ITEM TABLE */}
            <div className="dg-scroll overflow-x-auto">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3f7f5] text-[#64748b]">
                    <Package className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-[#13222b]">
                    {state.items.length === 0
                      ? 'Belum ada item di Master Item.'
                      : 'Tidak ada item yang cocok dengan pencarian atau filter.'}
                  </p>
                  {state.items.length === 0 && !isViewer ? (
                    <button
                      type="button"
                      onClick={openAddModal}
                      className="mt-3 inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Tambah Item Pertama</span>
                    </button>
                  ) : (
                    (searchQuery || catFilter !== 'all' || statusFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setCatFilter('all');
                          setStatusFilter('all');
                        }}
                        className="mt-3 h-8.5 rounded-xl bg-[#f3f7f5] px-4 text-xs font-semibold text-[#13222b] hover:bg-[#e6f7ee] hover:text-[#15803d] cursor-pointer"
                      >
                        Reset filter
                      </button>
                    )
                  )}
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead className="border-b border-[#edf2f0] bg-[#f7faf9] text-[11px] font-bold uppercase tracking-[0.04em] text-[#64748b]">
                    <tr>
                      <th className="px-5 py-3">Item &amp; ID</th>
                      <th className="px-3 py-3">Kategori</th>
                      <th className="px-3 py-3">Satuan</th>
                      <th className="px-3 py-3 text-right">Stok Min.</th>
                      <th className="px-3 py-3">Status</th>
                      {!isViewer && <th className="px-5 py-3 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf2f0]">
                    {filteredItems.map((item) => {
                      const stats = itemStatsMap[item.id];
                      const isCustomSat = Boolean(item.sat && !satuanList.includes(item.sat));
                      const minValue =
                        minDrafts[item.id] !== undefined ? minDrafts[item.id] : String(item.min ?? 0);

                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors hover:bg-[#f7faf9] ${
                            item.aktif ? '' : 'bg-[#f8faf9]/75 opacity-75'
                          }`}
                        >
                          <td className="px-5 py-3">
                            <div className="font-semibold text-[#13222b]">{item.nama}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[#64748b]">
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

                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="rounded-lg bg-[#f3f7f5] px-2.5 py-1 text-xs font-medium text-[#475569]">
                              {item.kat}
                            </span>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {isViewer ? (
                              <span className="font-medium text-[#13222b]">{item.sat || 'pcs'}</span>
                            ) : (
                              <select
                                value={item.sat || 'pcs'}
                                onChange={(e) => handleInlineSatChange(item, e.target.value)}
                                aria-label={`Satuan ${item.nama}`}
                                className="h-8 rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-2.5 text-xs font-semibold text-[#13222b] outline-none focus:border-[#2eb86b] focus:bg-white"
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

                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            {isViewer ? (
                              <span className="font-mono-num font-semibold text-[#13222b]">
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
                                className="font-mono-num h-8 w-20 rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-2.5 text-right text-xs font-semibold text-[#13222b] outline-none focus:border-[#2eb86b] focus:bg-white"
                              />
                            )}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                                item.aktif
                                  ? 'bg-[#e6f7ee] text-[#15803d]'
                                  : 'bg-[#f1f5f9] text-[#64748b]'
                              }`}
                            >
                              {item.aktif ? 'Aktif' : 'Arsip'}
                            </span>
                          </td>

                          {!isViewer && (
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(item)}
                                  className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  <span>Edit</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(item)}
                                  className={`inline-flex h-8 items-center gap-1 rounded-xl px-3 text-xs font-semibold transition cursor-pointer ${
                                    item.aktif
                                      ? 'bg-[#f3f7f5] text-[#475569] hover:bg-[#e1ebe7] hover:text-[#13222b]'
                                      : 'bg-[#e6f7ee] text-[#15803d] hover:bg-[#d1f2e0]'
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
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-xl transition cursor-pointer ${
                                    stats?.hasHistory
                                      ? 'bg-[#f3f7f5] text-[#94a3b8] hover:text-[#475569]'
                                      : 'bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fecaca]'
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
          </section>
        </div>
      </div>

      {/* MODAL: TAMBAH ITEM BARU */}
      {addModalOpen && !isViewer && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddModalOpen(false);
          }}
        >
          <div className="w-full max-w-[460px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="flex items-start justify-between border-b border-[#edf2f0] px-6 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#13222b]">
                  Tambah Item Baru
                </h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  Item baru akan langsung tersedia di Stok &amp; Input serta Tabel Bulanan
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAdd}>
              <div className="space-y-3.5 px-6 py-5">
                {addError && (
                  <div className="rounded-xl bg-[#fee2e2] px-3.5 py-2.5 text-xs font-semibold text-[#b91c1c]">
                    {addError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                    Nama Item Baru <span className="text-[#ef4444]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newNama}
                    onChange={(e) => {
                      setNewNama(e.target.value);
                      if (addError) setAddError(null);
                    }}
                    placeholder="Contoh: Dimsum Udang"
                    className="h-9.5 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3.5 text-sm text-[#13222b] placeholder:text-[#94a3b8] outline-none transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                    Kategori
                  </label>
                  <input
                    type="text"
                    list="master-kat-list"
                    value={newKat}
                    onChange={(e) => setNewKat(e.target.value)}
                    placeholder="Kategori"
                    className="h-9.5 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3.5 text-sm text-[#13222b] outline-none transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
                  />
                  <datalist id="master-kat-list">
                    {categories.map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                      Satuan
                    </label>
                    <select
                      value={newSat}
                      onChange={(e) => setNewSat(e.target.value)}
                      className="h-9.5 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3 text-sm text-[#13222b] outline-none transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
                    >
                      {satuanList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                      Stok Min.
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newMin}
                      onChange={(e) => setNewMin(e.target.value)}
                      placeholder="0"
                      className="font-mono-num h-9.5 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3.5 text-sm font-semibold text-[#13222b] outline-none transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-6 py-3.5">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="h-9 rounded-xl bg-[#eef3f1] px-4 text-xs font-semibold text-[#13222b] hover:bg-[#e1ebe7] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] whitespace-nowrap cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Item</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ITEM */}
      {editTarget && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditTarget(null);
          }}
        >
          <div className="w-full max-w-[460px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="flex items-start justify-between border-b border-[#edf2f0] px-6 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#13222b]">
                  Edit Master Item
                </h3>
                <p className="font-mono-num mt-0.5 text-xs text-[#64748b]">
                  ID: {editTarget.id} · histori transaksi tetap terhubung
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit}>
              <div className="space-y-3.5 px-6 py-5">
                {editError && (
                  <div className="rounded-xl bg-[#fee2e2] px-3.5 py-2.5 text-xs font-semibold text-[#b91c1c]">
                    {editError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                    Nama Item <span className="text-[#ef4444]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="h-9.5 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3.5 text-sm text-[#13222b] outline-none focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
                  />
                  <p className="mt-1 text-[11px] text-[#64748b]">
                    Mengubah nama tidak memutus histori karena seluruh transaksi menggunakan ID{' '}
                    <span className="font-mono-num font-semibold text-[#13222b]">{editTarget.id}</span>.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">Kategori</label>
                  <input
                    type="text"
                    list="edit-kat-list"
                    value={editKat}
                    onChange={(e) => setEditKat(e.target.value)}
                    className="h-9.5 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3.5 text-sm text-[#13222b] outline-none focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
                  />
                  <datalist id="edit-kat-list">
                    {categories.map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">Satuan</label>
                    <select
                      value={editSat}
                      onChange={(e) => setEditSat(e.target.value)}
                      className="h-9.5 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3 text-sm text-[#13222b] outline-none focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
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
                    <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                      Stok Minimum
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={editMin}
                      onChange={(e) => setEditMin(e.target.value)}
                      className="font-mono-num h-9.5 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3.5 text-sm font-semibold text-[#13222b] outline-none focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-6 py-3.5">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="h-9 rounded-xl bg-[#eef3f1] px-4 text-xs font-semibold text-[#13222b] hover:bg-[#e1ebe7] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white hover:bg-[#259f5b] cursor-pointer"
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
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="w-full max-w-[440px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="border-b border-[#edf2f0] px-6 py-4">
              <h3 className="font-display text-base font-bold text-[#13222b]">
                {deleteTarget.stats.hasHistory
                  ? 'Item Memiliki Histori Transaksi'
                  : 'Hapus Item Permanen'}
              </h3>
              <p className="font-mono-num mt-0.5 text-xs text-[#64748b]">
                {deleteTarget.item.nama} · {deleteTarget.item.id}
              </p>
            </div>

            <div className="px-6 py-5">
              {deleteTarget.stats.hasHistory ? (
                <div className="space-y-2.5 text-[13px] leading-relaxed text-[#475569]">
                  <p>
                    Item <strong className="text-[#13222b]">{deleteTarget.item.nama}</strong> tidak
                    dapat dihapus permanen karena masih terhubung dengan{' '}
                    <strong className="font-mono-num text-[#13222b]">
                      {deleteTarget.stats.totalEntries}
                    </strong>{' '}
                    catatan transaksi pada{' '}
                    <strong className="font-mono-num text-[#13222b]">
                      {deleteTarget.stats.monthsCount}
                    </strong>{' '}
                    bulan ({deleteTarget.stats.awalCount} stok awal, {deleteTarget.stats.datangCount}{' '}
                    barang datang, {deleteTarget.stats.closingCount} closing).
                  </p>
                  <p className="rounded-xl bg-[#f3f7f5] px-3.5 py-2.5 text-xs text-[#475569]">
                    Gunakan <strong className="text-[#13222b]">Arsipkan Item</strong> agar item
                    tidak muncul pada input baru, sementara histori Tabel Bulanan tetap akurat.
                  </p>
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed text-[#475569]">
                  Item <strong className="text-[#13222b]">{deleteTarget.item.nama}</strong> belum
                  memiliki histori transaksi di bulan manapun. Hapus item ini secara permanen dari
                  Master Item?
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-6 py-3.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-9 rounded-xl bg-[#eef3f1] px-4 text-xs font-semibold text-[#13222b] hover:bg-[#e1ebe7] cursor-pointer"
              >
                Batal
              </button>
              {deleteTarget.stats.hasHistory ? (
                deleteTarget.item.aktif ? (
                  <button
                    type="button"
                    onClick={handleArchiveFromDeleteModal}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#f59e0b] px-4 text-xs font-semibold text-white hover:bg-[#d97706] cursor-pointer"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span>Arsipkan Item</span>
                  </button>
                ) : null
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#ef4444] px-4 text-xs font-semibold text-white hover:bg-[#dc2626] cursor-pointer"
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
