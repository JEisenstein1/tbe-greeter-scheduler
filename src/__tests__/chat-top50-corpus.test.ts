import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type Scenario = {
  id: string;
  persona: 'guest' | 'volunteer' | 'admin';
  category: string;
  prompt: string;
  setup?: string;
  history?: unknown[];
  expected_response_semantics: string;
  forbidden_response_claims: string[];
  expected_actions: unknown[];
  expected_state_delta: string;
  expected_audit_delta: string;
  expected_notification: string;
  deterministic_or_model: string;
  priority: 'P0' | 'P1' | 'P2';
};

const scenarios = JSON.parse(
  fs.readFileSync(path.resolve('test-fixtures/chat/top-50-acceptance.json'), 'utf8'),
) as Scenario[];

const requiredTextFields: (keyof Scenario)[] = [
  'id',
  'category',
  'prompt',
  'expected_response_semantics',
  'expected_state_delta',
  'expected_audit_delta',
  'expected_notification',
  'deterministic_or_model',
];

describe('top-50 chat behavioral acceptance corpus', () => {
  it('contains exactly 50 uniquely identified scenarios', () => {
    expect(scenarios).toHaveLength(50);
    expect(new Set(scenarios.map(s => s.id)).size).toBe(50);
  });

  it('covers guest, volunteer, and admin product jobs', () => {
    const personas = new Set(scenarios.map(s => s.persona));
    expect(personas).toEqual(new Set(['guest', 'volunteer', 'admin']));
  });

  it('defines substantive response, action, persistence, audit, and notification expectations for every row', () => {
    for (const scenario of scenarios) {
      for (const field of requiredTextFields) {
        const value = scenario[field];
        expect(typeof value, `${scenario.id}.${String(field)}`).toBe('string');
        expect(String(value).trim().length, `${scenario.id}.${String(field)}`).toBeGreaterThan(2);
      }
      expect(Array.isArray(scenario.forbidden_response_claims), scenario.id).toBe(true);
      expect(Array.isArray(scenario.expected_actions), scenario.id).toBe(true);
      expect(['P0', 'P1', 'P2']).toContain(scenario.priority);
    }
  });

  it('does not let low-value safety probes crowd out normal product work', () => {
    const normalJobs = scenarios.filter(s => !s.category.startsWith('guardrail_') && !s.category.startsWith('privacy'));
    expect(normalJobs.length).toBeGreaterThanOrEqual(38);
  });

  it('includes full side-effect contracts for every mutation scenario', () => {
    const mutations = scenarios.filter(s => s.expected_actions.length > 0);
    expect(mutations.length).toBeGreaterThanOrEqual(15);
    for (const scenario of mutations) {
      expect(scenario.expected_state_delta.toLowerCase(), scenario.id).not.toMatch(/^none\.?$/);
      expect(scenario.expected_audit_delta.toLowerCase(), scenario.id).toMatch(/audit|interaction|transaction/);
      expect(scenario.expected_notification.trim().length, scenario.id).toBeGreaterThan(2);
    }
  });
});
