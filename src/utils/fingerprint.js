const crypto = require('crypto');

/**
 * Creates a fingerprint for duplicate detection.
 * Two submissions with same email and highly similar text → same fingerprint.
 */
const createFingerprint = (email, text) => {
  // Normalize text: lowercase, trim, collapse whitespace
  const normalizedText = text.toLowerCase().trim().replace(/\s+/g, ' ');
  const normalizedEmail = email.toLowerCase().trim();
  const raw = `${normalizedEmail}::${normalizedText}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
};

module.exports = { createFingerprint };