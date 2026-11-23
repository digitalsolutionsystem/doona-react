import React, { useMemo, useState } from 'react';
import { DAY_NAMES, MONTH_NAMES } from '../constants/defaults';
import { formatRp, getDayOfWeek, getMonth, getYear } from '../domain/dateUtils';
import {
  formatOmsetShort,
  formatSignedRp,
  getOmsetChartData,
  type OmsetChartMetricKey,
} from '../domain/omsetCalculations';
import type { AppData } from '../types/app';

interface OmsetChartPanelProps {
  state: AppData;
  ym: string;
  metricKey: OmsetChartMetricKey;
  onSelectDay: (d: number) => void;
}

export const OMSET_CHART_METRIC_KEYS: OmsetChartMetricKey[] = [
  'omset',
  'nota',
  'keluar',
  'gaji',
  'bx',
  'selisih',
];

const SERIES_COLOR_MAP: Record<string, string> = {
  tl: 'var(--accent)',
  qr: '#0d2530',
  tn: 'var(--accent)',
  qn: '#0d2530',
  kx: '#f59e0b',
  bx: '#ef4444',
  gaji: '#64748b',
  selT: '#f59e0b',
  selQ: '#ef4444',
};

function getSeriesColor(seriesKey: string, fallback: string): string {
  return SERIES_COLOR_MAP[seriesKey] || fallback;
}

function niceStep(rangeDiv: number): number {
  const safe = rangeDiv > 0 ? rangeDiv : 1;
  const exp = Math.pow(10, Math.floor(Math.log10(safe)));
  const frac = safe / exp;
  const mult = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return mult * exp;
}

