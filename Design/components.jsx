// Shared components for Plan marketplace prototype

const Icon = ({ name, size = 16 }) => {
  const icons = {
    home: "M3 11l9-8 9 8M5 9v11h4v-6h6v6h4V9",
    plus: "M12 5v14M5 12h14",
    arrow: "M5 12h14M13 5l7 7-7 7",
    arrowLeft: "M19 12H5M11 5l-7 7 7 7",
    check: "M20 6L9 17l-5-5",
    x: "M18 6L6 18M6 6l12 12",
    chat: "M21 12a8 8 0 01-11.8 7L4 21l2-5.2A8 8 0 1121 12z",
    settings: "M12 8a4 4 0 100 8 4 4 0 000-8z M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
    user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
    users: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.9 M16 3.1a4 4 0 010 7.8",
    bell: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 01-3.4 0",
    credit: "M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z M1 10h22",
    search: "M21 21l-4.3-4.3 M11 19a8 8 0 100-16 8 8 0 000 16z",
    file: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
    box: "M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.3 7L12 12l8.7-5 M12 22V12",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    clock: "M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2",
    warn: "M10.3 3.86L1.82 18a2 2 0 001.7 3h17a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01",
    star: "M12 2l3.1 6.3 7 1-5 4.9 1.1 6.9-6.2-3.3-6.2 3.3L7 14.2 2 9.3l7-1z",
    eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 100-6 3 3 0 000 6z",
    flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22V15",
    pkg: "M16.5 9.4L7.55 4.24 M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12",
    money: "M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    layers: "M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5",
    chart: "M3 3v18h18 M7 12l4-4 4 4 5-5"
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]?.split(" M").map((d, i) =>
      <path key={i} d={i === 0 ? d : "M" + d} />
      )}
    </svg>);

};

const Badge = ({ tone = "muted", children, dot }) =>
<span className={`badge ${tone}`} style={{ backgroundColor: "rgba(58, 47, 22, 0.25)" }}>
    {dot && <span className="dot" />}
    {children}
  </span>;


const StatusBadge = ({ status }) => {
  const t = useT();
  const map = {
    DRAFT: { tone: "muted", label: "Draft" },
    PUBLISHED: { tone: "info", label: "Publicat" },
    CLAIMED: { tone: "walnut", label: "Claim activ" },
    NEGOTIATION: { tone: "amber", label: "Negociere" },
    OFFER_SENT: { tone: "info", label: "Ofertă trimisă" },
    ACCEPTED: { tone: "sage", label: "Acceptată" },
    REJECTED: { tone: "crimson", label: "Respins" },
    EXPIRED: { tone: "muted", label: "Expirat" },
    IN_PROGRESS: { tone: "walnut", label: "În execuție" },
    COMPLETED: { tone: "sage", label: "Finalizat" },
    SMALL: { tone: "muted", label: "Small" },
    MEDIUM: { tone: "walnut", label: "Medium" },
    LARGE: { tone: "ink", label: "Large" }
  };
  const s = map[status] || { tone: "muted", label: status };
  return <Badge tone={s.tone} dot>{t(s.label)}</Badge>;
};

const Avatar = ({ name, size = 32, tone = "walnut" }) => {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const bg = tone === "ink" ? "var(--ink)" : tone === "sage" ? "var(--sage)" : "var(--walnut)";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color: "#FBF6EC",
      display: "grid", placeItems: "center",
      fontFamily: "var(--font-serif)", fontSize: size * 0.42,
      flexShrink: 0, backgroundColor: "rgb(146, 111, 46)"
    }}>{initials}</div>);

};

const TierBadge = ({ tier }) => {
  const cls = tier === "PLATINUM" ? "tier-platinum" : tier === "GOLD" ? "tier-gold" : "tier-silver";
  return (
    <span className={`badge ${cls}`} style={{ border: "none" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
      {tier}
    </span>);

};

const Stepper = ({ steps, current }) =>
<div className="stepper">
    {steps.map((s, i) =>
  <React.Fragment key={i}>
        <div className={`step ${i < current ? "done" : i === current ? "active" : ""}`}>
          <div className="num">{i < current ? "✓" : i + 1}</div>
          <div className="label">{s}</div>
        </div>
        {i < steps.length - 1 && <div className="step-sep" />}
      </React.Fragment>
  )}
  </div>;


const SlotTrack = ({ filled, total, warn }) =>
<div className="slot-track">
    {Array.from({ length: total }).map((_, i) =>
  <div key={i} className={`slot ${i < filled ? warn ? "warn" : "filled" : ""}`} />
  )}
  </div>;


const ScoreGauge = ({ score, size }) => {
  const max = 200;
  const pct = Math.min(100, score / max * 100);
  return (
    <div className="score-gauge">
      <div className="num">{score}</div>
      <div>
        <div className="label" style={{ color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>Project Score</div>
        <div className="bar"><span style={{ width: `${pct}%` }} /></div>
        <div className="thresholds">
          <span>0</span><span>SMALL · 60</span><span>MEDIUM · 120</span><span>LARGE</span>
        </div>
      </div>
      <div className="size-pill">{size}</div>
    </div>);

};

const ImagePlaceholder = ({ label, height = 160, width }) =>
<div className="img-ph" style={{ height, width }}>
    {label}
  </div>;


const Alert = ({ tone = "info", icon, title, children, action }) =>
<div className={`alert ${tone}`}>
    {icon && <div className="icon">{icon}</div>}
    <div style={{ flex: 1 }}>
      {title && <div style={{ fontWeight: 500, marginBottom: 2 }}>{title}</div>}
      <div>{children}</div>
    </div>
    {action}
  </div>;


const Tabs = ({ tabs, current, onChange }) =>
<div className="tabs">
    {tabs.map((t) =>
  <button key={t} className={`tab ${current === t ? "active" : ""}`} onClick={() => onChange(t)}>{t}</button>
  )}
  </div>;


const Toggle = ({ on, onChange }) =>
<div className={`toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)} />;


// Export to window
Object.assign(window, {
  Icon, Badge, StatusBadge, Avatar, TierBadge, Stepper, SlotTrack,
  ScoreGauge, ImagePlaceholder, Alert, Tabs, Toggle
});