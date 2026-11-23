export const DEFAULT_ACCENT_HEX = '#2eb86b';

const ACCENT_STORAGE_KEY = 'dg_accent_color_v1';
const RECENT_ACCENTS_KEY = 'dg_accent_recent_v1';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HsvColor {
  h: number; // 0..360
  s: number; // 0..100
  v: number; // 0..100
}

export interface HslColor {
  h: number; // 0..360
  s: number; // 0..100
  l: number; // 0..100
}

export interface AccentPalette {
  accent: string;
  hover: string;
  dark: string;
  deep: string;
  soft: string;
  soft2: string;
  softHover: string;
  border: string;
  ring20: string;
  fg: string;
  buttonContrast: number;
  textContrast: number;
}

export interface AccentFamily {
  name: string;
  shades: string[];
}

export interface AccentPreset {
  name: string;
  hex: string;
}

/** Curated named presets covering classic operational themes */
export const ACCENT_PRESETS: AccentPreset[] = [
  { name: 'Hijau Golf (Default)', hex: '#2eb86b' },
  { name: 'Tosca Clubhouse', hex: '#14a38b' },
  { name: 'Biru Laut', hex: '#2563eb' },
  { name: 'Biru Langit', hex: '#0284c7' },
  { name: 'Indigo Elegan', hex: '#4f46e5' },
  { name: 'Ungu Royal', hex: '#7c3aed' },
  { name: 'Rose Modern', hex: '#e11d48' },
  { name: 'Merah Marun', hex: '#b91c1c' },
  { name: 'Oranye Hangat', hex: '#ea580c' },
  { name: 'Amber Emas', hex: '#d97706' },
  { name: 'Zaitun Klasik', hex: '#65a30d' },
  { name: 'Slate Grafit', hex: '#334155' },
];

/** Complete 10-family x 6-shade full-spectrum color matrix (60 curated tones) */
export const FULL_COLOR_FAMILIES: AccentFamily[] = [
  {
    name: 'Hijau Emerald',
    shades: ['#14532d', '#15803d', '#16a34a', '#2eb86b', '#10b981', '#34d399'],
  },
  {
    name: 'Tosca & Cyan',
    shades: ['#134e4a', '#0f766e', '#0d9488', '#14a38b', '#0891b2', '#06b6d4'],
  },
  {
    name: 'Biru & Cobalt',
    shades: ['#1e3a8a', '#1d4ed8', '#2563eb', '#0284c7', '#3b82f6', '#0ea5e9'],
  },
  {
    name: 'Indigo & Violet',
    shades: ['#312e81', '#4338ca', '#4f46e5', '#6366f1', '#7c3aed', '#8b5cf6'],
  },
  {
    name: 'Ungu & Fuchsia',
    shades: ['#581c87', '#7e22ce', '#9333ea', '#a21caf', '#c026d3', '#d946ef'],
  },
  {
    name: 'Pink & Rose',
    shades: ['#881337', '#be123c', '#e11d48', '#db2777', '#ec4899', '#f43f5e'],
  },
  {
    name: 'Merah & Crimson',
    shades: ['#7f1d1d', '#991b1b', '#b91c1c', '#dc2626', '#ef4444', '#e05252'],
  },
  {
    name: 'Oranye & Terracotta',
    shades: ['#7c2d12', '#9a3412', '#c2410c', '#ea580c', '#f97316', '#d97706'],
  },
  {
    name: 'Emas & Zaitun',
    shades: ['#713f12', '#a16207', '#ca8a04', '#eab308', '#65a30d', '#84cc16'],
  },
  {
    name: 'Netral & Slate',
    shades: ['#1e293b', '#334155', '#475569', '#52525b', '#57534e', '#64748b'],
  },
];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizeHex(input: string): string | null {
  const cleaned = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const expanded = cleaned
      .split('')
      .map((ch) => ch + ch)
      .join('');
    return `#${expanded.toLowerCase()}`;
  }
  return null;
}

