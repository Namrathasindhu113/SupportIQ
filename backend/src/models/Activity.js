import mongoose from 'mongoose';

const ACTIVITY_TYPES = [
  'ticket_created',
  'status_changed',
  'priority_changed',
  'category_changed',
  'assigned',
  'unassigned',
  'replied',
  'ai_analyzed',
];

const activitySchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: [true, 'Ticket reference is required'],
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor reference is required'],
    },
    type: {
      type: String,
      enum: ACTIVITY_TYPES,
      required: [true, 'Activity type is required'],
    },
    // Flexible metadata: { from, to } for changes; { agentName } for assign;
    // { messagePreview } for replies; empty for creation / ai_analyzed
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    /**
     * Company (tenant) this activity belongs to — denormalised from the ticket.
     * Optional during the migration window.
     */
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
    },
  },
  {
    // Only createdAt — activity records are immutable, no updatedAt needed
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Index to fetch the timeline for a ticket efficiently
activitySchema.index({ ticket: 1, createdAt: 1 });

export { ACTIVITY_TYPES };

const Activity = mongoose.model('Activity', activitySchema);
export default Activity;
