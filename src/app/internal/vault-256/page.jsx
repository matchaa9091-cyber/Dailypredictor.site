"use client";

import { useState, useEffect, useCallback } from "react";
import {
  saveSingleAccumAction,
  getAllAccumsAction,
  deleteAccumAction,
  updateAccumAction,
  getPaymentRequestsAction,
  verifyPaymentAction,
  getSmsLogsAction,
} from "../../actions";

// ─── Design tokens ───────────────────────────────────────────────────────────
const DARK = {
  bg: "#000000",
  surface: "#0C0F10",
  surface2: "#111517",
  border: "#1F2426",
  text: "#FFFFFF",
  textDim: "#8A9A9E",
  green: "#00D45E",
  red: "#FF5555",
  amber: "#FFA800",
  blue: "#3B9EFF",
};

const TIER_COLOR = { free: DARK.green, vip: DARK.amber, premium: DARK.blue };

// ─── Shared input style ───────────────────────────────────────────────────────
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  background: DARK.bg,
  border: `1px solid ${DARK.border}`,
  borderRadius: 8,
  color: "#fff",
  fontFamily: "'Outfit', sans-serif",
  fontSize: 14,
  outline: "none",
  fontWeight: 700,
  boxSizing: "border-box",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function blankMatch() {
  return {
    h: "", a: "", lg: "", fl: "⚽", mkt: "Match Result",
    pick: "", odds: 1.8, conf: 90, analysis: "", hot: false,
    kickoff: new Date().toISOString(),
  };
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function toLocalH5(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Sub-component: single input row ─────────────────────────────────────────
function Input({ label, value, onChange, type = "text" }) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: "block", fontSize: 10, color: DARK.textDim, marginBottom: 4, fontWeight: 700 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

// ─── Sub-component: match card (used in both create & edit forms) ─────────────
function MatchCard({ match: m, index: i, total, onUpdate, onRemove }) {
  return (
    <div style={{
      background: DARK.surface2, border: `1px solid ${DARK.border}`,
      borderRadius: 12, padding: 15, marginBottom: 16, position: "relative",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: DARK.textDim }}>MATCH #{i + 1}</span>
        {total > 1 && (
          <button
            onClick={() => onRemove(i)}
            style={{ color: DARK.red, background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 800 }}
          >
            REMOVE
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <Input label="HOME TEAM" value={m.h} onChange={(v) => onUpdate(i, "h", v)} />
        <Input label="AWAY TEAM" value={m.a} onChange={(v) => onUpdate(i, "a", v)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <Input label="LEAGUE" value={m.lg} onChange={(v) => onUpdate(i, "lg", v)} />
        <Input label="EMOJI/FLAG" value={m.fl} onChange={(v) => onUpdate(i, "fl", v)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.5fr", gap: 10, marginBottom: 10 }}>
        <Input label="MARKET" value={m.mkt} onChange={(v) => onUpdate(i, "mkt", v)} />
        <Input label="ODDS" type="number" value={m.odds} onChange={(v) => onUpdate(i, "odds", v)} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <Input label="PICK (e.g. Man City Win)" value={m.pick} onChange={(v) => onUpdate(i, "pick", v)} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 10, color: DARK.textDim, marginBottom: 4, fontWeight: 700 }}>
          KICKOFF TIME (LOCAL)
        </label>
        <input
          type="datetime-local"
          value={m.kickoff ? toLocalH5(m.kickoff) : ""}
          onChange={(e) => {
            const d = new Date(e.target.value);
            if (!isNaN(d.getTime())) onUpdate(i, "kickoff", d.toISOString());
          }}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 10, color: DARK.textDim, marginBottom: 4, fontWeight: 700 }}>
          AI/ADMIN ANALYSIS
        </label>
        <textarea
          value={m.analysis || ""}
          onChange={(e) => onUpdate(i, "analysis", e.target.value)}
          placeholder="Why this pick?"
          style={{ ...inputStyle, height: 60, resize: "none", paddingTop: 10 }}
        />
      </div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={!!m.hot}
          onChange={(e) => onUpdate(i, "hot", e.target.checked)}
        />
        <span style={{ fontSize: 11, fontWeight: 800, color: DARK.textDim }}>HOT PICK 🔥</span>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ accum, onClose, onSaved }) {
  const [tier, setTier] = useState(accum.tier);
  const [matches, setMatches] = useState(accum.matches.map((m) => ({ ...m })));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const updateMatch = (i, field, val) => {
    const next = [...matches];
    next[i][field] = val;
    setMatches(next);
  };

  const addMatch = () => setMatches([...matches, blankMatch()]);
  const removeMatch = (i) => setMatches(matches.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    setStatus("Saving…");
    const ok = await updateAccumAction(accum.id, tier, matches);
    if (ok) {
      setStatus("✅ Saved!");
      setTimeout(() => { onSaved(); onClose(); }, 800);
    } else {
      setStatus("❌ Failed to save.");
    }
    setSaving(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.85)", display: "flex",
      alignItems: "flex-start", justifyContent: "center",
      overflowY: "auto", padding: "40px 16px",
    }}>
      <div style={{
        background: DARK.surface, border: `1px solid ${DARK.border}`,
        borderRadius: 18, padding: 28, width: "100%", maxWidth: 620,
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ fontFamily: "'Russo One', sans-serif", fontSize: 18, color: DARK.green, margin: 0 }}>
            EDIT TICKET
          </h2>
          <button onClick={onClose} style={{
            background: "none", border: `1px solid ${DARK.border}`, borderRadius: 8,
            color: DARK.textDim, cursor: "pointer", padding: "6px 14px", fontSize: 12, fontWeight: 800,
          }}>✕ CLOSE</button>
        </div>

        {/* Tier selector */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ display: "block", fontSize: 12, color: DARK.textDim, marginBottom: 8, fontWeight: 700 }}>
            SELECT TIER
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            {["free", "vip", "premium"].map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                style={{
                  flex: 1, padding: "11px", borderRadius: 10,
                  border: `1.5px solid ${tier === t ? TIER_COLOR[t] : DARK.border}`,
                  background: tier === t ? `${TIER_COLOR[t]}18` : DARK.bg,
                  color: tier === t ? TIER_COLOR[t] : DARK.text,
                  cursor: "pointer", fontWeight: 800, textTransform: "uppercase", fontSize: 13,
                }}
              >
                {t === "vip" ? "VIP SAFE" : t === "premium" ? "VIP BIG" : t}
              </button>
            ))}
          </div>
        </div>

        {/* Matches */}
        {matches.map((m, i) => (
          <MatchCard
            key={i} match={m} index={i} total={matches.length}
            onUpdate={updateMatch} onRemove={removeMatch}
          />
        ))}

        <button
          onClick={addMatch}
          style={{
            width: "100%", padding: "14px",
            border: `2px dashed ${DARK.border}`, borderRadius: 12,
            background: "none", color: DARK.textDim, cursor: "pointer", fontWeight: 800, marginBottom: 20,
          }}
        >+ ADD ANOTHER MATCH</button>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%", padding: "17px",
            background: DARK.green, color: "#000", border: "none", borderRadius: 13,
            fontFamily: "'Russo One', sans-serif", fontSize: 15, cursor: "pointer",
            boxShadow: `0 8px 20px ${DARK.green}44`,
          }}
        >
          {saving ? "SAVING…" : "SAVE CHANGES"}
        </button>
        {status && (
          <div style={{
            textAlign: "center", marginTop: 10, fontSize: 12, fontWeight: 800,
            color: status.startsWith("✅") ? DARK.green : DARK.red,
          }}>{status}</div>
        )}
      </div>
    </div>
  );
}

