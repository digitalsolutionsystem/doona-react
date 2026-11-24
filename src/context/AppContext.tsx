import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SATUAN, normalizeAppData } from '../constants/defaults';
import {
  getActiveEmployees,
  getArchivedEmployees,
  getCurrentTimeHHMM,
  getEmployees,
  getShiftPresets,
  getShiftScheduleConfig,
  writeStoredShiftConfig,
} from '../domain/attendanceCalculations';
import { formatDateKey, getDaysInMonth, getTodayParts, shiftDay, shiftMonth } from '../domain/dateUtils';
import {
  getOmsetClosing,
  getOmsetPeriodStats,
  getPeriodOfDay,
} from '../domain/omsetCalculations';
import {
  getActiveItems,
  getItemTransactionStats,
  getLastClosing,
  getSatuanList,
  getUnitUsageInfo,
  parseStockInput,
} from '../domain/stockCalculations';
import {
  getReportItemConfig,
  summarizeAppData,
  validateBackupPayload,
  type BackupDataSummary,
} from '../domain/reportCalculations';
import {
  apiService,
  clearSessionStorage,
  computeDataFingerprint,
  getStoredToken,
  getStoredUser,
  readLocalCache,
  readPreRestoreBackup,
  readSyncMeta,
  setStoredToken,
  setStoredUser,
  writeLocalCache,
  writePreRestoreBackup,
  writeSyncMeta,
  type PreRestoreBackupSnapshot,
  type SyncMetadata,
} from '../services/api';
import type {
  AbsensiSubTab,
  AppData,
  AttendanceDraftMap,
  AttendanceRecord,
  AttendanceShift,
  AttendanceStatus,
  DbConnectionMode,
  Employee,
  InputHarianTab,
  MasterItem,
  MenuId,
  NavigationOptions,
  OmsetDayRecord,
  OmsetSubTab,
  PayrollCycle,
  PengaturanSubTab,
  ShiftScheduleConfig,
  SqliteDatabaseInfo,
  UserProfile,
} from '../types/app';

export interface SaveEmployeeInput {
  id?: string;
  nama: string;
  foto?: string;
  jabatan?: string;
  shiftDefault?: AttendanceShift;
  gajiHarian: number;
  lemburPerPaket: number;
  siklusGaji: '14hari' | 'bulanan';
  applyRetroactive?: boolean;
}

export interface AddMasterItemInput {
  nama: string;
  kat: string;
  sat: string;
  min: number;
}

export interface UpdateMasterItemPatch {
  nama?: string;
  kat?: string;
  sat?: string;
  min?: number;
}

interface SyncIndicator {
  text: string;
  isError: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
}

export interface SyncConflictInfo {
  reason: 'pull_with_unsynced_local' | 'push_cloud_changed' | 'cloud_empty';
  message: string;
  localData: AppData;
  cloudData: AppData | null;
  localSummary: BackupDataSummary;
  cloudSummary: BackupDataSummary | null;
  detectedAt: string;
}

export interface SyncCheckResult {
  ok: boolean;
  status:
    | 'in_sync'
    | 'pulled'
    | 'pushed'
    | 'conflict'
    | 'unconfigured'
    | 'auth_expired'
    | 'readonly'
    | 'error';
  message: string;
}

