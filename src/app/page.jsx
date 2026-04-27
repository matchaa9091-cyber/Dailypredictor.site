"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getLatestAccumsAction,
  requestPaymentAction,
  checkUnlockStatusAction,
  getPerformanceResultsAction,
} from "./actions";

// ─── TIER CONFIG ─────────────────────────────────────────────────────────────
const TIERS = {
  free: { label: "FREE", emoji: "🌿", price: 0, color: "#4CAF50", dark: true, desc: "2 daily picks · No payment needed" },
  vip: { label: "VIP SAFE", emoji: "⭐", price: 1000, color: "#F5C842", dark: true, desc: "3 researched picks · Daily Access" },
  premium: { label: "VIP BIG", emoji: "💎", price: 1000, color: "#9D4EDD", dark: false, desc: "5 elite picks · Daily Access" },
};

// ─── COMPONENTS ─────────────────────────────────────────────────────────────

function useCountdown(targetMs) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(targetMs).getTime() - Date.now()));
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(targetMs).getTime() - Date.now()));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [targetMs]);
  return { left, h: Math.floor(left / 3600000), m: Math.floor((left % 3600000) / 60000), s: Math.floor((left % 60000) / 1000), expired: left === 0 };
}

function Countdown({ targetMs, color }) {
  const { expired, h, m, s } = useCountdown(targetMs);
  if (expired) return <span style={{ fontSize: 11, color: "#FF5555", fontWeight: 900, animation: "pulse 0.5s infinite" }}>⏱ Match Started!</span>;
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[{ v: h, l: "H" }, { v: m, l: "M" }, { v: s, l: "S" }].map(({ v, l }) => (
        <div key={l} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "3px 7px", minWidth: 34, textAlign: "center" }}>
          <div style={{ fontFamily: "'Russo One',sans-serif", fontSize: 15, color, lineHeight: 1 }}>{String(v).padStart(2, "0")}</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginTop: 1, fontWeight: 900 }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

