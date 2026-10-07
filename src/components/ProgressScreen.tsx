import React, { useState } from 'react';
import { 
  BarChart3, 
  ListFilter, 
  Check, 
  X as XIcon, 
  Minus, 
  Share2, 
  Scale, 
  ChevronRight, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit2, 
  TrendingDown, 
  TrendingUp, 
  Sparkles,
  Pill,
  Clock,
  ArrowUpRight,
  FileText
} from 'lucide-react';
import { Medication, DoseLog, WeightEntry, UserSettings } from '../types';
import { getLocalDateString, addDays, saveStoredWeightEntries, getStoredWeightEntries, saveStoredSettings, formatTime } from '../services/storage';
import { generateDoctorSummaryPDF, shareDoctorSummary } from '../services/pdfGenerator';
import { getMedFormIcon } from './TodayScreen';

interface ProgressScreenProps {
  medications: Medication[];
  doseLogs: DoseLog[];
  weightEntries: WeightEntry[];
  settings: UserSettings;
  onRefreshData: () => void;
}

export const ProgressScreen: React.FC<ProgressScreenProps> = ({
  medications,
  doseLogs,
  weightEntries,
  settings,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'charts' | 'list'>('charts');
  
  // Modals
  const [selectedMedForHistory, setSelectedMedForHistory] = useState<Medication | null>(null);
  const [isWeightHistoryOpen, setIsWeightHistoryOpen] = useState<boolean>(false);
  const [isDoctorSummaryOpen, setIsDoctorSummaryOpen] = useState<boolean>(false);
  const [isTargetWeightModalOpen, setIsTargetWeightModalOpen] = useState<boolean>(false);
  const [targetWeightInput, setTargetWeightInput] = useState<string>(settings.targetWeightKg.toString());

  // Doctor Summary range state
  const todayStr = getLocalDateString();
  const [summaryRangeType, setSummaryRangeType] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [customStartDate, setCustomStartDate] = useState<string>(addDays(todayStr, -30));
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Weight edit/add states inside weight history
  const [editingWeight, setEditingWeight] = useState<WeightEntry | null>(null);
  const [newWeightVal, setNewWeightVal] = useState<string>('');
  const [newWeightDate, setNewWeightDate] = useState<string>(todayStr);
  const [newWeightTime, setNewWeightTime] = useState<string>('08:00');

  // Compute 7 days for the 7-day strip cards (ending today)
  const last7Days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    last7Days.push(addDays(todayStr, -i));
  }

  // Weight info
  const sortedWeights = [...weightEntries].sort((a, b) => a.timestamp - b.timestamp);
  const latestWeight = sortedWeights.length > 0 ? sortedWeights[sortedWeights.length - 1] : null;
  const targetWeight = settings.targetWeightKg;
  const unit = settings.weightUnit;

  // Scheduled vs On-Demand medications
  const scheduledMeds = medications.filter(m => m.scheduleType !== 'as_needed' && !m.archived);
  const onDemandMeds = medications.filter(m => m.scheduleType === 'as_needed' || m.archived);
  const onDemandLogs = doseLogs.filter(l => l.isOnDemand);

  // Helper: check dose status of a med on a specific date
  const getDoseDayStatus = (medId: string, dateStr: string): 'taken' | 'missed' | 'not_scheduled' | 'partial' => {
    const med = medications.find(m => m.id === medId);
    if (!med) return 'not_scheduled';

    // Check if scheduled
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();

    if (dateStr < med.startDate || (med.endDate && dateStr > med.endDate)) {
      return 'not_scheduled';
    }

    let isScheduled = false;
    if (med.scheduleType === 'every_day') {
      isScheduled = true;
    } else if (med.scheduleType === 'specific_days') {
      isScheduled = (med.weekdays || []).includes(dayOfWeek);
    } else if (med.scheduleType === 'every_n_days') {
      const anchor = med.intervalAnchorDate || med.startDate;
      const [ay, am, ad] = anchor.split('-').map(Number);
      const diffDays = Math.round((new Date(y, m - 1, d).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000);
      isScheduled = diffDays >= 0 && diffDays % (med.intervalDays || 1) === 0;
    }

    if (!isScheduled) return 'not_scheduled';

    const dayLogs = doseLogs.filter(l => l.medicationId === medId && l.date === dateStr && !l.isOnDemand);
    if (dayLogs.length === 0) {
      // If it's today or in future, pending might not be missed yet
      if (dateStr > todayStr) return 'not_scheduled';
      return 'missed';
    }

    const takenCount = dayLogs.filter(l => l.status === 'taken').length;
    const missedCount = dayLogs.filter(l => l.status === 'missed' || l.status === 'skipped').length;

    if (takenCount === dayLogs.length) return 'taken';
    if (missedCount === dayLogs.length) return 'missed';
    return 'partial';
  };

  // Generate Doctor Summary
  const handleExportDoctorSummary = async () => {
    setIsGeneratingPdf(true);
    let start = addDays(todayStr, -30);
    let end = todayStr;

    if (summaryRangeType === '7') start = addDays(todayStr, -7);
    else if (summaryRangeType === '30') start = addDays(todayStr, -30);
    else if (summaryRangeType === '90') start = addDays(todayStr, -90);
    else if (summaryRangeType === 'custom') {
      start = customStartDate;
      end = customEndDate;
    }

    try {
      const { blob, filename } = await generateDoctorSummaryPDF({
        startDate: start,
        endDate: end,
        medications,
        doseLogs,
        weightEntries,
        targetWeightKg: targetWeight,
        weightUnit: unit,
      });

      await shareDoctorSummary(blob, filename);
      setIsDoctorSummaryOpen(false);
    } catch (e) {
      console.error('PDF export failed', e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Target Weight save
  const handleSaveTargetWeight = () => {
    const val = parseFloat(targetWeightInput);
    if (!isNaN(val) && val > 0) {
      const newSettings = { ...settings, targetWeightKg: Math.round(val * 10) / 10 };
      saveStoredSettings(newSettings);
      setIsTargetWeightModalOpen(false);
      onRefreshData();
    }
  };

  // Weight Entry CRUD in full history modal
  const handleSaveWeightEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newWeightVal);
    if (isNaN(val) || val <= 0) return;

    let updated = [...weightEntries];
    if (editingWeight) {
      updated = updated.map(w =>
        w.id === editingWeight.id
          ? {
              ...w,
              weightKg: val,
              date: newWeightDate,
              time: newWeightTime,
              timestamp: new Date(`${newWeightDate}T${newWeightTime}:00`).getTime(),
            }
          : w
      );
    } else {
      updated.push({
        id: `w_${Date.now()}`,
        weightKg: val,
        date: newWeightDate,
        time: newWeightTime,
        timestamp: new Date(`${newWeightDate}T${newWeightTime}:00`).getTime(),
      });
    }

    saveStoredWeightEntries(updated);
    setEditingWeight(null);
    setNewWeightVal('');
    onRefreshData();
  };

  const handleDeleteWeightEntry = (id: string) => {
    const updated = weightEntries.filter(w => w.id !== id);
    saveStoredWeightEntries(updated);
    onRefreshData();
  };

  // Calculate 4-week (28 days) average weekly weight trend
  const fourWeeksAgoDate = addDays(todayStr, -28);
  const weightsLast4Weeks = sortedWeights.filter(w => w.date >= fourWeeksAgoDate);
  
  let weeklyTrendText: string | null = null;
  let weeklyTrendDirection: 'down' | 'up' | 'neutral' = 'neutral';

  if (weightsLast4Weeks.length >= 2) {
    const oldest4W = weightsLast4Weeks[0];
    const newest4W = weightsLast4Weeks[weightsLast4Weeks.length - 1];
    const [y1, m1, d1] = oldest4W.date.split('-').map(Number);
    const [y2, m2, d2] = newest4W.date.split('-').map(Number);
    const t1 = new Date(y1, m1 - 1, d1).getTime();
    const t2 = new Date(y2, m2 - 1, d2).getTime();
    const daySpan = Math.max(1, Math.round((t2 - t1) / (1000 * 60 * 60 * 24)));
    const totalDiff = newest4W.weightKg - oldest4W.weightKg;
    const weeklyRate = (totalDiff / daySpan) * 7;
    const roundedRate = Math.round(weeklyRate * 10) / 10;

    if (roundedRate < -0.05) {
      weeklyTrendDirection = 'down';
      weeklyTrendText = `${roundedRate.toFixed(1)} ${unit}/wk`;
    } else if (roundedRate > 0.05) {
      weeklyTrendDirection = 'up';
      weeklyTrendText = `+${roundedRate.toFixed(1)} ${unit}/wk`;
    } else {
      weeklyTrendDirection = 'neutral';
      weeklyTrendText = `0.0 ${unit}/wk`;
    }
  }

  // Calculate 7-day SVG weight coordinates
  const last7Weights = sortedWeights.filter(w => w.date >= addDays(todayStr, -7));
  const renderWeightSvg = () => {
    const chartHeight = 110;
    const chartWidth = 320;
    const padding = 20;

    const weights = last7Weights.map(w => w.weightKg);
    if (weights.length === 0) {
      return (
        <div className="h-28 flex items-center justify-center text-xs text-zinc-500">
          No weight entries in the past 7 days
        </div>
      );
    }

    const allValues = [...weights, targetWeight];
    const minW = Math.min(...allValues) - 0.5;
    const maxW = Math.max(...allValues) + 0.5;
    const range = maxW - minW || 1;

    const points = last7Weights.map((w, idx) => {
      const x = padding + (idx / Math.max(last7Weights.length - 1, 1)) * (chartWidth - padding * 2);
      const y = chartHeight - padding - ((w.weightKg - minW) / range) * (chartHeight - padding * 2);
      return { x, y, weight: w.weightKg, date: w.date };
    });

    const targetY = chartHeight - padding - ((targetWeight - minW) / range) * (chartHeight - padding * 2);

    const pathData = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');

    return (
      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-32 overflow-visible">
          {/* Target line (dashed purple) */}
          <line
            x1={padding}
            y1={targetY}
            x2={chartWidth - padding}
            y2={targetY}
            stroke="#A855F7"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text
            x={chartWidth - padding}
            y={targetY - 5}
            fill="#C084FC"
            fontSize="9"
            fontWeight="bold"
            textAnchor="end"
          >
            Target {targetWeight} {unit}
          </text>

          {/* Area under curve gradient */}
          {points.length > 1 && (
            <path
              d={`${pathData} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`}
              fill="rgba(59, 130, 246, 0.15)"
            />
          )}

          {/* Actual line */}
          <path
            d={pathData}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots and labels */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#3B82F6" stroke="#1C1C1E" strokeWidth="2" />
              <text
                x={p.x}
                y={p.y - 7}
                fill="#E2E8F0"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
              >
                {p.weight}
              </text>
              <text
                x={p.x}
                y={chartHeight - 4}
                fill="#94A3B8"
                fontSize="8"
                textAnchor="middle"
              >
                {p.date.substring(8)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="pb-32 w-full max-w-2xl mx-auto px-4 sm:px-6 select-none">
      {/* Top Header */}
      <header className="pt-3 pb-3 flex items-center justify-between sticky top-0 bg-[#121212]/95 backdrop-blur-md z-30">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Progress</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Adherence & Health Trends</p>
        </div>

        {/* Doctor Summary Share Button */}
        <button
          onClick={() => setIsDoctorSummaryOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-bold transition active:scale-95"
          title="Share Doctor Summary PDF"
        >
          <Share2 className="w-4 h-4" />
          <span>Doctor PDF</span>
        </button>
      </header>

      {/* TABS: CHARTS vs LIST */}
      <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800 mb-4">
        <button
          onClick={() => setActiveTab('charts')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'charts' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Charts</span>
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'list' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <ListFilter className="w-4 h-4" />
          <span>History List</span>
        </button>
      </div>

      {activeTab === 'charts' ? (
        <div className="space-y-4">
          {/* SECTION: SCHEDULED MEDICATIONS (7 DAYS CARDS) */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
              Scheduled Medications (Last 7 Days)
            </h2>

            {scheduledMeds.length === 0 ? (
              <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 text-center text-xs text-zinc-500">
                No scheduled medications currently active.
              </div>
            ) : (
              scheduledMeds.map(med => {
                // Calculate 7-day adherence %
                let takenCount = 0;
                let scheduledCount = 0;
                last7Days.forEach(d => {
                  const s = getDoseDayStatus(med.id, d);
                  if (s !== 'not_scheduled') {
                    scheduledCount++;
                    if (s === 'taken') takenCount++;
                  }
                });
                const adherence = scheduledCount > 0 ? Math.round((takenCount / scheduledCount) * 100) : 100;

                return (
                  <div
                    key={med.id}
                    onClick={() => setSelectedMedForHistory(med)}
                    className="bg-[#1C1C1E] border border-zinc-800/90 rounded-3xl p-4 cursor-pointer hover:border-zinc-700 active:scale-[0.99] transition shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-800 text-blue-400 flex items-center justify-center border border-zinc-700/50 shrink-0">
                          {getMedFormIcon(med.form)}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base leading-tight">
                            {med.name}
                          </h3>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {med.strength} • {med.dosePerIntake}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            adherence >= 80
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {adherence}%
                        </span>
                        <ChevronRight className="w-4 h-4 text-zinc-500" />
                      </div>
                    </div>

                    {/* 7 Days Row */}
                    <div className="grid grid-cols-7 gap-1.5 pt-2 border-t border-zinc-800/60">
                      {last7Days.map(dStr => {
                        const status = getDoseDayStatus(med.id, dStr);
                        const isToday = dStr === todayStr;
                        const [y, m, d] = dStr.split('-').map(Number);
                        const dayLetter = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'narrow' });

                        return (
                          <div
                            key={dStr}
                            className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-center ${
                              isToday ? 'bg-zinc-800/90 border border-blue-500/50' : 'bg-zinc-800/40'
                            }`}
                          >
                            <span className="text-[9px] uppercase font-semibold text-zinc-400 mb-1">
                              {dayLetter}
                            </span>

                            {/* Status Icon */}
                            {status === 'taken' && (
                              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            )}
                            {status === 'missed' && (
                              <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                                <XIcon className="w-3.5 h-3.5" />
                              </div>
                            )}
                            {status === 'not_scheduled' && (
                              <div className="w-5 h-5 flex items-center justify-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                              </div>
                            )}
                            {status === 'partial' && (
                              <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                                <Minus className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* SEPARATE "ON DEMAND" CARD */}
          <div className="bg-[#1C1C1E] border border-zinc-800/90 rounded-3xl p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">On Demand (As Needed)</h3>
                  <p className="text-xs text-zinc-400">Logged only when taken</p>
                </div>
              </div>

              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300">
                {onDemandLogs.length} total intakes
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {onDemandLogs.length === 0 ? (
                <p className="text-xs text-zinc-500 py-3 text-center">
                  No as-needed doses logged yet. Use the '+' button on Today to record one.
                </p>
              ) : (
                onDemandLogs.slice(0, 3).map(log => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/40 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-white">{log.medicationName}</span>
                      <span className="text-zinc-400 ml-1.5">({log.doseAmount})</span>
                      {log.notes && <p className="text-[11px] text-zinc-500 italic">"{log.notes}"</p>}
                    </div>
                    <span className="text-zinc-400 font-mono text-[11px]">
                      {log.date}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* WEIGHT CARD (Latest, 7-day chart, dashed target, editable target) */}
          <div
            onClick={() => setIsWeightHistoryOpen(true)}
            className="bg-[#1C1C1E] border border-zinc-800/90 rounded-3xl p-4 shadow-sm cursor-pointer hover:border-zinc-700 transition"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">Weight Tracking</h3>
                    {weeklyTrendText && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          weeklyTrendDirection === 'down'
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : weeklyTrendDirection === 'up'
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}
                        title="Average weekly weight change based on the last 4 weeks"
                      >
                        {weeklyTrendDirection === 'down' ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : weeklyTrendDirection === 'up' ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : null}
                        <span>Trend {weeklyTrendText}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">
                    Target: <span className="text-purple-400 font-bold">{targetWeight} {unit}</span>
                  </p>
                </div>
              </div>

              <div className="text-right">
                {latestWeight ? (
                  <div>
                    <span className="text-xl font-black text-white">
                      {latestWeight.weightKg} <span className="text-xs font-normal text-zinc-400">{unit}</span>
                    </span>
                    <p className="text-[10px] text-zinc-400">
                      {latestWeight.date} {latestWeight.time}
                    </p>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500">No entries yet</span>
                )}
              </div>
            </div>

            {/* 7-Day SVG Line Chart */}
            <div className="pt-3">
              {renderWeightSvg()}
            </div>

            <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs text-blue-400 font-semibold">
              <span>View full weight history & edit target</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: LIST VIEW */
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
            Activity Log (Past 30 Days)
          </h2>

          {doseLogs.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs bg-zinc-900/40 rounded-3xl border border-zinc-800">
              No dose logs recorded yet.
            </div>
          ) : (
            doseLogs
              .slice(0, 30)
              .map(log => {
                const isTaken = log.status === 'taken';
                const isMissed = log.status === 'missed';
                const isSkipped = log.status === 'skipped';

                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-[#1C1C1E] border border-zinc-800/70"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isTaken
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : isMissed
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {isTaken ? <Check className="w-4 h-4" /> : isMissed ? <XIcon className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                      </div>

                      <div>
                        <h4 className="font-bold text-white text-sm">
                          {log.medicationName} {log.medicationStrength}
                        </h4>
                        <p className="text-xs text-zinc-400">
                          {log.doseAmount} • {log.date} {log.scheduledTime ? `at ${formatTime(log.scheduledTime)}` : '(On Demand)'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        isTaken
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : isMissed
                          ? 'text-rose-400 bg-rose-500/10'
                          : 'text-amber-400 bg-amber-500/10'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* MODAL 1: FULL HISTORY BY MONTH FOR A MEDICATION */}
      {selectedMedForHistory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-xl bg-[#1C1C1E] border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    {selectedMedForHistory.name}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {selectedMedForHistory.strength} • Adherence History
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMedForHistory(null)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Past 30 Days Adherence Breakdown */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {(() => {
                const logs = doseLogs.filter(l => l.medicationId === selectedMedForHistory.id && !l.isOnDemand);
                const taken = logs.filter(l => l.status === 'taken').length;
                const missed = logs.filter(l => l.status === 'missed').length;
                const skipped = logs.filter(l => l.status === 'skipped').length;
                const total = logs.length || 1;
                const pct = Math.round((taken / total) * 100);

                return (
                  <>
                    <div className="p-3 bg-zinc-800/60 rounded-2xl border border-zinc-700/40">
                      <div className="text-lg font-black text-emerald-400">{pct}%</div>
                      <div className="text-[10px] text-zinc-400 uppercase font-semibold">Adherence</div>
                    </div>
                    <div className="p-3 bg-zinc-800/60 rounded-2xl border border-zinc-700/40">
                      <div className="text-lg font-black text-white">{taken}</div>
                      <div className="text-[10px] text-zinc-400 uppercase font-semibold">Taken</div>
                    </div>
                    <div className="p-3 bg-zinc-800/60 rounded-2xl border border-zinc-700/40">
                      <div className="text-lg font-black text-rose-400">{missed + skipped}</div>
                      <div className="text-[10px] text-zinc-400 uppercase font-semibold">Missed / Skip</div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* List of recent logs for this medication */}
            <div className="mt-5 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Recent Intakes</h4>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {doseLogs
                  .filter(l => l.medicationId === selectedMedForHistory.id)
                  .slice(0, 20)
                  .map(log => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/50 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white">{log.date}</span>
                        <span className="text-zinc-400 ml-2">
                          {log.scheduledTime ? formatTime(log.scheduledTime) : 'As Needed'}
                        </span>
                      </div>
                      <span
                        className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded ${
                          log.status === 'taken'
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-rose-400 bg-rose-500/10'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: FULL WEIGHT HISTORY (ADD / EDIT / DELETE & EDIT TARGET) */}
      {isWeightHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-xl bg-[#1C1C1E] border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Scale className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Weight Management</h3>
              </div>
              <button
                onClick={() => {
                  setIsWeightHistoryOpen(false);
                  setEditingWeight(null);
                }}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Target Weight quick edit card */}
            <div className="mt-4 p-3 bg-zinc-800/60 rounded-2xl border border-zinc-700/40 flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400">Target Weight</span>
                <p className="text-base font-bold text-purple-300">
                  {targetWeight} {unit}
                </p>
              </div>
              <button
                onClick={() => {
                  setTargetWeightInput(targetWeight.toString());
                  setIsTargetWeightModalOpen(true);
                }}
                className="px-3 py-1.5 bg-purple-600/30 text-purple-300 hover:bg-purple-600/50 rounded-xl text-xs font-semibold"
              >
                Edit Target
              </button>
            </div>

            {/* Add or Edit Weight Entry form */}
            <form onSubmit={handleSaveWeightEntry} className="mt-4 p-3.5 bg-zinc-900/60 rounded-2xl border border-zinc-800/80 space-y-3">
              <div className="text-xs font-bold text-white">
                {editingWeight ? 'Edit Entry' : 'Log New Measurement'}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <input
                    type="number"
                    step="0.1"
                    placeholder={`Weight (${unit})`}
                    value={newWeightVal}
                    onChange={e => setNewWeightVal(e.target.value)}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-bold"
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="date"
                    value={newWeightDate}
                    onChange={e => setNewWeightDate(e.target.value)}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="time"
                    value={newWeightTime}
                    onChange={e => setNewWeightTime(e.target.value)}
                    required
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 font-bold text-xs rounded-xl text-white transition"
                >
                  {editingWeight ? 'Update Weight' : '+ Add Entry'}
                </button>
                {editingWeight && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWeight(null);
                      setNewWeightVal('');
                    }}
                    className="px-3 py-2 bg-zinc-800 text-zinc-300 font-bold text-xs rounded-xl hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* Weight Entries List */}
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Logged Measurements ({weightEntries.length})
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {weightEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-zinc-800/40 border border-zinc-700/30"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">
                        {entry.weightKg} {unit}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {entry.date} at {entry.time}
                        {entry.notes && ` • ${entry.notes}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingWeight(entry);
                          setNewWeightVal(entry.weightKg.toString());
                          setNewWeightDate(entry.date);
                          setNewWeightTime(entry.time);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-700"
                        title="Edit entry"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteWeightEntry(entry.id)}
                        className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-zinc-700"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TARGET WEIGHT EDIT MODAL */}
      {isTargetWeightModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-3xl p-5 text-center">
            <h3 className="text-base font-bold text-white">Set Target Weight</h3>
            <p className="text-xs text-zinc-400 mt-1 mb-4">Target line on 7-day progress charts</p>

            <div className="relative mb-4">
              <input
                type="number"
                step="0.1"
                value={targetWeightInput}
                onChange={e => setTargetWeightInput(e.target.value)}
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-lg font-bold text-white text-center focus:outline-none focus:border-purple-500"
              />
              <span className="absolute right-3 top-3 text-sm text-zinc-400">{unit}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setIsTargetWeightModalOpen(false)}
                className="py-2.5 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTargetWeight}
                className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white"
              >
                Save Target
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCTOR SUMMARY PDF MODAL */}
      {isDoctorSummaryOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-xl bg-[#1C1C1E] border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl text-zinc-100">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Export Doctor Summary PDF</h3>
              </div>
              <button
                onClick={() => setIsDoctorSummaryOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 mt-3">
              Generates an uninterpreted, clean medical PDF summarizing all scheduled medications, adherence percentages, missed doses, and weight logs for your physician visit.
            </p>

            {/* Date range picker */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Select Time Window
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: '7', label: '7 Days' },
                  { id: '30', label: '30 Days' },
                  { id: '90', label: '90 Days' },
                  { id: 'custom', label: 'Custom' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSummaryRangeType(item.id as any)}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      summaryRangeType === item.id
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {summaryRangeType === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">From Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">To Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2 text-xs text-white"
                  />
                </div>
              </div>
            )}

            <div className="mt-6 pt-3 border-t border-zinc-800">
              <button
                onClick={handleExportDoctorSummary}
                disabled={isGeneratingPdf}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 font-bold text-sm text-white rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50 active:scale-[0.98]"
              >
                <Share2 className="w-4 h-4" />
                <span>{isGeneratingPdf ? 'Compiling PDF...' : 'Generate & Share PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
