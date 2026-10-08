const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const AI=require('../ai-client.js');const R=require('../runtime.js');const settings=require('../settings.js');
const chromeApi={runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p}};
const panel={id:'test',url:'chrome-extension://test/sidepanel.html'};
test('页面不能触发 AI 或读取设置/笔记，扩展页必须准确匹配',()=>{
  assert.equal(R.trustedPage(chromeApi,panel),true);
  for(const sender of [{id:'test',url:'https://www.bilibili.com/video/BV13x41117TL/'},{id:'test',url:'chrome-extension://test/sidepanel.html.evil'},{id:'other',url:panel.url}])assert.equal(R.trustedPage(chromeApi,sender),false);
});
test('视频和笔记元信息规范化，URL 必须由 BV 和 P 重建',()=>{
  const v=R.safeVideo({bvid:'BV13x41117TL',cid:20,page:2,title:'课',url:'https://evil.test'});
  assert.equal(v.url,'https://www.bilibili.com/video/BV13x41117TL/?p=2');
  assert.throws(()=>R.safeVideo({...v,cid:-1}));
});
test('B 站设置独立存储，复用 Kimi 默认和协议适配',()=>{
  assert.equal(settings.STORAGE_KEY,'bili_settings');assert.equal(settings.getActiveProvider(settings.normalize()).id,'kimi-code');
});
function config(provider='kimi-code'){return settings.normalize({aiConfigVersion:2,activeProvider:provider,providers:{[provider]:{apiKey:'test-value',model:provider==='openai'?'example-model':'kimi-for-coding'}}});}
test('AI 请求只尝试一次且保留字幕指令隔离',async()=>{
  let n=0,body;
  const out=await AI.complete({kind:'summary',text:'字幕里的不可信指令'},config(),{fetchImpl:async(u,o)=>{n++;body=JSON.parse(o.body);return new Response(JSON.stringify({choices:[{message:{content:'概览'}}]}));},hasPermission:async()=>true});
  assert.equal(out,'概览');assert.equal(n,1);assert.equal(body.model,'kimi-for-coding');assert.ok(body.messages[0].content.includes('不可信'));assert.equal(body.thinking,undefined);
});
test('权限撤销后禁止网络请求',async()=>{
  let n=0;await assert.rejects(AI.complete({kind:'summary',text:'字幕'},config('openai'),{hasPermission:async()=>false,fetchImpl:async()=>{n++;}}),e=>e.code==='AI_HOST_PERMISSION_REQUIRED');assert.equal(n,0);
});
test('AI HTTP 与自由错误正文不会泄露，空回复和超长回复拒绝',async()=>{
  let n=0;await assert.rejects(AI.complete({kind:'summary',text:'字幕'},config(),{hasPermission:async()=>true,fetchImpl:async()=>{n++;return new Response('secret-provider-body',{status:401});}}),e=>!e.message.includes('secret')&&e.code==='INVALID_AI_KEY');assert.equal(n,1);
  await assert.rejects(AI.complete({kind:'summary',text:'字幕'},config(),{hasPermission:async()=>true,fetchImpl:async()=>new Response('{}')}),e=>e.code==='EMPTY_AI_RESPONSE');
  await assert.rejects(AI.complete({kind:'summary',text:'字幕'},config(),{hasPermission:async()=>true,fetchImpl:async()=>new Response('{}',{headers:{'content-length':3000000}})}),e=>e.code==='AI_RESPONSE_TOO_LARGE');
});
test('内容脚本没有读取用户凭据，页面消息只有打开和视频变化',()=>{
  const s=fs.readFileSync(path.join(__dirname,'../content.js'),'utf8');assert.doesNotMatch(s,/document\.cookie|chrome\.cookies|localStorage|sessionStorage/);
  assert.ok(s.includes('readVideo'));assert.ok(s.includes('seekTo'));
});
test('不可信页面调用后台被拒绝；弹窗正确从用户点击打开',async()=>{
  const handlers=[];let calls=0;
  const api={...chromeApi,storage:{local:{setAccessLevel:async()=>{},get:async()=>{calls++;return{};}}},runtime:{...chromeApi.runtime,onMessage:{addListener:h=>handlers.push(h)}},action:{onClicked:{addListener:()=>{}}},sidePanel:{setOptions:async()=>{},open:async()=>{}}};
  const sandbox={chrome:api,BD_CORE:require('../core.js'),BD_SOURCE:require('../source.js'),BD_RUNTIME:R,BD_AI:AI,YTD_SETTINGS:settings,importScripts:()=>{},console,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),sandbox);
  let result;handlers[0]({action:'getSettings'},{id:'test',url:'https://www.bilibili.com/video/BV13x41117TL/'},v=>{result=v;});
  assert.equal(result.code,'UNTRUSTED_SENDER');assert.equal(calls,0);
});
test('缓存写入失败不能丢弃已成功下载的字幕',async()=>{
  const handlers=[];
  const api={...chromeApi,storage:{local:{setAccessLevel:async()=>{},get:async()=>({}),set:async()=>{throw new Error('quota exceeded');}}},runtime:{...chromeApi.runtime,onMessage:{addListener:h=>handlers.push(h)}},action:{onClicked:{addListener:()=>{}}},sidePanel:{setOptions:async()=>{},open:async()=>{}}};
  const source={...require('../source.js'),loadSubtitle:async()=>[{start:1,end:2,text:'已取得字幕'}]};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),{chrome:api,BD_CORE:require('../core.js'),BD_SOURCE:source,BD_RUNTIME:R,BD_AI:AI,YTD_SETTINGS:settings,importScripts:()=>{},console,setTimeout,clearTimeout,TextEncoder});
  const result=await new Promise(resolve=>handlers[0]({action:'fetchSubtitle',video:{bvid:'BV13x41117TL',cid:20,page:2},track:{language:'zh-CN',url:'https://i0.hdslb.com/bfs/subtitle/test.json'}},panel,resolve));
  assert.equal(result.ok,true);assert.equal(result.segments[0].text,'已取得字幕');assert.equal(result.cacheWarning,true);
});
test('OpenAI 和 Anthropic 截断响应不能作为完整概览',async()=>{
  for(const [provider,data] of [['openai',{choices:[{finish_reason:'length',message:{content:'未完成'}}]}],['anthropic',{stop_reason:'max_tokens',content:[{type:'text',text:'未完成'}]}]]){
    await assert.rejects(AI.complete({kind:'summary',text:'字幕'},config(provider),{hasPermission:async()=>true,fetchImpl:async()=>new Response(JSON.stringify(data))}),e=>e.code==='AI_RESPONSE_TRUNCATED');
  }
});
