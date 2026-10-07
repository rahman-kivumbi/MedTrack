import React, { useState } from 'react';
import { 
  Flame, 
  Calendar as CalendarIcon, 
  Settings as SettingsIcon, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Pill, 
  Droplet, 
  Syringe, 
  Wind, 
  Droplets, 
  Sparkles, 
  Clock, 
  AlertCircle,
  MoreVertical,
  CheckCircle2,
  Undo2,
  Building2,
  ChevronRight
} from 'lucide-react';
import { DoseLog, Medication, MedicationForm, UserSettings, MedicalAppointment } from '../types';
import { 
  getLocalDateString, 
  addDays, 
  formatTime, 
  updateDoseStatus, 
  hasActivityOnDate,
  calculateStreak
} from '../services/storage';
import { notificationService } from '../services/notifications';

interface TodayScreenProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onOpenMonthCalendar: () => void;
  onOpenSettings: () => void;
  onOpenAddModal: () => void;
  doses: DoseLog[];
  onRefreshDoses: () => void;
  streak: number;
  settings: UserSettings;
  appointments?: MedicalAppointment[];
  onNavigateToAppointments?: () => void;
}

export const getMedFormIcon = (form: MedicationForm, className: string = 'w-5 h-5') => {
  switch (form) {
    case 'liquid':
      return <Droplet className={className} />;
    case 'injection':
      return <Syringe className={className} />;
    case 'inhaler':
      return <Wind className={className} />;
    case 'drops':
      return <Droplets className={className} />;
    case 'topical':
    case 'patch':
      return <Sparkles className={className} />;
    case 'pill':
    case 'capsule':
    default:
      return <Pill className={className} />;
  }
};

