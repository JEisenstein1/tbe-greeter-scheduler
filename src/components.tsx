import { useState, useEffect, useRef, useMemo } from 'react';
import type { Service, Slot, User, Volunteer, Admin, Toast } from './types';
import { VOLUNTEERS, ADMINS } from './data';
import { lookupMockAuthUser } from './appLogic';
import { statusFor, groupSlotsByTime, wdShort, dayNum, moShort } from './helpers';

// ── Icons ────────────────────────────────────────────────────

type IconName =
  | 'calendar' | 'sparkles' | 'inbox' | 'handshake' | 'star'
  | 'list' | 'grid' | 'send' | 'chevL' | 'chevR' | 'chevD'
  | 'x' | 'info' | 'search' | 'check' | 'bell' | 'mail' | 'user' | 'pen' | 'home';

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    calendar: (<><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M8 3v3M16 3v3" /></>),
    sparkles: (<><path d="M12 3l1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3z" fill="currentColor" stroke="none" /><path d="M19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14z" fill="currentColor" stroke="none" /></>),
    inbox: (<><path d="M4 13l2-7h12l2 7M4 13v6h16v-6M4 13h5l1 2h4l1-2h5" /></>),
    handshake: (<><path d="M3 13l3-3 3 1 3-3 4 4-2 2-2-2-2 2-2-2-2 2-3-1z" /><path d="M14 14l3 3" /></>),
    star: (<><path d="M12 4l2 5 5 .5-4 3.5 1.5 5L12 15l-4.5 3 1.5-5-4-3.5L10 9l2-5z" /></>),
    list: (<><path d="M4 6h16M4 12h16M4 18h16" /></>),
    grid: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>),
    send: (<><path d="M4 12l16-8-6 16-2-7-8-1z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" /></>),
    chevL: <path d="M14 6l-6 6 6 6" />,
    chevR: <path d="M10 6l6 6-6 6" />,
    chevD: <path d="M6 9l6 6 6-6" />,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    info: (<><circle cx="12" cy="12" r="9" /><path d="M12 8v.01M11 12h1v5h1" /></>),
    search: (<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>),
    check: <path d="M5 13l4 4 10-10" />,
    bell: (<><path d="M6 16V11a6 6 0 1112 0v5l2 2H4l2-2z" /><path d="M10 20a2 2 0 004 0" /></>),
    mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 7 8.5-7" /></>),
    user: (<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1-4 4.5-6 7-6s6 2 7 6" /></>),
    pen: (<><path d="M4 20l4-1L20 7l-3-3L5 16l-1 4z" /><path d="M14 6l3 3" /></>),
    home: (<><path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-7H9v7H5a1 1 0 01-1-1v-9z" /></>),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

// ── Topbar ───────────────────────────────────────────────────

interface TopbarProps {
  view: string;
  user: User | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onNav: (v: string) => void;
}

export function Topbar({ view, user, onOpenAuth, onSignOut, onNav }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!t.closest('.acct-menu, .user-pill')) setMenuOpen(false);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [menuOpen]);

  return (
    <header className="topbar">
      <div className="logo">
        <div className="mark">ב</div>
        <div>
          <div className="name">Temple Beth El</div>
          <div className="sub">Greeter Schedule</div>
        </div>
      </div>

      {user ? (
        <>
          <button className="user-pill" onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}>
            <span className="avatar">{user.name.charAt(0)}</span>
            <span>{user.name.split(' ')[0]}</span>
            {user.role === 'admin' && (
              <span className="role-chip owner" style={{ fontSize: 9, padding: '1px 6px', letterSpacing: '0.06em' }}>Admin</span>
            )}
            <span className="chev"><Icon name="chevD" size={14} /></span>
          </button>
          {menuOpen && (
            <div className="acct-menu" onClick={(e) => e.stopPropagation()}>
              <div className="hd">
                <div className="nm">
                  {user.name}
                  {user.role === 'admin' && (
                    <span className="role-chip owner" style={{ marginLeft: 8, fontSize: 9, padding: '1px 6px', letterSpacing: '0.06em' }}>Admin</span>
                  )}
                </div>
                <div className="em">{user.email}</div>
                <div className="src">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-gold)', display: 'inline-block' }} />
                  Signed in {user.source === 'google' ? 'via Google' : user.source === 'password' ? 'with email' : 'as guest'}
                </div>
              </div>
              {user.role === 'admin' && (
                <button onClick={() => { setMenuOpen(false); onNav('admin'); }}>
                  <span className="ico"><Icon name="inbox" size={16} /></span>
                  Admin hub
                </button>
              )}
              <button onClick={() => { setMenuOpen(false); onNav('mydates'); }}>
                <span className="ico"><Icon name="calendar" size={16} /></span>
                View my dates
              </button>
              <button onClick={() => { setMenuOpen(false); onNav('signup'); }}>
                <span className="ico"><Icon name="handshake" size={16} /></span>
                Sign up for a service
              </button>
              <button className="danger" onClick={() => { setMenuOpen(false); onSignOut(); }}>
                <span className="ico"><Icon name="x" size={16} /></span>
                Sign out
              </button>
            </div>
          )}
        </>
      ) : (
        <button className="signin-pill" onClick={onOpenAuth}>Sign in</button>
      )}
    </header>
  );
}