// ─── SMS Logs Tab ────────────────────────────────────────────────────────────
function SmsLogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    const data = await getSmsLogsAction();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => { loadLogs(); }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: DARK.text }}>💬 SMS INTELLIGENCE FEED</div>
          <div style={{ fontSize: 11, color: DARK.textDim, marginTop: 3 }}>Live webhook receives — auto-matched to payments</div>
        </div>
        <button onClick={loadLogs} style={{ background: DARK.surface, border: `1px solid ${DARK.border}`, color: DARK.textDim, padding: "6px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer" }}>↻ Refresh</button>
      </div>

      {/* Webhook URL info */}
      <div style={{ marginBottom: 20, padding: 14, background: "rgba(59,158,255,0.08)", border: `1px solid ${DARK.blue}33`, borderRadius: 10 }}>
        <div style={{ fontSize: 10, color: DARK.blue, fontWeight: 900, letterSpacing: 1, marginBottom: 6 }}>📡 WEBHOOK ENDPOINT</div>
        <code style={{ fontSize: 11, color: DARK.text, fontFamily: "monospace", wordBreak: "break-all" }}>
          POST https://dailypredictor.site/api/v1/momo-webhook
        </code>
        <div style={{ fontSize: 10, color: DARK.textDim, marginTop: 6 }}>
          Key: <code style={{ color: DARK.amber }}>Danvid_API_Key_256</code> — Use SMS Forwarder app on your phone
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: DARK.textDim }}>Loading SMS logs…</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, border: `1px dashed ${DARK.border}`, borderRadius: 14, color: DARK.textDim }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>📭</div>
          <div style={{ fontWeight: 800 }}>No SMS received yet.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Set up SMS Forwarder on your phone to start receiving.</div>
        </div>
      ) : (
        logs.map((sms, i) => (
          <div key={sms.id || i} style={{
            background: DARK.surface,
            border: `1px solid ${sms.status === 'matched' ? DARK.green : DARK.border}`,
            borderRadius: 12, padding: 14, marginBottom: 12, animation: "fadeUp 0.3s ease"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: DARK.textDim }}>{sms.sender || "UNKNOWN"}</span>
                <span style={{
                  fontSize: 9, fontWeight: 900, padding: "2px 8px", borderRadius: 20,
                  background: sms.status === 'matched' ? `${DARK.green}22` : `${DARK.amber}22`,
                  color: sms.status === 'matched' ? DARK.green : DARK.amber,
                }}>
                  {sms.status === 'matched' ? '✅ MATCHED' : sms.status === 'processing' ? '⚙️ PROCESSING' : '📥 RECEIVED'}
                </span>
              </div>
              <span style={{ fontSize: 10, color: DARK.textDim }}>{formatDate(sms.created_at)}</span>
            </div>
            <div style={{ fontSize: 12, color: DARK.text, lineHeight: 1.6, background: DARK.bg, padding: "8px 10px", borderRadius: 8, fontFamily: "monospace" }}>
              {sms.content}
            </div>
          </div>
        ))
      )}

      <div style={{ marginTop: 16, padding: 14, background: "rgba(0,212,94,0.05)", borderRadius: 10, border: `1px solid ${DARK.green}22` }}>
        <p style={{ margin: 0, fontSize: 11, color: DARK.textDim, lineHeight: 1.6 }}>
          💡 <strong style={{ color: DARK.text }}>How it works:</strong> When a customer pays MoMo/Airtel, 
          an SMS arrives on your phone. The SMS Forwarder app sends it here. The system extracts the Transaction ID 
          and instantly unlocks the ticket for the matching customer — zero delay, zero manual work.
        </p>
      </div>
    </div>
  );
}

