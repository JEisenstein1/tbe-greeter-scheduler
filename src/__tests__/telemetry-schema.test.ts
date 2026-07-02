import { describe, expect, it } from 'vitest';
// @ts-expect-error JS module intentionally shared with Vercel functions.
import { buildEventPayload, buildTransactionPayload, safeSnippet } from '../../api/_telemetry.js';

describe('telemetry payload helpers', () => {
  it('redacts sensitive keys and truncates long content', () => {
    const payload = buildEventPayload({
      eventName: 'form_submitted',
      userEmail: 'USER@Example.COM',
      properties: {
        field: 'signup',
        password: 'secret-password',
        token: 'abc123',
        nested: { apiKey: 'hidden', ok: true },
        long: 'x'.repeat(1400),
      },
    });

    expect(payload.eventName).toBe('form_submitted');
    expect(payload.userEmail).toBe('user@example.com');
    expect(payload.properties.password).toBe('[REDACTED]');
    expect(payload.properties.token).toBe('[REDACTED]');
    expect(payload.properties.nested.apiKey).toBe('[REDACTED]');
    expect(payload.properties.long).toHaveLength(1200);
  });

  it('normalizes transaction logging payloads for service and email operations', () => {
    const payload = buildTransactionPayload({
      transactionType: 'service_signup',
      status: 'success',
      actorEmail: 'VOLUNTEER@Example.COM',
      entityType: 'slot',
      entityId: 'svc-1:s1',
      latencyMs: 123.7,
      metadata: { providerMessageId: 'msg_123' },
    });

    expect(payload.transactionType).toBe('service_signup');
    expect(payload.actorEmail).toBe('volunteer@example.com');
    expect(payload.latencyMs).toBe(124);
    expect(payload.metadata.providerMessageId).toBe('msg_123');
  });

  it('safeSnippet handles non-strings and long strings', () => {
    expect(safeSnippet(null)).toBe('');
    expect(safeSnippet('a'.repeat(1300))).toHaveLength(1200);
  });
});
