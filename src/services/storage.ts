import { Medication, DoseLog, WeightEntry, UserSettings, MedicalAppointment } from '../types';

const STORAGE_KEYS = {
  MEDICATIONS: 'medtrack_medications_v1',
  DOSE_LOGS: 'medtrack_dose_logs_v1',
  WEIGHT: 'medtrack_weight_entries_v1',
  APPOINTMENTS: 'medtrack_appointments_v1',
  SETTINGS: 'medtrack_settings_v1',
  FIRST_LAUNCH: 'medtrack_first_launch_v1',
};

export const DEFAULT_SETTINGS: UserSettings = {
  targetWeightKg: 70.0,
  weightUnit: 'kg',
  gracePeriodMinutes: 120, // 2 hours
  notificationsEnabled: true,
  soundEnabled: true,
  vibrateEnabled: true,
  appLockEnabled: false,
  biometricsEnabled: false,
  hideInRecentApps: true,
  hasSeenBatteryOptimizationTip: false,
};

// Date utilities (in local time YYYY-MM-DD)
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (isNaN(hours) || isNaN(minutes)) return timeStr;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

// Storage Accessors
export function getStoredMedications(): Medication[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEDICATIONS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read medications', e);
    return [];
  }
}

export function saveStoredMedications(medications: Medication[]): void {
  localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(medications));
}

export function getStoredDoseLogs(): DoseLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DOSE_LOGS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read dose logs', e);
    return [];
  }
}

export function saveStoredDoseLogs(logs: DoseLog[]): void {
  localStorage.setItem(STORAGE_KEYS.DOSE_LOGS, JSON.stringify(logs));
}

export function getStoredWeightEntries(): WeightEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WEIGHT);
    const entries: WeightEntry[] = raw ? JSON.parse(raw) : [];
    return entries.sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    console.error('Failed to read weights', e);
    return [];
  }
}

export function saveStoredWeightEntries(entries: WeightEntry[]): void {
  localStorage.setItem(STORAGE_KEYS.WEIGHT, JSON.stringify(entries));
}

// Medical Appointments Accessors
export function getStoredAppointments(): MedicalAppointment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    const appointments: MedicalAppointment[] = raw ? JSON.parse(raw) : [];
    return appointments.sort((a, b) => {
      // Sort by date then time ascending
      const dtA = `${a.date}T${a.time || '00:00'}`;
      const dtB = `${b.date}T${b.time || '00:00'}`;
      return dtA.localeCompare(dtB);
    });
  } catch (e) {
    console.error('Failed to read appointments', e);
    return [];
  }
}

export function saveStoredAppointments(appointments: MedicalAppointment[]): void {
  localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
}

export function saveAppointment(appointment: MedicalAppointment): void {
  const current = getStoredAppointments();
  const existingIdx = current.findIndex(a => a.id === appointment.id);
  if (existingIdx >= 0) {
    current[existingIdx] = appointment;
  } else {
    current.push(appointment);
  }
  saveStoredAppointments(current);
}

export function deleteAppointment(appointmentId: string): void {
  const current = getStoredAppointments();
  const filtered = current.filter(a => a.id !== appointmentId);
  saveStoredAppointments(filtered);
}

