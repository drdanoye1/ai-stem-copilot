"use client";
import { useState, useEffect, useRef } from "react";
import {
  Car, Power, Package, Settings, Zap, Cpu, FlaskConical,
  Building2, Atom, Dna, Heart, Rocket, Shield, Calculator, Microscope,
} from "lucide-react";

// ─── Utility ─────────────────────────────────────────────────────────────────
function normCDF(z: number): number {
  if (z < -6) return 0; if (z > 6) return 1;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.398942282 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return z > 0 ? 1 - p : p;
}

// ─── Math functions ───────────────────────────────────────────────────────────

// 1. Traffic
function trafficMetrics(density: number, signalCycle: number) {
  const d = density / 100;
  const efficiency = 1 / (1 + Math.exp((d - 0.65) * 12));
  return {
    efficiency,
    throughput: Math.round(4800 * efficiency),
    avgWait: Math.round(signalCycle * (1 - efficiency) * 2.2 + 6),
    congestion: Math.min(100, Math.round((1 - efficiency) * 100)),
  };
}

// 2. Power Grid
function powerGridMetrics(renewableShare: number, load: number) {
  const totalGen = 600 + renewableShare * 4;
  const deltaF = ((totalGen - load) / (2 * 5 * 1000)) * 50;
  const freq = Math.max(48.5, Math.min(51.5, 50 + deltaF));
  const blackoutRisk = Math.min(100, Math.max(0, Math.abs(deltaF) > 0.5 ? (Math.abs(deltaF) - 0.5) * 100 : 0));
  return {
    freq, deltaF, blackoutRisk, totalGen,
    co2: Math.round(450 * (1 - renewableShare / 100) + 25),
    cost: Math.round(80 - renewableShare * 0.55 + (load > 800 ? 15 : 0) + (blackoutRisk > 50 ? 25 : 0)),
  };
}

// 3. Supply Chain
function supplyChainMetrics(leadTime: number, demandVolatility: number, safetyFactor: number) {
  const T = 5, sigma = 100 * (demandVolatility / 100);
  const bullwhip = 1 + 2 * (leadTime / T) + 2 * Math.pow(leadTime / T, 2);
  const safetyStock = Math.round(safetyFactor * sigma * Math.sqrt(leadTime + T));
  const cycleStock = Math.round(100 * (leadTime + T / 2));
  const totalInventory = safetyStock + cycleStock;
  return {
    bullwhip, safetyStock, totalInventory,
    stockoutRisk: Math.max(0, Math.round((1 - normCDF(safetyFactor)) * 100)),
    holdingCost: Math.round(totalInventory * 0.25),
  };
}

// 4. Mechanical — Spring-Mass-Damper
function mechanicalMetrics(massKg: number, springK: number, dampingC: number) {
  const omega0 = Math.sqrt(springK / massKg);
  const zeta = dampingC / (2 * Math.sqrt(springK * massKg));
  const freqHz = omega0 / (2 * Math.PI);
  const omegaD = zeta < 1 ? omega0 * Math.sqrt(Math.max(0, 1 - zeta * zeta)) : 0;
  const type = zeta > 1.001 ? "overdamped" : zeta > 0.999 ? "critical" : "underdamped";
  const settlingTime = zeta > 0 ? 4 / (zeta * omega0) : 999;
  return { omega0, zeta, freqHz, omegaD, type, settlingTime };
}

// 5. Electrical — RLC Circuit
function electricalMetrics(R: number, L_mH: number, C_uF: number) {
  const L = L_mH / 1000, C = C_uF / 1e6;
  const omega0 = 1 / Math.sqrt(L * C);
  const freq0Hz = omega0 / (2 * Math.PI);
  const Q = (1 / R) * Math.sqrt(L / C);
  const BW_Hz = R / (2 * Math.PI * L);
  const zeta = (R / 2) * Math.sqrt(C / L);
  return { freq0Hz, Q, BW_Hz, zeta, omega0 };
}

// 6. Electronic — MOSFET
function electronicMetrics(Vgs: number, Vds: number) {
  const Vt = 1.5, k = 2e-3;
  if (Vgs <= Vt) return { Id_mA: 0, region: "cutoff", gm_mS: 0, Vdsat: 0 };
  const Vdsat = Vgs - Vt;
  if (Vds < Vdsat) {
    const Id = k * ((Vgs - Vt) * Vds - Vds * Vds / 2);
    return { Id_mA: Id * 1000, region: "triode", gm_mS: k * Vds * 1000, Vdsat };
  }
  return { Id_mA: (k / 2) * Math.pow(Vgs - Vt, 2) * 1000, region: "saturation", gm_mS: k * (Vgs - Vt) * 1000, Vdsat };
}

// 7. Chemical — CSTR Reactor
function chemicalMetrics(tempK: number, tauMin: number) {
  const k = 1e8 * Math.exp(-72000 / (8.314 * tempK));
  const tau = tauMin * 60;
  const X = (k * tau) / (1 + k * tau);
  return { k, X: X * 100, Ca: 2.0 * (1 - X), heatGen: 50000 * k * 2.0 * (1 - X) };
}

// 8. Civil — Simply-Supported Beam (point load at centre)
function civilMetrics(loadKN: number, spanM: number) {
  const P = loadKN * 1000, L = spanM;
  const E = 200e9, I = 8.33e-5, Z = 9.95e-4;
  const deflMM = (P * Math.pow(L, 3)) / (48 * E * I) * 1000;
  const sigma = (P * L) / (4 * Z) / 1e6;
  const SF = 250 / Math.max(sigma, 0.001);
  return { deflMM, sigma, SF, L_d: deflMM > 0 ? Math.round(L * 1000 / deflMM) : 9999 };
}

// 9. Quantum — Single Qubit (Bloch sphere)
function quantumMetrics(thetaDeg: number, phiDeg: number) {
  const theta = thetaDeg * Math.PI / 180, phi = phiDeg * Math.PI / 180;
  return {
    p0: Math.pow(Math.cos(theta / 2), 2),
    p1: Math.pow(Math.sin(theta / 2), 2),
    bx: Math.sin(theta) * Math.cos(phi),
    by: Math.sin(theta) * Math.sin(phi),
    bz: Math.cos(theta),
    coherence: Math.abs(Math.sin(theta)) / 2,
  };
}

// 10. Biotech — Bioreactor (Monod kinetics)
function biotechMetrics(D: number, S0: number) {
  const muMax = 0.8, Ks = 0.2, Y = 0.5;
  if (D >= muMax) return { S: S0, X: 0, productivity: 0, mu: muMax, washout: true };
  const S_star = (Ks * D) / (muMax - D);
  const X_star = Math.max(0, Y * (S0 - S_star));
  return { S: S_star, X: X_star, productivity: D * X_star, mu: D, washout: false };
}

// 11. Nanotech — Quantum Dot (Brus equation, CdSe)
function nanotechMetrics(rNm: number) {
  const r = rNm * 1e-9;
  const confinement = (Math.PI * Math.PI * 1.0546e-34 * 1.0546e-34) / (2 * 0.13 * 9.109e-31 * r * r) / 1.602e-19;
  const Eg = 1.74 + confinement;
  const lambdaNm = 1239.8 / Eg;
  const stops: [number, string][] = [[430,"#9b59b6"],[480,"#3b82f6"],[510,"#06b6d4"],[560,"#22c55e"],[590,"#eab308"],[625,"#f97316"],[700,"#ef4444"]];
  const color = (stops.find(([w]) => lambdaNm <= w)?.[1] ?? "#ef4444") as string;
  return { confinement_eV: confinement, Eg_eV: Eg, lambdaNm, color };
}

// 12. Health — One-compartment Pharmacokinetics (oral)
function healthMetrics(doseMg: number, halfLifeH: number) {
  const kel = 0.693 / halfLifeH, Vd = 35, F = 0.8;
  const Cmax = (F * doseMg) / Vd;
  const AUC = Cmax / kel;
  const tMIC = halfLifeH * Math.log2(Math.max(1, Cmax / 0.5));
  return { Cmax, AUC, kel, tMIC };
}

// 13. Aerospace — Keplerian Orbit
function aerospaceMetrics(altKm: number, ecc: number) {
  const GM = 3.986e14, R_e = 6371e3;
  const a = R_e + altKm * 1e3;
  const T_min = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / GM) / 60;
  const v_circ = Math.sqrt(GM / a) / 1000;
  const hp = (a * (1 - ecc) - R_e) / 1000;
  const ha = (a * (1 + ecc) - R_e) / 1000;
  return { v_circ, T_min, hp, ha, a };
}

// 14. Defense — Projectile Trajectory (with drag factor)
function defenseMetrics(v0: number, angleDeg: number) {
  const theta = angleDeg * Math.PI / 180, g = 9.81;
  const range_m = (v0 * v0 * Math.sin(2 * theta)) / g * 0.75;
  const hMax_m = (v0 * v0 * Math.pow(Math.sin(theta), 2)) / (2 * g) * 0.85;
  const tof_s = (2 * v0 * Math.sin(theta)) / g * 0.9;
  return { range_km: range_m / 1000, hMax_km: hMax_m / 1000, tof_s };
}

// 15. Mathematics — Logistic Map (Chaos)
function chaosMetrics(r: number, x0: number) {
  let x = x0;
  const series: number[] = [];
  for (let i = 0; i < 150; i++) { x = r * x * (1 - x); series.push(x); }
  let lyapunov = 0;
  series.forEach(xi => { const d = Math.abs(r - 2 * r * xi); if (d > 1e-10) lyapunov += Math.log(d); });
  lyapunov /= series.length;
  const tail = series.slice(-32);
  let period = 0;
  for (let p = 1; p <= 16; p++) { if (Math.abs(tail[31 - p] - tail[31]) < 0.002) { period = p; break; } }
  return { series: series.slice(-20), lyapunov, period, chaos: lyapunov > 0 };
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function InsightBox({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3 text-xs leading-relaxed mt-4"
      style={{ background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.06)", color: "#64748b" }}>
      <strong style={{ color: "#94a3b8" }}>Model: </strong>{children}
    </div>
  );
}

function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const c = color ?? "#94a3b8";
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: `${c}10`, border: `1px solid ${c}25` }}>
      <div className="text-[10px] mb-0.5" style={{ color: "#64748b" }}>{label}</div>
      <div className="text-sm font-bold" style={{ color: c }}>{value}</div>
      {sub && <div className="text-[9px] mt-0.5" style={{ color: "#334155" }}>{sub}</div>}
    </div>
  );
}

function BarChart({ bars, accent, height = 140 }: { bars: number[]; accent: string; height?: number }) {
  return (
    <div className="flex items-end gap-0.5 rounded-xl overflow-hidden px-3 pt-3 pb-0"
      style={{ background: "rgba(0,0,0,0.25)", height }}>
      {bars.map((h, i) => (
        <div key={i} className="flex-1 rounded-t-sm"
          style={{
            height: `${Math.max(2, Math.min(97, h))}%`,
            background: `${accent}${i % 3 === 0 ? "70" : i % 3 === 1 ? "48" : "28"}`,
            minWidth: 4,
            transition: "height 1.1s cubic-bezier(.4,0,.2,1)",
          }} />
      ))}
    </div>
  );
}

function LiveHeader({ accent, title, sub, tick }: { accent: string; title: string; sub: string; tick: number }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <div className="text-xs font-semibold mb-0.5" style={{ color: accent }}>{title}</div>
        <div className="text-[10px]" style={{ color: "#334155" }}>{sub} · tick #{tick}</div>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />
        <span className="text-[10px]" style={{ color: accent }}>LIVE</span>
      </div>
    </div>
  );
}

// ─── Canvas Physical Scene Draw Functions ─────────────────────────────────────

function drawTrafficScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  density: number, congestion: number, tick: number) {
  ctx.fillStyle = "#18181b"; ctx.fillRect(0, 0, W, H);
  const lH = H / 3;
  ctx.strokeStyle = "rgba(255,220,80,0.45)"; ctx.lineWidth = 1.5; ctx.setLineDash([18, 14]);
  for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0, i*lH); ctx.lineTo(W, i*lH); ctx.stroke(); }
  ctx.setLineDash([]); ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 2;
  [0, H].forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); });
  const n = Math.round(density * 0.32);
  const cc = congestion > 60 ? "#ef4444" : congestion > 35 ? "#f59e0b" : "#22c55e";
  for (let i = 0; i < n; i++) {
    const lane = i % 3, spd = [4, 3, 3.5][lane];
    const bx = (i * 71 + lane * 43) % W;
    const mx = (bx + tick * spd) % W;
    const cy2 = lane * lH + lH * 0.22;
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(mx - 10, cy2 + 13, 20, 5);
    ctx.shadowColor = cc; ctx.shadowBlur = 6; ctx.fillStyle = cc;
    ctx.fillRect(mx - 11, cy2, 22, 14); ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(140,215,255,0.75)"; ctx.fillRect(mx - 6, cy2 + 2, 12, 7);
    ctx.fillStyle = "#fef9c3";
    [[mx-9,cy2+1],[mx+7,cy2+1]].forEach(([sx,sy]) => {
      ctx.beginPath(); ctx.arc(sx as number, sy as number, 1.5, 0, Math.PI*2); ctx.fill();
    });
  }
  ctx.shadowBlur = 0;
  if (congestion > 30) {
    ctx.fillStyle = "rgba(239,68,68," + ((congestion-30)/70*0.22) + ")"; ctx.fillRect(0, 0, W, H);
  }
  const sc = congestion > 55 ? "#ef4444" : congestion > 28 ? "#f59e0b" : "#22c55e";
  const [sx, sy] = [W - 22, H/2];
  ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(sx-10, sy-22, 20, 44);
  ctx.shadowColor = sc; ctx.shadowBlur = 10; ctx.fillStyle = sc;
  ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
}

function drawPowerScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  renewableShare: number, blackoutRisk: number, tick: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  sky.addColorStop(0, renewableShare > 50 ? "#0c1b33" : "#1a0f0a");
  sky.addColorStop(1, renewableShare > 50 ? "#0a2a4a" : "#2d1b0e");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#111111"; ctx.fillRect(0, H * 0.65, W, H * 0.35);
  for (let i = 0; i < 25; i++) {
    ctx.fillStyle = "rgba(255,255,255," + (0.2 + (i%3)*0.2) + ")";
    ctx.beginPath(); ctx.arc((i*137.5)%W, (i*79.3)%(H*0.55), 0.8, 0, Math.PI*2); ctx.fill();
  }
  const numT = Math.round(renewableShare / 22) + 1;
  for (let t = 0; t < Math.min(numT, 5); t++) {
    const tx = (t + 0.5) * (W / (Math.min(numT,5) + 0.5));
    const ty = H * 0.63, th = 48 + t * 4;
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - th); ctx.stroke();
    const ba = (tick * 0.08 + t * 1.2) % (Math.PI * 2);
    ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1.5;
    for (let b = 0; b < 3; b++) {
      const a = ba + b * (Math.PI * 2 / 3), bLen = 18 + t * 3;
      ctx.beginPath(); ctx.moveTo(tx, ty - th);
      ctx.lineTo(tx + Math.cos(a)*bLen, ty - th + Math.sin(a)*bLen); ctx.stroke();
    }
    ctx.fillStyle = "#374151"; ctx.beginPath(); ctx.arc(tx, ty - th, 3, 0, Math.PI*2); ctx.fill();
  }
  if (renewableShare > 25) {
    const np = Math.round(renewableShare / 15);
    for (let p = 0; p < Math.min(np, 7); p++) {
      const px = 20 + p * 38, py = H * 0.69;
      ctx.fillStyle = "#1e3a5f"; ctx.fillRect(px, py, 28, 15);
      ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 0.5; ctx.strokeRect(px, py, 28, 15);
      ctx.beginPath(); ctx.moveTo(px+14, py); ctx.lineTo(px+14, py+15); ctx.stroke();
    }
  }
  const bldgs = [55,88,48,72,82,52,68,40,78,62];
  ctx.fillStyle = "#111111";
  bldgs.forEach((bh, i) => {
    const bx = W * 0.52 + i * 28 - 15;
    ctx.fillRect(bx, H*0.65 - bh, 22, bh);
    ctx.fillStyle = "rgba(255,240,180,0.7)";
    for (let wy = 0; wy < Math.floor(bh/11); wy++) {
      ctx.fillRect(bx+3, H*0.65-bh+3+wy*11, 5, 5);
      if (bh > 30) ctx.fillRect(bx+12, H*0.65-bh+3+wy*11, 5, 5);
    }
    ctx.fillStyle = "#111111";
  });
  ctx.strokeStyle = "#374151"; ctx.lineWidth = 1;
  [50, 155, 260, 360].forEach((px, i, arr) => {
    if (i < arr.length - 1) {
      ctx.beginPath(); ctx.moveTo(px, H*0.54);
      ctx.bezierCurveTo(px+25, H*0.54+8, arr[i+1]-25, H*0.54+8, arr[i+1], H*0.54); ctx.stroke();
    }
    ctx.strokeStyle = "#4b5563"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, H*0.65); ctx.lineTo(px, H*0.5);
    ctx.moveTo(px-8, H*0.52); ctx.lineTo(px+8, H*0.52); ctx.stroke();
  });
  if (blackoutRisk > 35) {
    ctx.fillStyle = "rgba(239,68,68," + ((blackoutRisk-35)/65*0.28) + ")";
    ctx.fillRect(0, 0, W, H);
  }
}

function drawSupplyScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  stockoutRisk: number, totalInventory: number, tick: number) {
  ctx.fillStyle = "#0f1117"; ctx.fillRect(0, 0, W, H);
  const flY = H * 0.75;
  ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i*(W/7), flY); ctx.lineTo(W/2, H); ctx.stroke(); }
  ctx.fillStyle = "#14181f"; ctx.fillRect(0, flY, W, H - flY);
  const fill = Math.min(1, totalInventory / 1200);
  for (let s = 0; s < 4; s++) {
    const sx = 16 + s * (W/4 - 4), sw = W/4 - 20, sTop = H*0.1, sH2 = flY - H*0.1;
    ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.5; ctx.strokeRect(sx, sTop, sw, sH2);
    for (let sh = 0; sh < 4; sh++) {
      const sy = sTop + sh*(sH2/4);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx+sw, sy); ctx.stroke();
      const fw = fill * sw * 0.88;
      if (fw > 2) {
        ctx.fillStyle = "#1e3a5f"; ctx.fillRect(sx+2, sy+2, fw, sH2/4-5);
        const nb = Math.max(1, Math.round(fw / 14));
        ctx.fillStyle = "#2563eb";
        for (let b = 0; b < nb; b++) {
          ctx.fillRect(sx+3 + b*(fw/nb), sy+4, fw/nb - 3, sH2/4-10);
        }
      }
    }
  }
  const tx = W - 82, ty = flY - 32;
  ctx.fillStyle = "#1e293b"; ctx.fillRect(tx, ty, 68, 30);
  ctx.fillStyle = "#334155"; ctx.fillRect(tx+55, ty+5, 13, 18);
  ctx.fillStyle = "rgba(135,160,215,0.7)"; ctx.fillRect(tx+57, ty+7, 9, 10);
  [[tx+12,ty+30],[tx+52,ty+30]].forEach(([wx,wy]) => {
    ctx.fillStyle = "#1e40af"; ctx.beginPath(); ctx.arc(wx as number, wy as number, 6, 0, Math.PI*2); ctx.fill();
  });
  if (stockoutRisk > 15) {
    const flash = Math.floor(tick * 0.5) % 2 === 0;
    ctx.shadowColor = "#ef4444"; ctx.shadowBlur = flash ? 14 : 0;
    ctx.fillStyle = flash ? "#ef4444" : "rgba(239,68,68,0.3)";
    ctx.beginPath(); ctx.arc(W-13, 13, 8, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
  }
  const bFrac = Math.min(1, totalInventory / 1200);
  const bCol = bFrac < 0.3 ? "#ef4444" : bFrac < 0.6 ? "#f59e0b" : "#10b981";
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(5, 8, 12, H*0.55);
  ctx.fillStyle = bCol; ctx.fillRect(5, 8 + H*0.55*(1-bFrac), 12, H*0.55*bFrac);
  ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.strokeRect(5, 8, 12, H*0.55);
}


function drawMechanicalScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  massPos: number, type: string) {
  ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, W, H);
  const cy = H / 2, wallX = 38;
  ctx.fillStyle = "#334155"; ctx.fillRect(wallX-10, 18, 10, H-36);
  ctx.strokeStyle = "#475569"; ctx.lineWidth = 1;
  for (let y = 18; y < H-36; y += 10) {
    ctx.beginPath(); ctx.moveTo(wallX-10, y); ctx.lineTo(wallX-18, y+10); ctx.stroke();
  }
  const massX = wallX + 90 + (massPos - 50) * 1.3;
  const sprEnd = massX - 25;
  const nCoils = 8;
  const cW = (sprEnd - wallX) / nCoils;
  const typeColor = type === "overdamped" ? "#94a3b8" : type === "critical" ? "#f59e0b" : "#f97316";
  ctx.strokeStyle = "#f97316"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(wallX, cy);
  for (let c = 0; c < nCoils; c++) {
    ctx.lineTo(wallX + c*cW + cW*0.25, cy - 13);
    ctx.lineTo(wallX + c*cW + cW*0.75, cy + 13);
  }
  ctx.lineTo(sprEnd, cy); ctx.stroke();
  const dpY = cy + 32, dpCX = (wallX + sprEnd) / 2;
  ctx.strokeStyle = "#64748b"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(wallX, dpY); ctx.lineTo(dpCX-14, dpY); ctx.stroke();
  ctx.strokeRect(dpCX-14, dpY-8, 28, 16);
  ctx.beginPath(); ctx.moveTo(dpCX+14, dpY); ctx.lineTo(sprEnd, dpY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(dpCX+2, dpY-6); ctx.lineTo(dpCX+10, dpY-6);
  ctx.moveTo(dpCX+2, dpY+6); ctx.lineTo(dpCX+10, dpY+6);
  ctx.moveTo(dpCX+6, dpY-6); ctx.lineTo(dpCX+6, dpY+6); ctx.stroke();
  ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(wallX, H-18); ctx.lineTo(W-18, H-18); ctx.stroke();
  for (let gx = wallX; gx < W-18; gx += 12) {
    ctx.beginPath(); ctx.moveTo(gx, H-18); ctx.lineTo(gx-5, H-10); ctx.stroke();
  }
  ctx.fillStyle = typeColor + "2a"; ctx.shadowColor = typeColor; ctx.shadowBlur = 14;
  ctx.fillRect(massX-22, cy-24, 44, 48);
  ctx.strokeStyle = typeColor; ctx.lineWidth = 2; ctx.strokeRect(massX-22, cy-24, 44, 48);
  ctx.shadowBlur = 0; ctx.fillStyle = typeColor;
  ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.fillText("m", massX, cy+4);
  ctx.textAlign = "left";
}

function drawElectricalScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  Q: number, tick: number) {
  ctx.fillStyle = "#0a1628"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(34,211,238,0.05)"; ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 20) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke(); }
  for (let gy = 0; gy < H; gy += 20) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke(); }
  const cy = H/2, l = 38, r = W-38, top = cy-52, bot = cy+52;
  const ta = Math.min(0.9, 0.35 + Q/20);
  ctx.strokeStyle = "rgba(34,211,238," + ta + ")"; ctx.lineWidth = 2;
  ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = Q > 5 ? 8 : 3;
  [[l,top,r,top],[l,bot,r,bot],[l,top,l,bot],[r,top,r,bot]].forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  });
  ctx.shadowBlur = 0;
  const iX = l+30, iW = 65;
  ctx.strokeStyle = "#eab308"; ctx.lineWidth = 2.5; ctx.shadowColor = "#eab308"; ctx.shadowBlur = 5;
  ctx.beginPath(); ctx.moveTo(l, top);
  for (let c = 0; c < 5; c++) ctx.arc(iX + c*(iW/5) + iW/10, top, iW/10, Math.PI, 0, false);
  ctx.lineTo(iX+iW, top); ctx.stroke();
  const rX = W/2+5, rW = 55;
  ctx.strokeStyle = "#f97316"; ctx.shadowColor = "#f97316"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(rX, top);
  for (let z = 0; z < 6; z++) ctx.lineTo(rX+(z+0.5)*(rW/6), z%2===0 ? top-9 : top+9);
  ctx.lineTo(rX+rW, top); ctx.stroke();
  const cY = cy;
  ctx.strokeStyle = "#a78bfa"; ctx.shadowColor = "#a78bfa"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(r, top); ctx.lineTo(r, cY-12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r-14, cY-12); ctx.lineTo(r+14, cY-12);
  ctx.moveTo(r-14, cY-6); ctx.lineTo(r+14, cY-6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r, cY-6); ctx.lineTo(r, bot); ctx.stroke();
  ctx.shadowBlur = 0;
  const pLen = 2*(r-l) + 2*104;
  const pPos = (tick * 5) % pLen;
  const pN = pPos / pLen;
  let px = 0, py = 0;
  if (pN < 0.4) { px = l + pN/0.4*(r-l); py = top; }
  else if (pN < 0.6) { px = r; py = top + (pN-0.4)/0.2*104; }
  else if (pN < 1.0) { px = r - (pN-0.6)/0.4*(r-l); py = bot; }
  else { px = l; py = bot - (pN-1.0)/0.1*104; }
  const pColor = Q > 10 ? "#22d3ee" : Q > 3 ? "#eab308" : "#f43f5e";
  ctx.fillStyle = pColor; ctx.shadowColor = pColor; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = pColor; ctx.font = "bold 10px monospace"; ctx.fillText("Q=" + Q.toFixed(1), 10, 20);
}

function drawElectronicScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  Vgs: number, region: string) {
  ctx.fillStyle = "#0e1320"; ctx.fillRect(0, 0, W, H);
  const cx = W/2, cy = H/2, bW = 220, bH = 130;
  const bx = cx - bW/2, by = cy - bH/2;
  ctx.fillStyle = "#1a1040"; ctx.fillRect(bx, by, bW, bH);
  const ndW = 55;
  ctx.fillStyle = "#1e40af";
  ctx.fillRect(bx, by, ndW, bH*0.55);
  ctx.fillRect(bx+bW-ndW, by, ndW, bH*0.55);
  ctx.fillStyle = "#1e3a5f";
  ctx.fillRect(bx+ndW, by+bH*0.55, bW-2*ndW, bH*0.45);
  const channelOn = region !== "cutoff";
  if (channelOn) {
    const chAlpha = region === "saturation" ? 0.85 : 0.55;
    ctx.fillStyle = "rgba(16,185,129," + chAlpha + ")";
    ctx.fillRect(bx+ndW, by+bH*0.42, bW-2*ndW, bH*0.15);
  }
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(bx+ndW, by+bH*0.32, bW-2*ndW, bH*0.12);
  ctx.fillStyle = "#64748b";
  ctx.fillRect(bx+ndW, by+bH*0.18, bW-2*ndW, bH*0.14);
  ctx.strokeStyle = channelOn ? "#10b981" : "#475569"; ctx.lineWidth = 2.5;
  ctx.shadowColor = channelOn ? "#10b981" : "#334155";
  ctx.shadowBlur = channelOn ? 10 : 2;
  ctx.strokeRect(bx+ndW, by+bH*0.18, bW-2*ndW, bH*0.14); ctx.shadowBlur = 0;
  ctx.fillStyle = "#94a3b8"; ctx.font = "9px monospace"; ctx.textAlign = "center";
  ctx.fillText("S", bx+ndW/2, by+bH*0.25);
  ctx.fillText("G", cx, by+bH*0.12);
  ctx.fillText("D", bx+bW-ndW/2, by+bH*0.25);
  ctx.fillText("p-substrate", cx, by+bH*0.85);
  ctx.textAlign = "left";
  if (channelOn) {
    ctx.strokeStyle = "#10b981"; ctx.lineWidth = 1.5; ctx.shadowColor = "#10b981"; ctx.shadowBlur = 6;
    for (let i = 0; i < 3; i++) {
      const ax = bx + ndW + (i+1)*(bW-2*ndW)/4;
      ctx.beginPath(); ctx.moveTo(ax, by+bH*0.42); ctx.lineTo(ax, by+bH*0.7);
      ctx.moveTo(ax-4, by+bH*0.62); ctx.lineTo(ax, by+bH*0.7); ctx.lineTo(ax+4, by+bH*0.62); ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
  const rc = region === "saturation" ? "#10b981" : region === "triode" ? "#06b6d4" : "#475569";
  ctx.fillStyle = rc; ctx.font = "bold 10px monospace"; ctx.fillText(region.toUpperCase(), 8, 18);
  ctx.fillStyle = "#64748b"; ctx.fillText("Vgs=" + Vgs.toFixed(1) + "V", 8, 32);
}


function drawChemicalScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  temp: number, X: number, tick: number) {
  ctx.fillStyle = "#0a1a0a"; ctx.fillRect(0, 0, W, H);
  const cx = W/2, rW = 100, rH = 180;
  const rx = cx - rW/2, ry = H/2 - rH/2;
  const xFrac = X / 100;
  const rGrad = ctx.createLinearGradient(rx, ry, rx, ry+rH);
  rGrad.addColorStop(0, "rgba(29,78,216," + (1-xFrac*0.7) + ")");
  rGrad.addColorStop(1, "rgba(16,185,129," + (0.3+xFrac*0.7) + ")");
  ctx.fillStyle = rGrad; ctx.fillRect(rx, ry, rW, rH);
  ctx.strokeStyle = "#4b5563"; ctx.lineWidth = 3; ctx.strokeRect(rx, ry, rW, rH);
  ctx.fillStyle = "#1e293b"; ctx.fillRect(rx-8, ry-8, rW+16, 8);
  ctx.fillRect(rx-8, ry+rH, rW+16, 8);
  for (let b = 0; b < 6; b++) {
    const bx2 = rx + 10 + (b * 17 % rW);
    const by2 = ry + rH - ((tick * 2 + b * 30) % (rH - 10));
    const brad = 3 + (b % 3);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath(); ctx.ellipse(bx2, by2, brad, brad*1.4, 0, 0, Math.PI*2); ctx.fill();
  }
  const tGrad = ctx.createLinearGradient(rx+rW+10, ry+rH, rx+rW+10, ry);
  tGrad.addColorStop(0, "#3b82f6"); tGrad.addColorStop(0.5, "#f59e0b"); tGrad.addColorStop(1, "#ef4444");
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(rx+rW+8, ry, 18, rH);
  ctx.fillStyle = tGrad; ctx.fillRect(rx+rW+8, ry, 18, rH);
  ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.strokeRect(rx+rW+8, ry, 18, rH);
  const tFrac = (temp-300) / 190;
  ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(rx+rW+4, ry + rH*(1-tFrac)); ctx.lineTo(rx+rW+30, ry + rH*(1-tFrac)); ctx.stroke();
  ctx.fillStyle = "#ef4444"; ctx.font = "9px monospace";
  ctx.fillText(temp + "K", rx+rW+30, ry + rH*(1-tFrac) - 2);
  ctx.strokeStyle = "#84cc16"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rx+rW+10, ry-20);
  ctx.bezierCurveTo(rx+rW+10, ry-35, cx-10, ry-35, cx-10, ry-50);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rx+rW+10, ry+rH+20);
  ctx.bezierCurveTo(rx+rW+10, ry+rH+35, cx-10, ry+rH+35, cx-10, ry+rH+50);
  ctx.stroke();
  ctx.fillStyle = "#84cc16"; ctx.textAlign = "center";
  ctx.fillText("X=" + X.toFixed(1) + "%", cx, H - 8);
  ctx.textAlign = "left";
}

function drawCivilScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  loadKN: number, deflMM: number, SF: number) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H*0.6);
  skyGrad.addColorStop(0, "#0f172a"); skyGrad.addColorStop(1, "#1e293b");
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, H*0.6, W, H*0.4);
  const beamY = H * 0.42, lp = 60, rp = W - 60;
  const maxDefl = 30;
  const dp = Math.min(maxDefl, deflMM * 0.8);
  const sfColor = SF < 1.2 ? "#ef4444" : SF < 2 ? "#f59e0b" : "#10b981";
  ctx.strokeStyle = sfColor; ctx.lineWidth = 8; ctx.shadowColor = sfColor; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.moveTo(lp, beamY);
  const mid = (lp + rp) / 2;
  ctx.bezierCurveTo(mid-40, beamY+dp*0.5, mid+40, beamY+dp*0.5, rp, beamY);
  ctx.stroke(); ctx.shadowBlur = 0;
  const drawSupport = (x: number, pin: boolean) => {
    ctx.fillStyle = "#334155";
    ctx.beginPath(); ctx.moveTo(x, beamY); ctx.lineTo(x-14, beamY+28); ctx.lineTo(x+14, beamY+28); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 1; ctx.strokeRect(x-18, beamY+28, 36, 5);
    if (!pin) {
      ctx.fillStyle = "#64748b";
      for (let r2 = -1; r2 <= 1; r2++) { ctx.beginPath(); ctx.arc(x+r2*10, beamY+31, 4, 0, Math.PI*2); ctx.fill(); }
    }
  };
  drawSupport(lp, true); drawSupport(rp, false);
  const loadX = mid, loadYtop = beamY - 50, loadYbot = beamY;
  ctx.strokeStyle = "#f43f5e"; ctx.lineWidth = 2.5; ctx.shadowColor = "#f43f5e"; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.moveTo(loadX, loadYtop); ctx.lineTo(loadX, loadYbot-2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(loadX-8, loadYbot-14); ctx.lineTo(loadX, loadYbot-2); ctx.lineTo(loadX+8, loadYbot-14); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f43f5e"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
  ctx.fillText(loadKN + "kN", loadX, loadYtop - 6);
  ctx.fillStyle = sfColor; ctx.fillText("SF=" + SF.toFixed(2) + "  d=" + deflMM.toFixed(1) + "mm", mid, H - 8);
  ctx.textAlign = "left";
}

function drawQuantumScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  theta: number, phi: number, p0: number, bx2: number, by2: number, bz: number) {
  ctx.fillStyle = "#0b0f24"; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = "rgba(255,255,255," + (0.15 + (i%4)*0.1) + ")";
    ctx.beginPath(); ctx.arc((i*137.5)%W, (i*79.3)%(H), 0.7, 0, Math.PI*2); ctx.fill();
  }
  const cx = W * 0.42, cy = H/2, r2 = Math.min(W*0.28, H*0.38);
  ctx.strokeStyle = "rgba(167,139,250,0.3)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, r2, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, cy, r2, r2*0.25, 0, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(cx-r2, cy); ctx.lineTo(cx+r2, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy-r2); ctx.lineTo(cx, cy+r2); ctx.stroke();
  ctx.setLineDash([]);
  const th = theta * Math.PI / 180, ph = phi * Math.PI / 180;
  const vx = r2 * Math.sin(th) * Math.cos(ph);
  const vy = -r2 * Math.cos(th);
  const vz = r2 * Math.sin(th) * Math.sin(ph) * 0.35;
  ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 2.5; ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx+vx+vz, cy+vy); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = "#a78bfa"; ctx.beginPath();
  ctx.arc(cx+vx+vz, cy+vy, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "#10b981"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
  ctx.fillText("|0>", cx, cy - r2 - 8);
  ctx.fillStyle = "#f43f5e"; ctx.fillText("|1>", cx, cy + r2 + 14);
  ctx.textAlign = "left";
  const barX = W * 0.77;
  ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(barX, H*0.1, 30, H*0.8);
  ctx.fillStyle = "#10b981"; ctx.fillRect(barX, H*0.1 + H*0.8*(1-p0), 30, H*0.8*p0);
  ctx.fillStyle = "#f43f5e"; ctx.fillRect(barX + 35, H*0.1 + H*0.8*(1-p0), 30, H*0.8*(1-p0));
  ctx.strokeStyle = "#334155"; ctx.lineWidth = 1;
  ctx.strokeRect(barX, H*0.1, 30, H*0.8); ctx.strokeRect(barX+35, H*0.1, 30, H*0.8);
  ctx.fillStyle = "#94a3b8"; ctx.font = "9px monospace"; ctx.textAlign = "center";
  ctx.fillText("|0>", barX+15, H*0.93); ctx.fillText("|1>", barX+50, H*0.93);
  ctx.textAlign = "left";
}


function drawBiotechScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  D: number, X2: number, washout: boolean, tick: number) {
  ctx.fillStyle = "#071a0e"; ctx.fillRect(0, 0, W, H);
  const cx = W/2, vW = 120, vH = 180, vx = cx-vW/2, vy = H/2-vH/2;
  ctx.fillStyle = washout ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.08)";
  ctx.fillRect(vx, vy, vW, vH);
  ctx.strokeStyle = "#334155"; ctx.lineWidth = 3; ctx.strokeRect(vx, vy, vW, vH);
  const fluidColor = washout ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.25)";
  ctx.fillStyle = fluidColor; ctx.fillRect(vx+2, vy+2, vW-4, vH-4);
  const numCells = Math.round(X2 * 3);
  ctx.fillStyle = "#10b981";
  for (let i = 0; i < Math.min(numCells, 60); i++) {
    const cpx = vx + 8 + (i * 73 % (vW - 16));
    const cpy = vy + 8 + (i * 47 % (vH - 16));
    const cr = 2 + (i % 3);
    ctx.globalAlpha = washout ? 0.3 : 0.8;
    ctx.beginPath(); ctx.ellipse(cpx, cpy, cr, cr*1.3, 0, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const stirAngle = (tick * 0.15) % (Math.PI * 2);
  ctx.strokeStyle = "#64748b"; ctx.lineWidth = 2;
  const sx2 = cx, sy2 = vy + vH * 0.7;
  ctx.beginPath(); ctx.moveTo(sx2, vy); ctx.lineTo(sx2, sy2); ctx.stroke();
  for (let b = 0; b < 2; b++) {
    const ba = stirAngle + b * Math.PI;
    ctx.beginPath(); ctx.moveTo(sx2, sy2);
    ctx.lineTo(sx2 + Math.cos(ba)*36, sy2 + Math.sin(ba)*10); ctx.stroke();
  }
  ctx.fillStyle = "#334155"; ctx.fillRect(cx-6, vy-20, 12, 20);
  const fW = 25, fFrac = D / 0.8;
  ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(vx-fW-10, vy+20); ctx.lineTo(vx, vy+20); ctx.stroke();
  ctx.fillStyle = "rgba(59,130,246," + fFrac + ")";
  ctx.fillRect(vx-fW-10, vy+12, fW, 16);
  ctx.strokeStyle = "#334155"; ctx.strokeRect(vx-fW-10, vy+12, fW, 16);
  ctx.strokeStyle = "#10b981"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(vx+vW, vy+vH-20); ctx.lineTo(vx+vW+30, vy+vH-20); ctx.stroke();
  if (washout) {
    const flash = Math.floor(tick * 0.5) % 2 === 0;
    ctx.shadowColor = "#ef4444"; ctx.shadowBlur = flash ? 18 : 0;
    ctx.fillStyle = flash ? "#ef4444" : "rgba(239,68,68,0.3)";
    ctx.beginPath(); ctx.arc(W-15, 15, 9, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = "#ef4444"; ctx.font = "bold 9px monospace"; ctx.fillText("WASHOUT", W-90, 30);
  }
  ctx.fillStyle = "#10b981"; ctx.font = "bold 10px monospace";
  ctx.fillText("D=" + D.toFixed(2) + " /h", 8, 18);
  ctx.fillStyle = washout ? "#ef4444" : "#10b981";
  ctx.fillText("X=" + X2.toFixed(2) + " g/L", 8, 32);
}

function drawNanotechScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  rNm: number, emitColor: string, lambdaNm: number) {
  ctx.fillStyle = "#030712"; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = "rgba(255,255,255," + (0.1 + (i%4)*0.08) + ")";
    ctx.beginPath(); ctx.arc((i*97.5)%W, (i*137.3)%(H*0.85), 0.6, 0, Math.PI*2); ctx.fill();
  }
  const dotSizes = [1.2, 1.8, 2.5, 3.2, 4.0, 5.0, 6.2, 7.5, 8.8, 10.0];
  const colors2 = ["#9b59b6","#3b82f6","#06b6d4","#22c55e","#eab308","#f97316","#ef4444","#dc2626","#b91c1c","#991b1b"];
  const cols = 5, rows = 2;
  const cellW = W / (cols + 1), cellH = H * 0.7 / rows;
  for (let i = 0; i < 10; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const dotX = cellW * (col + 0.8), dotY = cellH * (row + 0.6) + H * 0.05;
    const displayR = dotSizes[i] * 4.5;
    const isSelected = Math.abs(dotSizes[i] - rNm) < 1.0;
    if (isSelected) {
      ctx.shadowColor = colors2[i]; ctx.shadowBlur = 22;
    }
    const grad = ctx.createRadialGradient(dotX-displayR*0.3, dotY-displayR*0.3, 0, dotX, dotY, displayR);
    grad.addColorStop(0, colors2[i]); grad.addColorStop(0.6, colors2[i] + "aa"); grad.addColorStop(1, colors2[i] + "22");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(dotX, dotY, displayR, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    if (isSelected) {
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(dotX, dotY, displayR + 3, 0, Math.PI*2); ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = "8px monospace"; ctx.textAlign = "center";
    ctx.fillText(dotSizes[i].toFixed(1) + "nm", dotX, dotY + displayR + 12);
  }
  ctx.textAlign = "left";
  const specY = H * 0.88;
  const specGrad = ctx.createLinearGradient(0, specY, W, specY);
  specGrad.addColorStop(0, "#9b59b6"); specGrad.addColorStop(0.2, "#3b82f6");
  specGrad.addColorStop(0.4, "#22c55e"); specGrad.addColorStop(0.6, "#eab308");
  specGrad.addColorStop(0.8, "#f97316"); specGrad.addColorStop(1, "#ef4444");
  ctx.fillStyle = specGrad; ctx.fillRect(0, specY, W, 14);
  const lambdaFrac = Math.max(0, Math.min(1, (lambdaNm - 430) / 270));
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(lambdaFrac * W, specY - 6); ctx.lineTo(lambdaFrac * W, specY + 18); ctx.stroke();
  ctx.shadowColor = emitColor; ctx.shadowBlur = 8;
  ctx.fillStyle = emitColor; ctx.font = "bold 9px monospace";
  ctx.fillText(lambdaNm.toFixed(0) + "nm", Math.min(lambdaFrac*W + 2, W-50), specY - 10);
  ctx.shadowBlur = 0;
}

function drawHealthScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  Cmax: number, halfLifeH: number, tick: number) {
  ctx.fillStyle = "#150818"; ctx.fillRect(0, 0, W, H);
  const tElapsed = (tick % 60) / 60;
  const kel2 = 0.693 / halfLifeH;
  const tHours = tElapsed * halfLifeH * 5;
  const Ct = Cmax * Math.exp(-kel2 * tHours);
  const cIntensity = Math.min(1, Ct / Math.max(0.01, Cmax));
  const cx2 = W * 0.38, cy2 = H * 0.42;
  const headR = 28;
  ctx.strokeStyle = "rgba(148,163,184,0.4)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx2, cy2 - 80, headR, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx2-30, cy2-52); ctx.lineTo(cx2-42, cy2+20);
  ctx.lineTo(cx2+42, cy2+20); ctx.lineTo(cx2+30, cy2-52); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx2-42, cy2+20); ctx.lineTo(cx2-52, cy2+90);
  ctx.moveTo(cx2+42, cy2+20); ctx.lineTo(cx2+52, cy2+90); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx2-20, cy2+20); ctx.lineTo(cx2-20, cy2+95);
  ctx.moveTo(cx2+20, cy2+20); ctx.lineTo(cx2+20, cy2+95); ctx.stroke();
  const bGlow = ctx.createRadialGradient(cx2, cy2, 10, cx2, cy2, 60);
  bGlow.addColorStop(0, "rgba(244,63,94," + cIntensity*0.8 + ")");
  bGlow.addColorStop(1, "rgba(244,63,94,0)");
  ctx.fillStyle = bGlow; ctx.fillRect(cx2-70, cy2-70, 140, 140);
  const curveX = W * 0.55, curveW = W * 0.4, curveH = H * 0.65, curveY = H * 0.1;
  ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(curveX, curveY); ctx.lineTo(curveX, curveY+curveH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(curveX, curveY+curveH); ctx.lineTo(curveX+curveW, curveY+curveH); ctx.stroke();
  ctx.strokeStyle = "#f43f5e"; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const ti = (i/40) * halfLifeH * 5;
    const ci = Cmax * Math.exp(-kel2 * ti);
    const px2 = curveX + (i/40)*curveW;
    const py2 = curveY + curveH - (ci/Cmax) * curveH * 0.85;
    i === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2);
  }
  ctx.stroke();
  const micY = curveY + curveH - (0.5/Cmax)*curveH*0.85;
  ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(curveX, micY); ctx.lineTo(curveX+curveW, micY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#f59e0b"; ctx.font = "9px monospace"; ctx.fillText("MIC", curveX+3, micY-3);
  const dotX = curveX + tElapsed * curveW;
  const dotY = curveY + curveH - (Ct/Cmax)*curveH*0.85;
  ctx.fillStyle = "#f43f5e"; ctx.shadowColor = "#f43f5e"; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(dotX, dotY, 4, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
}


function drawAerospaceScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  alt: number, ecc: number, tick: number) {
  ctx.fillStyle = "#020817"; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) {
    const brightness = 0.2 + (i % 5) * 0.12;
    ctx.fillStyle = "rgba(255,255,255," + brightness + ")";
    ctx.beginPath(); ctx.arc((i*97.3)%W, (i*137.7)%H, 0.6 + (i%3)*0.3, 0, Math.PI*2); ctx.fill();
  }
  const earthX = W * 0.3, earthY = H * 0.55, earthR = 52;
  const earthGrad = ctx.createRadialGradient(earthX-15, earthY-15, 5, earthX, earthY, earthR);
  earthGrad.addColorStop(0, "#1d4ed8"); earthGrad.addColorStop(0.4, "#1565c0");
  earthGrad.addColorStop(0.7, "#0d47a1"); earthGrad.addColorStop(1, "#1a237e");
  ctx.fillStyle = earthGrad;
  ctx.shadowColor = "#3b82f6"; ctx.shadowBlur = 15;
  ctx.beginPath(); ctx.arc(earthX, earthY, earthR, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(34,197,94,0.6)";
  ctx.beginPath(); ctx.ellipse(earthX-10, earthY-5, 15, 22, -0.3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(earthX+18, earthY+12, 12, 18, 0.5, 0, Math.PI*2); ctx.fill();
  const altNorm = Math.min(1, (alt - 200) / (42000 - 200));
  const aScale = earthR + 20 + altNorm * (Math.min(W,H)*0.33);
  const bAxis = aScale * Math.sqrt(Math.max(0.001, 1 - ecc*ecc));
  ctx.strokeStyle = "rgba(96,165,250,0.35)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(earthX + ecc*aScale*0.5, earthY, aScale, bAxis, 0, 0, Math.PI*2); ctx.stroke();
  const satAngle = (tick * 0.06) % (Math.PI * 2);
  const satR = aScale * (1 - ecc*ecc) / (1 + ecc * Math.cos(satAngle));
  const satX = earthX + ecc*aScale*0.5 + satR * Math.cos(satAngle);
  const satY = earthY + satR * Math.sin(satAngle) * (bAxis/aScale);
  ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(satX-8, satY); ctx.lineTo(satX-3, satY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(satX+3, satY); ctx.lineTo(satX+8, satY); ctx.stroke();
  ctx.fillStyle = "#e2e8f0"; ctx.shadowColor = "#e2e8f0"; ctx.shadowBlur = 8;
  ctx.fillRect(satX-3, satY-3, 6, 6); ctx.shadowBlur = 0;
  const trailLen = 12;
  for (let t2 = 1; t2 <= trailLen; t2++) {
    const ta = satAngle - t2 * 0.05;
    const tr2 = aScale * (1 - ecc*ecc) / (1 + ecc * Math.cos(ta));
    const tx2 = earthX + ecc*aScale*0.5 + tr2 * Math.cos(ta);
    const ty2 = earthY + tr2 * Math.sin(ta) * (bAxis/aScale);
    ctx.fillStyle = "rgba(96,165,250," + (0.3 - t2*0.023) + ")";
    ctx.beginPath(); ctx.arc(tx2, ty2, 1.5, 0, Math.PI*2); ctx.fill();
  }
  ctx.fillStyle = "#60a5fa"; ctx.font = "9px monospace";
  ctx.fillText(alt >= 1000 ? (alt/1000).toFixed(1) + "k km" : alt + " km alt", 8, 16);
  ctx.fillText("e=" + ecc.toFixed(2), 8, 28);
}

function drawDefenseScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  angle: number, range_km: number, hMax_km: number, tick: number) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H*0.65);
  skyGrad.addColorStop(0, "#0c0a1a"); skyGrad.addColorStop(1, "#1a1530");
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath(); ctx.arc((i*137)%W, (i*53)%(H*0.5), 0.7, 0, Math.PI*2); ctx.fill();
  }
  const groundY = H * 0.75;
  ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, groundY, W, H - groundY);
  const hills = [
    {x:0, h:30}, {x:80, h:50}, {x:160, h:25}, {x:240, h:45}, {x:320, h:35},
    {x:400, h:55}, {x:480, h:30}, {x:560, h:42}, {x:640, h:28}, {x:720, h:60}, {x:800, h:35}
  ];
  ctx.fillStyle = "#0f172a";
  ctx.beginPath(); ctx.moveTo(0, groundY);
  hills.forEach((h2, i) => {
    if (i % 2 === 0) ctx.bezierCurveTo(h2.x+20, groundY-h2.h*1.2, h2.x+60, groundY-h2.h, h2.x+80, groundY);
    else ctx.lineTo(h2.x+80, groundY);
  });
  ctx.lineTo(W, groundY); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  const launchX = 50, launchY = groundY - 5;
  const th = angle * Math.PI / 180, g2 = 9.81, drag2 = 0.75;
  const Rmax = range_km * 1000, Hmax = hMax_km * 1000;
  const projProgress = (tick * 0.025) % 1.05;
  const arcX = (t: number) => launchX + (t * (W - 100));
  const arcY = (t: number) => {
    const xm = t * Rmax;
    const y2 = xm * Math.tan(th) - (g2 * xm * xm) / (2 * (range_km*1000/Math.sin(2*th)||1) * Math.pow(Math.cos(th),2)) * drag2;
    return groundY - Math.max(0, y2 / Hmax) * (groundY - H*0.08);
  };
  ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1.5; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(launchX, launchY);
  for (let i = 1; i <= 40; i++) ctx.lineTo(arcX(i/40), arcY(i/40));
  ctx.stroke(); ctx.setLineDash([]);
  if (projProgress < 1.0) {
    const px2 = arcX(projProgress), py2 = arcY(projProgress);
    ctx.fillStyle = "#f59e0b"; ctx.shadowColor = "#f59e0b"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(px2, py2, 5, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
    for (let t2 = 1; t2 <= 8; t2++) {
      const tp = Math.max(0, projProgress - t2*0.015);
      ctx.fillStyle = "rgba(245,158,11," + (0.6 - t2*0.07) + ")";
      ctx.beginPath(); ctx.arc(arcX(tp), arcY(tp), 3-t2*0.3, 0, Math.PI*2); ctx.fill();
    }
  } else {
    const ex = arcX(1.0), ey2 = groundY;
    for (let i = 0; i < 8; i++) {
      const ea = (i/8)*Math.PI*2, er = 8 + (i%3)*4;
      ctx.strokeStyle = "#f97316"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ex, ey2); ctx.lineTo(ex+Math.cos(ea)*er, ey2+Math.sin(ea)*er); ctx.stroke();
    }
    ctx.fillStyle = "#f97316"; ctx.shadowColor = "#f97316"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(ex, ey2, 7, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
  }
  ctx.fillStyle = "#94a3b8"; ctx.font = "9px monospace";
  ctx.fillText(range_km.toFixed(1) + "km range  " + angle + " deg", 8, 14);
  ctx.fillText(hMax_km.toFixed(2) + "km apogee", 8, 26);
}

