import React, { useState } from 'react';
import { Pill, Scale, PlusCircle, X, Clock, Calendar, Building2 } from 'lucide-react';
import { Medication, WeightEntry } from '../types';
import { getLocalDateString, saveStoredWeightEntries, getStoredWeightEntries, saveStoredDoseLogs, getStoredDoseLogs } from '../services/storage';

interface AddActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  medications: Medication[];
  onOpenAddMedication: () => void;
  onOpenAddAppointment?: () => void;
  onDoseLogged: () => void;
  onWeightLogged: () => void;
  weightUnit: 'kg' | 'lbs';
}

export const AddActionModal: React.FC<AddActionModalProps> = ({
  isOpen,
  onClose,
  medications,
  onOpenAddMedication,
  onOpenAddAppointment,
  onDoseLogged,
  onWeightLogged,
  weightUnit,
}) => {
  const [activeView, setActiveView] = useState<'menu' | 'log_as_needed' | 'log_weight'>('menu');

  // As-needed dose form state
  const [selectedMedId, setSelectedMedId] = useState<string>('');
  const [doseAmount, setDoseAmount] = useState<string>('');
  const [asNeededNotes, setAsNeededNotes] = useState<string>('');

  // Weight form state
  const [weightValue, setWeightValue] = useState<string>('');
  const [weightDate, setWeightDate] = useState<string>(getLocalDateString());
  const [weightTime, setWeightTime] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [weightNotes, setWeightNotes] = useState<string>('');

  if (!isOpen) return null;

  const onDemandMeds = medications.filter(m => !m.archived);

  const handleSelectMedForDose = (medId: string) => {
    setSelectedMedId(medId);
    const m = medications.find(x => x.id === medId);
    if (m) {
      setDoseAmount(m.dosePerIntake || '1 dose');
    }
  };

  const handleSaveAsNeededDose = (e: React.FormEvent) => {
    e.preventDefault();
    const med = medications.find(m => m.id === selectedMedId);
    if (!med) return;

    const todayStr = getLocalDateString();
    const nowIso = new Date().toISOString();

    const existingLogs = getStoredDoseLogs();
    const newLog = {
      id: `prn_${med.id}_${Date.now()}`,
      medicationId: med.id,
      medicationName: med.name,
      medicationStrength: med.strength,
      medicationForm: med.form,
      doseAmount: doseAmount || med.dosePerIntake,
      date: todayStr,
      actualTime: nowIso,
      status: 'taken' as const,
      isOnDemand: true,
      notes: asNeededNotes.trim() || undefined,
    };

    saveStoredDoseLogs([newLog, ...existingLogs]);
    onDoseLogged();
    onClose();
    setActiveView('menu');
  };

  const handleSaveWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(weightValue);
    if (isNaN(num) || num <= 0) return;

    // Convert to kg if in lbs for internal standard storage
    const storedWeightKg = weightUnit === 'lbs' ? num * 0.45359237 : num;

    const existing = getStoredWeightEntries();
    const newEntry: WeightEntry = {
      id: `w_${Date.now()}`,
      weightKg: Math.round(storedWeightKg * 10) / 10,
      date: weightDate,
      time: weightTime,
      timestamp: new Date(`${weightDate}T${weightTime}:00`).getTime() || Date.now(),
      notes: weightNotes.trim() || undefined,
    };

    saveStoredWeightEntries([newEntry, ...existing]);
    onWeightLogged();
    onClose();
    setActiveView('menu');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full sm:max-w-lg bg-[#1C1C1E] border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl overflow-hidden text-zinc-100">
        {/* Main Menu View */}
        {activeView === 'menu' && (
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-lg font-bold text-white">Quick Actions</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {/* Option 1: Log as-needed dose */}
              <button
                onClick={() => {
                  const firstOnDemand = onDemandMeds.find(m => m.scheduleType === 'as_needed') || onDemandMeds[0];
                  if (firstOnDemand) {
                    handleSelectMedForDose(firstOnDemand.id);
                  }
                  setActiveView('log_as_needed');
                }}
                className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 active:scale-[0.98] border border-zinc-700/50 text-left transition"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Pill className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-base">Log as-needed dose</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">Record an unscheduled intake taken right now</p>
                </div>
              </button>

              {/* Option 2: Log weight */}
              <button
                onClick={() => {
                  setWeightValue('');
                  setActiveView('log_weight');
                }}
                className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 active:scale-[0.98] border border-zinc-700/50 text-left transition"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-base">Log weight</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">Record today's weight measurement</p>
                </div>
              </button>

              {/* Option 3: Add medication */}
              <button
                onClick={() => {
                  onClose();
                  onOpenAddMedication();
                }}
                className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 active:scale-[0.98] border border-zinc-700/50 text-left transition"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-base">Add medication</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">Setup a new scheduled or on-demand medication</p>
                </div>
              </button>

              {/* Option 4: Schedule medical appointment */}
              {onOpenAddAppointment && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAddAppointment();
                  }}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-800/70 hover:bg-zinc-800 active:scale-[0.98] border border-zinc-700/50 text-left transition"
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-base">Schedule hospital visit</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">Track checkups, doctor appointments &amp; refills</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Log As-Needed Dose View */}
        {activeView === 'log_as_needed' && (
          <form onSubmit={handleSaveAsNeededDose}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveView('menu')}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  ← Back
                </button>
                <h3 className="text-base font-bold text-white">Log As-Needed Dose</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Medication
                </label>
                {onDemandMeds.length === 0 ? (
                  <div className="p-3 bg-zinc-800/50 rounded-xl text-xs text-zinc-400">
                    No active medications found. Please create one first.
                  </div>
                ) : (
                  <select
                    value={selectedMedId}
                    onChange={e => handleSelectMedForDose(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                    required
                  >
                    {onDemandMeds.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.strength} ({m.form}) {m.scheduleType === 'as_needed' ? '[As Needed]' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Dose Taken
                </label>
                <input
                  type="text"
                  value={doseAmount}
                  onChange={e => setDoseAmount(e.target.value)}
                  placeholder="e.g. 1 pill(s), 200mg, 10ml"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Optional Note (Reason / Symptoms)
                </label>
                <input
                  type="text"
                  value={asNeededNotes}
                  onChange={e => setAsNeededNotes(e.target.value)}
                  placeholder="e.g. Mild headache, joint pain"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!selectedMedId}
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] font-semibold text-white shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  Confirm Dose Taken
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Log Weight View */}
        {activeView === 'log_weight' && (
          <form onSubmit={handleSaveWeight}>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveView('menu')}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  ← Back
                </button>
                <h3 className="text-base font-bold text-white">Log Weight</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Weight ({weightUnit})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="500"
                    value={weightValue}
                    onChange={e => setWeightValue(e.target.value)}
                    placeholder={weightUnit === 'kg' ? 'e.g. 71.5' : 'e.g. 157.6'}
                    required
                    autoFocus
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3.5 text-xl font-bold text-white focus:outline-none focus:border-blue-500 pr-14"
                  />
                  <span className="absolute right-4 top-3.5 text-zinc-400 font-semibold text-base">
                    {weightUnit}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Date
                  </label>
                  <input
                    type="date"
                    value={weightDate}
                    onChange={e => setWeightDate(e.target.value)}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Time
                  </label>
                  <input
                    type="time"
                    value={weightTime}
                    onChange={e => setWeightTime(e.target.value)}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Optional Note
                </label>
                <input
                  type="text"
                  value={weightNotes}
                  onChange={e => setWeightNotes(e.target.value)}
                  placeholder="e.g. Morning fasting, after workout"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!weightValue}
                  className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-[0.98] font-semibold text-white shadow-lg shadow-purple-600/20 transition disabled:opacity-50"
                >
                  Save Weight Entry
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
