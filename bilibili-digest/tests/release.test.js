const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('发布检查包含本地资源、许可和二创来源',()=>{
  const r=spawnSync(process.execPath,[path.join(root,'scripts/check-release.mjs')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr+r.stdout);
  assert.equal(fs.readFileSync(path.join(root,'LICENSE'),'utf8'),fs.readFileSync(path.join(root,'../LICENSE'),'utf8'));
  const notices=fs.readFileSync(path.join(root,'THIRD_PARTY_NOTICES.md'),'utf8');assert.ok(notices.includes('Zara Zhang'));assert.ok(notices.includes('zarazhangrui/youtube-digest'));assert.ok(notices.includes('kocean9-freedom/youtube-digest-kimi'));
});
test('manifest 不申请读取 cookie、下载和任意脚本注入权限',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  assert.equal(m.manifest_version,3);assert.equal(m.minimum_chrome_version,'116');
  for(const p of ['cookies','debugger','scripting','downloads','webRequest'])assert.ok(!m.permissions.includes(p));
  assert.ok(m.host_permissions.every(o=>!o.includes('youtube')&&!o.includes('supadata')&&!o.includes('kimi')));
});
