import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUSES,
  canTransition,
  estimatePriceKobo,
  generatePublicRef,
  requestExpirySeconds,
  transitionNote,
  transitionsFrom,
} from '../src/domain/booking.js';

test('booking status list is complete and unique', () => {
  assert.equal(BOOKING_STATUSES.length, 9);
  assert.equal(new Set(BOOKING_STATUSES).size, BOOKING_STATUSES.length);
  assert.deepEqual(
    [...BOOKING_STATUSES].sort(),
    ['accepted', 'arrived', 'cancelled', 'completed', 'declined', 'en_route', 'expired', 'in_progress', 'requested'],
  );
});

test('happy path transitions are allowed in order', () => {
  const path = ['requested', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed'];
  for (let index = 0; index < path.length - 1; index += 1) {
    assert.equal(canTransition(path[index], path[index + 1]), true, `${path[index]} -> ${path[index + 1]}`);
  }
});

test('terminal states cannot transition', () => {
  for (const status of ['completed', 'cancelled', 'declined', 'expired']) {
    assert.deepEqual(transitionsFrom(status), []);
    assert.equal(canTransition(status, 'in_progress'), false);
  }
});

test('invalid jumps are rejected', () => {
  assert.equal(canTransition('requested', 'completed'), false);
  assert.equal(canTransition('accepted', 'arrived'), false);
  assert.equal(canTransition('in_progress', 'cancelled'), false);
  assert.equal(canTransition('unknown', 'accepted'), false);
});

test('active statuses match operational bookings', () => {
  assert.deepEqual(ACTIVE_BOOKING_STATUSES, ['accepted', 'en_route', 'arrived', 'in_progress']);
});

test('price estimate uses two hours plus urgency fee', () => {
  assert.equal(estimatePriceKobo(850_000, 'scheduled'), 1_700_000);
  assert.equal(estimatePriceKobo(850_000, 'asap'), 1_800_000);
  assert.equal(estimatePriceKobo(850_000, 'emergency'), 2_000_000);
  assert.equal(estimatePriceKobo(0, 'asap'), 100_000);
  assert.equal(estimatePriceKobo(undefined, 'scheduled'), 0);
});

test('request expiry shortens with urgency', () => {
  assert.equal(requestExpirySeconds('scheduled'), 1800);
  assert.equal(requestExpirySeconds('asap'), 300);
  assert.equal(requestExpirySeconds('emergency'), 180);
});

test('public reference matches expected format', () => {
  const ref = generatePublicRef(new Date('2026-11-05T10:00:00Z'));
  assert.match(ref, /^SL-2026-[A-F0-9]{6}$/);
  assert.notEqual(ref, generatePublicRef(new Date('2026-11-05T10:00:00Z')));
});

test('transition notes identify the acting role', () => {
  assert.match(transitionNote('cancelled', 'client'), /Client cancelled/);
  assert.match(transitionNote('cancelled', 'worker'), /Worker cancelled/);
  assert.equal(transitionNote('accepted', 'worker'), 'Worker accepted the job.');
  assert.equal(transitionNote('unknown', 'worker'), 'Booking moved to unknown.');
});
