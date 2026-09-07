# YouTube Digest 多模型 AI 接入设计

日期：2026-09-08  
状态：待用户最终审阅  
目标版本：1.3.0

## 1. 背景与目标

YouTube Digest 当前固定使用 Kimi Coding Plan 的 `kimi-for-coding`。本次改造要在继续保留 Kimi 默认体验的同时，为用户提供两种扩展路径：通过 OpenRouter 快速尝试大量模型，以及通过官方或自定义接口直接连接模型厂商。

目标如下：

- Kimi Coding Plan 保持默认模式，用户只需填写自己的 Kimi Code API Key。
- 增加 OpenRouter 简易模式，通过一个 OpenRouter Key 选择其模型目录中的模型。
- 增加官方/自定义高级模式，支持 OpenAI 兼容协议、Anthropic Messages API 和 Gemini `generateContent`。
- 所有 Key 均由用户自行填写并保存在 `chrome.storage.local`，不进入源码、日志、提交、截图或发布包。
- 各提供商的请求格式、鉴权、响应解析和特殊规则相互隔离。
- 只向用户主动选择的服务发送内容；不自动切换模型、提供商或路由。
- 使用最小 Chrome 主机权限：Kimi 和 Supadata 保留安装时权限，其他服务在用户保存配置时按具体来源请求可选权限。

## 2. 非目标

1.3.0 不包含以下功能：

- 流式输出；
- 图片、音频或其他多模态输入；
- Tool Calling、Agent 或外部工具执行；
- 自动选择最便宜、最快或备用模型；
- 跨设备同步 API Key；
- 提供商费用或余额展示；
- 任意自定义请求头、用户脚本或请求体模板；
- 大量提供商专属高级参数。

这些限制用于控制首个多提供商版本的安全面、测试范围和维护成本。

## 3. 用户体验

设置页 AI 区域顶部显示三个互斥的模式卡片：

1. **Kimi Coding Plan（默认）**
   - 固定 Base URL：`https://api.kimi.com/coding/v1`
   - 固定模型：`kimi-for-coding`
   - 用户只填写 Kimi Code API Key。
   - 保持 K2.7 Code 默认 Thinking ON，不发送关闭思考的字段。

2. **OpenRouter 简易模式**
   - 固定 Base URL：`https://openrouter.ai/api/v1`
   - 用户填写 OpenRouter API Key。
   - 设置页从官方 `/api/v1/models` 获取可搜索模型目录。
   - 模型目录缓存 24 小时，可手动刷新；目录失败时允许直接填写模型 ID。
   - 请求始终使用用户选定的准确模型 ID，不启用应用级自动回退。

3. **官方/自定义高级模式**
   - 首批预设：OpenAI、DeepSeek、Kimi Open Platform、通义千问、智谱 GLM、SiliconFlow、Anthropic Claude、Google Gemini。
   - 提供 `OpenAI Compatible` 自定义项，用户填写 HTTPS Base URL 和模型 ID。
   - 本地开发接口允许 `http://localhost` 与 `http://127.0.0.1`。
   - 各官方预设显示协议、接口地址、模型 ID 输入框和官方文档链接，不长期硬编码容易过时的完整模型清单。

保存配置和测试连接分开：

- “保存”执行字段校验、请求所需主机权限并保存本地设置，不发送模型请求。
- “测试连接”明确提示会产生一次极小的 API 调用，然后发送要求返回 `OK` 的最小请求。
- 删除/重置按钮可以删除当前提供商 Key，也可以在二次确认后删除所有 AI Key。
- Key 输入默认遮罩；切换模式不会显示、复制或删除其他提供商的 Key。

## 4. 配置模型与迁移

配置由当前单组平铺 AI 字段升级为版本化的提供商配置。建议的逻辑结构如下：

```js
{
  aiConfigVersion: 2,
  activeProvider: "kimi-code",
  providers: {
    "kimi-code": { apiKey: "..." },
    openrouter: { apiKey: "...", model: "...", modelsCachedAt: 0 },
    openai: { apiKey: "...", model: "..." },
    anthropic: { apiKey: "...", model: "..." },
    gemini: { apiKey: "...", model: "..." },
    custom: { apiKey: "...", baseUrl: "...", model: "..." }
  }
}
```

实际持久化字段可以为了兼容现有实现而拆分，但必须满足以下不变量：

