/*
 * AppleEmojis - a Vencord userplugin
 * Copyright (c) 2026 YourName
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Emoji images are NOT bundled. They are loaded at runtime from the
 * emoji-datasource-apple npm package via jsDelivr. Apple emoji artwork
 * is copyrighted by Apple Inc.
 */

import definePlugin from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";

const EmojiUtils = findByPropsLazy("convertNameToSurrogate");
const EmojiStore = findStoreLazy("EmojiStore");

const BASE = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64/";
const IMG_SELECTOR = "img.emoji, img[data-type='emoji'], img[src*='twemoji']";
const SPRITE_SELECTOR = "[class*='emojiSpriteImage']";
const ALL = `${IMG_SELECTOR}, ${SPRITE_SELECTOR}`;

const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

// nom -> caractère, appris depuis le sélecteur (data-name + data-surrogates)
const learned = new Map<string, string>();

function nameToSurrogate(name: string): string | null {
    const l = learned.get(name);
    if (l) return l;
    try {
        const s = EmojiUtils.convertNameToSurrogate(name);
        if (s) return s;
    } catch { }
    try {
        const s = EmojiStore.getDisambiguatedEmojiContext().getByName(name)?.surrogates;
        if (s) return s;
    } catch { }
    try {
        const s = EmojiStore.getByName?.(name)?.surrogates;
        if (s) return s;
    } catch { }
    console.warn("[AppleEmojis] emoji introuvable pour le nom :", name);
    return null;
}

function toCodes(emoji: string, keepFE0F: boolean) {
    return [...emoji]
        .map(c => c.codePointAt(0)!.toString(16))
        .filter(c => keepFE0F || c !== "fe0f")
        .join("-");
}

function probe(url: string) {
    return new Promise<boolean>(res => {
        const i = new Image();
        i.onload = () => res(true);
        i.onerror = () => res(false);
        i.src = url;
    });
}

function resolve(emoji: string): Promise<string | null> {
    if (cache.has(emoji)) return Promise.resolve(cache.get(emoji)!);
    let p = pending.get(emoji);
    if (!p) {
        p = (async () => {
            const urls = [...new Set([
                BASE + toCodes(emoji, false) + ".png",
                BASE + toCodes(emoji, true) + ".png"
            ])];
            let found: string | null = null;
            for (const u of urls) {
                if (await probe(u)) { found = u; break; }
            }
            cache.set(emoji, found);
            pending.delete(emoji);
            return found;
        })();
        pending.set(emoji, p);
    }
    return p;
}

function getEmoji(el: HTMLElement): string | null {
    if (el instanceof HTMLImageElement) {
        if (el.dataset.type === "custom") return null;

        // éditeur : alt et data-name valent ":nerd:" au lieu du caractère
        const alt = el.alt || el.dataset.name || "";
        if (!alt) return null;
        if (/^:[^:\s]+:$/.test(alt)) return nameToSurrogate(alt.slice(1, -1));
        return alt;
    }
    // sprite du sélecteur : on en profite pour apprendre nom -> caractère
    const holder = el.closest<HTMLElement>("[data-surrogates]");
    if (!holder) return null;
    const s = holder.dataset.surrogates!;
    const n = holder.dataset.name;
    if (n) learned.set(n.replace(/^:|:$/g, ""), s);
    return s;
}

async function replace(el: HTMLElement) {
    const emoji = getEmoji(el);
    if (!emoji) return;

    const cached = cache.get(emoji);
    if (cached === null) return;
    const url = cached ?? await resolve(emoji);
    if (!url || getEmoji(el) !== emoji) return; // élément recyclé pendant l'attente

    if (el instanceof HTMLImageElement) {
        if (el.src === url) return;
        el.src = url;
        el.srcset = "";
    } else {
        if (el.style.backgroundImage.includes(url)) return;
        el.style.setProperty("background-image", `url("${url}")`, "important");
        el.style.setProperty("background-size", "100% 100%", "important");
        el.style.setProperty("background-position", "0 0", "important");
        el.style.setProperty("background-repeat", "no-repeat", "important");
    }
}

const queue = new Set<HTMLElement>();
let scheduled = false;

function enqueue(el: HTMLElement) {
    queue.add(el);
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
        scheduled = false;
        const items = [...queue];
        queue.clear();
        items.forEach(replace);
    });
}

function scan(root: ParentNode) {
    root.querySelectorAll<HTMLElement>(ALL).forEach(enqueue);
}

let observer: MutationObserver | null = null;

export default definePlugin({
    name: "AppleEmojis",
    description: "Replace Discord emoji with apple emoji because its more beautiful",
    authors: [{ name: "goodkittyboi", id: 1341742818066042966n }],

    start() {
        scan(document);
        observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                if (m.type === "attributes") {
                    const t = m.target;
                    if (t instanceof HTMLElement) {
                        if (t.matches(ALL)) enqueue(t);
                        else if (t.hasAttribute("data-surrogates")) scan(t); // bouton recyclé
                    }
                    continue;
                }
                m.addedNodes.forEach(node => {
                    if (!(node instanceof HTMLElement)) return;
                    if (node.matches(ALL)) enqueue(node);
                    else scan(node);
                });
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["alt", "src", "style", "data-surrogates", "data-name"]
        });
    },

    stop() {
        observer?.disconnect();
        observer = null;
        queue.clear();
    }
});