export type FeedSource = {
  media: string;
  url: string;
};

export type CollectedArticle = {
  editorId: string;
  editorName: string;
  media: string;
  title: string;
  url: string;
  publishedAt: string;
  excerpt: string;
  categories: string[];
};

type TrackedEditor = { id: string; name: string; media: string };

export const feedSources: FeedSource[] = [
  { media: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { media: "WIRED", url: "https://www.wired.com/feed/rss" },
  { media: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { media: "Tom's Guide", url: "https://www.tomsguide.com/feeds/all" },
  { media: "TechRadar", url: "https://www.techradar.com/rss" },
  { media: "Engadget", url: "https://www.engadget.com/rss.xml" },
  { media: "Stuff", url: "https://www.stuff.tv/feed/" },
  { media: "Android Authority", url: "https://www.androidauthority.com/feed" },
  { media: "MacRumors", url: "https://www.macrumors.com/macrumors.xml" },
  { media: "Macworld", url: "https://www.macworld.com/feed" },
  { media: "PetaPixel", url: "https://petapixel.com/feed/" },
  { media: "T3", url: "https://www.t3.com/feeds.xml" },
  { media: "ZDNET", url: "https://www.zdnet.com/news/rss.xml" },
];

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function plainText(value: string) {
  return decodeXml(value)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodeXml(match[1]).trim() : "";
}

function allTags(block: string, name: string) {
  return [...block.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "gi"))]
    .map((match) => plainText(match[1]))
    .filter(Boolean);
}

function normalizePerson(value: string) {
  const parenthesized = value.match(/\(([^()]+)\)\s*$/)?.[1];
  return (parenthesized || value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function itemLink(block: string) {
  const textLink = tag(block, "link");
  if (textLink && /^https?:\/\//i.test(textLink)) return textLink;
  const href = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1];
  return href ? decodeXml(href) : "";
}

function isoDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function parseFeed(xml: string, source: FeedSource, editors: TrackedEditor[]) {
  const blocks = [
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
    ...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi),
  ].map((match) => match[1]);
  const candidates: CollectedArticle[] = [];
  const mediaEditors = editors.filter((editor) => editor.media === source.media);

  for (const block of blocks) {
    const author = tag(block, "dc:creator") || tag(block, "author") || tag(tag(block, "author"), "name");
    const normalizedAuthor = normalizePerson(plainText(author));
    const editor = mediaEditors.find((item) => normalizePerson(item.name) === normalizedAuthor);
    if (!editor) continue;
    const title = plainText(tag(block, "title"));
    const url = itemLink(block);
    const publishedAt = isoDate(tag(block, "pubDate") || tag(block, "published") || tag(block, "updated"));
    if (!title || !url || !publishedAt) continue;
    const excerpt = plainText(tag(block, "description") || tag(block, "summary") || tag(block, "content")).slice(0, 700);
    candidates.push({
      editorId: editor.id,
      editorName: editor.name,
      media: source.media,
      title,
      url,
      publishedAt,
      excerpt,
      categories: allTags(block, "category").slice(0, 5),
    });
  }
  return candidates;
}

async function fetchOne(source: FeedSource, editors: TrackedEditor[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(source.url, {
      headers: { "User-Agent": "SignalDesk/0.1 (+local media research reader)", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${source.media} ${response.status}`);
    return { source, articles: parseFeed(await response.text(), source, editors), error: null as string | null };
  } catch (error) {
    return { source, articles: [] as CollectedArticle[], error: error instanceof Error ? `${source.media}: ${error.message}` : `${source.media}: 读取失败` };
  } finally {
    clearTimeout(timeout);
  }
}

export async function collectTrackedArticles(editors: TrackedEditor[]) {
  const results = await Promise.all(feedSources.map((source) => fetchOne(source, editors)));
  const deduped = new Map<string, CollectedArticle>();
  for (const article of results.flatMap((result) => result.articles)) deduped.set(article.url, article);
  return {
    articles: [...deduped.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    sourceCount: results.filter((result) => !result.error).length,
    errors: results.flatMap((result) => result.error ? [result.error] : []),
  };
}

export function fallbackArticleMetadata(article: CollectedArticle) {
  const rules: Array<[RegExp, string]> = [
    [/\b(ai|artificial intelligence|gemini|chatgpt|siri)\b/i, "人工智能"],
    [/\b(iphone|apple|ios|macbook|airpods)\b/i, "Apple"],
    [/\b(android|pixel|galaxy|smartphone|phone)\b/i, "智能手机"],
    [/\b(camera|photo|lens|video|imaging)\b/i, "影像"],
    [/\b(watch|wearable|fitness|health)\b/i, "可穿戴"],
    [/\b(robot|robotics)\b/i, "机器人"],
    [/\b(laptop|computer|chip|processor)\b/i, "电脑与芯片"],
    [/\b(security|privacy|breach)\b/i, "网络安全"],
  ];
  const haystack = `${article.title} ${article.excerpt} ${article.categories.join(" ")}`;
  const topics = rules.filter(([pattern]) => pattern.test(haystack)).map(([, topic]) => topic);
  return {
    summary: article.excerpt || `来自 ${article.media} 的最新文章，等待进一步分析。`,
    topics: [...new Set([...topics, ...article.categories.slice(0, 2)])].slice(0, 4).join("；") || "科技媒体",
  };
}
