import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  AppData,
  AttendanceRecord,
  Employee,
  MasterItem,
  MonthStock,
  OmsetClosingRecord,
  OmsetDayRecord,
  ReportItemConfig,
  ShiftScheduleConfig,
  UserProfile,
} from '../src/types/app.ts';

export interface SqliteUserRow {
  id: number;
  username: string;
  nama: string;
  role: string;
  foto: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface SqliteDatabaseInfo {
  engine: string;
  dbPath: string;
  fileName: string;
  fileSizeBytes: number;
  journalMode: string;
  schemaVersion: number;
  lastSavedAt: string | null;
  counts: {
    items: number;
    stockAwal: number;
    stockDaily: number;
    employees: number;
    employeesArchived: number;
    attendance: number;
    omsetDays: number;
    omsetClosing: number;
    users: number;
  };
}

const SCHEMA_VERSION = 1;
const SESSION_TTL_DAYS = 14;

export function resolveSqliteDbPath(): string {
  const custom = (process.env.SQLITE_DB_PATH || '').trim();
  if (custom) {
    if (custom.startsWith('~/')) {
      return path.resolve(os.homedir(), custom.slice(2));
    }
    return path.resolve(custom);
  }

  // Linux desktop (.deb / AppImage) convention: use XDG_DATA_HOME when running packaged
  const xdg = (process.env.XDG_DATA_HOME || '').trim();
  if (process.env.NODE_ENV === 'production' && xdg) {
    return path.resolve(xdg, 'doona-golf', 'doona-golf.sqlite');
  }

  return path.resolve(process.cwd(), 'data', 'doona-golf.sqlite');
}

const DB_PATH = resolveSqliteDbPath();
const DB_DIR = path.dirname(DB_PATH);
fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');

function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      nama TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      foto TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS master_items (
      id TEXT PRIMARY KEY,
      kat TEXT NOT NULL,
      nama TEXT NOT NULL,
      sat TEXT NOT NULL,
      min_qty REAL NOT NULL DEFAULT 0,
      aktif INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS stock_awal (
      ym TEXT NOT NULL,
      item_id TEXT NOT NULL,
      qty REAL NOT NULL,
      PRIMARY KEY (ym, item_id)
    );

    CREATE TABLE IF NOT EXISTS stock_daily (
      ym TEXT NOT NULL,
      day INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('d', 'c')),
      item_id TEXT NOT NULL,
      qty REAL NOT NULL,
      PRIMARY KEY (ym, day, kind, item_id)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_daily_ym ON stock_daily(ym);

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      nama TEXT NOT NULL,
      jabatan TEXT NOT NULL DEFAULT '',
      foto TEXT NOT NULL DEFAULT '',
      gaji_harian REAL NOT NULL DEFAULT 0,
      tarif_lembur REAL NOT NULL DEFAULT 0,
      siklus TEXT NOT NULL DEFAULT '14hari',
      shift_default TEXT NOT NULL DEFAULT 'Full',
      aktif INTEGER NOT NULL DEFAULT 1,
      archived INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      ym TEXT NOT NULL,
      day INTEGER NOT NULL,
      emp_id TEXT NOT NULL,
      status TEXT NOT NULL,
      shift TEXT,
      jam_masuk TEXT,
      jam_pulang TEXT,
      lembur REAL NOT NULL DEFAULT 0,
      catatan TEXT,
      tarif_harian REAL,
      tarif_lembur REAL,
      updated_at TEXT,
      PRIMARY KEY (ym, day, emp_id)
    );
    CREATE INDEX IF NOT EXISTS idx_attendance_ym ON attendance_records(ym);

    CREATE TABLE IF NOT EXISTS omset_days (
      date_key TEXT PRIMARY KEY,
      tn REAL,
      qn REAL,
      qr REAL,
      tl REAL,
      kx_json TEXT NOT NULL DEFAULT '[]',
      bx_json TEXT NOT NULL DEFAULT '[]',
      kt TEXT,
      kq TEXT,
      cn TEXT
    );