export const TodayScreen: React.FC<TodayScreenProps> = ({
  selectedDate,
  onSelectDate,
  onOpenMonthCalendar,
  onOpenSettings,
  onOpenAddModal,
  doses,
  onRefreshDoses,
  streak,
  settings,
  appointments = [],
  onNavigateToAppointments,
}) => {
  const [resolvedExpanded, setResolvedExpanded] = useState<boolean>(true);
  const [actionMenuDoseId, setActionMenuDoseId] = useState<string | null>(null);
  const [showStreakModal, setShowStreakModal] = useState<boolean>(false);

  const todayStr = getLocalDateString();
  const isSelectedDateToday = selectedDate === todayStr;

  const dayAppointments = appointments.filter(a => a.date === selectedDate);

  // Generate 7-day horizontal strip around selected date
  // Show 3 days before, selected day, 3 days after (or Mon-Sun)
  const stripDates: string[] = [];
  for (let offset = -3; offset <= 3; offset++) {
    stripDates.push(addDays(selectedDate, offset));
  }

  // Filter pending vs resolved (taken)
  const pendingDoses = doses.filter(d => d.status === 'pending' || d.status === 'missed');
  const resolvedDoses = doses.filter(d => d.status === 'taken' || d.status === 'skipped');

  // Group pending doses by scheduled time
  const pendingByTime = pendingDoses.reduce((acc, dose) => {
    const timeKey = dose.scheduledTime || 'Unscheduled / As Needed';
    if (!acc[timeKey]) acc[timeKey] = [];
    acc[timeKey].push(dose);
    return acc;
  }, {} as Record<string, DoseLog[]>);

  // Group resolved doses by scheduled time
  const resolvedByTime = resolvedDoses.reduce((acc, dose) => {
    const timeKey = dose.scheduledTime || 'As Needed';
    if (!acc[timeKey]) acc[timeKey] = [];
    acc[timeKey].push(dose);
    return acc;
  }, {} as Record<string, DoseLog[]>);

  const handleMarkTaken = (dose: DoseLog) => {
    if (settings.vibrateEnabled) notificationService.vibrate([60]);
    if (settings.soundEnabled) notificationService.playReminderChime();
    updateDoseStatus(dose, 'taken');
    setActionMenuDoseId(null);
    onRefreshDoses();
  };

  const handleMarkSkipped = (dose: DoseLog) => {
    updateDoseStatus(dose, 'skipped');
    setActionMenuDoseId(null);
    onRefreshDoses();
  };

  const handleMarkPending = (dose: DoseLog) => {
    updateDoseStatus(dose, 'pending');
    setActionMenuDoseId(null);
    onRefreshDoses();
  };

  const handleConfirmAllInGroup = (timeGroupDoses: DoseLog[]) => {
    if (settings.vibrateEnabled) notificationService.vibrate([70, 40, 70]);
    if (settings.soundEnabled) notificationService.playReminderChime();
    for (const d of timeGroupDoses) {
      updateDoseStatus(d, 'taken');
    }
    onRefreshDoses();
  };

  const formatDayHeader = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${dayName}, ${monthName}`;
  };

  return (
    <div className="pb-32 w-full max-w-2xl mx-auto px-4 sm:px-6 select-none">
      {/* TOP BAR */}
      <header className="pt-3 pb-2 flex items-center justify-between sticky top-0 bg-[#121212]/95 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black tracking-tight text-white">
            {isSelectedDateToday ? 'Today' : formatDayHeader(selectedDate)}
          </h1>
          {/* Calendar icon button */}
          <button
            onClick={onOpenMonthCalendar}
            className="w-10 h-10 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:scale-95 text-zinc-300 hover:text-white flex items-center justify-center transition border border-zinc-700/40"
            title="Open Month Calendar"
            aria-label="Open Calendar"
          >
            <CalendarIcon className="w-5 h-5 text-blue-400" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Streak Badge */}
          <button
            onClick={() => setShowStreakModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl font-bold text-sm border shadow-sm transition active:scale-95 cursor-pointer ${
              streak > 0
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
                : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-400 hover:bg-zinc-800/90'
            }`}
            title={`${streak} day adherence streak - Tap for details`}
            aria-label={`${streak} day adherence streak`}
          >
            <Flame className={`w-4 h-4 ${streak > 0 ? 'text-amber-400 fill-amber-400 animate-pulse' : 'text-zinc-500'}`} />
            <span>{streak}</span>
          </button>

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:scale-95 text-zinc-300 hover:text-white flex items-center justify-center transition border border-zinc-700/40"
            title="Settings & Privacy"
            aria-label="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* HORIZONTAL 7-DAY STRIP */}
      <section className="py-3">
        <div className="grid grid-cols-7 gap-1.5 bg-zinc-900/60 p-1.5 rounded-2xl border border-zinc-800/60">
          {stripDates.map(dateStr => {
            const [y, m, d] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });
            const dayNum = dateObj.getDate();
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const hasActivity = hasActivityOnDate(dateStr);

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                className={`flex flex-col items-center justify-center py-2 rounded-xl transition duration-150 active:scale-90 ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                    : isToday
                    ? 'bg-zinc-800/90 border border-blue-500/60 text-blue-400 font-bold'
                    : 'text-zinc-300 hover:bg-zinc-800/40'
                }`}
              >
                <span className="text-[10px] uppercase font-semibold opacity-75">{weekday}</span>
                <span className="text-sm font-bold mt-0.5">{dayNum}</span>

                {/* Dot for logged activity */}
                <div className="h-1.5 flex items-center justify-center mt-1">
                  {hasActivity ? (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-white' : isToday ? 'bg-blue-400' : 'bg-emerald-400'
                      }`}
                    />
                  ) : (
                    <span className="w-1.5 h-1.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* HOSPITAL & REFILL VISITS SCHEDULED FOR THIS DAY */}
      {dayAppointments.length > 0 && (
        <section className="mt-2 space-y-2">
          {dayAppointments.map(appt => {
            const refills = appt.medicationRefills || [];
            const finished = refills.filter(r => r.status === 'finished_needs_refill');
            return (
              <div
                key={appt.id}
                onClick={onNavigateToAppointments}
                className="p-4 rounded-3xl bg-gradient-to-r from-blue-950/40 via-[#1C1C1E] to-[#1C1C1E] border border-blue-500/40 shadow-sm cursor-pointer hover:border-blue-400/60 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0 mt-0.5">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-lg bg-blue-600 text-white">
                          Hospital Visit
                        </span>
                        <span className="text-xs text-zinc-400 font-semibold">
                          {formatTime(appt.time || '09:00')}
                        </span>
                        <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                          {appt.reasonType === 'refill' ? 'Medicine Refill' : appt.reasonType === 'checkup' ? 'Checkup' : appt.customReason || appt.reasonType}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white leading-tight">
                        {appt.hospitalOrClinic}
                      </h4>
                      {appt.doctorOrDepartment && (
                        <p className="text-xs text-zinc-300 mt-0.5">
                          {appt.doctorOrDepartment}
                        </p>
                      )}
                      {refills.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[11px] text-zinc-400">
                            {refills.length} medicine{refills.length !== 1 ? 's' : ''} attached:
                          </span>
                          {finished.length > 0 && (
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30">
                              {finished.length} finished / need refill
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-500 shrink-0 mt-2" />
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* PENDING DOSES GROUPED BY TIME */}
      <section className="mt-2 space-y-4">
        {Object.keys(pendingByTime).length === 0 ? (
          <div className="text-center py-10 px-4 bg-zinc-900/40 rounded-3xl border border-zinc-800/50">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white">All tasks caught up</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
              {doses.length === 0
                ? 'No scheduled medications for this day.'
                : 'Great job! All scheduled doses for this day have been confirmed.'}
            </p>
          </div>
        ) : (
          Object.entries(pendingByTime).map(([timeGroup, groupDoses]) => {
            const isMissedTime = groupDoses.some(d => d.status === 'missed');
            return (
              <div
                key={timeGroup}
                className="bg-[#1C1C1E] border border-zinc-800/90 rounded-3xl p-4 shadow-sm"
              >
                {/* Header: Scheduled time + Confirm all button */}
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-800/60">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-zinc-800 text-blue-400 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-base font-bold text-white tracking-wide">
                      {formatTime(timeGroup)}
                    </span>
                    {isMissedTime && (
                      <span className="text-[10px] font-semibold text-rose-400 bg-rose-950/60 border border-rose-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Past Grace
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleConfirmAllInGroup(groupDoses)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-bold transition active:scale-95 border border-blue-500/30"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Confirm all
                  </button>
                </div>

                {/* Dose Rows */}
                <div className="space-y-2">
                  {groupDoses.map(dose => {
                    const isMenuOpen = actionMenuDoseId === dose.id;
                    const isMissed = dose.status === 'missed';

                    return (
                      <div
                        key={dose.id}
                        className="relative flex items-center justify-between p-3 rounded-2xl bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/30 transition group"
                      >
                        {/* Pill Icon + Med Details */}
                        <div
                          className="flex items-center gap-3.5 flex-1 cursor-pointer pr-2"
                          onClick={() => handleMarkTaken(dose)}
                        >
                          <div className="w-11 h-11 rounded-2xl bg-zinc-800 text-blue-400 flex items-center justify-center border border-zinc-700/50 shadow-inner shrink-0">
                            {getMedFormIcon(dose.medicationForm)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-white text-base leading-snug">
                                {dose.medicationName}
                              </h4>
                              {dose.medicationStrength && (
                                <span className="text-xs text-zinc-400 font-medium">
                                  {dose.medicationStrength}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {dose.doseAmount}
                              {isMissed && (
                                <span className="text-rose-400 font-medium ml-2">
                                  (Missed)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Right side: Circular Checkbox + More actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Circular Checkbox (large tap target min 48px) */}
                          <button
                            onClick={() => handleMarkTaken(dose)}
                            className="w-12 h-12 rounded-full border-2 border-zinc-600 hover:border-emerald-500 flex items-center justify-center transition active:scale-90 group/btn bg-zinc-800/30"
                            aria-label={`Mark ${dose.medicationName} taken`}
                          >
                            <Check className="w-6 h-6 text-transparent group-hover/btn:text-emerald-400 transition" />
                          </button>

                          {/* Quick menu toggle */}
                          <button
                            onClick={() => setActionMenuDoseId(isMenuOpen ? null : dose.id)}
                            className="w-8 h-8 rounded-full hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition"
                            aria-label="More options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Floating mini action popup */}
                          {isMenuOpen && (
                            <div className="absolute right-3 top-14 z-20 bg-zinc-900 border border-zinc-700 rounded-2xl p-1.5 shadow-xl min-w-[130px] animate-in fade-in duration-100">
                              <button
                                onClick={() => handleMarkTaken(dose)}
                                className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-zinc-800 rounded-xl flex items-center gap-2"
                              >
                                <Check className="w-3.5 h-3.5" /> Mark Taken
                              </button>
                              <button
                                onClick={() => handleMarkSkipped(dose)}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-amber-400 hover:bg-zinc-800 rounded-xl flex items-center gap-2"
                              >
                                Skip Dose
                              </button>
                              <button
                                onClick={() => {
                                  setActionMenuDoseId(null);
                                  // Snooze 10 min
                                  notificationService.vibrate([40]);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 rounded-xl flex items-center gap-2"
                              >
                                Snooze 10 min
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* RESOLVED TASKS SECTION (Collapsible) */}
      {resolvedDoses.length > 0 && (
        <section className="mt-6">
          <button
            onClick={() => setResolvedExpanded(!resolvedExpanded)}
            className="w-full flex items-center justify-between py-2.5 px-3 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Resolved tasks ({resolvedDoses.length})
              </span>
            </div>
            {resolvedExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {resolvedExpanded && (
            <div className="mt-3 space-y-3">
              {Object.entries(resolvedByTime).map(([timeGroup, groupDoses]) => (
                <div
                  key={timeGroup}
                  className="bg-[#18181B]/70 border border-zinc-800/60 rounded-3xl p-3.5"
                >
                  <div className="text-xs font-semibold text-zinc-500 mb-2 px-1">
                    {formatTime(timeGroup)}
                  </div>
                  <div className="space-y-2">
                    {groupDoses.map(dose => (
                      <div
                        key={dose.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/40 opacity-80"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                            <Check className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="font-medium text-sm text-zinc-300 line-through">
                              {dose.medicationName} {dose.medicationStrength}
                            </h5>
                            <p className="text-[11px] text-zinc-500 line-through">
                              {dose.doseAmount} {dose.status === 'skipped' ? '• Skipped' : '• Taken'}
                            </p>
                          </div>
                        </div>

                        {/* Undo button */}
                        <button
                          onClick={() => handleMarkPending(dose)}
                          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition"
                          title="Undo / Mark pending"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* FLOATING ACTION BUTTON (FAB) */}
      <div className="fixed bottom-20 right-5 z-30">
        <button
          onClick={onOpenAddModal}
          className="w-14 h-14 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-90 text-white shadow-xl shadow-blue-600/35 flex items-center justify-center transition border border-blue-400/30"
          aria-label="Add action"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* STREAK INFO MODAL */}
      {showStreakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center text-zinc-100 shadow-2xl">
            <div className="w-14 h-14 rounded-3xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/10">
              <Flame className="w-8 h-8 fill-amber-400 animate-pulse" />
            </div>

            <h3 className="text-xl font-black text-white">
              {streak} Day{streak !== 1 ? 's' : ''} Streak
            </h3>
            <p className="text-xs text-amber-400/90 font-semibold mt-0.5">
              {streak > 0 ? 'Adherence flame is active!' : 'Start your streak today!'}
            </p>

            <div className="mt-4 p-3 bg-zinc-800/60 rounded-2xl border border-zinc-700/40 text-left text-xs text-zinc-300 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>
                  Counts consecutive days where <strong>every scheduled dose</strong> was marked <strong>taken</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">•</span>
                <span>
                  Days with <strong>no scheduled doses</strong> do not break or extend the streak.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>
                  A missed dose will reset your streak to 0.
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowStreakModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-bold text-xs text-white transition active:scale-95"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
