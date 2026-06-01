export const config = { runtime: 'edge' };

function buildSystemPrompt(role, user, services) {
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

When creating a service, generate a sensible slot layout. Use sequential slot IDs like "s101", "s102" etc.
Only call create_service when the admin clearly intends to add a service.`;
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
- Only call request_coverage if the user wants a substitute for a slot they're already in.
- Never sign up someone already in that slot.
- Be warm, concise, and helpful.`;
}

const TOOLS = [
  {
    name: 'sign_me_up',
    description: 'Sign the current volunteer up for a specific open slot in a service.',
    input_schema: { type: 'object', properties: { svcId: { type: 'string' }, slotId: { type: 'string' } }, required: ['svcId', 'slotId'] },
  },
  {
    name: 'request_coverage',
    description: 'Request a substitute for a slot the user is already signed up for.',
    input_schema: { type: 'object', properties: { svcId: { type: 'string' }, slotId: { type: 'string' } }, required: ['svcId', 'slotId'] },
  },
  {
    name: 'create_service',
    description: 'Create a new service and add it to the calendar.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique ID e.g. "svc-20260607"' },
        dateISO: { type: 'string', description: 'YYYY-MM-DD' },
        date: { type: 'string', description: 'e.g. "Saturday, June 7"' },
        time: { type: 'string', description: 'e.g. "9:30 AM"' },
        type: { type: 'string', description: 'e.g. "Shabbat Morning"' },
        isHH: { type: 'boolean' },
        slots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' }, role: { type: 'string' },
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
];

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { message, role, user, services } = body;
  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: 'message required' }), { status: 400 });
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
      return new Response(JSON.stringify({ error: `Anthropic API request failed (${anthropicRes.status})` }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await anthropicRes.json();

    // Extract text and tool actions from response
    let text = '';
    const actions = [];

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

    return new Response(JSON.stringify({ text, actions }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Chat endpoint error', err);
    return new Response(JSON.stringify({ error: 'Chat endpoint failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
