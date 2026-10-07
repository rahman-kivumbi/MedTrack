export type MedicationForm = 
  | 'pill' 
  | 'capsule' 
  | 'liquid' 
  | 'injection' 
  | 'inhaler' 
  | 'drops' 
  | 'patch' 
  | 'topical' 
  | 'other';

export type ScheduleType = 
  | 'every_day' 
  | 'specific_days' 
  | 'every_n_days' 
  | 'as_needed';

export type DoseStatus = 'pending' | 'taken' | 'missed' | 'skipped';

export interface Medication {
  id: string;
  name: string;
  strength: string; // e.g. "20mg", "500mg"
  form: MedicationForm;
  dosePerIntake: string; // e.g. "1 pill(s)", "10 ml"
  scheduleType: ScheduleType;
  // Specific days: 0 = Sun, 1 = Mon, ..., 6 = Sat
  weekdays?: number[];
  // Every N days
  intervalDays?: number;
  intervalAnchorDate?: string; // YYYY-MM-DD
  // Times of day in HH:mm format, e.g. ["08:00", "20:00"]
  scheduledTimes: string[];
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  notes?: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DoseLog {
  id: string; // composite e.g. `${medicationId}_${date}_${scheduledTime}` or uuid for on-demand
  medicationId: string;
  medicationName: string;
  medicationStrength: string;
  medicationForm: MedicationForm;
  doseAmount: string;
  date: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:mm (empty if on demand)
  actualTime?: string; // ISO string when logged
  status: DoseStatus;
  isOnDemand?: boolean;
  notes?: string;
  snoozedUntil?: number; // timestamp
}

export interface WeightEntry {
  id: string;
  weightKg: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  timestamp: number;
  notes?: string;
}

export interface UserSettings {
  targetWeightKg: number;
  weightUnit: 'kg' | 'lbs';
  gracePeriodMinutes: number; // default 120 (2 hours)
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  appLockEnabled: boolean;
  appLockPin?: string; // hashed or stored locally
  biometricsEnabled: boolean;
  hideInRecentApps: boolean;
  hasSeenBatteryOptimizationTip: boolean;
}

export interface DayActivity {
  date: string; // YYYY-MM-DD
  hasActivity: boolean;
  allTaken: boolean;
  scheduledCount: number;
  takenCount: number;
  missedCount: number;
}

export type AppointmentReasonType = 
  | 'checkup' 
  | 'refill' 
  | 'follow_up' 
  | 'specialist' 
  | 'lab_test' 
  | 'custom';

export interface AppointmentMedRefillItem {
  id: string;
  medicationId?: string;
  name: string;
  strength?: string;
  form?: MedicationForm;
  status: 'finished_needs_refill' | 'still_taking';
  remainingQuantity?: number;
  quantityNeeded?: number;
  unit?: string;
  notes?: string;
}

export interface MedicalAppointment {
  id: string;
  userId?: string;
  hospitalOrClinic: string;
  doctorOrDepartment?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  reasonType: AppointmentReasonType;
  customReason?: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  medicationRefills: AppointmentMedRefillItem[];
  createdAt: number;
  updatedAt: number;
}