export const OmsetChartPanel: React.FC<OmsetChartPanelProps> = ({
  state,
  ym,
  metricKey,
  onSelectDay,
}) => {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const chart = useMemo(() => getOmsetChartData(state, ym, metricKey), [state, ym, metricKey]);

  const monthName = MONTH_NAMES[getMonth(ym) - 1] || '';
  const yearNum = getYear(ym);
  const div = Boolean(chart.metric.diverging);

  const W = 960;
  const H = 368;
  const L = 66;
  const R = 16;
  const T = 54;
  const B = 30;
  const pw = W - L - R;
  const ph = H - T - B;
  const sx = pw / chart.nd;
  const bw = Math.min(26, sx * 0.62);

  const tots = chart.days
    .filter((x): x is typeof x & { tot: number } => x.has && x.tot !== null)
    .map((x) => x.tot);
  const yMax = Math.max(0, ...tots) || 1;
  const yMin = Math.min(0, ...tots);
  const step = niceStep((yMax - yMin) / 4 || 1);
  const lo = Math.floor(yMin / step + 1e-9) * step;
  const hi = Math.ceil(yMax / step - 1e-9) * step;
  const span = hi - lo || 1;
  const sy = (v: number) => T + ph * (1 - (v - lo) / span);

  const yTicks: number[] = [];
  for (let t = lo; t <= hi + step / 1000; t += step) {
    yTicks.push(t);
  }

  const hoveredPoint = hoveredDay ? chart.days.find((x) => x.d === hoveredDay) || null : null;

  const cvToneText =
    chart.cv < 15
      ? 'text-[#15803d]'
      : chart.cv < 35
        ? 'text-[#b45309]'
        : 'text-[#dc2626]';

  return (
    <div className="space-y-4">
      {chart.validCount === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-sm text-[#64748b] shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
          Belum ada data {chart.metric.label.toLowerCase()} pada {monthName} {yearNum}.
        </div>
      ) : (
        <>
          {/* Floating White Analytics KPI Strip */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
            <div className="grid grid-cols-2 divide-x divide-y divide-[#edf2f0] sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
              {div ? (
                <>
                  <div className="px-4 py-3.5">
                    <div className="text-[11.5px] font-semibold text-[#64748b]">Rata-rata / hari</div>
                    <div className="font-mono-num mt-1 text-[15px] font-bold text-[#13222b]">
                      {formatSignedRp(Math.round(chart.avg))}
                    </div>
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="text-[11.5px] font-semibold text-[#64748b]">
                      Terbesar +
                      {chart.maxDay && (chart.maxDay.tot || 0) > 0 ? ` · tgl ${chart.maxDay.d}` : ''}
                    </div>
                    <div
                      className={`font-mono-num mt-1 text-[15px] font-bold ${
                        chart.maxDay && (chart.maxDay.tot || 0) > 0
                          ? 'text-[#b45309]'
                          : 'text-[#15803d]'
                      }`}
                    >
                      {chart.maxDay && (chart.maxDay.tot || 0) > 0
                        ? formatSignedRp(chart.maxDay.tot)
                        : 'Tidak ada'}
                    </div>
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="text-[11.5px] font-semibold text-[#64748b]">
                      Terbesar −
                      {chart.minDay && (chart.minDay.tot || 0) < 0 ? ` · tgl ${chart.minDay.d}` : ''}
                    </div>
                    <div
                      className={`font-mono-num mt-1 text-[15px] font-bold ${
                        chart.minDay && (chart.minDay.tot || 0) < 0
                          ? 'text-[#dc2626]'
                          : 'text-[#15803d]'
                      }`}
                    >
                      {chart.minDay && (chart.minDay.tot || 0) < 0
                        ? formatSignedRp(chart.minDay.tot)
                        : 'Tidak ada'}
                    </div>
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="text-[11.5px] font-semibold text-[#64748b]">Hari ada selisih</div>
                    <div
                      className={`font-mono-num mt-1 text-[15px] font-bold ${
                        chart.nonZeroDiffDays > 0 ? 'text-[#dc2626]' : 'text-[#15803d]'
                      }`}
                    >
                      {chart.nonZeroDiffDays}{' '}
                      <span className="text-xs font-medium text-[#64748b]">
                        / {chart.validCount} hari
                      </span>
                    </div>
                  </div>
                  <div className="bg-[#f7faf9] px-4 py-3.5 sm:col-span-2">
                    <div className="text-[11.5px] font-semibold text-[#64748b]">
                      Total selisih bulan
                    </div>
                    <div
                      className={`font-mono-num mt-1 text-[15px] font-bold ${
                        chart.sumTotal === 0
                          ? 'text-[#15803d]'
                          : chart.sumTotal < 0
                            ? 'text-[#dc2626]'
                            : 'text-[#b45309]'
                      }`}
                    >
                      {formatSignedRp(chart.sumTotal)}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-[#f2fbf6] px-4 py-3.5">
                    <div className="text-[11.5px] font-semibold text-[#15803d]">Rata-rata / hari</div>
                    <div className="font-mono-num mt-1 text-[15px] font-bold text-[#15803d]">
                      {formatRp(Math.round(chart.avg))}
                    </div>
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="text-[11.5px] font-semibold text-[#64748b]">
                      Tertinggi{chart.maxDay ? ` · tgl ${chart.maxDay.d}` : ''}
                    </div>
                    <div className="font-mono-num mt-1 text-[15px] font-bold text-[#13222b]">
                      {chart.maxDay ? formatRp(chart.maxDay.tot || 0) : '–'}
                    </div>
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="text-[11.5px] font-semibold text-[#64748b]">
                      Terendah{chart.minDay ? ` · tgl ${chart.minDay.d}` : ''}
                    </div>
                    <div className="font-mono-num mt-1 text-[15px] font-bold text-[#b45309]">
                      {chart.minDay ? formatRp(chart.minDay.tot || 0) : '–'}
                    </div>
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="text-[11.5px] font-semibold text-[#64748b]">Fluktuasi</div>
                    <div className={`font-mono-num mt-1 text-[15px] font-bold ${cvToneText}`}>
                      ±{chart.cv}%
                    </div>
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="text-[11.5px] font-semibold text-[#64748b]">
                      Rata-rata P1 (1–15)
                    </div>
                    <div className="font-mono-num mt-1 text-[15px] font-bold text-[#13222b]">
                      {chart.hasP1 ? formatRp(Math.round(chart.avgP1)) : '–'}
                    </div>
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="text-[11.5px] font-semibold text-[#64748b]">
                      Rata-rata P2 (16–{chart.nd})
                    </div>
                    <div className="font-mono-num mt-1 text-[15px] font-bold text-[#13222b]">
                      {chart.hasP2 ? formatRp(Math.round(chart.avgP2)) : '–'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Interactive SVG Chart Card */}
          <div className="rounded-2xl bg-white p-4 shadow-[0_6px_24px_rgba(13,37,48,0.045)] sm:p-5">
            {/* Hover Inspector Line */}
            <div className="mb-3 flex min-h-[26px] flex-wrap items-center justify-between gap-2 border-b border-[#edf2f0] pb-2.5 text-xs">
              {hoveredPoint ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#13222b]">
                  <strong className="font-bold">
                    {DAY_NAMES[getDayOfWeek(ym, hoveredPoint.d)]}, {hoveredPoint.d} {monthName}
                  </strong>
                  {!hoveredPoint.has ? (
                    <span className="text-[#64748b]">Belum ada data</span>
                  ) : (
                    <>
                      {chart.metric.series.map((s) => (
                        <span key={s.k} className="text-[#475569]">
                          {s.l}:{' '}
                          <strong className="font-mono-num font-bold text-[#13222b]">
                            {div
                              ? formatSignedRp(hoveredPoint.v[s.k])
                              : formatRp(hoveredPoint.v[s.k])}
                          </strong>
                        </span>
                      ))}
                      {chart.metric.series.length > 1 && (
                        <span className="font-bold text-[#15803d]">
                          Total:{' '}
                          <span className="font-mono-num">
                            {div
                              ? formatSignedRp(hoveredPoint.tot)
                              : formatRp(hoveredPoint.tot || 0)}
                          </span>
                        </span>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <span className="text-[#64748b]">
                  Arahkan kursor ke batang tanggal untuk melihat rincian, atau klik batang untuk
                  membuka tanggal di tab Kalender.
                </span>
              )}
            </div>

            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="block h-auto w-full min-w-[680px]"
                role="img"
                aria-label={`Grafik batang ${chart.metric.label} ${monthName} ${yearNum}`}
              >
                {/* Y Grid Lines & Labels */}
                {yTicks.map((t, idx) => {
                  const yPos = sy(t);
                  const isZero = Math.abs(t) < step / 1000;
                  return (
                    <g key={idx}>
                      <line
                        x1={L}
                        x2={W - R}
                        y1={yPos}
                        y2={yPos}
                        stroke={isZero ? '#0d2530' : '#edf2f0'}
                        strokeWidth={isZero ? 1.5 : 1.25}
                      />
                      <text
                        x={L - 8}
                        y={yPos + 4}
                        textAnchor="end"
                        fontSize={11}
                        fontWeight={600}
                        fill="#64748b"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {formatOmsetShort(t)}
                      </text>
                    </g>
                  );
                })}

                {/* Period 1 / Period 2 Divider */}
                <line
                  x1={L + 15 * sx}
                  x2={L + 15 * sx}
                  y1={28}
                  y2={T + ph}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
                <text
                  x={L + 7.5 * sx}
                  y={16}
                  textAnchor="middle"
                  fontSize={11.5}
                  fontWeight={700}
                  fill="#475569"
                >
                  Periode 1 (1–15)
                </text>
                <text
                  x={L + (15 + (chart.nd - 15) / 2) * sx}
                  y={16}
                  textAnchor="middle"
                  fontSize={11.5}
                  fontWeight={700}
                  fill="#475569"
                >
                  Periode 2 (16–{chart.nd})
                </text>

                {/* Bars & X Labels */}
                {chart.days.map((x) => {
                  const cx = L + (x.d - 0.5) * sx;
                  const bx = cx - bw / 2;
                  const isSun = getDayOfWeek(ym, x.d) === 0;
                  const isHovered = hoveredDay === x.d;

                  let barNodes: React.ReactNode = null;
                  if (!x.has || x.tot === null) {
                    barNodes = (
                      <rect
                        x={bx}
                        y={sy(0) - 2.5}
                        width={bw}
                        height={2.5}
                        rx={1}
                        fill="#cbd5e1"
                      />
                    );
                  } else if (div) {
                    const y1 = sy(Math.max(x.tot, 0));
                    const y2 = sy(Math.min(x.tot, 0));
                    barNodes = (
                      <rect
                        x={bx}
                        y={y1}
                        width={bw}
                        height={Math.max(2, y2 - y1)}
                        rx={3}
                        fill={x.tot >= 0 ? '#f59e0b' : '#ef4444'}
                      />
                    );
                  } else {
                    let y0 = 0;
                    const rects: React.ReactNode[] = [];
                    chart.metric.series.forEach((s) => {
                      const val = x.v[s.k];
                      if (val <= 0) return;
                      const ya = sy(y0 + val);
                      const yb = sy(y0);
                      rects.push(
                        <rect
                          key={s.k}
                          x={bx}
                          y={ya}
                          width={bw}
                          height={Math.max(1.5, yb - ya)}
                          rx={2}
                          fill={getSeriesColor(s.k, s.c)}
                        />
                      );
                      y0 += val;
                    });
                    if (y0 === 0) {
                      rects.push(
                        <rect
                          key="zero"
                          x={bx}
                          y={sy(0) - 2.5}
                          width={bw}
                          height={2.5}
                          rx={1}
                          fill="#cbd5e1"
                        />
                      );
                    }
                    barNodes = rects;
                  }

                  const isPeak =
                    x.has &&
                    x.tot !== null &&
                    ((chart.maxDay && x.d === chart.maxDay.d) ||
                      (chart.minDay && x.d === chart.minDay.d));

                  return (
                    <g key={x.d}>
                      {isHovered && (
                        <rect
                          x={L + (x.d - 1) * sx}
                          y={T - 4}
                          width={sx}
                          height={ph + 8}
                          rx={4}
                          fill="var(--accent-soft)"
                        />
                      )}
                      {barNodes}
                      {isPeak && x.tot !== null && (
                        <text
                          x={cx}
                          y={x.tot >= 0 ? sy(x.tot) - 7 : sy(x.tot) + 14}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={700}
                          fill={
                            chart.maxDay && x.d === chart.maxDay.d
                              ? 'var(--accent-dark)'
                              : '#dc2626'
                          }
                          stroke="#fbfaf2"
                          strokeWidth={3.5}
                          paintOrder="stroke"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {formatOmsetShort(x.tot)}
                        </text>
                      )}
                      <text
                        x={cx}
                        y={H - 10}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={isSun ? 700 : 600}
                        fill={isSun ? '#dc2626' : '#64748b'}
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {x.d}
                      </text>
                      <rect
                        x={L + (x.d - 1) * sx}
                        y={T - 4}
                        width={sx}
                        height={ph + 8}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredDay(x.d)}
                        onMouseLeave={() => setHoveredDay(null)}
                        onClick={() => onSelectDay(x.d)}
                      />
                    </g>
                  );
                })}

                {/* Average Dashed Line */}
                <line
                  x1={L}
                  x2={W - R}
                  y1={sy(chart.avg)}
                  y2={sy(chart.avg)}
                  stroke="#0d2530"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
                <text
                  x={W - R - 4}
                  y={sy(chart.avg) - 6}
                  textAnchor="end"
                  fontSize={11}
                  fontWeight={700}
                  fill="#0d2530"
                  stroke="#fbfaf2"
                  strokeWidth={3.5}
                  paintOrder="stroke"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Rata-rata{' '}
                  {div ? formatSignedRp(Math.round(chart.avg)) : formatOmsetShort(chart.avg)}
                </text>
              </svg>
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-[#edf2f0] pt-3 text-xs font-semibold text-[#475569]">
              {div ? (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#f59e0b]" />
                    Selisih lebih (+)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#ef4444]" />
                    Selisih kurang (−)
                  </span>
                </>
              ) : (
                chart.metric.series.map((s) => (
                  <span key={s.k} className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-xs"
                      style={{ backgroundColor: getSeriesColor(s.k, s.c) }}
                    />
                    {s.l}
                  </span>
                ))
              )}
              <span className="inline-flex items-center gap-1.5">
                <span className="w-5 border-t-2 border-dashed border-[#0d2530]" />
                Rata-rata
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[3px] w-3 rounded-full bg-[#cbd5e1]" />
                Belum ada data
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
