import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ComposedChart, Line, ReferenceLine
} from "recharts";

const TABS = ["Vekst", "Kostnaden av å vente", "Sammenligning", "Pensjon"];

const formatNOK = (v) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return Math.round(v).toLocaleString("nb-NO");
};
const formatNOKFull = (v) => Math.round(v).toLocaleString("nb-NO") + " kr";

const PROFILES = [
  { id: "conservative", label: "Forsiktig", rate: 5, emoji: "🛡️", color: "#5ba8ff", desc: "Rentefond / obligasjoner", risk: "Lav risiko · Stabil vekst" },
  { id: "balanced", label: "Balansert", rate: 7.5, emoji: "⚖️", color: "#b48cff", desc: "Kombinasjonsfond (60/40)", risk: "Middels risiko · Jevn vekst" },
  { id: "aggressive", label: "Aggressiv", rate: 10, emoji: "🚀", color: "#7cff6b", desc: "Globalt indeksfond / aksjer", risk: "Høy risiko · Høyest potensial" },
];

const TAX_RATE = 0.3784; // Aksjesparekonto: 22% × 1.72

const Slider = ({ label, value, onChange, min, max, step, format, suffix = "", color = "#7cff6b" }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
      <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#8a8f98", fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 700, color: "#e0ffd6", fontFamily: "'Space Mono', monospace" }}>
        {format ? format(value) : value}{suffix}
      </span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: "100%", accentColor: color }} />
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", fontFamily: "'DM Sans', sans-serif" }}>
      <span>{format ? format(min) : min}{suffix}</span>
      <span>{format ? format(max) : max}{suffix}</span>
    </div>
  </div>
);

const StatCard = ({ label, value, sub, accent = false, highlight = false, negative = false }) => (
  <div style={{
    background: highlight ? "linear-gradient(135deg, #1a3a15 0%, #0d1f0a 100%)" : negative ? "rgba(255,60,60,0.03)" : "rgba(255,255,255,0.03)",
    border: highlight ? "1px solid rgba(124,255,107,0.3)" : negative ? "1px solid rgba(255,60,60,0.12)" : "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12, padding: "14px 16px", flex: 1, minWidth: 130
  }}>
    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#666", marginBottom: 5, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: negative ? "#ff6b6b" : accent ? "#7cff6b" : "#f0f0f0", fontFamily: "'Space Mono', monospace" }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>{sub}</div>}
  </div>
);

const compute = (lumpSum, monthly, rate, years, delayYears = 0) => {
  const monthlyRate = rate / 100 / 12;
  const data = [];
  let invested = lumpSum, total = lumpSum;
  const totalMonths = years * 12;
  const delayMonths = delayYears * 12;

  if (delayYears > 0) { invested = 0; total = 0; }

  data.push({ year: 0, invested, total: Math.round(total), interest: 0, label: "År 0" });

  for (let m = 1; m <= totalMonths; m++) {
    if (m > delayMonths) {
      if (m === delayMonths + 1 && delayYears > 0) {
        total = lumpSum;
        invested = lumpSum;
      }
      total = total * (1 + monthlyRate) + monthly;
      invested += monthly;
    }
    if (m % 12 === 0) {
      data.push({
        year: m / 12,
        invested: Math.round(invested),
        total: Math.round(total),
        interest: Math.round(total - invested),
        label: `År ${m / 12}`
      });
    }
  }
  return { data, finalTotal: Math.round(total), finalInvested: Math.round(invested), finalInterest: Math.round(total - invested) };
};

const computeTax = (totalValue, totalInvested) => {
  const gain = Math.max(0, totalValue - totalInvested);
  const tax = gain * TAX_RATE;
  return { gain: Math.round(gain), tax: Math.round(tax), afterTax: Math.round(totalValue - tax) };
};

const milestones = [100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];

const findMilestones = (lumpSum, monthly, rate, years) => {
  const monthlyRate = rate / 100 / 12;
  let total = lumpSum;
  const found = [];
  for (let m = 1; m <= years * 12; m++) {
    total = total * (1 + monthlyRate) + monthly;
    for (const ms of milestones) {
      if (total >= ms && !found.find(f => f.amount === ms)) {
        const y = Math.floor(m / 12);
        const mo = m % 12;
        found.push({ amount: ms, months: m, label: `${y} år${mo > 0 ? ` ${mo} mnd` : ""}` });
      }
    }
  }
  return found;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1a1d23", border: "1px solid rgba(124,255,107,0.2)",
      borderRadius: 8, padding: "10px 14px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
    }}>
      <div style={{ fontSize: 12, color: "#7cff6b", fontWeight: 600, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: p.color || "#ccc", marginBottom: 2, fontFamily: "'Space Mono', monospace" }}>
          {p.name}: {formatNOKFull(p.value)}
        </div>
      ))}
    </div>
  );
};

