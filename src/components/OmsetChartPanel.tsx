import React, { useMemo, useState } from 'react';
import { DAY_NAMES, MONTH_NAMES } from '../constants/defaults';
import { formatRp, getDayOfWeek, getMonth, getYear } from '../domain/dateUtils';
import {
  formatOmsetShort,
  formatSignedRp,
  getOmsetChartData,
  OMSET_CHART_METRICS,
  type OmsetChartMetricKey,
} from '../domain/omsetCalculations';
import type { AppData } from '../types/app';

interface OmsetChartPanelProps {
  state: AppData;
  ym: string;
  onSelectDay: (d: number) => void;
}

const METRIC_KEYS: OmsetChartMetricKey[] = [
  'omset',
  'nota',
  'keluar',
  'gaji',
  'bx',
  'selisih',
];

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
  onSelectDay,
}) => {
  const [metricKey, setMetricKey] = useState<OmsetChartMetricKey>('omset');
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const chart = useMemo(() => getOmsetChartData(state, ym, metricKey), [state, ym, metricKey]);

  const monthName = MONTH_NAMES[getMonth(ym) - 1] || '';
  const yearNum = getYear(ym);
  const div = Boolean(chart.metric.diverging);

  const W = 960;
  const H = 340;
  const L = 64;
  const R = 16;
  const T = 30;
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

  const cvTone =
    chart.cv < 15
      ? 'bg-[#1a9e94] text-white'
      : chart.cv < 35
        ? 'bg-[#d97706] text-white'
        : 'bg-[#dc2626] text-white';

  return (
    <div className="space-y-4">
      {/* Metric selector */}
      <div className="flex flex-wrap items-center gap-1 rounded-[9px] bg-[#edf1f4] p-1 w-fit">
        {METRIC_KEYS.map((k) => {
          const active = k === metricKey;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setMetricKey(k)}
              className={`h-8 rounded-[7px] px-3 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                active
                  ? 'bg-[#1a9e94] text-white shadow-xs'
                  : 'text-[#475569] hover:bg-white hover:text-[#1f2a36]'
              }`}
            >
              {OMSET_CHART_METRICS[k].label}
            </button>
          );
        })}
      </div>

      {chart.validCount === 0 ? (
        <div className="rounded-xl border border-[#dde2e6] bg-white p-10 text-center text-sm text-[#64748b]">
          Belum ada data {chart.metric.label.toLowerCase()} pada {monthName} {yearNum}.
        </div>
      ) : (
        <>
          {/* Analytics KPI Strip */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {div ? (
              <>
                <div className="rounded-xl bg-[#334155] px-3.5 py-3 text-white">
                  <div className="text-[11px] text-white/80">Rata-rata / hari</div>
                  <div className="font-mono-num mt-1 text-[15px] font-bold">
                    {formatSignedRp(Math.round(chart.avg))}
                  </div>
                </div>
                <div
                  className={`rounded-xl px-3.5 py-3 text-white ${
                    chart.maxDay && (chart.maxDay.tot || 0) > 0 ? 'bg-[#d97706]' : 'bg-[#1a9e94]'
                  }`}
                >
                  <div className="text-[11px] text-white/85">
                    Terbesar +
                    {chart.maxDay && (chart.maxDay.tot || 0) > 0 ? ` · tgl ${chart.maxDay.d}` : ''}
                  </div>
                  <div className="font-mono-num mt-1 text-[15px] font-bold">
                    {chart.maxDay && (chart.maxDay.tot || 0) > 0
                      ? formatSignedRp(chart.maxDay.tot)
                      : 'Tidak ada'}
                  </div>
                </div>
                <div
                  className={`rounded-xl px-3.5 py-3 text-white ${
                    chart.minDay && (chart.minDay.tot || 0) < 0 ? 'bg-[#dc2626]' : 'bg-[#1a9e94]'
                  }`}
                >
                  <div className="text-[11px] text-white/85">
                    Terbesar −
                    {chart.minDay && (chart.minDay.tot || 0) < 0 ? ` · tgl ${chart.minDay.d}` : ''}
                  </div>
                  <div className="font-mono-num mt-1 text-[15px] font-bold">
                    {chart.minDay && (chart.minDay.tot || 0) < 0
                      ? formatSignedRp(chart.minDay.tot)
                      : 'Tidak ada'}
                  </div>
                </div>
                <div
                  className={`rounded-xl px-3.5 py-3 text-white ${
                    chart.nonZeroDiffDays > 0 ? 'bg-[#dc2626]' : 'bg-[#1a9e94]'
                  }`}
                >
                  <div className="text-[11px] text-white/85">Hari ada selisih</div>
                  <div className="font-mono-num mt-1 text-[15px] font-bold">
                    {chart.nonZeroDiffDays}{' '}
                    <span className="text-xs font-normal opacity-80">/ {chart.validCount} hari</span>
                  </div>
                </div>
                <div className="rounded-xl bg-[#334155] px-3.5 py-3 text-white sm:col-span-2">
                  <div className="text-[11px] text-white/80">Total selisih bulan</div>
                  <div className="font-mono-num mt-1 text-[15px] font-bold">
                    {formatSignedRp(chart.sumTotal)}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl bg-[#1a9e94] px-3.5 py-3 text-white">
                  <div className="text-[11px] text-white/85">Rata-rata / hari</div>
                  <div className="font-mono-num mt-1 text-[15px] font-bold">
                    {formatRp(Math.round(chart.avg))}
                  </div>
                </div>
                <div className="rounded-xl bg-[#334155] px-3.5 py-3 text-white">
                  <div className="text-[11px] text-white/80">
                    Tertinggi{chart.maxDay ? ` · tgl ${chart.maxDay.d}` : ''}
                  </div>
                  <div className="font-mono-num mt-1 text-[15px] font-bold">
                    {chart.maxDay ? formatRp(chart.maxDay.tot || 0) : '–'}
                  </div>
                </div>
                <div className="rounded-xl bg-[#d97706] px-3.5 py-3 text-white">
                  <div className="text-[11px] text-white/85">
                    Terendah{chart.minDay ? ` · tgl ${chart.minDay.d}` : ''}
                  </div>
                  <div className="font-mono-num mt-1 text-[15px] font-bold">
                    {chart.minDay ? formatRp(chart.minDay.tot || 0) : '–'}
                  </div>
                </div>
                <div className={`rounded-xl px-3.5 py-3 ${cvTone}`}>
                  <div className="text-[11px] opacity-85">Fluktuasi</div>
                  <div className="font-mono-num mt-1 text-[15px] font-bold">±{chart.cv}%</div>
                </div>
                <div className="rounded-xl bg-[#334155] px-3.5 py-3 text-white">
                  <div className="text-[11px] text-white/80">Rata-rata P1 (1–15)</div>
                  <div className="font-mono-num mt-1 text-[15px] font-bold">
                    {chart.hasP1 ? formatRp(Math.round(chart.avgP1)) : '–'}
                  </div>
                </div>
                <div className="rounded-xl bg-[#334155] px-3.5 py-3 text-white">
                  <div className="text-[11px] text-white/80">Rata-rata P2 (16–{chart.nd})</div>
                  <div className="font-mono-num mt-1 text-[15px] font-bold">
                    {chart.hasP2 ? formatRp(Math.round(chart.avgP2)) : '–'}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Interactive SVG Chart Card */}
          <div className="rounded-xl border border-[#dde2e6] bg-white p-4">
            {/* Hover Inspector Line */}
            <div className="mb-2 flex min-h-[24px] flex-wrap items-center justify-between gap-2 text-xs">
              {hoveredPoint ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#1f2a36]">
                  <strong>
                    {DAY_NAMES[getDayOfWeek(ym, hoveredPoint.d)]}, {hoveredPoint.d} {monthName}
                  </strong>
                  {!hoveredPoint.has ? (
                    <span className="text-[#64748b]">Belum ada data</span>
                  ) : (
                    <>
                      {chart.metric.series.map((s) => (
                        <span key={s.k} className="text-[#475569]">
                          {s.l}:{' '}
                          <strong className="font-mono-num text-[#1f2a36]">
                            {div
                              ? formatSignedRp(hoveredPoint.v[s.k])
                              : formatRp(hoveredPoint.v[s.k])}
                          </strong>
                        </span>
                      ))}
                      {chart.metric.series.length > 1 && (
                        <span className="text-[#147a72] font-semibold">
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
                className="block w-full min-w-[680px] h-auto"
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
                        stroke={isZero ? '#475569' : '#e2e8f0'}
                        strokeWidth={isZero ? 1.5 : 1}
                      />
                      <text
                        x={L - 8}
                        y={yPos + 4}
                        textAnchor="end"
                        fontSize={11}
                        fontWeight={600}
                        fill="#1e293b"
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
                  y1={T - 6}
                  y2={T + ph}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                />
                <text
                  x={L + 7.5 * sx}
                  y={T - 12}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="#475569"
                >
                  PERIODE 1
                </text>
                <text
                  x={L + (15 + (chart.nd - 15) / 2) * sx}
                  y={T - 12}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="#475569"
                >
                  PERIODE 2
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
                        y={sy(0) - 2}
                        width={bw}
                        height={2}
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
                        fill={x.tot >= 0 ? '#e0a030' : '#c94a5b'}
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
                          fill={s.c}
                        />
                      );
                      y0 += val;
                    });
                    if (y0 === 0) {
                      rects.push(
                        <rect
                          key="zero"
                          x={bx}
                          y={sy(0) - 2}
                          width={bw}
                          height={2}
                          rx={1}
                          fill="#94a3b8"
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
                          fill="#1a9e94"
                          opacity={0.08}
                        />
                      )}
                      {barNodes}
                      {isPeak && x.tot !== null && (
                        <text
                          x={cx}
                          y={x.tot >= 0 ? sy(x.tot) - 6 : sy(x.tot) + 14}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={800}
                          fill={chart.maxDay && x.d === chart.maxDay.d ? '#0f5f58' : '#991b1b'}
                          stroke="#ffffff"
                          strokeWidth={3}
                          paintOrder="stroke"
                        >
                          {formatOmsetShort(x.tot)}
                        </text>
                      )}
                      <text
                        x={cx}
                        y={H - 10}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={isSun ? 800 : 600}
                        fill={isSun ? '#b91c1c' : '#1e293b'}
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
                  stroke="#0f172a"
                  strokeWidth={1.6}
                  strokeDasharray="7 5"
                />
                <text
                  x={W - R - 4}
                  y={sy(chart.avg) - 6}
                  textAnchor="end"
                  fontSize={11}
                  fontWeight={800}
                  fill="#0f172a"
                  stroke="#ffffff"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  Rata-rata {div ? formatSignedRp(Math.round(chart.avg)) : formatOmsetShort(chart.avg)}
                </text>
              </svg>
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-[#edf1f4] pt-2.5 text-xs text-[#475569]">
              {div ? (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-[#e0a030]" />
                    Selisih lebih (+)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-[#c94a5b]" />
                    Selisih kurang (−)
                  </span>
                </>
              ) : (
                chart.metric.series.map((s) => (
                  <span key={s.k} className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs" style={{ backgroundColor: s.c }} />
                    {s.l}
                  </span>
                ))
              )}
              <span className="inline-flex items-center gap-1.5">
                <span className="w-5 border-t-2 border-dashed border-[#0f172a]" />
                Rata-rata
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[3px] w-3 bg-[#cbd5e1]" />
                Belum ada data
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