export function hexToRgb(hex: string): RgbColor {
  const norm = normalizeHex(hex) || DEFAULT_ACCENT_HEX;
  const num = parseInt(norm.slice(1), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  const toByte = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

export function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6;
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb({ h, s, l }: HslColor): RgbColor {
  const hn = ((h % 360) + 360) % 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hn < 60) [r1, g1, b1] = [c, x, 0];
  else if (hn < 120) [r1, g1, b1] = [x, c, 0];
  else if (hn < 180) [r1, g1, b1] = [0, c, x];
  else if (hn < 240) [r1, g1, b1] = [0, x, c];
  else if (hn < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function hexToHsv(hex: string): HsvColor {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;

  return { h, s, v };
}

export function hsvToHex({ h, s, v }: HsvColor): string {
  const hn = ((h % 360) + 360) % 360;
  const sn = clamp(s, 0, 100) / 100;
  const vn = clamp(v, 0, 100) / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = vn - c;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hn < 60) [r1, g1, b1] = [c, x, 0];
  else if (hn < 120) [r1, g1, b1] = [x, c, 0];
  else if (hn < 180) [r1, g1, b1] = [0, c, x];
  else if (hn < 240) [r1, g1, b1] = [0, x, c];
  else if (hn < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  return rgbToHex({
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  });
}

function mixRgb(a: RgbColor, b: RgbColor, weightA: number): RgbColor {
  const w = clamp(weightA, 0, 1);
  return {
    r: a.r * w + b.r * (1 - w),
    g: a.g * w + b.g * (1 - w),
    b: a.b * w + b.b * (1 - w),
  };
}

function relativeLuminance({ r, g, b }: RgbColor): number {
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

const SURFACE_CREAM_RGB = hexToRgb('#fbfaf2');

/**
 * Derive a complete, balanced, accessible accent token palette from any HEX color.
 */
export function computeAccentPalette(rawHex: string): AccentPalette {
  const accent = normalizeHex(rawHex) || DEFAULT_ACCENT_HEX;
  const rgb = hexToRgb(accent);
  const hsl = rgbToHsl(rgb);

  // Hover shade: darken noticeably unless the accent is already very dark (then lift slightly)
  const hoverRgb = hslToRgb({
    h: hsl.h,
    s: clamp(hsl.s + 4, 0, 100),
    l: hsl.l > 22 ? clamp(hsl.l - 7, 10, 88) : clamp(hsl.l + 9, 14, 92),
  });
  const hover = rgbToHex(hoverRgb);

  // Soft tinted surfaces blended with the app's pale cream surface (#fbfaf2)
  const soft = rgbToHex(mixRgb(rgb, SURFACE_CREAM_RGB, 0.13));
  const soft2 = rgbToHex(mixRgb(rgb, SURFACE_CREAM_RGB, 0.065));
  const softHover = rgbToHex(mixRgb(rgb, SURFACE_CREAM_RGB, 0.22));
  const border = rgbToHex(mixRgb(rgb, SURFACE_CREAM_RGB, 0.34));

  // Readable dark text shade on light/soft backgrounds (enforce >= 4.8:1 contrast against soft)
  let darkL = clamp(Math.min(hsl.l - 12, 36), 14, 42);
  let dark = rgbToHex(hslToRgb({ h: hsl.h, s: clamp(hsl.s + 6, 0, 92), l: darkL }));
  while (getContrastRatio(dark, soft) < 4.8 && darkL > 12) {
    darkL -= 3;
    dark = rgbToHex(hslToRgb({ h: hsl.h, s: clamp(hsl.s + 6, 0, 92), l: darkL }));
  }

  const deep = rgbToHex(
    hslToRgb({ h: hsl.h, s: clamp(hsl.s + 6, 0, 92), l: clamp(darkL - 8, 10, 32) })
  );

  // Choose crisp white or deep ink foreground on solid accent buttons for readability
  const whiteContrast = getContrastRatio('#ffffff', accent);
  const inkContrast = getContrastRatio('#13222b', accent);
  const fg = whiteContrast >= 3.15 || whiteContrast >= inkContrast ? '#ffffff' : '#13222b';
  const buttonContrast = Math.max(whiteContrast, inkContrast);
  const textContrast = getContrastRatio(dark, soft);

  return {
    accent,
    hover,
    dark,
    deep,
    soft,
    soft2,
    softHover,
    border,
    ring20: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`,
    fg,
    buttonContrast,
    textContrast,
  };
}

export function applyAccentColor(rawHex: string, persist = true): AccentPalette {
  const palette = computeAccentPalette(rawHex);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--accent', palette.accent);
    root.style.setProperty('--accent-hover', palette.hover);
    root.style.setProperty('--accent-dark', palette.dark);
    root.style.setProperty('--accent-deep', palette.deep);
    root.style.setProperty('--accent-soft', palette.soft);
    root.style.setProperty('--accent-soft-2', palette.soft2);
    root.style.setProperty('--accent-soft-hover', palette.softHover);
    root.style.setProperty('--accent-border', palette.border);
    root.style.setProperty('--accent-ring-20', palette.ring20);
    root.style.setProperty('--accent-fg', palette.fg);
  }
  if (persist && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, palette.accent);
    } catch {
      // Ignore storage quota / private mode errors
    }
  }
  return palette;
}

export function loadSavedAccentColor(): string {
  if (typeof window === 'undefined') return DEFAULT_ACCENT_HEX;
  try {
    const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return normalizeHex(stored || '') || DEFAULT_ACCENT_HEX;
  } catch {
    return DEFAULT_ACCENT_HEX;
  }
}

export function initAccentTheme(): string {
  const saved = loadSavedAccentColor();
  applyAccentColor(saved, false);
  return saved;
}

export function loadRecentAccents(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_ACCENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === 'string' ? normalizeHex(item) : null))
      .filter((item): item is string => Boolean(item))
      .slice(0, 10);
  } catch {
    return [];
  }
}

export function pushRecentAccent(rawHex: string): string[] {
  const norm = normalizeHex(rawHex);
  if (!norm) return loadRecentAccents();
  const prev = loadRecentAccents();
  const next = [norm, ...prev.filter((c) => c !== norm)].slice(0, 10);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(RECENT_ACCENTS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}
