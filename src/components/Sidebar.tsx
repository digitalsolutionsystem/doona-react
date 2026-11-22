import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  Database,
  FileText,
  Home,
  KeyRound,
  LogIn,
  LogOut,
  Menu,
  Package,
  PenLine,
  Ruler,
  SlidersHorizontal,
  Table2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { DOONA_LOGO_URL } from '../constants/defaults';
import { useApp } from '../context/AppContext';
import { photoUrl } from '../services/api';
import type { MenuId } from '../types/app';

interface NavGroup {
  label: string;
  items: Array<{
    id: MenuId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operasional',
    items: [
      { id: 'home', label: 'Beranda', icon: Home },
      { id: 'in', label: 'Input Harian', icon: PenLine },
      { id: 'tb', label: 'Tabel Bulanan', icon: Table2 },
    ],
  },
  {
    label: 'Keuangan & SDM',
    items: [
      { id: 'om', label: 'OMSET', icon: Wallet },
      { id: 'ab', label: 'Absensi & Gaji', icon: Users },
    ],
  },
  {
    label: 'Inventori & Sistem',
    items: [
      { id: 'aw', label: 'Stok Awal', icon: Package },
      { id: 'ms', label: 'Master Item', icon: SlidersHorizontal },
      { id: 'st', label: 'Setting Satuan', icon: Ruler },
      { id: 'lp', label: 'Laporan & Ekspor', icon: FileText },
      { id: 'db', label: 'Koneksi Database', icon: Database },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  onOpenMobile,
}) => {
  const {
    activeMenu,
    navigateTo,
    user,
    dbMode,
    sync,
    setShowLoginModal,
    setShowChangePwdModal,
    logout,
  } = useApp();

  const [avatarErr, setAvatarErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  const userPhoto = photoUrl(user?.foto);
  useEffect(() => {
    setAvatarErr(false);
  }, [userPhoto]);

  // Keyboard shortcut F untuk toggle sidebar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      onToggleCollapse();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleCollapse]);

  const displayName = user?.nama || user?.username || 'Pengguna';
  const initial = (displayName.trim().charAt(0) || '?').toUpperCase();
  const roleLabel = user?.role === 'viewer' ? 'Viewer' : 'Admin';
  const dbConnected = dbMode === 'gas' || dbMode === 'cloud_connected';

  const handleSelectMenu = (id: MenuId) => {
    navigateTo(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Header Bar (< 900px) */}
      <div className="no-print sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[#202824] bg-[#111614] px-4 py-2.5 text-white md:hidden">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Buka menu navigasi"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-display truncate text-sm font-semibold tracking-tight text-white">
            Doona Golf
          </span>
          <span className="whitespace-nowrap text-xs text-[#96a09b]">· {roleLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('db')}
          title="Status Koneksi Database"
          className="flex h-9 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 text-xs font-medium text-[#d7deda]"
        >
          <Database className={`h-3.5 w-3.5 ${dbConnected ? 'text-[#4ade80]' : 'text-[#fbbf24]'}`} />
          <span className="whitespace-nowrap">{dbConnected ? 'Cloud' : 'Lokal'}</span>
        </button>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-90 bg-black/50 backdrop-blur-[1px] md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Desktop & Mobile Sidebar */}
      <aside
        id="sidebar"
        className={`dg-sidebar no-print ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
      >
        <div className="dg-sidebar-inner">
          {/* Brand Lockup Header */}
          <div
            className={`flex min-h-[60px] items-center border-b border-[#202824] ${
              collapsed ? 'flex-col justify-center gap-2 px-2 py-3' : 'justify-between gap-2 px-4 py-3'
            }`}
          >
            <button
              type="button"
              onClick={() => handleSelectMenu('home')}
              title="DOONA GOLF – Beranda"
              className={`flex min-w-0 items-center gap-2.5 text-left cursor-pointer ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/12 bg-[#14533c] text-xs font-bold text-white">
                {!logoErr ? (
                  <img
                    src={DOONA_LOGO_URL}
                    alt="Doona Golf"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoErr(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>DG</span>
                )}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <strong className="font-display block truncate text-[14.5px] font-semibold leading-tight text-white">
                    Doona Golf
                  </strong>
                  <span className="block truncate text-[11px] text-[#84908a]">
                    Operasional &amp; Stok
                  </span>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? 'Perluas sidebar (F)' : 'Ciutkan sidebar (F)'}
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#84908a] transition hover:bg-white/8 hover:text-white md:flex cursor-pointer"
            >
              <ChevronLeft
                className={`h-4 w-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
              />
            </button>

            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Tutup menu"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#84908a] hover:bg-white/8 hover:text-white md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Groups */}
          <div className="dg-nav-section">
            {NAV_GROUPS.map((group, gIdx) => (
              <div key={group.label} className={gIdx > 0 ? 'mt-4' : ''}>
                {!collapsed && (
                  <div className="px-4 pb-1.5 text-[11px] font-medium text-[#6c7872] whitespace-nowrap">
                    {group.label}
                  </div>
                )}
                {collapsed && gIdx > 0 && (
                  <div className="mx-3.5 mb-2 border-t border-[#202824]" />
                )}
                <nav className="space-y-0.5 px-2.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeMenu === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectMenu(item.id)}
                        title={item.label}
                        className={`group relative flex w-full items-center gap-2.5 rounded-md text-left text-[13px] whitespace-nowrap transition-colors cursor-pointer ${
                          collapsed ? 'justify-center px-0 py-2.5' : 'px-2.5 py-2'
                        } ${
                          isActive
                            ? 'bg-white/10 font-medium text-white'
                            : 'font-normal text-[#9aa5a0] hover:bg-white/[0.05] hover:text-[#e6ece9]'
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive
                              ? 'text-[#6ee7b7]'
                              : 'text-[#7b8882] group-hover:text-[#c7d1cc]'
                          }`}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          {/* Sidebar Footer: Account + Sync Status */}
          <div className="border-t border-[#202824] px-3 py-3">
            {!collapsed && (
              <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
                <button
                  type="button"
                  onClick={() => handleSelectMenu('db')}
                  title={
                    dbConnected
                      ? 'Terhubung ke Google Sheets'
                      : 'Mode Lokal / Belum terhubung Cloud'
                  }
                  className={`flex min-w-0 items-center gap-1.5 text-left text-[11px] font-medium transition hover:text-white cursor-pointer ${
                    sync.isError ? 'text-[#f87171]' : 'text-[#8c9892]'
                  }`}
                >
                  <Database
                    className={`h-3 w-3 shrink-0 ${
                      sync.isError
                        ? 'text-[#f87171]'
                        : dbConnected
                          ? 'text-[#4ade80]'
                          : 'text-[#fbbf24]'
                    }`}
                  />
                  <span className="truncate">{sync.text}</span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowChangePwdModal(true)}
                    title="Ganti Password"
                    className="flex h-6 w-6 items-center justify-center rounded text-[#8c9892] transition hover:bg-white/10 hover:text-white cursor-pointer"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                  {dbMode === 'cloud_unauth' ? (
                    <button
                      type="button"
                      onClick={() => setShowLoginModal(true)}
                      title="Masuk Akun Cloud"
                      className="flex h-6 w-6 items-center justify-center rounded text-[#6ee7b7] transition hover:bg-[#14533c] hover:text-white cursor-pointer"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={logout}
                      title="Kunci / Keluar"
                      className="flex h-6 w-6 items-center justify-center rounded text-[#8c9892] transition hover:bg-red-500/20 hover:text-[#fca5a5] cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div
              className={`flex items-center gap-2.5 rounded-md bg-white/[0.04] px-2 py-2 ${
                collapsed ? 'justify-center px-1' : ''
              }`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#14533c] text-[11px] font-semibold text-white">
                {userPhoto && !avatarErr ? (
                  <img
                    src={userPhoto}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarErr(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-xs font-medium text-[#edf2ef]">
                    {displayName}
                  </strong>
                  <span className="block truncate text-[11px] text-[#7c8882]">
                    @{user?.username || 'lokal'} · {roleLabel}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
