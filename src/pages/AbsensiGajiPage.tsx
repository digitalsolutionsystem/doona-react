import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Calendar,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  ExternalLink,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Save,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { EmployeeAvatar } from '../components/EmployeeAvatar';
import { DAY_NAMES, MONTH_NAMES } from '../constants/defaults';
import { useApp } from '../context/AppContext';
import {
  ATTENDANCE_STATUSES,
  buildRekapSlipWA,
  buildSingleEmpSlipWA,
  calcAttendanceRecordPay,
  calcEmployeePayroll,
  getActiveEmployees,
  getAllEmployeesWithArchive,
  getArchivedEmployees,
  getAttendanceCalendarMonth,
  getDailyAttendanceViewModel,
  getEmployees,
  getEmployeesForPayrollPeriod,
  getPayrollRange,
  isEmployeeArchived,
} from '../domain/attendanceCalculations';
import {
  formatDateKey,
  formatNum,
  formatRp,
  getDayOfWeek,
  getDaysInMonth,
  getMonth,
  getTodayParts,
  getYear,
} from '../domain/dateUtils';
import type { AbsensiSubTab, AttendanceStatus, Employee, PayrollCycle } from '../types/app';

const STATUS_BUTTON_ACTIVE: Record<AttendanceStatus, string> = {
  Hadir: 'border-[#14533c] bg-[#14533c] text-white',
  Izin: 'border-[#b45309] bg-[#b45309] text-white',
  Sakit: 'border-[#2c5282] bg-[#2c5282] text-white',
  Alfa: 'border-[#b91c1c] bg-[#b91c1c] text-white',
  Libur: 'border-[#3f4642] bg-[#3f4642] text-white',
};

const STATUS_TEXT_COLOR: Record<AttendanceStatus, string> = {
  Hadir: 'text-[#14533c]',
  Izin: 'text-[#b45309]',
  Sakit: 'text-[#2c5282]',
  Alfa: 'text-[#b91c1c]',
  Libur: 'text-[#565e59]',
};

const PAYROLL_CYCLES: Array<{ id: PayrollCycle; label: string }> = [
  { id: 'p1', label: 'Tahap 1 · 1–15' },
  { id: 'p2', label: 'Tahap 2 · 16–akhir' },
  { id: 'full', label: '1 bulan' },
];