export function getStoredSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch (e) {
    console.error('Failed to read settings', e);
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(settings: UserSettings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

// Medication Schedule Calculation
export function isMedicationScheduledOnDate(med: Medication, dateStr: string): boolean {
  if (med.scheduleType === 'as_needed') return false;
  
  if (dateStr < med.startDate) return false;
  if (med.endDate && dateStr > med.endDate) return false;

  const [y, m, d] = dateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  const dayOfWeek = targetDate.getDay(); // 0 is Sunday, 1 is Monday...

  if (med.scheduleType === 'every_day') {
    return true;
  }

  if (med.scheduleType === 'specific_days') {
    return (med.weekdays || []).includes(dayOfWeek);
  }

  if (med.scheduleType === 'every_n_days') {
    const interval = med.intervalDays || 1;
    const anchor = med.intervalAnchorDate || med.startDate;
    const [ay, am, ad] = anchor.split('-').map(Number);
    const anchorDate = new Date(ay, am - 1, ad);
    const diffMs = targetDate.getTime() - anchorDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % interval === 0;
  }

  return false;
}

// Generate expected doses for a given date, incorporating logged states and grace period
export function getDosesForDate(dateStr: string, gracePeriodMinutes: number = 120): DoseLog[] {
  const medications = getStoredMedications();
  const existingLogs = getStoredDoseLogs();
  const dateLogsMap = new Map<string, DoseLog>();

  // Filter logs for this specific date
  for (const log of existingLogs) {
    if (log.date === dateStr) {
      dateLogsMap.set(log.id, log);
    }
  }

  const result: DoseLog[] = [];
  const now = new Date();
  const todayStr = getLocalDateString(now);
  const [currentY, currentM, currentD] = dateStr.split('-').map(Number);

  // Active or previously active scheduled medications
  for (const med of medications) {
    // If med is archived, only show if logs already exist for this date or start date was valid
    if (med.archived) {
      // If there's already a log for this med today, include it
      const hasLogsToday = Array.from(dateLogsMap.values()).some(l => l.medicationId === med.id);
      if (!hasLogsToday) continue;
    }

    if (isMedicationScheduledOnDate(med, dateStr)) {
      for (const time of med.scheduledTimes) {
        const id = `${med.id}_${dateStr}_${time}`;
        const existing = dateLogsMap.get(id);

        if (existing) {
          result.push(existing);
        } else {
          // Compute status based on grace period
          // Slot datetime
          const [th, tm] = time.split(':').map(Number);
          const slotDateTime = new Date(currentY, currentM - 1, currentD, th, tm, 0);
          const graceExpiration = new Date(slotDateTime.getTime() + gracePeriodMinutes * 60 * 1000);

          let initialStatus: DoseLog['status'] = 'pending';
          if (now > graceExpiration) {
            initialStatus = 'missed';
          }

          result.push({
            id,
            medicationId: med.id,
            medicationName: med.name,
            medicationStrength: med.strength,
            medicationForm: med.form,
            doseAmount: med.dosePerIntake,
            date: dateStr,
            scheduledTime: time,
            status: initialStatus,
            isOnDemand: false,
          });
        }
      }
    }
  }

  // Also include any on-demand doses logged on this date
  for (const log of dateLogsMap.values()) {
    if (log.isOnDemand && !result.some(r => r.id === log.id)) {
      result.push(log);
    }
  }

  // Sort by time
  return result.sort((a, b) => {
    const timeA = a.scheduledTime || a.actualTime || '99:99';
    const timeB = b.scheduledTime || b.actualTime || '99:99';
    return timeA.localeCompare(timeB);
  });
}

// Update or set a dose status
export function updateDoseStatus(logToUpdate: DoseLog, newStatus: DoseLog['status']): void {
  const existingLogs = getStoredDoseLogs();
  const index = existingLogs.findIndex(l => l.id === logToUpdate.id);
  const now = new Date().toISOString();

  const updated: DoseLog = {
    ...logToUpdate,
    status: newStatus,
    actualTime: newStatus === 'taken' ? now : (logToUpdate.actualTime || now),
  };

  if (index >= 0) {
    existingLogs[index] = updated;
  } else {
    existingLogs.push(updated);
  }

  saveStoredDoseLogs(existingLogs);
}

// Calculate streak: consecutive days where every scheduled dose was marked taken
// Days with no scheduled doses do not break or extend the streak
export function calculateStreak(gracePeriodMinutes: number = 120): number {
  const medications = getStoredMedications();
  const logs = getStoredDoseLogs();
  
  // If there are no medications and no logs, streak is 0
  if (medications.length === 0 && logs.length === 0) {
    return 0;
  }

  const todayStr = getLocalDateString();
  let streak = 0;
  let checkDate = todayStr;

  // Find the earliest start date among all medications to know when to stop looking back
  const earliestMedDate = medications.reduce((min, m) => {
    return !min || m.startDate < min ? m.startDate : min;
  }, todayStr);

  // First, check today's status
  const todayDoses = getDosesForDate(todayStr, gracePeriodMinutes).filter(d => !d.isOnDemand);
  if (todayDoses.length > 0) {
    const allTakenToday = todayDoses.every(d => d.status === 'taken');
    const hasMissedOrSkippedToday = todayDoses.some(d => d.status === 'missed' || d.status === 'skipped');
    
    if (allTakenToday) {
      streak += 1;
    } else if (hasMissedOrSkippedToday) {
      // Missed or skipped today -> streak is broken
      return 0;
    }
    // If today is still pending with no missed doses, the active streak from yesterday carries over
  }

  // Now scan backwards from yesterday
  checkDate = addDays(todayStr, -1);
  for (let i = 0; i < 365; i++) {
    // If we've scanned earlier than any medication start date and there are no logs for this date or earlier, stop
    if (checkDate < earliestMedDate) {
      const hasOlderLogs = logs.some(l => l.date <= checkDate && !l.isOnDemand);
      if (!hasOlderLogs) {
        break;
      }
    }

    const doses = getDosesForDate(checkDate, gracePeriodMinutes).filter(d => !d.isOnDemand);
    
    if (doses.length === 0) {
      // Days with no scheduled doses do not break or extend the streak
      checkDate = addDays(checkDate, -1);
      continue;
    }

    const allTaken = doses.every(d => d.status === 'taken');
    if (allTaken) {
      streak += 1;
      checkDate = addDays(checkDate, -1);
    } else {
      // A missed or skipped scheduled dose found, streak ends here
      break;
    }
  }

  return streak;
}

// Activity indicator for a date (dot on calendar strip)
export function hasActivityOnDate(dateStr: string): boolean {
  const logs = getStoredDoseLogs();
  const hasLogs = logs.some(l => l.date === dateStr && (l.status === 'taken' || l.status === 'skipped'));
  const weights = getStoredWeightEntries();
  const hasWeight = weights.some(w => w.date === dateStr);
  return hasLogs || hasWeight;
}

// Encrypted Backup using Web Crypto API (AES-GCM 256 + PBKDF2)
export async function createEncryptedBackup(passphrase: string): Promise<string> {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    medications: getStoredMedications(),
    doseLogs: getStoredDoseLogs(),
    weightEntries: getStoredWeightEntries(),
    appointments: getStoredAppointments(),
    settings: getStoredSettings(),
  };

  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(data))
  );

  const envelope = {
    v: 1,
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  };

  return JSON.stringify(envelope);
}

