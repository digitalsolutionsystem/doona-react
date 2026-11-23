import React, { useState } from 'react';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { FloatingAlerts } from './components/FloatingAlerts';
import { LoginModal } from './components/LoginModal';
import { Sidebar } from './components/Sidebar';
import { AppProvider, useApp } from './context/AppContext';
import { AbsensiGajiPage } from './pages/AbsensiGajiPage';
import { BerandaPage } from './pages/BerandaPage';
import { DatabasePage } from './pages/DatabasePage';
import { InputHarianPage } from './pages/InputHarianPage';
import { LaporanPage } from './pages/LaporanPage';
import { MasterItemPage } from './pages/MasterItemPage';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage';
import { OmsetPage } from './pages/OmsetPage';
import { SettingSatuanPage } from './pages/SettingSatuanPage';
import { StokAwalPage } from './pages/StokAwalPage';
import { TabelBulananPage } from './pages/TabelBulananPage';

const AppShell: React.FC = () => {
  const { activeMenu, isViewer } = useApp();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#eef3f1] text-[#13222b]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onOpenMobile={() => setMobileOpen(true)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={`dg-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <main className="dg-main">
          {activeMenu === 'home' ? (
            <BerandaPage />
          ) : activeMenu === 'in' ? (
            <InputHarianPage />
          ) : activeMenu === 'tb' ? (
            <TabelBulananPage />
          ) : activeMenu === 'om' ? (
            <OmsetPage />
          ) : activeMenu === 'ab' ? (
            <AbsensiGajiPage />
          ) : activeMenu === 'aw' ? (
            <StokAwalPage />
          ) : activeMenu === 'ms' ? (
            <MasterItemPage />
          ) : activeMenu === 'st' ? (
            <SettingSatuanPage />
          ) : activeMenu === 'lp' ? (
            <LaporanPage />
          ) : activeMenu === 'db' ? (
            <DatabasePage />
          ) : (
            <ModulePlaceholderPage menu={activeMenu} />
          )}
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
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