interface AppContextValue {
  state: AppData;
  activeMenu: MenuId;
  ym: string;
  day: number;
  curYm: string;
  nowDay: number;
  inputTab: InputHarianTab;
  setInputTab: (t: InputHarianTab) => void;
  omSub: OmsetSubTab;
  setOmSub: (s: OmsetSubTab) => void;
  omPeriod: 0 | 1 | 2;
  setOmPeriod: (p: 0 | 1 | 2) => void;
  abSub: AbsensiSubTab;
  setAbSub: (s: AbsensiSubTab) => void;
  abCycle: PayrollCycle;
  setAbCycle: (c: PayrollCycle) => void;
  pgSub: PengaturanSubTab;
  setPgSub: (s: PengaturanSubTab) => void;
  absDraft: AttendanceDraftMap;
  setAbsDraft: React.Dispatch<React.SetStateAction<AttendanceDraftMap>>;
  hasAbsDraft: boolean;
  absSaving: boolean;
  absUnsent: boolean;
  absSaveError: string | null;
  hasUnsavedIn: boolean;
  hasUnsavedAwal: boolean;
  hasUnsavedOmset: boolean;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isViewer: boolean;
  isLocked: boolean;
  dbMode: DbConnectionMode;
  sqliteAvailable: boolean;
  sqliteChecking: boolean;
  sqliteNeedsSetup: boolean;
  sqliteEnvManaged: boolean;
  sqliteInfo: SqliteDatabaseInfo | null;
  sync: SyncIndicator;
  syncMeta: SyncMetadata;
  syncConflict: SyncConflictInfo | null;
  showLoginModal: boolean;
  setShowLoginModal: (v: boolean) => void;
  showChangePwdModal: boolean;
  setShowChangePwdModal: (v: boolean) => void;
  navigateTo: (menu: MenuId, opts?: NavigationOptions) => void;
  moveMonth: (delta: number) => void;
  moveDay: (delta: number) => void;
  selectDateStr: (isoDate: string) => void;
  setMonthAndDay: (ym: string, day: number) => void;
  goToday: () => void;
  updateState: (updater: (prev: AppData) => AppData, immediateSave?: boolean) => void;
  setStockCell: (
    targetYm: string,
    type: 'a' | 'd' | 'c',
    targetDay: number,
    itemId: string,
    rawValue: string | number
  ) => void;
  saveInputHarianNow: () => Promise<boolean>;
  saveStokAwalNow: () => Promise<boolean>;
  importStokAwalFromPrevMonth: (
    targetYm: string,
    mode?: 'all' | 'empty_only'
  ) => Promise<{
    ok: boolean;
    importedCount: number;
    prevYm: string;
    hadPrevData: boolean;
    savedToDb: boolean;
  }>;
  updateOmsetDay: (
    targetYm: string,
    targetDay: number,
    updater: (prev: OmsetDayRecord) => OmsetDayRecord
  ) => boolean;
  saveOmsetNow: () => Promise<boolean>;
  closeOmsetPeriod: (targetYm: string, period: 1 | 2) => Promise<boolean>;
  reopenOmsetPeriod: (targetYm: string, period: 1 | 2) => Promise<boolean>;
  setAttendanceDraftStatus: (
    targetYm: string,
    targetDay: number,
    empId: string,
    status: AttendanceStatus
  ) => void;
  updateAttendanceDraft: (
    targetYm: string,
    targetDay: number,
    empId: string,
    patch: Partial<AttendanceRecord>
  ) => void;
  clockInEmployee: (targetYm: string, targetDay: number, empId: string) => void;
  clockOutEmployee: (targetYm: string, targetDay: number, empId: string) => void;
  resetAttendanceDraftDay: (targetYm: string, targetDay: number) => void;
  setAttendanceDraftLembur: (
    targetYm: string,
    targetDay: number,
    empId: string,
    lembur: number
  ) => void;
  adjustAttendanceDraftLembur: (
    targetYm: string,
    targetDay: number,
    empId: string,
    delta: number
  ) => void;
  setAllAttendanceHadir: (
    targetYm: string,
    targetDay: number,
    options?: { onlyUnrecorded?: boolean; withScheduledTimes?: boolean }
  ) => void;
  saveSingleAttendanceRow: (
    targetYm: string,
    targetDay: number,
    empId: string
  ) => Promise<{ ok: boolean; error?: string }>;
  saveAttendanceDay: (
    targetYm: string,
    targetDay: number
  ) => Promise<{ ok: boolean; error?: string }>;
  saveEmployee: (input: SaveEmployeeInput) => { ok: boolean; error?: string };
  updateShiftConfig: (config: ShiftScheduleConfig) => void;
  toggleEmployeeActive: (empId: string) => void;
  archiveEmployee: (empId: string) => void;
  restoreArchivedEmployee: (empId: string) => void;
  addMasterItem: (input: AddMasterItemInput) => { ok: boolean; error?: string; item?: MasterItem };
  updateMasterItem: (
    itemId: string,
    patch: UpdateMasterItemPatch
  ) => { ok: boolean; error?: string };
  toggleMasterItemActive: (itemId: string) => void;
  deleteMasterItem: (
    itemId: string
  ) => { ok: boolean; hasHistory?: boolean; error?: string };
  addSatuan: (name: string) => { ok: boolean; error?: string; unit?: string };
  renameSatuan: (oldName: string, newName: string) => { ok: boolean; error?: string; updatedItems?: number };
  deleteSatuan: (name: string) => { ok: boolean; inUse?: boolean; error?: string };
  preRestoreBackup: PreRestoreBackupSnapshot | null;
  setReportItemConfig: (itemId: string, field: 'sisa' | 'pakai', value: boolean) => void;
  setAllReportItemConfig: (field: 'sisa' | 'pakai' | 'both', value: boolean) => void;
  sendReportTelegram: (text: string) => Promise<{ ok: boolean; error?: string }>;
  restoreBackupData: (rawJson: string) => Promise<{
    ok: boolean;
    error?: string;
    savedToCloud?: boolean;
    preBackupJson?: string;
    preBackupFilename?: string;
    summary?: BackupDataSummary;
  }>;
  restoreFromPreRestoreBackup: () => Promise<{ ok: boolean; error?: string }>;
  saveNow: (overrideData?: AppData) => Promise<boolean>;
  reloadFromCloud: (options?: { forceOverwriteLocal?: boolean }) => Promise<void>;
  refreshSqliteInfo: () => Promise<SqliteDatabaseInfo | null>;
  checkAndSyncCloud: (intent: 'pull' | 'push' | 'retry') => Promise<SyncCheckResult>;
  resolveSyncConflict: (
    resolution: 'use_cloud' | 'use_local' | 'cancel'
  ) => Promise<{ ok: boolean; message: string }>;
  setupInitialAdmin: (
    username: string,
    nama: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginWithCredentials: (
    username: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string; connError?: boolean; needsSetup?: boolean }>;
  enterLocalMode: () => void;
  logout: () => void;
  changePassword: (
    curr: string,
    nextPwd: string
  ) => Promise<{ ok: boolean; message: string }>;
  vacuumSqliteDb: () => Promise<{ ok: boolean; message: string }>;
  downloadSqliteBackup: () => Promise<{ ok: boolean; message: string }>;
  restoreSqliteFile: (file: File) => Promise<{
    ok: boolean;
    error?: string;
    preBackupJson?: string;
    preBackupFilename?: string;
    summary?: BackupDataSummary;
  }>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const todayInit = useMemo(() => getTodayParts(), []);
  const [curYm] = useState(todayInit.ym);
  const [nowDay] = useState(todayInit.day);

  const [state, setState] = useState<AppData>(() => normalizeAppData(readLocalCache()));
  const [activeMenu, setActiveMenu] = useState<MenuId>('home');
  const [ym, setYm] = useState<string>(todayInit.ym);
  const [day, setDay] = useState<number>(todayInit.day);

  // Cross-module sub-navigation states
  const [inputTab, setInputTab] = useState<InputHarianTab>('closing');
  const [omSub, setOmSub] = useState<OmsetSubTab>('harian');
  const [omPeriod, setOmPeriod] = useState<0 | 1 | 2>(0);
  const [abSub, setAbSub] = useState<AbsensiSubTab>('harian');
  const [abCycle, setAbCycle] = useState<PayrollCycle>(todayInit.day <= 15 ? 'p1' : 'p2');
  const [pgSub, setPgSub] = useState<PengaturanSubTab>('uiux');
  const [absDraft, setAbsDraft] = useState<AttendanceDraftMap>({});
  const [absSaving, setAbsSaving] = useState<boolean>(false);
  const [absUnsent, setAbsUnsent] = useState<boolean>(false);
  const [absSaveError, setAbsSaveError] = useState<string | null>(null);
  const [hasUnsavedIn, setHasUnsavedIn] = useState<boolean>(false);
  const [hasUnsavedAwal, setHasUnsavedAwal] = useState<boolean>(false);
  const [hasUnsavedOmset, setHasUnsavedOmset] = useState<boolean>(false);

  // Auth & SQLite Database connection states (Bearer token kept strictly in JS memory)
  const [sqliteAvailable, setSqliteAvailable] = useState<boolean>(true);
  const [sqliteChecking, setSqliteChecking] = useState<boolean>(true);
  const [sqliteNeedsSetup, setSqliteNeedsSetup] = useState<boolean>(false);
  const [sqliteEnvManaged, setSqliteEnvManaged] = useState<boolean>(false);
  const [sqliteInfo, setSqliteInfo] = useState<SqliteDatabaseInfo | null>(null);

  const [user, setUser] = useState<UserProfile | null>(() => {
    const stored = getStoredUser();
    if (stored) return stored;
    return { username: 'lokal', nama: 'Mode Cache Browser', role: 'admin' };
  });
  const [hasCloudToken, setHasCloudToken] = useState<boolean>(() => Boolean(getStoredToken()));
  const [isLocked, setIsLocked] = useState<boolean>(() => !getStoredToken());
  const [showLoginModal, setShowLoginModal] = useState<boolean>(() => !getStoredToken());
  const [showChangePwdModal, setShowChangePwdModal] = useState<boolean>(false);
  const [preRestoreBackup, setPreRestoreBackup] = useState<PreRestoreBackupSnapshot | null>(() =>
    readPreRestoreBackup()
  );
  const [syncMeta, setSyncMeta] = useState<SyncMetadata>(() => readSyncMeta());
  const [syncConflict, setSyncConflict] = useState<SyncConflictInfo | null>(null);

  const [sync, setSync] = useState<SyncIndicator>({
    text: 'Menghubungkan SQLite…',
    isError: false,
    isSyncing: false,
    lastSyncAt: null,
  });

  const syncMetaRef = useRef(syncMeta);
  syncMetaRef.current = syncMeta;
  const updateSyncMeta = useCallback((patch: Partial<SyncMetadata>) => {
    const next = writeSyncMeta(patch);
    syncMetaRef.current = next;
    setSyncMeta(next);
    return next;
  }, []);

  const saveTimerRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const absDraftRef = useRef(absDraft);
  absDraftRef.current = absDraft;

  const hasAbsDraft = useMemo(
    () => Object.keys(absDraft).some((k) => Object.keys(absDraft[k] || {}).length > 0),
    [absDraft]
  );

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasAbsDraft || hasUnsavedIn || hasUnsavedOmset || hasUnsavedAwal) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasAbsDraft, hasUnsavedIn, hasUnsavedOmset, hasUnsavedAwal]);

  const dbMode: DbConnectionMode = useMemo(() => {
    if (!sqliteAvailable) return 'local';
    return hasCloudToken ? 'sqlite_connected' : 'sqlite_unauth';
  }, [sqliteAvailable, hasCloudToken]);

  const isViewer = useMemo(() => {
    if (dbMode === 'local' || dbMode === 'sqlite_unauth') return false;
    return Boolean(user && user.role && user.role !== 'admin');
  }, [dbMode, user]);

  const isAuthenticated = !isLocked;

  const handleAuthExpired = useCallback(() => {
    clearSessionStorage();
    setHasCloudToken(false);
    setSqliteInfo(null);
    setIsLocked(true);
    setShowLoginModal(true);
    setSync({
      text: 'Sesi berakhir — silakan login kembali',
      isError: true,
      isSyncing: false,
      lastSyncAt: null,
    });
  }, []);

  const refreshSqliteInfo = useCallback(async (): Promise<SqliteDatabaseInfo | null> => {
    if (!getStoredToken()) return null;
    const res = await apiService.getSqliteInfo();
    if (res.authExpired) {
      handleAuthExpired();
      return null;
    }
    if (res.ok && res.info) {
      setSqliteInfo(res.info);
      return res.info;
    }
    return null;
  }, [handleAuthExpired]);

  const saveNow = useCallback(
    async (overrideData?: AppData): Promise<boolean> => {
      const payload = overrideData ?? stateRef.current;
      if (isViewer) {
        setSync((prev) => ({
          ...prev,
          text: 'Akun viewer: hanya baca',
          isError: true,
          isSyncing: false,
        }));
        return false;
      }

      const nowIso = new Date().toISOString();
      updateSyncMeta({ lastLocalWriteAt: nowIso });
      setSync((prev) => ({ ...prev, text: 'Menyimpan ke SQLite…', isError: false, isSyncing: true }));

      const res = await apiService.save(payload, isViewer);
      if (res.authExpired) {
        updateSyncMeta({
          pendingLocalChanges: true,
          lastError: 'Sesi login berakhir saat menyimpan ke SQLite.',
        });
        handleAuthExpired();
        return false;
      }
      if (res.ok) {
        const fp = computeDataFingerprint(payload);
        if (res.mode === 'sqlite') {
          updateSyncMeta({
            lastCloudSyncAt: res.savedAt || nowIso,
            lastCloudFingerprint: fp,
            pendingLocalChanges: false,
            lastError: null,
          });
          void refreshSqliteInfo();
        } else {
          updateSyncMeta({
            pendingLocalChanges: sqliteAvailable,
            lastError: null,
          });
        }
        setSync({
          text: res.mode === 'sqlite' ? 'Tersimpan di SQLite' : 'Tersimpan di Cache Browser',
          isError: false,
          isSyncing: false,
          lastSyncAt: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
        return true;
      }

      const errMsg =
        res.mode === 'readonly'
          ? 'Akun hanya-baca: ditolak oleh otorisasi server.'
          : res.mode === 'offline'
            ? 'Server SQLite tidak terjangkau — perubahan aman di cache browser.'
            : res.error || 'Gagal menyimpan ke SQLite — perubahan aman di cache browser.';

      updateSyncMeta({
        pendingLocalChanges: res.mode !== 'readonly',
        lastError: errMsg,
      });

      setSync({
        text:
          res.mode === 'readonly'
            ? 'Akun hanya-baca: ditolak server'
            : res.mode === 'offline'
              ? 'Cache Browser (Server Offline)'
              : 'Gagal simpan ke SQLite',
        isError: true,
        isSyncing: false,
        lastSyncAt: null,
      });
      return false;
    },
    [sqliteAvailable, isViewer, handleAuthExpired, updateSyncMeta, refreshSqliteInfo]
  );

  const reloadFromCloud = useCallback(
    async (options?: { forceOverwriteLocal?: boolean }) => {
      if (!getStoredToken()) {
        setSync({
          text: sqliteAvailable ? 'SQLite Siap (Belum Login)' : 'Mode Cache Browser',
          isError: false,
          isSyncing: false,
          lastSyncAt: null,
        });
        return;
      }

      setSync((prev) => ({
        ...prev,
        text: 'Memuat data dari SQLite…',
        isError: false,
        isSyncing: true,
      }));

      const dbRes = await apiService.fetchCloudRaw();
      if (dbRes.authExpired) {
        handleAuthExpired();
        return;
      }

      const localNormalized = normalizeAppData(readLocalCache() || stateRef.current);

      if (dbRes.ok && dbRes.data && !dbRes.isEmptyCloud) {
        const sqliteNormalized = normalizeAppData(dbRes.data);
        const localFp = computeDataFingerprint(localNormalized);
        const sqliteFp = computeDataFingerprint(sqliteNormalized);

        if (
          !options?.forceOverwriteLocal &&
          syncMetaRef.current.pendingLocalChanges &&
          localFp !== sqliteFp
        ) {
          setSyncConflict({
            reason: 'pull_with_unsynced_local',
            message:
              'Terdapat perubahan cache browser yang belum tersimpan ke SQLite dan berbeda dengan isi file SQLite. Pilih sumber data yang ingin dipertahankan.',
            localData: localNormalized,
            cloudData: sqliteNormalized,
            localSummary: summarizeAppData(localNormalized),
            cloudSummary: summarizeAppData(sqliteNormalized),
            detectedAt: new Date().toISOString(),
          });
          setSync({
            text: 'Konflik data — perlu konfirmasi',
            isError: true,
            isSyncing: false,
            lastSyncAt: null,
          });
          return;
        }

        stateRef.current = sqliteNormalized;
        setState(sqliteNormalized);
        writeLocalCache(sqliteNormalized);
        setSyncConflict(null);

        const nowIso = new Date().toISOString();
        updateSyncMeta({
          lastCloudSyncAt: nowIso,
          lastCloudFingerprint: sqliteFp,
          pendingLocalChanges: false,
          lastError: null,
        });

        setSync({
          text: 'Tersimpan di SQLite',
          isError: false,
          isSyncing: false,
          lastSyncAt: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });

        const [profileRes] = await Promise.all([apiService.me(), refreshSqliteInfo()]);
        if (profileRes?.success && profileRes.user) {
          setUser(profileRes.user);
          setStoredUser(profileRes.user);
        }
        return;
      }

      // Database SQLite baru & masih kosong -> langsung seed dengan data awal/cache lokal
      if (dbRes.ok && dbRes.isEmptyCloud) {
        stateRef.current = localNormalized;
        setState(localNormalized);
        writeLocalCache(localNormalized);
        const seeded = await saveNow(localNormalized);
        await refreshSqliteInfo();
        if (!seeded) {
          setSync({
            text: 'SQLite kosong — gagal menyimpan data awal',
            isError: true,
            isSyncing: false,
            lastSyncAt: null,
          });
        }
        return;
      }

      setState(localNormalized);
      if (dbRes.error) {
        updateSyncMeta({ lastError: dbRes.error });
        setSync({
          text: 'Cache Browser (Gagal Muat SQLite)',
          isError: true,
          isSyncing: false,
          lastSyncAt: null,
        });
      }
    },
    [sqliteAvailable, handleAuthExpired, updateSyncMeta, refreshSqliteInfo, saveNow]
  );

  // Deteksi status backend SQLite lokal saat aplikasi dibuka
  useEffect(() => {
    let active = true;
    (async () => {
      setSqliteChecking(true);
      const health = await apiService.checkSqliteHealth();
      if (!active) return;
      if (health && health.ok) {
        setSqliteAvailable(true);
        setSqliteNeedsSetup(Boolean(health.needsSetup));
        setSqliteEnvManaged(Boolean(health.envPasswordManaged));
        setSync({
          text: health.needsSetup ? 'SQLite Baru · Setup Admin' : 'SQLite Siap (Belum Login)',
          isError: false,
          isSyncing: false,
          lastSyncAt: null,
        });
      } else {
        setSqliteAvailable(false);
        setSqliteNeedsSetup(false);
        setSqliteEnvManaged(false);
        setSync({
          text: 'Mode Cache Browser (SQLite Offline)',
          isError: false,
          isSyncing: false,
          lastSyncAt: null,
        });
      }
      setSqliteChecking(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const checkAndSyncCloud = useCallback(
    async (intent: 'pull' | 'push' | 'retry'): Promise<SyncCheckResult> => {
      if ((intent === 'push' || intent === 'retry') && isViewer) {
        return {
          ok: false,
          status: 'readonly',
          message: 'Akun Viewer hanya memiliki akses baca dan tidak dapat menulis ke SQLite.',
        };
      }

      if (!sqliteAvailable || !getStoredToken()) {
        return {
          ok: false,
          status: 'unconfigured',
          message: 'Login ke akun SQLite lokal terlebih dahulu untuk menyinkronkan data.',
        };
      }

      setSync((prev) => ({
        ...prev,
        text: 'Memeriksa database SQLite…',
        isError: false,
        isSyncing: true,
      }));

      const dbRes = await apiService.fetchCloudRaw();
      if (dbRes.authExpired) {
        handleAuthExpired();
        return {
          ok: false,
          status: 'auth_expired',
          message: 'Sesi login berakhir. Silakan masuk ulang.',
        };
      }
      if (!dbRes.ok) {
        const msg = dbRes.error || 'Tidak dapat menjangkau server SQLite lokal.';
        updateSyncMeta({ lastError: msg });
        setSync({
          text: 'Server SQLite tidak merespons',
          isError: true,
          isSyncing: false,
          lastSyncAt: null,
        });
        return { ok: false, status: 'error', message: msg };
      }

      const localData = stateRef.current;
      const localFp = computeDataFingerprint(localData);

      if (dbRes.isEmptyCloud || !dbRes.data) {
        if (intent === 'pull') {
          setSyncConflict({
            reason: 'cloud_empty',
            message:
              'Database SQLite saat ini masih kosong. Anda dapat menyimpan data lokal saat ini ke file SQLite.',
            localData,
            cloudData: null,
            localSummary: summarizeAppData(localData),
            cloudSummary: null,
            detectedAt: new Date().toISOString(),
          });
          setSync({
            text: 'Database SQLite masih kosong',
            isError: true,
            isSyncing: false,
            lastSyncAt: null,
          });
          return {
            ok: false,
            status: 'conflict',
            message: 'Database SQLite masih kosong — konfirmasi untuk menyimpan data saat ini.',
          };
        }

        const pushed = await saveNow(localData);
        return pushed
          ? {
              ok: true,
              status: 'pushed',
              message: 'Data operasional berhasil disimpan ke database SQLite.',
            }
          : {
              ok: false,
              status: 'error',
              message: 'Gagal menulis data ke database SQLite.',
            };
      }

      const sqliteData = normalizeAppData(dbRes.data);
      const sqliteFp = computeDataFingerprint(sqliteData);

      if (localFp === sqliteFp) {
        const nowIso = new Date().toISOString();
        setSyncConflict(null);
        updateSyncMeta({
          lastCloudSyncAt: nowIso,
          lastCloudFingerprint: sqliteFp,
          pendingLocalChanges: false,
          lastError: null,
        });
        await refreshSqliteInfo();
        setSync({
          text: 'Tersimpan di SQLite',
          isError: false,
          isSyncing: false,
          lastSyncAt: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
        return {
          ok: true,
          status: 'in_sync',
          message: 'Data layar dan file SQLite sudah identik (sinkron).',
        };
      }

      if (intent === 'pull') {
        if (syncMetaRef.current.pendingLocalChanges) {
          setSyncConflict({
            reason: 'pull_with_unsynced_local',
            message:
              'Ada perubahan cache browser yang belum ditulis ke SQLite. Pilih versi yang ingin digunakan.',
            localData,
            cloudData: sqliteData,
            localSummary: summarizeAppData(localData),
            cloudSummary: summarizeAppData(sqliteData),
            detectedAt: new Date().toISOString(),
          });
          setSync({
            text: 'Konflik data — perlu konfirmasi',
            isError: true,
            isSyncing: false,
            lastSyncAt: null,
          });
          return {
            ok: false,
            status: 'conflict',
            message: 'Terdeteksi perubahan belum tersimpan. Pilih sumber data.',
          };
        }

        const snap = writePreRestoreBackup(
          localData,
          'Cadangan otomatis sebelum memuat ulang dari SQLite'
        );
        if (snap) setPreRestoreBackup(snap);

        stateRef.current = sqliteData;
        setState(sqliteData);
        writeLocalCache(sqliteData);
        setSyncConflict(null);
        updateSyncMeta({
          lastCloudSyncAt: new Date().toISOString(),
          lastCloudFingerprint: sqliteFp,
          pendingLocalChanges: false,
          lastError: null,
        });
        await refreshSqliteInfo();
        setSync({
          text: 'Tersimpan di SQLite',
          isError: false,
          isSyncing: false,
          lastSyncAt: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
        return {
          ok: true,
          status: 'pulled',
          message: 'Data terbaru berhasil dimuat dari file SQLite.',
        };
      }

      const pushed = await saveNow(localData);
      return pushed
        ? {
            ok: true,
            status: 'pushed',
            message: 'Seluruh data berhasil disimpan ke file SQLite lokal.',
          }
        : {
            ok: false,
            status: 'error',
            message: 'Gagal menyimpan data ke file SQLite lokal.',
          };
    },
    [sqliteAvailable, isViewer, handleAuthExpired, saveNow, updateSyncMeta, refreshSqliteInfo]
  );

  const resolveSyncConflict = useCallback(
    async (
      resolution: 'use_cloud' | 'use_local' | 'cancel'
    ): Promise<{ ok: boolean; message: string }> => {
      if (resolution === 'cancel' || !syncConflict) {
        setSyncConflict(null);
        return { ok: true, message: 'Sinkronisasi dibatalkan. Tidak ada data yang diubah.' };
      }

      if (resolution === 'use_cloud') {
        if (!syncConflict.cloudData) {
          setSyncConflict(null);
          return {
            ok: false,
            message: 'File SQLite kosong sehingga tidak dapat menggantikan data saat ini.',
          };
        }
        const snap = writePreRestoreBackup(
          stateRef.current,
          'Cadangan lokal otomatis sebelum memuat versi SQLite'
        );
        if (snap) setPreRestoreBackup(snap);

        const nextData = normalizeAppData(syncConflict.cloudData);
        const sqliteFp = computeDataFingerprint(nextData);
        stateRef.current = nextData;
        setState(nextData);
        writeLocalCache(nextData);
        setHasUnsavedIn(false);
        setHasUnsavedAwal(false);
        setHasUnsavedOmset(false);
        setAbsDraft({});
        setSyncConflict(null);

        updateSyncMeta({
          lastCloudSyncAt: new Date().toISOString(),
          lastCloudFingerprint: sqliteFp,
          pendingLocalChanges: false,
          lastError: null,
        });
        await refreshSqliteInfo();
        setSync({
          text: 'Tersimpan di SQLite',
          isError: false,
          isSyncing: false,
          lastSyncAt: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
        return {
          ok: true,
          message: 'Data dari file SQLite berhasil diterapkan.',
        };
      }

      if (isViewer) {
        return {
          ok: false,
          message: 'Akun Viewer tidak memiliki izin menulis ke file SQLite.',
        };
      }
      const pushed = await saveNow(stateRef.current);
      if (pushed) {
        setSyncConflict(null);
        return {
          ok: true,
          message: 'Data lokal berhasil ditulis ke file SQLite.',
        };
      }
      return {
        ok: false,
        message: 'Gagal menulis data lokal ke file SQLite.',
      };
    },
    [syncConflict, isViewer, saveNow, updateSyncMeta, refreshSqliteInfo]
  );

  const updateState = useCallback(
    (updater: (prev: AppData) => AppData, immediateSave = false) => {
      if (isViewer) return;
      setState((prev) => {
        const next = updater(prev);
        writeLocalCache(next);
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
        if (immediateSave) {
          void saveNow(next);
        } else {
          setSync((s) => ({ ...s, text: 'Menyimpan…', isError: false }));
          saveTimerRef.current = window.setTimeout(() => {
            void saveNow(next);
          }, 400);
        }
        return next;
      });
    },
    [isViewer, saveNow]
  );

  const setStockCell = useCallback(
    (
      targetYm: string,
      type: 'a' | 'd' | 'c',
      targetDay: number,
      itemId: string,
      rawValue: string | number
    ) => {
      if (isViewer) return;
      const parsed = parseStockInput(String(rawValue ?? ''));

      setState((prev) => {
        const curMonth = prev.m[targetYm] || { a: {}, d: {}, c: {} };
        let nextMonth = curMonth;

        if (type === 'a') {
          const nextA = { ...(curMonth.a || {}) };
          if (!parsed.valid || parsed.empty || parsed.value === undefined) {
            delete nextA[itemId];
          } else {
            nextA[itemId] = parsed.value;
          }
          nextMonth = { ...curMonth, a: nextA };
        } else {
          const prevDayMap = curMonth[type]?.[targetDay] || {};
          const nextDayMap = { ...prevDayMap };
          if (!parsed.valid || parsed.empty || parsed.value === undefined) {
            delete nextDayMap[itemId];
          } else {
            nextDayMap[itemId] = parsed.value;
          }
          const nextTypeMap = { ...(curMonth[type] || {}) };
          if (Object.keys(nextDayMap).length === 0) {
            delete nextTypeMap[targetDay];
          } else {
            nextTypeMap[targetDay] = nextDayMap;
          }
          nextMonth = { ...curMonth, [type]: nextTypeMap };
        }

        const nextState: AppData = {
          ...prev,
          m: {
            ...prev.m,
            [targetYm]: nextMonth,
          },
        };
        writeLocalCache(nextState);
        stateRef.current = nextState;
        return nextState;
      });

      if (type === 'a') {
        setHasUnsavedAwal(true);
        setSync((s) => ({
          ...s,
          text: 'Ada perubahan stok awal belum disimpan',
          isError: false,
        }));
      } else {
        setHasUnsavedIn(true);
        setSync((s) => ({
          ...s,
          text: 'Ada perubahan belum disimpan',
          isError: false,
        }));
      }
    },
    [isViewer]
  );

  const saveInputHarianNow = useCallback(async (): Promise<boolean> => {
    if (isViewer) return false;
    const ok = await saveNow(stateRef.current);
    if (ok) {
      setHasUnsavedIn(false);
    }
    return ok;
  }, [isViewer, saveNow]);

  const saveStokAwalNow = useCallback(async (): Promise<boolean> => {
    if (isViewer) return false;
    const ok = await saveNow(stateRef.current);
    if (ok) {
      setHasUnsavedAwal(false);
    }
    return ok;
  }, [isViewer, saveNow]);

  const importStokAwalFromPrevMonth = useCallback(
    async (
      targetYm: string,
      mode: 'all' | 'empty_only' = 'all'
    ): Promise<{
      ok: boolean;
      importedCount: number;
      prevYm: string;
      hadPrevData: boolean;
      savedToDb: boolean;
    }> => {
      const prevYm = shiftMonth(targetYm, -1);
      if (isViewer) {
        return { ok: false, importedCount: 0, prevYm, hadPrevData: false, savedToDb: false };
      }

      const current = stateRef.current;
      const activeItems = getActiveItems(current);
      const curMonth = current.m[targetYm] || { a: {}, d: {}, c: {} };
      const nextA: Record<string, number> = { ...(curMonth.a || {}) };

      let hadPrevData = false;
      let importedCount = 0;

      activeItems.forEach((item) => {
        const prevVal = getLastClosing(current, prevYm, item.id);
        if (prevVal === undefined) return;
        hadPrevData = true;
        if (mode === 'empty_only' && nextA[item.id] !== undefined) {
          return;
        }
        nextA[item.id] = prevVal;
        importedCount += 1;
      });

      if (!hadPrevData || importedCount === 0) {
        return {
          ok: false,
          importedCount: 0,
          prevYm,
          hadPrevData,
          savedToDb: false,
        };
      }

      // Hanya memperbarui state.m[targetYm].a; histori bulan sebelumnya (prevYm) tidak pernah diubah.
      const nextState: AppData = {
        ...current,
        m: {
          ...current.m,
          [targetYm]: {
            ...curMonth,
            a: nextA,
          },
        },
      };

      writeLocalCache(nextState);
      stateRef.current = nextState;
      setState(nextState);

      const savedToDb = await saveNow(nextState);
      setHasUnsavedAwal(!savedToDb);

      return {
        ok: true,
        importedCount,
        prevYm,
        hadPrevData,
        savedToDb,
      };
    },
    [isViewer, saveNow]
  );

  const updateOmsetDay = useCallback(
    (
      targetYm: string,
      targetDay: number,
      updater: (prev: OmsetDayRecord) => OmsetDayRecord
    ): boolean => {
      if (isViewer) return false;
      const period = getPeriodOfDay(targetDay);
      if (getOmsetClosing(stateRef.current, targetYm, period)) {
        return false;
      }

      const key = formatDateKey(targetYm, targetDay);
      setState((prev) => {
        if (getOmsetClosing(prev, targetYm, period)) return prev;
        const prevOm = prev.omset || { days: {}, closing: {} };
        const prevRec = prevOm.days?.[key] || {};
        const nextRec = updater(prevRec);
        const nextState: AppData = {
          ...prev,
          omset: {
            days: {
              ...(prevOm.days || {}),
              [key]: nextRec,
            },
            closing: prevOm.closing || {},
          },
        };
        writeLocalCache(nextState);
        stateRef.current = nextState;
        return nextState;
      });

      setHasUnsavedOmset(true);
      setSync((s) => ({
        ...s,
        text: 'Ada perubahan omset belum disimpan',
        isError: false,
      }));
      return true;
    },
    [isViewer]
  );

  const saveOmsetNow = useCallback(async (): Promise<boolean> => {
    if (isViewer) return false;
    const ok = await saveNow(stateRef.current);
    if (ok) {
      setHasUnsavedOmset(false);
    }
    return ok;
  }, [isViewer, saveNow]);

  const closeOmsetPeriod = useCallback(
    async (targetYm: string, period: 1 | 2): Promise<boolean> => {
      if (isViewer) return false;
      const current = stateRef.current;
      const stats = getOmsetPeriodStats(current, targetYm, period);
      const actor = user?.nama || user?.username || '-';
      const key = `${targetYm}-P${period}`;
      const prevOm = current.omset || { days: {}, closing: {} };

      const nextState: AppData = {
        ...current,
        omset: {
          days: prevOm.days || {},
          closing: {
            ...(prevOm.closing || {}),
            [key]: {
              at: new Date().toISOString(),
              by: actor,
              snap: { ...stats.totals },
            },
          },
        },
      };

      writeLocalCache(nextState);
      stateRef.current = nextState;
      setState(nextState);
      setHasUnsavedOmset(false);
      const ok = await saveNow(nextState);
      return ok;
    },
    [isViewer, saveNow, user]
  );

  const reopenOmsetPeriod = useCallback(
    async (targetYm: string, period: 1 | 2): Promise<boolean> => {
      if (isViewer) return false;
      const current = stateRef.current;
      const key = `${targetYm}-P${period}`;
      const prevOm = current.omset || { days: {}, closing: {} };
      const nextClosing = { ...(prevOm.closing || {}) };
      delete nextClosing[key];

      const nextState: AppData = {
        ...current,
        omset: {
          days: prevOm.days || {},
          closing: nextClosing,
        },
      };

      writeLocalCache(nextState);
      stateRef.current = nextState;
      setState(nextState);
      setHasUnsavedOmset(false);
      const ok = await saveNow(nextState);
      return ok;
    },
    [isViewer, saveNow]
  );

  const getEffectiveDraftRecord = useCallback(
    (
      draftMap: AttendanceDraftMap,
      targetYm: string,
      targetDay: number,
      empId: string
    ): AttendanceRecord => {
      const dk = `${targetYm}|${targetDay}`;
      const existingDraft = draftMap[dk]?.[empId];
      if (existingDraft) return { ...existingDraft };
      const committed = stateRef.current.absensi?.[targetYm]?.[targetDay]?.[empId];
      const emp = getEmployees(stateRef.current).find((e) => e.id === empId);
      const defaultShift: AttendanceShift = committed?.shift || emp?.shiftDefault || 'Full';
      return {
        status: committed?.status || 'Hadir',
        lembur: Math.max(0, Number(committed?.lembur) || 0),
        shift: defaultShift,
        ...(committed?.checkIn ? { checkIn: committed.checkIn } : {}),
        ...(committed?.checkOut ? { checkOut: committed.checkOut } : {}),
        ...(committed?.catatan ? { catatan: committed.catatan } : {}),
        ...(committed?.updatedAt ? { updatedAt: committed.updatedAt } : {}),
        ...(committed?.gajiHarian !== undefined ? { gajiHarian: committed.gajiHarian } : {}),
        ...(committed?.lemburPerPaket !== undefined
          ? { lemburPerPaket: committed.lemburPerPaket }
          : {}),
      };
    },
    []
  );

  const setAttendanceDraftStatus = useCallback(
    (targetYm: string, targetDay: number, empId: string, status: AttendanceStatus) => {
      if (isViewer) return;
      const dk = `${targetYm}|${targetDay}`;
      setAbsDraft((prev) => {
        const base = getEffectiveDraftRecord(prev, targetYm, targetDay, empId);
        const shift: AttendanceShift = base.shift || 'Full';
        const preset = getShiftPresets(stateRef.current)[shift];
        const nextRec: AttendanceRecord = { ...base, status, shift };
        if (status === 'Hadir') {
          if (!nextRec.checkIn && preset?.start) {
            nextRec.checkIn = preset.start;
          }
        } else {
          delete nextRec.checkIn;
          delete nextRec.checkOut;
        }
        return {
          ...prev,
          [dk]: {
            ...(prev[dk] || {}),
            [empId]: nextRec,
          },
        };
      });
      setAbsSaveError(null);
      setSync((s) => ({
        ...s,
        text: 'Ada perubahan absensi belum disimpan',
        isError: false,
      }));
    },
    [getEffectiveDraftRecord, isViewer]
  );

  const updateAttendanceDraft = useCallback(
    (
      targetYm: string,
      targetDay: number,
      empId: string,
      patch: Partial<AttendanceRecord>
    ) => {
      if (isViewer) return;
      const dk = `${targetYm}|${targetDay}`;
      setAbsDraft((prev) => {
        const base = getEffectiveDraftRecord(prev, targetYm, targetDay, empId);
        const nextRec: AttendanceRecord = {
          ...base,
          ...patch,
        };
        if (patch.lembur !== undefined) {
          nextRec.lembur = Math.max(0, Math.floor(Number(patch.lembur) || 0));
        }
        if (patch.checkIn === '') delete nextRec.checkIn;
        if (patch.checkOut === '') delete nextRec.checkOut;
        if (patch.catatan === '') delete nextRec.catatan;
        return {
          ...prev,
          [dk]: {
            ...(prev[dk] || {}),
            [empId]: nextRec,
          },
        };
      });
      setAbsSaveError(null);
      setSync((s) => ({
        ...s,
        text: 'Ada perubahan absensi belum disimpan',
        isError: false,
      }));
    },
    [getEffectiveDraftRecord, isViewer]
  );

  const clockInEmployee = useCallback(
    (targetYm: string, targetDay: number, empId: string) => {
      if (isViewer) return;
      const nowTime = getCurrentTimeHHMM();
      const dk = `${targetYm}|${targetDay}`;
      setAbsDraft((prev) => {
        const base = getEffectiveDraftRecord(prev, targetYm, targetDay, empId);
        return {
          ...prev,
          [dk]: {
            ...(prev[dk] || {}),
            [empId]: {
              ...base,
              status: 'Hadir',
              checkIn: nowTime,
            },
          },
        };
      });
      setAbsSaveError(null);
      setSync((s) => ({
        ...s,
        text: 'Ada perubahan absensi belum disimpan',
        isError: false,
      }));
    },
    [getEffectiveDraftRecord, isViewer]
  );

  const clockOutEmployee = useCallback(
    (targetYm: string, targetDay: number, empId: string) => {
      if (isViewer) return;
      const nowTime = getCurrentTimeHHMM();
      const dk = `${targetYm}|${targetDay}`;
      setAbsDraft((prev) => {
        const base = getEffectiveDraftRecord(prev, targetYm, targetDay, empId);
        const shift: AttendanceShift = base.shift || 'Full';
        const preset = getShiftPresets(stateRef.current)[shift];
        return {
          ...prev,
          [dk]: {
            ...(prev[dk] || {}),
            [empId]: {
              ...base,
              status: 'Hadir',
              checkIn: base.checkIn || preset?.start || nowTime,
              checkOut: nowTime,
            },
          },
        };
      });
      setAbsSaveError(null);
      setSync((s) => ({
        ...s,
        text: 'Ada perubahan absensi belum disimpan',
        isError: false,
      }));
    },
    [getEffectiveDraftRecord, isViewer]
  );

  const resetAttendanceDraftDay = useCallback(
    (targetYm: string, targetDay: number) => {
      if (isViewer) return;
      const dk = `${targetYm}|${targetDay}`;
      setAbsDraft((prev) => {
        if (!prev[dk]) return prev;
        const copy = { ...prev };
        delete copy[dk];
        return copy;
      });
      setAbsSaveError(null);
    },
    [isViewer]
  );

  const setAttendanceDraftLembur = useCallback(
    (targetYm: string, targetDay: number, empId: string, lembur: number) => {
      if (isViewer) return;
      const cleanLembur = Math.max(0, Math.floor(Number(lembur) || 0));
      const dk = `${targetYm}|${targetDay}`;
      setAbsDraft((prev) => {
        const base = getEffectiveDraftRecord(prev, targetYm, targetDay, empId);
        return {
          ...prev,
          [dk]: {
            ...(prev[dk] || {}),
            [empId]: { ...base, lembur: cleanLembur },
          },
        };
      });
      setAbsSaveError(null);
      setSync((s) => ({
        ...s,
        text: 'Ada perubahan absensi belum disimpan',
        isError: false,
      }));
    },
    [getEffectiveDraftRecord, isViewer]
  );

  const adjustAttendanceDraftLembur = useCallback(
    (targetYm: string, targetDay: number, empId: string, delta: number) => {
      if (isViewer) return;
      const dk = `${targetYm}|${targetDay}`;
      setAbsDraft((prev) => {
        const base = getEffectiveDraftRecord(prev, targetYm, targetDay, empId);
        const nextLembur = Math.max(0, (Number(base.lembur) || 0) + delta);
        return {
          ...prev,
          [dk]: {
            ...(prev[dk] || {}),
            [empId]: { ...base, lembur: nextLembur },
          },
        };
      });
      setAbsSaveError(null);
      setSync((s) => ({
        ...s,
        text: 'Ada perubahan absensi belum disimpan',
        isError: false,
      }));
    },
    [getEffectiveDraftRecord, isViewer]
  );

  const setAllAttendanceHadir = useCallback(
    (
      targetYm: string,
      targetDay: number,
      options?: { onlyUnrecorded?: boolean; withScheduledTimes?: boolean }
    ) => {
      if (isViewer) return;
      const activeEmps = getActiveEmployees(stateRef.current);
      if (activeEmps.length === 0) return;
      const dk = `${targetYm}|${targetDay}`;
      const committedDay = stateRef.current.absensi?.[targetYm]?.[targetDay] || {};
      const onlyUnrecorded = options?.onlyUnrecorded ?? false;
      const withScheduledTimes = options?.withScheduledTimes ?? true;

      setAbsDraft((prev) => {
        const nextDayDraft: Record<string, AttendanceRecord> = { ...(prev[dk] || {}) };
        activeEmps.forEach((emp) => {
          if (onlyUnrecorded && (committedDay[emp.id] || nextDayDraft[emp.id])) {
            return;
          }
          const base = getEffectiveDraftRecord(prev, targetYm, targetDay, emp.id);
          const shift: AttendanceShift = base.shift || emp.shiftDefault || 'Full';
          const preset = getShiftPresets(stateRef.current)[shift];
          const nextRec: AttendanceRecord = {
            ...base,
            status: 'Hadir',
            shift,
          };
          if (withScheduledTimes && preset?.start) {
            nextRec.checkIn = base.checkIn || preset.start;
            if (preset.end) {
              nextRec.checkOut = base.checkOut || preset.end;
            }
          }
          nextDayDraft[emp.id] = nextRec;
        });
        return { ...prev, [dk]: nextDayDraft };
      });
      setAbsSaveError(null);
      setSync((s) => ({
        ...s,
        text: 'Ada perubahan absensi belum disimpan',
        isError: false,
      }));
    },
    [getEffectiveDraftRecord, isViewer]
  );

  const updateShiftConfig = useCallback(
    (config: ShiftScheduleConfig) => {
      if (isViewer) return;
      const sanitized = getShiftScheduleConfig({
        ...stateRef.current,
        shiftConfig: config,
      });
      writeStoredShiftConfig(sanitized);
      updateState(
        (prev) => ({
          ...prev,
          shiftConfig: sanitized,
        }),
        true
      );
    },
    [isViewer, updateState]
  );

  const buildCommittedAttendanceRecord = (
    emp: Employee,
    committed: AttendanceRecord | undefined,
    draftRec: AttendanceRecord
  ): AttendanceRecord => {
    const status: AttendanceStatus = draftRec.status;
    const lembur = Math.max(0, Math.floor(Number(draftRec.lembur) || 0));
    const gajiHarian =
      committed?.gajiHarian !== undefined
        ? committed.gajiHarian
        : Number(emp.gajiHarian) || 0;
    const lemburPerPaket =
      committed?.lemburPerPaket !== undefined
        ? committed.lemburPerPaket
        : Number(emp.lemburPerPaket) || 0;
    const shift: AttendanceShift = draftRec.shift || committed?.shift || emp.shiftDefault || 'Full';
    const rec: AttendanceRecord = {
      status,
      lembur,
      gajiHarian,
      lemburPerPaket,
      shift,
      updatedAt: new Date().toISOString(),
    };
    if (status === 'Hadir') {
      if (draftRec.checkIn) rec.checkIn = draftRec.checkIn;
      if (draftRec.checkOut) rec.checkOut = draftRec.checkOut;
    }
    const cleanNote = (draftRec.catatan || '').trim();
    if (cleanNote) rec.catatan = cleanNote;
    return rec;
  };

  const saveSingleAttendanceRow = useCallback(
    async (
      targetYm: string,
      targetDay: number,
      empId: string
    ): Promise<{ ok: boolean; error?: string }> => {
      if (isViewer) {
        return { ok: false, error: 'Akun viewer hanya dapat membaca data.' };
      }
      if (absSaving) {
        return { ok: false, error: 'Penyimpanan absensi sedang berlangsung.' };
      }

      const current = stateRef.current;
      const emp = getActiveEmployees(current).find((e) => e.id === empId);
      if (!emp) {
        return { ok: false, error: 'Karyawan tidak ditemukan.' };
      }

      const dk = `${targetYm}|${targetDay}`;
      const draftDay = absDraftRef.current[dk] || {};
      const existingMonth = current.absensi?.[targetYm] || {};
      const existingDay = existingMonth[targetDay] || {};
      const committed = existingDay[empId];
      const draftRec = draftDay[empId] || committed;
      if (!draftRec) {
        return { ok: false, error: 'Pilih status atau lakukan Check-in terlebih dahulu.' };
      }

      const nextDayRecords: Record<string, AttendanceRecord> = {
        ...existingDay,
        [empId]: buildCommittedAttendanceRecord(emp, committed, draftRec),
      };

      const nextState: AppData = {
        ...current,
        absensi: {
          ...(current.absensi || {}),
          [targetYm]: {
            ...existingMonth,
            [targetDay]: nextDayRecords,
          },
        },
      };

      writeLocalCache(nextState);
      stateRef.current = nextState;
      setState(nextState);

      setAbsDraft((prev) => {
        if (!prev[dk]?.[empId]) return prev;
        const copyDay = { ...prev[dk] };
        delete copyDay[empId];
        const copy = { ...prev };
        if (Object.keys(copyDay).length === 0) {
          delete copy[dk];
        } else {
          copy[dk] = copyDay;
        }
        return copy;
      });

      setAbsSaving(true);
      setAbsSaveError(null);
      const ok = await saveNow(nextState);
      setAbsSaving(false);

      if (ok) {
        setAbsUnsent(false);
        setAbsSaveError(null);
        return { ok: true };
      }

      const msg =
        'Absensi belum terkirim ke database. Data aman di perangkat ini; klik "Simpan absensi" lagi untuk mengirim ulang.';
      setAbsUnsent(true);
      setAbsSaveError(msg);
      return { ok: false, error: msg };
    },
    [absSaving, isViewer, saveNow]
  );

  const saveAttendanceDay = useCallback(
    async (
      targetYm: string,
      targetDay: number
    ): Promise<{ ok: boolean; error?: string }> => {
      if (isViewer) {
        return { ok: false, error: 'Akun viewer hanya dapat membaca data.' };
      }
      if (absSaving) {
        return { ok: false, error: 'Penyimpanan absensi sedang berlangsung.' };
      }

      const current = stateRef.current;
      const activeEmps = getActiveEmployees(current);
      const dk = `${targetYm}|${targetDay}`;
      const draftDay = absDraftRef.current[dk] || {};
      const existingMonth = current.absensi?.[targetYm] || {};
      const existingDay = existingMonth[targetDay] || {};

      // Pertahankan seluruh histori karyawan nonaktif/arsip pada tanggal ini
      const nextDayRecords: Record<string, AttendanceRecord> = { ...existingDay };
      let savedAny = false;

      activeEmps.forEach((emp) => {
        const committed = existingDay[emp.id];
        const draftRec = draftDay[emp.id];
        if (!draftRec && !committed) {
          return;
        }
        const source = draftRec || committed!;
        nextDayRecords[emp.id] = buildCommittedAttendanceRecord(emp, committed, source);
        savedAny = true;
      });

      if (!savedAny) {
        return {
          ok: false,
          error:
            'Belum ada karyawan yang dicatat kehadirannya. Klik Check-in atau "Semua Hadir" terlebih dahulu.',
        };
      }

      const nextState: AppData = {
        ...current,
        absensi: {
          ...(current.absensi || {}),
          [targetYm]: {
            ...existingMonth,
            [targetDay]: nextDayRecords,
          },
        },
      };

      writeLocalCache(nextState);
      stateRef.current = nextState;
      setState(nextState);

      setAbsDraft((prev) => {
        if (!prev[dk]) return prev;
        const copy = { ...prev };
        delete copy[dk];
        return copy;
      });

      setAbsSaving(true);
      setAbsSaveError(null);
      setSync((s) => ({
        ...s,
        text: 'Menyimpan absensi ke database…',
        isError: false,
        isSyncing: true,
      }));

      const ok = await saveNow(nextState);
      setAbsSaving(false);

      if (ok) {
        setAbsUnsent(false);
        setAbsSaveError(null);
        return { ok: true };
      }

      const msg =
        'Absensi belum terkirim ke database. Data aman di perangkat ini; klik "Simpan absensi" lagi untuk mengirim ulang.';
      setAbsUnsent(true);
      setAbsSaveError(msg);
      return { ok: false, error: msg };
    },
    [absSaving, isViewer, saveNow]
  );

  const saveEmployee = useCallback(
    (input: SaveEmployeeInput): { ok: boolean; error?: string } => {
      if (isViewer) {
        return { ok: false, error: 'Akun viewer tidak dapat mengubah data karyawan.' };
      }
      const nama = input.nama.trim();
      if (!nama) {
        return { ok: false, error: 'Nama karyawan tidak boleh kosong.' };
      }
      const gajiHarian = Math.max(0, Math.round(Number(input.gajiHarian) || 0));
      const lemburPerPaket = Math.max(0, Math.round(Number(input.lemburPerPaket) || 0));
      const foto = (input.foto || '').trim();
      const jabatan = (input.jabatan || '').trim();
      const shiftDefault: AttendanceShift = input.shiftDefault || 'Full';
      const siklusGaji: '14hari' | 'bulanan' =
        input.siklusGaji === 'bulanan' ? 'bulanan' : '14hari';

      updateState((prev) => {
        const list = [...getEmployees(prev)];
        let nextAbsensi = prev.absensi || {};

        if (input.id) {
          const idx = list.findIndex((x) => x.id === input.id);
          if (idx >= 0) {
            const oldEmp = list[idx];
            const tariffChanged =
              Number(oldEmp.gajiHarian) !== gajiHarian ||
              Number(oldEmp.lemburPerPaket) !== lemburPerPaket;

            if (tariffChanged) {
              // Lindungi histori absensi yang sudah tersimpan agar tidak berubah secara retroaktif
              // kecuali pengguna secara eksplisit memilih opsi terapkan ke histori lama.
              const updatedAbsensi: AppData['absensi'] = {};
              Object.keys(nextAbsensi).forEach((mKey) => {
                const monthObj = nextAbsensi[mKey];
                const nextMonthObj: Record<number, Record<string, AttendanceRecord>> = {};
                Object.keys(monthObj).forEach((dStr) => {
                  const dNum = Number(dStr);
                  const dayObj = monthObj[dNum];
                  const rec = dayObj?.[oldEmp.id];
                  if (rec) {
                    nextMonthObj[dNum] = {
                      ...dayObj,
                      [oldEmp.id]: input.applyRetroactive
                        ? {
                            ...rec,
                            gajiHarian,
                            lemburPerPaket,
                          }
                        : {
                            ...rec,
                            gajiHarian:
                              rec.gajiHarian !== undefined
                                ? rec.gajiHarian
                                : Number(oldEmp.gajiHarian) || 0,
                            lemburPerPaket:
                              rec.lemburPerPaket !== undefined
                                ? rec.lemburPerPaket
                                : Number(oldEmp.lemburPerPaket) || 0,
                          },
                    };
                  } else {
                    nextMonthObj[dNum] = dayObj;
                  }
                });
                updatedAbsensi[mKey] = nextMonthObj;
              });
              nextAbsensi = updatedAbsensi;
            }

            list[idx] = {
              ...oldEmp,
              nama,
              foto,
              ...(jabatan ? { jabatan } : { jabatan: undefined }),
              shiftDefault,
              gajiHarian,
              lemburPerPaket,
              siklusGaji,
            };
          }
        } else {
          const newEmp: Employee = {
            id: 'k_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            nama,
            foto,
            ...(jabatan ? { jabatan } : {}),
            shiftDefault,
            gajiHarian,
            lemburPerPaket,
            siklusGaji,
            aktif: 1,
          };
          list.push(newEmp);
        }

        return {
          ...prev,
          karyawan: list,
          absensi: nextAbsensi,
        };
      }, true);

      return { ok: true };
    },
    [isViewer, updateState]
  );

  const toggleEmployeeActive = useCallback(
    (empId: string) => {
      if (isViewer) return;
      updateState((prev) => {
        const list = getEmployees(prev).map((k) =>
          k.id === empId ? { ...k, aktif: k.aktif ? 0 : 1 } : k
        );
        return { ...prev, karyawan: list };
      }, true);
    },
    [isViewer, updateState]
  );

  const archiveEmployee = useCallback(
    (empId: string) => {
      if (isViewer) return;
      updateState((prev) => {
        const list = getEmployees(prev);
        const target = list.find((k) => k.id === empId);
        if (!target) return prev;
        const arsip = getArchivedEmployees(prev).filter((k) => k.id !== empId);
        arsip.push({ ...target, aktif: 0 });
        return {
          ...prev,
          karyawan: list.filter((k) => k.id !== empId),
          karyawanArsip: arsip,
        };
      }, true);
    },
    [isViewer, updateState]
  );

  const restoreArchivedEmployee = useCallback(
    (empId: string) => {
      if (isViewer) return;
      updateState((prev) => {
        const arsip = getArchivedEmployees(prev);
        const target = arsip.find((k) => k.id === empId);
        if (!target) return prev;
        const list = getEmployees(prev).filter((k) => k.id !== empId);
        list.push({ ...target, aktif: 1 });
        return {
          ...prev,
          karyawan: list,
          karyawanArsip: arsip.filter((k) => k.id !== empId),
        };
      }, true);
    },
    [isViewer, updateState]
  );

  const addMasterItem = useCallback(
    (input: AddMasterItemInput): { ok: boolean; error?: string; item?: MasterItem } => {
      if (isViewer) {
        return { ok: false, error: 'Akun viewer tidak dapat menambah item.' };
      }
      const nama = input.nama.trim();
      if (!nama) {
        return { ok: false, error: 'Nama item wajib diisi.' };
      }
      const current = stateRef.current;
      if (current.items.some((i) => i.nama.trim().toLowerCase() === nama.toLowerCase())) {
        return { ok: false, error: `Nama item "${nama}" sudah terdaftar di Master Item.` };
      }
      const kat = input.kat.trim() || 'Lain-Lain';
      const sat = input.sat.trim() || 'pcs';
      const min = Math.max(0, Number(input.min) || 0);

      let newId = `i${Date.now()}`;
      while (current.items.some((i) => i.id === newId)) {
        newId = `i${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      }

      const newItem: MasterItem = {
        id: newId,
        kat,
        nama,
        sat,
        min,
        aktif: 1,
      };

      updateState(
        (prev) => ({
          ...prev,
          items: [...prev.items, newItem],
        }),
        true
      );

      return { ok: true, item: newItem };
    },
    [isViewer, updateState]
  );

  const updateMasterItem = useCallback(
    (itemId: string, patch: UpdateMasterItemPatch): { ok: boolean; error?: string } => {
      if (isViewer) {
        return { ok: false, error: 'Akun viewer tidak dapat mengubah Master Item.' };
      }
      const current = stateRef.current;
      const existing = current.items.find((i) => i.id === itemId);
      if (!existing) {
        return { ok: false, error: 'Item tidak ditemukan.' };
      }

      let nextNama = existing.nama;
      if (patch.nama !== undefined) {
        nextNama = patch.nama.trim();
        if (!nextNama) {
          return { ok: false, error: 'Nama item tidak boleh kosong.' };
        }
        if (
          current.items.some(
            (i) => i.id !== itemId && i.nama.trim().toLowerCase() === nextNama.toLowerCase()
          )
        ) {
          return { ok: false, error: `Nama item "${nextNama}" sudah digunakan item lain.` };
        }
      }

      const nextKat =
        patch.kat !== undefined ? patch.kat.trim() || 'Lain-Lain' : existing.kat;
      const nextSat = patch.sat !== undefined ? patch.sat.trim() || 'pcs' : existing.sat;
      const nextMin =
        patch.min !== undefined ? Math.max(0, Number(patch.min) || 0) : existing.min;

      // ID item tidak pernah diubah agar seluruh histori transaksi di state.m & repCfg tetap terhubung
      updateState(
        (prev) => ({
          ...prev,
          items: prev.items.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  nama: nextNama,
                  kat: nextKat,
                  sat: nextSat,
                  min: nextMin,
                }
              : i
          ),
        }),
        true
      );

      return { ok: true };
    },
    [isViewer, updateState]
  );

  const toggleMasterItemActive = useCallback(
    (itemId: string) => {
      if (isViewer) return;
      updateState(
        (prev) => ({
          ...prev,
          items: prev.items.map((i) =>
            i.id === itemId ? { ...i, aktif: i.aktif ? 0 : 1 } : i
          ),
        }),
        true
      );
    },
    [isViewer, updateState]
  );

  const deleteMasterItem = useCallback(
    (itemId: string): { ok: boolean; hasHistory?: boolean; error?: string } => {
      if (isViewer) {
        return { ok: false, error: 'Akun viewer tidak dapat menghapus item.' };
      }
      const current = stateRef.current;
      const existing = current.items.find((i) => i.id === itemId);
      if (!existing) {
        return { ok: false, error: 'Item tidak ditemukan.' };
      }

      const stats = getItemTransactionStats(current, itemId);
      if (stats.hasHistory) {
        return {
          ok: false,
          hasHistory: true,
          error: `Item "${existing.nama}" memiliki ${stats.totalEntries} catatan histori di ${stats.monthsCount} bulan. Arsipkan item agar riwayat transaksi tetap utuh.`,
        };
      }

      updateState((prev) => {
        const nextRepCfg = { ...(prev.repCfg || {}) };
        delete nextRepCfg[itemId];
        return {
          ...prev,
          items: prev.items.filter((i) => i.id !== itemId),
          repCfg: nextRepCfg,
        };
      }, true);

      return { ok: true };
    },
    [isViewer, updateState]
  );

  const addSatuan = useCallback(
    (rawName: string): { ok: boolean; error?: string; unit?: string } => {
      if (isViewer) {
        return { ok: false, error: 'Mode Viewer tidak diizinkan mengubah data.' };
      }
      const unit = String(rawName || '').trim().toLowerCase();
      if (!unit) {
        return { ok: false, error: 'Nama satuan wajib diisi.' };
      }
      if (unit.length > 24) {
        return { ok: false, error: 'Nama satuan maksimal 24 karakter.' };
      }

      const currentList = getSatuanList(stateRef.current, DEFAULT_SATUAN);
      if (currentList.some((s) => s.toLowerCase() === unit)) {
        return { ok: false, error: `Satuan "${unit}" sudah terdaftar.` };
      }

      updateState(
        (prev) => ({
          ...prev,
          satuan: [...getSatuanList(prev, DEFAULT_SATUAN), unit],
        }),
        true
      );
      return { ok: true, unit };
    },
    [isViewer, updateState]
  );

  const renameSatuan = useCallback(
    (
      oldName: string,
      rawNewName: string
    ): { ok: boolean; error?: string; updatedItems?: number } => {
      if (isViewer) {
        return { ok: false, error: 'Mode Viewer tidak diizinkan mengubah data.' };
      }
      const prevUnit = String(oldName || '').trim();
      const nextUnit = String(rawNewName || '').trim().toLowerCase();
      if (!prevUnit) {
        return { ok: false, error: 'Satuan asal tidak valid.' };
      }
      if (!nextUnit) {
        return { ok: false, error: 'Nama satuan baru wajib diisi.' };
      }
      if (nextUnit.length > 24) {
        return { ok: false, error: 'Nama satuan maksimal 24 karakter.' };
      }
      if (prevUnit.toLowerCase() === nextUnit) {
        return { ok: false, error: 'Nama satuan baru sama dengan nama sebelumnya.' };
      }

      const currentList = getSatuanList(stateRef.current, DEFAULT_SATUAN);
      if (
        currentList.some(
          (s) => s.toLowerCase() === nextUnit && s.toLowerCase() !== prevUnit.toLowerCase()
        )
      ) {
        return { ok: false, error: `Satuan "${nextUnit}" sudah terdaftar.` };
      }

      const updatedItems = stateRef.current.items.filter(
        (item) => (item.sat || '').trim().toLowerCase() === prevUnit.toLowerCase()
      ).length;

      updateState((prev) => {
        const prevList = getSatuanList(prev, DEFAULT_SATUAN);
        const existsInList = prevList.some((s) => s.toLowerCase() === prevUnit.toLowerCase());
        const mappedList = existsInList
          ? prevList.map((s) => (s.toLowerCase() === prevUnit.toLowerCase() ? nextUnit : s))
          : [...prevList, nextUnit];
        const dedupedList: string[] = [];
        for (const u of mappedList) {
          if (!dedupedList.some((x) => x.toLowerCase() === u.toLowerCase())) {
            dedupedList.push(u);
          }
        }

        // Update item unit reference ONLY — never convert numeric stock history in prev.m
        const nextItems = prev.items.map((item) =>
          (item.sat || '').trim().toLowerCase() === prevUnit.toLowerCase()
            ? { ...item, sat: nextUnit }
            : item
        );

        return {
          ...prev,
          satuan: dedupedList,
          items: nextItems,
        };
      }, true);

      return { ok: true, updatedItems };
    },
    [isViewer, updateState]
  );

  const deleteSatuan = useCallback(
    (name: string): { ok: boolean; inUse?: boolean; error?: string } => {
      if (isViewer) {
        return { ok: false, error: 'Mode Viewer tidak diizinkan mengubah data.' };
      }
      const target = String(name || '').trim();
      if (!target) {
        return { ok: false, error: 'Nama satuan tidak valid.' };
      }

      const usage = getUnitUsageInfo(stateRef.current, target, DEFAULT_SATUAN);
      if (!usage.canDelete) {
        return {
          ok: false,
          inUse: true,
          error: `Satuan "${target}" masih digunakan oleh ${usage.items.length} item (${usage.activeItems.length} aktif, ${usage.archivedItems.length} nonaktif). Ubah satuan item terkait terlebih dahulu sebelum menghapus.`,
        };
      }

      const currentList = getSatuanList(stateRef.current, DEFAULT_SATUAN);
      if (currentList.length <= 1) {
        return {
          ok: false,
          error: 'Minimal harus ada 1 satuan tersisa di dalam sistem.',
        };
      }

      updateState(
        (prev) => ({
          ...prev,
          satuan: getSatuanList(prev, DEFAULT_SATUAN).filter(
            (s) => s.toLowerCase() !== target.toLowerCase()
          ),
        }),
        true
      );
      return { ok: true };
    },
    [isViewer, updateState]
  );

  const setReportItemConfig = useCallback(
    (itemId: string, field: 'sisa' | 'pakai', value: boolean) => {
      if (isViewer) return;
      updateState((prev) => {
        const currentCfg = getReportItemConfig(prev, itemId);
        return {
          ...prev,
          repCfg: {
            ...(prev.repCfg || {}),
            [itemId]: {
              ...currentCfg,
              [field]: value,
            },
          },
        };
      }, false);
    },
    [isViewer, updateState]
  );

  const setAllReportItemConfig = useCallback(
    (field: 'sisa' | 'pakai' | 'both', value: boolean) => {
      if (isViewer) return;
      updateState((prev) => {
        const nextRepCfg = { ...(prev.repCfg || {}) };
        getActiveItems(prev).forEach((item) => {
          const currentCfg = getReportItemConfig(prev, item.id);
          nextRepCfg[item.id] = {
            sisa: field === 'sisa' || field === 'both' ? value : currentCfg.sisa,
            pakai: field === 'pakai' || field === 'both' ? value : currentCfg.pakai,
          };
        });
        return {
          ...prev,
          repCfg: nextRepCfg,
        };
      }, true);
    },
    [isViewer, updateState]
  );

  const sendReportTelegram = useCallback(
    async (text: string): Promise<{ ok: boolean; error?: string }> => {
      const cleaned = String(text || '').trim();
      if (!cleaned) {
        return { ok: false, error: 'Teks laporan masih kosong.' };
      }

      setSync((prev) => ({
        ...prev,
        text: 'Mengirim ke Telegram…',
        isError: false,
        isSyncing: true,
      }));

      const res = await apiService.sendTelegram(cleaned);
      if (res.authExpired) {
        clearSessionStorage();
        setHasCloudToken(false);
        setIsLocked(true);
        setShowLoginModal(true);
      }

      if (res.success) {
        setSync({
          text: 'Laporan terkirim ke Telegram',
          isError: false,
          isSyncing: false,
          lastSyncAt: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
        return { ok: true };
      }

      setSync((prev) => ({
        ...prev,
        text: 'Gagal kirim Telegram',
        isError: true,
        isSyncing: false,
      }));
      return {
        ok: false,
        error: res.error || 'Gagal mengirim laporan ke Telegram.',
      };
    },
    []
  );

  const restoreBackupData = useCallback(
    async (
      rawJson: string
    ): Promise<{
      ok: boolean;
      error?: string;
      savedToCloud?: boolean;
      preBackupJson?: string;
      preBackupFilename?: string;
      summary?: BackupDataSummary;
    }> => {
      if (isViewer) {
        return { ok: false, error: 'Mode Viewer tidak diizinkan melakukan restore data.' };
      }

      // 1. Validasi ketat terlebih dahulu — jangan sentuh data lama jika tidak valid
      const validation = validateBackupPayload(rawJson);
      if (!validation.valid || !validation.parsed) {
        return {
          ok: false,
          error: validation.error || 'File backup tidak valid.',
        };
      }

      // 2. Buat cadangan otomatis data lama sebelum mengganti data
      const currentSnapshot = stateRef.current;
      const preBackupJson = JSON.stringify(currentSnapshot, null, 2);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const preBackupFilename = `cadangan-sebelum-restore-doona-${stamp}.json`;
      const savedSnap = writePreRestoreBackup(
        currentSnapshot,
        'Cadangan otomatis sebelum restore backup JSON'
      );
      if (savedSnap) {
        setPreRestoreBackup(savedSnap);
      }

      // 3. Normalisasi & terapkan data baru
      const nextData = normalizeAppData(validation.parsed);
      stateRef.current = nextData;
      setState(nextData);
      writeLocalCache(nextData);
      setHasUnsavedIn(false);
      setHasUnsavedAwal(false);
      setHasUnsavedOmset(false);
      setAbsDraft({});
      setAbsUnsent(false);
      setAbsSaveError(null);

      // 4. Simpan langsung ke local + cloud (bila terhubung)
      const savedToCloud = await saveNow(nextData);

      return {
        ok: true,
        savedToCloud,
        preBackupJson,
        preBackupFilename,
        summary: validation.summary,
      };
    },
    [isViewer, saveNow]
  );

  const restoreFromPreRestoreBackup = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    if (isViewer) {
      return { ok: false, error: 'Mode Viewer tidak diizinkan memulihkan data.' };
    }
    const snap = readPreRestoreBackup();
    if (!snap || !snap.data) {
      return { ok: false, error: 'Tidak ada cadangan pra-restore yang tersimpan.' };
    }

    const currentBeforeRollback = stateRef.current;
    const nextData = normalizeAppData(snap.data);

    // Simpan kondisi sekarang sebagai snapshot baru sebelum rollback
    const swappedSnap = writePreRestoreBackup(
      currentBeforeRollback,
      'Cadangan sebelum memulihkan snapshot lama'
    );
    if (swappedSnap) {
      setPreRestoreBackup(swappedSnap);
    }

    stateRef.current = nextData;
    setState(nextData);
    writeLocalCache(nextData);
    setHasUnsavedIn(false);
    setHasUnsavedAwal(false);
    setHasUnsavedOmset(false);
    setAbsDraft({});
    await saveNow(nextData);

    return { ok: true };
  }, [isViewer, saveNow]);

  const navigateTo = useCallback(
    (menu: MenuId, opts?: NavigationOptions) => {
      const targetMenu: MenuId = menu === 'aw' ? 'in' : menu === 'db' ? 'pg' : menu;
      const targetInputTab = menu === 'aw' ? 'awal' : opts?.inputTab;
      const targetPgSub = menu === 'db' ? 'db' : opts?.pgSub;

      if (activeMenu === 'in' && targetMenu !== 'in' && !isViewer) {
        if (hasUnsavedIn || hasUnsavedAwal) {
          setHasUnsavedIn(false);
          setHasUnsavedAwal(false);
          void saveNow(stateRef.current);
        }
      }
      if (activeMenu === 'om' && targetMenu !== 'om' && hasUnsavedOmset && !isViewer) {
        setHasUnsavedOmset(false);
        void saveNow(stateRef.current);
      }

      if (opts?.ym) setYm(opts.ym);
      if (opts?.day !== undefined) {
        const targetYm = opts.ym || ym;
        setDay(Math.min(Math.max(1, opts.day), getDaysInMonth(targetYm)));
      }
      if (targetInputTab) setInputTab(targetInputTab);
      if (opts?.omSub) setOmSub(opts.omSub);
      if (opts?.omPeriod !== undefined) setOmPeriod(opts.omPeriod);
      if (opts?.abSub) setAbSub(opts.abSub);
      if (opts?.abCycle) setAbCycle(opts.abCycle);
      if (targetPgSub) setPgSub(targetPgSub);
      setActiveMenu(targetMenu);
    },
    [activeMenu, hasUnsavedAwal, hasUnsavedIn, hasUnsavedOmset, isViewer, saveNow, ym]
  );

  const moveMonth = useCallback(
    (delta: number) => {
      const nextYm = shiftMonth(ym, delta);
      setYm(nextYm);
      setDay((d) => Math.min(d, getDaysInMonth(nextYm)));
    },
    [ym]
  );

  const moveDay = useCallback(
    (delta: number) => {
      const next = shiftDay(ym, day, delta);
      setYm(next.ym);
      setDay(next.day);
    },
    [ym, day]
  );

  const selectDateStr = useCallback((isoDate: string) => {
    if (!isoDate || isoDate.length < 10) return;
    const nextYm = isoDate.slice(0, 7);
    const nextDay = Number(isoDate.slice(8, 10));
    if (!Number.isFinite(nextDay) || nextDay < 1) return;
    setYm(nextYm);
    setDay(Math.min(nextDay, getDaysInMonth(nextYm)));
  }, []);

  const setMonthAndDay = useCallback((nextYm: string, nextDay: number) => {
    setYm(nextYm);
    setDay(Math.min(Math.max(1, nextDay), getDaysInMonth(nextYm)));
  }, []);

  const goToday = useCallback(() => {
    const t = getTodayParts();
    setYm(t.ym);
    setDay(t.day);
  }, []);

  const setupInitialAdmin = useCallback(
    async (username: string, nama: string, password: string) => {
      const uname = username.trim();
      const displayName = nama.trim() || 'Admin Doona Golf';
      const pwd = password.trim();
      if (!uname) return { ok: false, error: 'Username admin wajib diisi.' };
      if (pwd.length < 6) return { ok: false, error: 'Password minimal 6 karakter.' };

      const res = await apiService.setupSqliteAdmin(uname, displayName, pwd);
      if (res.success && res.token) {
        try {
          localStorage.setItem('dg_last_user', uname);
        } catch {
          // ignore
        }
        setStoredToken(res.token);
        setHasCloudToken(true);
        setSqliteNeedsSetup(false);
        const prof: UserProfile = res.user || { username: uname, nama: displayName, role: 'admin' };
        setStoredUser(prof);
        setUser(prof);
        setIsLocked(false);
        setShowLoginModal(false);

        await reloadFromCloud({ forceOverwriteLocal: true });
        return { ok: true };
      }

      return { ok: false, error: res.error || 'Gagal membuat akun admin SQLite.' };
    },
    [reloadFromCloud]
  );

  const loginWithCredentials = useCallback(
    async (username: string, password: string) => {
      const uname = username.trim();
      const pwd = password.trim();
      if (!uname) return { ok: false, error: 'Username wajib diisi.' };
      if (!pwd) return { ok: false, error: 'Password wajib diisi.' };

      if (!sqliteAvailable) {
        return {
          ok: false,
          connError: true,
          error:
            'Server SQLite lokal tidak aktif. Jalankan server aplikasi atau gunakan Mode Cache Browser.',
        };
      }

      const res = await apiService.login(uname, pwd);
      if (res.success && res.token) {
        try {
          localStorage.setItem('dg_last_user', uname);
        } catch {
          // ignore
        }
        setStoredToken(res.token);
        setHasCloudToken(true);
        setSqliteNeedsSetup(false);
        const prof: UserProfile = res.user || { username: uname, nama: uname, role: 'admin' };
        setStoredUser(prof);
        setUser(prof);
        setIsLocked(false);
        setShowLoginModal(false);

        await reloadFromCloud();
        return { ok: true };
      }

      if (res.code === 'NEEDS_SETUP') {
        setSqliteNeedsSetup(true);
        return {
          ok: false,
          needsSetup: true,
          error: res.error || 'Akun admin belum dibuat. Silakan buat akun admin pertama kali.',
        };
      }

      return {
        ok: false,
        error: res.error || 'Username atau password salah.',
        connError: res.conn,
      };
    },
    [sqliteAvailable, reloadFromCloud]
  );

  const enterLocalMode = useCallback(() => {
    const prof: UserProfile = { username: 'lokal', nama: 'Mode Cache Browser', role: 'admin' };
    setUser(prof);
    setIsLocked(false);
    setShowLoginModal(false);
    setState(normalizeAppData(readLocalCache()));
    setSync({
      text: sqliteAvailable ? 'Cache Browser (Belum Login SQLite)' : 'Tersimpan di Cache Browser',
      isError: false,
      isSyncing: false,
      lastSyncAt: null,
    });
  }, [sqliteAvailable]);

  const logout = useCallback(() => {
    void apiService.logout();
    clearSessionStorage();
    setHasCloudToken(false);
    setSqliteInfo(null);
    setIsLocked(true);
    setShowLoginModal(true);
    setSync({
      text: sqliteAvailable ? 'SQLite Siap (Belum Login)' : 'Mode Cache Browser',
      isError: false,
      isSyncing: false,
      lastSyncAt: null,
    });
  }, [sqliteAvailable]);

  const changePassword = useCallback(async (curr: string, nextPwd: string) => {
    if (!nextPwd || nextPwd.length < 6) {
      return { ok: false, message: 'Password baru terlalu pendek (minimal 6 karakter).' };
    }
    if (!getStoredToken()) {
      return {
        ok: false,
        message: 'Silakan login ke akun SQLite terlebih dahulu untuk mengganti password.',
      };
    }
    const res = await apiService.changePwd(curr, nextPwd);
    if (res.success) {
      if (res.token) setStoredToken(res.token);
      return {
        ok: true,
        message: 'Password berhasil diperbarui di SQLite. Sesi lain otomatis dicabut.',
      };
    }
    return { ok: false, message: res.error || 'Gagal mengganti password.' };
  }, []);

  const vacuumSqliteDb = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const res = await apiService.vacuumSqlite();
    if (res.authExpired) {
      handleAuthExpired();
      return { ok: false, message: 'Sesi login berakhir.' };
    }
    if (res.ok && res.info) {
      setSqliteInfo(res.info);
      return {
        ok: true,
        message: 'Optimasi SQLite (VACUUM & WAL Checkpoint) berhasil dijalankan.',
      };
    }
    return { ok: false, message: res.error || 'Gagal menjalankan optimasi SQLite.' };
  }, [handleAuthExpired]);

  const downloadSqliteBackup = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const res = await apiService.downloadSqliteBackup();
    if (res.authExpired) {
      handleAuthExpired();
      return { ok: false, message: 'Sesi login berakhir.' };
    }
    if (res.ok) {
      return {
        ok: true,
        message: `File backup ${res.fileName || 'SQLite'} berhasil diunduh.`,
      };
    }
    return { ok: false, message: res.error || 'Gagal mengunduh backup SQLite.' };
  }, [handleAuthExpired]);

  const restoreSqliteFile = useCallback(
    async (
      file: File
    ): Promise<{
      ok: boolean;
      error?: string;
      preBackupJson?: string;
      preBackupFilename?: string;
      summary?: BackupDataSummary;
    }> => {
      if (isViewer) {
        return { ok: false, error: 'Mode Viewer tidak diizinkan melakukan restore database.' };
      }

      const currentSnapshot = stateRef.current;
      const preBackupJson = JSON.stringify(currentSnapshot, null, 2);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const preBackupFilename = `cadangan-sebelum-restore-doona-${stamp}.json`;

      const res = await apiService.importSqliteBackup(file);
      if (res.authExpired) {
        handleAuthExpired();
        return { ok: false, error: 'Sesi login berakhir. Silakan masuk ulang.' };
      }
      if (!res.ok || !res.data) {
        return { ok: false, error: res.error || 'Gagal memulihkan file SQLite.' };
      }

      const savedSnap = writePreRestoreBackup(
        currentSnapshot,
        `Cadangan otomatis sebelum restore file SQLite (${file.name})`
      );
      if (savedSnap) setPreRestoreBackup(savedSnap);

      const nextData = normalizeAppData(res.data);
      const fp = computeDataFingerprint(nextData);
      stateRef.current = nextData;
      setState(nextData);
      writeLocalCache(nextData);
      setHasUnsavedIn(false);
      setHasUnsavedAwal(false);
      setHasUnsavedOmset(false);
      setAbsDraft({});
      setAbsUnsent(false);
      setAbsSaveError(null);
      setSyncConflict(null);

      if (res.info) {
        setSqliteInfo(res.info);
      } else {
        void refreshSqliteInfo();
      }

      const nowIso = res.savedAt || new Date().toISOString();
      updateSyncMeta({
        lastLocalWriteAt: nowIso,
        lastCloudSyncAt: nowIso,
        lastCloudFingerprint: fp,
        pendingLocalChanges: false,
        lastError: null,
      });

      setSync({
        text: 'Tersimpan di SQLite',
        isError: false,
        isSyncing: false,
        lastSyncAt: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      });

      return {
        ok: true,
        preBackupJson,
        preBackupFilename,
        summary: summarizeAppData(nextData),
      };
    },
    [isViewer, handleAuthExpired, refreshSqliteInfo, updateSyncMeta]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      activeMenu,
      ym,
      day,
      curYm,
      nowDay,
      inputTab,
      setInputTab,
      omSub,
      setOmSub,
      omPeriod,
      setOmPeriod,
      abSub,
      setAbSub,
      abCycle,
      setAbCycle,
      pgSub,
      setPgSub,
      absDraft,
      setAbsDraft,
      hasAbsDraft,
      absSaving,
      absUnsent,
      absSaveError,
      hasUnsavedIn,
      hasUnsavedAwal,
      hasUnsavedOmset,
      user,
      isAuthenticated,
      isViewer,
      isLocked,
      dbMode,
      sqliteAvailable,
      sqliteChecking,
      sqliteNeedsSetup,
      sqliteEnvManaged,
      sqliteInfo,
      sync,
      syncMeta,
      syncConflict,
      showLoginModal,
      setShowLoginModal,
      showChangePwdModal,
      setShowChangePwdModal,
      navigateTo,
      moveMonth,
      moveDay,
      selectDateStr,
      setMonthAndDay,
      goToday,
      updateState,
      setStockCell,
      saveInputHarianNow,
      saveStokAwalNow,
      importStokAwalFromPrevMonth,
      updateOmsetDay,
      saveOmsetNow,
      closeOmsetPeriod,
      reopenOmsetPeriod,
      setAttendanceDraftStatus,
      updateAttendanceDraft,
      clockInEmployee,
      clockOutEmployee,
      resetAttendanceDraftDay,
      setAttendanceDraftLembur,
      adjustAttendanceDraftLembur,
      setAllAttendanceHadir,
      saveSingleAttendanceRow,
      saveAttendanceDay,
      saveEmployee,
      updateShiftConfig,
      toggleEmployeeActive,
      archiveEmployee,
      restoreArchivedEmployee,
      addMasterItem,
      updateMasterItem,
      toggleMasterItemActive,
      deleteMasterItem,
      addSatuan,
      renameSatuan,
      deleteSatuan,
      preRestoreBackup,
      setReportItemConfig,
      setAllReportItemConfig,
      sendReportTelegram,
      restoreBackupData,
      restoreFromPreRestoreBackup,
      saveNow,
      reloadFromCloud,
      refreshSqliteInfo,
      checkAndSyncCloud,
      resolveSyncConflict,
      setupInitialAdmin,
      loginWithCredentials,
      enterLocalMode,
      logout,
      changePassword,
      vacuumSqliteDb,
      downloadSqliteBackup,
      restoreSqliteFile,
    }),
    [
      state,
      activeMenu,
      ym,
      day,
      curYm,
      nowDay,
      inputTab,
      omSub,
      omPeriod,
      abSub,
      abCycle,
      pgSub,
      absDraft,
      hasAbsDraft,
      absSaving,
      absUnsent,
      absSaveError,
      hasUnsavedIn,
      hasUnsavedAwal,
      hasUnsavedOmset,
      user,
      isAuthenticated,
      isViewer,
      isLocked,
      dbMode,
      sqliteAvailable,
      sqliteChecking,
      sqliteNeedsSetup,
      sqliteEnvManaged,
      sqliteInfo,
      sync,
      syncMeta,
      syncConflict,
      showLoginModal,
      showChangePwdModal,
      navigateTo,
      moveMonth,
      moveDay,
      selectDateStr,
      setMonthAndDay,
      goToday,
      updateState,
      setStockCell,
      saveInputHarianNow,
      saveStokAwalNow,
      importStokAwalFromPrevMonth,
      updateOmsetDay,
      saveOmsetNow,
      closeOmsetPeriod,
      reopenOmsetPeriod,
      setAttendanceDraftStatus,
      updateAttendanceDraft,
      clockInEmployee,
      clockOutEmployee,
      resetAttendanceDraftDay,
      setAttendanceDraftLembur,
      adjustAttendanceDraftLembur,
      setAllAttendanceHadir,
      saveSingleAttendanceRow,
      saveAttendanceDay,
      saveEmployee,
      updateShiftConfig,
      toggleEmployeeActive,
      archiveEmployee,
      restoreArchivedEmployee,
      addMasterItem,
      updateMasterItem,
      toggleMasterItemActive,
      deleteMasterItem,
      addSatuan,
      renameSatuan,
      deleteSatuan,
      preRestoreBackup,
      setReportItemConfig,
      setAllReportItemConfig,
      sendReportTelegram,
      restoreBackupData,
      restoreFromPreRestoreBackup,
      saveNow,
      reloadFromCloud,
      refreshSqliteInfo,
      checkAndSyncCloud,
      resolveSyncConflict,
      setupInitialAdmin,
      loginWithCredentials,
      enterLocalMode,
      logout,
      changePassword,
      vacuumSqliteDb,
      downloadSqliteBackup,
      restoreSqliteFile,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp harus digunakan di dalam AppProvider');
  return ctx;
}
