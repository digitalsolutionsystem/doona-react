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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f4f6f7] text-[#1f2a36]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onOpenMobile={() => setMobileOpen(true)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={`dg-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <main className="flex h-full max-h-full flex-1 flex-col overflow-hidden">
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
        <div className="no-print fixed right-4 bottom-3.5 z-60 rounded-full bg-[#0f172a] px-3.5 py-1.5 text-xs font-bold text-white shadow-md pointer-events-none">
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
