import { DAY_NAMES, MONTH_NAMES } from '../constants/defaults';

export const pad2 = (n: number): string => String(n).padStart(2, '0');

export function getTodayParts(): { ym: string; day: number; dateKey: string } {
  const now = new Date();
  const ym = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const day = now.getDate();
  return { ym, day, dateKey: `${ym}-${pad2(day)}` };
}

export const getYear = (ym: string): number => Number(ym.slice(0, 4));
export const getMonth = (ym: string): number => Number(ym.slice(5, 7));

export function getDaysInMonth(ym: string): number {
  return new Date(getYear(ym), getMonth(ym), 0).getDate();
}

export function getDayOfWeek(ym: string, day: number): number {
  return new Date(getYear(ym), getMonth(ym) - 1, day).getDay();
}

export function getMonthLabel(ym: string): string {
  return `${MONTH_NAMES[getMonth(ym) - 1]} ${getYear(ym)}`;
}

export function getFullDateLabel(ym: string, day: number): string {
  return `${DAY_NAMES[getDayOfWeek(ym, day)]}, ${day} ${MONTH_NAMES[getMonth(ym) - 1]} ${getYear(ym)}`;
}

export function shiftMonth(ym: string, delta: number): string {
  const t = new Date(getYear(ym), getMonth(ym) - 1 + delta, 1);
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}`;
}

export function shiftDay(ym: string, day: number, delta: number): { ym: string; day: number } {
  const t = new Date(getYear(ym), getMonth(ym) - 1, day + delta);
  return {
    ym: `${t.getFullYear()}-${pad2(t.getMonth() + 1)}`,
    day: t.getDate(),
  };
}

export const formatDateKey = (ym: string, day: number): string => `${ym}-${pad2(day)}`;

export const hasVal = (v: unknown): v is number => v !== undefined && v !== null;

export const formatNum = (v: number | null | undefined): string =>
  v == null ? '–' : Number(v).toLocaleString('id-ID');

export const formatRp = (v: number | null | undefined): string => {
  const n = Number(v || 0);
  return (n < 0 ? '−Rp ' : 'Rp ') + Math.abs(n).toLocaleString('id-ID');
};

export function formatShortRp(v: number | null | undefined): string {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  const sg = n < 0 ? '−' : '';
  if (a >= 1e6) return `${sg}${(a / 1e6).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}jt`;
  if (a >= 1e3) return `${sg}${Math.round(a / 1e3)}rb`;
  return `${sg}${a}`;
}
