import { useState, useEffect, useCallback } from "react";

const SECTIONS = [
  { label: "Macro & News", items: [
    { id: "econ",     title: "Economic calendar checked",      tag: "critical",       color: "#f03e3e", hint: "8:30 AM ET releases (CPI, jobs, GDP) cause the biggest moves." },
    { id: "fed",      title: "Fed speakers / FOMC events",     tag: "high impact",    color: "#f03e3e", hint: "Fed commentary can reverse intraday direction instantly." },
    { id: "earnings", title: "Major earnings overnight",       tag: "high impact",    color: "#f5a623", hint: "Big tech earnings (NVDA, AAPL, MSFT, AMZN) move the whole index." },
    { id: "news",     title: "Overnight headline risk",        tag: "context",        color: "#4d9fff", hint: "Geopolitical events, surprise data, breaking macro news." },
  ]},
  { label: "Futures & Pre-Market", items: [
    { id: "futures",  title: "S&P 500 futures direction",      tag: "primary signal", color: "#05d97c", hint: "Best pre-open signal. >±0.5% = strong open expected." },
    { id: "spy-pm",   title: "SPY pre-market price & volume",  tag: "primary signal", color: "#05d97c", hint: "High pre-mkt volume confirms the futures signal." },
    { id: "vix",      title: "VIX volatility regime",          tag: "risk sizing",    color: "#f5a623", hint: "<15 calm · 15–25 normal · >25 reduce size · >30 sit out" },
  ]},
  { label: "Technical Context", items: [
    { id: "trend",    title: "SPY vs 9 EMA on daily chart",    tag: "trend bias",     color: "#4d9fff", hint: "Above = bullish bias. Below = bearish bias." },
    { id: "levels",   title: "Key support & resistance",       tag: "levels",         color: "#4d9fff", hint: "Yesterday's high/low are the most important intraday levels." },
    { id: "gap",      title: "Gap assessment",                 tag: "gap risk",       color: "#f5a623", hint: "Gaps >0.5% often fill in the first hour — plan around them." },
  ]}
];

const TOTAL = SECTIONS.reduce((a, s) => a + s.items.length, 0);

function initState() {
  const s = {};
  SECTIONS.forEach(sec => sec.items.forEach(i => { s[i.id] = { checked: false, aiText: null }; }));
  return s;
}

