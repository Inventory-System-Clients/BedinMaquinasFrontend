import { useEffect, useRef } from "react";

// Máquina de garra em SVG com volume (frente + lateral), neon e garra animada.
// Leve (sem Three.js): inclina em 3D seguindo o cursor dentro do hero e respeita
// prefers-reduced-motion via CSS.

const PELUCIAS = [
  { x: 88, y: 238, r: 15, c: "#3a7bff" },
  { x: 116, y: 242, r: 13, c: "#ffcc00" },
  { x: 205, y: 240, r: 15, c: "#ed3136" },
  { x: 180, y: 244, r: 12, c: "#3ee6ff" },
  { x: 100, y: 218, r: 12, c: "#f472b6" },
  { x: 196, y: 218, r: 13, c: "#8b5cf6" },
  { x: 220, y: 222, r: 9, c: "#ffcc00" },
  { x: 74, y: 222, r: 9, c: "#3ee6ff" },
];

function Capsula({ x, y, r, cima, baixo, classe }) {
  return (
    <g className={classe} style={{ transformBox: "fill-box" }}>
      <circle cx={x} cy={y} r={r} fill={baixo} />
      <path d={`M${x - r} ${y} a${r} ${r} 0 0 1 ${r * 2} 0 z`} fill={cima} />
      <ellipse cx={x - r * 0.35} cy={y - r * 0.45} rx={r * 0.35} ry={r * 0.2} fill="#fff" opacity="0.55" />
    </g>
  );
}

