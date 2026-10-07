import React, { useState } from 'react';
import { 
  X, 
  Shield, 
  Lock, 
  Bell, 
  Volume2, 
  Vibrate, 
  BatteryCharging, 
  Download, 
  Upload, 
  Database, 
  AlertTriangle, 
  CheckCircle2, 
  Scale, 
  Clock,
  Sparkles,
  Info,
  Smartphone
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { UserSettings } from '../types';
import { 
  saveStoredSettings, 
  createEncryptedBackup, 
  restoreEncryptedBackup, 
  loadSampleData 
} from '../services/storage';
import { notificationService } from '../services/notifications';
import { User } from '../services/firebase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  currentUser: User | null;
  onSignInWithGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSyncCloud: () => Promise<void>;
  onSettingsUpdated: (newSettings: UserSettings) => void;
  onDataReloaded: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  currentUser,
  onSignInWithGoogle,
  onSignOut,
  onSyncCloud,
  onSettingsUpdated,
  onDataReloaded,
}) => {
  // Cloud sync loading state
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // App Lock Pin Setup
  const [isPinSetupOpen, setIsPinSetupOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Backup Passphrase Dialog
  const [backupAction, setBackupAction] = useState<'export' | 'restore' | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [backupFileContent, setBackupFileContent] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  // Battery Tip dialog
  const [showBatteryTip, setShowBatteryTip] = useState(false);
  const [pinStatusFeedback, setPinStatusFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    setSyncFeedback(null);
    try {
      await onSignInWithGoogle();
      setSyncFeedback('Signed in successfully! Data synced.');
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch (err: unknown) {
      setSyncFeedback((err as Error)?.message || 'Sign in failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    setIsAuthLoading(true);
    try {
      await onSignOut();
      setSyncFeedback('Signed out.');
      setTimeout(() => setSyncFeedback(null), 2500);
    } catch (err: unknown) {
      setSyncFeedback((err as Error)?.message || 'Sign out failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await onSyncCloud();
      setSyncFeedback('Cloud sync complete!');
      setTimeout(() => setSyncFeedback(null), 2500);
    } catch (err: unknown) {
      setSyncFeedback('Sync failed: ' + ((err as Error)?.message || 'Network error'));
    } finally {
      setIsSyncing(false);
    }
  };

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const updated = { ...settings, [key]: value };
    saveStoredSettings(updated);
    onSettingsUpdated(updated);
  };

  const handleTestNotification = async () => {
    const granted = await notificationService.requestNotificationPermission();
    notificationService.playReminderChime();
    notificationService.vibrate([100, 50, 100]);

    if (granted) {
      await notificationService.sendDoseNotification(
        'Test Medication',
        '1 pill(s)',
        'Now'
      );
    }
  };

  const handleToggleAppLock = () => {
    if (settings.appLockEnabled && settings.appLockPin) {
      // Atomically disable PIN and clear PIN value
      const updated: UserSettings = {
        ...settings,
        appLockEnabled: false,
        appLockPin: '',
      };
      saveStoredSettings(updated);
      onSettingsUpdated(updated);
      setPinStatusFeedback('PIN protection has been disabled.');
      setTimeout(() => setPinStatusFeedback(null), 3000);
    } else {
      // Open PIN setup
      setNewPin('');
      setConfirmPin('');
      setPinError('');
      setIsPinSetupOpen(true);
    }
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4) {
      setPinError('PIN must be 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match.');
      return;
    }

    const updated: UserSettings = {
      ...settings,
      appLockEnabled: true,
      appLockPin: newPin,
    };
    saveStoredSettings(updated);
    onSettingsUpdated(updated);
    setIsPinSetupOpen(false);
    setPinStatusFeedback('PIN has been enabled!');
    setTimeout(() => setPinStatusFeedback(null), 3000);
  };

  const handleExportBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;

    try {
      const encryptedData = await createEncryptedBackup(passphrase);
      const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medtrack_backup_${new Date().toISOString().substring(0, 10)}.medbackup`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      setBackupStatus('Backup exported and saved successfully!');
      setTimeout(() => {
        setBackupAction(null);
        setPassphrase('');
        setBackupStatus(null);
      }, 2000);
    } catch (err) {
      setBackupStatus('Export failed: ' + (err as Error).message);
    }
  };

  const handleFileSelectForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = evt => {
        setBackupFileContent(evt.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleRestoreBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupFileContent || !passphrase) return;

    try {
      await restoreEncryptedBackup(backupFileContent, passphrase);
      setBackupStatus('Data restored successfully!');
      onDataReloaded();
      setTimeout(() => {
        setBackupAction(null);
        setPassphrase('');
        setBackupFileContent(null);
        setBackupStatus(null);
      }, 1500);
    } catch (err) {
      setBackupStatus('Restore failed: Incorrect passphrase or damaged file.');
    }
  };

  const handleLoadSampleData = () => {
    if (confirm('Load sample medications, doses, and weight records to test the app?')) {
      loadSampleData();
      onDataReloaded();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div className="w-full sm:max-w-xl bg-[#1C1C1E] border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <h3 className="text-lg font-bold text-white">Settings & Privacy</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-6">
          {/* SECTION: ANDROID APP & INSTALLATION */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
              Android Application
            </h4>
            <PWAInstallButton variant="card" />
          </div>

          {/* SECTION: GOOGLE ACCOUNT & CLOUD DATABASE SYNC */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Google Account & Cloud Sync
            </h4>
            <div className="bg-zinc-900/80 p-4 rounded-3xl border border-zinc-800/90 shadow-sm space-y-3">
              {currentUser ? (
                <div>
                  <div className="flex items-center gap-3">
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt={currentUser.displayName || 'Profile'}
                        className="w-12 h-12 rounded-2xl border border-blue-500/30 object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-lg">
                        {currentUser.displayName ? currentUser.displayName[0] : 'U'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-white text-sm truncate">
                          {currentUser.displayName || 'User'}
                        </h5>
                        <span className="w-2 h-2 rounded-full bg-emerald-400" title="Connected" />
                      </div>
                      <p className="text-xs text-zinc-400 truncate">{currentUser.email}</p>
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Synced with Cloud
                      </span>
                    </div>
                  </div>

                  {syncFeedback && (
                    <div className="mt-2.5 p-2 bg-blue-950/40 border border-blue-800/40 rounded-xl text-xs text-blue-300 text-center font-medium">
                      {syncFeedback}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-zinc-800/80">
                    <button
                      type="button"
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="py-2.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-blue-500/30 transition active:scale-95 disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGoogleSignOut}
                      disabled={isAuthLoading}
                      className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl flex items-center justify-center transition active:scale-95 disabled:opacity-50"
                    >
                      Log Out
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                    Sign in with your Google account to automatically back up and synchronize all your medications, dose logs, and weight trends across all your devices.
                  </p>

                  {syncFeedback && (
                    <div className="mb-3 p-2 bg-rose-950/40 border border-rose-800/40 rounded-xl text-xs text-rose-300 text-center font-medium">
                      {syncFeedback}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isAuthLoading}
                    className="w-full py-3 bg-white hover:bg-zinc-100 text-zinc-900 rounded-2xl font-bold text-xs flex items-center justify-center gap-2.5 shadow-md active:scale-95 transition disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{isAuthLoading ? 'Connecting...' : 'Sign In with Google'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* SECTION: DOSE GRACE PERIOD */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Missed Dose Grace Period
            </h4>
            <div className="bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800/80">
              <p className="text-xs text-zinc-400 mb-3">
                A pending dose automatically marks as "Missed" after this time has elapsed past scheduled intake.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { mins: 30, label: '30 mins' },
                  { mins: 60, label: '1 hour' },
                  { mins: 120, label: '2 hours (Def)' },
                  { mins: 240, label: '4 hours' },
                  { mins: 480, label: '8 hours' },
                  { mins: 1440, label: 'End of Day' },
                ].map(opt => (
                  <button
                    key={opt.mins}
                    type="button"
                    onClick={() => updateSetting('gracePeriodMinutes', opt.mins)}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold border transition text-center ${
                      settings.gracePeriodMinutes === opt.mins
                        ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                        : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION: UNITS */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-purple-400" />
              Weight Unit
            </h4>
            <div className="flex bg-zinc-900/60 p-1.5 rounded-2xl border border-zinc-800/80">
              <button
                type="button"
                onClick={() => updateSetting('weightUnit', 'kg')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                  settings.weightUnit === 'kg' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400'
                }`}
              >
                Kilograms (kg)
              </button>
              <button
                type="button"
                onClick={() => updateSetting('weightUnit', 'lbs')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                  settings.weightUnit === 'lbs' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400'
                }`}
              >
                Pounds (lbs)
              </button>
            </div>
          </div>

          {/* SECTION: REMINDERS & ALARMS */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-blue-400" />
              Reminders & Notifications
            </h4>
            <div className="bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-white">Enable Notifications</span>
                  <p className="text-xs text-zinc-400">Scheduled time alerts on device</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notificationsEnabled}
                  onChange={e => {
                    updateSetting('notificationsEnabled', e.target.checked);
                    if (e.target.checked) notificationService.requestNotificationPermission();
                  }}
                  className="w-5 h-5 accent-blue-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <span className="text-xs font-medium text-zinc-300">Play Audio Chime</span>
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={e => updateSetting('soundEnabled', e.target.checked)}
                  className="w-5 h-5 accent-blue-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <span className="text-xs font-medium text-zinc-300">Vibration Feedback</span>
                <input
                  type="checkbox"
                  checked={settings.vibrateEnabled}
                  onChange={e => updateSetting('vibrateEnabled', e.target.checked)}
                  className="w-5 h-5 accent-blue-600 rounded"
                />
              </div>

              <div className="pt-2 border-t border-zinc-800 flex gap-2">
                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-blue-400 rounded-xl"
                >
                  Test Reminder Now
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatteryTip(true)}
                  className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 rounded-xl flex items-center gap-1"
                >
                  <BatteryCharging className="w-3.5 h-3.5 text-amber-400" /> Exact Alarms Tip
                </button>
              </div>
            </div>
          </div>

          {/* SECTION: APP LOCK & PRIVACY */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Privacy & Security
            </h4>
            <div className="bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-white">App Lock (4-digit PIN)</span>
                  <p className="text-xs text-zinc-400">
                    {settings.appLockEnabled && settings.appLockPin
                      ? 'PIN lock is active'
                      : 'Protects app when opened'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {settings.appLockEnabled && settings.appLockPin && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewPin('');
                        setConfirmPin('');
                        setPinError('');
                        setIsPinSetupOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                    >
                      Change
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleAppLock}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                      settings.appLockEnabled && settings.appLockPin
                        ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {settings.appLockEnabled && settings.appLockPin ? 'Disable PIN' : 'Set PIN'}
                  </button>
                </div>
              </div>

              {pinStatusFeedback && (
                <div className="p-2 bg-blue-950/40 border border-blue-800/40 rounded-xl text-xs text-blue-300 text-center font-medium animate-in fade-in">
                  {pinStatusFeedback}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <div>
                  <span className="text-xs font-medium text-zinc-300">Hide in Recent Apps</span>
                  <p className="text-[11px] text-zinc-500">Blurs screen when multitasking</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.hideInRecentApps}
                  onChange={e => updateSetting('hideInRecentApps', e.target.checked)}
                  className="w-5 h-5 accent-blue-600 rounded"
                />
              </div>
            </div>
          </div>

          {/* SECTION: ENCRYPTED BACKUP & RESTORE */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              Offline Encrypted Backup
            </h4>
            <div className="bg-zinc-900/60 p-3.5 rounded-2xl border border-zinc-800/80 space-y-3">
              <p className="text-xs text-zinc-400 leading-relaxed">
                All data is stored exclusively on your phone. Backups are AES-256 encrypted using your custom passphrase.
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPassphrase('');
                    setBackupAction('export');
                  }}
                  className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" /> Export Backup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPassphrase('');
                    setBackupFileContent(null);
                    setBackupAction('restore');
                  }}
                  className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" /> Restore Backup
                </button>
              </div>
            </div>
          </div>

          {/* SECTION: SAMPLE DATA LOADER */}
          <div>
            <div className="bg-zinc-900/40 p-3.5 rounded-2xl border border-zinc-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Load Sample Data
                </span>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Populate realistic meds, logs, and weight for testing
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoadSampleData}
                className="px-3 py-1.5 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 rounded-xl text-xs font-bold transition"
              >
                Load Sample
              </button>
            </div>
          </div>

          {/* MEDICAL DISCLAIMER */}
          <div className="p-3.5 bg-zinc-900/80 rounded-2xl border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
            <span className="font-bold text-zinc-300 block mb-1">Medical Disclaimer</span>
            MedTrack only records the information you enter. It does not provide medical advice, diagnosis, dosage recommendations, or interaction warnings. Always consult a healthcare professional regarding medications.
          </div>

          {/* FOOTER */}
          <footer className="mt-8 pt-6 pb-2 border-t border-zinc-800/80 text-center select-none">
            <div className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-sm">
              <span className="text-xs sm:text-sm font-medium tracking-wide text-zinc-300 font-sans">
                &copy; Made with <span className="text-rose-500 inline-block animate-pulse text-sm">❤️</span> from <span className="text-white font-bold tracking-tight">Abraki Tech</span>.
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-zinc-500 mt-2 font-mono tracking-wider uppercase">
              MedTrack &bull; Offline &amp; Android Ready
            </p>
          </footer>
        </div>
      </div>

      {/* PIN SETUP SUB-MODAL */}
      {isPinSetupOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <form onSubmit={handleSavePin} className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Set 4-Digit PIN</h3>
            <p className="text-xs text-zinc-400 mt-1 mb-4">Choose a PIN to protect your records</p>

            {pinError && <p className="text-xs text-rose-400 mb-3">{pinError}</p>}

            <div className="space-y-3">
              <input
                type="password"
                maxLength={4}
                placeholder="4-digit PIN"
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                autoFocus
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-center text-xl tracking-widest text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <input
                type="password"
                maxLength={4}
                placeholder="Confirm 4-digit PIN"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-center text-xl tracking-widest text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                type="button"
                onClick={() => setIsPinSetupOpen(false)}
                className="py-2.5 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white"
              >
                Save PIN
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BACKUP EXPORT / RESTORE SUB-MODAL */}
      {backupAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <form
            onSubmit={backupAction === 'export' ? handleExportBackup : handleRestoreBackup}
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6"
          >
            <h3 className="text-base font-bold text-white">
              {backupAction === 'export' ? 'Export Encrypted Backup' : 'Restore Backup File'}
            </h3>

            {/* Warning about lost passphrase */}
            <div className="my-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> A lost passphrase cannot be recovered under any circumstance.
              </span>
            </div>

            {backupAction === 'restore' && (
              <div className="mb-3">
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Select .medbackup file
                </label>
                <input
                  type="file"
                  accept=".medbackup,.json"
                  onChange={handleFileSelectForRestore}
                  required
                  className="w-full text-xs text-zinc-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Enter Passphrase
              </label>
              <input
                type="password"
                placeholder="Passphrase"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                required
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {backupStatus && (
              <p className="text-xs text-zinc-300 mt-2 font-medium">{backupStatus}</p>
            )}

            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                type="button"
                onClick={() => setBackupAction(null)}
                className="py-2.5 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white"
              >
                {backupAction === 'export' ? 'Download Backup' : 'Restore Data'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BATTERY OPTIMIZATION TIP MODAL */}
      {showBatteryTip && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <BatteryCharging className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Reliable Alarms on Android</h3>
            <p className="text-xs text-zinc-300 mt-2 text-left leading-relaxed">
              To ensure scheduled medication reminders fire at exact times even when your phone is locked or asleep:
            </p>
            <div className="text-xs text-zinc-400 text-left mt-3 space-y-1.5 bg-zinc-800/60 p-3 rounded-xl">
              <p>1. Open Android <strong>Settings</strong> &gt; <strong>Apps</strong> &gt; <strong>MedTrack</strong>.</p>
              <p>2. Tap <strong>Battery</strong> and select <strong>Unrestricted</strong> (turn off battery optimization).</p>
              <p>3. Ensure <strong>Allow Alarms &amp; Reminders</strong> is enabled.</p>
            </div>
            <button
              onClick={() => setShowBatteryTip(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
