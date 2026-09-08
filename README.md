# YouTube Digest

[English](README.md) | [简体中文](README.zh-CN.md)

> **Derivative project:** This repository builds on Zara Zhang's original [zarazhangrui/youtube-digest](https://github.com/zarazhangrui/youtube-digest), retains its MIT copyright and license notice, and is not an official upstream release.

Turn every YouTube video into a resource for deep learning. YouTube Digest brings transcripts, bilingual translation, AI overviews, explanations, and timestamped notes into one Chrome side panel, so you can study ideas and language without losing your place.

- Turn captions into a readable, searchable learning resource.
- Learn languages with the original transcript, a Simplified Chinese translation, or an aligned bilingual view.
- Build understanding with an AI overview, chapters, key quotes, and selected-text explanations.
- Navigate long videos by clicking timestamps in the transcript, overview, or notes.
- Save polished timestamped notes for later study.
- Keep control of your data with your own API keys, local Chrome storage, and no analytics or telemetry.

YouTube Digest is a bring-your-own-key project installed locally from GitHub. It is not available through the Chrome Web Store, does not include API credits, and does not run a developer-operated server.

![YouTube Digest demo](YouTube%20Digest%20demo.png)

## New in v1.3.1

- Replace the ambiguous `Unknown provider error` with a clear reload instruction when an updated Options page is still connected to an older background service worker.
- Keep Kimi Coding Plan as the default, fixed `kimi-for-coding` experience.
- Use OpenRouter simple mode to search a cached model directory or enter a model ID manually.
- Use official / custom advanced mode for OpenAI-compatible services, Anthropic Messages, and Gemini generateContent.
- Keep each provider's API key and settings isolated in local Chrome storage.
- Grant only the selected provider's exact origin when Chrome asks for optional host access.

## Install with your coding agent

You do not need to understand the code or use the command line. Send this message to your coding agent:

> Download or clone this project into a permanent folder I choose, tell me its exact full path, and use that same folder for Chrome's Load unpacked step. If I need a suggestion during this first installation, offer `~/Documents/youtube-digest` on macOS or Linux, or `%USERPROFILE%\Documents\youtube-digest` on Windows, but do not assume either path. Walk me through installation and setup in simple terms. https://github.com/kocean9-freedom/youtube-digest-kimi

Your agent should:

1. Ask where you want to keep the project, download or clone it there, and tell you the exact full path. If you want a suggestion, it can offer `~/Documents/youtube-digest` on macOS or Linux, or `%USERPROFILE%\Documents\youtube-digest` on Windows.
2. Open the official Supadata page and the page for the AI provider you choose, then help you create your own accounts.
3. Walk you through selecting the exact project folder you chose in Chrome with **Load unpacked**.
4. Show you where to enter your API keys in the extension's **Settings** page.
5. Open a YouTube video with captions and confirm the transcript and translation work.

Keep this folder in the same place after installation. If you move or delete it, Chrome's unpacked extension stops working until you load the extension again from its new permanent folder.

Never paste an API key into an AI chat, source file, screenshot, or public message. Enter keys yourself, directly in the YouTube Digest Settings page. Your coding agent can point to the correct field without seeing the key.

## Install manually

If you prefer to do it yourself:

