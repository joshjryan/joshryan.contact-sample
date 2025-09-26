import type { APIContext, APIRoute } from 'astro';

type RuntimeEnv = Record<string, string | undefined>;

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

    const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('scope', 'repo');
    authorizeUrl.searchParams.set('redirect_uri', redirectUri.toString());

    return Response.redirect(authorizeUrl.toString(), 302);
  } catch (error) {
    console.error('Failed to generate GitHub authorization URL', error);
    return new Response('Unable to initiate GitHub authorization.', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    });
  }
};
