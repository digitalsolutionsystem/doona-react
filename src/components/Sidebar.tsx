import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
    label: 'Menu Utama',
    items: [
      { id: 'home', label: 'Beranda', icon: Home },
      { id: 'in', label: 'Input Harian', icon: PenLine },
      { id: 'tb', label: 'Tabel Bulanan', icon: Table2 },
    ],
  },
  {
    label: 'Keuangan',
    items: [{ id: 'om', label: 'OMSET', icon: Wallet }],
  },
  {
    label: 'Karyawan',
    items: [{ id: 'ab', label: 'Absensi & Gaji', icon: Users }],
  },
  {
    label: 'Manajemen',
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

  const navSectionRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Partial<Record<MenuId, HTMLButtonElement | null>>>({});
  const [indStyle, setIndStyle] = useState<{ top: number; height: number; visible: boolean }>({
    top: 0,
    height: 38,
    visible: false,
  });
  const [noAnim, setNoAnim] = useState(true);
  const [avatarErr, setAvatarErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  const userPhoto = photoUrl(user?.foto);
  useEffect(() => {
    setAvatarErr(false);
  }, [userPhoto]);

  const recalcIndicator = (instant = false) => {
    const btn = btnRefs.current[activeMenu];
    if (!btn) {
      setIndStyle((prev) => ({ ...prev, visible: false }));
      return;
    }
    if (instant) setNoAnim(true);
    setIndStyle({
      top: btn.offsetTop,
      height: btn.offsetHeight,
      visible: true,
    });
    if (instant) {
      requestAnimationFrame(() => setNoAnim(false));
    }
  };

  useLayoutEffect(() => {
    recalcIndicator(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMenu]);

  useEffect(() => {
    const timer = window.setTimeout(() => recalcIndicator(true), 260);
    const onResize = () => recalcIndicator(true);
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, activeMenu]);

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
      {/* Mobile Header Trigger Bar (hanya tampil < 900px) */}
      <div className="no-print md:hidden sticky top-0 z-40 flex items-center justify-between gap-3 bg-[#111111] px-4 py-2.5 text-white border-b border-[#2c2c2c]">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Buka menu navigasi"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#262626] text-white hover:bg-[#333]"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold tracking-wide truncate">DOONA GOLF</span>
          <span className="text-xs text-[#b5b5b5] whitespace-nowrap">· {roleLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('db')}
          title="Status Koneksi Database"
          className="flex h-10 items-center gap-1.5 rounded-lg bg-[#262626] px-2.5 text-xs font-medium text-[#e2e8f0]"
        >
          <Database className="h-3.5 w-3.5 text-[#1a9e94]" />
          <span className="whitespace-nowrap">{dbConnected ? 'Cloud' : 'Lokal'}</span>
        </button>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-90 bg-slate-900/60 backdrop-blur-[2px] md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Desktop & Mobile Sidebar */}
      <aside
        id="sidebar"
        className={`dg-sidebar no-print ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
      >
        <div className="dg-sidebar-inner">
          {/* Brand / User Profile Header */}
          <div
            className={`relative flex border-b border-[#2c2c2c] min-h-[62px] ${
              collapsed
                ? 'flex-col items-start justify-start gap-2.5 px-0 pl-1.5 pt-3.5 pb-2.5'
                : 'items-center gap-2.5 py-3.5 pr-3 pl-1.5'
            }`}
          >
            <button
              type="button"
              onClick={() => handleSelectMenu('home')}
              title="Beranda"
              className="flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#1a9e94] text-lg font-bold text-white shadow-md cursor-pointer"
            >
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
            </button>

            {!collapsed && (
              <div className="flex-1 min-w-0">
                <strong className="block truncate text-[13px] font-bold tracking-wide text-white">
                  {displayName}
                </strong>
                <small className="block truncate text-[10.5px] tracking-wider text-[#b5b5b5]">
                  @{user?.username || 'lokal'} · {roleLabel}
                </small>
              </div>
            )}

            {/* Desktop collapse button */}
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? 'Tampilkan sidebar (F)' : 'Sembunyikan sidebar (F)'}
              className={`hidden md:flex shrink-0 items-center justify-center rounded-md text-[#b5b5b5] transition-colors hover:bg-[#262626] hover:text-white cursor-pointer ${
                collapsed ? 'ml-2.5 h-[26px] w-8 bg-[#262626] text-white' : 'h-7 w-7'
              }`}
            >
              <ChevronLeft
                className={`h-4 w-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Tutup menu"
              className="flex md:hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#b5b5b5] hover:bg-[#262626] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Groups */}
          <div ref={navSectionRef} className="dg-nav-section">
            <div
              className={`dg-nav-ind ${noAnim ? 'no-anim' : ''}`}
              style={{
                transform: `translateY(${indStyle.top}px)`,
                height: `${indStyle.height}px`,
                opacity: indStyle.visible ? 1 : 0,
              }}
            />

            {NAV_GROUPS.map((group, gIdx) => (
              <div key={group.label} className={gIdx > 0 ? 'mt-1' : ''}>
                {!collapsed && (
                  <div className="px-[18px] pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7d7d7d] whitespace-nowrap">
                    {group.label}
                  </div>
                )}
                <nav>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeMenu === item.id;
                    return (
                      <button
                        key={item.id}
                        ref={(el) => {
                          btnRefs.current[item.id] = el;
                        }}
                        type="button"
                        onClick={() => handleSelectMenu(item.id)}
                        title={item.label}
                        className={`relative z-1 mx-2 mb-1 flex w-[calc(100%-16px)] items-center gap-2.5 rounded-[9px] text-left text-[13px] whitespace-nowrap overflow-hidden transition-colors cursor-pointer ${
                          collapsed ? 'py-2.5 pr-2.5 pl-4' : 'py-[9px] pr-2.5 pl-4'
                        } ${
                          isActive
                            ? 'bg-transparent font-semibold text-[#1f2a36]'
                            : 'bg-transparent font-medium text-[#b5b5b5] hover:bg-[#262626] hover:text-[#e2e8f0]'
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isActive ? 'text-[#1a9e94]' : 'text-current'
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

          {/* Sidebar Footer */}
          <div className="border-t border-[#2c2c2c] px-2 py-2.5">
            {!collapsed && (
              <div className="mb-2 flex items-center justify-between gap-1.5 px-1">
                <div
                  className={`truncate text-[11px] font-medium ${
                    sync.isError ? 'text-[#ef7f78]' : 'text-[#b5b5b5]'
                  }`}
                  title={sync.text}
                >
                  {sync.text}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSelectMenu('db')}
                    title={
                      dbConnected
                        ? 'Terhubung ke Google Sheets'
                        : 'Mode Lokal / Belum terhubung Cloud'
                    }
                    className="relative flex h-[26px] w-[26px] items-center justify-center rounded-md bg-white/10 text-[#d9d9d9] hover:bg-white/25 hover:text-white cursor-pointer"
                  >
                    <Database className="h-3.5 w-3.5" />
                    <span
                      className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ring-[1.5px] ring-[#2d363d] ${
                        dbConnected ? 'bg-[#2fb67c]' : 'bg-[#f0b429]'
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChangePwdModal(true)}
                    title="Ganti Password"
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-white/10 text-[#d9d9d9] hover:bg-white/25 hover:text-white cursor-pointer"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                  {dbMode === 'cloud_unauth' ? (
                    <button
                      type="button"
                      onClick={() => setShowLoginModal(true)}
                      title="Masuk Akun Cloud"
                      className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-[#1a9e94]/25 text-[#5eead4] hover:bg-[#1a9e94] hover:text-white cursor-pointer"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={logout}
                      title="Kunci / Keluar"
                      className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-white/10 text-[#d9d9d9] hover:bg-[#e5534b]/25 hover:text-[#e5534b] cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 rounded-[9px] bg-[#262626] px-2.5 py-2 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-[#3b4a56] text-[11px] font-bold text-white">
                {!logoErr ? (
                  <img
                    src={DOONA_LOGO_URL}
                    alt="DG"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoErr(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>DG</span>
                )}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-xs leading-tight text-[#e2e8f0]">
                    Doona Golf
                  </strong>
                  <small className="block truncate text-[11px] text-[#b5b5b5]">
                    Stok Manager
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
