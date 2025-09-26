import type { APIContext, APIRoute } from 'astro';

type RuntimeEnv = Record<string, string | undefined>;

type GithubTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
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
    const state = requestUrl.searchParams.get('state');


    if (!code) {
      return new Response('Missing authorization code.', {
        status: 400,
        headers: { 'content-type': 'text/plain' },
      });
    }

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
      return new Response('Failed to exchange token with GitHub.', {
        status: 502,
        headers: { 'content-type': 'text/plain' },
      });
    }

    const tokenJson = (await tokenResponse.json()) as GithubTokenResponse;

    if (!tokenJson.access_token) {
      console.error('GitHub token exchange error', tokenJson);
      const message = tokenJson.error_description || tokenJson.error || 'Unknown GitHub error.';
      return new Response(`GitHub authorization failed: ${message}`, {
        status: 502,
        headers: { 'content-type': 'text/plain' },
      });
    }

    const token = tokenJson.access_token;

    const payload: Record<string, unknown> = { token };
    if (state) {
      payload.state = state;
    }


    const html = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="utf-8" />',
      '    <title>GitHub Authorization Success</title>',
      '  </head>',
      '  <body>',
      '    <script>',
      `      const payload = ${JSON.stringify(payload)};`,
      "      const message = 'authorization:github:success:' + JSON.stringify(payload);",
      "      try {",
      "        const targetWindow = window.opener || window.parent;",
      "        if (targetWindow) {",
      "          targetWindow.postMessage(message, '*');",
      "        } else {",
      "          console.error('Unable to locate opener window for OAuth completion');",
      "        }",

      "      } catch (error) {",
      "        console.error('Failed to notify opener about authorization success', error);",
      "      }",
      "      window.close();",
      '    </script>',
      '  </body>',
      '</html>',
    ].join('\n');

    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
  } catch (error) {
    console.error('Unexpected error during GitHub OAuth callback', error);
    return new Response('Unexpected error while completing authorization.', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    });
  }
};