function WinCalc({ totalOdds, color, t }) {
  const [stake, setStake] = useState("10000");
  const win = stake ? Math.floor(Number(stake) * totalOdds).toLocaleString() : "—";
  return (
    <div style={{ padding: "12px 18px", borderBottom: `1px solid ${t.border}` }}>
      <div style={{ fontSize: 9, color: t.textDim, fontWeight: 900, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>💰 WIN CALCULATOR</div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: t.textDim, marginBottom: 4, fontWeight: 900 }}>STAKE (UGX)</div>
          <input value={stake} onChange={e => setStake(e.target.value.replace(/\D/g, ""))}
            style={{ width: "100%", padding: "8px 10px", background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 8, color: t.text, fontFamily: "'Outfit',sans-serif", fontSize: 14, fontWeight: 800, outline: "none" }} />
        </div>
        <div style={{ color: t.textDim, fontSize: 18, paddingBottom: 8 }}>→</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: t.textDim, marginBottom: 4, fontWeight: 900 }}>WIN (UGX)</div>
          <div style={{ padding: "8px 10px", background: `${color}14`, border: `1.5px solid ${color}44`, borderRadius: 8 }}>
            <span style={{ fontFamily: "'Russo One',sans-serif", fontSize: 14, color }}>{win}</span>
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
  const [copied, setCopied] = useState(false);
  const [showTrModal, setShowTrModal] = useState(false);
  const [trId, setTrId] = useState("");
  const [isPending, setIsPending] = useState(false);

  const PAY_NUMBERS = {
    mtn: "0765040502",
    airtel: "0707683295"
  };

  const currentNumber = PAY_NUMBERS[payMethod];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const go = async () => { 
    if(phone.length < 9) return; 
    setShowTrModal(true);
  };

  const submitTr = async () => {
    if(!trId) return;
    setPaying(true);
    try {
      const res = await requestPaymentAction(phone, payMethod, accum.tier, cfg.price, trId);
      if (res.success) {
        setIsPending(true);
        setShowTrModal(false);
        localStorage.setItem(`user-phone`, phone);
        localStorage.setItem(`last-request-id`, res.data.id);
      } else {
        alert("Verification request could not be sent. Please try again or contact support if the issue persists.");
      }
    } catch (e) {
      console.error(e);
      alert("An unexpected error occurred during submission.");
    }
    setPaying(false);
  };

  // Poll for auto-verification status when pending
  useEffect(() => {
    if (!isPending) return;

    const interval = setInterval(async () => {
      const unlocked = await checkUnlockStatusAction(phone);
      if (unlocked) {
        onPaid(phone);
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPending, phone, onPaid]);

  if (isPending) {
    return (
      <div style={{padding:"40px 20px", textAlign:"center", animation:"fadeUp 0.3s ease"}}>
        <div style={{fontSize:42, marginBottom:20, animation: "spin 1.5s linear infinite", display: "inline-block"}}>⚙️</div>
        <div style={{fontFamily:"'Russo One',sans-serif", fontSize:20, color:cfg.color, marginBottom:10}}>VERIFYING PAYMENT</div>
        <p style={{fontSize:13, color:t.textDim, lineHeight:1.6, fontWeight:800}}>
          Auto-verifying transaction ID <strong>{trId}</strong>... <br/>
          <span style={{color:t.text}}>Please wait, your ticket will unlock securely in a few moments.</span>
        </p>
        <button onClick={onBack} style={{marginTop:20, background:t.surface, border:`1px solid ${t.border}`, borderRadius:10, padding:"10px 20px", color:t.textDim, fontWeight:800, cursor:"pointer"}}>Close & Wait</button>
      </div>
    );
  }

  return (
    <div style={{padding:"18px", animation:"fadeUp 0.3s ease"}}>
      <button onClick={onBack} style={{background:"none", border:"none", color:t.textDim, cursor:"pointer", fontSize:13, fontWeight:800, marginBottom:14, padding:0, display:"flex", alignItems:"center", gap:5}}>
        <span style={{fontSize:16}}>←</span> Back to Ticket
      </button>

      {/* TrID Modal Overlay */}
      {showTrModal && (
        <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(5px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20, animation:"fadeUp 0.2s ease"}}>
          <div style={{background:t.surface, border:`2px solid ${cfg.color}`, borderRadius:20, padding:25, width:"100%", maxWidth:360, position:"relative", boxShadow:`0 10px 40px -10px ${cfg.color}88`}}>
            <button onClick={()=>setShowTrModal(false)} style={{position:"absolute", top:15, right:15, background:"none", border:"none", color:t.textDim, fontSize:20, cursor:"pointer"}}>✕</button>
            <div style={{textAlign:"center", marginBottom:20}}>
              <div style={{fontSize:30, marginBottom:10}}>🆔</div>
              <div style={{fontFamily:"'Russo One',sans-serif", fontSize:19, color:cfg.color}}>TRANSACTION ID</div>
              <p style={{fontSize:11, color:t.textDim, marginTop:5, fontWeight:800}}>Enter the ID from your MoMo/Airtel SMS receipt</p>
            </div>
            
            <input 
              value={trId} 
              onChange={e=>setTrId(e.target.value)} 
              placeholder="e.g. 192837465..."
              autoFocus
              style={{
                width:"100%", padding:"15px", background:t.bg, border:`1.5px solid ${trId?cfg.color:t.border}`, borderRadius:14, 
                color:t.text, fontFamily:"'Outfit',sans-serif", fontSize:18, fontWeight:800, outline:"none", textAlign:"center",
                transition:"all 0.2s", marginBottom:20
              }}
            />

            <button onClick={submitTr} disabled={paying || !trId} style={{
              width:"100%", padding:"16px",
              background: paying || !trId ? t.border : `linear-gradient(135deg, ${cfg.color}, ${cfg.color}bb)`,
              color: paying || !trId ? t.textDim : (cfg.dark ? "#000" : "#fff"),
              border:"none", borderRadius:14, fontFamily:"'Russo One',sans-serif", fontSize:16, letterSpacing:1,
              cursor: paying || !trId ? "not-allowed" : "pointer", transition:"all 0.3s",
              display:"flex", alignItems:"center", justifyContent:"center", gap:10
            }}>
              {paying ? "SUBMITTING..." : "VERIFY NOW →"}
            </button>
          </div>
        </div>
      )}

      <div style={{textAlign:"center", marginBottom:20}}>
        <div style={{fontSize:28, marginBottom:8}}>{cfg.emoji}</div>
        <div style={{fontFamily:"'Russo One',sans-serif", fontSize:20, color:cfg.color, letterSpacing:0.5}}>DAILY ACCESS PAYMENT</div>
        <p style={{fontSize:12, color:t.textDim, marginTop:5, fontWeight:700}}>Follow steps below to unlock all {cfg.label} picks</p>
      </div>

      {/* TICKET PREVIEW */}
      <div style={{background:t.bg, border:`1px solid ${t.border}`, borderRadius:12, marginBottom:18, overflow:"hidden", opacity:0.6}}>
        {(accum.matches || []).slice(0, 2).map((m,i)=>(
          <div key={i} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 12px", borderBottom:i < 1 ? `1px solid ${t.border}` : "none"}}>
            <div style={{fontSize:10, fontWeight:900, color:t.text}}>{m.h} v {m.a}</div>
            <span style={{background:cfg.color, color:cfg.dark?"#000":"#fff", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:900, filter:"blur(4px)"}}>{isNaN(Number(m.odds)) ? m.odds : Number(m.odds).toFixed(2)}</span>
          </div>
        ))}
        <div style={{padding:"6px 12px", background:`${cfg.color}10`, fontSize:10, fontWeight:900, display:"flex", justifyContent:"space-between", color:cfg.color}}>
          <span>TOTAL ODDS</span>
          <span>{Number(accum.total_odds ?? accum.totalOdds ?? 0).toFixed(2)}</span>
        </div>
      </div>

      {/* STEP 1: SELECT PROVIDER */}
      <div style={{marginBottom:18}}>
        <div style={{fontSize:10, color:t.textDim, fontWeight:900, letterSpacing:1.5, marginBottom:10, textTransform:"uppercase"}}>STEP 1: SELECT YOUR NETWORK</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
          {[
            {id:"mtn", lbl:"MTN MoMo", img:"/mtn_logo.jpg", c:"#FFD700"}, 
            {id:"airtel", lbl:"Airtel Money", img:"/airtel_logo.jpg", c:"#FF3B5C"}
          ].map(pm => (
            <button key={pm.id} onClick={() => setPayMethod(pm.id)} style={{
              height:80,
              padding:0, 
              border:`2.5px solid ${payMethod === pm.id ? pm.c : "transparent"}`, 
              borderRadius:16, 
              cursor:"pointer", 
              background:pm.c, 
              overflow:"hidden",
              transition:"all 0.2s",
              position:"relative",
              outline: "none",
              boxShadow: payMethod === pm.id ? `0 0 15px ${pm.c}66` : "none"
            }}>
              <img src={pm.img} alt={pm.lbl} style={{
                width:"100%", 
                height:"100%", 
                objectFit:"cover",
                opacity: payMethod === pm.id ? 1 : 0.8
              }} />
              {payMethod === pm.id && (
                <div style={{
                  position:"absolute", top:8, right:8, background:"#000", color:pm.c, width:20, height:20, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, border:`2px solid ${pm.c}`
                }}>✓</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* STEP 2: PAY TO NUMBER */}
      <div style={{background:t.bg, border:`1.5px dashed ${cfg.color}55`, borderRadius:16, padding:16, marginBottom:18, textAlign:"center", position:"relative", overflow:"hidden"}}>
        <div style={{position:"absolute", top:0, left:0, width:"100%", height:4, background:payMethod === "mtn" ? "#FFD700" : "#FF3B5C"}} />
        <div style={{fontSize:10, color:t.textDim, fontWeight:900, marginBottom:10, letterSpacing:1.5}}>STEP 2: SEND UGX {cfg.price.toLocaleString()} TO</div>
        
        <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:10}}>
          <div style={{fontFamily:"'Russo One',sans-serif", fontSize:24, color:t.text, letterSpacing:1}}>{currentNumber}</div>
          <button onClick={handleCopy} style={{background:copied? "#00D45E" : t.surface, border:`1px solid ${t.border}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:10, fontWeight:900, color:copied?"#000":t.text, transition:"all 0.2s", display:"flex", alignItems:"center", gap:5}}>
            {copied ? "COPIED! ✅" : "COPY 📋"}
          </button>
        </div>
        
        <div style={{fontSize:11, color:t.textDim, fontWeight:800, marginTop:5}}>
          Recipient: <span style={{color:t.text}}>DAILY PREDICTOR</span>
        </div>
      </div>

      {/* STEP 3: CONFIRMATION */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:10, color:t.textDim, fontWeight:900, letterSpacing:1.5, marginBottom:10, textTransform:"uppercase"}}>STEP 3: ENTER SENDER NUMBER</div>
        <div style={{display:"flex", alignItems:"center", gap:10, border:`1.5px solid ${phone.length >= 9 ? cfg.color : t.border}`, borderRadius:12, padding:"12px 15px", background:t.surface, transition:"all 0.2s"}}>
          <span style={{color:t.textDim, fontSize:14, fontWeight:900}}>🇺🇬 +256</span>
          <input 
            value={phone} 
            onChange={e => setPhone(e.target.value.replace(/\D/g,"").slice(0,10))} 
            placeholder="7X XXX XXXX"
            style={{flex:1, border:"none", outline:"none", background:"transparent", fontFamily:"'Outfit',sans-serif", fontSize:16, letterSpacing:2, color:t.text, fontWeight:800}}
          />
        </div>
        <p style={{fontSize:10, color:t.textDim, marginTop:8, textAlign:"center", fontWeight:700, lineHeight:1.4}}>Enter the number you used to send the payment</p>
      </div>

      <button onClick={go} disabled={paying || phone.length < 9} style={{
        width:"100%", padding:"16px",
        background: paying || phone.length < 9 ? t.border : `linear-gradient(135deg, ${cfg.color}, ${cfg.color}bb)`,
        color: paying || phone.length < 9 ? t.textDim : (cfg.dark ? "#000" : "#fff"),
        border:"none", borderRadius:14, fontFamily:"'Russo One',sans-serif", fontSize:16, letterSpacing:1,
        cursor: paying || phone.length < 9 ? "not-allowed" : "pointer", transition:"all 0.3s",
        display:"flex", alignItems:"center", justifyContent:"center", gap:10,
        boxShadow: paying || phone.length < 9 ? "none" : `0 10px 25px ${cfg.color}44`,
        transform: paying || phone.length < 9 ? "none" : "translateY(-1px)",
      }}>
        {paying ? (
          <>
            <div style={{width:18, height:18, border:`3px solid rgba(255,255,255,0.2)`, borderTopColor:cfg.color, borderRadius:"50%", animation:"spin 0.8s linear infinite"}} />
            VERIFYING...
          </>
        ) : (
          <>CONFIRM I HAVE PAID →</>
        )}
      </button>

      <div style={{marginTop:15, textAlign:"center"}}>
        <p style={{fontSize:10, color:t.textDim, fontWeight:800}}>Verification takes 2-5 minutes. Ticket will unlock automatically.</p>
      </div>
    </div>
  );
}

function AccumCard({ accum, dark, t }) {
  const cfg = TIERS[accum.tier];
  const [unlocked, setUnlocked] = useState(accum.tier === "free");
  const [payOpen, setPayOpen] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState(null);

  useEffect(() => {
    const checkStatus = async () => {
      // 1. Check local override first
      const dailyAccess = localStorage.getItem(`unlocked-daily-access-${new Date().toISOString().slice(0, 10)}`);
      if (dailyAccess === "true") {
        setUnlocked(true);
        return;
      }
      
      // 2. Check DB using saved phone
      const savedPhone = localStorage.getItem('user-phone');
      if (savedPhone) {
        const isActuallyUnlocked = await checkUnlockStatusAction(savedPhone);
        if (isActuallyUnlocked) {
          setUnlocked(true);
          localStorage.setItem(`unlocked-daily-access-${new Date().toISOString().slice(0, 10)}`, "true");
        }
      } else {
        setUnlocked(accum.tier === "free");
      }
    };
    checkStatus();
  }, [accum.tier]);

  const handlePaid = (phone) => {
    setUnlocked(true);
    setPayOpen(false);
    localStorage.setItem(`unlocked-daily-access-${new Date().toISOString().slice(0, 10)}`, "true");
    // Trigger a window event or state lift if I wanted other cards to refresh immediately, 
    // but a simple refresh or just standard React state for this card is fine.
    // For "Daily Access", clicking one should ideally unlock all immediately.
    window.location.reload(); // Quickest way to sync all cards since they use local storage
  };

  const { expired } = useCountdown(accum.first_kickoff || accum.firstKick);
  if (expired) return null;

  return (
    <div style={{ background: t.surface, border: `1.5px solid ${unlocked ? cfg.color + "66" : t.border}`, borderRadius: 20, overflow: "hidden", marginBottom: 25, animation: "fadeUp 0.5s ease" }}>
      <div style={{ background: dark ? `${cfg.color}0E` : `${cfg.color}16`, borderBottom: `1px solid ${t.border}`, padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{cfg.emoji}</div>
          <div>
            <div style={{ fontFamily: "'Russo One',sans-serif", fontSize: 14, color: cfg.color, letterSpacing: 0.5 }}>{cfg.label} TICKET</div>
            <div style={{ fontSize: 10, color: t.textDim, marginTop: 1, fontWeight: 900 }}>Daily Access Includes This Ticket</div>
          </div>
        </div>
        {unlocked
          ? <span style={{ background: cfg.color, color: cfg.dark ? "#000" : "#fff", borderRadius: 7, padding: "4px 12px", fontSize: 10, fontWeight: 900 }}>🔓 LIVE</span>
          : <span style={{ background: dark ? "rgba(255,255,255,0.05)" : t.border, color: t.textDim, border: `1px solid ${t.border}`, borderRadius: 7, padding: "4px 12px", fontSize: 10, fontWeight: 900 }}>🔒 LOCKED</span>
        }
      </div>

      <div style={{ padding: "10px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: dark ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.02)" }}>
        <span style={{ fontSize: 9, color: t.textDim, fontWeight: 900, letterSpacing: 1.5, textTransform: "uppercase" }}>⏳ TICKETS EXPIRES IN</span>
        <Countdown targetMs={accum.first_kickoff || accum.firstKick} color={cfg.color} />
      </div>

      {payOpen ? (
        <PayScreen accum={accum} t={t} dark={dark} onBack={() => setPayOpen(false)} onPaid={handlePaid} />
      ) : (
        <>
          {(accum.matches || []).map((m, i) => (
            <div key={m.id} style={{ borderBottom: `1px solid ${t.border}`, padding: "15px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span>{m.fl}</span>
                  <span style={{ fontSize: 11, color: t.textDim, fontWeight: 900 }}>{m.lg}</span>
                  {m.hot && <span style={{ fontSize: 9, background: "#FF4D00", color: "#fff", borderRadius: 5, padding: "2px 6px", fontWeight: 900 }}>🔥 HL</span>}
                </div>
                <span style={{ fontSize: 11, color: t.textDim, fontWeight: 900 }}>⏰ {new Date(m.kickoff).toLocaleTimeString('en-US', { hour: "2-digit", minute: "2-digit", hour12: true })} / {new Date(m.kickoff).toLocaleTimeString('en-GB', { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ flex: 1, fontWeight: 900, fontSize: 16, color: t.text }}>{m.h}</span>
                <span style={{ fontSize: 10, color: t.textDim, background: t.border, padding: "2px 10px", borderRadius: 6, flexShrink: 0, fontWeight: 900 }}>VS</span>
                <span style={{ flex: 1, fontWeight: 900, fontSize: 16, color: t.text, textAlign: "right" }}>{m.a}</span>
              </div>
              <div style={{ position: "relative" }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: dark ? `${cfg.color}08` : `${cfg.color}0F`,
                  border: `1.5px solid ${cfg.color}${unlocked ? "44" : "1A"}`,
                  borderRadius: 10, padding: "10px 14px",
                  filter: unlocked ? "none" : "blur(8px)",
                  userSelect: unlocked ? "auto" : "none",
                  transition: "filter 0.6s ease",
                }}>
                  <div>
                    <div style={{ fontSize: 9, color: t.textDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2, fontWeight: 900 }}>{m.mkt}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: cfg.color }}>✅ {m.pick}</div>
                  </div>
                  <div style={{ background: cfg.color, color: cfg.dark ? "#000" : "#fff", borderRadius: 8, padding: "8px 14px", textAlign: "center", minWidth: 55 }}>
                    <div style={{ fontFamily: "'Russo One',sans-serif", fontSize: 20, lineHeight: 1 }}>{isNaN(Number(m.odds)) ? m.odds : Number(m.odds).toFixed(2)}</div>
                    <div style={{ fontSize: 8, letterSpacing: 1, opacity: 0.8, marginTop: 1, fontWeight: 900 }}>ODDS</div>
                  </div>
                </div>
                {!unlocked && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, pointerEvents: "none" }}>
                    <span style={{ fontSize: 13 }}>🔒</span><span style={{ fontSize: 12, fontWeight: 900, color: t.textDim }}>Ticket Locked</span>
                  </div>
                )}
              </div>
              {unlocked && (
                <div onClick={() => setActiveAnalysis(m.analysis)} style={{ cursor: "pointer", marginTop: 10, background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.035)", borderRadius: 10, padding: "12px 14px", borderLeft: `4px solid ${cfg.color}88`, animation: "fadeUp 0.4s ease", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 12, color: t.textDim, lineHeight: 1.7, margin: 0, fontWeight: 800 }}>Tap to view analysis...</p>
                  <span style={{ fontSize: 16, opacity: 0.8 }}>🔍</span>
                </div>
              )}
            </div>
          ))}

          <div style={{ padding: "16px 20px", background: dark ? `${cfg.color}06` : `${cfg.color}0A`, borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: t.textDim, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>TOTAL TICKET ODDS</div>
              <div style={{ fontSize: 13, color: t.textDim, fontWeight: 900 }}>{(accum.matches || []).length} Elite Picks</div>
            </div>
            <div style={{ background: `linear-gradient(135deg,${cfg.color},${cfg.color}aa)`, color: cfg.dark ? "#000" : "#fff", borderRadius: 14, padding: "12px 22px", textAlign: "center", boxShadow: `0 8px 20px ${cfg.color}44` }}>
              <div style={{ fontFamily: "'Russo One',sans-serif", fontSize: 38, lineHeight: 1 }}>{Number(accum.total_odds ?? accum.totalOdds ?? 0).toFixed(2)}</div>
              <div style={{ fontSize: 9, letterSpacing: 2, marginTop: 3, opacity: 0.9, fontWeight: 900 }}>TOTAL ODDS</div>
            </div>
          </div>

          <div style={{ padding: "18px 20px" }}>
            {accum.tier === "free" ? null : !unlocked ? (
              <button onClick={() => setPayOpen(true)} style={{
                width: "100%", padding: "16px",
                background: `linear-gradient(135deg,${cfg.color},${cfg.color}bb)`,
                color: cfg.dark ? "#000" : "#fff",
                border: "none", borderRadius: 14, fontFamily: "'Russo One',sans-serif",
                fontSize: 17, letterSpacing: 1, cursor: "pointer", transition: "all 0.2s",
                boxShadow: `0 8px 22px ${cfg.color}44`,
              }}>
                🔓 GET DAILY ACCESS · UGX 1,000
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: `${cfg.color}10`, padding: "12px", borderRadius: 12 }}>
                <span style={{ color: cfg.color, fontSize: 16 }}>✅</span>
                <span style={{ color: cfg.color, fontWeight: 900, fontSize: 14 }}>Successfully Unlocked Ticket</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Analysis Modal */}
      {activeAnalysis && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeUp 0.3s ease" }} onClick={(e) => { if (e.target === e.currentTarget) setActiveAnalysis(null) }}>
          <div style={{ background: t.surface, border: `1.5px solid ${cfg.color}`, borderRadius: 16, padding: 20, maxWidth: 400, width: "100%", position: "relative", boxShadow: `0 10px 40px -10px ${cfg.color}88` }}>
            <button onClick={() => setActiveAnalysis(null)} style={{ position: "absolute", top: 15, right: 15, background: "none", border: "none", color: t.textDim, fontSize: 20, cursor: "pointer" }}>✕</button>
            <div style={{ fontFamily: "'Russo One',sans-serif", fontSize: 18, color: cfg.color, marginBottom: 15 }}>Match Analysis</div>
            <p style={{ fontSize: 14, color: t.text, lineHeight: 1.8, fontWeight: 800 }}>{activeAnalysis}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultTicker({ t, dark, results = [] }) {
  if (!results || results.length === 0) return null;

  // Double the items for seamless scrolling
  const items = [...results, ...results];

  const getTierConfig = (label) => {
    const l = label.toUpperCase();
    switch (l) {
      case 'FREE': return { bg: "rgba(0, 212, 94, 0.15)", border: "#00D45E", text: "#00D45E" };
      case 'VIP SAFE': return { bg: "rgba(245, 200, 66, 0.15)", border: "#F5C842", text: "#F5C842" };
      case 'VIP BIG': return { bg: "rgba(157, 78, 221, 0.15)", border: "#9D4EDD", text: "#9D4EDD" };
      default: return { bg: t.surface, border: t.border, text: t.text };
    }
  };

  return (
    <div style={{ 
      width: "100vw", 
      position: "relative",
      left: "50%",
      transform: "translateX(-50%)",
      background: dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)",
      borderTop: `1px solid ${t.border}`,
      borderBottom: `1px solid ${t.border}`,
      padding: "12px 0",
      overflow: "hidden",
      margin: "25px 0",
      userSelect: "none",
    }}>
      <div style={{ 
        display: "flex", 
        width: "max-content",
        animation: "marquee 35s linear infinite",
        gap: 20
      }}>
        {items.map((res, i) => {
          const displayLabel = res.tier === "premium" ? "VIP BIG" : res.tier === "vip" ? "VIP SAFE" : res.tier;
          const cfg = getTierConfig(displayLabel);
          return (
            <div key={i} style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 10, 
              background: cfg.bg,
              border: `1.5px solid ${cfg.border}33`,
              padding: "6px 16px",
              borderRadius: 30,
              whiteSpace: "nowrap",
              backdropFilter: "blur(4px)"
            }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: cfg.text, letterSpacing: 1, textTransform: "uppercase" }}>{displayLabel}</span>
              <div style={{ height: 14, width: 1.5, background: `${cfg.text}22` }} />
              {res.status === 'win' ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ 
                    width: 18, height: 18, borderRadius: "50%", background: "#00D45E", 
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#000",
                  }}>✓</div>
                  <span style={{ fontFamily: "'Russo One',sans-serif", fontSize: 13, color: "#00D45E", letterSpacing: 0.5 }}>{res.odds} <span style={{fontSize: 9}}>ODDS</span></span>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ 
                     width: 18, height: 18, borderRadius: "50%", background: "rgba(255,85,85,0.1)", 
                     display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#FF5555",
                     border: "1px solid rgba(255,85,85,0.4)"
                  }}>✕</div>
                  <span style={{ fontSize: 10, fontWeight: 900, color: "#FF5555", letterSpacing: 0.5 }}>LOST</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(true);
  const [accums, setAccums] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const t = dark ? DARK : LIGHT;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const userPhone = localStorage.getItem("user-phone");
      const stored = await getLatestAccumsAction(userPhone);
      if (Object.keys(stored).length > 0) {
        setAccums(stored);
      }
      const perf = await getPerformanceResultsAction();
      setPerformance(perf);
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ background: t.bg, color: t.text, minHeight: "100vh", fontFamily: "'Outfit',sans-serif", fontWeight: 800, overflowX: "hidden" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 99, background: dark ? "rgba(0,0,0,0.96)" : "rgba(242,255,245,0.96)", backdropFilter: "blur(20px)", borderBottom: `1.5px solid ${t.border}`, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="Logo" style={{ width: 38, height: 38, borderRadius: 11, boxShadow: "0 0 20px #00D45E66", objectFit: "cover" }} />
          <div>
            <div style={{ fontFamily: "'Russo One',sans-serif", fontSize: 18, letterSpacing: 1, color: t.text }}>DAILY PREDICTOR<span style={{ color: "#00D45E" }}> UG</span></div>
            <div style={{ fontSize: 9, color: t.textDim, letterSpacing: 2, textTransform: "uppercase", fontWeight: 900 }}>Metric Data Insights</div>
          </div>
        </div>
        <button onClick={() => setDark(!dark)} style={{ width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${t.border}`, background: t.surface, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s" }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </nav>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "25px 18px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 25, animation: "fadeUp 0.6s ease" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,212,94,0.1)", border: "1.5px solid rgba(0,212,94,0.3)", borderRadius: 30, padding: "7px 20px", marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: "#00D45E", fontWeight: 900, letterSpacing: 1.5 }}>📅 {new Date().toLocaleDateString("en-UG", { weekday: "long", day: "numeric", month: "long" })}</span>
          </div>
          <h1 style={{ fontFamily: "'Russo One',sans-serif", fontSize: 26, color: t.text, letterSpacing: 0.5, marginBottom: 8 }}>PRO ANALYZED <span style={{ color: "#00D45E" }}>VIP TICKETS</span></h1>
          
          <div style={{ 
            display: "inline-flex", alignItems: "center", gap: 6, 
            marginTop: 15, marginBottom: -10,
            fontSize: 10, color: t.textDim, fontWeight: 900, letterSpacing: 1.5, 
            textTransform: "uppercase", opacity: 0.8
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00D45E", animation: "pulse 2s infinite" }} />
            WEEKLY PERFORMANCE TRACKER
          </div>
          <ResultTicker t={t} dark={dark} results={performance} />
          <p style={{ fontSize: 14, color: t.textDim, lineHeight: 1.6, fontWeight: 900 }}>Expertly researched picks for today</p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 45, animation: "spin 1s linear infinite", display: "inline-block", marginBottom: 15 }}>⚙️</div>
            <div style={{ fontFamily: "'Russo One',sans-serif", fontSize: 19, color: "#00D45E", marginBottom: 10 }}>Loading Picks...</div>
          </div>
        ) : accums && Object.keys(accums).length > 0 ? (
          ["free", "vip", "premium"].map(tier =>
            accums[tier] && <AccumCard key={tier} accum={accums[tier]} dark={dark} t={t} />
          )
        ) : (
          <div style={{ textAlign: "center", padding: "60px 20px", background: t.surface, borderRadius: 20, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 40, marginBottom: 15 }}>⏳</div>
            <div style={{ fontFamily: "'Russo One',sans-serif", fontSize: 18, color: t.text }}>No Tickets Yet</div>
            <div style={{ fontSize: 13, color: t.textDim, marginTop: 8, fontWeight: 900 }}>Our experts are analyzing today's games. Check back soon!</div>
          </div>
        )}

        <div style={{ marginTop: 50, paddingTop: 30, borderTop: `1.5px solid ${t.border}`, textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Russo One',sans-serif", fontSize: 18, color: t.text, marginBottom: 10 }}>About Daily Predictor UG</h2>
          <p style={{ fontSize: 13, color: t.textDim, lineHeight: 1.6, fontWeight: 800, marginBottom: 20 }}>
            Stop betting on gut feelings. At Daily Predictor UG, we do the heavy lifting for you.
            We compile data and expert analysis from the world's leading sports platforms to transform
            complex performance metrics and advanced football statistics into clear, actionable daily tickets.
            Whether it’s an obscure league or the Champions League, we give Ugandan fans the expert insight
            they need to stay ahead of the game.
          </p>
          <div style={{ fontSize: 12, color: t.textDim, fontWeight: 900 }}>
            Powered by <span style={{ color: "#00D45E" }}>Metric Data Insights</span>
          </div>
        </div>

        <div style={{ 
          marginTop: 40, padding: "20px", 
          background: dark ? "rgba(255,85,85,0.05)" : "rgba(255,85,85,0.03)", 
          border: `1px solid ${dark ? "rgba(255,85,85,0.2)" : "rgba(255,85,85,0.15)"}`, 
          borderRadius: 16, textAlign: "center" 
        }}>
          <div style={{ fontSize: 11, color: "#FF5555", fontWeight: 900, letterSpacing: 1.5, marginBottom: 10 }}>⚠️ LEGAL DISCLAIMER & RESPONSIBLE GAMBLING</div>
          <p style={{ fontSize: 11, color: t.textDim, lineHeight: 1.8, fontWeight: 800, margin: 0 }}>
            Daily Predictor UG does not encourage, host, or conduct any betting or gambling activities on this website. 
            All analysis, picks, and updates are provided for <strong>informational and entertainment purposes only</strong>. 
            Betting decisions are made at your own personal choice and risk. <br/><br/>
            Betting can be addictive and psychologically harmful. This service is strictly <strong>not recommended</strong> for persons under the age of 18. 
            If you choose to gamble, please <strong>bet responsibly</strong>.
          </p>
        </div>
      </div>

      {/* ADMIN DOT */}
      <a href="/internal/vault-256" style={{
        position: "fixed", bottom: 20, right: 20, width: 15, height: 15,
        background: "#000", border: "1px solid #222", borderRadius: "50%",
        cursor: "pointer", opacity: 0.15, transition: "opacity 0.2s"
      }} onMouseOver={e => e.currentTarget.style.opacity = 1} onMouseOut={e => e.currentTarget.style.opacity = 0.15} />
    </div>
  );
}

const DARK = { bg: "#000000", surface: "#0C0F10", border: "#222729", text: "#FFFFFF", textDim: "#94A7AB" };
const LIGHT = { bg: "#F4FFF7", surface: "#FFFFFF", border: "#D1EDD7", text: "#15331C", textDim: "#5B8268" };