1. Open [github.com/kocean9-freedom/youtube-digest-kimi](https://github.com/kocean9-freedom/youtube-digest-kimi).
2. Choose **Code**, then **Download ZIP**.
3. Choose a permanent folder and unzip the project there. Optional suggestions are `~/Documents/youtube-digest` on macOS or Linux, or `%USERPROFILE%\Documents\youtube-digest` on Windows. You may use a different folder.
4. In Chrome, open `chrome://extensions`.
5. Turn on **Developer mode**.
6. Click **Load unpacked**.
7. Select the exact project folder you chose, which must contain `manifest.json`.
8. Pin YouTube Digest from Chrome's Extensions menu if you want quick access.

Because this is an unpacked extension, it does not update automatically. After downloading an update or changing local files, click **Reload** on the YouTube Digest card at `chrome://extensions`, then refresh open YouTube tabs. Moving or deleting the source folder breaks the unpacked extension until you load it again from the new location.

## Set up your API keys

YouTube Digest needs two keys under your own provider accounts:

1. A **Supadata API key** to retrieve YouTube transcripts.
2. One **AI provider API key** for overviews, explanations, translation, and automatic note polishing. Kimi Coding Plan remains the default.

### Get a Supadata API key

1. Open the official [Supadata sign-up page](https://dash.supadata.ai/auth/sign-up).
2. Create an account and complete the short onboarding flow.
3. Supadata generates an API key automatically during onboarding.
4. Open the [Supadata dashboard](https://dash.supadata.ai/) whenever you need to find or manage the key.
5. Copy the key and paste it into **Supadata API key** in YouTube Digest Settings.

See the [official Supadata documentation](https://docs.supadata.ai/) if the dashboard flow changes.

### Get a Kimi Code API key

1. Open the official [Kimi Code Console](https://www.kimi.com/code/console).
2. Sign in with the Kimi account that has your Kimi Coding Plan membership.
3. Create an API key and give it a recognizable name such as `YouTube Digest`.
4. Copy the key immediately. The full key is shown only once.
5. Paste it into **Kimi Code API key** in YouTube Digest Settings.

See the [official Kimi Code documentation](https://www.kimi.com/code/docs/) for current membership, model, and API details.

Open **Settings** from the side panel. You can also open the YouTube Digest **Options** page from its card at `chrome://extensions` or by right-clicking its toolbar icon. Paste keys only into these Settings fields. Never paste a key into an AI chat, repository file, screenshot, or public message.

### Choose an AI mode

The Settings page provides three independent modes:

- **Kimi Coding Plan**, the default. It uses this fixed configuration:

```text
Base URL: https://api.kimi.com/coding/v1
Endpoint: https://api.kimi.com/coding/v1/chat/completions
Model: kimi-for-coding
```

- **OpenRouter simple mode**. Enter an OpenRouter key, search its model directory, or type an exact model ID. The model list is cached locally for 24 hours. OpenRouter may route content to the host of the model you select.
- **Official / custom advanced mode**. Choose OpenAI, DeepSeek, Kimi Open Platform, Qwen, GLM, SiliconFlow, Anthropic, Gemini, or a custom OpenAI-compatible endpoint. Provider model availability changes over time, so enter an exact model ID from that provider's current documentation. Qwen and custom endpoints allow an editable Base URL.

Kimi K2.7 Code operates with **Thinking ON**. YouTube Digest does not send a thinking-disable field for Kimi. Anthropic and Gemini use their own request formats; DeepSeek-only behavior stays isolated from every other provider. Each AI request or translation batch is attempted once, with no automatic retry or provider fallback. A complete transcript translation can require multiple batches and therefore multiple paid requests.

When you save or test a non-default provider, Chrome asks for access to that provider's exact origin. The manifest declares broad optional HTTPS capability only so custom endpoints can work; the extension requests one selected origin at runtime and does not gain blanket access automatically. Custom endpoints must use HTTPS, except `http://localhost` and `http://127.0.0.1` for local development.

Kimi Coding Plan is primarily designed for coding tools. This personal remix uses its OpenAI-compatible endpoint for video-learning features, so confirm that this use fits the current Kimi terms and membership rules before relying on it.

Keys and settings are stored in Chrome's local extension storage on your device. Release builds do not include or use `config.js`.

## Use YouTube Digest

1. Open a standard YouTube watch page with captions.
2. Click the YouTube Digest extension icon to open the side panel.
3. Read the timestamped transcript, or choose **Original**, **中文**, or **双语**.
4. Open **Overview** when you want AI-generated chapters and key quotes.
5. Select transcript text when you want an AI explanation.
6. Save a note from the player or a key quote, then revisit it from **Notes**.

## What works today

- Google Chrome 116 or newer, using the Side Panel API.
- Standard `youtube.com/watch` video pages.
- Native subtitle tracks returned by Supadata. YouTube Digest prefers English when available, but may show another native language.
- Original, Simplified Chinese, and aligned bilingual transcript views.
- AI overviews, selected-text explanations, translation, and automatic note polishing.
- Local notes and a local cache for recent transcript and digest results.
- Kimi Coding Plan by default, OpenRouter simple mode, and official or custom advanced providers using OpenAI-compatible, Anthropic Messages, or Gemini generateContent protocols.

Shorts, live streams, private or access-restricted videos, and videos without an available native transcript may not work. Firefox, Safari, mobile browsers, and other Chromium browsers are not currently tested or supported.

YouTube Digest forces Supadata's `mode=native`. It does not request AI-generated transcripts or perform local audio transcription when native captions are unavailable.

## Supadata free tier and request costs

Current as of August 9, 2026, the [Supadata pricing page](https://supadata.ai/pricing) lists a free tier with **100 credits per month**, no credit card required. Unused credits do not roll over. Supadata pricing can change, so check the current page before relying on these numbers.

The [Supadata transcript documentation](https://docs.supadata.ai/get-transcript) describes the transcript request modes and credit behavior:

- A native transcript request uses **1 credit**, regardless of video duration.
- A generated transcript costs **2 credits per video minute**. YouTube Digest does not use this path because it forces `mode=native`.
- An unavailable native lookup returned as HTTP `206` still uses **1 credit**.

With the current native-only behavior, the free tier can cover roughly 100 transcript lookups per month when each request succeeds once. Retries and unavailable-caption lookups also consume credits, so actual successful-video coverage can be lower.

Kimi Coding Plan usage is separate from Supadata. YouTube Digest does not collect payments or resell access. Kimi Code requests consume your membership quota, so monitor both provider accounts and check the current [Kimi Code documentation](https://www.kimi.com/code/docs/) for availability and limits.

## Remix it with your coding agent

This is a personal remix project. Upstream issues and pull requests are not accepted. If something breaks or you want a new feature, download or fork your own copy and ask your coding agent to fix, remix, or personalize it for you.

YouTube Digest uses plain HTML, CSS, and JavaScript with no build step, so it is a friendly starting point for agent-assisted projects. Ideas to try:

- Add more translation languages and let each person choose a learning language.
- Create customized summary templates for lectures, interviews, tutorials, reviews, or research talks.
- Build a vocabulary notebook that saves a word, its sentence, meaning, and video timestamp.
- Export notes and vocabulary to Markdown, CSV, Anki, or another study tool.
- Add personal topic filters that highlight the chapters most relevant to a goal.
- Add optional local-model support for a different privacy and cost tradeoff.
- Improve accessibility with keyboard navigation, font controls, and higher-contrast themes.

Ask your agent to preserve the bring-your-own-key model, keep secrets out of source files, run the checks below, and test the remix on real videos.

## Privacy and data flow

YouTube Digest makes provider requests directly from the extension:

1. It sends a canonical YouTube watch URL to Supadata to request the native transcript.
2. It sends the transcript and relevant video metadata to your chosen AI provider when you request AI features.
3. Focused features send only the content they need, such as selected text with context or small transcript batches for translation.
4. It stores keys, settings, notes, and recent cache entries locally in Chrome.

There is no YouTube Digest account system, advertising, analytics, or telemetry. Supadata, your chosen AI provider, and OpenRouter when selected still receive data under their own terms and privacy policies. See [PRIVACY.md](PRIVACY.md) for details.

## Troubleshooting

### The Digest button is missing on a YouTube video

- At `chrome://extensions`, find YouTube Digest and click **Reload**, then refresh the YouTube tab.
- Confirm that you are on a standard `https://www.youtube.com/watch?...` page, not a Short, embed, or live page.
- The current version automatically follows YouTube when its responsive action bar changes. Wait a moment after the page finishes loading.
- If you have an older downloaded copy, resizing the YouTube window horizontally once may reveal the button. Then download the latest version so resizing is no longer required.
- If it is still missing, ask your coding agent to inspect the content script on that exact video page.

### The side panel does not open

- Confirm that you are on a standard `https://www.youtube.com/watch?...` page.
- At `chrome://extensions`, confirm YouTube Digest is enabled and click **Reload**.
- Refresh the YouTube tab after reloading the extension.
- Ask your coding agent to inspect the extension if the problem continues.

### YouTube Digest asks for setup

- Open **Settings**, save a Supadata key, choose an AI mode, and enter that provider's key.
- Use **Test connection** before opening a video. Chrome may first ask for the selected provider's host permission.
- Keys are separate per provider. Switching providers does not copy one provider's key into another profile.

### No transcript is found

- Confirm the video is public and has native captions.
- Check your Supadata key, remaining credits, rate limit, and account status.
- Remember that unavailable native lookups and manual retries may still consume credits.

YouTube Digest will not fall back to generated transcription.

### AI requests fail

- If **Test connection** says the extension background is not responding, open `chrome://extensions`, click **Reload** on YouTube Digest, reopen Settings, and test again. This is required after local source files change.
- A `401` or `403` usually means the selected provider's key or account access is invalid.
- A `429` usually means the selected provider's rate or quota limit was reached.
- Confirm the model ID, Base URL when editable, and Chrome permission shown in Settings.
- For OpenRouter, verify that the selected model is available to your account and routing preferences.

Never share API keys, private transcripts, or personal notes in chats, screenshots, or logs.

## Checks for coding agents

Ask your coding agent to run these commands after changing the project:

```bash
npm test
npm run check
npm run package
```

The agent should also reload the unpacked extension in Chrome and test several real YouTube videos. Automated checks do not prove that live provider requests and YouTube interactions work.

## License

This repository is derived from the original project, [zarazhangrui/youtube-digest](https://github.com/zarazhangrui/youtube-digest) by Zara Zhang, and retains the original MIT copyright and license notice. The multi-provider changes are a normal MIT-licensed derivative work, not an official upstream release.

MIT. See [LICENSE](LICENSE).
