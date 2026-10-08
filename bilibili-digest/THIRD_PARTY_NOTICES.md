# 二创来源与第三方说明

## 原始项目

- 原作者：**Zara Zhang**。
- 原项目：[YouTube Digest — zarazhangrui/youtube-digest](https://github.com/zarazhangrui/youtube-digest)。
- 原始许可：MIT，Copyright (c) 2026 Zara Zhang。本目录 [LICENSE](LICENSE) 保留原文，发布包也包含该许可。

## 中间衍生项目与本版本

- 本仓库：[kocean9-freedom/youtube-digest-kimi](https://github.com/kocean9-freedom/youtube-digest-kimi)。
- YouTube 版在原项目基础上加入 Kimi Coding Plan、多提供商协议接入及相关改进。
- **Bilibili Digest** 是同一仓库中供个人使用的进一步衍生版本，位于 `bilibili-digest/`。复用了 YouTube 版的 `settings.js` 非秘密配置逻辑和 `ai-providers.js` 协议适配器，并延续字幕学习、概览和笔记的产品思路；新增 B 站字幕来源、分 P 识别、独立后台、中文界面和导出流程。
- 本版本继续采用 MIT。不是 Zara Zhang 的官方发布，也不是 Bilibili、Chrome、OpenAI、Kimi 或其他模型服务商的官方产品；原作者不承担本版本的支持责任。

## 接口实现参考

- 字幕接口行为参考 [yt-dlp 的 B 站提取器](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/bilibili.py)，核对 `x/player/wbi/v2`、`need_login_subtitle` 和字幕 `from/to/content` 格式。本版本未复制或捆绑 yt-dlp 代码，也不依赖 yt-dlp。
- 扩展 API 参考 [Chrome 官方侧边栏文档](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)。
- 图标为本版本自行绘制。产品没有捆绑字体、第三方前端库或远程脚本；测试工具不进入安装包。
