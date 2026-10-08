/**
 * seed.js — SupportIQ demo data seed script
 *
 * Usage:  npm run seed
 *
 * Wipes and recreates the four SupportIQ collections (Users, Tickets,
 * Messages, Activities) with realistic demo data for evaluation.
 * Safe to run multiple times — always produces a clean, identical dataset.
 */

import 'dotenv/config';
import mongoose from 'mongoose';

import User     from './src/models/User.js';
import Ticket   from './src/models/Ticket.js';
import Message  from './src/models/Message.js';
import Activity from './src/models/Activity.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helper — build a Date offset from now (negative = past)
// ─────────────────────────────────────────────────────────────────────────────
const daysAgo  = (n) => new Date(Date.now() - n * 86_400_000);
const hoursAgo = (n) => new Date(Date.now() - n * 3_600_000);

// ─────────────────────────────────────────────────────────────────────────────
// Connect
// ─────────────────────────────────────────────────────────────────────────────
async function connect() {
  if (!process.env.MONGO_URI) {
    console.error('❌  MONGO_URI is not set. Check your .env file.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Wipe only the four SupportIQ collections
// ─────────────────────────────────────────────────────────────────────────────
async function clearCollections() {
  await Promise.all([
    User.deleteMany({}),
    Ticket.deleteMany({}),
    Message.deleteMany({}),
    Activity.deleteMany({}),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────────────────────
async function seed() {
  // ── 1. Users ───────────────────────────────────────────────────────────────
  // Passwords are set as plaintext here; the User pre-save hook hashes them.
  const [agent, customerSam, customerAlex] = await User.create([
    {
      name:     'Sarah Mitchell',
      email:    'agent@supportiq.dev',
      password: 'Agent@12345',
      role:     'agent',
    },
    {
      name:     'Sam Carter',
      email:    'customer@supportiq.dev',
      password: 'Customer@12345',
      role:     'customer',
    },
    {
      name:     'Alex Rivera',
      email:    'alex@supportiq.dev',
      password: 'Customer@12345',
      role:     'customer',
    },
  ]);

  // ── 2. Tickets ─────────────────────────────────────────────────────────────
  // We bypass the model's default timestamps so the seed timeline looks
  // believable.  Mongoose allows overriding createdAt/updatedAt when the
  // document is created if we set the fields explicitly.

  const ticketsData = [
    // ── T1: Sam — billing / urgent / in_progress / assigned ─────────────────
    {
      title:       'Payment charged but order still shows pending',
      description:
        'I completed a payment of $149.00 yesterday afternoon for order #ORD-8821. ' +
        'My bank statement clearly shows the charge, but the order status on your ' +
        'platform still reads "pending". I need this resolved urgently as the items ' +
        'are time-sensitive.',
      status:      'in_progress',
      priority:    'urgent',
      category:    'billing',
      customer:    customerSam._id,
      assignedTo:  agent._id,
      createdAt:   daysAgo(5),
      updatedAt:   daysAgo(2),
    },
    // ── T2: Sam — technical / high / open / unassigned ───────────────────────
    {
      title:       'Unable to reset account password',
      description:
        'I requested a password reset email three times over the last two days, ' +
        'but no email has arrived — not even in spam. I am locked out of my account ' +
        'and cannot access any of my previous orders or invoices.',
      status:      'open',
      priority:    'high',
      category:    'technical',
      customer:    customerSam._id,
      assignedTo:  null,
      createdAt:   daysAgo(3),
      updatedAt:   daysAgo(3),
    },
    // ── T3: Sam — billing / medium / resolved / assigned ────────────────────
    {
      title:       'Invoice GST details are incorrect',
      description:
        'Invoice #INV-2024-0047 issued last month contains an incorrect GST ' +
        'registration number. Our accounting team requires the corrected invoice ' +
        'before we can process the payment. Please reissue with GST number ' +
        '27AAPFU0939F1ZV.',
      status:      'resolved',
      priority:    'medium',
      category:    'billing',
      customer:    customerSam._id,
      assignedTo:  agent._id,
      createdAt:   daysAgo(14),
      updatedAt:   daysAgo(7),
    },
    // ── T4: Alex — technical / high / in_progress / assigned ────────────────
    {
      title:       'Dashboard not loading telemetry data',
      description:
        'Since yesterday evening the Analytics dashboard shows a blank page ' +
        'after login. The browser console shows: "Uncaught TypeError: Cannot read ' +
        'properties of undefined (reading \'datasets\')". I\'ve tried Chrome, ' +
        'Firefox, and a hard-refresh — the issue persists across all browsers.',
      status:      'in_progress',
      priority:    'high',
      category:    'technical',
      customer:    customerAlex._id,
      assignedTo:  agent._id,
      createdAt:   daysAgo(2),
      updatedAt:   hoursAgo(6),
    },
    // ── T5: Alex — billing / medium / open / unassigned ─────────────────────
    {
      title:       'Duplicate payment notification received',
      description:
        'I received two identical payment confirmation emails for subscription ' +
        'renewal (Plan: Pro, $49/month) within minutes of each other this morning. ' +
        'My payment method was only charged once, but I want to confirm no duplicate ' +
        'charge will appear on my next statement.',
      status:      'open',
      priority:    'medium',
      category:    'billing',
      customer:    customerAlex._id,
      assignedTo:  null,
      createdAt:   daysAgo(1),
      updatedAt:   daysAgo(1),
    },
    // ── T6: Alex — general / low / closed / assigned ─────────────────────────
    {
      title:       'Request to update account contact information',
      description:
        'I recently changed my business email address and phone number. ' +
        'Please update my account with the following:\n' +
        'New email: alex.rivera@newdomain.com\n' +
        'New phone: +1 (555) 234-5678\n' +
        'Please confirm once the update has been made.',
      status:      'closed',
      priority:    'low',
      category:    'general',
      customer:    customerAlex._id,
      assignedTo:  agent._id,
      createdAt:   daysAgo(21),
      updatedAt:   daysAgo(18),
    },
  ];

  // insertMany bypasses the pre-save hook; use create() in a loop so that
  // any future Ticket pre-save hooks also fire, and to get back ObjectIds.
  // We use Model.insertMany with timestamps: false override via the raw approach
  // because we need to control createdAt.  The cleanest way in Mongoose is
  // to set the fields directly and call save() per document.
  const tickets = [];
  for (const data of ticketsData) {
    const { createdAt, updatedAt, ...fields } = data;
    const t = new Ticket(fields);
    t.createdAt = createdAt;
    t.updatedAt = updatedAt;
    await t.save();
    tickets.push(t);
  }

  const [t1, t2, t3, t4, t5, t6] = tickets;

  // ── 3. Messages ────────────────────────────────────────────────────────────
  // Each entry: { ticket, sender, body, createdAt }

  const messagesData = [
    // T1 — Payment pending
    {
      ticket:    t1._id,
      sender:    customerSam._id,
      body:      'I was charged $149.00 for order #ORD-8821 yesterday but the status still shows "pending". My bank confirms the deduction. Can you please check?',
      createdAt: new Date(t1.createdAt.getTime() + 5 * 60_000), // 5 min after creation
    },
    {
      ticket:    t1._id,
      sender:    agent._id,
      body:      "Hi Sam, thanks for reaching out. I've located order #ORD-8821 and can confirm the payment was received on our end. It looks like a processing delay caused the status mismatch. I'm escalating this to our fulfilment team right now.",
      createdAt: new Date(t1.createdAt.getTime() + 2 * 3_600_000), // 2 hrs after
    },
    {
      ticket:    t1._id,
      sender:    customerSam._id,
      body:      "Thank you for the quick response. Could you give me an estimated time for when the status will update? I need the items by Friday.",
      createdAt: new Date(t1.createdAt.getTime() + 4 * 3_600_000),
    },
    {
      ticket:    t1._id,
      sender:    agent._id,
      body:      "Understood — I've marked this as urgent with the fulfilment team and requested a 24-hour resolution. I'll follow up with you tomorrow morning at the latest.",
      createdAt: new Date(t1.createdAt.getTime() + 5 * 3_600_000),
    },

    // T3 — GST invoice (resolved)
    {
      ticket:    t3._id,
      sender:    customerSam._id,
      body:      'The GST number on invoice #INV-2024-0047 is incorrect. Our accounts team cannot process payment until this is corrected. The correct GST number is 27AAPFU0939F1ZV.',
      createdAt: new Date(t3.createdAt.getTime() + 10 * 60_000),
    },
    {
      ticket:    t3._id,
      sender:    agent._id,
      body:      "Hi Sam, I can see the error on that invoice. I'm generating a corrected version now — you should receive it via email within the next 30 minutes.",
      createdAt: new Date(t3.createdAt.getTime() + 3 * 3_600_000),
    },
    {
      ticket:    t3._id,
      sender:    agent._id,
      body:      'The corrected invoice has been sent to your registered email address. Please let me know if everything looks right.',
      createdAt: new Date(t3.createdAt.getTime() + 4 * 3_600_000),
    },
    {
      ticket:    t3._id,
      sender:    customerSam._id,
      body:      'Received and confirmed — the GST number is now correct. Thank you for the quick turnaround.',
      createdAt: new Date(t3.createdAt.getTime() + 6 * 3_600_000),
    },

    // T4 — Dashboard blank
    {
      ticket:    t4._id,
      sender:    customerAlex._id,
      body:      "The analytics dashboard is completely blank since yesterday. I see this in the browser console: \"Uncaught TypeError: Cannot read properties of undefined (reading 'datasets')\". This is affecting my ability to review weekly reports.",
      createdAt: new Date(t4.createdAt.getTime() + 15 * 60_000),
    },
    {
      ticket:    t4._id,
      sender:    agent._id,
      body:      "Hi Alex, thank you for the detailed report and for including the console error — that's very helpful. This appears to be related to a data-loading issue introduced in yesterday's deployment. Our engineering team is actively investigating.",
      createdAt: new Date(t4.createdAt.getTime() + 1 * 3_600_000),
    },
    {
      ticket:    t4._id,
      sender:    customerAlex._id,
      body:      'Appreciate the update. Is there a workaround I can use in the meantime? I have a board meeting tomorrow and need access to the last 30 days of data.',
      createdAt: new Date(t4.createdAt.getTime() + 2 * 3_600_000),
    },
    {
      ticket:    t4._id,
      sender:    agent._id,
      body:      "As a temporary workaround, you can access your data via Reports > Export (top-right menu) to download a CSV of the last 30 days. We expect the dashboard fix to be deployed within 6–8 hours.",
      createdAt: new Date(t4.createdAt.getTime() + 2.5 * 3_600_000),
    },

    // T6 — Contact info update (closed)
    {
      ticket:    t6._id,
      sender:    customerAlex._id,
      body:      'Please update my account email to alex.rivera@newdomain.com and phone to +1 (555) 234-5678. The current details are outdated.',
      createdAt: new Date(t6.createdAt.getTime() + 20 * 60_000),
    },
    {
      ticket:    t6._id,
      sender:    agent._id,
      body:      "Hi Alex, I've updated your contact information. New email: alex.rivera@newdomain.com, phone: +1 (555) 234-5678. A confirmation has been sent to both your old and new email addresses.",
      createdAt: new Date(t6.createdAt.getTime() + 1 * 3_600_000),
    },
    {
      ticket:    t6._id,
      sender:    customerAlex._id,
      body:      'Perfect, received both confirmations. Thanks!',
      createdAt: new Date(t6.createdAt.getTime() + 90 * 60_000),
    },
  ];

  const messages = [];
  for (const data of messagesData) {
    const { createdAt, ...fields } = data;
    const m = new Message(fields);
    m.createdAt = createdAt;
    await m.save();
    messages.push(m);
  }

  // ── 4. Activities ──────────────────────────────────────────────────────────
  const activitiesData = [
    // ── T1 ───────────────────────────────────────────────────────────────────
    {
      ticket:    t1._id,
      actor:     customerSam._id,
      type:      'ticket_created',
      meta:      {},
      createdAt: t1.createdAt,
    },
    {
      ticket:    t1._id,
      actor:     agent._id,
      type:      'assigned',
      meta:      { from: null, to: agent._id, agentName: agent.name },
      createdAt: new Date(t1.createdAt.getTime() + 1 * 3_600_000),
    },
    {
      ticket:    t1._id,
      actor:     agent._id,
      type:      'priority_changed',
      meta:      { from: 'medium', to: 'urgent' },
      createdAt: new Date(t1.createdAt.getTime() + 1.1 * 3_600_000),
    },
    {
      ticket:    t1._id,
      actor:     agent._id,
      type:      'status_changed',
      meta:      { from: 'open', to: 'in_progress' },
      createdAt: new Date(t1.createdAt.getTime() + 1.2 * 3_600_000),
    },
    {
      ticket:    t1._id,
      actor:     agent._id,
      type:      'replied',
      meta:      { messagePreview: "Hi Sam, thanks for reaching out. I've located order #ORD-8821", senderRole: 'agent' },
      createdAt: new Date(t1.createdAt.getTime() + 2 * 3_600_000),
    },
    {
      ticket:    t1._id,
      actor:     customerSam._id,
      type:      'replied',
      meta:      { messagePreview: 'Thank you for the quick response. Could you give me an estimated time', senderRole: 'customer' },
      createdAt: new Date(t1.createdAt.getTime() + 4 * 3_600_000),
    },

    // ── T2 ───────────────────────────────────────────────────────────────────
    {
      ticket:    t2._id,
      actor:     customerSam._id,
      type:      'ticket_created',
      meta:      {},
      createdAt: t2.createdAt,
    },
    {
      ticket:    t2._id,
      actor:     agent._id,
      type:      'priority_changed',
      meta:      { from: 'medium', to: 'high' },
      createdAt: new Date(t2.createdAt.getTime() + 30 * 60_000),
    },

    // ── T3 ───────────────────────────────────────────────────────────────────
    {
      ticket:    t3._id,
      actor:     customerSam._id,
      type:      'ticket_created',
      meta:      {},
      createdAt: t3.createdAt,
    },
    {
      ticket:    t3._id,
      actor:     agent._id,
      type:      'assigned',
      meta:      { from: null, to: agent._id, agentName: agent.name },
      createdAt: new Date(t3.createdAt.getTime() + 2 * 3_600_000),
    },
    {
      ticket:    t3._id,
      actor:     agent._id,
      type:      'status_changed',
      meta:      { from: 'open', to: 'in_progress' },
      createdAt: new Date(t3.createdAt.getTime() + 2.5 * 3_600_000),
    },
    {
      ticket:    t3._id,
      actor:     agent._id,
      type:      'replied',
      meta:      { messagePreview: "I can see the error on that invoice. I'm generating a corrected version", senderRole: 'agent' },
      createdAt: new Date(t3.createdAt.getTime() + 3 * 3_600_000),
    },
    {
      ticket:    t3._id,
      actor:     customerSam._id,
      type:      'replied',
      meta:      { messagePreview: 'Received and confirmed — the GST number is now correct', senderRole: 'customer' },
      createdAt: new Date(t3.createdAt.getTime() + 6 * 3_600_000),
    },
    {
      ticket:    t3._id,
      actor:     agent._id,
      type:      'status_changed',
      meta:      { from: 'in_progress', to: 'resolved' },
      createdAt: new Date(t3.createdAt.getTime() + 7 * 3_600_000),
    },

    // ── T4 ───────────────────────────────────────────────────────────────────
    {
      ticket:    t4._id,
      actor:     customerAlex._id,
      type:      'ticket_created',
      meta:      {},
      createdAt: t4.createdAt,
    },
    {
      ticket:    t4._id,
      actor:     agent._id,
      type:      'assigned',
      meta:      { from: null, to: agent._id, agentName: agent.name },
      createdAt: new Date(t4.createdAt.getTime() + 45 * 60_000),
    },
    {
      ticket:    t4._id,
      actor:     agent._id,
      type:      'priority_changed',
      meta:      { from: 'medium', to: 'high' },
      createdAt: new Date(t4.createdAt.getTime() + 50 * 60_000),
    },
    {
      ticket:    t4._id,
      actor:     agent._id,
      type:      'category_changed',
      meta:      { from: 'general', to: 'technical' },
      createdAt: new Date(t4.createdAt.getTime() + 55 * 60_000),
    },
    {
      ticket:    t4._id,
      actor:     agent._id,
      type:      'status_changed',
      meta:      { from: 'open', to: 'in_progress' },
      createdAt: new Date(t4.createdAt.getTime() + 1 * 3_600_000),
    },
    {
      ticket:    t4._id,
      actor:     agent._id,
      type:      'replied',
      meta:      { messagePreview: 'Hi Alex, thank you for the detailed report', senderRole: 'agent' },
      createdAt: new Date(t4.createdAt.getTime() + 1 * 3_600_000 + 5 * 60_000),
    },
    {
      ticket:    t4._id,
      actor:     customerAlex._id,
      type:      'replied',
      meta:      { messagePreview: 'Appreciate the update. Is there a workaround', senderRole: 'customer' },
      createdAt: new Date(t4.createdAt.getTime() + 2 * 3_600_000),
    },

    // ── T5 ───────────────────────────────────────────────────────────────────
    {
      ticket:    t5._id,
      actor:     customerAlex._id,
      type:      'ticket_created',
      meta:      {},
      createdAt: t5.createdAt,
    },

    // ── T6 ───────────────────────────────────────────────────────────────────
    {
      ticket:    t6._id,
      actor:     customerAlex._id,
      type:      'ticket_created',
      meta:      {},
      createdAt: t6.createdAt,
    },
    {
      ticket:    t6._id,
      actor:     agent._id,
      type:      'assigned',
      meta:      { from: null, to: agent._id, agentName: agent.name },
      createdAt: new Date(t6.createdAt.getTime() + 30 * 60_000),
    },
    {
      ticket:    t6._id,
      actor:     agent._id,
      type:      'status_changed',
      meta:      { from: 'open', to: 'in_progress' },
      createdAt: new Date(t6.createdAt.getTime() + 45 * 60_000),
    },
    {
      ticket:    t6._id,
      actor:     agent._id,
      type:      'replied',
      meta:      { messagePreview: "I've updated your contact information", senderRole: 'agent' },
      createdAt: new Date(t6.createdAt.getTime() + 1 * 3_600_000),
    },
    {
      ticket:    t6._id,
      actor:     customerAlex._id,
      type:      'replied',
      meta:      { messagePreview: 'Perfect, received both confirmations', senderRole: 'customer' },
      createdAt: new Date(t6.createdAt.getTime() + 90 * 60_000),
    },
    {
      ticket:    t6._id,
      actor:     agent._id,
      type:      'status_changed',
      meta:      { from: 'in_progress', to: 'resolved' },
      createdAt: new Date(t6.createdAt.getTime() + 2 * 3_600_000),
    },
    {
      ticket:    t6._id,
      actor:     agent._id,
      type:      'status_changed',
      meta:      { from: 'resolved', to: 'closed' },
      createdAt: new Date(t6.createdAt.getTime() + 3 * 3_600_000),
    },
  ];

  const activities = [];
  for (const data of activitiesData) {
    const { createdAt, ...fields } = data;
    const a = new Activity(fields);
    a.createdAt = createdAt;
    await a.save();
    activities.push(a);
  }

  return {
    userCount:     3,
    ticketCount:   tickets.length,
    messageCount:  messages.length,
    activityCount: activities.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  try {
    process.stdout.write('Connecting to MongoDB… ');
    await connect();
    console.log('connected.\n');

    process.stdout.write('Clearing existing collections… ');
    await clearCollections();
    console.log('done.\n');

    process.stdout.write('Seeding demo data… ');
    const counts = await seed();
    console.log('done.\n');

    console.log('SupportIQ database seeded successfully.');
    console.log(`  Users:      ${counts.userCount}`);
    console.log(`  Tickets:    ${counts.ticketCount}`);
    console.log(`  Messages:   ${counts.messageCount}`);
    console.log(`  Activities: ${counts.activityCount}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌  Seed failed:', err.message);
    if (process.env.NODE_ENV === 'development') console.error(err.stack);
    try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
    process.exit(1);
  }
})();
