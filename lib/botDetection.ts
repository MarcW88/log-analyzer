export type BotCategory = "Search engines" | "AI bots" | "Social" | "Others";
export type BotProvider =
  | "Google"
  | "Bing"
  | "Baidu"
  | "Apple"
  | "OpenAI"
  | "Facebook"
  | "Twitter"
  | "LinkedIn"
  | "Others";

export interface BotInfo {
  name: string;
  provider: BotProvider;
  category: BotCategory;
}

const BOT_SIGNATURES: Array<{
  pattern: RegExp;
  info: BotInfo;
}> = [
  // Google
  {
    pattern: /googlebot-mobile|googlebot\/.*mobile/i,
    info: { name: "Googlebot Mobile", provider: "Google", category: "Search engines" },
  },
  {
    pattern: /googlebot-image/i,
    info: { name: "Googlebot Image", provider: "Google", category: "Search engines" },
  },
  {
    pattern: /googlebot/i,
    info: { name: "Googlebot Desktop", provider: "Google", category: "Search engines" },
  },
  {
    pattern: /google-inspectiontool/i,
    info: { name: "Google Inspection Tool", provider: "Google", category: "Search engines" },
  },
  {
    pattern: /googlelabs/i,
    info: { name: "Google Labs", provider: "Google", category: "Search engines" },
  },
  {
    pattern: /mediapartners-google/i,
    info: { name: "Google Adsense", provider: "Google", category: "Others" },
  },
  {
    pattern: /adsbot-google/i,
    info: { name: "Google AdsBot", provider: "Google", category: "Others" },
  },
  // Bing
  {
    pattern: /bingbot.*mobi|mobi.*bingbot/i,
    info: { name: "Bingbot Mobile", provider: "Bing", category: "Search engines" },
  },
  {
    pattern: /bingbot/i,
    info: { name: "Bingbot Desktop", provider: "Bing", category: "Search engines" },
  },
  {
    pattern: /msnbot/i,
    info: { name: "MSNbot", provider: "Bing", category: "Search engines" },
  },
  {
    pattern: /adidxbot/i,
    info: { name: "Bing Ads Bot", provider: "Bing", category: "Others" },
  },
  {
    pattern: /bingpreview/i,
    info: { name: "Bing Preview", provider: "Bing", category: "Others" },
  },
  // Baidu
  {
    pattern: /baiduspider/i,
    info: { name: "Baiduspider", provider: "Baidu", category: "Search engines" },
  },
  // Apple
  {
    pattern: /applebot/i,
    info: { name: "Applebot", provider: "Apple", category: "Search engines" },
  },
  // OpenAI / AI bots
  {
    pattern: /gptbot/i,
    info: { name: "GPTBot", provider: "OpenAI", category: "AI bots" },
  },
  {
    pattern: /oai-searchbot|openai-searchbot/i,
    info: { name: "OpenAI SearchBot", provider: "OpenAI", category: "AI bots" },
  },
  {
    pattern: /chatgpt-user/i,
    info: { name: "ChatGPT User", provider: "OpenAI", category: "AI bots" },
  },
  {
    pattern: /perplexitybot/i,
    info: { name: "PerplexityBot", provider: "Others", category: "AI bots" },
  },
  {
    pattern: /claudebot/i,
    info: { name: "ClaudeBot", provider: "Others", category: "AI bots" },
  },
  {
    pattern: /anthropic-ai/i,
    info: { name: "Anthropic AI", provider: "Others", category: "AI bots" },
  },
  {
    pattern: /cohere-ai/i,
    info: { name: "Cohere AI", provider: "Others", category: "AI bots" },
  },
  {
    pattern: /youbot/i,
    info: { name: "YouBot", provider: "Others", category: "AI bots" },
  },
  // Facebook / Social
  {
    pattern: /facebookexternalhit/i,
    info: { name: "Facebook External Hit", provider: "Facebook", category: "Social" },
  },
  {
    pattern: /twitterbot/i,
    info: { name: "Twitterbot", provider: "Twitter", category: "Social" },
  },
  {
    pattern: /linkedinbot/i,
    info: { name: "LinkedInBot", provider: "LinkedIn", category: "Social" },
  },
  // Ahrefs
  {
    pattern: /ahrefsbot/i,
    info: { name: "Ahrefsbot", provider: "Others", category: "Others" },
  },
  {
    pattern: /ahrefs-sitemap/i,
    info: { name: "Ahrefs Sitemap", provider: "Others", category: "Others" },
  },
  // SEMrush
  {
    pattern: /semrushbot/i,
    info: { name: "SEMrushBot", provider: "Others", category: "Others" },
  },
  // Moz
  {
    pattern: /dotbot/i,
    info: { name: "DotBot (Moz)", provider: "Others", category: "Others" },
  },
  // Majestic
  {
    pattern: /mj12bot/i,
    info: { name: "MJ12Bot", provider: "Others", category: "Others" },
  },
  // Yandex
  {
    pattern: /yandexbot|yandex\//i,
    info: { name: "Yandexbot", provider: "Others", category: "Search engines" },
  },
  // Seznam
  {
    pattern: /seznambot/i,
    info: { name: "Seznambot", provider: "Others", category: "Search engines" },
  },
  // Sogou
  {
    pattern: /sogou/i,
    info: { name: "Sogou", provider: "Others", category: "Search engines" },
  },
  // DuckDuckGo
  {
    pattern: /duckduckbot/i,
    info: { name: "DuckDuckBot", provider: "Others", category: "Search engines" },
  },
  // CCBot
  {
    pattern: /ccbot/i,
    info: { name: "Ccbot", provider: "Others", category: "Others" },
  },
  // PetalBot
  {
    pattern: /petalbot/i,
    info: { name: "Petalbot", provider: "Others", category: "Others" },
  },
  // Bytedance
  {
    pattern: /bytespider/i,
    info: { name: "Bytespider", provider: "Others", category: "Others" },
  },
  // SiteAudit bots
  {
    pattern: /siteauditbot/i,
    info: { name: "Siteauditbot", provider: "Others", category: "Others" },
  },
  // OhDear
  {
    pattern: /ohdear/i,
    info: { name: "OhDear Monitor", provider: "Others", category: "Others" },
  },
  // WordPress
  {
    pattern: /wordpress\//i,
    info: { name: "WordPress", provider: "Others", category: "Others" },
  },
  // okhttp
  {
    pattern: /okhttp/i,
    info: { name: "okhttp", provider: "Others", category: "Others" },
  },
  // Python
  {
    pattern: /python-requests|python-urllib/i,
    info: { name: "Python", provider: "Others", category: "Others" },
  },
  // Go http client
  {
    pattern: /go-http-client/i,
    info: { name: "Go Http Client", provider: "Others", category: "Others" },
  },
  // Generic http
  {
    pattern: /^http\//i,
    info: { name: "http", provider: "Others", category: "Others" },
  },
  // Curl
  {
    pattern: /^curl\//i,
    info: { name: "curl", provider: "Others", category: "Others" },
  },
  // Wget
  {
    pattern: /^wget\//i,
    info: { name: "wget", provider: "Others", category: "Others" },
  },
  // Mozilla-based fallback (minimal UA - likely bot)
  {
    pattern: /^mozilla\/5\.0 \(compatible;/i,
    info: { name: "Mozilla", provider: "Others", category: "Others" },
  },
];

export function detectBot(userAgent: string): BotInfo | null {
  if (!userAgent || userAgent === "-") return null;
  for (const sig of BOT_SIGNATURES) {
    if (sig.pattern.test(userAgent)) {
      return sig.info;
    }
  }
  return null;
}

export function isBot(userAgent: string): boolean {
  return detectBot(userAgent) !== null;
}
