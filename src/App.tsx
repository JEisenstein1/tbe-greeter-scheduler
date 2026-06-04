import { useState, useEffect } from 'react';
import type { Service, User, ViewId, AdminSubId, AssignTarget, SignupTarget, EventEditState, TweakValues } from './types';
import { INITIAL_SERVICES } from './data';
import { buildConfirmationEmail, shouldRestorePersistedUser } from './appLogic';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakToggle } from './TweaksPanel';
import { Topbar, BotNav, AssignModal, SignUpModal, ToastRail, AuthSheet, EventEditModal, ConfirmDialog } from './components';
import {
  AIView, CalendarView, SignUpView, MyDatesView,
  AdminHubView, VolunteersView, AdminsView, CoverageView, EmailView, SettingsView,
} from './views';

const TWEAK_DEFAULTS: TweakValues = {
  palette: 'navy-gold',
  headingFont: 'Playfair Display',
  density: 'regular',
  defaultCalendarView: 'list',
  hhAccents: true,
  landing: 'ai',
};

const PALETTES: Record<string, { label: string; vars: Record<string, string> }> = {
  'navy-gold': {
    label: 'Navy & Gold',
    vars: {
      '--c-navy':      '#16263f',
      '--c-navy-soft': '#2a3c5a',
      '--c-gold':      '#b8893a',
      '--c-gold-soft': '#d9b06a',
      '--c-cream':     '#f6f1e7',
      '--c-paper':     '#fbf8f1',
    },
  },
  'olive-stone': {
    label: 'Olive & Stone',
    vars: {
      '--c-navy':      '#3e4732',
      '--c-navy-soft': '#5a6248',
      '--c-gold':      '#9a7a3a',
      '--c-gold-soft': '#c4a062',
      '--c-cream':     '#f1ede4',
      '--c-paper':     '#f8f5ee',
    },
  },
  'burgundy-cream': {
    label: 'Burgundy & Cream',
    vars: {
      '--c-navy':      '#5a2330',
      '--c-navy-soft': '#73323f',
      '--c-gold':      '#a8732e',
      '--c-gold-soft': '#cc9e5b',
      '--c-cream':     '#f5ece4',
      '--c-paper':     '#fbf5ed',
    },
  },
  'indigo-saffron': {
    label: 'Indigo & Saffron',
    vars: {
      '--c-navy':      '#2a2a5a',
      '--c-navy-soft': '#3f3f72',
      '--c-gold':      '#c08a2e',
      '--c-gold-soft': '#e0b66a',
      '--c-cream':     '#f3eee2',
      '--c-paper':     '#faf6eb',
    },
  },
};

const HEADING_FONTS = ['Playfair Display', 'Cormorant Garamond', 'Fraunces', 'DM Serif Display'];

async function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    credentials: 'include',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body as T;
}

