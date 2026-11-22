import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Box,
  Check,
  Edit3,
  Eye,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { DEFAULT_SATUAN } from '../constants/defaults';
import { useApp } from '../context/AppContext';
import {
  getAllCategories,
  getSatuanList,
  getUnitUsageInfo,
  type UnitUsageInfo,
} from '../domain/stockCalculations';
import type { MasterItem } from '../types/app';

type SatuanTab = 'item' | 'list';

export const SettingSatuanPage: React.FC = () => {
  const {
    state,
    isViewer,
    sync,
    addSatuan,
    renameSatuan,
    deleteSatuan,
    updateMasterItem,
    navigateTo,
  } = useApp();

  const [subTab, setSubTab] = useState<SatuanTab>('item');
  const [searchQuery, setSearchQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('all');

  // Inline feedback banner
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(
    null
  );

  // Add Satuan Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Rename Satuan Modal
  const [renameTarget, setRenameTarget] = useState<UnitUsageInfo | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  // View Items using a Satuan Modal
  const [inspectUnit, setInspectUnit] = useState<string | null>(null);

  // Delete Satuan Modal
  const [deleteTarget, setDeleteTarget] = useState<UnitUsageInfo | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 3800);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const satuanList = useMemo(() => getSatuanList(state, DEFAULT_SATUAN), [state]);
  const categories = useMemo(() => getAllCategories(state), [state]);

  // Usage info for every registered unit
  const unitInfos = useMemo(
    () => satuanList.map((u) => getUnitUsageInfo(state, u, DEFAULT_SATUAN)),
    [state, satuanList]
  );

  // Detect any legacy custom units referenced on items that aren't in state.satuan
  const orphanUnits = useMemo(() => {
    const regSet = new Set(satuanList.map((s) => s.trim().toLowerCase()));
    const extras = new Set<string>();
    state.items.forEach((item) => {
      const sat = (item.sat || '').trim();
      if (sat && !regSet.has(sat.toLowerCase())) {
        extras.add(sat);
      }
    });
    return Array.from(extras).map((u) => getUnitUsageInfo(state, u, DEFAULT_SATUAN));
  }, [state, satuanList]);

  const inspectInfo = useMemo(() => {
    if (!inspectUnit) return null;
    return getUnitUsageInfo(state, inspectUnit, DEFAULT_SATUAN);
  }, [state, inspectUnit]);

  // Grouped items for Tab 1 (Satuan per Item)
  const groupedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const normUnitFilter = unitFilter === 'all' ? null : unitFilter.trim().toLowerCase();

    return categories
      .map((kat): [string, MasterItem[]] => {
        const list = state.items.filter((item) => {
          if ((item.kat || 'Lain-Lain') !== kat) return false;
          if (normUnitFilter && (item.sat || '').trim().toLowerCase() !== normUnitFilter) {
            return false;
          }
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
        return [kat, list];
      })
      .filter(([, list]) => list.length > 0);
  }, [categories, state.items, searchQuery, unitFilter]);

  const totalFilteredItems = useMemo(
    () => groupedItems.reduce((acc, [, list]) => acc + list.length, 0),
    [groupedItems]
  );

  const openAddModal = () => {
    setNewUnitName('');
    setAddError(null);
    setAddModalOpen(true);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addSatuan(newUnitName);
    if (!res.ok) {
      setAddError(res.error || 'Gagal menambah satuan.');
      return;
    }
    setAddModalOpen(false);
    setFeedback({
      tone: 'ok',
      text: `Satuan "${res.unit}" berhasil ditambahkan dan langsung tersedia di Master Item.`,
    });
  };

  const openRenameModal = (info: UnitUsageInfo) => {
    setRenameTarget(info);
    setRenameValue(info.unit);
    setRenameError(null);
  };

  const handleSubmitRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget) return;
    const res = renameSatuan(renameTarget.unit, renameValue);
    if (!res.ok) {
      setRenameError(res.error || 'Gagal mengubah nama satuan.');
      return;
    }
    const nextLabel = renameValue.trim().toLowerCase();
    setRenameTarget(null);
    setFeedback({
      tone: 'ok',
      text:
        res.updatedItems && res.updatedItems > 0
          ? `Satuan diubah menjadi "${nextLabel}" dan diperbarui pada ${res.updatedItems} item (angka histori stok tetap utuh).`
          : `Satuan berhasil diubah menjadi "${nextLabel}".`,
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const targetName = deleteTarget.unit;
    const res = deleteSatuan(targetName);
    setDeleteTarget(null);
    if (!res.ok) {
      setFeedback({ tone: 'err', text: res.error || 'Gagal menghapus satuan.' });
      return;
    }
    setFeedback({
      tone: 'ok',
      text: `Satuan "${targetName}" telah dihapus dari daftar satuan.`,
    });
  };

  const handleChangeItemSat = (item: MasterItem, nextSat: string) => {
    if (isViewer) return;
    const res = updateMasterItem(item.id, { sat: nextSat });
    if (res.ok) {
      setFeedback({
        tone: 'ok',
        text: `Satuan "${item.nama}" diubah menjadi "${nextSat}" tanpa mengubah angka histori transaksi.`,
      });
    }
  };

  const jumpToItemsWithUnit = (unit: string) => {
    setInspectUnit(null);
    setDeleteTarget(null);
    setUnitFilter(unit);
    setSearchQuery('');
    setSubTab('item');
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f4f6f7] p-3 sm:p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#dde2e6] bg-white">
        {/* TOP HEADER TOOLBAR */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3 sm:px-5">
          <div>
            <h1 className="text-[15px] font-bold text-[#1f2a36]">Setting Satuan</h1>
            <p className="text-[11.5px] text-[#64748b]">
              Kelola satuan persediaan dan hubungannya dengan Master Item, Stok Awal, Input Harian,
              Tabel Bulanan, dan Laporan
            </p>
          </div>

          <div
            className="flex items-center gap-1 rounded-lg border border-[#e2e8f0] bg-[#f1f5f9] p-1"
            role="tablist"
            aria-label="Submenu Setting Satuan"
          >
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'item'}
              onClick={() => setSubTab('item')}
              className={`h-8 rounded-md px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'item'
                  ? 'bg-white text-[#147d75] shadow-xs'
                  : 'text-[#64748b] hover:text-[#1f2a36]'
              }`}
            >
              Satuan per Item
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'list'}
              onClick={() => setSubTab('list')}
              className={`h-8 rounded-md px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'list'
                  ? 'bg-white text-[#147d75] shadow-xs'
                  : 'text-[#64748b] hover:text-[#1f2a36]'
              }`}
            >
              Daftar Satuan{' '}
              <span className="font-mono-num opacity-80">({satuanList.length})</span>
            </button>
          </div>
        </div>

        {/* SUBHEADER ACTION BAR */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 sm:px-5">
          {subTab === 'item' ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama item, kategori…"
                  aria-label="Cari item"
                  className="h-8 w-56 rounded-lg border border-[#dde2e6] bg-white pr-7 pl-8 text-xs text-[#1f2a36] placeholder:text-[#94a3b8] focus:border-[#1a9e94] focus:outline-none"
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
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                aria-label="Filter satuan"
                className="h-8 rounded-lg border border-[#dde2e6] bg-white px-2.5 text-xs font-medium text-[#334155] focus:border-[#1a9e94] focus:outline-none"
              >
                <option value="all">Semua satuan ({satuanList.length})</option>
                {satuanList.map((s) => (
                  <option key={s} value={s}>
                    Satuan: {s}
                  </option>
                ))}
                {orphanUnits.map((o) => (
                  <option key={o.unit} value={o.unit}>
                    Satuan kustom: {o.unit}
                  </option>
                ))}
              </select>

              {(searchQuery || unitFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setUnitFilter('all');
                  }}
                  className="text-xs font-semibold text-[#147d75] hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          ) : (
            <div className="text-xs text-[#64748b]">
              Menampilkan <strong className="font-mono-num text-[#1f2a36]">{satuanList.length}</strong>{' '}
              satuan terdaftar · Satuan yang sedang digunakan item tidak dapat dihapus sebelum relasi
              dipindahkan
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo('ms')}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#dde2e6] bg-white px-3 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Master Item</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            {!isViewer && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-3.5 text-xs font-semibold text-white hover:bg-[#14857c] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{subTab === 'item' ? 'Tambah Satuan Kustom' : 'Tambah Satuan Baru'}</span>
              </button>
            )}
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

        {/* CONTENT BODY */}
        <div className="dg-scroll min-h-0 flex-1 overflow-auto">
          {/* ─────────────────── TAB 1: SATUAN PER ITEM ─────────────────── */}
          {subTab === 'item' && (
            <>
              {totalFilteredItems === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                  <Package className="mb-3 h-9 w-9 text-[#94a3b8]" />
                  <p className="text-sm font-semibold text-[#334155]">
                    Tidak ada item yang cocok dengan filter saat ini.
                  </p>
                  {(searchQuery || unitFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setUnitFilter('all');
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
                      <th className="px-4 py-3 sm:px-5">Nama Item</th>
                      <th className="px-3 py-3">Kategori</th>
                      <th className="px-3 py-3">Satuan Aktif</th>
                      <th className="px-4 py-3 sm:px-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {groupedItems.map(([cat, items]) => (
                      <React.Fragment key={cat}>
                        <tr className="bg-[#f8fafc]/90">
                          <td
                            colSpan={4}
                            className="px-4 py-2 text-[11.5px] font-bold tracking-wide text-[#475569] sm:px-5"
                          >
                            {cat}{' '}
                            <span className="font-mono-num font-normal text-[#94a3b8]">
                              ({items.length})
                            </span>
                          </td>
                        </tr>
                        {items.map((item) => {
                          const isCustomSat = Boolean(item.sat && !satuanList.includes(item.sat));
                          return (
                            <tr
                              key={item.id}
                              className={`hover:bg-[#f8fafc] ${item.aktif ? '' : 'opacity-60'}`}
                            >
                              <td className="px-4 py-2.5 sm:px-5">
                                <div className="font-semibold text-[#1f2a36]">{item.nama}</div>
                                <div className="font-mono-num text-[11px] text-[#94a3b8]">
                                  ID: {item.id}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-[#475569] whitespace-nowrap">
                                {item.kat}
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {isViewer ? (
                                  <span className="font-medium text-[#1f2a36]">
                                    {item.sat || 'pcs'}
                                  </span>
                                ) : (
                                  <select
                                    value={item.sat || 'pcs'}
                                    onChange={(e) => handleChangeItemSat(item, e.target.value)}
                                    aria-label={`Satuan untuk ${item.nama}`}
                                    className="h-8 w-40 rounded-md border border-[#dde2e6] bg-white px-2.5 text-xs font-semibold text-[#1f2a36] focus:border-[#1a9e94] focus:outline-none"
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
                              <td className="px-4 py-2.5 whitespace-nowrap sm:px-5">
                                <span
                                  className={`text-xs font-semibold ${
                                    item.aktif ? 'text-[#15803d]' : 'text-[#64748b]'
                                  }`}
                                >
                                  {item.aktif ? 'Aktif' : 'Arsip'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* ─────────────────── TAB 2: DAFTAR SATUAN ─────────────────── */}
          {subTab === 'list' && (
            <div className="space-y-4">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="sticky top-0 z-10 border-b border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-[#64748b]">
                  <tr>
                    <th className="w-14 px-4 py-3 sm:px-5">No</th>
                    <th className="px-3 py-3">Nama Satuan</th>
                    <th className="px-3 py-3">Penggunaan Item</th>
                    <th className="px-4 py-3 text-right sm:px-5">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {unitInfos.map((info, idx) => (
                    <tr key={info.unit} className="hover:bg-[#f8fafc]">
                      <td className="font-mono-num px-4 py-3 text-xs text-[#64748b] sm:px-5">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#1f2a36]">{info.unit}</span>
                          <span className="text-[11px] text-[#94a3b8]">
                            {info.isDefault ? '· Bawaan' : '· Kustom'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {info.totalCount > 0 ? (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                            <button
                              type="button"
                              onClick={() => setInspectUnit(info.unit)}
                              className="font-mono-num font-semibold text-[#147d75] hover:underline cursor-pointer"
                            >
                              {info.totalCount} item
                            </button>
                            <span className="text-[#64748b]">
                              ({info.activeItems.length} aktif
                              {info.archivedItems.length > 0
                                ? `, ${info.archivedItems.length} arsip`
                                : ''}
                              {info.itemsWithHistoryCount > 0
                                ? ` · ${info.itemsWithHistoryCount} berhistori`
                                : ''}
                              )
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-[#94a3b8]">Belum digunakan</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap sm:px-5">
                        <div className="inline-flex items-center gap-1.5">
                          {info.totalCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setInspectUnit(info.unit)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#dde2e6] bg-white px-2.5 text-xs font-semibold text-[#475569] hover:bg-[#f8fafc] cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Item</span>
                            </button>
                          )}
                          {!isViewer && (
                            <>
                              <button
                                type="button"
                                onClick={() => openRenameModal(info)}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#dde2e6] bg-white px-2.5 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc] cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(info)}
                                aria-label={`Hapus satuan ${info.unit}`}
                                title={
                                  info.canDelete
                                    ? `Hapus satuan ${info.unit}`
                                    : `Sedang digunakan oleh ${info.totalCount} item`
                                }
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border cursor-pointer ${
                                  info.canDelete
                                    ? 'border-[#fecdd3] bg-white text-[#dc2626] hover:bg-[#fff1f2]'
                                    : 'border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8] hover:text-[#64748b]'
                                }`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ORPHAN CUSTOM UNITS (IF ANY LEGACY DATA HAS UNREGISTERED UNIT STRINGS) */}
              {orphanUnits.length > 0 && (
                <div className="mx-4 mb-4 rounded-xl border border-[#fde68a] bg-[#fffbeb] p-4 sm:mx-5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#92400e]">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Satuan Kustom pada Item Belum Terdaftar ({orphanUnits.length})</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {orphanUnits.map((o) => (
                      <div
                        key={o.unit}
                        className="flex items-center gap-2 rounded-lg border border-[#fde68a] bg-white px-3 py-1.5 text-xs"
                      >
                        <span className="font-semibold text-[#1f2a36]">{o.unit}</span>
                        <span className="text-[#64748b]">({o.totalCount} item)</span>
                        {!isViewer && (
                          <button
                            type="button"
                            onClick={() => {
                              const res = addSatuan(o.unit);
                              if (res.ok) {
                                setFeedback({
                                  tone: 'ok',
                                  text: `Satuan "${o.unit}" didaftarkan ke Daftar Satuan.`,
                                });
                              }
                            }}
                            className="font-semibold text-[#147d75] hover:underline cursor-pointer"
                          >
                            Daftarkan
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM FOOTER BAR */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 text-xs sm:px-5">
          <p className="text-[#64748b]">
            Perubahan satuan langsung sinkron ke Master Item, Stok Awal, Input Harian, Tabel
            Bulanan, dan Laporan tanpa mengonversi angka histori secara otomatis.
          </p>
          <span className="font-medium text-[#15803d] whitespace-nowrap">{sync.text}</span>
        </div>
      </div>

      {/* ─────────────────── MODAL: TAMBAH SATUAN BARU ─────────────────── */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddModalOpen(false);
          }}
        >
          <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-[#dde2e6] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e6f5f3] text-[#147d75]">
                  <Box className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1f2a36]">Tambah Satuan Baru</h3>
                  <p className="text-xs text-[#64748b]">
                    Satuan akan otomatis tersedia di seluruh modul stok
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd}>
              <div className="space-y-3.5 px-5 py-4">
                {addError && (
                  <div className="rounded-lg border border-[#fecdd3] bg-[#fff1f2] px-3 py-2 text-xs font-medium text-[#9f1239]">
                    {addError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#1f2a36]">
                    Nama Satuan <span className="text-[#dc2626]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={24}
                    value={newUnitName}
                    onChange={(e) => {
                      setNewUnitName(e.target.value);
                      setAddError(null);
                    }}
                    placeholder="Contoh: sachet, kaleng, bungkus, dus"
                    className="h-10 w-full rounded-lg border border-[#dde2e6] px-3 text-sm text-[#1f2a36] focus:border-[#1a9e94] focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-[#64748b]">
                    Nama satuan otomatis diseragamkan ke huruf kecil dan divalidasi agar tidak
                    duplikat.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="h-9 rounded-lg border border-[#dde2e6] bg-white px-4 text-xs font-semibold text-[#475569] hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-4 text-xs font-semibold text-white hover:bg-[#14857c] cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Simpan Satuan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────── MODAL: EDIT NAMA SATUAN ─────────────────── */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRenameTarget(null);
          }}
        >
          <div className="w-full max-w-[430px] overflow-hidden rounded-2xl border border-[#dde2e6] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-[#1f2a36]">Edit Nama Satuan</h3>
                <p className="text-xs text-[#64748b]">
                  Satuan saat ini: <strong className="text-[#1f2a36]">{renameTarget.unit}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRename}>
              <div className="space-y-3.5 px-5 py-4">
                {renameError && (
                  <div className="rounded-lg border border-[#fecdd3] bg-[#fff1f2] px-3 py-2 text-xs font-medium text-[#9f1239]">
                    {renameError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#1f2a36]">
                    Nama Satuan Baru <span className="text-[#dc2626]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={24}
                    value={renameValue}
                    onChange={(e) => {
                      setRenameValue(e.target.value);
                      setRenameError(null);
                    }}
                    className="h-10 w-full rounded-lg border border-[#dde2e6] px-3 text-sm text-[#1f2a36] focus:border-[#1a9e94] focus:outline-none"
                  />
                </div>

                {renameTarget.totalCount > 0 && (
                  <div className="rounded-lg border border-[#bae6fd] bg-[#f0f9ff] px-3 py-2.5 text-xs leading-relaxed text-[#075985]">
                    Label satuan pada <strong>{renameTarget.totalCount} item</strong> akan ikut
                    diperbarui secara konsisten. Angka stok dan histori transaksi tidak dikonversi
                    atau diubah.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  className="h-9 rounded-lg border border-[#dde2e6] bg-white px-4 text-xs font-semibold text-[#475569] hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-4 text-xs font-semibold text-white hover:bg-[#14857c] cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────── MODAL: DAFTAR ITEM PENGGUNA SATUAN ─────────────────── */}
      {inspectInfo && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectUnit(null);
          }}
        >
          <div className="w-full max-w-[480px] overflow-hidden rounded-2xl border border-[#dde2e6] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-[#1f2a36]">
                  Item dengan Satuan &ldquo;{inspectInfo.unit}&rdquo;
                </h3>
                <p className="text-xs text-[#64748b]">
                  {inspectInfo.totalCount} item ({inspectInfo.activeItems.length} aktif ·{' '}
                  {inspectInfo.archivedItems.length} arsip)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectUnit(null)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="dg-scroll max-h-[55vh] divide-y divide-[#e2e8f0] overflow-y-auto px-5 py-2">
              {inspectInfo.items.length === 0 ? (
                <p className="py-8 text-center text-xs text-[#64748b]">
                  Tidak ada item yang menggunakan satuan ini.
                </p>
              ) : (
                inspectInfo.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[#1f2a36]">{item.nama}</div>
                      <div className="text-xs text-[#64748b]">
                        {item.kat} · <span className="font-mono-num">ID: {item.id}</span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        item.aktif ? 'text-[#15803d]' : 'text-[#64748b]'
                      }`}
                    >
                      {item.aktif ? 'Aktif' : 'Arsip'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-5 py-3.5">
              <button
                type="button"
                onClick={() => jumpToItemsWithUnit(inspectInfo.unit)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#1a9e94] bg-white px-3.5 text-xs font-semibold text-[#147d75] hover:bg-[#f0fdfa] cursor-pointer"
              >
                <span>Ubah di Satuan per Item</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setInspectUnit(null)}
                className="h-9 rounded-lg border border-[#dde2e6] bg-white px-4 text-xs font-semibold text-[#475569] hover:bg-slate-50 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── MODAL: HAPUS SATUAN (RELATIONAL GUARD) ─────────────────── */}
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
                    deleteTarget.canDelete
                      ? 'bg-[#fff1f2] text-[#dc2626]'
                      : 'bg-[#fffbeb] text-[#d97706]'
                  }`}
                >
                  {deleteTarget.canDelete ? (
                    <Trash2 className="h-5 w-5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1f2a36]">
                    {deleteTarget.canDelete
                      ? `Hapus Satuan "${deleteTarget.unit}"`
                      : `Satuan "${deleteTarget.unit}" Sedang Digunakan`}
                  </h3>
                  <p className="text-xs text-[#64748b]">
                    {deleteTarget.canDelete
                      ? 'Tidak ada item yang memakai satuan ini'
                      : `${deleteTarget.totalCount} item masih merujuk ke satuan ini`}
                  </p>
                </div>
              </div>

              {deleteTarget.canDelete ? (
                <p className="mt-3.5 text-sm leading-relaxed text-[#334155]">
                  Hapus satuan <strong>{deleteTarget.unit}</strong> dari daftar pilihan satuan?
                  Anda dapat menambahkannya kembali kapan saja jika diperlukan.
                </p>
              ) : (
                <div className="mt-3.5 space-y-2.5 text-sm leading-relaxed text-[#334155]">
                  <p>
                    Satuan <strong>{deleteTarget.unit}</strong> tidak dapat dihapus karena masih
                    digunakan oleh{' '}
                    <strong className="font-mono-num">{deleteTarget.totalCount}</strong> item (
                    {deleteTarget.activeItems.length} aktif
                    {deleteTarget.archivedItems.length > 0
                      ? `, ${deleteTarget.archivedItems.length} arsip`
                      : ''}
                    {deleteTarget.itemsWithHistoryCount > 0
                      ? `, ${deleteTarget.itemsWithHistoryCount} memiliki histori transaksi`
                      : ''}
                    ):
                  </p>
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs text-[#475569]">
                    {deleteTarget.items.map((i) => i.nama).join(', ')}
                  </div>
                  <p className="text-xs text-[#64748b]">
                    Pindahkan satuan item-item tersebut ke satuan lain terlebih dahulu, atau gunakan
                    tombol <strong>Edit</strong> untuk mengubah label satuan secara langsung.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] px-5 py-3.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-9 rounded-lg border border-[#dde2e6] bg-white px-4 text-xs font-semibold text-[#475569] hover:bg-slate-50 cursor-pointer"
              >
                Tutup
              </button>
              {deleteTarget.canDelete ? (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#dc2626] px-4 text-xs font-semibold text-white hover:bg-[#b91c1c] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Ya, Hapus</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => jumpToItemsWithUnit(deleteTarget.unit)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1a9e94] px-4 text-xs font-semibold text-white hover:bg-[#14857c] cursor-pointer"
                >
                  <span>Kelola Item Terkait</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
