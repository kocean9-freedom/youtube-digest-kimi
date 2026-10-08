// Real Manifest V3 runtime + mocked Bilibili endpoints, isolated headless profile.
const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {chromium}=require('playwright');
async function main(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bili-digest-test-'));const root=path.resolve(__dirname,'..');let context;
  try{
    context=await chromium.launchPersistentContext(directory,{headless:true,...(process.env.BD_EXTENSION_BROWSER_EXECUTABLE?{executablePath:process.env.BD_EXTENSION_BROWSER_EXECUTABLE}:{}),args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`],ignoreDefaultArgs:['--disable-extensions']});
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:15000});const id=new URL(worker.url()).hostname;
    const errors=[];worker.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const json=data=>({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'https://www.bilibili.com','access-control-allow-credentials':'true'},body:JSON.stringify(data)});
    await context.route('https://www.bilibili.com/video/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Fixture B站视频</title><h1>Fixture</h1><video></video>'}));
    await context.route('https://api.bilibili.com/**',route=>{
      const u=new URL(route.request().url());
      const data=u.pathname.includes('/view')?{bvid:'BV13x41117TL',aid:1,title:'测试课程',owner:{name:'测试 UP'},pages:[{page:1,cid:11,part:'第一 P',duration:50},{page:2,cid:22,part:'第二 P',duration:90}]}:{subtitle:{subtitles:[{id:1,lan:'zh-CN',lan_doc:'中文',subtitle_url:'https://i0.hdslb.com/bfs/subtitle/test.json'}]}};
      return route.fulfill(json({code:0,data}));
    });
    await context.route('https://i0.hdslb.com/bfs/subtitle/**',route=>route.fulfill(json({body:[{from:1.25,to:2.5,content:'真实扩展通信测试'}]})));
    const page=await context.newPage();await page.goto('https://www.bilibili.com/video/BV13x41117TL/?p=2');await page.locator('#bili-digest-open').waitFor();
    const tabId=await worker.evaluate(async()=>{const tabs=await chrome.tabs.query({url:'https://www.bilibili.com/video/*'});return tabs[0].id;});
    const options=await context.newPage();await options.goto(`chrome-extension://${id}/options.html`);await options.waitForLoadState('networkidle');
    const read=await options.evaluate(tabId=>chrome.runtime.sendMessage({action:'getVideo',tabId}),tabId);assert.equal(read.ok,true,JSON.stringify(read));assert.equal(read.video.cid,22);
    const subtitle=await options.evaluate(data=>chrome.runtime.sendMessage({action:'fetchSubtitle',video:data.video,track:data.tracks[0]}),read);assert.equal(subtitle.ok,true,JSON.stringify(subtitle));assert.equal(subtitle.segments[0].start,1.25);
    const saved=await options.evaluate(video=>chrome.runtime.sendMessage({action:'saveNote',video,text:'保留观点',seconds:1.25}),read.video);assert.equal(saved.ok,true);assert.equal(saved.notes.length,1);
    const canSend=await page.evaluate(()=>typeof chrome.runtime?.sendMessage==='function');assert.equal(canSend,false);
    // Same-page URL navigation must invalidate cached metadata and change cid.
    await page.evaluate(()=>history.pushState({},'', '?p=1'));await page.waitForTimeout(1000);
    const changed=await options.evaluate(tabId=>chrome.runtime.sendMessage({action:'getVideo',tabId}),tabId);assert.equal(changed.video.cid,11);
    const separate=await options.evaluate(video=>chrome.runtime.sendMessage({action:'getNotes',video}),changed.video);assert.equal(separate.notes.length,0);
    assert.deepEqual(errors,[]);console.log('PASS: real MV3 extension — startup, content injection, P2/P1 source, CDN fetch, notes isolation, page cannot read settings');
  }finally{await context?.close();fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
