import { describe, expect, it } from 'vitest';
import {
  applyAssignVolunteer,
  applyRemoveSignup,
  applyRequestCoverage,
  planAiAction,
  applyAiActions,
  type AiAction,
} from '../appLogic';
import type { Service, User } from '../types';

// Gap B — frontend action-execution path.
//
// These tests exercise the exact pure transforms App.tsx wires into its AI mutation
// handlers (onAIVolunteerSignup / onAIRemoveSignup / onAIRequestCoverage) and the
// planAiAction dispatch AIView uses to decide which handler fires. Proving them here
// shows the frontend will mutate ONLY the targeted slot for a given action, and does
// nothing for a logged-out user's self-signup.

function baseServices(): Service[] {
  return [
    {
      id: 'svc-fri', dateISO: '2026-07-03', date: 'Friday, July 3', time: '6:30 PM', type: 'Kabbalat Shabbat', isHH: false,
      slots: [
        { id: 'fri-greeter', role: 'Greeter', timeSlot: null, volunteer: 'Debbie Adler-Klein', volunteerEmail: 'dakmd75@gmail.com' },
        { id: 'fri-usher', role: 'Usher', timeSlot: null, volunteer: 'Sarah Levine', volunteerEmail: 'sarah.levine@example.com' },
      ],
    },
    {
      id: 'svc-sat', dateISO: '2026-07-04', date: 'Saturday, July 4', time: '9:30 AM', type: 'Shabbat Morning', isHH: false,
      slots: [
        { id: 'sat-greeter', role: 'Greeter', timeSlot: null, volunteer: null, volunteerEmail: null },
      ],
    },
  ];
}

const volunteerUser: User = { name: 'Emma Adler', email: 'emma.p.adler@gmail.com', role: 'volunteer', source: 'google' };
const adminUser: User = { name: 'Jon Eisenstein', email: 'jon.eisenstein@gmail.com', role: 'admin', source: 'google' };

// A slot on a service other than the mutated one, so we can assert it is left untouched
// by reference identity (proving no accidental deep-copy/reset of unrelated services).
function otherService(before: Service[], after: Service[]) {
  const b = before.find(s => s.id === 'svc-sat')!;
  const a = after.find(s => s.id === 'svc-sat')!;
  return { b, a };
}

