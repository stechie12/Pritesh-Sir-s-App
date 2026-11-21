import type { WebSearchSource } from './types.ts';
import { LruCache, sanitizeHttpUrl } from './security.ts';

const webSearchCache = new LruCache<{ sources: WebSearchSource[]; contextSummary: string }>(
  100,
  15 * 60 * 1000
);

export function getWebSearchCacheStats() {
  return webSearchCache.getStats();
}

/**
 * Determines whether a prompt benefits from parallel DuckDuckGo / Wikipedia knowledge grounding,
 * returning a cleaned search query or null for casual greetings and short chat turns.
 */
export function shouldPerformWebSearch(question: string, forceWebSearch = false): string | null {
  const qTrim = question.trim();
  const qLower = qTrim.toLowerCase();
  const cleanWords = qLower.replace(/[^a-z0-9\s]/g, '').trim();

  if (
    /^(?:hi+|hello+|hey+|hii+|yo+|sup|wassup|how\s*are\s*you|how\s*is\s*life|hows\s*life|thanks|thank\s*you|ok|okay|bye|good\s*(?:morning|afternoon|evening|night))$/i.test(
      cleanWords
    )
  ) {
    return null;
  }

  const stripped = qTrim
    .replace(
      /\b(?:i\s*am|i'm|im)\s+(?:a\s+student\s+)?(?:in\s+)?(?:grade|class|std|standard)?\s*\d*(?:th|st|nd|rd)?\b/gi,
      ''
    )
    .replace(/\b(?:we\s*are|we're|were)\s+doing\s+[a-z]+\b/gi, '')
    .replace(
      /\b(?:hmmm+|uh+|um+|hey|bro|bruh|please|pls|tell\s+me\s+about|tell\s+me|can\s+you\s+explain|can\s+you\s+tell\s+me|do\s+you\s+know|teach\s+me\s+about|teach\s+me)\b/gi,
      ''
    )
    .replace(
      /^(?:what\s+(?:is|was|are|were)(?:\s+(?:a|an|the))?|who\s+(?:is|was|invented|discovered)|where\s+is|when\s+(?:is|was|did)|how\s+(?:does|do|to|many|much)|why\s+(?:is|are|do|does)|define|explain\s+to\s+me|explain\s+about|explain|meaning\s+of|search\s+for|search)\s+/i,
      ''
    )
    .replace(/[?!.,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped || stripped.length < 2) return null;

  const looksLikeQuestionOrFactQuery =
    forceWebSearch ||
    qTrim.includes('?') ||
    /\b(?:what|who|where|when|why|how|which|define|explain|meaning|capital|invented|discovered|formula|theorem|law|history|science|physics|chemistry|biology|geography|planet|country|president|prime\s+minister|population|speed|distance|temperature|sin|cos|tan|cot|sec|cosec|surd|surds|trigonometry|tirgnometry|calculus|algebra|geometry|matrix|matrices|logarithm|quadratic)\b/i.test(
      qLower
    );

  if (!looksLikeQuestionOrFactQuery) return null;

  return stripped.slice(0, 90);
}

/**
 * Queries DuckDuckGo Instant Answers and Wikipedia REST summaries concurrently
 * within a strict AbortController timeout budget, caching verified results for 15 minutes.
 */
export async function performLiveWebSearch(
  question: string,
  forceWebSearch = false,
  timeoutMs = 1500
): Promise<{ sources: WebSearchSource[]; contextSummary: string }> {
  const searchQuery = shouldPerformWebSearch(question, forceWebSearch);
  if (!searchQuery) {
    return { sources: [], contextSummary: '' };
  }

  const cacheKey = searchQuery.toLowerCase();
  const cached = webSearchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const sources: WebSearchSource[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const ddgPromise = fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_html=1&skip_disambig=1`,
      { signal: controller.signal }
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    const wikiPromise = (async () => {
      if (/^\d+$/.test(searchQuery.trim())) return [];
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        searchQuery
      )}&utf8=&format=json&srlimit=2`;
      const sRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'PriteshSirsMathsApp/2.0' },
        signal: controller.signal,
      });
      if (!sRes.ok) return [];
      const sData = (await sRes.json()) as {
        query?: { search?: Array<{ title?: string; snippet?: string }> };
      };
      const hits = (sData?.query?.search || []).slice(0, 2);
      const summaryPromises = hits.map(async (hit) => {
        if (!hit.title) return null;
        const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`;
        const sumRes = await fetch(sumUrl, {
          headers: { 'User-Agent': 'PriteshSirsMathsApp/2.0' },
          signal: controller.signal,
        });
        if (!sumRes.ok) return null;
        const sumData = (await sumRes.json()) as {
          title?: string;
          extract?: string;
          content_urls?: { desktop?: { page?: string } };
        };
        if (sumData?.extract && sumData.extract.length > 20) {
          const safeUrl = sanitizeHttpUrl(
            sumData.content_urls?.desktop?.page ||
              `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`
          );
          if (!safeUrl) return null;
          return {
            title: `${sumData.title || hit.title} — Wikipedia`,
            url: safeUrl,
            snippet: sumData.extract.slice(0, 380),
          } as WebSearchSource;
        }
        return null;
      });
      const resolved = await Promise.all(summaryPromises);
      return resolved.filter((x): x is WebSearchSource => x !== null);
    })().catch(() => []);

    const [ddgData, wikiResults] = await Promise.all([ddgPromise, wikiPromise]);

    if (ddgData && typeof ddgData === 'object') {
      const ddg = ddgData as {
        AbstractText?: string;
        AbstractURL?: string;
        Heading?: string;
        Answer?: string;
      };
      const safeDdgUrl =
        sanitizeHttpUrl(
          ddg.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`
        ) || `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`;

      if (ddg.Answer && typeof ddg.Answer === 'string' && ddg.Answer.trim()) {
        sources.push({
          title: `${ddg.Heading || searchQuery} — DuckDuckGo Instant Answer`,
          url: safeDdgUrl,
          snippet: ddg.Answer.trim(),
        });
      }
      if (ddg.AbstractText && ddg.AbstractText.length > 20) {
        sources.push({
          title: `${ddg.Heading || searchQuery} — DuckDuckGo Knowledge Graph`,
          url: safeDdgUrl,
          snippet: ddg.AbstractText.slice(0, 380),
        });
      }
    }

    for (const w of wikiResults) {
      if (!sources.some((s) => s.url === w.url)) {
        sources.push(w);
      }
    }
  } catch {
    // Ignore abort / network failures gracefully
  } finally {
    clearTimeout(timer);
  }

  const topSources = sources.slice(0, 3);
  const contextSummary = topSources
    .map((s, idx) => `[Source ${idx + 1}: ${s.title}] ${s.snippet}`)
    .join('\n');

  const result = { sources: topSources, contextSummary };
  if (topSources.length > 0) {
    webSearchCache.set(cacheKey, result);
  }
  return result;
}
