import { useCallback, useEffect, useMemo, useState } from "react";
import { Botao, Campo, Dialogo, InputSugestao, Rodape, Segmentado, StatCard, Vazio, inputCls, tdCls, thCls } from "./ui";
import { confirmar, useAviso, useVerMais } from "./hooks";
import { ContaFormDialog, EditarContaDialog } from "./ContaFormDialog";
import { SITUACAO, TEXTOS, abrirRelatorio, brl, dataBR, erroApi, escapeHtml, exportarCsv, gc, hoje } from "./utils";

// Contas a pagar / Contas a receber (mesmo componente, `tipo` PAGAR ou RECEBER):
// alertas de vencimento, totais do topo, abas de situação, período, filtros, seleção em
// lote, baixa, edição, estorno, cancelamento, exclusão, planilha e PDF.

const VISOES = [
  ["todas", "Todas"],
  ["aberto", "Em aberto"],
  ["vencidas", "Vencidas"],
  ["quitadas", null], // "Pagas" / "Recebidas"
  ["canceladas", "Canceladas"],
];

const FILTROS_VAZIOS = { busca: "", categoria: "", centroCusto: "", valor: "" };

export default function ContasPanel({ tipo, classificacoes, bancos, onAlterado }) {
  const t = TEXTOS[tipo];
  const avisar = useAviso();
  const [visao, setVisao] = useState("todas");
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [periodoPor, setPeriodoPor] = useState("vencimento");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [dados, setDados] = useState({ items: [], total: 0 });
  const [resumo, setResumo] = useState(null);
  const [alertas, setAlertas] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [selecionadas, setSelecionadas] = useState(new Set());
  const [novaAberta, setNovaAberta] = useState(false);
  const [editando, setEditando] = useState(null);
  const [quitando, setQuitando] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [loteAberto, setLoteAberto] = useState(false);

  // Filtros comuns à lista e aos totais do topo (os totais ignoram só a aba de situação).
  const paramsFiltro = useMemo(
    () => ({
      tipo,
      ...Object.fromEntries(Object.entries(filtros).map(([k, v]) => [k, v.trim() || undefined])),
      de: de || undefined,
      ate: ate || undefined,
      periodoPor: de || ate ? periodoPor : undefined,
    }),
    [tipo, filtros, de, ate, periodoPor]
  );
  const temFiltro = Object.entries(paramsFiltro).some(([k, v]) => k !== "tipo" && v);
  const chave = JSON.stringify({ visao, paramsFiltro });
  const { pageSize, verMais } = useVerMais(chave);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [lista, res, al] = await Promise.all([gc.contas({ ...paramsFiltro, situacao: visao, pageSize }), gc.resumoContas(paramsFiltro), gc.alertas()]);
      setDados(lista);
      setResumo(res);
      setAlertas(al[tipo] ? { ...al[tipo], diasAviso: al.diasAviso } : null);
    } catch (err) {
      avisar(erroApi(err, "Erro ao carregar as contas."), "erro");
    } finally {
      setCarregando(false);
    }
  }, [paramsFiltro, visao, pageSize, tipo, avisar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Trocou de aba ou filtro: a seleção antiga não vale mais.
  useEffect(() => setSelecionadas(new Set()), [chave]);

  function recarregar() {
    carregar();
    onAlterado?.();
  }

  const abertasNaTela = dados.items.filter((c) => c.status === "PENDENTE");
  const todasSelecionadas = abertasNaTela.length > 0 && abertasNaTela.every((c) => selecionadas.has(c.id));
  const selecionadasLista = abertasNaTela.filter((c) => selecionadas.has(c.id));
  const venceEmBreve = (c) => c.situacao === "PENDENTE" && c.vencimento <= somarDiasLocal(hoje(), alertas?.diasAviso ?? 3);

  function alternar(id, marcado) {
    setSelecionadas((prev) => {
      const prox = new Set(prev);
      if (marcado) prox.add(id);
      else prox.delete(id);
      return prox;
    });
  }

  async function acao(fn, sucesso, falha) {
    try {
      await fn();
      avisar(sucesso);
      recarregar();
    } catch (err) {
      avisar(erroApi(err, falha), "erro");
    }
  }

  async function cancelar(conta) {
    if (!(await confirmar("Cancelar conta?", `"${conta.descricao}" — ${brl(conta.valor)}. Ela sai dos totais, mas fica no histórico.`, "Cancelar conta"))) return;
    acao(() => gc.cancelar(conta.id), "Conta cancelada.", "Não foi possível cancelar.");
  }

  async function reabrir(conta) {
    const texto = conta.status === "QUITADA" ? `Desfazer a baixa de "${conta.descricao}"? Ela volta a ficar em aberto.` : `Reativar "${conta.descricao}"?`;
    if (!(await confirmar(conta.status === "QUITADA" ? "Estornar baixa?" : "Reativar conta?", texto, "Sim", false))) return;
    acao(() => gc.reabrir(conta.id), "Conta reaberta.", "Não foi possível reabrir.");
  }

  async function excluir(conta) {
    if (!(await confirmar("Excluir conta?", `"${conta.descricao}" — ${brl(conta.valor)}. Isso não pode ser desfeito.`, "Excluir"))) return;
    let futuras = false;
    if (conta.grupoParcelasId && conta.parcelaNumero < conta.parcelaTotal) {
      futuras = await confirmar("Excluir as próximas também?", `Excluir também as parcelas seguintes (${conta.parcelaNumero + 1} a ${conta.parcelaTotal}) que ainda estão em aberto?`, "Sim, excluir as próximas", true);
    }
    acao(() => gc.excluir(conta.id, futuras), "Conta excluída.", "Não foi possível excluir.");
  }

  async function todasParaExportar() {
    if (pageSize === "all" || dados.total <= dados.items.length) return dados.items;
    return (await gc.contas({ ...paramsFiltro, situacao: visao, pageSize: "all" })).items;
  }

  const rotuloVisao = (k, l) => l ?? t.quitadas;
  const subtitulo = [
    `${rotuloVisao(visao, VISOES.find(([k]) => k === visao)[1])}.`,
    (de || ate) && `${periodoPor === "quitacao" ? t.quitadoEm.replace(" em", "") : "Vencimento"}${de ? ` de ${dataBR(de)}` : ""}${ate ? ` até ${dataBR(ate)}` : ""}.`,
    filtros.busca && `Busca: "${filtros.busca}".`,
    filtros.categoria && `Categoria: ${filtros.categoria}.`,
  ]
    .filter(Boolean)
    .join(" ");

  async function exportarExcel() {
    const linhas = await todasParaExportar();
    exportarCsv(tipo === "PAGAR" ? "contas-a-pagar" : "contas-a-receber", COLUNAS(t), linhas);
  }

  async function gerarPdf() {
    const linhas = await todasParaExportar();
    const corpo = linhas
      .map(
        (c) => `<tr><td>${dataBR(c.vencimento)}</td><td>${escapeHtml(descricaoParcela(c))}</td><td>${escapeHtml(c.pessoa ?? "—")}</td><td>${escapeHtml(c.categoria)}</td>
        <td>${SITUACAO[c.situacao].label}</td><td>${c.dataQuitacao ? dataBR(c.dataQuitacao) : "—"}</td><td class="num">${brl(c.valor)}</td></tr>`
      )
      .join("");
    const total = linhas.reduce((s, c) => s + c.valor, 0);
    abrirRelatorio(
      t.titulo,
      `<h1>${t.titulo}</h1><div class="muted">${escapeHtml(subtitulo)} · Gerado em ${new Date().toLocaleString("pt-BR")}</div>
      ${resumo ? `<div class="summary"><div class="box"><strong>${t.aberto}</strong><br/>${brl(resumo.aberto.total)} (${resumo.aberto.count})</div>
      <div class="box"><strong>Vencido</strong><br/>${brl(resumo.vencido.total)} (${resumo.vencido.count})</div>
      <div class="box"><strong>${t.totalQuitado}</strong><br/>${brl(resumo.quitado.total)} (${resumo.quitado.count})</div></div>` : ""}
      <table><thead><tr><th>Vencimento</th><th>Descrição</th><th>${t.pessoa}</th><th>Categoria</th><th>Situação</th><th>${t.quitadoEm}</th><th class="num">Valor</th></tr></thead>
      <tbody>${corpo || '<tr><td colspan="7">Nenhuma conta.</td></tr>'}</tbody></table>
      <div class="total">Total listado: ${brl(total)} (${linhas.length} contas)</div>`
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {alertas?.vencidas.count > 0 && (
        <button type="button" onClick={() => setVisao("vencidas")} className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-left text-sm font-medium text-red-700">
          <span className="animate-pulse text-lg">⚠️</span>
          <span className="animate-pulse">
            {alertas.vencidas.count} conta{alertas.vencidas.count === 1 ? "" : "s"} vencida{alertas.vencidas.count === 1 ? "" : "s"} — {brl(alertas.vencidas.total)}
          </span>
          <span className="ml-auto text-xs font-normal underline">Ver vencidas</span>
        </button>
      )}
      {alertas?.emBreve.count > 0 && (
        <button type="button" onClick={() => setVisao("aberto")} className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-left text-sm font-medium text-amber-800">
          <span className="text-lg">⏰</span>
          {alertas.emBreve.count} conta{alertas.emBreve.count === 1 ? "" : "s"} vence{alertas.emBreve.count === 1 ? "" : "m"} até os próximos {alertas.diasAviso} dias — {brl(alertas.emBreve.total)}
          <span className="ml-auto text-xs font-normal underline">Ver em aberto</span>
        </button>
      )}

      <div className="grid gap-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icone="🕒" label={t.aberto} valor={resumo ? brl(resumo.aberto.total) : "—"} detalhe={resumo && contas(resumo.aberto.count)} />
          <StatCard
            icone="⚠️"
            label="Vencido (dentro do em aberto)"
            valor={resumo ? brl(resumo.vencido.total) : "—"}
            tom={resumo?.vencido.count ? "crit" : "neutro"}
            destaque={resumo?.vencido.count > 0}
            detalhe={resumo && contas(resumo.vencido.count)}
          />
          <StatCard icone="✅" label={t.totalQuitado} valor={resumo ? brl(resumo.quitado.total) : "—"} tom="ok" detalhe={resumo && contas(resumo.quitado.count)} />
        </div>
        <p className="text-xs text-gray-500">{temFiltro ? "Totais de acordo com os filtros abaixo." : "Totais gerais (sem filtro)."} Contas canceladas não entram.</p>
      </div>

      <Segmentado opcoes={VISOES.map(([k, l]) => [k, rotuloVisao(k, l)])} valor={visao} onChange={setVisao} />

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-2">
          <Campo label="Período por">
            <select className={`${inputCls} w-40`} value={periodoPor} onChange={(e) => setPeriodoPor(e.target.value)}>
              <option value="vencimento">Vencimento</option>
              <option value="quitacao">{tipo === "PAGAR" ? "Pagamento" : "Recebimento"}</option>
            </select>
          </Campo>
          <Campo label="De">
            <input type="date" className={`${inputCls} w-40`} value={de} onChange={(e) => setDe(e.target.value)} />
          </Campo>
          <Campo label="Até">
            <input type="date" className={`${inputCls} w-40`} value={ate} onChange={(e) => setAte(e.target.value)} />
          </Campo>
          <div className="flex flex-wrap gap-1 pb-0.5">
            {ATALHOS.map(([rotulo, fn]) => (
              <Botao key={rotulo} variante="fantasma" pequeno onClick={() => { const [a, b] = fn(); setDe(a); setAte(b); }}>
                {rotulo}
              </Botao>
            ))}
            {(de || ate) && (
              <Botao variante="fantasma" pequeno onClick={() => { setDe(""); setAte(""); }}>
                ✕ Limpar período
              </Botao>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Campo label="Buscar">
            <input className={`${inputCls} w-56`} placeholder={`Descrição, ${tipo === "PAGAR" ? "fornecedor" : "cliente"}, documento...`} value={filtros.busca} onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))} />
          </Campo>
          <Campo label="Categoria">
            <InputSugestao id={`gc-f-cat-${tipo}`} opcoes={classificacoes?.categorias?.[tipo]} className={`${inputCls} w-48`} value={filtros.categoria} onChange={(e) => setFiltros((f) => ({ ...f, categoria: e.target.value }))} placeholder="Todas" />
          </Campo>
          <Campo label="Centro de custo">
            <InputSugestao id={`gc-f-cc-${tipo}`} opcoes={classificacoes?.centrosCusto} className={`${inputCls} w-44`} value={filtros.centroCusto} onChange={(e) => setFiltros((f) => ({ ...f, centroCusto: e.target.value }))} placeholder="Todos" />
          </Campo>
          <Campo label="Valor exato">
            <input inputMode="decimal" className={`${inputCls} w-28`} placeholder="0,00" value={filtros.valor} onChange={(e) => setFiltros((f) => ({ ...f, valor: e.target.value }))} />
          </Campo>
          {Object.values(filtros).some(Boolean) && (
            <Botao variante="fantasma" pequeno className="mb-1" onClick={() => setFiltros(FILTROS_VAZIOS)}>
              ✕ Limpar filtros
            </Botao>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Botao variante="contorno" onClick={exportarExcel} disabled={!dados.total} title="Baixar a lista (abre no Excel)">
              📊 Excel
            </Botao>
            <Botao variante="contorno" onClick={gerarPdf} disabled={!dados.total}>
              🖨 PDF
            </Botao>
            <Botao onClick={() => setNovaAberta(true)}>＋ {t.nova}</Botao>
          </div>
        </div>
      </div>

      {abertasNaTela.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={todasSelecionadas} onChange={(e) => setSelecionadas(e.target.checked ? new Set(abertasNaTela.map((c) => c.id)) : new Set())} />
            Selecionar tudo ({abertasNaTela.length} em aberto na tela)
          </label>
          <Botao pequeno variante="sucesso" disabled={selecionadasLista.length === 0} onClick={() => setLoteAberto(true)}>
            ✔ Marcar como {t.verbo}
            {selecionadasLista.length ? ` (${selecionadasLista.length})` : ""}
          </Botao>
          {selecionadasLista.length > 0 && <span className="text-xs text-gray-500">Total selecionado: {brl(selecionadasLista.reduce((s, c) => s + c.valor, 0))}</span>}
          {dados.total > dados.items.length && <span className="text-xs text-gray-500">Use &ldquo;Ver mais&rdquo; para incluir as outras {dados.total - dados.items.length} contas.</span>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-3" />
              <th className={thCls}>Descrição</th>
              <th className={thCls}>{tipo === "PAGAR" ? "Fornecedor" : "Cliente"}</th>
              <th className={thCls}>Valor</th>
              <th className={thCls}>Vencimento</th>
              <th className={thCls}>{t.quitadoEm}</th>
              <th className={thCls}>Situação</th>
              <th className="w-48" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {carregando && dados.items.length === 0 && <Vazio colSpan={8}>Carregando...</Vazio>}
            {!carregando && dados.items.length === 0 && <Vazio colSpan={8}>{MSG_VAZIO[visao] ?? "Nenhuma conta encontrada."}</Vazio>}
            {dados.items.map((c) => (
              <tr key={c.id} className={`transition hover:bg-blue-50/40 ${selecionadas.has(c.id) ? "bg-blue-50/60" : ""}`}>
                <td className="px-3 py-2.5 align-top">
                  {c.status === "PENDENTE" && <input type="checkbox" checked={selecionadas.has(c.id)} onChange={(e) => alternar(c.id, e.target.checked)} aria-label={`Selecionar ${c.descricao}`} />}
                </td>
                <td className={tdCls}>
                  <button type="button" className="text-left font-medium hover:underline" onClick={() => setDetalhe(c)} title="Ver detalhes">
                    {c.descricao}
                  </button>
                  {c.parcelaTotal && (
                    <span className="ml-1 text-xs text-gray-500">
                      ({c.parcelaNumero}/{c.parcelaTotal}){c.recorrente ? " ↻" : ""}
                    </span>
                  )}
                  <span className="block text-xs text-gray-500">
                    {c.categoria}
                    {c.centroCusto ? ` · ${c.centroCusto}` : ""}
                    {c.documento ? ` · doc. ${c.documento}` : ""}
                  </span>
                </td>
                <td className={`${tdCls} text-gray-600`}>{c.pessoa || "—"}</td>
                <td className={`${tdCls} whitespace-nowrap font-medium`}>{brl(c.valor)}</td>
                <td className={`${tdCls} whitespace-nowrap text-gray-600`}>{dataBR(c.vencimento)}</td>
                <td className={`${tdCls} whitespace-nowrap text-gray-600`}>
                  {c.dataQuitacao ? dataBR(c.dataQuitacao) : "—"}
                  {c.valorQuitado != null && c.valorQuitado !== c.valor && <span className="block text-xs">{brl(c.valorQuitado)}</span>}
                </td>
                <td className={tdCls}>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${SITUACAO[c.situacao].classe}`}>
                    {c.situacao === "QUITADA" ? t.quitada : SITUACAO[c.situacao].label}
                  </span>
                  {venceEmBreve(c) && <span className="mt-1 block w-fit rounded-full border border-amber-300 px-2 py-0.5 text-xs text-amber-700">Vence em breve</span>}
                </td>
                <td className="px-3 py-2 text-right align-top">
                  <div className="flex justify-end gap-1 whitespace-nowrap">
                    {c.status === "PENDENTE" && (
                      <Botao pequeno variante="sucesso" onClick={() => setQuitando(c)}>
                        {t.quitar}
                      </Botao>
                    )}
                    <Botao pequeno variante="fantasma" onClick={() => setEditando(c)} title="Editar">
                      ✏️
                    </Botao>
                    {c.status === "PENDENTE" ? (
                      <Botao pequeno variante="perigo" onClick={() => cancelar(c)} title="Cancelar conta">
                        Cancelar
                      </Botao>
                    ) : (
                      <Botao pequeno variante="fantasma" onClick={() => reabrir(c)} title={c.status === "QUITADA" ? "Estornar a baixa" : "Reativar"}>
                        ↩ {c.status === "QUITADA" ? "Estornar" : "Reativar"}
                      </Botao>
                    )}
                    <Botao pequeno variante="perigo" onClick={() => excluir(c)} title="Excluir">
                      🗑
                    </Botao>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {dados.total > dados.items.length && (
          <div className="border-t border-gray-100 p-2 text-center">
            <Botao variante="fantasma" onClick={verMais} disabled={carregando}>
              {carregando ? "Carregando..." : `Ver mais (${dados.items.length} de ${dados.total} contas)`}
            </Botao>
          </div>
        )}
      </div>

      <ContaFormDialog tipo={tipo} aberto={novaAberta} onFechar={() => setNovaAberta(false)} onSalvo={recarregar} classificacoes={classificacoes} bancos={bancos} />
      <EditarContaDialog conta={editando} onFechar={() => setEditando(null)} onSalvo={recarregar} classificacoes={classificacoes} bancos={bancos} />
      <QuitarDialog conta={quitando} onFechar={() => setQuitando(null)} onSalvo={recarregar} bancos={bancos} formas={classificacoes?.formasPagamento} />
      <QuitarLoteDialog tipo={tipo} aberto={loteAberto} contas={selecionadasLista} bancos={bancos} onFechar={() => setLoteAberto(false)} onSalvo={() => { setSelecionadas(new Set()); recarregar(); }} />
      <DetalhesDialog conta={detalhe} onFechar={() => setDetalhe(null)} />
    </div>
  );
}

function somarDiasLocal(dia, dias) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const contas = (n) => `${n} conta${n === 1 ? "" : "s"}`;
const descricaoParcela = (c) => (c.parcelaTotal ? `${c.descricao} (${c.parcelaNumero}/${c.parcelaTotal})` : c.descricao);

const MSG_VAZIO = {
  aberto: "Nenhuma conta em aberto. 🎉",
  vencidas: "Nenhuma conta vencida. 🎉",
  quitadas: "Nenhuma conta quitada.",
  canceladas: "Nenhuma conta cancelada.",
};

// Atalhos de período (de, até).
const ATALHOS = [
  ["Este mês", () => { const h = hoje(); const [a, m] = h.split("-").map(Number); return [`${h.slice(0, 7)}-01`, new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)]; }],
  ["Próx. 7 dias", () => [hoje(), somarDiasLocal(hoje(), 7)]],
  ["Próx. 30 dias", () => [hoje(), somarDiasLocal(hoje(), 30)]],
];

const COLUNAS = (t) => [
  { titulo: "Descrição", valor: descricaoParcela },
  { titulo: t.pessoa, valor: (c) => c.pessoa },
  { titulo: "Categoria", valor: (c) => c.categoria },
  { titulo: "Grupo", valor: (c) => c.grupo },
  { titulo: "Centro de custo", valor: (c) => c.centroCusto },
  { titulo: "Documento", valor: (c) => c.documento },
  { titulo: "Vencimento", valor: (c) => dataBR(c.vencimento) },
  { titulo: "Situação", valor: (c) => SITUACAO[c.situacao].label },
  { titulo: "Valor", valor: (c) => c.valor },
  { titulo: t.quitadoEm, valor: (c) => (c.dataQuitacao ? dataBR(c.dataQuitacao) : "") },
  { titulo: t.valorQuitado, valor: (c) => c.valorQuitado },
  { titulo: "Forma", valor: (c) => c.formaPagamento },
  { titulo: "Conta bancária", valor: (c) => c.contaBancaria?.nome },
  { titulo: "Observação", valor: (c) => c.observacao },
];

/** Baixa de uma conta: data (até hoje), valor efetivo (juros/desconto), conta bancária e forma. */
function QuitarDialog({ conta, onFechar, onSalvo, bancos, formas }) {
  const avisar = useAviso();
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (conta) setForm({ data: hoje(), valor: String(conta.valor), contaBancariaId: conta.contaBancariaId ?? "", formaPagamento: conta.formaPagamento ?? "" });
  }, [conta]);
  if (!conta || !form) return null;
  const t = TEXTOS[conta.tipo];
  const diff = Math.round(((Number(form.valor) || 0) - conta.valor) * 100) / 100;

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await gc.quitar(conta.id, form);
      avisar(`Conta baixada como ${t.quitada.toLowerCase()}.`);
      onSalvo();
      onFechar();
    } catch (err) {
      avisar(erroApi(err, "Não foi possível dar baixa."), "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialogo aberto onFechar={onFechar} titulo={`${t.quitar} “${conta.descricao}”`} descricao={`Valor da conta: ${brl(conta.valor)} · vence ${dataBR(conta.vencimento)}`} largura="max-w-md">
      <form onSubmit={salvar} className="grid gap-3">
        <Campo label={t.dataQuitacao}>
          <input type="date" required max={hoje()} className={inputCls} value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
        </Campo>
        <Campo label={t.valorQuitado} dica={diff !== 0 && Number(form.valor) ? (diff > 0 ? `+${brl(diff)} (juros/multa)` : `${brl(diff)} (desconto)`) : null}>
          <input type="number" min="0" step="0.01" className={inputCls} value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} />
        </Campo>
        <Campo label="Conta bancária">
          <select className={inputCls} value={form.contaBancariaId} onChange={(e) => setForm((f) => ({ ...f, contaBancariaId: e.target.value }))}>
            <option value="">—</option>
            {bancos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Forma de pagamento">
          <InputSugestao id="gc-q-forma" opcoes={formas} value={form.formaPagamento} onChange={(e) => setForm((f) => ({ ...f, formaPagamento: e.target.value }))} placeholder="PIX" />
        </Campo>
        <Rodape>
          <Botao variante="contorno" onClick={onFechar}>
            Voltar
          </Botao>
          <Botao type="submit" variante="sucesso" disabled={salvando}>
            {salvando ? "Salvando..." : `Confirmar ${conta.tipo === "PAGAR" ? "pagamento" : "recebimento"}`}
          </Botao>
        </Rodape>
      </form>
    </Dialogo>
  );
}

/** "Marcar como pagas/recebidas": pergunta se mantém hoje; se não, uma data por conta. */
function QuitarLoteDialog({ tipo, aberto, contas: lista, bancos, onFechar, onSalvo }) {
  const t = TEXTOS[tipo];
  const avisar = useAviso();
  const [passo, setPasso] = useState("pergunta");
  const [datas, setDatas] = useState({});
  const [todas, setTodas] = useState(hoje());
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setPasso("pergunta");
    setDatas(Object.fromEntries(lista.map((c) => [c.id, hoje()])));
    setTodas(hoje());
    setContaBancariaId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  async function baixar(comDatas) {
    if (comDatas && lista.some((c) => !datas[c.id] || datas[c.id] > hoje())) return avisar(`Informe uma ${t.dataQuitacao.toLowerCase()} (até hoje) para cada conta.`, "erro");
    setOcupado(true);
    try {
      const n = await gc.quitarLote({ itens: lista.map((c) => ({ id: c.id, data: comDatas ? datas[c.id] : hoje() })), contaBancariaId: contaBancariaId || undefined });
      avisar(`${n} conta(s) marcada(s) como ${t.quitada.toLowerCase()}(s).`);
      onSalvo();
      onFechar();
    } catch (err) {
      avisar(erroApi(err, `Não foi possível marcar as contas como ${t.verbo}.`), "erro");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Dialogo
      aberto={aberto}
      onFechar={onFechar}
      titulo={`Marcar ${lista.length} conta${lista.length === 1 ? "" : "s"} como ${lista.length === 1 ? t.quitada.toLowerCase() : t.verbo}`}
      descricao={`Total: ${brl(lista.reduce((s, c) => s + c.valor, 0))} — cada conta é baixada com o valor cheio.`}
    >
      <Campo label="Conta bancária (opcional — senão usa a prevista de cada conta)" className="mb-3">
        <select className={inputCls} value={contaBancariaId} onChange={(e) => setContaBancariaId(e.target.value)}>
          <option value="">— manter a de cada conta —</option>
          {bancos.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nome}
            </option>
          ))}
        </select>
      </Campo>
      {passo === "pergunta" ? (
        <>
          <p className="text-sm font-medium">Manter a {t.dataQuitacao.toLowerCase()} como hoje?</p>
          <Rodape>
            <Botao variante="contorno" disabled={ocupado} onClick={() => setPasso("datas")}>
              Não, escolher as datas
            </Botao>
            <Botao variante="sucesso" disabled={ocupado} onClick={() => baixar(false)}>
              {ocupado ? "Marcando..." : "Sim, hoje"}
            </Botao>
          </Rodape>
        </>
      ) : (
        <>
          <Campo label="Aplicar a mesma data a todas" className="mb-3 w-48">
            <input
              type="date"
              max={hoje()}
              className={inputCls}
              value={todas}
              onChange={(e) => {
                setTodas(e.target.value);
                if (e.target.value) setDatas(Object.fromEntries(lista.map((c) => [c.id, e.target.value])));
              }}
            />
          </Campo>
          <div className="grid gap-2">
            {lista.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{descricaoParcela(c)}</div>
                  <div className="text-xs text-gray-500">
                    {c.pessoa ? `${c.pessoa} · ` : ""}
                    {brl(c.valor)} · vence {dataBR(c.vencimento)}
                  </div>
                </div>
                <input type="date" max={hoje()} className={`${inputCls} w-40 py-1`} value={datas[c.id] ?? ""} onChange={(e) => setDatas((p) => ({ ...p, [c.id]: e.target.value }))} aria-label={`${t.dataQuitacao} de ${c.descricao}`} />
              </div>
            ))}
          </div>
          <Rodape>
            <Botao variante="contorno" disabled={ocupado} onClick={() => setPasso("pergunta")}>
              Voltar
            </Botao>
            <Botao variante="sucesso" disabled={ocupado} onClick={() => baixar(true)}>
              {ocupado ? "Marcando..." : `Confirmar ${tipo === "PAGAR" ? "pagamento" : "recebimento"}`}
            </Botao>
          </Rodape>
        </>
      )}
    </Dialogo>
  );
}

function DetalhesDialog({ conta, onFechar }) {
  if (!conta) return null;
  const t = TEXTOS[conta.tipo];
  const linhas = [
    [t.pessoa, conta.pessoa],
    ["Situação", conta.situacao === "QUITADA" ? t.quitada : SITUACAO[conta.situacao].label],
    ["Valor", brl(conta.valor)],
    ["Vencimento", dataBR(conta.vencimento)],
    [t.quitadoEm, conta.dataQuitacao ? dataBR(conta.dataQuitacao) : null],
    [t.valorQuitado, conta.valorQuitado != null ? brl(conta.valorQuitado) : null],
    ["Forma de pagamento", conta.formaPagamento],
    ["Conta bancária", conta.contaBancaria?.nome],
    ["Categoria", conta.categoria],
    ["Grupo", conta.grupo],
    ["Centro de custo", conta.centroCusto],
    ["Documento", conta.documento],
    ["Parcela", conta.parcelaTotal ? `${conta.parcelaNumero}/${conta.parcelaTotal}${conta.recorrente ? " (recorrente)" : ""}` : null],
    ["Lançado por", conta.criadoPor?.nome],
    ["Lançado em", conta.createdAt ? new Date(conta.createdAt).toLocaleString("pt-BR") : null],
    ["Observação", conta.observacao],
  ];
  return (
    <Dialogo aberto onFechar={onFechar} titulo={conta.descricao} largura="max-w-md">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {linhas
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-gray-500">{k}</dt>
              <dd className="whitespace-pre-wrap break-words">{v}</dd>
            </div>
          ))}
      </dl>
    </Dialogo>
  );
}