    CREATE TABLE IF NOT EXISTS omset_closing (
      period_key TEXT PRIMARY KEY,
      closed_at TEXT NOT NULL,
      closed_by TEXT NOT NULL,
      snap_json TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO meta (key, value, updated_at)
     VALUES ('schema_version', ?, ?)
     ON CONFLICT(key) DO NOTHING`
  ).run(String(SCHEMA_VERSION), now);
}

initSchema();

// ─────────────────── PASSWORD & SESSION HELPERS ───────────────────

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPasswordHash(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function timingSafeTextEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toUserProfile(row: SqliteUserRow): UserProfile {
  return {
    username: row.username,
    nama: row.nama,
    foto: row.foto || undefined,
    role: row.role === 'viewer' ? 'viewer' : 'admin',
  };
}

export function isEnvAdminConfigured(): boolean {
  return Boolean((process.env.DOONA_ADMIN_PASSWORD || '').trim());
}

export function getUserCount(): number {
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
  return row.cnt;
}

export function isAdminConfigured(): boolean {
  return isEnvAdminConfigured() || getUserCount() > 0;
}

export function setupInitialAdmin(
  username: string,
  nama: string,
  password: string
): { ok: true; user: UserProfile; userId: number } | { ok: false; error: string } {
  if (isEnvAdminConfigured()) {
    return {
      ok: false,
      error: 'Password admin dikelola melalui variabel lingkungan DOONA_ADMIN_PASSWORD.',
    };
  }

  const cleanUser = username.trim();
  const cleanName = nama.trim() || cleanUser;
  if (cleanUser.length < 2 || cleanUser.length > 40) {
    return { ok: false, error: 'Username harus 2 hingga 40 karakter.' };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(cleanUser)) {
    return { ok: false, error: 'Username hanya boleh huruf, angka, titik, garis bawah, atau strip.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Password minimal 6 karakter.' };
  }

  const runSetup = db.transaction(() => {
    const existing = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
    if (existing.cnt > 0) {
      return null;
    }
    const now = new Date().toISOString();
    const hash = hashPassword(password);
    const info = db
      .prepare(
        `INSERT INTO users (username, nama, role, foto, password_hash, created_at, updated_at)
         VALUES (?, ?, 'admin', '', ?, ?, ?)`
      )
      .run(cleanUser, cleanName, hash, now, now);

    return {
      userId: Number(info.lastInsertRowid),
      user: {
        username: cleanUser,
        nama: cleanName,
        role: 'admin' as const,
      },
    };
  });

  const created = runSetup();
  if (!created) {
    return { ok: false, error: 'Akun admin awal sudah dibuat. Silakan login.' };
  }
  return { ok: true, user: created.user, userId: created.userId };
}

export function verifyUserCredentials(
  username: string,
  password: string
): { ok: true; user: UserProfile; userId: number } | { ok: false; error: string } {
  const cleanUser = username.trim();
  if (!cleanUser || !password) {
    return { ok: false, error: 'Username dan password wajib diisi.' };
  }

  // Env-configured admin passcode always overrides claimed fallback hash
  const envPwd = (process.env.DOONA_ADMIN_PASSWORD || '').trim();
  const envUser = (process.env.DOONA_ADMIN_USERNAME || 'admin').trim();
  if (envPwd && cleanUser.toLowerCase() === envUser.toLowerCase()) {
    if (!timingSafeTextEqual(password, envPwd)) {
      return { ok: false, error: 'Username atau password salah.' };
    }
    const existing = db
      .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
      .get(envUser) as SqliteUserRow | undefined;
    if (existing) {
      return { ok: true, user: toUserProfile(existing), userId: existing.id };
    }
    const now = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO users (username, nama, role, foto, password_hash, created_at, updated_at)
         VALUES (?, ?, 'admin', '', ?, ?, ?)`
      )
      .run(envUser, 'Administrator', hashPassword(envPwd), now, now);
    return {
      ok: true,
      userId: Number(info.lastInsertRowid),
      user: { username: envUser, nama: 'Administrator', role: 'admin' },
    };
  }

  const row = db
    .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
    .get(cleanUser) as SqliteUserRow | undefined;

  if (!row || !verifyPasswordHash(password, row.password_hash)) {
    return { ok: false, error: 'Username atau password salah.' };
  }

  return { ok: true, user: toUserProfile(row), userId: row.id };
}

