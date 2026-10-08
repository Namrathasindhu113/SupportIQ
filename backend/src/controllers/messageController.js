import Message from '../models/Message.js';
import Activity from '../models/Activity.js';
import createActivity from '../utils/createActivity.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/tickets/:id/messages
// ownerOrAgent already enforced; req.ticket is available.
// ─────────────────────────────────────────────────────────────────────────────
export const getMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({ ticket: req.ticket._id })
      .populate('sender', 'name email role')
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      success: true,
      data: { messages },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/tickets/:id/messages
// Both customers (own ticket) and agents can reply.
// sender is always taken from req.user — never trusted from the body.
// ─────────────────────────────────────────────────────────────────────────────
export const createMessage = async (req, res, next) => {
  try {
    const { body } = req.body;

    const message = await Message.create({
      ticket: req.ticket._id,
      sender: req.user._id,  // server-side only — never from request body
      body: body.trim(),
    });

    // Populate sender for the response
    await message.populate('sender', 'name email role');

    await createActivity({
      ticketId: req.ticket._id,
      actorId: req.user._id,
      type: 'replied',
      meta: {
        // Store a short preview so the timeline is useful at a glance
        messagePreview: body.trim().slice(0, 120),
        senderRole: req.user.role,
      },
    });

    return res.status(201).json({
      success: true,
      data: { message },
      message: 'Reply posted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/tickets/:id/activity
// ownerOrAgent already enforced; req.ticket is available.
// ─────────────────────────────────────────────────────────────────────────────
export const getActivity = async (req, res, next) => {
  try {
    const activities = await Activity.find({ ticket: req.ticket._id })
      .populate('actor', 'name email role')
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      success: true,
      data: { activities },
    });
  } catch (error) {
    next(error);
  }
};