export default function ClawMachine3D({ className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const maquina = ref.current;
    const hero = maquina?.closest(".bm-hero");
    if (!maquina || !hero) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    let raf = 0;
    const mover = (e) => {
      if (e.pointerType === "touch") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        maquina.style.setProperty("--ry", `${-8 + x * 16}deg`);
        maquina.style.setProperty("--rx", `${-y * 8}deg`);
      });
    };
    const sair = () => {
      maquina.style.setProperty("--ry", "-8deg");
      maquina.style.setProperty("--rx", "0deg");
    };
    hero.addEventListener("pointermove", mover);
    hero.addEventListener("pointerleave", sair);
    return () => {
      cancelAnimationFrame(raf);
      hero.removeEventListener("pointermove", mover);
      hero.removeEventListener("pointerleave", sair);
    };
  }, []);

  return (
    <div className={`bm-stage ${className}`} aria-hidden="true">
      <svg ref={ref} className="bm-machine h-full w-full" viewBox="0 0 340 400" role="presentation">
        <defs>
          <linearGradient id="bmFrente" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dfe7f5" />
            <stop offset="1" stopColor="#8a9bb8" />
          </linearGradient>
          <linearGradient id="bmLado" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5b6d8f" />
            <stop offset="1" stopColor="#2c3a57" />
          </linearGradient>
          <linearGradient id="bmTopo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f4f7fc" />
            <stop offset="1" stopColor="#b4c1d8" />
          </linearGradient>
          <linearGradient id="bmVidro" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d3d7a" stopOpacity="0.85" />
            <stop offset="1" stopColor="#0b1838" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="bmVidroLado" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#173263" stopOpacity="0.9" />
            <stop offset="1" stopColor="#0a1630" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="bmReflexo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="bmPainel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b2f5c" />
            <stop offset="1" stopColor="#0c1733" />
          </linearGradient>
          <radialGradient id="bmChao" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#3ee6ff" stopOpacity="0.45" />
            <stop offset="1" stopColor="#3ee6ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bmLuz" cx="0.5" cy="0" r="0.8">
            <stop offset="0" stopColor="#bfe9ff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#bfe9ff" stopOpacity="0" />
          </radialGradient>
          {PELUCIAS.map((p, i) => (
            <radialGradient key={i} id={`bmP${i}`} cx="0.35" cy="0.3" r="0.75">
              <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="0.35" stopColor={p.c} />
              <stop offset="1" stopColor={p.c} stopOpacity="0.75" />
            </radialGradient>
          ))}
          <filter id="bmGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* reflexo no piso */}
        <ellipse cx="170" cy="368" rx="140" ry="20" fill="url(#bmChao)" />

        {/* ---- teto ---- */}
        <polygon points="60,40 110,15 280,15 230,40" fill="url(#bmTopo)" />
        {/* ---- cabeçalho ---- */}
        <rect x="60" y="40" width="170" height="50" rx="4" fill="#0e1d3f" />
        <polygon points="230,40 280,15 280,65 230,90" fill="url(#bmLado)" />
        <text x="145" y="73" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="22" letterSpacing="4" fill="#7ef0ff" filter="url(#bmGlow)" className="bm-neon">
          BEDIN
        </text>
        <rect x="72" y="48" width="22" height="3" rx="1.5" fill="#3ee6ff" filter="url(#bmGlow)" />
        <rect x="196" y="48" width="22" height="3" rx="1.5" fill="#3ee6ff" filter="url(#bmGlow)" />

        {/* ---- vitrine ---- */}
        <polygon points="230,90 280,65 280,225 230,250" fill="url(#bmVidroLado)" />
        <rect x="60" y="90" width="170" height="160" fill="url(#bmVidro)" />
        <rect x="60" y="90" width="170" height="70" fill="url(#bmLuz)" />

        {/* trilho e garra */}
        <rect x="72" y="100" width="146" height="4" rx="2" fill="#9fb3d6" />
        <g className="bm-carriage" style={{ transformBox: "view-box" }}>
          <rect x="135" y="97" width="20" height="10" rx="3" fill="#e2e8f2" />
          <rect x="144" y="107" width="2" height="36" fill="#cbd5e1" className="bm-cable" style={{ transformBox: "fill-box", transformOrigin: "top" }} />
          <g className="bm-claw">
            <rect x="136" y="141" width="18" height="10" rx="3" fill="#e2e8f2" />
            <rect x="139" y="143" width="12" height="2" rx="1" fill="#3ee6ff" filter="url(#bmGlow)" />
            <g className="bm-prong-l" style={{ transformBox: "fill-box", transformOrigin: "right top" }}>
              <path d="M140 151 L128 165 L134 178" fill="none" stroke="#d6dfec" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="134" cy="178" r="2.5" fill="#3ee6ff" filter="url(#bmGlow)" />
            </g>
            <g className="bm-prong-r" style={{ transformBox: "fill-box", transformOrigin: "left top" }}>
              <path d="M150 151 L162 165 L156 178" fill="none" stroke="#d6dfec" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="156" cy="178" r="2.5" fill="#3ee6ff" filter="url(#bmGlow)" />
            </g>
          </g>
        </g>

        {/* pelúcias */}
        {PELUCIAS.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={p.r} fill={`url(#bmP${i})`} />
            {p.r >= 13 && (
              <>
                <circle cx={p.x - p.r * 0.35} cy={p.y - p.r * 0.1} r="1.6" fill="#0b1838" />
                <circle cx={p.x + p.r * 0.35} cy={p.y - p.r * 0.1} r="1.6" fill="#0b1838" />
              </>
            )}
          </g>
        ))}
        {/* ursinho */}
        <g>
          <circle cx="137" cy="214" r="7" fill="#c98b4f" />
          <circle cx="161" cy="214" r="7" fill="#c98b4f" />
          <circle cx="149" cy="229" r="17" fill="#d9a066" />
          <ellipse cx="149" cy="234" rx="7" ry="5" fill="#f1cf9f" />
          <circle cx="143" cy="225" r="1.8" fill="#2a1a0a" />
          <circle cx="155" cy="225" r="1.8" fill="#2a1a0a" />
          <circle cx="149" cy="232" r="1.6" fill="#2a1a0a" />
          <circle cx="150" cy="248" r="12" fill="#d9a066" />
        </g>

        {/* reflexo do vidro + bordas neon */}
        <polygon points="60,90 130,90 60,200" fill="url(#bmReflexo)" />
        <g filter="url(#bmGlow)" className="bm-neon">
          <line x1="61" y1="90" x2="61" y2="250" stroke="#3ee6ff" strokeWidth="2.5" />
          <line x1="229" y1="90" x2="229" y2="250" stroke="#3ee6ff" strokeWidth="2.5" />
          <line x1="279" y1="65" x2="279" y2="225" stroke="#3ee6ff" strokeWidth="2" opacity="0.7" />
        </g>

        {/* ---- base ---- */}
        <polygon points="230,250 280,225 280,335 230,360" fill="url(#bmLado)" />
        <rect x="60" y="250" width="170" height="110" fill="url(#bmFrente)" />
        {/* painel de controle */}
        <polygon points="52,262 238,262 230,298 60,298" fill="url(#bmPainel)" />
        <rect x="70" y="270" width="64" height="20" rx="4" fill="#0a1630" stroke="#3ee6ff" strokeOpacity="0.6" />
        <rect x="76" y="276" width="30" height="3" rx="1.5" fill="#3ee6ff" className="bm-blink" />
        <rect x="76" y="282" width="46" height="3" rx="1.5" fill="#3a7bff" opacity="0.8" />
        <line x1="166" y1="284" x2="166" y2="270" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
        <circle cx="166" cy="268" r="6" fill="#ed3136" />
        <circle cx="200" cy="281" r="9" fill="#ffcc00" filter="url(#bmGlow)" />
        <circle cx="198" cy="278" r="3" fill="#fff" opacity="0.6" />
        {/* saída de prêmios e moedeiro */}
        <rect x="80" y="314" width="58" height="32" rx="5" fill="#0b1532" />
        <rect x="84" y="318" width="50" height="4" rx="2" fill="#3ee6ff" opacity="0.5" />
        <rect x="176" y="312" width="30" height="36" rx="4" fill="#1a2747" />
        <rect x="186" y="320" width="10" height="2" rx="1" fill="#ffcc00" />
        <rect x="181" y="330" width="20" height="12" rx="2" fill="#0b1532" stroke="#3a7bff" strokeOpacity="0.6" />
        {/* LEDs laterais */}
        {[245, 265, 285, 305].map((y, i) => (
          <circle key={y} cx="255" cy={y - i * 2} r="2.4" fill={i % 2 ? "#ffcc00" : "#3ee6ff"} filter="url(#bmGlow)" className="bm-blink" style={{ animationDelay: `${i * 0.3}s` }} />
        ))}

        {/* cápsulas flutuantes */}
        <Capsula x={30} y={130} r={13} cima="#ffcc00" baixo="#ffffff" classe="bm-float" />
        <Capsula x={312} y={110} r={10} cima="#3a7bff" baixo="#e2e8f0" classe="bm-float d2" />
        <Capsula x={318} y={300} r={12} cima="#ed3136" baixo="#f8fafc" classe="bm-float d3" />
        <Capsula x={22} y={290} r={8} cima="#3ee6ff" baixo="#f8fafc" classe="bm-float d2" />
      </svg>
    </div>
  );
}
