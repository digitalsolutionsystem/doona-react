import React, { useRef, useState } from 'react';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { FloatingAlerts } from './components/FloatingAlerts';
import { LoginModal } from './components/LoginModal';
import { HeaderSlotProvider } from './components/PageHeader';
import { Sidebar, SIDEBAR_MENU_ORDER } from './components/Sidebar';
import { AppProvider, useApp } from './context/AppContext';
import { AbsensiGajiPage } from './pages/AbsensiGajiPage';
import { BerandaPage } from './pages/BerandaPage';
import { InputHarianPage } from './pages/InputHarianPage';
import { LaporanPage } from './pages/LaporanPage';
import { MasterItemPage } from './pages/MasterItemPage';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage';
import { OmsetPage } from './pages/OmsetPage';
import { PengaturanPage } from './pages/PengaturanPage';
import { SettingSatuanPage } from './pages/SettingSatuanPage';
import { TabelBulananPage } from './pages/TabelBulananPage';
import type { MenuId } from './types/app';

const AppShell: React.FC = () => {
  const { activeMenu, isViewer, isLocked, showLoginModal } = useApp();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerSlotEl, setHeaderSlotEl] = useState<HTMLElement | null>(null);

  const normalizedMenu: MenuId =
    activeMenu === 'aw' ? 'in' : activeMenu === 'db' ? 'pg' : activeMenu;
  const navTrackRef = useRef<{ menu: MenuId; dir: 'down' | 'up' }>({
    menu: normalizedMenu,
    dir: 'down',
  });

  if (navTrackRef.current.menu !== normalizedMenu) {
    const prevIdx = SIDEBAR_MENU_ORDER.indexOf(navTrackRef.current.menu);
    const nextIdx = SIDEBAR_MENU_ORDER.indexOf(normalizedMenu);
    let dir: 'down' | 'up' = 'down';
    if (prevIdx !== -1 && nextIdx !== -1) {
      const len = SIDEBAR_MENU_ORDER.length;
      if (prevIdx === len - 1 && nextIdx === 0) dir = 'down';
      else if (prevIdx === 0 && nextIdx === len - 1) dir = 'up';
      else dir = nextIdx > prevIdx ? 'down' : 'up';
    }
    navTrackRef.current = { menu: normalizedMenu, dir };
  }

  const navDirection = navTrackRef.current.dir;

  const contentClass = sidebarCollapsed ? 'dg-content sidebar-collapsed' : 'dg-content';

  if (isLocked && showLoginModal) {
    return <LoginModal />;
  }

  const renderActivePage = () => {
    if (normalizedMenu === 'home') return <BerandaPage />;
    if (normalizedMenu === 'in') return <InputHarianPage />;
    if (normalizedMenu === 'tb') return <TabelBulananPage />;
    if (normalizedMenu === 'om') return <OmsetPage />;
    if (normalizedMenu === 'ab') return <AbsensiGajiPage />;
    if (normalizedMenu === 'ms') return <MasterItemPage />;
    if (normalizedMenu === 'st') return <SettingSatuanPage />;
    if (normalizedMenu === 'lp') return <LaporanPage />;
    if (normalizedMenu === 'pg') return <PengaturanPage />;
    return <ModulePlaceholderPage menu={normalizedMenu} />;
  };

  return (
    <HeaderSlotProvider value={headerSlotEl}>
      <div className="min-h-screen bg-[var(--bg)] text-[#13222b]">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          mobileOpen={mobileOpen}
          onOpenMobile={() => setMobileOpen(true)}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className={contentClass}>
          {/* Persistent Stationary Top Header Frame (fixed size & position across all menus) */}
          <div className="dg-persistent-header-wrap no-print px-4 pt-3 pb-1 md:px-6">
            <header
              ref={setHeaderSlotEl}
              className="dg-persistent-header rounded-2xl bg-white px-4 py-2.5 shadow-[0_6px_22px_rgba(13,37,48,0.045)] md:px-5"
            />
          </div>

          <main className="dg-main">
            <div
              key={normalizedMenu}
              className={`dg-workspace-stage ${
                navDirection === 'up' ? 'dg-workspace-enter-up' : 'dg-workspace-enter-down'
              }`}
            >
              {renderActivePage()}
            </div>
          </main>
        </div>

        {isViewer && (
          <div className="no-print pointer-events-none fixed right-5 bottom-4 z-60 rounded-xl bg-[#0d2530] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(13,37,48,0.2)]">
            Mode hanya-baca (Viewer)
          </div>
        )}

        <FloatingAlerts />
        <LoginModal />
        <ChangePasswordModal />
      </div>
    </HeaderSlotProvider>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
