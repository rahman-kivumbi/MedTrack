import React, { useState } from 'react';
import { 
  Plus, 
  Pill, 
  Clock, 
  Calendar, 
  Archive, 
  RotateCcw, 
  Trash2, 
  Edit3, 
  X, 
  AlertTriangle,
  Check,
  ChevronRight,
  Info,
  Building2
} from 'lucide-react';
import { Medication, MedicationForm, ScheduleType, MedicalAppointment } from '../types';
import { getMedFormIcon } from './TodayScreen';
import { getLocalDateString, formatTime, saveStoredMedications } from '../services/storage';
import { AppointmentsSection } from './AppointmentsSection';
import { AppointmentModal } from './AppointmentModal';

interface TreatmentScreenProps {
  medications: Medication[];
  onRefreshMedications: () => void;
  openCreateModalDirectly?: boolean;
  onCloseDirectModal?: () => void;
  appointments?: MedicalAppointment[];
  onSaveAppointment?: (appointment: MedicalAppointment) => void;
  onDeleteAppointment?: (id: string) => void;
  onToggleAppointmentStatus?: (appointment: MedicalAppointment) => void;
  initialSubTab?: 'medications' | 'appointments';
  openCreateAppointmentDirectly?: boolean;
  onCloseDirectAppointmentModal?: () => void;
}

