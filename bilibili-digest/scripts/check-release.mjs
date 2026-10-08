import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const releaseFiles = Object.freeze(['manifest.json', 'core.js', 'source.js', 'runtime.js', 'settings.js', 'ai-providers.js', 'ai-client.js', 'content.js', 'background.js', 'sidepanel.html', 'sidepanel.css', 'sidepanel.js', 'options.html', 'options.js', 'README.md', 'PRIVACY.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE', 'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png']);
export function checkRelease() {
  const allowed = new Set(releaseFiles); const referenced = new Set();
  for (const file of releaseFiles) {
    const full = path.join(root, file);
    if (!fs.existsSync(full) || !fs.lstatSync(full).isFile() || fs.lstatSync(full).isSymbolicLink()) throw new Error(`Missing/unsafe release file: ${file}`);
    if (file.endsWith('.js')) {
      const check = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' });
      if (check.status !== 0) throw new Error(check.stderr);
    }
    if (!/\.(js|html|md|json)$/.test(file)) continue;
    const text = fs.readFileSync(full, 'utf8');
    if (/\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/.test(text)) throw new Error(`Possible secret in public file: ${file}`);
    if (file.endsWith('.html')) for (const m of text.matchAll(/(?:src|href)=["']([^"']+)["']/g)) { if (!/^[a-z]+:|^#|^\/\//i.test(m[1])) referenced.add(m[1]); }
    if (file.endsWith('.js')) for (const m of text.matchAll(/importScripts\(([^)]+)\)/g)) for (const name of m[1].matchAll(/["']([^"']+)["']/g)) referenced.add(name[1]);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.manifest_version !== 3 || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Invalid Manifest V3 version');
  referenced.add(manifest.background.service_worker); referenced.add(manifest.side_panel.default_path); referenced.add(manifest.options_ui.page);
  for (const scripts of manifest.content_scripts) for (const file of scripts.js) referenced.add(file);
  for (const value of Object.values(manifest.icons || {})) referenced.add(value);
  for (const value of Object.values(manifest.action.default_icon || {})) referenced.add(value);
  for (const file of referenced) if (!allowed.has(file)) throw new Error(`Reference outside release allowlist: ${file}`);
  const notices = fs.readFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  if (!notices.includes('Zara Zhang') || !notices.includes('zarazhangrui/youtube-digest') || !notices.includes('kocean9-freedom/youtube-digest-kimi')) throw new Error('Missing remix attribution');
  if (!fs.readFileSync(path.join(root, 'LICENSE'), 'utf8').includes('Copyright (c) 2026 Zara Zhang')) throw new Error('Original MIT notice must be preserved');
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const manifest = checkRelease(); console.log(`PASS: Bilibili Digest ${manifest.version} release — ${releaseFiles.length} allowlisted files, syntax, references, provenance`); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
