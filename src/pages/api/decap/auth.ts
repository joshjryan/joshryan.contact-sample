import type { APIContext, APIRoute } from 'astro';

const STATE_COOKIE_NAME = 'decap_oauth_state';
const STATE_COOKIE_PATH = '/api/decap';
const STATE_COOKIE_MAX_AGE_SECONDS = 5 * 60;

type RuntimeEnv = Record<string, string | undefined>;

const createStateCookie = (state: string, requestUrl: URL): string => {
  const directives = [
    `${STATE_COOKIE_NAME}=${encodeURIComponent(state)}`,
    `Path=${STATE_COOKIE_PATH}`,
    `Max-Age=${STATE_COOKIE_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (requestUrl.protocol === 'https:') {
    directives.push('Secure');
  }

  return directives.join('; ');
};

const getGithubClientId = (locals: APIContext['locals']): string | undefined => {
  const runtimeEnv = locals.runtime?.env as RuntimeEnv | undefined;
  return runtimeEnv?.GITHUB_CLIENT_ID ?? import.meta.env.GITHUB_CLIENT_ID;
};

export const GET: APIRoute = async ({ locals, request }) => {
  const clientId = getGithubClientId(locals);

  if (!clientId) {
    return new Response('Missing GitHub client ID configuration.', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    });
  }

  try {
    const requestUrl = new URL(request.url);
    const redirectUri = new URL('/api/decap/callback', requestUrl.origin);
    const oauthState = crypto.randomUUID();
    const clientState = requestUrl.searchParams.get('state');

    const statePayload: Record<string, string> = { csrf: oauthState };
    if (clientState) {
      statePayload.payload = clientState;
    }

    const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set(
      'scope',
      requestUrl.searchParams.get('scope') ?? 'repo',
    );
    authorizeUrl.searchParams.set('redirect_uri', redirectUri.toString());
    authorizeUrl.searchParams.set('state', JSON.stringify(statePayload));

    const headers = new Headers({ Location: authorizeUrl.toString() });
    headers.append('Set-Cookie', createStateCookie(oauthState, requestUrl));

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (error) {
    console.error('Failed to generate GitHub authorization URL', error);
    return new Response('Unable to initiate GitHub authorization.', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    });
  }
};