const FORM_OPTIONS: { id: MedicationForm; label: string }[] = [
  { id: 'pill', label: 'Pill' },
  { id: 'capsule', label: 'Capsule' },
  { id: 'liquid', label: 'Liquid' },
  { id: 'injection', label: 'Injection' },
  { id: 'inhaler', label: 'Inhaler' },
  { id: 'drops', label: 'Drops' },
  { id: 'patch', label: 'Patch' },
  { id: 'topical', label: 'Topical' },
  { id: 'other', label: 'Other' },
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const TreatmentScreen: React.FC<TreatmentScreenProps> = ({
  medications,
  onRefreshMedications,
  openCreateModalDirectly = false,
  onCloseDirectModal,
  appointments = [],
  onSaveAppointment,
  onDeleteAppointment,
  onToggleAppointmentStatus,
  initialSubTab = 'medications',
  openCreateAppointmentDirectly = false,
  onCloseDirectAppointmentModal,
}) => {
  const [subTab, setSubTab] = useState<'medications' | 'appointments'>(initialSubTab);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState<boolean>(false);
  const [editingAppointment, setEditingAppointment] = useState<MedicalAppointment | null>(null);

  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(openCreateModalDirectly);
  const [deleteConfirmMed, setDeleteConfirmMed] = useState<Medication | null>(null);

  React.useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  React.useEffect(() => {
    if (openCreateAppointmentDirectly) {
      setSubTab('appointments');
      setEditingAppointment(null);
      setIsAppointmentModalOpen(true);
      if (onCloseDirectAppointmentModal) onCloseDirectAppointmentModal();
    }
  }, [openCreateAppointmentDirectly]);

  // Form Fields
  const [name, setName] = useState<string>('');
  const [strength, setStrength] = useState<string>('');
  const [form, setForm] = useState<MedicationForm>('pill');
  const [dosePerIntake, setDosePerIntake] = useState<string>('1 pill(s)');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('every_day');
  const [scheduledTimes, setScheduledTimes] = useState<string[]>(['08:00']);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  const [intervalDays, setIntervalDays] = useState<number>(2);
  const [startDate, setStartDate] = useState<string>(getLocalDateString());
  const [endDate, setEndDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Handle opening modal directly from external call (e.g. Today FAB)
  React.useEffect(() => {
    if (openCreateModalDirectly) {
      handleOpenCreate();
      if (onCloseDirectModal) onCloseDirectModal();
    }
  }, [openCreateModalDirectly]);

  const handleOpenCreate = () => {
    setEditingMedication(null);
    setName('');
    setStrength('');
    setForm('pill');
    setDosePerIntake('1 pill(s)');
    setScheduleType('every_day');
    setScheduledTimes(['08:00']);
    setWeekdays([1, 2, 3, 4, 5]);
    setIntervalDays(2);
    setStartDate(getLocalDateString());
    setEndDate('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (med: Medication) => {
    setEditingMedication(med);
    setName(med.name);
    setStrength(med.strength);
    setForm(med.form);
    setDosePerIntake(med.dosePerIntake);
    setScheduleType(med.scheduleType);
    setScheduledTimes(med.scheduledTimes.length > 0 ? [...med.scheduledTimes] : ['08:00']);
    setWeekdays(med.weekdays ? [...med.weekdays] : [1, 2, 3, 4, 5]);
    setIntervalDays(med.intervalDays || 2);
    setStartDate(med.startDate);
    setEndDate(med.endDate || '');
    setNotes(med.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const allMeds = [...medications];
    const now = Date.now();

    if (editingMedication) {
      // Rule: Editing schedule must never change past history.
      // We update the medication object definition. Past doseLogs remain intact as recorded.
      const index = allMeds.findIndex(m => m.id === editingMedication.id);
      if (index >= 0) {
        allMeds[index] = {
          ...editingMedication,
          name: name.trim(),
          strength: strength.trim(),
          form,
          dosePerIntake: dosePerIntake.trim(),
          scheduleType,
          scheduledTimes: scheduleType === 'as_needed' ? [] : scheduledTimes.filter(Boolean).sort(),
          weekdays: scheduleType === 'specific_days' ? weekdays.sort() : undefined,
          intervalDays: scheduleType === 'every_n_days' ? Number(intervalDays) : undefined,
          startDate,
          endDate: endDate ? endDate : undefined,
          notes: notes.trim() || undefined,
          updatedAt: now,
        };
      }
    } else {
      const newMed: Medication = {
        id: `med_${now}`,
        name: name.trim(),
        strength: strength.trim(),
        form,
        dosePerIntake: dosePerIntake.trim(),
        scheduleType,
        scheduledTimes: scheduleType === 'as_needed' ? [] : scheduledTimes.filter(Boolean).sort(),
        weekdays: scheduleType === 'specific_days' ? weekdays.sort() : undefined,
        intervalDays: scheduleType === 'every_n_days' ? Number(intervalDays) : undefined,
        startDate,
        endDate: endDate ? endDate : undefined,
        notes: notes.trim() || undefined,
        archived: false,
        createdAt: now,
        updatedAt: now,
      };
      allMeds.push(newMed);
    }

    saveStoredMedications(allMeds);
    onRefreshMedications();
    setIsModalOpen(false);
  };

  const handleToggleArchive = (med: Medication) => {
    const allMeds = [...medications];
    const index = allMeds.findIndex(m => m.id === med.id);
    if (index >= 0) {
      allMeds[index] = {
        ...med,
        archived: !med.archived,
        updatedAt: Date.now(),
      };
      saveStoredMedications(allMeds);
      onRefreshMedications();
    }
  };

  const handleDeleteMedication = () => {
    if (!deleteConfirmMed) return;
    const allMeds = medications.filter(m => m.id !== deleteConfirmMed.id);
    saveStoredMedications(allMeds);
    setDeleteConfirmMed(null);
    onRefreshMedications();
  };

  const handleAddTimeSlot = () => {
    setScheduledTimes(prev => [...prev, '12:00']);
  };

  const handleRemoveTimeSlot = (idx: number) => {
    setScheduledTimes(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateTimeSlot = (idx: number, val: string) => {
    setScheduledTimes(prev => {
      const updated = [...prev];
      updated[idx] = val;
      return updated;
    });
  };

  const handleToggleWeekday = (dayIndex: number) => {
    setWeekdays(prev => {
      if (prev.includes(dayIndex)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(d => d !== dayIndex);
      } else {
        return [...prev, dayIndex];
      }
    });
  };

  const activeMedications = medications.filter(m => !m.archived);
  const archivedMedications = medications.filter(m => m.archived);

  return (
    <div className="pb-32 w-full max-w-2xl mx-auto px-4 sm:px-6 select-none">
      {/* Top Header */}
      <header className="pt-3 pb-3 flex items-center justify-between sticky top-0 bg-[#121212]/95 backdrop-blur-md z-30">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {subTab === 'medications' ? 'Treatment' : 'Hospital Visits'}
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {subTab === 'medications'
              ? `${activeMedications.length} active medication${activeMedications.length !== 1 ? 's' : ''}`
              : `${appointments.length} hospital & refill appointment${appointments.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {subTab === 'medications' ? (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Med</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setEditingAppointment(null);
              setIsAppointmentModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Visit</span>
          </button>
        )}
      </header>

      {/* SEGMENTED TAB SWITCH: MEDICATIONS vs HOSPITAL APPOINTMENTS */}
      <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800 mb-4 mt-2">
        <button
          onClick={() => setSubTab('medications')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            subTab === 'medications' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Pill className="w-4 h-4" />
          <span>Medications ({activeMedications.length})</span>
        </button>
        <button
          onClick={() => setSubTab('appointments')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            subTab === 'appointments' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-400" />
          <span>Hospital Visits &amp; Refills ({appointments.length})</span>
        </button>
      </div>

      {/* TAB 1: MEDICATIONS VIEW */}
      {subTab === 'medications' && (
        <>
          {/* Active Medications List */}
          <div className="space-y-3 mt-2">
        {activeMedications.length === 0 ? (
          <div className="text-center py-12 px-4 bg-zinc-900/40 rounded-3xl border border-zinc-800/60">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 text-zinc-400 mx-auto flex items-center justify-center mb-3">
              <Pill className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">No active medications</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
              Tap "Add Med" to record your prescriptions, vitamins, or on-demand medications.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-blue-600/20 text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-600/30 transition"
            >
              + Create First Medication
            </button>
          </div>
        ) : (
          activeMedications.map(med => (
            <div
              key={med.id}
              className="bg-[#1C1C1E] border border-zinc-800/90 rounded-3xl p-4 shadow-sm hover:border-zinc-700 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-800 text-blue-400 flex items-center justify-center border border-zinc-700/50 shrink-0">
                    {getMedFormIcon(med.form)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white leading-tight">
                        {med.name}
                      </h3>
                      {med.strength && (
                        <span className="text-xs text-zinc-400 font-medium">
                          {med.strength}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {med.dosePerIntake} • <span className="capitalize">{med.form}</span>
                    </p>
                  </div>
                </div>

                {/* Edit & Archive Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(med)}
                    className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                    title="Edit Medication"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleArchive(med)}
                    className="p-2 rounded-xl text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition"
                    title="Archive Medication"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmMed(med)}
                    className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
                    title="Delete Medication"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Schedule Details Badge */}
              <div className="mt-3 pt-3 border-t border-zinc-800/60 flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    {med.scheduleType === 'as_needed'
                      ? 'As needed (On Demand)'
                      : med.scheduleType === 'every_day'
                      ? `Daily at ${med.scheduledTimes.map(formatTime).join(', ')}`
                      : med.scheduleType === 'specific_days'
                      ? `${(med.weekdays || []).map(d => WEEKDAY_NAMES[d]).join(', ')} at ${med.scheduledTimes.map(formatTime).join(', ')}`
                      : `Every ${med.intervalDays} days at ${med.scheduledTimes.map(formatTime).join(', ')}`}
                  </span>
                </div>

                {med.notes && (
                  <span className="text-[11px] text-zinc-500 italic truncate max-w-[200px]">
                    "{med.notes}"
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ARCHIVED SECTION */}
      {archivedMedications.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="w-full flex items-center justify-between py-2.5 px-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition"
          >
            <span>Archived Medications ({archivedMedications.length})</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${showArchived ? 'rotate-90' : ''}`} />
          </button>

          {showArchived && (
            <div className="space-y-3 mt-3">
              {archivedMedications.map(med => (
                <div
                  key={med.id}
                  className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-4 opacity-75"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-300">
                        {med.name} {med.strength}
                      </h4>
                      <p className="text-xs text-zinc-500">
                        Archived • Past logs preserved in adherence history
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleArchive(med)}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-800 text-blue-400 hover:bg-zinc-700 text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>
                      <button
                        onClick={() => setDeleteConfirmMed(med)}
                        className="p-1.5 text-zinc-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
        </>
      )}

      {/* TAB 2: HOSPITAL APPOINTMENTS & REFILLS VIEW */}
      {subTab === 'appointments' && (
        <AppointmentsSection
          appointments={appointments}
          onOpenCreate={() => {
            setEditingAppointment(null);
            setIsAppointmentModalOpen(true);
          }}
          onOpenEdit={(appt) => {
            setEditingAppointment(appt);
            setIsAppointmentModalOpen(true);
          }}
          onDelete={(id) => {
            if (onDeleteAppointment) onDeleteAppointment(id);
          }}
          onToggleStatus={(appt) => {
            if (onToggleAppointmentStatus) onToggleAppointmentStatus(appt);
          }}
        />
      )}

      {/* ADD / EDIT MEDICATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
          <div className="w-full sm:max-w-xl bg-[#1C1C1E] border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-lg font-bold text-white">
                {editingMedication ? 'Edit Medication' : 'Add Medication'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMedication} className="mt-4 space-y-4">
              {/* Name & Strength */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    Medication Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Lisinopril"
                    required
                    autoFocus
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    Strength
                  </label>
                  <input
                    type="text"
                    value={strength}
                    onChange={e => setStrength(e.target.value)}
                    placeholder="e.g. 10mg"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Form & Dose per intake */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    Form
                  </label>
                  <select
                    value={form}
                    onChange={e => {
                      const f = e.target.value as MedicationForm;
                      setForm(f);
                      if (!dosePerIntake || dosePerIntake === '1 pill(s)') {
                        if (f === 'liquid') setDosePerIntake('5 ml');
                        else if (f === 'drops') setDosePerIntake('2 drops');
                        else if (f === 'inhaler') setDosePerIntake('2 puffs');
                        else setDosePerIntake(`1 ${f}(s)`);
                      }
                    }}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500 capitalize"
                  >
                    {FORM_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    Dose per intake
                  </label>
                  <input
                    type="text"
                    value={dosePerIntake}
                    onChange={e => setDosePerIntake(e.target.value)}
                    placeholder="e.g. 1 pill(s)"
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Schedule Type */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  Schedule
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'every_day', label: 'Every Day' },
                    { id: 'specific_days', label: 'Specific Weekdays' },
                    { id: 'every_n_days', label: 'Every N Days' },
                    { id: 'as_needed', label: 'On Demand (PRN)' },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setScheduleType(item.id as ScheduleType)}
                      className={`p-2.5 rounded-xl text-xs font-semibold border text-center transition ${
                        scheduleType === item.id
                          ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                          : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weekday selector if specific_days */}
              {scheduleType === 'specific_days' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Select Days
                  </label>
                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAY_NAMES.map((name, idx) => {
                      const isSelected = weekdays.includes(idx);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => handleToggleWeekday(idx)}
                          className={`h-9 rounded-xl text-xs font-bold transition ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Interval Days if every_n_days */}
              {scheduleType === 'every_n_days' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    Repeat every how many days?
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="2"
                      max="90"
                      value={intervalDays}
                      onChange={e => setIntervalDays(Math.max(2, parseInt(e.target.value) || 2))}
                      className="w-24 bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-sm text-zinc-400">days (e.g. Every 2 days)</span>
                  </div>
                </div>
              )}

              {/* Times of Day (if not as_needed) */}
              {scheduleType !== 'as_needed' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Scheduled Intake Times
                    </label>
                    <button
                      type="button"
                      onClick={handleAddTimeSlot}
                      className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                    >
                      + Add Time
                    </button>
                  </div>
                  <div className="space-y-2">
                    {scheduledTimes.map((timeVal, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={timeVal}
                          onChange={e => handleUpdateTimeSlot(idx, e.target.value)}
                          required
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                        {scheduledTimes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTimeSlot(idx)}
                            className="p-2 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-zinc-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  Instructions / Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Take with breakfast. Drink plenty of water."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] font-bold text-white shadow-lg shadow-blue-600/30 transition text-base"
                >
                  {editingMedication ? 'Save Changes' : 'Add Medication'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteConfirmMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Delete {deleteConfirmMed.name}?</h3>
            <p className="text-xs text-zinc-400 mt-2">
              Are you sure? If you simply stopped taking it, archiving is recommended to preserve your adherence history.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirmMed(null)}
                className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-semibold text-xs text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMedication}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-semibold text-xs text-white shadow-md shadow-rose-600/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HOSPITAL APPOINTMENT CREATE / EDIT MODAL */}
      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => {
          setIsAppointmentModalOpen(false);
          setEditingAppointment(null);
        }}
        appointmentToEdit={editingAppointment}
        onSave={(savedAppt) => {
          if (onSaveAppointment) onSaveAppointment(savedAppt);
          setIsAppointmentModalOpen(false);
          setEditingAppointment(null);
        }}
        availableMedications={medications}
      />
    </div>
  );
};
