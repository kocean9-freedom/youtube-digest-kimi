# YouTube Digest

[English](README.md) | [简体中文](README.zh-CN.md)

> **衍生项目说明：** 本仓库基于 Zara Zhang 的原项目 [zarazhangrui/youtube-digest](https://github.com/zarazhangrui/youtube-digest) 继续开发，保留原 MIT 版权与许可声明，不代表原作者发布的官方上游版本。

把每个 YouTube 视频变成一份可以深入学习的资料。YouTube Digest 把字幕、双语翻译、AI 概览、内容讲解和时间戳笔记放进同一个 Chrome 侧边栏，让你可以持续学习视频中的知识和语言，同时不丢失原视频上下文。

- 把零碎字幕变成清晰、可搜索的学习资料。
- 查看原文、简体中文翻译，或中英双语对照字幕来学习语言。
- 通过 AI 概览、章节、重点引用和选中文本讲解建立系统理解。
- 点击字幕、概览或笔记中的时间戳，快速跳转到对应位置。
- 保存自动润色的时间戳笔记，方便之后复习。
- 使用自己的 API Key，数据保存在本地 Chrome 中，不包含分析统计或行为追踪。

YouTube Digest 是一个需要自行提供 API Key 的开源项目，通过 GitHub 安装。目前没有上架 Chrome 应用商店，不赠送 API 额度，也没有开发者运营的服务器。

点击查看演示和教学视频（小白友好）：[https://www.bilibili.com/video/BV1dnuq6dEak/](https://www.bilibili.com/video/BV1dnuq6dEak/)

![YouTube Digest 双语演示](YouTube%20Digest%20demo%20bilingual.png)

## v1.3.2 更新

- 将 YouTube 内容脚本暂时未连接识别为可恢复的页面刷新状态，不再记为扩展错误。
- 侧边栏会直接提示刷新 YouTube 页面，临时连接到旧后台 Service Worker 时也能识别。
- 当新版设置页仍连接旧的后台 Service Worker 时，不再显示含糊的 `Unknown provider error`，而是明确提示重新加载扩展。
- 默认保留 Kimi Coding Plan 和固定的 `kimi-for-coding` 体验。
- 增加 OpenRouter 简易模式，可搜索已缓存的模型目录，也可手动输入模型 ID。
- 增加官方 / 自定义高级模式，支持 OpenAI 兼容、Anthropic Messages 和 Gemini generateContent。
- 每个提供商的 API Key 和设置都在 Chrome 本地分开保存。
- Chrome 只会在你选择非默认提供商时，请求该提供商的准确来源权限。

## 让你的编程 Agent 帮你安装

你不需要看懂代码，也不需要会使用命令行。把下面这段话发送给你的编程 Agent：

> 请把这个项目下载或克隆到我选择的长期保留文件夹，告诉我准确的完整路径，并让 Chrome“加载已解压的扩展程序”使用同一个文件夹。如果我在第一次安装时需要位置建议，可以推荐 macOS 或 Linux 上的 `~/Documents/youtube-digest`，或 Windows 上的 `%USERPROFILE%\Documents\youtube-digest`，但不要假设我一定使用这些路径。请用简单易懂的语言一步一步指导我完成安装和配置。https://github.com/kocean9-freedom/youtube-digest-kimi

你的 Agent 应该帮你：

1. 先询问你想把项目长期保存在哪里，再下载或克隆到那里，并告诉你准确的完整路径。如果你需要建议，可以推荐 macOS 或 Linux 上的 `~/Documents/youtube-digest`，或 Windows 上的 `%USERPROFILE%\Documents\youtube-digest`。
2. 打开下方 Supadata 和你选择的 AI 提供商官方页面，指导你创建自己的账号。
3. 指导你在 Chrome 中通过“加载已解压的扩展程序”选择你刚才确定的那个准确项目文件夹。
4. 告诉你应该在扩展的“设置”页面哪个位置填写 API Key。
5. 打开一个带字幕的 YouTube 视频，确认字幕和翻译功能可以使用。

安装后请让这个文件夹留在原位。如果移动或删除它，Chrome 中加载的本地扩展会失效，需要从新的长期存放位置重新加载。

不要把 API Key 发送到 AI 对话、源代码、截图或公开消息中。请你自己在 YouTube Digest 的设置页面直接填写。编程 Agent 可以告诉你填写位置，但不需要看到 Key。

## 手动安装

如果你想自己操作：

1. 打开 [github.com/kocean9-freedom/youtube-digest-kimi](https://github.com/kocean9-freedom/youtube-digest-kimi)。
2. 点击 **Code**，再选择 **Download ZIP**。
3. 选择一个长期保留的文件夹，并把项目解压到这里。可选建议是 macOS 或 Linux 上的 `~/Documents/youtube-digest`，或 Windows 上的 `%USERPROFILE%\Documents\youtube-digest`。你也可以使用其他文件夹。
4. 在 Chrome 地址栏打开 `chrome://extensions`。
5. 打开右上角的“开发者模式”。
6. 点击“加载已解压的扩展程序”。
7. 选择你刚才确定的那个准确项目文件夹，其中必须包含 `manifest.json`。
8. 如果需要，可以在 Chrome 扩展菜单中固定 YouTube Digest。

这是一个本地加载的扩展，不会自动更新。下载新版或让 Agent 修改代码后，请在 `chrome://extensions` 中找到 YouTube Digest 并点击“重新加载”，然后刷新已经打开的 YouTube 页面。如果移动或删除源代码文件夹，Chrome 中加载的扩展会失效，需要从新的位置重新加载。

## 设置 API Key

YouTube Digest 需要你在自己的服务账号中准备两个 Key：

1. **Supadata API Key**，用于获取 YouTube 字幕。
2. 一个 **AI 提供商 API Key**，用于生成概览、讲解内容、翻译和自动润色笔记。Kimi Coding Plan 仍是默认选项。

### 获取 Supadata API Key

1. 打开 Supadata 官方[注册页面](https://dash.supadata.ai/auth/sign-up)。
2. 创建账号并完成简短的新手引导。
3. Supadata 会在新手引导过程中自动生成 API Key。
4. 之后可以随时打开 [Supadata 控制台](https://dash.supadata.ai/)查找或管理 Key。
5. 复制 Key，并粘贴到 YouTube Digest 设置中的 **Supadata API key**。

如果页面流程发生变化，请查看 [Supadata 官方文档](https://docs.supadata.ai/)。

### 获取 Kimi Code API Key

1. 打开官方 [Kimi Code 控制台](https://www.kimi.com/code/console)。
2. 使用已开通 Kimi Coding Plan 会员的 Kimi 账号登录。
3. 创建 API Key，并填写容易识别的名称，例如 `YouTube Digest`。
4. 立即复制 Key。完整 Key 只会显示一次。
5. 把 Key 粘贴到 YouTube Digest 设置中的 **Kimi Code API key**。

当前会员、模型和接口说明请查看 [Kimi Code 官方文档](https://www.kimi.com/code/docs/)。

在侧边栏中打开 **Settings**。你也可以在 `chrome://extensions` 的 YouTube Digest 卡片中打开扩展选项。Key 只能粘贴到这些设置输入框中。不要把 Key 发送到 AI 对话、项目文件、截图或公开消息中。

### 选择 AI 模式

设置页提供三种相互独立的模式：

- **Kimi Coding Plan**，默认模式。它使用以下固定配置：

```text
Base URL: https://api.kimi.com/coding/v1
Endpoint: https://api.kimi.com/coding/v1/chat/completions
Model: kimi-for-coding
```

- **OpenRouter 简易模式**。填入 OpenRouter Key 后，可搜索模型目录或手动输入准确的模型 ID。模型列表会在本地缓存 24 小时。OpenRouter 可能把内容路由到你选择模型的托管方。
- **官方 / 自定义高级模式**。可选 OpenAI、DeepSeek、Kimi 开放平台、Qwen、GLM、SiliconFlow、Anthropic、Gemini 或自定义 OpenAI 兼容接口。模型会变动，请以服务商当前文档中的准确模型 ID 为准。Qwen 和自定义接口可编辑 Base URL。

Kimi K2.7 Code 使用 **Thinking ON**。YouTube Digest 不会向 Kimi 发送关闭思考的字段。Anthropic 和 Gemini 使用各自的请求格式；DeepSeek 专用行为与其他提供商隔离。每个 AI 请求或翻译批次只尝试一次，不会自动重试或切换提供商。完整字幕翻译可能分成多个批次，因此可能产生多次付费请求。

保存或测试非默认提供商时，Chrome 会请求该提供商的准确来源权限。Manifest 声明较广的可选 HTTPS 能力只是为了允许自定义端点；扩展不会自动获得所有网站权限。自定义端点必须使用 HTTPS，本地开发的 `http://localhost` 和 `http://127.0.0.1` 除外。

Kimi Coding Plan 主要面向编程工具。这个个人改造版使用它的 OpenAI 兼容接口实现视频学习功能，使用前请确认当前 Kimi 条款和会员规则允许这种用法。

API Key 和设置保存在你设备上的 Chrome 扩展本地存储中。发布包不会包含或使用 `config.js`。

## 使用 YouTube Digest

1. 打开一个有字幕的普通 YouTube 视频页面。
2. 点击 YouTube Digest 扩展图标，打开侧边栏。
3. 阅读带时间戳的字幕，或选择 **Original**、**中文**、**双语**。
4. 打开 **Overview**，查看 AI 生成的章节和重点引用。
5. 选中字幕，获取 AI 内容讲解。
6. 从播放器或重点引用中保存笔记，之后可以在 **Notes** 中查看。

## 当前支持范围

- Chrome 116 或更高版本。
- 标准的 `youtube.com/watch` 视频页面。
- Supadata 能够返回的原生字幕。YouTube Digest 会优先请求英文字幕，也可能显示其他可用的原生语言。
- 原文、简体中文和双语对照字幕。
- AI 概览、选中文本讲解、翻译和自动润色笔记。
- 本地笔记，以及最近字幕、概览和翻译的本地缓存。
- 默认使用 Kimi Coding Plan，同时支持 OpenRouter 简易模式，以及基于 OpenAI 兼容、Anthropic Messages 或 Gemini generateContent 协议的官方和自定义高级提供商。

Shorts、直播、私密视频、受访问限制的视频，以及没有原生字幕的视频可能无法使用。目前没有测试 Firefox、Safari、移动浏览器或其他 Chromium 浏览器。

YouTube Digest 强制使用 Supadata 的 `mode=native`，不会在没有原生字幕时请求 AI 生成转录，也不会在本地转录音频。

## Supadata 免费额度和请求成本

截至 2026 年 8 月 9 日，[Supadata 价格页面](https://supadata.ai/pricing)显示免费版每月提供 **100 credits**，不需要信用卡，未使用的额度不会结转。价格可能变化，使用前请查看最新页面。

[Supadata 字幕接口文档](https://docs.supadata.ai/get-transcript)说明了不同模式的计费方式：

- 获取一次原生字幕消耗 **1 credit**，与视频时长无关。
- AI 生成字幕每分钟消耗 **2 credits**。YouTube Digest 不会使用这条路径，因为它强制使用 `mode=native`。
- 如果没有可用原生字幕并返回 HTTP `206`，仍会消耗 **1 credit**。

按照当前只获取原生字幕的方式，如果每次请求都成功，免费版每月大约可以查询 100 个视频。重试和没有字幕的查询也会消耗额度，所以实际成功数量可能更少。

Kimi Coding Plan 的额度与 Supadata 分开计算。YouTube Digest 不收款，也不转售 API 服务。Kimi Code 请求会消耗你的会员额度，请定期查看两个服务账号，并通过 [Kimi Code 官方文档](https://www.kimi.com/code/docs/) 确认当前的可用性和限制。

## 用编程 Agent 改造成自己的版本

这是一个个人 Remix 项目，不接受上游 Issue 或 Pull Request。如果功能出错，或者你想增加新功能，请下载或 Fork 自己的副本，再让你的编程 Agent 帮你修复、改造和个性化。

YouTube Digest 使用原生 HTML、CSS 和 JavaScript，没有构建步骤，很适合用编程 Agent 做个人项目。你可以尝试：

- 增加更多翻译语言，并让每个人选择自己的学习语言。
- 为课程、访谈、教程、测评或研究视频增加自定义总结模板。
- 增加生词本，保存单词、原句、解释和视频时间戳。
- 把笔记和生词导出到 Markdown、CSV、Anki 或其他学习工具。
- 增加个人主题筛选，只突出与你目标相关的章节。
- 增加本地模型选项，获得不同的隐私和成本方案。
- 改善键盘操作、字体大小和高对比度等无障碍体验。

请让 Agent 保留用户自带 API Key 的模式，不要把秘密写入源代码，并运行下方检查。分享自己的版本前，也要在真实视频上测试。

## 隐私和数据流向

YouTube Digest 会直接从扩展向服务商发送请求：

1. 把标准化的 YouTube 视频地址发送给 Supadata，用于获取原生字幕。
2. 当你使用 AI 功能时，把字幕和相关视频信息发送给你当前选择的 AI 提供商。
3. 翻译或讲解等功能只发送当前需要的内容，例如选中的文本和上下文，或少量字幕分段。
4. API Key、设置、笔记和最近缓存保存在 Chrome 本地。

YouTube Digest 没有账号系统、广告、分析统计或行为追踪。Supadata、你选择的 AI 提供商，以及选中 OpenRouter 时的 OpenRouter，仍会按照各自的条款和隐私政策处理数据。详情请查看 [PRIVACY.md](PRIVACY.md)。

## 常见问题

### YouTube 视频页面没有显示 Digest 按钮

- 在 `chrome://extensions` 中找到 YouTube Digest，点击“重新加载”，然后刷新 YouTube 页面。
- 确认当前页面是标准 `https://www.youtube.com/watch?...` 页面，而不是 Shorts、嵌入页面或直播页面。
- 当前版本会在 YouTube 响应式操作栏变化时自动重新定位按钮。页面加载完成后可以稍等片刻。
- 如果你使用的是较早下载的版本，可以先横向调整一次 YouTube 窗口宽度让按钮出现，然后下载最新版，这样之后不再需要调整窗口。
- 如果按钮仍然没有出现，让你的编程 Agent 在这个具体视频页面检查 content script。

### 侧边栏无法打开

- 确认你打开的是标准 `https://www.youtube.com/watch?...` 页面。
- 在 `chrome://extensions` 中确认 YouTube Digest 已启用，并点击“重新加载”。
- 重新加载扩展后，刷新 YouTube 页面。
- 如果 Chrome 仍显示 `Receiving end does not exist`，先清除旧错误记录，再刷新 YouTube 页面并重试。问题已消失后，历史错误仍可能留在列表中。
- 如果问题仍然存在，让你的编程 Agent 检查扩展。

### YouTube Digest 提示需要设置

- 打开 **Settings**，保存 Supadata Key，选择 AI 模式，并填写该提供商的 Key。
- 打开视频前先点击 **Test connection**。Chrome 可能会先请求当前提供商的主机权限。
- 每个提供商的 Key 独立保存，切换时不会把一个提供商的 Key 复制到另一个配置中。

### 找不到字幕

- 确认视频是公开的，并且有原生字幕。
- 检查 Supadata Key、剩余额度、限速和账号状态。
- 没有字幕的查询和手动重试也可能消耗额度。

YouTube Digest 不会自动改用 AI 生成字幕。

### AI 请求失败

- 如果点击 **Test connection** 后提示扩展后台没有响应，请打开 `chrome://extensions`，在 YouTube Digest 卡片上点击“重新加载”，重新打开设置页后再测试。每次修改本地源码后都需要这样重新加载。
- `401` 或 `403` 通常表示当前提供商的 Key 或账号权限有问题。
- `429` 通常表示达到了当前提供商的限速或额度上限。
- 确认模型 ID、可编辑时的 Base URL，以及设置页显示的 Chrome 权限。
- 使用 OpenRouter 时，请确认所选模型对你的账号和路由偏好可用。

不要在对话、截图或日志中分享 API Key、私密字幕或个人笔记。

## 给编程 Agent 的检查命令

修改项目后，让你的编程 Agent 运行：

```bash
npm test
npm run check
npm run package
```

Agent 还应该在 Chrome 中重新加载扩展，并测试多个真实 YouTube 视频。自动检查通过，不代表真实服务请求和 YouTube 交互一定正常。

## 开源许可

本仓库基于原项目衍生：Zara Zhang 的 [zarazhangrui/youtube-digest](https://github.com/zarazhangrui/youtube-digest)。本仓库保留原 MIT 版权和许可声明。多提供商改动是 MIT 许可下正常的衍生创作，不代表原作者发布的官方上游版本。

MIT，详见 [LICENSE](LICENSE)。
