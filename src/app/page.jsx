"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  getLatestAccumsAction,
} from "./actions";

// ─── TIER CONFIG ─────────────────────────────────────────────────────────────
const TIERS = {
  free:    { label:"FREE",    emoji:"🌿", price:0,    color:"#4CAF50", dark:true,  desc:"2 daily picks · No payment needed" },
  vip:     { label:"VIP",     emoji:"⭐", price:1000,  color:"#F5C842", dark:true,  desc:"3 researched picks · High confidence" },
  premium: { label:"PREMIUM", emoji:"💎", price:2500,  color:"#B388FF", dark:false, desc:"5 elite picks · Expert analysis" },
};

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

function Countdown({ targetMs, color }) {
  const { expired, h, m, s } = useCountdown(targetMs);
  if (expired) return <span style={{fontSize:11,color:"#FF5555",fontWeight:900,animation:"pulse 0.5s infinite"}}>⏱ Match Started!</span>;
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

function WinCalc({ totalOdds, color, t }) {
  const [stake, setStake] = useState("10000");
  const win = stake ? Math.floor(Number(stake)*totalOdds).toLocaleString() : "—";
  return (
    <div style={{padding:"12px 18px",borderBottom:`1px solid ${t.border}`}}>
      <div style={{fontSize:9,color:t.textDim,fontWeight:900,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>💰 WIN CALCULATOR</div>
      <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:t.textDim,marginBottom:4,fontWeight:900}}>STAKE (UGX)</div>
          <input value={stake} onChange={e=>setStake(e.target.value.replace(/\D/g,""))}
            style={{width:"100%",padding:"8px 10px",background:t.bg,border:`1.5px solid ${t.border}`,borderRadius:8,color:t.text,fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:800,outline:"none"}}/>
        </div>
        <div style={{color:t.textDim,fontSize:18,paddingBottom:8}}>→</div>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:t.textDim,marginBottom:4,fontWeight:900}}>WIN (UGX)</div>
          <div style={{padding:"8px 10px",background:`${color}14`,border:`1.5px solid ${color}44`,borderRadius:8}}>
            <span style={{fontFamily:"'Russo One',sans-serif",fontSize:14,color}}>{win}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PayScreen({ accum, t, dark, onBack, onPaid }) {
  const cfg = TIERS[accum.tier];
  const [payMethod, setPayMethod] = useState("mtn");
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const go = () => { if(phone.length<9) return; setPaying(true); setTimeout(()=>{ setPaying(false); onPaid(phone); },2200); };
  return (
    <div style={{padding:"18px",animation:"fadeUp 0.3s ease"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:t.textDim,cursor:"pointer",fontSize:13,fontWeight:800,marginBottom:14,padding:0}}>← Back</button>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:26}}>{cfg.emoji}</div>
        <div style={{fontFamily:"'Russo One',sans-serif",fontSize:19,color:cfg.color,marginTop:4}}>{cfg.label} UNLOCK</div>
        <div style={{fontSize:12,color:t.textDim,marginTop:3,fontWeight:700}}>{accum.matches.length} picks · Expert analysis</div>
      </div>
      <div style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:12,marginBottom:14,overflow:"hidden"}}>
        {(accum.matches || []).map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",borderBottom:i<accum.matches.length-1?`1px solid ${t.border}`:"none"}}>
            <div>
              <div style={{fontSize:9,color:t.textDim,fontWeight:900}}>{m.fl} {m.lg}</div>
              <div style={{fontSize:12,fontWeight:900,color:t.text}}>{m.h} vs {m.a}</div>
            </div>
            <div style={{display:"flex",gap:5,alignItems:"center"}}>
              <span style={{fontSize:10,filter:"blur(5px)",userSelect:"none",background:t.border,padding:"2px 7px",borderRadius:5,color:t.textDim}}>███████</span>
              <span style={{background:cfg.color,color:cfg.dark?"#000":"#fff",borderRadius:5,padding:"2px 8px",fontSize:12,fontWeight:900,filter:"blur(5px)",userSelect:"none"}}>{Number(m.odds).toFixed(2)}</span>
            </div>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",padding:"11px 14px",borderTop:`1px solid ${t.border}`,background:`${cfg.color}0C`}}>
          <span style={{fontSize:12,fontWeight:900,color:t.text}}>TOTAL ODDS</span>
          <span style={{fontFamily:"'Russo One',sans-serif",fontSize:24,color:cfg.color}}>{Number(accum.total_odds || accum.totalOdds).toFixed(2)}</span>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:11}}>
        {[{id:"mtn",lbl:"MTN MoMo",em:"📱",c:"#FFD700"},{id:"airtel",lbl:"Airtel Money",em:"📲",c:"#FF3B5C"}].map(pm=>(
          <button key={pm.id} onClick={()=>setPayMethod(pm.id)} style={{padding:"10px 8px",border:`1.5px solid ${payMethod===pm.id?pm.c:t.border}`,borderRadius:10,cursor:"pointer",background:payMethod===pm.id?`${pm.c}15`:t.surface,display:"flex",flexDirection:"column",alignItems:"center",gap:4,transition:"all 0.2s",position:"relative",fontFamily:"'Outfit',sans-serif"}}>
            <span style={{fontSize:20}}>{pm.em}</span>
            <span style={{fontSize:11,fontWeight:800,color:payMethod===pm.id?pm.c:t.textDim}}>{pm.lbl}</span>
            {payMethod===pm.id&&<span style={{position:"absolute",top:5,right:5,width:13,height:13,borderRadius:"50%",background:pm.c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:"#000",fontWeight:900}}>✓</span>}
          </button>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,border:`1.5px solid ${phone.length>=9?cfg.color:t.border}`,borderRadius:10,padding:"11px 13px",background:t.surface,marginBottom:11,transition:"all 0.2s"}}>
        <span style={{color:t.textDim,fontSize:13,whiteSpace:"nowrap",fontWeight:800}}>🇺🇬 +256</span>
        <input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="7X XXX XXXX"
          style={{flex:1,border:"none",outline:"none",background:"transparent",fontFamily:"'Outfit',sans-serif",fontSize:15,letterSpacing:2,color:t.text,fontWeight:800}}/>
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
    </div>
  );
}

