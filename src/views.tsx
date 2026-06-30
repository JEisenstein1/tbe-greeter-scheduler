import { useState, useEffect, useRef, useMemo } from 'react';
import type { Service, Slot, User, ChatMessage, SSEEvent } from './types';
import { VOLUNTEERS, ADMINS, SYNAGOGUE } from './data';
import { openCount, groupSlotsByTime, fmtDate, abbrev, statusFor } from './helpers';
import { findUserAssignments, getCalendarDayPrimaryAction } from './appLogic';
import { Icon, DateBadge, ServiceCard } from './components';

// ═══════════════════════════════════════════════════════════════
// AI Scheduler
// ═══════════════════════════════════════════════════════════════

interface AIViewProps {
  user: User | null;
  services: Service[];
  onAIVolunteerSignup: (svcId: string | number, slotId: string, vol: { name: string; email: string }) => void;
  onAIRemoveSignup: (svcId: string | number, slotId: string) => void;
  onAIRequestCoverage: (svcId: string | number, slotId: string) => void;
  onAICreateService: (svc: Service) => void | Promise<void>;
}

interface ActionCard {
  title: string;
  rows: [string, string][];
}

interface ChatBubble {
  role: 'user' | 'ai';
  text: string;
  card: ActionCard | null;
}

function ActionCard({ card }: { card: ActionCard }) {
  return (
    <div className="action-card">
      <div className="title">✦ {card.title}</div>
      {card.rows.map(([k, v], i) => (
        <div className="row" key={i}>
          <strong style={{ minWidth: 56, display: 'inline-block' }}>{k}</strong> {v}
        </div>
      ))}
    </div>
  );
}

