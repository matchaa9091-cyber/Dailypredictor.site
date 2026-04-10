"use client";

import { useState } from "react";
import { saveSingleAccumAction } from "../actions";

const DARK  = { bg:"#000000", surface:"#0C0F10", border:"#1F2426", text:"#FFFFFF", textDim:"#8A9A9E" };

export default function AdminPage() {
  const [tier, setTier] = useState("free");
  const [matches, setMatches] = useState([
    { h:"", a:"", lg:"", fl:"⚽", mkt:"Match Result", pick:"", odds:1.8, conf:90, analysis:"", hot:false, kickoff: new Date().toISOString().slice(0,16) }
  ]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const addMatch = () => setMatches([...matches, { h:"", a:"", lg:"", fl:"⚽", mkt:"Match Result", pick:"", odds:1.8, conf:90, analysis:"", hot:false, kickoff: new Date().toISOString().slice(0,16) }]);
  const removeMatch = (i) => setMatches(matches.filter((_, idx) => idx !== i));
  
  const updateMatch = (i, field, val) => {
    const next = [...matches];
    next[i][field] = val;
    setMatches(next);
  };

  const handleSave = async () => {
    setLoading(true);
    setStatus("Saving...");
    try {
      const totalOdds = matches.reduce((acc, m) => acc * Number(m.odds), 1).toFixed(2);
      const firstKick = matches.reduce((a, m) => new Date(m.kickoff).getTime() < new Date(a).getTime() ? m.kickoff : a, matches[0].kickoff);
      
      const acc = {
        tier,
        matches,
        totalOdds,
        firstKick
      };
      
      const res = await saveSingleAccumAction(tier, acc);
      if (res) {
        setStatus("✅ Success! Ticket is live.");
        setMatches([{ h:"", a:"", lg:"", fl:"⚽", mkt:"Match Result", pick:"", odds:1.8, conf:90, analysis:"", hot:false, kickoff: new Date().toISOString().slice(0,16) }]);
      } else {
        setStatus("❌ Failed to save. Check Console.");
      }
    } catch (e) {
      console.error(e);
      setStatus("❌ Error: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{background:DARK.bg, color:DARK.text, minHeight:"100vh", padding:"40px 20px", fontFamily:"'Outfit', sans-serif"}}>
      <div style={{maxWidth:600, margin:"0 auto"}}>
        <h1 style={{fontFamily:"'Russo One', sans-serif", fontSize:24, marginBottom:20, color:"#00D45E"}}>ADMIN: CREATE TICKET</h1>
        
        <div style={{marginBottom:25}}>
          <label style={{display:"block", fontSize:12, color:DARK.textDim, marginBottom:8, fontWeight:700}}>SELECT TIER</label>
          <div style={{display:"flex", gap:10}}>
            {["free", "vip", "premium"].map(t => (
              <button key={t} onClick={() => setTier(t)} style={{
                flex:1, padding:"12px", borderRadius:10, border:`1.5px solid ${tier===t ? "#00D45E" : DARK.border}`,
                background:tier===t ? "rgba(0,212,94,0.1)" : DARK.surface,
                color:tier===t ? "#00D45E" : DARK.text, cursor:"pointer", fontWeight:800, textTransform:"uppercase"
              }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {matches.map((m, i) => (
          <div key={i} style={{background:DARK.surface, border:`1px solid ${DARK.border}`, borderRadius:12, padding:15, marginBottom:20, position:"relative"}}>
            <div style={{display:"flex", justifyContent:"space-between", marginBottom:15}}>
              <span style={{fontSize:11, fontWeight:900, color:DARK.textDim}}>MATCH #{i+1}</span>
              {matches.length > 1 && <button onClick={() => removeMatch(i)} style={{color:"#FF5555", background:"none", border:"none", cursor:"pointer", fontSize:11, fontWeight:800}}>REMOVE</button>}
            </div>
            
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10}}>
                <Input label="HOME TEAM" value={m.h} onChange={v => updateMatch(i, 'h', v)} />
                <Input label="AWAY TEAM" value={m.a} onChange={v => updateMatch(i, 'a', v)} />
            </div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10}}>
                <Input label="LEAGUE" value={m.lg} onChange={v => updateMatch(i, 'lg', v)} />
                <Input label="EMOJI/FLAG" value={m.fl} onChange={v => updateMatch(i, 'fl', v)} />
            </div>
            <div style={{display:"grid", gridTemplateColumns:"1.5fr 0.5fr", gap:10, marginBottom:10}}>
                <Input label="MARKET" value={m.mkt} onChange={v => updateMatch(i, 'mkt', v)} />
                <Input label="ODDS" type="number" value={m.odds} onChange={v => updateMatch(i, 'odds', v)} />
            </div>
            <div style={{marginBottom:10}}>
                <Input label="PICK (e.g. Man City Win)" value={m.pick} onChange={v => updateMatch(i, 'pick', v)} />
            </div>
            <div style={{marginBottom:10}}>
                <label style={{display:"block", fontSize:10, color:DARK.textDim, marginBottom:4, fontWeight:700}}>KICKOFF TIME (LOCAL)</label>
                <input type="datetime-local" value={m.kickoff} onChange={e => updateMatch(i, 'kickoff', e.target.value)} style={inputStyle} />
            </div>
            <div>
                <label style={{display:"block", fontSize:10, color:DARK.textDim, marginBottom:4, fontWeight:700}}>AI/ADMIN ANALYSIS</label>
                <textarea value={m.analysis} onChange={e => updateMatch(i, 'analysis', e.target.value)} placeholder="Why this pick?" style={{...inputStyle, height:60, resize:"none", paddingTop:10}} />
            </div>
            <div style={{marginTop:10, display:"flex", alignItems:"center", gap:8}}>
                <input type="checkbox" checked={m.hot} onChange={e => updateMatch(i, 'hot', e.target.checked)} />
                <span style={{fontSize:11, fontWeight:800, color:DARK.textDim}}>HOT PICK (FIRE ICON)</span>
            </div>
          </div>
        ))}

        <button onClick={addMatch} style={{width:"100%", padding:"15px", border:`2px dashed ${DARK.border}`, borderRadius:12, background:"none", color:DARK.textDim, cursor:"pointer", fontWeight:800, marginBottom:30}}>
          + ADD ANOTHER MATCH
        </button>

        <div style={{position:"sticky", bottom:20, padding:10, background:DARK.bg}}>
            <button onClick={handleSave} disabled={loading} style={{
                width:"100%", padding:"18px", background:"#00D45E", color:"#000", border:"none", borderRadius:14,
                fontFamily:"'Russo One', sans-serif", fontSize:16, cursor:"pointer", boxShadow:"0 10px 20px rgba(0,212,94,0.3)"
            }}>
                {loading ? "SAVING..." : `PUBLISH ${tier.toUpperCase()} TICKET`}
            </button>
            {status && <div style={{textAlign:"center", marginTop:10, fontSize:12, fontWeight:800, color:status.startsWith("✅") ? "#00D45E" : "#FF5555"}}>{status}</div>}
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type="text" }) {
    return (
        <div style={{flex:1}}>
            <label style={{display:"block", fontSize:10, color:DARK.textDim, marginBottom:4, fontWeight:700}}>{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
        </div>
    );
}

const inputStyle = {
    width:"100%", padding:"10px 12px", background:DARK.bg, border:`1px solid ${DARK.border}`, borderRadius:8,
    color:"#fff", fontFamily:"'Outfit', sans-serif", fontSize:14, outline:"none", fontWeight:700
};
