# Privacy

Effective: September 8, 2026

YouTube Digest is a GitHub-only, bring-your-own-key Chrome extension. It has no YouTube Digest account, developer-operated backend, analytics, advertising, or telemetry.

## Data the extension handles

Depending on the feature you use, YouTube Digest handles:

- the canonical URL and video ID of the active YouTube video;
- transcript text and timestamps;
- video metadata such as title, channel, description, and duration;
- selected transcript text and nearby context;
- content requested for translation or note cleanup;
- notes you save;
- Supadata and AI provider configuration, including API keys; and
- cached transcripts, digests, translations, and the non-secret OpenRouter model directory.

## Where data goes

### Supadata

YouTube Digest sends the canonical YouTube video URL to `https://api.supadata.ai` with your Supadata API key. Supadata returns the transcript and timestamps. A Supadata key is required for transcript retrieval.

### Your chosen AI provider

When you request an AI feature, the extension sends only the content needed for that action to the provider selected in Settings. This may include:

- transcript and relevant video metadata for an overview;
- selected text and nearby transcript context for an explanation;
- small transcript or result batches for progressive translation; and
- nearby transcript context and video metadata when polishing a saved note.

The available modes are Kimi Coding Plan, OpenRouter simple mode, and official / custom advanced mode. Advanced providers use an OpenAI-compatible API, Anthropic Messages, or Gemini generateContent. OpenRouter may route submitted content to the host of the model you choose. Review the selected provider's and model host's terms, privacy policy, retention policy, and account controls before sending sensitive content.

Requests go directly from the extension to Supadata and your chosen AI provider. The repository owner does not proxy or receive these requests. There is no automatic provider fallback and no automatic retry of a paid AI request.

## Local storage and retention

YouTube Digest uses Chrome's local extension storage, not a YouTube Digest cloud service.

- Every provider has a separate locally stored profile and API key. Switching providers does not copy a key between profiles.
- Saved notes remain until you delete them or remove or clear the extension's data. The extension keeps up to 100 notes.
- Recent transcript, digest, and per-segment translation cache entries are stored locally. The cache is limited to 20 videos, and entries older than 30 days are removed when the side panel opens.
- The OpenRouter model directory is cached locally for up to 24 hours and does not contain your API key.

Chrome extension storage is not a password vault. Anyone with sufficient access to your browser profile or device may be able to recover locally stored keys or content. Use dedicated or scoped keys where supported, set spending limits, and rotate or revoke a key if the device or browser profile is compromised.

To remove data:

- delete the current provider's key in Settings;
- delete individual notes, clear cached digests, or delete all notes;
- reset all extension data in Settings; or
- remove the extension or clear its Chrome storage, then revoke provider keys in each provider dashboard.

Clearing local data does not delete information already processed or retained by a third-party provider. Use that provider's controls for service-side data.

## Permissions

YouTube Digest uses Chrome permissions for these purposes:

- `sidePanel`: display the interface beside YouTube.
- `storage`: store settings, keys, notes, model-directory data, and cached results locally.
- `tabs`: identify and interact with the active YouTube tab.
- `scripting`: coordinate the extension's YouTube page controls.
- YouTube host access: read the active video's URL and metadata and provide timestamp controls.
- Supadata host access: retrieve transcripts.
- Kimi host access: keep the default Kimi Coding Plan mode available without an extra prompt.
- Optional HTTPS and local-development host capability: allow a user-selected provider. Chrome is asked for the exact selected origin when you save or test that provider, or when you explicitly refresh the OpenRouter model directory. The extension does not automatically receive access to every HTTPS site. If you later revoke an origin, AI requests stop with a permission error until you return to Settings and authorize it again.

YouTube Digest does not use these permissions to monitor general browsing activity.

## No sale or advertising use

YouTube Digest does not sell personal information, build advertising profiles, or share data with data brokers. It does not include analytics SDKs.

## Changes

Privacy-relevant changes will be documented in this file and in the repository history. Review updates before installing a new version.

## Questions

This repository does not provide a public support or issue channel. Review this policy, the source code, and each provider's documentation before use. For a vulnerability or accidental secret exposure, follow the private process in [SECURITY.md](SECURITY.md).
