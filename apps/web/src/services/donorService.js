/**
 * Donor Service
 * 
 * Manages donor data using localStorage with a Firestore-ready structure.
 * Easy to migrate to Firestore later by swapping the storage implementation.
 */

const STORAGE_KEY = 'sladesh_donors';

/**
 * Generate a unique ID (mimics Firestore auto-generated IDs)
 */
function generateId() {
  return `donor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current timestamp in ISO format (Firestore-compatible)
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Load donors from localStorage
 */
function loadDonors() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[donorService] Failed to load donors from localStorage', error);
    return [];
  }
}

/**
 * Save donors to localStorage
 */
function saveDonors(donors) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(donors));
  } catch (error) {
    console.error('[donorService] Failed to save donors to localStorage', error);
    throw new Error('Kunne ikke gemme donor-data');
  }
}

/**
 * Get all donors, sorted by amount (highest first)
 * @returns {Array} Array of donor objects
 */
export function getDonors() {
  const donors = loadDonors();
  // Sort by amount (highest first), then by date (newest first)
  return donors.sort((a, b) => {
    if (b.amount !== a.amount) {
      return b.amount - a.amount;
    }
    return new Date(b.date) - new Date(a.date);
  });
}

/**
 * Add a new donor
 * @param {Object} donor - Donor data { name, amount, date, message? }
 * @returns {Object} The created donor with id and timestamps
 */
export function addDonor(donor) {
  if (!donor.name || !donor.amount || !donor.date) {
    throw new Error('Navn, beløb og dato er påkrævet');
  }

  const donors = loadDonors();
  const newDonor = {
    id: generateId(),
    name: donor.name.trim(),
    amount: parseFloat(donor.amount),
    date: donor.date,
    message: donor.message?.trim() || null,
    createdAt: getTimestamp(),
    updatedAt: getTimestamp(),
  };

  donors.push(newDonor);
  saveDonors(donors);
  
  console.info('[donorService] Donor created', { id: newDonor.id, name: newDonor.name });
  return newDonor;
}

/**
 * Update an existing donor
 * @param {string} id - Donor ID
 * @param {Object} updates - Fields to update
 * @returns {Object} The updated donor
 */
export function updateDonor(id, updates) {
  const donors = loadDonors();
  const index = donors.findIndex(d => d.id === id);
  
  if (index === -1) {
    throw new Error('Donor ikke fundet');
  }

  const updatedDonor = {
    ...donors[index],
    ...updates,
    id: donors[index].id, // Preserve original ID
    createdAt: donors[index].createdAt, // Preserve creation timestamp
    updatedAt: getTimestamp(),
  };

  // Ensure amount is a number
  if (updates.amount !== undefined) {
    updatedDonor.amount = parseFloat(updates.amount);
  }

  // Trim strings
  if (updates.name) {
    updatedDonor.name = updates.name.trim();
  }
  if (updates.message !== undefined) {
    updatedDonor.message = updates.message?.trim() || null;
  }

  donors[index] = updatedDonor;
  saveDonors(donors);
  
  console.info('[donorService] Donor updated', { id, updates: Object.keys(updates) });
  return updatedDonor;
}

/**
 * Delete a donor
 * @param {string} id - Donor ID
 */
export function deleteDonor(id) {
  const donors = loadDonors();
  const filtered = donors.filter(d => d.id !== id);
  
  if (filtered.length === donors.length) {
    throw new Error('Donor ikke fundet');
  }

  saveDonors(filtered);
  console.info('[donorService] Donor deleted', { id });
}

/**
 * Get a single donor by ID
 * @param {string} id - Donor ID
 * @returns {Object|null} The donor or null if not found
 */
export function getDonorById(id) {
  const donors = loadDonors();
  return donors.find(d => d.id === id) || null;
}
