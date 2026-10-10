import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { COMPANY_ROLES } from './Membership.js';

/**
 * Invitation — single-use, expiring invite token.
 *
 * Flow:
 *   1. A company_admin POSTs to /api/v1/companies/:id/invitations
 *      with { email, role } — creates an Invitation.
 *   2. The invited user POSTs to /api/v1/companies/:id/join
 *      with { token } — consumed atomically, Membership created, token burned.
 *
 * Security properties:
 *   - Token is a random 32-byte hex string (256 bits of entropy).
 *   - Stored hashed (SHA-256) in the DB; plaintext is returned once on creation.
 *   - Expires after INVITATION_TTL_HOURS (default 72h) — enforced by TTL index
 *     and an explicit application-layer check before redemption.
 *   - Single-use: `usedAt` is set on redemption; a used invitation is rejected.
 *   - Email is lowercased and matched against the joining user's email to prevent
 *     token theft (an invitation is issued to a specific address).
 */

const INVITATION_TTL_HOURS = parseInt(process.env.INVITATION_TTL_HOURS, 10) || 72;

const invitationSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company reference is required'],
    },
    /** Email the invitation was issued to; must match the joining user. */
    email: {
      type: String,
      required: [true, 'Invited email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    /** Role the joining user will receive in the company. */
    role: {
      type: String,
      enum: COMPANY_ROLES,
      required: [true, 'Invitation role is required'],
    },
    /** SHA-256 hash of the plaintext token. Never returned to clients. */
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    /** Set on redemption; null while pending. */
    usedAt: {
      type: Date,
      default: null,
    },
    /** Who sent the invite — for auditing. */
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// TTL index: MongoDB automatically removes expired, unused invitations.
// Used invitations (usedAt != null) should be retained briefly for audit;
// filter them out in application logic rather than relying solely on this index.
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
invitationSchema.index({ company: 1, email: 1 });
invitationSchema.index({ tokenHash: 1 }, { unique: true });

/** Generate a new plaintext token and return both plaintext + hash. */
invitationSchema.statics.generateToken = function () {
  const plaintext = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash };
};

/** Return the SHA-256 hash of the supplied plaintext token. */
invitationSchema.statics.hashToken = function (plaintext) {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
};

/** Number of hours until a new invitation expires. */
invitationSchema.statics.ttlHours = INVITATION_TTL_HOURS;

const Invitation = mongoose.model('Invitation', invitationSchema);
export default Invitation;