export function AIView({ user, services, onAIVolunteerSignup, onAIRemoveSignup, onAIRequestCoverage, onAICreateService }: AIViewProps) {
  const effectiveRole = user?.role === 'admin' ? 'admin' : 'volunteer';
  const isGuest = !user;

  const intro = effectiveRole === 'admin'
    ? "Hi! I'm here to help you set up greeter and usher coverage for upcoming services. Tell me what's on the calendar — I'll handle the slot details."
    : isGuest
      ? "Welcome! I can help you find a service to sign up for. Sign in to manage your own schedule."
      : `Hi ${user!.name.split(' ')[0]}! I can sign you up for services, send you your upcoming dates, or find a substitute when you can't make it. What can I do?`;

  const heroEyebrow = effectiveRole === 'admin' ? 'AI Scheduling Assistant' : 'Your Scheduling Buddy';
  const heroTitle = effectiveRole === 'admin' ? 'Plan a service in plain English.' : 'Manage your schedule by chat.';
  const heroDesc = effectiveRole === 'admin'
    ? "Tell me about an upcoming service — Shabbat, High Holiday, or something custom — and I'll set up the right slots automatically."
    : isGuest
      ? "Sign in to have me manage your dates. Or ask what's coming up and I'll show you the calendar."
      : "Ask me to sign you up, list your dates, or find a sub. Try a quick one below.";

  const [messages, setMessages] = useState<ChatBubble[]>([{ role: 'ai', text: intro, card: null }]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [streamCard, setStreamCard] = useState<ActionCard | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages([{ role: 'ai', text: intro, card: null }]);
  }, [user?.email]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing, streamText]);

  const sendToAPI = async (userText: string) => {
    const history = messages
      .slice(-8)
      .filter(m => m.text?.trim())
      .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text.slice(0, 1200) }));
    setMessages(m => [...m, { role: 'user', text: userText, card: null }]);
    setTyping(true);
    setIsStreaming(true);

    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history,
          role: effectiveRole,
          user: user ? { name: user.name, email: user.email } : null,
          services: services.map(s => ({
            id: s.id, dateISO: s.dateISO, date: s.date, time: s.time,
            type: s.type, isHH: s.isHH,
            slots: s.slots.map(sl => ({ id: sl.id, role: sl.role, timeSlot: sl.timeSlot, volunteer: sl.volunteer, volunteerEmail: sl.volunteerEmail, coverageRequested: sl.coverageRequested })),
          })),
          volunteers: user?.role === 'admin' ? VOLUNTEERS.filter(v => v.active).map(v => ({ name: v.name, email: v.email, active: v.active })) : [],
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      }

      const data = await response.json() as { text: string; actions: { action: string; svcId?: string; slotId?: string; volunteerName?: string; volunteerEmail?: string; service?: Service }[]; error?: string };

      if (data.error) throw new Error(data.error);

      setTyping(false);

      let finalCard: ActionCard | null = null;

      for (const act of data.actions ?? []) {
        if (act.action === 'sign_me_up' && act.svcId && act.slotId) {
          if (!user) continue;
          onAIVolunteerSignup(act.svcId, act.slotId, { name: user.name, email: user.email });
          const svc = services.find(s => String(s.id) === String(act.svcId));
          const slot = svc?.slots.find(sl => sl.id === act.slotId);
          if (svc && slot) {
            finalCard = { title: svc.type, rows: [['When', `${svc.date} · ${svc.time}`], ['Role', slot.role], ['You', `${user.name} · ${user.email}`], ['', '✓ Confirmation sent']] };
          }
        } else if (act.action === 'assign_volunteer' && act.svcId && act.slotId && act.volunteerName && act.volunteerEmail) {
          onAIVolunteerSignup(act.svcId, act.slotId, { name: act.volunteerName, email: act.volunteerEmail });
          const svc = services.find(s => String(s.id) === String(act.svcId));
          const slot = svc?.slots.find(sl => sl.id === act.slotId);
          if (svc && slot) {
            finalCard = { title: svc.type, rows: [['When', `${svc.date} · ${svc.time}`], ['Role', slot.role], ['Volunteer', `${act.volunteerName} · ${act.volunteerEmail}`], ['', '✓ Confirmation sent']] };
          }
        } else if (act.action === 'remove_signup' && act.svcId && act.slotId) {
          onAIRemoveSignup(act.svcId, act.slotId);
          const svc = services.find(s => String(s.id) === String(act.svcId));
          const slot = svc?.slots.find(sl => sl.id === act.slotId);
          if (svc && slot) {
            finalCard = { title: 'Removed from service', rows: [['Event', `${svc.type} · ${svc.date}`], ['Role', `${slot.role}${slot.timeSlot ? ` · ${slot.timeSlot}` : ''}`], ['Status', 'Assignment removed']] };
          }
        } else if (act.action === 'request_coverage' && act.svcId && act.slotId) {
          onAIRequestCoverage(act.svcId, act.slotId);
          const svc = services.find(s => String(s.id) === String(act.svcId));
          const slot = svc?.slots.find(sl => sl.id === act.slotId);
          if (svc && slot) {
            finalCard = { title: 'Looking for a substitute', rows: [['Event', `${svc.type} · ${svc.date}`], ['Role', `${slot.role}${slot.timeSlot ? ` · ${slot.timeSlot}` : ''}`], ['Status', 'Coverage requested — admin notified']] };
          }
        } else if (act.action === 'create_service' && act.service) {
          await onAICreateService(act.service);
          finalCard = { title: act.service.type, rows: [['Date', act.service.date], ['Time', act.service.time], ['Slots', `${act.service.slots.length} total`]] };
        }
      }

      setMessages(m => [...m, { role: 'ai', text: data.text, card: finalCard }]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setTyping(false);
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(m => [...m, { role: 'ai', text: `Error: ${msg}`, card: null }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const chips = effectiveRole === 'admin'
    ? [
        { label: 'Add Kabbalat Shabbat for this Friday' },
        { label: 'Set up Rosh Hashanah Sep 12, 9am–1pm' },
        { label: 'Add a Saturday morning Shabbat' },
      ]
    : isGuest
      ? [
          { label: "What's coming up this Friday?" },
          { label: 'How do I sign up?' },
        ]
      : [
          { label: 'Sign me up for this Friday' },
          { label: 'Send me my upcoming dates' },
          { label: "I can't make my next service" },
          { label: "What's my next service?" },
        ];

  const send = () => {
    const t = input.trim();
    if (!t || isStreaming) return;
    setInput('');
    sendToAPI(t);
  };

  return (
    <div className="ai">
      <div className="ai-hero">
        <span className="star s1">✦</span>
        <span className="star s2">✦</span>
        <span className="star s3">✦</span>
        <span className="star s4">✦</span>
        <div className="eyebrow">{heroEyebrow}</div>
        <h2>{heroTitle}</h2>
        <p>{heroDesc}</p>
      </div>

      <div className="chat" ref={scrollRef}>
        {messages.map((m, i) => {
          if (!m.text && !m.card) return null;
          return (
            <div className={`bubble ${m.role}`} key={i}>
              {m.role === 'ai' && <div className="ai-meta">Assistant</div>}
              {m.text && <div>{m.text}</div>}
              {m.card && <ActionCard card={m.card} />}
            </div>
          );
        })}
        {typing && (
          <div className="bubble ai">
            <div className="ai-meta">Assistant</div>
            <div className="typing"><span /><span /><span /></div>
          </div>
        )}
        {streamText && (
          <div className="bubble ai">
            <div className="ai-meta">Assistant</div>
            <div>
              {streamText}
              <span style={{
                display: 'inline-block', width: 7, height: 14,
                background: 'var(--c-gold)', marginLeft: 2,
                transform: 'translateY(2px)', animation: 'blink 1s infinite',
              }} />
            </div>
            {streamCard && <ActionCard card={streamCard} />}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="divider-orn">Try one</div>
        <div className="chips">
          {chips.map((c, i) => (
            <button key={i} className="chip" onClick={() => { if (!isStreaming) sendToAPI(c.label); }}>
              <span className="spk">✦</span>{c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chat-input-bar">
        <textarea
          rows={1}
          placeholder={effectiveRole === 'admin' ? 'Tell me about a service…' : 'Ask me anything about your schedule…'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        <button className="send" onClick={send} disabled={!input.trim() || isStreaming}>
          <Icon name="send" size={18} />
        </button>
      </div>
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Calendar (List + Grid)
// ═══════════════════════════════════════════════════════════════

interface CalendarViewProps {
  services: Service[];
  defaultView?: string;
  user?: User | null;
  onOpenAuth?: () => void;
  onAssign: (svc: Service, slot: Slot) => void;
  onRemove: (svcId: string | number, slotId: string) => void;
  onSignUp?: (svc: Service, slot: Slot, vol: { name: string; email: string }) => void;
  onRequestCoverage?: (svcId: string | number, slotId: string) => void;
  onSelfRemove?: (svcId: string | number, slotId: string) => void;
  onCreateEvent: (date: string | null) => void;
  onEditEvent: (svc: Service) => void;
  onDeleteEvent: (svc: Service) => void;
}

export function CalendarView({ services, defaultView, user, onOpenAuth, onAssign, onRemove, onSignUp, onRequestCoverage, onSelfRemove, onCreateEvent, onEditEvent, onDeleteEvent }: CalendarViewProps) {
  const [mode, setMode] = useState(defaultView || 'list');
  const [showPast, setShowPast] = useState(false);
  useEffect(() => { setMode(defaultView || 'list'); }, [defaultView]);

  const todayISO = new Date().toISOString().slice(0, 10);
  const { pastServices, upcomingServices } = useMemo(() => {
    const sorted = [...services].sort((a, b) => String(a.dateISO).localeCompare(String(b.dateISO)));
    return {
      pastServices: sorted.filter(s => String(s.dateISO) < todayISO),
      upcomingServices: sorted.filter(s => String(s.dateISO) >= todayISO),
    };
  }, [services, todayISO]);

  const stats = useMemo(() => {
    let filled = 0, open = 0;
    services.forEach(s => s.slots.forEach(sl => sl.volunteer ? filled++ : open++));
    return { filled, open };
  }, [services]);

  const renderServiceCard = (svc: Service) => (
    <ServiceCard key={svc.id} svc={svc} mode={user?.role === 'admin' ? 'admin' : 'volunteer'}
                 currentUserName={user?.name}
                 onAssign={onAssign} onRemove={onRemove}
                 onSignUp={(svc, slot) => user ? onSignUp?.(svc, slot, { name: user.name, email: user.email }) : onOpenAuth?.()}
                 onRequestCoverage={onRequestCoverage}
                 onSelfRemove={onSelfRemove}
                 onEdit={user?.role === 'admin' ? onEditEvent : undefined}
                 onDelete={user?.role === 'admin' ? onDeleteEvent : undefined}
                 name={user?.name || 'Guest'} email={user?.email || 'guest@example.com'} />
  );

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Coverage</div>
        <h1>The Calendar</h1>
        <p>Tap any date to see, edit, or add events. Filled slots show in green; openings need a volunteer.</p>
      </div>

      <div className="stats" style={{ marginTop: 4 }}>
        <div className="stat">
          <div className="n"><span className="accent-green">{stats.filled}</span></div>
          <div className="lbl">Slots Filled</div>
        </div>
        <div className="stat">
          <div className="n"><span className="accent-red">{stats.open}</span></div>
          <div className="lbl">Slots Open</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <div className="results-pill"><strong>{upcomingServices.length}</strong> upcoming / <strong>{services.length}</strong> total services</div>
        <div className="seg">
          <button aria-pressed={mode === 'list'} onClick={() => setMode('list')}>List</button>
          <button aria-pressed={mode === 'grid'} onClick={() => setMode('grid')}>Grid</button>
        </div>
      </div>

      {pastServices.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className="results-pill"
            aria-expanded={showPast}
            onClick={() => setShowPast(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', border: '1px solid var(--line)', background: 'rgba(255,255,255,.7)' }}>
            <span><strong>{pastServices.length}</strong> past service{pastServices.length === 1 ? '' : 's'} hidden</span>
            <span aria-hidden="true">{showPast ? '▾' : '▸'} View previous services</span>
          </button>
          {showPast && (
            <div style={{ display: 'grid', gap: 12, marginTop: 8, opacity: 0.86 }}>
              {pastServices.map(renderServiceCard)}
            </div>
          )}
        </div>
      )}

      {mode === 'list' ? (
        <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
          {upcomingServices.length ? upcomingServices.map(renderServiceCard) : (
            <div className="empty-card">No upcoming services scheduled yet.</div>
          )}
        </div>
      ) : (
        <GridCalendar services={upcomingServices}
                      user={user} onOpenAuth={onOpenAuth}
                      onAssign={onAssign} onRemove={onRemove}
                      onSignUp={onSignUp} onRequestCoverage={onRequestCoverage} onSelfRemove={onSelfRemove}
                      onCreateEvent={onCreateEvent}
                      onEditEvent={onEditEvent}
                      onDeleteEvent={onDeleteEvent} />
      )}

      {user?.role === 'admin' && (
        <button className="fab" onClick={() => onCreateEvent(null)}>
          <span className="plus">+</span> New event
        </button>
      )}
    </div>
  );
}

function GridCalendar({ services, user, onOpenAuth, onAssign, onRemove, onSignUp, onRequestCoverage, onSelfRemove, onCreateEvent, onEditEvent, onDeleteEvent }: CalendarViewProps) {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4); // May
  const [selected, setSelected] = useState<string | null>(null);

  const todayISO = new Date().toISOString().slice(0, 10);

  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWd = first.getDay();
  const cells: ({ d: number; iso: string } | null)[] = [];
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ d, iso });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const svcByDay = useMemo(() => {
    const m: Record<string, Service[]> = {};
    services.forEach(s => {
      if (!m[s.dateISO]) m[s.dateISO] = [];
      m[s.dateISO].push(s);
    });
    return m;
  }, [services]);

  const monthLabel = new Date(year, month, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const nav = (dir: number) => {
    let m = month + dir, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y); setSelected(null);
  };

  const selectedSvcs = selected ? (svcByDay[selected] || []) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
      <div className="cal-legend">
        <div className="item"><span className="swatch full" /> Fully Staffed</div>
        <div className="item"><span className="swatch partial" /> Partially Open</div>
        <div className="item"><span className="swatch open" /> Unfilled</div>
      </div>

      <div className="cal">
        <div className="cal-hd">
          <div className="month">{monthLabel}</div>
          <div className="cal-nav">
            <button onClick={() => nav(-1)}><Icon name="chevL" size={14} /></button>
            <button onClick={() => nav(1)}><Icon name="chevR" size={14} /></button>
          </div>
        </div>
        <div className="cal-grid">
          {['S','M','T','W','T','F','S'].map((w, i) => (
            <div key={i} className="cal-wdh">{w}</div>
          ))}
          {cells.map((cell, i) => {
            if (!cell) return <div key={i} className="cal-cell muted" />;
            const svcs = svcByDay[cell.iso] || [];
            const has = svcs.length > 0;
            const isToday = cell.iso === todayISO;
            const isSel = cell.iso === selected;

            const initials: { ini: string; name: string }[] = [];
            const seen = new Set<string>();
            svcs.forEach(s => s.slots.forEach(sl => {
              if (sl.volunteer && !seen.has(sl.volunteer)) {
                seen.add(sl.volunteer);
                const parts = sl.volunteer.trim().split(/\s+/);
                const ini = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
                initials.push({ ini: ini.toUpperCase(), name: sl.volunteer });
              }
            }));

            return (
              <div key={i}
                   className={`cal-cell${has ? ' has' : ''}${isToday ? ' today' : ''}${isSel ? ' selected' : ''}`}
                   onClick={() => setSelected(isSel ? null : cell.iso)}>
                <div className="num">{cell.d}</div>
                {has && (
                  <div className="pills">
                    {svcs.slice(0, 2).map(s => {
                      const st = statusFor(s);
                      return <div key={s.id} className={`cal-pill ${st.kind}`}>{abbrev(s.type)}</div>;
                    })}
                    {svcs.length > 2 && <div className="cal-pill open">+{svcs.length - 2}</div>}
                  </div>
                )}
                {initials.length > 0 && (
                  <div className="initials">
                    {initials.slice(0, 3).map((x, j) => (
                      <span key={j} className="cal-init" title={x.name}>{x.ini}</span>
                    ))}
                    {initials.length > 3 && (
                      <span className="cal-init more">+{initials.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="day-panel">
          <div className="day-panel-hd">
            <span>{fmtDate(selected)}</span>
            <button className="btn sm ghost" onClick={() => setSelected(null)}>
              <Icon name="x" size={14} /> Close
            </button>
          </div>
          {selectedSvcs.length === 0 ? (
            <div className="day-create">
              <div className="glyph">✦</div>
              <div className="msg">No services scheduled for this day yet.</div>
              {user?.role === 'admin' ? (
                <button className="btn primary" onClick={() => onCreateEvent(selected)}>
                  <Icon name="pen" size={14} /> Create event on this day
                </button>
              ) : (
                <button className="btn primary" onClick={() => onOpenAuth?.()}>
                  Sign in to volunteer
                </button>
              )}
            </div>
          ) : (
            <>
              {selectedSvcs.map(svc => (
                <ServiceCard key={svc.id} svc={svc} mode={user?.role === 'admin' ? 'admin' : 'volunteer'}
                             currentUserName={user?.name}
                             onAssign={onAssign} onRemove={onRemove}
                             onSignUp={(svc, slot) => user ? onSignUp?.(svc, slot, { name: user.name, email: user.email }) : onOpenAuth?.()}
                             onRequestCoverage={onRequestCoverage}
                             onSelfRemove={onSelfRemove}
                             onEdit={user?.role === 'admin' ? onEditEvent : undefined}
                             onDelete={user?.role === 'admin' ? onDeleteEvent : undefined}
                             name={user?.name || 'Guest'} email={user?.email || 'guest@example.com'} />
              ))}
              {user?.role === 'admin' && (
                <button className="btn ghost" onClick={() => onCreateEvent(selected)} style={{ alignSelf: 'flex-start' }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--c-gold)', color: 'var(--c-navy)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                  }}>+</span>
                  Add another event on this day
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sign Up (volunteer)
// ═══════════════════════════════════════════════════════════════

interface SignUpViewProps {
  services: Service[];
  user: User | null;
  onOpenAuth: () => void;
  onSignUp: (svc: Service, slot: Slot, vol: { name: string; email: string }) => void;
  onRequestCoverage: (svcId: string | number, slotId: string) => void;
  onSelfRemove: (svcId: string | number, slotId: string) => void;
}

export function SignUpView({ services, user, onOpenAuth, onSignUp, onRequestCoverage, onSelfRemove }: SignUpViewProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const effectiveName  = user ? user.name  : name;
  const effectiveEmail = user ? user.email : email;
  const ready = !!effectiveName.trim() && !!effectiveEmail.trim();

  const visible = services.filter(s => {
    const hasOpen = openCount(s) > 0;
    const mine = user && s.slots.some(sl => sl.volunteer && sl.volunteer.toLowerCase() === user.name.toLowerCase());
    return hasOpen || mine;
  });

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Volunteer</div>
        <h1>Sign Up to Greet</h1>
        <p>Welcome friends at the door for one of our upcoming services. Open spots fill on a first-come basis.</p>
      </div>

      {user ? (
        <div className="welcome-card">
          <div className="avatar">{user.name.charAt(0)}</div>
          <div className="who">
            <div className="eyebrow">Signed in</div>
            <div className="nm">Hi, {user.name.split(' ')[0]}</div>
            <div className="em">{user.email}</div>
          </div>
          <button className="swap" onClick={onOpenAuth}>Switch</button>
        </div>
      ) : (
        <>
          <div className="signin-prompt">
            <Icon name="user" size={16} />
            <span><strong>Have an account?</strong> Sign in so we remember you.</span>
            <button onClick={onOpenAuth}>Sign in</button>
          </div>
          <div className="signup-form">
            <div className="lbl-pair">
              <label>Your name</label>
              <input type="text" placeholder="e.g. Miriam Katz"
                     value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="lbl-pair">
              <label>Email</label>
              <input type="email" placeholder="you@email.com"
                     value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <div className="results-pill">
          <strong>{visible.length}</strong>{' '}
          {visible.length === 1 ? 'service' : 'services'} {user ? 'to manage' : 'with openings'}
        </div>
        {!ready && !user && (
          <div style={{ fontSize: 11.5, color: 'var(--c-muted)', fontStyle: 'italic' }}>
            Add your details to enable sign-up
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 12, marginTop: 4 }}>
        {visible.length === 0 ? (
          <div className="empty">
            <div className="glyph">✦</div>
            All slots are filled. Thank you to our volunteers!
          </div>
        ) : visible.map(svc => (
          <ServiceCard key={svc.id} svc={svc} mode="volunteer"
                       currentUserName={user?.name}
                       onSignUp={(svc, slot) => onSignUp(svc, slot, { name: effectiveName, email: effectiveEmail })}
                       onRequestCoverage={onRequestCoverage}
                       onSelfRemove={onSelfRemove}
                       name={effectiveName} email={effectiveEmail} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// My Dates
// ═══════════════════════════════════════════════════════════════

interface MyDatesViewProps {
  services: Service[];
  user: User | null;
  onOpenAuth: () => void;
  onRequestCoverage: (svcId: string | number, slotId: string) => void;
  onSelfRemove: (svcId: string | number, slotId: string) => void;
}

export function MyDatesView({ services, user, onOpenAuth, onRequestCoverage, onSelfRemove }: MyDatesViewProps) {
  const [query, setQuery] = useState(user?.name || '');
  const [submitted, setSubmitted] = useState(user?.name || '');

  useEffect(() => {
    if (user) { setQuery(user.name); setSubmitted(user.name); }
  }, [user?.name]);

  const lookup = () => setSubmitted(query.trim());

  const matches = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    if (!user && !submitted) return null;
    return findUserAssignments(services, user, todayISO, submitted);
  }, [submitted, services, user]);

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Volunteer</div>
        <h1>My Dates</h1>
        <p>{user ? 'Your upcoming greeter and usher assignments.' : "Look up the services you're scheduled to greet at."}</p>
      </div>

      {user ? (
        <div className="welcome-card" style={{ marginBottom: 4 }}>
          <div className="avatar">{user.name.charAt(0)}</div>
          <div className="who">
            <div className="eyebrow">Signed in</div>
            <div className="nm">{user.name}</div>
            <div className="em">{user.email}</div>
          </div>
          <button className="swap" onClick={onOpenAuth}>Switch</button>
        </div>
      ) : (
        <>
          <div className="signin-prompt">
            <Icon name="user" size={16} />
            <span><strong>Sign in</strong> to see your dates automatically.</span>
            <button onClick={onOpenAuth}>Sign in</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" placeholder="Or enter your name…"
                   value={query} onChange={e => setQuery(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && lookup()}
                   style={{ flex: 1, padding: '11px 14px', background: 'var(--c-card)', border: '1px solid var(--c-line)', borderRadius: 'var(--r-md)', outline: 'none', fontSize: 14 }} />
            <button className="btn primary" onClick={lookup}>
              <Icon name="search" size={14} /> Look Up
            </button>
          </div>
        </>
      )}

      <div style={{ marginTop: 14 }}>
        {matches === null && (
          <div className="empty">
            <div className="glyph">✦</div>
            Enter your name and tap Look Up.
          </div>
        )}
        {matches !== null && matches.length === 0 && (
          <div className="empty">
            <div className="glyph">·</div>
            No upcoming assignments {user ? 'yet' : `found for "${submitted}"`}. Head to Sign Up to volunteer.
          </div>
        )}
        {matches !== null && matches.length > 0 && (
          <>
            <div className="results-pill" style={{ marginBottom: 10 }}>
              <strong>{matches.length}</strong> upcoming assignment{matches.length === 1 ? '' : 's'}
              {!user && ` for ${submitted}`}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {matches.map(({ svc, slot }, i) => (
                <div key={i} className="card">
                  <div className="card-hd no-border">
                    <DateBadge iso={svc.dateISO} />
                    <div className="card-info">
                      <div className="type">{svc.type}</div>
                      <div className="meta">
                        <span style={{ whiteSpace: 'nowrap' }}>{svc.date.split(',')[0]}</span>
                        <span className="sep">·</span>
                        <span style={{ whiteSpace: 'nowrap' }}>{svc.time}</span>
                        {svc.isHH && <span className="tag-hh">HH</span>}
                      </div>
                      <div style={{ marginTop: 8, display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--c-gold)', fontWeight: 600, letterSpacing: '0.04em' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-gold)' }} />
                        {slot.role}{slot.timeSlot ? ` · ${slot.timeSlot}` : ''}
                        {slot.coverageRequested && (
                          <span className="cov-tag" style={{ marginLeft: 4 }}>Coverage requested</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {user && (
                    <div className="card-admin-row">
                      <span className="lbl">Your commitment</span>
                      {!slot.coverageRequested && (
                        <button className="slot-action" onClick={() => onRequestCoverage(svc.id, slot.id)}>
                          Request coverage
                        </button>
                      )}
                      <button className="slot-action danger" onClick={() => onSelfRemove(svc.id, slot.id)}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Email Templates
// ═══════════════════════════════════════════════════════════════

const DEFAULT_REMINDER = `Shalom {volunteer_name},

A gentle reminder that we still have a few greeter and usher openings on the calendar. If you're able to take one, your community thanks you.

{open_slots_list}

Sign up here: {signup_link}

With gratitude,
Temple Beth El`;

const DEFAULT_CONFIRMATION = `Shalom {volunteer_name},

Thank you for serving as {role} at {service_type} on {date}.

Time: {time}
{timeslot_line}

A Google Calendar invite is attached to this message. We'll see you at the door!

— Temple Beth El`;

export function EmailView({ onBack }: { onBack?: () => void }) {
  const [tab, setTab] = useState<'reminder' | 'confirmation'>('reminder');
  const [reminder, setReminder] = useState(DEFAULT_REMINDER);
  const [confirmation, setConfirmation] = useState(DEFAULT_CONFIRMATION);
  const [preview, setPreview] = useState(false);
  const [sendState, setSendState] = useState<{ name: string; email: string; status: 'queued' | 'sending' | 'sent' }[] | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const insertVar = (v: string) => {
    const el = textRef.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const cur = tab === 'reminder' ? reminder : confirmation;
    const next = cur.slice(0, start) + v + cur.slice(end);
    if (tab === 'reminder') setReminder(next); else setConfirmation(next);
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = start + v.length; }, 0);
  };

  const variables = tab === 'reminder'
    ? ['{volunteer_name}', '{open_slots_list}', '{signup_link}']
    : ['{volunteer_name}', '{service_type}', '{date}', '{time}', '{role}', '{timeslot_line}'];

  const sample = tab === 'reminder' ? {
    volunteer_name: 'Miriam',
    open_slots_list: '• Friday, May 29 — Kabbalat Shabbat, Greeter (6:30 PM)',
    signup_link: 'tbe.org/greet',
  } : {
    volunteer_name: 'Miriam',
    service_type: 'Kabbalat Shabbat',
    date: 'Friday, May 29',
    time: '6:30 PM',
    role: 'Greeter',
    timeslot_line: '',
  };

  const renderTemplate = (t: string) => {
    let out = t;
    Object.entries(sample).forEach(([k, v]) => { out = out.split('{' + k + '}').join(v); });
    return out;
  };

  const startSend = () => {
    const init = VOLUNTEERS.map(v => ({ ...v, status: 'queued' as const }));
    setSendState(init);
    init.forEach((_, i) => {
      setTimeout(() => setSendState(prev => prev!.map((p, idx) => idx === i ? { ...p, status: 'sending' } : p)), 300 + i * 360);
      setTimeout(() => setSendState(prev => prev!.map((p, idx) => idx === i ? { ...p, status: 'sent' } : p)), 900 + i * 360);
    });
  };

  const current = tab === 'reminder' ? reminder : confirmation;

  return (
    <div>
      {onBack ? (
        <div className="sub-head">
          <button className="back-btn" onClick={onBack}><Icon name="chevL" size={16} /></button>
          <div className="page-head" style={{ flex: 1, marginBottom: 0 }}>
            <div className="eyebrow">Admin · Communication</div>
            <h1>Email Templates</h1>
          </div>
        </div>
      ) : (
        <div className="page-head">
          <div className="eyebrow">Communication</div>
          <h1>Email Templates</h1>
          <p>Edit the messages we send to volunteers. Variables in braces are filled in automatically.</p>
        </div>
      )}

      <div className="tpl-tabs">
        <button aria-selected={tab === 'reminder'} onClick={() => { setTab('reminder'); setPreview(false); }}>
          Weekly Reminder
        </button>
        <button aria-selected={tab === 'confirmation'} onClick={() => { setTab('confirmation'); setPreview(false); }}>
          Confirmation
        </button>
      </div>

      <div className="tpl-banner">
        <span className="ico"><Icon name="info" size={16} /></span>
        {tab === 'reminder'
          ? 'Sent to all volunteers when you tap Send. Intended for a weekly cadence.'
          : 'Sent automatically whenever a volunteer is assigned, or when one signs themselves up.'}
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-muted)', fontWeight: 600, marginBottom: 6 }}>
          Insert variable
        </div>
        <div className="var-chips">
          {variables.map(v => (
            <button key={v} className="var-chip" onClick={() => insertVar(v)}>{v}</button>
          ))}
        </div>
      </div>

      <textarea ref={textRef} className="tpl-text" value={current}
                onChange={e => tab === 'reminder' ? setReminder(e.target.value) : setConfirmation(e.target.value)} />

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={() => setPreview(!preview)}>
          {preview ? 'Hide preview' : 'Preview'}
        </button>
        <button className="btn primary">Save template</button>
      </div>

      {preview && (
        <div className="email-preview" style={{ marginTop: 4 }}>
          <div className="row">
            <div className="lbl">To</div>
            <div className="val">{sample.volunteer_name} &lt;sample@email.com&gt;</div>
          </div>
          <div className="row">
            <div className="lbl">Subj</div>
            <div className="val">
              {tab === 'reminder' ? 'This week at Temple Beth El' : `You're scheduled — ${'service_type' in sample ? sample.service_type : ''}`}
            </div>
          </div>
          <div className="body">{renderTemplate(current)}</div>
        </div>
      )}

      {tab === 'reminder' && (
        <>
          <div className="divider-orn">Distribution</div>
          <button className="btn gold" onClick={startSend} disabled={!!(sendState && sendState.some(s => s.status === 'sending'))}>
            <Icon name="send" size={14} /> Send to All Volunteers
          </button>
          {sendState && (
            <div className="card" style={{ padding: '8px 16px', marginTop: 8 }}>
              {sendState.map((v, i) => (
                <div className="send-row" key={i}>
                  <div className="name">
                    {v.name}
                    <span className="em">{v.email}</span>
                  </div>
                  <span className={`status ${v.status}`}>
                    {v.status === 'queued' && 'Queued'}
                    {v.status === 'sending' && 'Sending…'}
                    {v.status === 'sent' && 'Sent'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Admin Hub
// ═══════════════════════════════════════════════════════════════

interface AdminHubViewProps {
  services: Service[];
  onNavSub: (sub: string) => void;
}

export function AdminHubView({ services, onNavSub }: AdminHubViewProps) {
  const coverageCount = useMemo(() => {
    let n = 0;
    services.forEach(s => s.slots.forEach(sl => sl.coverageRequested && n++));
    return n;
  }, [services]);
  const openSlots = useMemo(() => {
    let n = 0;
    services.forEach(s => s.slots.forEach(sl => !sl.volunteer && n++));
    return n;
  }, [services]);

  const tiles = [
    { id: 'coverage', ico: 'bell' as const, name: 'Coverage Requests', desc: 'Volunteers looking for substitutes', badge: coverageCount > 0 ? coverageCount : null },
    { id: 'volunteers', ico: 'user' as const, name: 'Volunteers', desc: `${VOLUNTEERS.filter(v => v.active).length} active profiles` },
    { id: 'admins', ico: 'handshake' as const, name: 'Admins', desc: `${ADMINS.length} people with admin access` },
    { id: 'email', ico: 'mail' as const, name: 'Email Templates', desc: 'Reminder & confirmation messages' },
    { id: 'settings', ico: 'info' as const, name: 'Settings', desc: 'Synagogue info & integrations' },
  ];

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Admin</div>
        <h1>Admin Hub</h1>
        <p>Manage people, templates, and coverage requests. {openSlots} open slot{openSlots === 1 ? '' : 's'} across the year.</p>
      </div>
      <div className="hub-grid">
        {tiles.map(t => (
          <button key={t.id} className="hub-tile" onClick={() => onNavSub(t.id)}>
            {t.badge && <span className="badge">{t.badge}</span>}
            <div className="ico-wrap"><Icon name={t.ico} size={18} /></div>
            <div className="nm">{t.name}</div>
            <div className="desc">{t.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Volunteers (admin)
// ═══════════════════════════════════════════════════════════════

export function VolunteersView({ onBack }: { onBack: () => void }) {
  const [volunteers, setVolunteers] = useState(VOLUNTEERS);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const addOne = () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setVolunteers(v => [...v, { name: newName.trim(), email: newEmail.trim(), active: true, joined: new Date().toISOString().slice(0, 10), servedCount: 0 }]);
    setNewName(''); setNewEmail(''); setAdding(false);
  };

  const toggleActive = (email: string) => setVolunteers(v => v.map(x => x.email === email ? { ...x, active: !x.active } : x));
  const remove = (email: string) => setVolunteers(v => v.filter(x => x.email !== email));

  return (
    <div>
      <div className="sub-head">
        <button className="back-btn" onClick={onBack}><Icon name="chevL" size={16} /></button>
        <div className="page-head" style={{ flex: 1, marginBottom: 0 }}>
          <div className="eyebrow">Admin</div>
          <h1>Volunteers</h1>
        </div>
      </div>
      <p style={{ color: 'var(--c-muted)', fontSize: 14, margin: '0 0 4px' }}>
        These profiles power assignment and look-up.
      </p>
      <div className="people-list">
        {volunteers.map(v => {
          const init = (v.name[0] || '?').toUpperCase() + (v.name.split(' ')[1]?.[0] || '').toUpperCase();
          return (
            <div className={`person-row ${v.active ? '' : 'inactive'}`} key={v.email}>
              <div className="av">{init}</div>
              <div className="who">
                <div className="nm">
                  {v.name}
                  {!v.active && <span className="role-chip inactive">Inactive</span>}
                </div>
                <div className="em">{v.email}</div>
                <div className="meta-line">
                  Joined {new Date(v.joined + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  {' · '}{v.servedCount} service{v.servedCount === 1 ? '' : 's'} served
                </div>
              </div>
              <div className="actions">
                <button className="slot-action" onClick={() => toggleActive(v.email)}>
                  {v.active ? 'Deactivate' : 'Reactivate'}
                </button>
                <button className="slot-action danger" onClick={() => remove(v.email)}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>
      {adding ? (
        <div className="add-row">
          <div className="ev-row">
            <label>Name</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. David Adler" />
          </div>
          <div className="ev-row">
            <label>Email</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="dadler@gmail.com" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn primary" onClick={addOne} disabled={!newName.trim() || !newEmail.trim()}>Add volunteer</button>
          </div>
        </div>
      ) : (
        <button className="btn" onClick={() => setAdding(true)} style={{ alignSelf: 'flex-start' }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--c-gold)', color: 'var(--c-navy)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>+</span>
          Add volunteer
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Admins (admin)
// ═══════════════════════════════════════════════════════════════

export function AdminsView({ onBack }: { onBack: () => void }) {
  const [admins, setAdmins] = useState(ADMINS);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const add = () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setAdmins(a => [...a, { name: newName.trim(), email: newEmail.trim(), role: 'Admin', joined: new Date().toISOString().slice(0, 10), source: 'invited' }]);
    setNewName(''); setNewEmail(''); setAdding(false);
  };
  const remove = (email: string) => setAdmins(a => a.filter(x => x.email !== email));

  return (
    <div>
      <div className="sub-head">
        <button className="back-btn" onClick={onBack}><Icon name="chevL" size={16} /></button>
        <div className="page-head" style={{ flex: 1, marginBottom: 0 }}>
          <div className="eyebrow">Admin</div>
          <h1>Admins</h1>
        </div>
      </div>
      <p style={{ color: 'var(--c-muted)', fontSize: 14, margin: '0 0 4px' }}>
        People who can edit the schedule, manage volunteers, and send reminders.
      </p>
      <div className="people-list">
        {admins.map(a => {
          const init = (a.name.replace(/^Rabbi\s+/, '')[0] || '?').toUpperCase()
                     + (a.name.replace(/^Rabbi\s+/, '').split(' ')[1]?.[0] || '').toUpperCase();
          return (
            <div className="person-row" key={a.email}>
              <div className="av">{init}</div>
              <div className="who">
                <div className="nm">
                  {a.name}
                  <span className={`role-chip ${a.role === 'Owner' ? 'owner' : 'admin'}`}>{a.role}</span>
                </div>
                <div className="em">{a.email}</div>
                <div className="meta-line">
                  {a.source === 'google' ? 'Signs in with Google' :
                   a.source === 'password' ? 'Signs in with password' :
                                              'Pending — invite emailed'}
                </div>
              </div>
              <div className="actions">
                {a.role !== 'Owner' && (
                  <button className="slot-action danger" onClick={() => remove(a.email)}>Remove</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {adding ? (
        <div className="add-row">
          <div className="ev-row">
            <label>Name</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Esther Klein" />
          </div>
          <div className="ev-row">
            <label>Email (becomes username)</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="eklein@tbe.org" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn primary" onClick={add} disabled={!newName.trim() || !newEmail.trim()}>Send invite</button>
          </div>
        </div>
      ) : (
        <button className="btn" onClick={() => setAdding(true)} style={{ alignSelf: 'flex-start' }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--c-gold)', color: 'var(--c-navy)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>+</span>
          Invite admin
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Coverage Requests (admin)
// ═══════════════════════════════════════════════════════════════

interface CoverageViewProps {
  services: Service[];
  onBack: () => void;
  onAssign: (svc: Service, slot: Slot) => void;
  onClearCoverage: (svcId: string | number, slotId: string) => void;
}

export function CoverageView({ services, onBack, onAssign, onClearCoverage }: CoverageViewProps) {
  const requests = useMemo(() => {
    const out: { svc: Service; slot: Slot }[] = [];
    services.forEach(svc => svc.slots.forEach(sl => {
      if (sl.coverageRequested) out.push({ svc, slot: sl });
    }));
    return out;
  }, [services]);

  return (
    <div>
      <div className="sub-head">
        <button className="back-btn" onClick={onBack}><Icon name="chevL" size={16} /></button>
        <div className="page-head" style={{ flex: 1, marginBottom: 0 }}>
          <div className="eyebrow">Admin</div>
          <h1>Coverage Requests</h1>
        </div>
      </div>
      <p style={{ color: 'var(--c-muted)', fontSize: 14, margin: '0 0 4px' }}>
        Volunteers who've asked for a substitute. Assign a replacement to close it.
      </p>
      {requests.length === 0 ? (
        <div className="empty">
          <div className="glyph">✦</div>
          No one needs coverage right now.
        </div>
      ) : (
        <div className="cov-list">
          {requests.map(({ svc, slot }, i) => (
            <div className="cov-card" key={i}>
              <div className="hd">
                <DateBadge iso={svc.dateISO} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="who-nm">{slot.volunteer}</div>
                  <div className="what">
                    needs a sub for <strong style={{ color: 'var(--c-ink)' }}>{slot.role}</strong> at <strong style={{ color: 'var(--c-ink)' }}>{svc.type}</strong>
                  </div>
                  <div className="what">
                    {svc.date.split(',')[0]} · {svc.time}{slot.timeSlot ? ` · ${slot.timeSlot}` : ''}
                  </div>
                  <div className="since">Distribution list notified</div>
                </div>
              </div>
              <div className="body">
                <button className="slot-action primary" onClick={() => onAssign(svc, slot)}>Assign substitute</button>
                <button className="slot-action" onClick={() => onClearCoverage(svc.id, slot.id)}>Mark resolved</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Settings (admin)
// ═══════════════════════════════════════════════════════════════

export function SettingsView({ onBack }: { onBack: () => void }) {
  const S = SYNAGOGUE;
  const [years, setYears] = useState([2026, 2027, 2028]);
  const [selectedYear, setSelectedYear] = useState(2026);

  return (
    <div>
      <div className="sub-head">
        <button className="back-btn" onClick={onBack}><Icon name="chevL" size={16} /></button>
        <div className="page-head" style={{ flex: 1, marginBottom: 0 }}>
          <div className="eyebrow">Admin</div>
          <h1>Settings</h1>
        </div>
      </div>

      <div className="set-section">
        <div className="sect-hd">Synagogue</div>
        <div className="set-row">
          <div className="l"><div className="k">Name</div><div className="v">{S.name}</div></div>
          <button className="slot-action">Edit</button>
        </div>
        <div className="set-row">
          <div className="l"><div className="k">Address</div><div className="v">{S.address}</div></div>
          <button className="slot-action">Edit</button>
        </div>
      </div>

      <div className="set-section">
        <div className="sect-hd">Default service times</div>
        <div className="set-row">
          <div className="l"><div className="k">Friday Kabbalat Shabbat</div><div className="v">{S.defaultFridayTime} · 1 Greeter</div></div>
          <button className="slot-action">Edit</button>
        </div>
        <div className="set-row">
          <div className="l"><div className="k">Saturday Shabbat Morning</div><div className="v">{S.defaultSaturdayTime} · 1 Greeter</div></div>
          <button className="slot-action">Edit</button>
        </div>
      </div>

      <div className="set-section">
        <div className="sect-hd">Reminders</div>
        <div className="set-row">
          <div className="l"><div className="k">Weekly reminder</div><div className="v">{S.reminderDay}s at {S.reminderHour}</div></div>
          <button className="slot-action">Edit</button>
        </div>
        <div className="set-row">
          <div className="l"><div className="k">Confirmation reminder</div><div className="v">48 hours before each service</div></div>
          <button className="slot-action">Edit</button>
        </div>
      </div>

      <div className="set-section">
        <div className="sect-hd">Integrations</div>
        <div className="set-row">
          <div className="l"><div className="k">Gmail</div><div className="v connected">Connected · {S.integrations.gmail.account}</div></div>
          <button className="slot-action">Manage</button>
        </div>
        <div className="set-row">
          <div className="l"><div className="k">Google Calendar</div><div className="v connected">Connected · {S.integrations.gcal.account}</div></div>
          <button className="slot-action">Manage</button>
        </div>
      </div>

      <div className="set-section">
        <div className="sect-hd">Calendar horizon</div>
        <div className="set-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <div className="l" style={{ width: '100%' }}>
            <div className="k">Years staged</div>
            <div className="v" style={{ marginTop: 8 }}>
              <div className="year-bar">
                {years.map(y => (
                  <button key={y} className="year-pill" aria-pressed={y === selectedYear} onClick={() => setSelectedYear(y)}>{y}</button>
                ))}
                <button className="year-pill add" onClick={() => setYears([...years, years[years.length - 1] + 1])}>
                  + Add {years[years.length - 1] + 1}
                </button>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-muted)' }}>
            We pre-stage holidays and weekly Shabbat dates for the years above.
          </div>
        </div>
      </div>
    </div>
  );
}
