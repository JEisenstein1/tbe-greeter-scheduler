import { describe, expect, it } from 'vitest';
// @ts-expect-error Vercel API route is a plain JS module.
const { buildCalendarInvite, buildRawEmail, buildResendPayload } = await import('../../lib/signup.js');

describe('calendar invite email payloads', () => {
  const unfold = (ics: string) => ics.replace(/\r\n[ \t]/g, '');
  const service = {
    id: 'svc-calendar-test',
    date_iso: '2026-06-05',
    date_label: 'Friday, June 5',
    time_label: '6:30 PM',
    type: 'Kabbalat Shabbat',
  };
  const slot = { id: 'slot-calendar-test', role: 'Greeter', time_slot: null };
  const volunteer = { volName: 'Debbie Adler-Klein', volEmail: 'dakmd75@gmail.com' };

  it('builds an iCalendar REQUEST for the greeter assignment', () => {
    const invite = buildCalendarInvite({ service, slot, volunteer, organizerEmail: 'travis.thybot@gmail.com' });

    const content = unfold(invite.content);
    expect(invite.filename).toBe('tbe-greeter-svc-calendar-test-slot-calendar-test.ics');
    expect(content).toContain('BEGIN:VCALENDAR');
    expect(content).toContain('METHOD:REQUEST');
    expect(content).toContain('BEGIN:VEVENT');
    expect(content).toContain('SUMMARY:Kabbalat Shabbat Greeter');
    expect(content).toContain('DTSTART;TZID=America/New_York:20260605T183000');
    expect(content).toContain('DTEND;TZID=America/New_York:20260605T193000');
    expect(content).toContain('ATTENDEE;CN=Debbie Adler-Klein;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:dakmd75@gmail.com');
    expect(content).toContain('ORGANIZER;CN=Temple Beth El:mailto:travis.thybot@gmail.com');
  });

  it('attaches the iCalendar invite in Gmail raw MIME', () => {
    const invite = buildCalendarInvite({ service, slot, volunteer, organizerEmail: 'travis.thybot@gmail.com' });
    const raw = Buffer.from(buildRawEmail({
      from: 'Travis <travis.thybot@gmail.com>',
      to: volunteer.volEmail,
      subject: "You're scheduled — Kabbalat Shabbat, Friday, June 5",
      text: 'Confirmation text',
      calendarInvite: invite,
    }).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

    expect(raw).toContain('Subject: =?UTF-8?B?WW91J3JlIHNjaGVkdWxlZCDigJQgS2FiYmFsYXQgU2hhYmJhdCwgRnJpZGF5LCBKdW5lIDU=?=');
    expect(raw).not.toContain('Subject: You\'re scheduled —');
    expect(raw).toContain('Content-Type: multipart/mixed; boundary=');
    expect(raw).toContain('Content-Type: text/calendar; charset=utf-8; method=REQUEST; name="tbe-greeter-svc-calendar-test-slot-calendar-test.ics"');
    expect(raw).toContain('Content-Disposition: attachment; filename="tbe-greeter-svc-calendar-test-slot-calendar-test.ics"');
    expect(raw).toContain('Content-Class: urn:content-classes:calendarmessage');
    expect(raw).toContain('BEGIN:VCALENDAR');
  });

  it('adds the invite as a Resend attachment', () => {
    const invite = buildCalendarInvite({ service, slot, volunteer, organizerEmail: 'travis.thybot@gmail.com' });
    const payload = buildResendPayload({
      from: 'Travis <travis.thybot@gmail.com>',
      to: volunteer.volEmail,
      subject: 'Temple Beth El greeter confirmation',
      text: 'Confirmation text',
      calendarInvite: invite,
    });

    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0]).toMatchObject({ filename: invite.filename, contentType: 'text/calendar; method=REQUEST; charset=utf-8' });
    expect(Buffer.from(payload.attachments[0].content, 'base64').toString('utf8')).toContain('BEGIN:VCALENDAR');
  });
});