function drawMathScene(ctx: CanvasRenderingContext2D, W: number, H: number,
  r2: number, x0: number, chaos: boolean, tick: number) {
  ctx.fillStyle = "#0b0f24"; ctx.fillRect(0, 0, W, H);
  const pad = 30, cW = W - 2*pad, cH = H - 2*pad;
  ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, pad+cH); ctx.lineTo(pad+cW, pad+cH); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.setLineDash([3,6]);
  ctx.beginPath(); ctx.moveTo(pad, pad+cH); ctx.lineTo(pad+cW, pad); ctx.stroke();
  ctx.setLineDash([]);
  const col = chaos ? "#f43f5e" : "#10b981";
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const xi = i / 60;
    const yi = r2 * xi * (1 - xi);
    const px2 = pad + xi * cW;
    const py2 = pad + cH - yi * cH;
    i === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2);
  }
  ctx.stroke();
  const steps = Math.min(30, 10 + tick % 20);
  let cx2 = x0;
  const lCol = chaos ? "rgba(251,113,133,0.7)" : "rgba(16,185,129,0.7)";
  ctx.strokeStyle = lCol; ctx.lineWidth = 1.2;
  ctx.beginPath();
  const sx3 = pad + cx2 * cW, sy3 = pad + cH;
  ctx.moveTo(sx3, sy3);
  for (let s = 0; s < steps; s++) {
    const nextY = r2 * cx2 * (1 - cx2);
    const lx1 = pad + cx2 * cW, ly1 = pad + cH - cx2 * cH;
    const ly2 = pad + cH - nextY * cH;
    ctx.lineTo(lx1, ly1);
    ctx.lineTo(pad + nextY * cW, ly2);
    cx2 = nextY;
  }
  ctx.stroke();
  const dotColor = chaos ? "#fb7185" : "#10b981";
  ctx.fillStyle = dotColor; ctx.shadowColor = dotColor; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(pad + cx2*cW, pad + cH - cx2*cH, 4, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = chaos ? "#f43f5e" : "#10b981"; ctx.font = "bold 10px monospace";
  ctx.fillText(chaos ? "CHAOS" : "STABLE", pad, pad - 8);
  ctx.fillStyle = "#64748b"; ctx.fillText("r=" + r2.toFixed(2), W-60, pad - 8);
}