- 每个提供商拥有独立 Key；切换提供商不会把一个 Key 用到另一个域名。
- 当前 Kimi 版本的 `aiApiKey` 在首次加载时迁移到 `kimi-code` 配置，迁移幂等且不丢失 Supadata Key。
- 已经被旧版清除的 DeepSeek Key不会恢复或猜测。
- 配置返回给 side panel 时只返回 `hasAiKey`、活动提供商名称和必要的非秘密状态，不把 Key 暴露给内容脚本或页面。
- OpenRouter 模型缓存不含凭据，可与 Key 分开清理。

## 5. 提供商注册表

新增一个集中注册表，保存非秘密的提供商元数据：

- 稳定 ID、显示名称和所属模式；
- 协议类型；
- 默认 Base URL 或完整 endpoint；
- 固定模型或用户可编辑模型；
- 官方文档和创建 Key 的链接；
- 所需主机来源；
- 是否允许自定义 Base URL。

注册表不保存 API Key，也不混入提供商请求实现。设置页、后台请求和权限逻辑都通过同一注册表识别提供商，避免三处分别维护地址和名称。

## 6. 统一调用接口

现有 AI 功能继续通过一个统一函数调用模型：

```js
complete({
  system,
  messages,
  maxTokens,
  temperature,
  outputIntent
}) => { text, model, usage? }
```

`background.js` 仍负责扩展消息路由、字幕处理和产品逻辑；协议转换放入独立适配器。建议新增：

- `providers/registry.js`
- `providers/openai-compatible.js`
- `providers/anthropic.js`
- `providers/gemini.js`
- `providers/errors.js`

若当前无构建步骤使多文件共享不便，可以使用普通脚本按依赖顺序加载，或将适配器保持为可测试的独立全局模块；不为此引入打包器或前端框架。

### 6.1 OpenAI Compatible

适用于 Kimi、OpenRouter、OpenAI、DeepSeek、通义千问、智谱 GLM、SiliconFlow 和自定义兼容接口。

- 请求使用 Bearer 鉴权和 `application/json`。
- 标准请求包含 `model`、`messages`、`max_tokens`；仅在该提供商允许时发送可选参数。
- 解析 `choices[0].message.content`，并兼容内容为文本块数组的安全归一化。
- Kimi 不发送关闭 Thinking 的字段。
- DeepSeek 专属字段或未来重试策略只能在 DeepSeek 提供商规则内加入。
- OpenRouter 可加入官方允许的应用标识头，但不得包含用户身份或秘密；首版可以不发送这些可选头。

### 6.2 Anthropic Messages

- 使用 `/v1/messages`、`x-api-key`、`anthropic-version` 和 JSON Content-Type。
- `system` 与 `messages` 按 Anthropic 协议分开构造。
- 输出只拼接响应中的文本内容块，忽略不支持的块类型。
- 首版不默认发送 `temperature`，避免模型兼容性变化影响所有 Claude 请求。
- Anthropic 的错误、版本头和模型规则不会进入其他适配器。

### 6.3 Gemini generateContent

- 使用 `models/{model}:generateContent`。
- Key 放入 `x-goog-api-key` 请求头。
- `system` 转为 `systemInstruction`，消息转为 `contents`，生成限制转为 `generationConfig`。
- 输出从 `candidates[].content.parts[]` 中提取文本。
- 安全拦截、无候选结果和截断状态转换成清晰的 Gemini 错误。

## 7. URL 与权限安全

`manifest.json`：

- `host_permissions` 保留 YouTube、Supadata 和默认 Kimi 所需来源。
- 其他 AI 服务放入 `optional_host_permissions`。
- 为支持任意用户自定义 HTTPS 来源，需要声明可选的 `https://*/*` 能力，但扩展只在用户保存配置的点击事件中，使用 `chrome.permissions.request()` 请求规范化后的准确来源。
- 本地接口只允许可选的 `http://localhost/*` 和 `http://127.0.0.1/*`。

自定义 URL 校验规则：

- 默认只允许 `https:`；仅上述两个本地主机允许 `http:`。
- 拒绝 URL 中的用户名、密码和片段。
- 规范化末尾斜杠，明确把输入解释为 Base URL，再由协议适配器拼接 endpoint。
- 保存前展示实际将要访问的来源。
- 切换配置不会自动撤销旧来源权限，以免破坏另一份已保存配置；设置页提供权限说明，重置所有设置时尝试移除不再需要的可选权限。

Chrome 只把活动提供商的权限状态返回给 UI，不把凭据发送给内容脚本。

## 8. 请求生命周期与错误

继续保留现有响应大小上限、空闲超时和总时长上限，并由统一请求层应用。首版不自动重试付费 AI 请求，避免重复收费或重复处理私密内容；用户可在界面主动重试。

错误统一为包含 `code`、`provider` 和安全用户消息的结构，至少覆盖：

