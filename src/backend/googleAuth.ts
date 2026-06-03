export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

export interface GoogleUserProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

export const DEFAULT_GOOGLE_SCOPES = ['openid', 'email', 'profile'];

export function requireGoogleOAuthConfig(env: Record<string, string | undefined>): GoogleOAuthConfig {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const redirectUri = env.GOOGLE_REDIRECT_URI;
  const missing = [
    ['GOOGLE_CLIENT_ID', clientId],
    ['GOOGLE_CLIENT_SECRET', clientSecret],
    ['GOOGLE_REDIRECT_URI', redirectUri],
  ].filter(([, value]) => !value).map(([key]) => key);

  if (missing.length) throw new Error(`Missing Google OAuth config: ${missing.join(', ')}`);

  return { clientId: clientId!, clientSecret: clientSecret!, redirectUri: redirectUri!, scopes: DEFAULT_GOOGLE_SCOPES };
}

export function buildGoogleAuthUrl(config: GoogleOAuthConfig, state: string, nonce: string): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', (config.scopes || DEFAULT_GOOGLE_SCOPES).join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export function mapGoogleProfileToUser(profile: GoogleUserProfile, adminEmails: string): { name: string; email: string; role: 'admin' | 'volunteer'; source: 'google'; googleSub: string } {
  if (!profile.emailVerified) throw new Error('GOOGLE_EMAIL_NOT_VERIFIED');
  const email = profile.email.trim().toLowerCase();
  const admins = adminEmails.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  return {
    name: profile.name || email.split('@')[0],
    email,
    role: admins.includes(email) ? 'admin' : 'volunteer',
    source: 'google',
    googleSub: profile.sub,
  };
}
