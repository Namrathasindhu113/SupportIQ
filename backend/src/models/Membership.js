import mongoose from 'mongoose';

/**
 * Membership — user ↔ company join table.
 *
 * Roles are scoped per company:
 *   company_admin — can invite, manage agents/customers, view all tickets
 *   agent         — can see and act on all company tickets
 *   customer      — can create and see only their own tickets
 *
 * A user may hold different roles in different companies.
 * A company must always have at least one company_admin (enforced at the
 * application layer — the creator is seeded before the record is saved).
 */
const COMPANY_ROLES = ['company_admin', 'agent', 'customer'];

const membershipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company reference is required'],
    },
    role: {
      type: String,
      enum: COMPANY_ROLES,
      required: [true, 'Membership role is required'],
    },
    /** Soft-deactivation: revoked members cannot access company resources. */
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// One active membership per (user, company) pair
membershipSchema.index({ user: 1, company: 1 }, { unique: true });
// Quickly list all members of a company, filtered by role
membershipSchema.index({ company: 1, role: 1, active: 1 });
// Quickly list all companies a user belongs to
membershipSchema.index({ user: 1, active: 1 });

export { COMPANY_ROLES };
const Membership = mongoose.model('Membership', membershipSchema);
export default Membership;
