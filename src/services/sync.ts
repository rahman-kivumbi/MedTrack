import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, User } from './firebase';
import { Medication, DoseLog, WeightEntry, UserSettings, MedicalAppointment } from '../types';
import { 
  getStoredMedications, 
  saveStoredMedications, 
  getStoredDoseLogs, 
  saveStoredDoseLogs, 
  getStoredWeightEntries, 
  saveStoredWeightEntries, 
  getStoredSettings,
  getStoredAppointments,
  saveStoredAppointments
} from './storage';

// Helper to remove undefined keys so Firestore doesn't reject document payloads
function cleanObject<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// Ensure ID contains only characters allowed by security rules
function sanitizeId(id: string): string {
  if (!id) return `id_${Date.now()}`;
  return id.replace(/[^a-zA-Z0-9_\-:@.]/g, '_').substring(0, 120);
}

export async function syncUserDataWithCloud(user: User): Promise<{ syncedMeds: number; syncedLogs: number; syncedWeights: number }> {
  const userId = user.uid;
  const userRef = doc(db, 'users', userId);

  try {
    // 1. Update user profile document
    await setDoc(userRef, cleanObject({
      userId,
      displayName: user.displayName || 'User',
      email: user.email || '',
      photoURL: user.photoURL || '',
      updatedAt: new Date().toISOString(),
    }), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }

  // 2. Fetch existing cloud data
  const cloudMeds: Medication[] = [];
  const cloudLogs: DoseLog[] = [];
  const cloudWeights: WeightEntry[] = [];
  const cloudAppts: MedicalAppointment[] = [];

  try {
    const medsSnap = await getDocs(collection(db, 'users', userId, 'medications'));
    medsSnap.forEach(d => {
      cloudMeds.push(d.data() as Medication);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/medications`);
  }

  try {
    const logsSnap = await getDocs(collection(db, 'users', userId, 'doseLogs'));
    logsSnap.forEach(d => {
      cloudLogs.push(d.data() as DoseLog);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/doseLogs`);
  }

  try {
    const weightsSnap = await getDocs(collection(db, 'users', userId, 'weights'));
    weightsSnap.forEach(d => {
      cloudWeights.push(d.data() as WeightEntry);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/weights`);
  }

  try {
    const apptsSnap = await getDocs(collection(db, 'users', userId, 'appointments'));
    apptsSnap.forEach(d => {
      cloudAppts.push(d.data() as MedicalAppointment);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/appointments`);
  }

  // 3. Local data
  const localMeds = getStoredMedications();
  const localLogs = getStoredDoseLogs();
  const localWeights = getStoredWeightEntries();
  const localAppts = getStoredAppointments();
  const localSettings = getStoredSettings();

  // 4. Merge medications (deduplicate by id)
  const mergedMedsMap = new Map<string, Medication>();
  cloudMeds.forEach(m => mergedMedsMap.set(m.id, m));
  localMeds.forEach(m => {
    const existing = mergedMedsMap.get(m.id);
    if (!existing || (m.updatedAt && (!existing.updatedAt || m.updatedAt > existing.updatedAt))) {
      mergedMedsMap.set(m.id, m);
    }
  });
  const finalMeds = Array.from(mergedMedsMap.values());
  saveStoredMedications(finalMeds);

  // 5. Merge dose logs
  const mergedLogsMap = new Map<string, DoseLog>();
  cloudLogs.forEach(l => mergedLogsMap.set(l.id, l));
  localLogs.forEach(l => mergedLogsMap.set(l.id, l));
  const finalLogs = Array.from(mergedLogsMap.values());
  saveStoredDoseLogs(finalLogs);

  // 6. Merge weights
  const mergedWeightsMap = new Map<string, WeightEntry>();
  cloudWeights.forEach(w => mergedWeightsMap.set(w.id, w));
  localWeights.forEach(w => mergedWeightsMap.set(w.id, w));
  const finalWeights = Array.from(mergedWeightsMap.values());
  saveStoredWeightEntries(finalWeights);

  // 6b. Merge appointments
  const mergedApptsMap = new Map<string, MedicalAppointment>();
  cloudAppts.forEach(a => mergedApptsMap.set(a.id, a));
  localAppts.forEach(a => {
    const existing = mergedApptsMap.get(a.id);
    if (!existing || (a.updatedAt && (!existing.updatedAt || a.updatedAt > existing.updatedAt))) {
      mergedApptsMap.set(a.id, a);
    }
  });
  const finalAppts = Array.from(mergedApptsMap.values());
  saveStoredAppointments(finalAppts);

  // 7. Push local to cloud in batches
  try {
    const batch = writeBatch(db);

    for (const med of finalMeds) {
      const docId = sanitizeId(med.id);
      const medDoc = doc(db, 'users', userId, 'medications', docId);
      batch.set(medDoc, cleanObject({ ...med, id: docId, userId }));
    }

    for (const log of finalLogs.slice(0, 100)) {
      const docId = sanitizeId(log.id);
      const logDoc = doc(db, 'users', userId, 'doseLogs', docId);
      batch.set(logDoc, cleanObject({ ...log, id: docId, userId }));
    }

    for (const weight of finalWeights.slice(0, 50)) {
      const docId = sanitizeId(weight.id);
      const weightDoc = doc(db, 'users', userId, 'weights', docId);
      batch.set(weightDoc, cleanObject({ ...weight, id: docId, userId }));
    }

    for (const appt of finalAppts.slice(0, 50)) {
      const docId = sanitizeId(appt.id);
      const apptDoc = doc(db, 'users', userId, 'appointments', docId);
      batch.set(apptDoc, cleanObject({ ...appt, id: docId, userId }));
    }

    const settingsDoc = doc(db, 'users', userId, 'settings', 'current');
    batch.set(settingsDoc, cleanObject({
      userId,
      targetWeightKg: localSettings.targetWeightKg || 70,
      weightUnit: localSettings.weightUnit || 'kg',
      gracePeriodMinutes: localSettings.gracePeriodMinutes || 120,
      updatedAt: Date.now(),
    }));

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/batch_sync`);
  }

  return {
    syncedMeds: finalMeds.length,
    syncedLogs: finalLogs.length,
    syncedWeights: finalWeights.length,
  };
}

export async function syncSingleMedication(userId: string, med: Medication): Promise<void> {
  const docId = sanitizeId(med.id);
  try {
    const medDoc = doc(db, 'users', userId, 'medications', docId);
    await setDoc(medDoc, cleanObject({ ...med, id: docId, userId }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/medications/${docId}`);
  }
}

export async function deleteSingleMedication(userId: string, medId: string): Promise<void> {
  const docId = sanitizeId(medId);
  try {
    const medDoc = doc(db, 'users', userId, 'medications', docId);
    await deleteDoc(medDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/medications/${docId}`);
  }
}

export async function syncSingleDoseLog(userId: string, log: DoseLog): Promise<void> {
  const docId = sanitizeId(log.id);
  try {
    const logDoc = doc(db, 'users', userId, 'doseLogs', docId);
    await setDoc(logDoc, cleanObject({ ...log, id: docId, userId }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/doseLogs/${docId}`);
  }
}

export async function syncSingleWeight(userId: string, weight: WeightEntry): Promise<void> {
  const docId = sanitizeId(weight.id);
  try {
    const weightDoc = doc(db, 'users', userId, 'weights', docId);
    await setDoc(weightDoc, cleanObject({ ...weight, id: docId, userId }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/weights/${docId}`);
  }
}

export async function syncSingleAppointment(userId: string, appt: MedicalAppointment): Promise<void> {
  const docId = sanitizeId(appt.id);
  try {
    const apptDoc = doc(db, 'users', userId, 'appointments', docId);
    await setDoc(apptDoc, cleanObject({ ...appt, id: docId, userId }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/appointments/${docId}`);
  }
}

export async function deleteSingleAppointment(userId: string, apptId: string): Promise<void> {
  const docId = sanitizeId(apptId);
  try {
    const apptDoc = doc(db, 'users', userId, 'appointments', docId);
    await deleteDoc(apptDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/appointments/${docId}`);
  }
}
