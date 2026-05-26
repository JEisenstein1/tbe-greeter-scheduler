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
        service: {
          type: 'object',
          properties: {
            id: { type: 'string' }, dateISO: { type: 'string' }, date: { type: 'string' },
            time: { type: 'string' }, type: { type: 'string' }, isHH: { type: 'boolean' },
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
      required: ['service'],
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

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const send = async (data) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  (async () => {
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
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          stream: true,
          system: systemPrompt,
          tools,
          messages: [{ role: 'user', content: message }],
        }),
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        await send({ type: 'error', message: `Anthropic API ${anthropicRes.status}: ${errText}` });
        await writer.close();
        return;
      }

      const reader = anthropicRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentToolName = null;
      let currentToolInput = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event:')) continue;
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;

          let evt;
          try { evt = JSON.parse(raw); } catch { continue; }

          if (evt.type === 'content_block_start') {
            if (evt.content_block?.type === 'tool_use') {
              currentToolName = evt.content_block.name;
              currentToolInput = '';
            }
          } else if (evt.type === 'content_block_delta') {
            if (evt.delta?.type === 'text_delta') {
              await send({ type: 'text', delta: evt.delta.text });
            } else if (evt.delta?.type === 'input_json_delta' && currentToolName) {
              currentToolInput += evt.delta.partial_json;
            }
          } else if (evt.type === 'content_block_stop' && currentToolName) {
            try {
              const input = JSON.parse(currentToolInput);
              if (currentToolName === 'sign_me_up') {
                await send({ type: 'tool_action', action: 'sign_me_up', svcId: String(input.svcId), slotId: input.slotId });
              } else if (currentToolName === 'request_coverage') {
                await send({ type: 'tool_action', action: 'request_coverage', svcId: String(input.svcId), slotId: input.slotId });
              } else if (currentToolName === 'create_service') {
                await send({ type: 'tool_action', action: 'create_service', service: input.service });
              }
            } catch { /* malformed */ }
            currentToolName = null;
            currentToolInput = '';
          }
        }
      }

      await send({ type: 'done' });
    } catch (err) {
      await send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
