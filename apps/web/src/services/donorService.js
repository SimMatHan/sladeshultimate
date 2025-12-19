/**
 * Donor Service
 * 
 * Manages donor data using Firestore with real-time updates.
 * Stores donations with user references (uid) for solid data anchoring.
 */

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Subscribe to real-time donor updates
 * @param {Function} callback - Called with sorted donor array on each update
 * @param {Function} onError - Called on error
 * @returns {Function} Unsubscribe function
 */
export function subscribeToDonors(callback, onError) {
  const donorsRef = collection(db, 'donations');
  const q = query(donorsRef, orderBy('amount', 'desc'), orderBy('date', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const donors = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        // Convert Firestore Timestamps to Date objects for display
        date: docSnap.data().date?.toDate?.() || new Date(docSnap.data().date),
        createdAt: docSnap.data().createdAt?.toDate?.() || new Date(docSnap.data().createdAt),
        updatedAt: docSnap.data().updatedAt?.toDate?.() || new Date(docSnap.data().updatedAt),
      }));
      
      console.info('[donorService] Real-time update received', { count: donors.length });
      callback(donors);
    },
    (error) => {
      console.error('[donorService] Real-time listener error', error);
      if (onError) {
        onError(error);
      }
    }
  );

  return unsubscribe;
}

/**
 * Add a new donor with user reference
 * @param {Object} donorData - Donor data
 * @param {string} donorData.userId - User's Firebase UID
 * @param {string} donorData.userName - User's display name (cached)
 * @param {string} donorData.userInitials - User's initials (cached)
 * @param {Object} donorData.userAvatarGradient - User's avatar gradient (cached)
 * @param {number} donorData.amount - Donation amount in DKK
 * @param {string|Date} donorData.date - Donation date
 * @param {string} [donorData.message] - Optional message
 * @param {string} donorData.createdBy - Admin UID who created this donation
 * @returns {Promise<string>} Document ID of the created donation
 */
export async function addDonor(donorData) {
  const { userId, userName, userInitials, userAvatarGradient, amount, date, message, createdBy } = donorData;

  if (!userId || !userName || !amount || !date || !createdBy) {
    throw new Error('userId, userName, amount, date og createdBy er påkrævet');
  }

  const donorsRef = collection(db, 'donations');
  const payload = {
    userId,
    userName,
    userInitials,
    userAvatarGradient,
    amount: parseFloat(amount),
    date: date instanceof Date ? date : new Date(date),
    message: message?.trim() || null,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(donorsRef, payload);
  console.info('[donorService] Donor created', { id: docRef.id, userId, userName, amount });
  
  return docRef.id;
}

/**
 * Update an existing donor
 * @param {string} donorId - Donor document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateDonor(donorId, updates) {
  if (!donorId) {
    throw new Error('Donor ID er påkrævet');
  }

  const donorRef = doc(db, 'donations', donorId);
  
  // Ensure amount is a number if being updated
  const sanitizedUpdates = { ...updates };
  if (updates.amount !== undefined) {
    sanitizedUpdates.amount = parseFloat(updates.amount);
  }
  
  // Trim message if being updated
  if (updates.message !== undefined) {
    sanitizedUpdates.message = updates.message?.trim() || null;
  }

  // Convert date to Date object if being updated
  if (updates.date && !(updates.date instanceof Date)) {
    sanitizedUpdates.date = new Date(updates.date);
  }

  sanitizedUpdates.updatedAt = serverTimestamp();

  await updateDoc(donorRef, sanitizedUpdates);
  console.info('[donorService] Donor updated', { id: donorId, updates: Object.keys(updates) });
}

/**
 * Delete a donor
 * @param {string} donorId - Donor document ID
 * @returns {Promise<void>}
 */
export async function deleteDonor(donorId) {
  if (!donorId) {
    throw new Error('Donor ID er påkrævet');
  }

  const donorRef = doc(db, 'donations', donorId);
  await deleteDoc(donorRef);
  console.info('[donorService] Donor deleted', { id: donorId });
}

/**
 * Get a single donor by ID
 * @param {string} donorId - Donor document ID
 * @returns {Promise<Object|null>} The donor or null if not found
 */
export async function getDonorById(donorId) {
  if (!donorId) {
    return null;
  }

  const donorRef = doc(db, 'donations', donorId);
  const donorSnap = await getDoc(donorRef);

  if (!donorSnap.exists()) {
    return null;
  }

  const data = donorSnap.data();
  return {
    id: donorSnap.id,
    ...data,
    date: data.date?.toDate?.() || new Date(data.date),
    createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
    updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
  };
}
