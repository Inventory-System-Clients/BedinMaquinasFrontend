import { useEffect, useState } from "react";
import { Botao, Card, Campo, StatCard, Vazio, inputCls, tdCls, thCls } from "./ui";
import { confirmar, useAviso } from "./hooks";
import { EditarContaDialog } from "./ContaFormDialog";
import { LancamentoDialog } from "./LancamentoDialog";
import { abrirRelatorio, brl, dataBR, erroApi, escapeHtml, exportarCsv, gc, hoje, primeiroDiaDoMes } from "./utils";

// Fluxo de caixa realizado no período (contas pagas/recebidas + lançamentos manuais),
// com saldo inicial real (saldos iniciais + tudo antes do período), previsão do que vence
// no período, fluxo diário, DRE simplificado e lançamentos editáveis.

const ORIGEM = { recebida: "Recebida", paga: "Paga", manual: "Manual" };

export default function FluxoCaixaPanel({ classificacoes, bancos, onAlterado }) {
  const avisar = useAviso();
  const [de, setDe] = useState(primeiroDiaDoMes());
  const [ate, setAte] = useState(hoje());
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [fluxo, setFluxo] = useState(null);
  const [editandoConta, setEditandoConta] = useState(null);
  const [lancamento, setLancamento] = useState(null);
  const [recarga, setRecarga] = useState(0);
  // "Ver mais" vale só para o filtro em que foi clicado.
  const chaveFiltro = `${de}|${ate}|${contaBancariaId}`;
  const [todosPara, setTodosPara] = useState(null);
  const mostrarTodos = todosPara === chaveFiltro;

  useEffect(() => {
    if (!de || !ate) return undefined;
    let vivo = true;
    gc.fluxo({ de, ate, contaBancariaId: contaBancariaId || undefined })
      .then((dados) => vivo && setFluxo(dados))
      .catch((err) => vivo && avisar(erroApi(err, "Erro ao calcular o fluxo de caixa."), "erro"));
    return () => {
      vivo = false;
    };
  }, [de, ate, contaBancariaId, recarga, avisar]);

  function recarregar() {
    setRecarga((n) => n + 1);
    onAlterado?.();
  }

  async function excluirLancamento(m) {
    if (!(await confirmar("Excluir lançamento?", `"${m.descricao}" — ${brl(m.valor)}`, "Excluir"))) return;
    try {
      await gc.excluirLancamento(m.id);
      avisar("Lançamento excluído.");
      recarregar();
    } catch (err) {
      avisar(erroApi(err, "Não foi possível excluir."), "erro");
    }
  }

  const movimentos = fluxo?.movimentos ?? [];
  const visiveis = mostrarTodos ? movimentos : movimentos.slice(0, 15);
  const nomeConta = bancos.find((b) => b.id === contaBancariaId)?.nome;

  function exportarExcel() {
    exportarCsv(`fluxo-de-caixa-${de}-a-${ate}`, [
      { titulo: "Data", valor: (m) => dataBR(m.data) },
      { titulo: "Tipo", valor: (m) => ORIGEM[m.origem] },
      { titulo: "Descrição", valor: (m) => m.descricao },
      { titulo: "Pessoa", valor: (m) => m.pessoa },
      { titulo: "Categoria", valor: (m) => m.categoria },
      { titulo: "Centro de custo", valor: (m) => m.centroCusto },
      { titulo: "Conta bancária", valor: (m) => m.contaBancaria },
      { titulo: "Valor", valor: (m) => (m.entrada ? m.valor : -m.valor) },
    ], movimentos);
  }

  function gerarPdf() {
    if (!fluxo) return;
    const linhasDre = (lista) => lista.map((r) => `<tr><td>${escapeHtml(r.nome)}</td><td class="num">${brl(r.total)}</td></tr>`).join("");
    const linhas = movimentos
      .map((m) => `<tr><td>${dataBR(m.data)}</td><td>${ORIGEM[m.origem]}</td><td>${escapeHtml(m.descricao)}${m.pessoa ? ` (${escapeHtml(m.pessoa)})` : ""}</td><td>${escapeHtml(m.categoria)}</td><td class="num">${m.entrada ? "+" : "-"} ${brl(m.valor)}</td></tr>`)
      .join("");
    abrirRelatorio(
      `Fluxo de caixa ${dataBR(de)} a ${dataBR(ate)}`,
      `<h1>Fluxo de caixa${nomeConta ? ` — ${escapeHtml(nomeConta)}` : ""}</h1>
      <div class="muted">Período: ${dataBR(de)} a ${dataBR(ate)} · Gerado em ${new Date().toLocaleString("pt-BR")}</div>
      <div class="summary">
        <div class="box"><strong>Saldo inicial</strong><br/>${brl(fluxo.saldoInicial)}</div>
        <div class="box"><strong>Entradas</strong><br/>${brl(fluxo.entradas)}</div>
        <div class="box"><strong>Saídas</strong><br/>${brl(fluxo.saidas)}</div>
        <div class="box"><strong>Saldo final</strong><br/>${brl(fluxo.saldoFinal)}</div>
        <div class="box"><strong>A receber em aberto (vence no período)</strong><br/>${brl(fluxo.previstoReceber)}</div>
        <div class="box"><strong>A pagar em aberto (vence no período)</strong><br/>${brl(fluxo.previstoPagar)}</div>
      </div>
      <h2>DRE simplificado</h2>
      <table><thead><tr><th>Receitas por categoria</th><th class="num">Valor</th></tr></thead><tbody>${linhasDre(fluxo.dre.receitas) || '<tr><td colspan="2">Sem receitas.</td></tr>'}</tbody></table>
      <table><thead><tr><th>Despesas por categoria</th><th class="num">Valor</th></tr></thead><tbody>${linhasDre(fluxo.dre.despesas) || '<tr><td colspan="2">Sem despesas.</td></tr>'}</tbody></table>
      <h2>Lançamentos do período</h2>
      <table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th></tr></thead><tbody>${linhas || '<tr><td colspan="5">Nenhum lançamento.</td></tr>'}</tbody></table>
      <div class="total">Resultado do período: ${brl(fluxo.dre.resultado)}</div>`
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <Campo label="De">
          <input type="date" className={`${inputCls} w-40`} value={de} onChange={(e) => setDe(e.target.value)} />
        </Campo>
        <Campo label="Até">
          <input type="date" className={`${inputCls} w-40`} value={ate} onChange={(e) => setAte(e.target.value)} />
        </Campo>
        <Campo label="Conta bancária">
          <select className={`${inputCls} w-48`} value={contaBancariaId} onChange={(e) => setContaBancariaId(e.target.value)}>
            <option value="">Todas</option>
            {bancos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </Campo>
        <div className="ml-auto flex flex-wrap gap-2">
          <Botao variante="contorno" onClick={exportarExcel} disabled={!movimentos.length}>
            📊 Excel
          </Botao>
          <Botao variante="contorno" onClick={gerarPdf} disabled={!fluxo}>
            🖨 PDF do período
          </Botao>
          <Botao onClick={() => setLancamento({})}>＋ Novo lançamento</Botao>
        </div>
      </div>

      {fluxo && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Saldo inicial" valor={brl(fluxo.saldoInicial)} detalhe={`em ${dataBR(fluxo.de)}`} />
            <StatCard label="Entradas" valor={brl(fluxo.entradas)} tom="ok" />
            <StatCard label="Saídas" valor={brl(fluxo.saidas)} tom="crit" />
            <StatCard label="Saldo final" valor={brl(fluxo.saldoFinal)} tom={fluxo.saldoFinal < 0 ? "crit" : "neutro"} detalhe={`em ${dataBR(fluxo.ate)}`} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard icone="📥" label="A receber em aberto (vence no período)" valor={brl(fluxo.previstoReceber)} />
            <StatCard icone="📤" label="A pagar em aberto (vence no período)" valor={brl(fluxo.previstoPagar)} />
            <StatCard icone="🔮" label="Saldo projetado" valor={brl(fluxo.saldoProjetado)} tom={fluxo.saldoProjetado < 0 ? "crit" : "neutro"} detalhe="Saldo final + a receber − a pagar" destaque={fluxo.saldoProjetado < 0} />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
            <Card titulo="Fluxo de caixa diário">
              {fluxo.linhaDoTempo.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum movimento no período.</p>
              ) : (
                <div className="max-h-80 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-gray-100">
                        <th className={thCls}>Data</th>
                        <th className={thCls}>Entradas</th>
                        <th className={thCls}>Saídas</th>
                        <th className={thCls}>Saldo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {fluxo.linhaDoTempo.map((p) => (
                        <tr key={p.data}>
                          <td className="px-3 py-1.5">{dataBR(p.data)}</td>
                          <td className="px-3 py-1.5 text-emerald-700">{p.entradas ? brl(p.entradas) : "—"}</td>
                          <td className="px-3 py-1.5 text-red-600">{p.saidas ? brl(p.saidas) : "—"}</td>
                          <td className={`px-3 py-1.5 font-medium ${p.saldo < 0 ? "text-red-600" : ""}`}>{brl(p.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card titulo="DRE simplificado">
              <div className="grid gap-4 sm:grid-cols-2">
                <ListaDre titulo="Receitas por categoria" itens={fluxo.dre.receitas} total={fluxo.dre.receitaTotal} vazio="Sem receitas no período." />
                <ListaDre titulo="Despesas por categoria" itens={fluxo.dre.despesas} total={fluxo.dre.despesaTotal} vazio="Sem despesas no período." />
              </div>
              <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm font-semibold">
                <span>Resultado líquido</span>
                <span className={fluxo.dre.resultado < 0 ? "text-red-600" : "text-emerald-700"}>{brl(fluxo.dre.resultado)}</span>
              </div>
            </Card>
          </div>
        </>
      )}

      <Card titulo={`Lançamentos do período (${movimentos.length})`}>
        <p className="mb-3 text-sm text-gray-500">Tudo aqui é editável — clique em ✏️ para corrigir valor, data, categoria ou descrição.</p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className={thCls}>Data</th>
                <th className={thCls}>Tipo</th>
                <th className={thCls}>Descrição</th>
                <th className={thCls}>Categoria</th>
                <th className={thCls}>Conta</th>
                <th className={thCls}>Valor</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movimentos.length === 0 && <Vazio colSpan={7}>Nenhum lançamento no período.</Vazio>}
              {visiveis.map((m) => (
                <tr key={`${m.origem}-${m.id}`} className="hover:bg-blue-50/40">
                  <td className={`${tdCls} whitespace-nowrap`}>{dataBR(m.data)}</td>
                  <td className={`${tdCls} text-gray-500`}>{ORIGEM[m.origem]}</td>
                  <td className={tdCls}>
                    {m.descricao}
                    {m.pessoa && <span className="text-gray-500"> ({m.pessoa})</span>}
                  </td>
                  <td className={`${tdCls} text-gray-500`}>{m.categoria}</td>
                  <td className={`${tdCls} text-gray-500`}>{m.contaBancaria ?? "—"}</td>
                  <td className={`${tdCls} whitespace-nowrap font-medium ${m.entrada ? "text-emerald-700" : "text-red-600"}`}>
                    {m.entrada ? "+" : "−"} {brl(m.valor)}
                  </td>
                  <td className="whitespace-nowrap px-2 text-right">
                    <button type="button" className="rounded p-1 hover:bg-gray-100" title="Editar" onClick={() => (m.origem === "manual" ? setLancamento(m.registro) : setEditandoConta(m.registro))}>
                      ✏️
                    </button>
                    {m.origem === "manual" && (
                      <button type="button" className="rounded p-1 hover:bg-red-50" title="Excluir" onClick={() => excluirLancamento(m)}>
                        🗑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!mostrarTodos && movimentos.length > visiveis.length && (
          <div className="mt-2 text-center">
            <Botao variante="fantasma" onClick={() => setTodosPara(chaveFiltro)}>
              Ver mais ({visiveis.length} de {movimentos.length} lançamentos)
            </Botao>
          </div>
        )}
      </Card>

      <EditarContaDialog conta={editandoConta} onFechar={() => setEditandoConta(null)} onSalvo={recarregar} classificacoes={classificacoes} bancos={bancos} />
      <LancamentoDialog lancamento={lancamento} onFechar={() => setLancamento(null)} onSalvo={recarregar} classificacoes={classificacoes} bancos={bancos} />
    </div>
  );
}

function ListaDre({ titulo, itens, total, vazio }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-700">{titulo}</p>
      {itens.length === 0 && <p className="text-sm text-gray-500">{vazio}</p>}
      {itens.map((r) => (
        <div key={r.nome} className="flex justify-between gap-2 py-0.5 text-sm">
          <span className="text-gray-600">{r.nome}</span>
          <span>{brl(r.total)}</span>
        </div>
      ))}
      {itens.length > 0 && (
        <div className="mt-1 flex justify-between border-t border-gray-100 pt-1 text-sm font-medium">
          <span>Total</span>
          <span>{brl(total)}</span>
        </div>
      )}
    </div>
  );
}
