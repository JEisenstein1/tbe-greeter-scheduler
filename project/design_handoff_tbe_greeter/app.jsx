// Main app — TBE Greeter Scheduler

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "navy-gold",
  "headingFont": "Playfair Display",
  "density": "regular",
  "defaultCalendarView": "list",
  "hhAccents": true,
  "landing": "ai"
}/*EDITMODE-END*/;

const PALETTES = {
  "navy-gold": {
    label: "Navy & Gold",
    vars: {
      "--c-navy":      "#16263f",
      "--c-navy-soft": "#2a3c5a",
      "--c-gold":      "#b8893a",
      "--c-gold-soft": "#d9b06a",
      "--c-cream":     "#f6f1e7",
      "--c-paper":     "#fbf8f1",
    },
  },
  "olive-stone": {
    label: "Olive & Stone",
    vars: {
      "--c-navy":      "#3e4732",
      "--c-navy-soft": "#5a6248",
      "--c-gold":      "#9a7a3a",
      "--c-gold-soft": "#c4a062",
      "--c-cream":     "#f1ede4",
      "--c-paper":     "#f8f5ee",
    },
  },
  "burgundy-cream": {
    label: "Burgundy & Cream",
    vars: {
      "--c-navy":      "#5a2330",
      "--c-navy-soft": "#73323f",
      "--c-gold":      "#a8732e",
      "--c-gold-soft": "#cc9e5b",
      "--c-cream":     "#f5ece4",
      "--c-paper":     "#fbf5ed",
    },
  },
  "indigo-saffron": {
    label: "Indigo & Saffron",
    vars: {
      "--c-navy":      "#2a2a5a",
      "--c-navy-soft": "#3f3f72",
      "--c-gold":      "#c08a2e",
      "--c-gold-soft": "#e0b66a",
      "--c-cream":     "#f3eee2",
      "--c-paper":     "#faf6eb",
    },
  },
};

