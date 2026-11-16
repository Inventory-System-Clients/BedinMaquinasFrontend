import { Link } from "react-router-dom";
import { CountUp, Icone, Tilt } from "./fx";

// Cards do dashboard: indicadores (KPI) e atalhos operacionais.

const TONS = {
  azul: { tile: "bg-[#e8efff] text-[#2457b1]", barra: "from-[#3a7bff] to-[#2457b1]", acao: "text-[#2457b1]" },
  verde: { tile: "bg-emerald-50 text-emerald-600", barra: "from-emerald-400 to-emerald-600", acao: "text-emerald-700" },
  violeta: { tile: "bg-violet-50 text-violet-600", barra: "from-violet-400 to-indigo-600", acao: "text-violet-700" },
  ciano: { tile: "bg-cyan-50 text-cyan-700", barra: "from-cyan-300 to-sky-600", acao: "text-cyan-800" },
  laranja: { tile: "bg-orange-50 text-orange-600", barra: "from-amber-400 to-orange-600", acao: "text-orange-700" },
  vermelho: { tile: "bg-red-50 text-red-600", barra: "from-red-400 to-[#ed3136]", acao: "text-red-700" },
};

/** Brilho que repete a cada atualização dos dados (a `key` remonta o span). */
function Flash({ versao }) {
  if (!versao) return null;
  return <span key={versao} className="bm-flash pointer-events-none absolute inset-0 rounded-[inherit]" />;
}

/** KPI simples (fundo claro). */
export function KpiCard({ icone, tom = "azul", titulo, valor, formatar, descricao, versao, className = "" }) {
  const t = TONS[tom];
  return (
    <Tilt className={`bm-card overflow-hidden p-4 sm:p-5 ${className}`}>
      <Flash versao={versao} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{titulo}</p>
        <span className={`bm-ic-tile h-10! w-10! ${t.tile}`}>
          <Icone nome={icone} className="h-5 w-5" />
        </span>
      </div>
      <CountUp valor={valor} formatar={formatar} className="mt-1 block text-2xl font-bold tracking-tight text-slate-900 tabular-nums sm:text-3xl" />
      {descricao && <p className="mt-1 text-xs text-slate-500">{descricao}</p>}
    </Tilt>
  );
}

/** KPI principal (faturamento): iluminação azul e detalhe dourado. */
export function KpiDestaque({ titulo, valor, formatar, descricao, acao, versao, className = "" }) {
  return (
    <Tilt forca={4} className={`bm-card bm-kpi-hero overflow-hidden p-5 sm:p-6 ${className}`}>
      <Flash versao={versao} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-blue-100/90">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ffcc00] shadow-[0_0_10px_#ffcc00]" />
            {titulo}
          </p>
          <CountUp valor={valor} formatar={formatar} className="mt-2 block text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl" />
          {descricao && <p className="mt-1.5 text-xs text-blue-100/75">{descricao}</p>}
        </div>
        <span className="bm-ic-tile shrink-0 border border-[#ffcc00]/40 bg-[#ffcc00]/15 text-[#ffd84a]">
          <Icone nome="coins" className="h-6 w-6" />
        </span>
      </div>
      {acao && (
        <Link to={acao.to} className="bm-go mt-4 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-[#ffd84a] hover:text-white">
          {acao.label}
          <Icone nome="arrow" className="h-4 w-4" />
        </Link>
      )}
    </Tilt>
  );
}

/** Cabeçalho padrão das seções grandes (busca, alertas, performance). */
export function SecaoCabecalho({ icone, tom = "azul", titulo, descricao, children }) {
  const t = TONS[tom];
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`bm-ic-tile shrink-0 ${t.tile}`}>
          <Icone nome={icone} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">{titulo}</h2>
          {descricao && <p className="text-xs text-slate-500 sm:text-sm">{descricao}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Card operacional (atalho): ícone, título, informação principal, descrição e ação.
 * Navega com `to` ou executa `onClick`.
 */
export function OpCard({ to, onClick, icone, tom = "azul", titulo, valor, descricao, acao, destaque = false, sutil = false, children }) {
  const t = TONS[tom];
  const conteudo = (
    <>
      <span className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${t.barra} ${sutil ? "opacity-40" : ""}`} />
      {/* Reserva espaço à direita quando há selo/badge absoluto no canto. */}
      <div className={`flex items-start gap-3 ${children ? "pr-16" : ""}`}>
        <span className={`bm-ic-tile shrink-0 ${t.tile}`}>
          <Icone nome={icone} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{titulo}</h3>
          {descricao && <p className="mt-0.5 text-xs leading-snug text-slate-500">{descricao}</p>}
        </div>
      </div>
      {valor !== undefined && <div className={`mt-4 text-3xl font-bold tracking-tight tabular-nums ${sutil ? "text-slate-400" : "text-slate-900"}`}>{valor}</div>}
      <span className={`bm-go mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold ${t.acao}`}>
        {acao}
        <Icone nome="arrow" className="h-4 w-4" />
      </span>
      {children}
    </>
  );
  const cls = `bm-card relative flex h-full w-full sm:min-h-44 flex-col overflow-hidden p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3a7bff] ${
    destaque ? "ring-2 ring-red-400/60" : ""
  }`;
  if (to) {
    return (
      <Tilt as={Link} to={to} className={cls}>
        {conteudo}
      </Tilt>
    );
  }
  return (
    <Tilt as="button" type="button" onClick={onClick} className={cls}>
      {conteudo}
    </Tilt>
  );
}
