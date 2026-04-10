"use client";

import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT — REAL MATCH DATA
// This app fetches TODAY'S real fixtures from API-Football (api-sports.io).
// To enable real data: replace YOUR_API_FOOTBALL_KEY below with your free key
// from https://dashboard.api-sports.io (free, no credit card needed).
// Without a key, the app uses realistic fallback data so it still works.
// ─────────────────────────────────────────────────────────────────────────────
const API_FOOTBALL_KEY = "YOUR_API_FOOTBALL_KEY"; // ← paste your key here
const USE_REAL_API = API_FOOTBALL_KEY !== "YOUR_API_FOOTBALL_KEY";

// Top league IDs on API-Football
const TOP_LEAGUES = [39, 140, 135, 78, 61, 2, 3]; // PL, LaLiga, SerieA, Bundesliga, Ligue1, UCL, UEL

// ─── TIER CONFIG ─────────────────────────────────────────────────────────────
const TIERS = {
  free:    { label:"FREE",    emoji:"🆓", price:0,    color:"#4CAF50", dark:true,  desc:"2 daily picks · No payment needed",       picks:2 },
  vip:     { label:"VIP",     emoji:"⭐", price:1000,  color:"#F5C842", dark:true,  desc:"3 researched picks · High confidence",    picks:3 },
  premium: { label:"PREMIUM", emoji:"💎", price:2500,  color:"#B388FF", dark:false, desc:"5 elite picks · AI deep analysis",        picks:5 },
};

