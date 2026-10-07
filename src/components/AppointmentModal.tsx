import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Building2, 
  User as UserIcon, 
  Pill, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Sparkles,
  Stethoscope,
  RotateCcw,
  FlaskConical,
  FileText,
  HelpCircle,
  PackageCheck,
  AlertTriangle
} from 'lucide-react';
import { 
  MedicalAppointment, 
  AppointmentReasonType, 
  AppointmentMedRefillItem, 
  Medication 
} from '../types';
import { getLocalDateString } from '../services/storage';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentToEdit?: MedicalAppointment | null;
  onSave: (appointment: MedicalAppointment) => void;
  availableMedications: Medication[];
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  appointmentToEdit,
  onSave,
  availableMedications,
}) => {
  const [hospitalOrClinic, setHospitalOrClinic] = useState('');
  const [doctorOrDepartment, setDoctorOrDepartment] = useState('');
  const [date, setDate] = useState(getLocalDateString());
  const [time, setTime] = useState('09:00');
  const [reasonType, setReasonType] = useState<AppointmentReasonType>('checkup');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [medicationRefills, setMedicationRefills] = useState<AppointmentMedRefillItem[]>([]);
  const [errors, setErrors] = useState<string | null>(null);

  // Initialize or reset when modal opens or appointmentToEdit changes
  useEffect(() => {
    if (appointmentToEdit) {
      setHospitalOrClinic(appointmentToEdit.hospitalOrClinic || '');
      setDoctorOrDepartment(appointmentToEdit.doctorOrDepartment || '');
      setDate(appointmentToEdit.date || getLocalDateString());
      setTime(appointmentToEdit.time || '09:00');
      setReasonType(appointmentToEdit.reasonType || 'checkup');
      setCustomReason(appointmentToEdit.customReason || '');
      setNotes(appointmentToEdit.notes || '');
      setMedicationRefills(appointmentToEdit.medicationRefills ? [...appointmentToEdit.medicationRefills] : []);
    } else {
      setHospitalOrClinic('');
      setDoctorOrDepartment('');
      setDate(getLocalDateString());
      setTime('09:00');
      setReasonType('checkup');
      setCustomReason('');
      setNotes('');
      // If user has medications and selects refill by default, don't pre-populate unless requested
      setMedicationRefills([]);
    }
    setErrors(null);
  }, [appointmentToEdit, isOpen]);

  if (!isOpen) return null;

  // Auto-populate from user's current active medications
  const handlePopulateFromMedications = () => {
    const activeMeds = availableMedications.filter(m => !m.archived);
    if (activeMeds.length === 0) {
      setErrors('No active medications found in your Treatment list.');
      return;
    }

    const items: AppointmentMedRefillItem[] = activeMeds.map(med => ({
      id: `refill_${med.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      medicationId: med.id,
      name: med.name,
      strength: med.strength,
      form: med.form,
      status: 'still_taking',
      remainingQuantity: 10,
      quantityNeeded: 30,
      unit: med.form === 'liquid' ? 'bottles' : med.form === 'inhaler' ? 'inhalers' : med.form === 'drops' ? 'bottles' : 'pills',
      notes: '',
    }));

    // Merge or replace
    setMedicationRefills(prev => {
      const existingNames = new Set(prev.map(p => p.name.toLowerCase()));
      const filteredNew = items.filter(i => !existingNames.has(i.name.toLowerCase()));
      return [...prev, ...filteredNew];
    });
  };

  const handleAddNewRefillItem = () => {
    const newItem: AppointmentMedRefillItem = {
      id: `refill_item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      strength: '',
      status: 'finished_needs_refill',
      remainingQuantity: 0,
      quantityNeeded: 30,
      unit: 'pills',
      notes: '',
    };
    setMedicationRefills(prev => [...prev, newItem]);
  };

  const handleUpdateRefillItem = (id: string, updates: Partial<AppointmentMedRefillItem>) => {
    setMedicationRefills(prev =>
      prev.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleMedNameChange = (id: string, newName: string) => {
    const matched = availableMedications.find(
      m => m.name.toLowerCase() === newName.trim().toLowerCase()
    );
    if (matched) {
      handleUpdateRefillItem(id, {
        name: newName,
        strength: matched.strength || undefined,
        form: matched.form,
        medicationId: matched.id,
        unit: matched.form === 'liquid' ? 'bottles' : matched.form === 'inhaler' ? 'inhalers' : matched.form === 'drops' ? 'bottles' : 'pills',
      });
    } else {
      handleUpdateRefillItem(id, { name: newName });
    }
  };

  const handleApplyDatePreset = (daysOffset: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysOffset);
    const yr = target.getFullYear();
    const mo = String(target.getMonth() + 1).padStart(2, '0');
    const da = String(target.getDate()).padStart(2, '0');
    setDate(`${yr}-${mo}-${da}`);
  };

  const handleRemoveRefillItem = (id: string) => {
    setMedicationRefills(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospitalOrClinic.trim()) {
      setErrors('Please enter the Hospital or Clinic name.');
      return;
    }
    if (!date) {
      setErrors('Please select the appointment date.');
      return;
    }

    const cleanedRefills: AppointmentMedRefillItem[] = medicationRefills
      .filter(item => item.name.trim().length > 0)
      .map(item => ({
        ...item,
        name: item.name.trim(),
        strength: item.strength?.trim() || undefined,
        unit: item.unit?.trim() || 'pills',
        notes: item.notes?.trim() || undefined,
      }));

    const appointment: MedicalAppointment = {
      id: appointmentToEdit ? appointmentToEdit.id : `appt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      hospitalOrClinic: hospitalOrClinic.trim(),
      doctorOrDepartment: doctorOrDepartment.trim() || undefined,
      date,
      time: time || '09:00',
      reasonType,
      customReason: reasonType === 'custom' ? customReason.trim() : undefined,
      notes: notes.trim() || undefined,
      status: appointmentToEdit ? appointmentToEdit.status : 'scheduled',
      medicationRefills: cleanedRefills,
      createdAt: appointmentToEdit ? appointmentToEdit.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    onSave(appointment);
    onClose();
  };

  const reasonsList: { type: AppointmentReasonType; label: string; icon: React.ReactNode; desc: string }[] = [
    { type: 'checkup', label: 'Checkup', icon: <Stethoscope className="w-4 h-4 text-emerald-400" />, desc: 'Routine exam' },
    { type: 'refill', label: 'Medicine Refill', icon: <Pill className="w-4 h-4 text-blue-400" />, desc: 'Prescription renewal' },
    { type: 'follow_up', label: 'Follow-up', icon: <RotateCcw className="w-4 h-4 text-purple-400" />, desc: 'Review progress' },
    { type: 'lab_test', label: 'Lab / Blood Test', icon: <FlaskConical className="w-4 h-4 text-amber-400" />, desc: 'Diagnostics' },
    { type: 'custom', label: 'Custom Reason', icon: <FileText className="w-4 h-4 text-rose-400" />, desc: 'Other purpose' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full sm:max-w-xl bg-[#1C1C1E] border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">
                {appointmentToEdit ? 'Edit Hospital Appointment' : 'Schedule Hospital Appointment'}
              </h3>
              <p className="text-xs text-zinc-400">Track doctor visits, checkups &amp; medication refills</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errors && (
          <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errors}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* 1. HOSPITAL & CLINIC NAME */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              Hospital / Clinic Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. City General Hospital, St. Mary Clinic"
              value={hospitalOrClinic}
              onChange={e => setHospitalOrClinic(e.target.value)}
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* 2. DOCTOR OR DEPARTMENT */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
              Doctor or Department <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Dr. Robert Evans • Cardiology / Room 302"
              value={doctorOrDepartment}
              onChange={e => setDoctorOrDepartment(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* 3. DATE AND TIME */}
          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Quick date preset helper chips */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider shrink-0 mr-0.5">Quick Date:</span>
              <button
                type="button"
                onClick={() => handleApplyDatePreset(7)}
                className="px-2 py-0.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-300 hover:text-white border border-zinc-700/50 shrink-0 transition"
              >
                +1 Wk
              </button>
              <button
                type="button"
                onClick={() => handleApplyDatePreset(14)}
                className="px-2 py-0.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-300 hover:text-white border border-zinc-700/50 shrink-0 transition"
              >
                +2 Wks
              </button>
              <button
                type="button"
                onClick={() => handleApplyDatePreset(30)}
                className="px-2 py-0.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-300 hover:text-white border border-zinc-700/50 shrink-0 transition"
              >
                +1 Mo
              </button>
              <button
                type="button"
                onClick={() => handleApplyDatePreset(60)}
                className="px-2 py-0.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-300 hover:text-white border border-zinc-700/50 shrink-0 transition"
              >
                +2 Mos
              </button>
              <button
                type="button"
                onClick={() => handleApplyDatePreset(90)}
                className="px-2 py-0.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-[11px] font-semibold text-zinc-300 hover:text-white border border-zinc-700/50 shrink-0 transition"
              >
                +3 Mos
              </button>
            </div>
          </div>

          {/* 4. PURPOSE / REASON SELECTOR */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">
              Appointment Purpose <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {reasonsList.map(r => {
                const isSelected = reasonType === r.type;
                return (
                  <button
                    key={r.type}
                    type="button"
                    onClick={() => setReasonType(r.type)}
                    className={`p-2.5 rounded-2xl border text-left transition flex flex-col gap-1 active:scale-95 ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm'
                        : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {r.icon}
                      <span className="text-xs font-bold leading-tight">{r.label}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 leading-none">{r.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom reason input if "custom" is selected */}
            {reasonType === 'custom' && (
              <div className="mt-2.5">
                <input
                  type="text"
                  placeholder="Specify reason for hospital visit (e.g. Wound dressing, Physical therapy)"
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {/* 5. MEDICINE REFILL & SUPPLY TRACKER (USER'S EXPLICIT REQUIREMENT) */}
          <div className="pt-2 border-t border-zinc-800/80">
            {/* Datalist for active medication auto-suggestions */}
            <datalist id="available-meds-datalist">
              {availableMedications.map(m => (
                <option key={m.id} value={m.name}>
                  {m.strength ? `${m.strength} (${m.form})` : m.form}
                </option>
              ))}
            </datalist>

            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-blue-400" />
                  Medicines Finished &amp; Refills Needed
                </h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Track which medicines got over and which are still being taken
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {availableMedications.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePopulateFromMedications}
                    className="px-2.5 py-1 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 text-[11px] font-bold flex items-center gap-1 transition"
                    title="Import active meds from Treatment"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Import Meds</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddNewRefillItem}
                  className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold flex items-center gap-1 transition border border-zinc-700/60"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Medicine</span>
                </button>
              </div>
            </div>

            {/* List of medication refill items */}
            {medicationRefills.length === 0 ? (
              <div className="p-4 bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-800 text-center">
                <p className="text-xs text-zinc-400">
                  No medicines attached to this appointment.
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Add items to take to your doctor or pharmacist to know which ones finished and need refill.
                </p>
                <div className="flex justify-center gap-2 mt-3">
                  {availableMedications.length > 0 && (
                    <button
                      type="button"
                      onClick={handlePopulateFromMedications}
                      className="px-3 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Import Active Prescriptions
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddNewRefillItem}
                    className="px-3 py-1.5 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Custom Medicine
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {medicationRefills.map((item, idx) => {
                  const isFinished = item.status === 'finished_needs_refill';
                  return (
                    <div
                      key={item.id || idx}
                      className={`p-3.5 rounded-2xl border transition ${
                        isFinished
                          ? 'bg-rose-950/20 border-rose-500/30 shadow-sm'
                          : 'bg-zinc-900/90 border-zinc-800'
                      }`}
                    >
                      {/* Name & Strength row */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            list="available-meds-datalist"
                            placeholder="Medication name (e.g. Metformin)"
                            value={item.name}
                            onChange={e => handleMedNameChange(item.id, e.target.value)}
                            required
                            className="bg-zinc-800 border border-zinc-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Strength (e.g. 500mg)"
                            value={item.strength || ''}
                            onChange={e => handleUpdateRefillItem(item.id, { strength: e.target.value })}
                            className="bg-zinc-800 border border-zinc-700/80 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveRefillItem(item.id)}
                          className="p-1.5 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Status Toggle: Finished vs Still Taking */}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateRefillItem(item.id, { status: 'finished_needs_refill' })}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition border ${
                            isFinished
                              ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700/60 hover:text-rose-300'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Finished / Got Over (Needs Refill)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateRefillItem(item.id, { status: 'still_taking' })}
                          className={`py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition border ${
                            !isFinished
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700/60 hover:text-emerald-300'
                          }`}
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Still Being Taken (In Stock)</span>
                        </button>
                      </div>

                      {/* Quantities: Remaining & Refill Needed */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-0.5">
                            Remaining Left
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={item.remainingQuantity ?? ''}
                            onChange={e =>
                              handleUpdateRefillItem(item.id, {
                                remainingQuantity: e.target.value === '' ? undefined : Number(e.target.value),
                              })
                            }
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-0.5">
                            Refill Needed
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="30"
                            value={item.quantityNeeded ?? ''}
                            onChange={e =>
                              handleUpdateRefillItem(item.id, {
                                quantityNeeded: e.target.value === '' ? undefined : Number(e.target.value),
                              })
                            }
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-0.5">
                            Unit
                          </label>
                          <input
                            type="text"
                            placeholder="pills / bottles"
                            value={item.unit || 'pills'}
                            onChange={e => handleUpdateRefillItem(item.id, { unit: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Notes / doctor reminder for this pill */}
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="Note for doctor (e.g. check for cheaper generic, ran out 3 days ago)"
                          value={item.notes || ''}
                          onChange={e => handleUpdateRefillItem(item.id, { notes: e.target.value })}
                          className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-2.5 py-1 text-[11px] text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6. GENERAL NOTES */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              General Instructions / Prep Notes <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Fasting 8 hours prior for blood sugar, bring blood pressure log and insurance card"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* SUBMIT BUTTONS */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-3 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white shadow-lg shadow-blue-600/30 transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{appointmentToEdit ? 'Save Changes' : 'Schedule Appointment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