const HEADING_FONTS = ["Playfair Display", "Cormorant Garamond", "Fraunces", "DM Serif Display"];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useState(t.landing || "ai");
  const [adminSub, setAdminSub] = useState(null); // null = hub, or 'volunteers'|'admins'|'coverage'|'email'|'settings'
  const [services, setServices] = useState(() => window.TBE_DATA.SERVICES);

  // Auth — persisted in localStorage
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("tbe.user");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  useEffect(() => {
    if (user) localStorage.setItem("tbe.user", JSON.stringify(user));
    else localStorage.removeItem("tbe.user");
  }, [user]);
  const [authOpen, setAuthOpen] = useState(false);

  // Modals
  const [assignTarget, setAssignTarget] = useState(null);
  const [signupTarget, setSignupTarget] = useState(null);
  const [signupForm, setSignupForm] = useState({ name: "", email: "" });
  const [toasts, setToasts] = useState([]);
  // Event create/edit + delete
  const [eventEdit, setEventEdit] = useState(null); // { initial, prefilledDate } | null
  const [eventDelete, setEventDelete] = useState(null); // svc | null

  // Apply landing view on first render
  useEffect(() => {
    setView(v => v || t.landing || "ai");
  }, []);

  // Guard: if the current view is admin-only and user is not admin, route to AI
  useEffect(() => {
    const adminOnly = ["calendar", "admin"];
    if (adminOnly.includes(view) && user?.role !== "admin") {
      setView("ai");
      setAdminSub(null);
    }
  }, [view, user?.role]);

  // apply palette + density + heading font + hh accents
  useEffect(() => {
    const root = document.documentElement;
    const p = PALETTES[t.palette] || PALETTES["navy-gold"];
    Object.entries(p.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.setProperty("--font-serif", `"${t.headingFont}", Georgia, serif`);
    root.dataset.density = t.density;
    root.dataset.hhAccents = t.hhAccents ? "on" : "off";
  }, [t.palette, t.headingFont, t.density, t.hhAccents]);

  const pushToast = (msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(ts => [...ts, { id, msg }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 3200);
  };

  const onAssign = (svc, slot) => setAssignTarget({ svc, slot });
  const onRemove = (svcId, slotId) => {
    setServices(prev => prev.map(s => s.id !== svcId ? s : ({
      ...s,
      slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, volunteer: null, volunteerEmail: null }))
    })));
    pushToast("Volunteer removed");
  };
  const onConfirmAssign = (svcId, slotId, vol) => {
    setServices(prev => prev.map(s => s.id !== svcId ? s : ({
      ...s,
      slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, volunteer: vol.name, volunteerEmail: vol.email }))
    })));
    setAssignTarget(null);
    pushToast(`${vol.name.split(" ")[0]} assigned · invite sent`);
  };

  const onSignUp = (svc, slot, vol) => {
    if (!vol?.name?.trim() || !vol?.email?.trim()) return;
    setSignupForm({ name: vol.name.trim(), email: vol.email.trim() });
    setSignupTarget({ svc, slot });
  };
  const onConfirmSignUp = (svcId, slotId, vol) => {
    setServices(prev => prev.map(s => s.id !== svcId ? s : ({
      ...s,
      slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, volunteer: vol.name, volunteerEmail: vol.email }))
    })));
    setSignupTarget(null);
    pushToast("Confirmation sent — see you there!");
  };

  const handleSignIn = (u) => {
    setUser(u);
    setAuthOpen(false);
    pushToast(u.source === "google" ? `Signed in with Google as ${u.name.split(" ")[0]}`
            : u.source === "manual" ? `Welcome, ${u.name.split(" ")[0]}`
            : `Welcome back, ${u.name.split(" ")[0]}`);
  };
  const handleSignOut = () => {
    const name = user?.name?.split(" ")[0];
    setUser(null);
    if (name) pushToast(`Signed out`);
  };

  // Event create / edit / delete
  const onCreateEvent = (prefilledDate) => setEventEdit({ initial: null, prefilledDate });
  const onEditEvent   = (svc) => setEventEdit({ initial: svc, prefilledDate: null });
  const onDeleteEvent = (svc) => setEventDelete(svc);

  const handleSaveEvent = (svc) => {
    const isEdit = services.some(s => s.id === svc.id);
    setServices(prev => {
      if (isEdit) return prev.map(s => s.id === svc.id ? svc : s);
      return [...prev, svc].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    });
    setEventEdit(null);
    pushToast(isEdit ? `${svc.type} updated` : `${svc.type} added`);
  };
  const handleConfirmDelete = () => {
    const svc = eventDelete;
    setServices(prev => prev.filter(s => s.id !== svc.id));
    setEventDelete(null);
    pushToast(`${svc.type} removed`);
  };

  // Volunteer actions on own slots
  const onRequestCoverage = (svcId, slotId) => {
    setServices(prev => prev.map(s => s.id !== svcId ? s : ({
      ...s,
      slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, coverageRequested: true })),
    })));
    pushToast("Coverage requested — we'll find a substitute");
  };
  const onSelfRemove = (svcId, slotId) => {
    setServices(prev => prev.map(s => s.id !== svcId ? s : ({
      ...s,
      slots: s.slots.map(sl => sl.id !== slotId ? sl : ({
        ...sl, volunteer: null, volunteerEmail: null, coverageRequested: false,
      })),
    })));
    pushToast("Commitment removed");
  };

  // Coverage resolved by admin (without reassigning)
  const onClearCoverage = (svcId, slotId) => {
    setServices(prev => prev.map(s => s.id !== svcId ? s : ({
      ...s,
      slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, coverageRequested: false })),
    })));
    pushToast("Coverage request marked resolved");
  };

  // AI volunteer flows
  const onAIVolunteerSignup = (svcId, slotId, vol) => {
    setServices(prev => prev.map(s => s.id !== svcId ? s : ({
      ...s,
      slots: s.slots.map(sl => sl.id !== slotId ? sl : ({ ...sl, volunteer: vol.name, volunteerEmail: vol.email }))
    })));
    pushToast(`Signed up — confirmation sent to ${vol.email}`);
  };

  return (
    <div className="app">
      <Topbar view={view} user={user}
              onOpenAuth={() => setAuthOpen(true)}
              onSignOut={handleSignOut}
              onNav={setView} />
      <main className="main">
        {view === "ai"       && <AIView user={user} services={services}
                                        onAIVolunteerSignup={onAIVolunteerSignup}
                                        onAIRequestCoverage={onRequestCoverage} />}
        {view === "calendar" && <CalendarView services={services} defaultView={t.defaultCalendarView}
                                              onAssign={onAssign} onRemove={onRemove}
                                              onCreateEvent={onCreateEvent}
                                              onEditEvent={onEditEvent}
                                              onDeleteEvent={onDeleteEvent} />}
        {view === "admin" && (
          adminSub === null         ? <AdminHubView services={services} onNavSub={setAdminSub} /> :
          adminSub === "volunteers" ? <VolunteersView onBack={() => setAdminSub(null)} /> :
          adminSub === "admins"     ? <AdminsView    onBack={() => setAdminSub(null)} /> :
          adminSub === "coverage"   ? <CoverageView  services={services}
                                                     onBack={() => setAdminSub(null)}
                                                     onAssign={onAssign}
                                                     onClearCoverage={onClearCoverage} /> :
          adminSub === "email"      ? <EmailView     onBack={() => setAdminSub(null)} /> :
          adminSub === "settings"   ? <SettingsView  onBack={() => setAdminSub(null)} /> :
          null
        )}
        {view === "signup"   && <SignUpView services={services}
                                            user={user}
                                            onOpenAuth={() => setAuthOpen(true)}
                                            onSignUp={onSignUp}
                                            onRequestCoverage={onRequestCoverage}
                                            onSelfRemove={onSelfRemove} />}
        {view === "mydates"  && <MyDatesView services={services}
                                             user={user}
                                             onOpenAuth={() => setAuthOpen(true)}
                                             onRequestCoverage={onRequestCoverage}
                                             onSelfRemove={onSelfRemove} />}
      </main>

      <BotNav view={view} onNav={(v) => { setView(v); setAdminSub(null); }} user={user} />

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

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakRadio label="Density"
                    value={t.density}
                    options={["compact", "regular", "cozy"]}
                    onChange={v => setTweak("density", v)} />
        <TweakSelect label="Palette"
                     value={t.palette}
                     options={Object.entries(PALETTES).map(([id, p]) => ({ value: id, label: p.label }))}
                     onChange={v => setTweak("palette", v)} />
        <TweakSelect label="Heading font"
                     value={t.headingFont}
                     options={HEADING_FONTS.map(f => ({ value: f, label: f }))}
                     onChange={v => setTweak("headingFont", v)} />
        <TweakToggle label="High Holiday accents"
                     value={t.hhAccents}
                     onChange={v => setTweak("hhAccents", v)} />

        <TweakSection label="Behavior" />
        <TweakRadio label="Calendar opens to"
                    value={t.defaultCalendarView}
                    options={["list", "grid"]}
                    onChange={v => setTweak("defaultCalendarView", v)} />
        <TweakSelect label="Land on"
                     value={t.landing}
                     options={[
                       { value: "ai", label: "AI Scheduler" },
                       { value: "calendar", label: "Calendar" },
                       { value: "signup", label: "Sign Up" },
                       { value: "mydates", label: "My Dates" },
                       { value: "admin", label: "Admin Hub" },
                     ]}
                     onChange={v => { setTweak("landing", v); setView(v); }} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