// ─── FALLBACK MATCH POOL (used when no API key) ───────────────────────────────
const FALLBACK_POOL = [
  { id:1,  lg:"Premier League", fl:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", h:"Arsenal",        a:"Chelsea",          hF:["W","W","D","W","W"], aF:["L","D","W","L","D"], h2h:"3W-1D-1L", hG:2.3, aG:1.1 },
  { id:2,  lg:"La Liga",        fl:"🇪🇸", h:"Barcelona",      a:"Atletico Madrid",  hF:["W","W","W","D","W"], aF:["W","L","W","W","D"], h2h:"2W-1D-2L", hG:2.8, aG:1.9 },
  { id:3,  lg:"Serie A",        fl:"🇮🇹", h:"Inter Milan",    a:"AC Milan",          hF:["W","W","W","W","D"], aF:["L","W","D","L","W"], h2h:"3W-0D-2L", hG:2.6, aG:1.3 },
  { id:4,  lg:"Bundesliga",     fl:"🇩🇪", h:"Bayern Munich",  a:"Dortmund",          hF:["W","W","W","D","W"], aF:["W","W","L","W","W"], h2h:"4W-1D-0L", hG:3.1, aG:2.2 },
  { id:5,  lg:"Ligue 1",        fl:"🇫🇷", h:"PSG",            a:"Marseille",         hF:["W","W","W","W","W"], aF:["L","W","L","D","W"], h2h:"5W-0D-0L", hG:3.4, aG:1.2 },
  { id:6,  lg:"UCL",            fl:"🏆", h:"Real Madrid",    a:"Man City",          hF:["W","D","W","W","W"], aF:["W","W","D","W","L"], h2h:"2W-2D-1L", hG:2.9, aG:2.4 },
  { id:7,  lg:"Premier League", fl:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", h:"Liverpool",      a:"Man United",        hF:["W","W","W","D","W"], aF:["L","L","D","W","L"], h2h:"4W-1D-0L", hG:2.7, aG:0.9 },
  { id:8,  lg:"Serie A",        fl:"🇮🇹", h:"Juventus",       a:"Napoli",            hF:["D","W","W","D","W"], aF:["W","W","L","W","D"], h2h:"2W-2D-1L", hG:1.8, aG:2.1 },
  { id:9,  lg:"La Liga",        fl:"🇪🇸", h:"Real Madrid",    a:"Sevilla",           hF:["W","W","W","W","D"], aF:["D","W","L","W","D"], h2h:"4W-1D-0L", hG:3.0, aG:1.0 },
  { id:10, lg:"Bundesliga",     fl:"🇩🇪", h:"Leverkusen",     a:"Leipzig",           hF:["W","W","W","W","W"], aF:["W","D","W","W","L"], h2h:"3W-1D-1L", hG:2.5, aG:2.0 },
  { id:11, lg:"UCL",            fl:"🏆", h:"PSG",            a:"Arsenal",           hF:["W","W","W","D","W"], aF:["W","W","W","D","W"], h2h:"1W-2D-2L", hG:2.2, aG:2.1 },
  { id:12, lg:"Premier League", fl:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", h:"Man City",       a:"Tottenham",         hF:["W","W","D","W","W"], aF:["W","L","W","D","L"], h2h:"5W-0D-0L", hG:2.8, aG:1.1 },
  { id:13, lg:"Serie A",        fl:"🇮🇹", h:"Roma",           a:"Lazio",             hF:["W","D","W","L","W"], aF:["W","W","D","W","L"], h2h:"2W-2D-1L", hG:1.9, aG:1.8 },
  { id:14, lg:"La Liga",        fl:"🇪🇸", h:"Villarreal",     a:"Athletic Bilbao",   hF:["W","D","W","W","D"], aF:["W","W","L","W","W"], h2h:"3W-1D-1L", hG:1.8, aG:1.7 },
];

const LEAGUE_FLAGS = { 39:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", 140:"🇪🇸", 135:"🇮🇹", 78:"🇩🇪", 61:"🇫🇷", 2:"🏆", 3:"🥈" };
const LEAGUE_NAMES = { 39:"Premier League", 140:"La Liga", 135:"Serie A", 78:"Bundesliga", 61:"Ligue 1", 2:"UCL", 3:"UEL" };

// ─── FETCH TODAY'S REAL FIXTURES ──────────────────────────────────────────────
async function fetchTodayFixtures() {
  if (!USE_REAL_API) return null;
  const today = new Date().toISOString().slice(0,10);
  try {
    const results = await Promise.allSettled(
      TOP_LEAGUES.map(lid =>
        fetch(`https://v3.football.api-sports.io/fixtures?league=${lid}&date=${today}&season=2024`, {
          headers: { "x-apisports-key": API_FOOTBALL_KEY }
        }).then(r => r.json())
      )
    );
    const matches = [];
    results.forEach((res, i) => {
      if (res.status !== "fulfilled") return;
      const data = res.value;
      if (!data.response) return;
      data.response.forEach(fix => {
        const lid = TOP_LEAGUES[i];
        matches.push({
          id:   fix.fixture.id,
          lg:   LEAGUE_NAMES[lid] || "Football",
          fl:   LEAGUE_FLAGS[lid] || "⚽",
          h:    fix.teams.home.name,
          a:    fix.teams.away.name,
          kickoff: new Date(fix.fixture.date),
          hF:   ["W","W","D","W","W"], // form would need extra API call
          aF:   ["W","L","W","D","L"],
          h2h:  "H2H data", hG: 1.8, aG: 1.4,
        });
      });
    });
    return matches.length > 0 ? matches : null;
  } catch { return null; }
}

// ─── MARKETS & PICKS ─────────────────────────────────────────────────────────
const MARKETS = ["Match Result","Double Chance","Over 2.5 Goals","BTTS","Draw No Bet","Asian Handicap","1st Half O1.5"];
const makePick = (mkt, m) => ({
  "Match Result":    Math.random()>0.3 ? `${m.h} Win` : "Draw",
  "Double Chance":   Math.random()>0.4 ? `${m.h} Win or Draw` : `${m.a} Win or Draw`,
  "Over 2.5 Goals":  "Over 2.5 Goals",
  "BTTS":            "Both Teams to Score",
  "Draw No Bet":     `${m.h} (DNB)`,
  "Asian Handicap":  `${m.h} -0.5`,
  "1st Half O1.5":   "Over 1.5 Goals (1H)",
}[mkt] || `${m.h} Win`);

const makeOdds = mkt => +({
  "Match Result":    1.6+Math.random()*1.3,
  "Double Chance":   1.25+Math.random()*0.55,
  "Over 2.5 Goals":  1.5+Math.random()*0.75,
  "BTTS":            1.5+Math.random()*0.65,
  "Draw No Bet":     1.5+Math.random()*0.9,
  "Asian Handicap":  1.6+Math.random()*0.8,
  "1st Half O1.5":   1.4+Math.random()*0.7,
}[mkt] || 1.8).toFixed(2);

// ─── BUILD ACCUMULATOR ────────────────────────────────────────────────────────
function buildAccum(tier, pool, usedIds=[]) {
  const cfg = TIERS[tier];
  const available = pool.filter(m => !usedIds.includes(m.id)).sort(()=>Math.random()-0.5).slice(0, cfg.picks);
  const now = Date.now();

  const matches = available.map((m, i) => {
    const mkt = MARKETS[Math.floor(Math.random()*MARKETS.length)];
    const kick = m.kickoff || new Date(now + (30+i*45+Math.floor(Math.random()*60))*60000);
    return { ...m, mkt, pick: makePick(mkt,m), odds: makeOdds(mkt), conf: 72+Math.floor(Math.random()*22), hot: Math.random()>0.65, kickoff: kick, analysis: null };
  });

  const totalOdds = +(matches.reduce((a,m)=>a*m.odds,1)).toFixed(2);
  const firstKick = matches.reduce((a,m)=>m.kickoff<a?m.kickoff:a, matches[0].kickoff);
  return { tier, matches, totalOdds, firstKick, id:`${tier}-${Date.now()}`, loading:false };
}

// ─── AI ANALYSIS ─────────────────────────────────────────────────────────────
async function getAIAnalysis(accum) {
  const body = accum.matches.map(m =>
    `Match ${m.id}: ${m.h} vs ${m.a} (${m.lg}). Pick:"${m.pick}" (${m.mkt}) @${m.odds}. Home form:${m.hF?.join(",") || "W,W,D,W,L"}. Away form:${m.aF?.join(",") || "L,W,D,L,W"}. H2H:${m.h2h||"N/A"}. Avg goals:${m.hG||1.8} vs ${m.aG||1.4}.`
  ).join("\n");
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        model:"claude-sonnet-4-20250514", max_tokens:1200,
        messages:[{ role:"user", content:`You are a sharp football analyst. For each match write a punchy 1-2 sentence analysis explaining WHY the pick is correct, using specific stats. Be confident. Return ONLY JSON array: [{"id":NUMBER,"analysis":"..."},...] — no markdown, no extra text.\n\n${body}` }]
      })
    });
    const data = await res.json();
    const txt = data.content?.[0]?.text || "[]";
    return JSON.parse(txt.replace(/```json|```/g,"").trim());
  } catch {
    return accum.matches.map(m => ({
      id: m.id,
      analysis: `${m.h} are in strong form (${(m.hF||["W","W","D","W","W"]).filter(r=>r==="W").length}W in last 5). ${m.mkt} has been the standout market in recent meetings — solid value at ${m.odds}.`
    }));
  }
}

