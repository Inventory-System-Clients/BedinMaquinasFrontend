import { useEffect, useState } from "react";
import { Botao, Card, Campo, StatCard, inputCls } from "./ui";
import { useAviso } from "./hooks";
import { COR_ENTRADA, GraficoMensal, GraficoProjecao, GraficoRanking } from "./Graficos";
import { ContaFormDialog } from "./ContaFormDialog";
import { LancamentoDialog } from "./LancamentoDialog";
import { SITUACAO, abrirRelatorio, brl, dataBR, erroApi, escapeHtml, gc, hoje, mesCurto, primeiroDiaDoMes, somarMeses } from "./utils";

// Resumo da gestão de contas: indicadores do período, entradas x saídas por mês, projeção
// das próximas semanas, composição de despesas/receitas e próximos vencimentos.

function fimDoMes(dia) {
  const [a, m] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

const ATALHOS = [
  ["Este mês", () => [primeiroDiaDoMes(), hoje()]],
  ["Mês passado", () => { const ini = somarMeses(primeiroDiaDoMes(), -1); return [ini, fimDoMes(ini)]; }],
  ["Últimos 3 meses", () => [somarMeses(primeiroDiaDoMes(), -2), hoje()]],
  ["Este ano", () => [`${hoje().slice(0, 4)}-01-01`, hoje()]],
];

export default function ResumoPanel({ classificacoes, bancos, onAlterado, irPara, versao }) {
  const avisar = useAviso();
  const [de, setDe] = useState(primeiroDiaDoMes());
  const [ate, setAte] = useState(hoje());
  const [resumo, setResumo] = useState(null);
  const [nova, setNova] = useState(null); // "PAGAR" | "RECEBER"
  const [lancamento, setLancamento] = useState(null);
  const [visaoComposicao, setVisaoComposicao] = useState("categoria");

  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!de || !ate) return undefined;
    let vivo = true;
    gc.resumo({ de, ate })
      .then((dados) => vivo && setResumo(dados))
      .catch((err) => vivo && avisar(erroApi(err, "Erro ao carregar o resumo."), "erro"));
    return () => {
      vivo = false;
    };
  }, [de, ate, versao, recarga, avisar]);

  function recarregar() {
    setRecarga((n) => n + 1);
    onAlterado?.();
  }

  function gerarPdf() {
    if (!resumo) return;
    const tabela = (titulo, linhas) => {
      const soma = linhas.reduce((s, l) => s + l.total, 0);
      const corpo = linhas.map((l) => `<tr><td>${escapeHtml(l.nome)}</td><td class="num">${brl(l.total)}</td><td class="num">${soma ? ((l.total / soma) * 100).toFixed(1).replace(".", ",") : 0}%</td></tr>`).join("");
      return `<h2>${titulo}</h2><table><thead><tr><th>Nome</th><th class="num">Valor</th><th class="num">%</th></tr></thead><tbody>${corpo || '<tr><td colspan="3">Nada no período.</td></tr>'}</tbody><tfoot><tr><th>Total</th><th class="num">${brl(soma)}</th><th></th></tr></tfoot></table>`;
    };
    const mensal = resumo.mensal.map((m) => `<tr><td>${mesCurto(m.mes)}</td><td class="num">${brl(m.entradas)}</td><td class="num">${brl(m.saidas)}</td><td class="num">${brl(m.resultado)}</td></tr>`).join("");
    abrirRelatorio(
      `Resumo financeiro ${dataBR(de)} a ${dataBR(ate)}`,
      `<h1>Resumo financeiro</h1><div class="muted">Período: ${dataBR(de)} a ${dataBR(ate)} · Gerado em ${new Date().toLocaleString("pt-BR")}</div>
      <div class="summary">
        <div class="box"><strong>Entradas</strong><br/>${brl(resumo.entradas)}</div>
        <div class="box"><strong>Saídas</strong><br/>${brl(resumo.saidas)}</div>
        <div class="box"><strong>Resultado</strong><br/>${brl(resumo.resultado)}${resumo.margem != null ? ` (${resumo.margem.toFixed(1).replace(".", ",")}%)` : ""}</div>
        <div class="box"><strong>Saldo nas contas hoje</strong><br/>${brl(resumo.saldoBancos)}</div>
        <div class="box"><strong>A pagar em aberto</strong><br/>${brl(resumo.pagar.aberto.total)} (vencido ${brl(resumo.pagar.vencido.total)})</div>
        <div class="box"><strong>A receber em aberto</strong><br/>${brl(resumo.receber.aberto.total)} (vencido ${brl(resumo.receber.vencido.total)})</div>
      </div>
      <h2>Entradas x saídas por mês</h2><table><thead><tr><th>Mês</th><th class="num">Entradas</th><th class="num">Saídas</th><th class="num">Resultado</th></tr></thead><tbody>${mensal}</tbody></table>
      ${tabela("Despesas por categoria", resumo.despesasPorCategoria)}
      ${tabela("Despesas por centro de custo", resumo.despesasPorCentroCusto)}
      ${tabela("Receitas por categoria", resumo.receitasPorCategoria)}
      <div class="total">Resultado do período: ${brl(resumo.resultado)}</div>`
    );
  }

  const r = resumo;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <Campo label="De">
          <input type="date" className={`${inputCls} w-40`} value={de} onChange={(e) => setDe(e.target.value)} />
        </Campo>
        <Campo label="Até">
          <input type="date" className={`${inputCls} w-40`} value={ate} onChange={(e) => setAte(e.target.value)} />
        </Campo>
        <div className="flex flex-wrap gap-1 pb-0.5">
          {ATALHOS.map(([rotulo, fn]) => (
            <Botao key={rotulo} pequeno variante="fantasma" onClick={() => { const [a, b] = fn(); setDe(a); setAte(b); }}>
              {rotulo}
            </Botao>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Botao variante="contorno" onClick={gerarPdf} disabled={!r}>
            🖨 PDF do período
          </Botao>
          <Botao variante="contorno" onClick={() => setLancamento({})}>
            ＋ Lançamento
          </Botao>
          <Botao variante="contorno" onClick={() => setNova("RECEBER")}>
            ＋ A receber
          </Botao>
          <Botao onClick={() => setNova("PAGAR")}>＋ A pagar</Botao>
        </div>
      </div>

      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard icone="↑" label="Entradas no período" valor={brl(r.entradas)} tom="ok" />
            <StatCard icone="↓" label="Saídas no período" valor={brl(r.saidas)} tom="crit" />
            <StatCard
              icone="="
              label="Resultado do período"
              valor={brl(r.resultado)}
              tom={r.resultado < 0 ? "crit" : "ok"}
              detalhe={r.margem != null ? `Margem de ${r.margem.toFixed(1).replace(".", ",")}%` : `${r.quantidadeLancamentos} lançamentos`}
            />
            <StatCard icone="🏦" label="Saldo nas contas hoje" valor={brl(r.saldoBancos)} tom={r.saldoBancos < 0 ? "crit" : "neutro"} detalhe={`${r.bancos.length} conta${r.bancos.length === 1 ? "" : "s"}`} />
            <button type="button" className="text-left" onClick={() => irPara("pagar")}>
              <StatCard
                icone="📤"
                label="A pagar em aberto"
                valor={brl(r.pagar.aberto.total)}
                tom={r.pagar.vencido.count ? "crit" : "neutro"}
                destaque={r.pagar.vencido.count > 0}
                detalhe={r.pagar.vencido.count ? `⚠️ ${brl(r.pagar.vencido.total)} vencido (${r.pagar.vencido.count})` : `${r.pagar.aberto.count} contas`}
              />
            </button>
            <button type="button" className="text-left" onClick={() => irPara("receber")}>
              <StatCard
                icone="📥"
                label="A receber em aberto"
                valor={brl(r.receber.aberto.total)}
                tom={r.receber.vencido.count ? "crit" : "neutro"}
                destaque={r.receber.vencido.count > 0}
                detalhe={r.receber.vencido.count ? `⚠️ ${brl(r.receber.vencido.total)} atrasado (${r.receber.vencido.count})` : `${r.receber.aberto.count} contas`}
              />
            </button>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
            <Card titulo={`Entradas x saídas (${r.mensal.length} meses)`}>
              <GraficoMensal dados={r.mensal} />
            </Card>
            <Card titulo="Projeção: o que vence nas próximas 8 semanas">
              <GraficoProjecao dados={r.projecao} />
              <p className="mt-1 text-xs text-gray-500">Contas em aberto pelo vencimento. Vencidas entram na semana atual.</p>
            </Card>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
            <Card
              titulo="Para onde foi o dinheiro"
              acao={
                <select className="rounded-md border border-gray-200 px-2 py-1 text-xs" value={visaoComposicao} onChange={(e) => setVisaoComposicao(e.target.value)}>
                  <option value="categoria">Por categoria</option>
                  <option value="centroCusto">Por centro de custo</option>
                </select>
              }
            >
              <GraficoRanking dados={visaoComposicao === "categoria" ? r.despesasPorCategoria : r.despesasPorCentroCusto} nome="Saídas" />
            </Card>
            <Card titulo="De onde veio o dinheiro">
              <GraficoRanking dados={r.receitasPorCategoria} cor={COR_ENTRADA} nome="Entradas" />
            </Card>
          </div>

          <Card titulo="Próximos vencimentos (15 dias) e atrasadas">
            {r.proximosVencimentos.length === 0 ? (
              <p className="text-sm text-gray-500">Nada vencendo nos próximos 15 dias. 🎉</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {r.proximosVencimentos.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => irPara(c.tipo === "PAGAR" ? "pagar" : "receber")}
                    className="flex w-full flex-wrap items-center gap-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span className={`w-20 text-xs font-semibold ${c.tipo === "PAGAR" ? "text-orange-700" : "text-blue-700"}`}>{c.tipo === "PAGAR" ? "↓ A pagar" : "↑ A receber"}</span>
                    <span className="w-24 whitespace-nowrap text-gray-600">{dataBR(c.vencimento)}</span>
                    <span className="order-last w-full min-w-0 truncate sm:order-0 sm:w-auto sm:flex-1">
                      <strong className="font-medium">{c.descricao}</strong>
                      {c.parcelaTotal ? ` (${c.parcelaNumero}/${c.parcelaTotal})` : ""}
                      {c.pessoa && <span className="text-gray-500"> · {c.pessoa}</span>}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${SITUACAO[c.situacao].classe}`}>{SITUACAO[c.situacao].label}</span>
                    <span className="ml-auto w-28 text-right font-semibold">{brl(c.valor)}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {!r && <p className="py-10 text-center text-gray-500">Carregando resumo...</p>}

      <ContaFormDialog tipo={nova ?? "PAGAR"} aberto={!!nova} onFechar={() => setNova(null)} onSalvo={recarregar} classificacoes={classificacoes} bancos={bancos} />
      <LancamentoDialog lancamento={lancamento} onFechar={() => setLancamento(null)} onSalvo={recarregar} classificacoes={classificacoes} bancos={bancos} />
    </div>
  );
}
