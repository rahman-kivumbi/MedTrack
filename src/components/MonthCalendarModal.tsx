import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, CheckCircle2, Building2 } from 'lucide-react';
import { getLocalDateString, hasActivityOnDate, getDosesForDate } from '../services/storage';
import { MedicalAppointment } from '../types';

interface MonthCalendarModalProps {
  isOpen: boolean;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  onClose: () => void;
  appointments?: MedicalAppointment[];
}

export const MonthCalendarModal: React.FC<MonthCalendarModalProps> = ({
  isOpen,
  selectedDate,
  onSelectDate,
  onClose,
  appointments = [],
}) => {
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const [y, m] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  if (!isOpen) return null;

  const todayStr = getLocalDateString();
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const prevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const monthName = currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Compute days in month
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Blank slots for previous month
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const prevDate = new Date(year, month - 1, d);
    days.push({
      dateStr: getLocalDateString(prevDate),
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    days.push({
      dateStr: getLocalDateString(dateObj),
      dayNum: d,
      isCurrentMonth: true,
    });
  }

  // Fill up to 35 or 42 slots
  const remaining = 42 - days.length;
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      days.push({
        dateStr: getLocalDateString(nextDate),
        dayNum: d,
        isCurrentMonth: false,
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full sm:max-w-lg bg-[#1C1C1E] border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-bold text-white">Select Date</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between py-4">
          <button
            onClick={prevMonth}
            className="p-2 rounded-full hover:bg-zinc-800 text-zinc-300 hover:text-white transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-base font-semibold text-white tracking-wide">{monthName}</span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-full hover:bg-zinc-800 text-zinc-300 hover:text-white transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-zinc-500 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((item, idx) => {
            const isToday = item.dateStr === todayStr;
            const isSelected = item.dateStr === selectedDate;
            const hasActivity = hasActivityOnDate(item.dateStr);
            const hasAppointment = appointments.some(a => a.date === item.dateStr && a.status === 'scheduled');

            return (
              <button
                key={idx}
                onClick={() => {
                  onSelectDate(item.dateStr);
                  onClose();
                }}
                className={`relative flex flex-col items-center justify-center h-11 rounded-xl text-sm font-medium transition active:scale-95 ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                    : isToday
                    ? 'bg-zinc-800 border border-blue-500 text-blue-400 font-bold'
                    : item.isCurrentMonth
                    ? 'text-zinc-200 hover:bg-zinc-800/70'
                    : 'text-zinc-600 hover:bg-zinc-800/30'
                }`}
              >
                <span>{item.dayNum}</span>

                {/* Activity and appointment indicator dots */}
                <div className="flex items-center gap-1 mt-0.5">
                  {hasActivity && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected
                          ? 'bg-white'
                          : isToday
                          ? 'bg-blue-400'
                          : 'bg-emerald-400'
                      }`}
                    />
                  )}
                  {hasAppointment && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-amber-200' : 'bg-amber-400'
                      }`}
                      title="Hospital visit scheduled"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick jump to Today & Legend */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-2">
          <button
            onClick={() => {
              onSelectDate(todayStr);
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 py-1.5 px-3 rounded-lg hover:bg-blue-600/10 transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Jump to Today
          </button>
          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Meds Taken
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Hospital Visit
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
