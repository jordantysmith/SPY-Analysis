export const maxDuration = 60;

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function fetchLivePrices() {
  const symbols = ["SPY", "ES=F", "%5EVIX"];
  const results = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
          { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } }
        );
        const data = await res.json();
        const quote = data?.chart?.result?.[0]?.meta;
        if (quote) {
          const price = quote.regularMarketPrice;
          const prev = quote.previousClose || quote.chartPreviousClose;
          const changePct = (((price - prev) / prev) * 100).toFixed(2);
          results[symbol] = { price, prevClose: prev, changePct };
        }
      } catch (e) {
        results[symbol] = null;
      }
    })
  );
  return results;
}

function formatPrices(prices) {
  const spy = prices["SPY"];
  const es  = prices["ES=F"];
  const vix = prices["%5EVIX"];

  const fmt = (d) => d ? {
    value: `${d.changePct > 0 ? "+" : ""}${d.changePct}%`,
    raw: d.price,
    dir: d.changePct > 0 ? "up" : d.changePct < 0 ? "down" : "flat",
  } : null;

  const vixLevel = vix?.price || 18;
  return {
    spyData: fmt(spy),
    esData:  fmt(es),
    vixData: vix ? {
      value: vix.price.toFixed(2),
      regime: vixLevel < 15 ? "low" : vixLevel < 25 ? "normal" : vixLevel < 30 ? "high" : "extreme",
    } : null,
    vixLevel,
  };
}

async function fetchNewsAnalysis(apiKey, today, etTime) {
  const prompt = `You are a pre-market trading analyst. Today is ${today}, ET time ${etTime}.

Do ONE focused web search for today's pre-market news, then respond immediately with JSON.
Search for: "stock market premarket news ${today} economic calendar earnings"

Respond with ONLY a JSON object. No markdown, no backticks. Start with { end with }:
{"items":{"econ":{"checked":true,"text":"Economic calendar detail."},"fed":{"checked":true,"text":"Fed speakers today."},"earnings":{"checked":true,"text":"Key overnight earnings."},"news":{"checked":true,"text":"Top overnight headline."},"futures":{"checked":true,"text":"Futures tone."},"spy-pm":{"checked":true,"text":"SPY pre-market tone."},"vix":{"checked":true,"text":"VIX context."},"trend":{"checked":true,"text":"SPY vs 9 EMA."},"levels":{"checked":true,"text":"Key support and resistance."},"gap":{"checked":true,"text":"Gap size and fill risk."}},"trade":{"bias":"BULLISH","direction":"CALL / BUY SPY","dir_sub":"Reason for bias","target_pct":"+75%","target_dollars":"+$750 options","stop_pct":"-45%","stop_dollars":"-$450 options","rationale":"One sentence rationale."},"summary":"Two sentence morning summary with trade recommendation."}

Trade rules: $1000 size, medium-high risk. BULLISH=CALL +75% target -45% stop. BEARISH=PUT same. Mixed=NO TRADE. VIX>25 stop -35%. VIX>30 size $500.`;

  let messages = [{ role: "user", content: prompt }];
  let current = null;

  for (let turn = 0; turn < 4; turn++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages,
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error("Claude API: " + data.error.message);
    current = data;
    messages.push({ role: "assistant", content: data.content });

    const toolUses = data.content.filter((b) => b.type === "tool_use");
    if (!toolUses.length) break;

    messages.push({
      role: "user",
      content: toolUses.map((b) => ({
        type: "tool_result",
        tool_use_id: b.id,
        content: "Search completed.",
      })),
    });
  }

  const texts = (current?.content || [])
    .filter((b) => b.type === "text" && b.text?.trim())
    .map((b) => b.text.trim());

  let raw = texts.join("\n").replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const js = raw.indexOf("{");
  const je = raw.lastIndexOf("}");
  if (js === -1 || je === -1) throw new Error("No JSON in response: " + raw.substring(0, 200));
  return JSON.parse(raw.substring(js, je + 1));
}

export default async function handler(req, res) {
  Object.entries(HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/New_York",
  });
  const etTime = new Date().toLocaleTimeString("en-US", {
    timeZone: "America/New_York", hour: "2-digit", minute: "2-digit",
  });

  try {
    // Fetch live prices AND news analysis in parallel
    const [prices, newsData] = await Promise.all([
      fetchLivePrices(),
      fetchNewsAnalysis(apiKey, today, etTime),
    ]);

    const { spyData, esData, vixData, vixLevel } = formatPrices(prices);

    // Adjust stops based on live VIX
    const stopPct  = vixLevel > 25 ? "-35%" : "-45%";
    const sizeNote = vixLevel > 30 ? "$500 max — extreme volatility" : "$1,000";

    const result = {
      futures: esData  || { value: "unavailable", raw: null, dir: "flat" },
      spy_pm:  spyData || { value: "unavailable", raw: null, dir: "flat" },
      vix:     vixData || { value: "unavailable", regime: "normal" },
      items: {
        ...newsData.items,
        // Prepend live prices to relevant checklist items
        futures:  { ...newsData.items?.futures,  text: esData  ? `ES ${esData.value} at ${esData.raw?.toFixed(2)}. ${newsData.items?.futures?.text || ""}` : newsData.items?.futures?.text },
        "spy-pm": { ...newsData.items?.["spy-pm"], text: spyData ? `SPY $${spyData.raw?.toFixed(2)} (${spyData.value}). ${newsData.items?.["spy-pm"]?.text || ""}` : newsData.items?.["spy-pm"]?.text },
        vix:      { ...newsData.items?.vix,      text: vixData  ? `VIX ${vixData.value} (${vixData.regime}). ${newsData.items?.vix?.text || ""}` : newsData.items?.vix?.text },
      },
      trade: {
        ...newsData.trade,
        stop_pct: stopPct,
        target_dollars: spyData ? `+$750 options / +$${(spyData.raw * 0.003).toFixed(2)} shares` : "+$750 options",
        stop_dollars:   spyData ? `-$${Math.round(1000 * Math.abs(parseFloat(stopPct)) / 100)} options / -$${(spyData.raw * 0.0015).toFixed(2)} shares` : "-$450 options",
      },
      summary: newsData.summary,
    };

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}