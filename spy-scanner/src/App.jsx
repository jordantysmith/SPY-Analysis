import { useState, useEffect, useCallback } from "react";

const SECTIONS = [
  { label: "Macro & News", items: [
    { id: "econ",     title: "Economic calendar checked",     tag: "critical",       color: "#f03e3e", hint: "8:30 AM ET releases (CPI, jobs, GDP) cause the biggest moves." },
    { id: "fed",      title: "Fed speakers / FOMC events",    tag: "high impact",    color: "#f03e3e", hint: "Fed commentary can reverse intraday direction instantly." },
    { id: "earnings", title: "Major earnings overnight",      tag: "high impact",    color: "#f5a623", hint: "Big tech earnings (NVDA, AAPL, MSFT, AMZN) move the whole index." },
    { id: "news",     title: "Overnight headline risk",       tag: "context",        color: "#4d9fff", hint: "Geopolitical events, surprise data, breaking macro news." },
  ]},
  { label: "Futures & Pre-Market", items: [
    { id: "futures",  title: "S&P 500 futures direction",     tag: "primary signal", color: "#05d97c", hint: "Best pre-open signal. >±0.5% = strong open expected." },
    { id: "spy-pm",   title: "SPY pre-market price & volume", tag: "primary signal", color: "#05d97c", hint: "High pre-mkt volume confirms the futures signal." },
    { id: "vix",      title: "VIX volatility regime",         tag: "risk sizing",    color: "#f5a623", hint: "<15 calm · 15–25 normal · >25 reduce size · >30 sit out" },
  ]},
  { label: "Technical Context", items: [
    { id: "trend",    title: "SPY vs 9 EMA on daily chart",   tag: "trend bias",     color: "#4d9fff", hint: "Above 9 EMA = bullish bias. Below = bearish bias." },
    { id: "levels",   title: "Key support & resistance",      tag: "levels",         color: "#4d9fff", hint: "Yesterday's high/low are the most important intraday levels." },
    { id: "gap",      title: "Gap assessment",                tag: "gap risk",       color: "#f5a623", hint: "Gaps >0.5% often fill in the first hour — plan around them." },
  ]}
];

const TOTAL = SECTIONS.reduce((a, s) => a + s.items.length, 0);
const M = { fontFamily: "'Courier New', monospace" };
const BG = "#07090d", BG2 = "#0e1117", BDR = "#1c2333", BDR2 = "#263040";
const TX = "#dde4f0", TX2 = "#7a8899", TX3 = "#3d4f63";

function initSt() {
  const s = {};
  SECTIONS.forEach(sec => sec.items.forEach(i => { s[i.id] = { checked: false, ai: null }; }));
  return s;
}

