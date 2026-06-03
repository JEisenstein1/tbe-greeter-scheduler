import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();

describe('chat scheduling query scope', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENROUTER_API_KEY = originalEnv;
  });

  async function post(message: string) {
    const mod = await import('../../api/chat.js?scope=' + encodeURIComponent(message));
    return mod.default({
      method: 'POST',
      json: async () => ({
        message,
        role: 'volunteer',
        user: { name: 'Jon Eisenstein', email: 'jon.eisenstein@gmail.com' },
        services: [{
          id: 'svc-1', dateISO: '2026-06-06', date: 'Saturday, June 6', time: '9:30 AM', type: 'Shabbat Morning', isHH: false,
          slots: [{ id: 's1', role: 'Greeter', timeSlot: null, volunteer: 'Jon Eisenstein' }],
        }],
      }),
    } as Request);
  }

  it.each([
    'what dates am I signed up for',
    'what services am I signed up for',
    'show my upcoming dates',
    'am I on the schedule?',
  ])('allows volunteer self-schedule query: %s', async (message) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'You are signed up for Shabbat Morning.', tool_calls: [] } }] }),
    });

    const res = await post(message);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).toContain('signed up');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
