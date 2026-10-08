import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: [true, 'Ticket reference is required'],
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender reference is required'],
    },
    body: {
      type: String,
      required: [true, 'Message body is required'],
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
  },
  { timestamps: true }
);

// Index to efficiently fetch all messages for a ticket in order
messageSchema.index({ ticket: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;
