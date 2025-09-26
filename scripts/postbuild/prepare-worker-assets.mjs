import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..', '..');
const distClientDir = resolve(projectRoot, 'dist', 'client');
const publicDir = resolve(projectRoot, 'public');

if (!existsSync(distClientDir)) {
  mkdirSync(distClientDir, { recursive: true });
}

if (existsSync(publicDir)) {
  cpSync(publicDir, distClientDir, {
    recursive: true,
    force: false,
    errorOnExist: false,
  });
}
