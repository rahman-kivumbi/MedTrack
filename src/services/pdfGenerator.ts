import { jsPDF } from 'jspdf';
import { Medication, DoseLog, WeightEntry } from '../types';
import { formatTime } from './storage';

export interface DoctorSummaryData {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  medications: Medication[];
  doseLogs: DoseLog[];
  weightEntries: WeightEntry[];
  targetWeightKg?: number;
  weightUnit?: string;
}

export async function generateDoctorSummaryPDF(data: DoctorSummaryData): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors
  const primaryColor: [number, number, number] = [30, 58, 138]; // Deep Navy
  const textColor: [number, number, number] = [33, 37, 41];
  const mutedColor: [number, number, number] = [100, 116, 139];
  const accentRed: [number, number, number] = [220, 38, 38];
  const accentGreen: [number, number, number] = [22, 163, 74];

  // Helper for page break
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...primaryColor);
  doc.text('Patient Medication & Health Log', margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text(`Reporting Period: ${data.startDate} to ${data.endDate} | Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, margin, y);
  y += 4;
  doc.text('Note: This document contains only patient-entered records. No clinical interpretations are provided.', margin, y);
  y += 8;

  // Horizontal divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // SECTION 1: Active & Scheduled Medications with Adherence
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryColor);
  doc.text('1. Medications & Adherence Overview', margin, y);
  y += 6;

  // Filter logs within range
  const logsInRange = data.doseLogs.filter(l => l.date >= data.startDate && l.date <= data.endDate);

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...textColor);

  doc.text('Medication', margin + 3, y + 5);
  doc.text('Dose & Form', margin + 55, y + 5);
  doc.text('Schedule', margin + 95, y + 5);
  doc.text('Adherence', margin + 145, y + 5);
  y += 9;

  for (const med of data.medications) {
    checkPageBreak(12);

    const medLogs = logsInRange.filter(l => l.medicationId === med.id && !l.isOnDemand);
    const takenCount = medLogs.filter(l => l.status === 'taken').length;
    const totalScheduled = medLogs.length;
    const adherencePercent = totalScheduled > 0 ? Math.round((takenCount / totalScheduled) * 100) : 100;

    let scheduleDesc = '';
    if (med.scheduleType === 'every_day') {
      scheduleDesc = `Daily: ${med.scheduledTimes.map(formatTime).join(', ')}`;
    } else if (med.scheduleType === 'as_needed') {
      const onDemandLogs = logsInRange.filter(l => l.medicationId === med.id && l.isOnDemand);
      scheduleDesc = `As needed (${onDemandLogs.length} taken)`;
    } else if (med.scheduleType === 'specific_days') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      scheduleDesc = (med.weekdays || []).map(d => days[d]).join(', ');
    } else {
      scheduleDesc = `Every ${med.intervalDays || 1} day(s)`;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text(`${med.name} ${med.strength}`, margin + 3, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`${med.dosePerIntake} (${med.form})`, margin + 55, y + 4);

    doc.setFontSize(8);
    doc.text(scheduleDesc.substring(0, 30), margin + 95, y + 4);

    if (med.scheduleType === 'as_needed') {
      doc.setTextColor(...mutedColor);
      doc.text('On demand', margin + 145, y + 4);
    } else {
      if (adherencePercent >= 80) {
        doc.setTextColor(...accentGreen);
      } else {
        doc.setTextColor(...accentRed);
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`${adherencePercent}% (${takenCount}/${totalScheduled})`, margin + 145, y + 4);
    }

    // Row bottom line
    y += 7;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;
  }

  y += 4;

  // SECTION 2: Recorded Missed or Skipped Doses
  checkPageBreak(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryColor);
  doc.text('2. Missed & Skipped Doses Log', margin, y);
  y += 6;

  const missedOrSkippedLogs = logsInRange
    .filter(l => (l.status === 'missed' || l.status === 'skipped') && !l.isOnDemand)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (missedOrSkippedLogs.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    doc.text('No missed or skipped doses were recorded during this period.', margin + 3, y + 4);
    y += 10;
  } else {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...textColor);
    doc.text('Date', margin + 3, y + 5);
    doc.text('Time', margin + 35, y + 5);
    doc.text('Medication', margin + 65, y + 5);
    doc.text('Status', margin + 140, y + 5);
    y += 9;

    for (const log of missedOrSkippedLogs) {
      checkPageBreak(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...textColor);
      doc.text(log.date, margin + 3, y + 4);
      doc.text(formatTime(log.scheduledTime || ''), margin + 35, y + 4);
      doc.text(`${log.medicationName} (${log.doseAmount})`, margin + 65, y + 4);

      if (log.status === 'missed') {
        doc.setTextColor(...accentRed);
        doc.setFont('helvetica', 'bold');
        doc.text('Missed', margin + 140, y + 4);
      } else {
        doc.setTextColor(217, 119, 6); // amber
        doc.text('Skipped', margin + 140, y + 4);
      }

      y += 6;
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y, pageWidth - margin, y);
      y += 2;
    }
    y += 4;
  }

  // SECTION 3: Weight Tracking & Simple Trend Chart
  checkPageBreak(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryColor);
  doc.text('3. Weight History & Target', margin, y);
  y += 6;

  const weightsInRange = data.weightEntries
    .filter(w => w.date >= data.startDate && w.date <= data.endDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (weightsInRange.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    doc.text('No weight measurements were recorded during this period.', margin + 3, y + 4);
    y += 10;
  } else {
    const unit = data.weightUnit || 'kg';
    const latest = weightsInRange[weightsInRange.length - 1];
    const first = weightsInRange[0];
    const diff = (latest.weightKg - first.weightKg).toFixed(1);
    const target = data.targetWeightKg;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    let summaryText = `Starting: ${first.weightKg.toFixed(1)} ${unit} (${first.date})  |  Latest: ${latest.weightKg.toFixed(1)} ${unit} (${latest.date})  |  Change: ${Number(diff) > 0 ? '+' : ''}${diff} ${unit}`;
    if (target) {
      summaryText += `  |  Target: ${target.toFixed(1)} ${unit}`;
    }
    doc.text(summaryText, margin + 3, y + 4);
    y += 8;

    // Simple vector line chart in PDF
    const chartHeight = 35;
    const chartWidth = contentWidth;
    const chartX = margin;
    const chartY = y;

    // Chart Background
    doc.setFillColor(248, 250, 252);
    doc.rect(chartX, chartY, chartWidth, chartHeight, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(chartX, chartY, chartWidth, chartHeight, 'S');

    const weightValues = weightsInRange.map(w => w.weightKg);
    if (target) weightValues.push(target);
    const minW = Math.floor(Math.min(...weightValues) - 1);
    const maxW = Math.ceil(Math.max(...weightValues) + 1);
    const rangeW = maxW - minW || 1;

    // Draw target line if available
    if (target) {
      const targetY = chartY + chartHeight - ((target - minW) / rangeW) * (chartHeight - 8) - 4;
      doc.setDrawColor(168, 85, 247); // purple
      doc.setLineWidth(0.4);
      // Dashed line
      for (let x = chartX + 15; x < chartX + chartWidth - 10; x += 4) {
        doc.line(x, targetY, x + 2, targetY);
      }
      doc.setFontSize(7);
      doc.setTextColor(168, 85, 247);
      doc.text(`Target: ${target} ${unit}`, chartX + chartWidth - 32, targetY - 1);
    }

    // Plot weights
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.8);
    const points: [number, number][] = [];

    const stepX = (chartWidth - 30) / Math.max(weightsInRange.length - 1, 1);
    for (let i = 0; i < weightsInRange.length; i++) {
      const entry = weightsInRange[i];
      const px = chartX + 15 + i * stepX;
      const py = chartY + chartHeight - ((entry.weightKg - minW) / rangeW) * (chartHeight - 8) - 4;
      points.push([px, py]);
    }

    for (let i = 0; i < points.length - 1; i++) {
      doc.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
    }

    // Points & labels
    doc.setFillColor(37, 99, 235);
    for (let i = 0; i < points.length; i++) {
      const [px, py] = points[i];
      doc.circle(px, py, 1.2, 'F');

      if (weightsInRange.length <= 10 || i === 0 || i === points.length - 1) {
        doc.setFontSize(6.5);
        doc.setTextColor(...textColor);
        doc.text(`${weightsInRange[i].weightKg.toFixed(1)}`, px - 4, py - 3);
        doc.setFontSize(5.5);
        doc.setTextColor(...mutedColor);
        doc.text(weightsInRange[i].date.substring(5), px - 4, chartY + chartHeight - 1);
      }
    }

    y += chartHeight + 8;
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.text(
      `MedTrack Health Record • Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  const filename = `MedTrack_Doctor_Summary_${data.startDate}_to_${data.endDate}.pdf`;
  const blob = doc.output('blob');
  return { blob, filename };
}

export async function shareDoctorSummary(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: 'application/pdf' });

  // Try Android / Web Share API with files
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'MedTrack Doctor Summary',
        text: 'Doctor Summary Report from MedTrack',
        files: [file],
      });
      return true;
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        console.warn('Native share failed, falling back to download', err);
      }
    }
  }

  // Fallback: Trigger browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
  return true;
}
