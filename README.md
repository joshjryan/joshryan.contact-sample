# Astro Brochure Site

A minimal, production-ready Astro brochure site with Home, About, and Contact pages.

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer (or any compatible package manager)

## Getting Started

Install dependencies:

```bash
npm install
```

## Development

Start the local development server with hot reload:

```bash
npm run dev
```

## Production Build

Create an optimized build in the `dist/` directory:

```bash
npm run build
```

## Cloudflare Workers Deployment

This project is configured to deploy to [Cloudflare Workers](https://developers.cloudflare.com/workers/) using Wrangler.

Build and deploy the worker (requires authentication with Cloudflare):

```bash
npm run deploy
```

The build step ensures `dist/client` exists with the static assets Wrangler expects, so deploys succeed even when no client bundles are generated.

To preview the worker locally with asset serving, use Wrangler's dev server:

```bash
npx wrangler dev
```

## Preview

Preview the production build locally (runs `npm run build` if necessary):

```bash
npm run preview
```

## Project Structure

```
└── src
    ├── components
    ├── layouts
    └── pages
```

Static assets live in `public/` and are served at the site root.
