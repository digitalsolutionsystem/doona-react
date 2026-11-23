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
    <div className="dg-page">
      {/* STICKY FLOATING TOP HEADER */}
      <div className="dg-sticky-header no-print px-4 pt-3 pb-1 md:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-[0_6px_22px_rgba(13,37,48,0.045)] md:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[17px] font-bold tracking-[-0.015em] text-[#13222b]">
            Setting Satuan
          </h1>

          <div
            className="flex items-center gap-1 rounded-xl bg-[#f3f7f5] p-1"
            role="tablist"
            aria-label="Submenu Setting Satuan"
          >
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'item'}
              onClick={() => setSubTab('item')}
              className={`h-7 rounded-lg px-3 text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'item'
                  ? 'bg-[#2eb86b] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#13222b]'
              }`}
            >
              Satuan per Item
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'list'}
              onClick={() => setSubTab('list')}
              className={`h-7 rounded-lg px-3 text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === 'list'
                  ? 'bg-[#2eb86b] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#13222b]'
              }`}
            >
              Daftar Satuan <span className="font-mono-num opacity-85">({satuanList.length})</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigateTo('ms')}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Master Item</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#2eb86b]" />
          </button>
          {!isViewer && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{subTab === 'item' ? 'Tambah Satuan Kustom' : 'Tambah Satuan Baru'}</span>
            </button>
          )}
        </div>
        </header>
      </div>

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

      {/* CONTENT BODY */}
      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="space-y-4">
          <section className="overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
            {/* FILTER BAR */}
            <div className="no-print flex flex-wrap items-center justify-between gap-2.5 border-b border-[#edf2f0] px-4 py-3 md:px-5">
              {subTab === 'item' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#94a3b8]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari nama item, kategori…"
                      aria-label="Cari item"
                      className="h-8.5 w-56 rounded-xl bg-[#f3f7f5] pr-7 pl-8.5 text-xs text-[#13222b] placeholder:text-[#94a3b8] outline-none transition focus:bg-white focus:ring-2 focus:ring-[#2eb86b]"
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
                    value={unitFilter}
                    onChange={(e) => setUnitFilter(e.target.value)}
                    aria-label="Filter satuan"
                    className="h-8.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-medium text-[#13222b] outline-none focus:ring-2 focus:ring-[#2eb86b]"
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
                      className="text-xs font-semibold text-[#15803d] hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-xs text-[#64748b]">
                  Menampilkan{' '}
                  <strong className="font-mono-num text-[#13222b]">{satuanList.length}</strong>{' '}
                  satuan terdaftar · Satuan yang dipakai item dilindungi dari penghapusan
                </div>
              )}

              <span className="text-[11px] font-medium text-[#64748b]">
                Sinkron otomatis ke seluruh modul stok
              </span>
            </div>

            {subTab === 'item' && (
              <div className="dg-scroll overflow-x-auto">
                {totalFilteredItems === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3f7f5] text-[#64748b]">
                      <Package className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-[#13222b]">
                      Tidak ada item yang cocok dengan filter saat ini.
                    </p>
                    {(searchQuery || unitFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setUnitFilter('all');
                        }}
                        className="mt-3 h-8.5 rounded-xl bg-[#f3f7f5] px-4 text-xs font-semibold text-[#13222b] hover:bg-[#e6f7ee] hover:text-[#15803d] cursor-pointer"
                      >
                        Reset filter
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left text-[13px]">
                    <thead className="border-b border-[#edf2f0] bg-[#f7faf9] text-[11px] font-bold uppercase tracking-[0.04em] text-[#64748b]">
                      <tr>
                        <th className="px-5 py-3">Nama Item</th>
                        <th className="px-3 py-3">Kategori</th>
                        <th className="px-3 py-3">Satuan Aktif</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2f0]">
                      {groupedItems.map(([cat, items]) => (
                        <React.Fragment key={cat}>
                          <tr className="bg-[#f3f7f5]/80">
                            <td
                              colSpan={4}
                              className="px-5 py-2 text-[11px] font-bold uppercase tracking-[0.04em] text-[#13222b]"
                            >
                              {cat}{' '}
                              <span className="font-mono-num font-semibold text-[#64748b]">
                                · {items.length}
                              </span>
                            </td>
                          </tr>
                          {items.map((item) => {
                            const isCustomSat = Boolean(item.sat && !satuanList.includes(item.sat));
                            return (
                              <tr
                                key={item.id}
                                className={`transition-colors hover:bg-[#f7faf9] ${
                                  item.aktif ? '' : 'opacity-65'
                                }`}
                              >
                                <td className="px-5 py-3">
                                  <div className="font-semibold text-[#13222b]">{item.nama}</div>
                                  <div className="font-mono-num text-[11px] text-[#64748b]">
                                    {item.id}
                                  </div>
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  <span className="rounded-lg bg-[#f3f7f5] px-2.5 py-1 text-xs font-medium text-[#475569]">
                                    {item.kat}
                                  </span>
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  {isViewer ? (
                                    <span className="font-semibold text-[#13222b]">
                                      {item.sat || 'pcs'}
                                    </span>
                                  ) : (
                                    <select
                                      value={item.sat || 'pcs'}
                                      onChange={(e) => handleChangeItemSat(item, e.target.value)}
                                      aria-label={`Satuan untuk ${item.nama}`}
                                      className="h-8 w-40 rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-2.5 text-xs font-semibold text-[#13222b] outline-none focus:border-[#2eb86b] focus:bg-white"
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
                                <td className="px-5 py-3 whitespace-nowrap">
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
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {subTab === 'list' && (
              <div className="dg-scroll overflow-x-auto">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead className="border-b border-[#edf2f0] bg-[#f7faf9] text-[11px] font-bold uppercase tracking-[0.04em] text-[#64748b]">
                    <tr>
                      <th className="w-14 px-5 py-3">No</th>
                      <th className="px-3 py-3">Nama Satuan</th>
                      <th className="px-3 py-3">Penggunaan Item</th>
                      <th className="px-5 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf2f0]">
                    {unitInfos.map((info, idx) => (
                      <tr key={info.unit} className="transition-colors hover:bg-[#f7faf9]">
                        <td className="font-mono-num px-5 py-3 text-xs text-[#64748b]">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#13222b]">{info.unit}</span>
                            <span
                              className={`rounded-lg px-2 py-0.5 text-[10.5px] font-semibold ${
                                info.isDefault
                                  ? 'bg-[#f3f7f5] text-[#64748b]'
                                  : 'bg-[#e6f7ee] text-[#15803d]'
                              }`}
                            >
                              {info.isDefault ? 'Bawaan' : 'Kustom'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {info.totalCount > 0 ? (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                              <button
                                type="button"
                                onClick={() => setInspectUnit(info.unit)}
                                className="font-mono-num font-bold text-[#15803d] hover:underline cursor-pointer"
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
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {info.totalCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setInspectUnit(info.unit)}
                                className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#e1ebe7] hover:text-[#13222b] cursor-pointer"
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
                                  className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
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
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-xl transition cursor-pointer ${
                                    info.canDelete
                                      ? 'bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fecaca]'
                                      : 'bg-[#f3f7f5] text-[#94a3b8] hover:text-[#475569]'
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
              </div>
            )}
          </section>

          {subTab === 'list' && orphanUnits.length > 0 && (
            <div className="rounded-2xl bg-[#fffbeb] p-4 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex items-center gap-2 text-xs font-bold text-[#b45309]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Satuan Kustom pada Item Belum Terdaftar ({orphanUnits.length})</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {orphanUnits.map((o) => (
                  <div
                    key={o.unit}
                    className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs shadow-xs"
                  >
                    <span className="font-semibold text-[#13222b]">{o.unit}</span>
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
                        className="font-bold text-[#15803d] hover:underline cursor-pointer"
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
      </div>

      {/* MODAL: TAMBAH SATUAN */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAddModalOpen(false);
          }}
        >
          <div className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="flex items-start justify-between border-b border-[#edf2f0] px-6 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#13222b]">
                  Tambah Satuan Baru
                </h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  Satuan akan otomatis tersedia di seluruh modul stok
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

            <form onSubmit={handleSubmitAdd}>
              <div className="space-y-3.5 px-6 py-5">
                {addError && (
                  <div className="rounded-xl bg-[#fee2e2] px-3.5 py-2.5 text-xs font-semibold text-[#b91c1c]">
                    {addError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                    Nama Satuan <span className="text-[#ef4444]">*</span>
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
                    className="h-9.5 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3.5 text-sm text-[#13222b] outline-none focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
                  />
                  <p className="mt-1.5 text-[11px] text-[#64748b]">
                    Nama satuan otomatis diseragamkan ke huruf kecil dan dicek agar tidak duplikat.
                  </p>
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
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white hover:bg-[#259f5b] cursor-pointer"
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
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRenameTarget(null);
          }}
        >
          <div className="w-full max-w-[430px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="flex items-start justify-between border-b border-[#edf2f0] px-6 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#13222b]">
                  Edit Nama Satuan
                </h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  Satuan saat ini: <strong className="text-[#13222b]">{renameTarget.unit}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRename}>
              <div className="space-y-3.5 px-6 py-5">
                {renameError && (
                  <div className="rounded-xl bg-[#fee2e2] px-3.5 py-2.5 text-xs font-semibold text-[#b91c1c]">
                    {renameError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                    Nama Satuan Baru <span className="text-[#ef4444]">*</span>
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
                    className="h-9.5 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3.5 text-sm text-[#13222b] outline-none focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
                  />
                </div>

                {renameTarget.totalCount > 0 && (
                  <div className="rounded-xl bg-[#f3f7f5] px-3.5 py-2.5 text-xs leading-relaxed text-[#475569]">
                    Label satuan pada{' '}
                    <strong className="text-[#13222b]">{renameTarget.totalCount} item</strong> akan
                    ikut diperbarui secara konsisten. Angka stok dan histori transaksi tidak
                    dikonversi.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-6 py-3.5">
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
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

      {/* MODAL: DAFTAR ITEM PENGGUNA SATUAN */}
      {inspectInfo && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectUnit(null);
          }}
        >
          <div className="w-full max-w-[480px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="flex items-start justify-between border-b border-[#edf2f0] px-6 py-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#13222b]">
                  Item dengan Satuan &ldquo;{inspectInfo.unit}&rdquo;
                </h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  {inspectInfo.totalCount} item · {inspectInfo.activeItems.length} aktif ·{' '}
                  {inspectInfo.archivedItems.length} arsip
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectUnit(null)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="dg-scroll max-h-[55vh] divide-y divide-[#edf2f0] overflow-y-auto px-6 py-1">
              {inspectInfo.items.length === 0 ? (
                <p className="py-8 text-center text-xs text-[#64748b]">
                  Tidak ada item yang menggunakan satuan ini.
                </p>
              ) : (
                inspectInfo.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[#13222b]">{item.nama}</div>
                      <div className="text-xs text-[#64748b]">
                        {item.kat} · <span className="font-mono-num">{item.id}</span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${
                        item.aktif
                          ? 'bg-[#e6f7ee] text-[#15803d]'
                          : 'bg-[#f1f5f9] text-[#64748b]'
                      }`}
                    >
                      {item.aktif ? 'Aktif' : 'Arsip'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-6 py-3.5">
              <button
                type="button"
                onClick={() => jumpToItemsWithUnit(inspectInfo.unit)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#e6f7ee] px-3.5 text-xs font-semibold text-[#15803d] hover:bg-[#d1f2e0] cursor-pointer"
              >
                <span>Ubah di Satuan per Item</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setInspectUnit(null)}
                className="h-9 rounded-xl bg-[#eef3f1] px-4 text-xs font-semibold text-[#13222b] hover:bg-[#e1ebe7] cursor-pointer"
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
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="w-full max-w-[440px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
            <div className="border-b border-[#edf2f0] px-6 py-4">
              <h3 className="font-display text-base font-bold text-[#13222b]">
                {deleteTarget.canDelete
                  ? `Hapus Satuan "${deleteTarget.unit}"`
                  : `Satuan "${deleteTarget.unit}" Sedang Digunakan`}
              </h3>
              <p className="mt-0.5 text-xs text-[#64748b]">
                {deleteTarget.canDelete
                  ? 'Tidak ada item yang memakai satuan ini'
                  : `${deleteTarget.totalCount} item masih merujuk ke satuan ini`}
              </p>
            </div>

            <div className="px-6 py-5">
              {deleteTarget.canDelete ? (
                <p className="text-[13px] leading-relaxed text-[#475569]">
                  Hapus satuan <strong className="text-[#13222b]">{deleteTarget.unit}</strong> dari
                  daftar pilihan satuan? Anda dapat menambahkannya kembali kapan saja.
                </p>
              ) : (
                <div className="space-y-2.5 text-[13px] leading-relaxed text-[#475569]">
                  <p>
                    Satuan <strong className="text-[#13222b]">{deleteTarget.unit}</strong> tidak
                    dapat dihapus karena masih digunakan oleh{' '}
                    <strong className="font-mono-num text-[#13222b]">
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
                  <div className="max-h-32 overflow-y-auto rounded-xl bg-[#f3f7f5] px-3.5 py-2.5 text-xs text-[#475569]">
                    {deleteTarget.items.map((i) => i.nama).join(', ')}
                  </div>
                  <p className="text-xs text-[#64748b]">
                    Pindahkan satuan item-item tersebut ke satuan lain terlebih dahulu, atau gunakan
                    Edit untuk mengubah label satuan langsung.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-6 py-3.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-9 rounded-xl bg-[#eef3f1] px-4 text-xs font-semibold text-[#13222b] hover:bg-[#e1ebe7] cursor-pointer"
              >
                Tutup
              </button>
              {deleteTarget.canDelete ? (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#ef4444] px-4 text-xs font-semibold text-white hover:bg-[#dc2626] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Ya, Hapus</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => jumpToItemsWithUnit(deleteTarget.unit)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white hover:bg-[#259f5b] cursor-pointer"
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