// ── Bottom nav ───────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'ai',       label: 'AI',       icon: 'sparkles' as IconName, role: 'all'   },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' as IconName, role: 'all'   },
  { id: 'admin',    label: 'Admin',    icon: 'inbox' as IconName,    role: 'admin' },
  { id: 'signup',   label: 'Sign Up',  icon: 'handshake' as IconName,role: 'all'   },
  { id: 'mydates',  label: 'My Dates', icon: 'user' as IconName,     role: 'all'   },
];

export function BotNav({ view, onNav, user }: { view: string; onNav: (v: string) => void; user: User | null }) {
  const isAdmin = user?.role === 'admin';
  const items = NAV_ITEMS.filter(i => i.role === 'all' || (i.role === 'admin' && isAdmin));
  return (
    <nav className="botnav" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map(item => (
        <button key={item.id}
                aria-current={view === item.id ? 'page' : undefined}
                onClick={() => onNav(item.id)}>
          <div className="ico"><Icon name={item.icon} size={20} /></div>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

// ── Date badge ───────────────────────────────────────────────

export function DateBadge({ iso }: { iso: string }) {
  return (
    <div className="datebadge">
      <div className="wd">{wdShort(iso)}</div>
      <div className="dy">{dayNum(iso)}</div>
      <div className="mo">{moShort(iso)}</div>
    </div>
  );
}

// ── Status badge ─────────────────────────────────────────────

export function StatusBadge({ svc }: { svc: Service }) {
  const s = statusFor(svc);
  return <span className={`status ${s.kind}`}>{s.label}</span>;
}

// ── Service Card ─────────────────────────────────────────────

interface ServiceCardProps {
  svc: Service;
  mode?: 'admin' | 'volunteer';
  currentUserName?: string;
  onAssign?: (svc: Service, slot: Slot) => void;
  onRemove?: (svcId: string | number, slotId: string) => void;
  onSignUp?: (svc: Service, slot: Slot) => void;
  onEdit?: (svc: Service) => void;
  onDelete?: (svc: Service) => void;
  onRequestCoverage?: (svcId: string | number, slotId: string) => void;
  onSelfRemove?: (svcId: string | number, slotId: string) => void;
  name?: string;
  email?: string;
}

export function ServiceCard({ svc, mode = 'admin', currentUserName, onAssign, onRemove, onSignUp, onEdit, onDelete, onRequestCoverage, onSelfRemove, name, email }: ServiceCardProps) {
  const groups = groupSlotsByTime(svc.slots);

  return (
    <div className="card">
      <div className="card-hd">
        <DateBadge iso={svc.dateISO} />
        <div className="card-info">
          <div className="type">{svc.type}</div>
          <div className="meta">
            <span style={{ whiteSpace: 'nowrap' }}>{svc.date.split(',')[0]}</span>
            <span className="sep">·</span>
            <span style={{ whiteSpace: 'nowrap' }}>{svc.time}</span>
            {svc.isHH && <span className="tag-hh">HH</span>}
          </div>
        </div>
        <StatusBadge svc={svc} />
      </div>

      {groups.map((g, gi) => (
        <div key={gi}>
          {g.timeSlot && (
            <div className="timeslot-group">
              <div className="timeslot-label">{g.timeSlot}</div>
            </div>
          )}
          <div className="slots" style={g.timeSlot ? { paddingTop: 0 } : undefined}>
            {g.slots.map(s => {
              const filled = !!s.volunteer;
              const isMine = mode === 'volunteer' && filled && currentUserName
                && s.volunteer!.toLowerCase() === currentUserName.toLowerCase();
              return (
                <div className="slot" key={s.id}>
                  <span className={`dot ${filled ? 'filled' : 'open'}`} />
                  <span className="role">{s.role}</span>
                  <span className={`vol ${filled ? 'has-name' : 'open-label'}`}>
                    {filled ? (isMine ? 'You' : s.volunteer) : 'Open'}
                    {s.coverageRequested && <span className="cov-tag">Coverage</span>}
                  </span>
                  {mode === 'admin' && filled && (
                    <button className="slot-action danger" onClick={() => onRemove?.(svc.id, s.id)}>Remove</button>
                  )}
                  {mode === 'admin' && !filled && (
                    <button className="slot-action primary" onClick={() => onAssign?.(svc, s)}>Assign</button>
                  )}
                  {mode === 'volunteer' && !filled && (
                    <button className="slot-action primary"
                            onClick={() => onSignUp?.(svc, s)}
                            disabled={!name?.trim() || !email?.trim()}>
                      Add
                    </button>
                  )}
                  {mode === 'volunteer' && isMine && (
                    <div className="slot-mine-actions">
                      {!s.coverageRequested && (
                        <button className="slot-action" onClick={() => onRequestCoverage?.(svc.id, s.id)}>
                          Need sub
                        </button>
                      )}
                      <button className="slot-action danger" onClick={() => onSelfRemove?.(svc.id, s.id)}>Remove</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {mode === 'admin' && (onEdit || onDelete) && (
        <div className="card-admin-row">
          <span className="lbl">Event</span>
          {onEdit   && <button className="slot-action"        onClick={() => onEdit(svc)}>Edit</button>}
          {onDelete && <button className="slot-action danger" onClick={() => onDelete(svc)}>Delete</button>}
        </div>
      )}
    </div>
  );
}

// ── Assign Modal ─────────────────────────────────────────────

interface AssignModalProps {
  svc: Service;
  slot: Slot;
  onClose: () => void;
  onConfirm: (svcId: string | number, slotId: string, vol: Volunteer) => void;
}

export function AssignModal({ svc, slot, onClose, onConfirm }: AssignModalProps) {
  const [volIdx, setVolIdx] = useState(-1);
  const [sending, setSending] = useState(false);
  const vol = volIdx >= 0 ? VOLUNTEERS[volIdx] : null;

  const handleConfirm = async () => {
    if (!vol) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 1100));
    onConfirm(svc.id, slot.id, vol);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-grip" />
        <div className="modal-hd">
          <div className="eyebrow">Assign Volunteer</div>
          <h3>{svc.type}</h3>
          <div className="sub">{svc.date} · {svc.time}{slot.timeSlot ? ` · ${slot.timeSlot}` : ''}</div>
        </div>
        <div className="modal-body">
          <div className="modal-context-row">
            <div>
              <div className="l">Role</div>
              <div className="v">{slot.role}</div>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Select volunteer
            </label>
            <select className="select-vol" value={volIdx} onChange={e => setVolIdx(+e.target.value)}>
              <option value={-1}>Choose a volunteer…</option>
              {VOLUNTEERS.map((v, i) => (
                <option key={i} value={i}>{v.name}</option>
              ))}
            </select>
          </div>
          {vol && (
            <div className="email-preview">
              <div className="row">
                <div className="lbl">To</div>
                <div className="val">{vol.name} &lt;{vol.email}&gt;</div>
              </div>
              <div className="row">
                <div className="lbl">Subj</div>
                <div className="val">You're scheduled — {svc.type}, {svc.date.split(',')[1].trim()}</div>
              </div>
              <div className="body">
                {`Shalom ${vol.name.split(' ')[0]},\n\nYou've been scheduled as `}<strong>{slot.role}</strong>{` for `}<strong>{svc.type}</strong>{` on `}<strong>{svc.date}</strong>{` at `}<strong>{svc.time}</strong>{`${slot.timeSlot ? ` (${slot.timeSlot})` : ''}.\n\nA Google Calendar invite is on its way. Thank you for helping us welcome the community.\n\n— Temple Beth El`}
              </div>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!vol || sending} onClick={handleConfirm}>
            {sending ? 'Sending…' : 'Assign & Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sign-up Confirmation Modal ───────────────────────────────

interface SignUpModalProps {
  svc: Service;
  slot: Slot;
  name: string;
  email: string;
  onClose: () => void;
  onConfirm: (svcId: string | number, slotId: string, vol: { name: string; email: string }) => void;
}

export function SignUpModal({ svc, slot, name, email, onClose, onConfirm }: SignUpModalProps) {
  const [sending, setSending] = useState(false);
  const handleConfirm = async () => {
    setSending(true);
    await new Promise(r => setTimeout(r, 900));
    onConfirm(svc.id, slot.id, { name, email });
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-grip" />
        <div className="modal-hd">
          <div className="eyebrow">Confirm sign-up</div>
          <h3>{svc.type}</h3>
          <div className="sub">{svc.date} · {svc.time}{slot.timeSlot ? ` · ${slot.timeSlot}` : ''}</div>
        </div>
        <div className="modal-body">
          <div className="modal-context-row">
            <div style={{ flex: 1 }}>
              <div className="l">You'll serve as</div>
              <div className="v">{slot.role}</div>
            </div>
          </div>
          <div className="email-preview">
            <div className="row">
              <div className="lbl">To</div>
              <div className="val">{name} &lt;{email}&gt;</div>
            </div>
            <div className="row">
              <div className="lbl">Subj</div>
              <div className="val">Thank you for signing up — {svc.type}</div>
            </div>
            <div className="body">
              {`Shalom ${name.split(' ')[0] || 'friend'},\n\nThank you for signing up to serve as `}<strong>{slot.role}</strong>{` at `}<strong>{svc.type}</strong>{`.\n\n`}<strong>{svc.date}</strong>{` · `}<strong>{svc.time}</strong>{`${slot.timeSlot ? '\n' + slot.timeSlot : ''}\n\nA Google Calendar invite is on its way. If anything changes, please reply to this message.\n\n— Temple Beth El`}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="btn primary" disabled={sending} onClick={handleConfirm}>
            {sending ? 'Sending…' : 'Confirm & Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toasts ───────────────────────────────────────────────────

export function ToastRail({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-rail">
      {toasts.map(t => (
        <div className="toast" key={t.id}>
          <div className="check">✓</div>
          <div>{t.msg}</div>
        </div>
      ))}
    </div>
  );
}

// ── Auth Sheet ───────────────────────────────────────────────

const GoogleLogo = () => (
  <svg className="g" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h5.9c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.24-4.74 3.24-8.32z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09a6.59 6.59 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
  </svg>
);

interface AuthSheetProps {
  onClose: () => void;
  onSignIn: (u: User) => void;
  suggested?: { name: string; email: string } | null;
}

export function AuthSheet({ onClose, onSignIn, suggested }: AuthSheetProps) {
  const [tab, setTab] = useState<'password' | 'guest'>(suggested?.name ? 'guest' : 'password');
  const [email, setEmail] = useState(suggested?.email || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(suggested?.name || '');
  const [guestEmail, setGuestEmail] = useState(suggested?.email || '');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const tryPassword = async () => {
    setErr('');
    if (!email.trim() || !password) { setErr('Email and password required.'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setLoading(false);
    const match = lookupMockAuthUser(email, 'password');
    if (match) {
      const { verifiedByProvider: _verifiedByProvider, ...user } = match;
      onSignIn(user);
      return;
    }
    setErr('No account found for that email. Continue as guest to sign up anyway.');
  };

  const tryGoogle = () => {
    setErr('');
    setLoading(true);
    window.location.href = '/api/auth/google/start';
  };

  const tryGuest = () => {
    setErr('');
    if (!name.trim() || !guestEmail.trim()) { setErr('Name and email required.'); return; }
    onSignIn({ name: name.trim(), email: guestEmail.trim(), source: 'manual', role: 'volunteer' });
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-grip" />
        <div className="modal-hd">
          <div className="eyebrow">Welcome</div>
          <h3>Sign in to Temple Beth El</h3>
          <div className="sub">So we can remember who you are when you sign up or check your dates.</div>
        </div>
        <div className="modal-body">
          <div className="auth-tabs">
            <button aria-pressed={tab === 'password'} onClick={() => setTab('password')}>Sign in</button>
            <button aria-pressed={tab === 'guest'}    onClick={() => setTab('guest')}>Continue as guest</button>
          </div>

          {tab === 'password' ? (
            <>
              <div className="auth-field">
                <label>Email</label>
                <input type="email" autoComplete="email" value={email}
                       onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              <button className="auth-google" onClick={tryGoogle} disabled={loading}>
                <GoogleLogo />
                {loading ? 'Connecting…' : 'Continue with Google'}
              </button>
              <div className="hint">Uses Google sign-in. Admin access is granted by the Temple Beth El allowlist.</div>
              <div className="auth-divider">or sign in with password</div>
              <div className="auth-field">
                <label>Password</label>
                <input type="password" autoComplete="current-password" value={password}
                       onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                       onKeyDown={e => e.key === 'Enter' && tryPassword()} />
                <div className="hint">Any password works for registered members.</div>
              </div>
              {err && <div className="auth-err">{err}</div>}
            </>
          ) : (
            <>
              <div className="auth-field">
                <label>Your name</label>
                <input type="text" autoComplete="name" value={name}
                       onChange={e => setName(e.target.value)} placeholder="e.g. Miriam Katz" />
              </div>
              <div className="auth-field">
                <label>Email</label>
                <input type="email" autoComplete="email" value={guestEmail}
                       onChange={e => setGuestEmail(e.target.value)} placeholder="you@email.com"
                       onKeyDown={e => e.key === 'Enter' && tryGuest()} />
                <div className="hint">No account needed — we'll just use this to confirm your sign-up.</div>
              </div>
              {err && <div className="auth-err">{err}</div>}
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose} disabled={loading}>Cancel</button>
          {tab === 'password' ? (
            <button className="btn primary" onClick={tryPassword} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          ) : (
            <button className="btn primary" onClick={tryGuest} disabled={loading}>Continue</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Event edit / create modal ────────────────────────────────

const EVENT_TYPES = [
  { id: 'kab',    label: 'Kabbalat Shabbat', desc: '1 Greeter · Friday',           defTime: '6:30 PM' },
  { id: 'shabAM', label: 'Shabbat Morning',  desc: '1 Greeter · Saturday',          defTime: '9:30 AM' },
  { id: 'hh',     label: 'High Holiday',     desc: '30-min windows · 4 roles each', defTime: '9:00 AM – 12:00 PM' },
  { id: 'custom', label: 'Custom Event',     desc: 'Set your own slots',            defTime: '7:00 PM' },
];

function parseTime12(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = +m[1], min = +m[2];
  const pm = m[3].toUpperCase() === 'PM';
  if (h === 12) h = 0;
  if (pm) h += 12;
  return h * 60 + min;
}
function fmtTime12(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24;
  const min = mins % 60;
  const pm = h24 >= 12;
  let h = h24 % 12; if (h === 0) h = 12;
  return `${h}:${String(min).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`;
}
function buildHHWindows(start: string, end: string): string[] {
  const s = parseTime12(start), e = parseTime12(end);
  if (s == null || e == null || e <= s) return [];
  const out: string[] = [];
  for (let t = s; t < e; t += 30) {
    out.push(`${fmtTime12(t)} – ${fmtTime12(Math.min(t + 30, e))}`);
  }
  return out;
}

interface EventEditModalProps {
  initial: Service | null;
  prefilledDate: string | null;
  onClose: () => void;
  onSave: (svc: Service) => void;
}

export function EventEditModal({ initial, prefilledDate, onClose, onSave }: EventEditModalProps) {
  const isEdit = !!initial;
  const initType = useMemo(() => {
    if (!initial) return 'kab';
    if (initial.isHH) return 'hh';
    if (initial.type === 'Kabbalat Shabbat') return 'kab';
    if (initial.type === 'Shabbat Morning') return 'shabAM';
    return 'custom';
  }, [initial]);

  const [type, setType] = useState(initType);
  const [date, setDate] = useState(initial?.dateISO || prefilledDate || '');
  const [timeStr, setTimeStr] = useState(initial?.time || EVENT_TYPES.find(t => t.id === initType)?.defTime || '');
  const [customName, setCustomName] = useState(
    initial && !initial.isHH && initial.type !== 'Kabbalat Shabbat' && initial.type !== 'Shabbat Morning'
      ? initial.type : ''
  );
  const [greeterN, setGreeterN] = useState(
    initial && initType === 'custom'
      ? initial.slots.filter(s => s.role.startsWith('Greeter')).length || 2
      : 2
  );
  const [usherN, setUsherN] = useState(
    initial && initType === 'custom'
      ? initial.slots.filter(s => s.role.startsWith('Usher')).length || 0
      : 0
  );

  useEffect(() => {
    if (isEdit) return;
    const t = EVENT_TYPES.find(t => t.id === type);
    if (t) setTimeStr(t.defTime);
  }, [type, isEdit]);

  const preview = useMemo(() => {
    if (type === 'kab')    return { count: 1, desc: '1 × Greeter' };
    if (type === 'shabAM') return { count: 1, desc: '1 × Greeter' };
    if (type === 'hh') {
      const [s, e] = timeStr.split('–').map(x => x.trim());
      const wins = buildHHWindows(s || '', e || '');
      return { count: wins.length * 4, desc: `${wins.length} × 30 min · Greeter ×2, Usher ×2 each = ${wins.length * 4} slots` };
    }
    return { count: greeterN + usherN, desc: `${greeterN} × Greeter${usherN > 0 ? ` · ${usherN} × Usher` : ''}` };
  }, [type, timeStr, greeterN, usherN]);

  const save = () => {
    if (!date) return;
    const typeName =
      type === 'kab'    ? 'Kabbalat Shabbat' :
      type === 'shabAM' ? 'Shabbat Morning' :
      type === 'hh'     ? (customName.trim() || 'High Holiday Service') :
                          (customName.trim() || 'Custom Event');

    const mkSlot = (role: string, timeSlot: string | null): Slot => {
      const carry = initial?.slots.find(o => o.role === role && (o.timeSlot ?? '') === (timeSlot ?? '') && o.volunteer);
      return {
        id: 's' + Math.random().toString(36).slice(2, 9),
        role, timeSlot,
        volunteer: carry?.volunteer ?? null,
        volunteerEmail: carry?.volunteerEmail ?? null,
      };
    };

    let newSlots: Slot[] = [];
    if (type === 'kab' || type === 'shabAM') {
      newSlots = [mkSlot('Greeter', null)];
    } else if (type === 'hh') {
      const [s, e] = timeStr.split('–').map(x => x.trim());
      const wins = buildHHWindows(s || '', e || '');
      wins.forEach(w => ['Greeter 1', 'Greeter 2', 'Usher 1', 'Usher 2'].forEach(role => {
        newSlots.push(mkSlot(role, w));
      }));
    } else {
      for (let i = 0; i < greeterN; i++) newSlots.push(mkSlot(greeterN === 1 ? 'Greeter' : `Greeter ${i + 1}`, null));
      for (let i = 0; i < usherN; i++)   newSlots.push(mkSlot(usherN === 1 ? 'Usher' : `Usher ${i + 1}`, null));
    }

    const svc: Service = {
      id: initial?.id || Date.now(),
      dateISO: date,
      date: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      time: timeStr,
      type: typeName,
      isHH: type === 'hh',
      slots: newSlots,
    };
    onSave(svc);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-grip" />
        <div className="modal-hd">
          <div className="eyebrow">{isEdit ? 'Edit event' : 'New event'}</div>
          <h3>{isEdit ? initial!.type : 'Add a service to the calendar'}</h3>
          {!isEdit && <div className="sub">Choose a type — slot rules apply automatically.</div>}
        </div>
        <div className="modal-body">
          {!isEdit && (
            <div className="ev-type-grid">
              {EVENT_TYPES.map(t => (
                <button key={t.id} className="ev-type" aria-pressed={type === t.id} onClick={() => setType(t.id)}>
                  <div className="nm">{t.label}</div>
                  <div className="desc">{t.desc}</div>
                </button>
              ))}
            </div>
          )}
          <div className="ev-pair">
            <div className="ev-row">
              <label>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="ev-row">
              <label>Time</label>
              <input type="text" value={timeStr} onChange={e => setTimeStr(e.target.value)}
                     placeholder={type === 'hh' ? '9:00 AM – 12:00 PM' : '6:30 PM'} />
            </div>
          </div>
          {(type === 'custom' || (isEdit && type !== 'kab' && type !== 'shabAM' && type !== 'hh')) && (
            <div className="ev-row">
              <label>Event name</label>
              <input type="text" value={customName} onChange={e => setCustomName(e.target.value)}
                     placeholder="e.g. Purim Party" />
            </div>
          )}
          {type === 'custom' && (
            <div className="ev-pair">
              <div className="ev-row">
                <label>Greeters</label>
                <input type="number" min="0" max="10" value={greeterN}
                       onChange={e => setGreeterN(Math.max(0, Math.min(10, +e.target.value || 0)))} />
              </div>
              <div className="ev-row">
                <label>Ushers</label>
                <input type="number" min="0" max="10" value={usherN}
                       onChange={e => setUsherN(Math.max(0, Math.min(10, +e.target.value || 0)))} />
              </div>
            </div>
          )}
          <div className="slot-summary">
            <strong>{preview.count} slot{preview.count === 1 ? '' : 's'}</strong> · {preview.desc}
            {isEdit && initial!.slots.some(s => s.volunteer) && (
              <div style={{ marginTop: 4, fontSize: 11.5 }}>Existing volunteers will be preserved where roles match.</div>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!date}>
            {isEdit ? 'Save changes' : 'Add to calendar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm dialog ───────────────────────────────────────────

interface ConfirmDialogProps {
  title: string;
  message: string;
  sub?: string;
  confirmLabel?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ title, message, sub, confirmLabel = 'Confirm', danger = false, onClose, onConfirm }: ConfirmDialogProps) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="modal-grip" />
        <div className="modal-hd">
          <div className="eyebrow">{danger ? 'Confirm delete' : 'Confirm'}</div>
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          <div className="confirm-body">
            <div className="glyph">{danger ? '·' : '✦'}</div>
            <div className="msg">{message}</div>
            {sub && <div className="sub">{sub}</div>}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
