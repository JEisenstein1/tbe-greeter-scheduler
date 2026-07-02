import { neon } from '@neondatabase/serverless';

const MAX_SNIPPET = 1200;
const SENSITIVE_KEY_RE = /(password|passcode|secret|token|api[_-]?key|authorization|cookie|session|credential|private[_-]?key)/i;

export function safeSnippet(value, max = MAX_SNIPPET) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase() || null;
}

export function redactValue(value, depth = 0) {
  if (depth > 5) return '[TRUNCATED]';
  if (typeof value === 'string') return safeSnippet(value);
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map(item => redactValue(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, inner] of Object.entries(value).slice(0, 100)) {
      out[key] = SENSITIVE_KEY_RE.test(key) ? '[REDACTED]' : redactValue(inner, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, MAX_SNIPPET);
}

export function buildEventPayload(entry = {}) {
  return {
    eventName: safeSnippet(entry.eventName || entry.name || 'unknown_event', 160),
    sessionId: safeSnippet(entry.sessionId || '', 160) || null,
    userEmail: normalizeEmail(entry.userEmail),
    userRole: safeSnippet(entry.userRole || '', 80) || null,
    pagePath: safeSnippet(entry.pagePath || '', 500) || null,
    source: safeSnippet(entry.source || 'web', 80),
    appVersion: safeSnippet(entry.appVersion || process.env.VERCEL_GIT_COMMIT_SHA || '', 120) || null,
    properties: redactValue(entry.properties || {}),
  };
}

export function buildTransactionPayload(entry = {}) {
  return {
    transactionType: safeSnippet(entry.transactionType || entry.type || 'unknown_transaction', 160),
    status: safeSnippet(entry.status || 'unknown', 80),
    actorEmail: normalizeEmail(entry.actorEmail || entry.userEmail),
    entityType: safeSnippet(entry.entityType || '', 120) || null,
    entityId: safeSnippet(String(entry.entityId || ''), 240) || null,
    latencyMs: Number.isFinite(entry.latencyMs) ? Math.round(entry.latencyMs) : null,
    error: safeSnippet(entry.error || '', 1200) || null,
    metadata: redactValue(entry.metadata || {}),
  };
}

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

export function telemetryDb() {
  const url = databaseUrl();
  if (!url) return null;
  return neon(url);
}

export async function ensureTelemetryTables(sql) {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  await sql`CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    user_email TEXT,
    user_role TEXT,
    channel TEXT NOT NULL DEFAULT 'web',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    app_version TEXT,
    prompt_version TEXT,
    model TEXT,
    outcome TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  )`;
  await sql`CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT,
    content_redacted TEXT,
    model TEXT,
    latency_ms INTEGER,
    token_count INTEGER,
    action_count INTEGER,
    action_types TEXT[],
    status TEXT,
    error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  )`;
  await sql`CREATE TABLE IF NOT EXISTS app_event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_name TEXT NOT NULL,
    session_id TEXT,
    user_email TEXT,
    user_role TEXT,
    page_path TEXT,
    source TEXT NOT NULL DEFAULT 'web',
    app_version TEXT,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb
  )`;
  await sql`CREATE TABLE IF NOT EXISTS transaction_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transaction_type TEXT NOT NULL,
    status TEXT NOT NULL,
    actor_email TEXT,
    entity_type TEXT,
    entity_id TEXT,
    latency_ms INTEGER,
    error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_app_event_log_event_created ON app_event_log(event_name, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_transaction_log_type_created ON transaction_log(transaction_type, created_at DESC)`;
}

export async function logChatTurn(entry = {}, sql = telemetryDb()) {
  if (!sql || !entry.sessionId) return;
  await ensureTelemetryTables(sql);
  const metadata = redactValue(entry.metadata || {});
  await sql`INSERT INTO chat_sessions(id, user_email, user_role, channel, app_version, prompt_version, model, metadata, last_seen_at)
    VALUES(${entry.sessionId}, ${normalizeEmail(entry.userEmail)}, ${entry.userRole || null}, ${entry.channel || 'web'}, ${entry.appVersion || process.env.VERCEL_GIT_COMMIT_SHA || null}, ${entry.promptVersion || null}, ${entry.model || null}, ${JSON.stringify(metadata)}, NOW())
    ON CONFLICT(id) DO UPDATE SET user_email=COALESCE(EXCLUDED.user_email, chat_sessions.user_email), user_role=COALESCE(EXCLUDED.user_role, chat_sessions.user_role), last_seen_at=NOW(), app_version=COALESCE(EXCLUDED.app_version, chat_sessions.app_version), model=COALESCE(EXCLUDED.model, chat_sessions.model)`;
  if (entry.userMessage) {
    await sql`INSERT INTO chat_messages(session_id, role, content, content_redacted, status, metadata)
      VALUES(${entry.sessionId}, 'user', ${safeSnippet(entry.userMessage, 4000)}, ${safeSnippet(entry.userMessage)}, ${entry.status || null}, ${JSON.stringify(metadata)})`;
  }
  if (entry.assistantMessage || entry.error) {
    await sql`INSERT INTO chat_messages(session_id, role, content, content_redacted, model, latency_ms, token_count, action_count, action_types, status, error, metadata)
      VALUES(${entry.sessionId}, 'assistant', ${safeSnippet(entry.assistantMessage || '', 4000)}, ${safeSnippet(entry.assistantMessage || '')}, ${entry.model || null}, ${Number.isFinite(entry.latencyMs) ? Math.round(entry.latencyMs) : null}, ${Number.isFinite(entry.tokenCount) ? Math.round(entry.tokenCount) : null}, ${entry.actionCount || 0}, ${entry.actionTypes || []}, ${entry.status || null}, ${entry.error || null}, ${JSON.stringify(metadata)})`;
  }
}

export async function logAppEvent(entry = {}, sql = telemetryDb()) {
  if (!sql) return;
  const payload = buildEventPayload(entry);
  await ensureTelemetryTables(sql);
  await sql`INSERT INTO app_event_log(event_name, session_id, user_email, user_role, page_path, source, app_version, properties)
    VALUES(${payload.eventName}, ${payload.sessionId}, ${payload.userEmail}, ${payload.userRole}, ${payload.pagePath}, ${payload.source}, ${payload.appVersion}, ${JSON.stringify(payload.properties)})`;
}

export async function logTransaction(entry = {}, sql = telemetryDb()) {
  if (!sql) return;
  const payload = buildTransactionPayload(entry);
  await ensureTelemetryTables(sql);
  await sql`INSERT INTO transaction_log(transaction_type, status, actor_email, entity_type, entity_id, latency_ms, error, metadata)
    VALUES(${payload.transactionType}, ${payload.status}, ${payload.actorEmail}, ${payload.entityType}, ${payload.entityId}, ${payload.latencyMs}, ${payload.error}, ${JSON.stringify(payload.metadata)})`;
}