export function createSession(userId: number, ttlDays = SESSION_TTL_DAYS): string {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const now = new Date();
  const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now.toISOString());
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(tokenHash, userId, expires.toISOString(), now.toISOString());

  return token;
}

export function getSessionUser(token: string): { userId: number; user: UserProfile } | null {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const nowIso = new Date().toISOString();
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .get(tokenHash, nowIso) as SqliteUserRow | undefined;

  if (!row) return null;
  return { userId: row.id, user: toUserProfile(row) };
}

export function revokeSession(token: string): void {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function changeUserPassword(
  userId: number,
  currentPwd: string,
  nextPwd: string
): { ok: true; token: string } | { ok: false; error: string } {
  if (isEnvAdminConfigured()) {
    return {
      ok: false,
      error: 'Password admin dikelola oleh DOONA_ADMIN_PASSWORD di konfigurasi server.',
    };
  }
  if (!nextPwd || nextPwd.length < 6) {
    return { ok: false, error: 'Password baru minimal 6 karakter.' };
  }
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as
    | SqliteUserRow
    | undefined;
  if (!row) {
    return { ok: false, error: 'Akun pengguna tidak ditemukan.' };
  }
  if (!verifyPasswordHash(currentPwd, row.password_hash)) {
    return { ok: false, error: 'Password saat ini tidak sesuai.' };
  }

  const now = new Date().toISOString();
  const newHash = hashPassword(nextPwd);
  const newToken = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      newHash,
      now,
      userId
    );
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    return createSession(userId);
  })();

  return { ok: true, token: newToken };
}

// ─────────────────── RELATIONAL APP DATA REPOSITORY ───────────────────

function readMetaJson<T>(sourceDb: Database.Database, key: string): T | undefined {
  const row = sourceDb.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  if (!row) return undefined;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return undefined;
  }
}

