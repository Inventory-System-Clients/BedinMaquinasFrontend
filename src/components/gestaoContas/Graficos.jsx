import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { brl, dataBR, mesCurto } from "./utils";

// Paleta categórica fixa (mesma ordem em todo gráfico desta tela, validada para daltonismo):
// azul = entradas / a receber, laranja = saídas / a pagar. Nunca ciclada.
const COR_ENTRADA = "#2a78d6";
const COR_SAIDA = "#eb6834";
const GRADE = "#e5e7eb";
const TEXTO_MUDO = "#6b7280";

const compacto = (v) => {
  const n = Math.abs(v);
  const sinal = v < 0 ? "-" : "";
  if (n >= 1_000_000) return `${sinal}R$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${sinal}R$${(n / 1000).toFixed(1)}k`;
  return `${sinal}R$${n.toFixed(0)}`;
};

function Dica({ active, payload, label, extra }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label && <div className="mb-1 text-gray-500">{label}</div>}
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 text-gray-800">
          <span className="flex items-center gap-1.5">
            <i className="inline-block size-2 rounded-full" style={{ background: p.color || p.payload?.cor }} />
            {p.name}
          </span>
          <strong>{brl(p.value)}</strong>
        </div>
      ))}
      {extra && extra(payload[0].payload)}
    </div>
  );
}

function SemDados({ altura = 200, texto = "Sem dados no período." }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400" style={{ height: altura }}>
      {texto}
    </div>
  );
}

/** Entradas x saídas por mês — comparação de magnitude entre duas séries; resultado no tooltip. */
export function GraficoMensal({ dados }) {
  if (!dados?.some((d) => d.entradas || d.saidas)) return <SemDados altura={260} />;
  const pontos = dados.map((d) => ({ ...d, label: mesCurto(d.mes) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={pontos} barGap={2} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={GRADE} />
        <XAxis dataKey="label" tick={{ fill: TEXTO_MUDO, fontSize: 12 }} axisLine={{ stroke: "#d1d5db" }} tickLine={false} />
        <YAxis tick={{ fill: TEXTO_MUDO, fontSize: 12 }} axisLine={false} tickLine={false} width={60} tickFormatter={compacto} />
        <Tooltip
          cursor={{ fill: "rgba(36,87,177,0.06)" }}
          content={
            <Dica
              extra={(p) => (
                <div className={`mt-1 border-t border-gray-100 pt-1 text-right font-semibold ${p.resultado < 0 ? "text-red-600" : "text-emerald-700"}`}>
                  Resultado: {brl(p.resultado)}
                </div>
              )}
            />
          }
        />
        <Legend wrapperStyle={{ fontSize: 12, color: TEXTO_MUDO }} iconType="circle" iconSize={8} />
        <Bar dataKey="entradas" name="Entradas" fill={COR_ENTRADA} radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Bar dataKey="saidas" name="Saídas" fill={COR_SAIDA} radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ranking horizontal (despesas/receitas por categoria ou centro de custo) — uma série, uma cor. */
export function GraficoRanking({ dados, cor = COR_SAIDA, max = 8, nome = "Valor" }) {
  if (!dados?.length) return <SemDados altura={180} />;
  // Mais que `max` categorias: o resto vira "Outras".
  const top = dados.slice(0, max);
  const resto = dados.slice(max).reduce((s, d) => s + d.total, 0);
  const linhas = resto > 0 ? [...top, { nome: `Outras (${dados.length - max})`, total: resto }] : top;
  const soma = dados.reduce((s, d) => s + d.total, 0);
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, linhas.length * 36 + 16)}>
      <BarChart data={linhas} layout="vertical" margin={{ top: 4, right: 110, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} stroke={GRADE} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="nome" width={150} tick={{ fill: "#374151", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "rgba(36,87,177,0.06)" }} content={<Dica />} />
        <Bar
          dataKey="total"
          name={nome}
          fill={cor}
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
          isAnimationActive={false}
          label={{
            position: "right",
            fill: "#374151",
            fontSize: 12,
            formatter: (v) => `${brl(v)} · ${soma > 0 ? Math.round((v / soma) * 100) : 0}%`,
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Próximas 8 semanas: quanto vence a pagar x a receber (vencidas entram na 1ª semana). */
export function GraficoProjecao({ dados }) {
  if (!dados?.some((d) => d.pagar || d.receber)) return <SemDados altura={240} texto="Nada em aberto nas próximas semanas." />;
  const pontos = dados.map((d, i) => ({ ...d, label: i === 0 ? "Esta sem." : dataBR(d.inicio).slice(0, 5), periodo: `${dataBR(d.inicio)} a ${dataBR(d.fim)}` }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={pontos} barGap={2} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={GRADE} />
        <XAxis dataKey="label" tick={{ fill: TEXTO_MUDO, fontSize: 12 }} axisLine={{ stroke: "#d1d5db" }} tickLine={false} />
        <YAxis tick={{ fill: TEXTO_MUDO, fontSize: 12 }} axisLine={false} tickLine={false} width={60} tickFormatter={compacto} />
        <Tooltip
          cursor={{ fill: "rgba(36,87,177,0.06)" }}
          content={
            <Dica
              extra={(p) => (
                <div className="mt-1 border-t border-gray-100 pt-1 text-gray-500">
                  {p.periodo}
                  <div className={`text-right font-semibold ${p.receber - p.pagar < 0 ? "text-red-600" : "text-emerald-700"}`}>Saldo: {brl(p.receber - p.pagar)}</div>
                </div>
              )}
            />
          }
        />
        <Legend wrapperStyle={{ fontSize: 12, color: TEXTO_MUDO }} iconType="circle" iconSize={8} />
        <Bar dataKey="receber" name="A receber" fill={COR_ENTRADA} radius={[4, 4, 0, 0]} maxBarSize={26} />
        <Bar dataKey="pagar" name="A pagar" fill={COR_SAIDA} radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Saldo por conta bancária (positivo azul, negativo vermelho de alerta + rótulo). */
export function GraficoSaldos({ dados }) {
  if (!dados?.length) return <SemDados altura={140} texto="Nenhuma conta bancária cadastrada." />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, dados.length * 36 + 16)}>
      <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 100, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} stroke={GRADE} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="nome" width={130} tick={{ fill: "#374151", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "rgba(36,87,177,0.06)" }} content={<Dica />} />
        <Bar dataKey="saldo" name="Saldo" radius={4} maxBarSize={20} isAnimationActive={false} label={{ position: "right", fill: "#374151", fontSize: 12, formatter: (v) => brl(v) }}>
          {dados.map((d) => (
            <Cell key={d.id} fill={d.saldo < 0 ? "#d03b3b" : COR_ENTRADA} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export { COR_ENTRADA, COR_SAIDA };
