import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const CHART_COLORS = [
  "#ef4444","#f59e0b","#22c55e","#3b82f6","#a855f7",
  "#ec4899","#14b8a6","#f97316","#6366f1","#84cc16",
];

export function Graficos() {
  const [loading, setLoading] = useState(true);
  const [lojas, setLojas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [dadosProcessados, setDadosProcessados] = useState(null);
  const [custosVariaveisInput, setCustosVariaveisInput] = useState("");
  const [custosVariaveis, setCustosVariaveis] = useState(0);

  useEffect(() => {
    carregarLojas();
  }, []);

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);

      // Monta params do balanco — mesmo calculo do Dashboard mas no periodo escolhido
      const params = { dataInicio, dataFim };
      if (lojaSelecionada) params.lojaId = lojaSelecionada;

      const [maquinasRes, movimentacoesRes, produtosRes, balancoRes] = await Promise.all([
        api.get("/maquinas"),
        api.get("/movimentacoes"),
        api.get("/produtos"),
        api.get("/relatorios/balanco-semanal", { params }).catch(() => ({ data: null })),
      ]);

      // Filtra por loja se selecionada, senao usa todas
      let maquinas = maquinasRes.data || [];
      if (lojaSelecionada) {
        maquinas = maquinas.filter(m =>
          String(m.lojaId ?? m.loja_id ?? "") === String(lojaSelecionada)
        );
      }

      // Usa Set de strings para comparacao robusta (API pode retornar int ou string)
      const maquinaIds = new Set(maquinas.map(m => String(m.id)));
      const movFiltradas = (movimentacoesRes.data || []).filter((mov) => {
        const movData = new Date(mov.createdAt);
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim + "T23:59:59");
        // Aceita tanto maquinaId (camelCase) quanto maquina_id (snake_case)
        const maqId = String(mov.maquinaId ?? mov.maquina_id ?? "");
        return maquinaIds.has(maqId) && movData >= inicio && movData <= fim;
      });

      processarDados(maquinas, movFiltradas, produtosRes.data || [], lojas, balancoRes.data);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [lojaSelecionada, dataInicio, dataFim, lojas]);

  useEffect(() => {
    if (dataInicio && dataFim && lojas.length > 0) {
      carregarDados();
    }
  }, [lojaSelecionada, dataInicio, dataFim, lojas, carregarDados]);

  const carregarLojas = async () => {
    try {
      setLoading(true);
      const lojasRes = await api.get("/lojas");
      setLojas(lojasRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar lojas:", error);
    } finally {
      setLoading(false);
    }
  };

  const processarDados = (maquinas, movs, produtos, lojasList, balanco) => {
    // Helper: converte campo da API (pode vir como string) para numero
    const n = v => Number(v) || 0;

    // ===== FATURAMENTO REAL via balanco-semanal (mesmo calculo do Dashboard) =====
    // O backend soma valorFaturado de cada movimentacao no periodo
    const faturamentoBalanco = n(balanco?.totais?.totalFaturamento);
    const saidasBalanco = n(balanco?.totais?.totalSairam ?? balanco?.totais?.totalProdutosSairam);

    // Preco medio de todos os produtos ativos com preco cadastrado
    const prodComPreco = produtos.filter(p => n(p.preco) > 0);
    const precoMedio = prodComPreco.length > 0
      ? prodComPreco.reduce((s, p) => s + n(p.preco), 0) / prodComPreco.length
      : 0;

    // Dados por maquina
    const porMaquina = maquinas.map(maq => {
      const maqId = String(maq.id);
      const movsMaq = movs.filter(m =>
        String(m.maquinaId ?? m.maquina_id ?? "") === maqId
      );

      const totalSaidas = movsMaq.reduce((s, m) => s + n(m.sairam), 0);
      const totalEntradas = movsMaq.reduce((s, m) => s + n(m.abastecidas), 0);

      // Faturamento real (campos financeiros da movimentacao) ou estimado pelo preco medio
      const fatReal = movsMaq.reduce((s, m) =>
        s + n(m.valorEntradaNotas) + n(m.valorEntradaCartao) + n(m.valorEntradaFichas), 0
      );
      // Estimativa por maquina para o grafico de barras (nao usada no KPI financeiro)
      const faturamento = fatReal > 0 ? fatReal : totalSaidas * precoMedio;

      const pct = n(maq.percentualComissao);
      const custoProd = totalSaidas * precoMedio;
      const custoComissao = faturamento * (pct / 100);

      const ultimaMov = [...movsMaq].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      const estoque = ultimaMov
        ? n(ultimaMov.totalPre) + n(ultimaMov.abastecidas) - n(ultimaMov.sairam)
        : n(maq.estoqueAtual);

      return {
        id: maq.id, lojaId: maq.lojaId ?? maq.loja_id, nome: maq.nome, codigo: maq.codigo,
        totalSaidas, totalEntradas, faturamento, custoProd, custoComissao,
        percentualComissao: pct, estoque, capacidade: n(maq.capacidadePadrao),
        numMovs: movsMaq.length,
      };
    });

    // Por loja — prioriza distribuicaoLojas do balanco (dado real do backend)
    let porLoja;
    if (balanco?.distribuicaoLojas?.length > 0) {
      porLoja = balanco.distribuicaoLojas.map(l => ({
        lojaId: l.lojaId ?? l.nome,
        lojaNome: l.nome,
        faturamento: n(l.faturamento),
        custoProd: 0,       // backend nao retorna custo por loja — sera calculado abaixo se disponivel
        custoComissao: 0,
        saidas: n(l.sairam ?? l.produtosVendidos),
        numMaq: 0,
      }));
      // Soma custos por loja a partir dos dados por maquina
      porMaquina.forEach(m => {
        const entry = porLoja.find(l => l.lojaNome === (lojasList || []).find(x => String(x.id) === String(m.lojaId))?.nome);
        if (entry) {
          entry.custoProd += m.custoProd;
          entry.custoComissao += m.custoComissao;
          entry.numMaq += 1;
        }
      });
    } else {
      // Fallback: agrega manualmente a partir dos dados de maquina
      const lojaMap = {};
      porMaquina.forEach(m => {
        const lid = String(m.lojaId);
        if (!lojaMap[lid]) {
          const loja = (lojasList || []).find(l => String(l.id) === lid);
          lojaMap[lid] = { lojaId: lid, lojaNome: loja ? loja.nome : "Loja ?",
            faturamento: 0, custoProd: 0, custoComissao: 0, saidas: 0, numMaq: 0 };
        }
        lojaMap[lid].faturamento += m.faturamento;
        lojaMap[lid].custoProd += m.custoProd;
        lojaMap[lid].custoComissao += m.custoComissao;
        lojaMap[lid].saidas += m.totalSaidas;
        lojaMap[lid].numMaq += 1;
      });
      porLoja = Object.values(lojaMap).sort((a, b) => b.faturamento - a.faturamento);
    }

    // ===== Totais financeiros — usa faturamento real do balanco quando disponivel =====
    const lucroBruto = faturamentoBalanco > 0
      ? faturamentoBalanco
      : porMaquina.reduce((s, m) => s + m.faturamento, 0);
    const totalSaidasReal = saidasBalanco > 0
      ? saidasBalanco
      : porMaquina.reduce((s, m) => s + m.totalSaidas, 0);
    const custoProdTotal = totalSaidasReal * precoMedio;
    const custoComTotal = porMaquina.reduce((s, m) => s + m.custoComissao, 0);

    setDadosProcessados({
      porMaquina,
      porLoja,
      totais: {
        saidas: totalSaidasReal,
        entradas: porMaquina.reduce((s, m) => s + m.totalEntradas, 0),
        movs: movs.length,
        maquinas: maquinas.length,
      },
      financeiro: { lucroBruto, custoProdutos: custoProdTotal, custoComissao: custoComTotal, precoMedio },
      origemFaturamento: faturamentoBalanco > 0 ? "backend" : "estimado",
    });
  };

  const aplicarCustosVariaveis = () => {
    const v = parseFloat(custosVariaveisInput.replace(",", ".")) || 0;
    setCustosVariaveis(v);
  };

  const lucroLiquido = dadosProcessados
    ? dadosProcessados.financeiro.lucroBruto
      - dadosProcessados.financeiro.custoProdutos
      - dadosProcessados.financeiro.custoComissao
      - custosVariaveis
    : 0;

  if (loading && lojas.length === 0) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="📊 Gráficos e Relatórios"
          subtitle="Desempenho financeiro e operacional das máquinas"
          icon="📈"
        />

        {/* ===== FILTROS ===== */}
        <div className="card mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">🔍 Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">🏪 Loja</label>
              <select
                value={lojaSelecionada}
                onChange={e => setLojaSelecionada(e.target.value)}
                className="input-field w-full"
              >
                <option value="">📦 Todas as lojas</option>
                {lojas.map(l => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">📅 Data Inicial</label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">📅 Data Final</label>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">💸 Custos Variáveis (R$)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: 350,00"
                  value={custosVariaveisInput}
                  onChange={e => setCustosVariaveisInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && aplicarCustosVariaveis()}
                  className="input-field flex-1"
                />
                <button
                  onClick={aplicarCustosVariaveis}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                  title="Aplicar"
                >
                  ✓
                </button>
              </div>
              {custosVariaveis > 0 && (
                <p className="text-xs text-indigo-700 mt-1 font-medium">✓ R$ {custosVariaveis.toFixed(2)}</p>
              )}
            </div>
          </div>
        </div>

        {loading && (dataInicio && dataFim) ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="text-gray-600 mt-4">Carregando dados...</p>
          </div>
        ) : !dataInicio || !dataFim ? (
          <div className="text-center py-12 card">
            <p className="text-6xl mb-4">📊</p>
            <p className="text-gray-600 text-lg">Selecione o período para visualizar os gráficos</p>
            <p className="text-gray-400 text-sm mt-2">Loja é opcional — por padrão exibe todas as lojas</p>
          </div>
        ) : dadosProcessados ? (
          <div className="space-y-6">

            {/* ===== RESUMO FINANCEIRO ===== */}
            <div className="card border-2 border-emerald-200 bg-linear-to-br from-emerald-50 to-green-50">
              <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                💰 Resumo Financeiro
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                <span className="font-semibold text-gray-700">
                  {lojaSelecionada ? lojas.find(l => l.id === lojaSelecionada)?.nome : "Todas as lojas"}
                </span>
                {" · "}
                {new Date(dataInicio + "T12:00").toLocaleDateString("pt-BR")} até{" "}
                {new Date(dataFim + "T12:00").toLocaleDateString("pt-BR")}
                {dadosProcessados.origemFaturamento === "backend"
                  ? <span className="ml-2 text-emerald-600 font-semibold">✓ Faturamento via valorFaturado</span>
                  : <span className="ml-2 text-orange-500 font-semibold">⚠ Faturamento estimado (preço médio)</span>
                }
                {dadosProcessados.financeiro.precoMedio > 0 && (
                  <> · Preço médio: <b>R$ {dadosProcessados.financeiro.precoMedio.toFixed(2)}</b></>
                )}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  {
                    icon: "💵", label: dadosProcessados.origemFaturamento === "backend" ? "Faturamento Real" : "Faturamento (est.)",
                    value: dadosProcessados.financeiro.lucroBruto,
                    display: `R$ ${dadosProcessados.financeiro.lucroBruto.toFixed(2)}`,
                    color: "text-emerald-700", border: "border-emerald-200",
                  },
                  {
                    icon: "📦", label: "Custo Produtos",
                    display: `− R$ ${dadosProcessados.financeiro.custoProdutos.toFixed(2)}`,
                    color: "text-red-600", border: "border-red-100",
                  },
                  {
                    icon: "🤝", label: "Custo Comissão",
                    display: `− R$ ${dadosProcessados.financeiro.custoComissao.toFixed(2)}`,
                    color: "text-orange-600", border: "border-orange-100",
                  },
                  {
                    icon: "💸", label: "Custos Variáveis",
                    display: custosVariaveis > 0 ? `− R$ ${custosVariaveis.toFixed(2)}` : "—",
                    color: "text-purple-600", border: "border-purple-100",
                  },
                  {
                    icon: lucroLiquido >= 0 ? "✅" : "⚠️", label: "Lucro Líquido",
                    display: `R$ ${lucroLiquido.toFixed(2)}`,
                    color: lucroLiquido >= 0 ? "text-emerald-700 font-bold" : "text-red-700 font-bold",
                    border: lucroLiquido >= 0 ? "border-emerald-400" : "border-red-300",
                  },
                ].map((k, i) => (
                  <div key={i} className={`bg-white rounded-2xl p-4 shadow border ${k.border}`}>
                    <div className="text-2xl mb-1">{k.icon}</div>
                    <div className={`text-xl font-bold ${k.color}`}>{k.display}</div>
                    <div className="text-xs text-gray-500 mt-1">{k.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ===== KPIs OPERACIONAIS ===== */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: "📤", label: "Vendidos", value: dadosProcessados.totais.saidas, color: "text-red-600" },
                { icon: "📥", label: "Abastecidos", value: dadosProcessados.totais.entradas, color: "text-green-600" },
                { icon: "🔄", label: "Movimentações", value: dadosProcessados.totais.movs, color: "text-purple-600" },
                { icon: "🏭", label: "Máquinas", value: dadosProcessados.totais.maquinas, color: "text-orange-600" },
              ].map((k, i) => (
                <div key={i} className="card text-center py-4 border border-gray-100">
                  <div className="text-2xl mb-1">{k.icon}</div>
                  <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{k.label}</div>
                </div>
              ))}
            </div>

            {/* ===== RENDIMENTO POR LOJA ===== */}
            {dadosProcessados.porLoja.length > 0 && (
              <div className="card">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  🏪 Rendimento por Loja
                  {dadosProcessados.porLoja.length > 1 && (
                    <span className="text-sm font-normal text-gray-500">
                      ({dadosProcessados.porLoja.length} lojas)
                    </span>
                  )}
                </h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={dadosProcessados.porLoja}
                    margin={{ top: 10, right: 20, left: 10, bottom: dadosProcessados.porLoja.length > 4 ? 60 : 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="lojaNome"
                      angle={dadosProcessados.porLoja.length > 4 ? -30 : 0}
                      textAnchor={dadosProcessados.porLoja.length > 4 ? "end" : "middle"}
                      height={dadosProcessados.porLoja.length > 4 ? 70 : 40}
                    />
                    <YAxis tickFormatter={v => `R$${Number(v).toFixed(0)}`} />
                    <Tooltip formatter={v => `R$ ${Number(v).toFixed(2)}`} />
                    <Legend />
                    <Bar dataKey="faturamento" fill="#22c55e" name="Faturamento Bruto" />
                    <Bar dataKey="custoProd" fill="#ef4444" name="Custo Produtos" />
                    <Bar dataKey="custoComissao" fill="#f97316" name="Custo Comissão" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ===== PRODUTOS QUE MAIS SAEM ===== */}
            <div className="card">
              <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                📊 Produtos que Mais Saem
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Saídas totais por máquina no período
                {dadosProcessados.totais.saidas === 0 && " — verifique se o backend retorna o campo "}
                {dadosProcessados.totais.saidas === 0 && <code>sairam</code>}
              </p>
              {dadosProcessados.totais.saidas === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-4xl mb-2">📭</p>
                  <p className="text-sm">Nenhuma saída registrada no período.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={[...dadosProcessados.porMaquina].sort((a, b) => b.totalSaidas - a.totalSaidas)}
                    margin={{ top: 10, right: 20, left: 10, bottom: 70 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" angle={-35} textAnchor="end" height={80} tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={v => [v, "Saídas"]} />
                    <Bar dataKey="totalSaidas" name="Saídas" radius={[4, 4, 0, 0]}>
                      {[...dadosProcessados.porMaquina]
                        .sort((a, b) => b.totalSaidas - a.totalSaidas)
                        .map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ===== BREAKDOWN DE CUSTOS ===== */}
            {(() => {
              const { custoProdutos, custoComissao } = dadosProcessados.financeiro;
              const pData = [
                { name: "Custo Produtos", value: Number(custoProdutos.toFixed(2)) },
                { name: "Comissão", value: Number(custoComissao.toFixed(2)) },
                ...(custosVariaveis > 0
                  ? [{ name: "Var. (digitado)", value: Number(custosVariaveis.toFixed(2)) }]
                  : []),
              ].filter(d => d.value > 0);

              if (pData.length === 0) return (
                <div className="card border border-dashed border-gray-300 text-center py-6 text-gray-400">
                  <p className="text-3xl mb-2">💸</p>
                  <p className="text-sm">
                    Custos zerados — campos <code>valorEntradaNotas</code> / <code>percentualComissao</code> não
                    retornados pelo backend. Consulte o prompt para o backend abaixo.
                  </p>
                </div>
              );

              const PIE = ["#ef4444", "#f97316", "#a855f7"];
              const total = pData.reduce((s, d) => s + d.value, 0);
              return (
                <div className="card">
                  <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                    💸 Breakdown de Custos
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Total: <b className="text-gray-700">R$ {total.toFixed(2)}</b>
                  </p>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="w-full md:w-2/3">
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={pData}
                            cx="50%"
                            cy="50%"
                            outerRadius={95}
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                            labelLine
                          >
                            {pData.map((_, i) => (
                              <Cell key={i} fill={PIE[i % PIE.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={v => `R$ ${Number(v).toFixed(2)}`} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 min-w-48">
                      {pData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: PIE[i % PIE.length] }} />
                            <span className="text-sm text-gray-700">{d.name}</span>
                          </div>
                          <span className="text-sm font-bold">R$ {d.value.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="border-t pt-2 flex justify-between">
                        <span className="text-sm font-bold text-gray-700">Total</span>
                        <span className="text-sm font-bold">R$ {total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        ) : null}
      </div>

      <Footer />
    </div>
  );
}
