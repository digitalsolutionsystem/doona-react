import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
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
    label: 'Harian',
    items: [
      { id: 'home', label: 'Beranda', icon: Home },
      { id: 'in', label: 'Input Harian', icon: PenLine },
      { id: 'tb', label: 'Tabel Bulanan', icon: Table2 },
    ],
  },
  {
    label: 'Keuangan',
    items: [
      { id: 'om', label: 'OMSET', icon: Wallet },
      { id: 'ab', label: 'Absensi & Gaji', icon: Users },
      { id: 'lp', label: 'Laporan & Ekspor', icon: FileText },
    ],
  },
  {
    label: 'Pengaturan',
    items: [
      { id: 'aw', label: 'Stok Awal', icon: Package },
      { id: 'ms', label: 'Master Item', icon: SlidersHorizontal },
      { id: 'st', label: 'Setting Satuan', icon: Ruler },
      { id: 'db', label: 'Database', icon: Database },
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
  const [accountPopOpen, setAccountPopOpen] = useState(false);
  const accountPopRef = useRef<HTMLDivElement | null>(null);

  const userPhoto = photoUrl(user?.foto);
  useEffect(() => {
    setAvatarErr(false);
  }, [userPhoto]);

  // Close compact account popover on outside click or Escape
  useEffect(() => {
    if (!accountPopOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (accountPopRef.current && !accountPopRef.current.contains(e.target as Node)) {
        setAccountPopOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountPopOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountPopOpen]);

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
  const showLabels = !collapsed || mobileOpen;

  const statusDotColor = sync.isError
    ? 'bg-[#ef4444]'
    : dbConnected
      ? 'bg-[#2eb86b]'
      : 'bg-[#f59e0b]';

  const handleSelectMenu = (id: MenuId) => {
    navigateTo(id);
    setAccountPopOpen(false);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Header Bar (< 900px) */}
      <div className="no-print sticky top-0 z-40 flex h-13 items-center justify-between gap-3 bg-[#0d2530] px-4 text-white shadow-sm md:hidden">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Buka menu navigasi"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#d7e3e8] transition hover:bg-[#153644] hover:text-white cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => handleSelectMenu('home')}
          className="flex min-w-0 items-center gap-2 cursor-pointer"
        >
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-[#2eb86b] text-[11px] font-bold text-white">
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
          <span className="font-display truncate text-[15px] font-bold tracking-tight text-white">
            Doona Golf
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectMenu('db')}
          title="Status Koneksi Database"
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[#153644] px-2.5 text-xs font-semibold text-white cursor-pointer"
        >
          <span className={`h-2 w-2 rounded-full ${statusDotColor}`} />
          <span className="whitespace-nowrap">{dbConnected ? 'Cloud' : 'Lokal'}</span>
        </button>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-90 bg-[#0d2530]/45 backdrop-blur-[1px] md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Floating Rounded Deep-Teal Sidebar (Sample Style) */}
      <aside
        id="sidebar"
        className={`dg-sidebar no-print ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
      >
        {/* Signature Circular Expand/Collapse Toggle perched on the right edge */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? 'Perluas menu (F)' : 'Ciutkan menu (F)'}
          aria-label={collapsed ? 'Perluas menu' : 'Ciutkan menu'}
          className="absolute top-[46px] -right-3.5 z-30 hidden h-7 w-7 items-center justify-center rounded-full border-[3px] border-[#eef3f1] bg-[#0d2530] text-white shadow-sm transition hover:bg-[#173c4d] md:flex cursor-pointer"
        >
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
          />
        </button>

        <div className="dg-sidebar-inner">
          {/* Brand Logo Header */}
          <div
            className={`flex h-[68px] shrink-0 items-center ${
              showLabels ? 'justify-between px-4' : 'justify-center px-2'
            }`}
          >
            <button
              type="button"
              onClick={() => handleSelectMenu('home')}
              title="DOONA GOLF – Beranda"
              className="flex min-w-0 items-center gap-3 text-left cursor-pointer"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#2eb86b] text-xs font-extrabold text-white shadow-sm">
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
              {showLabels && (
                <span className="font-display truncate text-[16px] font-bold tracking-tight text-white whitespace-nowrap">
                  Doona Golf
                </span>
              )}
            </button>

            {mobileOpen && (
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Tutup menu"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#9ab3be] transition hover:bg-[#153644] hover:text-white md:hidden cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Navigation Items */}
          <div className="dg-nav-section">
            {NAV_GROUPS.map((group, gIdx) => (
              <div key={group.label} className={gIdx > 0 ? (showLabels ? 'mt-4' : 'mt-2.5') : ''}>
                {showLabels ? (
                  <div className="px-4 pb-1.5 text-[10.5px] font-semibold tracking-wider text-[#6f909e] uppercase whitespace-nowrap">
                    {group.label}
                  </div>
                ) : (
                  gIdx > 0 && <div className="mx-4 mb-2.5 border-t border-[#1c3d4d]" />
                )}

                <nav className={`space-y-1 ${showLabels ? 'px-3' : 'px-2.5'}`}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeMenu === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectMenu(item.id)}
                        title={item.label}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group flex w-full items-center gap-3 rounded-xl text-left text-[13.5px] whitespace-nowrap transition-colors cursor-pointer ${
                          showLabels ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'
                        } ${
                          isActive
                            ? showLabels
                              ? 'bg-[#2eb86b] font-semibold text-white'
                              : 'bg-[#153644] text-[#2eb86b]'
                            : 'font-medium text-[#c5d7df] hover:bg-[#153644] hover:text-white'
                        }`}
                      >
                        <Icon
                          className={`h-[19px] w-[19px] shrink-0 transition-colors ${
                            isActive
                              ? showLabels
                                ? 'text-white'
                                : 'text-[#2eb86b]'
                              : 'text-[#b2c9d3] group-hover:text-white'
                          }`}
                        />
                        {showLabels && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          {/* Bottom User Avatar + Status Ring (Sample Style) */}
          <div ref={accountPopRef} className="relative shrink-0 px-3 pt-2 pb-4">
            {showLabels ? (
              <div className="space-y-2 border-t border-[#1c3d4d] pt-3">
                <button
                  type="button"
                  onClick={() => handleSelectMenu('db')}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11.5px] font-medium text-[#9ab3be] transition hover:bg-[#153644] hover:text-white cursor-pointer"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotColor}`} />
                  <span className="truncate">{sync.text}</span>
                </button>

                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="relative h-9 w-9 shrink-0">
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#193d4d] text-xs font-bold text-white ring-2 ring-[#234d60]">
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
                      <span
                        className={`absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-[#0d2530] ${statusDotColor}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-white">{displayName}</div>
                      <div className="truncate text-[11px] text-[#8da8b4]">{roleLabel}</div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setShowChangePwdModal(true)}
                      title="Ganti Password"
                      aria-label="Ganti Password"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9ab3be] transition hover:bg-[#153644] hover:text-white cursor-pointer"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </button>
                    {dbMode === 'cloud_unauth' ? (
                      <button
                        type="button"
                        onClick={() => setShowLoginModal(true)}
                        title="Masuk Akun Cloud"
                        aria-label="Masuk Akun Cloud"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#2eb86b] transition hover:bg-[#153644] cursor-pointer"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={logout}
                        title="Keluar"
                        aria-label="Keluar"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9ab3be] transition hover:bg-[#b91c1c] hover:text-white cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setAccountPopOpen((v) => !v)}
                  title={`${displayName} · ${roleLabel}`}
                  aria-label="Menu akun"
                  className="relative h-10 w-10 rounded-full transition hover:scale-105 cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#193d4d] text-xs font-bold text-white ring-2 ring-[#265469]">
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
                  <span
                    className={`absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-[#0d2530] ${statusDotColor}`}
                  />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Compact Account Popover when collapsed */}
        {!showLabels && accountPopOpen && (
          <div className="fixed bottom-4 left-[92px] z-50 w-56 overflow-hidden rounded-2xl bg-white p-2 shadow-[0_14px_36px_rgba(13,37,48,0.18)]">
            <div className="border-b border-[#e2ebe7] px-3 py-2">
              <div className="truncate text-xs font-bold text-[#13222b]">{displayName}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#64748b]">
                <span className={`h-2 w-2 rounded-full ${statusDotColor}`} />
                <span className="truncate">{sync.text}</span>
              </div>
            </div>
            <div className="mt-1 space-y-0.5">
              <button
                type="button"
                onClick={() => handleSelectMenu('db')}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#334155] hover:bg-[#eef3f1] cursor-pointer"
              >
                <Database className="h-3.5 w-3.5 text-[#2eb86b]" />
                <span>Koneksi Database</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccountPopOpen(false);
                  setShowChangePwdModal(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#334155] hover:bg-[#eef3f1] cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5 text-[#64748b]" />
                <span>Ganti Password</span>
              </button>
              {dbMode === 'cloud_unauth' ? (
                <button
                  type="button"
                  onClick={() => {
                    setAccountPopOpen(false);
                    setShowLoginModal(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#14533c] hover:bg-[#e6f7ee] cursor-pointer"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Masuk Akun Cloud</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAccountPopOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#b91c1c] hover:bg-[#fee2e2] cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Keluar</span>
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
