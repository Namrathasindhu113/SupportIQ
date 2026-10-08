import mongoose from 'mongoose';

const aiSummarySchema = new mongoose.Schema(
  {
    summary: { type: String },
    suggestedCategory: { type: String },
    suggestedPriority: { type: String },
    investigationSteps: [{ type: String }],
    draftResponse: { type: String },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    category: {
      type: String,
      enum: ['billing', 'technical', 'general', 'other'],
      default: 'general',
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer is required'],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    aiSummary: {
      type: aiSummarySchema,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for common query patterns
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ customer: 1 });
ticketSchema.index({ assignedTo: 1 });

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
