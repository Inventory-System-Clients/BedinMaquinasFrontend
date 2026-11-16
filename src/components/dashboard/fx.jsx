import { useEffect, useLayoutEffect, useRef } from "react";

// Efeitos visuais leves do dashboard, sem bibliotecas: revelaÃ§Ã£o ao rolar, contagem
// animada, inclinaÃ§Ã£o 3D no hover e parallax. Nada aqui gera re-render: tudo escreve
// direto no DOM (classList / style / textContent) dentro de callbacks.

const reduzirMovimento = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const ICONES = {
  refresh: "M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5",
  truck: "M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  plus: "M12 5v14M5 12h14",
  cart: "M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2M9.5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17.5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  wrench: "M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 1.3-1.3-6-6L4 12 1 9l8-8 1.7 1.3a4 4 0 0 0 4 4z",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h4M18 9v6a4 4 0 0 1-4 4h-4",
  gift: "M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z",
  alert: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  check: "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3",
  store: "M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6",
  coins: "M9 14c3.9 0 7-1.3 7-3s-3.1-3-7-3-7 1.3-7 3 3.1 3 7 3zM2 11v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4M16 8.5c3.4.3 6 1.5 6 3s-1.8 2.3-4.5 2.8M22 11.5v4c0 1.4-2.2 2.6-5.4 2.9",
  box: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  clipboard: "M9 4h6v3H9zM9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3M9 12h6M9 16h4",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  dashboard: "M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z",
  gamepad: "M6 12h4M8 10v4M15 13h.01M18 11h.01M17.3 5H6.7a4 4 0 0 0-4 3.6L2 15a3 3 0 0 0 5.4 2l1.6-2h6l1.6 2a3 3 0 0 0 5.4-2l-.7-6.4a4 4 0 0 0-4-3.6z",
  tag: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01",
  wallet: "M20 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15v12H5a2 2 0 0 1-2-2V6M16 14h.01",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  menu: "M4 6h16M4 12h16M4 18h16",
  x: "M18 6 6 18M6 6l12 12",
  arrow: "M5 12h14M13 6l6 6-6 6",
  calendar: "M3 5h18v16H3zM16 3v4M8 3v4M3 10h18",
  pin: "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
};

/** Ãcone de traÃ§o (estilo minimalista consistente). */
export function Icone({ nome, className = "h-5 w-5", strokeWidth = 1.8, ...resto }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...resto}>
      <path d={ICONES[nome] || ICONES.sparkle} />
    </svg>
  );
}

/** Revela o conteÃºdo quando entra na tela (uma vez). `atraso` em ms para animaÃ§Ãµes sequenciais. */
export function Reveal({ as = "div", atraso = 0, className = "", style, children, ...resto }) {
  const Tag = as;
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (reduzirMovimento() || typeof IntersectionObserver === "undefined") {
      el.classList.add("is-in");
      return undefined;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          el.classList.add("is-in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`bm-reveal ${className}`} style={{ "--bm-delay": `${atraso}ms`, ...style }} {...resto}>
      {children}
    </Tag>
  );
}

/** NÃºmero com contagem animada ao entrar na tela e a cada mudanÃ§a de valor. */
export function CountUp({ valor, formatar = (v) => Math.round(v).toLocaleString("pt-BR"), duracao = 1100, className }) {
  const ref = useRef(null);
  const anterior = useRef(0);
  const visivel = useRef(false);
  const alvo = Number(valor) || 0;

  // Layout effect: o texto é escrito antes da pintura (o React não controla o conteúdo do span).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let raf = 0;
    let io;

    const animar = () => {
      const de = anterior.current;
      anterior.current = alvo;
      if (reduzirMovimento() || de === alvo) {
        el.textContent = formatar(alvo);
        return;
      }
      const inicio = performance.now();
      const passo = (agora) => {
        const t = Math.min(1, (agora - inicio) / duracao);
        const e = 1 - Math.pow(1 - t, 3);
        el.textContent = formatar(de + (alvo - de) * e);
        if (t < 1) raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    };

    if (visivel.current || typeof IntersectionObserver === "undefined") {
      visivel.current = true;
      animar();
    } else {
      el.textContent = formatar(0);
      io = new IntersectionObserver((entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          visivel.current = true;
          io.disconnect();
          animar();
        }
      });
      io.observe(el);
    }
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      // Se a animaÃ§Ã£o foi interrompida, a prÃ³xima parte do valor final.
      if (visivel.current) el.textContent = formatar(alvo);
    };
    // `formatar` costuma ser inline; sÃ³ o valor deve reiniciar a animaÃ§Ã£o.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo, duracao]);

  return (
    <span ref={ref} className={className} />
  );
}

/** InclinaÃ§Ã£o 3D suave seguindo o cursor (sÃ³ em dispositivos com hover). */
export function Tilt({ as = "div", forca = 6, className = "", children, ...resto }) {
  const Tag = as;
  const ref = useRef(null);
  const mover = (e) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch" || reduzirMovimento()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(x - 0.5) * forca}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * forca}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  };
  const sair = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };
  return (
    <Tag ref={ref} className={`bm-tilt ${className}`} onPointerMove={mover} onPointerLeave={sair} {...resto}>
      {children}
    </Tag>
  );
}

/** Desloca a camada decorativa conforme a rolagem (parallax). `velocidade` < 0 sobe mais devagar. */
export function Parallax({ velocidade = 0.15, className = "", children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduzirMovimento()) return undefined;
    let raf = 0;
    const aplicar = () => {
      raf = 0;
      const y = Math.min(window.scrollY, 900) * velocidade;
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    };
    const aoRolar = () => {
      if (!raf) raf = requestAnimationFrame(aplicar);
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
    aplicar();
    return () => {
      window.removeEventListener("scroll", aoRolar);
      cancelAnimationFrame(raf);
    };
  }, [velocidade]);
  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}
