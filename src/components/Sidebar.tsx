import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Database,
  FileText,
  Home,
  KeyRound,
  LogIn,
  LogOut,
  Menu,
  PenLine,
  Ruler,
  Settings,
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

export const SIDEBAR_MENU_ORDER: MenuId[] = [
  'home',
  'in',
  'tb',
  'om',
  'ab',
  'lp',
  'ms',
  'st',
  'pg',
];

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Menu Utama',
    items: [
      { id: 'home', label: 'Beranda', icon: Home },
      { id: 'in', label: 'Stok & Input', icon: PenLine },
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
      { id: 'ms', label: 'Master Item', icon: SlidersHorizontal },
      { id: 'st', label: 'Setting Satuan', icon: Ruler },
      { id: 'pg', label: 'Pengaturan', icon: Settings },
    ],
  },
];

const NOTCH_STROKE = '#6b7c90';
const NOTCH_CORNER_R = 20;
const NOTCH_LEFT_INSET = 10;

const ActiveNotchSvg: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const safeW = Math.max(width, 64);
  const safeH = Math.max(height, 40);
  const c = NOTCH_CORNER_R;
  const svgH = safeH + c * 2;
  const rx = safeW - 1;
  const topY = c + 1;
  const botY = c + safeH - 1;
  const leftR = (botY - topY) / 2;
  const curveStartX = Math.max(rx - c, NOTCH_LEFT_INSET + 1 + leftR);
  const leftArcEndX = Math.min(NOTCH_LEFT_INSET + 1 + leftR, curveStartX);

  const strokePath = [
    `M ${rx} 0`,
    `L ${rx} 1`,
    `A ${c} ${c} 0 0 1 ${curveStartX} ${topY}`,
    `L ${leftArcEndX} ${topY}`,
    `A ${leftR} ${leftR} 0 0 0 ${leftArcEndX} ${botY}`,
    `L ${curveStartX} ${botY}`,
    `A ${c} ${c} 0 0 1 ${rx} ${botY + c}`,
    `L ${rx} ${svgH}`,
  ].join(' ');

  const fillPath = `${strokePath} L ${safeW + 2} ${svgH} L ${safeW + 2} 0 Z`;

  return (
    <svg
      aria-hidden="true"
      width={safeW}
      height={svgH}
      viewBox={`0 0 ${safeW} ${svgH}`}
      className="pointer-events-none absolute -top-[20px] left-0 block overflow-visible"
    >
      <path d={fillPath} fill="var(--bg)" />
      <path
        d={strokePath}
        fill="none"
        stroke={NOTCH_STROKE}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
};

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
    showLoginModal,
    showChangePwdModal,
    setShowLoginModal,
    setShowChangePwdModal,
    logout,
  } = useApp();

  const [avatarErr, setAvatarErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);
  const [accountPopOpen, setAccountPopOpen] = useState(false);
  const accountPopRef = useRef<HTMLDivElement | null>(null);

  // Gliding curved cutout notch measurement state
  const navSectionRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Partial<Record<MenuId, HTMLButtonElement | null>>>({});
  const [notchPos, setNotchPos] = useState<{ top: number; height: number; width: number } | null>(
    null
  );
  const [notchAnimated, setNotchAnimated] = useState(false);

  const normalizedActiveMenu: MenuId =
    activeMenu === 'aw' ? 'in' : activeMenu === 'db' ? 'pg' : activeMenu;
  const showLabels = !collapsed || mobileOpen;

  const userPhoto = photoUrl(user?.foto);
  useEffect(() => {
    setAvatarErr(false);
  }, [userPhoto]);

  // Measure active button position & sidebar width inside scroll container
  const measureActiveNotch = useCallback(() => {
    const navEl = navSectionRef.current;
    const btnEl = buttonRefs.current[normalizedActiveMenu];
    if (!navEl || !btnEl) return;
    const navRect = navEl.getBoundingClientRect();
    const btnRect = btnEl.getBoundingClientRect();
    const top = Math.round(btnRect.top - navRect.top + navEl.scrollTop);
    const height = Math.round(btnRect.height);
    const width = Math.round(navEl.clientWidth);
    setNotchPos((prev) =>
      prev && prev.top === top && prev.height === height && prev.width === width
        ? prev
        : { top, height, width }
    );
  }, [normalizedActiveMenu]);

  useLayoutEffect(() => {
    measureActiveNotch();
    const btnEl = buttonRefs.current[normalizedActiveMenu];
    if (btnEl) {
      btnEl.scrollIntoView({ block: 'nearest', behavior: notchAnimated ? 'smooth' : 'auto' });
    }
    if (!notchAnimated) {
      const raf = window.requestAnimationFrame(() => setNotchAnimated(true));
      return () => window.cancelAnimationFrame(raf);
    }
  }, [measureActiveNotch, normalizedActiveMenu, showLabels, notchAnimated]);

  useEffect(() => {
    const navEl = navSectionRef.current;
    if (!navEl) return;
    const ro = new ResizeObserver(() => measureActiveNotch());
    ro.observe(navEl);
    window.addEventListener('resize', measureActiveNotch);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measureActiveNotch);
    };
  }, [measureActiveNotch]);

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

  // Global keyboard shortcuts:
  // - F: toggle normal (expanded) <-> minimalis (icon-only) on desktop, or drawer on mobile
  // - ArrowUp / ArrowDown: switch active menu smoothly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (showLoginModal || showChangePwdModal) return;

      // Skip shortcuts if a page modal dialog is open
      const openOverlay = document.querySelector(
        '.fixed.inset-0:not([data-sidebar-backdrop="true"])'
      );
      if (openOverlay) return;

      if (e.key === 'f' || e.key === 'F') {
        if (e.repeat) return;
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        if (window.innerWidth <= 900) {
          if (mobileOpen) onCloseMobile();
          else onOpenMobile();
        } else {
          setAccountPopOpen(false);
          onToggleCollapse();
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (e.shiftKey) return;
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        const curIdx = SIDEBAR_MENU_ORDER.indexOf(normalizedActiveMenu);
        const safeIdx = curIdx === -1 ? 0 : curIdx;
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const nextIdx =
          (safeIdx + delta + SIDEBAR_MENU_ORDER.length) % SIDEBAR_MENU_ORDER.length;
        const nextMenu = SIDEBAR_MENU_ORDER[nextIdx];
        if (nextMenu && nextMenu !== normalizedActiveMenu) {
          navigateTo(nextMenu);
          setAccountPopOpen(false);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    mobileOpen,
    navigateTo,
    normalizedActiveMenu,
    onCloseMobile,
    onOpenMobile,
    onToggleCollapse,
    showChangePwdModal,
    showLoginModal,
  ]);

  const displayName = user?.nama || user?.username || 'Pengguna';
  const initial = (displayName.trim().charAt(0) || '?').toUpperCase();
  const roleLabel = user?.role === 'viewer' ? 'Viewer' : 'Admin';
  const dbConnected = dbMode === 'gas' || dbMode === 'cloud_connected';

  const statusDotColor = sync.isError
    ? 'bg-[#ef4444]'
    : dbConnected
      ? 'bg-[#14a38b]'
      : 'bg-[#f59e0b]';

  const handleSelectMenu = (id: MenuId) => {
    navigateTo(id);
    setAccountPopOpen(false);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Header Bar (< 900px) */}
      <div className="no-print sticky top-0 z-40 flex h-13 items-center justify-between gap-3 border-b border-white/10 bg-[#101316] px-4 text-white shadow-sm md:hidden">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Buka menu navigasi"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#cbd5e1] transition hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => handleSelectMenu('home')}
          className="flex min-w-0 items-center gap-2 cursor-pointer"
        >
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-[#14a38b] text-[11px] font-bold text-white">
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
          className="flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-xs font-semibold text-white cursor-pointer"
        >
          <span className={`h-2 w-2 rounded-full ${statusDotColor}`} />
          <span className="whitespace-nowrap">{dbConnected ? 'Cloud' : 'Lokal'}</span>
        </button>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          data-sidebar-backdrop="true"
          className="fixed inset-0 z-90 bg-black/55 backdrop-blur-[1px] md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Flush Obsidian Sidebar with Smooth Gliding Curved Cutout Notch */}
      <aside
        id="sidebar"
        className={`dg-sidebar no-print ${collapsed ? 'collapsed' : ''} ${
          mobileOpen ? 'mobile-open' : ''
        }`}
      >
        {/* Expand/Collapse Toggle perched on top right edge */}
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleCollapse();
          }}
          title={collapsed ? 'Perluas sidebar (F)' : 'Mode minimalis ikon saja (F)'}
          aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar ke mode minimalis'}
          className="absolute top-[20px] -right-3.5 z-30 hidden h-7 w-7 items-center justify-center rounded-full border-2 border-[#6b7c90] bg-[#101316] text-[#e2e8f0] shadow-sm transition hover:bg-[#1c2228] hover:text-white outline-none focus:outline-none focus-visible:outline-none md:flex cursor-pointer"
        >
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
          />
        </button>

        <div className="dg-sidebar-inner">
          {/* Continuous 2px slate-gray vertical border rail along the right edge */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 bottom-0 z-[1] w-[2px] bg-[#6b7c90]"
          />

          {/* Brand Logo Header */}
          <div
            className={`relative z-[2] mr-[2px] flex h-[66px] shrink-0 items-center border-b border-white/[0.08] ${
              showLabels ? 'justify-between px-4' : 'justify-center px-2'
            }`}
          >
            <button
              type="button"
              onClick={() => handleSelectMenu('home')}
              title="DOONA GOLF – Beranda"
              className="flex min-w-0 items-center gap-3 text-left cursor-pointer"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#14a38b] text-xs font-extrabold text-white shadow-sm">
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
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#94a3b8] transition hover:bg-white/10 hover:text-white md:hidden cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Navigation Items with Smooth Gliding Active Cutout */}
          <div ref={navSectionRef} className="dg-nav-section">
            {notchPos && (
              <div
                aria-hidden="true"
                className={`dg-active-notch ${notchAnimated ? 'dg-notch-animated' : ''}`}
                style={{
                  transform: `translate3d(0, ${notchPos.top}px, 0)`,
                  height: `${notchPos.height}px`,
                }}
              >
                <ActiveNotchSvg width={notchPos.width} height={notchPos.height} />
              </div>
            )}

            {NAV_GROUPS.map((group, gIdx) => (
              <div
                key={group.label}
                className={`relative ${gIdx > 0 ? (showLabels ? 'mt-5' : 'mt-3') : ''}`}
              >
                {showLabels ? (
                  <div className="relative z-[1] px-5 pb-2 text-[10.5px] font-semibold tracking-[0.07em] text-[#7c8794] uppercase whitespace-nowrap">
                    {group.label}
                  </div>
                ) : (
                  gIdx > 0 && <div className="relative z-[1] mx-4 mb-3 border-t border-white/[0.08]" />
                )}

                <nav className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = normalizedActiveMenu === item.id;

                    return (
                      <div key={item.id} className="relative w-full">
                        <button
                          ref={(el) => {
                            buttonRefs.current[item.id] = el;
                          }}
                          type="button"
                          onClick={() => handleSelectMenu(item.id)}
                          title={`${item.label} (↑/↓)`}
                          aria-current={isActive ? 'page' : undefined}
                          className={`group relative z-[3] ml-2.5 flex h-[46px] items-center rounded-xl text-left text-[13.5px] whitespace-nowrap transition-colors duration-250 cursor-pointer ${
                            showLabels
                              ? 'w-[calc(100%-22px)] gap-3 pl-4 pr-3'
                              : 'w-[calc(100%-20px)] justify-center'
                          } ${
                            isActive
                              ? 'font-bold text-[#13222b]'
                              : 'font-medium text-[#c4ccd4] hover:bg-white/[0.07] hover:text-white'
                          }`}
                        >
                          <Icon
                            className={`h-[19px] w-[19px] shrink-0 transition-colors duration-250 ${
                              isActive
                                ? 'text-[#14a38b]'
                                : 'text-[#9aa5b1] group-hover:text-white'
                            }`}
                          />
                          {showLabels && <span className="truncate">{item.label}</span>}
                        </button>
                      </div>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          {/* Bottom User Avatar + Status */}
          <div
            ref={accountPopRef}
            className="relative z-[2] mr-[2px] shrink-0 border-t border-white/[0.08] px-3 pt-2.5 pb-4"
          >
            {showLabels ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleSelectMenu('db')}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11.5px] font-medium text-[#94a3b8] transition hover:bg-white/[0.07] hover:text-white cursor-pointer"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotColor}`} />
                  <span className="truncate">{sync.text}</span>
                </button>

                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="relative h-9 w-9 shrink-0">
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#1e252c] text-xs font-bold text-white ring-2 ring-white/15">
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
                        className={`absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-[#101316] ${statusDotColor}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-white">{displayName}</div>
                      <div className="truncate text-[11px] text-[#8a94a0]">{roleLabel}</div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setShowChangePwdModal(true)}
                      title="Ganti Password"
                      aria-label="Ganti Password"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#94a3b8] transition hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </button>
                    {dbMode === 'cloud_unauth' ? (
                      <button
                        type="button"
                        onClick={() => setShowLoginModal(true)}
                        title="Masuk Akun Cloud"
                        aria-label="Masuk Akun Cloud"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#14a38b] transition hover:bg-white/10 cursor-pointer"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={logout}
                        title="Keluar"
                        aria-label="Keluar"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#94a3b8] transition hover:bg-[#b91c1c] hover:text-white cursor-pointer"
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
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#1e252c] text-xs font-bold text-white ring-2 ring-white/15">
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
                    className={`absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-[#101316] ${statusDotColor}`}
                  />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Compact Account Popover when collapsed */}
        {!showLabels && accountPopOpen && (
          <div className="fixed bottom-4 left-[88px] z-50 w-56 overflow-hidden rounded-2xl border border-[#cfdcd7] bg-white p-2 shadow-[0_14px_36px_rgba(13,37,48,0.18)]">
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
                <Database className="h-3.5 w-3.5 text-[#14a38b]" />
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
