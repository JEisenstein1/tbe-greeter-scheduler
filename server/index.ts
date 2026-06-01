import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── Types ─────────────────────────────────────────────────────

interface SlotInfo {
  id: string;
  role: string;
  timeSlot: string | null;
  volunteer: string | null;
}

interface ServiceInfo {
  id: string | number;
  dateISO: string;
  date: string;
  time: string;
  type: string;
  isHH: boolean;
  slots: SlotInfo[];
}

// ── System prompt ─────────────────────────────────────────────

function buildSystemPrompt(
  role: 'admin' | 'volunteer',
  user: { name: string; email: string } | null,
  services: ServiceInfo[],
): string {
  const today = new Date().toISOString().slice(0, 10);

  const svcLines = services.map(s => {
    const open = s.slots.filter(sl => !sl.volunteer);
    const filled = s.slots.filter(sl => sl.volunteer);
    const slotSummary = s.slots.map(sl =>
      `    - [${sl.id}] ${sl.role}${sl.timeSlot ? ` (${sl.timeSlot})` : ''}: ${sl.volunteer ? sl.volunteer : 'OPEN'}`
    ).join('\n');
    return `• ${s.date} ${s.time} — ${s.type}${s.isHH ? ' [HIGH HOLIDAY]' : ''} (id: ${s.id}) — ${open.length} open / ${filled.length} filled\n${slotSummary}`;
  }).join('\n\n');

  if (role === 'admin') {
    return `You are the AI scheduling assistant for Temple Beth El's greeter volunteer program.
Today is ${today}. You are speaking with an admin.

CURRENT CALENDAR (${services.length} services):
${svcLines || '(no services yet)'}

SLOT TEMPLATES by service type:
- Shabbat Morning: 2 Greeters (9:30 AM, 10:00 AM), 1 Usher, 1 Parking Attendant
- Friday Evening / Erev Shabbat: 2 Greeters (5:45 PM, 6:15 PM), 1 Usher
- Havdalah: 1 Greeter
- High Holiday (Rosh Hashanah / Yom Kippur): 4 Greeters (8:30 AM, 9:00 AM, 9:30 AM, 10:00 AM), 2 Ushers, 2 Parking Attendants
- Custom: use whatever slots the admin specifies

When creating a service, generate a sensible slot layout based on the service type unless the admin specifies otherwise. Use sequential slot IDs like "s101", "s102", etc. (use a starting offset like 100 + current timestamp mod 1000 to avoid collisions).

Only call create_service when the admin clearly intends to add a service. Confirm details conversationally before calling the tool if any key information is missing (date, time, type).`;
  }

  const userName = user?.name ?? 'the volunteer';
  const userEmail = user?.email ?? '(no email)';
  const mySlots = user ? services.flatMap(s =>
    s.slots.filter(sl => sl.volunteer === user.name).map(sl => ({
      svc: s, slot: sl,
    }))
  ) : [];

  const mySlotLines = mySlots.length
    ? mySlots.map(({ svc, slot }) =>
        `  - [svcId: ${svc.id}, slotId: ${slot.id}] ${svc.type} on ${svc.date} · ${slot.role}${slot.timeSlot ? ` (${slot.timeSlot})` : ''}`
      ).join('\n')
    : '  (none yet)';

  const openSlots = services.flatMap(s =>
    s.slots.filter(sl => !sl.volunteer).map(sl => ({
      svc: s, slot: sl,
    }))
  );
  const openLines = openSlots.length
    ? openSlots.slice(0, 12).map(({ svc, slot }) =>
        `  - [svcId: ${svc.id}, slotId: ${slot.id}] ${svc.type} on ${svc.date} · ${slot.role}${slot.timeSlot ? ` (${slot.timeSlot})` : ''}`
      ).join('\n')
    : '  (no open slots)';

  return `You are a friendly scheduling assistant for Temple Beth El's greeter volunteer program.
Today is ${today}. You are speaking with ${userName} (${userEmail}).

${userName}'s current commitments:
${mySlotLines}

Open slots available to sign up for:
${openLines}

Full calendar (for reference):
${svcLines || '(no services)'}

Guidelines:
- Only call sign_me_up if the user clearly wants to sign up for a specific slot. If it's ambiguous, ask which slot.
- Only call request_coverage if the user wants to find a substitute for a slot they're already in.
- Never sign up someone who is already in that slot.
- Be warm, concise, and helpful. Confirm the action briefly after calling a tool.`;
}