// ─── 1. Traffic ───────────────────────────────────────────────────────────────
function TrafficTwinDemo() {
  const ACC = "#f59e0b";
  const [density, setDensity] = useState(45);
  const [signal, setSignal] = useState(60);
  const [tick, setTick] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 20 }, () => 20 + Math.random() * 50));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const { efficiency } = trafficMetrics(density, signal);
      setBars(prev => prev.map(b => {
        const tgt = density * efficiency * (0.6 + Math.random() * 0.8);
        return Math.max(5, Math.min(97, b + (tgt - b) * 0.35 + (Math.random() - 0.5) * 6));
      }));
      setTick(t => t + 1);
    }, 1500);
    return () => clearInterval(id);
  }, [density, signal]);

  const { efficiency, throughput, avgWait, congestion } = trafficMetrics(density, signal);
  const cColor = congestion > 65 ? "#f43f5e" : congestion > 40 ? "#f59e0b" : "#10b981";

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawTrafficScene(ctx, cv.width, cv.height, density, congestion, tick);
  }, [density, signal, congestion, tick]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="City Traffic Network — Live Twin" sub={`2,847 nodes · 11,402 edges`} tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <BarChart bars={bars} accent={ACC} />
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>Intersection 1</span><span>vehicle density</span><span>Intersection 20</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Traffic Density</span><span style={{ color: ACC }}>{density}%</span>
            </label>
            <input type="range" min={10} max={95} value={density} style={{ accentColor: ACC, width: "100%" }}
              onChange={e => setDensity(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Signal Cycle</span><span style={{ color: ACC }}>{signal}s</span>
            </label>
            <input type="range" min={30} max={120} step={5} value={signal} style={{ accentColor: ACC, width: "100%" }}
              onChange={e => setSignal(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="Throughput" value={throughput.toLocaleString()} sub="vehicles/hr" color={ACC} />
          <KPICard label="Avg Wait" value={`${avgWait}s`} sub="per intersection" color={ACC} />
          <KPICard label="Congestion" value={String(congestion)} sub={congestion > 65 ? "severe" : congestion > 40 ? "moderate" : "clear"} color={cColor} />
        </div>
        <InsightBox accent={ACC}>
          Throughput = 4800 x n(p), n(p) = 1/(1 + e^12(p-0.65)). At p = {(density/100).toFixed(2)}, efficiency ={" "}
          <strong style={{ color: ACC }}>{(efficiency * 100).toFixed(0)}%</strong>. Congestion index = (1 - n) x 100.
        </InsightBox>
      </div>
    </div>
  );
}

// ─── 2. Power Grid ────────────────────────────────────────────────────────────
function PowerGridTwinDemo() {
  const ACC = "#22d3ee";
  const [renew, setRenew] = useState(30);
  const [load, setLoad] = useState(750);
  const [tick, setTick] = useState(0);
  const [hist, setHist] = useState<number[]>(() => Array(20).fill(50));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const { freq } = powerGridMetrics(renew, load);
      setHist(prev => {
        const next = Math.max(49, Math.min(51, freq + (Math.random() - 0.5) * 0.08));
        return [...prev.slice(1), next];
      });
      setTick(t => t + 1);
    }, 1200);
    return () => clearInterval(id);
  }, [renew, load]);

  const { freq, deltaF, blackoutRisk, co2, cost, totalGen } = powerGridMetrics(renew, load);
  const rColor = blackoutRisk > 50 ? "#f43f5e" : blackoutRisk > 20 ? "#f59e0b" : "#10b981";
  const fMin = Math.min(...hist), fMax = Math.max(...hist), fRange = fMax - fMin || 0.1;

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawPowerScene(ctx, cv.width, cv.height, renew, blackoutRisk, tick);
  }, [renew, load, blackoutRisk, tick]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="National Grid — Frequency Monitor" sub={`${Math.round(totalGen)} MW gen · ${load} MW load`} tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <div className="flex items-end gap-0.5 rounded-xl overflow-hidden px-3 pt-3 pb-0"
          style={{ background: "rgba(0,0,0,0.25)", height: 120 }}>
          {hist.map((f, i) => {
            const pct = ((f - fMin) / fRange) * 80 + 10;
            return (
              <div key={i} className="flex-1 flex flex-col justify-end items-center">
                <div className="w-full rounded-t-sm" style={{
                  height: `${pct}%`, minWidth: 6, transition: "height 1s ease",
                  background: Math.abs(f - 50) > 0.4 ? "#f43f5e88" : `${ACC}55`,
                }} />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>t-20s</span><span>grid frequency (Hz)</span><span>now</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Renewable Mix</span><span style={{ color: ACC }}>{renew}%</span>
            </label>
            <input type="range" min={0} max={100} step={5} value={renew} style={{ accentColor: ACC, width: "100%" }}
              onChange={e => setRenew(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Total Load</span><span style={{ color: ACC }}>{load} MW</span>
            </label>
            <input type="range" min={400} max={1000} step={10} value={load} style={{ accentColor: ACC, width: "100%" }}
              onChange={e => setLoad(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <KPICard label="Frequency" value={`${freq.toFixed(2)} Hz`} color={Math.abs(freq - 50) > 0.4 ? "#f43f5e" : ACC} />
          <KPICard label="Blackout Risk" value={`${Math.round(blackoutRisk)}%`} color={rColor} />
          <KPICard label="CO2 Intensity" value={`${co2} g/kWh`} color="#94a3b8" />
          <KPICard label="Spot Price" value={`$${cost}/MWh`} color="#94a3b8" />
        </div>
        <InsightBox accent={ACC}>
          Df = (P_gen - P_load)/(2H*P_rated) x f0. H = 5s, P_rated = 1000 MW, f0 = 50 Hz.
          Current Df = <strong style={{ color: ACC }}>{deltaF.toFixed(3)} Hz</strong>. Safe: |Df| &lt; 0.5 Hz.
        </InsightBox>
      </div>
    </div>
  );
}

// ─── 3. Supply Chain ─────────────────────────────────────────────────────────
function SupplyChainTwinDemo() {
  const ACC = "#8b5cf6";
  const [leadTime, setLeadTime] = useState(7);
  const [vol, setVol] = useState(20);
  const [sf, setSf] = useState(1.65);
  const [tick, setTick] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(12).fill(60));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const { totalInventory } = supplyChainMetrics(leadTime, vol, sf);
      setBars(prev => prev.map(b => {
        const tgt = (totalInventory / 800) * 80 + (Math.random() - 0.5) * 20;
        return Math.max(5, Math.min(97, b + (tgt - b) * 0.3));
      }));
      setTick(t => t + 1);
    }, 1400);
    return () => clearInterval(id);
  }, [leadTime, vol, sf]);

  const { bullwhip, safetyStock, totalInventory, stockoutRisk } = supplyChainMetrics(leadTime, vol, sf);
  const rColor = stockoutRisk > 15 ? "#f43f5e" : stockoutRisk > 5 ? "#f59e0b" : "#10b981";
  const bColor = bullwhip > 3 ? "#f43f5e" : bullwhip > 2 ? "#f59e0b" : "#10b981";

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawSupplyScene(ctx, cv.width, cv.height, stockoutRisk, totalInventory, tick);
  }, [leadTime, vol, sf, stockoutRisk, totalInventory, tick]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="Multi-Tier Supply Chain — Inventory Monitor" sub={`4 tiers · ${totalInventory} units on hand`} tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <BarChart bars={bars} accent={ACC} />
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>Retailer</span><span>inventory across nodes</span><span>Supplier</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-5 mb-5">
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Lead Time</span><span style={{ color: ACC }}>{leadTime}d</span>
            </label>
            <input type="range" min={1} max={30} value={leadTime} style={{ accentColor: ACC, width: "100%" }} onChange={e => setLeadTime(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Demand Volatility</span><span style={{ color: ACC }}>{vol}%</span>
            </label>
            <input type="range" min={1} max={80} value={vol} style={{ accentColor: ACC, width: "100%" }} onChange={e => setVol(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Safety Factor</span><span style={{ color: ACC }}>{sf.toFixed(2)}s</span>
            </label>
            <input type="range" min={0.5} max={3} step={0.05} value={sf} style={{ accentColor: ACC, width: "100%" }} onChange={e => setSf(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="Safety Stock" value={`${safetyStock}u`} color={ACC} />
          <KPICard label="Stockout Risk" value={`${stockoutRisk}%`} color={rColor} />
          <KPICard label="Bullwhip" value={`${bullwhip.toFixed(2)}x`} color={bColor} />
        </div>
        <InsightBox accent={ACC}>
          Bullwhip = 1 + 2L/T + 2(L/T)^2. At L={leadTime}d, T=5d: <strong style={{ color: ACC }}>{bullwhip.toFixed(2)}x</strong> variance amplification.
          Stockout risk = 1 - Phi({sf.toFixed(2)}) = <strong style={{ color: rColor }}>{stockoutRisk}%</strong> (normal CDF).
        </InsightBox>
      </div>
    </div>
  );
}


// ─── 4. Mechanical — Spring-Mass-Damper ──────────────────────────────────────
function MechanicalTwinDemo() {
  const ACC = "#f97316";
  const [mass, setMass] = useState(5);
  const [springK, setSpringK] = useState(200);
  const [dampingC, setDampingC] = useState(10);
  const [tick, setTick] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(20).fill(50));
  const tRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    tRef.current = 0;
    const id = setInterval(() => {
      tRef.current += 1;
      const { omega0, zeta, omegaD, type } = mechanicalMetrics(mass, springK, dampingC);
      setBars(Array.from({ length: 20 }, (_, i) => {
        const t = tRef.current * 0.12 + i * 0.25;
        let disp = 0;
        if (type === "overdamped") {
          const sq = Math.sqrt(Math.max(0, zeta * zeta - 1));
          disp = sq > 0 ? (Math.exp(-omega0*(zeta-sq)*t) - Math.exp(-omega0*(zeta+sq)*t))/(2*sq) : 0;
        } else if (type === "critical") {
          disp = t * Math.exp(-omega0 * t);
        } else {
          disp = Math.exp(-zeta * omega0 * t) * Math.cos(omegaD * t);
        }
        return Math.max(5, Math.min(95, 50 + 43 * disp));
      }));
      setTick(t => t + 1);
    }, 120);
    return () => clearInterval(id);
  }, [mass, springK, dampingC]);

  const { freqHz, zeta, settlingTime, type } = mechanicalMetrics(mass, springK, dampingC);
  const typeColor = type === "overdamped" ? "#94a3b8" : type === "critical" ? "#f59e0b" : ACC;
  const massPos = bars[10] ?? 50;

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawMechanicalScene(ctx, cv.width, cv.height, massPos, type);
  }, [massPos, type, tick]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="Spring-Mass-Damper — Transient Response" sub={`m=${mass}kg  k=${springK}N/m  c=${dampingC}N*s/m`} tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <BarChart bars={bars} accent={ACC} />
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>t=0</span><span>displacement x(t) over time</span><span>steady state</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-5 mb-5">
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Mass</span><span style={{ color: ACC }}>{mass} kg</span>
            </label>
            <input type="range" min={1} max={50} value={mass} style={{ accentColor: ACC, width: "100%" }} onChange={e => setMass(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Spring k</span><span style={{ color: ACC }}>{springK} N/m</span>
            </label>
            <input type="range" min={10} max={2000} step={10} value={springK} style={{ accentColor: ACC, width: "100%" }} onChange={e => setSpringK(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Damping c</span><span style={{ color: ACC }}>{dampingC} N*s/m</span>
            </label>
            <input type="range" min={0} max={200} value={dampingC} style={{ accentColor: ACC, width: "100%" }} onChange={e => setDampingC(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="Natural Freq" value={`${freqHz.toFixed(2)} Hz`} color={ACC} />
          <KPICard label="Damping Ratio z" value={zeta.toFixed(3)} color={typeColor} sub={type} />
          <KPICard label="Settling Time" value={settlingTime < 100 ? `${settlingTime.toFixed(1)}s` : "---"} color="#94a3b8" />
        </div>
        <InsightBox accent={ACC}>
          w0 = sqrt(k/m) = <strong style={{ color: ACC }}>{(freqHz*2*Math.PI).toFixed(2)} rad/s</strong>.{" "}
          z = c/(2*sqrt(km)) = <strong style={{ color: typeColor }}>{zeta.toFixed(3)}</strong>.{" "}
          x(t) = e^(-z*w0*t)*cos(wd*t). Response: <strong style={{ color: typeColor }}>{type}</strong>.
        </InsightBox>
      </div>
    </div>
  );
}

// ─── 5. Electrical — RLC Circuit ─────────────────────────────────────────────
function ElectricalTwinDemo() {
  const ACC = "#eab308";
  const [R, setR] = useState(50);
  const [L_mH, setL_mH] = useState(100);
  const [C_uF, setC_uF] = useState(10);
  const [tick, setTick] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(20).fill(20));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const { omega0, Q } = electricalMetrics(R, L_mH, C_uF);
      const noise = () => (Math.random() - 0.5) * 2;
      setBars(Array.from({ length: 20 }, (_, i) => {
        const omega = omega0 * Math.exp((i - 10) * 0.18);
        const ratio = omega / omega0;
        const mag = 1 / Math.sqrt(Math.pow(1 - ratio * ratio, 2) + Math.pow(ratio / Q, 2));
        const peak = Q > 0.5 ? Q : 1;
        return Math.max(3, Math.min(95, (mag / peak) * 88 + noise()));
      }));
      setTick(t => t + 1);
    }, 1200);
    return () => clearInterval(id);
  }, [R, L_mH, C_uF]);

  const { freq0Hz, Q, BW_Hz } = electricalMetrics(R, L_mH, C_uF);
  const freqStr = freq0Hz >= 1000 ? `${(freq0Hz/1000).toFixed(2)} kHz` : `${freq0Hz.toFixed(1)} Hz`;
  const bwStr = BW_Hz >= 1000 ? `${(BW_Hz/1000).toFixed(1)} kHz` : `${BW_Hz.toFixed(1)} Hz`;

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawElectricalScene(ctx, cv.width, cv.height, Q, tick);
  }, [R, L_mH, C_uF, Q, tick]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="RLC Circuit — Frequency Response |H(jw)|" sub={`R=${R}ohm  L=${L_mH}mH  C=${C_uF}uF`} tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <BarChart bars={bars} accent={ACC} />
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>0.1*w0</span><span>frequency sweep (log scale)</span><span>10*w0</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-5 mb-5">
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Resistance R</span><span style={{ color: ACC }}>{R} ohm</span>
            </label>
            <input type="range" min={1} max={500} value={R} style={{ accentColor: ACC, width: "100%" }} onChange={e => setR(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Inductance L</span><span style={{ color: ACC }}>{L_mH} mH</span>
            </label>
            <input type="range" min={1} max={500} value={L_mH} style={{ accentColor: ACC, width: "100%" }} onChange={e => setL_mH(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Capacitance C</span><span style={{ color: ACC }}>{C_uF} uF</span>
            </label>
            <input type="range" min={1} max={200} value={C_uF} style={{ accentColor: ACC, width: "100%" }} onChange={e => setC_uF(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="Resonant Freq" value={freqStr} color={ACC} />
          <KPICard label="Q Factor" value={Q.toFixed(2)} color={Q > 10 ? "#10b981" : Q > 3 ? ACC : "#f43f5e"} sub={Q > 10 ? "sharp" : Q < 1 ? "overdamped" : "moderate"} />
          <KPICard label="Bandwidth" value={bwStr} color="#94a3b8" />
        </div>
        <InsightBox accent={ACC}>
          w0 = 1/sqrt(LC) = <strong style={{ color: ACC }}>{freqStr}</strong>.{" "}
          Q = (1/R)*sqrt(L/C) = <strong style={{ color: ACC }}>{Q.toFixed(2)}</strong>. Higher Q means sharper resonance.
          |H(jw)| = 1/sqrt[(1-(w/w0)^2)^2 + (w/Qw0)^2].
        </InsightBox>
      </div>
    </div>
  );
}

// ─── 6. Electronic — MOSFET I-V ──────────────────────────────────────────────
function ElectronicTwinDemo() {
  const ACC = "#06b6d4";
  const [Vgs, setVgs] = useState(3.0);
  const [Vds, setVds] = useState(5.0);
  const [tick, setTick] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(20).fill(10));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const noise = () => (Math.random() - 0.5) * 1.5;
      setBars(Array.from({ length: 20 }, (_, i) => {
        const vd = i * 0.8;
        const { Id_mA } = electronicMetrics(Vgs, vd);
        return Math.max(2, Math.min(95, Id_mA * 8 + noise()));
      }));
      setTick(t => t + 1);
    }, 1200);
    return () => clearInterval(id);
  }, [Vgs]);

  const { Id_mA, region, gm_mS, Vdsat } = electronicMetrics(Vgs, Vds);
  const regColor = region === "saturation" ? "#10b981" : region === "triode" ? ACC : "#475569";

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawElectronicScene(ctx, cv.width, cv.height, Vgs, region);
  }, [Vgs, Vds, region]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="NMOS MOSFET — I-V Characteristic" sub={`Vgs=${Vgs.toFixed(1)}V  Vds=${Vds.toFixed(1)}V  Vt=1.5V`} tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <BarChart bars={bars} accent={ACC} />
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>Vds=0V</span><span>drain current Id vs Vds</span><span>Vds=15V</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Gate Voltage Vgs</span><span style={{ color: ACC }}>{Vgs.toFixed(1)} V</span>
            </label>
            <input type="range" min={0} max={5} step={0.1} value={Vgs} style={{ accentColor: ACC, width: "100%" }} onChange={e => setVgs(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Drain Voltage Vds</span><span style={{ color: ACC }}>{Vds.toFixed(1)} V</span>
            </label>
            <input type="range" min={0} max={15} step={0.1} value={Vds} style={{ accentColor: ACC, width: "100%" }} onChange={e => setVds(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="Drain Current Id" value={`${Id_mA.toFixed(2)} mA`} color={ACC} />
          <KPICard label="Region" value={region} color={regColor} sub={`Vdsat=${Vdsat.toFixed(1)}V`} />
          <KPICard label="Transconductance gm" value={`${gm_mS.toFixed(2)} mS`} color="#94a3b8" />
        </div>
        <InsightBox accent={ACC}>
          Triode (Vds &lt; Vgs-Vt): Id = k[(Vgs-Vt)Vds - Vds^2/2].{" "}
          Sat (Vds &gt;= Vgs-Vt): Id = (k/2)(Vgs-Vt)^2 = <strong style={{ color: ACC }}>{((0.002/2)*Math.pow(Math.max(0,Vgs-1.5),2)*1000).toFixed(2)} mA</strong>.
          Region: <strong style={{ color: regColor }}>{region}</strong>.
        </InsightBox>
      </div>
    </div>
  );
}


// ─── 7. Chemical — CSTR Reactor ──────────────────────────────────────────────
function ChemicalTwinDemo() {
  const ACC = "#84cc16";
  const [temp, setTemp] = useState(380);
  const [tau, setTau] = useState(10);
  const [tick, setTick] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(20).fill(30));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const noise = () => (Math.random() - 0.5) * 2;
      setBars(Array.from({ length: 20 }, (_, i) => {
        const T = 300 + i * 10;
        return Math.max(2, Math.min(95, chemicalMetrics(T, tau).X + noise()));
      }));
      setTick(t => t + 1);
    }, 1400);
    return () => clearInterval(id);
  }, [tau]);

  const { k, X, Ca } = chemicalMetrics(temp, tau);
  const convColor = X > 80 ? "#10b981" : X > 50 ? ACC : "#f59e0b";

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawChemicalScene(ctx, cv.width, cv.height, temp, X, tick);
  }, [temp, tau, X, tick]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="CSTR Reactor — Conversion vs Temperature" sub="Arrhenius kinetics · Ea=72 kJ/mol · first-order" tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <BarChart bars={bars} accent={ACC} />
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>300K</span><span>conversion X(T) at tau={tau}min</span><span>490K</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Temperature T</span><span style={{ color: ACC }}>{temp} K ({temp-273}C)</span>
            </label>
            <input type="range" min={300} max={490} step={5} value={temp} style={{ accentColor: ACC, width: "100%" }} onChange={e => setTemp(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Residence Time tau</span><span style={{ color: ACC }}>{tau} min</span>
            </label>
            <input type="range" min={1} max={60} value={tau} style={{ accentColor: ACC, width: "100%" }} onChange={e => setTau(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="Conversion X" value={`${X.toFixed(1)}%`} color={convColor} />
          <KPICard label="Rate Const k" value={k.toExponential(2)} sub="s-1" color={ACC} />
          <KPICard label="Outlet Conc Ca" value={`${Ca.toFixed(3)} mol/L`} color="#94a3b8" />
        </div>
        <InsightBox accent={ACC}>
          Arrhenius: k = k0*exp(-Ea/RT). CSTR conversion: X = k*tau/(1+k*tau).
          At {temp}K: k = <strong style={{ color: ACC }}>{k.toExponential(3)} s-1</strong>,{" "}
          X = <strong style={{ color: convColor }}>{X.toFixed(1)}%</strong>.
        </InsightBox>
      </div>
    </div>
  );
}

// ─── 8. Civil — Beam Deflection ──────────────────────────────────────────────
function CivilTwinDemo() {
  const ACC = "#6366f1";
  const [loadKN, setLoadKN] = useState(100);
  const [spanM, setSpanM] = useState(8);
  const [tick, setTick] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(20).fill(50));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const P = loadKN * 1000, L = spanM;
      const noise = () => (Math.random() - 0.5) * 1.5;
      setBars(Array.from({ length: 20 }, (_, i) => {
        const x = (i / 19) * L;
        const Mx = x <= L/2 ? P*x/2 : P*(L-x)/2;
        const Mmax = P*L/4;
        return Math.max(3, Math.min(95, (Mx/Mmax)*88 + noise()));
      }));
      setTick(t => t + 1);
    }, 1500);
    return () => clearInterval(id);
  }, [loadKN, spanM]);

  const { deflMM, sigma, SF, L_d } = civilMetrics(loadKN, spanM);
  const sfColor = SF < 1 ? "#f43f5e" : SF < 2 ? "#f59e0b" : "#10b981";

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawCivilScene(ctx, cv.width, cv.height, loadKN, deflMM, SF);
  }, [loadKN, spanM, deflMM, SF]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="Simply-Supported Beam — Bending Moment" sub="W250x89 steel  E=200GPa  sigma_y=250MPa" tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <BarChart bars={bars} accent={ACC} />
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>Left support</span><span>bending moment M(x)</span><span>Right support</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Point Load P</span><span style={{ color: ACC }}>{loadKN} kN</span>
            </label>
            <input type="range" min={10} max={500} step={10} value={loadKN} style={{ accentColor: ACC, width: "100%" }} onChange={e => setLoadKN(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Span L</span><span style={{ color: ACC }}>{spanM} m</span>
            </label>
            <input type="range" min={2} max={20} step={0.5} value={spanM} style={{ accentColor: ACC, width: "100%" }} onChange={e => setSpanM(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="Max Deflection" value={`${deflMM.toFixed(1)} mm`} color={ACC} sub={`L/${L_d}`} />
          <KPICard label="Bending Stress" value={`${sigma.toFixed(1)} MPa`} color={sigma > 200 ? "#f43f5e" : "#94a3b8"} />
          <KPICard label="Safety Factor" value={SF.toFixed(2)} color={sfColor} sub={SF < 1.5 ? "check design" : "ok"} />
        </div>
        <InsightBox accent={ACC}>
          d_max = PL^3/(48EI) = <strong style={{ color: ACC }}>{deflMM.toFixed(2)} mm</strong> (L/{L_d}).{" "}
          sigma = PL/(4Z) = <strong style={{ color: sigma > 200 ? "#f43f5e" : ACC }}>{sigma.toFixed(1)} MPa</strong>.{" "}
          SF = sigma_y/sigma = 250/{sigma.toFixed(1)} = <strong style={{ color: sfColor }}>{SF.toFixed(2)}</strong>.
        </InsightBox>
      </div>
    </div>
  );
}

// ─── 9. Quantum — Single Qubit ───────────────────────────────────────────────
function QuantumTwinDemo() {
  const ACC = "#a78bfa";
  const [theta, setTheta] = useState(90);
  const [phi, setPhi] = useState(45);
  const [tick, setTick] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(20).fill(50));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const noise = () => (Math.random() - 0.5) * 1;
      setBars(Array.from({ length: 20 }, (_, i) => {
        const th = i * 9 * Math.PI / 180;
        const p0 = Math.pow(Math.cos(th / 2), 2);
        return Math.max(3, Math.min(95, p0 * 90 + noise()));
      }));
      setTick(t => t + 1);
    }, 1200);
    return () => clearInterval(id);
  }, []);

  const { p0, p1, bx, by, bz, coherence } = quantumMetrics(theta, phi);

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawQuantumScene(ctx, cv.width, cv.height, theta, phi, p0, bx, by, bz);
  }, [theta, phi, p0, bx, by, bz]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="Single Qubit — Bloch Sphere State" sub="|psi> = cos(t/2)|0> + exp(i*phi)*sin(t/2)|1>" tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <BarChart bars={bars} accent={ACC} />
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>theta=0 (|0&gt;)</span><span>P(|0&gt;) vs polar angle sweep</span><span>theta=180 (|1&gt;)</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Polar angle theta</span><span style={{ color: ACC }}>{theta} deg</span>
            </label>
            <input type="range" min={0} max={180} value={theta} style={{ accentColor: ACC, width: "100%" }} onChange={e => setTheta(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Azimuthal phi</span><span style={{ color: ACC }}>{phi} deg</span>
            </label>
            <input type="range" min={0} max={360} value={phi} style={{ accentColor: ACC, width: "100%" }} onChange={e => setPhi(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <KPICard label="P(|0>)" value={`${(p0*100).toFixed(1)}%`} color={ACC} />
          <KPICard label="P(|1>)" value={`${(p1*100).toFixed(1)}%`} color="#f43f5e" />
          <KPICard label="Coherence" value={coherence.toFixed(3)} color="#94a3b8" />
          <KPICard label="Bloch z" value={bz.toFixed(3)} color={bz > 0 ? "#10b981" : "#f59e0b"} />
        </div>
        <InsightBox accent={ACC}>
          |psi&gt; = cos(t/2)|0&gt; + exp(i*phi)sin(t/2)|1&gt;. Bloch vector: ({bx.toFixed(2)}, {by.toFixed(2)}, {bz.toFixed(2)}).{" "}
          P(|0&gt;) = cos^2(t/2) = <strong style={{ color: ACC }}>{(p0*100).toFixed(1)}%</strong>.{" "}
          Coherence = |sin(t)|/2 = <strong style={{ color: ACC }}>{coherence.toFixed(3)}</strong>.
        </InsightBox>
      </div>
    </div>
  );
}


// ─── 10. Biotech — Bioreactor (Monod) ────────────────────────────────────────
function BiotechTwinDemo() {
  const ACC = "#10b981";
  const [D, setD] = useState(0.35);
  const [S0, setS0] = useState(10);
  const [tick, setTick] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(20).fill(50));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const noise = () => (Math.random() - 0.5) * 2;
      setBars(Array.from({ length: 20 }, (_, i) => {
        const d_i = 0.05 + i * 0.035;
        const { X } = biotechMetrics(d_i, S0);
        return Math.max(2, Math.min(95, (X / (0.5 * S0)) * 88 + noise()));
      }));
      setTick(t => t + 1);
    }, 1400);
    return () => clearInterval(id);
  }, [S0]);

  const { X, S: S_star, productivity, washout } = biotechMetrics(D, S0);
  const wColor = washout ? "#f43f5e" : X > 3 ? "#10b981" : "#f59e0b";

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawBiotechScene(ctx, cv.width, cv.height, D, X, washout, tick);
  }, [D, S0, X, washout, tick]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="Chemostat — Biomass vs Dilution Rate" sub="Monod kinetics · mu_max=0.8/h · Ks=0.2 g/L · Y=0.5" tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <BarChart bars={bars} accent={ACC} />
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>D=0.05/h</span><span>biomass X vs dilution rate D</span><span>D=0.75/h</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Dilution Rate D</span><span style={{ color: ACC }}>{D.toFixed(2)} /h</span>
            </label>
            <input type="range" min={0.05} max={0.75} step={0.01} value={D} style={{ accentColor: ACC, width: "100%" }} onChange={e => setD(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Feed Substrate S0</span><span style={{ color: ACC }}>{S0} g/L</span>
            </label>
            <input type="range" min={1} max={20} value={S0} style={{ accentColor: ACC, width: "100%" }} onChange={e => setS0(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="Biomass X" value={`${X.toFixed(2)} g/L`} color={wColor} sub={washout ? "washout!" : ""} />
          <KPICard label="Residual S*" value={`${S_star.toFixed(3)} g/L`} color="#94a3b8" />
          <KPICard label="Productivity D*X" value={`${productivity.toFixed(3)} g/L/h`} color={ACC} />
        </div>
        <InsightBox accent={ACC}>
          Monod: mu = mu_max*S/(Ks+S). S* = Ks*D/(mu_max-D) = <strong style={{ color: ACC }}>{S_star.toFixed(3)} g/L</strong>,{" "}
          X* = Y(S0-S*) = <strong style={{ color: wColor }}>{X.toFixed(2)} g/L</strong>.
          Washout at D &gt;= mu_max = 0.8/h.
        </InsightBox>
      </div>
    </div>
  );
}

// ─── 11. Nanotech — Quantum Dot (Brus equation, CdSe) ────────────────────────
function NanotechTwinDemo() {
  const ACC = "#67e8f9";
  const [rNm, setRNm] = useState(3.5);
  const [tick, setTick] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(20).fill(50));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const noise = () => (Math.random() - 0.5) * 2;
      const Eg_min = nanotechMetrics(10).Eg_eV;
      const Eg_max = nanotechMetrics(1).Eg_eV;
      setBars(Array.from({ length: 20 }, (_, i) => {
        const r_i = 1 + i * 0.45;
        const { Eg_eV } = nanotechMetrics(r_i);
        return Math.max(3, Math.min(95, ((Eg_eV - Eg_min) / (Eg_max - Eg_min)) * 88 + noise()));
      }));
      setTick(t => t + 1);
    }, 1600);
    return () => clearInterval(id);
  }, []);

  const { confinement_eV, Eg_eV, lambdaNm, color } = nanotechMetrics(rNm);

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawNanotechScene(ctx, cv.width, cv.height, rNm, color, lambdaNm);
  }, [rNm, color, lambdaNm]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="CdSe Quantum Dot — Size-Tunable Bandgap" sub="Brus equation · particle-in-a-sphere · Eg_bulk=1.74 eV" tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <BarChart bars={bars} accent={ACC} />
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>r=1nm (UV)</span><span>bandgap energy Eg(r)</span><span>r=10nm (red)</span>
        </div>
        <div className="mb-5">
          <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
            <span>Particle Radius r</span><span style={{ color: ACC }}>{rNm.toFixed(1)} nm</span>
          </label>
          <input type="range" min={1} max={10} step={0.1} value={rNm} style={{ accentColor: ACC, width: "100%" }} onChange={e => setRNm(+e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="Confinement Energy" value={`${confinement_eV.toFixed(3)} eV`} color={ACC} />
          <KPICard label="Total Bandgap" value={`${Eg_eV.toFixed(3)} eV`} color={ACC} />
          <KPICard label="Emission" value={`${lambdaNm.toFixed(0)} nm`} color={color} sub="dot color below" />
        </div>
        <div className="mt-3 rounded-xl h-5 flex items-center justify-center text-[10px] font-semibold"
          style={{ background: color, color: lambdaNm < 500 ? "#fff" : "#000" }}>
          {lambdaNm.toFixed(0)} nm emission
        </div>
        <InsightBox accent={ACC}>
          Brus: Eg(r) = Eg_bulk + hbar^2*pi^2/(2*m_eff*r^2).
          At r={rNm.toFixed(1)}nm: dE_conf = <strong style={{ color: ACC }}>{confinement_eV.toFixed(3)} eV</strong>,
          Eg = <strong style={{ color: ACC }}>{Eg_eV.toFixed(3)} eV</strong>,
          lambda = <strong style={{ color }}>{lambdaNm.toFixed(0)} nm</strong>. Smaller dots shift emission blue.
        </InsightBox>
      </div>
    </div>
  );
}

