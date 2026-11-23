import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { PageHeader } from '../components/PageHeader';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  LogIn,
  LogOut,
  MessageSquare,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
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
  DEFAULT_SHIFT_CONFIG,
  buildRekapSlipWA,
  buildSingleEmpSlipWA,
  calcAttendanceRecordPay,
  calcEmployeePayroll,
  calcLateMinutes,
  calcWorkDurationMinutes,
  formatDurationLabel,
  getActiveEmployees,
  getAllEmployeesWithArchive,
  getArchivedEmployees,
  getAttendanceCalendarMonth,
  getDailyAttendanceViewModel,
  getEmployees,
  getEmployeesForPayrollPeriod,
  getPayrollRange,
  getShiftList,
  getShiftPresets,
  getShiftScheduleConfig,
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
import type {
  AbsensiSubTab,
  AttendanceShift,
  AttendanceStatus,
  Employee,
  PayrollCycle,
  ScheduledShiftId,
  ShiftScheduleConfig,
} from '../types/app';

const STATUS_BUTTON_ACTIVE: Record<AttendanceStatus, string> = {
  Hadir: 'bg-[#2eb86b] text-white shadow-xs',
  Izin: 'bg-[#f59e0b] text-white shadow-xs',
  Sakit: 'bg-[#0ea5e9] text-white shadow-xs',
  Alfa: 'bg-[#ef4444] text-white shadow-xs',
  Libur: 'bg-[#0d2530] text-white shadow-xs',
};

const STATUS_TEXT_COLOR: Record<AttendanceStatus, string> = {
  Hadir: 'text-[#15803d]',
  Izin: 'text-[#b45309]',
  Sakit: 'text-[#0284c7]',
  Alfa: 'text-[#dc2626]',
  Libur: 'text-[#475569]',
};