export default function CompoundCalculator() {
  const [monthly, setMonthly] = useState(3000);
  const [lumpSum, setLumpSum] = useState(0);
  const [years, setYears] = useState(25);
  const [activeTab, setActiveTab] = useState(0);
  const [showInflation, setShowInflation] = useState(false);
  const [showTax, setShowTax] = useState(false);
  const [profileIdx, setProfileIdx] = useState(2);
  const [age, setAge] = useState(30);
  const [retireAge, setRetireAge] = useState(67);

  const profile = PROFILES[profileIdx];
  const inflationRate = 2.5;
  const rate = profile.rate;
  const effectiveRate = showInflation ? rate - inflationRate : rate;

  const pensionYears = Math.max(1, retireAge - age);

  const result = useMemo(() => compute(lumpSum, monthly, effectiveRate, years), [lumpSum, monthly, effectiveRate, years]);
  const delay1 = useMemo(() => compute(lumpSum, monthly, effectiveRate, years, 1), [lumpSum, monthly, effectiveRate, years]);
  const delay3 = useMemo(() => compute(lumpSum, monthly, effectiveRate, years, 3), [lumpSum, monthly, effectiveRate, years]);
  const delay5 = useMemo(() => compute(lumpSum, monthly, effectiveRate, years, 5), [lumpSum, monthly, effectiveRate, years]);

  const savingsResult = useMemo(() => compute(lumpSum, monthly, showInflation ? 1 : 3.5, years), [lumpSum, monthly, years, showInflation]);

  const pensionResult = useMemo(() => compute(lumpSum, monthly, effectiveRate, pensionYears), [lumpSum, monthly, effectiveRate, pensionYears]);
  const pensionProfiles = useMemo(() => PROFILES.map(p => {
    const r = showInflation ? p.rate - inflationRate : p.rate;
    return { ...p, result: compute(lumpSum, monthly, r, pensionYears) };
  }), [lumpSum, monthly, pensionYears, showInflation]);

  const taxInfo = useMemo(() => computeTax(result.finalTotal, result.finalInvested), [result]);
  const pensionTaxInfo = useMemo(() => computeTax(pensionResult.finalTotal, pensionResult.finalInvested), [pensionResult]);

  const msList = useMemo(() => findMilestones(lumpSum, monthly, effectiveRate, years), [lumpSum, monthly, effectiveRate, years]);

  const costData = useMemo(() => [
    { name: "Start i dag", value: result.finalTotal, fill: "#7cff6b" },
    { name: "Vent 1 år", value: delay1.finalTotal, fill: "#5bc950" },
    { name: "Vent 3 år", value: delay3.finalTotal, fill: "#3a8a30" },
    { name: "Vent 5 år", value: delay5.finalTotal, fill: "#1f5018" },
  ], [result, delay1, delay3, delay5]);

  const comparisonData = useMemo(() => {
    return result.data.map((d, i) => ({
      ...d,
      savings: savingsResult.data[i]?.total || 0,
      fund: d.total,
    }));
  }, [result, savingsResult]);

  const pensionData = useMemo(() => {
    const maxLen = Math.max(...pensionProfiles.map(p => p.result.data.length));
    return Array.from({ length: maxLen }, (_, i) => {
      const obj = { year: i, label: `${age + i} år` };
      pensionProfiles.forEach(p => {
        obj[p.id] = p.result.data[i]?.total || 0;
      });
      obj.invested = pensionProfiles[0].result.data[i]?.invested || 0;
      return obj;
    });
  }, [pensionProfiles, age]);

  const interestPercent = result.finalTotal > 0 ? ((result.finalInterest / result.finalTotal) * 100).toFixed(0) : 0;

  const ToggleChip = ({ on, onClick, children }) => (
    <button onClick={onClick} className={`toggle-btn ${on ? "on" : ""}`}>{children}</button>
  );

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0c10", color: "#e8e8e8",
      fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=range] {
          -webkit-appearance: none; height: 4px; border-radius: 2px;
          background: linear-gradient(90deg, #7cff6b33, #7cff6b);
          outline: none; cursor: pointer;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
          background: #7cff6b; cursor: pointer; box-shadow: 0 0 12px rgba(124,255,107,0.4);
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .tab-btn {
          padding: 8px 16px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08);
          background: transparent; color: #888; cursor: pointer; font-size: 12px;
          font-family: 'DM Sans', sans-serif; transition: all 0.2s; font-weight: 500; white-space: nowrap;
        }
        .tab-btn:hover { border-color: rgba(124,255,107,0.2); color: #bbb; }
        .tab-btn.active {
          background: rgba(124,255,107,0.1); border-color: rgba(124,255,107,0.3); color: #7cff6b;
        }
        .milestone-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 20px; font-size: 11px;
          background: rgba(124,255,107,0.06); border: 1px solid rgba(124,255,107,0.15);
          color: #ccc; font-family: 'Space Mono', monospace;
        }
        .toggle-btn {
          padding: 5px 12px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);
          background: transparent; color: #888; cursor: pointer; font-size: 11px;
          font-family: 'DM Sans', sans-serif; transition: all 0.2s;
        }
        .toggle-btn.on { background: rgba(255,180,50,0.15); border-color: rgba(255,180,50,0.3); color: #ffb432; }
        .profile-card {
          flex: 1; min-width: 140; padding: 14px 16px; border-radius: 12px; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02);
          transition: all 0.2s; text-align: center;
        }
        .profile-card:hover { border-color: rgba(255,255,255,0.15); }
        .profile-card.selected { border-width: 2px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.35s ease-out; }
        .glow-line { position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(124,255,107,0.3), transparent); }
        .section { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px; padding: 22px 20px; margin-bottom: 20px; position: relative; }
      `}</style>

      <div style={{ position: "fixed", top: -200, right: -200, width: 600, height: 600,
        background: "radial-gradient(circle, rgba(124,255,107,0.03) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 20px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, textTransform: "uppercase", color: "#7cff6b", marginBottom: 8, fontFamily: "'Space Mono', monospace" }}>
            Heddas Compound Interest Calculator
          </div>
          <h1 style={{
            fontSize: "clamp(26px, 5vw, 40px)", fontWeight: 700, letterSpacing: -1,
            background: "linear-gradient(135deg, #ffffff 0%, #7cff6b 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.1, marginBottom: 6
          }}>
            Pengene dine kan jobbe<br />hardere enn deg
          </h1>
          <p style={{ color: "#666", fontSize: 13, maxWidth: 400, margin: "0 auto" }}>
            Se hvordan små, jevnlige investeringer vokser til noe stort
          </p>
        </div>

        {/* Fund Profiles */}
        <div className="section">
          <div className="glow-line" />
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#666", marginBottom: 14 }}>
            Velg investeringsprofil
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {PROFILES.map((p, i) => (
              <div key={p.id}
                className={`profile-card ${profileIdx === i ? "selected" : ""}`}
                style={profileIdx === i ? { borderColor: p.color, background: `${p.color}10` } : {}}
                onClick={() => setProfileIdx(i)}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>{p.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: profileIdx === i ? p.color : "#ccc", marginBottom: 2 }}>
                  {p.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: profileIdx === i ? p.color : "#888" }}>
                  {p.rate}%
                </div>
                <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>{p.desc}</div>
                <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>{p.risk}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="section">
          <div className="glow-line" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#aaa" }}>Parametere</span>
            <div style={{ display: "flex", gap: 6 }}>
              <ToggleChip on={showInflation} onClick={() => setShowInflation(!showInflation)}>
                {showInflation ? "📉 Inflasjonsjustert" : "Inflasjon"}
              </ToggleChip>
              <ToggleChip on={showTax} onClick={() => setShowTax(!showTax)}>
                {showTax ? "🏛️ Skatt ASK" : "Skatt"}
              </ToggleChip>
            </div>
          </div>

          <Slider label="Engangsbeløp" value={lumpSum} onChange={setLumpSum}
            min={0} max={1000000} step={10000} format={(v) => v.toLocaleString("nb-NO") + " kr"} />
          <Slider label="Månedlig sparing" value={monthly} onChange={setMonthly}
            min={500} max={30000} step={500} format={(v) => v.toLocaleString("nb-NO") + " kr"} />
          <Slider label="Tidshorisont" value={years} onChange={setYears}
            min={1} max={40} step={1} suffix=" år" />

          {showInflation && (
            <div style={{ marginTop: 6, padding: "7px 12px", borderRadius: 8,
              background: "rgba(255,180,50,0.08)", border: "1px solid rgba(255,180,50,0.15)", fontSize: 11, color: "#cc9933" }}>
              Reell avkastning: {effectiveRate.toFixed(1)}% (nominell {rate}% − {inflationRate}% inflasjon)
            </div>
          )}
          {showTax && (
            <div style={{ marginTop: 6, padding: "7px 12px", borderRadius: 8,
              background: "rgba(100,150,255,0.06)", border: "1px solid rgba(100,150,255,0.15)", fontSize: 11, color: "#7aa8ff" }}>
              Aksjesparekonto: {(TAX_RATE * 100).toFixed(2)}% skatt på gevinst ved uttak. Skjermingsfradrag ikke inkludert.
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <StatCard label="Total verdi" value={formatNOKFull(result.finalTotal)} highlight />
          <StatCard label="Investert" value={formatNOKFull(result.finalInvested)}
            sub={lumpSum > 0 ? `${lumpSum.toLocaleString("nb-NO")} + ${monthly.toLocaleString("nb-NO")}/mnd` : `${monthly.toLocaleString("nb-NO")} kr/mnd`} />
          <StatCard label="Avkastning" value={formatNOKFull(result.finalInterest)}
            sub={`${interestPercent}% er «gratis» penger`} accent />
          {showTax && (
            <StatCard label="Etter skatt (ASK)" value={formatNOKFull(taxInfo.afterTax)}
              sub={`${formatNOKFull(taxInfo.tax)} i skatt`} negative />
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {TABS.map((tab, i) => (
            <button key={i} className={`tab-btn ${activeTab === i ? "active" : ""}`} onClick={() => setActiveTab(i)}>
              {tab}
            </button>
          ))}
        </div>

        {/* Charts */}
        <div className="fade-in section" key={activeTab}>
          <div className="glow-line" />

          {activeTab === 0 && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc", marginBottom: 3, paddingLeft: 4 }}>
                Din formue over {years} år
              </div>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 18, paddingLeft: 4 }}>
                {profile.emoji} {profile.label} ({effectiveRate.toFixed(1)}%) · Grønt = avkastning · Grått = innskudd
              </div>
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={result.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={profile.color} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={profile.color} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#555" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#555" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10 }} axisLine={{ stroke: "#222" }} tickLine={false} />
                  <YAxis tickFormatter={formatNOK} tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total" name="Total" stroke={profile.color} fill="url(#gI)" strokeWidth={2} />
                  <Area type="monotone" dataKey="invested" name="Investert" stroke="#555" fill="url(#gV)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}

          {activeTab === 1 && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc", marginBottom: 3, paddingLeft: 4 }}>
                Kostnaden av å vente
              </div>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 18, paddingLeft: 4 }}>
                Hvert år du venter koster deg dyrt — tid er din største allierte
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={costData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }} barSize={55}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: "#aaa", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatNOK} tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Sluttverdi" radius={[6, 6, 0, 0]}>
                    {costData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16, padding: "0 4px" }}>
                {[{ d: 1, r: delay1 }, { d: 3, r: delay3 }, { d: 5, r: delay5 }].map(({ d, r }) => {
                  const lost = result.finalTotal - r.finalTotal;
                  return (
                    <div key={d} style={{
                      flex: 1, minWidth: 140, padding: "12px 14px", borderRadius: 10,
                      background: "rgba(255,60,60,0.04)", border: "1px solid rgba(255,60,60,0.12)"
                    }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 3 }}>Venter {d} år</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: "#ff6b6b", fontFamily: "'Space Mono', monospace" }}>
                        −{formatNOKFull(lost)}
                      </div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>tapt avkastning</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 2 && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc", marginBottom: 3, paddingLeft: 4 }}>
                {profile.label} fond vs. Sparekonto
              </div>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 18, paddingLeft: 4 }}>
                {profile.emoji} {effectiveRate.toFixed(1)}% vs 🏦 {showInflation ? "1.0" : "3.5"}% over {years} år
              </div>
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={comparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={profile.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={profile.color} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffb432" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#ffb432" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10 }} axisLine={{ stroke: "#222" }} tickLine={false} />
                  <YAxis tickFormatter={formatNOK} tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="fund" name="Fond" stroke={profile.color} fill="url(#gF)" strokeWidth={2} />
                  <Area type="monotone" dataKey="savings" name="Sparekonto" stroke="#ffb432" fill="url(#gS)" strokeWidth={2} />
                  <Line type="monotone" dataKey="invested" name="Investert" stroke="#555" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{
                marginTop: 14, padding: "10px 14px", borderRadius: 10,
                background: "rgba(124,255,107,0.04)", border: "1px solid rgba(124,255,107,0.12)", margin: "14px 4px 0"
              }}>
                <span style={{ fontSize: 12, color: "#aaa" }}>Forskjell: </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#7cff6b", fontFamily: "'Space Mono', monospace" }}>
                  +{formatNOKFull(result.finalTotal - savingsResult.finalTotal)}
                </span>
                <span style={{ fontSize: 11, color: "#666" }}> mer med fond</span>
              </div>
            </>
          )}

          {activeTab === 3 && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc", marginBottom: 3, paddingLeft: 4 }}>
                Din pensjon 🎯
              </div>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 14, paddingLeft: 4 }}>
                Se hva du kan ha ved pensjonsalder — alle tre profiler sammenlignet
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 18, padding: "0 4px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Slider label="Din alder nå" value={age} onChange={setAge} min={18} max={60} step={1} suffix=" år" color="#b48cff" />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Slider label="Pensjonsalder" value={retireAge} onChange={setRetireAge} min={55} max={75} step={1} suffix=" år" color="#b48cff" />
                </div>
              </div>

              <div style={{ padding: "0 4px", marginBottom: 16 }}>
                <div style={{
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(180,140,255,0.06)", border: "1px solid rgba(180,140,255,0.15)",
                  fontSize: 12, color: "#b48cff"
                }}>
                  {pensionYears} år til pensjon — du er {age}, pensjon ved {retireAge}
                </div>
              </div>

              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={pensionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    {PROFILES.map(p => (
                      <linearGradient key={p.id} id={`g${p.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={p.color} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={p.color} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fill: "#555", fontSize: 10 }} axisLine={{ stroke: "#222" }} tickLine={false}
                    interval={Math.max(0, Math.floor(pensionData.length / 8) - 1)} />
                  <YAxis tickFormatter={formatNOK} tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  {PROFILES.map(p => (
                    <Area key={p.id} type="monotone" dataKey={p.id} name={p.label}
                      stroke={p.color} fill={`url(#g${p.id})`} strokeWidth={profileIdx === PROFILES.indexOf(p) ? 2.5 : 1.2}
                      strokeOpacity={profileIdx === PROFILES.indexOf(p) ? 1 : 0.5} />
                  ))}
                  <Line type="monotone" dataKey="invested" name="Investert" stroke="#555" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16, padding: "0 4px" }}>
                {pensionProfiles.map((p, i) => {
                  const tx = computeTax(p.result.finalTotal, p.result.finalInvested);
                  return (
                    <div key={p.id} style={{
                      flex: 1, minWidth: 150, padding: "14px 16px", borderRadius: 12,
                      background: profileIdx === i ? `${p.color}10` : "rgba(255,255,255,0.02)",
                      border: `1px solid ${profileIdx === i ? p.color + "40" : "rgba(255,255,255,0.06)"}`
                    }}>
                      <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>{p.emoji} {p.label} ({(showInflation ? p.rate - inflationRate : p.rate).toFixed(1)}%)</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: p.color, fontFamily: "'Space Mono', monospace" }}>
                        {formatNOKFull(p.result.finalTotal)}
                      </div>
                      {showTax && (
                        <div style={{ fontSize: 10, color: "#ff6b6b", marginTop: 3 }}>
                          Etter skatt: {formatNOKFull(tx.afterTax)}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
                        {((p.result.finalInterest / Math.max(1, p.result.finalTotal)) * 100).toFixed(0)}% avkastning
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Milestones */}
        {msList.length > 0 && (
          <div className="section">
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#666", marginBottom: 12 }}>
              🎯 Milepæler
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {msList.map((ms, i) => (
                <div key={i} className="milestone-pill">
                  <span style={{ color: "#7cff6b", fontWeight: 700 }}>{formatNOKFull(ms.amount)}</span>
                  <span style={{ color: "#666" }}>→</span>
                  <span>{ms.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "28px 20px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: "#ddd" }}>
            {result.finalInterest > result.finalInvested
              ? "🚀 Rentes rente gjør mer av jobben enn deg!"
              : "⏳ Gi det litt mer tid — magien starter snart"}
          </div>
          <p style={{ fontSize: 12, color: "#666", maxWidth: 480, margin: "0 auto" }}>
            {result.finalInterest > result.finalInvested
              ? `${interestPercent}% av pengene dine kommer fra avkastning. Jo lenger du holder ut, jo mer jobber de for deg.`
              : `Akkurat nå er ${interestPercent}% avkastning — compounding er en snøball som vokser raskere over tid.`}
          </p>
          <div style={{ fontSize: 10, color: "#444", marginTop: 16 }}>
            ⚠️ Historisk avkastning er ingen garanti for fremtidig avkastning. Dette er kun en illustrasjon.
          </div>
        </div>
      </div>
    </div>
  );
}
