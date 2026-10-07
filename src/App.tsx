/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  getStoredMedications, 
  getStoredDoseLogs, 
  getStoredWeightEntries, 
  getStoredSettings, 
  getDosesForDate, 
  calculateStreak, 
  getLocalDateString,
  updateDoseStatus,
  formatTime,
  loadSampleData,
  getStoredAppointments,
  saveAppointment,
  deleteAppointment
} from './services/storage';
import { notificationService } from './services/notifications';
import { auth, signInWithGoogle, signOutUser, onAuthStateChanged, User } from './services/firebase';
import { syncUserDataWithCloud, syncSingleAppointment, deleteSingleAppointment } from './services/sync';
import { Medication, DoseLog, WeightEntry, UserSettings, MedicalAppointment } from './types';
import { Navigation, TabType } from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { TodayScreen } from './components/TodayScreen';
import { ProgressScreen } from './components/ProgressScreen';
import { TreatmentScreen } from './components/TreatmentScreen';
import { MonthCalendarModal } from './components/MonthCalendarModal';
import { SettingsModal } from './components/SettingsModal';
import { AddActionModal } from './components/AddActionModal';
import { AppLockModal } from './components/AppLockModal';
import { Bell, Check, Clock } from 'lucide-react';

export default function App() {
  // Navigation & Date (HOME is 1st on the left)
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());

  // User Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Data State
  const [medications, setMedications] = useState<Medication[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [appointments, setAppointments] = useState<MedicalAppointment[]>([]);
  const [settings, setSettings] = useState<UserSettings>(getStoredSettings());
  const [streak, setStreak] = useState<number>(0);

  // Modals & Panels
  const [isMonthCalendarOpen, setIsMonthCalendarOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isAddActionModalOpen, setIsAddActionModalOpen] = useState<boolean>(false);
  const [openCreateMedDirectly, setOpenCreateMedDirectly] = useState<boolean>(false);
  const [treatmentSubTab, setTreatmentSubTab] = useState<'medications' | 'appointments'>('medications');
  const [openCreateAppointmentDirectly, setOpenCreateAppointmentDirectly] = useState<boolean>(false);

  // App Lock & Privacy Veil
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    const s = getStoredSettings();
    return !!s.appLockEnabled && !!s.appLockPin;
  });
  const [isPrivacyVeilActive, setIsPrivacyVeilActive] = useState<boolean>(false);

  // Active In-App Reminder Alert
  const [dueReminderDose, setDueReminderDose] = useState<DoseLog | null>(null);

  // Reload all data from local storage
  const reloadData = useCallback(() => {
    const s = getStoredSettings();
    const meds = getStoredMedications();
    const logs = getStoredDoseLogs();
    const weights = getStoredWeightEntries();
    const appts = getStoredAppointments();
    setSettings(s);
    setMedications(meds);
    setDoseLogs(logs);
    setWeightEntries(weights);
    setAppointments(appts);
    setStreak(calculateStreak(s.gracePeriodMinutes));
  }, []);

  // Handlers for Medical Appointments
  const handleSaveAppointment = (appointment: MedicalAppointment) => {
    saveAppointment(appointment);
    if (currentUser) {
      syncSingleAppointment(currentUser.uid, appointment).catch(console.warn);
    }
    reloadData();
  };

  const handleDeleteAppointment = (id: string) => {
    deleteAppointment(id);
    if (currentUser) {
      deleteSingleAppointment(currentUser.uid, id).catch(console.warn);
    }
    reloadData();
  };

  const handleToggleAppointmentStatus = (appointment: MedicalAppointment) => {
    const updated: MedicalAppointment = {
      ...appointment,
      status: appointment.status === 'completed' ? 'scheduled' : 'completed',
      updatedAt: Date.now(),
    };
    saveAppointment(updated);
    if (currentUser) {
      syncSingleAppointment(currentUser.uid, updated).catch(console.warn);
    }
    reloadData();
  };

  // Initial load
  useEffect(() => {
    // If brand new storage, auto-load sample data for immediate testability
    const meds = getStoredMedications();
    if (meds.length === 0) {
      loadSampleData();
    }
    reloadData();
  }, [reloadData]);

  // Firebase Auth State Listener & Auto-Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      setCurrentUser(user);
      if (user) {
        try {
          await syncUserDataWithCloud(user);
          reloadData();
        } catch (err) {
          console.warn('Background cloud sync warning', err);
        }
      }
    });
    return () => unsubscribe();
  }, [reloadData]);

  const handleSignInGoogle = async () => {
    const user = await signInWithGoogle();
    setCurrentUser(user);
    await syncUserDataWithCloud(user);
    reloadData();
  };

  const handleSignOutUser = async () => {
    await signOutUser();
    setCurrentUser(null);
  };

  const handleManualCloudSync = async () => {
    if (currentUser) {
      await syncUserDataWithCloud(currentUser);
      reloadData();
    }
  };

  // Privacy veil on tab blur / recent apps
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (settings.hideInRecentApps) {
          setIsPrivacyVeilActive(true);
        }
        if (settings.appLockEnabled && settings.appLockPin) {
          setIsAppLocked(true);
        }
      } else {
        setIsPrivacyVeilActive(false);
      }
    };

    const handleWindowBlur = () => {
      if (settings.hideInRecentApps) {
        setIsPrivacyVeilActive(true);
      }
    };

    const handleWindowFocus = () => {
      setIsPrivacyVeilActive(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [settings.hideInRecentApps, settings.appLockEnabled]);

  // Real-time reminder watcher (runs every 30 seconds)
  useEffect(() => {
    if (!settings.notificationsEnabled) return;

    const checkReminders = () => {
      const now = new Date();
      const todayStr = getLocalDateString(now);
      const currentHoursMinutes = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const todayDoses = getDosesForDate(todayStr, settings.gracePeriodMinutes);
      // Find doses that match current time or were snoozed until now and are pending
      const dueDose = todayDoses.find(d => {
        if (d.status !== 'pending') return false;
        if (d.snoozedUntil && Date.now() >= d.snoozedUntil) return true;
        return d.scheduledTime === currentHoursMinutes;
      });

      if (dueDose && (!dueReminderDose || dueReminderDose.id !== dueDose.id)) {
        setDueReminderDose(dueDose);
        notificationService.sendDoseNotification(
          dueDose.medicationName,
          dueDose.doseAmount,
          dueDose.scheduledTime || currentHoursMinutes,
          () => {
            updateDoseStatus(dueDose, 'taken');
            reloadData();
            setDueReminderDose(null);
          }
        );
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 30000);
    return () => clearInterval(interval);
  }, [settings.notificationsEnabled, settings.gracePeriodMinutes, dueReminderDose, reloadData]);

  // Get doses for current selected date on Today screen
  const todayDoses = getDosesForDate(selectedDate, settings.gracePeriodMinutes);
  const pendingCountToday = todayDoses.filter(d => d.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#121212] text-[#E1E2E6] flex flex-col font-sans relative selection:bg-blue-600 selection:text-white">
      {/* Privacy Veil when switching apps in Recent Apps */}
      {isPrivacyVeilActive && (
        <div className="fixed inset-0 z-[200] bg-[#121212] flex items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 text-blue-400 flex items-center justify-center animate-pulse">
            <span className="font-bold text-lg">M</span>
          </div>
        </div>
      )}

      {/* App Lock PIN / Biometric Modal */}
      <AppLockModal
        isLocked={isAppLocked && settings.appLockEnabled && !!settings.appLockPin}
        storedPin={settings.appLockPin}
        biometricsEnabled={settings.biometricsEnabled}
        onUnlock={() => setIsAppLocked(false)}
      />

      {/* In-App Reminder Banner for Due Dose */}
      {dueReminderDose && (
        <div className="fixed top-3 left-4 right-4 z-50 max-w-xl mx-auto bg-blue-600 text-white rounded-3xl p-4 shadow-2xl border border-blue-400/40 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h4 className="font-bold text-base leading-tight">
                  Time for {dueReminderDose.medicationName}
                </h4>
                <p className="text-xs text-blue-100 mt-0.5">
                  Dose: {dueReminderDose.doseAmount} at {formatTime(dueReminderDose.scheduledTime || '')}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-blue-500/50">
            <button
              onClick={() => {
                updateDoseStatus(dueReminderDose, 'taken');
                notificationService.vibrate([60]);
                setDueReminderDose(null);
                reloadData();
              }}
              className="py-2 rounded-xl bg-white text-blue-600 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
            >
              <Check className="w-4 h-4" /> Taken
            </button>
            <button
              onClick={() => {
                // Snooze 10 min
                dueReminderDose.snoozedUntil = Date.now() + 10 * 60 * 1000;
                setDueReminderDose(null);
                notificationService.vibrate([40]);
              }}
              className="py-2 rounded-xl bg-blue-700/80 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
            >
              <Clock className="w-4 h-4" /> Snooze 10 min
            </button>
          </div>
        </div>
      )}

      {/* MAIN SCREEN ROUTER */}
      <main className="flex-1 overflow-x-hidden">
        {activeTab === 'home' && (
          <HomeScreen
            currentUser={currentUser}
            medications={medications}
            todayDoses={todayDoses}
            weightEntries={weightEntries}
            appointments={appointments}
            settings={settings}
            streak={streak}
            onNavigateTab={tab => setActiveTab(tab)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenAddModal={() => setIsAddActionModalOpen(true)}
            onOpenAppointmentModal={() => {
              setActiveTab('treatment');
              setTreatmentSubTab('appointments');
              setOpenCreateAppointmentDirectly(true);
            }}
            onNavigateToAppointments={() => {
              setActiveTab('treatment');
              setTreatmentSubTab('appointments');
            }}
            onRefreshData={reloadData}
            onSignInWithGoogle={handleSignInGoogle}
          />
        )}

        {activeTab === 'today' && (
          <TodayScreen
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onOpenMonthCalendar={() => setIsMonthCalendarOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenAddModal={() => setIsAddActionModalOpen(true)}
            doses={todayDoses}
            onRefreshDoses={reloadData}
            streak={streak}
            settings={settings}
            appointments={appointments}
            onNavigateToAppointments={() => {
              setActiveTab('treatment');
              setTreatmentSubTab('appointments');
            }}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressScreen
            medications={medications}
            doseLogs={doseLogs}
            weightEntries={weightEntries}
            settings={settings}
            onRefreshData={reloadData}
          />
        )}

        {activeTab === 'treatment' && (
          <TreatmentScreen
            medications={medications}
            onRefreshMedications={reloadData}
            openCreateModalDirectly={openCreateMedDirectly}
            onCloseDirectModal={() => setOpenCreateMedDirectly(false)}
            appointments={appointments}
            onSaveAppointment={handleSaveAppointment}
            onDeleteAppointment={handleDeleteAppointment}
            onToggleAppointmentStatus={handleToggleAppointmentStatus}
            initialSubTab={treatmentSubTab}
            openCreateAppointmentDirectly={openCreateAppointmentDirectly}
            onCloseDirectAppointmentModal={() => setOpenCreateAppointmentDirectly(false)}
          />
        )}
      </main>

      {/* BOTTOM NAVIGATION */}
      <Navigation
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        pendingCount={pendingCountToday}
      />

      {/* MODALS */}
      <MonthCalendarModal
        isOpen={isMonthCalendarOpen}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onClose={() => setIsMonthCalendarOpen(false)}
        appointments={appointments}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        currentUser={currentUser}
        onSignInWithGoogle={handleSignInGoogle}
        onSignOut={handleSignOutUser}
        onSyncCloud={handleManualCloudSync}
        onSettingsUpdated={newSettings => {
          setSettings(newSettings);
          if (!newSettings.appLockEnabled || !newSettings.appLockPin) {
            setIsAppLocked(false);
          }
          reloadData();
        }}
        onDataReloaded={reloadData}
      />

      <AddActionModal
        isOpen={isAddActionModalOpen}
        onClose={() => setIsAddActionModalOpen(false)}
        medications={medications}
        onOpenAddMedication={() => {
          setActiveTab('treatment');
          setTreatmentSubTab('medications');
          setOpenCreateMedDirectly(true);
        }}
        onOpenAddAppointment={() => {
          setActiveTab('treatment');
          setTreatmentSubTab('appointments');
          setOpenCreateAppointmentDirectly(true);
        }}
        onDoseLogged={reloadData}
        onWeightLogged={reloadData}
        weightUnit={settings.weightUnit}
      />
    </div>
  );
}
