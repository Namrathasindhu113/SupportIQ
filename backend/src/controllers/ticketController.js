import Ticket from '../models/Ticket.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Activity from '../models/Activity.js';
import Membership from '../models/Membership.js';
import AppError from '../utils/AppError.js';
import createActivity from '../utils/createActivity.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/tickets
// Customer: create a new support ticket.
// When req.membership is present the ticket is scoped to that company.
// ─────────────────────────────────────────────────────────────────────────────
export const createTicket = async (req, res, next) => {
  try {
    const { title, description, priority, category } = req.body;

    const ticket = await Ticket.create({
      title,
      description,
      ...(priority && { priority }),
      ...(category && { category }),
      // customer is always from the authenticated user — never from the body
      customer: req.user._id,
      // company is always from the server-side membership context — never client-supplied
      ...(req.membership ? { company: req.membership.company } : {}),
    });

    await createActivity({
      ticketId: ticket._id,
      actorId: req.user._id,
      type: 'ticket_created',
      ...(req.membership ? { companyId: req.membership.company } : {}),
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
// Customer: own tickets only.  Agent/admin: all tickets in company.
// Query params: status, priority, category, assignedTo, search, page, limit
// ─────────────────────────────────────────────────────────────────────────────
export const getTickets = async (req, res, next) => {
  try {
    const { status, priority, category, assignedTo, search } = req.query;

    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip  = (page - 1) * limit;

    // Build filter — always scope to company when membership context is present
    const filter = {};

    if (req.membership) {
      // Scope to authenticated user's verified company
      filter.company = req.membership.company;

      // Customers see only their own tickets within the company
      if (req.membership.role === 'customer') {
        filter.customer = req.user._id;
      }
    } else {
      // Legacy path: customers see only their own tickets
      if (req.user.role === 'customer') {
        filter.customer = req.user._id;
      }
    }

    if (status)     filter.status   = status;
    if (priority)   filter.priority = priority;
    if (category)   filter.category = category;
    if (assignedTo) filter.assignedTo = assignedTo === 'null' ? null : assignedTo;

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ title: regex }, { description: regex }];
    }

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate('customer',   'name email')
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
// GET /api/v1/tickets/overview
// Agent support-operations metrics for the authenticated company only.
// ─────────────────────────────────────────────────────────────────────────────
export const getTicketOverview = async (req, res, next) => {
  try {
    const company = req.company._id;
    const companyFilter = { company };

    const [
      total,
      open,
      inProgress,
      resolved,
      urgent,
      unassigned,
      myAssigned,
      attentionTickets,
      recentActivity,
    ] = await Promise.all([
      Ticket.countDocuments(companyFilter),
      Ticket.countDocuments({ ...companyFilter, status: 'open' }),
      Ticket.countDocuments({ ...companyFilter, status: 'in_progress' }),
      Ticket.countDocuments({ ...companyFilter, status: { $in: ['resolved', 'closed'] } }),
      Ticket.countDocuments({ ...companyFilter, priority: 'urgent' }),
      Ticket.countDocuments({ ...companyFilter, assignedTo: null }),
      Ticket.countDocuments({
        ...companyFilter,
        assignedTo: req.user._id,
        status: { $in: ['open', 'in_progress'] },
      }),
      Ticket.find({
        ...companyFilter,
        status: { $in: ['open', 'in_progress'] },
        $or: [
          { priority: { $in: ['high', 'urgent'] }, status: 'open' },
          { assignedTo: null },
        ],
      })
        .populate('customer', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: 1 })
        .limit(5)
        .lean(),
      Activity.find({ company })
        .populate('ticket', 'title')
        .populate('actor', 'name')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        metrics: { total, open, inProgress, resolved, urgent, unassigned, myAssigned },
        attentionTickets,
        recentActivity,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/tickets/:id
// ownerOrAgent middleware already enforces access + company scope.
// ─────────────────────────────────────────────────────────────────────────────
export const getTicketById = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.ticket._id)
      .populate('customer',   'name email')
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
// PATCH /api/v1/tickets/:id/status   (agent / company_admin only)
// ─────────────────────────────────────────────────────────────────────────────
export const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const ticket = req.ticket;

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
      ...(req.membership ? { companyId: req.membership.company } : {}),
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
// PATCH /api/v1/tickets/:id/priority   (agent / company_admin only)
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
      ...(req.membership ? { companyId: req.membership.company } : {}),
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
// PATCH /api/v1/tickets/:id/category   (agent / company_admin only)
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
      ...(req.membership ? { companyId: req.membership.company } : {}),
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
// PATCH /api/v1/tickets/:id/assign   (agent / company_admin only)
// Body: { assignedTo: "<agentId>" }  or  { assignedTo: null } to unassign.
// When membership context is present, the assignee MUST hold an active
// agent or company_admin membership in the same company.
// ─────────────────────────────────────────────────────────────────────────────
export const assignTicket = async (req, res, next) => {
  try {
    const rawValue  = req.body.assignedTo;
    const assignedTo = rawValue === null || rawValue === 'null' || rawValue === ''
      ? null
      : rawValue;

    const ticket = req.ticket;
    const previousAssignee = ticket.assignedTo;

    if (assignedTo !== null) {
      if (req.membership) {
        // Company-scoped: assignee must be an active agent/admin in this company
        const assigneeMembership = await Membership.findOne({
          user: assignedTo,
          company: req.membership.company,
          role: { $in: ['agent', 'company_admin'] },
          active: true,
        }).populate('user', '_id name role');

        if (!assigneeMembership) {
          return next(new AppError(
            'Assignee must be an active agent or admin in this company.',
            400
          ));
        }

        ticket.assignedTo = assigneeMembership.user._id;

        await ticket.save();

        await createActivity({
          ticketId: ticket._id,
          actorId: req.user._id,
          type: 'assigned',
          meta: {
            from: previousAssignee ?? null,
            to: assigneeMembership.user._id,
            agentName: assigneeMembership.user.name,
          },
          companyId: req.membership.company,
        });

        return res.json({
          success: true,
          data: { ticket },
          message: `Ticket assigned to ${assigneeMembership.user.name}.`,
        });

      } else {
        // Legacy path: validate by global role
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
    }

    // Unassign
    ticket.assignedTo = null;
    await ticket.save();

    await createActivity({
      ticketId: ticket._id,
      actorId: req.user._id,
      type: 'unassigned',
      meta: { from: previousAssignee ?? null, to: null },
      ...(req.membership ? { companyId: req.membership.company } : {}),
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
