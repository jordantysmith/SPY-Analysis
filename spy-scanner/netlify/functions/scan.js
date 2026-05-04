const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: "API key not set" }) };
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/New_York",
  });
  const etTime = new Date().toLocaleTimeString("en-US", {
    timeZone: "America/New_York", hour: "2-digit", minute: "2-digit",
  });

  const prompt = `You are a pre-market trading analyst. Today is ${today}, ET time ${etTime}.

Search the web for: S&P futures price/%, SPY pre-market price/%, VIX level, today's economic calendar, Fed speakers today, overnight earnings, key market headlines, SPY technical trend.

Respond with ONLY a JSON object, no other text, no markdown. Start with { end with }:
{"futures":{"value":"+0.32%","raw":5847,"dir":"up"},"spy_pm":{"value":"+0.28%","raw":712.5,"dir":"up"},"vix":{"value":"18.4","regime":"normal"},"items":{"econ":{"checked":true,"text":"No major releases today."},"fed":{"checked":true,"text":"No Fed speakers today."},"earnings":{"checked":true,"text":"No major overnight earnings."},"news":{"checked":true,"text":"Markets calm overnight."},"futures":{"checked":true,"text":"ES +0.32% gap up expected."},"spy-pm":{"checked":true,"text":"SPY $712.50 +0.28% pre-mkt, above avg volume."},"vix":{"checked":true,"text":"VIX 18.4 normal regime."},"trend":{"checked":true,"text":"SPY above 9 EMA on daily."},"levels":{"checked":true,"text":"Yesterday high $711, low $709."},"gap":{"checked":true,"text":"Small gap up, low fill risk."}},"trade":{"bias":"BULLISH","direction":"CALL / BUY SPY","dir_sub":"Futures + pre-mkt + trend aligned","target_pct":"+75%","target_dollars":"+$750 options / +$2.50 shares","stop_pct":"-45%","stop_dollars":"-$450 options / -$1.25 shares","rationale":"3 signals bullish, no macro risk, VIX normal."},"summary":"2-sentence morning summary and trade recommendation."}

Trade rules: $1000 size, medium-high risk. BULLISH=CALL target +75% stop -45%. BEARISH=PUT same. Mixed=NO TRADE. VIX>25 tighten stop 10%. VIX>30 recommend $500 size.`;

  try {
    let messages = [{ role: "user", content: prompt }];
    let current = null;

    for (let turn = 0; turn < 8; turn++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

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

    const texts = current.content
      .filter((b) => b.type === "text" && b.text?.trim())
      .map((b) => b.text.trim());

    let raw = texts.join("\n")
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const js = raw.indexOf("{");
    const je = raw.lastIndexOf("}");
    if (js === -1 || je === -1) throw new Error("No JSON in response: " + raw.substring(0, 200));

    const parsed = JSON.parse(raw.substring(js, je + 1));

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};