function getTableColumns(sourceDb: Database.Database, tableName: string): Set<string> {
  const allowedTables = new Set(['employees', 'attendance_records']);
  if (!allowedTables.has(tableName)) return new Set();
  const rows = sourceDb.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

function readAppDataFromDb(sourceDb: Database.Database): Partial<AppData> | null {
  const initRow = sourceDb.prepare("SELECT value FROM meta WHERE key = 'initialized'").get() as
    | { value: string }
    | undefined;

  const itemRows = sourceDb
    .prepare('SELECT id, kat, nama, sat, min_qty, aktif FROM master_items ORDER BY sort_order ASC')
    .all() as Array<{
    id: string;
    kat: string;
    nama: string;
    sat: string;
    min_qty: number;
    aktif: number;
  }>;

  if (!initRow && itemRows.length === 0) {
    return null;
  }

  const items: MasterItem[] = itemRows.map((r) => ({
    id: r.id,
    kat: r.kat,
    nama: r.nama,
    sat: r.sat,
    min: Number(r.min_qty) || 0,
    aktif: Number(r.aktif) ? 1 : 0,
  }));

  const m: Record<string, MonthStock> = {};
  const ensureMonth = (ym: string): MonthStock => {
    if (!m[ym]) m[ym] = { a: {}, d: {}, c: {} };
    return m[ym];
  };

  const awalRows = sourceDb.prepare('SELECT ym, item_id, qty FROM stock_awal').all() as Array<{
    ym: string;
    item_id: string;
    qty: number;
  }>;
  for (const r of awalRows) {
    ensureMonth(r.ym).a[r.item_id] = Number(r.qty);
  }

  const dailyRows = sourceDb
    .prepare('SELECT ym, day, kind, item_id, qty FROM stock_daily')
    .all() as Array<{
    ym: string;
    day: number;
    kind: 'd' | 'c';
    item_id: string;
    qty: number;
  }>;
  for (const r of dailyRows) {
    const month = ensureMonth(r.ym);
    const bucket = month[r.kind];
    if (!bucket[r.day]) bucket[r.day] = {};
    bucket[r.day][r.item_id] = Number(r.qty);
  }

  const empCols = getTableColumns(sourceDb, 'employees');
  const hasEmpAktif = empCols.has('aktif');
  const empRows = sourceDb
    .prepare(
      hasEmpAktif
        ? `SELECT id, nama, jabatan, foto, gaji_harian, tarif_lembur, siklus, shift_default, aktif, archived
           FROM employees ORDER BY sort_order ASC`
        : `SELECT id, nama, jabatan, foto, gaji_harian, tarif_lembur, siklus, shift_default, 1 AS aktif, archived
           FROM employees ORDER BY sort_order ASC`
    )
    .all() as Array<{
    id: string;
    nama: string;
    jabatan: string;
    foto: string;
    gaji_harian: number;
    tarif_lembur: number;
    siklus: string;
    shift_default: string;
    aktif: number;
    archived: number;
  }>;

  const karyawan: Employee[] = [];
  const karyawanArsip: Employee[] = [];
  for (const r of empRows) {
    const emp: Employee = {
      id: r.id,
      nama: r.nama,
      jabatan: r.jabatan || '',
      foto: r.foto || '',
      gajiHarian: Number(r.gaji_harian) || 0,
      lemburPerPaket: Number(r.tarif_lembur) || 0,
      siklusGaji: r.siklus === 'bulanan' ? 'bulanan' : '14hari',
      shiftDefault:
        r.shift_default === 'Pagi' ||
        r.shift_default === 'Siang' ||
        r.shift_default === 'Fleksibel'
          ? r.shift_default
          : 'Full',
      aktif: Number(r.aktif) ? 1 : 0,
    };
    if (r.archived) karyawanArsip.push(emp);
    else karyawan.push(emp);
  }

  const attCols = getTableColumns(sourceDb, 'attendance_records');
  const hasAttUpdatedAt = attCols.has('updated_at');
  const absensi: Record<string, Record<number, Record<string, AttendanceRecord>>> = {};
  const attRows = sourceDb
    .prepare(
      hasAttUpdatedAt
        ? `SELECT ym, day, emp_id, status, shift, jam_masuk, jam_pulang, lembur, catatan, tarif_harian, tarif_lembur, updated_at
           FROM attendance_records`
        : `SELECT ym, day, emp_id, status, shift, jam_masuk, jam_pulang, lembur, catatan, tarif_harian, tarif_lembur, NULL AS updated_at
           FROM attendance_records`
    )
    .all() as Array<{
    ym: string;
    day: number;
    emp_id: string;
    status: string;
    shift: string | null;
    jam_masuk: string | null;
    jam_pulang: string | null;
    lembur: number;
    catatan: string | null;
    tarif_harian: number | null;
    tarif_lembur: number | null;
    updated_at: string | null;
  }>;

  for (const r of attRows) {
    if (!absensi[r.ym]) absensi[r.ym] = {};
    if (!absensi[r.ym][r.day]) absensi[r.ym][r.day] = {};
    const rec: AttendanceRecord = {
      status: r.status as AttendanceRecord['status'],
      lembur: Number(r.lembur) || 0,
    };
    if (r.shift) rec.shift = r.shift as AttendanceRecord['shift'];
    if (r.jam_masuk) rec.checkIn = r.jam_masuk;
    if (r.jam_pulang) rec.checkOut = r.jam_pulang;
    if (r.catatan) rec.catatan = r.catatan;
    if (r.updated_at) rec.updatedAt = r.updated_at;
    if (r.tarif_harian !== null && r.tarif_harian !== undefined) {
      rec.gajiHarian = Number(r.tarif_harian);
    }
    if (r.tarif_lembur !== null && r.tarif_lembur !== undefined) {
      rec.lemburPerPaket = Number(r.tarif_lembur);
    }
    absensi[r.ym][r.day][r.emp_id] = rec;
  }

  const omsetDays: Record<string, OmsetDayRecord> = {};
  const omRows = sourceDb
    .prepare('SELECT date_key, tn, qn, qr, tl, kx_json, bx_json, kt, kq, cn FROM omset_days')
    .all() as Array<{
    date_key: string;
    tn: number | null;
    qn: number | null;
    qr: number | null;
    tl: number | null;
    kx_json: string;
    bx_json: string;
    kt: string | null;
    kq: string | null;
    cn: string | null;
  }>;

  for (const r of omRows) {
    const rec: OmsetDayRecord = {};
    if (r.tn !== null) rec.tn = Number(r.tn);
    if (r.qn !== null) rec.qn = Number(r.qn);
    if (r.qr !== null) rec.qr = Number(r.qr);
    if (r.tl !== null) rec.tl = Number(r.tl);
    try {
      const kx = JSON.parse(r.kx_json);
      if (Array.isArray(kx) && kx.length > 0) rec.kx = kx;
    } catch {
      // ignore malformed json
    }
    try {
      const bx = JSON.parse(r.bx_json);
      if (Array.isArray(bx) && bx.length > 0) rec.bx = bx;
    } catch {
      // ignore malformed json
    }
    if (r.kt !== null) rec.kt = r.kt;
    if (r.kq !== null) rec.kq = r.kq;
    if (r.cn !== null) rec.cn = r.cn;
    omsetDays[r.date_key] = rec;
  }

  const omsetClosing: Record<string, OmsetClosingRecord> = {};
  const closingRows = sourceDb
    .prepare('SELECT period_key, closed_at, closed_by, snap_json FROM omset_closing')
    .all() as Array<{
    period_key: string;
    closed_at: string;
    closed_by: string;
    snap_json: string;
  }>;
  for (const r of closingRows) {
    try {
      omsetClosing[r.period_key] = {
        at: r.closed_at,
        by: r.closed_by,
        snap: JSON.parse(r.snap_json),
      };
    } catch {
      // ignore
    }
  }

  return {
    items,
    satuan: readMetaJson<string[]>(sourceDb, 'satuan'),
    repCfg: readMetaJson<Record<string, ReportItemConfig>>(sourceDb, 'rep_cfg'),
    shiftConfig: readMetaJson<Partial<ShiftScheduleConfig>>(sourceDb, 'shift_config'),
    m,
    karyawan,
    karyawanArsip,
    absensi,
    omset: {
      days: omsetDays,
      closing: omsetClosing,
    },
  };
}

export function readAppData(): Partial<AppData> | null {
  return readAppDataFromDb(db);
}

export function writeAppData(data: AppData): string {
  const now = new Date().toISOString();

  const upsertMeta = db.prepare(
    `INSERT INTO meta (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );
  const insertItem = db.prepare(
    `INSERT INTO master_items (id, kat, nama, sat, min_qty, aktif, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertAwal = db.prepare(
    `INSERT INTO stock_awal (ym, item_id, qty) VALUES (?, ?, ?)`
  );
  const insertDaily = db.prepare(
    `INSERT INTO stock_daily (ym, day, kind, item_id, qty) VALUES (?, ?, ?, ?, ?)`
  );
  const insertEmp = db.prepare(
    `INSERT INTO employees (id, nama, jabatan, foto, gaji_harian, tarif_lembur, siklus, shift_default, aktif, archived, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertAtt = db.prepare(
    `INSERT INTO attendance_records (ym, day, emp_id, status, shift, jam_masuk, jam_pulang, lembur, catatan, tarif_harian, tarif_lembur, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertOmsetDay = db.prepare(
    `INSERT INTO omset_days (date_key, tn, qn, qr, tl, kx_json, bx_json, kt, kq, cn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertOmsetClosing = db.prepare(
    `INSERT INTO omset_closing (period_key, closed_at, closed_by, snap_json)
     VALUES (?, ?, ?, ?)`
  );

  const tx = db.transaction((payload: AppData) => {
    db.prepare('DELETE FROM master_items').run();
    (payload.items || []).forEach((item, idx) => {
      if (!item || !item.id) return;
      insertItem.run(
        String(item.id),
        String(item.kat || 'Lainnya'),
        String(item.nama || ''),
        String(item.sat || 'pcs'),
        Number(item.min) || 0,
        Number(item.aktif) === 0 ? 0 : 1,
        idx
      );
    });

    db.prepare('DELETE FROM stock_awal').run();
    db.prepare('DELETE FROM stock_daily').run();
    const months = payload.m || {};
    for (const [ym, stock] of Object.entries(months)) {
      if (!stock || typeof stock !== 'object') continue;
      for (const [itemId, qty] of Object.entries(stock.a || {})) {
        if (qty !== undefined && qty !== null && Number.isFinite(Number(qty))) {
          insertAwal.run(ym, itemId, Number(qty));
        }
      }
      for (const kind of ['d', 'c'] as const) {
        const dayMap = stock[kind] || {};
        for (const [dayKey, itemMap] of Object.entries(dayMap)) {
          const dayNum = Number(dayKey);
          if (!Number.isInteger(dayNum) || !itemMap || typeof itemMap !== 'object') continue;
          for (const [itemId, qty] of Object.entries(itemMap)) {
            if (qty !== undefined && qty !== null && Number.isFinite(Number(qty))) {
              insertDaily.run(ym, dayNum, kind, itemId, Number(qty));
            }
          }
        }
      }
    }

    db.prepare('DELETE FROM employees').run();
    const seenEmpIds = new Set<string>();
    (payload.karyawan || []).forEach((emp, idx) => {
      if (!emp || !emp.id || seenEmpIds.has(emp.id)) return;
      seenEmpIds.add(emp.id);
      insertEmp.run(
        String(emp.id),
        String(emp.nama || ''),
        String(emp.jabatan || ''),
        String(emp.foto || ''),
        Number(emp.gajiHarian) || 0,
        Number(emp.lemburPerPaket) || 0,
        emp.siklusGaji === 'bulanan' ? 'bulanan' : '14hari',
        String(emp.shiftDefault || 'Full'),
        Number(emp.aktif) === 0 ? 0 : 1,
        0,
        idx
      );
    });
    (payload.karyawanArsip || []).forEach((emp, idx) => {
      if (!emp || !emp.id || seenEmpIds.has(emp.id)) return;
      seenEmpIds.add(emp.id);
      insertEmp.run(
        String(emp.id),
        String(emp.nama || ''),
        String(emp.jabatan || ''),
        String(emp.foto || ''),
        Number(emp.gajiHarian) || 0,
        Number(emp.lemburPerPaket) || 0,
        emp.siklusGaji === 'bulanan' ? 'bulanan' : '14hari',
        String(emp.shiftDefault || 'Full'),
        0,
        1,
        idx
      );
    });

    db.prepare('DELETE FROM attendance_records').run();
    const absensi = payload.absensi || {};
    for (const [ym, dayMap] of Object.entries(absensi)) {
      if (!dayMap || typeof dayMap !== 'object') continue;
      for (const [dayKey, empMap] of Object.entries(dayMap)) {
        const dayNum = Number(dayKey);
        if (!Number.isInteger(dayNum) || !empMap || typeof empMap !== 'object') continue;
        for (const [empId, rec] of Object.entries(empMap)) {
          if (!rec || !rec.status) continue;
          insertAtt.run(
            ym,
            dayNum,
            empId,
            String(rec.status),
            rec.shift ? String(rec.shift) : null,
            rec.checkIn ? String(rec.checkIn) : null,
            rec.checkOut ? String(rec.checkOut) : null,
            Number(rec.lembur) || 0,
            rec.catatan ? String(rec.catatan) : null,
            rec.gajiHarian !== undefined && rec.gajiHarian !== null ? Number(rec.gajiHarian) : null,
            rec.lemburPerPaket !== undefined && rec.lemburPerPaket !== null
              ? Number(rec.lemburPerPaket)
              : null,
            rec.updatedAt ? String(rec.updatedAt) : null
          );
        }
      }
    }

    db.prepare('DELETE FROM omset_days').run();
    const omDays = payload.omset?.days || {};
    for (const [dateKey, rec] of Object.entries(omDays)) {
      if (!rec || typeof rec !== 'object') continue;
      insertOmsetDay.run(
        dateKey,
        rec.tn !== undefined && rec.tn !== null ? Number(rec.tn) : null,
        rec.qn !== undefined && rec.qn !== null ? Number(rec.qn) : null,
        rec.qr !== undefined && rec.qr !== null ? Number(rec.qr) : null,
        rec.tl !== undefined && rec.tl !== null ? Number(rec.tl) : null,
        JSON.stringify(Array.isArray(rec.kx) ? rec.kx : []),
        JSON.stringify(Array.isArray(rec.bx) ? rec.bx : []),
        rec.kt !== undefined && rec.kt !== null ? String(rec.kt) : null,
        rec.kq !== undefined && rec.kq !== null ? String(rec.kq) : null,
        rec.cn !== undefined && rec.cn !== null ? String(rec.cn) : null
      );
    }

    db.prepare('DELETE FROM omset_closing').run();
    const omClosing = payload.omset?.closing || {};
    for (const [periodKey, rec] of Object.entries(omClosing)) {
      if (!rec || typeof rec !== 'object') continue;
      insertOmsetClosing.run(
        periodKey,
        String(rec.at || now),
        String(rec.by || '-'),
        JSON.stringify(rec.snap || {})
      );
    }

    upsertMeta.run('satuan', JSON.stringify(payload.satuan || []), now);
    upsertMeta.run('rep_cfg', JSON.stringify(payload.repCfg || {}), now);
    upsertMeta.run('shift_config', JSON.stringify(payload.shiftConfig || {}), now);
    upsertMeta.run('initialized', '1', now);
    upsertMeta.run('last_saved_at', now, now);
  });

  tx(data);
  return now;
}

// ─────────────────── INFO, VACUUM & SAFE BACKUP ───────────────────

export function getDatabaseInfo(): SqliteDatabaseInfo {
  const countOf = (sql: string): number => {
    const r = db.prepare(sql).get() as { cnt: number };
    return r?.cnt ?? 0;
  };

  let fileSizeBytes = 0;
  try {
    fileSizeBytes = fs.statSync(DB_PATH).size;
  } catch {
    fileSizeBytes = 0;
  }

  const journalRow = db.pragma('journal_mode', { simple: true });
  const lastSavedRow = db.prepare("SELECT value FROM meta WHERE key = 'last_saved_at'").get() as
    | { value: string }
    | undefined;

  return {
    engine: 'SQLite 3 (better-sqlite3)',
    dbPath: DB_PATH,
    fileName: path.basename(DB_PATH),
    fileSizeBytes,
    journalMode: String(journalRow || 'wal').toUpperCase(),
    schemaVersion: SCHEMA_VERSION,
    lastSavedAt: lastSavedRow?.value || null,
    counts: {
      items: countOf('SELECT COUNT(*) AS cnt FROM master_items'),
      stockAwal: countOf('SELECT COUNT(*) AS cnt FROM stock_awal'),
      stockDaily: countOf('SELECT COUNT(*) AS cnt FROM stock_daily'),
      employees: countOf('SELECT COUNT(*) AS cnt FROM employees WHERE archived = 0'),
      employeesArchived: countOf('SELECT COUNT(*) AS cnt FROM employees WHERE archived = 1'),
      attendance: countOf('SELECT COUNT(*) AS cnt FROM attendance_records'),
      omsetDays: countOf('SELECT COUNT(*) AS cnt FROM omset_days'),
      omsetClosing: countOf('SELECT COUNT(*) AS cnt FROM omset_closing'),
      users: countOf('SELECT COUNT(*) AS cnt FROM users'),
    },
  };
}

export function vacuumDatabase(): SqliteDatabaseInfo {
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.exec('VACUUM');
  return getDatabaseInfo();
}

export async function createSafeBackupFile(): Promise<string> {
  const safeName = `backup-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.sqlite`;
  const targetPath = path.resolve(DB_DIR, safeName);
  if (!targetPath.startsWith(DB_DIR + path.sep)) {
    throw new Error('Invalid backup path.');
  }
  await db.backup(targetPath);
  return targetPath;
}

const SQLITE_MAGIC_HEADER = Buffer.from('SQLite format 3\0', 'utf8');
const MAX_SQLITE_IMPORT_BYTES = 25 * 1024 * 1024; // 25 MB
const REQUIRED_APP_TABLES = [
  'meta',
  'master_items',
  'stock_awal',
  'stock_daily',
  'employees',
  'attendance_records',
  'omset_days',
  'omset_closing',
];

export function inspectAndImportSqliteBuffer(
  buffer: Buffer
):
  | { ok: true; data: Partial<AppData>; savedAt: string; info: SqliteDatabaseInfo }
  | { ok: false; error: string } {
  if (!Buffer.isBuffer(buffer) || buffer.length < 100) {
    return { ok: false, error: 'File SQLite kosong atau tidak valid.' };
  }
  if (buffer.length > MAX_SQLITE_IMPORT_BYTES) {
    return { ok: false, error: 'Ukuran file SQLite melebihi batas maksimal 25 MB.' };
  }
  if (!buffer.subarray(0, 16).equals(SQLITE_MAGIC_HEADER)) {
    return {
      ok: false,
      error: 'Format file tidak dikenali sebagai database SQLite 3 yang valid.',
    };
  }

  const safeTempName = `import-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.sqlite`;
  const tempPath = path.resolve(DB_DIR, safeTempName);
  if (!tempPath.startsWith(DB_DIR + path.sep)) {
    return { ok: false, error: 'Path sementara tidak valid.' };
  }

  let uploadedDb: Database.Database | null = null;
  try {
    fs.writeFileSync(tempPath, buffer, { mode: 0o600 });
    uploadedDb = new Database(tempPath, { readonly: true, fileMustExist: true });

    const checkResult = uploadedDb.pragma('quick_check', { simple: true });
    if (String(checkResult || '').toLowerCase() !== 'ok') {
      return {
        ok: false,
        error: 'File SQLite terdeteksi rusak (gagal lolos pemeriksaan integritas).',
      };
    }

    const tableRows = uploadedDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const existingTables = new Set(tableRows.map((r) => r.name));
    const missing = REQUIRED_APP_TABLES.filter((t) => !existingTables.has(t));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Struktur tabel tidak sesuai database DOONA GOLF (tabel tidak ditemukan: ${missing.join(', ')}).`,
      };
    }

    const extracted = readAppDataFromDb(uploadedDb);
    if (!extracted) {
      return {
        ok: false,
        error: 'File SQLite tersebut masih kosong dan belum memiliki data operasional.',
      };
    }

    const savedAt = writeAppData({
      items: extracted.items || [],
      satuan: extracted.satuan || [],
      repCfg: extracted.repCfg || {},
      m: extracted.m || {},
      karyawan: extracted.karyawan || [],
      karyawanArsip: extracted.karyawanArsip || [],
      absensi: extracted.absensi || {},
      shiftConfig: extracted.shiftConfig,
      omset: extracted.omset || { days: {}, closing: {} },
    });

    return {
      ok: true,
      data: extracted,
      savedAt,
      info: getDatabaseInfo(),
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Kesalahan membaca file SQLite.';
    return { ok: false, error: `Gagal memulihkan file SQLite: ${detail}` };
  } finally {
    if (uploadedDb) {
      try {
        uploadedDb.close();
      } catch {
        // ignore close error
      }
    }
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      // ignore cleanup error
    }
  }
}