describe('applyAssignVolunteer — assign_volunteer path', () => {
  it('fills only the targeted empty slot', () => {
    const before = baseServices();
    const after = applyAssignVolunteer(before, 'svc-sat', 'sat-greeter', { name: 'Emma Adler', email: 'emma.p.adler@gmail.com' });
    const slot = after.find(s => s.id === 'svc-sat')!.slots.find(s => s.id === 'sat-greeter')!;
    expect(slot.volunteer).toBe('Emma Adler');
    expect(slot.volunteerEmail).toBe('emma.p.adler@gmail.com');
  });

  it('leaves sibling slots on the same service untouched', () => {
    const before = baseServices();
    const after = applyAssignVolunteer(before, 'svc-fri', 'fri-greeter', { name: 'Emma Adler', email: 'emma.p.adler@gmail.com' });
    const usher = after.find(s => s.id === 'svc-fri')!.slots.find(s => s.id === 'fri-usher')!;
    expect(usher.volunteer).toBe('Sarah Levine');
  });

  it('leaves other services referentially unchanged', () => {
    const before = baseServices();
    const after = applyAssignVolunteer(before, 'svc-fri', 'fri-greeter', { name: 'Emma Adler', email: 'emma.p.adler@gmail.com' });
    const { b, a } = otherService(before, after);
    expect(a).toBe(b);
  });

  it('does not mutate the input array', () => {
    const before = baseServices();
    const snapshot = JSON.stringify(before);
    applyAssignVolunteer(before, 'svc-sat', 'sat-greeter', { name: 'Emma Adler', email: 'emma.p.adler@gmail.com' });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('applyRemoveSignup — remove_signup path', () => {
  it('clears only the targeted slot and resets its coverage flag', () => {
    const before = baseServices();
    before[0].slots[0].coverageRequested = true;
    const after = applyRemoveSignup(before, 'svc-fri', 'fri-greeter');
    const greeter = after.find(s => s.id === 'svc-fri')!.slots.find(s => s.id === 'fri-greeter')!;
    expect(greeter.volunteer).toBeNull();
    expect(greeter.volunteerEmail).toBeNull();
    expect(greeter.coverageRequested).toBe(false);
  });

  it('leaves the sibling usher assignment intact', () => {
    const before = baseServices();
    const after = applyRemoveSignup(before, 'svc-fri', 'fri-greeter');
    const usher = after.find(s => s.id === 'svc-fri')!.slots.find(s => s.id === 'fri-usher')!;
    expect(usher.volunteer).toBe('Sarah Levine');
    expect(usher.volunteerEmail).toBe('sarah.levine@example.com');
  });
});

describe('applyRequestCoverage — request_coverage path', () => {
  it('flags only the targeted slot for coverage without clearing the volunteer', () => {
    const before = baseServices();
    const after = applyRequestCoverage(before, 'svc-fri', 'fri-greeter');
    const greeter = after.find(s => s.id === 'svc-fri')!.slots.find(s => s.id === 'fri-greeter')!;
    expect(greeter.coverageRequested).toBe(true);
    expect(greeter.volunteer).toBe('Debbie Adler-Klein');
  });

  it('does not flag sibling slots', () => {
    const before = baseServices();
    const after = applyRequestCoverage(before, 'svc-fri', 'fri-greeter');
    const usher = after.find(s => s.id === 'svc-fri')!.slots.find(s => s.id === 'fri-usher')!;
    expect(usher.coverageRequested).toBeUndefined();
  });
});

describe('planAiAction — AIView dispatch', () => {
  it('maps sign_me_up to the signed-in user identity, ignoring any spoofed fields', () => {
    const act: AiAction = { action: 'sign_me_up', svcId: 'svc-sat', slotId: 'sat-greeter', volunteerName: 'Someone Else', volunteerEmail: 'evil@example.com' };
    const plan = planAiAction(act, volunteerUser);
    expect(plan).toEqual({ kind: 'signup', svcId: 'svc-sat', slotId: 'sat-greeter', vol: { name: 'Emma Adler', email: 'emma.p.adler@gmail.com' } });
  });

  it('returns null for sign_me_up when there is no signed-in user', () => {
    const act: AiAction = { action: 'sign_me_up', svcId: 'svc-sat', slotId: 'sat-greeter' };
    expect(planAiAction(act, null)).toBeNull();
  });

  it('maps assign_volunteer using the supplied volunteer details', () => {
    const act: AiAction = { action: 'assign_volunteer', svcId: 'svc-sat', slotId: 'sat-greeter', volunteerName: 'Emma Adler', volunteerEmail: 'emma.p.adler@gmail.com' };
    expect(planAiAction(act, adminUser)).toEqual({ kind: 'signup', svcId: 'svc-sat', slotId: 'sat-greeter', vol: { name: 'Emma Adler', email: 'emma.p.adler@gmail.com' } });
  });

  it('returns null for assign_volunteer missing volunteer identity', () => {
    const act: AiAction = { action: 'assign_volunteer', svcId: 'svc-sat', slotId: 'sat-greeter' };
    expect(planAiAction(act, adminUser)).toBeNull();
  });

  it('maps remove_signup and request_coverage to their kinds', () => {
    expect(planAiAction({ action: 'remove_signup', svcId: 'svc-fri', slotId: 'fri-greeter' }, adminUser))
      .toEqual({ kind: 'remove', svcId: 'svc-fri', slotId: 'fri-greeter' });
    expect(planAiAction({ action: 'request_coverage', svcId: 'svc-fri', slotId: 'fri-greeter' }, volunteerUser))
      .toEqual({ kind: 'coverage', svcId: 'svc-fri', slotId: 'fri-greeter' });
  });

  it('returns null for an unknown action', () => {
    expect(planAiAction({ action: 'delete_everything', svcId: 'svc-fri', slotId: 'fri-greeter' }, adminUser)).toBeNull();
  });
});

describe('applyAiActions — end-to-end frontend reducer', () => {
  it('executes each recognized action against only its target slot', () => {
    const before = baseServices();
    const actions: AiAction[] = [
      { action: 'assign_volunteer', svcId: 'svc-sat', slotId: 'sat-greeter', volunteerName: 'Emma Adler', volunteerEmail: 'emma.p.adler@gmail.com' },
      { action: 'request_coverage', svcId: 'svc-fri', slotId: 'fri-usher' },
    ];
    const after = applyAiActions(before, actions, adminUser);
    expect(after.find(s => s.id === 'svc-sat')!.slots[0].volunteer).toBe('Emma Adler');
    expect(after.find(s => s.id === 'svc-fri')!.slots.find(s => s.id === 'fri-usher')!.coverageRequested).toBe(true);
    // Untouched slot stays as seeded.
    expect(after.find(s => s.id === 'svc-fri')!.slots.find(s => s.id === 'fri-greeter')!.volunteer).toBe('Debbie Adler-Klein');
  });

  it('makes no mutation for a logged-out self-signup', () => {
    const before = baseServices();
    const snapshot = JSON.stringify(before);
    const after = applyAiActions(before, [{ action: 'sign_me_up', svcId: 'svc-sat', slotId: 'sat-greeter' }], null);
    expect(after).toBe(before);
    expect(JSON.stringify(after)).toBe(snapshot);
  });

  it('makes no mutation for an empty action list', () => {
    const before = baseServices();
    expect(applyAiActions(before, [], adminUser)).toBe(before);
  });

  it('spoofed user data on sign_me_up cannot assign a different person', () => {
    const before = baseServices();
    const after = applyAiActions(
      before,
      [{ action: 'sign_me_up', svcId: 'svc-sat', slotId: 'sat-greeter', volunteerName: 'Attacker', volunteerEmail: 'attacker@example.com' }],
      volunteerUser,
    );
    const slot = after.find(s => s.id === 'svc-sat')!.slots[0];
    expect(slot.volunteer).toBe('Emma Adler');
    expect(slot.volunteerEmail).toBe('emma.p.adler@gmail.com');
  });
});