export const AbsensiGajiPage: React.FC = () => {
  const {
    state,
    ym,
    day,
    abSub,
    setAbSub,
    abCycle,
    setAbCycle,
    absDraft,
    absSaving,
    absUnsent,
    absSaveError,
    isViewer,
    moveMonth,
    moveDay,
    selectDateStr,
    setMonthAndDay,
    goToday,
    navigateTo,
    setAttendanceDraftStatus,
    setAttendanceDraftLembur,
    adjustAttendanceDraftLembur,
    setAllAttendanceHadir,
    saveAttendanceDay,
    saveEmployee,
    toggleEmployeeActive,
    archiveEmployee,
    restoreArchivedEmployee,
  } = useApp();

  const [prevSub, setPrevSub] = useState<AbsensiSubTab>('harian');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [calSelDay, setCalSelDay] = useState<number>(day);
  const [detailShowAll, setDetailShowAll] = useState<boolean>(false);
  const [showArchiveList, setShowArchiveList] = useState<boolean>(false);

  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  const [empModalOpen, setEmpModalOpen] = useState<boolean>(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [formNama, setFormNama] = useState<string>('');
  const [formFoto, setFormFoto] = useState<string>('');
  const [formGaji, setFormGaji] = useState<string>('75000');
  const [formLembur, setFormLembur] = useState<string>('25000');
  const [formSiklus, setFormSiklus] = useState<'14hari' | 'bulanan'>('14hari');
  const [formApplyRetroactive, setFormApplyRetroactive] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<Employee | null>(null);
  const [waModal, setWaModal] = useState<{ title: string; text: string } | null>(null);

  const nd = getDaysInMonth(ym);
  const yearNum = getYear(ym);
  const monthNum = getMonth(ym);
  const monthLabel = `${MONTH_NAMES[monthNum - 1]} ${yearNum}`;
  const todayParts = useMemo(() => getTodayParts(), []);
  const dateIso = formatDateKey(ym, day);
  const activeTabKey: AbsensiSubTab = abSub === 'detail' ? prevSub : abSub;

  useEffect(() => {
    setCalSelDay((prev) => Math.min(Math.max(1, prev || day), nd));
  }, [ym, nd, day]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const showToast = (text: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ text, tone });
  };

  const masterEmployees = useMemo(() => getEmployees(state), [state]);
  const activeEmployees = useMemo(() => getActiveEmployees(state), [state]);
  const archivedEmployees = useMemo(() => getArchivedEmployees(state), [state]);
  const allEmployeesWithArchive = useMemo(() => getAllEmployeesWithArchive(state), [state]);

  const payrollRange = useMemo(() => getPayrollRange(ym, abCycle), [ym, abCycle]);

  const dailyModel = useMemo(
    () => getDailyAttendanceViewModel(state, ym, day, absDraft),
    [state, ym, day, absDraft]
  );

  const calendarData = useMemo(() => getAttendanceCalendarMonth(state, ym), [state, ym]);

  const payrollRows = useMemo(() => {
    const emps = getEmployeesForPayrollPeriod(state, ym, payrollRange);
    let totalGaji = 0;
    let totalGapok = 0;
    let totalLemburRp = 0;
    let totalHadir = 0;
    let totalLemburPaket = 0;

    const list = emps.map(({ emp, isArchived }) => {
      const calc = calcEmployeePayroll(state, ym, emp, payrollRange);
      totalGaji += calc.tot;
      totalGapok += calc.gp;
      totalLemburRp += calc.ul;
      totalHadir += calc.h;
      totalLemburPaket += calc.lm;
      return { emp, isArchived, calc };
    });

    return {
      list,
      totalGaji,
      totalGapok,
      totalLemburRp,
      totalHadir,
      totalLemburPaket,
    };
  }, [state, ym, payrollRange]);

  const selectedEmployee = useMemo(() => {
    if (selectedEmpId) {
      const found = allEmployeesWithArchive.find((e) => e.id === selectedEmpId);
      if (found) return found;
    }
    return activeEmployees[0] || masterEmployees[0] || archivedEmployees[0] || null;
  }, [selectedEmpId, allEmployeesWithArchive, activeEmployees, masterEmployees, archivedEmployees]);

  const openEmpDetail = (empId: string) => {
    setSelectedEmpId(empId);
    if (abSub !== 'detail') setPrevSub(abSub);
    setAbSub('detail');
  };

  const backFromDetail = () => {
    setAbSub(prevSub === 'detail' ? 'harian' : prevSub);
  };

  const handleSaveToday = async () => {
    const res = await saveAttendanceDay(ym, day);
    if (res.ok) {
      showToast(`Absensi tgl ${day} ${MONTH_NAMES[monthNum - 1]} berhasil disimpan.`);
    } else if (res.error) {
      showToast(res.error, 'err');
    }
  };

  const openAddModal = () => {
    setEditEmp(null);
    setFormNama('');
    setFormFoto('');
    setFormGaji('75000');
    setFormLembur('25000');
    setFormSiklus('14hari');
    setFormApplyRetroactive(false);
    setFormError(null);
    setEmpModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditEmp(emp);
    setFormNama(emp.nama || '');
    setFormFoto(emp.foto || '');
    setFormGaji(String(Number(emp.gajiHarian) || 0));
    setFormLembur(String(Number(emp.lemburPerPaket) || 0));
    setFormSiklus(emp.siklusGaji === 'bulanan' ? 'bulanan' : '14hari');
    setFormApplyRetroactive(false);
    setFormError(null);
    setEmpModalOpen(true);
  };

  const isEditingTariffChanged = useMemo(() => {
    if (!editEmp) return false;
    const nextGaji = Math.max(0, Math.round(Number(formGaji) || 0));
    const nextLembur = Math.max(0, Math.round(Number(formLembur) || 0));
    return (
      nextGaji !== (Number(editEmp.gajiHarian) || 0) ||
      nextLembur !== (Number(editEmp.lemburPerPaket) || 0)
    );
  }, [editEmp, formGaji, formLembur]);

  const handleSubmitEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const res = saveEmployee({
      id: editEmp?.id,
      nama: formNama,
      foto: formFoto,
      gajiHarian: Number(formGaji) || 0,
      lemburPerPaket: Number(formLembur) || 0,
      siklusGaji: formSiklus,
      applyRetroactive: formApplyRetroactive,
    });
    if (!res.ok) {
      setFormError(res.error || 'Gagal menyimpan data karyawan.');
      return;
    }
    setEmpModalOpen(false);
    showToast(editEmp ? 'Data karyawan berhasil diperbarui.' : 'Karyawan baru berhasil ditambahkan.');
  };

  const handleConfirmArchive = () => {
    if (!archiveTarget) return;
    const name = archiveTarget.nama;
    archiveEmployee(archiveTarget.id);
    setArchiveTarget(null);
    showToast(`"${name}" dipindahkan ke arsip. Riwayat absensi tetap tersimpan.`);
  };

  const copyTextToClipboard = async (title: string, text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showToast(`${title} disalin ke clipboard (siap ditempel ke WhatsApp).`);
        return;
      }
    } catch {
      // Fallback ke modal salin manual jika izin clipboard diblokir iframe
    }
    setWaModal({ title, text });
  };

  const handleCopyRekapWA = () => {
    const txt = buildRekapSlipWA(state, ym, abCycle);
    void copyTextToClipboard('Rekap gaji', txt);
  };

  const handleCopySingleSlipWA = (emp: Employee) => {
    const txt = buildSingleEmpSlipWA(state, ym, abCycle, emp.id);
    if (!txt) return;
    void copyTextToClipboard(`Slip gaji ${emp.nama}`, txt);
  };

  const renderCycleSwitcher = () => (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg border border-[#e5e5df] bg-[#f1f1ec] p-0.5"
      role="tablist"
      aria-label="Siklus gaji"
    >
      {PAYROLL_CYCLES.map((c) => {
        const active = abCycle === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setAbCycle(c.id)}
            className={`h-7 shrink-0 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              active
                ? 'bg-[#14533c] text-white'
                : 'text-[#565e59] hover:bg-white hover:text-[#141816]'
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );

  const selectedCalInfo = useMemo(() => {
    const safeDay = Math.min(Math.max(1, calSelDay), nd);
    return calendarData.days[safeDay - 1] || null;
  }, [calendarData.days, calSelDay, nd]);

  const detailViewData = useMemo(() => {
    if (!selectedEmployee) return null;
    const calc = calcEmployeePayroll(state, ym, selectedEmployee, payrollRange);
    const startDay = detailShowAll ? 1 : payrollRange.start;
    const endDay = detailShowAll ? nd : payrollRange.end;
    const absMonth = state.absensi?.[ym] || {};

    const dayRows = [];
    for (let d = startDay; d <= endDay; d++) {
      const rec = absMonth[d]?.[selectedEmployee.id];
      const pay = calcAttendanceRecordPay(selectedEmployee, rec);
      const dow = getDayOfWeek(ym, d);
      const inRange = d >= payrollRange.start && d <= payrollRange.end;
      dayRows.push({
        day: d,
        dow,
        dayName: DAY_NAMES[dow],
        rec,
        gp: pay.gp,
        ul: pay.ul,
        tot: pay.tot,
        lm: pay.lm,
        inRange,
      });
    }

    const archived = isEmployeeArchived(state, selectedEmployee.id);
    const offBreakdown = [
      ['Izin', calc.iz],
      ['Sakit', calc.s],
      ['Alfa', calc.a],
      ['Libur', calc.l],
    ]
      .filter(([, count]) => Number(count) > 0)
      .map(([lbl, count]) => `${lbl} ${count}`)
      .join(' · ');

    return { calc, dayRows, archived, offBreakdown };
  }, [selectedEmployee, state, ym, payrollRange, detailShowAll, nd]);

  const calendarLeadingBlanks = getDayOfWeek(ym, 1);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f7f4]">
      {/* TOP TOOLBAR */}
      <div className="no-print flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e5e5df] bg-white px-4 py-3 sm:px-6">
        {abSub === 'harian' ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => moveDay(-1)}
              aria-label="Hari sebelumnya"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5df] bg-white text-[#565e59] hover:bg-[#f4f4ef] hover:text-[#141816] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={dateIso}
              onChange={(e) => selectDateStr(e.target.value)}
              aria-label="Pilih tanggal absensi"
              className="font-mono-num h-8 rounded-lg border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#141816] focus:border-[#14533c] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => moveDay(1)}
              aria-label="Hari berikutnya"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5df] bg-white text-[#565e59] hover:bg-[#f4f4ef] hover:text-[#141816] cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="h-8 shrink-0 rounded-lg border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#141816] hover:bg-[#f4f4ef] whitespace-nowrap cursor-pointer"
            >
              Hari ini
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="Bulan sebelumnya"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5df] bg-white text-[#565e59] hover:bg-[#f4f4ef] hover:text-[#141816] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-display min-w-[140px] text-center text-[14px] font-semibold text-[#141816]">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="Bulan berikutnya"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e5df] bg-white text-[#565e59] hover:bg-[#f4f4ef] hover:text-[#141816] cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* SUB-TAB SWITCHER */}
        <div
          className="flex items-center gap-0.5 overflow-x-auto rounded-lg border border-[#e5e5df] bg-[#f1f1ec] p-0.5"
          role="tablist"
          aria-label="Submenu Absensi & Gaji"
        >
          {(
            [
              { id: 'harian', label: 'Absen', icon: Calendar },
              { id: 'kalender', label: 'Kalender', icon: CalendarDays },
              { id: 'karyawan', label: 'Karyawan', icon: Users },
              { id: 'rekap', label: 'Rekap gaji', icon: Wallet },
            ] as Array<{
              id: AbsensiSubTab;
              label: string;
              icon: React.ComponentType<{ className?: string }>;
            }>
          ).map((tab) => {
            const Icon = tab.icon;
            const isOn = activeTabKey === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isOn}
                onClick={() => {
                  if (tab.id === 'kalender') setCalSelDay(Math.min(day, nd));
                  setAbSub(tab.id);
                }}
                className={`flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isOn
                    ? 'bg-[#14533c] text-white'
                    : 'text-[#565e59] hover:bg-white hover:text-[#141816]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* INLINE TOAST / DB ERROR BANNER */}
      {(toast || absSaveError) && (
        <div className="no-print shrink-0 border-b border-[#e5e5df] bg-white px-4 py-2 sm:px-6">
          {absSaveError && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#f5c2c2] bg-[#fef2f2] px-3.5 py-2 text-xs text-[#991b1b]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#b91c1c]" />
                <span>{absSaveError}</span>
              </div>
              {!isViewer && abSub === 'harian' && (
                <button
                  type="button"
                  disabled={absSaving}
                  onClick={handleSaveToday}
                  className="shrink-0 rounded-md bg-[#b91c1c] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#991b1b] whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  Kirim ulang
                </button>
              )}
            </div>
          )}
          {toast && !absSaveError && (
            <div
              className={`flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium ${
                toast.tone === 'err'
                  ? 'border-[#f5c2c2] bg-[#fef2f2] text-[#991b1b]'
                  : 'border-[#d6e4dd] bg-[#f4faf7] text-[#14533c]'
              }`}
            >
              <span>{toast.text}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Tutup notifikasi"
                className="text-current opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* MAIN SCROLLABLE CONTENT */}
      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-[1160px]">
          {/* ─────────────────── TAB 1: ABSENSI HARIAN ─────────────────── */}
          {abSub === 'harian' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#141816]">
                    Absensi {DAY_NAMES[getDayOfWeek(ym, day)]}, {day} {monthLabel}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#7c8580]">
                    Gaji pokok hanya dihitung pada status Hadir · Libur, Izin, Sakit, dan Alfa tidak
                    menambah gaji pokok
                  </p>
                </div>
                {dailyModel.draftDayCount > 0 && (
                  <span className="text-xs font-medium text-[#b45309]">
                    Ada draf belum disimpan ({dailyModel.draftDayCount} tanggal)
                  </span>
                )}
              </div>

              {activeEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#dcdcd4] bg-white py-14 text-center">
                  <Users className="mb-3 h-8 w-8 text-[#9aa39d]" />
                  <p className="text-sm font-medium text-[#141816]">Belum ada karyawan aktif.</p>
                  <p className="mt-1 text-xs text-[#7c8580]">
                    Tambahkan atau aktifkan karyawan terlebih dahulu untuk mulai mencatat absensi.
                  </p>
                  {!isViewer && (
                    <button
                      type="button"
                      onClick={() => setAbSub('karyawan')}
                      className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#14533c] px-4 text-xs font-medium text-white hover:bg-[#0f3f2d] cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Kelola Karyawan</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* 3-COLUMN SUMMARY LEDGER STRIP */}
                  <div className="grid grid-cols-1 divide-y divide-[#efefea] overflow-hidden rounded-xl border border-[#e5e5df] bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    <div className="px-5 py-3.5">
                      <div className="text-xs font-medium text-[#7c8580]">Hadir</div>
                      <div className="font-mono-num mt-1 text-xl font-semibold text-[#141816]">
                        {dailyModel.hadir}
                        <span className="text-sm font-normal text-[#7c8580]">
                          /{activeEmployees.length}
                        </span>
                      </div>
                    </div>
                    <div className="px-5 py-3.5">
                      <div className="text-xs font-medium text-[#7c8580]">Lembur</div>
                      <div className="font-mono-num mt-1 text-xl font-semibold text-[#141816]">
                        {dailyModel.lembur}
                        <span className="ml-1 text-sm font-normal text-[#7c8580]">paket</span>
                      </div>
                    </div>
                    <div className="bg-[#f4faf7] px-5 py-3.5">
                      <div className="text-xs font-medium text-[#14533c]">Total gaji hari ini</div>
                      <div className="font-mono-num mt-1 text-xl font-semibold text-[#14533c]">
                        {formatRp(dailyModel.gaji)}
                      </div>
                    </div>
                  </div>

                  {/* ATTENDANCE LIST */}
                  <div className="divide-y divide-[#efefea] overflow-hidden rounded-xl border border-[#e5e5df] bg-white">
                    {dailyModel.rows.map((row) => {
                      const { emp, effective, isSaved, gp, ul, tot } = row;
                      return (
                        <div
                          key={emp.id}
                          className={`grid grid-cols-1 items-center gap-3 px-4 py-3.5 transition-colors lg:grid-cols-[minmax(190px,1.2fr)_auto_auto_minmax(150px,0.8fr)] ${
                            isSaved ? 'bg-white' : 'bg-[#fdf9ee]/70'
                          }`}
                        >
                          {/* WHO */}
                          <div className="flex items-center gap-3">
                            <EmployeeAvatar nama={emp.nama} foto={emp.foto} size="md" />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => openEmpDetail(emp.id)}
                                className="block truncate text-left text-[13.5px] font-semibold text-[#141816] hover:text-[#14533c] hover:underline cursor-pointer"
                                title="Klik untuk lihat rincian & slip gaji"
                              >
                                {emp.nama}
                              </button>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px]">
                                <span
                                  className={
                                    isSaved
                                      ? 'font-medium text-[#15803d]'
                                      : 'font-medium text-[#b45309]'
                                  }
                                >
                                  {isSaved ? 'Tersimpan' : 'Belum disimpan'}
                                </span>
                                <span aria-hidden="true" className="text-[#c5c5bc]">
                                  ·
                                </span>
                                <span className="font-mono-num text-[#7c8580]">
                                  {formatRp(emp.gajiHarian)}/hr
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* STATUS BUTTONS */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {ATTENDANCE_STATUSES.map((st) => {
                              const isSelected = effective.status === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  disabled={isViewer}
                                  onClick={() => setAttendanceDraftStatus(ym, day, emp.id, st)}
                                  className={`h-8 shrink-0 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                                    isSelected
                                      ? STATUS_BUTTON_ACTIVE[st]
                                      : 'border-[#e5e5df] bg-white text-[#565e59] hover:border-[#b5b5ac] hover:text-[#141816]'
                                  }`}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>

                          {/* LEMBUR STEPPER */}
                          <div className="flex items-center gap-2">
                            <div className="inline-flex items-center overflow-hidden rounded-lg border border-[#e5e5df] bg-white">
                              <button
                                type="button"
                                disabled={isViewer || effective.lembur <= 0}
                                onClick={() => adjustAttendanceDraftLembur(ym, day, emp.id, -1)}
                                aria-label={`Kurangi lembur ${emp.nama}`}
                                className="flex h-8 w-8 items-center justify-center text-[#565e59] hover:bg-[#f4f4ef] disabled:opacity-40 cursor-pointer"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                disabled={isViewer}
                                value={effective.lembur}
                                onChange={(e) =>
                                  setAttendanceDraftLembur(
                                    ym,
                                    day,
                                    emp.id,
                                    parseInt(e.target.value, 10) || 0
                                  )
                                }
                                aria-label={`Paket lembur ${emp.nama}`}
                                className="font-mono-num h-8 w-12 border-x border-[#efefea] text-center text-xs font-semibold text-[#141816] focus:outline-none disabled:bg-[#f4f4ef]"
                              />
                              <button
                                type="button"
                                disabled={isViewer}
                                onClick={() => adjustAttendanceDraftLembur(ym, day, emp.id, 1)}
                                aria-label={`Tambah lembur ${emp.nama}`}
                                className="flex h-8 w-8 items-center justify-center text-[#565e59] hover:bg-[#f4f4ef] disabled:opacity-40 cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <span className="font-mono-num text-[11.5px] text-[#7c8580] whitespace-nowrap">
                              paket × {formatNum(emp.lemburPerPaket)}
                            </span>
                          </div>

                          {/* DAILY PAY PREVIEW */}
                          <div className="text-left lg:text-right">
                            <div className="font-mono-num text-sm font-semibold text-[#141816]">
                              {formatRp(tot)}
                            </div>
                            <div className="font-mono-num text-[11px] text-[#7c8580]">
                              Pokok {formatNum(gp)} · Lembur {formatNum(ul)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─────────────────── TAB 2: KALENDER ABSENSI ─────────────────── */}
          {abSub === 'kalender' && (
            <div className="space-y-5">
              {/* SUMMARY STRIP */}
              <div className="grid grid-cols-1 divide-y divide-[#efefea] overflow-hidden rounded-xl border border-[#e5e5df] bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="px-5 py-3.5">
                  <div className="text-xs font-medium text-[#7c8580]">Hari terisi</div>
                  <div className="font-mono-num mt-1 text-xl font-semibold text-[#141816]">
                    {calendarData.filledDays}
                    <span className="text-sm font-normal text-[#7c8580]">/{nd}</span>
                  </div>
                </div>
                <div className="px-5 py-3.5">
                  <div className="text-xs font-medium text-[#7c8580]">Tidak hadir</div>
                  <div className="font-mono-num mt-1 text-xl font-semibold text-[#141816]">
                    {calendarData.totalAbsent}
                    <span className="ml-1 text-sm font-normal text-[#7c8580]">orang-hari</span>
                  </div>
                </div>
                <div className="bg-[#f4faf7] px-5 py-3.5">
                  <div className="text-xs font-medium text-[#14533c]">Total hadir</div>
                  <div className="font-mono-num mt-1 text-xl font-semibold text-[#14533c]">
                    {calendarData.totalHadir}
                    <span className="ml-1 text-sm font-normal text-[#14533c]/75">orang-hari</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(290px,1fr)]">
                {/* CALENDAR GRID */}
                <div className="rounded-xl border border-[#e5e5df] bg-white p-4 sm:p-5">
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAY_NAMES.map((dn, idx) => (
                      <div
                        key={dn}
                        className={`pb-1.5 text-center text-[11.5px] font-medium ${
                          idx === 0 ? 'text-[#b91c1c]' : 'text-[#7c8580]'
                        }`}
                      >
                        {dn.slice(0, 3)}
                      </div>
                    ))}

                    {Array.from({ length: calendarLeadingBlanks }).map((_, idx) => (
                      <div key={`blank-${idx}`} className="h-16 rounded-lg" />
                    ))}

                    {calendarData.days.map((info) => {
                      const isSel = info.day === calSelDay;
                      const isToday = ym === todayParts.ym && info.day === todayParts.day;
                      const isSunday = getDayOfWeek(ym, info.day) === 0;

                      const toneClass =
                        info.status === 'full'
                          ? 'border-[#c7dfd3] bg-[#f4faf7]'
                          : info.status === 'part'
                            ? 'border-[#e7c78a] bg-[#fdf9ee]'
                            : info.status === 'zero'
                              ? 'border-[#f5c2c2] bg-[#fef2f2]'
                              : 'border-[#efefea] bg-white';

                      return (
                        <button
                          key={info.day}
                          type="button"
                          onClick={() => setCalSelDay(info.day)}
                          className={`relative flex h-16 flex-col items-start justify-between rounded-lg border p-2 text-left transition-colors cursor-pointer hover:border-[#14533c] ${toneClass} ${
                            isSel ? 'border-[#14533c] ring-1 ring-[#14533c]' : ''
                          }`}
                        >
                          <div className="flex w-full items-center justify-between">
                            <span
                              className={`font-mono-num text-xs font-semibold ${
                                isSunday ? 'text-[#b91c1c]' : 'text-[#141816]'
                              }`}
                            >
                              {info.day}
                            </span>
                            {isToday && (
                              <span className="text-[10px] font-semibold text-[#14533c]">
                                Hari ini
                              </span>
                            )}
                          </div>
                          {info.recordedCount > 0 ? (
                            <div className="font-mono-num flex flex-wrap items-center gap-x-1.5 text-[11px] font-semibold">
                              <span className="text-[#14533c]">{info.hadirCount}H</span>
                              {info.absentCount > 0 && (
                                <span className="text-[#b91c1c]">{info.absentCount}A</span>
                              )}
                              {info.pendingCount > 0 && (
                                <span className="text-[10px] font-normal text-[#b45309]">
                                  +{info.pendingCount}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#9aa39d]">–</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SELECTED DAY ASIDE */}
                <aside className="overflow-hidden rounded-xl border border-[#e5e5df] bg-white">
                  {selectedCalInfo ? (
                    <>
                      <div className="border-b border-[#efefea] px-5 py-4">
                        <h3 className="font-display text-[15px] font-semibold text-[#141816]">
                          {DAY_NAMES[getDayOfWeek(ym, selectedCalInfo.day)]}, {selectedCalInfo.day}{' '}
                          {monthLabel}
                        </h3>
                        <p className="mt-0.5 text-xs text-[#7c8580]">
                          {selectedCalInfo.people.length === 0
                            ? 'Belum ada karyawan.'
                            : `${selectedCalInfo.hadirCount} hadir · ${selectedCalInfo.absentCount} tidak hadir${
                                selectedCalInfo.pendingCount > 0
                                  ? ` · ${selectedCalInfo.pendingCount} belum diisi`
                                  : ''
                              }`}
                        </p>
                      </div>

                      <div className="divide-y divide-[#efefea]">
                        {/* HADIR */}
                        {selectedCalInfo.people.filter((p) => p.record?.status === 'Hadir').length >
                          0 && (
                          <div className="px-5 py-3.5">
                            <div className="mb-2 text-xs font-semibold text-[#14533c]">
                              Hadir (
                              {
                                selectedCalInfo.people.filter((p) => p.record?.status === 'Hadir')
                                  .length
                              }
                              )
                            </div>
                            <div className="divide-y divide-[#efefea]">
                              {selectedCalInfo.people
                                .filter((p) => p.record?.status === 'Hadir')
                                .map(({ emp, record, isArchived }) => (
                                  <div
                                    key={emp.id}
                                    className="flex items-center justify-between gap-2 py-2"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <EmployeeAvatar nama={emp.nama} foto={emp.foto} size="sm" />
                                      <button
                                        type="button"
                                        onClick={() => openEmpDetail(emp.id)}
                                        className="truncate text-xs font-medium text-[#141816] hover:text-[#14533c] hover:underline cursor-pointer"
                                      >
                                        {emp.nama}
                                        {isArchived ? ' (Arsip)' : ''}
                                      </button>
                                    </div>
                                    {record && Number(record.lembur) > 0 && (
                                      <span className="font-mono-num text-[11px] font-medium text-[#7c8580] whitespace-nowrap">
                                        lembur {record.lembur} pkt
                                      </span>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* TIDAK HADIR */}
                        {selectedCalInfo.people.filter(
                          (p) => p.record && p.record.status !== 'Hadir'
                        ).length > 0 && (
                          <div className="px-5 py-3.5">
                            <div className="mb-2 text-xs font-semibold text-[#b91c1c]">
                              Tidak hadir (
                              {
                                selectedCalInfo.people.filter(
                                  (p) => p.record && p.record.status !== 'Hadir'
                                ).length
                              }
                              )
                            </div>
                            <div className="divide-y divide-[#efefea]">
                              {selectedCalInfo.people
                                .filter((p) => p.record && p.record.status !== 'Hadir')
                                .map(({ emp, record, isArchived }) => (
                                  <div
                                    key={emp.id}
                                    className="flex items-center justify-between gap-2 py-2"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <EmployeeAvatar nama={emp.nama} foto={emp.foto} size="sm" />
                                      <button
                                        type="button"
                                        onClick={() => openEmpDetail(emp.id)}
                                        className="truncate text-xs font-medium text-[#141816] hover:text-[#14533c] hover:underline cursor-pointer"
                                      >
                                        {emp.nama}
                                        {isArchived ? ' (Arsip)' : ''}
                                      </button>
                                    </div>
                                    {record && (
                                      <span
                                        className={`text-xs font-semibold ${STATUS_TEXT_COLOR[record.status]}`}
                                      >
                                        {record.status}
                                      </span>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* BELUM DIISI */}
                        {selectedCalInfo.people.filter((p) => !p.record).length > 0 && (
                          <div className="px-5 py-3.5">
                            <div className="mb-2 text-xs font-medium text-[#7c8580]">
                              Belum diisi ({selectedCalInfo.people.filter((p) => !p.record).length})
                            </div>
                            <div className="divide-y divide-[#efefea]">
                              {selectedCalInfo.people
                                .filter((p) => !p.record)
                                .map(({ emp }) => (
                                  <div
                                    key={emp.id}
                                    className="flex items-center justify-between gap-2 py-2"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <EmployeeAvatar nama={emp.nama} foto={emp.foto} size="sm" />
                                      <span className="truncate text-xs font-medium text-[#565e59]">
                                        {emp.nama}
                                      </span>
                                    </div>
                                    <span className="text-xs text-[#9aa39d]">–</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}
                </aside>
              </div>
            </div>
          )}

          {/* ─────────────────── TAB 3: MASTER KARYAWAN ─────────────────── */}
          {abSub === 'karyawan' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#141816]">
                    Master Karyawan
                  </h2>
                  <p className="mt-0.5 text-xs text-[#7c8580]">
                    Sumber identitas, tarif gaji harian, tarif lembur per paket, dan siklus
                    penggajian
                  </p>
                </div>
                {archivedEmployees.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowArchiveList((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#565e59] hover:text-[#14533c] cursor-pointer"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span>
                      {showArchiveList ? 'Sembunyikan' : 'Lihat'} arsip ({archivedEmployees.length})
                    </span>
                  </button>
                )}
              </div>

              {masterEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#dcdcd4] bg-white py-14 text-center">
                  <Users className="mb-3 h-8 w-8 text-[#9aa39d]" />
                  <p className="text-sm font-medium text-[#141816]">Belum ada karyawan.</p>
                  {!isViewer && (
                    <button
                      type="button"
                      onClick={openAddModal}
                      className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#14533c] px-4 text-xs font-medium text-white hover:bg-[#0f3f2d] cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Tambah karyawan</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#e5e5df] bg-white">
                  <table className="w-full border-collapse text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#e5e5df] bg-[#fafaf8] text-xs font-medium text-[#7c8580]">
                        <th className="px-4 py-3">Nama</th>
                        <th className="px-4 py-3 text-right">Gaji harian</th>
                        <th className="px-4 py-3 text-right">Tarif lembur</th>
                        <th className="px-4 py-3 text-center">Siklus</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        {!isViewer && <th className="px-4 py-3 text-right">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#efefea]">
                      {masterEmployees.map((emp) => (
                        <tr
                          key={emp.id}
                          className={`hover:bg-[#fafaf8] ${emp.aktif ? '' : 'opacity-60'}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <EmployeeAvatar nama={emp.nama} foto={emp.foto} size="sm" />
                              <div>
                                <button
                                  type="button"
                                  onClick={() => openEmpDetail(emp.id)}
                                  className="font-semibold text-[#141816] hover:text-[#14533c] hover:underline cursor-pointer"
                                >
                                  {emp.nama}
                                </button>
                                <div className="font-mono-num text-[11px] text-[#7c8580]">
                                  ID: {emp.id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="font-mono-num px-4 py-3 text-right font-semibold text-[#141816] whitespace-nowrap">
                            {formatRp(emp.gajiHarian)}
                            <span className="font-sans text-[11px] font-normal text-[#7c8580]">
                              {' '}
                              /hari
                            </span>
                          </td>
                          <td className="font-mono-num px-4 py-3 text-right font-semibold text-[#141816] whitespace-nowrap">
                            {formatRp(emp.lemburPerPaket)}
                            <span className="font-sans text-[11px] font-normal text-[#7c8580]">
                              {' '}
                              /paket
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-medium text-[#565e59] whitespace-nowrap">
                            {emp.siklusGaji === 'bulanan' ? 'Bulanan' : '2x/bulan'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              disabled={isViewer}
                              onClick={() => toggleEmployeeActive(emp.id)}
                              className={`h-7 shrink-0 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer disabled:cursor-default ${
                                emp.aktif
                                  ? 'border-[#c7dfd3] bg-[#f4faf7] text-[#14533c] hover:bg-[#e5f2ec]'
                                  : 'border-[#dcdcd4] bg-[#fafaf8] text-[#7c8580] hover:bg-[#f1f1ec]'
                              }`}
                              title={
                                isViewer
                                  ? undefined
                                  : 'Klik untuk mengubah status aktif / nonaktif'
                              }
                            >
                              {emp.aktif ? 'Aktif' : 'Nonaktif'}
                            </button>
                          </td>
                          {!isViewer && (
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(emp)}
                                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#141816] hover:bg-[#f4f4ef] cursor-pointer"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setArchiveTarget(emp)}
                                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#f5c2c2] bg-white px-2.5 text-xs font-medium text-[#b91c1c] hover:bg-[#fef2f2] cursor-pointer"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                  <span>Arsipkan</span>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ARCHIVED EMPLOYEES SECTION */}
              {showArchiveList && archivedEmployees.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold text-[#565e59]">
                      Arsip Karyawan ({archivedEmployees.length})
                    </h3>
                    <span className="text-xs text-[#7c8580]">
                      Riwayat absensi &amp; penggajian tetap dipertahankan
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-[#e5e5df] bg-white">
                    <table className="w-full border-collapse text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-[#e5e5df] bg-[#fafaf8] text-xs font-medium text-[#7c8580]">
                          <th className="px-4 py-2.5">Nama</th>
                          <th className="px-4 py-2.5 text-right">Tarif terakhir</th>
                          <th className="px-4 py-2.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#efefea]">
                        {archivedEmployees.map((emp) => (
                          <tr key={emp.id} className="hover:bg-[#fafaf8]">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <EmployeeAvatar nama={emp.nama} foto={emp.foto} size="sm" />
                                <button
                                  type="button"
                                  onClick={() => openEmpDetail(emp.id)}
                                  className="font-medium text-[#565e59] hover:text-[#14533c] hover:underline cursor-pointer"
                                >
                                  {emp.nama}
                                </button>
                              </div>
                            </td>
                            <td className="font-mono-num px-4 py-2.5 text-right text-xs text-[#7c8580] whitespace-nowrap">
                              {formatRp(emp.gajiHarian)}/hr · Lembur {formatRp(emp.lemburPerPaket)}
                              /pkt
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEmpDetail(emp.id)}
                                  className="h-7 rounded-md border border-[#e5e5df] bg-white px-2.5 text-xs font-medium text-[#565e59] hover:bg-[#f4f4ef] cursor-pointer"
                                >
                                  Histori
                                </button>
                                {!isViewer && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      restoreArchivedEmployee(emp.id);
                                      showToast(`"${emp.nama}" dipulihkan ke daftar karyawan aktif.`);
                                    }}
                                    className="inline-flex h-7 items-center gap-1 rounded-md border border-[#c7dfd3] bg-[#f4faf7] px-2.5 text-xs font-medium text-[#14533c] hover:bg-[#e5f2ec] cursor-pointer"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    <span>Pulihkan</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────── TAB 4: REKAP GAJI ─────────────────── */}
          {abSub === 'rekap' && (
            <div className="space-y-5">
              {/* CYCLE SWITCHER BAR */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  {renderCycleSwitcher()}
                  <span className="text-xs text-[#7c8580]">
                    <strong className="font-medium text-[#141816]">{payrollRange.label}</strong>
                    {payrollRange.isBiweekly
                      ? ` · Dibayar tgl ${payrollRange.payDay} setelah toko tutup`
                      : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigateTo('om', {
                      ym,
                      omSub: 'rekap',
                      omPeriod: abCycle === 'p1' ? 1 : abCycle === 'p2' ? 2 : 0,
                    })
                  }
                  className="no-print inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[#14533c] hover:underline whitespace-nowrap cursor-pointer"
                >
                  <span>Sinkron dengan OMSET</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* SUMMARY STRIP */}
              <div className="grid grid-cols-1 divide-y divide-[#efefea] overflow-hidden rounded-xl border border-[#e5e5df] bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="bg-[#f4faf7] px-5 py-3.5">
                  <div className="text-xs font-medium text-[#14533c]">Total gaji periode</div>
                  <div className="font-mono-num mt-1 text-xl font-semibold text-[#14533c]">
                    {formatRp(payrollRows.totalGaji)}
                  </div>
                </div>
                <div className="px-5 py-3.5">
                  <div className="text-xs font-medium text-[#7c8580]">Hari hadir</div>
                  <div className="font-mono-num mt-1 text-xl font-semibold text-[#141816]">
                    {payrollRows.totalHadir}
                    <span className="ml-1 text-sm font-normal text-[#7c8580]">hari</span>
                  </div>
                </div>
                <div className="px-5 py-3.5">
                  <div className="text-xs font-medium text-[#7c8580]">Lembur</div>
                  <div className="font-mono-num mt-1 text-xl font-semibold text-[#141816]">
                    {payrollRows.totalLemburPaket}
                    <span className="ml-1 text-sm font-normal text-[#7c8580]">paket</span>
                  </div>
                </div>
              </div>

              {/* PAYROLL TABLE */}
              {payrollRows.list.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#dcdcd4] bg-white py-12 text-center text-sm text-[#7c8580]">
                  Belum ada karyawan untuk direkap.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#e5e5df] bg-white">
                  <table className="w-full border-collapse text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#e5e5df] bg-[#fafaf8] text-xs font-medium text-[#7c8580]">
                        <th className="px-4 py-3">Nama</th>
                        <th className="px-4 py-3 text-right">Hadir</th>
                        <th
                          className="px-4 py-3 text-right"
                          title="Libur · Izin · Sakit · Alfa"
                        >
                          Absen
                        </th>
                        <th className="px-4 py-3 text-right">Lembur</th>
                        <th className="px-4 py-3 text-right">Gaji pokok</th>
                        <th className="px-4 py-3 text-right">Uang lembur</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#efefea]">
                      {payrollRows.list.map(({ emp, isArchived, calc }) => (
                        <tr key={emp.id} className="hover:bg-[#fafaf8]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <EmployeeAvatar nama={emp.nama} foto={emp.foto} size="sm" />
                              <div>
                                <button
                                  type="button"
                                  onClick={() => openEmpDetail(emp.id)}
                                  className="font-semibold text-[#141816] hover:text-[#14533c] hover:underline cursor-pointer"
                                >
                                  {emp.nama}
                                </button>
                                <div className="text-[11px] text-[#7c8580]">
                                  {emp.siklusGaji === 'bulanan' ? 'Bulanan' : '2x/bulan'}
                                  {isArchived
                                    ? ' · Arsip'
                                    : !emp.aktif
                                      ? ' · Nonaktif'
                                      : ''}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="font-mono-num px-4 py-3 text-right font-medium text-[#141816] whitespace-nowrap">
                            {calc.h} hr
                          </td>
                          <td
                            className="font-mono-num px-4 py-3 text-right text-[#7c8580] whitespace-nowrap"
                            title="Libur · Izin · Sakit · Alfa"
                          >
                            {calc.off > 0 ? `${calc.l}·${calc.iz}·${calc.s}·${calc.a}` : '–'}
                          </td>
                          <td className="font-mono-num px-4 py-3 text-right font-medium text-[#141816] whitespace-nowrap">
                            {calc.lm} pkt
                          </td>
                          <td className="font-mono-num px-4 py-3 text-right text-[#565e59] whitespace-nowrap">
                            {formatRp(calc.gp)}
                          </td>
                          <td className="font-mono-num px-4 py-3 text-right text-[#565e59] whitespace-nowrap">
                            {formatRp(calc.ul)}
                          </td>
                          <td className="font-mono-num px-4 py-3 text-right font-semibold text-[#14533c] whitespace-nowrap">
                            {formatRp(calc.tot)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#111614] bg-[#111614] font-semibold text-white">
                        <td className="px-4 py-3">Total ({payrollRows.list.length} karyawan)</td>
                        <td className="font-mono-num px-4 py-3 text-right whitespace-nowrap">
                          {payrollRows.totalHadir} hr
                        </td>
                        <td className="px-4 py-3 text-right text-white/50">–</td>
                        <td className="font-mono-num px-4 py-3 text-right whitespace-nowrap">
                          {payrollRows.totalLemburPaket} pkt
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right whitespace-nowrap">
                          {formatRp(payrollRows.totalGapok)}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right whitespace-nowrap">
                          {formatRp(payrollRows.totalLemburRp)}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right text-[#6ee7b7] whitespace-nowrap">
                          {formatRp(payrollRows.totalGaji)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────── TAB 5: DETAIL & SLIP KARYAWAN ─────────────────── */}
          {abSub === 'detail' && (
            <div className="space-y-5">
              {!selectedEmployee || !detailViewData ? (
                <div className="rounded-xl border border-dashed border-[#dcdcd4] bg-white py-12 text-center text-sm text-[#7c8580]">
                  Karyawan tidak ditemukan.
                </div>
              ) : (
                <>
                  {/* TOP CONTROL ROW */}
                  <div className="no-print flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={backFromDetail}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] hover:bg-[#f4f4ef] whitespace-nowrap cursor-pointer"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Kembali</span>
                      </button>
                      <select
                        value={selectedEmployee.id}
                        onChange={(e) => setSelectedEmpId(e.target.value)}
                        aria-label="Pilih karyawan"
                        className="h-8 rounded-lg border border-[#e5e5df] bg-white px-3 text-xs font-medium text-[#141816] focus:border-[#14533c] focus:outline-none"
                      >
                        {allEmployeesWithArchive.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nama}
                            {isEmployeeArchived(state, e.id)
                              ? ' (Arsip)'
                              : !e.aktif
                                ? ' (Nonaktif)'
                                : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {renderCycleSwitcher()}
                  </div>

                  {/* PROFILE HEADER */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e5df] pb-4">
                    <div className="flex items-center gap-3.5">
                      <EmployeeAvatar
                        nama={selectedEmployee.nama}
                        foto={selectedEmployee.foto}
                        size="lg"
                      />
                      <div>
                        <h2 className="font-display text-lg font-semibold text-[#141816]">
                          {selectedEmployee.nama}
                        </h2>
                        <p className="text-xs text-[#7c8580]">
                          Rincian gaji · {payrollRange.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#565e59]">
                      <span className="font-mono-num">
                        Gaji pokok{' '}
                        <strong className="font-semibold text-[#141816]">
                          {formatRp(selectedEmployee.gajiHarian)}
                        </strong>
                        /hari
                      </span>
                      <span aria-hidden="true" className="text-[#c5c5bc]">
                        ·
                      </span>
                      <span className="font-mono-num">
                        Lembur{' '}
                        <strong className="font-semibold text-[#141816]">
                          {formatRp(selectedEmployee.lemburPerPaket)}
                        </strong>
                        /paket
                      </span>
                      <span aria-hidden="true" className="text-[#c5c5bc]">
                        ·
                      </span>
                      <span
                        className={`font-medium ${
                          detailViewData.archived
                            ? 'text-[#7c8580]'
                            : selectedEmployee.aktif
                              ? 'text-[#14533c]'
                              : 'text-[#7c8580]'
                        }`}
                      >
                        {detailViewData.archived
                          ? 'Arsip'
                          : selectedEmployee.aktif
                            ? 'Aktif'
                            : 'Nonaktif'}
                      </span>
                      <span aria-hidden="true" className="text-[#c5c5bc]">
                        ·
                      </span>
                      <span>
                        {selectedEmployee.siklusGaji === 'bulanan' ? 'Bulanan' : '2x Sebulan'}
                      </span>
                    </div>
                  </div>

                  {/* HERO TOTALS */}
                  <div className="grid grid-cols-1 divide-y divide-[#efefea] overflow-hidden rounded-xl border border-[#e5e5df] bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    <div className="bg-[#f4faf7] px-5 py-3.5">
                      <div className="text-xs font-medium text-[#14533c]">Total gaji diterima</div>
                      <div className="font-mono-num mt-1 text-xl font-semibold text-[#14533c]">
                        {formatRp(detailViewData.calc.tot)}
                      </div>
                    </div>
                    <div className="px-5 py-3.5">
                      <div className="text-xs font-medium text-[#7c8580]">Hadir</div>
                      <div className="font-mono-num mt-1 text-xl font-semibold text-[#141816]">
                        {detailViewData.calc.h}
                        <span className="ml-1 text-sm font-normal text-[#7c8580]">
                          / {payrollRange.count} hari
                        </span>
                      </div>
                    </div>
                    <div className="px-5 py-3.5">
                      <div className="text-xs font-medium text-[#7c8580]">Lembur</div>
                      <div className="font-mono-num mt-1 text-xl font-semibold text-[#141816]">
                        {detailViewData.calc.lm}
                        <span className="ml-1 text-sm font-normal text-[#7c8580]">paket</span>
                      </div>
                    </div>
                  </div>

                  {/* SLIP BREAKDOWN TABLE */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-[#565e59]">Rincian slip gaji</h3>
                    <div className="overflow-x-auto rounded-xl border border-[#e5e5df] bg-white">
                      <table className="w-full border-collapse text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[#e5e5df] bg-[#fafaf8] text-xs font-medium text-[#7c8580]">
                            <th className="px-4 py-2.5">Komponen</th>
                            <th className="px-4 py-2.5 text-right">Jumlah</th>
                            <th className="px-4 py-2.5 text-right">Tarif</th>
                            <th className="px-4 py-2.5 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#efefea]">
                          <tr>
                            <td className="px-4 py-2.5 font-medium text-[#141816]">Gaji pokok</td>
                            <td className="font-mono-num px-4 py-2.5 text-right text-[#565e59]">
                              {detailViewData.calc.h} hari
                            </td>
                            <td className="font-mono-num px-4 py-2.5 text-right text-[#7c8580]">
                              {detailViewData.calc.hasMixedRates
                                ? 'Sesuai riwayat'
                                : formatRp(detailViewData.calc.effectiveGajiRate)}
                            </td>
                            <td className="font-mono-num px-4 py-2.5 text-right font-semibold text-[#141816]">
                              {formatRp(detailViewData.calc.gp)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-medium text-[#141816]">Uang lembur</td>
                            <td className="font-mono-num px-4 py-2.5 text-right text-[#565e59]">
                              {detailViewData.calc.lm} paket
                            </td>
                            <td className="font-mono-num px-4 py-2.5 text-right text-[#7c8580]">
                              {detailViewData.calc.hasMixedRates
                                ? 'Sesuai riwayat'
                                : formatRp(detailViewData.calc.effectiveLemburRate)}
                            </td>
                            <td className="font-mono-num px-4 py-2.5 text-right font-semibold text-[#141816]">
                              {formatRp(detailViewData.calc.ul)}
                            </td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-[#e5e5df] bg-[#f4faf7] font-semibold">
                            <td colSpan={3} className="px-4 py-2.5 text-[#141816]">
                              Total diterima
                            </td>
                            <td className="font-mono-num px-4 py-2.5 text-right text-[#14533c]">
                              {formatRp(detailViewData.calc.tot)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {detailViewData.offBreakdown && (
                      <p className="text-xs text-[#7c8580]">
                        Tidak hadir: {detailViewData.offBreakdown}
                      </p>
                    )}
                  </div>

                  {/* DAILY HISTORY TABLE */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-[#565e59]">
                      Riwayat harian (
                      {detailShowAll ? `1–${nd}` : `${payrollRange.start}–${payrollRange.end}`}{' '}
                      {monthLabel})
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-[#e5e5df] bg-white">
                      <table className="w-full border-collapse text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[#e5e5df] bg-[#fafaf8] text-xs font-medium text-[#7c8580]">
                            <th className="px-4 py-2.5">Tanggal</th>
                            <th className="px-4 py-2.5">Status</th>
                            <th className="px-4 py-2.5 text-right">Lembur</th>
                            <th className="px-4 py-2.5 text-right">Gaji pokok</th>
                            <th className="px-4 py-2.5 text-right">Uang lembur</th>
                            <th className="px-4 py-2.5 text-right">Total</th>
                            {!isViewer && !detailViewData.archived && (
                              <th className="no-print px-4 py-2.5 text-right">Aksi</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#efefea]">
                          {detailViewData.dayRows.map((dr) => (
                            <tr
                              key={dr.day}
                              className={`hover:bg-[#fafaf8] ${dr.inRange ? '' : 'opacity-45'}`}
                            >
                              <td
                                className={`px-4 py-2 font-medium whitespace-nowrap ${
                                  dr.dow === 0 ? 'text-[#b91c1c]' : 'text-[#141816]'
                                }`}
                              >
                                {dr.dayName}, {dr.day} {MONTH_NAMES[monthNum - 1]}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                {dr.rec ? (
                                  <span
                                    className={`text-xs font-semibold ${STATUS_TEXT_COLOR[dr.rec.status]}`}
                                  >
                                    {dr.rec.status}
                                  </span>
                                ) : (
                                  <span className="text-xs text-[#9aa39d]">Belum diisi</span>
                                )}
                              </td>
                              <td className="font-mono-num px-4 py-2 text-right text-[#7c8580] whitespace-nowrap">
                                {dr.lm > 0 ? `${dr.lm} paket` : '–'}
                              </td>
                              <td className="font-mono-num px-4 py-2 text-right text-[#565e59] whitespace-nowrap">
                                {dr.gp > 0 ? formatRp(dr.gp) : '–'}
                              </td>
                              <td className="font-mono-num px-4 py-2 text-right text-[#565e59] whitespace-nowrap">
                                {dr.ul > 0 ? formatRp(dr.ul) : '–'}
                              </td>
                              <td className="font-mono-num px-4 py-2 text-right font-semibold text-[#141816] whitespace-nowrap">
                                {dr.rec ? formatRp(dr.tot) : '–'}
                              </td>
                              {!isViewer && !detailViewData.archived && (
                                <td className="no-print px-4 py-2 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMonthAndDay(ym, dr.day);
                                      setAbSub('harian');
                                    }}
                                    className="h-7 rounded-md border border-[#e5e5df] bg-white px-2.5 text-[11.5px] font-medium text-[#565e59] hover:bg-[#f4f4ef] cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM FOOTER BAR */}
      <div className="no-print flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#e5e5df] bg-white px-4 py-2.5 sm:px-6">
        {abSub === 'harian' && (
          <>
            <div className="text-xs text-[#565e59]">
              {dailyModel.pending > 0 ? (
                <span>
                  <strong className="text-[#b45309]">{dailyModel.pending} karyawan</strong> belum
                  disimpan
                </span>
              ) : absUnsent ? (
                <strong className="text-[#b91c1c]">
                  Belum terkirim ke database — klik Simpan absensi
                </strong>
              ) : (
                <span className="font-medium text-[#15803d]">
                  Semua absensi hari ini sudah tersimpan
                </span>
              )}
            </div>
            {!isViewer && activeEmployees.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAllAttendanceHadir(ym, day)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#141816] hover:bg-[#f4f4ef] whitespace-nowrap cursor-pointer"
                >
                  <UserCheck className="h-3.5 w-3.5 text-[#14533c]" />
                  <span>Semua hadir</span>
                </button>
                <button
                  type="button"
                  disabled={absSaving}
                  onClick={handleSaveToday}
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-4 text-xs font-medium text-white transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                    dailyModel.pending > 0 || absUnsent
                      ? 'bg-[#b45309] hover:bg-[#92400e]'
                      : 'bg-[#14533c] hover:bg-[#0f3f2d]'
                  }`}
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{absSaving ? 'Menyimpan…' : 'Simpan absensi'}</span>
                </button>
              </div>
            )}
          </>
        )}

        {abSub === 'kalender' && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[#7c8580]">
              <span>
                <strong className="text-[#14533c]">H</strong> = Hadir
              </span>
              <span>
                <strong className="text-[#b91c1c]">A</strong> = Tidak hadir
              </span>
              <span>
                <strong className="text-[#b45309]">+N</strong> = Belum diisi
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setMonthAndDay(ym, calSelDay);
                setAbSub('harian');
              }}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#14533c] px-4 text-xs font-medium text-white hover:bg-[#0f3f2d] whitespace-nowrap cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Buka absen tgl {calSelDay}</span>
            </button>
          </>
        )}

        {abSub === 'karyawan' && (
          <>
            <div className="text-xs text-[#7c8580]">
              <strong className="text-[#141816]">{activeEmployees.length}</strong> aktif dari{' '}
              <strong className="text-[#141816]">{masterEmployees.length}</strong> karyawan
              {archivedEmployees.length > 0 ? ` · ${archivedEmployees.length} arsip` : ''}
            </div>
            {!isViewer && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#14533c] px-4 text-xs font-medium text-white hover:bg-[#0f3f2d] whitespace-nowrap cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah karyawan</span>
              </button>
            )}
          </>
        )}

        {abSub === 'rekap' && (
          <>
            <div className="text-xs text-[#7c8580]">Absen = libur · izin · sakit · alfa</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#141816] hover:bg-[#f4f4ef] whitespace-nowrap cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak</span>
              </button>
              <button
                type="button"
                onClick={handleCopyRekapWA}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#14533c] px-4 text-xs font-medium text-white hover:bg-[#0f3f2d] whitespace-nowrap cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Salin untuk WhatsApp</span>
              </button>
            </div>
          </>
        )}

        {abSub === 'detail' && selectedEmployee && (
          <>
            <button
              type="button"
              onClick={() => setDetailShowAll((v) => !v)}
              className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#141816] hover:bg-[#f4f4ef] whitespace-nowrap cursor-pointer"
            >
              {detailShowAll ? 'Tampilkan periode ini saja' : 'Tampilkan sebulan penuh'}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#e5e5df] bg-white px-3.5 text-xs font-medium text-[#141816] hover:bg-[#f4f4ef] whitespace-nowrap cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopySingleSlipWA(selectedEmployee)}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#14533c] px-4 text-xs font-medium text-white hover:bg-[#0f3f2d] whitespace-nowrap cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Salin slip WhatsApp</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─────────────────── MODAL: TAMBAH / EDIT KARYAWAN ─────────────────── */}
      {empModalOpen && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#111614]/55 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEmpModalOpen(false);
          }}
        >
          <div className="w-full max-w-[460px] overflow-hidden rounded-xl border border-[#e5e5df] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#efefea] px-5 py-4">
              <div className="flex items-center gap-3">
                <EmployeeAvatar nama={formNama || '?'} foto={formFoto} size="md" />
                <div>
                  <h3 className="font-display text-base font-semibold text-[#141816]">
                    {editEmp ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
                  </h3>
                  <p className="text-xs text-[#7c8580]">
                    Atur nama, foto, gaji harian, tarif lembur, dan siklus gaji
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmpModalOpen(false)}
                aria-label="Tutup modal"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7c8580] hover:bg-[#f4f4ef] hover:text-[#141816] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEmployee}>
              <div className="space-y-3.5 px-5 py-4">
                {formError && (
                  <div className="rounded-lg border border-[#f5c2c2] bg-[#fef2f2] px-3 py-2 text-xs font-medium text-[#991b1b]">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#141816]">
                    Nama Karyawan <span className="text-[#b91c1c]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="h-10 w-full rounded-lg border border-[#dcdcd4] px-3 text-sm text-[#141816] focus:border-[#14533c] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#141816]">
                    Link Foto (opsional)
                  </label>
                  <input
                    type="url"
                    value={formFoto}
                    onChange={(e) => setFormFoto(e.target.value)}
                    placeholder="https://lh3.googleusercontent.com/d/ID_FILE"
                    className="h-10 w-full rounded-lg border border-[#dcdcd4] px-3 text-sm text-[#141816] focus:border-[#14533c] focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-[#7c8580]">
                    Mendukung link Google Drive (dibagikan &ldquo;Siapa saja yang memiliki
                    link&rdquo;) atau kolom Foto URL di sheet KARYAWAN.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#141816]">
                      Gaji Harian (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={formGaji}
                      onChange={(e) => setFormGaji(e.target.value)}
                      className="font-mono-num h-10 w-full rounded-lg border border-[#dcdcd4] px-3 text-sm font-semibold text-[#141816] focus:border-[#14533c] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#141816]">
                      Tarif Lembur / Paket (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={formLembur}
                      onChange={(e) => setFormLembur(e.target.value)}
                      className="font-mono-num h-10 w-full rounded-lg border border-[#dcdcd4] px-3 text-sm font-semibold text-[#141816] focus:border-[#14533c] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#141816]">
                    Siklus Penggajian
                  </label>
                  <select
                    value={formSiklus}
                    onChange={(e) =>
                      setFormSiklus(e.target.value === 'bulanan' ? 'bulanan' : '14hari')
                    }
                    className="h-10 w-full rounded-lg border border-[#dcdcd4] bg-white px-3 text-sm text-[#141816] focus:border-[#14533c] focus:outline-none"
                  >
                    <option value="14hari">
                      2x Sebulan (Tahap 1: 1–15 &amp; Tahap 2: 16–akhir)
                    </option>
                    <option value="bulanan">Bulanan (1 Bulan Penuh)</option>
                  </select>
                </div>

                {editEmp && isEditingTariffChanged && (
                  <div className="rounded-lg border border-[#e7d4a5] bg-[#fdf9ee] p-3 text-xs text-[#8a5308]">
                    <p className="font-semibold">Perlindungan histori tarif</p>
                    <p className="mt-0.5 leading-relaxed">
                      Secara default, perubahan tarif hanya berlaku untuk absensi baru agar histori
                      penggajian &amp; OMSET yang sudah tersimpan tidak berubah secara retroaktif.
                    </p>
                    <label className="mt-2 flex items-center gap-2 font-medium text-[#78350f] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formApplyRetroactive}
                        onChange={(e) => setFormApplyRetroactive(e.target.checked)}
                        className="h-3.5 w-3.5 rounded accent-[#b45309]"
                      />
                      <span>Terapkan tarif baru ke seluruh histori tersimpan</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#efefea] bg-[#fafaf8] px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setEmpModalOpen(false)}
                  className="h-9 rounded-lg border border-[#e5e5df] bg-white px-4 text-xs font-medium text-[#565e59] hover:bg-[#f4f4ef] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#14533c] px-4 text-xs font-medium text-white hover:bg-[#0f3f2d] cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{editEmp ? 'Simpan perubahan' : 'Tambah karyawan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────── MODAL: KONFIRMASI ARSIP KARYAWAN ─────────────────── */}
      {archiveTarget && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#111614]/55 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setArchiveTarget(null);
          }}
        >
          <div className="w-full max-w-[420px] overflow-hidden rounded-xl border border-[#e5e5df] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#efefea] px-5 py-4">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-[#b91c1c]" />
                <h3 className="font-display text-base font-semibold text-[#141816]">
                  Arsipkan Karyawan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7c8580] hover:bg-[#f4f4ef] hover:text-[#141816] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs leading-relaxed text-[#565e59]">
                Arsipkan <strong className="text-[#141816]">{archiveTarget.nama}</strong> dari
                daftar karyawan aktif? Seluruh riwayat absensi, slip gaji, dan perhitungan gaji di
                OMSET tetap tersimpan utuh dan karyawan dapat dipulihkan kapan saja.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#efefea] bg-[#fafaf8] px-5 py-3.5">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="h-9 rounded-lg border border-[#e5e5df] bg-white px-4 text-xs font-medium text-[#565e59] hover:bg-[#f4f4ef] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                className="h-9 rounded-lg bg-[#b91c1c] px-4 text-xs font-medium text-white hover:bg-[#991b1b] cursor-pointer"
              >
                Ya, Arsipkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── MODAL: FALLBACK SALIN TEKS WHATSAPP ─────────────────── */}
      {waModal && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-[#111614]/55 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setWaModal(null);
          }}
        >
          <div className="w-full max-w-[520px] overflow-hidden rounded-xl border border-[#e5e5df] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#efefea] px-5 py-4">
              <div>
                <h3 className="font-display text-base font-semibold text-[#141816]">
                  Salin {waModal.title}
                </h3>
                <p className="text-xs text-[#7c8580]">
                  Salin teks di bawah ini lalu tempel (paste) ke WhatsApp
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWaModal(null)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7c8580] hover:bg-[#f4f4ef] hover:text-[#141816] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <textarea
                readOnly
                value={waModal.text}
                rows={13}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono-num w-full rounded-lg border border-[#dcdcd4] bg-[#fafaf8] p-3 text-xs leading-relaxed text-[#141816] focus:border-[#14533c] focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#efefea] bg-[#fafaf8] px-5 py-3.5">
              <button
                type="button"
                onClick={() => setWaModal(null)}
                className="h-9 rounded-lg border border-[#e5e5df] bg-white px-4 text-xs font-medium text-[#565e59] hover:bg-[#f4f4ef] cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(waModal.text);
                    setWaModal(null);
                    showToast(`${waModal.title} berhasil disalin.`);
                  } catch {
                    showToast('Gunakan Ctrl+C / Cmd+C pada kotak teks di atas.', 'err');
                  }
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#14533c] px-4 text-xs font-medium text-white hover:bg-[#0f3f2d] cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Salin teks</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
