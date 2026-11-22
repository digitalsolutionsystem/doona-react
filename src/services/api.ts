import { DEFAULT_API_URL } from '../constants/defaults';
import type { AppData, UserProfile } from '../types/app';

interface GasRunner {
  withSuccessHandler: (cb: (res: unknown) => void) => GasRunner;
  withFailureHandler: (cb: (err: unknown) => void) => GasRunner;
  getData: (token: string) => void;
  saveData: (json: string, token: string) => void;
  sendTelegram: (text: string, token: string) => void;
  getProfile: (token: string) => void;
  login: (user: string, pwd: string) => void;
  changePwd: (curr: string, nw: string, token: string) => void;
}

declare global {
  interface Window {
    google?: {
      script?: {
        run?: GasRunner;
      };
    };
  }
}

export const API_URL_RE =
  /^https:\/\/script\.google\.com\/(?:a\/(?:macros\/)?[^/]+\/)?macros\/s\/[\w-]+\/exec$/;

export function hasGoogleAppsScriptHost(): boolean {
  return Boolean(window.google?.script?.run);
}

export function getApiUrl(): string {
  const stored = localStorage.getItem('dg_api_url');
  if (stored === '__LOCAL_ONLY__') return '';
  return (stored ?? DEFAULT_API_URL ?? '').trim();
}

export function setApiUrl(url: string): void {
  const cleaned = (url || '').trim();
  if (!cleaned) {
    localStorage.setItem('dg_api_url', '__LOCAL_ONLY__');
  } else {
    localStorage.setItem('dg_api_url', cleaned);
  }
}

export function resetApiUrl(): void {
  localStorage.removeItem('dg_api_url');
  clearSessionStorage();
}

export function isApiConfigured(): boolean {
  return Boolean(hasGoogleAppsScriptHost() || getApiUrl());
}

export function getStoredToken(): string {
  return sessionStorage.getItem('dg_token') || localStorage.getItem('dg_token') || '';
}

export function setStoredToken(token: string, remember: boolean): void {
  if (!token) return;
  sessionStorage.setItem('dg_token', token);
  if (remember) localStorage.setItem('dg_token', token);
  else localStorage.removeItem('dg_token');
}

