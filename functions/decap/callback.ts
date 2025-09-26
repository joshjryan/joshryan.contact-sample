import type { PagesFunction } from '@cloudflare/workers-types';

/**
 * Cloudflare Pages Function to complete the GitHub OAuth flow for Decap CMS.
 */
export const onRequest: PagesFunction = async ({ env, request }) => {
  const clientId = env.GITHUB_CLIENT_ID as string | undefined;
  const clientSecret = env.GITHUB_CLIENT_SECRET as string | undefined;

  if (!clientId || !clientSecret) {
    return new Response('Missing GitHub OAuth configuration.', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    });
  }

  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');

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

    const tokenJson: { access_token?: string; error?: string; error_description?: string } =
      await tokenResponse.json();

    if (!tokenJson.access_token) {
      console.error('GitHub token exchange error', tokenJson);
      const message = tokenJson.error_description || tokenJson.error || 'Unknown GitHub error.';
      return new Response(`GitHub authorization failed: ${message}`, {
        status: 502,
        headers: { 'content-type': 'text/plain' },
      });
    }

    const token = tokenJson.access_token;

    const html = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="utf-8" />',
      '    <title>GitHub Authorization Success</title>',
      '  </head>',
      '  <body>',
      '    <script>',
      `      const token = ${JSON.stringify(token)};`,
      "      try {",
      "        window.opener.postMessage(",
      "          'authorization:github:success:' + JSON.stringify({ token }),",
      "          window.location.origin",
      "        );",
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