function AccumCard({ accum, dark, t }) {
  const cfg = TIERS[accum.tier];
  const [unlocked, setUnlocked] = useState(accum.tier==="free");
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    const unlockedId = localStorage.getItem(`unlocked-${accum.tier}-${new Date().toISOString().slice(0,10)}`);
    if (unlockedId === accum.id) {
      setUnlocked(true);
    } else {
      setUnlocked(accum.tier === "free");
    }
  }, [accum.tier, accum.id]);

  const handlePaid = (phone) => {
    setUnlocked(true);
    setPayOpen(false);
    localStorage.setItem(`unlocked-${accum.tier}-${new Date().toISOString().slice(0,10)}`, accum.id);
  };

  return (
    <div style={{background:t.surface,border:`1.5px solid ${unlocked?cfg.color+"66":t.border}`,borderRadius:20,overflow:"hidden",marginBottom:25,animation:"fadeUp 0.5s ease"}}>
      <div style={{background:dark?`${cfg.color}0E`:`${cfg.color}16`,borderBottom:`1px solid ${t.border}`,padding:"15px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{cfg.emoji}</div>
          <div>
            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:14,color:cfg.color,letterSpacing:0.5}}>{cfg.label} ACCUMULATOR</div>
            <div style={{fontSize:10,color:t.textDim,marginTop:1,fontWeight:900}}>{cfg.desc}</div>
          </div>
        </div>
        {unlocked 
          ? <span style={{background:cfg.color,color:cfg.dark?"#000":"#fff",borderRadius:7,padding:"4px 12px",fontSize:10,fontWeight:900}}>🔓 LIVE</span>
          : <span style={{background:dark?"rgba(255,255,255,0.05)":t.border,color:t.textDim,border:`1px solid ${t.border}`,borderRadius:7,padding:"4px 12px",fontSize:10,fontWeight:900}}>🔒 LOCKED</span>
        }
      </div>

      <div style={{padding:"10px 20px",borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:dark?"rgba(0,0,0,0.18)":"rgba(0,0,0,0.02)"}}>
        <span style={{fontSize:9,color:t.textDim,fontWeight:900,letterSpacing:1.5,textTransform:"uppercase"}}>⏳ TICKETS EXPIRES IN</span>
        <Countdown targetMs={accum.first_kickoff || accum.firstKick} color={cfg.color}/>
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
                <span style={{fontSize:11,color:t.textDim,fontWeight:900}}>⏰ {new Date(m.kickoff).toLocaleTimeString('en-US',{hour:"2-digit",minute:"2-digit",hour12:true})} / {new Date(m.kickoff).toLocaleTimeString('en-GB',{hour:"2-digit",minute:"2-digit",hour12:false})}</span>
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
                    <div style={{fontFamily:"'Russo One',sans-serif",fontSize:20,lineHeight:1}}>{Number(m.odds).toFixed(2)}</div>
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
                  <p style={{fontSize:12,color:t.textDim,lineHeight:1.7,margin:0,fontWeight:800}}>{m.analysis}</p>
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
              <div style={{fontFamily:"'Russo One',sans-serif",fontSize:38,lineHeight:1}}>{Number(accum.total_odds || accum.totalOdds).toFixed(2)}</div>
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
  const [loading, setLoading] = useState(true);
  const t = dark ? DARK : LIGHT;

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const stored = await getLatestAccumsAction();
      if(Object.keys(stored).length > 0) {
        setAccums(stored);
      }
      setLoading(false);
    })();
  },[]);

  return (
    <div style={{background:t.bg,color:t.text,minHeight:"100vh",fontFamily:"'Outfit',sans-serif",fontWeight:800}}>
      <nav style={{position:"sticky",top:0,zIndex:99,background:dark?"rgba(0,0,0,0.96)":"rgba(242,255,245,0.96)",backdropFilter:"blur(20px)",borderBottom:`1.5px solid ${t.border}`,padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:38,height:38,borderRadius:11,background:"#00D45E",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 0 20px #00D45E66"}}>⚽</div>
          <div>
            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:18,letterSpacing:1,color:t.text}}>PREDICTOR<span style={{color:"#00D45E"}}>UG</span></div>
            <div style={{fontSize:9,color:t.textDim,letterSpacing:2,textTransform:"uppercase",fontWeight:900}}>Expert Tips</div>
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
          <h1 style={{fontFamily:"'Russo One',sans-serif",fontSize:32,color:t.text,letterSpacing:0.5,marginBottom:8}}>Pro Analyzed <span style={{color:"#00D45E"}}>Tickets</span></h1>
          <p style={{fontSize:14,color:t.textDim,lineHeight:1.6,fontWeight:900}}>Expertly researched picks for today</p>
        </div>

        {loading ? (
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <div style={{fontSize:45,animation:"spin 1s linear infinite",display:"inline-block",marginBottom:15}}>⚙️</div>
            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:19,color:"#00D45E",marginBottom:10}}>Loading Picks...</div>
          </div>
        ) : accums && Object.keys(accums).length > 0 ? (
          ["free","vip","premium"].map(tier=>
            accums[tier] && <AccumCard key={tier} accum={accums[tier]} dark={dark} t={t} />
          )
        ) : (
          <div style={{textAlign:"center",padding:"60px 20px",background:t.surface,borderRadius:20,border:`1px solid ${t.border}`}}>
            <div style={{fontSize:40,marginBottom:15}}>⏳</div>
            <div style={{fontFamily:"'Russo One',sans-serif",fontSize:18,color:t.text}}>No Tickets Yet</div>
            <div style={{fontSize:13,color:t.textDim,marginTop:8,fontWeight:900}}>Our experts are analyzing today's games. Check back soon!</div>
          </div>
        )}

        <p style={{textAlign:"center",fontSize:11,color:t.textDim,lineHeight:1.8,fontWeight:800,padding:"0 15px",marginTop:30}}>⚠️ Tickets are for entertainment and info only. Please play responsibly. 18+</p>
      </div>

      {/* ADMIN DOT */}
      <a href="/admin" style={{
        position:"fixed", bottom:20, right:20, width:15, height:15, 
        background:"#000", border:"1px solid #222", borderRadius:"50%", 
        cursor:"pointer", opacity:0.15, transition:"opacity 0.2s"
      }} onMouseOver={e=>e.currentTarget.style.opacity=1} onMouseOut={e=>e.currentTarget.style.opacity=0.15} />
    </div>
  );
}

const DARK  = { bg:"#000000", surface:"#0C0F10", border:"#222729", text:"#FFFFFF", textDim:"#94A7AB" };
const LIGHT = { bg:"#F4FFF7", surface:"#FFFFFF",  border:"#D1EDD7", text:"#15331C", textDim:"#5B8268" };
