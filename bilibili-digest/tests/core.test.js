const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const video = { bvid: 'BV13x41117TL', cid: 20, page: 2, part: '第二课', title: '学习 <示例>', author: 'UP', url: 'https://www.bilibili.com/video/BV13x41117TL/?p=2', source: '中文（AI 字幕）' };
const segments = [{ start: 1.25, end: 2.75, text: 'Hello <script>' }, { start: 4, end: 5, text: '第二句' }];

test('只识别准确 B 站普通视频域名与有效分 P', () => {
  assert.deepEqual(C.parseVideoUrl(video.url), { bvid: video.bvid, page: 2 });
  for (const url of ['https://www.bilibili.com.evil.test/video/BV13x41117TL/', 'https://www.bilibili.com/bangumi/play/ep1', 'https://www.bilibili.com/video/BV13x41117TL/?p=2x', 'https://www.bilibili.com/video/BV13x41117TL/?p=0', 'http://www.bilibili.com/video/BV13x41117TL/', 'https://www.bilibili.com/video/BV13x41117TL/?p=1&p=2']) assert.equal(C.parseVideoUrl(url), null);
});
test('分 P 按 page 选择 cid，不能复用第一 P', () => {
  const meta = C.parseMetadata({ bvid: video.bvid, aid: 10, title: '视频', owner: { name: 'UP' }, pages: [{ page: 1, cid: 11, part: '一', duration: 50 }, { page: 2, cid: 20, part: '二', duration: 90 }] }, 2);
  assert.equal(meta.cid, 20); assert.equal(meta.duration, 90); assert.equal(meta.page, 2);
  assert.throws(() => C.parseMetadata({ bvid: video.bvid, pages: [{page:1,cid:11}] }, 3), /分 P/);
});
test('字幕保留毫秒、按时间排序且拒绝非法段', () => {
  assert.deepEqual(C.normalizeSubtitle([{ from: 4, to: 5, content: '二' }, { from: 1.25, to: 2.75, content: ' 一 ' }, { from: -1, to: 2, content: '坏' }, { from: 1, to: 0, content: '坏' }, { from: '1', to: 2, content: '坏' }]), [{start:1.25,end:2.75,text:'一'},{start:4,end:5,text:'二'}]);
});
test('Markdown/TXT 导出保留元信息、时间戳和来源；SRT 有毫秒', () => {
  const md=C.transcriptExport(video,segments,'md');
  for(const part of ['BV13x41117TL','20','第二课','AI 字幕','00:01','Hello']) assert.ok(md.includes(part));
  assert.ok(!md.includes('<script>')); assert.ok(md.includes('&lt;script&gt;'));
  assert.ok(C.transcriptExport(video,segments,'txt').includes('Hello <script>'));
  assert.match(C.transcriptExport(video,segments,'srt'), /00:00:01,250 --> 00:00:02,750/);
  assert.equal(C.timestampUrl(video,4), video.url+'&t=4');
});
test('批次覆盖全部字幕且翻译严格对齐 ID', () => {
  const chunks=C.chunkSegments(segments,100,1); assert.equal(chunks.length,2); assert.equal(chunks[1][0].id,1);
  assert.deepEqual(C.parseTranslation('```json\n[{"id":0,"text":"你好"}]\n```',[{id:0}]), [{id:0,text:'你好'}]);
  assert.throws(()=>C.parseTranslation('[{"id":1,"text":"错位"}]',[{id:0}]),/对齐/);
  assert.throws(()=>C.parseTranslation('[{"id":0,"text":"a"},{"id":0,"text":"b"}]',[{id:0},{id:1}]),/对齐/);
});
test('文件名和 Markdown 特殊字符不能产生路径或 HTML', () => {
  assert.ok(!/[\\/<>]/.test(C.filename('../a/<b>')));
  assert.equal(C.cacheKey(video,'zh-CN'),'bili:BV13x41117TL:20:zh-CN');
});
test('缓存按 UTF-8 字节预算淘汰旧项，单项过大也不能写满存储', () => {
  const items={old:{savedAt:1,text:'旧'.repeat(200)},new:{savedAt:2,text:'新'.repeat(100)}};
  const kept=C.boundedEntries(items,'savedAt',400);
  assert.deepEqual(Object.keys(kept),['new']);
  assert.deepEqual(C.boundedEntries({large:{savedAt:3,text:'x'.repeat(500)}},'savedAt',400),{});
});