type DailyFilterMode = 'all' | 'unrecorded' | 'hadir' | 'late' | 'absent' | 'overtime';

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
    updateAttendanceDraft,
    clockInEmployee,
    clockOutEmployee,
    resetAttendanceDraftDay,
    setAttendanceDraftLembur,
    adjustAttendanceDraftLembur,
    setAllAttendanceHadir,
    saveSingleAttendanceRow,
    saveAttendanceDay,
    saveEmployee,
    updateShiftConfig,
    toggleEmployeeActive,
    archiveEmployee,
    restoreArchivedEmployee,
  } = useApp();

  const [prevSub, setPrevSub] = useState<AbsensiSubTab>('harian');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [calSelDay, setCalSelDay] = useState<number>(day);
  const [detailShowAll, setDetailShowAll] = useState<boolean>(false);
  const [showArchiveList, setShowArchiveList] = useState<boolean>(false);

  // HRIS Daily Workspace filters & inline note drawers
  const [dailySearch, setDailySearch] = useState<string>('');
  const [dailyFilter, setDailyFilter] = useState<DailyFilterMode>('all');
  const [openNoteIds, setOpenNoteIds] = useState<Record<string, boolean>>({});
  const [nowClock, setNowClock] = useState<string>(() =>
    new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  );

  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  const [empModalOpen, setEmpModalOpen] = useState<boolean>(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [formNama, setFormNama] = useState<string>('');
  const [formFoto, setFormFoto] = useState<string>('');
  const [formJabatan, setFormJabatan] = useState<string>('');
  const [formShiftDefault, setFormShiftDefault] = useState<AttendanceShift>('Full');
  const [formGaji, setFormGaji] = useState<string>('75000');
  const [formLembur, setFormLembur] = useState<string>('25000');
  const [formSiklus, setFormSiklus] = useState<'14hari' | 'bulanan'>('14hari');
  const [formApplyRetroactive, setFormApplyRetroactive] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<Employee | null>(null);
  const [waModal, setWaModal] = useState<{ title: string; text: string } | null>(null);
  const [shiftModalOpen, setShiftModalOpen] = useState<boolean>(false);
  const [shiftForm, setShiftForm] = useState<ShiftScheduleConfig>(() =>
    getShiftScheduleConfig(state)
  );

  const shiftConfig = useMemo(() => getShiftScheduleConfig(state), [state]);
  const shiftPresets = useMemo(() => getShiftPresets(state), [state]);
  const shiftList = useMemo(() => getShiftList(state), [state]);

  const openShiftModal = () => {
    setShiftForm({
      Full: { ...shiftConfig.Full },
      Pagi: { ...shiftConfig.Pagi },
      Siang: { ...shiftConfig.Siang },
    });
    setShiftModalOpen(true);
  };

  const handleSaveShiftConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) return;
    updateShiftConfig(shiftForm);
    setShiftModalOpen(false);
    showToast('Pengaturan jam kerja (Start–Finish) berhasil disimpan.');
  };

  const handleResetShiftDefaults = () => {
    setShiftForm({
      Full: { ...DEFAULT_SHIFT_CONFIG.Full },
      Pagi: { ...DEFAULT_SHIFT_CONFIG.Pagi },
      Siang: { ...DEFAULT_SHIFT_CONFIG.Siang },
    });
  };

  const nd = getDaysInMonth(ym);
  const yearNum = getYear(ym);
  const monthNum = getMonth(ym);
  const monthLabel = `${MONTH_NAMES[monthNum - 1]} ${yearNum}`;
  const todayParts = useMemo(() => getTodayParts(), []);
  const isViewingToday = ym === todayParts.ym && day === todayParts.day;
  const dateIso = formatDateKey(ym, day);
  const activeTabKey: AbsensiSubTab = abSub === 'detail' ? prevSub : abSub;

  useEffect(() => {
    setCalSelDay((prev) => Math.min(Math.max(1, prev || day), nd));
  }, [ym, nd, day]);

  useEffect(() => {
    if (abSub !== 'harian') return;
    const tick = () =>
      setNowClock(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [abSub]);

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

  const filteredDailyRows = useMemo(() => {
    const q = dailySearch.trim().toLowerCase();
    return dailyModel.rows.filter((row) => {
      if (q) {
        const hay = `${row.emp.nama} ${row.emp.jabatan || ''} ${row.shift}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (dailyFilter === 'unrecorded') return !row.isRecorded;
      if (dailyFilter === 'hadir') return row.effective?.status === 'Hadir';
      if (dailyFilter === 'late') return row.effective?.status === 'Hadir' && row.lateMinutes > 0;
      if (dailyFilter === 'absent')
        return Boolean(row.effective && row.effective.status !== 'Hadir');
      if (dailyFilter === 'overtime') return Boolean(row.effective && row.effective.lembur > 0);
      return true;
    });
  }, [dailyModel.rows, dailySearch, dailyFilter]);

  const attendancePct =
    activeEmployees.length > 0
      ? Math.round((dailyModel.hadir / activeEmployees.length) * 100)
      : 0;

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
      showToast(`Absensi tgl ${day} ${MONTH_NAMES[monthNum - 1]} berhasil disimpan & diverifikasi.`);
    } else if (res.error) {
      showToast(res.error, 'err');
    }
  };

  const handleSaveRow = async (emp: Employee) => {
    const res = await saveSingleAttendanceRow(ym, day, emp.id);
    if (res.ok) {
      showToast(`Absensi ${emp.nama} berhasil diverifikasi.`);
    } else if (res.error) {
      showToast(res.error, 'err');
    }
  };

  const openAddModal = () => {
    setEditEmp(null);
    setFormNama('');
    setFormFoto('');
    setFormJabatan('');
    setFormShiftDefault('Full');
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
    setFormJabatan(emp.jabatan || '');
    setFormShiftDefault(emp.shiftDefault || 'Full');
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
      jabatan: formJabatan,
      shiftDefault: formShiftDefault,
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
      className="inline-flex items-center gap-1 rounded-xl bg-white p-1 shadow-[0_6px_22px_rgba(13,37,48,0.045)]"
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
            className={`h-7 shrink-0 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              active
                ? 'bg-[#2eb86b] text-white shadow-xs'
                : 'text-[#64748b] hover:bg-[#f3f7f5] hover:text-[#13222b]'
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
    <div className="dg-page">
      {/* PERSISTENT STATIONARY TOP TOOLBAR */}
      <PageHeader>
        {abSub === 'harian' ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-xl bg-[#f3f7f5] p-0.5">
              <button
                type="button"
                onClick={() => moveDay(-1)}
                aria-label="Hari sebelumnya"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="date"
                value={dateIso}
                onChange={(e) => selectDateStr(e.target.value)}
                aria-label="Pilih tanggal absensi"
                className="font-mono-num h-7 bg-transparent px-2 text-xs font-semibold text-[#13222b] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => moveDay(1)}
                aria-label="Hari berikutnya"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={goToday}
              className="h-8 shrink-0 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] whitespace-nowrap cursor-pointer"
            >
              Hari ini
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center rounded-xl bg-[#f3f7f5] p-0.5">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="Bulan sebelumnya"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-display min-w-[136px] text-center text-[13.5px] font-bold text-[#13222b]">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="Bulan berikutnya"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#475569] transition hover:bg-white hover:text-[#13222b] cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* LIVE CLOCK + WORK HOURS SETTING + SUB-TAB SWITCHER */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-3 text-white shadow-xs whitespace-nowrap">
            <Clock className="h-3.5 w-3.5 shrink-0 opacity-90" />
            <span className="font-mono-num text-xs font-bold tracking-tight">{nowClock}</span>
            {abSub === 'harian' && (
              <span className="text-[11px] font-medium opacity-85">
                · {isViewingToday ? 'Hari ini' : 'Tanggal lain'}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={openShiftModal}
            title="Atur jam mulai & selesai kerja setiap shift"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] whitespace-nowrap cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#15803d]" />
            <span>Jam Kerja</span>
          </button>

          <div
            className="flex items-center gap-1 overflow-x-auto rounded-xl bg-[#f3f7f5] p-1"
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
                  className={`flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    isOn
                      ? 'bg-[#2eb86b] text-white shadow-xs'
                      : 'text-[#64748b] hover:text-[#13222b]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </PageHeader>

      {/* FLOATING TOAST / DB ERROR BANNER */}
      {(toast || absSaveError) && (
        <div className="no-print mx-4 mt-3 shrink-0 md:mx-6">
          {absSaveError && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#ef4444] px-4 py-2.5 text-xs font-semibold text-white shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{absSaveError}</span>
              </div>
              {!isViewer && abSub === 'harian' && (
                <button
                  type="button"
                  disabled={absSaving}
                  onClick={handleSaveToday}
                  className="shrink-0 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/30 whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  Kirim ulang
                </button>
              )}
            </div>
          )}
          {toast && !absSaveError && (
            <div
              className={`flex items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-sm ${
                toast.tone === 'err' ? 'bg-[#ef4444]' : 'bg-[#2eb86b]'
              }`}
            >
              <span>{toast.text}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Tutup notifikasi"
                className="text-current opacity-80 hover:opacity-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* MAIN SCROLLABLE CONTENT */}
      <div className="dg-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="mx-auto max-w-[1380px]">
          {/* ─────────────────── TAB 1: ABSENSI HARIAN (HRIS WORKSPACE) ─────────────────── */}
          {abSub === 'harian' && (
            <div className="space-y-4">
              {dailyModel.draftDayCount > 0 && (
                <div className="flex items-center justify-end text-xs">
                  <span className="font-semibold text-[#b45309]">
                    Draf belum diverifikasi ({dailyModel.draftDayCount} tanggal)
                  </span>
                </div>
              )}

              {activeEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-14 text-center shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                  <Users className="mb-3 h-8 w-8 text-[#94a3b8]" />
                  <p className="text-sm font-semibold text-[#13222b]">Belum ada karyawan aktif.</p>
                  <p className="mt-1 text-xs text-[#64748b]">
                    Tambahkan atau aktifkan karyawan terlebih dahulu untuk mulai mencatat absensi.
                  </p>
                  {!isViewer && (
                    <button
                      type="button"
                      onClick={() => setAbSub('karyawan')}
                      className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Kelola Karyawan</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* 4 COMPACT SOLID HRIS KPI CARDS */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {/* KPI 1: Kehadiran (Solid Emerald) */}
                    <div className="rounded-2xl bg-[#157f5d] px-4 py-2.5 text-white shadow-[0_6px_18px_rgba(13,37,48,0.08)]">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-white/85">
                        <span className="truncate">Kehadiran</span>
                        <span className="font-mono-num shrink-0 font-bold text-white">
                          {attendancePct}%
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <div className="font-mono-num text-lg leading-tight font-bold text-white">
                          {dailyModel.hadir}
                          <span className="text-xs font-medium text-white/80">
                            /{activeEmployees.length} hadir
                          </span>
                        </div>
                        <span className="font-mono-num shrink-0 text-[11px] font-medium text-white/85">
                          {dailyModel.unrecordedCount > 0
                            ? `Belum ${dailyModel.unrecordedCount}`
                            : `Tercatat ${dailyModel.recordedCount}`}
                        </span>
                      </div>
                    </div>

                    {/* KPI 2: Ketepatan & Jam Kerja (Solid Cobalt Blue) */}
                    <div className="rounded-2xl bg-[#1d5fa7] px-4 py-2.5 text-white shadow-[0_6px_18px_rgba(13,37,48,0.08)]">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-white/85">
                        <span className="truncate">Jam Kerja</span>
                        <span className="font-mono-num shrink-0 font-semibold text-white/95">
                          Tepat {dailyModel.onTimeCount} · Telat {dailyModel.lateCount}
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <div className="font-mono-num text-lg leading-tight font-bold text-white">
                          {dailyModel.avgWorkMinutes !== null
                            ? formatDurationLabel(dailyModel.avgWorkMinutes)
                            : dailyModel.hadir > 0
                              ? 'Aktif'
                              : '–'}
                        </div>
                        <span className="shrink-0 text-[11px] font-medium text-white/80">
                          Rata-rata shift
                        </span>
                      </div>
                    </div>

                    {/* KPI 3: Tidak Hadir & Lembur (Solid Warm Amber) */}
                    <div className="rounded-2xl bg-[#b85d0b] px-4 py-2.5 text-white shadow-[0_6px_18px_rgba(13,37,48,0.08)]">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-white/85">
                        <span className="truncate">Off &amp; Lembur</span>
                        <span className="font-mono-num shrink-0 font-bold text-white">
                          {dailyModel.lembur} pkt lembur
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <div className="font-mono-num text-lg leading-tight font-bold text-white">
                          {dailyModel.absent}
                          <span className="ml-1 text-xs font-medium text-white/80">off</span>
                        </div>
                        <span className="font-mono-num shrink-0 text-[11px] font-medium text-white/85">
                          I {dailyModel.izin} · S {dailyModel.sakit} · A {dailyModel.alfa} · L{' '}
                          {dailyModel.libur}
                        </span>
                      </div>
                    </div>

                    {/* KPI 4: Estimasi Payroll Hari Ini (Solid Deep Indigo) */}
                    <div className="rounded-2xl bg-[#433878] px-4 py-2.5 text-white shadow-[0_6px_18px_rgba(13,37,48,0.08)]">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-white/85">
                        <span className="truncate">Payroll Hari Ini</span>
                        <span className="font-mono-num shrink-0 font-bold text-white">
                          {dailyModel.saved}/{activeEmployees.length} sah
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <div className="font-mono-num truncate text-lg leading-tight font-bold text-white">
                          {formatRp(dailyModel.gaji)}
                        </div>
                        <span className="font-mono-num shrink-0 text-[11px] font-medium text-white/85">
                          Lbr {formatNum(dailyModel.uangLembur)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* UNIFIED HRIS ATTENDANCE SHEET */}
                  <div className="overflow-hidden rounded-2xl border border-[#c5d4ce] bg-white shadow-[0_8px_24px_rgba(13,37,48,0.065)]">
                    {/* FILTER, SEARCH & BULK ACTIONS BAR */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#cfdcd7] bg-[#f7faf9] px-4 py-3 sm:px-5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="relative">
                          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#64748b]" />
                          <input
                            type="text"
                            value={dailySearch}
                            onChange={(e) => setDailySearch(e.target.value)}
                            placeholder="Cari nama atau jabatan…"
                            aria-label="Cari karyawan"
                            className="h-8.5 w-48 rounded-xl border border-[#dce6e2] bg-[#f7faf9] pr-3 pl-8.5 text-xs text-[#13222b] transition focus:border-[#2eb86b] focus:bg-white focus:outline-none sm:w-56"
                          />
                        </div>

                        <div
                          className="flex items-center gap-1 overflow-x-auto rounded-xl bg-[#f3f7f5] p-1"
                          role="tablist"
                          aria-label="Filter status absensi harian"
                        >
                          {(
                            [
                              { id: 'all', label: 'Semua', count: activeEmployees.length },
                              {
                                id: 'unrecorded',
                                label: 'Belum Absen',
                                count: dailyModel.unrecordedCount,
                              },
                              { id: 'hadir', label: 'Hadir', count: dailyModel.hadir },
                              { id: 'late', label: 'Telat', count: dailyModel.lateCount },
                              { id: 'absent', label: 'Tidak Hadir', count: dailyModel.absent },
                              {
                                id: 'overtime',
                                label: 'Lembur',
                                count: dailyModel.rows.filter(
                                  (r) => (r.effective?.lembur || 0) > 0
                                ).length,
                              },
                            ] as Array<{ id: DailyFilterMode; label: string; count: number }>
                          ).map((f) => {
                            const active = dailyFilter === f.id;
                            return (
                              <button
                                key={f.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setDailyFilter(f.id)}
                                className={`h-7 shrink-0 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-white text-[#13222b] shadow-xs'
                                    : 'text-[#64748b] hover:text-[#13222b]'
                                }`}
                              >
                                {f.label}{' '}
                                <span className="font-mono-num opacity-75">({f.count})</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {!isViewer && (
                        <div className="flex flex-wrap items-center gap-2">
                          {dailyModel.draftRowCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                resetAttendanceDraftDay(ym, day);
                                showToast('Draf perubahan hari ini dibatalkan.');
                              }}
                              className="inline-flex h-8.5 shrink-0 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#fee2e2] hover:text-[#b91c1c] whitespace-nowrap cursor-pointer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Reset Draf</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setAllAttendanceHadir(ym, day, {
                                onlyUnrecorded: dailyModel.recordedCount > 0 && dailyModel.unrecordedCount > 0,
                                withScheduledTimes: true,
                              })
                            }
                            className="inline-flex h-8.5 shrink-0 items-center gap-1.5 rounded-xl bg-[#e6f7ee] px-3.5 text-xs font-semibold text-[#15803d] transition hover:bg-[#d1f0e0] whitespace-nowrap cursor-pointer"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>
                              {dailyModel.recordedCount > 0 && dailyModel.unrecordedCount > 0
                                ? `Hadirkan ${dailyModel.unrecordedCount} Belum Absen`
                                : 'Semua Hadir (Sesuai Shift)'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* DESKTOP COLUMN HEADERS */}
                    <div className="hidden border-b-2 border-[#b5c7c0] bg-[#e5efec] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[#132b36] xl:grid xl:grid-cols-[minmax(215px,1.25fr)_252px_minmax(220px,1.15fr)_116px_138px_132px_74px] xl:items-center xl:gap-3">
                      <div>Karyawan &amp; Shift</div>
                      <div>Status Kehadiran</div>
                      <div>Log Waktu / Keterangan</div>
                      <div>Durasi</div>
                      <div>Lembur</div>
                      <div className="text-right">Estimasi Gaji</div>
                      <div className="text-right">Aksi</div>
                    </div>

                    {/* ROWS */}
                    {filteredDailyRows.length === 0 ? (
                      <div className="px-5 py-12 text-center">
                        <p className="text-sm font-semibold text-[#13222b]">
                          Tidak ada karyawan yang sesuai filter.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setDailySearch('');
                            setDailyFilter('all');
                          }}
                          className="mt-3 inline-flex h-8.5 items-center rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                        >
                          Tampilkan semua karyawan
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#d4e0dc]">
                        {filteredDailyRows.map((row) => {
                          const {
                            emp,
                            effective,
                            isRecorded,
                            hasDraft,
                            isSaved,
                            shift,
                            lateMinutes,
                            workMinutes,
                            gp,
                            ul,
                            tot,
                          } = row;
                          const isHadir = effective?.status === 'Hadir';
                          const isAbsentStatus = Boolean(effective && effective.status !== 'Hadir');
                          const hasNote = Boolean(effective?.catatan?.trim());
                          const isNoteOpen = Boolean(openNoteIds[emp.id]);

                          return (
                            <div
                              key={emp.id}
                              className={`transition-colors ${
                                hasDraft
                                  ? 'bg-[#fffbeb]/55'
                                  : !isRecorded
                                    ? 'bg-[#fafcfb]'
                                    : 'bg-white'
                              }`}
                            >
                              <div className="grid grid-cols-1 items-center gap-3 px-4 py-3.5 sm:px-5 xl:grid-cols-[minmax(215px,1.25fr)_252px_minmax(220px,1.15fr)_116px_138px_132px_74px]">
                                {/* 1. KARYAWAN & SHIFT */}
                                <div className="flex min-w-0 items-center gap-3">
                                  <EmployeeAvatar nama={emp.nama} foto={emp.foto} size="md" />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => openEmpDetail(emp.id)}
                                        className="truncate text-left text-[13.5px] font-bold text-[#13222b] hover:text-[#15803d] hover:underline cursor-pointer"
                                        title="Lihat profil & slip gaji karyawan"
                                      >
                                        {emp.nama}
                                      </button>
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px]">
                                      {emp.jabatan && (
                                        <>
                                          <span className="font-medium text-[#475569]">
                                            {emp.jabatan}
                                          </span>
                                          <span aria-hidden="true" className="text-[#cbd5e1]">
                                            ·
                                          </span>
                                        </>
                                      )}
                                      <span
                                        className={
                                          isSaved
                                            ? 'font-semibold text-[#15803d]'
                                            : hasDraft
                                              ? 'font-semibold text-[#b45309]'
                                              : 'font-medium text-[#64748b]'
                                        }
                                      >
                                        {isSaved
                                          ? 'Terverifikasi'
                                          : hasDraft
                                            ? 'Draf'
                                            : 'Belum absen'}
                                      </span>
                                      <span aria-hidden="true" className="text-[#cbd5e1]">
                                        ·
                                      </span>
                                      <select
                                        value={shift}
                                        disabled={isViewer}
                                        aria-label={`Shift ${emp.nama}`}
                                        onChange={(e) => {
                                          const nextShift = e.target.value as AttendanceShift;
                                          const preset = shiftPresets[nextShift];
                                          updateAttendanceDraft(ym, day, emp.id, {
                                            status: effective?.status || 'Hadir',
                                            shift: nextShift,
                                            ...(effective?.status === 'Hadir' &&
                                            !effective?.checkIn &&
                                            preset.start
                                              ? { checkIn: preset.start }
                                              : {}),
                                          });
                                        }}
                                        className="bg-transparent text-[11.5px] font-semibold text-[#475569] outline-none hover:text-[#13222b] focus:text-[#15803d] cursor-pointer disabled:cursor-default"
                                      >
                                        {shiftList.map((s) => (
                                          <option key={s.id} value={s.id}>
                                            {s.shortLabel}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>

                                {/* 2. STATUS KEHADIRAN */}
                                <div className="flex flex-wrap items-center gap-1">
                                  {ATTENDANCE_STATUSES.map((st) => {
                                    const isSelected = effective?.status === st;
                                    return (
                                      <button
                                        key={st}
                                        type="button"
                                        disabled={isViewer}
                                        onClick={() =>
                                          setAttendanceDraftStatus(ym, day, emp.id, st)
                                        }
                                        className={`h-8 shrink-0 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                                          isSelected
                                            ? STATUS_BUTTON_ACTIVE[st]
                                            : 'bg-[#f3f7f5] text-[#475569] hover:bg-[#e1ebe7] hover:text-[#13222b]'
                                        }`}
                                      >
                                        {st}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* 3. LOG WAKTU (CHECK-IN / CHECK-OUT) ATAU ALASAN */}
                                <div>
                                  {!isRecorded ? (
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        disabled={isViewer}
                                        onClick={() => clockInEmployee(ym, day, emp.id)}
                                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-3 text-xs font-semibold text-white transition hover:bg-[#259f5b] whitespace-nowrap cursor-pointer disabled:opacity-50"
                                      >
                                        <LogIn className="h-3.5 w-3.5" />
                                        <span>Check-in</span>
                                      </button>
                                      <span className="text-[11.5px] text-[#64748b]">
                                        atau pilih status
                                      </span>
                                    </div>
                                  ) : isHadir ? (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <div className="inline-flex items-center rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-2">
                                        <span className="text-[10.5px] font-semibold text-[#64748b]">
                                          In
                                        </span>
                                        <input
                                          type="time"
                                          disabled={isViewer}
                                          value={effective?.checkIn || ''}
                                          onChange={(e) =>
                                            updateAttendanceDraft(ym, day, emp.id, {
                                              status: 'Hadir',
                                              checkIn: e.target.value,
                                            })
                                          }
                                          aria-label={`Jam masuk ${emp.nama}`}
                                          className="font-mono-num h-7.5 w-[74px] bg-transparent pl-1 text-xs font-semibold text-[#13222b] focus:outline-none"
                                        />
                                      </div>

                                      {effective?.checkOut ? (
                                        <div className="inline-flex items-center rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-2">
                                          <span className="text-[10.5px] font-semibold text-[#64748b]">
                                            Out
                                          </span>
                                          <input
                                            type="time"
                                            disabled={isViewer}
                                            value={effective.checkOut}
                                            onChange={(e) =>
                                              updateAttendanceDraft(ym, day, emp.id, {
                                                status: 'Hadir',
                                                checkOut: e.target.value,
                                              })
                                            }
                                            aria-label={`Jam pulang ${emp.nama}`}
                                            className="font-mono-num h-7.5 w-[74px] bg-transparent pl-1 text-xs font-semibold text-[#13222b] focus:outline-none"
                                          />
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={isViewer}
                                          onClick={() => clockOutEmployee(ym, day, emp.id)}
                                          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl bg-[#0d2530] px-2.5 text-[11.5px] font-semibold text-white transition hover:bg-[#173a4a] whitespace-nowrap cursor-pointer disabled:opacity-50"
                                          title="Catat jam pulang sekarang"
                                        >
                                          <LogOut className="h-3 w-3" />
                                          <span>Check-out</span>
                                        </button>
                                      )}
                                    </div>
                                  ) : isAbsentStatus ? (
                                    <input
                                      type="text"
                                      disabled={isViewer}
                                      value={effective?.catatan || ''}
                                      onChange={(e) =>
                                        updateAttendanceDraft(ym, day, emp.id, {
                                          status: effective!.status,
                                          catatan: e.target.value,
                                        })
                                      }
                                      placeholder={`Alasan ${effective?.status.toLowerCase()} (opsional)…`}
                                      aria-label={`Alasan ${effective?.status} ${emp.nama}`}
                                      className="h-8 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3 text-xs text-[#13222b] transition focus:border-[#2eb86b] focus:bg-white focus:outline-none disabled:opacity-60"
                                    />
                                  ) : null}
                                </div>

                                {/* 4. DURASI & KETEPATAN */}
                                <div className="text-xs">
                                  {isHadir ? (
                                    <div>
                                      <div className="font-mono-num font-bold text-[#13222b]">
                                        {workMinutes !== null
                                          ? formatDurationLabel(workMinutes)
                                          : effective?.checkIn
                                            ? 'Berlangsung'
                                            : '–'}
                                      </div>
                                      <div
                                        className={`mt-0.5 text-[11px] font-semibold ${
                                          lateMinutes > 0
                                            ? lateMinutes >= 30
                                              ? 'text-[#dc2626]'
                                              : 'text-[#b45309]'
                                            : effective?.checkIn
                                              ? 'text-[#15803d]'
                                              : 'text-[#94a3b8]'
                                        }`}
                                      >
                                        {lateMinutes > 0
                                          ? `Telat ${lateMinutes} mnt`
                                          : effective?.checkIn
                                            ? 'Tepat waktu'
                                            : 'Tanpa jam'}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[#94a3b8]">–</span>
                                  )}
                                </div>

                                {/* 5. LEMBUR STEPPER */}
                                <div className="flex items-center gap-1.5">
                                  <div className="inline-flex items-center overflow-hidden rounded-xl border border-[#dce6e2] bg-[#f7faf9]">
                                    <button
                                      type="button"
                                      disabled={
                                        isViewer || !isRecorded || (effective?.lembur || 0) <= 0
                                      }
                                      onClick={() =>
                                        adjustAttendanceDraftLembur(ym, day, emp.id, -1)
                                      }
                                      aria-label={`Kurangi lembur ${emp.nama}`}
                                      className="flex h-7.5 w-7 items-center justify-center text-[#475569] hover:bg-white hover:text-[#13222b] disabled:opacity-40 cursor-pointer"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      disabled={isViewer}
                                      value={effective?.lembur || 0}
                                      onChange={(e) =>
                                        setAttendanceDraftLembur(
                                          ym,
                                          day,
                                          emp.id,
                                          parseInt(e.target.value, 10) || 0
                                        )
                                      }
                                      aria-label={`Paket lembur ${emp.nama}`}
                                      className="font-mono-num h-7.5 w-10 border-x border-[#edf2f0] bg-white text-center text-xs font-bold text-[#13222b] focus:outline-none disabled:bg-[#f3f7f5]"
                                    />
                                    <button
                                      type="button"
                                      disabled={isViewer}
                                      onClick={() =>
                                        adjustAttendanceDraftLembur(ym, day, emp.id, 1)
                                      }
                                      aria-label={`Tambah lembur ${emp.nama}`}
                                      className="flex h-7.5 w-7 items-center justify-center text-[#475569] hover:bg-white hover:text-[#13222b] disabled:opacity-40 cursor-pointer"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                  <span className="font-mono-num text-[11px] text-[#64748b] whitespace-nowrap">
                                    ×{formatNum(emp.lemburPerPaket / 1000)}k
                                  </span>
                                </div>

                                {/* 6. ESTIMASI GAJI */}
                                <div className="text-left xl:text-right">
                                  <div
                                    className={`font-mono-num text-sm font-bold ${
                                      isRecorded ? 'text-[#13222b]' : 'text-[#94a3b8]'
                                    }`}
                                  >
                                    {isRecorded ? formatRp(tot) : '–'}
                                  </div>
                                  <div className="font-mono-num text-[11px] text-[#64748b]">
                                    {isRecorded
                                      ? `Pokok ${formatNum(gp)} · Lmb ${formatNum(ul)}`
                                      : `${formatRp(emp.gajiHarian)}/hr`}
                                  </div>
                                </div>

                                {/* 7. AKSI BARIS (CATATAN & VERIFIKASI CEPAT) */}
                                <div className="flex items-center justify-start gap-1 xl:justify-end">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenNoteIds((prev) => ({
                                        ...prev,
                                        [emp.id]: !prev[emp.id],
                                      }))
                                    }
                                    title={hasNote ? `Catatan: ${effective?.catatan}` : 'Tambah catatan HR'}
                                    aria-label={`Catatan HR ${emp.nama}`}
                                    className={`flex h-8 w-8 items-center justify-center rounded-xl transition cursor-pointer ${
                                      hasNote || isNoteOpen
                                        ? 'bg-[#e6f7ee] text-[#15803d]'
                                        : 'bg-[#f3f7f5] text-[#64748b] hover:bg-[#e1ebe7] hover:text-[#13222b]'
                                    }`}
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                  </button>

                                  {!isViewer && hasDraft && (
                                    <button
                                      type="button"
                                      disabled={absSaving}
                                      onClick={() => void handleSaveRow(emp)}
                                      title={`Verifikasi & simpan absensi ${emp.nama}`}
                                      aria-label={`Simpan absensi ${emp.nama}`}
                                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2eb86b] text-white transition hover:bg-[#259f5b] disabled:opacity-50 cursor-pointer"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </button>
                                  )}

                                  {isSaved && !hasDraft && (
                                    <span
                                      title="Sudah diverifikasi & tersimpan"
                                      className="flex h-8 w-8 items-center justify-center text-[#2eb86b]"
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* EXPANDABLE INLINE HR NOTE STRIP */}
                              {isNoteOpen && (
                                <div className="flex flex-wrap items-center gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-4 py-2.5 sm:px-5">
                                  <span className="text-[11px] font-bold text-[#64748b]">
                                    Catatan HR:
                                  </span>
                                  <input
                                    type="text"
                                    disabled={isViewer}
                                    value={effective?.catatan || ''}
                                    onChange={(e) =>
                                      updateAttendanceDraft(ym, day, emp.id, {
                                        status: effective?.status || 'Hadir',
                                        catatan: e.target.value,
                                      })
                                    }
                                    placeholder="Tulis keterangan keterlambatan, lembur, izin, atau surat dokter…"
                                    className="h-8 min-w-[220px] flex-1 rounded-lg border border-[#dce6e2] bg-white px-3 text-xs text-[#13222b] focus:border-[#2eb86b] focus:outline-none disabled:opacity-60"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenNoteIds((prev) => ({ ...prev, [emp.id]: false }))
                                    }
                                    className="h-8 rounded-lg px-2.5 text-xs font-semibold text-[#64748b] hover:bg-[#e8f0ed] hover:text-[#13222b] cursor-pointer"
                                  >
                                    Selesai
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─────────────────── TAB 2: KALENDER ABSENSI ─────────────────── */}
          {abSub === 'kalender' && (
            <div className="space-y-4">
              {/* SUMMARY STRIP */}
              <div className="grid grid-cols-1 divide-y divide-[#edf2f0] overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="px-5 py-4">
                  <div className="text-xs font-semibold text-[#64748b]">Hari terisi</div>
                  <div className="font-mono-num mt-1 text-xl font-bold text-[#13222b]">
                    {calendarData.filledDays}
                    <span className="text-sm font-medium text-[#64748b]">/{nd}</span>
                  </div>
                </div>
                <div className="px-5 py-4">
                  <div className="text-xs font-semibold text-[#64748b]">Tidak hadir</div>
                  <div className="font-mono-num mt-1 text-xl font-bold text-[#13222b]">
                    {calendarData.totalAbsent}
                    <span className="ml-1 text-sm font-medium text-[#64748b]">orang-hari</span>
                  </div>
                </div>
                <div className="bg-[#f2fbf6] px-5 py-4">
                  <div className="text-xs font-semibold text-[#15803d]">Total hadir</div>
                  <div className="font-mono-num mt-1 text-xl font-bold text-[#15803d]">
                    {calendarData.totalHadir}
                    <span className="ml-1 text-sm font-medium text-[#2eb86b]">orang-hari</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(290px,1fr)]">
                {/* CALENDAR GRID */}
                <div className="rounded-2xl bg-white p-4 shadow-[0_6px_24px_rgba(13,37,48,0.045)] sm:p-5">
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAY_NAMES.map((dn, idx) => (
                      <div
                        key={dn}
                        className={`pb-1.5 text-center text-[11px] font-bold uppercase tracking-[0.04em] ${
                          idx === 0 ? 'text-[#dc2626]' : 'text-[#64748b]'
                        }`}
                      >
                        {dn.slice(0, 3)}
                      </div>
                    ))}

                    {Array.from({ length: calendarLeadingBlanks }).map((_, idx) => (
                      <div key={`blank-${idx}`} className="h-16 rounded-xl" />
                    ))}

                    {calendarData.days.map((info) => {
                      const isSel = info.day === calSelDay;
                      const isToday = ym === todayParts.ym && info.day === todayParts.day;
                      const isSunday = getDayOfWeek(ym, info.day) === 0;

                      const toneClass =
                        info.status === 'full'
                          ? 'border-[#bbf7d0] bg-[#f2fbf6]'
                          : info.status === 'part'
                            ? 'border-[#fcd34d] bg-[#fffbeb]'
                            : info.status === 'zero'
                              ? 'border-[#fecaca] bg-[#fef2f2]'
                              : 'border-[#edf2f0] bg-[#f7faf9]/60';

                      return (
                        <button
                          key={info.day}
                          type="button"
                          onClick={() => setCalSelDay(info.day)}
                          className={`relative flex h-16 flex-col items-start justify-between rounded-xl border p-2 text-left transition-colors cursor-pointer hover:border-[#2eb86b] ${toneClass} ${
                            isSel ? 'border-[#2eb86b] ring-2 ring-[#2eb86b]' : ''
                          }`}
                        >
                          <div className="flex w-full items-center justify-between">
                            <span
                              className={`font-mono-num text-xs font-bold ${
                                isSunday ? 'text-[#dc2626]' : 'text-[#13222b]'
                              }`}
                            >
                              {info.day}
                            </span>
                            {isToday && (
                              <span className="text-[10px] font-bold text-[#15803d]">
                                Hari ini
                              </span>
                            )}
                          </div>
                          {info.recordedCount > 0 ? (
                            <div className="font-mono-num flex flex-wrap items-center gap-x-1.5 text-[11px] font-bold">
                              <span className="text-[#15803d]">{info.hadirCount}H</span>
                              {info.absentCount > 0 && (
                                <span className="text-[#dc2626]">{info.absentCount}A</span>
                              )}
                              {info.pendingCount > 0 && (
                                <span className="text-[10px] font-medium text-[#b45309]">
                                  +{info.pendingCount}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#94a3b8]">–</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SELECTED DAY ASIDE */}
                <aside className="overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                  {selectedCalInfo ? (
                    <>
                      <div className="border-b border-[#edf2f0] px-5 py-4">
                        <h3 className="font-display text-[15px] font-bold text-[#13222b]">
                          {DAY_NAMES[getDayOfWeek(ym, selectedCalInfo.day)]}, {selectedCalInfo.day}{' '}
                          {monthLabel}
                        </h3>
                        <p className="mt-0.5 text-xs text-[#64748b]">
                          {selectedCalInfo.people.length === 0
                            ? 'Belum ada karyawan.'
                            : `${selectedCalInfo.hadirCount} hadir · ${selectedCalInfo.absentCount} tidak hadir${
                                selectedCalInfo.pendingCount > 0
                                  ? ` · ${selectedCalInfo.pendingCount} belum diisi`
                                  : ''
                              }`}
                        </p>
                      </div>

                      <div className="divide-y divide-[#edf2f0]">
                        {/* HADIR */}
                        {selectedCalInfo.people.filter((p) => p.record?.status === 'Hadir').length >
                          0 && (
                          <div className="px-5 py-3.5">
                            <div className="mb-2 text-xs font-bold text-[#15803d]">
                              Hadir (
                              {
                                selectedCalInfo.people.filter((p) => p.record?.status === 'Hadir')
                                  .length
                              }
                              )
                            </div>
                            <div className="divide-y divide-[#edf2f0]">
                              {selectedCalInfo.people
                                .filter((p) => p.record?.status === 'Hadir')
                                .map(({ emp, record, isArchived }) => {
                                  const late = calcLateMinutes(
                                    record?.shift || emp.shiftDefault,
                                    record?.checkIn,
                                    state
                                  );
                                  return (
                                    <div
                                      key={emp.id}
                                      className="flex items-start justify-between gap-2 py-2"
                                    >
                                      <div className="flex min-w-0 items-start gap-2">
                                        <EmployeeAvatar nama={emp.nama} foto={emp.foto} size="sm" />
                                        <div className="min-w-0">
                                          <button
                                            type="button"
                                            onClick={() => openEmpDetail(emp.id)}
                                            className="block truncate text-left text-xs font-semibold text-[#13222b] hover:text-[#15803d] hover:underline cursor-pointer"
                                          >
                                            {emp.nama}
                                            {isArchived ? ' (Arsip)' : ''}
                                          </button>
                                          {(record?.checkIn || record?.shift || late > 0) && (
                                            <div className="font-mono-num mt-0.5 text-[11px] text-[#64748b]">
                                              {record?.shift || emp.shiftDefault || 'Full'}
                                              {record?.checkIn
                                                ? ` · ${record.checkIn}${record.checkOut ? `–${record.checkOut}` : ''}`
                                                : ''}
                                              {late > 0 && (
                                                <span className="ml-1 font-semibold text-[#b45309]">
                                                  · Telat {late}m
                                                </span>
                                              )}
                                            </div>
                                          )}
                                          {record?.catatan && (
                                            <div className="mt-0.5 truncate text-[11px] text-[#64748b]">
                                              {record.catatan}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      {record && Number(record.lembur) > 0 && (
                                        <span className="font-mono-num shrink-0 text-[11px] font-semibold text-[#64748b] whitespace-nowrap">
                                          lembur {record.lembur} pkt
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {/* TIDAK HADIR */}
                        {selectedCalInfo.people.filter(
                          (p) => p.record && p.record.status !== 'Hadir'
                        ).length > 0 && (
                          <div className="px-5 py-3.5">
                            <div className="mb-2 text-xs font-bold text-[#dc2626]">
                              Tidak hadir (
                              {
                                selectedCalInfo.people.filter(
                                  (p) => p.record && p.record.status !== 'Hadir'
                                ).length
                              }
                              )
                            </div>
                            <div className="divide-y divide-[#edf2f0]">
                              {selectedCalInfo.people
                                .filter((p) => p.record && p.record.status !== 'Hadir')
                                .map(({ emp, record, isArchived }) => (
                                  <div
                                    key={emp.id}
                                    className="flex items-start justify-between gap-2 py-2"
                                  >
                                    <div className="flex min-w-0 items-start gap-2">
                                      <EmployeeAvatar nama={emp.nama} foto={emp.foto} size="sm" />
                                      <div className="min-w-0">
                                        <button
                                          type="button"
                                          onClick={() => openEmpDetail(emp.id)}
                                          className="block truncate text-left text-xs font-semibold text-[#13222b] hover:text-[#15803d] hover:underline cursor-pointer"
                                        >
                                          {emp.nama}
                                          {isArchived ? ' (Arsip)' : ''}
                                        </button>
                                        {record?.catatan && (
                                          <div className="mt-0.5 truncate text-[11px] text-[#64748b]">
                                            {record.catatan}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {record && (
                                      <span
                                        className={`shrink-0 text-xs font-bold ${STATUS_TEXT_COLOR[record.status]}`}
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
                            <div className="mb-2 text-xs font-semibold text-[#64748b]">
                              Belum diisi ({selectedCalInfo.people.filter((p) => !p.record).length})
                            </div>
                            <div className="divide-y divide-[#edf2f0]">
                              {selectedCalInfo.people
                                .filter((p) => !p.record)
                                .map(({ emp }) => (
                                  <div
                                    key={emp.id}
                                    className="flex items-center justify-between gap-2 py-2"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <EmployeeAvatar nama={emp.nama} foto={emp.foto} size="sm" />
                                      <span className="truncate text-xs font-semibold text-[#475569]">
                                        {emp.nama}
                                      </span>
                                    </div>
                                    <span className="text-xs text-[#94a3b8]">–</span>
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
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-[#13222b]">
                    Master Karyawan
                  </h2>
                  <p className="mt-0.5 text-xs text-[#64748b]">
                    Sumber identitas, tarif gaji harian, tarif lembur per paket, dan siklus
                    penggajian
                  </p>
                </div>
                {archivedEmployees.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowArchiveList((v) => !v)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-[#475569] shadow-xs transition hover:text-[#15803d] cursor-pointer"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span>
                      {showArchiveList ? 'Sembunyikan' : 'Lihat'} arsip ({archivedEmployees.length})
                    </span>
                  </button>
                )}
              </div>

              {masterEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-14 text-center shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                  <Users className="mb-3 h-8 w-8 text-[#94a3b8]" />
                  <p className="text-sm font-semibold text-[#13222b]">Belum ada karyawan.</p>
                  {!isViewer && (
                    <button
                      type="button"
                      onClick={openAddModal}
                      className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Tambah karyawan</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                  <table className="w-full border-collapse text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#edf2f0] bg-[#f7faf9] text-[11px] font-bold uppercase tracking-[0.04em] text-[#64748b]">
                        <th className="px-4 py-3">Nama &amp; Jabatan</th>
                        <th className="px-4 py-3">Shift Default</th>
                        <th className="px-4 py-3 text-right">Gaji harian</th>
                        <th className="px-4 py-3 text-right">Tarif lembur</th>
                        <th className="px-4 py-3 text-center">Siklus</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        {!isViewer && <th className="px-4 py-3 text-right">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2f0]">
                      {masterEmployees.map((emp) => (
                        <tr
                          key={emp.id}
                          className={`transition hover:bg-[#f7faf9] ${emp.aktif ? '' : 'opacity-60'}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <EmployeeAvatar nama={emp.nama} foto={emp.foto} size="sm" />
                              <div>
                                <button
                                  type="button"
                                  onClick={() => openEmpDetail(emp.id)}
                                  className="font-bold text-[#13222b] hover:text-[#15803d] hover:underline cursor-pointer"
                                >
                                  {emp.nama}
                                </button>
                                <div className="text-[11px] text-[#64748b]">
                                  {emp.jabatan ? `${emp.jabatan} · ` : ''}
                                  <span className="font-mono-num">ID: {emp.id}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-[#475569] whitespace-nowrap">
                            {shiftPresets[emp.shiftDefault || 'Full'].shortLabel}
                          </td>
                          <td className="font-mono-num px-4 py-3 text-right font-bold text-[#13222b] whitespace-nowrap">
                            {formatRp(emp.gajiHarian)}
                            <span className="font-sans text-[11px] font-medium text-[#64748b]">
                              {' '}
                              /hari
                            </span>
                          </td>
                          <td className="font-mono-num px-4 py-3 text-right font-bold text-[#13222b] whitespace-nowrap">
                            {formatRp(emp.lemburPerPaket)}
                            <span className="font-sans text-[11px] font-medium text-[#64748b]">
                              {' '}
                              /paket
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-semibold text-[#475569] whitespace-nowrap">
                            {emp.siklusGaji === 'bulanan' ? 'Bulanan' : '2x/bulan'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              disabled={isViewer}
                              onClick={() => toggleEmployeeActive(emp.id)}
                              className={`h-7 shrink-0 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:cursor-default ${
                                emp.aktif
                                  ? 'bg-[#e6f7ee] text-[#15803d] hover:bg-[#d1f0e0]'
                                  : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
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
                                  className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#f3f7f5] px-2.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setArchiveTarget(emp)}
                                  className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#fee2e2] px-2.5 text-xs font-semibold text-[#b91c1c] transition hover:bg-[#fecaca] cursor-pointer"
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
                    <h3 className="font-display text-sm font-bold text-[#475569]">
                      Arsip Karyawan ({archivedEmployees.length})
                    </h3>
                    <span className="text-xs text-[#64748b]">
                      Riwayat absensi &amp; penggajian tetap dipertahankan
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                    <table className="w-full border-collapse text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-[#edf2f0] bg-[#f7faf9] text-[11px] font-bold uppercase tracking-[0.04em] text-[#64748b]">
                          <th className="px-4 py-2.5">Nama</th>
                          <th className="px-4 py-2.5 text-right">Tarif terakhir</th>
                          <th className="px-4 py-2.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#edf2f0]">
                        {archivedEmployees.map((emp) => (
                          <tr key={emp.id} className="hover:bg-[#f7faf9]">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <EmployeeAvatar nama={emp.nama} foto={emp.foto} size="sm" />
                                <button
                                  type="button"
                                  onClick={() => openEmpDetail(emp.id)}
                                  className="font-semibold text-[#475569] hover:text-[#15803d] hover:underline cursor-pointer"
                                >
                                  {emp.nama}
                                </button>
                              </div>
                            </td>
                            <td className="font-mono-num px-4 py-2.5 text-right text-xs text-[#64748b] whitespace-nowrap">
                              {formatRp(emp.gajiHarian)}/hr · Lembur {formatRp(emp.lemburPerPaket)}
                              /pkt
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEmpDetail(emp.id)}
                                  className="h-7.5 rounded-xl bg-[#f3f7f5] px-2.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
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
                                    className="inline-flex h-7.5 items-center gap-1 rounded-xl bg-[#e6f7ee] px-2.5 text-xs font-semibold text-[#15803d] transition hover:bg-[#d1f0e0] cursor-pointer"
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
            <div className="space-y-4">
              {/* CYCLE SWITCHER BAR */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  {renderCycleSwitcher()}
                  <span className="text-xs text-[#64748b]">
                    <strong className="font-semibold text-[#13222b]">{payrollRange.label}</strong>
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
                  className="no-print inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-[#15803d] shadow-xs transition hover:bg-[#e6f7ee] whitespace-nowrap cursor-pointer"
                >
                  <span>Sinkron dengan OMSET</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* SUMMARY STRIP */}
              <div className="grid grid-cols-1 divide-y divide-[#edf2f0] overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="bg-[#f2fbf6] px-5 py-4">
                  <div className="text-xs font-semibold text-[#15803d]">Total gaji periode</div>
                  <div className="font-mono-num mt-1 text-xl font-bold text-[#15803d]">
                    {formatRp(payrollRows.totalGaji)}
                  </div>
                </div>
                <div className="px-5 py-4">
                  <div className="text-xs font-semibold text-[#64748b]">Hari hadir</div>
                  <div className="font-mono-num mt-1 text-xl font-bold text-[#13222b]">
                    {payrollRows.totalHadir}
                    <span className="ml-1 text-sm font-medium text-[#64748b]">hari</span>
                  </div>
                </div>
                <div className="px-5 py-4">
                  <div className="text-xs font-semibold text-[#64748b]">Lembur</div>
                  <div className="font-mono-num mt-1 text-xl font-bold text-[#13222b]">
                    {payrollRows.totalLemburPaket}
                    <span className="ml-1 text-sm font-medium text-[#64748b]">paket</span>
                  </div>
                </div>
              </div>

              {/* PAYROLL TABLE */}
              {payrollRows.list.length === 0 ? (
                <div className="rounded-2xl bg-white py-12 text-center text-sm text-[#64748b] shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                  Belum ada karyawan untuk direkap.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                  <table className="w-full border-collapse text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#edf2f0] bg-[#f7faf9] text-[11px] font-bold uppercase tracking-[0.04em] text-[#64748b]">
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
                    <tbody className="divide-y divide-[#edf2f0]">
                      {payrollRows.list.map(({ emp, isArchived, calc }) => (
                        <tr key={emp.id} className="hover:bg-[#f7faf9]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <EmployeeAvatar nama={emp.nama} foto={emp.foto} size="sm" />
                              <div>
                                <button
                                  type="button"
                                  onClick={() => openEmpDetail(emp.id)}
                                  className="font-bold text-[#13222b] hover:text-[#15803d] hover:underline cursor-pointer"
                                >
                                  {emp.nama}
                                </button>
                                <div className="text-[11px] text-[#64748b]">
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
                          <td className="font-mono-num px-4 py-3 text-right font-semibold text-[#13222b] whitespace-nowrap">
                            {calc.h} hr
                          </td>
                          <td
                            className="font-mono-num px-4 py-3 text-right text-[#64748b] whitespace-nowrap"
                            title="Libur · Izin · Sakit · Alfa"
                          >
                            {calc.off > 0 ? `${calc.l}·${calc.iz}·${calc.s}·${calc.a}` : '–'}
                          </td>
                          <td className="font-mono-num px-4 py-3 text-right font-semibold text-[#13222b] whitespace-nowrap">
                            {calc.lm} pkt
                          </td>
                          <td className="font-mono-num px-4 py-3 text-right text-[#475569] whitespace-nowrap">
                            {formatRp(calc.gp)}
                          </td>
                          <td className="font-mono-num px-4 py-3 text-right text-[#475569] whitespace-nowrap">
                            {formatRp(calc.ul)}
                          </td>
                          <td className="font-mono-num px-4 py-3 text-right font-bold text-[#15803d] whitespace-nowrap">
                            {formatRp(calc.tot)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#0d2530] font-bold text-white">
                        <td className="px-4 py-3">Total ({payrollRows.list.length} karyawan)</td>
                        <td className="font-mono-num px-4 py-3 text-right whitespace-nowrap">
                          {payrollRows.totalHadir} hr
                        </td>
                        <td className="px-4 py-3 text-right text-[#94a3b8]">–</td>
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
            <div className="space-y-4">
              {!selectedEmployee || !detailViewData ? (
                <div className="rounded-2xl bg-white py-12 text-center text-sm text-[#64748b] shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
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
                        className="inline-flex h-8.5 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-semibold text-[#13222b] shadow-xs transition hover:bg-[#f3f7f5] whitespace-nowrap cursor-pointer"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Kembali</span>
                      </button>
                      <select
                        value={selectedEmployee.id}
                        onChange={(e) => setSelectedEmpId(e.target.value)}
                        aria-label="Pilih karyawan"
                        className="h-8.5 rounded-xl bg-white px-3 text-xs font-semibold text-[#13222b] shadow-xs focus:ring-2 focus:ring-[#2eb86b] focus:outline-none cursor-pointer"
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

                  {/* PROFILE HEADER CARD */}
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                    <div className="flex items-center gap-3.5">
                      <EmployeeAvatar
                        nama={selectedEmployee.nama}
                        foto={selectedEmployee.foto}
                        size="lg"
                      />
                      <div>
                        <h2 className="font-display text-lg font-bold text-[#13222b]">
                          {selectedEmployee.nama}
                        </h2>
                        <p className="text-xs text-[#64748b]">
                          Rincian gaji · {payrollRange.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#475569]">
                      <span className="font-mono-num">
                        Gaji pokok{' '}
                        <strong className="font-bold text-[#13222b]">
                          {formatRp(selectedEmployee.gajiHarian)}
                        </strong>
                        /hari
                      </span>
                      <span aria-hidden="true" className="text-[#cbd5e1]">
                        ·
                      </span>
                      <span className="font-mono-num">
                        Lembur{' '}
                        <strong className="font-bold text-[#13222b]">
                          {formatRp(selectedEmployee.lemburPerPaket)}
                        </strong>
                        /paket
                      </span>
                      <span aria-hidden="true" className="text-[#cbd5e1]">
                        ·
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 font-semibold ${
                          detailViewData.archived
                            ? 'bg-[#f1f5f9] text-[#64748b]'
                            : selectedEmployee.aktif
                              ? 'bg-[#e6f7ee] text-[#15803d]'
                              : 'bg-[#f1f5f9] text-[#64748b]'
                        }`}
                      >
                        {detailViewData.archived
                          ? 'Arsip'
                          : selectedEmployee.aktif
                            ? 'Aktif'
                            : 'Nonaktif'}
                      </span>
                      <span aria-hidden="true" className="text-[#cbd5e1]">
                        ·
                      </span>
                      <span>
                        {selectedEmployee.siklusGaji === 'bulanan' ? 'Bulanan' : '2x Sebulan'}
                      </span>
                    </div>
                  </div>

                  {/* HERO TOTALS */}
                  <div className="grid grid-cols-1 divide-y divide-[#edf2f0] overflow-hidden rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    <div className="bg-[#f2fbf6] px-5 py-4">
                      <div className="text-xs font-semibold text-[#15803d]">Total gaji diterima</div>
                      <div className="font-mono-num mt-1 text-xl font-bold text-[#15803d]">
                        {formatRp(detailViewData.calc.tot)}
                      </div>
                    </div>
                    <div className="px-5 py-4">
                      <div className="text-xs font-semibold text-[#64748b]">Hadir</div>
                      <div className="font-mono-num mt-1 text-xl font-bold text-[#13222b]">
                        {detailViewData.calc.h}
                        <span className="ml-1 text-sm font-medium text-[#64748b]">
                          / {payrollRange.count} hari
                        </span>
                      </div>
                    </div>
                    <div className="px-5 py-4">
                      <div className="text-xs font-semibold text-[#64748b]">Lembur</div>
                      <div className="font-mono-num mt-1 text-xl font-bold text-[#13222b]">
                        {detailViewData.calc.lm}
                        <span className="ml-1 text-sm font-medium text-[#64748b]">paket</span>
                      </div>
                    </div>
                  </div>

                  {/* SLIP BREAKDOWN TABLE */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-[#475569]">Rincian slip gaji</h3>
                    <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                      <table className="w-full border-collapse text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[#edf2f0] bg-[#f7faf9] text-[11px] font-bold uppercase tracking-[0.04em] text-[#64748b]">
                            <th className="px-4 py-2.5">Komponen</th>
                            <th className="px-4 py-2.5 text-right">Jumlah</th>
                            <th className="px-4 py-2.5 text-right">Tarif</th>
                            <th className="px-4 py-2.5 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf2f0]">
                          <tr>
                            <td className="px-4 py-2.5 font-semibold text-[#13222b]">Gaji pokok</td>
                            <td className="font-mono-num px-4 py-2.5 text-right text-[#475569]">
                              {detailViewData.calc.h} hari
                            </td>
                            <td className="font-mono-num px-4 py-2.5 text-right text-[#64748b]">
                              {detailViewData.calc.hasMixedRates
                                ? 'Sesuai riwayat'
                                : formatRp(detailViewData.calc.effectiveGajiRate)}
                            </td>
                            <td className="font-mono-num px-4 py-2.5 text-right font-bold text-[#13222b]">
                              {formatRp(detailViewData.calc.gp)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2.5 font-semibold text-[#13222b]">Uang lembur</td>
                            <td className="font-mono-num px-4 py-2.5 text-right text-[#475569]">
                              {detailViewData.calc.lm} paket
                            </td>
                            <td className="font-mono-num px-4 py-2.5 text-right text-[#64748b]">
                              {detailViewData.calc.hasMixedRates
                                ? 'Sesuai riwayat'
                                : formatRp(detailViewData.calc.effectiveLemburRate)}
                            </td>
                            <td className="font-mono-num px-4 py-2.5 text-right font-bold text-[#13222b]">
                              {formatRp(detailViewData.calc.ul)}
                            </td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-[#edf2f0] bg-[#f2fbf6] font-bold">
                            <td colSpan={3} className="px-4 py-3 text-[#13222b]">
                              Total diterima
                            </td>
                            <td className="font-mono-num px-4 py-3 text-right text-[#15803d]">
                              {formatRp(detailViewData.calc.tot)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {detailViewData.offBreakdown && (
                      <p className="text-xs text-[#64748b]">
                        Tidak hadir: {detailViewData.offBreakdown}
                      </p>
                    )}
                  </div>

                  {/* DAILY HISTORY TABLE */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-[#475569]">
                      Riwayat harian (
                      {detailShowAll ? `1–${nd}` : `${payrollRange.start}–${payrollRange.end}`}{' '}
                      {monthLabel})
                    </h3>
                    <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_6px_24px_rgba(13,37,48,0.045)]">
                      <table className="w-full border-collapse text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[#edf2f0] bg-[#f7faf9] text-[11px] font-bold uppercase tracking-[0.04em] text-[#64748b]">
                            <th className="px-4 py-2.5">Tanggal</th>
                            <th className="px-4 py-2.5">Status</th>
                            <th className="px-4 py-2.5">Shift &amp; Jam Kerja</th>
                            <th className="px-4 py-2.5">Catatan</th>
                            <th className="px-4 py-2.5 text-right">Lembur</th>
                            <th className="px-4 py-2.5 text-right">Gaji pokok</th>
                            <th className="px-4 py-2.5 text-right">Uang lembur</th>
                            <th className="px-4 py-2.5 text-right">Total</th>
                            {!isViewer && !detailViewData.archived && (
                              <th className="no-print px-4 py-2.5 text-right">Aksi</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#edf2f0]">
                          {detailViewData.dayRows.map((dr) => {
                            const lateMins =
                              dr.rec?.status === 'Hadir'
                                ? calcLateMinutes(
                                    dr.rec.shift || selectedEmployee.shiftDefault,
                                    dr.rec.checkIn,
                                    state
                                  )
                                : 0;
                            const durMins =
                              dr.rec?.status === 'Hadir'
                                ? calcWorkDurationMinutes(dr.rec.checkIn, dr.rec.checkOut)
                                : null;
                            return (
                              <tr
                                key={dr.day}
                                className={`hover:bg-[#f7faf9] ${dr.inRange ? '' : 'opacity-45'}`}
                              >
                                <td
                                  className={`px-4 py-2.5 font-semibold whitespace-nowrap ${
                                    dr.dow === 0 ? 'text-[#dc2626]' : 'text-[#13222b]'
                                  }`}
                                >
                                  {dr.dayName}, {dr.day} {MONTH_NAMES[monthNum - 1]}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  {dr.rec ? (
                                    <span
                                      className={`text-xs font-bold ${STATUS_TEXT_COLOR[dr.rec.status]}`}
                                    >
                                      {dr.rec.status}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-[#94a3b8]">Belum diisi</span>
                                  )}
                                </td>
                                <td className="font-mono-num px-4 py-2.5 text-xs text-[#475569] whitespace-nowrap">
                                  {dr.rec?.status === 'Hadir' ? (
                                    <span>
                                      {dr.rec.shift || selectedEmployee.shiftDefault || 'Full'}
                                      {dr.rec.checkIn
                                        ? ` · ${dr.rec.checkIn}${dr.rec.checkOut ? `–${dr.rec.checkOut}` : ''}`
                                        : ''}
                                      {durMins !== null ? ` (${formatDurationLabel(durMins)})` : ''}
                                      {lateMins > 0 && (
                                        <span className="ml-1.5 font-semibold text-[#b45309]">
                                          Telat {lateMins}m
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-[#94a3b8]">–</span>
                                  )}
                                </td>
                                <td className="max-w-[200px] truncate px-4 py-2.5 text-xs text-[#64748b]">
                                  {dr.rec?.catatan || '–'}
                                </td>
                                <td className="font-mono-num px-4 py-2.5 text-right text-[#64748b] whitespace-nowrap">
                                  {dr.lm > 0 ? `${dr.lm} paket` : '–'}
                                </td>
                                <td className="font-mono-num px-4 py-2.5 text-right text-[#475569] whitespace-nowrap">
                                  {dr.gp > 0 ? formatRp(dr.gp) : '–'}
                                </td>
                                <td className="font-mono-num px-4 py-2.5 text-right text-[#475569] whitespace-nowrap">
                                  {dr.ul > 0 ? formatRp(dr.ul) : '–'}
                                </td>
                                <td className="font-mono-num px-4 py-2.5 text-right font-bold text-[#13222b] whitespace-nowrap">
                                  {dr.rec ? formatRp(dr.tot) : '–'}
                                </td>
                                {!isViewer && !detailViewData.archived && (
                                  <td className="no-print px-4 py-2.5 text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMonthAndDay(ym, dr.day);
                                        setAbSub('harian');
                                      }}
                                      className="h-7 rounded-lg bg-[#f3f7f5] px-2.5 text-[11.5px] font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
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

      {/* FLOATING BOTTOM FOOTER BAR */}
      <div className="no-print mx-4 mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-[0_6px_22px_rgba(13,37,48,0.06)] md:mx-6 md:px-5">
        {abSub === 'harian' && (
          <>
            <div className="text-xs text-[#475569]">
              {absUnsent ? (
                <strong className="text-[#dc2626]">
                  Belum terkirim ke database — klik Simpan &amp; Verifikasi
                </strong>
              ) : dailyModel.draftRowCount > 0 ? (
                <span>
                  <strong className="text-[#b45309]">{dailyModel.draftRowCount} karyawan</strong>{' '}
                  menunggu verifikasi
                  {dailyModel.unrecordedCount > 0
                    ? ` · ${dailyModel.unrecordedCount} belum absen`
                    : ''}
                </span>
              ) : dailyModel.unrecordedCount > 0 ? (
                <span>
                  <strong className="text-[#13222b]">{dailyModel.unrecordedCount} karyawan</strong>{' '}
                  belum absen · {dailyModel.saved} sudah terverifikasi
                </span>
              ) : (
                <span className="font-semibold text-[#15803d]">
                  Seluruh absensi hari ini ({dailyModel.saved}/{activeEmployees.length}) sudah
                  terverifikasi
                </span>
              )}
            </div>
            {!isViewer && activeEmployees.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setAllAttendanceHadir(ym, day, {
                      onlyUnrecorded: false,
                      withScheduledTimes: true,
                    })
                  }
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] whitespace-nowrap cursor-pointer"
                >
                  <UserCheck className="h-3.5 w-3.5 text-[#2eb86b]" />
                  <span>Semua hadir</span>
                </button>
                <button
                  type="button"
                  disabled={absSaving || (dailyModel.recordedCount === 0 && !absUnsent)}
                  onClick={handleSaveToday}
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 ${
                    dailyModel.draftRowCount > 0 || absUnsent
                      ? 'bg-[#f59e0b] hover:bg-[#d97706]'
                      : 'bg-[#2eb86b] hover:bg-[#259f5b]'
                  }`}
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>
                    {absSaving
                      ? 'Menyimpan…'
                      : dailyModel.draftRowCount > 0
                        ? `Simpan & Verifikasi (${dailyModel.draftRowCount})`
                        : 'Simpan absensi'}
                  </span>
                </button>
              </div>
            )}
          </>
        )}

        {abSub === 'kalender' && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[#64748b]">
              <span>
                <strong className="text-[#15803d]">H</strong> = Hadir
              </span>
              <span>
                <strong className="text-[#dc2626]">A</strong> = Tidak hadir
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
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] whitespace-nowrap cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Buka absen tgl {calSelDay}</span>
            </button>
          </>
        )}

        {abSub === 'karyawan' && (
          <>
            <div className="text-xs text-[#64748b]">
              <strong className="text-[#13222b]">{activeEmployees.length}</strong> aktif dari{' '}
              <strong className="text-[#13222b]">{masterEmployees.length}</strong> karyawan
              {archivedEmployees.length > 0 ? ` · ${archivedEmployees.length} arsip` : ''}
            </div>
            {!isViewer && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] whitespace-nowrap cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah karyawan</span>
              </button>
            )}
          </>
        )}

        {abSub === 'rekap' && (
          <>
            <div className="text-xs text-[#64748b]">Absen = libur · izin · sakit · alfa</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] whitespace-nowrap cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak</span>
              </button>
              <button
                type="button"
                onClick={handleCopyRekapWA}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] whitespace-nowrap cursor-pointer"
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
              className="inline-flex h-9 shrink-0 items-center rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] whitespace-nowrap cursor-pointer"
            >
              {detailShowAll ? 'Tampilkan periode ini saja' : 'Tampilkan sebulan penuh'}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#f3f7f5] px-3.5 text-xs font-semibold text-[#13222b] transition hover:bg-[#e1ebe7] whitespace-nowrap cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopySingleSlipWA(selectedEmployee)}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] whitespace-nowrap cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Salin slip WhatsApp</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─────────────────── MODAL: TAMBAH / EDIT KARYAWAN ─────────────────── */}
      {empModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEmpModalOpen(false);
            }}
          >
            <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
              <div className="flex shrink-0 items-center justify-between border-b border-[#edf2f0] px-5 py-4">
                <div className="flex items-center gap-3">
                  <EmployeeAvatar nama={formNama || '?'} foto={formFoto} size="md" />
                  <div>
                    <h3 className="font-display text-base font-bold text-[#13222b]">
                      {editEmp ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
                    </h3>
                    <p className="text-xs text-[#64748b]">
                      Atur nama, foto, gaji harian, tarif lembur, dan siklus gaji
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEmpModalOpen(false)}
                  aria-label="Tutup modal"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitEmployee} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
                {formError && (
                  <div className="rounded-xl bg-[#fee2e2] px-3 py-2 text-xs font-semibold text-[#b91c1c]">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                    Nama Karyawan <span className="text-[#ef4444]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="h-10 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3 text-sm text-[#13222b] transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                      Jabatan / Posisi
                    </label>
                    <input
                      type="text"
                      value={formJabatan}
                      onChange={(e) => setFormJabatan(e.target.value)}
                      placeholder="Contoh: Barista, Kasir"
                      className="h-10 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3 text-sm text-[#13222b] transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                      Shift Default
                    </label>
                    <select
                      value={formShiftDefault}
                      onChange={(e) => setFormShiftDefault(e.target.value as AttendanceShift)}
                      className="h-10 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3 text-sm text-[#13222b] transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20 focus:outline-none"
                    >
                      {shiftList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                    Link Foto (opsional)
                  </label>
                  <input
                    type="url"
                    value={formFoto}
                    onChange={(e) => setFormFoto(e.target.value)}
                    placeholder="https://lh3.googleusercontent.com/d/ID_FILE"
                    className="h-10 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3 text-sm text-[#13222b] transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-[#64748b]">
                    Mendukung link Google Drive (dibagikan &ldquo;Siapa saja yang memiliki
                    link&rdquo;) atau kolom Foto URL di sheet KARYAWAN.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                      Gaji Harian (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={formGaji}
                      onChange={(e) => setFormGaji(e.target.value)}
                      className="font-mono-num h-10 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3 text-sm font-bold text-[#13222b] transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                      Tarif Lembur / Paket (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={formLembur}
                      onChange={(e) => setFormLembur(e.target.value)}
                      className="font-mono-num h-10 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3 text-sm font-bold text-[#13222b] transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#13222b]">
                    Siklus Penggajian
                  </label>
                  <select
                    value={formSiklus}
                    onChange={(e) =>
                      setFormSiklus(e.target.value === 'bulanan' ? 'bulanan' : '14hari')
                    }
                    className="h-10 w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] px-3 text-sm text-[#13222b] transition focus:border-[#2eb86b] focus:bg-white focus:ring-2 focus:ring-[#2eb86b]/20 focus:outline-none"
                  >
                    <option value="14hari">
                      2x Sebulan (Tahap 1: 1–15 &amp; Tahap 2: 16–akhir)
                    </option>
                    <option value="bulanan">Bulanan (1 Bulan Penuh)</option>
                  </select>
                </div>

                {editEmp && isEditingTariffChanged && (
                  <div className="rounded-xl bg-[#fef3c7] p-3 text-xs text-[#92400e]">
                    <p className="font-bold">Perlindungan histori tarif</p>
                    <p className="mt-0.5 leading-relaxed">
                      Secara default, perubahan tarif hanya berlaku untuk absensi baru agar histori
                      penggajian &amp; OMSET yang sudah tersimpan tidak berubah secara retroaktif.
                    </p>
                    <label className="mt-2 flex items-center gap-2 font-semibold text-[#78350f] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formApplyRetroactive}
                        onChange={(e) => setFormApplyRetroactive(e.target.checked)}
                        className="h-3.5 w-3.5 rounded accent-[#f59e0b]"
                      />
                      <span>Terapkan tarif baru ke seluruh histori tersimpan</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setEmpModalOpen(false)}
                  className="h-9 rounded-xl bg-white px-4 text-xs font-semibold text-[#13222b] shadow-xs transition hover:bg-[#e1ebe7] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{editEmp ? 'Simpan perubahan' : 'Tambah karyawan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
          document.body
        )}

      {/* ─────────────────── MODAL: KONFIRMASI ARSIP KARYAWAN ─────────────────── */}
      {archiveTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
            onClick={(e) => {
              if (e.target === e.currentTarget) setArchiveTarget(null);
            }}
          >
            <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
              <div className="flex shrink-0 items-center justify-between border-b border-[#edf2f0] px-5 py-4">
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4 text-[#ef4444]" />
                  <h3 className="font-display text-base font-bold text-[#13222b]">
                    Arsipkan Karyawan
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setArchiveTarget(null)}
                  aria-label="Tutup"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <p className="text-xs leading-relaxed text-[#475569]">
                  Arsipkan <strong className="text-[#13222b]">{archiveTarget.nama}</strong> dari
                  daftar karyawan aktif? Seluruh riwayat absensi, slip gaji, dan perhitungan gaji di
                  OMSET tetap tersimpan utuh dan karyawan dapat dipulihkan kapan saja.
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setArchiveTarget(null)}
                  className="h-9 rounded-xl bg-white px-4 text-xs font-semibold text-[#13222b] shadow-xs transition hover:bg-[#e1ebe7] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmArchive}
                  className="h-9 rounded-xl bg-[#ef4444] px-4 text-xs font-semibold text-white transition hover:bg-[#dc2626] cursor-pointer"
                >
                  Ya, Arsipkan
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ─────────────────── MODAL: FALLBACK SALIN TEKS WHATSAPP ─────────────────── */}
      {waModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
            onClick={(e) => {
              if (e.target === e.currentTarget) setWaModal(null);
            }}
          >
            <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
              <div className="flex shrink-0 items-center justify-between border-b border-[#edf2f0] px-5 py-4">
                <div>
                  <h3 className="font-display text-base font-bold text-[#13222b]">
                    Salin {waModal.title}
                  </h3>
                  <p className="text-xs text-[#64748b]">
                    Salin teks di bawah ini lalu tempel (paste) ke WhatsApp
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWaModal(null)}
                  aria-label="Tutup"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <textarea
                  readOnly
                  value={waModal.text}
                  rows={13}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono-num w-full rounded-xl border border-[#dce6e2] bg-[#f7faf9] p-3 text-xs leading-relaxed text-[#13222b] focus:border-[#2eb86b] focus:outline-none"
                />
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => setWaModal(null)}
                  className="h-9 rounded-xl bg-white px-4 text-xs font-semibold text-[#13222b] shadow-xs transition hover:bg-[#e1ebe7] cursor-pointer"
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
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Salin teks</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL PENGATURAN JAM KERJA (START – FINISH) */}
      {shiftModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0d2530]/45 p-4 backdrop-blur-[2px]"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShiftModalOpen(false);
            }}
          >
            <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(13,37,48,0.22)]">
              <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[#edf2f0] px-5 py-3.5">
                <div>
                  <h3 className="font-display text-base font-bold text-[#13222b]">
                    Pengaturan Jam Kerja (Start–Finish)
                  </h3>
                  <p className="mt-0.5 text-xs text-[#64748b]">
                    Atur jam masuk &amp; jam pulang setiap shift sebagai acuan keterlambatan dan isi otomatis
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShiftModalOpen(false)}
                  aria-label="Tutup pengaturan jam kerja"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f3f7f5] hover:text-[#13222b] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveShiftConfig} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
                  {(
                    [
                      {
                        id: 'Full' as ScheduledShiftId,
                        name: 'Full Day',
                        desc: 'Shift operasional penuh harian',
                      },
                      {
                        id: 'Pagi' as ScheduledShiftId,
                        name: 'Shift Pagi',
                        desc: 'Jadwal kerja sesi pagi',
                      },
                      {
                        id: 'Siang' as ScheduledShiftId,
                        name: 'Shift Siang',
                        desc: 'Jadwal kerja sesi siang/sore',
                      },
                    ] as const
                  ).map((item) => {
                    const hours = shiftForm[item.id];
                    const durMins = calcWorkDurationMinutes(hours.start, hours.end);
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[#dce6e2] bg-[#f7faf9] p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-[#13222b]">{item.name}</div>
                            <div className="text-[11px] text-[#64748b]">{item.desc}</div>
                          </div>
                          <span className="font-mono-num rounded-lg bg-[#e6f7ee] px-2.5 py-1 text-[11px] font-bold text-[#15803d]">
                            Durasi {formatDurationLabel(durMins)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-[#475569]">
                              Start (Jam Masuk)
                            </label>
                            <input
                              type="time"
                              required
                              disabled={isViewer}
                              value={hours.start}
                              onChange={(e) =>
                                setShiftForm((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], start: e.target.value },
                                }))
                              }
                              className="font-mono-num h-9 w-full rounded-xl border border-[#dce6e2] bg-white px-3 text-xs font-bold text-[#13222b] outline-none transition focus:border-[#2eb86b] focus:ring-2 focus:ring-[#2eb86b]/20 disabled:opacity-60"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold text-[#475569]">
                              Finish (Jam Pulang)
                            </label>
                            <input
                              type="time"
                              required
                              disabled={isViewer}
                              value={hours.end}
                              onChange={(e) =>
                                setShiftForm((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], end: e.target.value },
                                }))
                              }
                              className="font-mono-num h-9 w-full rounded-xl border border-[#dce6e2] bg-white px-3 text-xs font-bold text-[#13222b] outline-none transition focus:border-[#2eb86b] focus:ring-2 focus:ring-[#2eb86b]/20 disabled:opacity-60"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <p className="rounded-xl bg-[#f3f7f5] px-3.5 py-2 text-[11.5px] leading-relaxed text-[#475569]">
                    Shift <strong className="text-[#13222b]">Fleksibel</strong> tidak memiliki jam
                    baku sehingga tidak dikenakan hitungan keterlambatan.
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#edf2f0] bg-[#f7faf9] px-5 py-3">
                  {!isViewer ? (
                    <button
                      type="button"
                      onClick={handleResetShiftDefaults}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-semibold text-[#475569] shadow-xs transition hover:bg-[#e1ebe7] hover:text-[#13222b] cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset Default</span>
                    </button>
                  ) : (
                    <span className="text-xs text-[#64748b]">Mode hanya-baca (Viewer)</span>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShiftModalOpen(false)}
                      className="h-9 rounded-xl bg-white px-4 text-xs font-semibold text-[#13222b] shadow-xs transition hover:bg-[#e1ebe7] cursor-pointer"
                    >
                      Batal
                    </button>
                    {!isViewer && (
                      <button
                        type="submit"
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2eb86b] px-4 text-xs font-semibold text-white transition hover:bg-[#259f5b] cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>Simpan Jam Kerja</span>
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
