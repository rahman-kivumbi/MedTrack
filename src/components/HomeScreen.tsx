import React from 'react';
import { 
  Flame, 
  Settings as SettingsIcon, 
  CheckCircle2, 
  Clock, 
  Scale, 
  Pill, 
  Calendar, 
  ChevronRight, 
  Check, 
  Share2, 
  Plus, 
  ShieldCheck, 
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Droplet,
  Sparkles,
  Building2,
  Stethoscope,
  AlertTriangle
} from 'lucide-react';
import { Medication, DoseLog, WeightEntry, UserSettings, MedicalAppointment } from '../types';
import { getLocalDateString, formatTime, updateDoseStatus, addDays } from '../services/storage';
import { getMedFormIcon } from './TodayScreen';
import { notificationService } from '../services/notifications';
import { User } from '../services/firebase';
import { PWAInstallButton } from './PWAInstallButton';

interface HomeScreenProps {
  currentUser: User | null;
  medications: Medication[];
  todayDoses: DoseLog[];
  weightEntries: WeightEntry[];
  appointments?: MedicalAppointment[];
  settings: UserSettings;
  streak: number;
  onNavigateTab: (tab: 'today' | 'progress' | 'treatment') => void;
  onOpenSettings: () => void;
  onOpenAddModal: () => void;
  onOpenAppointmentModal?: (appointment?: MedicalAppointment) => void;
  onNavigateToAppointments?: () => void;
  onRefreshData: () => void;
  onSignInWithGoogle?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentUser,
  medications,
  todayDoses,
  weightEntries,
  appointments = [],
  settings,
  streak,
  onNavigateTab,
  onOpenSettings,
  onOpenAddModal,
  onOpenAppointmentModal,
  onNavigateToAppointments,
  onRefreshData,
  onSignInWithGoogle,
}) => {
  const todayStr = getLocalDateString();

  // Dynamic greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Today's stats
  const scheduledToday = todayDoses.filter(d => !d.isOnDemand);
  const takenToday = scheduledToday.filter(d => d.status === 'taken');
  const pendingToday = scheduledToday.filter(d => d.status === 'pending');
  const missedToday = scheduledToday.filter(d => d.status === 'missed');
  const completionPercent = scheduledToday.length > 0 
    ? Math.round((takenToday.length / scheduledToday.length) * 100) 
    : 100;

  // Next due dose
  const nextPendingDose = pendingToday[0];

  // Upcoming appointments
  const upcomingAppointments = appointments
    .filter(a => a.status === 'scheduled' && a.date >= todayStr)
    .sort((a, b) => `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`));
  const nextAppointment = upcomingAppointments[0];

  // Weight info
  const sortedWeights = [...weightEntries].sort((a, b) => b.timestamp - a.timestamp);
  const latestWeight = sortedWeights[0];
  const targetWeight = settings.targetWeightKg;
  const unit = settings.weightUnit;
  const weightDiff = latestWeight ? (latestWeight.weightKg - targetWeight).toFixed(1) : null;

  // Active medications
  const activeMeds = medications.filter(m => !m.archived);

  // Quick mark next dose taken directly from home card
  const handleQuickTake = (dose: DoseLog) => {
    if (settings.vibrateEnabled) notificationService.vibrate([60]);
    if (settings.soundEnabled) notificationService.playReminderChime();
    updateDoseStatus(dose, 'taken');
    onRefreshData();
  };

  const userName = currentUser?.displayName || currentUser?.email?.split('@')[0];

  return (
    <div className="pb-32 w-full max-w-2xl mx-auto px-4 sm:px-6 select-none">
      {/* Top Header */}
      <header className="pt-3 pb-3 flex items-center justify-between sticky top-0 bg-[#121212]/95 backdrop-blur-md z-30">
        <div>
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
            {getGreeting()}
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {userName ? `Welcome, ${userName.split(' ')[0]}` : 'Home Dashboard'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {currentUser?.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt={userName || 'Account'}
              onClick={onOpenSettings}
              className="w-10 h-10 rounded-2xl border border-zinc-700 cursor-pointer object-cover shadow-sm active:scale-95 transition"
              title={`${userName} (Settings)`}
            />
          ) : (
            <button
              onClick={onOpenSettings}
              className="w-10 h-10 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:scale-95 text-zinc-300 hover:text-white flex items-center justify-center transition border border-zinc-700/40"
              title="Settings & Account"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      <div className="space-y-4 mt-2">
        {/* Android PWA Install Card if not already installed */}
        <PWAInstallButton variant="card" />

        {/* CARD 1: UPPER CARD WITH WELCOME (USER NAME) & STREAK */}
        <div 
          onClick={() => onNavigateTab('today')}
          className="bg-gradient-to-br from-blue-950/40 via-[#1C1C1E] to-[#1C1C1E] border border-blue-500/30 rounded-3xl p-4.5 cursor-pointer hover:border-blue-500/50 transition shadow-lg shadow-blue-950/15"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={userName || 'User'}
                  className="w-13 h-13 rounded-2xl border-2 border-blue-500/40 object-cover shadow-inner shrink-0"
                />
              ) : (
                <div className="w-13 h-13 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-inner shrink-0">
                  <Flame className={`w-7 h-7 fill-amber-400 ${streak > 0 ? 'animate-pulse' : 'opacity-60'}`} />
                </div>
              )}
              <div>
                <h2 className="text-lg font-black text-white leading-tight">
                  {userName ? `Welcome, ${userName}!` : 'Welcome!'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 fill-amber-400" /> {streak} Day Streak
                  </span>
                  <span className="text-zinc-600 text-xs">•</span>
                  <span className="text-xs text-zinc-400 font-medium">
                    {currentUser ? 'Cloud Synced' : 'Local Storage'}
                  </span>
                </div>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-zinc-500 shrink-0" />
          </div>
        </div>

        {/* CARD 2: TODAY'S DOSE SNAPSHOT & NEXT UP */}
        <div className="bg-[#1C1C1E] border border-zinc-800/90 rounded-3xl p-4.5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/70">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-white text-base">Today's Regimen</h3>
            </div>
            <span className="text-xs font-bold text-blue-400 bg-blue-600/15 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
              {takenToday.length} of {scheduledToday.length} Taken
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${scheduledToday.length === 0 ? 100 : completionPercent}%` }}
              />
            </div>
          </div>

          {/* Next pending dose or caught up message */}
          <div className="mt-4">
            {nextPendingDose ? (
              <div className="p-3 bg-zinc-800/60 rounded-2xl border border-zinc-700/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 text-blue-400 flex items-center justify-center border border-zinc-700/50 shrink-0">
                    {getMedFormIcon(nextPendingDose.medicationForm)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-zinc-400 uppercase">
                        Due {formatTime(nextPendingDose.scheduledTime || '')}
                      </span>
                    </div>
                    <h4 className="font-bold text-white text-sm">
                      {nextPendingDose.medicationName} {nextPendingDose.medicationStrength}
                    </h4>
                    <p className="text-[11px] text-zinc-400">{nextPendingDose.doseAmount}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleQuickTake(nextPendingDose)}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 shadow-md shadow-emerald-600/20 transition"
                  title="Mark taken"
                >
                  <Check className="w-3.5 h-3.5" /> Taken
                </button>
              </div>
            ) : scheduledToday.length > 0 ? (
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-2xl flex items-center gap-3 text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="text-xs font-semibold">
                  All scheduled medication doses for today have been confirmed!
                </span>
              </div>
            ) : (
              <div className="p-3 bg-zinc-800/30 rounded-2xl text-xs text-zinc-500 text-center">
                No scheduled medications for today.
              </div>
            )}
          </div>

          {/* Jump to Today screen */}
          <button
            onClick={() => onNavigateTab('today')}
            className="w-full mt-3 py-2 text-center text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1 transition"
          >
            <span>Open Today's Full Schedule</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* CARD 2B: UPCOMING HOSPITAL & MEDICAL APPOINTMENTS */}
        <div className="bg-[#1C1C1E] border border-zinc-800/90 rounded-3xl p-4.5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/70">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-white text-base">Hospital &amp; Refill Visits</h3>
            </div>
            {nextAppointment ? (
              <span className="text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                {upcomingAppointments.length} Scheduled
              </span>
            ) : (
              <button
                onClick={() => onOpenAppointmentModal ? onOpenAppointmentModal() : onNavigateTab('treatment')}
                className="text-xs font-bold text-blue-400 bg-blue-600/15 border border-blue-500/30 px-2.5 py-0.5 rounded-full hover:bg-blue-600/25 transition"
              >
                + Schedule
              </button>
            )}
          </div>

          <div className="mt-3">
            {nextAppointment ? (
              <div 
                onClick={() => onNavigateToAppointments ? onNavigateToAppointments() : onNavigateTab('treatment')}
                className="p-3.5 bg-zinc-800/50 hover:bg-zinc-800/80 rounded-2xl border border-zinc-700/50 cursor-pointer transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white text-[11px] font-extrabold">
                        {nextAppointment.date === todayStr ? 'Today' : nextAppointment.date}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {formatTime(nextAppointment.time || '09:00')}
                      </span>
                      <span className="capitalize text-[11px] font-bold text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded-full border border-blue-500/30">
                        {nextAppointment.reasonType === 'refill' ? 'Medicine Refill' : nextAppointment.reasonType === 'checkup' ? 'Checkup' : nextAppointment.customReason || nextAppointment.reasonType}
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-sm flex items-center gap-1.5 mt-1.5">
                      <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>{nextAppointment.hospitalOrClinic}</span>
                    </h4>

                    {nextAppointment.doctorOrDepartment && (
                      <p className="text-xs text-zinc-300 mt-0.5">
                        {nextAppointment.doctorOrDepartment}
                      </p>
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-zinc-500 mt-1 shrink-0" />
                </div>

                {/* Attached Medicines Preview */}
                {nextAppointment.medicationRefills && nextAppointment.medicationRefills.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-700/40 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                      Medicine Checklist:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {nextAppointment.medicationRefills.map(r => (
                        <span
                          key={r.id}
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-lg border flex items-center gap-1 ${
                            r.status === 'finished_needs_refill'
                              ? 'bg-rose-950/40 text-rose-300 border-rose-500/40'
                              : 'bg-zinc-800 text-emerald-300 border-zinc-700'
                          }`}
                        >
                          <span className={r.status === 'finished_needs_refill' ? 'text-rose-400' : 'text-emerald-400'}>
                            {r.status === 'finished_needs_refill' ? '● Needs Refill:' : '✓ In Stock:'}
                          </span>
                          <span>{r.name} ({r.remainingQuantity ?? 0} left)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-zinc-800/30 rounded-2xl text-xs text-zinc-500 text-center">
                No upcoming hospital visits scheduled.
              </div>
            )}

            <button
              onClick={() => onNavigateToAppointments ? onNavigateToAppointments() : onNavigateTab('treatment')}
              className="w-full mt-3 py-2 text-center text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center justify-center gap-1 transition"
            >
              <span>Manage Hospital Visits &amp; Refills</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* CARD 3: WEIGHT & GOAL CARD */}
        <div 
          onClick={() => onNavigateTab('progress')}
          className="bg-[#1C1C1E] border border-zinc-800/90 rounded-3xl p-4.5 cursor-pointer hover:border-zinc-700 transition shadow-sm"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/70">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Scale className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-white text-base">Weight Progress</h3>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-400">Current Weight</span>
              <div className="text-2xl font-black text-white mt-0.5">
                {latestWeight ? (
                  <span>{latestWeight.weightKg} <span className="text-sm font-normal text-zinc-400">{unit}</span></span>
                ) : (
                  <span className="text-sm text-zinc-500 font-normal">No entry yet</span>
                )}
              </div>
              {latestWeight && (
                <span className="text-[10px] text-zinc-500">
                  Last recorded: {latestWeight.date}
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="text-xs text-zinc-400">Target Goal</span>
              <div className="text-lg font-bold text-purple-400 mt-0.5">
                {targetWeight} {unit}
              </div>
              {weightDiff && (
                <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1 justify-end">
                  {Number(weightDiff) > 0 ? (
                    <span className="text-amber-400">+{weightDiff} {unit} to target</span>
                  ) : Number(weightDiff) < 0 ? (
                    <span className="text-emerald-400">{weightDiff} {unit} past target</span>
                  ) : (
                    <span className="text-emerald-400">Target reached!</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CARD 4: ACTIVE MEDICATIONS SUMMARY */}
        <div 
          onClick={() => onNavigateTab('treatment')}
          className="bg-[#1C1C1E] border border-zinc-800/90 rounded-3xl p-4.5 cursor-pointer hover:border-zinc-700 transition shadow-sm"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/70">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Pill className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-white text-base">Active Medications</h3>
            </div>
            <span className="text-xs font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
              {activeMeds.length} Total
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {activeMeds.length === 0 ? (
              <p className="text-xs text-zinc-500 py-2 text-center">
                No active medications configured.
              </p>
            ) : (
              activeMeds.slice(0, 3).map(med => (
                <div 
                  key={med.id}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-800/40 border border-zinc-800"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-zinc-800 text-blue-400 flex items-center justify-center shrink-0">
                      {getMedFormIcon(med.form, 'w-4 h-4')}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {med.name} {med.strength}
                      </h4>
                      <p className="text-[10px] text-zinc-400">
                        {med.dosePerIntake} • <span className="capitalize">{med.form}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-lg">
                    {med.scheduleType === 'as_needed' ? 'On Demand' : 'Scheduled'}
                  </span>
                </div>
              ))
            )}

            {activeMeds.length > 3 && (
              <p className="text-[11px] text-center text-zinc-500 pt-1">
                +{activeMeds.length - 3} more medications in Treatment
              </p>
            )}
          </div>
        </div>

        {/* CARD 5: QUICK ACTIONS TILES */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 px-1">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={onOpenAddModal}
              className="p-3.5 bg-zinc-900/80 hover:bg-zinc-800 active:scale-[0.98] border border-zinc-800 rounded-2xl text-left transition"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center mb-2">
                <Plus className="w-4 h-4" />
              </div>
              <span className="font-bold text-white text-xs block">Log Dose or Weight</span>
              <span className="text-[10px] text-zinc-400">Record an intake now</span>
            </button>

            <button
              onClick={() => onNavigateTab('progress')}
              className="p-3.5 bg-zinc-900/80 hover:bg-zinc-800 active:scale-[0.98] border border-zinc-800 rounded-2xl text-left transition"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center mb-2">
                <Share2 className="w-4 h-4" />
              </div>
              <span className="font-bold text-white text-xs block">Doctor Summary</span>
              <span className="text-[10px] text-zinc-400">Export report PDF</span>
            </button>
          </div>
        </div>

        {/* CARD 6: SAFETY & PRIVACY NOTICE */}
        <div className="p-4 bg-zinc-900/50 rounded-3xl border border-zinc-800/70 text-xs text-zinc-400 space-y-1.5">
          <div className="flex items-center gap-1.5 text-zinc-300 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>100% On-Device Privacy</span>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-400">
            MedTrack stores all your logs strictly on your device. Backups are encrypted with your chosen passphrase.
          </p>
        </div>
      </div>
    </div>
  );
};
