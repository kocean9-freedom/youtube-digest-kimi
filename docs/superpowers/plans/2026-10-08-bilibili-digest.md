# Bilibili Digest Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan in this session. 用户已授权完成、测试和推送；无需重复请求执行批准。

**Goal:** 交付独立的个人 B 站字幕学习扩展，并推送用户现有仓库。

**Architecture:** 在 bilibili-digest/ 隔离平台适配、网络解析、侧边栏和设置。复用现有协议适配器；浏览器管理 B 站会话，AI 只接收可信扩展页的主动请求。

**Tech Stack:** Chrome 116+ MV3、原生 HTML/CSS/JS、Node test、已缓存 Playwright。

**Spec:** docs/superpowers/specs/2026-10-08-bilibili-digest-design.md

## Global Constraints
- 不修改 YouTube 运行时代码；B 站目录可独立加载，无产品依赖安装。
- 原 Zara Zhang MIT 许可和两级二创来源保留；默认中文。
- 字幕无需 Key；AI 手动触发、单次尝试、准确来源权限、本地 trusted storage。
- 登录由浏览器管理，不读取/记录/导出凭据。仅现有字幕，不转录、不 OCR。
- 以 BV/cid 隔离缓存和笔记；旧请求不能覆盖新内容。

## Review Focus
- 快速换 P/换标签时迟到的字幕、AI 结果或笔记不得污染新视频。
- 被污染的页面消息或字幕 URL 不得触发任意 fetch、AI 付费调用或读取 Key。
- 空字幕和 need_login_subtitle 各自说明；网络失败不可吞为无字幕。
- 翻译缺少/重复 ID 或长度失控时拒绝错误对齐，保留原文。
- 导出与 UI 对 HTML/Markdown 特殊字符安全，SRT 使用毫秒而非整数秒。

### Task 1: 字幕核心和来源适配
**Files:** bilibili-digest/core.js、bilibili-digest/source.js、bilibili-digest/tests/core.test.js、bilibili-digest/tests/source.test.js。
**Interfaces:** parseVideoUrl(url) -> {bvid,page}; parseMetadata(data,page) -> video; normalizeSubtitle(body) -> segments; transcriptExport(video,segments,format) -> string; loadVideo(url,fetchImpl) -> {video,tracks}; loadSubtitle(url,fetchImpl) -> segments。
- [x] 先写并运行失败测试：精确域名、有效 BV/正整数 P、分 P 的 cid、乱序/非法时间段、SRT/Markdown/TXT、HTTPS CDN 白名单、登录/空字幕/HTTP/风控、网络超时及体积。
- [x] 实现平台无关核心与分离的元数据/字幕网络操作。
- [x] 运行 node --test bilibili-digest/tests/core.test.js bilibili-digest/tests/source.test.js，预期全部通过。

### Task 2: 后台、内容脚本和 AI
**Files:** bilibili-digest/background.js、content.js、ai-client.js、settings.js、ai-providers.js、manifest.json、tests/runtime.test.js。
**Interfaces:** 使用 Task 1 video/segments；扩展消息 action 获取当前内容、字幕、AI、笔记；AI completion(input, settings, deps) -> text。
- [x] 先写并运行失败测试：可信/不可信发送者、字幕 URL 限制、设置隔离、模型字段、权限撤销、错误脱敏、超时、响应体限制。
- [x] 复用协议适配器和非秘密配置；实现只在当前 B 站视频工作的内容脚本、中文打开按钮和当前时间/跳转。
- [x] 实现可信消息后台、缓存和笔记、按需 AI；缓存键是 BV/cid/语言。
- [x] 运行全部 B 站 Node 测试，预期通过。

### Task 3: 中文界面与完整流程
**Files:** bilibili-digest/sidepanel.html、sidepanel.css、sidepanel.js、options.html、options.js、tests/ui-smoke.cjs。
**Interfaces:** 消费 Task 2 消息；核心提供格式化和导出。设置页按提供商独立保存，权限必须从保存手势直接申请。
- [x] 创建 headless 浏览器测试，验证字幕无需 Key、检索、跳转、语言、复制/导出、选段笔记、AI 结果、换 P 时迟到请求、窄屏和设置；先运行确认缺文件失败。
- [x] 实现纸张式中文侧边栏；翻译 ID 严格对齐，摘要分块；每项异步操作保留 generation/token 检查。
- [x] 实现设置和密钥删除、测试连接、准确来源权限。
- [x] 运行 Node 与 headless UI 测试；保存截图核对布局。

### Task 4: 署名、打包与交付
**Files:** bilibili-digest/README.md、LICENSE、THIRD_PARTY_NOTICES.md、PRIVACY.md、scripts/check-release.mjs、scripts/package.mjs；根 README 两种语言和 package.json 仅增加 B 站入口。
- [x] 编写发布检查测试：manifest/HTML 本地引用完整、JS 语法正确、来源和 LICENSE 完整、ZIP 白名单排除缓存/测试/Key/记忆文件。
- [x] 实现文档、检查和打包，记录自动验证、匿名真实验证和真实账号/付费请求边界。
- [x] 运行 npm test、npm run check、npm run package，以及 test:bilibili、check:bilibili、package:bilibili 和 headless UI。
- [x] 按 executing-plans 的要求做一次独立整体验证审查，修复重要发现并回归。
- [ ] 按 git-push 提交、合并 main、推送已授权仓库；核对远端 SHA。

## 实施与审查记录

- Task 1/2：11 项核心来源测试和 8 项运行时测试先失败后通过。Task 3：headless UI 与真实 MV3 模拟接口测试通过，无前台切换或凭据访问。
- Task 4：许可原文与两级二创署名、21 文件白名单检查、独立 ZIP 已生成。
- 独立 code-reviewer 审查复现缓存配额及设置错误吞掉两项 Important，均已补失败回归后修复；24 项 Node 测试通过，错误提示 UI 回归通过。OpenAI/Anthropic 截断亦补齐。
- 缓存修订：字幕与结果各 2 MiB，结果指纹为 SHA-256，笔记 4 MiB / 1000 条；缓存写入失败仍显示和允许导出已取得的字幕。
- 记录的边界：已有笔记暂依赖当前分 P 字幕成功加载；独立离线笔记入口留待后续，不扩大首版范围。真实账号与付费模型未验证。
- 用户已明确授权完成、测试和推送；采用本会话实现与一次独立最终审查，无额外逐阶段审批。
