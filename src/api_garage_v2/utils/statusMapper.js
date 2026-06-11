/**
 * Status Mapping Utilities
 * Maps statuses between Garage System ↔ SkySoft ↔ Motive API
 * 
 * Status Flow:
 * Garage System → mapGarageToSkySoft() → SkySoft Database
 * SkySoft Database → mapSkySoftToMotive() → Motive API
 */

/**
 * Map Garage status to SkySoft status
 * 
 * Garage statuses (from external garage systems):
 * - Open
 * - In_Progress
 * - Completed
 * - Approved
 * - Cancelled
 * - On_Hold
 * 
 * SkySoft statuses (internal database):
 * - Open
 * - In Progress
 * - Completed
 * - Manager Approved
 * - Cancelled
 * - On Hold
 * 
 * @param {string} garageStatus - Status from garage system
 * @returns {string} SkySoft status
 */
function mapGarageToSkySoft(garageStatus) {
  const mapping = {
    'Open': 'Open',
    'In_Progress': 'In Progress',
    'Completed': 'Manager Approved', // ⚠️ IMPORTANT: Garage "Completed" auto-approves in SkySoft
    'Approved': 'Manager Approved',
    'Cancelled': 'Cancelled',
    'On_Hold': 'On Hold'
  };

  const mapped = mapping[garageStatus];
  
  if (!mapped) {
    console.warn(`⚠️ Unknown garage status: "${garageStatus}", defaulting to "Open"`);
    return 'Open';
  }

  return mapped;
}

/**
 * Map SkySoft status to Motive API status
 * 
 * SkySoft statuses → Motive statuses:
 * - Open → unresolved
 * - In Progress → in_progress
 * - Completed → resolved
 * - Manager Approved → resolved
 * - Cancelled → cancelled
 * - On Hold → unresolved
 * 
 * @param {string} skySoftStatus - SkySoft internal status
 * @returns {string} Motive API status
 */
function mapSkySoftToMotive(skySoftStatus) {
  const mapping = {
    'Open': 'unresolved',
    'In Progress': 'in_progress',
    'Completed': 'resolved',
    'Manager Approved': 'resolved',
    'Cancelled': 'cancelled',
    'On Hold': 'unresolved'
  };

  const mapped = mapping[skySoftStatus];
  
  if (!mapped) {
    console.warn(`⚠️ Unknown SkySoft status: "${skySoftStatus}", defaulting to "unresolved"`);
    return 'unresolved';
  }

  return mapped;
}

/**
 * Map Garage status directly to Motive status (convenience method)
 * 
 * @param {string} garageStatus - Status from garage system
 * @returns {string} Motive API status
 */
function mapGarageToMotive(garageStatus) {
  const skySoftStatus = mapGarageToSkySoft(garageStatus);
  return mapSkySoftToMotive(skySoftStatus);
}

/**
 * Validate garage status
 * 
 * @param {string} status - Status to validate
 * @returns {boolean} True if valid
 */
function isValidGarageStatus(status) {
  const validStatuses = ['Open', 'In_Progress', 'Completed', 'Approved', 'Cancelled', 'On_Hold'];
  return validStatuses.includes(status);
}

/**
 * Validate SkySoft status
 * 
 * @param {string} status - Status to validate
 * @returns {boolean} True if valid
 */
function isValidSkySoftStatus(status) {
  const validStatuses = ['Open', 'In Progress', 'Completed', 'Manager Approved', 'Cancelled', 'On Hold'];
  return validStatuses.includes(status);
}

/**
 * Get all valid garage statuses
 * 
 * @returns {string[]} Array of valid statuses
 */
function getValidGarageStatuses() {
  return ['Open', 'In_Progress', 'Completed', 'Approved', 'Cancelled', 'On_Hold'];
}

/**
 * Get all valid SkySoft statuses
 * 
 * @returns {string[]} Array of valid statuses
 */
function getValidSkySoftStatuses() {
  return ['Open', 'In Progress', 'Completed', 'Manager Approved', 'Cancelled', 'On Hold'];
}

/**
 * Check if status represents a completed state
 * 
 * @param {string} status - Status to check (can be Garage or SkySoft format)
 * @returns {boolean} True if status represents completion
 */
function isCompletedStatus(status) {
  const completedStatuses = ['Completed', 'Manager Approved', 'Approved'];
  return completedStatuses.includes(status);
}

/**
 * Check if status represents an active state (not cancelled/completed)
 * 
 * @param {string} status - Status to check (can be Garage or SkySoft format)
 * @returns {boolean} True if status represents active work
 */
function isActiveStatus(status) {
  const activeStatuses = ['Open', 'In_Progress', 'In Progress', 'On_Hold', 'On Hold'];
  return activeStatuses.includes(status);
}

module.exports = {
  mapGarageToSkySoft,
  mapSkySoftToMotive,
  mapGarageToMotive,
  isValidGarageStatus,
  isValidSkySoftStatus,
  getValidGarageStatuses,
  getValidSkySoftStatuses,
  isCompletedStatus,
  isActiveStatus
};
