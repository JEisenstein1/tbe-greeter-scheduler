import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

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

function buildSystemPrompt(
  role: 'admin' | 'volunteer',
  user: { name: string; email: string } | null,
  services: ServiceInfo[],
): string {
  const today = new Date().toISOString().slice(0, 10);

  const svcLines = services.map(s => {
    const slotSummary = s.slots.map(sl =>
      `    - [${sl.id}] ${sl.role}${sl.timeSlot ? ` (${sl.timeSlot})` : ''}: ${sl.volunteer ?? 'OPEN'}`
    ).join('\n');
    const open = s.slots.filter(sl => !sl.volunteer).length;
    const filled = s.slots.filter(sl => sl.volunteer).length;
    return `• ${s.date} ${s.time} — ${s.type}${s.isHH ? ' [HIGH HOLIDAY]' : ''} (id: ${s.id}) — ${open} open / ${filled} filled\n${slotSummary}`;
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

When creating a service, generate a sensible slot layout based on the service type unless the admin specifies otherwise. Use sequential slot IDs like "s101", "s102", etc.

Only call create_service when the admin clearly intends to add a service. Confirm details conversationally before calling the tool if any key information is missing.`;
  }

  const userName = user?.name ?? 'the volunteer';
  const userEmail = user?.email ?? '(no email)';

  const mySlots = user ? services.flatMap(s =>
    s.slots.filter(sl => sl.volunteer === user.name).map(sl => ({ svc: s, slot: sl }))
  ) : [];

  const mySlotLines = mySlots.length
    ? mySlots.map(({ svc, slot }) =>
        `  - [svcId: ${svc.id}, slotId: ${slot.id}] ${svc.type} on ${svc.date} · ${slot.role}${slot.timeSlot ? ` (${slot.timeSlot})` : ''}`
      ).join('\n')
    : '  (none yet)';

  const openSlots = services.flatMap(s =>
    s.slots.filter(sl => !sl.volunteer).map(sl => ({ svc: s, slot: sl }))
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
- Only call sign_me_up if the user clearly wants to sign up for a specific slot.
- Only call request_coverage if the user wants to find a substitute for a slot they're already in.
- Never sign up someone who is already in that slot.
- Be warm, concise, and helpful.`;
}

const TOOLS: Anthropic.Tool[] = [
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
        service: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            dateISO: { type: 'string', description: 'YYYY-MM-DD' },
            date: { type: 'string', description: 'e.g. "Saturday, May 31"' },
            time: { type: 'string', description: 'e.g. "9:30 AM"' },
            type: { type: 'string', description: 'e.g. "Shabbat Morning"' },
            isHH: { type: 'boolean' },
            slots: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  role: { type: 'string' },
                  timeSlot: { type: ['string', 'null'] },
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
      required: ['service'],
    },
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY environment variable is not set' });
    return;
  }

  const anthropic = new Anthropic({ apiKey });

  const { message, role, user, services } = req.body as {
    message: string;
    role: 'admin' | 'volunteer';
    user: { name: string; email: string } | null;
    services: ServiceInfo[];
  };

  if (!message?.trim()) {
    res.status(400).json({ error: 'message required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const systemPrompt = buildSystemPrompt(role, user, services);
    const tools = role === 'volunteer' ? TOOLS.filter(t => t.name !== 'create_service') : TOOLS;

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: [{ role: 'user', content: message }],
    });

    let currentToolName: string | null = null;
    let currentToolInput = '';

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_start') {
        if (chunk.content_block.type === 'tool_use') {
          currentToolName = chunk.content_block.name;
          currentToolInput = '';
        }
      } else if (chunk.type === 'content_block_delta') {
        if (chunk.delta.type === 'text_delta') {
          send({ type: 'text', delta: chunk.delta.text });
        } else if (chunk.delta.type === 'input_json_delta' && currentToolName) {
          currentToolInput += chunk.delta.partial_json;
        }
      } else if (chunk.type === 'content_block_stop' && currentToolName) {
        try {
          const input = JSON.parse(currentToolInput);
          if (currentToolName === 'sign_me_up') {
            send({ type: 'tool_action', action: 'sign_me_up', svcId: String(input.svcId), slotId: input.slotId });
          } else if (currentToolName === 'request_coverage') {
            send({ type: 'tool_action', action: 'request_coverage', svcId: String(input.svcId), slotId: input.slotId });
          } else if (currentToolName === 'create_service') {
            send({ type: 'tool_action', action: 'create_service', service: input.service });
          }
        } catch { /* malformed tool input */ }
        currentToolName = null;
        currentToolInput = '';
      }
    }

    send({ type: 'done' });
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    send({ type: 'error', message });
    res.end();
  }
}