export default function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useState<ViewId>(t.landing || 'ai');
  const [adminSub, setAdminSub] = useState<AdminSubId | null>(null);
  const [services, setServices] = useState<Service[]>(() => INITIAL_SERVICES);

  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem('tbe.user');
      if (!shouldRestorePersistedUser(raw)) return null;
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  useEffect(() => {
    // Do not persist public-kiosk/user identity across reloads; real auth is cookie-backed.
    localStorage.removeItem('tbe.user');
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    apiJson<{ user: User | null }>('/api/auth/me')
      .then(({ user }) => { if (!cancelled && user) setUser(user); })
      .catch(() => { /* stay anonymous */ });
    apiJson<{ services: Service[] }>('/api/services')
      .then(({ services }) => { if (!cancelled && services?.length) setServices(services); })
      .catch(() => { /* fixture fallback remains loaded */ });
    return () => { cancelled = true; };
  }, []);
  const [authOpen, setAuthOpen] = useState(false);

  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [signupTarget, setSignupTarget] = useState<SignupTarget | null>(null);
  const [signupForm, setSignupForm] = useState({ name: '', email: '' });
  const [eventEdit, setEventEdit] = useState<EventEditState | null>(null);
  const [eventDelete, setEventDelete] = useState<Service | null>(null);
  const [toasts, setToasts] = useState<{ id: string; msg: string }[]>([]);

  useEffect(() => {
    const adminOnly: ViewId[] = ['admin'];
    if (adminOnly.includes(view) && user?.role !== 'admin') {
      setView('ai');
      setAdminSub(null);
    }
  }, [view, user?.role]);

  useEffect(() => {
    const root = document.documentElement;
    const p = PALETTES[t.palette] ?? PALETTES['navy-gold'];
    Object.entries(p.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.setProperty('--font-serif', `"${t.headingFont}", Georgia, serif`);
    root.dataset.density = t.density;
    root.dataset.hhAccents = t.hhAccents ? 'on' : 'off';
  }, [t.palette, t.headingFont, t.density, t.hhAccents]);

  const pushToast = (msg: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(ts => [...ts, { id, msg }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 3200);
  };

  const onAssign = (svc: Service, slot: import('./types').Slot) => setAssignTarget({ svc, slot });
  const onRemove = async (svcId: string | number, slotId: string) => {
    try { await apiJson('/api/services/remove', { method: 'POST', body: JSON.stringify({ serviceId: svcId, slotId }) }); } catch { /* allow fixture/demo mode */ }
    setServices(prev => prev.map(s => s.id !== svcId ? s : ({
      ...s,
      slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, volunteer: null, volunteerEmail: null })),
    })));
    pushToast('Volunteer removed');
  };
  const onConfirmAssign = async (svcId: string | number, slotId: string, vol: { name: string; email: string }) => {
    let delivery = 'invite prepared';
    try { const out = await apiJson<{ delivery?: { status?: string } }>('/api/services/signup', { method: 'POST', body: JSON.stringify({ serviceId: svcId, slotId, name: vol.name, email: vol.email }) }); delivery = out.delivery?.status === 'sent' ? 'invite sent' : delivery; } catch { /* allow fixture/demo mode */ }
    setServices(prev => prev.map(s => s.id !== svcId ? s : ({
      ...s,
      slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, volunteer: vol.name, volunteerEmail: vol.email })),
    })));
    setAssignTarget(null);
    pushToast(`${vol.name.split(' ')[0]} assigned · ${delivery}`);
  };

  const onSignUp = (svc: Service, slot: import('./types').Slot, vol: { name: string; email: string }) => {
    if (!vol?.name?.trim() || !vol?.email?.trim()) return;
    setSignupForm({ name: vol.name.trim(), email: vol.email.trim() });
    setSignupTarget({ svc, slot });
  };
  const onConfirmSignUp = async (svcId: string | number, slotId: string, vol: { name: string; email: string }) => {
    const svc = services.find(s => s.id === svcId);
    const slot = svc?.slots.find(sl => sl.id === slotId);
    const email = svc && slot ? buildConfirmationEmail(svc, slot, vol) : null;
    try { await apiJson('/api/services/signup', { method: 'POST', body: JSON.stringify({ serviceId: svcId, slotId, name: vol.name, email: vol.email }) }); } catch { /* allow fixture/demo mode */ }
    setServices(prev => prev.map(s => s.id !== svcId ? s : ({
      ...s,
      slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, volunteer: vol.name, volunteerEmail: vol.email })),
    })));
    setSignupTarget(null);
    pushToast(email ? `Confirmation prepared for ${email.to}` : 'Confirmation prepared');
  };

  const handleSignIn = (u: User) => {
    setUser(u);
    setAuthOpen(false);
    pushToast(
      u.source === 'google' ? `Signed in with Google as ${u.name.split(' ')[0]}`
      : u.source === 'manual' ? `Welcome, ${u.name.split(' ')[0]}`
      : `Welcome back, ${u.name.split(' ')[0]}`
    );
  };
  const handleSignOut = async () => {
    try { await apiJson('/api/auth/logout', { method: 'POST' }); } catch { /* already signed out locally */ }
    setUser(null);
    pushToast('Signed out');
  };

  const onCreateEvent = (prefilledDate: string | null) => setEventEdit({ initial: null, prefilledDate });
  const onEditEvent = (svc: Service) => setEventEdit({ initial: svc, prefilledDate: null });
  const onDeleteEvent = (svc: Service) => setEventDelete(svc);

  const handleSaveEvent = async (svc: Service) => {
    const isEdit = services.some(s => s.id === svc.id);
    try { await apiJson('/api/services/create', { method: 'POST', body: JSON.stringify({ service: svc }) }); } catch { /* allow fixture/demo mode */ }
    setServices(prev => {
      if (isEdit) return prev.map(s => s.id === svc.id ? svc : s);
      return [...prev, svc].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    });
    setEventEdit(null);
    pushToast(isEdit ? `${svc.type} updated` : `${svc.type} added`);
  };
  const handleConfirmDelete = async () => {
    const svc = eventDelete!;
    try { await apiJson('/api/services/delete', { method: 'POST', body: JSON.stringify({ serviceId: svc.id }) }); } catch { /* allow fixture/demo mode */ }
    setServices(prev => prev.filter(s => svc.id !== s.id));
    setEventDelete(null);
    pushToast(`${svc.type} removed`);
  };

  const onRequestCoverage = async (svcId: string | number, slotId: string) => {
    try { await apiJson('/api/services/request-coverage', { method: 'POST', body: JSON.stringify({ serviceId: svcId, slotId }) }); } catch { /* allow fixture/demo mode */ }
    setServices(prev => prev.map(s => s.id !== svcId ? s : ({
      ...s,
      slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, coverageRequested: true })),
    })));
    pushToast('Coverage requested — we\'ll find a substitute');
  };
  const onSelfRemove = async (svcId: string | number, slotId: string) => {
    try { await apiJson('/api/services/remove', { method: 'POST', body: JSON.stringify({ serviceId: svcId, slotId }) }); } catch { /* allow fixture/demo mode */ }
    setServices(prev => prev.map(s => s.id !== svcId ? s : ({
      ...s,
      slots: s.slots.map(sl => sl.id !== slotId ? sl : ({
        ...sl, volunteer: null, volunteerEmail: null, coverageRequested: false,
      })),
    })));
    pushToast('Commitment removed');
  };
  const onClearCoverage = (svcId: string | number, slotId: string) => {
    setServices(prev => prev.map(s => s.id !== svcId ? s : ({
      ...s,
      slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, coverageRequested: false })),
    })));
    pushToast('Coverage request marked resolved');
  };

  const onAIVolunteerSignup = async (svcId: string | number, slotId: string, vol: { name: string; email: string }) => {
    try { await apiJson('/api/services/signup', { method: 'POST', body: JSON.stringify({ serviceId: svcId, slotId, name: vol.name, email: vol.email }) }); } catch { /* allow fixture/demo mode */ }
    setServices(prev => prev.map(s => s.id !== svcId ? s : ({
      ...s,
      slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, volunteer: vol.name, volunteerEmail: vol.email })),
    })));
    pushToast(`Signed up — confirmation sent to ${vol.email}`);
  };
  const onAICreateService = async (svc: Service) => {
    try { await apiJson('/api/services/create', { method: 'POST', body: JSON.stringify({ service: svc }) }); } catch { /* allow fixture/demo mode */ }
    setServices(prev => [...prev, svc].sort((a, b) => a.dateISO.localeCompare(b.dateISO)));
    pushToast(`${svc.type} added to calendar`);
  };

  const navTo = (v: string) => { setView(v as ViewId); setAdminSub(null); };

  return (
    <div className="app">
      <Topbar view={view} user={user}
              onOpenAuth={() => setAuthOpen(true)}
              onSignOut={handleSignOut}
              onNav={(v) => setView(v as ViewId)} />
      <main className="main">
        {view === 'ai' && (
          <AIView user={user} services={services}
                  onAIVolunteerSignup={onAIVolunteerSignup}
                  onAIRequestCoverage={onRequestCoverage}
                  onAICreateService={onAICreateService} />
        )}
        {view === 'calendar' && (
          <CalendarView services={services} defaultView={t.defaultCalendarView}
                        user={user} onOpenAuth={() => setAuthOpen(true)}
                        onAssign={onAssign} onRemove={onRemove}
                        onSignUp={onSignUp} onRequestCoverage={onRequestCoverage} onSelfRemove={onSelfRemove}
                        onCreateEvent={onCreateEvent}
                        onEditEvent={onEditEvent}
                        onDeleteEvent={onDeleteEvent} />
        )}
        {view === 'admin' && (
          adminSub === null         ? <AdminHubView services={services} onNavSub={(sub) => setAdminSub(sub as AdminSubId)} /> :
          adminSub === 'volunteers' ? <VolunteersView onBack={() => setAdminSub(null)} /> :
          adminSub === 'admins'     ? <AdminsView onBack={() => setAdminSub(null)} /> :
          adminSub === 'coverage'   ? <CoverageView services={services}
                                                    onBack={() => setAdminSub(null)}
                                                    onAssign={onAssign}
                                                    onClearCoverage={onClearCoverage} /> :
          adminSub === 'email'      ? <EmailView onBack={() => setAdminSub(null)} /> :
          adminSub === 'settings'   ? <SettingsView onBack={() => setAdminSub(null)} /> :
          null
        )}
        {view === 'signup' && (
          <SignUpView services={services} user={user}
                      onOpenAuth={() => setAuthOpen(true)}
                      onSignUp={onSignUp}
                      onRequestCoverage={onRequestCoverage}
                      onSelfRemove={onSelfRemove} />
        )}
        {view === 'mydates' && (
          <MyDatesView services={services} user={user}
                       onOpenAuth={() => setAuthOpen(true)}
                       onRequestCoverage={onRequestCoverage}
                       onSelfRemove={onSelfRemove} />
        )}
      </main>

      <BotNav view={view} onNav={navTo} user={user} />

      {assignTarget && (
        <AssignModal svc={assignTarget.svc} slot={assignTarget.slot}
                     onClose={() => setAssignTarget(null)}
                     onConfirm={onConfirmAssign} />
      )}
      {signupTarget && (
        <SignUpModal svc={signupTarget.svc} slot={signupTarget.slot}
                     name={signupForm.name} email={signupForm.email}
                     onClose={() => setSignupTarget(null)}
                     onConfirm={onConfirmSignUp} />
      )}
      {eventEdit && (
        <EventEditModal initial={eventEdit.initial}
                        prefilledDate={eventEdit.prefilledDate}
                        onClose={() => setEventEdit(null)}
                        onSave={handleSaveEvent} />
      )}
      {eventDelete && (
        <ConfirmDialog
          danger
          title={`Delete ${eventDelete.type}?`}
          message={`This will remove ${eventDelete.type} on ${eventDelete.date} and unassign ${eventDelete.slots.filter(s => s.volunteer).length} volunteer(s).`}
          sub="This cannot be undone."
          confirmLabel="Delete event"
          onClose={() => setEventDelete(null)}
          onConfirm={handleConfirmDelete} />
      )}
      {authOpen && (
        <AuthSheet onClose={() => setAuthOpen(false)}
                   onSignIn={handleSignIn}
                   suggested={user ? { name: user.name, email: user.email } : null} />
      )}
      <ToastRail toasts={toasts} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakRadio label="Density"
                    value={t.density}
                    options={['compact', 'regular', 'cozy']}
                    onChange={v => setTweak('density', v as TweakValues['density'])} />
        <TweakSelect label="Palette"
                     value={t.palette}
                     options={Object.entries(PALETTES).map(([id, p]) => ({ value: id, label: p.label }))}
                     onChange={v => setTweak('palette', v)} />
        <TweakSelect label="Heading font"
                     value={t.headingFont}
                     options={HEADING_FONTS.map(f => ({ value: f, label: f }))}
                     onChange={v => setTweak('headingFont', v)} />
        <TweakToggle label="High Holiday accents"
                     value={t.hhAccents}
                     onChange={v => setTweak('hhAccents', v)} />

        <TweakSection label="Behavior" />
        <TweakRadio label="Calendar opens to"
                    value={t.defaultCalendarView}
                    options={['list', 'grid']}
                    onChange={v => setTweak('defaultCalendarView', v as TweakValues['defaultCalendarView'])} />
        <TweakSelect label="Land on"
                     value={t.landing}
                     options={[
                       { value: 'ai', label: 'AI Scheduler' },
                       { value: 'calendar', label: 'Calendar' },
                       { value: 'signup', label: 'Sign Up' },
                       { value: 'mydates', label: 'My Dates' },
                       { value: 'admin', label: 'Admin Hub' },
                     ]}
                     onChange={v => { setTweak('landing', v as ViewId); setView(v as ViewId); }} />
      </TweaksPanel>
    </div>
  );
}
