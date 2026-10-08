const test=require('node:test');
const assert=require('node:assert/strict');
const S=require('../source.js');
const url='https://www.bilibili.com/video/BV13x41117TL/?p=2';
function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});}
const meta={code:0,data:{bvid:'BV13x41117TL',aid:1,title:'课',pages:[{page:1,cid:10,part:'一'},{page:2,cid:20,part:'二'}]}};
test('网络按当前分 P 获取字幕；会话只由浏览器管理',async()=>{
  const calls=[];
  const result=await S.loadVideo(url,async(u,options)=>{calls.push({u,options});return response(calls.length===1?meta:{code:0,data:{subtitle:{subtitles:[{id:1,lan:'ai-zh',lan_doc:'中文',subtitle_url:'//aisubtitle.hdslb.com/bfs/ai_subtitle/test.json'}]}}});});
  assert.equal(result.video.cid,20);assert.ok(calls[1].u.includes('cid=20'));assert.equal(calls[1].options.credentials,'include');assert.equal(result.tracks[0].isAi,true);
});
test('需要登录与无字幕使用不同错误',async()=>{
  for(const [data,code] of [[{need_login_subtitle:true},'LOGIN_REQUIRED'],[{subtitle:{subtitles:[]}},'NO_SUBTITLE']]){
    let n=0;await assert.rejects(S.loadVideo(url,async()=>response(++n===1?meta:{code:0,data})),e=>e.code===code);
  }
});
test('HTTP、风控与网络失败不变成无字幕',async()=>{
  await assert.rejects(S.loadVideo(url,async()=>response({},403)),e=>e.code==='HTTP_ERROR');
  await assert.rejects(S.loadVideo(url,async()=>response({code:-352,message:'private service text'})),e=>e.code==='ACCESS_RESTRICTED'&&!e.message.includes('private'));
  await assert.rejects(S.loadVideo(url,async()=>{throw new Error('cookie=secret')}),e=>e.code==='NETWORK_ERROR'&&!e.message.includes('secret'));
});
test('字幕 CDN 仅允许准确 HTTPS hdslb 来源与字幕路径',()=>{
  assert.equal(S.subtitleUrl('//i0.hdslb.com/bfs/subtitle/x.json'),'https://i0.hdslb.com/bfs/subtitle/x.json');
  for(const u of ['https://i0.hdslb.com.evil.test/bfs/subtitle/x','http://i0.hdslb.com/bfs/subtitle/x','https://user:pass@i0.hdslb.com/bfs/subtitle/x','https://i0.hdslb.com/private','https://127.0.0.1/bfs/subtitle/x','https://i0.hdslb.com:444/bfs/subtitle/x']) assert.throws(()=>S.subtitleUrl(u));
});
test('下载字幕不带凭据、不跟随重定向，并限制体积',async()=>{
  let opts;
  assert.deepEqual(await S.loadSubtitle('https://i0.hdslb.com/bfs/subtitle/x.json',async(u,o)=>{opts=o;return response({body:[{from:1,to:2,content:'字幕'}]});}),[{start:1,end:2,text:'字幕'}]);
  assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');
  await assert.rejects(S.readJson(new Response('x',{headers:{'content-length':String(3*1024*1024)}})),e=>e.code==='RESPONSE_TOO_LARGE');
  await assert.rejects(S.loadSubtitle('https://i0.hdslb.com/bfs/subtitle/x',async()=>response({body:[]})),e=>e.code==='EMPTY_SUBTITLE');
});