// ─── The Main Admin Logic ────────────────────────────────────────────────────
function AdminDashboard() {
  // ── CREATE TAB state ───────────────────────────────────────────────────────
  const [tab, setTab] = useState("create"); // "create" | "manage"
  const [tier, setTier] = useState("free");
  const [matches, setMatches] = useState([blankMatch()]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // ── MANAGE TAB state ───────────────────────────────────────────────────────
  const [accums, setAccums] = useState([]);
  const [fetchingAccums, setFetchingAccums] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // ticket being edited
  const [filterTier, setFilterTier] = useState("all");
  const [deletingId, setDeletingId] = useState(null);

  // ── PAYMENTS TAB state ──────────────────────────────────────────────────────
  const [payments, setPayments] = useState([]);
  const [fetchingPayments, setFetchingPayments] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);

  // ── Helpers: Create tab ────────────────────────────────────────────────────
  const addMatch = () => setMatches([...matches, blankMatch()]);
  const removeMatch = (i) => setMatches(matches.filter((_, idx) => idx !== i));
  const updateMatch = (i, field, val) => {
    const next = [...matches];
    next[i][field] = val;
    setMatches(next);
  };

  const loadPayments = async () => {
    setFetchingPayments(true);
    const data = await getPaymentRequestsAction();
    setPayments(data);
    setFetchingPayments(false);
  };

  const handleSave = async () => {
    setLoading(true);
    setStatus("Saving…");
    try {
      const totalOdds = matches.reduce((acc, m) => acc * (isNaN(Number(m.odds)) ? 1 : Number(m.odds)), 1).toFixed(2);
      const firstKick = matches.reduce(
        (a, m) => new Date(m.kickoff).getTime() < new Date(a).getTime() ? m.kickoff : a,
        matches[0].kickoff
      );
      const res = await saveSingleAccumAction(tier, { tier, matches, totalOdds, firstKick });
      if (res) {
        setStatus("✅ Success! Ticket is live.");
        setMatches([blankMatch()]);
      } else {
        setStatus("❌ Failed to save. Check Console.");
      }
    } catch (e) {
      console.error(e);
      setStatus("❌ Error: " + e.message);
    }
    setLoading(false);
  };

  const loadAccums = useCallback(async () => {
    setFetchingAccums(true);
    const data = await getAllAccumsAction();
    setAccums(data);
    setFetchingAccums(false);
  }, []);

  useEffect(() => {
    if (tab === "manage") loadAccums();
    if (tab === "payments") loadPayments();
  }, [tab, loadAccums]);

  const handleVerify = async (id) => {
    if (!confirm("Verify this payment? This will unlock the ticket for the user.")) return;
    setVerifyingId(id);
    const ok = await verifyPaymentAction(id);
    if (ok) {
      setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'verified' } : p));
      alert("Success! Ticket has been unlocked for the user.");
    } else {
      alert("Verification failed. Check your database connection.");
    }
    setVerifyingId(null);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this ticket? This cannot be undone.")) return;
    setDeletingId(id);
    const ok = await deleteAccumAction(id);
    if (ok) setAccums((prev) => prev.filter((a) => a.id !== id));
    setDeletingId(null);
  };

  const filteredAccums = filterTier === "all"
    ? accums
    : accums.filter((a) => a.tier === filterTier);

  return (
    <div style={{ maxWidth: 660, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "'Russo One', sans-serif", fontSize: 22, marginBottom: 28, color: DARK.green, letterSpacing: 1 }}>⚡ PREDICTOR ADMIN</h1>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
        {[
          { key: "create", label: "✏️ Create" },
          { key: "manage", label: "🗂️ Manage" },
          { key: "payments", label: "💰 Payments" },
          { key: "sms", label: "💬 SMS Logs" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1, padding: "11px 8px", borderRadius: 12,
              border: `1.5px solid ${tab === key ? DARK.green : DARK.border}`,
              background: tab === key ? "rgba(0,212,94,0.1)" : DARK.surface,
              color: tab === key ? DARK.green : DARK.textDim,
              cursor: "pointer", fontWeight: 800, fontSize: 12, transition: "all .2s",
            }}
          >{label}</button>
        ))}
      </div>

      {tab === "create" && (
        <>
          <div style={{ marginBottom: 25 }}>
            <label style={{ display: "block", fontSize: 12, color: DARK.textDim, marginBottom: 8, fontWeight: 700 }}>SELECT TIER</label>
            <div style={{ display: "flex", gap: 10 }}>
              {["free", "vip", "premium"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  style={{
                    flex: 1, padding: "12px", borderRadius: 10,
                    border: `1.5px solid ${tier === t ? TIER_COLOR[t] : DARK.border}`,
                    background: tier === t ? `${TIER_COLOR[t]}18` : DARK.surface,
                    color: tier === t ? TIER_COLOR[t] : DARK.text,
                    cursor: "pointer", fontWeight: 800, textTransform: "uppercase",
                  }}
                >{t === "vip" ? "VIP SAFE" : t === "premium" ? "VIP BIG" : t}</button>
              ))}
            </div>
          </div>
          {matches.map((m, i) => (
            <MatchCard key={i} match={m} index={i} total={matches.length} onUpdate={updateMatch} onRemove={removeMatch} />
          ))}
          <button onClick={addMatch} style={{ width: "100%", padding: "15px", border: `2px dashed ${DARK.border}`, borderRadius: 12, background: "none", color: DARK.textDim, cursor: "pointer", fontWeight: 800, marginBottom: 30 }}>+ ADD ANOTHER MATCH</button>
          <div style={{ position: "sticky", bottom: 20, padding: 10, background: DARK.bg }}>
            <button onClick={handleSave} disabled={loading} style={{ width: "100%", padding: "18px", background: DARK.green, color: "#000", border: "none", borderRadius: 14, fontFamily: "'Russo One', sans-serif", fontSize: 16, cursor: "pointer", boxShadow: `0 10px 20px ${DARK.green}4D` }}>
              {loading ? "SAVING…" : `PUBLISH ${tier.toUpperCase()} TICKET`}
            </button>
            {status && <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, fontWeight: 800, color: status.startsWith("✅") ? DARK.green : DARK.red }}>{status}</div>}
          </div>
        </>
      )}

      {tab === "manage" && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 22, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }}>
              {["all", "free", "vip", "premium"].map((t) => (
                <button key={t} onClick={() => setFilterTier(t)} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 800, border: `1.5px solid ${filterTier === t ? (TIER_COLOR[t] || DARK.green) : DARK.border}`, background: filterTier === t ? `${TIER_COLOR[t] || DARK.green}18` : DARK.surface, color: filterTier === t ? (TIER_COLOR[t] || DARK.green) : DARK.textDim, cursor: "pointer", textTransform: "uppercase" }}>{t === "vip" ? "VIP SAFE" : t === "premium" ? "VIP BIG" : t}</button>
              ))}
            </div>
            <button onClick={loadAccums} disabled={fetchingAccums} style={{ padding: "9px 18px", borderRadius: 9, border: `1px solid ${DARK.border}`, background: DARK.surface, color: DARK.textDim, cursor: "pointer", fontSize: 12, fontWeight: 800 }}>{fetchingAccums ? "⟳ Loading…" : "↻ Refresh"}</button>
          </div>
          {!fetchingAccums && filteredAccums.map((acc) => {
            const tc = TIER_COLOR[acc.tier] || DARK.green;
            return (
              <div key={acc.id} style={{ background: DARK.surface, border: `1px solid ${DARK.border}`, borderRadius: 14, marginBottom: 18, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${DARK.border}`, background: `${tc}0A` }}>
                  <span style={{ background: `${tc}22`, color: tc, padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>{acc.tier === "vip" ? "VIP SAFE" : acc.tier === "premium" ? "VIP BIG" : acc.tier}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: DARK.text }}>×{Number(acc.total_odds).toFixed(2)} odds <span style={{ fontSize: 11, color: DARK.textDim, fontWeight: 600, marginLeft: 10 }}>{acc.matches?.length || 0} matches</span></div>
                    <div style={{ fontSize: 11, color: DARK.textDim, marginTop: 2 }}>📅 {formatDate(acc.first_kickoff)} <span style={{ marginLeft: 12, color: DARK.border }}>|</span> <span style={{ marginLeft: 12 }}>Created: {formatDate(acc.created_at)}</span></div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setEditTarget(acc)} style={{ padding: "8px 16px", borderRadius: 9, border: `1.5px solid ${DARK.blue}`, background: `${DARK.blue}18`, color: DARK.blue, cursor: "pointer", fontSize: 12, fontWeight: 800 }}>✏️ Edit</button>
                    <button onClick={() => handleDelete(acc.id)} disabled={deletingId === acc.id} style={{ padding: "8px 16px", borderRadius: 9, border: `1.5px solid ${DARK.red}`, background: `${DARK.red}18`, color: DARK.red, cursor: "pointer", fontSize: 12, fontWeight: 800 }}>{deletingId === acc.id ? "…" : "🗑 Delete"}</button>
                  </div>
                </div>
                {(acc.matches || []).length > 0 && <div style={{ padding: "12px 18px" }}>{(acc.matches).map((m, mi) => (
                  <div key={m.id || mi} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: mi < acc.matches.length - 1 ? `1px solid ${DARK.border}` : "none" }}>
                    <span style={{ fontSize: 18 }}>{m.fl || "⚽"}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: DARK.text }}>{m.h} <span style={{ color: DARK.textDim, fontWeight: 400 }}>vs</span> {m.a}</span>
                      <div style={{ fontSize: 11, color: DARK.textDim, marginTop: 2 }}>{m.lg} · {m.mkt} → <strong style={{ color: tc }}>{m.pick}</strong> <span style={{ marginLeft: 8, color: DARK.text, fontWeight: 700 }}>@{Number(m.odds).toFixed(2)}</span> {m.hot && <span style={{ marginLeft: 6 }}>🔥</span>}</div>
                    </div>
                  </div>
                ))}</div>}
              </div>
            );
          })}
        </>
      )}

      {tab === "payments" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: DARK.textDim, fontWeight: 800 }}>LATEST PAYMENT ATTEMPTS</div>
            <button onClick={loadPayments} style={{ background: DARK.surface, border: `1px solid ${DARK.border}`, color: DARK.textDim, padding: "6px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer" }}>↻ Refresh</button>
          </div>
          {payments.map((p, i) => (
            <div key={p.id || i} style={{ background: DARK.surface, border: `1px solid ${p.status==='verified'?DARK.green:DARK.border}`, borderRadius: 14, padding: 18, marginBottom: 15, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: DARK.text }}>+256 {p.phone_number}</span>
                  {p.status === 'verified' && <span style={{ background: DARK.green, color: "#000", fontSize: 9, fontWeight: 900, padding: "2px 8px", borderRadius: 20 }}>VERIFIED</span>}
                </div>
                <div style={{ fontSize: 11, color: DARK.textDim, display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ color: p.method === "mtn" ? DARK.amber : DARK.red, fontWeight: 900, textTransform: "uppercase" }}>{p.method}</span>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <span>{p.tier?.toUpperCase()} TICKET</span>
                  <span style={{ opacity: 0.3 }}>|</span>
                  <span>{formatDate(p.created_at)}</span>
                </div>
                <div style={{ marginTop: 10, background: DARK.bg, borderRadius: 8, padding: "8px 12px", border: `1px solid ${DARK.border}`, display: "inline-block" }}>
                  <span style={{ fontSize: 10, color: DARK.textDim, fontWeight: 800, marginRight: 8 }}>TX ID:</span>
                  <span style={{ fontSize: 12, color: DARK.green, fontWeight: 900, fontFamily: "monospace" }}>{p.transaction_id || "N/A"}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", marginLeft: 20 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: DARK.text, marginBottom: 8 }}>UGX {p.amount?.toLocaleString()}</div>
                {p.status === 'pending' ? <button onClick={() => handleVerify(p.id)} disabled={verifyingId === p.id} style={{ background: DARK.green, color: "#000", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 900, cursor: "pointer", boxShadow: `0 4px 12px ${DARK.green}44` }}>{verifyingId === p.id ? "..." : "✅ VERIFY"}</button> : <div style={{ color: DARK.textDim, fontSize: 11, fontWeight: 800 }}>COMPLETED</div>}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === "sms" && <SmsLogsTab />}

      {editTarget && <EditModal accum={editTarget} onClose={() => setEditTarget(null)} onSaved={loadAccums} />}
    </div>
  );
}

// ─── The Root Secret Entrance ────────────────────────────────────────────────
export default function SecretVaultPage() {
  const [pass, setPass] = useState("");
  const [isAuth, setIsAuth] = useState(false);
  const [error, setError] = useState(false);

  // If already authorized in this session, skip prompt
  useEffect(() => {
    if (sessionStorage.getItem("admin_vault_auth") === "true") {
      setIsAuth(true);
    }
  }, []);

  const handleAuth = (e) => {
    e?.preventDefault();
    if (pass === "Danvid256.") {
      setIsAuth(true);
      setError(false);
      sessionStorage.setItem("admin_vault_auth", "true");
    } else {
      setError(true);
      setPass("");
    }
  };

  if (isAuth) {
    return (
      <div style={{ background: DARK.bg, minHeight: "100vh" }}>
        <AdminDashboard />
      </div>
    );
  }

  return (
    <div style={{ background: DARK.bg, color: DARK.text, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 360, width: "100%", textAlign: "center", animation: "fadeUp 0.6s ease" }}>
        <div style={{ fontSize: 50, marginBottom: 20 }}>🔒</div>
        <h2 style={{ fontFamily: "'Russo One', sans-serif", fontSize: 20, marginBottom: 10 }}>ADMIN VAULT</h2>
        <p style={{ color: DARK.textDim, fontSize: 13, marginBottom: 30, fontWeight: 700 }}>Enter secure passphrase to access control panel.</p>
        
        <form onSubmit={handleAuth}>
          <input 
            type="password" 
            placeholder="Passphrase..." 
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            style={{ ...inputStyle, textAlign: "center", fontSize: 18, padding: "15px", letterSpacing: 4, border: error ? `1.5px solid ${DARK.red}` : `1.5px solid ${DARK.border}` }}
            autoFocus
          />
          {error && <div style={{ color: DARK.red, fontSize: 12, marginTop: 10, fontWeight: 800 }}>❌ Incorrect passphrase. Access denied.</div>}
          
          <button type="submit" style={{ width: "100%", marginTop: 20, padding: "15px", background: DARK.green, color: "#000", border: "none", borderRadius: 10, fontWeight: 900, cursor: "pointer", fontSize: 14 }}>
            UNLOCK ACCESS
          </button>
        </form>

        <div style={{ marginTop: 40, borderTop: `1px solid ${DARK.border}`, paddingTop: 20, fontSize: 10, color: DARK.textDim, fontWeight: 800 }}>
          ESTABLISHED SECURE CONNECTION · DAILY PREDICTOR UG
        </div>
      </div>
    </div>
  );
}
