# Bilibili Digest · 字幕笔记

> **二创来源：** 本版本基于 [Zara Zhang 的 YouTube Digest](https://github.com/zarazhangrui/youtube-digest) 及本仓库的 [youtube-digest-kimi 衍生版本](https://github.com/kocean9-freedom/youtube-digest-kimi) 开发。保留原 MIT 版权与许可，并在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 说明复用范围。属于个人自用衍生作品，不代表原作者或 B 站的官方发布。

把 B 站视频字幕变成可以搜索、回看和交给 Codex 阅读的学习资料。Chrome 侧边栏提供原文字幕、按需翻译、AI 概览、片段讲解与时间戳笔记。

## 首版功能

- 提取普通 BV 视频**当前分 P**的可用字幕，包括站方提供的 AI 字幕；多语言字幕可选择。
- 字幕关键词搜索、点击时间戳跳转到播放器。
- 复制完整字幕，导出 **Markdown、TXT、SRT**；Markdown/TXT 包含标题、UP 主、链接、BV、cid、分 P 和字幕来源，SRT 保留毫秒。
- 原文、中文译文、双语显示；AI 翻译分批执行，完成的译文保留在本地，失败不覆盖原文。
- 手动生成 AI 概览，长字幕分段整理后合并；可点击概览时间戳回看。
- 选中字幕讲解或摘录，手写本地笔记，可选 AI 润色，导出当前分 P 的笔记。
- 分 P/视频切换清空旧内容，缓存与笔记按 BV/cid 分开保存。

**字幕提取、搜索、复制、导出与笔记无需 AI Key，也无需 Supadata。** AI 只在点击对应功能后调用。

## 安装

1. 下载或克隆 [本仓库](https://github.com/kocean9-freedom/youtube-digest-kimi)，放到长期保留的文件夹。
2. 在 Chrome 打开 `chrome://extensions`，开启“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择仓库内的 **`bilibili-digest` 文件夹**，其中包含此版本的 `manifest.json`。根目录是 YouTube 版，请不要选错。
4. 在 B 站自行登录，打开一个普通 `https://www.bilibili.com/video/BV.../` 视频。
5. 点击页面左下角的“字幕笔记”按钮，或 Chrome 扩展图标打开侧边栏。

需要 Chrome 116 或更高版本；本版本不自动打开设置页、不自动更新。源码更新后，在扩展管理页点击“重新加载”，再刷新已打开的 B 站视频页。

也可以解压独立的 `bilibili-digest-v0.1.0.zip`，加载解压后的文件夹。不要移动或删除正在使用的源码目录。

## 给 Codex 阅读

1. 获取字幕，选择原文显示，点击“导出”并选择 Markdown 或 TXT。
2. 把文件放到当前 Codex 项目的文件夹中，告诉 Codex 文件名和需要完成的分析。
3. 例如：“读取这份字幕，整理主要观点和实践步骤，指出可能的识别错误，并保留时间戳。”

“复制全文”也可直接用于粘贴。导出与复制覆盖**全部字幕**，不受当前搜索筛选限制。插件不会自动投递到 Codex，也不会控制 Codex 界面。字幕不包含视频画面；图表、代码操作等需要补充截图。

## 可选 AI 设置

侧边栏右上角齿轮打开模型设置。默认保留 Kimi Coding Plan / `kimi-for-coding`；也支持 OpenRouter、OpenAI、DeepSeek、Kimi 开放平台、Qwen、GLM、SiliconFlow、Anthropic、Gemini 和自定义 OpenAI 兼容接口。

- 每个提供商独立保存 Key，不与 YouTube 版共享；切换时未保存草稿会丢弃。
- OpenRouter 和其他可编辑模型采用**手动填写模型 ID**，以服务商当前文档为准。
- 保存和测试时只请求当前服务的准确来源权限；不会自动取得所有 HTTPS 网站访问权。
- 测试连接也可能消耗服务商额度；摘要、翻译和润色每批只尝试一次，不自动重试或切换提供商。
- 概览会显示预计请求次数；翻译过程中显示批次。停止只阻止后续批次，已经发送的请求仍可能计费。
- Kimi Coding Plan 主要面向编程工具，请自行核对最新会员权益与服务规则。

**请自行在设置页填写 Key，不要发送到聊天、截图、日志或源代码中。**

## 支持边界与异常

- 支持普通 BV 视频和当前分 P；不批量获取合集，不支持直播、番剧、互动视频、付费课程或其他特殊播放器。
- 依赖播放器可提供的字幕。部分字幕需要登录；匿名接口返回空列表不能证明视频没有字幕。请在视频页自行登录并确认播放器字幕菜单可用。
- 画面内嵌的硬字幕不能直接提取，没有字幕时不下载音视频、不做 OCR 或语音转录；弹幕不会充当字幕。
- B 站内部接口可能变动或限制访问；失败会明确提示登录、网络/请求问题或暂无字幕。即便接口返回成功，也可能没有字幕。
- 字幕缓存与模型结果各最多保留最近 12 项、各限制 2 MiB；字幕在 24 小时内复用，超大单项可能不缓存。缓存写入失败不会阻止阅读和导出。笔记单独长期保存，最多 1000 条 / 4 MiB，建议定期导出。
- 首版浏览已有笔记仍依赖当前分 P 的字幕成功加载；接口暂不可用时无法在面板恢复旧笔记。暂不提供离线笔记浏览入口，请提前导出。
- 更换字幕来源会清除当前来源的展示结果，避免语言错配；视频/分 P 切换会清空编辑中的笔记草稿，请先保存。
- 页面没有“字幕笔记”按钮或提示后台未连接：重新加载扩展并刷新视频页，再点 Chrome 扩展图标。

## 验证与开发

本项目无产品依赖、无构建步骤，直接加载此目录。

在仓库根目录执行：

```sh
npm run test:bilibili
npm run check:bilibili
npm run package:bilibili
```

输出为仓库根目录 `dist/bilibili-digest-v0.1.0.zip`。打包只包含显式白名单文件，不包含测试、缓存、记忆文档和任何账号配置。

可选界面/真实扩展运行时测试需要已有 Playwright 与 Chromium：

```sh
npm run test:bilibili:ui
npm run test:bilibili:extension
```

本机运行时不在默认路径时，可为本次命令设置 `NODE_PATH`；浏览器路径分别可通过 `BD_BROWSER_EXECUTABLE` / `BD_EXTENSION_BROWSER_EXECUTABLE` 指定。不要为这些测试使用自己的日常浏览器配置目录。

测试使用模拟字幕和隔离的无窗口浏览器，不访问真实账号或付费模型。匿名真实接口验证只能证明接口可达；**真实账号下的字幕可用性与真实付费服务尚须自行验证**。AI 字幕及模型生成内容可能有错误，应结合原视频核对。

## 数据和许可

详见 [PRIVACY.md](PRIVACY.md)、[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 与 [LICENSE](LICENSE)。MIT。
