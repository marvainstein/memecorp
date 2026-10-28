import * as cheerio from "cheerio";
import { isWorkRelated } from "../autotag";
import { isImageUrl, strings, type Adapter, type Candidate } from "../types";

const absolute = (src: string | undefined, base: string) => {
  if (!src) return null;
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
};

/**
 * RSS / Atom feeds (blogs, meme sites, Mastodon or Lemmy feeds...). Takes the image from
 * enclosures, media:content or the first <img> of the item's HTML.
 * config: { feeds: ["https://example.com/feed.xml"], topical: true }
 */
export const feedAdapter: Adapter = {
  id: "feed",
  label: "Feeds RSS / Atom",
  description: "Cualquier feed RSS o Atom con imágenes (respeta robots.txt).",
  missing: (config) => (strings(config.feeds).length ? null : "Configurá al menos un feed."),
  async fetch({ http, config, log }) {
    const candidates: Candidate[] = [];
    let failures = 0;
    for (const feedUrl of strings(config.feeds)) {
      try {
        const $ = cheerio.load(await http.text(feedUrl, { kind: "page" }), { xml: true });
        const host = new URL(feedUrl).hostname;
        $("item, entry").each((_, el) => {
          const item = $(el);
          const link = item.find("link").first().attr("href") || item.find("link").first().text().trim() || item.find("guid").text().trim();
          const title = item.find("title").first().text().trim();
          const html = item.find("content\\:encoded, content, description, summary").first().text();
          const fromHtml = html ? cheerio.load(html)("img").first() : null;
          const image =
            item.find("enclosure[type^='image']").attr("url") ||
            item.find("media\\:content[medium='image'], media\\:content[type^='image']").attr("url") ||
            item.find("media\\:thumbnail").attr("url") ||
            fromHtml?.attr("src");
          const imageUrl = absolute(image, link || feedUrl);
          if (!imageUrl || !isImageUrl(imageUrl) || !link) return;
          candidates.push({
            externalId: link,
            imageUrl,
            pageUrl: absolute(link, feedUrl) ?? link,
            title: (title || fromHtml?.attr("alt") || "Meme").slice(0, 160),
            altText: fromHtml?.attr("alt"),
            sourceName: host,
            topical: config.topical === true || isWorkRelated(`${title} ${fromHtml?.attr("alt") ?? ""}`),
          });
        });
      } catch (err) {
        failures++;
        log(`${feedUrl}: ${(err as Error).message}`);
      }
    }
    if (failures && failures === strings(config.feeds).length) throw new Error("Ningún feed respondió");
    return { candidates };
  },
};

/**
 * Generic page extractor with Cheerio for directories that allow crawling (robots.txt is
 * checked and Crawl-delay honored). Collects <img> elements matching an optional selector.
 * config: { pages: ["https://example.com/memes"], selector: "article img", minWidth: 300, topical: false }
 */
export const webpageAdapter: Adapter = {
  id: "webpage",
  label: "Páginas web (Cheerio)",
  description: "Extrae imágenes de páginas que permiten el rastreo (respeta robots.txt y Crawl-delay).",
  missing: (config) => (strings(config.pages).length ? null : "Configurá al menos una página."),
  async fetch({ http, config, log }) {
    const selector = String(config.selector || "img");
    const minWidth = Number(config.minWidth ?? 250);
    const candidates: Candidate[] = [];
    let failures = 0;
    for (const pageUrl of strings(config.pages)) {
      try {
        const $ = cheerio.load(await http.text(pageUrl, { kind: "page" }));
        const host = new URL(pageUrl).hostname;
        $(selector).each((_, el) => {
          const img = $(el);
          const src = img.attr("data-src") || img.attr("src") || img.attr("srcset")?.split(",").pop()?.trim().split(" ")[0];
          const imageUrl = absolute(src, pageUrl);
          const width = Number(img.attr("width") || 0);
          if (!imageUrl || !isImageUrl(imageUrl) || (width && width < minWidth)) return;
          const link = absolute(img.closest("a").attr("href"), pageUrl) ?? pageUrl;
          const caption = img.closest("figure").find("figcaption").text().trim();
          const title = (img.attr("alt") || img.attr("title") || caption || $("title").text() || "Meme").trim().slice(0, 160);
          candidates.push({
            externalId: imageUrl,
            imageUrl,
            pageUrl: link,
            title,
            altText: img.attr("alt"),
            description: caption || undefined,
            sourceName: host,
            topical: config.topical === true || isWorkRelated(`${title} ${caption}`),
          });
        });
      } catch (err) {
        failures++;
        log(`${pageUrl}: ${(err as Error).message}`);
      }
    }
    if (failures && failures === strings(config.pages).length) throw new Error("Ninguna página respondió");
    return { candidates };
  },
};
