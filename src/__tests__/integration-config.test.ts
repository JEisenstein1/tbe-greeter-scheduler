import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const api = readFileSync('api/chat.js', 'utf8');
const server = readFileSync('server/index.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const claudeMd = readFileSync('CLAUDE.md', 'utf8');

describe('AI routing contract', () => {
  it('uses configurable OPENROUTER_MODEL in both Edge and local server', () => {
    expect(api).toContain("process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-haiku'");
    expect(server).toContain("process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-haiku'");
  });

  it('keeps create_service schema flat in both Edge and local server', () => {
    expect(api).toContain("required: ['id', 'dateISO', 'date', 'time', 'type', 'isHH', 'slots']");
    expect(server).toContain("required: ['id', 'dateISO', 'date', 'time', 'type', 'isHH', 'slots']");
    expect(server).not.toContain("required: ['service']");
    expect(server).toContain("actions.push({ action: 'create_service', service: input })");
  });

  it('returns JSON from local server instead of SSE', () => {
    expect(server).toContain('res.json(result);');
    expect(server).not.toContain('text/event-stream');
    expect(server).not.toContain('res.write(`data:');
  });

  it('does not depend on the Anthropic SDK after OpenRouter migration', () => {
    expect(api).not.toContain('api.anthropic.com');
    expect(server).not.toContain('api.anthropic.com');
    expect(server).not.toContain('@anthropic-ai/sdk');
    expect(server).not.toContain('new Anthropic');
    expect(pkg.dependencies['@anthropic-ai/sdk']).toBeUndefined();
  });

  it('documents local/Edge parity and OpenRouter model override', () => {
    expect(claudeMd).toContain('Mirrors `api/chat.js` protocol/schema/model configuration');
    expect(claudeMd).toContain('OPENROUTER_MODEL');
  });
});
