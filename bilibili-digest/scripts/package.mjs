import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { spawnSync } from 'node:child_process'; import { createHash } from 'node:crypto';
import { root, releaseFiles, checkRelease } from './check-release.mjs';
const manifest = checkRelease(); const outputDir = path.resolve(root, '../dist'); fs.mkdirSync(outputDir, { recursive: true });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bilibili-digest-package-'));
try {
  const zip = path.join(temp, 'package.zip');
  const result = spawnSync('zip', ['-X', '-q', zip, ...releaseFiles], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'zip command is required');
  const list = spawnSync('unzip', ['-Z1', zip], { encoding: 'utf8' });
  if (list.status !== 0 || list.stdout.trim().split('\n').some(file => !releaseFiles.includes(file))) throw new Error('ZIP allowlist verification failed');
  const output = path.join(outputDir, `bilibili-digest-v${manifest.version}.zip`);
  fs.copyFileSync(zip, output); const digest = createHash('sha256').update(fs.readFileSync(output)).digest('hex');
  fs.writeFileSync(`${output}.sha256`, `${digest}  ${path.basename(output)}\n`);
  console.log(`Packaged: ${output}\nSHA-256: ${digest}`);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