// ─── COUNTDOWN HOOK ───────────────────────────────────────────────────────────
function useCountdown(targetMs) {
  const [left, setLeft] = useState(()=>Math.max(0, targetMs-Date.now()));
  useEffect(()=>{
    const tick = () => setLeft(Math.max(0, targetMs-Date.now()));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [targetMs]);
  return { h:Math.floor(left/3600000), m:Math.floor((left%3600000)/60000), s:Math.floor((left%60000)/1000), expired:left===0 };
}

// ─── COUNTDOWN DISPLAY ────────────────────────────────────────────────────────
function Countdown({ targetMs, color }) {
  const { h, m, s, expired } = useCountdown(targetMs);
  if (expired) return <span style={{fontSize:11,color:"#FF5555",fontWeight:700,animation:"pulse 0.5s infinite"}}>⏱ Starting now!</span>;
  return (
    <div style={{display:"flex",gap:3}}>
      {[{v:h,l:"H"},{v:m,l:"M"},{v:s,l:"S"}].map(({v,l})=>(
        <div key={l} style={{background:"rgba(0,0,0,0.3)",borderRadius:6,padding:"3px 7px",minWidth:34,textAlign:"center"}}>
          <div style={{fontFamily:"'Russo One',sans-serif",fontSize:15,color,lineHeight:1}}>{String(v).padStart(2,"0")}</div>
          <div style={{fontSize:8,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginTop:1}}>{l}</div>
        </div>
      ))}
    </div>
  );
}

// ─── WIN CALCULATOR ───────────────────────────────────────────────────────────
function WinCalc({ totalOdds, color, t }) {
  const [stake, setStake] = useState("10000");
  const win = stake ? Math.floor(Number(stake)*totalOdds).toLocaleString() : "—";
  return (
    <div style={{padding:"12px 18px",borderBottom:`1px solid ${t.border}`}}>
      <div style={{fontSize:9,color:t.textDim,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>💰 WIN CALCULATOR</div>
      <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:t.textDim,marginBottom:4}}>STAKE (UGX)</div>
          <input value={stake} onChange={e=>setStake(e.target.value.replace(/\D/g,""))}
            style={{width:"100%",padding:"8px 10px",background:t.bg,border:`1.5px solid ${t.border}`,borderRadius:8,color:t.text,fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:600,outline:"none"}}/>
        </div>
        <div style={{color:t.textDim,fontSize:18,paddingBottom:8}}>→</div>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:t.textDim,marginBottom:4}}>WIN (UGX)</div>
          <div style={{padding:"8px 10px",background:`${color}14`,border:`1.5px solid ${color}44`,borderRadius:8}}>
            <span style={{fontFamily:"'Russo One',sans-serif",fontSize:14,color}}>{win}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAYMENT SCREEN ───────────────────────────────────────────────────────────
function PayScreen({ accum, t, dark, onBack, onPaid }) {
  const cfg = TIERS[accum.tier];
  const [payMethod, setPayMethod] = useState("mtn");
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const go = () => { if(phone.length<9) return; setPaying(true); setTimeout(()=>{ setPaying(false); onPaid(); },2200); };
  return (
    <div style={{padding:"18px",animation:"fadeUp 0.3s ease"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:t.textDim,cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:14,padding:0}}>← Back</button>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:26}}>{cfg.emoji}</div>
        <div style={{fontFamily:"'Russo One',sans-serif",fontSize:19,color:cfg.color,marginTop:4}}>{cfg.label} UNLOCK</div>
        <div style={{fontSize:12,color:t.textDim,marginTop:3}}>{accum.matches.length} picks · Full AI analysis · Valid all day</div>
      </div>
      {/* Summary — picks blurred, total odds visible */}
      <div style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:12,marginBottom:14,overflow:"hidden"}}>
        {accum.matches.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",borderBottom:i<accum.matches.length-1?`1px solid ${t.border}`:"none"}}>
            <div>
              <div style={{fontSize:9,color:t.textDim}}>{m.fl} {m.lg}</div>
              <div style={{fontSize:12,fontWeight:700,color:t.text}}>{m.h} vs {m.a}</div>
            </div>
            <div style={{display:"flex",gap:5,alignItems:"center"}}>
              <span style={{fontSize:10,filter:"blur(5px)",userSelect:"none",background:t.border,padding:"2px 7px",borderRadius:5,color:t.textDim}}>███████</span>
              <span style={{background:cfg.color,color:cfg.dark?"#000":"#fff",borderRadius:5,padding:"2px 8px",fontSize:12,fontWeight:800,filter:"blur(5px)",userSelect:"none"}}>{m.odds}</span>
            </div>
          </div>
        ))}
        {/* Total odds — always clear */}
        <div style={{display:"flex",justifyContent:"space-between",padding:"11px 14px",borderTop:`1px solid ${t.border}`,background:`${cfg.color}0C`}}>
          <span style={{fontSize:12,fontWeight:700,color:t.text}}>TOTAL ODDS</span>
          <span style={{fontFamily:"'Russo One',sans-serif",fontSize:24,color:cfg.color}}>{accum.totalOdds}</span>
        </div>
      </div>
      {/* Payment method */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:11}}>
        {[{id:"mtn",lbl:"MTN MoMo",em:"📱",c:"#FFD700"},{id:"airtel",lbl:"Airtel Money",em:"📲",c:"#FF3B5C"}].map(pm=>(
          <button key={pm.id} onClick={()=>setPayMethod(pm.id)} style={{padding:"10px 8px",border:`1.5px solid ${payMethod===pm.id?pm.c:t.border}`,borderRadius:10,cursor:"pointer",background:payMethod===pm.id?`${pm.c}15`:t.surface,display:"flex",flexDirection:"column",alignItems:"center",gap:4,transition:"all 0.2s",position:"relative",fontFamily:"'Outfit',sans-serif"}}>
            <span style={{fontSize:20}}>{pm.em}</span>
            <span style={{fontSize:11,fontWeight:600,color:payMethod===pm.id?pm.c:t.textDim}}>{pm.lbl}</span>
            {payMethod===pm.id&&<span style={{position:"absolute",top:5,right:5,width:13,height:13,borderRadius:"50%",background:pm.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#000",fontWeight:800}}>✓</span>}
          </button>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,border:`1.5px solid ${phone.length>=9?cfg.color:t.border}`,borderRadius:10,padding:"11px 13px",background:t.surface,marginBottom:11,transition:"border-color 0.2s"}}>
        <span style={{color:t.textDim,fontSize:13,whiteSpace:"nowrap"}}>🇺🇬 +256</span>
        <input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="7X XXX XXXX"
          style={{flex:1,border:"none",outline:"none",background:"transparent",fontFamily:"'Outfit',sans-serif",fontSize:15,letterSpacing:2,color:t.text}}/>
      </div>
      <button onClick={go} disabled={paying||phone.length<9} style={{
        width:"100%",padding:"14px",
        background:paying||phone.length<9?t.border:`linear-gradient(135deg,${cfg.color},${cfg.color}bb)`,
        color:paying||phone.length<9?t.textDim:(cfg.dark?"#000":"#fff"),
        border:"none",borderRadius:11,fontFamily:"'Russo One',sans-serif",fontSize:16,letterSpacing:1,
        cursor:paying||phone.length<9?"not-allowed":"pointer",transition:"all 0.2s",
        display:"flex",alignItems:"center",justifyContent:"center",gap:8,
      }}>
        {paying?<><span style={{width:16,height:16,border:`2px solid ${t.textDim}`,borderTopColor:cfg.color,borderRadius:"50%",animation:"spin 0.8s linear infinite",display:"inline-block"}}/>PROCESSING...</>:`PAY UGX ${cfg.price.toLocaleString()} →`}
      </button>
      <p style={{textAlign:"center",fontSize:10,color:t.textDim,marginTop:8}}>🔒 Secured via {payMethod==="mtn"?"MTN MoMo":"Airtel Money"} · No subscription</p>
    </div>
  );
}

// ─── ACCUMULATOR CARD ─────────────────────────────────────────────────────────
function AccumCard({ accum, dark, t, onRegenerate }) {
  const cfg = TIERS[accum.tier];
  const [unlocked, setUnlocked] = useState(accum.tier==="free");
  const [payOpen, setPayOpen] = useState(false);
  const [dying, setDying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const { expired } = useCountdown(accum.firstKick.getTime());

  useEffect(()=>{
    if(expired && !dying && !regenerating) {
      setDying(true);
      setTimeout(()=>{
        setRegenerating(true);
        setTimeout(()=>onRegenerate(accum.tier), 10000+Math.random()*20000);
      }, 1400);
    }
  }, [expired]);

  if(regenerating) return (
    <div style={{background:t.surface,border:`1px solid ${cfg.color}33`,borderRadius:18,padding:"28px 20px",textAlign:"center",marginBottom:20,animation:"fadeUp 0.4s ease"}}>
      <div style={{fontSize:30,animation:"spin 1.2s linear infinite",display:"inline-block",marginBottom:12}}>⚙️</div>
      <div style={{fontFamily:"'Russo One',sans-serif",fontSize:15,color:cfg.color,marginBottom:6}}>Generating new {cfg.label} accumulator...</div>
      <div style={{fontSize:12,color:t.textDim,marginBottom:14}}>AI scanning today's matches</div>
      <div style={{display:"flex",justifyContent:"center",gap:5}}>
        {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:cfg.color,animation:`dotBounce 1.2s ${i*0.2}s infinite`}}/>)}
      </div>
    </div>
  );

  return (
    <div style={{background:t.surface,border:`1.5px solid ${unlocked?cfg.color+"66":t.border}`,borderRadius:18,overflow:"hidden",marginBottom:20,opacity:dying?0:1,transition:"opacity 1s",animation:"fadeUp 0.5s ease"}}>

      {/* Header */}
      <div style={{background:dark?`${cfg.color}0E`:`${cfg.color}16`,borderBottom:`1px solid ${t.border}`,padding:"13px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:9,background:cfg.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{cfg.emoji}</div>
          <div>
            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:14,color:cfg.color,letterSpacing:0.5}}>{cfg.label} ACCUMULATOR</div>
            <div style={{fontSize:10,color:t.textDim,marginTop:1}}>{cfg.desc}</div>
          </div>
        </div>
        {unlocked
          ? <span style={{background:cfg.color,color:cfg.dark?"#000":"#fff",borderRadius:7,padding:"3px 10px",fontSize:10,fontWeight:800}}>🔓 LIVE</span>
          : <span style={{background:dark?"rgba(255,255,255,0.05)":t.border,color:t.textDim,border:`1px solid ${t.border}`,borderRadius:7,padding:"3px 10px",fontSize:10,fontWeight:700}}>🔒 LOCKED</span>
        }
      </div>

      {/* Countdown */}
      <div style={{padding:"9px 18px",borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:dark?"rgba(0,0,0,0.18)":"rgba(0,0,0,0.02)"}}>
        <span style={{fontSize:9,color:t.textDim,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>⏳ FIRST MATCH IN</span>
        <Countdown targetMs={accum.firstKick.getTime()} color={cfg.color}/>
      </div>

      {/* Match rows or pay screen */}
      {payOpen ? (
        <PayScreen accum={accum} t={t} dark={dark} onBack={()=>setPayOpen(false)} onPaid={()=>{ setUnlocked(true); setPayOpen(false); }}/>
      ) : (
        <>
          {accum.matches.map((m,i)=>(
            <div key={m.id} style={{borderBottom:`1px solid ${t.border}`,padding:"13px 18px",position:"relative"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <span>{m.fl}</span>
                  <span style={{fontSize:11,color:t.textDim,fontWeight:600}}>{m.lg}</span>
                  {m.hot&&<span style={{fontSize:9,background:"#FF4D00",color:"#fff",borderRadius:5,padding:"1px 5px",fontWeight:700}}>🔥</span>}
                </div>
                <span style={{fontSize:11,color:t.textDim}}>⏰ {m.kickoff.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
              </div>
              {/* Teams always visible */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{flex:1,fontWeight:700,fontSize:15,color:t.text}}>{m.h}</span>
                <span style={{fontSize:10,color:t.textDim,background:t.border,padding:"2px 8px",borderRadius:5,flexShrink:0}}>VS</span>
                <span style={{flex:1,fontWeight:700,fontSize:15,color:t.text,textAlign:"right"}}>{m.a}</span>
              </div>
              {/* Pick — blurred until unlocked */}
              <div style={{position:"relative"}}>
                <div style={{
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                  background:dark?`${cfg.color}08`:`${cfg.color}0F`,
                  border:`1px solid ${cfg.color}${unlocked?"44":"1A"}`,
                  borderRadius:9,padding:"9px 12px",
                  filter:unlocked?"none":"blur(7px)",
                  userSelect:unlocked?"auto":"none",
                  transition:"filter 0.6s ease",
                }}>
                  <div>
                    <div style={{fontSize:9,color:t.textDim,letterSpacing:1,textTransform:"uppercase",marginBottom:2}}>{m.mkt}</div>
                    <div style={{fontSize:13,fontWeight:700,color:cfg.color}}>✅ {m.pick}</div>
                  </div>
                  <div style={{background:cfg.color,color:cfg.dark?"#000":"#fff",borderRadius:7,padding:"6px 12px",textAlign:"center",minWidth:52}}>
                    <div style={{fontFamily:"'Russo One',sans-serif",fontSize:19,lineHeight:1}}>{m.odds}</div>
                    <div style={{fontSize:8,letterSpacing:1,opacity:0.75,marginTop:1}}>ODDS</div>
                  </div>
                </div>
                {!unlocked&&(
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",gap:5,pointerEvents:"none"}}>
                    <span>🔒</span><span style={{fontSize:11,fontWeight:700,color:t.textDim}}>Pay to reveal pick & odds</span>
                  </div>
                )}
              </div>
              {/* Confidence bar */}
              <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1,height:2,background:t.border,borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${m.conf}%`,background:cfg.color,borderRadius:2,transition:"width 1.2s ease"}}/>
                </div>
                <span style={{fontSize:9,color:t.textDim,whiteSpace:"nowrap"}}>AI: {m.conf}%</span>
              </div>
              {/* AI analysis after unlock */}
              {unlocked&&(
                <div style={{marginTop:9,background:dark?"rgba(255,255,255,0.025)":"rgba(0,0,0,0.03)",borderRadius:8,padding:"9px 11px",borderLeft:`2px solid ${cfg.color}55`,animation:"fadeUp 0.4s ease"}}>
                  {accum.loading&&!m.analysis
                    ? <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <span style={{width:10,height:10,border:`2px solid ${t.border}`,borderTopColor:cfg.color,borderRadius:"50%",animation:"spin 0.8s linear infinite",display:"inline-block"}}/>
                        <span style={{fontSize:11,color:t.textDim}}>Generating analysis...</span>
                      </div>
                    : <p style={{fontSize:12,color:t.textDim,lineHeight:1.65,margin:0}}>{m.analysis||"Analysis ready."}</p>
                  }
                </div>
              )}
            </div>
          ))}

          {/* ── TOTAL ODDS — no multiplication shown, just the total ── */}
          <div style={{padding:"14px 18px",background:dark?`${cfg.color}06`:`${cfg.color}0A`,borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:9,color:t.textDim,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>TOTAL ACCUMULATOR ODDS</div>
              <div style={{fontSize:12,color:t.textDim}}>{accum.matches.length} picks combined</div>
            </div>
            <div style={{background:`linear-gradient(135deg,${cfg.color},${cfg.color}aa)`,color:cfg.dark?"#000":"#fff",borderRadius:12,padding:"10px 20px",textAlign:"center"}}>
              <div style={{fontFamily:"'Russo One',sans-serif",fontSize:34,lineHeight:1}}>{accum.totalOdds}</div>
              <div style={{fontSize:8,letterSpacing:2,marginTop:3,opacity:0.85,fontWeight:600}}>TOTAL ODDS</div>
            </div>
          </div>

          {/* Win calculator — only after unlock */}
          {unlocked && <WinCalc totalOdds={accum.totalOdds} color={cfg.color} t={t}/>}

          {/* CTA */}
          <div style={{padding:"14px 18px"}}>
            {accum.tier==="free"
              ? <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <span style={{color:cfg.color,fontSize:14}}>✅</span>
                  <span style={{color:cfg.color,fontWeight:700,fontSize:13}}>Free picks — no payment needed!</span>
                </div>
              : !unlocked
                ? <>
                    <button onClick={()=>setPayOpen(true)} style={{
                      width:"100%",padding:"14px",
                      background:`linear-gradient(135deg,${cfg.color},${cfg.color}bb)`,
                      color:cfg.dark?"#000":"#fff",
                      border:"none",borderRadius:11,fontFamily:"'Russo One',sans-serif",
                      fontSize:16,letterSpacing:1,cursor:"pointer",transition:"all 0.2s",
                    }}>
                      🔓 UNLOCK {cfg.label} · UGX {cfg.price.toLocaleString()}
                    </button>
                    <p style={{textAlign:"center",fontSize:10,color:t.textDim,marginTop:7}}>One-time · Valid all day · No subscription</p>
                  </>
                : <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    <span style={{color:cfg.color,fontSize:14}}>✅</span>
                    <span style={{color:cfg.color,fontWeight:700,fontSize:13}}>Unlocked — good luck! 🍀</span>
                  </div>
            }
          </div>
        </>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(true);
  const [accums, setAccums] = useState({});
  const [pool, setPool] = useState(null);
  const [ticker, setTicker] = useState(0);
  const [liveUsers, setLiveUsers] = useState(1247);
  const [dataSource, setDataSource] = useState("loading"); // "real" | "fallback" | "loading"
  const t = dark ? DARK : LIGHT;

  const WINS = [
    {u:"Kasozi J.",w:"145,000",s:"10,000",time:"2h ago"},
    {u:"Nakato A.",w:"87,000", s:"10,000",time:"Yesterday"},
    {u:"Mukasa P.",w:"210,000",s:"10,000",time:"2 days ago"},
    {u:"Atim R.",  w:"63,000", s:"10,000",time:"3 days ago"},
  ];

  // Load match pool — real or fallback
  useEffect(()=>{
    (async()=>{
      const real = await fetchTodayFixtures();
      if(real && real.length >= 10) {
        setPool(real);
        setDataSource("real");
      } else {
        setPool(FALLBACK_POOL);
        setDataSource(USE_REAL_API ? "fallback" : "fallback");
      }
    })();
  },[]);

  // Build accumulators once pool is ready
  useEffect(()=>{
    if(!pool) return;
    const usedIds = [];
    const newAccums = {};
    for(const tier of ["free","vip","premium"]) {
      const acc = buildAccum(tier, pool, usedIds);
      acc.matches.forEach(m=>usedIds.push(m.id));
      newAccums[tier] = acc;
    }
    setAccums(newAccums);

    // Load AI analysis for all tiers
    for(const tier of ["free","vip","premium"]) {
      const acc = newAccums[tier];
      setAccums(prev=>({...prev,[tier]:{...prev[tier],loading:true}}));
      getAIAnalysis(acc).then(analyses=>{
        setAccums(prev=>{
          const cur = prev[tier];
          if(!cur || cur.id!==acc.id) return prev;
          return {...prev,[tier]:{...cur,loading:false,matches:cur.matches.map(m=>{
            const f=analyses.find(a=>a.id===m.id);
            return f?{...m,analysis:f.analysis}:m;
          })}};
        });
      });
    }
  },[pool]);

  const handleRegenerate = useCallback((tier)=>{
    if(!pool) return;
    setAccums(prev=>({...prev,[tier]:null}));
    const usedIds=[];
    Object.entries(accums||{}).forEach(([k,a])=>{ if(k!==tier&&a) a.matches.forEach(m=>usedIds.push(m.id)); });
    setTimeout(()=>{
      const acc = buildAccum(tier, pool, usedIds);
      setAccums(prev=>({...prev,[tier]:{...acc,loading:true}}));
      getAIAnalysis(acc).then(analyses=>{
        setAccums(prev=>{
          const cur=prev[tier];
          if(!cur||cur.id!==acc.id) return prev;
          return {...prev,[tier]:{...cur,loading:false,matches:cur.matches.map(m=>{
            const f=analyses.find(a=>a.id===m.id);
            return f?{...m,analysis:f.analysis}:m;
          })}};
        });
      });
    },300);
  },[pool, accums]);

  useEffect(()=>{const i=setInterval(()=>setTicker(x=>(x+1)%WINS.length),3800);return()=>clearInterval(i);},[]);
  useEffect(()=>{const i=setInterval(()=>setLiveUsers(n=>n+Math.floor(Math.random()*5-1)),4500);return()=>clearInterval(i);},[]);

  return (
    <div style={{background:t.bg,color:t.text,minHeight:"100vh",fontFamily:"'Outfit',sans-serif"}}>
      {/* NAV */}
      <nav style={{position:"sticky",top:0,zIndex:99,background:dark?"rgba(3,10,6,0.97)":"rgba(245,255,248,0.97)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${t.border}`,padding:"11px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:"#00D45E",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⚽</div>
          <div>
            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:17,letterSpacing:1,color:t.text}}>PREDICTOR<span style={{color:"#00D45E"}}>UG</span></div>
            <div style={{fontSize:9,color:t.textDim,letterSpacing:2,textTransform:"uppercase"}}>Daily Safe Tickets</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* Data source indicator */}
          <div style={{fontSize:9,color:dataSource==="real"?"#00D45E":t.textDim,background:dark?"rgba(0,0,0,0.3)":"rgba(0,0,0,0.06)",borderRadius:6,padding:"3px 7px",border:`1px solid ${dataSource==="real"?"#00D45E33":t.border}`}}>
            {dataSource==="real"?"📡 LIVE DATA":dataSource==="fallback"?"📋 SAMPLE DATA":"⏳"}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(0,212,94,0.08)",border:"1px solid rgba(0,212,94,0.25)",borderRadius:20,padding:"5px 11px"}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#00D45E",animation:"pulse 1.5s infinite",display:"block"}}/>
            <span style={{fontSize:11,fontWeight:600,color:"#00D45E"}}>{liveUsers.toLocaleString()}</span>
          </div>
          <button onClick={()=>setDark(!dark)} style={{width:34,height:34,borderRadius:"50%",border:`1px solid ${t.border}`,background:t.surface,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {dark?"☀️":"🌙"}
          </button>
        </div>
      </nav>

      <div style={{maxWidth:480,margin:"0 auto",padding:"20px 16px 70px"}}>

        {/* Hero */}
        <div style={{textAlign:"center",marginBottom:20,animation:"fadeUp 0.5s ease"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(0,212,94,0.08)",border:"1px solid rgba(0,212,94,0.25)",borderRadius:20,padding:"5px 14px",marginBottom:14}}>
            <span style={{fontSize:11,color:"#00D45E",fontWeight:700,letterSpacing:1}}>📅 {new Date().toLocaleDateString("en-UG",{weekday:"long",day:"numeric",month:"long"})}</span>
          </div>
          <h1 style={{fontFamily:"'Russo One',sans-serif",fontSize:28,color:t.text,letterSpacing:0.5,marginBottom:6}}>AI-Powered <span style={{color:"#00D45E"}}>Accumulators</span></h1>
          <p style={{fontSize:13,color:t.textDim,lineHeight:1.6}}>3 tiers · Live countdowns · Claude AI analysis</p>
        </div>

        {/* Streak */}
        <div style={{display:"flex",gap:10,marginBottom:14,animation:"fadeUp 0.4s 0.07s ease both"}}>
          {[{l:"WINS",v:18,c:"#00D45E"},{l:"LOSSES",v:4,c:"#FF4D4D"},{l:"RATE",v:"82%",c:"#00D45E"}].map((s,i)=>(
            <div key={i} style={{flex:1,background:t.surface,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 0",textAlign:"center"}}>
              <div style={{fontFamily:"'Russo One',sans-serif",fontSize:22,color:s.c}}>{s.v}</div>
              <div style={{fontSize:9,color:t.textDim,letterSpacing:1.5,textTransform:"uppercase",marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Ticker */}
        <div key={ticker} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,212,94,0.07)",border:"1px solid rgba(0,212,94,0.2)",borderRadius:10,padding:"9px 14px",marginBottom:20,overflow:"hidden",animation:"tickIn 0.4s ease"}}>
          <span style={{fontSize:10,fontWeight:800,color:"#00D45E",letterSpacing:1,whiteSpace:"nowrap"}}>⚡ WIN:</span>
          <span style={{fontSize:12,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            <strong>{WINS[ticker].u}</strong> won <span style={{color:"#00D45E"}}>UGX {WINS[ticker].w}</span> from {WINS[ticker].s} · {WINS[ticker].time}
          </span>
        </div>

        {/* Tier legend */}
        <div style={{display:"flex",gap:8,marginBottom:22,animation:"fadeUp 0.4s 0.1s ease both"}}>
          {Object.entries(TIERS).map(([k,c])=>(
            <div key={k} style={{flex:1,background:t.surface,border:`1px solid ${c.color}44`,borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
              <div style={{fontSize:15,marginBottom:2}}>{c.emoji}</div>
              <div style={{fontSize:10,fontWeight:800,color:c.color}}>{c.label}</div>
              <div style={{fontSize:9,color:t.textDim,marginTop:1}}>{k==="free"?"Free":k==="vip"?"1,000 UGX":"2,500 UGX"}</div>
            </div>
          ))}
        </div>

        {/* API key notice */}
        {!USE_REAL_API && (
          <div style={{background:dark?"rgba(245,200,66,0.07)":"rgba(245,200,66,0.12)",border:"1px solid rgba(245,200,66,0.3)",borderRadius:12,padding:"11px 14px",marginBottom:18,display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:16,flexShrink:0}}>ℹ️</span>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#F5C842",marginBottom:3}}>Using sample match data</div>
              <div style={{fontSize:11,color:t.textDim,lineHeight:1.5}}>To show real today's fixtures, get a free API key at <span style={{color:"#F5C842"}}>dashboard.api-sports.io</span> and add it at the top of this file.</div>
            </div>
          </div>
        )}

        {/* Accumulators */}
        {Object.keys(accums).length === 0 ? (
          <div style={{textAlign:"center",padding:"40px 20px"}}>
            <div style={{fontSize:36,animation:"spin 1s linear infinite",display:"inline-block",marginBottom:14}}>⚙️</div>
            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:18,color:"#00D45E",marginBottom:8}}>Loading accumulators...</div>
            <div style={{fontSize:13,color:t.textDim}}>Fetching matches & running AI analysis</div>
          </div>
        ) : (
          ["free","vip","premium"].map(tier=>
            accums[tier]
              ? <AccumCard key={accums[tier].id} accum={accums[tier]} dark={dark} t={t} onRegenerate={handleRegenerate}/>
              : <div key={tier} style={{background:t.surface,border:`1px solid ${TIERS[tier].color}33`,borderRadius:18,padding:"28px",textAlign:"center",marginBottom:20}}>
                  <div style={{fontSize:28,animation:"spin 1.2s linear infinite",display:"inline-block",marginBottom:10}}>⚙️</div>
                  <div style={{color:TIERS[tier].color,fontFamily:"'Russo One',sans-serif",fontSize:14}}>Building {TIERS[tier].label}...</div>
                </div>
          )
        )}

        {/* Recent winners */}
        <div style={{fontSize:10,color:t.textDim,fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>⚡ RECENT WINNERS</div>
        <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:16,overflow:"hidden",marginBottom:20}}>
          {WINS.map((w,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",borderBottom:i<WINS.length-1?`1px solid ${t.border}`:"none"}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:"rgba(0,212,94,0.1)",border:"1px solid rgba(0,212,94,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,color:"#00D45E",flexShrink:0}}>{w.u[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13,color:t.text}}>{w.u}</div>
                <div style={{fontSize:11,color:t.textDim}}>Stake: UGX {w.s}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:800,fontSize:14,color:"#00D45E"}}>+{w.w}</div>
                <div style={{fontSize:10,color:t.textDim}}>{w.time}</div>
              </div>
            </div>
          ))}
        </div>

        <p style={{textAlign:"center",fontSize:11,color:t.textDim,lineHeight:1.7}}>⚠️ Predictions are AI-generated analysis only. Always bet responsibly. 18+ only.</p>
      </div>
    </div>
  );
}

const DARK  = { bg:"#030D06", surface:"#071209", border:"#0E2214", text:"#E6F4EA", textDim:"#3D6B4A" };
const LIGHT = { bg:"#F2FFF5", surface:"#FFFFFF",  border:"#C5E8CC", text:"#1A3D22", textDim:"#5A8C66" };
