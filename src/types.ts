export interface Slot {
  id: string;
  role: string;
  timeSlot: string | null;
  volunteer: string | null;
  volunteerEmail: string | null;
  coverageRequested?: boolean;
}

export interface Service {
  id: number | string;
  dateISO: string;
  date: string;
  time: string;
  type: string;
  isHH: boolean;
  slots: Slot[];
}

export interface Volunteer {
  name: string;
  email: string;
  active: boolean;
  joined: string;
  servedCount: number;
}

export interface Admin {
  name: string;
  email: string;
  role: 'Owner' | 'Admin';
  joined: string;
  source: 'google' | 'password' | 'invited';
}

export interface Synagogue {
  name: string;
  address: string;
  defaultFridayTime: string;
  defaultSaturdayTime: string;
  reminderDay: string;
  reminderHour: string;
  integrations: {
    gmail: { connected: boolean; account: string };
    gcal: { connected: boolean; account: string };
  };
}

export type UserRole = 'admin' | 'volunteer';
export type AuthSource = 'google' | 'password' | 'manual';

export interface User {
  name: string;
  email: string;
  role: UserRole;
  source: AuthSource;
}

export interface Toast {
  id: string;
  msg: string;
}

export interface AssignTarget {
  svc: Service;
  slot: Slot;
}

export interface SignupTarget {
  svc: Service;
  slot: Slot;
}

export interface EventEditState {
  initial: Service | null;
  prefilledDate: string | null;
}

export type ViewId = 'ai' | 'calendar' | 'admin' | 'signup' | 'mydates';
export type AdminSubId = 'volunteers' | 'admins' | 'coverage' | 'email' | 'settings';

export interface TweakValues {
  palette: string;
  headingFont: string;
  density: 'compact' | 'regular' | 'cozy';
  defaultCalendarView: 'list' | 'grid';
  hhAccents: boolean;
  landing: ViewId;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type SSEEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_action'; action: 'sign_me_up'; svcId: string; slotId: string }
  | { type: 'tool_action'; action: 'request_coverage'; svcId: string; slotId: string }
  | { type: 'tool_action'; action: 'create_service'; service: Service }
  | { type: 'done' }
  | { type: 'error'; message: string };