export async function restoreEncryptedBackup(backupJson: string, passphrase: string): Promise<void> {
  const envelope = JSON.parse(backupJson);
  if (!envelope.salt || !envelope.iv || !envelope.data) {
    throw new Error('Invalid backup file format');
  }

  const salt = new Uint8Array(envelope.salt);
  const iv = new Uint8Array(envelope.iv);
  const ciphertext = new Uint8Array(envelope.data);

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    const dec = new TextDecoder();
    const payload = JSON.parse(dec.decode(decrypted));

    if (payload.medications) saveStoredMedications(payload.medications);
    if (payload.doseLogs) saveStoredDoseLogs(payload.doseLogs);
    if (payload.weightEntries) saveStoredWeightEntries(payload.weightEntries);
    if (payload.appointments) saveStoredAppointments(payload.appointments);
    if (payload.settings) saveStoredSettings(payload.settings);
  } catch (err) {
    throw new Error('Incorrect passphrase or corrupted backup file');
  }
}

// Sample Data Generator
export function loadSampleData(): void {
  const today = getLocalDateString();
  const sampleMedications: Medication[] = [
    {
      id: 'med-1',
      name: 'Lisinopril',
      strength: '10mg',
      form: 'pill',
      dosePerIntake: '1 pill(s)',
      scheduleType: 'every_day',
      scheduledTimes: ['08:00'],
      startDate: addDays(today, -30),
      notes: 'Take in morning with water. Blood pressure medication.',
      archived: false,
      createdAt: Date.now() - 30 * 86400000,
      updatedAt: Date.now() - 30 * 86400000,
    },
    {
      id: 'med-2',
      name: 'Metformin',
      strength: '500mg',
      form: 'pill',
      dosePerIntake: '1 pill(s)',
      scheduleType: 'every_day',
      scheduledTimes: ['08:00', '20:00'],
      startDate: addDays(today, -20),
      notes: 'Take with food to minimize GI discomfort.',
      archived: false,
      createdAt: Date.now() - 20 * 86400000,
      updatedAt: Date.now() - 20 * 86400000,
    },
    {
      id: 'med-3',
      name: 'Vitamin D3',
      strength: '2000 IU',
      form: 'capsule',
      dosePerIntake: '1 capsule(s)',
      scheduleType: 'every_day',
      scheduledTimes: ['12:00'],
      startDate: addDays(today, -15),
      notes: 'Take with lunch.',
      archived: false,
      createdAt: Date.now() - 15 * 86400000,
      updatedAt: Date.now() - 15 * 86400000,
    },
    {
      id: 'med-4',
      name: 'Ibuprofen',
      strength: '400mg',
      form: 'pill',
      dosePerIntake: '1 pill(s)',
      scheduleType: 'as_needed',
      scheduledTimes: [],
      startDate: addDays(today, -25),
      notes: 'Take as needed for tension headaches.',
      archived: false,
      createdAt: Date.now() - 25 * 86400000,
      updatedAt: Date.now() - 25 * 86400000,
    },
  ];

  // Generate logs for past 10 days
  const sampleLogs: DoseLog[] = [];
  for (let i = 10; i >= 0; i--) {
    const dStr = addDays(today, -i);
    // Lisinopril: taken all 10 days (except 8 days ago missed)
    const lisStatus = i === 8 ? 'missed' : 'taken';
    sampleLogs.push({
      id: `med-1_${dStr}_08:00`,
      medicationId: 'med-1',
      medicationName: 'Lisinopril',
      medicationStrength: '10mg',
      medicationForm: 'pill',
      doseAmount: '1 pill(s)',
      date: dStr,
      scheduledTime: '08:00',
      actualTime: lisStatus === 'taken' ? `${dStr}T08:15:00.000Z` : undefined,
      status: i === 0 ? 'taken' : (lisStatus as DoseLog['status']),
      isOnDemand: false,
    });

    // Metformin 08:00
    const metMorningStatus = i === 7 ? 'skipped' : 'taken';
    sampleLogs.push({
      id: `med-2_${dStr}_08:00`,
      medicationId: 'med-2',
      medicationName: 'Metformin',
      medicationStrength: '500mg',
      medicationForm: 'pill',
      doseAmount: '1 pill(s)',
      date: dStr,
      scheduledTime: '08:00',
      actualTime: `${dStr}T08:20:00.000Z`,
      status: i === 0 ? 'taken' : (metMorningStatus as DoseLog['status']),
      isOnDemand: false,
    });

    // Metformin 20:00
    sampleLogs.push({
      id: `med-2_${dStr}_20:00`,
      medicationId: 'med-2',
      medicationName: 'Metformin',
      medicationStrength: '500mg',
      medicationForm: 'pill',
      doseAmount: '1 pill(s)',
      date: dStr,
      scheduledTime: '20:00',
      actualTime: i === 0 ? undefined : `${dStr}T20:10:00.000Z`,
      status: i === 0 ? 'pending' : 'taken',
      isOnDemand: false,
    });

    // Vitamin D3
    sampleLogs.push({
      id: `med-3_${dStr}_12:00`,
      medicationId: 'med-3',
      medicationName: 'Vitamin D3',
      medicationStrength: '2000 IU',
      medicationForm: 'capsule',
      doseAmount: '1 capsule(s)',
      date: dStr,
      scheduledTime: '12:00',
      actualTime: `${dStr}T12:30:00.000Z`,
      status: 'taken',
      isOnDemand: false,
    });
  }

  // Add 2 on-demand Ibuprofen logs
  sampleLogs.push({
    id: `ondemand-1`,
    medicationId: 'med-4',
    medicationName: 'Ibuprofen',
    medicationStrength: '400mg',
    medicationForm: 'pill',
    doseAmount: '1 pill(s)',
    date: addDays(today, -3),
    scheduledTime: undefined,
    actualTime: `${addDays(today, -3)}T15:30:00.000Z`,
    status: 'taken',
    isOnDemand: true,
    notes: 'Afternoon mild headache',
  });
  sampleLogs.push({
    id: `ondemand-2`,
    medicationId: 'med-4',
    medicationName: 'Ibuprofen',
    medicationStrength: '400mg',
    medicationForm: 'pill',
    doseAmount: '1 pill(s)',
    date: today,
    scheduledTime: undefined,
    actualTime: `${today}T10:15:00.000Z`,
    status: 'taken',
    isOnDemand: true,
    notes: 'Back ache',
  });

  // Sample weight entries (tracking down towards 70kg target)
  const sampleWeights: WeightEntry[] = [
    { id: 'w-1', weightKg: 73.8, date: addDays(today, -14), time: '07:30', timestamp: Date.now() - 14 * 86400000 },
    { id: 'w-2', weightKg: 73.4, date: addDays(today, -11), time: '07:45', timestamp: Date.now() - 11 * 86400000 },
    { id: 'w-3', weightKg: 73.1, date: addDays(today, -8), time: '07:20', timestamp: Date.now() - 8 * 86400000 },
    { id: 'w-4', weightKg: 72.7, date: addDays(today, -6), time: '08:00', timestamp: Date.now() - 6 * 86400000 },
    { id: 'w-5', weightKg: 72.3, date: addDays(today, -4), time: '07:30', timestamp: Date.now() - 4 * 86400000 },
    { id: 'w-6', weightKg: 72.0, date: addDays(today, -2), time: '07:40', timestamp: Date.now() - 2 * 86400000 },
    { id: 'w-7', weightKg: 71.8, date: today, time: '07:35', timestamp: Date.now() },
  ];

  // Sample medical appointments
  const sampleAppointments: MedicalAppointment[] = [
    {
      id: 'appt-1',
      hospitalOrClinic: 'St. Mary General Hospital',
      doctorOrDepartment: 'Dr. Robert Evans • Cardiology Clinic',
      date: addDays(today, 4),
      time: '10:30',
      reasonType: 'refill',
      notes: 'Bring current medication list and fasting blood sugar diary.',
      status: 'scheduled',
      medicationRefills: [
        {
          id: 'refill-item-1',
          medicationId: 'med-2',
          name: 'Metformin',
          strength: '500mg',
          form: 'pill',
          status: 'finished_needs_refill',
          remainingQuantity: 0,
          quantityNeeded: 60,
          unit: 'pills',
          notes: 'Finished 2 days ago. Need 2-month refill prescription.',
        },
        {
          id: 'refill-item-2',
          medicationId: 'med-1',
          name: 'Lisinopril',
          strength: '10mg',
          form: 'pill',
          status: 'still_taking',
          remainingQuantity: 8,
          quantityNeeded: 30,
          unit: 'pills',
          notes: '8 pills remaining. Running low by next week.',
        },
        {
          id: 'refill-item-3',
          medicationId: 'med-3',
          name: 'Vitamin D3',
          strength: '2000 IU',
          form: 'capsule',
          status: 'still_taking',
          remainingQuantity: 24,
          quantityNeeded: 0,
          unit: 'capsules',
          notes: 'Still have 24 capsules left, sufficient supply.',
        },
      ],
      createdAt: Date.now() - 3 * 86400000,
      updatedAt: Date.now() - 3 * 86400000,
    },
    {
      id: 'appt-2',
      hospitalOrClinic: 'City Health Medical Center',
      doctorOrDepartment: 'General OPD Checkup',
      date: addDays(today, 18),
      time: '14:00',
      reasonType: 'checkup',
      notes: 'Annual routine health checkup and blood pressure monitoring.',
      status: 'scheduled',
      medicationRefills: [],
      createdAt: Date.now() - 5 * 86400000,
      updatedAt: Date.now() - 5 * 86400000,
    },
  ];

  saveStoredMedications(sampleMedications);
  saveStoredDoseLogs(sampleLogs);
  saveStoredWeightEntries(sampleWeights);
  saveStoredAppointments(sampleAppointments);
  const currentSettings = getStoredSettings();
  saveStoredSettings({
    ...currentSettings,
    targetWeightKg: 70.0,
  });
}
