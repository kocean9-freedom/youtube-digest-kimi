// Headless interface tests with simulated Chrome messages; no account/paid APIs.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
async function fixture(page) {
  await page.addInitScript(() => {
    const listeners = []; const store = {}; let notes = [];
    window.mock = { part: 1, hasAiKey: false, delay: 0, calls: [], denied: false };
    const video = () => ({bvid:'BV13x41117TL',cid:100+window.mock.part,page:window.mock.part,totalParts:2,title:'从视频到知识：理解神经网络',part:'第 '+window.mock.part+' 课',author:'知识研究所',duration:120,url:'https://www.bilibili.com/video/BV13x41117TL/?p='+window.mock.part});
    const getSettings = () => ({aiConfigVersion:2,activeProvider:'kimi-code',providers:{'kimi-code':{apiKey:'',model:'kimi-for-coding'}}});
    const result = async m => {
      window.mock.calls.push(m);
      if(m.action==='getSettings')return {ok:true,hasAiKey:window.mock.hasAiKey,provider:'Kimi Coding Plan',settings:store.bili_settings||getSettings()};
      if(m.action==='getVideo'){const v=video();if(window.mock.delay)await new Promise(r=>setTimeout(r,window.mock.delay));return {ok:true,video:v,tracks:[{language:'ai-en',label:'English',isAi:true,url:'https://i0.hdslb.com/bfs/subtitle/example.json'}]};}
      if(m.action==='fetchSubtitle')return {ok:true,segments:[{start:1.25,end:5,text:'First, a neural network learns patterns from examples.'},{start:8,end:14,text:'<script>literal</script> Weights connect the layers.'},{start:18,end:24,text:'Gradient descent updates each weight.'}]};
      if(m.action==='getNotes')return {ok:true,notes:notes.filter(n=>n.cid===m.video.cid)};
      if(m.action==='saveNote'){notes.unshift({...m.video,id:'note-'+Date.now(),text:m.text,seconds:m.seconds});return {ok:true,notes:notes.filter(n=>n.cid===m.video.cid)};}
      if(m.action==='deleteNote'){notes=notes.filter(n=>n.id!==m.id);return {ok:true,notes};}
      if(m.action==='getTime')return {ok:true,time:18};
      if(m.action==='ai'){
        if(m.input.kind==='translation')return {ok:true,text:JSON.stringify(JSON.parse(m.input.text).map(s=>({id:s.id,text:'中文译文 '+s.id})))};
        if(window.mock.delay)await new Promise(r=>setTimeout(r,window.mock.delay));
        return {ok:true,text:m.input.kind==='cleanup'?'润色后的笔记':'核心观点\n[00:01] 神经网络从样本中学习规律。'};
      }
      if(m.action==='testAi')return window.mock.failTest?{ok:false,error:'模型服务拒绝了 Key，请检查 Key 和账号权限。'}:{ok:true,text:'OK'};
      return {ok:true};
    };
    window.chrome={runtime:{id:'fixture',getURL:p=>'chrome-extension://fixture/'+p,sendMessage:result,onMessage:{addListener:l=>listeners.push(l)},openOptionsPage:async()=>{}},tabs:{query:async()=>[{id:1,url:video().url}],get:async()=>({id:1,url:video().url}),onActivated:{addListener:l=>listeners.push(l)},onUpdated:{addListener:l=>listeners.push(l)}},storage:{local:{get:async key=>({[key]:store[key]}),set:async d=>Object.assign(store,d),remove:async key=>delete store[key]},onChanged:{addListener:()=>{}}},permissions:{request:async()=>!window.mock.denied,contains:async()=>true}};
    window.mock.navigate = part => {window.mock.part=part;listeners.forEach(l=>l({action:'frontVideoChanged',tabId:1}));};
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.mock.clipboard=text;}}});
  });
}
async function main() {
  assert.ok(fs.existsSync(path.join(root,'sidepanel.html')),'sidepanel.html must exist');
  const browser=await chromium.launch({headless:true,...(process.env.BD_BROWSER_EXECUTABLE?{executablePath:process.env.BD_BROWSER_EXECUTABLE}:{})});
  try {
    const context=await browser.newContext({viewport:{width:390,height:860},acceptDownloads:true});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await fixture(page);
    await page.goto(pathToFileURL(path.join(root,'sidepanel.html')).href);await page.waitForLoadState('networkidle');
    await page.locator('.subtitle-row').first().waitFor();assert.equal(await page.locator('.subtitle-row').count(),3);
    assert.equal(await page.locator('#generateSummary').isDisabled(),true);
    assert.equal(await page.locator('#videoTitle').textContent(),'从视频到知识：理解神经网络');
    assert.equal(await page.locator('#subtitleList script').count(),0);
    await page.locator('#search').fill('weights');assert.equal(await page.locator('.subtitle-row:visible').count(),1);
    await page.locator('#search').fill('');await page.locator('.seek').first().click();assert.ok((await page.evaluate(()=>window.mock.calls)).some(m=>m.action==='seekTo'&&m.seconds===1.25));
    await page.locator('#copyTranscript').click();assert.match(await page.evaluate(()=>window.mock.clipboard),/cid：101/);
    const downloadPromise=page.waitForEvent('download');await page.locator('#exportTranscript').click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/\.md$/);assert.match(fs.readFileSync(await download.path(),'utf8'),/字幕来源/);
    await page.locator('[data-tab="notes"]').click();await page.locator('#noteText').fill('重点笔记');await page.locator('#saveNote').click();await page.locator('.note-card').waitFor();assert.match(await page.locator('.note-card').textContent(),/重点笔记/);
    await page.locator('.delete-note').click();await page.waitForFunction(()=>document.querySelectorAll('.note-card').length===0);
    await page.evaluate(()=>window.mock.hasAiKey=true);await page.locator('#refresh').click();await page.waitForFunction(()=>!document.getElementById('generateSummary').disabled);
    await page.locator('[data-tab="overview"]').click();await page.locator('#generateSummary').click();await page.waitForFunction(()=>document.getElementById('summary').textContent.includes('核心观点'));
    await page.locator('[data-tab="transcript"]').click();await page.locator('#translate').click();await page.waitForFunction(()=>document.querySelector('.translated')?.textContent.includes('中文译文'));
    await page.locator('#displayMode').selectOption('bilingual');
    fs.mkdirSync(path.resolve(root,'../dist/bilibili-test'),{recursive:true});
    await page.screenshot({path:path.resolve(root,'../dist/bilibili-test/sidepanel.png'),fullPage:true});
    await page.evaluate(()=>{window.mock.delay=250;window.mock.navigate(2);});
    await page.waitForFunction(()=>document.getElementById('videoMeta').textContent.includes('P2'));
    assert.equal(await page.locator('#summary').textContent(),'');
    await page.evaluate(()=>{window.mock.delay=300;window.mock.navigate(1);setTimeout(()=>{window.mock.delay=0;window.mock.navigate(2);},40);});
    await page.waitForTimeout(450);assert.match(await page.locator('#videoMeta').textContent(),/P2/);
    await page.setViewportSize({width:320,height:700});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const options=await context.newPage();options.on('pageerror',e=>errors.push(e.message));await fixture(options);
    await options.goto(pathToFileURL(path.join(root,'options.html')).href);await options.waitForLoadState('networkidle');
    await options.locator('#apiKey').fill('fixture-value');await options.locator('#saveSettings').click();await options.waitForFunction(()=>document.getElementById('status').textContent.includes('已保存'));
    await options.locator('#provider').selectOption('openai');await options.locator('#apiKey').fill('another-fixture');await options.locator('#model').fill('example-model');await options.locator('#saveSettings').click();
    await options.locator('#provider').selectOption('kimi-code');assert.equal(await options.locator('#apiKey').inputValue(),'fixture-value');
    await options.evaluate(()=>window.mock.failTest=true);await options.locator('#testConnection').click();await options.waitForFunction(()=>document.getElementById('status').textContent.includes('拒绝了 Key'));
    await options.locator('#deleteKey').click();assert.equal(await options.locator('#apiKey').inputValue(),'');
    await options.screenshot({path:path.resolve(root,'../dist/bilibili-test/options.png'),fullPage:true});
    assert.deepEqual(errors,[]);console.log('PASS: headless UI — extraction without Key, search, seek, copy/export, notes, AI, translation, part races, narrow view, settings isolation');
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
