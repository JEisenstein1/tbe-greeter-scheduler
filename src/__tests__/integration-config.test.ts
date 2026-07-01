import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const api = readFileSync('api/chat.js', 'utf8');
const server = readFileSync('server/index.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const claudeMd = readFileSync('CLAUDE.md', 'utf8');

describe('AI routing contract', () => {
  it('uses configurable OPENROUTER_MODEL in the canonical chat handler and delegates local server to it', () => {
    expect(api).toContain("process.env.OPENROUTER_MODEL || 'openai/gpt-5.5'");
    expect(server).toContain("import chatHandler from '../api/chat.js'");
  });

  it('keeps create_service schema flat in the canonical chat handler used by local and Edge paths', () => {
    expect(api).toContain("required: ['id', 'dateISO', 'date', 'time', 'type', 'isHH', 'slots']");
    expect(server).not.toContain("required: ['service']");
    expect(api).toContain("actions.push({ action: 'create_service', service: input })");
  });

  it('returns JSON from local server instead of SSE', () => {
    expect(server).toContain('res.send(text);');
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
    expect(claudeMd).toContain('delegates to the canonical `api/chat.js` handler');
    expect(claudeMd).toContain('OPENROUTER_MODEL');
  });
});
