export function servicesForViewer(services, role = 'guest', viewerEmail = '') {
  const normalizedViewerEmail = String(viewerEmail || '').trim().toLowerCase();
  return (services || []).map(service => ({
    ...service,
    slots: (service.slots || []).map(slot => {
      if (role === 'admin') return { ...slot };
      if (role === 'volunteer') {
        const mine = normalizedViewerEmail
          && String(slot.volunteerEmail || '').trim().toLowerCase() === normalizedViewerEmail;
        return { ...slot, volunteerEmail: mine ? slot.volunteerEmail : null };
      }
      return {
        ...slot,
        volunteer: slot.volunteer ? 'FILLED' : null,
        volunteerEmail: null,
        coverageRequested: false,
      };
    }),
  }));
}
