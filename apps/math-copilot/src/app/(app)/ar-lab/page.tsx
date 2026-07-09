"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Scan, Lock, ArrowRight, Zap, Glasses, Hand, Volume2, Camera, Layers, Share2, X, CameraOff, Wifi } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";

const ACCENT = "#f43f5e";

// ── Polyhedra definitions ─────────────────────────────────────────────────────

type Vec3 = [number, number, number];

const SHAPES = {
  cube: {
    label: "Cube",
    vertices: [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1,  1], [1, -1,  1], [1, 1,  1], [-1, 1,  1],
    ] as Vec3[],
    edges: [
      [0,1],[1,2],[2,3],[3,0],  // back face
      [4,5],[5,6],[6,7],[7,4],  // front face
      [0,4],[1,5],[2,6],[3,7],  // connecting edges
    ],
    V: 8, E: 12, F: 6,
    formula: "4 sides per face, 6 faces",
  },
  tetrahedron: {
    label: "Tetrahedron",
    vertices: [
      [ 0,  1.2,  0],
      [ 1, -0.6, -0.6],
      [-1, -0.6, -0.6],
      [ 0, -0.6,  1.1],
    ] as Vec3[],
    edges: [[0,1],[0,2],[0,3],[1,2],[2,3],[3,1]],
    V: 4, E: 6, F: 4,
    formula: "Simplest convex polyhedron",
  },
  octahedron: {
    label: "Octahedron",
    vertices: [
      [ 0,  1.3,  0],
      [ 0, -1.3,  0],
      [ 1,  0,    0],
      [-1,  0,    0],
      [ 0,  0,    1],
      [ 0,  0,   -1],
    ] as Vec3[],
    edges: [
      [0,2],[0,3],[0,4],[0,5],
      [1,2],[1,3],[1,4],[1,5],
      [2,4],[4,3],[3,5],[5,2],
    ],
    V: 6, E: 12, F: 8,
    formula: "Dual of the cube",
  },
} as const;

type ShapeKey = keyof typeof SHAPES;

// ── 3D math helpers ───────────────────────────────────────────────────────────

function rotX(v: Vec3, θ: number): Vec3 {
  return [v[0], v[1] * Math.cos(θ) - v[2] * Math.sin(θ), v[1] * Math.sin(θ) + v[2] * Math.cos(θ)];
}
function rotY(v: Vec3, φ: number): Vec3 {
  return [v[0] * Math.cos(φ) + v[2] * Math.sin(φ), v[1], -v[0] * Math.sin(φ) + v[2] * Math.cos(φ)];
}

// ── Canvas 3D explorer ────────────────────────────────────────────────────────