// ─── 12. Health — Pharmacokinetics ───────────────────────────────────────────
function HealthTwinDemo() {
  const ACC = "#f43f5e";
  const [dose, setDose] = useState(500);
  const [halfLife, setHalfLife] = useState(6);
  const [tick, setTick] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(20).fill(50));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const { Cmax, kel } = healthMetrics(dose, halfLife);
      const noise = () => (Math.random() - 0.5) * 1.5;
      setBars(Array.from({ length: 20 }, (_, i) => {
        const t = i * halfLife * 0.3;
        const C = Cmax * Math.exp(-kel * t);
        return Math.max(2, Math.min(95, (C / Cmax) * 88 + noise()));
      }));
      setTick(t => t + 1);
    }, 1300);
    return () => clearInterval(id);
  }, [dose, halfLife]);

  const { Cmax, AUC, tMIC } = healthMetrics(dose, halfLife);
  const MIC = 0.5;
  const safeColor = Cmax > MIC * 4 ? "#10b981" : Cmax > MIC ? "#f59e0b" : "#f43f5e";

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawHealthScene(ctx, cv.width, cv.height, Cmax, halfLife, tick);
  }, [dose, halfLife, Cmax, tick]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="Pharmacokinetics — Concentration-Time Curve" sub="1-compartment model · Vd=35L · F=80% bioavailability" tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <BarChart bars={bars} accent={ACC} />
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>t=0</span><span>plasma concentration C(t)</span><span>~6 half-lives</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Dose</span><span style={{ color: ACC }}>{dose} mg</span>
            </label>
            <input type="range" min={50} max={2000} step={50} value={dose} style={{ accentColor: ACC, width: "100%" }} onChange={e => setDose(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Half-life t(1/2)</span><span style={{ color: ACC }}>{halfLife} h</span>
            </label>
            <input type="range" min={0.5} max={48} step={0.5} value={halfLife} style={{ accentColor: ACC, width: "100%" }} onChange={e => setHalfLife(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="Peak Cmax" value={`${Cmax.toFixed(2)} mg/L`} color={safeColor} sub={Cmax > MIC ? "above MIC" : "sub-MIC"} />
          <KPICard label="AUC" value={`${AUC.toFixed(1)} mg*h/L`} color={ACC} />
          <KPICard label="Time above MIC" value={`${tMIC.toFixed(1)} h`} color="#94a3b8" />
        </div>
        <InsightBox accent={ACC}>
          C(t) = (F*D/Vd)*exp(-kel*t). kel = 0.693/t(1/2) = <strong style={{ color: ACC }}>{(0.693/halfLife).toFixed(3)} /h</strong>.{" "}
          Cmax = F*D/Vd = 0.8*{dose}/35 = <strong style={{ color: safeColor }}>{Cmax.toFixed(2)} mg/L</strong>.{" "}
          AUC = Cmax/kel = <strong style={{ color: ACC }}>{AUC.toFixed(1)} mg*h/L</strong>.
        </InsightBox>
      </div>
    </div>
  );
}


// ─── 13. Aerospace — Keplerian Orbit ─────────────────────────────────────────
function AerospaceTwinDemo() {
  const ACC = "#60a5fa";
  const [alt, setAlt] = useState(400);
  const [ecc, setEcc] = useState(0.1);
  const [tick, setTick] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(20).fill(50));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const { a } = aerospaceMetrics(alt, ecc);
      const R_e = 6371e3;
      const noise = () => (Math.random() - 0.5) * 2;
      setBars(Array.from({ length: 20 }, (_, i) => {
        const nu = (i / 19) * 2 * Math.PI;
        const r_i = ecc > 0 ? a*(1-ecc*ecc)/(1+ecc*Math.cos(nu)) : a;
        const h_i = (r_i - R_e) / 1000;
        const h_max = alt*(1+ecc);
        return Math.max(5, Math.min(93, (h_i/h_max)*85 + noise()));
      }));
      setTick(t => t + 1);
    }, 1300);
    return () => clearInterval(id);
  }, [alt, ecc]);

  const { v_circ, T_min, hp, ha } = aerospaceMetrics(alt, ecc);
  const T_str = T_min >= 60 ? `${(T_min/60).toFixed(2)} hr` : `${T_min.toFixed(1)} min`;

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawAerospaceScene(ctx, cv.width, cv.height, alt, ecc, tick);
  }, [alt, ecc, tick]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="Keplerian Orbit — Altitude vs True Anomaly" sub="GM=3.986e14 m3/s2 · R_earth=6371 km" tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <BarChart bars={bars} accent={ACC} />
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>nu=0 (periapsis)</span><span>orbital altitude</span><span>nu=360</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Semi-major Altitude</span><span style={{ color: ACC }}>{alt} km</span>
            </label>
            <input type="range" min={200} max={42000} step={100} value={alt} style={{ accentColor: ACC, width: "100%" }} onChange={e => setAlt(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Eccentricity e</span><span style={{ color: ACC }}>{ecc.toFixed(2)}</span>
            </label>
            <input type="range" min={0} max={0.85} step={0.01} value={ecc} style={{ accentColor: ACC, width: "100%" }} onChange={e => setEcc(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <KPICard label="Orbital Velocity" value={`${v_circ.toFixed(2)} km/s`} color={ACC} />
          <KPICard label="Period T" value={T_str} color={ACC} />
          <KPICard label="Periapsis hp" value={`${hp.toFixed(0)} km`} color="#94a3b8" />
          <KPICard label="Apoapsis ha" value={`${ha.toFixed(0)} km`} color="#94a3b8" />
        </div>
        <InsightBox accent={ACC}>
          Kepler III: T = 2*pi*sqrt(a^3/GM). v = sqrt(GM/a) = <strong style={{ color: ACC }}>{v_circ.toFixed(2)} km/s</strong>.{" "}
          T = <strong style={{ color: ACC }}>{T_str}</strong>. Altitude: {hp.toFixed(0)} km (periapsis) to {ha.toFixed(0)} km (apoapsis).
          r(nu) = a*(1-e^2)/(1+e*cos(nu)).
        </InsightBox>
      </div>
    </div>
  );
}

// ─── 14. Defense — Projectile Trajectory ─────────────────────────────────────
function DefenseTwinDemo() {
  const ACC = "#94a3b8";
  const [v0, setV0] = useState(500);
  const [angle, setAngle] = useState(45);
  const [tick, setTick] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(20).fill(50));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const theta = angle * Math.PI / 180;
      const g = 9.81, drag = 0.75;
      const Rmax = (v0*v0*Math.sin(2*theta))/g*drag;
      const noise = () => (Math.random() - 0.5) * 1.5;
      setBars(Array.from({ length: 20 }, (_, i) => {
        const x = (i/19)*Rmax;
        const y = x*Math.tan(theta) - (g*x*x)/(2*v0*v0*Math.pow(Math.cos(theta),2));
        const hMax = (v0*v0*Math.pow(Math.sin(theta),2))/(2*g)*0.85;
        return Math.max(2, Math.min(93, (Math.max(0,y)/hMax)*85 + noise()));
      }));
      setTick(t => t + 1);
    }, 1400);
    return () => clearInterval(id);
  }, [v0, angle]);

  const { range_km, hMax_km, tof_s } = defenseMetrics(v0, angle);

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawDefenseScene(ctx, cv.width, cv.height, angle, range_km, hMax_km, tick);
  }, [v0, angle, range_km, hMax_km, tick]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="Projectile Trajectory — Height Profile" sub="Vacuum model with 25% drag reduction correction" tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <BarChart bars={bars} accent={ACC} />
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>Launch</span><span>trajectory height y(x)</span><span>Impact</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Muzzle Velocity v0</span><span style={{ color: ACC }}>{v0} m/s</span>
            </label>
            <input type="range" min={50} max={1500} step={25} value={v0} style={{ accentColor: ACC, width: "100%" }} onChange={e => setV0(+e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Launch Angle theta</span><span style={{ color: ACC }}>{angle} deg</span>
            </label>
            <input type="range" min={5} max={85} value={angle} style={{ accentColor: ACC, width: "100%" }} onChange={e => setAngle(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="Range" value={`${range_km.toFixed(2)} km`} color={ACC} />
          <KPICard label="Max Altitude" value={`${hMax_km.toFixed(2)} km`} color={ACC} />
          <KPICard label="Time of Flight" value={`${tof_s.toFixed(1)} s`} color="#94a3b8" />
        </div>
        <InsightBox accent={ACC}>
          R = v0^2*sin(2*theta)/g * 0.75 = <strong style={{ color: ACC }}>{range_km.toFixed(2)} km</strong>.{" "}
          H_max = v0^2*sin^2(theta)/(2g) * 0.85 = <strong style={{ color: ACC }}>{hMax_km.toFixed(2)} km</strong>.{" "}
          Optimal range at theta=45 deg. Drag factor reduces range ~25%.
        </InsightBox>
      </div>
    </div>
  );
}

// ─── 15. Mathematics — Logistic Map (Chaos) ──────────────────────────────────
function MathematicsTwinDemo() {
  const ACC = "#fb7185";
  const [r, setR] = useState(3.7);
  const [x0, setX0] = useState(0.4);
  const [tick, setTick] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(20).fill(50));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setTick(prev => {
        const newTick = prev + 1;
        const { series } = chaosMetrics(r, (x0 + newTick * 0.0001) % 0.98 + 0.01);
        setBars(series.map(v => Math.max(3, Math.min(95, v * 90 + 3))));
        return newTick;
      });
    }, 300);
    return () => clearInterval(id);
  }, [r, x0]);

  const { lyapunov, period, chaos } = chaosMetrics(r, x0);
  const lyaColor = chaos ? "#f43f5e" : "#10b981";
  const behaviorLabel = chaos ? "chaos" : period === 1 ? "fixed point" : period > 0 ? `period-${period}` : "converging";

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    drawMathScene(ctx, cv.width, cv.height, r, x0, chaos, tick);
  }, [r, x0, chaos, tick]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-surface)", border: `1px solid ${ACC}25` }}>
      <div className="px-6 pt-6 pb-6">
        <LiveHeader accent={ACC} title="Logistic Map — Bifurcation and Chaos" sub="x_(n+1) = r * x_n * (1 - x_n)" tick={tick} />
        <canvas ref={canvasRef} width={800} height={320} style={{ width: "100%", height: 160, borderRadius: 10, marginBottom: 10, display: "block" }} />
        <BarChart bars={bars} accent={ACC} />
        <div className="flex justify-between text-[9px] mt-1 mb-5 px-1" style={{ color: "#334155" }}>
          <span>iteration n</span><span>last 20 values of x_n</span><span>n+19</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Growth rate r</span><span style={{ color: ACC }}>{r.toFixed(2)}</span>
            </label>
            <input type="range" min={2.5} max={4.0} step={0.01} value={r} style={{ accentColor: ACC, width: "100%" }} onChange={e => setR(+e.target.value)} />
            <div className="flex justify-between text-[9px] mt-0.5" style={{ color: "#334155" }}>
              <span>stable</span><span>period-2</span><span>period-4</span><span>chaos</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold flex justify-between mb-1.5" style={{ color: "#94a3b8" }}>
              <span>Initial condition x0</span><span style={{ color: ACC }}>{x0.toFixed(2)}</span>
            </label>
            <input type="range" min={0.01} max={0.99} step={0.01} value={x0} style={{ accentColor: ACC, width: "100%" }} onChange={e => setX0(+e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <KPICard label="Behavior" value={behaviorLabel} color={lyaColor} />
          <KPICard label="Lyapunov" value={lyapunov.toFixed(3)} color={lyaColor} sub={chaos ? "lambda>0: chaos" : "lambda<0: stable"} />
          <KPICard label="Period" value={period === 0 ? "inf" : String(period)} color="#94a3b8" sub={chaos ? "aperiodic" : undefined} />
        </div>
        <InsightBox accent={ACC}>
          x_(n+1) = r*x_n*(1-x_n). Lyapunov: lambda = (1/N)*sum(ln|r-2r*x_n|) = <strong style={{ color: lyaColor }}>{lyapunov.toFixed(3)}</strong>.{" "}
          lambda &gt; 0 means chaos. Try r~3.57 for period-doubling cascade.
        </InsightBox>
      </div>
    </div>
  );
}

