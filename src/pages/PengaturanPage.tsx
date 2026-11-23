import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import {
  Check,
  Copy,
  Database,
  Home,
  Palette,
  Pipette,
  RotateCcw,
  Save,
  Settings,
  SlidersHorizontal,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DatabasePage } from './DatabasePage';
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT_HEX,
  FULL_COLOR_FAMILIES,
  applyAccentColor,
  computeAccentPalette,
  hexToHsv,
  hexToRgb,
  hsvToHex,
  loadRecentAccents,
  loadSavedAccentColor,
  normalizeHex,
  pushRecentAccent,
  rgbToHex,
  rgbToHsl,
  type HsvColor,
} from '../utils/accentTheme';

export const PengaturanPage: React.FC = () => {
  const { pgSub, setPgSub } = useApp();
  const [accentHex, setAccentHex] = useState<string>(() => loadSavedAccentColor());
  const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(loadSavedAccentColor()));
  const [hexInput, setHexInput] = useState<string>(() => loadSavedAccentColor().toUpperCase());
  const [recentColors, setRecentColors] = useState<string[]>(() => loadRecentAccents());
  const [copiedHex, setCopiedHex] = useState(false);
  const [previewTab, setPreviewTab] = useState<'closing' | 'datang' | 'rekap'>('closing');

  const svBoardRef = useRef<HTMLDivElement | null>(null);
  const hueBarRef = useRef<HTMLDivElement | null>(null);
  const nativePickerRef = useRef<HTMLInputElement | null>(null);
  const draggingSvRef = useRef(false);
  const draggingHueRef = useRef(false);

  const palette = useMemo(() => computeAccentPalette(accentHex), [accentHex]);
  const rgb = useMemo(() => hexToRgb(accentHex), [accentHex]);
  const hsl = useMemo(() => rgbToHsl(rgb), [rgb]);

  // Apply live to document root whenever accentHex changes
  useEffect(() => {
    applyAccentColor(accentHex, true);
  }, [accentHex]);

  const commitAccent = useCallback(
    (nextHex: string, opts?: { syncHsv?: boolean; recordRecent?: boolean }) => {
      const norm = normalizeHex(nextHex);
      if (!norm) return;
      setAccentHex(norm);
      setHexInput(norm.toUpperCase());
      if (opts?.syncHsv !== false) {
        setHsv(hexToHsv(norm));
      }
      if (opts?.recordRecent) {
        setRecentColors(pushRecentAccent(norm));
      }
    },
    []
  );

  // Update from 2D Saturation x Value spectrum board
  const updateFromSvPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = svBoardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const s = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
      const v = Math.min(100, Math.max(0, (1 - (clientY - rect.top) / rect.height) * 100));
      const nextHsv: HsvColor = { h: hsv.h, s, v };
      setHsv(nextHsv);
      const nextHex = hsvToHex(nextHsv);
      setAccentHex(nextHex);
      setHexInput(nextHex.toUpperCase());
    },
    [hsv.h]
  );

  // Update from 360-degree Hue spectrum bar
  const updateFromHuePointer = useCallback(
    (clientX: number) => {
      const el = hueBarRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const h = Math.min(360, Math.max(0, ((clientX - rect.left) / rect.width) * 360));
      const nextHsv: HsvColor = { h, s: hsv.s, v: hsv.v };
      setHsv(nextHsv);
      const nextHex = hsvToHex(nextHsv);
      setAccentHex(nextHex);
      setHexInput(nextHex.toUpperCase());
    },
    [hsv.s, hsv.v]
  );

  const handleSvPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingSvRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromSvPointer(e.clientX, e.clientY);
  };

  const handleSvPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingSvRef.current) return;
    updateFromSvPointer(e.clientX, e.clientY);
  };

  const handleSvPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingSvRef.current) return;
    draggingSvRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setRecentColors(pushRecentAccent(accentHex));
  };

  const handleHuePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingHueRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromHuePointer(e.clientX);
  };

  const handleHuePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingHueRef.current) return;
    updateFromHuePointer(e.clientX);
  };

  const handleHuePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingHueRef.current) return;
    draggingHueRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setRecentColors(pushRecentAccent(accentHex));
  };

  const handleHexChange = (val: string) => {
    const cleaned = val.startsWith('#') ? val : `#${val}`;
    setHexInput(cleaned.toUpperCase().slice(0, 7));
    const norm = normalizeHex(cleaned);
    if (norm) {
      setAccentHex(norm);
      setHsv(hexToHsv(norm));
    }
  };

  const handleHexBlur = () => {
    const norm = normalizeHex(hexInput);
    if (norm) {
      commitAccent(norm, { syncHsv: true, recordRecent: true });
    } else {
      setHexInput(accentHex.toUpperCase());
    }
  };

  const handleRgbChange = (channel: 'r' | 'g' | 'b', rawVal: string) => {
    const parsed = parseInt(rawVal, 10);
    const num = Number.isNaN(parsed) ? 0 : Math.min(255, Math.max(0, parsed));
    const nextHex = rgbToHex({ ...rgb, [channel]: num });
    commitAccent(nextHex, { syncHsv: true, recordRecent: false });
  };

  const handleCopyHex = async () => {
    try {
      await navigator.clipboard.writeText(accentHex.toUpperCase());
      setCopiedHex(true);
      window.setTimeout(() => setCopiedHex(false), 1600);
    } catch {
      // Fallback ignored if clipboard unavailable
    }
  };

  const handleResetDefault = () => {
    commitAccent(DEFAULT_ACCENT_HEX, { syncHsv: true, recordRecent: true });
  };

  const pureHueHex = useMemo(() => hsvToHex({ h: hsv.h, s: 100, v: 100 }), [hsv.h]);
  const isDefault = accentHex.toLowerCase() === DEFAULT_ACCENT_HEX;

  const derivedSwatches = [
    { label: 'Utama', hex: palette.accent },
    { label: 'Hover', hex: palette.hover },
    { label: 'Teks Gelap', hex: palette.dark },
    { label: 'Latar Lembut', hex: palette.soft },
    { label: 'Border', hex: palette.border },
  ];

  const settingsHeaderLeft = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl bg-[#e6f7ee] text-[#15803d]">
          <Settings className="h-4 w-4" />
        </div>
        <h1 className="font-display text-[17px] font-bold tracking-[-0.015em] text-[#13222b]">
          Pengaturan
        </h1>
      </div>

      <div className="flex items-center gap-1 rounded-xl bg-[#f3f7f5] p-1">
        <button
          type="button"
          onClick={() => setPgSub('uiux')}
          className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
            pgSub === 'uiux'
              ? 'bg-[#2eb86b] text-white shadow-xs'
              : 'text-[#64748b] hover:text-[#13222b]'
          }`}
        >
          <Palette className="h-3.5 w-3.5 shrink-0" />
          <span>UI/UX</span>
        </button>
        <button
          type="button"
          onClick={() => setPgSub('db')}
          className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
            pgSub === 'db'
              ? 'bg-[#2eb86b] text-white shadow-xs'
              : 'text-[#64748b] hover:text-[#13222b]'
          }`}
        >
          <Database className="h-3.5 w-3.5 shrink-0" />
          <span>Koneksi Database</span>
        </button>
      </div>
    </div>
  );

  if (pgSub === 'db') {
    return <DatabasePage headerLeft={settingsHeaderLeft} />;
  }

  return (
    <div className="dg-page">
      {/* Persistent Stationary Top Header */}
      <PageHeader>
          {settingsHeaderLeft}

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden h-8.5 items-center gap-2 rounded-xl bg-[#f3f7f5] px-3 text-xs text-[#475569] sm:flex">
              <span
                className="h-4 w-4 rounded-md border border-[#2f363e]/40"
                style={{ backgroundColor: accentHex }}
              />
              <span className="font-mono-num font-semibold text-[#13222b]">
                {accentHex.toUpperCase()}
              </span>
            </div>

            <button
              type="button"
              onClick={handleResetDefault}
              disabled={isDefault}
              className="inline-flex h-8.5 shrink-0 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Hijau Default</span>
            </button>
          </div>
      </PageHeader>

      {/* Main Scrollable Workspace */}
      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="grid w-full grid-cols-1 items-start gap-5 lg:grid-cols-12">
          {/* LEFT COLUMN: Full Spectrum Picker + Complete 60-Shade Color Palette */}
          <section className="space-y-5 lg:col-span-7">
            {/* Interactive 2D Spectrum + Hue Bar + HEX/RGB Controls */}
            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
                <div>
                  <h3 className="font-display text-[15px] font-bold text-[#13222b]">
                    Pemilih Warna Spektrum Penuh
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748b]">
                    Geser area warna dan bilah spektrum untuk memilih warna aksen bebas sesuai selera
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    ref={nativePickerRef}
                    type="color"
                    value={accentHex}
                    onChange={(e) =>
                      commitAccent(e.target.value, { syncHsv: true, recordRecent: true })
                    }
                    aria-label="Pilih warna dari pemilih sistem"
                    className="sr-only"
                  />
                  <button
                    type="button"
                    onClick={() => nativePickerRef.current?.click()}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] whitespace-nowrap cursor-pointer"
                  >
                    <Pipette className="h-3.5 w-3.5 text-[#15803d]" />
                    <span>Color Picker OS</span>
                  </button>
                </div>
              </div>

              {/* 2D Saturation x Value Board */}
              <div
                ref={svBoardRef}
                role="slider"
                tabIndex={0}
                aria-label="Area saturasi dan kecerahan warna"
                aria-valuetext={accentHex.toUpperCase()}
                onPointerDown={handleSvPointerDown}
                onPointerMove={handleSvPointerMove}
                onPointerUp={handleSvPointerUp}
                className="relative h-52 w-full cursor-crosshair overflow-hidden rounded-xl border border-[#2f363e]/25 select-none touch-none sm:h-60"
                style={{
                  backgroundColor: pureHueHex,
                  backgroundImage:
                    'linear-gradient(to top, #000000, rgba(0,0,0,0)), linear-gradient(to right, #ffffff, rgba(255,255,255,0))',
                }}
              >
                {/* Draggable Crosshair Handle */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white shadow-[0_0_0_1.5px_rgba(19,34,43,0.7),0_4px_10px_rgba(0,0,0,0.3)]"
                  style={{
                    left: `${hsv.s}%`,
                    top: `${100 - hsv.v}%`,
                    backgroundColor: accentHex,
                  }}
                />
              </div>

              {/* 360-Degree Hue Spectrum Slider */}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-medium text-[#64748b]">
                  <span>Spektrum Hue (0°–360°)</span>
                  <span className="font-mono-num text-[#334155]">
                    H {hsl.h}° · S {hsl.s}% · L {hsl.l}%
                  </span>
                </div>
                <div
                  ref={hueBarRef}
                  role="slider"
                  tabIndex={0}
                  aria-label="Spektrum Hue"
                  aria-valuemin={0}
                  aria-valuemax={360}
                  aria-valuenow={Math.round(hsv.h)}
                  onPointerDown={handleHuePointerDown}
                  onPointerMove={handleHuePointerMove}
                  onPointerUp={handleHuePointerUp}
                  className="relative h-5 w-full cursor-pointer rounded-full border border-[#2f363e]/25 select-none touch-none"
                  style={{
                    background:
                      'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white shadow-[0_0_0_1.5px_rgba(19,34,43,0.65),0_3px_8px_rgba(0,0,0,0.28)]"
                    style={{
                      left: `${(hsv.h / 360) * 100}%`,
                      backgroundColor: pureHueHex,
                    }}
                  />
                </div>
              </div>

              {/* Precision HEX + RGB Controls */}
              <div className="mt-5 grid grid-cols-1 gap-3 border-t border-[#e2ebe7] pt-4 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <label className="mb-1 block text-[11px] font-semibold text-[#64748b]">
                    Kode HEX
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-9 w-9 shrink-0 rounded-xl border border-[#2f363e]/30"
                      style={{ backgroundColor: accentHex }}
                    />
                    <input
                      type="text"
                      value={hexInput}
                      onChange={(e) => handleHexChange(e.target.value)}
                      onBlur={handleHexBlur}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleHexBlur();
                      }}
                      spellCheck={false}
                      maxLength={7}
                      aria-label="Kode warna HEX"
                      className="font-mono-num h-9 min-w-0 flex-1 rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3 text-xs font-bold tracking-wider text-[#13222b] uppercase outline-none transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
                    />
                    <button
                      type="button"
                      onClick={handleCopyHex}
                      title="Salin kode HEX"
                      aria-label="Salin kode HEX"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f3f7f5] text-[#475569] transition hover:bg-[#e1ebe7] hover:text-[#13222b] cursor-pointer"
                    >
                      {copiedHex ? (
                        <Check className="h-4 w-4 text-[#15803d]" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:col-span-7">
                  {(['r', 'g', 'b'] as const).map((ch) => (
                    <div key={ch}>
                      <label className="mb-1 block text-[11px] font-semibold text-[#64748b] uppercase">
                        {ch === 'r' ? 'Red (R)' : ch === 'g' ? 'Green (G)' : 'Blue (B)'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={rgb[ch]}
                        onChange={(e) => handleRgbChange(ch, e.target.value)}
                        onBlur={() => setRecentColors(pushRecentAccent(accentHex))}
                        className="font-mono-num h-9 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-2.5 text-xs font-bold text-[#13222b] outline-none transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Full 60-Color Curated Palette Grid + Presets + Recent */}
            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-[#15803d]" />
                  <h3 className="font-display text-[15px] font-bold text-[#13222b]">
                    Palet Warna Lengkap
                  </h3>
                </div>
                <span className="text-xs text-[#64748b]">
                  60 warna kurasi · 10 rumpun warna
                </span>
              </div>

              {/* 12 Named Quick Presets */}
              <div className="mb-5">
                <div className="mb-2 text-[11.5px] font-semibold text-[#475569]">
                  Preset Populer
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {ACCENT_PRESETS.map((preset) => {
                    const selected = accentHex.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() =>
                          commitAccent(preset.hex, { syncHsv: true, recordRecent: true })
                        }
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition cursor-pointer ${
                          selected
                            ? 'border-[#2eb86b] bg-[#e6f7ee] text-[#15803d]'
                            : 'border-[#dce6e2] bg-[#f7faf9] text-[#13222b] hover:bg-white'
                        }`}
                      >
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-black/15"
                          style={{ backgroundColor: preset.hex }}
                        >
                          {selected && <Check className="h-3 w-3 text-white drop-shadow-xs" />}
                        </span>
                        <span className="truncate">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 10 Families x 6 Shades Full Matrix */}
              <div className="space-y-2.5 border-t border-[#e2ebe7] pt-4">
                <div className="text-[11.5px] font-semibold text-[#475569]">
                  Matriks Gradasi Lengkap
                </div>
                <div className="space-y-2">
                  {FULL_COLOR_FAMILIES.map((family) => (
                    <div
                      key={family.name}
                      className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[136px_1fr]"
                    >
                      <span className="truncate text-xs font-medium text-[#475569]">
                        {family.name}
                      </span>
                      <div className="grid grid-cols-6 gap-1.5">
                        {family.shades.map((hex) => {
                          const selected = accentHex.toLowerCase() === hex.toLowerCase();
                          const swatchPalette = computeAccentPalette(hex);
                          return (
                            <button
                              key={hex}
                              type="button"
                              onClick={() =>
                                commitAccent(hex, { syncHsv: true, recordRecent: true })
                              }
                              title={`${family.name} · ${hex.toUpperCase()}`}
                              aria-label={`Pilih warna ${family.name} ${hex.toUpperCase()}`}
                              className={`group relative flex h-8 w-full items-center justify-center rounded-lg border transition hover:scale-[1.04] cursor-pointer ${
                                selected
                                  ? 'scale-[1.04] border-[#13222b] ring-2 ring-[#13222b]/30'
                                  : 'border-black/15'
                              }`}
                              style={{ backgroundColor: hex }}
                            >
                              {selected && (
                                <Check
                                  className="h-4 w-4"
                                  style={{ color: swatchPalette.fg }}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Custom Colors */}
              {recentColors.length > 0 && (
                <div className="mt-5 border-t border-[#e2ebe7] pt-4">
                  <div className="mb-2 text-[11.5px] font-semibold text-[#475569]">
                    Terakhir Dipakai
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {recentColors.map((hex) => {
                      const selected = accentHex.toLowerCase() === hex.toLowerCase();
                      const swatchPalette = computeAccentPalette(hex);
                      return (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => commitAccent(hex, { syncHsv: true, recordRecent: false })}
                          title={hex.toUpperCase()}
                          aria-label={`Gunakan warna terakhir ${hex.toUpperCase()}`}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition hover:scale-105 cursor-pointer ${
                            selected
                              ? 'border-[#13222b] ring-2 ring-[#13222b]/30'
                              : 'border-black/15'
                          }`}
                          style={{ backgroundColor: hex }}
                        >
                          {selected && (
                            <Check className="h-3.5 w-3.5" style={{ color: swatchPalette.fg }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT COLUMN: Live UI Preview + Auto-Derived Palette Tokens */}
          <aside className="space-y-5 lg:sticky lg:top-3 lg:col-span-5">
            {/* Live Interactive Component Preview */}
            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <div className="pb-4">
                <h3 className="font-display text-[15px] font-bold text-[#13222b]">
                  Pratinjau Langsung
                </h3>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  Perubahan warna langsung diterapkan ke tombol, tab aktif, ikon sidebar, dan grafik di seluruh menu
                </p>
              </div>

              <div className="space-y-4">
                {/* Preview: Primary & Soft Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    className="inline-flex h-9.5 items-center gap-2 rounded-xl bg-[#2eb86b] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#259f5b] whitespace-nowrap cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Simpan Data</span>
                  </button>

                  <button
                    type="button"
                    className="inline-flex h-9.5 items-center gap-2 rounded-xl bg-[#e6f7ee] px-4 text-xs font-bold text-[#15803d] transition hover:bg-[#d1f2e0] whitespace-nowrap cursor-pointer"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Aksi Sekunder</span>
                  </button>
                </div>

                {/* Preview: Segmented Tabs */}
                <div className="flex items-center gap-1 rounded-xl bg-[#f3f7f5] p-1">
                  {(
                    [
                      { id: 'closing', label: 'Closing' },
                      { id: 'datang', label: 'Barang Datang' },
                      { id: 'rekap', label: 'Rekap' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPreviewTab(t.id)}
                      className={`h-8 flex-1 rounded-lg px-2.5 text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                        previewTab === t.id
                          ? 'bg-[#2eb86b] text-white shadow-xs'
                          : 'text-[#475569] hover:text-[#13222b]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Preview: Sidebar Active Item & Metric Highlight */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f7ee] text-[#14a38b]">
                      <Home className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#13222b]">Ikon Menu Aktif</div>
                      <div className="text-[11px] text-[#64748b]">
                        Tersinkron ke sidebar & seluruh halaman
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono-num text-sm font-bold text-[#15803d]">+12,4%</div>
                    <div className="text-[11px] text-[#64748b]">Sorotan angka</div>
                  </div>
                </div>

                {/* Preview: Focus Input */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#64748b]">
                    Contoh Kolom Input Fokus
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="Dimsum · 45 porsi"
                    className="h-9.5 w-full rounded-xl border border-[#2eb86b] bg-white px-3.5 text-xs font-semibold text-[#13222b] ring-2 ring-[#2eb86b]/20 outline-none"
                  />
                </div>

                {/* Preview: Striped Progress Bar */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11.5px]">
                    <span className="font-semibold text-[#475569]">Progres Pengisian Harian</span>
                    <span className="font-mono-num font-bold text-[#15803d]">78%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[#e1ebe7]">
                    <div className="dg-striped-bar h-full w-[78%] rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-Derived Palette Breakdown & Live Contrast Verification */}
            <div className="rounded-2xl bg-white p-5 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
              <h3 className="font-display text-[15px] font-bold text-[#13222b]">
                Turunan Warna Otomatis
              </h3>
              <p className="mt-0.5 text-xs text-[#64748b]">
                Setiap warna yang dipilih otomatis menghasilkan gradasi tombol, latar lembut, dan teks yang terbaca jelas
              </p>

              <div className="mt-4 grid grid-cols-5 gap-2">
                {derivedSwatches.map((sw) => (
                  <div key={sw.label} className="space-y-1.5 text-center">
                    <div
                      className="h-11 w-full rounded-xl border border-black/15"
                      style={{ backgroundColor: sw.hex }}
                    />
                    <div className="text-[10.5px] font-semibold text-[#334155]">{sw.label}</div>
                    <div className="font-mono-num text-[10px] text-[#64748b]">
                      {sw.hex.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#e2ebe7] pt-3.5 text-xs text-[#475569]">
                <span>Keterbacaan teks tombol</span>
                <span className="font-mono-num font-bold text-[#13222b]">
                  {palette.buttonContrast.toFixed(1)}:1 ·{' '}
                  {palette.fg === '#ffffff' ? 'Teks Putih' : 'Teks Gelap Otomatis'}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569]">
                <span>Keterbacaan label lembut</span>
                <span className="font-mono-num font-bold text-[#15803d]">
                  {palette.textContrast.toFixed(1)}:1 · Kontras AA+
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
