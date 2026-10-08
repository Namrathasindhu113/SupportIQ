import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Activity from '../models/Activity.js';
import AppError from '../utils/AppError.js';
import createActivity from '../utils/createActivity.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/tickets
// Customer: create a new support ticket
// ─────────────────────────────────────────────────────────────────────────────
export const createTicket = async (req, res, next) => {
  try {
    const { title, description, priority, category } = req.body;

    const ticket = await Ticket.create({
      title,
      description,
      // Controlled defaults — only accept priority/category from body if provided
      ...(priority && { priority }),
      ...(category && { category }),
      // customer is always taken from the authenticated user — never from the body
      customer: req.user._id,
    });

    await createActivity({
      ticketId: ticket._id,
      actorId: req.user._id,
      type: 'ticket_created',
    });

    return res.status(201).json({
      success: true,
      data: { ticket },
      message: 'Ticket created successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/tickets
// Customer: own tickets only.  Agent: all tickets.
// Query params: status, priority, category, assignedTo, search, page, limit
// ─────────────────────────────────────────────────────────────────────────────
export const getTickets = async (req, res, next) => {
  try {
    const { status, priority, category, assignedTo, search } = req.query;

    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip  = (page - 1) * limit;

    // Build filter
    const filter = {};

    // Customers see only their own tickets
    if (req.user.role === 'customer') {
      filter.customer = req.user._id;
    }

    if (status)     filter.status   = status;
    if (priority)   filter.priority = priority;
    if (category)   filter.category = category;
    if (assignedTo) filter.assignedTo = assignedTo === 'null' ? null : assignedTo;

    // Full-text search on title and description
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ title: regex }, { description: regex }];
    }

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate('customer',  'name email')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Ticket.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        tickets,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/tickets/:id
// ownerOrAgent middleware already fetches req.ticket and enforces access.
// Populate customer, agent, messages, and activity timeline here.
// ─────────────────────────────────────────────────────────────────────────────
export const getTicketById = async (req, res, next) => {
  try {
    // Re-fetch with population (ownerOrAgent fetches a lean ref for auth only)
    const ticket = await Ticket.findById(req.ticket._id)
      .populate('customer',  'name email')
      .populate('assignedTo', 'name email');

    const [messages, activities] = await Promise.all([
      Message.find({ ticket: ticket._id })
        .populate('sender', 'name email role')
        .sort({ createdAt: 1 })
        .lean(),
      Activity.find({ ticket: ticket._id })
        .populate('actor', 'name email role')
        .sort({ createdAt: 1 })
        .lean(),
    ]);

    return res.json({
      success: true,
      data: { ticket, messages, activities },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/tickets/:id/status   (agent only)
// ─────────────────────────────────────────────────────────────────────────────
export const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const ticket = req.ticket; // from ownerOrAgent

    const previousStatus = ticket.status;

    if (previousStatus === status) {
      return res.json({
        success: true,
        data: { ticket },
        message: 'Ticket status is already set to that value.',
      });
    }

    ticket.status = status;
    await ticket.save();

    await createActivity({
      ticketId: ticket._id,
      actorId: req.user._id,
      type: 'status_changed',
      meta: { from: previousStatus, to: status },
    });

    return res.json({
      success: true,
      data: { ticket },
      message: `Ticket status updated to "${status}".`,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/tickets/:id/priority   (agent only)
// ─────────────────────────────────────────────────────────────────────────────
export const updatePriority = async (req, res, next) => {
  try {
    const { priority } = req.body;
    const ticket = req.ticket;

    const previousPriority = ticket.priority;

    if (previousPriority === priority) {
      return res.json({
        success: true,
        data: { ticket },
        message: 'Ticket priority is already set to that value.',
      });
    }

    ticket.priority = priority;
    await ticket.save();

    await createActivity({
      ticketId: ticket._id,
      actorId: req.user._id,
      type: 'priority_changed',
      meta: { from: previousPriority, to: priority },
    });

    return res.json({
      success: true,
      data: { ticket },
      message: `Ticket priority updated to "${priority}".`,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/tickets/:id/category   (agent only)
// ─────────────────────────────────────────────────────────────────────────────
export const updateCategory = async (req, res, next) => {
  try {
    const { category } = req.body;
    const ticket = req.ticket;

    const previousCategory = ticket.category;

    if (previousCategory === category) {
      return res.json({
        success: true,
        data: { ticket },
        message: 'Ticket category is already set to that value.',
      });
    }

    ticket.category = category;
    await ticket.save();

    await createActivity({
      ticketId: ticket._id,
      actorId: req.user._id,
      type: 'category_changed',
      meta: { from: previousCategory, to: category },
    });

    return res.json({
      success: true,
      data: { ticket },
      message: `Ticket category updated to "${category}".`,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/tickets/:id/assign   (agent only)
// Body: { assignedTo: "<agentId>" }  or  { assignedTo: null } to unassign
// ─────────────────────────────────────────────────────────────────────────────
export const assignTicket = async (req, res, next) => {
  try {
    // assignedTo may arrive as string "null" from some clients — normalise
    const rawValue  = req.body.assignedTo;
    const assignedTo = rawValue === null || rawValue === 'null' || rawValue === ''
      ? null
      : rawValue;

    const ticket = req.ticket;
    const previousAssignee = ticket.assignedTo;

    if (assignedTo !== null) {
      // Validate target user exists and is an agent
      const targetUser = await User.findById(assignedTo).select('_id name role');
      if (!targetUser) {
        return next(new AppError('Assigned user not found.', 404));
      }
      if (targetUser.role !== 'agent') {
        return next(new AppError('Tickets can only be assigned to users with the agent role.', 400));
      }

      ticket.assignedTo = targetUser._id;

      await ticket.save();

      await createActivity({
        ticketId: ticket._id,
        actorId: req.user._id,
        type: 'assigned',
        meta: {
          from: previousAssignee ?? null,
          to: targetUser._id,
          agentName: targetUser.name,
        },
      });

      return res.json({
        success: true,
        data: { ticket },
        message: `Ticket assigned to ${targetUser.name}.`,
      });
    }

    // Unassign
    ticket.assignedTo = null;
    await ticket.save();

    await createActivity({
      ticketId: ticket._id,
      actorId: req.user._id,
      type: 'unassigned',
      meta: { from: previousAssignee ?? null, to: null },
    });

    return res.json({
      success: true,
      data: { ticket },
      message: 'Ticket unassigned.',
    });
  } catch (error) {
    next(error);
  }
};