export default function App() {
  const [st, setSt] = useState(initSt);
  const [tickers, setTickers] = useState({ es: null, spy: null, vix: null });
  const [trade, setTrade] = useState(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("Run around 8:45 AM ET each morning after the 8:30 data drops");
  const [msgC, setMsgC] = useState(TX3);
  const [clock, setClock] = useState("--:--:--");
  const [mktStatus, setMktStatus] = useState({ text: "–", color: TX3 });

  useEffect(() => {
    const tick = () => {
      const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
      setClock(`${String(et.getHours()).padStart(2,"0")}:${String(et.getMinutes()).padStart(2,"0")}:${String(et.getSeconds()).padStart(2,"0")}`);
      const m = et.getHours() * 60 + et.getMinutes(), d = et.getDay();
      if (d===0||d===6) setMktStatus({ text:"WEEKEND — CLOSED", color:TX3 });
      else if (m<240)   setMktStatus({ text:"OVERNIGHT", color:TX3 });
      else if (m<570)   { const r=570-m; setMktStatus({ text:`PRE-MARKET · ${Math.floor(r/60)}h ${r%60}m to open`, color:"#f5a623" }); }
      else if (m<630)   setMktStatus({ text:"⚡ FIRST HOUR", color:"#05d97c" });
      else if (m<960)   setMktStatus({ text:"MARKET OPEN", color:"#4d9fff" });
      else              setMktStatus({ text:"AFTER HOURS", color:TX3 });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const toggle = useCallback(id => {
    setSt(p => ({ ...p, [id]: { ...p[id], checked: !p[id].checked } }));
  }, []);

  const done = Object.values(st).filter(s => s.checked).length;
  const pct = done / TOTAL;
  const vColor = pct===0?"#3d4f63":pct<0.5?"#f5a623":pct<0.8?"#4d9fff":"#05d97c";
  const vMsg = pct===0?"Run the AI scan to auto-assess pre-market conditions."
    :pct<0.5?"Partial — review all sections before trading."
    :pct<0.8?"Mostly clear. Confirm trade plan before entering."
    :pct<1?"Nearly complete — confirm stops then enter with discipline."
    :"All clear. You have a plan — execute it and respect your stops.";

  const applyResults = (p) => {
    if (p.futures) setTickers(t => ({ ...t, es: p.futures }));
    if (p.spy_pm)  setTickers(t => ({ ...t, spy: p.spy_pm }));
    if (p.vix)     setTickers(t => ({ ...t, vix: p.vix }));
    if (p.items) setSt(prev => {
      const next = { ...prev };
      Object.entries(p.items).forEach(([id, v]) => { if (next[id]) next[id] = { checked: !!v.checked, ai: v.text||null }; });
      return next;
    });
    if (p.trade) setTrade(p.trade);
    if (p.summary) setNotes(p.summary + (p.trade?.rationale ? "\n\nRationale: " + p.trade.rationale : ""));
  };

  const runScan = async () => {
    setBusy(true); setMsgC("#f5a623");
    setMsg("Scanning markets…");

    try {
      const r1 = await fetch("/.netlify/functions/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r1.ok) throw new Error(`Function returned ${r1.status} — run via netlify dev locally or check Netlify logs`);
      const parsed = await r1.json();
      if (parsed.error) throw new Error(parsed.error);
      applyResults(parsed);
      const t = new Date().toLocaleTimeString("en-US",{timeZone:"America/New_York",hour:"2-digit",minute:"2-digit"});
      setMsg("Scan complete — " + t + " ET"); setMsgC("#05d97c");
    } catch(e) {
      setMsg("Error: " + e.message); setMsgC("#f03e3e");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSt(initSt()); setTickers({es:null,spy:null,vix:null}); setTrade(null); setNotes("");
    setMsg("Run around 8:45 AM ET each morning after the 8:30 data drops"); setMsgC(TX3);
  };

  const Tc = ({ label, d }) => {
    const vc = d?.dir==="up"?"#05d97c":d?.dir==="down"?"#f03e3e":"#f5a623";
    const sub = d ? (d.raw ? (Number(d.raw)>500?`~${Number(d.raw).toLocaleString()}`:`$${Number(d.raw).toFixed(2)}`) : (d.regime||"")) : "awaiting scan";
    return (
      <div style={{background:BG2,border:`1px solid ${d?BDR2:BDR}`,borderRadius:6,padding:"0.7rem 0.85rem"}}>
        <div style={{...M,fontSize:8,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:TX3,marginBottom:4}}>{label}</div>
        <div style={{...M,fontSize:17,fontWeight:700,color:d?vc:TX3,lineHeight:1}}>{d?.value||"—"}</div>
        <div style={{...M,fontSize:8,color:TX3,marginTop:3}}>{sub}</div>
      </div>
    );
  };

  const biasColor = trade?.bias?.includes("BULL")?"#05d97c":trade?.bias?.includes("BEAR")?"#f03e3e":"#f5a623";

  return (
    <div style={{background:BG,minHeight:"100vh",color:TX,fontFamily:"'Segoe UI',sans-serif",padding:"1.25rem",fontSize:14}}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.15}} *{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1.4rem",paddingBottom:"1rem",borderBottom:`1px solid ${BDR}`}}>
        <div>
          <div style={{...M,fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:TX3,marginBottom:5,display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#05d97c",display:"inline-block",animation:"blink 2s infinite"}}/>
            AI-Powered · Live Scan
          </div>
          <div style={{fontSize:21,fontWeight:700,letterSpacing:"-0.02em"}}>SPY Pre-Market</div>
          <div style={{...M,fontSize:9,color:TX3,marginTop:4}}>$1,000 · medium-high risk · auto-scan</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{...M,fontSize:19,fontWeight:700,letterSpacing:"0.04em"}}>{clock}</div>
          <div style={{...M,fontSize:9,marginTop:3,color:mktStatus.color}}>{mktStatus.text}</div>
        </div>
      </div>

      {/* Scan button */}
      <button onClick={runScan} disabled={busy} style={{width:"100%",padding:"0.85rem",background:"#05d97c12",border:"1px solid #05d97c28",borderRadius:7,color:"#05d97c",...M,fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:busy?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:"0.45rem",opacity:busy?0.55:1}}>
        {busy?"⏳":"⚡"} {busy?"Scanning markets…":"Run AI Pre-Market Scan"}
      </button>
      <div style={{...M,fontSize:9,color:msgC,textAlign:"center",marginBottom:"1.1rem",minHeight:14}}>{msg}</div>

      {/* Tickers */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:"1.25rem"}}>
        <Tc label="S&P Futures /ES" d={tickers.es}/>
        <Tc label="SPY Pre-mkt" d={tickers.spy}/>
        <Tc label="VIX" d={tickers.vix}/>
      </div>

      {/* Checklist sections */}
      {SECTIONS.map(sec => {
        const secDone = sec.items.filter(i => st[i.id].checked).length;
        return (
          <div key={sec.label}>
            <div style={{display:"flex",alignItems:"center",gap:8,margin:"1.4rem 0 0.45rem"}}>
              <div style={{flex:1,height:1,background:BDR}}/>
              <div style={{...M,fontSize:8,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:TX3}}>{sec.label}</div>
              <div style={{...M,fontSize:8,color:TX3}}>{secDone}/{sec.items.length}</div>
              <div style={{flex:1,height:1,background:BDR}}/>
            </div>
            {sec.items.map(item => {
              const s = st[item.id];
              return (
                <div key={item.id} onClick={()=>toggle(item.id)}
                  style={{display:"flex",gap:9,padding:"0.62rem 0.4rem",borderRadius:4,borderBottom:`1px solid ${BDR}`,alignItems:"flex-start",cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.background=BG2}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{width:16,height:16,border:`1.5px solid ${s.checked?"#05d97c":BDR2}`,borderRadius:3,flexShrink:0,marginTop:1,display:"flex",alignItems:"center",justifyContent:"center",background:s.checked?"#05d97c":"transparent",transition:"all 0.15s"}}>
                    {s.checked&&<div style={{width:7,height:4,borderLeft:"2px solid #07090d",borderBottom:"2px solid #07090d",transform:"rotate(-45deg) translate(1px,-1px)"}}/>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:2}}>
                      <span style={{fontSize:12,fontWeight:500,color:s.checked?TX3:TX,textDecoration:s.checked?"line-through":"none"}}>{item.title}</span>
                      <span style={{...M,fontSize:7,fontWeight:700,letterSpacing:"0.05em",padding:"2px 5px",borderRadius:3,textTransform:"uppercase",background:item.color+"12",color:item.color,border:`1px solid ${item.color}22`}}>{item.tag}</span>
                      {s.ai&&<span style={{...M,fontSize:7,padding:"2px 5px",borderRadius:3,background:"#05d97c0a",color:"#05d97c",border:"1px solid #05d97c18"}}>AI</span>}
                    </div>
                    {s.ai
                      ? <div style={{...M,fontSize:9,color:s.checked?TX3:TX2,lineHeight:1.55}}>{s.ai}</div>
                      : <div style={{fontSize:10,color:TX3,lineHeight:1.5}}>{item.hint}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Trade plan */}
      <div style={{background:BG2,border:`1px solid ${BDR2}`,borderRadius:7,marginTop:"1.4rem",overflow:"hidden"}}>
        <div style={{padding:"0.72rem 1.1rem",borderBottom:`1px solid ${BDR}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
          <span style={{...M,fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:TX3}}>AI Trade Plan · $1,000 · medium-high risk</span>
          {trade&&<span style={{...M,fontSize:7,fontWeight:700,padding:"2px 7px",borderRadius:3,textTransform:"uppercase",background:biasColor+"12",color:biasColor,border:`1px solid ${biasColor}22`}}>{trade.bias}</span>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}>
          {[
            {lbl:"Direction",val:trade?.direction||"—",sub:trade?.dir_sub||"run scan",vc:trade?biasColor:TX3},
            {lbl:"Position Size",val:"$1,000",sub:"fixed · medium-high risk",vc:TX},
            {lbl:"Profit Target",val:trade?.target_pct||"—",sub:trade?.target_dollars||"—",vc:"#05d97c"},
            {lbl:"Stop Loss",val:trade?.stop_pct||"—",sub:trade?.stop_dollars||"—",vc:"#f03e3e"},
          ].map((c,i)=>(
            <div key={i} style={{padding:"0.78rem 1.1rem",borderRight:i%2===0?`1px solid ${BDR}`:"none",borderBottom:i<2?`1px solid ${BDR}`:"none"}}>
              <div style={{...M,fontSize:8,color:TX3,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:4}}>{c.lbl}</div>
              <div style={{...M,fontSize:15,fontWeight:700,color:c.vc}}>{c.val}</div>
              <div style={{...M,fontSize:8,color:TX3,marginTop:2}}>{c.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Verdict */}
      <div style={{marginTop:"1.25rem",border:`1px solid ${done===TOTAL?"#05d97c28":BDR}`,borderRadius:7,padding:"1rem 1.1rem",background:BG2,transition:"border-color 0.4s"}}>
        <div style={{...M,fontSize:27,fontWeight:700}}>{done}</div>
        <div style={{...M,fontSize:9,color:TX3,marginTop:2}}>of {TOTAL} items assessed</div>
        <div style={{fontSize:11,color:done===TOTAL?"#05d97c":TX2,lineHeight:1.6,marginTop:"0.5rem"}}>{vMsg}</div>
        <div style={{height:2,background:BDR,borderRadius:2,marginTop:"0.75rem",overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct*100}%`,background:vColor,borderRadius:2,transition:"width 0.5s ease, background 0.5s ease"}}/>
        </div>
      </div>

      {/* Notes */}
      <div style={{marginTop:"1rem",background:BG2,border:`1px solid ${BDR}`,borderRadius:7,padding:"0.9rem 1.1rem"}}>
        <div style={{...M,fontSize:8,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:TX3,marginBottom:"0.4rem"}}>AI Summary · Notes</div>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="AI summary appears here after scan…"
          style={{background:"transparent",border:"none",color:TX2,...M,fontSize:10,width:"100%",resize:"none",outline:"none",lineHeight:1.65,minHeight:56}}/>
      </div>

      <button onClick={reset} style={{...M,fontSize:9,color:TX3,background:"none",border:`1px solid ${BDR}`,borderRadius:4,padding:"5px 12px",cursor:"pointer",marginTop:"0.85rem",letterSpacing:"0.05em"}}>↺ Reset for new session</button>
      <div style={{...M,fontSize:8,color:TX3,marginTop:"1rem",lineHeight:1.55,padding:"0.65rem 0.9rem",border:`1px solid ${BDR}`,borderRadius:5}}>⚠ Not financial advice. Informational only. Always apply your own judgment. Never risk more than you can afford to lose.</div>
    </div>
  );
}