import type {
  AppData,
  SqliteDatabaseInfo,
  SqliteHealthResponse,
  UserProfile,
} from '../types/app';

/**
 * In-memory Bearer token store (never persisted to localStorage or sessionStorage).
 */
let memoryToken = '';
let memoryUser: UserProfile | null = null;

function purgeLegacyBrowserAuthKeys(): void {
  try {
    sessionStorage.removeItem('dg_token');
    localStorage.removeItem('dg_token');
    sessionStorage.removeItem('dg_auth');
    localStorage.removeItem('dg_auth');
    sessionStorage.removeItem('dg_user');
    localStorage.removeItem('dg_user');
    localStorage.removeItem('dg_pwd');
  } catch {
    // Abaikan jika browser membatasi akses storage
  }
}

purgeLegacyBrowserAuthKeys();

export function getStoredToken(): string {
  return memoryToken;
}

export function setStoredToken(token: string): void {
  memoryToken = (token || '').trim();
}

export function getStoredUser(): UserProfile | null {
  return memoryUser;
}

export function setStoredUser(user: UserProfile | null): void {
  memoryUser = user ? { ...user } : null;
}

export function clearSessionStorage(): void {
  memoryToken = '';
  memoryUser = null;
  purgeLegacyBrowserAuthKeys();
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
  if (/^(javascript|data:text\/html)/i.test(clean)) return '';
  const match =
    clean.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ||
    clean.match(/drive\.google\.com\/(?:open|uc)\?[^#]*\bid=([\w-]+)/);
  return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : clean;
}

export interface ApiSaveResult {
  ok: boolean;
  mode: 'sqlite' | 'local' | 'offline' | 'readonly' | 'error';
  authExpired?: boolean;
  savedAt?: string;
  error?: string;
}

export interface ApiLoginResult {
  success: boolean;
  token?: string;
  user?: UserProfile;
  code?: string;
  error?: string;
  conn?: boolean;
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
    shiftConfig: data.shiftConfig || {},
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

function buildAuthHeaders(includeJson = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  if (memoryToken) headers.Authorization = `Bearer ${memoryToken}`;
  return headers;
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const apiService = {
  async checkSqliteHealth(): Promise<SqliteHealthResponse | null> {
    try {
      const res = await fetch('/api/health', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const body = await parseJsonSafe<SqliteHealthResponse>(res);
      if (body && body.ok && body.engine === 'sqlite') {
        return body;
      }
      return null;
    } catch {
      return null;
    }
  },

  async setupSqliteAdmin(
    username: string,
    nama: string,
    password: string
  ): Promise<ApiLoginResult> {
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, nama, password }),
      });
      const body = await parseJsonSafe<ApiLoginResult>(res);
      if (res.ok && body?.success) {
        return body;
      }
      return {
        success: false,
        error: body?.error || 'Gagal membuat akun admin SQLite.',
      };
    } catch {
      return {
        success: false,
        conn: true,
        error: 'Tidak dapat terhubung ke server SQLite lokal.',
      };
    }
  },

  async login(username: string, password: string): Promise<ApiLoginResult> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = await parseJsonSafe<ApiLoginResult>(res);
      if (res.ok && body?.success) {
        return body;
      }
      return {
        success: false,
        code: body?.code,
        error: body?.error || 'Username atau password salah.',
      };
    } catch {
      return {
        success: false,
        conn: true,
        error: 'Tidak dapat terhubung ke server SQLite lokal.',
      };
    }
  },

  async logout(): Promise<void> {
    if (!memoryToken) return;
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: buildAuthHeaders(false),
      });
    } catch {
      // Abaikan error jaringan saat logout
    }
  },

  async me(): Promise<{ success?: boolean; user?: UserProfile; code?: string } | null> {
    if (!memoryToken) return null;
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: buildAuthHeaders(false),
      });
      return await parseJsonSafe<{ success?: boolean; user?: UserProfile; code?: string }>(res);
    } catch {
      return null;
    }
  },

  async changePwd(
    current: string,
    password: string
  ): Promise<{ success: boolean; token?: string; error?: string; code?: string }> {
    if (!memoryToken) {
      return { success: false, code: 'AUTH', error: 'Silakan masuk ke akun SQLite terlebih dahulu.' };
    }
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({ current, password }),
      });
      const body = await parseJsonSafe<{
        success?: boolean;
        token?: string;
        error?: string;
        code?: string;
      }>(res);
      if (res.ok && body?.success) {
        return { success: true, token: body.token };
      }
      return {
        success: false,
        code: body?.code,
        error: body?.error || 'Gagal mengganti password.',
      };
    } catch {
      return { success: false, error: 'Tidak dapat terhubung ke server SQLite lokal.' };
    }
  },

  async fetchCloudRaw(): Promise<ApiCloudFetchResult> {
    if (!memoryToken) {
      return { ok: false, data: null, unconfigured: true };
    }
    try {
      const res = await fetch('/api/data', {
        method: 'GET',
        headers: buildAuthHeaders(false),
      });
      const body = await parseJsonSafe<{
        success?: boolean;
        code?: string;
        error?: string;
        isEmpty?: boolean;
        data?: Partial<AppData> | null;
      }>(res);

      if (res.status === 401 || body?.code === 'AUTH') {
        return { ok: false, data: null, authExpired: true, error: 'Sesi login berakhir.' };
      }
      if (res.ok && body?.success) {
        const parsed = body.data || null;
        const isEmpty = Boolean(body.isEmpty) || !parsed || !Array.isArray(parsed.items) || parsed.items.length === 0;
        return { ok: true, data: parsed, isEmptyCloud: isEmpty };
      }
      return {
        ok: false,
        data: null,
        error: body?.error || 'Gagal membaca data dari database SQLite.',
      };
    } catch {
      return {
        ok: false,
        data: null,
        error: 'Tidak dapat terhubung ke server SQLite lokal.',
      };
    }
  },

  async save(data: AppData, isViewer: boolean): Promise<ApiSaveResult> {
    if (isViewer) {
      return { ok: false, mode: 'readonly' };
    }
    writeLocalCache(data);

    if (!memoryToken) {
      return { ok: true, mode: 'local' };
    }

    try {
      const res = await fetch('/api/data', {
        method: 'PUT',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({ data }),
      });
      const body = await parseJsonSafe<{
        success?: boolean;
        code?: string;
        savedAt?: string;
        error?: string;
      }>(res);

      if (res.status === 401 || body?.code === 'AUTH') {
        return { ok: false, mode: 'error', authExpired: true };
      }
      if (res.status === 403 || body?.code === 'FORBIDDEN') {
        return { ok: false, mode: 'readonly' };
      }
      if (res.ok && body?.success) {
        return { ok: true, mode: 'sqlite', savedAt: body.savedAt };
      }
      return { ok: false, mode: 'error', error: body?.error };
    } catch {
      return { ok: false, mode: 'offline' };
    }
  },

  async getSqliteInfo(): Promise<{
    ok: boolean;
    info?: SqliteDatabaseInfo;
    authExpired?: boolean;
    error?: string;
  }> {
    if (!memoryToken) {
      return { ok: false, error: 'Belum login ke SQLite.' };
    }
    try {
      const res = await fetch('/api/db/info', {
        method: 'GET',
        headers: buildAuthHeaders(false),
      });
      const body = await parseJsonSafe<{
        success?: boolean;
        code?: string;
        info?: SqliteDatabaseInfo;
        error?: string;
      }>(res);
      if (res.status === 401 || body?.code === 'AUTH') {
        return { ok: false, authExpired: true, error: 'Sesi login berakhir.' };
      }
      if (res.ok && body?.success && body.info) {
        return { ok: true, info: body.info };
      }
      return { ok: false, error: body?.error || 'Gagal membaca informasi SQLite.' };
    } catch {
      return { ok: false, error: 'Server SQLite tidak merespons.' };
    }
  },

  async vacuumSqlite(): Promise<{
    ok: boolean;
    info?: SqliteDatabaseInfo;
    authExpired?: boolean;
    error?: string;
  }> {
    if (!memoryToken) {
      return { ok: false, error: 'Silakan masuk sebagai Admin terlebih dahulu.' };
    }
    try {
      const res = await fetch('/api/db/vacuum', {
        method: 'POST',
        headers: buildAuthHeaders(false),
      });
      const body = await parseJsonSafe<{
        success?: boolean;
        code?: string;
        info?: SqliteDatabaseInfo;
        error?: string;
      }>(res);
      if (res.status === 401 || body?.code === 'AUTH') {
        return { ok: false, authExpired: true, error: 'Sesi login berakhir.' };
      }
      if (res.ok && body?.success && body.info) {
        return { ok: true, info: body.info };
      }
      return { ok: false, error: body?.error || 'Gagal mengoptimasi database SQLite.' };
    } catch {
      return { ok: false, error: 'Server SQLite tidak merespons.' };
    }
  },

  async downloadSqliteBackup(): Promise<{
    ok: boolean;
    fileName?: string;
    authExpired?: boolean;
    error?: string;
  }> {
    if (!memoryToken) {
      return { ok: false, error: 'Silakan masuk sebagai Admin untuk mengunduh backup .sqlite.' };
    }
    try {
      const res = await fetch('/api/db/export-sqlite', {
        method: 'GET',
        headers: buildAuthHeaders(false),
      });
      if (res.status === 401) {
        return { ok: false, authExpired: true, error: 'Sesi login berakhir.' };
      }
      if (!res.ok) {
        const body = await parseJsonSafe<{ error?: string }>(res);
        return { ok: false, error: body?.error || 'Gagal membuat file backup SQLite.' };
      }

      const blob = await res.blob();
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `doona-golf-backup-${dateStr}.sqlite`;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      return { ok: true, fileName };
    } catch {
      return { ok: false, error: 'Gagal mengunduh file backup SQLite.' };
    }
  },

  async importSqliteBackup(file: File): Promise<{
    ok: boolean;
    data?: Partial<AppData>;
    savedAt?: string;
    info?: SqliteDatabaseInfo;
    authExpired?: boolean;
    error?: string;
  }> {
    if (!memoryToken) {
      return {
        ok: false,
        error: 'Silakan masuk sebagai Admin untuk melakukan restore file .sqlite.',
      };
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const res = await fetch('/api/db/import-sqlite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          Authorization: `Bearer ${memoryToken}`,
        },
        body: arrayBuffer,
      });
      const body = await parseJsonSafe<{
        success?: boolean;
        code?: string;
        data?: Partial<AppData>;
        savedAt?: string;
        info?: SqliteDatabaseInfo;
        error?: string;
      }>(res);

      if (res.status === 401 || body?.code === 'AUTH') {
        return { ok: false, authExpired: true, error: 'Sesi login berakhir.' };
      }
      if (res.status === 403 || body?.code === 'FORBIDDEN') {
        return { ok: false, error: 'Hanya akun Admin yang dapat merestore database SQLite.' };
      }
      if (res.ok && body?.success && body.data) {
        return {
          ok: true,
          data: body.data,
          savedAt: body.savedAt,
          info: body.info,
        };
      }
      return {
        ok: false,
        error: body?.error || 'File SQLite ditolak oleh server.',
      };
    } catch {
      return {
        ok: false,
        error: 'Gagal mengirim file SQLite ke server lokal.',
      };
    }
  },

  async sendTelegram(_text: string): Promise<ApiTelegramResult> {
    return {
      success: false,
      error:
        'Mode database SQLite lokal berjalan offline tanpa jembatan Telegram. Gunakan tombol Salin untuk mengirim laporan via WhatsApp atau Telegram.',
    };
  },
};
