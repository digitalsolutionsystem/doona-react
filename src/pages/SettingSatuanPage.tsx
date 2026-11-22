import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
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

  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(
    null
  );

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<UnitUsageInfo | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const [inspectUnit, setInspectUnit] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UnitUsageInfo | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 3800);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const satuanList = useMemo(() => getSatuanList(state, DEFAULT_SATUAN), [state]);
  const categories = useMemo(() => getAllCategories(state), [state]);

  const unitInfos = useMemo(
    () => satuanList.map((u) => getUnitUsageInfo(state, u, DEFAULT_SATUAN)),
    [state, satuanList]
  );

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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
      {/* TOP HEADER */}
      <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e5df] px-5 py-3.5 md:px-6">
        <div>
          <h1 className="font-display text-lg font-semibold text-[#141816]">Setting Satuan</h1>
          <p className="text-xs text-[#7c8580]">
            Kelola satuan persediaan dan relasinya dengan Master Item, Stok Awal, Input Harian,
            Tabel Bulanan, dan Laporan
          </p>
        </div>

        <div
          className="flex items-center gap-0.5 rounded-lg border border-[#e5e5df] bg-[#f7f7f4] p-0.5"
          role="tablist"
          aria-label="Submenu Setting Satuan"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'item'}
            onClick={() => setSubTab('item')}
            className={`h-7.5 rounded-md px-3 text-xs font-medium transition whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'item'
                ? 'bg-[#14533c] text-white'
                : 'text-[#565e59] hover:bg-white hover:text-[#141816]'
            }`}
          >
            Satuan per Item
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'list'}
            onClick={() => setSubTab('list')}
            className={`h-7.5 rounded-md px-3 text-xs font-medium transition whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'list'
                ? 'bg-[#14533c] text-white'
                : 'text-[#565e59] hover:bg-white hover:text-[#141816]'
            }`}
          >
            Daftar Satuan <span className="font-mono-num opacity-80">({satuanList.length})</span>
          </button>
        </div>
      </header>

      {/* SUBHEADER ACTION BAR */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e5e5df] bg-[#fafaf8] px-5 py-2.5 md:px-6">
        {subTab === 'item' ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[#9aa39e]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama item, kategori…"
                aria-label="Cari item"
                className="h-8 w-56 rounded-md border border-[#e5e5df] bg-white pr-7 pl-8 text-xs text-[#141816] placeholder:text-[#9aa39e] focus:border-[#14533c] focus:outline-none"
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
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              aria-label="Filter satuan"
              className="h-8 rounded-md border border-[#e5e5df] bg-white px-2.5 text-xs text-[#565e59] focus:border-[#14533c] focus:outline-none"
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
                className="text-xs font-medium text-[#14533c] hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        ) : (
          <div className="text-xs text-[#565e59]">
            Menampilkan <strong className="font-mono-num text-[#141816]">{satuanList.length}</strong>{' '}
            satuan terdaftar · Satuan yang digunakan item tidak dapat dihapus sebelum relasi
            dipindahkan
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigateTo('ms')}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#565e59] hover:bg-[#f3f3ee] hover:text-[#141816] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Master Item</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {!isViewer && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#14533c] px-3.5 text-xs font-medium text-white hover:bg-[#0f3f2d] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{subTab === 'item' ? 'Tambah Satuan Kustom' : 'Tambah Satuan Baru'}</span>
            </button>
          )}
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

      {/* CONTENT BODY */}
      <div className="dg-scroll min-h-0 flex-1 overflow-auto">
        {subTab === 'item' && (
          <>
            {totalFilteredItems === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <Package className="mb-3 h-8 w-8 text-[#9aa39e]" />
                <p className="text-sm font-medium text-[#141816]">
                  Tidak ada item yang cocok dengan filter saat ini.
                </p>
                {(searchQuery || unitFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setUnitFilter('all');
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
                    <th className="px-5 py-2.5 md:px-6">Nama Item</th>
                    <th className="px-3 py-2.5">Kategori</th>
                    <th className="px-3 py-2.5">Satuan Aktif</th>
                    <th className="px-5 py-2.5 md:px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efefea]">
                  {groupedItems.map(([cat, items]) => (
                    <React.Fragment key={cat}>
                      <tr className="bg-[#f4f4ef]">
                        <td
                          colSpan={4}
                          className="px-5 py-1.5 text-xs font-semibold text-[#141816] md:px-6"
                        >
                          {cat}{' '}
                          <span className="font-mono-num font-normal text-[#7c8580]">
                            · {items.length}
                          </span>
                        </td>
                      </tr>
                      {items.map((item) => {
                        const isCustomSat = Boolean(item.sat && !satuanList.includes(item.sat));
                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-[#fafaf8] ${item.aktif ? '' : 'opacity-60'}`}
                          >
                            <td className="px-5 py-2.5 md:px-6">
                              <div className="font-medium text-[#141816]">{item.nama}</div>
                              <div className="font-mono-num text-[11px] text-[#7c8580]">
                                {item.id}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-[#565e59] whitespace-nowrap">
                              {item.kat}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {isViewer ? (
                                <span className="font-medium text-[#141816]">
                                  {item.sat || 'pcs'}
                                </span>
                              ) : (
                                <select
                                  value={item.sat || 'pcs'}
                                  onChange={(e) => handleChangeItemSat(item, e.target.value)}
                                  aria-label={`Satuan untuk ${item.nama}`}
                                  className="h-7.5 w-40 rounded-md border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#141816] focus:border-[#14533c] focus:outline-none"
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
                            <td className="px-5 py-2.5 whitespace-nowrap md:px-6">
                              <span
                                className={`text-xs font-medium ${
                                  item.aktif ? 'text-[#15803d]' : 'text-[#7c8580]'
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

        {subTab === 'list' && (
          <div className="space-y-4">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="sticky top-0 z-10 border-b border-[#e5e5df] bg-[#fafaf8] text-xs font-medium text-[#565e59]">
                <tr>
                  <th className="w-14 px-5 py-2.5 md:px-6">No</th>
                  <th className="px-3 py-2.5">Nama Satuan</th>
                  <th className="px-3 py-2.5">Penggunaan Item</th>
                  <th className="px-5 py-2.5 text-right md:px-6">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efefea]">
                {unitInfos.map((info, idx) => (
                  <tr key={info.unit} className="hover:bg-[#fafaf8]">
                    <td className="font-mono-num px-5 py-2.5 text-xs text-[#7c8580] md:px-6">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-[#141816]">{info.unit}</span>
                        <span className="text-[11px] text-[#7c8580]">
                          · {info.isDefault ? 'Bawaan' : 'Kustom'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {info.totalCount > 0 ? (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => setInspectUnit(info.unit)}
                            className="font-mono-num font-medium text-[#14533c] hover:underline cursor-pointer"
                          >
                            {info.totalCount} item
                          </button>
                          <span className="text-[#7c8580]">
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
                        <span className="text-xs text-[#9aa39e]">Belum digunakan</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap md:px-6">
                      <div className="inline-flex items-center gap-1.5">
                        {info.totalCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setInspectUnit(info.unit)}
                            className="inline-flex h-7.5 items-center gap-1 rounded-md border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#565e59] hover:bg-[#f3f3ee] cursor-pointer"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Item</span>
                          </button>
                        )}
                        {!isViewer && (
                          <>
                            <button
                              type="button"
                              onClick={() => openRenameModal(info)}
                              className="inline-flex h-7.5 items-center gap-1 rounded-md border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#141816] hover:bg-[#f3f3ee] cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" />
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
                              className={`inline-flex h-7.5 w-7.5 items-center justify-center rounded-md border cursor-pointer ${
                                info.canDelete
                                  ? 'border-[#fecaca] bg-white text-[#b91c1c] hover:bg-[#fef2f2]'
                                  : 'border-[#e5e5df] bg-[#fafaf8] text-[#9aa39e] hover:text-[#565e59]'
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

            {orphanUnits.length > 0 && (
              <div className="mx-5 mb-4 rounded-lg border border-[#f3d692] bg-[#fffcf2] p-4 md:mx-6">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#92400e]">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Satuan Kustom pada Item Belum Terdaftar ({orphanUnits.length})</span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {orphanUnits.map((o) => (
                    <div
                      key={o.unit}
                      className="flex items-center gap-2 rounded-md border border-[#f3d692] bg-white px-3 py-1.5 text-xs"
                    >
                      <span className="font-medium text-[#141816]">{o.unit}</span>
                      <span className="text-[#7c8580]">({o.totalCount} item)</span>
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
                          className="font-medium text-[#14533c] hover:underline cursor-pointer"
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

      {/* BOTTOM FOOTER */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-[#e5e5df] bg-[#fafaf8] px-5 py-2 text-xs md:px-6">
        <p className="text-[#7c8580]">
          Perubahan satuan langsung sinkron ke seluruh modul tanpa mengonversi angka histori secara
          otomatis.
        </p>
        <span className="font-medium text-[#15803d] whitespace-nowrap">{sync.text}</span>
      </div>

      {/* MODAL: TAMBAH SATUAN */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#111614]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddModalOpen(false);
          }}
        >
          <div className="w-full max-w-[420px] overflow-hidden rounded-xl border border-[#e5e5df] bg-white shadow-[0_24px_60px_rgba(17,22,20,0.18)]">
            <div className="flex items-start justify-between border-b border-[#e5e5df] px-5 py-4">
              <div>
                <h3 className="font-display text-base font-semibold text-[#141816]">
                  Tambah Satuan Baru
                </h3>
                <p className="mt-0.5 text-xs text-[#565e59]">
                  Satuan akan otomatis tersedia di seluruh modul stok
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#7c8580] hover:bg-[#f3f3ee] hover:text-[#141816] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd}>
              <div className="space-y-3.5 px-5 py-4">
                {addError && (
                  <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs font-medium text-[#b91c1c]">
                    {addError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#141816]">
                    Nama Satuan <span className="text-[#b91c1c]">*</span>
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
                    className="h-9.5 w-full rounded-md border border-[#e5e5df] px-3 text-sm text-[#141816] focus:border-[#14533c] focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-[#7c8580]">
                    Nama satuan otomatis diseragamkan ke huruf kecil dan dicek agar tidak duplikat.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#e5e5df] bg-[#fafaf8] px-5 py-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="h-8.5 rounded-md border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#565e59] hover:bg-[#f3f3ee] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-[#14533c] px-4 text-xs font-medium text-white hover:bg-[#0f3f2d] cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Simpan Satuan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT NAMA SATUAN */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#111614]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRenameTarget(null);
          }}
        >
          <div className="w-full max-w-[430px] overflow-hidden rounded-xl border border-[#e5e5df] bg-white shadow-[0_24px_60px_rgba(17,22,20,0.18)]">
            <div className="flex items-start justify-between border-b border-[#e5e5df] px-5 py-4">
              <div>
                <h3 className="font-display text-base font-semibold text-[#141816]">
                  Edit Nama Satuan
                </h3>
                <p className="mt-0.5 text-xs text-[#565e59]">
                  Satuan saat ini: <strong className="text-[#141816]">{renameTarget.unit}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#7c8580] hover:bg-[#f3f3ee] hover:text-[#141816] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRename}>
              <div className="space-y-3.5 px-5 py-4">
                {renameError && (
                  <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs font-medium text-[#b91c1c]">
                    {renameError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#141816]">
                    Nama Satuan Baru <span className="text-[#b91c1c]">*</span>
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
                    className="h-9.5 w-full rounded-md border border-[#e5e5df] px-3 text-sm text-[#141816] focus:border-[#14533c] focus:outline-none"
                  />
                </div>

                {renameTarget.totalCount > 0 && (
                  <div className="rounded-lg border border-[#e5e5df] bg-[#fafaf8] px-3 py-2.5 text-xs leading-relaxed text-[#565e59]">
                    Label satuan pada <strong className="text-[#141816]">{renameTarget.totalCount} item</strong> akan ikut
                    diperbarui secara konsisten. Angka stok dan histori transaksi tidak dikonversi.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#e5e5df] bg-[#fafaf8] px-5 py-3">
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
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

      {/* MODAL: DAFTAR ITEM PENGGUNA SATUAN */}
      {inspectInfo && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#111614]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectUnit(null);
          }}
        >
          <div className="w-full max-w-[480px] overflow-hidden rounded-xl border border-[#e5e5df] bg-white shadow-[0_24px_60px_rgba(17,22,20,0.18)]">
            <div className="flex items-start justify-between border-b border-[#e5e5df] px-5 py-4">
              <div>
                <h3 className="font-display text-base font-semibold text-[#141816]">
                  Item dengan Satuan &ldquo;{inspectInfo.unit}&rdquo;
                </h3>
                <p className="mt-0.5 text-xs text-[#565e59]">
                  {inspectInfo.totalCount} item · {inspectInfo.activeItems.length} aktif ·{' '}
                  {inspectInfo.archivedItems.length} arsip
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectUnit(null)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#7c8580] hover:bg-[#f3f3ee] hover:text-[#141816] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="dg-scroll max-h-[55vh] divide-y divide-[#efefea] overflow-y-auto px-5 py-1">
              {inspectInfo.items.length === 0 ? (
                <p className="py-8 text-center text-xs text-[#7c8580]">
                  Tidak ada item yang menggunakan satuan ini.
                </p>
              ) : (
                inspectInfo.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[#141816]">{item.nama}</div>
                      <div className="text-xs text-[#7c8580]">
                        {item.kat} · <span className="font-mono-num">{item.id}</span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium ${
                        item.aktif ? 'text-[#15803d]' : 'text-[#7c8580]'
                      }`}
                    >
                      {item.aktif ? 'Aktif' : 'Arsip'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-[#e5e5df] bg-[#fafaf8] px-5 py-3">
              <button
                type="button"
                onClick={() => jumpToItemsWithUnit(inspectInfo.unit)}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-md border border-[#14533c] bg-white px-3 text-xs font-medium text-[#14533c] hover:bg-[#ecf5f1] cursor-pointer"
              >
                <span>Ubah di Satuan per Item</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setInspectUnit(null)}
                className="h-8.5 rounded-md border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#565e59] hover:bg-[#f3f3ee] cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HAPUS SATUAN */}
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
                {deleteTarget.canDelete
                  ? `Hapus Satuan "${deleteTarget.unit}"`
                  : `Satuan "${deleteTarget.unit}" Sedang Digunakan`}
              </h3>
              <p className="mt-0.5 text-xs text-[#565e59]">
                {deleteTarget.canDelete
                  ? 'Tidak ada item yang memakai satuan ini'
                  : `${deleteTarget.totalCount} item masih merujuk ke satuan ini`}
              </p>
            </div>

            <div className="px-5 py-4">
              {deleteTarget.canDelete ? (
                <p className="text-[13px] leading-relaxed text-[#565e59]">
                  Hapus satuan <strong className="text-[#141816]">{deleteTarget.unit}</strong> dari
                  daftar pilihan satuan? Anda dapat menambahkannya kembali kapan saja.
                </p>
              ) : (
                <div className="space-y-2.5 text-[13px] leading-relaxed text-[#565e59]">
                  <p>
                    Satuan <strong className="text-[#141816]">{deleteTarget.unit}</strong> tidak
                    dapat dihapus karena masih digunakan oleh{' '}
                    <strong className="font-mono-num text-[#141816]">
                      {deleteTarget.totalCount}
                    </strong>{' '}
                    item ({deleteTarget.activeItems.length} aktif
                    {deleteTarget.archivedItems.length > 0
                      ? `, ${deleteTarget.archivedItems.length} arsip`
                      : ''}
                    {deleteTarget.itemsWithHistoryCount > 0
                      ? `, ${deleteTarget.itemsWithHistoryCount} berhistori`
                      : ''}
                    ):
                  </p>
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-[#e5e5df] bg-[#fafaf8] px-3 py-2 text-xs text-[#565e59]">
                    {deleteTarget.items.map((i) => i.nama).join(', ')}
                  </div>
                  <p className="text-xs text-[#7c8580]">
                    Pindahkan satuan item-item tersebut ke satuan lain terlebih dahulu, atau gunakan
                    Edit untuk mengubah label satuan langsung.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#e5e5df] bg-[#fafaf8] px-5 py-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-8.5 rounded-md border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#565e59] hover:bg-[#f3f3ee] cursor-pointer"
              >
                Tutup
              </button>
              {deleteTarget.canDelete ? (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-[#b91c1c] px-4 text-xs font-medium text-white hover:bg-[#991b1b] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Ya, Hapus</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => jumpToItemsWithUnit(deleteTarget.unit)}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-md bg-[#14533c] px-4 text-xs font-medium text-white hover:bg-[#0f3f2d] cursor-pointer"
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