function GeometryExplorer3D({ isPro, isAdmin }: { isPro: boolean; isAdmin: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shape, setShape] = useState<ShapeKey>("cube");
  const angleRef = useRef({ x: 0.35, y: 0.0 });
  const rafRef = useRef<number>(0);
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const scale = 85;

    // Mouse drag handlers
    const onDown = (e: MouseEvent) => {
      dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    };
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      angleRef.current.y += (e.clientX - dragRef.current.lastX) * 0.012;
      angleRef.current.x += (e.clientY - dragRef.current.lastY) * 0.012;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
    };
    const onUp = () => { dragRef.current.active = false; };

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    const draw = () => {
      // Auto-rotate when not dragging
      if (!dragRef.current.active) {
        angleRef.current.y += 0.007;
      }

      ctx.clearRect(0, 0, W, H);

      const s = SHAPES[shape];

      // Project all vertices
      const projected = s.vertices.map((v) => {
        const r = rotY(rotX(v, angleRef.current.x), angleRef.current.y);
        return { px: cx + r[0] * scale, py: cy - r[1] * scale, z: r[2] };
      });

      // Draw edges (sorted back-to-front for depth)
      const edgesWithDepth = s.edges.map(([a, b]) => ({
        a, b,
        depth: (projected[a].z + projected[b].z) / 2,
      }));
      edgesWithDepth.sort((a, b) => a.depth - b.depth);

      edgesWithDepth.forEach(({ a, b, depth }) => {
        const va = projected[a], vb = projected[b];
        const t = (depth + 1.5) / 3; // normalise roughly 0..1
        const alpha = 0.20 + t * 0.75;
        const width = 0.8 + t * 1.4;

        ctx.beginPath();
        ctx.moveTo(va.px, va.py);
        ctx.lineTo(vb.px, vb.py);
        ctx.strokeStyle = `rgba(244,63,94,${alpha.toFixed(2)})`;
        ctx.lineWidth = width;
        ctx.stroke();
      });

      // Draw vertices
      projected.forEach(({ px, py, z }) => {
        const t = (z + 1.5) / 3;
        const r = 2.5 + t * 2.5;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(244,63,94,${(0.45 + t * 0.50).toFixed(2)})`;
        ctx.fill();
        // glow
        ctx.beginPath();
        ctx.arc(px, py, r + 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(244,63,94,${(0.06 + t * 0.08).toFixed(2)})`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [shape]);

  const s = SHAPES[shape];
  const euler = s.V - s.E + s.F;

  return (
    <div className="rounded-2xl overflow-hidden mb-10"
      style={{ background: "var(--bg-surface)", border: `1px solid ${ACCENT}25` }}>

      {/* shape selector */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest mr-1" style={{ color: "#334155" }}>Shape:</span>
        {(Object.keys(SHAPES) as ShapeKey[]).map(k => (
          <button key={k} onClick={() => setShape(k)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{
              background: shape === k ? `${ACCENT}20` : "rgba(255,255,255,0.04)",
              border: shape === k ? `1px solid ${ACCENT}50` : "1px solid rgba(255,255,255,0.08)",
              color: shape === k ? ACCENT : "#475569",
              transition: "all 0.15s",
            }}>
            {SHAPES[k].label}
          </button>
        ))}
        <span className="ml-auto text-[10px]" style={{ color: "#334155" }}>Drag to rotate</span>
      </div>

      {/* canvas */}
      <div className="relative flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #0d0015 0%, #140520 50%, #0d001a 100%)", minHeight: "220px" }}>
        {/* perspective grid overlay */}
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(${ACCENT}50 1px, transparent 1px), linear-gradient(90deg, ${ACCENT}50 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
            transform: "perspective(300px) rotateX(35deg)",
            transformOrigin: "bottom center",
          }} />
        <canvas
          ref={canvasRef}
          width={560}
          height={220}
          style={{ width: "100%", maxWidth: "560px", height: "220px", cursor: "grab", position: "relative", zIndex: 1 }}
        />
      </div>

      {/* Euler's formula display */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-4 flex-wrap mb-3">
          {/* V */}
          <div className="text-center px-4 py-2 rounded-xl"
            style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}20` }}>
            <div className="text-2xl font-bold" style={{ color: ACCENT }}>{s.V}</div>
            <div className="text-[10px]" style={{ color: "#64748b" }}>Vertices</div>
          </div>
          <div className="text-lg font-bold" style={{ color: "#334155" }}>−</div>
          {/* E */}
          <div className="text-center px-4 py-2 rounded-xl"
            style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}20` }}>
            <div className="text-2xl font-bold" style={{ color: ACCENT }}>{s.E}</div>
            <div className="text-[10px]" style={{ color: "#64748b" }}>Edges</div>
          </div>
          <div className="text-lg font-bold" style={{ color: "#334155" }}>+</div>
          {/* F */}
          <div className="text-center px-4 py-2 rounded-xl"
            style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}20` }}>
            <div className="text-2xl font-bold" style={{ color: ACCENT }}>{s.F}</div>
            <div className="text-[10px]" style={{ color: "#64748b" }}>Faces</div>
          </div>
          <div className="text-lg font-bold" style={{ color: "#334155" }}>=</div>
          {/* result */}
          <div className="text-center px-4 py-2 rounded-xl"
            style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <div className="text-2xl font-bold" style={{ color: "#10b981" }}>{euler}</div>
            <div className="text-[10px]" style={{ color: "#64748b" }}>χ (Euler)</div>
          </div>
          <div className="flex-1 min-w-48 text-xs leading-relaxed" style={{ color: "#475569" }}>
            <strong style={{ color: "#94a3b8" }}>Euler's Characteristic:</strong>{" "}
            V − E + F = 2 holds for every convex polyhedron. {s.formula}.
          </div>
        </div>

      </div>
    </div>
  );
}

// ── AR Camera Overlay (WebXR → Camera fallback) ───────────────────────────────

type ARMode = "cube" | "wave" | "molecule" | "stats" | "matrix";

const AR_MODES: Array<{ key: ARMode; emoji: string; label: string }> = [
  { key: "cube",     emoji: "🧊", label: "3D Shape" },
  { key: "wave",     emoji: "🌊", label: "Waves" },
  { key: "molecule", emoji: "🔬", label: "Molecule" },
  { key: "stats",    emoji: "📊", label: "Stats" },
  { key: "matrix",   emoji: "🧮", label: "Matrix" },
];

function inferMode(experience: string): ARMode {
  const e = experience.toLowerCase();
  if (e.includes("wave") || e.includes("interference")) return "wave";
  if (e.includes("molecular") || e.includes("geometry"))  return "molecule";
  if (e.includes("statistic") || e.includes("landscape")) return "stats";
  if (e.includes("linear") || e.includes("algebra"))      return "matrix";
  return "cube";
}

// draw functions – each receives (ctx, canvasWidth, canvasHeight, tick)

function drawCube(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  type V3 = [number,number,number];
  const rotX = ([x,y,z]: V3, a: number): V3 => [x, y*Math.cos(a)-z*Math.sin(a), y*Math.sin(a)+z*Math.cos(a)];
  const rotY = ([x,y,z]: V3, a: number): V3 => [x*Math.cos(a)+z*Math.sin(a), y, -x*Math.sin(a)+z*Math.cos(a)];
  const raw: V3[] = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const cx=w/2, cy=h/2, sc=Math.min(w,h)*0.22;
  const project = (v: V3) => { const r=rotY(rotX(v,0.3),t*0.018); const z=4+r[2]; return { px:cx+(r[0]/z)*sc, py:cy-(r[1]/z)*sc, z:r[2] }; };
  const proj = raw.map(project);
  const ed = edges.map(([a,b])=>({ a,b,depth:(proj[a].z+proj[b].z)/2 })).sort((a,b)=>a.depth-b.depth);
  ctx.save();
  ed.forEach(({a,b,depth})=>{
    const al = 0.25+((depth+1.5)/3)*0.70;
    ctx.beginPath(); ctx.moveTo(proj[a].px,proj[a].py); ctx.lineTo(proj[b].px,proj[b].py);
    ctx.strokeStyle=`rgba(244,63,94,${al.toFixed(2)})`; ctx.lineWidth=1.8; ctx.shadowColor="#f43f5e"; ctx.shadowBlur=8; ctx.stroke();
  });
  proj.forEach(({px,py,z})=>{
    const al=0.5+((z+1.5)/3)*0.45; const r=2.5+((z+1.5)/3)*2.5;
    ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fillStyle=`rgba(244,63,94,${al})`; ctx.fill();
  });
  ctx.restore();
  ctx.fillStyle="rgba(255,255,255,0.85)"; ctx.font="bold 13px sans-serif"; ctx.textAlign="center";
  ctx.fillText("V − E + F = 2  (Euler’s polyhedron formula)", w/2, h-54);
}

function drawWave(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const s1={x:w*0.35,y:h*0.5}, s2={x:w*0.65,y:h*0.5};
  const wl=75, maxR=Math.sqrt(w*w+h*h), offset=(t*2.2)%wl;
  [{src:s1,color:"34,211,238"},{src:s2,color:"244,63,94"}].forEach(({src,color})=>{
    for (let r=offset; r<maxR; r+=wl) {
      const alpha=Math.max(0,0.75-r/maxR);
      ctx.beginPath(); ctx.arc(src.x,src.y,r,0,Math.PI*2);
      ctx.strokeStyle=`rgba(${color},${alpha.toFixed(2)})`; ctx.lineWidth=1.5; ctx.stroke();
    }
  });
  [s1,s2].forEach((s,i)=>{
    ctx.beginPath(); ctx.arc(s.x,s.y,10,0,Math.PI*2);
    ctx.fillStyle=i===0?"#22d3ee":"#f43f5e"; ctx.fill();
    ctx.fillStyle="#fff"; ctx.font="bold 13px sans-serif"; ctx.textAlign="center";
    ctx.fillText(`S${i+1}`,s.x,s.y+4);
  });
  ctx.fillStyle="rgba(255,255,255,0.85)"; ctx.font="bold 13px sans-serif"; ctx.textAlign="center";
  ctx.fillText("Wave Interference — rings meet at constructive nodes", w/2, h-54);
}

function drawMolecule(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  type V3=[number,number,number];
  const cx=w/2, cy=h/2, a=t*0.014;
  const rotY=([x,y,z]:V3):V3=>[x*Math.cos(a)+z*Math.sin(a),y,-x*Math.sin(a)+z*Math.cos(a)];
  const proj=([x,y,z]:V3)=>{ const d=320,s=d/(d+z+10); return {x:cx+x*s,y:cy+y*s,z,s}; };
  const bL=90, bA=104.5*Math.PI/180;
  const atoms:[V3,string,string,number][]=[
    [[0,0,0],"#ef4444","O",20],
    [[bL*Math.sin(bA/2),-bL*Math.cos(bA/2),0],"#e2e8f0","H",12],
    [[-bL*Math.sin(bA/2),-bL*Math.cos(bA/2),0],"#e2e8f0","H",12],
  ];
  const rendered=atoms.map(([pos,color,label,r])=>({p:proj(rotY(pos)),color,label,r})).sort((a,b)=>b.p.z-a.p.z);
  const oP=proj(rotY([0,0,0]));
  rendered.forEach(at=>{
    if (at.label!=="O"){
      ctx.beginPath(); ctx.moveTo(oP.x,oP.y); ctx.lineTo(at.p.x,at.p.y);
      ctx.strokeStyle="rgba(255,255,255,0.55)"; ctx.lineWidth=4; ctx.stroke();
    }
  });
  rendered.forEach(at=>{
    const r=at.r*at.p.s;
    ctx.beginPath(); ctx.arc(at.p.x,at.p.y,r,0,Math.PI*2);
    ctx.fillStyle=at.color; ctx.shadowColor=at.color; ctx.shadowBlur=12; ctx.fill(); ctx.shadowBlur=0;
    ctx.fillStyle="#fff"; ctx.font=`bold ${Math.round(11*at.p.s)}px sans-serif`; ctx.textAlign="center";
    ctx.fillText(at.label,at.p.x,at.p.y+4);
  });
  ctx.fillStyle="rgba(255,255,255,0.85)"; ctx.font="bold 13px sans-serif"; ctx.textAlign="center";
  ctx.fillText("H₂O — Bond Angle 104.5°  ·  VSEPR bent geometry", w/2, h-54);
}

function drawStats(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx=w/2, cy=h*0.62, sigma=70+Math.sin(t*0.025)*22, amp=140;
  const gauss=(x:number)=>cy-amp*Math.exp(-0.5*((x-cx)/sigma)**2);
  const pts:Array<[number,number]>=[];
  for (let x=0; x<=w; x+=2) pts.push([x,gauss(x)]);
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  pts.forEach(([x,y])=>ctx.lineTo(x,y));
  ctx.lineTo(w,cy); ctx.lineTo(0,cy); ctx.closePath();
  ctx.fillStyle="rgba(34,211,238,0.12)"; ctx.fill();
  ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
  pts.forEach(([x,y])=>ctx.lineTo(x,y));
  ctx.strokeStyle="#22d3ee"; ctx.lineWidth=2.5; ctx.stroke();
  [-2,-1,0,1,2].forEach(n=>{
    const x=cx+n*sigma, y=gauss(x);
    ctx.save(); ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,cy);
    ctx.strokeStyle=n===0?"#f59e0b":"rgba(244,63,94,0.65)";
    ctx.lineWidth=n===0?2.5:1.5; if(n!==0)ctx.setLineDash([4,4]);
    ctx.stroke(); ctx.restore();
    ctx.fillStyle="#fff"; ctx.font="12px sans-serif"; ctx.textAlign="center";
    ctx.fillText(n===0?"μ":`${n>0?"+":""}${n}σ`,x,cy+18);
  });
  ctx.fillStyle="rgba(255,255,255,0.85)"; ctx.font="bold 13px sans-serif"; ctx.textAlign="center";
  ctx.fillText(`Normal Distribution  σ = ${sigma.toFixed(0)}  (68–95–99.7 rule)`, w/2, h-54);
}

function drawMatrix(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx=w/2, cy=h/2, sc=55;
  const phase=(t*0.018)%(Math.PI*4);
  let m00=1,m01=0,m10=0,m11=1;
  if (phase<Math.PI){ const s=Math.sin(phase); m01=s*0.9; }
  else { const th=(phase-Math.PI)/(Math.PI*3)*Math.PI*2; m00=Math.cos(th); m01=-Math.sin(th); m10=Math.sin(th); m11=Math.cos(th); }
  const tr=(x:number,y:number):[number,number]=>[cx+(m00*x+m01*y)*sc, cy-(m10*x+m11*y)*sc];
  ctx.save();
  for (let i=-5;i<=5;i++){
    const[ax,ay]=tr(i,-5),[bx,by]=tr(i,5);
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by);
    ctx.strokeStyle=i===0?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.10)"; ctx.lineWidth=i===0?1.5:0.8; ctx.stroke();
    const[cx2,cy2]=tr(-5,i),[dx,dy]=tr(5,i);
    ctx.beginPath(); ctx.moveTo(cx2,cy2); ctx.lineTo(dx,dy);
    ctx.strokeStyle=i===0?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.10)"; ctx.lineWidth=i===0?1.5:0.8; ctx.stroke();
  }
  const[e1x,e1y]=tr(1,0); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(e1x,e1y); ctx.strokeStyle="#f43f5e"; ctx.lineWidth=3; ctx.stroke();
  const[e2x,e2y]=tr(0,1); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(e2x,e2y); ctx.strokeStyle="#22d3ee"; ctx.lineWidth=3; ctx.stroke();
  ctx.restore();
  ctx.fillStyle="rgba(255,255,255,0.85)"; ctx.font="bold 12px monospace"; ctx.textAlign="left";
  ctx.fillText(`M = [ ${m00.toFixed(2)}  ${m01.toFixed(2)} ]`, 20, 30);
  ctx.fillText(`    [ ${m10.toFixed(2)}  ${m11.toFixed(2)} ]`, 20, 48);
  ctx.font="bold 13px sans-serif"; ctx.textAlign="center";
  ctx.fillText("Linear Transformation — basis vectors animate the matrix", w/2, h-54);
}

// ── Component ─────────────────────────────────────────────────────────────────

function ARCameraOverlay({ onClose, experience = "Free Explore" }: { onClose: () => void; experience?: string }) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number>(0);
  const tRef       = useRef(0);
  const [status, setStatus]     = useState<"init" | "active" | "error">("init");
  const [xrMode, setXrMode]     = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [mode, setMode] = useState<ARMode>(() => inferMode(experience));

  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    tRef.current += 1;
    const t = tRef.current;
    if (mode === "wave")     { drawWave(ctx, w, h, t);     return; }
    if (mode === "molecule") { drawMolecule(ctx, w, h, t); return; }
    if (mode === "stats")    { drawStats(ctx, w, h, t);    return; }
    if (mode === "matrix")   { drawMatrix(ctx, w, h, t);   return; }
    drawCube(ctx, w, h, t);
  }, [mode]);

  useEffect(() => {
    const tryWebXR = async () => {
      if (typeof navigator !== "undefined" && "xr" in navigator) {
        try {
          const supported = await (navigator as any).xr.isSessionSupported("immersive-ar");
          if (supported) {
            setXrMode(true); setStatus("active");
            const session = await (navigator as any).xr.requestSession("immersive-ar", { requiredFeatures: [] });
            session.addEventListener("end", () => { setStatus("init"); onClose(); });
            return;
          }
        } catch { /* fall through */ }
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        setStatus("active");
      } catch (err: any) { setErrorMsg(err?.message || "Camera access denied."); setStatus("error"); }
    };
    tryWebXR();
    return () => { cancelAnimationFrame(rafRef.current); streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [onClose]);

  useEffect(() => {
    if (status !== "active" || xrMode) return;
    const canvas = overlayRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const video = videoRef.current;
    const loop = () => {
      const cw=canvas.width, ch=canvas.height;
      ctx.clearRect(0,0,cw,ch);
      if (video && video.readyState >= 2) {
        ctx.drawImage(video,0,0,cw,ch);
        const grad=ctx.createRadialGradient(cw/2,ch/2,ch*0.35,cw/2,ch/2,ch*0.75);
        grad.addColorStop(0,"rgba(0,0,0,0)"); grad.addColorStop(1,"rgba(0,0,0,0.50)");
        ctx.fillStyle=grad; ctx.fillRect(0,0,cw,ch);
      } else { ctx.fillStyle="#05060f"; ctx.fillRect(0,0,cw,ch); }
      drawFrame(ctx, cw, ch);
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [status, xrMode, drawFrame]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.96)" }}>
      <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 rounded-full"
        style={{ background: "rgba(255,255,255,0.10)", color: "#94a3b8" }}>
        <X className="w-5 h-5" />
      </button>
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
        style={{ background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.25)", color: "#22d3ee" }}>
        {status === "active"
          ? <><div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22d3ee" }} />{xrMode ? "WebXR Active" : "AR Camera Overlay"}</>
          : status === "init" ? <><Wifi className="w-3.5 h-3.5 animate-pulse" /> Initialising…</>
          : <><CameraOff className="w-3.5 h-3.5" /> Camera unavailable</>}
      </div>
      {status === "error" ? (
        <div className="text-center max-w-sm px-8">
          <CameraOff className="w-12 h-12 mx-auto mb-4 opacity-30" style={{ color: ACCENT }} />
          <p className="font-semibold mb-2" style={{ color: "#f1f5f9" }}>AR mode unavailable</p>
          <p className="text-sm mb-6" style={{ color: "#475569" }}>{errorMsg}</p>
          <button onClick={onClose} className="px-5 py-2 rounded-xl text-sm font-semibold"
            style={{ background: `${ACCENT}20`, border: `1px solid ${ACCENT}40`, color: ACCENT }}>Go back</button>
        </div>
      ) : xrMode ? (
        <div className="text-center">
          <div className="text-6xl mb-4">🥽</div>
          <p className="font-bold text-lg mb-2" style={{ color: "#f1f5f9" }}>WebXR session started</p>
          <p className="text-sm" style={{ color: "#475569" }}>Put on your headset — the AR overlay is active in your device.</p>
        </div>
      ) : (
        <>
          <video ref={videoRef} playsInline muted style={{ display: "none" }} />
          <canvas ref={overlayRef}
            width={typeof window !== "undefined" ? window.innerWidth : 1280}
            height={typeof window !== "undefined" ? window.innerHeight : 720}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {AR_MODES.map(m => (
              <button key={m.key} onClick={() => setMode(m.key)}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: mode === m.key ? `${ACCENT}25` : "rgba(0,0,0,0.55)",
                  border: `1px solid ${mode === m.key ? ACCENT : "rgba(255,255,255,0.12)"}`,
                  color: mode === m.key ? ACCENT : "#94a3b8",
                }}>
                <span className="text-lg leading-none">{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Static catalogue data ─────────────────────────────────────────────────────

const EXPERIENCES = [
  {
    icon: "🌊",
    title: "Wave Interference Field",
    desc: "Generate physical waves in AR space. Walk through constructive and destructive interference patterns you can touch.",
    badge: "AR",
  },
  {
    icon: "🪐",
    title: "Orbital Mechanics",
    desc: "Place planets and watch them orbit. Tweak mass and velocity and observe Kepler's laws emerge at planetary scale.",
    badge: "VR",
  },
  {
    icon: "🧮",
    title: "Linear Algebra Room",
    desc: "Visualise matrix transformations as spatial warps of the room you're in. Eigenspaces become physical axes you can walk along.",
    badge: "AR",
  },
  {
    icon: "🔬",
    title: "Molecular Geometry",
    desc: "Hold molecules in your hands. Rotate bond angles, observe dipole moments, and see VSEPR theory rendered at atomic scale.",
    badge: "AR",
  },
  {
    icon: "📊",
    title: "Statistics Landscape",
    desc: "Walk through data distributions as physical terrain — standard deviations become hills, outliers become cliffs.",
    badge: "VR",
  },
];

const CAPABILITIES = [
  { icon: Glasses, title: "WebXR Compatible", desc: "Works with Meta Quest, Apple Vision Pro, HoloLens 2, and any WebXR-capable headset — no app install required.", action: "vr" },
  { icon: Hand, title: "Gestural Interaction", desc: "Grab, stretch, rotate, and manipulate mathematical objects directly with your hands or controllers.", action: "vr" },
  { icon: Volume2, title: "Spatial Audio", desc: "Mathematical relationships are sonified — hear the pitch change as a parameter sweeps through resonance.", action: "vr" },
  { icon: Camera, title: "AR Overlay Mode", desc: "Overlay mathematical structures onto the real world via your device's camera for a mixed-reality experience.", action: "ar" },
  { icon: Layers, title: "Multi-User Rooms", desc: "Collaborate with classmates or students in shared virtual spaces around the same mathematical object.", action: "soon" },
  { icon: Share2, title: "Session Recording", desc: "Record your VR exploration as a 360° video to share, submit as coursework, or review later.", action: "soon" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ARLabPage() {
  const { isPro, isAdmin } = usePlan();
  const [showAR, setShowAR] = useState<string | null>(null);
  const [vrModal, setVrModal] = useState<string | null>(null);
  const [soonModal, setSoonModal] = useState<string | null>(null);
  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {showAR !== null && <ARCameraOverlay experience={showAR} onClose={() => setShowAR(null)} />}
      {vrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.90)" }}>
          <div className="rounded-2xl p-8 max-w-sm w-full mx-4 text-center relative"
            style={{ background: "rgba(15,15,25,0.98)", border: "1px solid rgba(244,63,94,0.25)" }}>
            <button onClick={() => setVrModal(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}>
              <X className="w-4 h-4" />
            </button>
            <div className="text-5xl mb-4">🥽</div>
            <h3 className="text-lg font-bold mb-2" style={{ color: "#f1f5f9" }}>{vrModal}</h3>
            <p className="text-sm mb-4" style={{ color: "#475569" }}>
              Full VR experience requires a WebXR-compatible headset (Meta Quest, Apple Vision Pro, HoloLens 2).
            </p>
            <p className="text-xs mb-6 px-2 py-2 rounded-lg" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.15)", color: "#f43f5e" }}>
              Connect a headset and click Launch AR Camera — WebXR session will activate automatically.
            </p>
            <button onClick={() => { setVrModal(null); setShowAR(vrModal ?? 'Free Explore'); }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.30)", color: ACCENT }}>
              Launch AR / WebXR
            </button>
          </div>
        </div>
      )}

      {soonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.90)" }}>
          <div className="rounded-2xl p-8 max-w-sm w-full mx-4 text-center relative"
            style={{ background: "rgba(15,15,25,0.98)", border: "1px solid rgba(244,63,94,0.25)" }}>
            <button onClick={() => setSoonModal(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "#64748b" }}>
              <X className="w-4 h-4" />
            </button>
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="text-lg font-bold mb-2" style={{ color: "#f1f5f9" }}>{soonModal}</h3>
            <p className="text-sm mb-6" style={{ color: "#475569" }}>
              This feature is in active development and will be available in the next platform update.
            </p>
            <button onClick={() => setSoonModal(null)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.30)", color: ACCENT }}>
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.25)" }}>
            <Scan className="w-4 h-4" style={{ color: ACCENT }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
            Experiential Intelligence™ — Layer 4
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: "#f1f5f9" }}>
          AR / VR Lab™
        </h1>
        <p className="text-sm max-w-xl" style={{ color: "#475569" }}>
          Step inside the mathematics — wear a headset, pick up your device, or run in browser.
          Every experience makes abstract concepts feel physically real.
        </p>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => setShowAR('Free Explore')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.30)", color: ACCENT }}>
            <Camera className="w-4 h-4" />Launch AR Camera
          </button>
          <span className="text-xs" style={{ color: "#334155" }}>Opens your device camera with 3D wireframe overlay</span>
        </div>
      </div>

      {/* 3D Geometry Explorer */}
      <GeometryExplorer3D isPro={isPro} isAdmin={isAdmin} />

      {/* AR/VR Experiences */}
      <div className="mb-10">
        <h2 className="text-lg font-bold mb-5" style={{ color: "#f1f5f9" }}>AR / VR Experiences</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXPERIENCES.map((exp, i) => (
            <button key={i}
              onClick={() => exp.badge === "AR" ? setShowAR(exp.title) : setVrModal(exp.title)}
              className="rounded-2xl p-5 relative overflow-hidden text-left transition-all hover:scale-[1.02]"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{exp.icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full"
                  style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}25`, color: ACCENT }}>
                  {exp.badge}
                </span>
              </div>
              <h3 className="font-semibold text-sm mb-1.5" style={{ color: "#f1f5f9" }}>{exp.title}</h3>
              <p className="text-xs leading-relaxed mb-3" style={{ color: "#475569" }}>{exp.desc}</p>
              <div className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: ACCENT }}>
                {exp.badge === "AR" ? <Camera className="w-3 h-3" /> : <Glasses className="w-3 h-3" />}
                {exp.badge === "AR" ? "Launch AR Camera" : "Open VR Experience"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Platform Capabilities */}
      <div className="mb-10">
        <h2 className="text-lg font-bold mb-5" style={{ color: "#f1f5f9" }}>Platform Capabilities</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CAPABILITIES.map((cap, i) => {
            const CapIcon = cap.icon;
            const capLabel = cap.action === "ar"
              ? { Icon: Camera, text: "Try Now" }
              : cap.action === "vr"
              ? { Icon: Glasses, text: "Requires Headset" }
              : { Icon: Zap, text: "Coming Soon" };
            const LabelIcon = capLabel.Icon;
            return (
              <button key={i}
                onClick={() => {
                  if (cap.action === "ar") setShowAR(cap.title);
                  else if (cap.action === "vr") setVrModal(cap.title);
                  else setSoonModal(cap.title);
                }}
                className="rounded-2xl p-5 text-left transition-all hover:scale-[1.02]"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                <CapIcon className="w-5 h-5 mb-3" style={{ color: ACCENT }} />
                <h3 className="font-semibold text-sm mb-1.5" style={{ color: "#f1f5f9" }}>{cap.title}</h3>
                <p className="text-xs leading-relaxed mb-3" style={{ color: "#475569" }}>{cap.desc}</p>
                <div className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: ACCENT }}>
                  <LabelIcon className="w-3 h-3" />{capLabel.text}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