export function getStoredUser(): UserProfile | null {
  try {
    return JSON.parse(
      sessionStorage.getItem('dg_user') || localStorage.getItem('dg_user') || 'null'
    );
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserProfile, remember?: boolean): void {
  const raw = JSON.stringify(user);
  sessionStorage.setItem('dg_user', raw);
  const keep = remember ?? Boolean(localStorage.getItem('dg_auth'));
  if (keep) localStorage.setItem('dg_user', raw);
  else localStorage.removeItem('dg_user');
}

export function clearSessionStorage(): void {
  sessionStorage.removeItem('dg_token');
  localStorage.removeItem('dg_token');
  sessionStorage.removeItem('dg_user');
  localStorage.removeItem('dg_user');
  sessionStorage.removeItem('dg_auth');
  localStorage.removeItem('dg_auth');
}

export function getStoredLocalPwd(): string {
  return localStorage.getItem('dg_pwd') || 'admin';
}

export function setStoredLocalPwd(pwd: string): void {
  localStorage.setItem('dg_pwd', pwd);
}

export function readLocalCache(): Partial<AppData> | null {
  try {
    return JSON.parse(localStorage.getItem('dg') || 'null');
  } catch {
    return null;
  }
}

export function writeLocalCache(data: AppData): void {
  try {
    localStorage.setItem('dg', JSON.stringify(data));
  } catch {
    // Abaikan jika quota storage penuh
  }
}

export function photoUrl(u?: string): string {
  const clean = String(u || '').trim();
  if (!clean) return '';
  const match =
    clean.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ||
    clean.match(/drive\.google\.com\/(?:open|uc)\?[^#]*\bid=([\w-]+)/);
  return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : clean;
}

export function getApiErrorMessage(err: unknown): string {
  const url = getApiUrl();
  if (url && !API_URL_RE.test(url)) {
    return 'Format Web App URL tidak valid. URL harus berbentuk https://script.google.com/macros/s/…/exec.';
  }
  const msg = err instanceof Error ? err.message : String(err || '');
  if ((err instanceof Error && err.name === 'SyntaxError') || /JSON/i.test(msg)) {
    return 'Server tidak membalas data yang benar. Pastikan deployment diset "Who has access: Anyone" dan sudah di-deploy ulang.';
  }
  return 'Tidak dapat terhubung ke server. Periksa koneksi internet, Web App URL, dan pastikan akses deployment diset "Anyone".';
}

async function postApi<T>(payload: Record<string, unknown>, customUrl?: string): Promise<T> {
  const target = (customUrl ?? getApiUrl()).trim();
  const res = await fetch(target, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  });
  return (await res.json()) as T;
}

export interface ApiLoadResult {
  data: Partial<AppData> | null;
  source: 'cloud' | 'local';
  authExpired?: boolean;
  error?: string;
}

export interface ApiSaveResult {
  ok: boolean;
  mode: 'cloud' | 'local' | 'offline' | 'readonly' | 'error';
  authExpired?: boolean;
}

export interface ApiLoginResult {
  success: boolean;
  token?: string;
  user?: UserProfile;
  error?: string;
  conn?: boolean;
}

export interface ApiPingResult {
  success: boolean;
  spreadsheetName?: string;
  sheets?: string[];
  error?: string;
}

export interface PreRestoreBackupSnapshot {
  savedAt: string;
  reason: string;
  data: AppData;
}

const PRE_RESTORE_BACKUP_KEY = 'dg_pre_restore_backup';

export function readPreRestoreBackup(): PreRestoreBackupSnapshot | null {
  try {
    const raw = localStorage.getItem(PRE_RESTORE_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PreRestoreBackupSnapshot;
    if (!parsed || typeof parsed !== 'object' || !parsed.data || !parsed.savedAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePreRestoreBackup(
  data: AppData,
  reason = 'Cadangan otomatis sebelum restore'
): PreRestoreBackupSnapshot | null {
  try {
    const snapshot: PreRestoreBackupSnapshot = {
      savedAt: new Date().toISOString(),
      reason,
      data: JSON.parse(JSON.stringify(data)) as AppData,
    };
    localStorage.setItem(PRE_RESTORE_BACKUP_KEY, JSON.stringify(snapshot));
    return snapshot;
  } catch {
    return null;
  }
}

export interface SyncMetadata {
  lastLocalWriteAt: string | null;
  lastCloudSyncAt: string | null;
  lastCloudFingerprint: string | null;
  pendingLocalChanges: boolean;
  lastError: string | null;
}

const SYNC_META_KEY = 'dg_sync_meta';

const DEFAULT_SYNC_META: SyncMetadata = {
  lastLocalWriteAt: null,
  lastCloudSyncAt: null,
  lastCloudFingerprint: null,
  pendingLocalChanges: false,
  lastError: null,
};

export function readSyncMeta(): SyncMetadata {
  try {
    const raw = localStorage.getItem(SYNC_META_KEY);
    if (!raw) return { ...DEFAULT_SYNC_META };
    const parsed = JSON.parse(raw) as Partial<SyncMetadata>;
    return {
      lastLocalWriteAt: typeof parsed.lastLocalWriteAt === 'string' ? parsed.lastLocalWriteAt : null,
      lastCloudSyncAt: typeof parsed.lastCloudSyncAt === 'string' ? parsed.lastCloudSyncAt : null,
      lastCloudFingerprint:
        typeof parsed.lastCloudFingerprint === 'string' ? parsed.lastCloudFingerprint : null,
      pendingLocalChanges: Boolean(parsed.pendingLocalChanges),
      lastError: typeof parsed.lastError === 'string' ? parsed.lastError : null,
    };
  } catch {
    return { ...DEFAULT_SYNC_META };
  }
}

export function writeSyncMeta(patch: Partial<SyncMetadata>): SyncMetadata {
  const next: SyncMetadata = {
    ...readSyncMeta(),
    ...patch,
  };
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(next));
  } catch {
    // Abaikan jika storage penuh
  }
  return next;
}

function stableStringify(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) {
    return '[' + val.map((item) => stableStringify(item)).join(',') + ']';
  }
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return '{' + keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',') + '}';
}

/**
 * Menghasilkan fingerprint deterministik dari seluruh AppData
 * untuk mendeteksi konflik & mencegah penimpaan data secara tidak sengaja.
 */
export function computeDataFingerprint(data: Partial<AppData> | null | undefined): string {
  if (!data) return 'empty';
  const canonical = stableStringify({
    items: data.items || [],
    satuan: data.satuan || [],
    repCfg: data.repCfg || {},
    m: data.m || {},
    karyawan: data.karyawan || [],
    karyawanArsip: data.karyawanArsip || [],
    absensi: data.absensi || {},
    omset: data.omset || { days: {}, closing: {} },
  });
  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${(hash >>> 0).toString(16).padStart(8, '0')}-${canonical.length}`;
}

export function getLocalCacheStats(): { hasCache: boolean; sizeKb: number } {
  try {
    const raw = localStorage.getItem('dg');
    if (!raw) return { hasCache: false, sizeKb: 0 };
    const bytes = new Blob([raw]).size;
    return {
      hasCache: true,
      sizeKb: Math.max(0.1, Math.round((bytes / 1024) * 10) / 10),
    };
  } catch {
    return { hasCache: false, sizeKb: 0 };
  }
}

export function validateApiUrlFormat(url: string): { valid: boolean; error?: string } {
  const cleaned = (url || '').trim();
  if (!cleaned) return { valid: true };
  if (!API_URL_RE.test(cleaned)) {
    return {
      valid: false,
      error:
        'Format Web App URL tidak valid. URL harus berbentuk https://script.google.com/macros/s/…/exec.',
    };
  }
  return { valid: true };
}

export interface ApiCloudFetchResult {
  ok: boolean;
  data: Partial<AppData> | null;
  isEmptyCloud?: boolean;
  authExpired?: boolean;
  unconfigured?: boolean;
  error?: string;
}

export interface ApiTelegramResult {
  success: boolean;
  error?: string;
  authExpired?: boolean;
}

export const apiService = {
  /**
   * Membaca data mentah dari Cloud (Google Apps Script) TANPA langsung menimpa localStorage.
   * Digunakan untuk deteksi konflik dan sinkronisasi aman.
   */
  async fetchCloudRaw(): Promise<ApiCloudFetchResult> {
    const gs = window.google?.script?.run;
    const token = getStoredToken();

    if (gs) {
      return new Promise((resolve) => {
        gs.withSuccessHandler((raw) => {
          try {
            const parsed = raw ? (JSON.parse(String(raw)) as Partial<AppData>) : null;
            const hasItems = Boolean(parsed && Array.isArray(parsed.items) && parsed.items.length > 0);
            resolve({ ok: true, data: parsed, isEmptyCloud: !hasItems });
          } catch (err) {
            resolve({ ok: false, data: null, error: getApiErrorMessage(err) });
          }
        })
          .withFailureHandler((err) => {
            const msg = String(err || '');
            if (msg.includes('AUTH')) {
              resolve({ ok: false, data: null, authExpired: true, error: 'Sesi login berakhir.' });
            } else {
              resolve({ ok: false, data: null, error: msg || 'Gagal membaca data dari Google Apps Script.' });
            }
          })
          .getData(token);
      });
    }

    const url = getApiUrl();
    if (!url || !token) {
      return { ok: false, data: null, unconfigured: true };
    }

    try {
      const res = await postApi<{
        success?: boolean;
        code?: string;
        error?: string;
        data?: Partial<AppData> | null;
      }>({ action: 'getData', token });

      if (res?.code === 'AUTH') {
        return { ok: false, data: null, authExpired: true, error: 'Sesi login berakhir.' };
      }
      if (res?.success) {
        const parsed = res.data || null;
        const hasItems = Boolean(parsed && Array.isArray(parsed.items) && parsed.items.length > 0);
        return { ok: true, data: parsed, isEmptyCloud: !hasItems };
      }
      return {
        ok: false,
        data: null,
        error: res?.error || 'Server gagal mengembalikan data cloud.',
      };
    } catch (err) {
      return { ok: false, data: null, error: getApiErrorMessage(err) };
    }
  },

  async load(): Promise<ApiLoadResult> {
    const cloudRes = await this.fetchCloudRaw();
    if (cloudRes.authExpired) {
      return { data: readLocalCache(), source: 'local', authExpired: true };
    }
    if (cloudRes.ok && cloudRes.data) {
      try {
        localStorage.setItem('dg', JSON.stringify(cloudRes.data));
      } catch {
        // ignore
      }
      return { data: cloudRes.data, source: 'cloud' };
    }
    if (cloudRes.error) {
      return { data: readLocalCache(), source: 'local', error: cloudRes.error };
    }
    return { data: readLocalCache(), source: 'local' };
  },

  async save(data: AppData, isViewer: boolean): Promise<ApiSaveResult> {
    if (isViewer) {
      return { ok: false, mode: 'readonly' };
    }
    writeLocalCache(data);
    const gs = window.google?.script?.run;
    const token = getStoredToken();

    if (gs) {
      return new Promise((resolve) => {
        gs.withSuccessHandler(() => resolve({ ok: true, mode: 'cloud' }))
          .withFailureHandler((err) => {
            const msg = String(err);
            if (msg.includes('AUTH')) resolve({ ok: false, mode: 'error', authExpired: true });
            else if (/FORBIDDEN/.test(msg)) resolve({ ok: false, mode: 'readonly' });
            else resolve({ ok: false, mode: 'error' });
          })
          .saveData(JSON.stringify(data), token);
      });
    }

    const url = getApiUrl();
    if (url && token) {
      try {
        const res = await postApi<{ success?: boolean; code?: string }>({
          action: 'saveData',
          token,
          data,
        });
        if (res?.code === 'AUTH') return { ok: false, mode: 'error', authExpired: true };
        if (res?.code === 'FORBIDDEN') return { ok: false, mode: 'readonly' };
        if (res?.success) return { ok: true, mode: 'cloud' };
        return { ok: false, mode: 'error' };
      } catch {
        return { ok: false, mode: 'offline' };
      }
    }

    return { ok: true, mode: 'local' };
  },

  async sendTelegram(text: string): Promise<ApiTelegramResult> {
    const gs = window.google?.script?.run;
    const token = getStoredToken();

    if (gs) {
      return new Promise((resolve) => {
        gs.withSuccessHandler((res) => {
          const r = res as { success?: boolean; error?: string } | null;
          resolve({ success: Boolean(r?.success), error: r?.error });
        })
          .withFailureHandler((err) => {
            const msg = String(err || '');
            if (msg.includes('AUTH')) {
              resolve({ success: false, authExpired: true, error: 'Sesi login telah berakhir.' });
            } else {
              resolve({ success: false, error: msg || 'Gagal mengirim ke Telegram.' });
            }
          })
          .sendTelegram(text, token);
      });
    }

    const url = getApiUrl();
    if (!url) {
      return {
        success: false,
        error:
          'Kirim Telegram membutuhkan koneksi ke Google Sheets / Apps Script (token bot disimpan aman di Code.gs). Hubungkan database terlebih dahulu.',
      };
    }

    try {
      const res = await postApi<{ success?: boolean; error?: string; code?: string }>({
        action: 'sendTelegram',
        token,
        text,
      });
      if (res?.code === 'AUTH') {
        return {
          success: false,
          authExpired: true,
          error: 'Sesi login berakhir. Silakan masuk ulang ke database.',
        };
      }
      return {
        success: Boolean(res?.success),
        error: res?.error,
      };
    } catch (err) {
      return { success: false, error: getApiErrorMessage(err) };
    }
  },

  async login(username: string, password: string): Promise<ApiLoginResult> {
    const gs = window.google?.script?.run;
    if (gs) {
      return new Promise((resolve) => {
        gs.withSuccessHandler((res) => resolve(res as ApiLoginResult))
          .withFailureHandler((err) => resolve({ success: false, error: String(err) }))
          .login(username, password);
      });
    }
    try {
      return await postApi<ApiLoginResult>({ action: 'login', username, password });
    } catch (err) {
      return { success: false, conn: true, error: getApiErrorMessage(err) };
    }
  },

  async me(): Promise<{ success?: boolean; user?: UserProfile; code?: string } | null> {
    const gs = window.google?.script?.run;
    const token = getStoredToken();
    if (!token && !gs) return null;
    if (gs) {
      return new Promise((resolve) => {
        gs.withSuccessHandler((u) => resolve({ success: true, user: u as UserProfile }))
          .withFailureHandler(() => resolve(null))
          .getProfile(token);
      });
    }
    try {
      return await postApi<{ success?: boolean; user?: UserProfile; code?: string }>({
        action: 'me',
        token,
      });
    } catch {
      return null;
    }
  },

  async changePwd(
    current: string,
    password: string
  ): Promise<{ success: boolean; token?: string; error?: string; code?: string }> {
    const gs = window.google?.script?.run;
    const token = getStoredToken();
    if (gs) {
      return new Promise((resolve) => {
        gs.withSuccessHandler((r) =>
          resolve(r as { success: boolean; token?: string; error?: string })
        )
          .withFailureHandler((e) => resolve({ success: false, error: String(e) }))
          .changePwd(current, password, token);
      });
    }
    try {
      return await postApi<{ success: boolean; token?: string; error?: string; code?: string }>({
        action: 'changePwd',
        token,
        current,
        password,
      });
    } catch {
      return { success: false, error: 'Tidak dapat terhubung ke server.' };
    }
  },

  async ping(customUrl?: string): Promise<ApiPingResult> {
    const target = (customUrl ?? getApiUrl()).trim();
    if (!target) return { success: false, error: 'URL belum diisi.' };
    try {
      return await postApi<ApiPingResult>(
        { action: 'ping', token: getStoredToken() },
        target
      );
    } catch (err) {
      return { success: false, error: getApiErrorMessage(err) };
    }
  },
};
