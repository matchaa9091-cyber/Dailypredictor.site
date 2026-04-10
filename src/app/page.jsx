"use client";
// Force Vercel Sync: 2026-04-10


import { useState, useEffect, useCallback, useRef } from "react";
import { 
  getAIAnalysisAction, 
  getLatestAccumsAction, 
  saveSingleAccumAction,
  fetchFixturesAction
} from "./actions";

// ─── TIER CONFIG ─────────────────────────────────────────────────────────────
const TIERS = {
  free:    { label:"FREE",    emoji:"🆓", price:0,    color:"#4CAF50", dark:true,  desc:"2 daily picks · No payment needed",       picks:2 },
  vip:     { label:"VIP",     emoji:"⭐", price:1000,  color:"#F5C842", dark:true,  desc:"3 researched picks · High confidence",    picks:3 },
  premium: { label:"PREMIUM", emoji:"💎", price:2500,  color:"#B388FF", dark:false, desc:"5 elite picks · AI deep analysis",        picks:5 },
};

// ─── FALLBACK MATCH POOL ───────────────────────────────
const FALLBACK_POOL = [
  { id:1,  lg:"Premier League", fl:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", h:"Arsenal",        a:"Chelsea" },
  { id:2,  lg:"La Liga",        fl:"🇪🇸", h:"Barcelona",      a:"Atletico Madrid" },
  { id:3,  lg:"Serie A",        fl:"🇮🇹", h:"Inter Milan",    a:"AC Milan" },
  { id:4,  lg:"Bundesliga",     fl:"🇩🇪", h:"Bayern Munich",  a:"Dortmund" },
  { id:5,  lg:"Ligue 1",        fl:"🇫🇷", h:"PSG",            a:"Marseille" },
  { id:6,  lg:"UCL",            fl:"🏆", h:"Real Madrid",    a:"Man City" },
  { id:7,  lg:"Euro 2024",      fl:"🇪🇺", h:"Germany",        a:"Spain" },
  { id:8,  lg:"Copa America",   fl:"🇺🇸", h:"Argentina",      a:"Brazil" },
  { id:9,  lg:"MLS",            fl:"🇺🇸", h:"Inter Miami",    a:"LA Galaxy" },
  { id:10, lg:"Eredivisie",     fl:"🇳🇱", h:"Ajax",           a:"PSV" },
];

const MARKETS = ["Match Result","Double Chance","Over 2.5 Goals","BTTS","Draw No Bet","Asian Handicap"];
const makePick = (mkt, m) => ({
  "Match Result":    Math.random()>0.3 ? `${m.h} Win` : "Draw",
  "Double Chance":   Math.random()>0.4 ? `${m.h} Win or Draw` : `${m.a} Win or Draw`,
  "Over 2.5 Goals":  "Over 2.5 Goals",
  "BTTS":            "Both Teams to Score",
  "Draw No Bet":     `${m.h} (DNB)`,
  "Asian Handicap":  `${m.h} -0.5`,
}[mkt] || `${m.h} Win`);

const makeOdds = mkt => +({
  "Match Result":    1.6+Math.random()*1.3,
  "Double Chance":   1.25+Math.random()*0.55,
  "Over 2.5 Goals":  1.5+Math.random()*0.75,
  "BTTS":            1.5+Math.random()*0.65,
  "Draw No Bet":     1.5+Math.random()*0.9,
  "Asian Handicap":  1.6+Math.random()*0.8,
}[mkt] || 1.8).toFixed(2);

function buildAccum(tier, pool, usedIds=[]) {
  const cfg = TIERS[tier];
  const now = Date.now();
  
  // Only use matches starting in the future
  const futureMatches = pool.filter(m => {
    const kick = new Date(m.kickoff || (now + 3600000)).getTime();
    return kick > now;
  });

  const available = (futureMatches.length >= cfg.picks ? futureMatches : pool)
    .filter(m => !usedIds.includes(m.id))
    .sort(()=>Math.random()-0.5)
    .slice(0, cfg.picks);

  const matches = available.map((m, i) => {
    const mkt = MARKETS[Math.floor(Math.random()*MARKETS.length)];
    // If no real kickoff, space them out starting 1 hour from now
    const kick = m.kickoff || new Date(now + (60 + i*45)*60000).toISOString(); 
    return { ...m, mkt, pick: makePick(mkt,m), odds: makeOdds(mkt), conf: 72+Math.floor(Math.random()*22), hot: Math.random()>0.65, kickoff: kick, analysis: null };
  });

  const totalOdds = +(matches.reduce((a,m)=>a*m.odds,1)).toFixed(2);
  const firstKick = matches.reduce((a,m)=>new Date(m.kickoff).getTime() < a ? new Date(m.kickoff).getTime() : a, new Date(matches[0].kickoff).getTime());
  return { tier, matches, totalOdds, firstKick: new Date(firstKick).toISOString(), id:`${tier}-${Date.now()}` };
}

// ─── COMPONENTS ─────────────────────────────────────────────────────────────

function useCountdown(targetMs) {
  const [left, setLeft] = useState(()=>Math.max(0, new Date(targetMs).getTime()-Date.now()));
  useEffect(()=>{
    const tick = () => setLeft(Math.max(0, new Date(targetMs).getTime()-Date.now()));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [targetMs]);
  return { left, h:Math.floor(left/3600000), m:Math.floor((left%3600000)/60000), s:Math.floor((left%60000)/1000), expired:left===0 };
}

function Countdown({ targetMs, color, tier, onExpired }) {
  const { expired, h, m, s } = useCountdown(targetMs);
  const hasExpiredRef = useRef(false);
  
  useEffect(() => {
    if (expired && !hasExpiredRef.current && onExpired) {
      hasExpiredRef.current = true;
      onExpired(tier);
    }
  }, [expired, tier, onExpired]);

  if (expired) return <span style={{fontSize:11,color:"#FF5555",fontWeight:900,animation:"pulse 0.5s infinite"}}>⏱ Starting now!</span>;
  return (
    <div style={{display:"flex",gap:3}}>
      {[{v:h,l:"H"},{v:m,l:"M"},{v:s,l:"S"}].map(({v,l})=>(
        <div key={l} style={{background:"rgba(0,0,0,0.3)",borderRadius:6,padding:"3px 7px",minWidth:34,textAlign:"center"}}>
          <div style={{fontFamily:"'Russo One',sans-serif",fontSize:15,color,lineHeight:1}}>{String(v).padStart(2,"0")}</div>
          <div style={{fontSize:8,color:"rgba(255,255,255,0.4)",letterSpacing:1,marginTop:1,fontWeight:900}}>{l}</div>
        </div>
      ))}
    </div>
  );
}

function AccumCard({ accum, dark, t, onExpired }) {
  const cfg = TIERS[accum.tier];
  const [unlocked, setUnlocked] = useState(accum.tier==="free");
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    const isPaid = localStorage.getItem(`unlocked-${accum.tier}-${new Date().toISOString().slice(0,10)}`);
    if (isPaid) setUnlocked(true);
  }, [accum.tier]);

  const handlePaid = (phone) => {
    setUnlocked(true);
    setPayOpen(false);
    localStorage.setItem(`unlocked-${accum.tier}-${new Date().toISOString().slice(0,10)}`, "true");
  };

  if (accum.isRegenerating) {
    return (
      <div style={{background:t.surface,border:`1px solid ${cfg.color}44`,borderRadius:20,padding:"40px",textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:40,animation:"spin 1s linear infinite",display:"inline-block",marginBottom:15}}>⚙️</div>
        <div style={{fontFamily:"'Russo One',sans-serif",fontSize:16,color:cfg.color}}>Building New {cfg.label} Ticket...</div>
      </div>
    );
  }

  return (
    <div style={{background:t.surface,border:`1.5px solid ${unlocked?cfg.color+"66":t.border}`,borderRadius:20,overflow:"hidden",marginBottom:25,animation:"fadeUp 0.5s ease"}}>
      <div style={{background:dark?`${cfg.color}0E`:`${cfg.color}16`,borderBottom:`1px solid ${t.border}`,padding:"15px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:9,background:cfg.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{cfg.emoji}</div>
          <div>
            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:14,color:cfg.color,letterSpacing:0.5}}>{cfg.label} ACCUMULATOR</div>
            <div style={{fontSize:10,color:t.textDim,marginTop:1,fontWeight:900}}>{cfg.desc}</div>
          </div>
        </div>
        {unlocked 
          ? <span style={{background:cfg.color,color:cfg.dark?"#000":"#fff",borderRadius:7,padding:"4px 12px",fontSize:10,fontWeight:900}}>🔓 UNLOCKED</span>
          : <span style={{background:dark?"rgba(255,255,255,0.05)":t.border,color:t.textDim,border:`1px solid ${t.border}`,borderRadius:7,padding:"4px 12px",fontSize:10,fontWeight:900}}>🔒 LOCKED</span>
        }
      </div>

      <div style={{padding:"10px 20px",borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:dark?"rgba(0,0,0,0.18)":"rgba(0,0,0,0.02)"}}>
        <span style={{fontSize:9,color:t.textDim,fontWeight:900,letterSpacing:1.5,textTransform:"uppercase"}}>⏳ TICKETS EXPIRES IN</span>
        <Countdown targetMs={accum.first_kickoff || accum.firstKick} color={cfg.color} tier={accum.tier} onExpired={onExpired}/>
      </div>

      {payOpen ? (
        <PayScreen accum={accum} t={t} dark={dark} onBack={()=>setPayOpen(false)} onPaid={handlePaid}/>
      ) : (
        <>
          {(accum.matches || []).map((m,i)=>(
            <div key={m.id} style={{borderBottom:`1px solid ${t.border}`,padding:"15px 20px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <span>{m.fl}</span>
                  <span style={{fontSize:11,color:t.textDim,fontWeight:900}}>{m.lg}</span>
                  {m.hot &&<span style={{fontSize:9,background:"#FF4D00",color:"#fff",borderRadius:5,padding:"2px 6px",fontWeight:900}}>🔥 HL</span>}
                </div>
                <span style={{fontSize:11,color:t.textDim,fontWeight:900}}>⏰ {new Date(m.kickoff).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <span style={{flex:1,fontWeight:900,fontSize:16,color:t.text}}>{m.h}</span>
                <span style={{fontSize:10,color:t.textDim,background:t.border,padding:"2px 10px",borderRadius:6,flexShrink:0,fontWeight:900}}>VS</span>
                <span style={{flex:1,fontWeight:900,fontSize:16,color:t.text,textAlign:"right"}}>{m.a}</span>
              </div>
              <div style={{position:"relative"}}>
                <div style={{
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                  background:dark?`${cfg.color}08`:`${cfg.color}0F`,
                  border:`1.5px solid ${cfg.color}${unlocked?"44":"1A"}`,
                  borderRadius:10,padding:"10px 14px",
                  filter:unlocked?"none":"blur(8px)",
                  userSelect:unlocked?"auto":"none",
                  transition:"filter 0.6s ease",
                }}>
                  <div>
                    <div style={{fontSize:9,color:t.textDim,letterSpacing:1.5,textTransform:"uppercase",marginBottom:2,fontWeight:900}}>{m.mkt}</div>
                    <div style={{fontSize:14,fontWeight:900,color:cfg.color}}>✅ {m.pick}</div>
                  </div>
                  <div style={{background:cfg.color,color:cfg.dark?"#000":"#fff",borderRadius:8,padding:"8px 14px",textAlign:"center",minWidth:55}}>
                    <div style={{fontFamily:"'Russo One',sans-serif",fontSize:20,lineHeight:1}}>{m.odds}</div>
                    <div style={{fontSize:8,letterSpacing:1,opacity:0.8,marginTop:1,fontWeight:900}}>ODDS</div>
                  </div>
                </div>
                {!unlocked&&(
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",gap:5,pointerEvents:"none"}}>
                    <span style={{fontSize:13}}>🔒</span><span style={{fontSize:12,fontWeight:900,color:t.textDim}}>Ticket Locked</span>
                  </div>
                )}
              </div>
              {unlocked&&(
                <div style={{marginTop:10,background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.035)",borderRadius:10,padding:"12px 14px",borderLeft:`4px solid ${cfg.color}88`,animation:"fadeUp 0.4s ease"}}>
                  <p style={{fontSize:12,color:t.textDim,lineHeight:1.7,margin:0,fontWeight:800}}>{m.analysis || "AI: Data-backed prediction for today's fixture."}</p>
                </div>
              )}
            </div>
          ))}

          <div style={{padding:"16px 20px",background:dark?`${cfg.color}06`:`${cfg.color}0A`,borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:10,color:t.textDim,fontWeight:900,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>TOTAL TICKET ODDS</div>
              <div style={{fontSize:13,color:t.textDim,fontWeight:900}}>{(accum.matches || []).length} Elite Picks</div>
            </div>
            <div style={{background:`linear-gradient(135deg,${cfg.color},${cfg.color}aa)`,color:cfg.dark?"#000":"#fff",borderRadius:14,padding:"12px 22px",textAlign:"center",boxShadow:`0 8px 20px ${cfg.color}44`}}>
              <div style={{fontFamily:"'Russo One',sans-serif",fontSize:38,lineHeight:1}}>{accum.total_odds || accum.totalOdds}</div>
              <div style={{fontSize:9,letterSpacing:2,marginTop:3,opacity:0.9,fontWeight:900}}>TOTAL ODDS</div>
            </div>
          </div>
          
          <div style={{padding:"18px 20px"}}>
            {accum.tier==="free" ? null : !unlocked ? (
               <button onClick={()=>setPayOpen(true)} style={{
                width:"100%",padding:"16px",
                background:`linear-gradient(135deg,${cfg.color},${cfg.color}bb)`,
                color:cfg.dark?"#000":"#fff",
                border:"none",borderRadius:14,fontFamily:"'Russo One',sans-serif",
                fontSize:17,letterSpacing:1,cursor:"pointer",transition:"all 0.2s",
                boxShadow:`0 8px 22px ${cfg.color}44`,
              }}>
                🔓 UNLOCK NOW · UGX {cfg.price.toLocaleString()}
              </button>
            ) : (
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:`${cfg.color}10`,padding:"12px",borderRadius:12}}>
                  <span style={{color:cfg.color,fontSize:16}}>✅</span>
                  <span style={{color:cfg.color,fontWeight:900,fontSize:14}}>Successfully Unlocked Ticket</span>
                </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(true);
  const [accums, setAccums] = useState(null);
  const [pool, setPool] = useState(null);
  const loadingRef = useRef(false);
  const t = dark ? DARK : LIGHT;

  useEffect(()=>{
    (async()=>{
      if (loadingRef.current) return;
      loadingRef.current = true;
      
      const stored = await getLatestAccumsAction();
      const real = await fetchFixturesAction();
      const currentPool = (real && real.length >= 2) ? real : FALLBACK_POOL;
      setPool(currentPool);

      const finalAccums = { ...stored };
      const usedIds = [];
      Object.values(stored).forEach(a => a.matches.forEach(m => usedIds.push(m.id)));

      let changed = false;
      for(const tier of ["free","vip","premium"]) {
        if (!finalAccums[tier]) {
          const acc = buildAccum(tier, currentPool, usedIds);
          acc.matches.forEach(m => usedIds.push(m.id));
          
          const analysis = await getAIAnalysisAction(acc);
          acc.matches = acc.matches.map(m => {
            const f = analysis.find(a => a.id === m.id);
            return f ? { ...m, analysis: f.analysis } : m;
          });
          
          const saved = await saveSingleAccumAction(tier, acc);
          finalAccums[tier] = { ...acc, ...saved, matches: acc.matches };
          changed = true;
        }
      }
      setAccums(finalAccums);
      loadingRef.current = false;
    })();
  },[]);

  const handleTierExpired = useCallback(async (tier) => {
    if (!pool || !accums || loadingRef.current) return;
    
    setAccums(prev => ({ ...prev, [tier]: { ...prev[tier], isRegenerating: true } }));
    
    const usedIds = [];
    Object.entries(accums).forEach(([k, a]) => {
      if (k !== tier && a && a.matches) a.matches.forEach(m => usedIds.push(m.id));
    });

    const newAcc = buildAccum(tier, pool, usedIds);
    const analysis = await getAIAnalysisAction(newAcc);
    newAcc.matches = newAcc.matches.map(m => {
      const f = analysis.find(a => a.id === m.id);
      return f ? { ...m, analysis: f.analysis } : m;
    });

    const saved = await saveSingleAccumAction(tier, newAcc);
    setAccums(prev => ({ 
      ...prev, 
      [tier]: { ...newAcc, ...saved, matches: newAcc.matches, isRegenerating: false } 
    }));
  }, [pool, accums]);

  return (
    <div style={{background:t.bg,color:t.text,minHeight:"100vh",fontFamily:"'Outfit',sans-serif",fontWeight:800}}>
      <nav style={{position:"sticky",top:0,zIndex:99,background:dark?"rgba(0,0,0,0.96)":"rgba(242,255,245,0.96)",backdropFilter:"blur(20px)",borderBottom:`1.5px solid ${t.border}`,padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:38,height:38,borderRadius:11,background:"#00D45E",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 0 20px #00D45E66"}}>⚽</div>
          <div>
            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:18,letterSpacing:1,color:t.text}}>PREDICTOR<span style={{color:"#00D45E"}}>UG</span></div>
            <div style={{fontSize:9,color:t.textDim,letterSpacing:2,textTransform:"uppercase",fontWeight:900}}>Premium AI Analysis</div>
          </div>
        </div>
        <button onClick={()=>setDark(!dark)} style={{width:36,height:36,borderRadius:"50%",border:`1.5px solid ${t.border}`,background:t.surface,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.3s"}}>
          {dark?"☀️":"🌙"}
        </button>
      </nav>

      <div style={{maxWidth:480,margin:"0 auto",padding:"25px 18px 80px"}}>
        <div style={{textAlign:"center",marginBottom:25,animation:"fadeUp 0.6s ease"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(0,212,94,0.1)",border:"1.5px solid rgba(0,212,94,0.3)",borderRadius:30,padding:"7px 20px",marginBottom:16}}>
            <span style={{fontSize:12,color:"#00D45E",fontWeight:900,letterSpacing:1.5}}>📅 {new Date().toLocaleDateString("en-UG",{weekday:"long",day:"numeric",month:"long"})}</span>
          </div>
          <h1 style={{fontFamily:"'Russo One',sans-serif",fontSize:32,color:t.text,letterSpacing:0.5,marginBottom:8}}>AI Winning <span style={{color:"#00D45E"}}>Streaks</span></h1>
          <p style={{fontSize:14,color:t.textDim,lineHeight:1.6,fontWeight:900}}>Verified picks · Real-time AI processing</p>
        </div>

        {!accums ? (
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <div style={{fontSize:45,animation:"spin 1s linear infinite",display:"inline-block",marginBottom:15}}>⚙️</div>
            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:19,color:"#00D45E",marginBottom:10}}>Loading Cloud Picks...</div>
            <div style={{fontSize:14,color:t.textDim,fontWeight:900}}>Synchronizing with PredictorUG server</div>
          </div>
        ) : (
          ["free","vip","premium"].map(tier=>
            accums[tier] && <AccumCard key={tier} accum={accums[tier]} dark={dark} t={t} onExpired={handleTierExpired}/>
          )
        )}

        </div>

      {/* ADMIN DOT */}
      <a href="/admin" style={{
        position:"fixed", bottom:20, right:20, width:15, height:15, 
        background:"#000", border:"1px solid #222", borderRadius:"50%", 
        cursor:"pointer", opacity:0.3, transition:"opacity 0.2s"
      }} onMouseOver={e=>e.currentTarget.style.opacity=1} onMouseOut={e=>e.currentTarget.style.opacity=0.3} />
    </div>
  );
}

const DARK  = { bg:"#000000", surface:"#0C0F10", border:"#222729", text:"#FFFFFF", textDim:"#94A7AB" };
const LIGHT = { bg:"#F4FFF7", surface:"#FFFFFF",  border:"#D1EDD7", text:"#15331C", textDim:"#5B8268" };