- 缺少 API Key；
- 缺少主机权限；
- Base URL 或模型 ID 无效；
- `401/403` 鉴权失败；
- `429` 限流或额度不足；
- 网络、空闲或总时长超时；
- 响应超过限制；
- 空响应或响应结构错误；
- Gemini 安全拦截；
- 提供商返回的其他非成功状态。

界面错误必须包含当前选择的提供商名称，不能把一个服务的帮助文案显示给另一个服务。服务端错误正文作为不可信数据处理，不插入 HTML，也不写入日志。

## 9. 隐私、署名与文档

- README 和 README.zh-CN 顶部增加醒目的衍生项目说明：本项目基于 Zara Zhang 的 YouTube Digest 修改，保留 MIT License，并链接原仓库。
- 保留 `LICENSE` 中原作者的版权声明，不把继承代码宣称为完全原创。
- GitHub 安装、下载、反馈链接指向当前维护仓库；原仓库链接保留在署名位置。
- PRIVACY 说明字幕、选中文本和笔记只会发送给用户当前选择的 AI 服务；OpenRouter 可能根据用户选择的模型继续路由给对应模型提供商，用户应阅读其政策。
- SECURITY 说明本地 Key 的风险、可选主机权限、自定义 endpoint 风险、最小权限和秘密泄露处理方法。
- 所有文档强调扩展不提供 API 额度、不代理收费、不运营中转服务器。

## 10. 测试策略

采用测试先行，新增或更新以下覆盖：

1. **设置与迁移**
   - 当前 Kimi 平铺配置迁移到版本 2 且幂等。
   - Supadata Key 不受影响。
   - 提供商 Key 相互隔离，切换不删除或误用 Key。
   - 重置当前 Key与重置所有 AI Key行为正确。

2. **注册表与 URL**
   - 每个预设的协议、endpoint 和主机来源正确。
   - HTTPS、自定义路径、localhost 例外和非法 URL 校验。
   - endpoint 拼接不会重复路径或把凭据带入 URL。

3. **协议契约**
   - OpenAI Compatible、Anthropic 和 Gemini 的请求快照与响应解析。
   - Kimi 不含关闭 Thinking 字段。
   - DeepSeek 专属字段不出现在其他提供商请求中。
   - Provider-specific 错误映射互不污染。

4. **权限与 OpenRouter**
   - Kimi 使用现有必需权限。
   - 其他服务保存时只请求准确来源。
   - 权限拒绝不会保存为可用配置。
   - OpenRouter 模型获取、搜索、24 小时缓存、刷新和手动 ID 回退。

5. **UI、文档与发布**
   - 三种模式及中英文文案完整。
   - Key 不出现在 DOM 文本、日志、源码扫描或发布 ZIP 中。
   - 署名、隐私、安全和仓库链接符合约定。
   - Manifest 版本为 1.3.0，权限和发布白名单正确。

最终必须运行：

```bash
npm test
npm run check
npm run package
```

自动测试通过后，还需重新加载未打包扩展，在真实 YouTube 视频上分别验证 Kimi、OpenRouter，以及至少一个高级模式协议。真实测试的 Key 仍由用户自己输入，测试结果不得截图或记录 Key。

## 11. 验收标准

- 新安装默认选中 Kimi Coding Plan，现有 Kimi 用户升级后无需重新填写 Key。
- OpenRouter 能加载或手动输入模型，并完成摘要/翻译等现有 AI 功能。
- OpenAI Compatible、Anthropic 和 Gemini 各自能构造正确请求并解析文本响应。
- 任意提供商都无法读取或使用另一提供商的 Key。
- 非 Kimi 服务只在用户操作后请求准确的可选主机权限。
- 不存在自动跨提供商回退或隐藏重试。
- README、README.zh-CN、PRIVACY、SECURITY 和测试与实际行为一致。
- `npm test`、`npm run check`、`npm run package` 全部通过，并生成不含秘密的 1.3.0 ZIP。

## 12. 参考资料

- [Kimi Coding Plan API](https://www.kimi.com/code/docs/)
- [OpenRouter Quickstart](https://openrouter.ai/docs/quickstart)
- [OpenRouter Models API](https://openrouter.ai/docs/api/api-reference/models/get-models)
- [Chrome optional permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [Chrome extension privacy guidance](https://developer.chrome.com/docs/extensions/develop/security-privacy/user-privacy)
- [Gemini generateContent API](https://ai.google.dev/api/generate-content)
- [Anthropic model deprecations](https://docs.anthropic.com/en/docs/about-claude/model-deprecations)