// ── Tools ─────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'sign_me_up',
    description: 'Sign the current volunteer up for a specific open slot in a service.',
    input_schema: {
      type: 'object' as const,
      properties: {
        svcId: { type: 'string', description: 'Service ID (as a string)' },
        slotId: { type: 'string', description: 'Slot ID within the service' },
      },
      required: ['svcId', 'slotId'],
    },
  },
  {
    name: 'request_coverage',
    description: 'Request a substitute for a slot the user is already signed up for.',
    input_schema: {
      type: 'object' as const,
      properties: {
        svcId: { type: 'string', description: 'Service ID (as a string)' },
        slotId: { type: 'string', description: 'Slot ID within the service' },
      },
      required: ['svcId', 'slotId'],
    },
  },
  {
    name: 'create_service',
    description: 'Create a new service and add it to the calendar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Unique ID for the service' },
        dateISO: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        date: { type: 'string', description: 'Human-readable date, e.g. "Saturday, May 31"' },
        time: { type: 'string', description: 'Time string, e.g. "9:30 AM"' },
        type: { type: 'string', description: 'Service type, e.g. "Shabbat Morning"' },
        isHH: { type: 'boolean', description: 'True if this is a High Holiday service' },
        slots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              role: { type: 'string', description: 'Role name, e.g. "Greeter", "Usher"' },
              timeSlot: { type: ['string', 'null'], description: 'Optional time sub-slot, e.g. "9:30 AM"' },
              volunteer: { type: ['string', 'null'] },
              volunteerEmail: { type: ['string', 'null'] },
            },
            required: ['id', 'role', 'timeSlot', 'volunteer', 'volunteerEmail'],
          },
        },
      },
      required: ['id', 'dateISO', 'date', 'time', 'type', 'isHH', 'slots'],
    },
  },
];

// ── Chat endpoint ─────────────────────────────────────────────

function jsonError(res: express.Response, status: number, error: string) {
  res.status(status).json({ error });
}

app.post('/api/chat', async (req, res) => {
  const { message, role, user, services = [] } = req.body as {
    message: string;
    role: 'admin' | 'volunteer';
    user: { name: string; email: string } | null;
    services: ServiceInfo[];
  };

  if (!message?.trim()) {
    jsonError(res, 400, 'message required');
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    jsonError(res, 500, 'ANTHROPIC_API_KEY is not set');
    return;
  }

  try {
    const systemPrompt = buildSystemPrompt(role, user, services);
    const tools = role === 'volunteer' ? TOOLS.filter(t => t.name !== 'create_service') : TOOLS;
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!anthropicRes.ok) {
      console.error('Anthropic API error', anthropicRes.status, await anthropicRes.text());
      jsonError(res, 502, `Anthropic API request failed (${anthropicRes.status})`);
      return;
    }

    const data = await anthropicRes.json() as { content?: Array<any> };
    let text = '';
    const actions: Array<Record<string, unknown>> = [];

    for (const block of data.content ?? []) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        const input = block.input ?? {};
        if (block.name === 'sign_me_up') {
          actions.push({ action: 'sign_me_up', svcId: String(input.svcId), slotId: input.slotId });
        } else if (block.name === 'request_coverage') {
          actions.push({ action: 'request_coverage', svcId: String(input.svcId), slotId: input.slotId });
        } else if (block.name === 'create_service') {
          actions.push({ action: 'create_service', service: input });
        }
      }
    }

    res.json({ text, actions });
  } catch (err: unknown) {
    console.error('Chat endpoint error', err);
    jsonError(res, 500, 'Chat endpoint failed');
  }
});

app.listen(3001, () => {
  console.log('TBE server listening on http://localhost:3001');
});
