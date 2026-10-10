import mongoose from 'mongoose';

/**
 * Company — a workspace / tenant.
 *
 * Each company has its own agents, customers, and tickets.
 * Users can belong to multiple companies via the Membership join table.
 */
const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [120, 'Company name cannot exceed 120 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Company slug is required'],
      unique: true,
      lowercase: true,   // Mongoose auto-lowercases before saving
      trim: true,
      validate: {
        validator: (v) => /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$|^[a-z0-9]{2}$/.test(v),
        message: 'Slug must be 2-60 lowercase letters, numbers, or hyphens',
      },
    },
    /** User who originally created this company (always a company_admin member). */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Company creator is required'],
    },
  },
  { timestamps: true }
);

companySchema.index({ slug: 1 }, { unique: true });
companySchema.index({ createdBy: 1 });

const Company = mongoose.model('Company', companySchema);
export default Company;
