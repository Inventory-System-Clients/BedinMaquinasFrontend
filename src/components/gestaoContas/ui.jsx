import { useCallback, useEffect, useState } from "react";
import { ToastCtx } from "./hooks";

// Peças visuais da Gestão de Contas — mesmo desenho da aba financeiro da Reblind
// (cards, abas segmentadas, tabela, diálogos), nas cores do BedinMáquinas.

export const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#2457B1] focus:ring-2 focus:ring-[#2457B1]/15 disabled:bg-gray-50";

const botoes = {
  primario: "bg-[#2457B1] text-white hover:bg-[#1d4690] shadow-sm",
  contorno: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
  fantasma: "text-gray-600 hover:bg-gray-100",
  perigo: "text-red-600 hover:bg-red-50",
  sucesso: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
};

export function Botao({ variante = "primario", pequeno, className = "", ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        pequeno ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm"
      } ${botoes[variante]} ${className}`}
    />
  );
}

export function Campo({ label, children, className = "", dica }) {
  return (
    <label className={`grid gap-1 text-sm ${className}`}>
      <span className="text-xs font-medium text-gray-600">{label}</span>
      {children}
      {dica && <span className="text-xs text-gray-400">{dica}</span>}
    </label>
  );
}

/** Input com sugestões (datalist) — aceita valor novo, que vira sugestão nos próximos lançamentos. */
export function InputSugestao({ id, opcoes = [], ...props }) {
  return (
    <>
      <input list={id} className={inputCls} autoComplete="off" {...props} />
      <datalist id={id}>
        {opcoes.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

export function Segmentado({ opcoes, valor, onChange }) {
  return (
    <div className="inline-flex w-fit flex-wrap rounded-lg border border-gray-200 bg-white p-0.5 text-sm shadow-sm">
      {opcoes.map(([chave, label]) => (
        <button
          key={chave}
          type="button"
          onClick={() => onChange(chave)}
          className={`rounded-md px-3 py-1.5 font-medium transition ${valor === chave ? "bg-[#2457B1] text-white" : "text-gray-500 hover:text-gray-800"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Card({ titulo, acao, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
      {(titulo || acao) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          {titulo && <h3 className="text-base font-semibold text-gray-800">{titulo}</h3>}
          {acao}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const tons = { ok: "text-emerald-700", crit: "text-red-600", neutro: "text-gray-900" };

export function StatCard({ label, valor, tom = "neutro", detalhe, icone, destaque }) {
  return (
    <div className={`min-w-0 rounded-xl border bg-white p-4 shadow-sm ${destaque ? "border-red-300" : "border-gray-200"}`}>
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        {icone && <span aria-hidden>{icone}</span>}
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold ${tons[tom]}`}>{valor}</div>
      {detalhe && <div className="mt-0.5 text-xs text-gray-500">{detalhe}</div>}
    </div>
  );
}

export function Dialogo({ aberto, onFechar, titulo, descricao, children, largura = "max-w-lg" }) {
  useEffect(() => {
    if (!aberto) return undefined;
    const onKey = (e) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 backdrop-blur-[1px]" onMouseDown={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[calc(100dvh-1rem)] w-full ${largura} flex-col overflow-hidden rounded-xl bg-white shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{titulo}</h3>
            {descricao && <p className="mt-0.5 text-sm text-gray-500">{descricao}</p>}
          </div>
          <button type="button" onClick={onFechar} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Rodape({ children }) {
  return <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">{children}</div>;
}

export function Vazio({ children, colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-gray-500">
        {children}
      </td>
    </tr>
  );
}

export const thCls = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500";
export const tdCls = "px-3 py-2.5 text-sm text-gray-800 align-top";

// ------------------------------------------------------------------ Avisos (toast)

export function ToastProvider({ children }) {
  const [itens, setItens] = useState([]);
  const avisar = useCallback((mensagem, tipo = "sucesso") => {
    const id = Math.random().toString(36).slice(2);
    setItens((prev) => [...prev, { id, mensagem, tipo }]);
    setTimeout(() => setItens((prev) => prev.filter((i) => i.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] grid gap-2">
        {itens.map((i) => (
          <div
            key={i.id}
            className={`pointer-events-auto max-w-sm rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg ${
              i.tipo === "erro" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {i.tipo === "erro" ? "⚠️ " : "✓ "}
            {i.mensagem}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