function useETClock() {
  const [time, setTime] = useState({ clock: "--:--:--", status: "–", statusColor: "#3d4f63" });
  useEffect(() => {
    const tick = () => {
      const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
      const h = String(et.getHours()).padStart(2, "0");
      const m = String(et.getMinutes()).padStart(2, "0");
      const s = String(et.getSeconds()).padStart(2, "0");
      const mins = et.getHours() * 60 + et.getMinutes();
      const day = et.getDay();
      let status, statusColor;
      if (day === 0 || day === 6) { status = "WEEKEND — CLOSED"; statusColor = "#3d4f63"; }
      else if (mins < 240) { status = "OVERNIGHT"; statusColor = "#3d4f63"; }
      else if (mins < 570) { const d = 570 - mins; status = `PRE-MARKET · ${Math.floor(d/60)}h ${d%60}m to open`; statusColor = "#f5a623"; }
      else if (mins < 630) { status = "⚡ FIRST HOUR"; statusColor = "#05d97c"; }
      else if (mins < 960) { status = "MARKET OPEN"; statusColor = "#4d9fff"; }
      else { status = "AFTER HOURS"; statusColor = "#3d4f63"; }
      setTime({ clock: `${h}:${m}:${s}`, status, statusColor });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function App() {
  const [state, setState] = useState(initState);
  const [tickers, setTickers] = useState({ es: null, spy: null, vix: null });
  const [trade, setTrade] = useState(null);
  const [notes, setNotes] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("Searches live market data + news — run around 8:45 AM ET");
  const [scanColor, setScanColor] = useState("#3d4f63");
  const { clock, status, statusColor } = useETClock();

  const toggle = useCallback((id) => {
    setState(prev => ({ ...prev, [id]: { ...prev[id], checked: !prev[id].checked } }));
  }, []);

  const done = Object.values(state).filter(s => s.checked).length;
  const pct = done / TOTAL;

  const verdictColor = pct === 0 ? "#3d4f63" : pct < 0.5 ? "#f5a623" : pct < 0.8 ? "#4d9fff" : "#05d97c";
  const verdictMsg = pct === 0 ? "Run the AI scan to auto-assess pre-market conditions."
    : pct < 0.5 ? "Partial — review all sections before trading."
    : pct < 0.8 ? "Mostly clear. Confirm trade plan before entering."
    : pct < 1 ? "Nearly complete — confirm stops then enter with discipline."
    : "All clear. You have a plan — execute it and respect your stops.";

  const runScan = async () => {
    setScanning(true);
    setScanColor("#f5a623");
    const stepMsgs = ["Fetching S&P futures…","Checking SPY pre-market…","Reading VIX…","Scanning economic calendar…","Checking Fed schedule…","Reviewing overnight earnings…","Scanning headlines…","Assessing technicals…","Building trade plan…"];
    let si = 0;
    const stepTimer = setInterval(() => { setScanStatus(stepMsgs[si % stepMsgs.length]); si++; }, 2500);

    const today = new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric", timeZone:"America/New_York" });
    const etTime = new Date().toLocaleTimeString("en-US", { timeZone:"America/New_York", hour:"2-digit", minute:"2-digit" });

    const prompt = `You are a pre-market trading analyst. Today is ${today}, ET time ${etTime}.

Search the web for: S&P futures price/%, SPY pre-market price/%, VIX level, today's economic calendar, Fed speakers today, overnight earnings, key market headlines, SPY technical trend.

Respond with ONLY a JSON object, no other text, no markdown fences. Start with { end with }:
{"futures":{"value":"+0.32%","raw":5847,"dir":"up"},"spy_pm":{"value":"+0.28%","raw":712.5,"dir":"up"},"vix":{"value":"18.4","regime":"normal"},"items":{"econ":{"checked":true,"text":"No major releases today."},"fed":{"checked":true,"text":"No Fed speakers today."},"earnings":{"checked":true,"text":"No major overnight earnings."},"news":{"checked":true,"text":"Markets calm overnight."},"futures":{"checked":true,"text":"ES +0.32% — gap up expected."},"spy-pm":{"checked":true,"text":"SPY $712.50 +0.28% pre-mkt, above avg volume."},"vix":{"checked":true,"text":"VIX 18.4 — normal regime, full size ok."},"trend":{"checked":true,"text":"SPY above 9 EMA on daily. Bullish bias."},"levels":{"checked":true,"text":"Yesterday high $711, low $709. $714 next resistance."},"gap":{"checked":true,"text":"Small gap up ~$1.50, low fill risk."}},"trade":{"bias":"BULLISH","direction":"CALL / BUY SPY","dir_sub":"Futures + pre-mkt + trend aligned bullish","target_pct":"+75%","target_dollars":"+$750 on options / +$2.50 on shares","stop_pct":"-45%","stop_dollars":"-$450 on options / -$1.25 on shares","rationale":"3 primary signals bullish, no macro risk, VIX normal."},"summary":"Brief 2-sentence morning summary and trade recommendation."}

Rules: $1000 size, medium-high risk. BULLISH=CALL target +75% stop -45%. BEARISH=PUT same. Mixed signals=NO TRADE. VIX>25 tighten stop 10%. VIX>30 recommend $500 size.`;

    try {
      const r1 = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: prompt }] })
      });
      const d1 = await r1.json();
      if (d1.error) throw new Error("API: " + d1.error.message);

      let messages = [{ role: "user", content: prompt }, { role: "assistant", content: d1.content }];
      let current = d1;

      for (let i = 0; i < 7; i++) {
        const tools = current.content.filter(b => b.type === "tool_use");
        if (!tools.length) break;
        const results = tools.map(b => ({ type: "tool_result", tool_use_id: b.id, content: "Search results retrieved." }));
        messages.push({ role: "user", content: results });
        const rN = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000,
            tools: [{ type: "web_search_20250305", name: "web_search" }], messages })
        });
        const dN = await rN.json();
        if (dN.error) throw new Error("API: " + dN.error.message);
        messages.push({ role: "assistant", content: dN.content });
        current = dN;
      }

      clearInterval(stepTimer);
      const texts = current.content.filter(b => b.type === "text" && b.text?.trim()).map(b => b.text.trim());
      let raw = texts.join("\n").replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      if (!raw) throw new Error("No text in final API response");
      const js = raw.indexOf("{"), je = raw.lastIndexOf("}");
      if (js === -1 || je === -1) throw new Error("No JSON found in: " + raw.substring(0, 150));
      const parsed = JSON.parse(raw.substring(js, je + 1));

      // Apply tickers
      const newTickers = {};
      if (parsed.futures) newTickers.es = parsed.futures;
      if (parsed.spy_pm)  newTickers.spy = parsed.spy_pm;
      if (parsed.vix)     newTickers.vix = parsed.vix;
      setTickers(newTickers);

      // Apply checklist
      if (parsed.items) {
        setState(prev => {
          const next = { ...prev };
          Object.entries(parsed.items).forEach(([id, v]) => {
            if (next[id] !== undefined) next[id] = { checked: !!v.checked, aiText: v.text || null };
          });
          return next;
        });
      }

      if (parsed.trade) setTrade(parsed.trade);
      if (parsed.summary) setNotes(parsed.summary + (parsed.trade?.rationale ? "\n\nRationale: " + parsed.trade.rationale : ""));

      const etNow = new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" });
      setScanStatus("Scan complete — " + etNow + " ET");
      setScanColor("#05d97c");

    } catch (err) {
      clearInterval(stepTimer);
      setScanStatus("Error: " + err.message);
      setScanColor("#f03e3e");
      console.error("Scan error:", err);
    } finally {
      setScanning(false);
    }
  };

  const reset = () => {
    setState(initState());
    setTickers({ es: null, spy: null, vix: null });
    setTrade(null);
    setNotes("");
    setScanStatus("Searches live market data + news — run around 8:45 AM ET");
    setScanColor("#3d4f63");
  };

  const mono = { fontFamily: "'JetBrains Mono', 'Courier New', monospace" };
  const bg = "#07090d", bg2 = "#0e1117", bg3 = "#141820";
  const border = "#1c2333", border2 = "#263040";
  const text = "#dde4f0", text2 = "#7a8899", text3 = "#3d4f63";

  const TickerCard = ({ label, data }) => {
    const dir = data?.dir;
    const valColor = dir === "up" ? "#05d97c" : dir === "down" ? "#f03e3e" : "#f5a623";
    return (
      <div style={{ background: bg2, border: `1px solid ${data ? border2 : border}`, borderRadius: 6, padding: "0.7rem 0.9rem", transition: "border-color 0.3s" }}>
        <div style={{ ...mono, fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: text3, marginBottom: 4 }}>{label}</div>
        <div style={{ ...mono, fontSize: 17, fontWeight: 700, color: data ? valColor : text3, lineHeight: 1 }}>{data?.value || "—"}</div>
        <div style={{ ...mono, fontSize: 8, color: text3, marginTop: 3 }}>
          {data ? (data.raw ? (typeof data.raw === "number" && data.raw > 100 ? `~${data.raw.toLocaleString()}` : `$${Number(data.raw).toFixed(2)}`) : (data.regime || "")) : "awaiting scan"}
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: bg, minHeight: "100vh", color: text, fontFamily: "'Syne', sans-serif", padding: "1.25rem", fontSize: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: `1px solid ${border}` }}>
        <div>
          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: text3, marginBottom: 5, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#05d97c", display: "inline-block", animation: "blink 2s infinite" }}/>AI-Powered · Live Scan
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>SPY Pre-Market</div>
          <div style={{ ...mono, fontSize: 9, color: text3, marginTop: 4 }}>$1,000 · medium-high risk · auto-scan</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ ...mono, fontSize: 20, fontWeight: 700, letterSpacing: "0.04em" }}>{clock}</div>
          <div style={{ ...mono, fontSize: 9, marginTop: 3, color: statusColor }}>{status}</div>
        </div>
      </div>

      {/* Scan Button */}
      <button onClick={runScan} disabled={scanning} style={{ width: "100%", padding: "0.85rem", background: "#05d97c14", border: "1px solid #05d97c30", borderRadius: 7, color: "#05d97c", ...mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: scanning ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: "0.5rem", opacity: scanning ? 0.6 : 1 }}>
        {scanning ? "⏳" : "⚡"} {scanning ? "Scanning…" : "Run AI Pre-Market Scan"}
      </button>
      <div style={{ ...mono, fontSize: 9, color: scanColor, textAlign: "center", marginBottom: "1rem", minHeight: 14 }}>{scanStatus}</div>

      {/* Tickers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: "1.25rem" }}>
        <TickerCard label="S&P Futures /ES" data={tickers.es} />
        <TickerCard label="SPY Pre-mkt" data={tickers.spy} />
        <TickerCard label="VIX" data={tickers.vix} />
      </div>

      {/* Checklist */}
      {SECTIONS.map(sec => {
        const secDone = sec.items.filter(i => state[i.id].checked).length;
        return (
          <div key={sec.label}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "1.5rem 0 0.5rem" }}>
              <div style={{ flex: 1, height: 1, background: border }} />
              <div style={{ ...mono, fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: text3 }}>{sec.label}</div>
              <div style={{ ...mono, fontSize: 8, color: text3 }}>{secDone}/{sec.items.length}</div>
              <div style={{ flex: 1, height: 1, background: border }} />
            </div>
            {sec.items.map((item, idx) => {
              const s = state[item.id];
              return (
                <div key={item.id} onClick={() => toggle(item.id)} style={{ display: "flex", gap: 9, padding: "0.65rem 0.4rem", borderRadius: 4, borderBottom: `1px solid ${border}`, alignItems: "flex-start", cursor: "pointer", background: "transparent", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = bg2}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 16, height: 16, border: `1.5px solid ${s.checked ? "#05d97c" : border2}`, borderRadius: 3, flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", background: s.checked ? "#05d97c" : "transparent", transition: "all 0.15s" }}>
                    {s.checked && <div style={{ width: 7, height: 4, borderLeft: "2px solid #07090d", borderBottom: "2px solid #07090d", transform: "rotate(-45deg) translate(1px,-1px)" }}/>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: s.checked ? text3 : text, textDecoration: s.checked ? "line-through" : "none" }}>{item.title}</span>
                      <span style={{ ...mono, fontSize: 7, fontWeight: 700, letterSpacing: "0.05em", padding: "2px 5px", borderRadius: 3, textTransform: "uppercase", background: item.color + "14", color: item.color, border: `1px solid ${item.color}25` }}>{item.tag}</span>
                      {s.aiText && <span style={{ ...mono, fontSize: 7, padding: "2px 5px", borderRadius: 3, background: "#05d97c0c", color: "#05d97c", border: "1px solid #05d97c1c" }}>AI</span>}
                    </div>
                    {s.aiText
                      ? <div style={{ ...mono, fontSize: 9, color: s.checked ? text3 : text2, lineHeight: 1.55 }}>{s.aiText}</div>
                      : <div style={{ fontSize: 10, color: text3, lineHeight: 1.5 }}>{item.hint}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Trade Plan */}
      <div style={{ background: bg2, border: `1px solid ${border2}`, borderRadius: 7, marginTop: "1.5rem", overflow: "hidden" }}>
        <div style={{ padding: "0.75rem 1.1rem", borderBottom: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          <span style={{ ...mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: text3 }}>AI Trade Plan · $1,000 · medium-high risk</span>
          {trade && <span style={{ ...mono, fontSize: 7, fontWeight: 700, padding: "2px 7px", borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.05em", background: trade.bias?.includes("BULL") ? "#05d97c14" : trade.bias?.includes("BEAR") ? "#f03e3e14" : "#f5a62314", color: trade.bias?.includes("BULL") ? "#05d97c" : trade.bias?.includes("BEAR") ? "#f03e3e" : "#f5a623", border: `1px solid ${trade.bias?.includes("BULL") ? "#05d97c25" : trade.bias?.includes("BEAR") ? "#f03e3e25" : "#f5a62325"}` }}>{trade.bias}</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {[
            { label: "Direction", val: trade?.direction || "—", sub: trade?.dir_sub || "run scan", color: trade?.bias?.includes("BULL") ? "#05d97c" : trade?.bias?.includes("BEAR") ? "#f03e3e" : text3 },
            { label: "Position Size", val: "$1,000", sub: "fixed · medium-high risk", color: text },
            { label: "Profit Target", val: trade?.target_pct || "—", sub: trade?.target_dollars || "—", color: "#05d97c" },
            { label: "Stop Loss", val: trade?.stop_pct || "—", sub: trade?.stop_dollars || "—", color: "#f03e3e" },
          ].map((cell, i) => (
            <div key={i} style={{ padding: "0.8rem 1.1rem", borderRight: i % 2 === 0 ? `1px solid ${border}` : "none", borderBottom: i < 2 ? `1px solid ${border}` : "none" }}>
              <div style={{ ...mono, fontSize: 8, color: text3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>{cell.label}</div>
              <div style={{ ...mono, fontSize: 16, fontWeight: 700, color: cell.color }}>{cell.val}</div>
              <div style={{ ...mono, fontSize: 8, color: text3, marginTop: 2 }}>{cell.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Verdict */}
      <div style={{ marginTop: "1.25rem", border: `1px solid ${done === TOTAL ? "#05d97c30" : border}`, borderRadius: 7, padding: "1rem 1.1rem", background: bg2, transition: "border-color 0.4s" }}>
        <div style={{ ...mono, fontSize: 28, fontWeight: 700 }}>{done}</div>
        <div style={{ ...mono, fontSize: 9, color: text3, marginTop: 2 }}>of {TOTAL} items assessed</div>
        <div style={{ fontSize: 11, color: done === TOTAL ? "#05d97c" : text2, lineHeight: 1.6, marginTop: "0.5rem" }}>{verdictMsg}</div>
        <div style={{ height: 2, background: border, borderRadius: 2, marginTop: "0.75rem", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct * 100}%`, background: verdictColor, borderRadius: 2, transition: "width 0.5s ease, background 0.5s ease" }}/>
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginTop: "1rem", background: bg2, border: `1px solid ${border}`, borderRadius: 7, padding: "0.9rem 1.1rem" }}>
        <div style={{ ...mono, fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: text3, marginBottom: "0.4rem" }}>AI Summary · Notes</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="AI summary appears here after scan…" style={{ background: "transparent", border: "none", color: text2, ...mono, fontSize: 10, width: "100%", resize: "none", outline: "none", lineHeight: 1.65, minHeight: 56 }}/>
      </div>

      <button onClick={reset} style={{ ...mono, fontSize: 9, color: text3, background: "none", border: `1px solid ${border}`, borderRadius: 4, padding: "5px 12px", cursor: "pointer", marginTop: "0.85rem", letterSpacing: "0.05em" }}>↺ Reset</button>
      <div style={{ ...mono, fontSize: 8, color: text3, marginTop: "1rem", lineHeight: 1.55, padding: "0.65rem 0.9rem", border: `1px solid ${border}`, borderRadius: 5 }}>⚠ Not financial advice. Informational only. Always apply your own judgment. Never risk more than you can afford to lose.</div>

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.15}}`}</style>
    </div>
  );
}
