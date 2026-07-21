import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const viewsSource = fs.readFileSync(path.resolve('src/views.tsx'), 'utf8');
const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');

describe('AI signup result truthfulness contract', () => {
  it('awaits the mutation result before rendering a success card', () => {
    expect(viewsSource).toContain('const result = await onAIVolunteerSignup');
    expect(viewsSource).toContain('if (result.assigned && svc && slot)');
  });

  it('only claims an email was sent when delivery reports sent', () => {
    expect(viewsSource).toContain('result.confirmationSent');
    expect(viewsSource).toContain("['Confirmation', 'Assignment saved; email not confirmed']");
    expect(viewsSource).not.toContain("['', '✓ Confirmation sent']");
  });

  it('returns a failed assignment result on a slot conflict', () => {
    expect(appSource).toContain('return { assigned: false, confirmationSent: false }');
    expect(appSource).toContain('return { assigned: true, confirmationSent }');
  });
});
