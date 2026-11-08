import { randomBytes } from 'node:crypto';

export const BOOKING_STATUSES = [
  'requested',
  'accepted',
  'en_route',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'declined',
  'expired',
];

const TRANSITIONS = {
  requested: ['accepted', 'declined', 'cancelled', 'expired'],
  accepted: ['en_route', 'cancelled'],
  en_route: ['arrived', 'cancelled'],
  arrived: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
  declined: [],
  expired: [],
};

export const ACTIVE_BOOKING_STATUSES = ['accepted', 'en_route', 'arrived', 'in_progress'];

export const URGENCY_FEE_KOBO = {
  scheduled: 0,
  asap: 100_000,
  emergency: 300_000,
};

export function canTransition(from, to) {
  return Boolean(TRANSITIONS[from]?.includes(to));
}

export function transitionsFrom(status) {
  return [...(TRANSITIONS[status] ?? [])];
}

export function estimatePriceKobo(hourlyRateKobo, urgency) {
  const base = Math.max(0, Number(hourlyRateKobo) || 0) * 2;
  const fee = URGENCY_FEE_KOBO[urgency] ?? 0;
  return base + fee;
}

export function generatePublicRef(now = new Date()) {
  const year = now.getUTCFullYear();
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `SL-${year}-${suffix}`;
}

export function requestExpirySeconds(urgency) {
  if (urgency === 'emergency') return 3 * 60;
  if (urgency === 'asap') return 5 * 60;
  return 30 * 60;
}

export function transitionNote(status, actorRole) {
  const notes = {
    accepted: 'Worker accepted the job.',
    declined: 'Worker declined the job.',
    en_route: 'Worker is on the way.',
    arrived: 'Worker arrived at the location.',
    in_progress: 'Job started.',
    completed: 'Job marked complete.',
    cancelled: `${actorRole === 'client' ? 'Client' : 'Worker'} cancelled the booking.`,
    expired: 'Booking request expired without a response.',
  };
  return notes[status] ?? `Booking moved to ${status}.`;
}