// ─── Category registry ────────────────────────────────────────────────────────

type TabId = "traffic"|"power"|"supply"|"mechanical"|"electrical"|"electronic"|
             "chemical"|"civil"|"quantum"|"biotech"|"nanotech"|"health"|
             "aerospace"|"defense"|"mathematics";

interface CatDef {
  id: TabId;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
  Comp: React.ComponentType;
}

const CATEGORIES: CatDef[] = [
  { id: "traffic",     label: "Traffic",      Icon: Car,         color: "#f59e0b", Comp: TrafficTwinDemo },
  { id: "power",       label: "Power Grid",   Icon: Power,       color: "#22d3ee", Comp: PowerGridTwinDemo },
  { id: "supply",      label: "Supply Chain", Icon: Package,     color: "#8b5cf6", Comp: SupplyChainTwinDemo },
  { id: "mechanical",  label: "Mechanical",   Icon: Settings,    color: "#f97316", Comp: MechanicalTwinDemo },
  { id: "electrical",  label: "Electrical",   Icon: Zap,         color: "#eab308", Comp: ElectricalTwinDemo },
  { id: "electronic",  label: "Electronic",   Icon: Cpu,         color: "#06b6d4", Comp: ElectronicTwinDemo },
  { id: "chemical",    label: "Chemical",     Icon: FlaskConical,color: "#84cc16", Comp: ChemicalTwinDemo },
  { id: "civil",       label: "Civil",        Icon: Building2,   color: "#6366f1", Comp: CivilTwinDemo },
  { id: "quantum",     label: "Quantum",      Icon: Atom,        color: "#a78bfa", Comp: QuantumTwinDemo },
  { id: "biotech",     label: "Biotech",      Icon: Dna,         color: "#10b981", Comp: BiotechTwinDemo },
  { id: "nanotech",    label: "Nanotech",     Icon: Microscope,  color: "#67e8f9", Comp: NanotechTwinDemo },
  { id: "health",      label: "Health",       Icon: Heart,       color: "#f43f5e", Comp: HealthTwinDemo },
  { id: "aerospace",   label: "Aerospace",    Icon: Rocket,      color: "#60a5fa", Comp: AerospaceTwinDemo },
  { id: "defense",     label: "Defense",      Icon: Shield,      color: "#94a3b8", Comp: DefenseTwinDemo },
  { id: "mathematics", label: "Mathematics",  Icon: Calculator,  color: "#fb7185", Comp: MathematicsTwinDemo },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DigitalTwinPage() {
  const [tab, setTab] = useState<TabId>("traffic");
  const active = CATEGORIES.find(c => c.id === tab)!;
  const ActiveComp = active.Comp;

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-base, #0b0f1a)" }}>
      <div className="mb-5">
        <h1 className="text-xl font-bold mb-0.5" style={{ color: "#f1f5f9" }}>Digital Twin Simulator</h1>
        <p className="text-xs" style={{ color: "#475569" }}>
          15 live physics-based models — each with animated physical scene and mathematical simulation
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6" style={{ scrollbarWidth: "none" }}>
        {CATEGORIES.map(cat => {
          const CatIcon = cat.Icon;
          const isActive = tab === cat.id;
          return (
            <button key={cat.id} onClick={() => setTab(cat.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all hover:scale-[1.03]"
              style={{
                background: isActive ? `${cat.color}22` : "rgba(255,255,255,0.04)",
                border: `1px solid ${isActive ? cat.color : "rgba(255,255,255,0.08)"}`,
                color: isActive ? cat.color : "#475569",
              }}>
              <CatIcon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>
      <ActiveComp />
    </div>
  );
}
