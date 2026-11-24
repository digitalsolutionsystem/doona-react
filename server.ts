import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  changeUserPassword,
  createSafeBackupFile,
  createSession,
  getDatabaseInfo,
  getSessionUser,
  inspectAndImportSqliteBuffer,
  isAdminConfigured,
  isEnvAdminConfigured,
  readAppData,
  revokeSession,
  setupInitialAdmin,
  vacuumDatabase,
  verifyUserCredentials,
  writeAppData,
} from './server/db.ts';
import type { AppData, UserProfile } from './src/types/app.ts';

interface AuthenticatedRequest extends Request {
  authUser?: UserProfile;
  authUserId?: number;
  authToken?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

function extractBearerToken(req: Request): string {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  const session = getSessionUser(token);
  if (!session) {
    res.status(401).json({ success: false, code: 'AUTH', error: 'Sesi login tidak valid atau telah berakhir.' });
    return;
  }
  req.authUser = session.user;
  req.authUserId = session.userId;
  req.authToken = token;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser || req.authUser.role !== 'admin') {
    res.status(403).json({ success: false, code: 'FORBIDDEN', error: 'Akses hanya untuk akun Admin.' });
    return;
  }
  next();
}

async function startServer(): Promise<void> {
  const app = express();

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  app.use(express.json({ limit: '15mb' }));

  // ─────────────────── PUBLIC HEALTH & FIRST-RUN STATUS ───────────────────
  app.get('/api/health', (_req, res) => {
    const info = getDatabaseInfo();
    res.json({
      ok: true,
      engine: 'sqlite',
      needsSetup: !isAdminConfigured(),
      envPasswordManaged: isEnvAdminConfigured(),
      dbFileName: info.fileName,
    });
  });

  // ─────────────────── AUTHENTICATION ROUTES ───────────────────
  app.post('/api/auth/setup', (req, res) => {
    const body = req.body as { username?: unknown; nama?: unknown; password?: unknown } | undefined;
    const username = typeof body?.username === 'string' ? body.username : '';
    const nama = typeof body?.nama === 'string' ? body.nama : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    const result = setupInitialAdmin(username, nama, password);
    if (!result.ok) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    const token = createSession(result.userId);
    res.status(201).json({
      success: true,
      token,
      user: result.user,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const body = req.body as { username?: unknown; password?: unknown } | undefined;
    const username = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!isAdminConfigured()) {
      res.status(409).json({
        success: false,
        code: 'NEEDS_SETUP',
        error: 'Akun admin belum dibuat. Silakan buat akun admin pertama kali.',
      });
      return;
    }

    const result = verifyUserCredentials(username, password);
    if (!result.ok) {
      res.status(401).json({ success: false, error: result.error });
      return;
    }

    const token = createSession(result.userId);
    res.json({
      success: true,
      token,
      user: result.user,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractBearerToken(req);
    if (token) revokeSession(token);
    res.json({ success: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({
      success: true,
      user: req.authUser,
    });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    const body = req.body as { current?: unknown; password?: unknown } | undefined;
    const current = typeof body?.current === 'string' ? body.current : '';
    const nextPwd = typeof body?.password === 'string' ? body.password : '';

    if (!req.authUserId) {
      res.status(401).json({ success: false, code: 'AUTH', error: 'Sesi tidak valid.' });
      return;
    }

    const result = changeUserPassword(req.authUserId, current, nextPwd);
    if (!result.ok) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({
      success: true,
      token: result.token,
    });
  });

  // ─────────────────── SQLITE DATA & MAINTENANCE ROUTES ───────────────────
  app.get('/api/db/info', requireAuth, (_req, res) => {
    res.json({
      success: true,
      info: getDatabaseInfo(),
    });
  });

  app.get('/api/data', requireAuth, (_req, res) => {
    const data = readAppData();
    res.json({
      success: true,
      isEmpty: !data,
      data,
    });
  });

  app.put('/api/data', requireAuth, requireAdmin, (req, res) => {
    const body = req.body as { data?: unknown } | undefined;
    const payload = body?.data;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      res.status(400).json({ success: false, error: 'Payload data aplikasi tidak valid.' });
      return;
    }
    const candidate = payload as Partial<AppData>;
    if (!Array.isArray(candidate.items)) {
      res.status(400).json({ success: false, error: 'Daftar master item harus berupa array.' });
      return;
    }

    try {
      const savedAt = writeAppData(candidate as AppData);
      res.json({ success: true, savedAt });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan data ke SQLite.';
      res.status(500).json({ success: false, error: msg });
    }
  });

  app.post('/api/db/vacuum', requireAuth, requireAdmin, (_req, res) => {
    try {
      const info = vacuumDatabase();
      res.json({ success: true, info });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menjalankan optimasi SQLite.';
      res.status(500).json({ success: false, error: msg });
    }
  });

  app.get('/api/db/export-sqlite', requireAuth, requireAdmin, async (_req, res) => {
    let tempPath: string | null = null;
    try {
      tempPath = await createSafeBackupFile();
      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/vnd.sqlite3');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="doona-golf-backup-${dateStr}.sqlite"`
      );

      const stream = fs.createReadStream(tempPath);
      const cleanup = () => {
        if (tempPath) {
          const p = tempPath;
          tempPath = null;
          fs.unlink(p, () => {});
        }
      };
      res.on('finish', cleanup);
      res.on('close', cleanup);
      stream.on('error', () => {
        cleanup();
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Gagal membaca file backup SQLite.' });
        }
      });
      stream.pipe(res);
    } catch (err) {
      if (tempPath) fs.unlink(tempPath, () => {});
      const msg = err instanceof Error ? err.message : 'Gagal membuat backup SQLite.';
      res.status(500).json({ success: false, error: msg });
    }
  });

  app.post(
    '/api/db/import-sqlite',
    requireAuth,
    requireAdmin,
    express.raw({
      type: [
        'application/octet-stream',
        'application/vnd.sqlite3',
        'application/x-sqlite3',
      ],
      limit: '25mb',
    }),
    (req, res) => {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({
          success: false,
          error: 'File SQLite tidak diterima atau kosong.',
        });
        return;
      }

      const result = inspectAndImportSqliteBuffer(req.body);
      if (!result.ok) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        data: result.data,
        savedAt: result.savedAt,
        info: result.info,
      });
    }
  );

  // ─────────────────── FRONTEND SERVING (DEV VITE / PROD DIST) ───────────────────
  const distDir = path.resolve(__dirname, 'dist');
  const distIndex = path.join(distDir, 'index.html');
  const isProd =
    process.env.NODE_ENV === 'production' ||
    (!process.env.VITE_DEV_SERVER && fs.existsSync(distIndex));

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir, { index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(distIndex);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    const info = getDatabaseInfo();
    console.log(`DOONA GOLF server listening on http://0.0.0.0:${PORT} (SQLite: ${info.dbPath})`);
  });
}

void startServer();
