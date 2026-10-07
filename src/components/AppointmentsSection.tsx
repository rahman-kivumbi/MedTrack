import React, { useState } from 'react';
import { 
  Building2, 
  Calendar, 
  Clock, 
  User, 
  Pill, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  RotateCcw, 
  AlertTriangle, 
  PackageCheck, 
  FileText, 
  Stethoscope,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  MapPin,
  Sparkles,
  Share2,
  Copy,
  Check
} from 'lucide-react';
import { MedicalAppointment, AppointmentReasonType, Medication } from '../types';
import { formatTime, getLocalDateString } from '../services/storage';

interface AppointmentsSectionProps {
  appointments: MedicalAppointment[];
  onOpenCreate: () => void;
  onOpenEdit: (appointment: MedicalAppointment) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (appointment: MedicalAppointment) => void;
}

export const AppointmentsSection: React.FC<AppointmentsSectionProps> = ({
  appointments,
  onOpenCreate,
  onOpenEdit,
  onDelete,
  onToggleStatus,
}) => {
  const [filter, setFilter] = useState<'upcoming' | 'all' | 'completed'>('upcoming');
  const [expandedRefillId, setExpandedRefillId] = useState<string | null>(null);
  const [copiedApptId, setCopiedApptId] = useState<string | null>(null);

  const todayStr = getLocalDateString();

  // Share or copy appointment details for doctor / pharmacy visit
  const handleShareOrCopyAppt = async (appt: MedicalAppointment) => {
    const lines: string[] = [];
    lines.push(`🏥 HOSPITAL APPOINTMENT & REFILL SLIP`);
    lines.push(`Hospital/Clinic: ${appt.hospitalOrClinic}`);
    if (appt.doctorOrDepartment) lines.push(`Doctor/Department: ${appt.doctorOrDepartment}`);
    lines.push(`Date: ${appt.date} at ${formatTime(appt.time || '09:00')}`);
    const purposeName = appt.reasonType === 'refill' ? 'Medicine Refill' : appt.reasonType === 'checkup' ? 'General Checkup' : appt.reasonType === 'follow_up' ? 'Follow-up Visit' : appt.reasonType === 'lab_test' ? 'Lab Test' : appt.customReason || 'Visit';
    lines.push(`Purpose: ${purposeName}`);
    if (appt.notes) lines.push(`Notes: ${appt.notes}`);

    const refills = appt.medicationRefills || [];
    const finished = refills.filter(r => r.status === 'finished_needs_refill');
    const stillTaking = refills.filter(r => r.status === 'still_taking');

    if (finished.length > 0) {
      lines.push('');
      lines.push(`🚨 MEDICINES FINISHED (NEED REFILL):`);
      finished.forEach(item => {
        lines.push(`• ${item.name} ${item.strength || ''}: 0 remaining left, need ${item.quantityNeeded || 30} ${item.unit || 'pills'}${item.notes ? ` (Note: ${item.notes})` : ''}`);
      });
    }

    if (stillTaking.length > 0) {
      lines.push('');
      lines.push(`📦 MEDICINES STILL BEING TAKEN (IN STOCK):`);
      stillTaking.forEach(item => {
        lines.push(`• ${item.name} ${item.strength || ''}: ${item.remainingQuantity ?? 0} ${item.unit || 'pills'} left${item.quantityNeeded ? ` (Refill needed: ${item.quantityNeeded})` : ''}${item.notes ? ` (Note: ${item.notes})` : ''}`);
      });
    }

    lines.push('');
    lines.push(`Generated from MedTrack Personal Health Log`);
    const fullText = lines.join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Hospital Visit - ${appt.hospitalOrClinic}`,
          text: fullText,
        });
        return;
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          console.warn('Share dismissed or unsupported, falling back to copy');
        }
      }
    }

    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedApptId(appt.id);
      setTimeout(() => setCopiedApptId(null), 2500);
    } catch (e) {
      console.warn('Clipboard write failed', e);
    }
  };

  // Helper for human-friendly date countdown
  const getDaysDiffDescription = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [cy, cm, cd] = todayStr.split('-').map(Number);
    const apptDate = new Date(y, m - 1, d);
    const todayDate = new Date(cy, cm - 1, cd);

    const diffMs = apptDate.getTime() - todayDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { text: 'Today', urgent: true, isPast: false };
    if (diffDays === 1) return { text: 'Tomorrow', urgent: true, isPast: false };
    if (diffDays > 1 && diffDays <= 7) return { text: `In ${diffDays} days`, urgent: false, isPast: false };
    if (diffDays > 7) return { text: `In ${diffDays} days`, urgent: false, isPast: false };
    if (diffDays === -1) return { text: 'Yesterday', urgent: false, isPast: true };
    return { text: `${Math.abs(diffDays)} days ago`, urgent: false, isPast: true };
  };

  const getReasonBadge = (type: AppointmentReasonType, customReason?: string) => {
    switch (type) {
      case 'refill':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 border border-blue-500/30 text-blue-400">
            <Pill className="w-3 h-3" /> Medicine Refill
          </span>
        );
      case 'checkup':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <Stethoscope className="w-3 h-3" /> General Checkup
          </span>
        );
      case 'follow_up':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/15 border border-purple-500/30 text-purple-400">
            <RotateCcw className="w-3 h-3" /> Follow-up Visit
          </span>
        );
      case 'lab_test':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <FlaskConical className="w-3 h-3" /> Lab / Blood Work
          </span>
        );
      case 'custom':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400">
            <FileText className="w-3 h-3" /> {customReason || 'Custom Visit'}
          </span>
        );
    }
  };

  const sortedAppointments = [...appointments].sort((a, b) => {
    const dtA = `${a.date}T${a.time || '00:00'}`;
    const dtB = `${b.date}T${b.time || '00:00'}`;
    return dtA.localeCompare(dtB);
  });

  const filteredAppointments = sortedAppointments.filter(appt => {
    if (filter === 'upcoming') {
      return appt.status === 'scheduled' && appt.date >= todayStr;
    }
    if (filter === 'completed') {
      return appt.status === 'completed' || (appt.status === 'scheduled' && appt.date < todayStr);
    }
    return true; // 'all'
  });

  return (
    <div className="space-y-4">
      {/* Header with Add Button and Filter Chips */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter chips */}
        <div className="flex items-center bg-zinc-900/90 p-1 rounded-2xl border border-zinc-800">
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'upcoming'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'all'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All Visits ({appointments.length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'completed'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Completed / Past
          </button>
        </div>

        <button
          onClick={onOpenCreate}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-2xl text-xs font-bold shadow-md shadow-blue-600/30 flex items-center justify-center gap-1.5 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Appointment</span>
        </button>
      </div>

      {/* Appointment Cards List */}
      {filteredAppointments.length === 0 ? (
        <div className="text-center py-12 px-4 bg-zinc-900/40 rounded-3xl border border-zinc-800/60">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 text-zinc-400 mx-auto flex items-center justify-center mb-3">
            <Building2 className="w-7 h-7 text-blue-400" />
          </div>
          <h3 className="text-base font-bold text-white">
            {filter === 'upcoming' ? 'No upcoming appointments' : 'No appointments found'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
            Schedule doctor visits, hospital checkups, and record medicine refills so you never run out of medication.
          </p>
          <button
            onClick={onOpenCreate}
            className="mt-4 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition"
          >
            + Schedule First Visit
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredAppointments.map(appt => {
            const countdown = getDaysDiffDescription(appt.date);
            const isCompleted = appt.status === 'completed';
            const refills = appt.medicationRefills || [];
            const finishedRefills = refills.filter(r => r.status === 'finished_needs_refill');
            const stillTakingRefills = refills.filter(r => r.status === 'still_taking');
            const isRefillsExpanded = expandedRefillId === appt.id;

            return (
              <div
                key={appt.id}
                className={`bg-[#1C1C1E] border rounded-3xl p-4.5 shadow-sm transition ${
                  isCompleted
                    ? 'border-zinc-800/60 opacity-80'
                    : countdown.urgent
                    ? 'border-blue-500/40 shadow-blue-950/20'
                    : 'border-zinc-800/90 hover:border-zinc-700'
                }`}
              >
                {/* Top Row: Date, countdown & status badge */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800/70">
                  <div className="flex items-center gap-2">
                    <div
                      className={`px-2.5 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 ${
                        isCompleted
                          ? 'bg-zinc-800 text-zinc-400'
                          : countdown.urgent
                          ? 'bg-blue-600 text-white shadow-sm'
                          : countdown.isPast
                          ? 'bg-zinc-800 text-zinc-400'
                          : 'bg-blue-950/60 border border-blue-500/30 text-blue-300'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{countdown.text}</span>
                    </div>

                    <span className="text-xs text-zinc-400 font-medium">
                      {appt.date} • {formatTime(appt.time || '09:00')}
                    </span>
                  </div>

                  <div>
                    {getReasonBadge(appt.reasonType, appt.customReason)}
                  </div>
                </div>

                {/* Main Information: Hospital & Doctor */}
                <div className="mt-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-black text-white leading-tight flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>{appt.hospitalOrClinic}</span>
                      </h3>
                      {appt.doctorOrDepartment && (
                        <p className="text-xs text-zinc-300 mt-1 flex items-center gap-1.5 font-medium">
                          <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>{appt.doctorOrDepartment}</span>
                        </p>
                      )}
                    </div>

                    {/* Quick complete toggle */}
                    <button
                      onClick={() => onToggleStatus(appt)}
                      className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                      title={isCompleted ? 'Mark as Scheduled' : 'Mark as Completed'}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="hidden sm:inline">{isCompleted ? 'Completed' : 'Mark Done'}</span>
                    </button>
                  </div>

                  {/* Notes if available */}
                  {appt.notes && (
                    <div className="mt-2.5 p-2.5 bg-zinc-900/80 rounded-2xl border border-zinc-800/80 text-xs text-zinc-300 leading-relaxed">
                      <span className="font-semibold text-zinc-400 block text-[10px] uppercase tracking-wider mb-0.5">
                        Instructions / Notes
                      </span>
                      {appt.notes}
                    </div>
                  )}

                  {/* MEDICINE REFILL SUMMARY & INVENTORY BREAKDOWN */}
                  {refills.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-zinc-800/60">
                      <div 
                        onClick={() => setExpandedRefillId(isRefillsExpanded ? null : appt.id)}
                        className="flex items-center justify-between cursor-pointer py-1 text-xs text-zinc-300 hover:text-white"
                      >
                        <div className="flex items-center gap-2">
                          <Pill className="w-3.5 h-3.5 text-blue-400" />
                          <span className="font-bold">
                            Attached Medicines ({refills.length})
                          </span>
                          {finishedRefills.length > 0 && (
                            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full text-[10px] font-bold">
                              {finishedRefills.length} Finished / Need Refill
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                          <span>{isRefillsExpanded ? 'Hide' : 'Show details'}</span>
                          {isRefillsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                      </div>

                      {/* Expanded Refill items */}
                      {isRefillsExpanded && (
                        <div className="mt-2 space-y-2 bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800/80 animate-in fade-in duration-150">
                          {/* Finished medicines */}
                          {finishedRefills.length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-400" /> Finished • Needs Refill Prescription
                              </span>
                              <div className="space-y-1.5">
                                {finishedRefills.map(item => (
                                  <div
                                    key={item.id}
                                    className="p-2 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-between text-xs"
                                  >
                                    <div>
                                      <p className="font-bold text-white leading-tight">
                                        {item.name} {item.strength}
                                      </p>
                                      {item.notes && (
                                        <p className="text-[11px] text-rose-300/80 mt-0.5">{item.notes}</p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[11px] font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-lg border border-rose-500/40">
                                        Refill: {item.quantityNeeded || 30} {item.unit || 'pills'}
                                      </span>
                                      <p className="text-[10px] text-zinc-400 mt-0.5">
                                        Remaining: {item.remainingQuantity ?? 0}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Still taking medicines */}
                          {stillTakingRefills.length > 0 && (
                            <div className={finishedRefills.length > 0 ? 'mt-3 pt-2 border-t border-zinc-800/60' : ''}>
                              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                                <PackageCheck className="w-3 h-3 text-emerald-400" /> Still Being Taken (In Stock)
                              </span>
                              <div className="space-y-1.5">
                                {stillTakingRefills.map(item => (
                                  <div
                                    key={item.id}
                                    className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-between text-xs"
                                  >
                                    <div>
                                      <p className="font-bold text-zinc-200 leading-tight">
                                        {item.name} {item.strength}
                                      </p>
                                      {item.notes && (
                                        <p className="text-[11px] text-zinc-400 mt-0.5">{item.notes}</p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                                        {item.remainingQuantity !== undefined ? `${item.remainingQuantity} left` : 'In Stock'}
                                      </span>
                                      {item.quantityNeeded && item.quantityNeeded > 0 ? (
                                        <p className="text-[10px] text-zinc-400 mt-0.5">
                                          Need: {item.quantityNeeded} {item.unit || 'pills'}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer actions: Edit & Delete */}
                  <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500">
                      Status: <strong className="text-zinc-300 capitalize">{appt.status}</strong>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleShareOrCopyAppt(appt)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 ${
                          copiedApptId === appt.id
                            ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                            : 'text-blue-400 hover:text-white bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20'
                        }`}
                        title="Copy/Share prescription refill & visit note for doctor or pharmacy"
                      >
                        {copiedApptId === appt.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Refill Slip</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => onOpenEdit(appt)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => onDelete(appt.id)}
                        className="p-1.5 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
                        title="Delete Appointment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
