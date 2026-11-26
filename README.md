# AppleEmojis for Vencord

A [Vencord](https://github.com/Vendicated/Vencord) userplugin that replaces Discord's default (Twemoji) emojis with Apple-style emojis.
 
> [!WARNING]
> **External service disclaimer:** this plugin makes requests to an external service. To display Apple-style emojis, it downloads emoji images from the [jsDelivr](https://www.jsdelivr.com/) CDN (`cdn.jsdelivr.net`), which serves the [`emoji-datasource-apple`](https://www.npmjs.com/package/emoji-datasource-apple) npm package. See [External services](#external-services) below for details.
 
## What it replaces

- Emojis in chat messages
- The emoji picker (sprite-sheet based)
- The emoji preview bar at the bottom of the picker
- Emojis inside the message input box (Slate editor)

Custom server emojis are left untouched. If an Apple image does not exist for a given emoji (for example a very new one), Discord's original image is kept.

## How it works

Discord renders emojis in three different ways, so the plugin handles each one:

1. **`<img class="emoji" alt="😀">`** (chat): the character is read from `alt` and the image `src` is swapped.
2. **Sprite `<div class="emojiSpriteImage...">`** (picker): the character is read from the parent button's `data-surrogates` attribute, and the `background-image` is replaced.
3. **`<img alt=":nerd:">`** (input box): only the emoji *name* is available, so the plugin resolves it to a character (see below), then swaps the image.

A `MutationObserver` watches the page, handles recycled DOM nodes (the picker reuses elements while scrolling), and batches work per animation frame. Resolved URLs are cached, and candidates are preloaded off-screen before being applied, which avoids flicker and broken images.

Name-to-character resolution tries, in order:

1. Names learned from the picker (`data-name` + `data-surrogates`)
2. `convertNameToSurrogate` from Discord's internal modules
3. `EmojiStore.getDisambiguatedEmojiContext().getByName(name)`
4. `EmojiStore.getByName(name)`

If all fail, a warning is logged: `[AppleEmojis] emoji not found for name: ...`.

## Installation

Userplugins require building Vencord from source.

### 1. Prerequisites

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org) (LTS)
- pnpm: `npm i -g pnpm`

### 2. Clone and set up Vencord

```bash
git clone https://github.com/Vendicated/Vencord.git
cd Vencord
pnpm install --frozen-lockfile
mkdir src/userplugins
```

### 3. Add this plugin

```bash
git clone https://github.com/freeman649/Apple-Emoji-Plugins-Vencord.git src/userplugins/appleEmojis
```

### 4. Build and inject

```bash
pnpm build
pnpm inject
```

Choose your Discord install in the installer and click **Patch**, then fully restart Discord.

### 5. Enable it

Discord Settings → Vencord → Plugins → enable **AppleEmojis**.

After a Vencord update, rebuild with `pnpm build` and reload Discord with Ctrl+R.

## Troubleshooting

- **Nothing changes**: open DevTools (Ctrl+Shift+I) and check the console for `Refused to load image` / Content Security Policy errors. If `cdn.jsdelivr.net` is blocked, allow it through `CspPolicies` in a `native.ts` file next to `index.tsx`.
- **Emojis in the input box stay Discord-style**: open the emoji picker once after starting Discord (it teaches the plugin emoji names), then check the console for the `emoji not found` warning. Open an issue with the warning and the result of `Vencord.Webpack.findByProps("convertNameToSurrogate")`.
- **Emojis revert after a Discord update**: Discord likely changed class names or internals. Open an issue with the HTML of the affected element (right-click → Inspect → Copy element).
- **Newest emojis still show Discord's version**: bump the pinned version in `BASE` at the top of `index.tsx` (`emoji-datasource-apple@15.1.2`).

## Ideas / TODO

- Setting to choose the emoji style (Apple, Google, Facebook, Twitter) via `definePluginSettings`
- Optional local hosting of the images (offline support)
- Replace system-font emojis in usernames and channel names

## Disclaimer

- Client modifications are against Discord's Terms of Service. Use at your own risk.
- This repository contains **no** emoji artwork. Images are fetched at runtime from the [`emoji-datasource-apple`](https://github.com/iamcal/emoji-data) package, and Apple emoji artwork belongs to Apple Inc. Do not redistribute the images.
- Not affiliated with Discord, Vencord, or Apple.

## License

[GPL-3.0-or-later](LICENSE), the same license family as Vencord.
