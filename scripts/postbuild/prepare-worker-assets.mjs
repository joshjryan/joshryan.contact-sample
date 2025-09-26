import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..', '..');
const distDir = resolve(projectRoot, 'dist');
const distClientDir = resolve(distDir, 'client');
const distAstroDir = resolve(distDir, '_astro');
const publicDir = resolve(projectRoot, 'public');

if (!existsSync(distClientDir)) {
  mkdirSync(distClientDir, { recursive: true });
}

if (existsSync(publicDir)) {
  cpSync(publicDir, distClientDir, {
    recursive: true,
    force: true,
  });
}

if (existsSync(distAstroDir)) {
  const clientAstroDir = resolve(distClientDir, '_astro');
  mkdirSync(clientAstroDir, { recursive: true });
  cpSync(distAstroDir, clientAstroDir, {
    recursive: true,
    force: true,
  });
}
