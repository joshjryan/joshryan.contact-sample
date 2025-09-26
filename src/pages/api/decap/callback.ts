import type { APIContext, APIRoute } from 'astro';

const STATE_COOKIE_NAME = 'decap_oauth_state';
const STATE_COOKIE_PATH = '/api/decap';

type RuntimeEnv = Record<string, string | undefined>;

type GithubTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type ParsedState = {
  csrf: string;
  payload?: string;
};

const parseCookies = (cookieHeader: string | null): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((accumulator, cookie) => {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (!name) {
      return accumulator;
    }

    const value = valueParts.join('=');
    accumulator[name] = value;
    return accumulator;
  }, {});
};

const parseAuthorizeState = (rawState: string): ParsedState => {
  try {
    const parsed = JSON.parse(rawState) as Partial<ParsedState>;
    if (parsed && typeof parsed === 'object' && typeof parsed.csrf === 'string') {
      return {
        csrf: parsed.csrf,
        payload: typeof parsed.payload === 'string' ? parsed.payload : undefined,
      };
    }
  } catch (error) {
    console.warn('Failed to parse OAuth state as JSON, falling back to raw value.', error);
  }

  return { csrf: rawState };
};

const createClearedStateCookie = (requestUrl: URL): string => {
  const directives = [
    `${STATE_COOKIE_NAME}=`,
    `Path=${STATE_COOKIE_PATH}`,
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (requestUrl.protocol === 'https:') {
    directives.push('Secure');
  }

  return directives.join('; ');
};

const getGithubCredentials = (
  locals: APIContext['locals'],
): { clientId?: string; clientSecret?: string } => {
  const runtimeEnv = locals.runtime?.env as RuntimeEnv | undefined;
  const clientId = runtimeEnv?.GITHUB_CLIENT_ID ?? import.meta.env.GITHUB_CLIENT_ID;
  const clientSecret = runtimeEnv?.GITHUB_CLIENT_SECRET ?? import.meta.env.GITHUB_CLIENT_SECRET;

  return { clientId, clientSecret };
};

export const GET: APIRoute = async ({ locals, request }) => {
  const { clientId, clientSecret } = getGithubCredentials(locals);

  if (!clientId || !clientSecret) {
    return new Response('Missing GitHub OAuth configuration.', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    });
  }

  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const stateParam = requestUrl.searchParams.get('state');

    if (!code) {
      return new Response('Missing authorization code.', {
        status: 400,
        headers: { 'content-type': 'text/plain' },
      });
    }

    const cookies = parseCookies(request.headers.get('cookie'));
    const storedStateValue = cookies[STATE_COOKIE_NAME];
    const storedState = storedStateValue ? decodeURIComponent(storedStateValue) : undefined;

    if (!storedState) {
      console.error('OAuth callback received without a stored state cookie.');
      const headers = new Headers({ 'content-type': 'text/plain' });
      headers.append('Set-Cookie', createClearedStateCookie(requestUrl));
      return new Response('Missing stored OAuth state.', {
        status: 400,
        headers,
      });
    }

    if (!stateParam) {
      console.error('OAuth callback missing state parameter.');
      const headers = new Headers({ 'content-type': 'text/plain' });
      headers.append('Set-Cookie', createClearedStateCookie(requestUrl));
      return new Response('Missing OAuth state parameter.', {
        status: 400,
        headers,
      });
    }

    const parsedState = parseAuthorizeState(stateParam);

    if (storedState !== parsedState.csrf) {
      console.error('OAuth state mismatch detected.', {
        expected: storedState,
        received: parsedState.csrf,
      });
      const headers = new Headers({ 'content-type': 'text/plain' });
      headers.append('Set-Cookie', createClearedStateCookie(requestUrl));
      return new Response('OAuth state mismatch detected.', {
        status: 400,
        headers,
      });
    }

    const validatedState = parsedState.payload ?? null;

    console.info('OAuth state validated successfully.', {
      csrf: parsedState.csrf,
      clientState: validatedState,
    });

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('GitHub token exchange failed with status', tokenResponse.status);
      const headers = new Headers({ 'content-type': 'text/plain' });
      headers.append('Set-Cookie', createClearedStateCookie(requestUrl));
      return new Response('Failed to exchange token with GitHub.', {
        status: 502,
        headers,
      });
    }

    const tokenJson = (await tokenResponse.json()) as GithubTokenResponse;

    if (!tokenJson.access_token) {
      console.error('GitHub token exchange error', tokenJson);
      const message = tokenJson.error_description || tokenJson.error || 'Unknown GitHub error.';
      const headers = new Headers({ 'content-type': 'text/plain' });
      headers.append('Set-Cookie', createClearedStateCookie(requestUrl));
      return new Response(`GitHub authorization failed: ${message}`, {
        status: 502,
        headers,
      });
    }

    const token = tokenJson.access_token;

    const payload: Record<string, unknown> = { token };

    if (stateParam) {
      payload.state = stateParam;
    }

    if (validatedState) {
      payload.validatedState = validatedState;
    }

    const payloadJson = JSON.stringify(payload);

    const successHeaders = new Headers({ 'content-type': 'text/html' });
    successHeaders.append('Set-Cookie', createClearedStateCookie(requestUrl));

    const html = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="utf-8" />',
      '    <title>GitHub Authorization Success</title>',
      '    <style>',
      '      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 2rem; }',
      '    </style>',
      '  </head>',
      '  <body>',
      '    <p>Authorization complete. You may close this tab if it does not close automatically.</p>',
      '    <script>',
      `      const payload = ${payloadJson};`,
      "      const message = 'authorization:github:success:' + JSON.stringify(payload);",
      "      let targetWindow = null;",
      "      try {",
      "        if (window.opener && !window.opener.closed) {",
      "          targetWindow = window.opener;",
      "        } else if (window.parent && window.parent !== window) {",
      "          targetWindow = window.parent;",
      "        }",
      "      } catch (lookupError) {",
      "        console.error('Error while locating opener window for OAuth completion', lookupError);",
      "      }",
      "      if (targetWindow) {",
      "        try {",
      "          targetWindow.postMessage(message, '*');",
      "          window.close();",
      "        } catch (postError) {",
      "          console.error('Failed to notify opener about authorization success', postError);",
      "        }",
      "      } else {",
      "        console.error('Unable to locate opener window for OAuth completion');",
      "        const warning = document.createElement('p');",
      "        warning.textContent = 'We could not return you to the admin screen automatically. Please switch back to it and refresh the page.';",
      "        document.body.appendChild(warning);",
      "      }",
      '    </script>',
      '  </body>',
      '</html>',
    ].join('\n');

    return new Response(html, {
      status: 200,
      headers: successHeaders,
    });
  } catch (error) {
    console.error('Unexpected error during GitHub OAuth callback', error);
    return new Response('Unexpected error while completing authorization.', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    });
  }
};
