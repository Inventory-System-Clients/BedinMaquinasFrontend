import { useState, useEffect } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { PageLoader, EmptyState } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";

export function Financeiro() {
  const { usuario } = useAuth();
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [lojasAReceber, setLojasAReceber] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [aviso, setAviso] = useState("");
  const [editando, setEditando] = useState(null);
  const [valores, setValores] = useState({ dinheiro: "", cartao: "" });
  const [buscandoDigital, setBuscandoDigital] = useState(false);
  const [mensagemDigital, setMensagemDigital] = useState("");
  const [lojaBusca, setLojaBusca] = useState("");


  useEffect(() => {
    carregarPendenciasFinanceiras();
  }, []);

  const carregarPendenciasFinanceiras = async () => {
    try {
      setLoading(true);
      const [movsRes, areceberRes] = await Promise.all([
        api.get("/movimentacoes/pendentes-financeiro"),
        api.get("/roteiros/financeiro/areceber"),
      ]);
      setMovimentacoes(movsRes.data || []);
      setLojasAReceber(areceberRes.data || []);
    } catch (error) {
      setError("Erro ao carregar movimentações: " + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const chaveGrupo = (mov) =>
    `${mov.lojaId || mov.maquina?.lojaId}|${mov.roteiroId || new Date(mov.dataColeta).toISOString().slice(0, 10)}`;

  const grupos = Object.values(
    movimentacoes.reduce((acc, mov) => {
      const chave = chaveGrupo(mov);
      if (!acc[chave]) {
        acc[chave] = { chave, loja: mov.maquina?.loja, dataColeta: mov.dataColeta, movs: [] };
      }
      acc[chave].movs.push(mov);
      if (new Date(mov.dataColeta) > new Date(acc[chave].dataColeta)) {
        acc[chave].dataColeta = mov.dataColeta;
      }
      return acc;
    }, {})
  ).sort((a, b) => new Date(b.dataColeta) - new Date(a.dataColeta));

  const iniciarEdicao = (grupo) => {
    const cartaoAtual = grupo.movs.reduce((s, m) => s + Number(m.valorEntradaCartao || 0), 0);
    setEditando(grupo.chave);
    setValores({ dinheiro: "", cartao: cartaoAtual > 0 ? cartaoAtual.toFixed(2) : "" });
    setMensagemDigital("");
  };

  const cancelarEdicao = () => {
    setEditando(null);
    setValores({ dinheiro: "", cartao: "" });
    setMensagemDigital("");
  };

  const buscarValorDigital = async (grupo) => {
    setBuscandoDigital(true);
    setMensagemDigital("");
    let total = 0;
    let falhas = 0;
    for (const mov of grupo.movs) {
      try {
        const { data } = await api.post(`/movimentacoes/${mov.id}/machine-pay/valor-digital`);
        total += Number(data.valorEntradaCartao || 0);
      } catch {
        falhas += 1;
      }
    }
    setValores((prev) => ({ ...prev, cartao: total.toFixed(2) }));
    setMensagemDigital(
      falhas === 0
        ? "✅ Valor digital somado via Machine Pay."
        : `⚠️ ${falhas} máquina(s) sem valor digital automático — confira/ajuste o total.`
    );
    setBuscandoDigital(false);
  };

  const salvarValores = async (grupo) => {
    try {
      setError("");
      const { data } = await api.put("/movimentacoes/financeiro-ponto", {
        movimentacaoIds: grupo.movs.map((m) => m.id),
        valorDinheiro: valores.dinheiro === "" ? 0 : valores.dinheiro,
        valorCartao: valores.cartao === "" ? 0 : valores.cartao,
      });
      setSuccess("Valores do ponto lançados com sucesso!");
      setAviso(
        data?.machinePayFalhas > 0
          ? `Valores salvos, mas ${data.machinePayFalhas} máquina(s) não sincronizaram com a Machine Pay.`
          : ""
      );
      cancelarEdicao();
      await carregarPendenciasFinanceiras();
    } catch (error) {
      setError("Erro ao salvar valores: " + (error.response?.data?.error || error.message));
    }
  };


  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Gestão Financeira"
          subtitle="Lance o dinheiro e o cartão total de cada ponto"
          icon="💰"
        />

        {error && <AlertBox type="error" message={error} onClose={() => setError("")} />}
        {success && <AlertBox type="success" message={success} onClose={() => setSuccess("")} />}
        {aviso && <AlertBox type="warning" message={aviso} onClose={() => setAviso("")} />}

        {lojasAReceber.length === 0 && movimentacoes.length === 0 ? (
          <EmptyState message="Não há movimentações pendentes de preenchimento financeiro" icon="✅" />
        ) : (
          <div className="space-y-10">
            {/* À Receber */}
            {lojasAReceber.length > 0 ? (
              <div className="bg-white shadow-md rounded-lg overflow-hidden p-4">
                <h2 className="text-xl font-bold mb-4">À Receber (Lojas)</h2>
                <div className="space-y-3">
                  {lojasAReceber.map((item) => {
                    const criado = new Date(item.createdAt || item.dataMarcacao);
                    const diffDias = Math.floor((Date.now() - criado.getTime()) / (1000 * 60 * 60 * 24));
                    const atrasado = diffDias > 7;
                    // Calcular valor a receber da loja
                    const valorTotal = item.valorTotal ?? item.totalLucro ?? 0;
                    const comissao = item.comissao ?? item.totalComissao ?? 0;
                    const valorAReceber = valorTotal - comissao;
                    return (
                      <div key={item.id} className={`flex items-center justify-between p-3 rounded border ${atrasado ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            {item.loja?.nome || 'Loja'}
                            <span className="text-green-700 bg-green-100 rounded px-2 py-1 text-sm font-bold ml-2">
                              R$ {valorAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            Marcado em {criado.toLocaleDateString()} {atrasado && (<span className="text-red-700 font-semibold ml-1">(&gt; 1 semana)</span>)}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await api.put(`/roteiros/financeiro/areceber/${item.id}/receber`);
                              setSuccess("Recebimento confirmado!");
                              await carregarPendenciasFinanceiras();
                            } catch (e) {
                              setError("Erro ao confirmar recebimento: " + (e.response?.data?.error || e.message));
                            }
                          }}
                          className="btn-success"
                        >
                          ✓ Recebido
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Pendentes de Valores */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="p-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0">
                <h2 className="text-xl font-bold">Pendentes de Valores (por Ponto)</h2>
                <input
                  type="text"
                  placeholder="Buscar por nome da loja..."
                  value={lojaBusca}
                  onChange={(e) => setLojaBusca(e.target.value)}
                  className="px-2 py-1 border rounded text-sm w-56"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ponto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Máquinas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Funcionário</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor do ponto (R$)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {grupos
                      .filter((g) => lojaBusca.trim() === "" || (g.loja?.nome || "").toLowerCase().includes(lojaBusca.trim().toLowerCase()))
                      .map((grupo) => (
                        <tr key={grupo.chave} className="hover:bg-gray-50 align-top">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{new Date(grupo.dataColeta).toLocaleDateString("pt-BR")}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-semibold">{grupo.loja?.nome || "N/A"}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {grupo.movs.map((m) => (
                              <div key={m.id}>{m.maquina?.nome || m.maquina?.codigo || "N/A"}</div>
                            ))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {[...new Set(grupo.movs.map((m) => m.usuario?.nome).filter(Boolean))].join(", ") || "N/A"}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {editando === grupo.chave ? (
                              <div className="space-y-2">
                                <label className="block text-xs text-gray-600">💵 Dinheiro total do ponto</label>
                                <input type="number" step="0.01" min="0" placeholder="0,00" value={valores.dinheiro} onChange={(e) => setValores({ ...valores, dinheiro: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />
                                <label className="block text-xs text-gray-600">💳 Cartão/PIX total do ponto</label>
                                <input type="number" step="0.01" min="0" placeholder="0,00" value={valores.cartao} onChange={(e) => setValores({ ...valores, cartao: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />
                                <button type="button" onClick={() => buscarValorDigital(grupo)} disabled={buscandoDigital} className="text-xs text-blue-600 hover:underline disabled:opacity-50">
                                  {buscandoDigital ? "Buscando..." : "🔄 Buscar cartão na Machine Pay"}
                                </button>
                                {mensagemDigital && <p className="text-xs text-gray-600">{mensagemDigital}</p>}
                                <p className="text-xs text-gray-400">O valor é rateado entre as máquinas do ponto conforme as fichas.</p>
                              </div>
                            ) : (
                              <span className="text-yellow-600 text-xs font-semibold">Pendente</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {editando === grupo.chave ? (
                              <div className="flex gap-2">
                                <button onClick={() => salvarValores(grupo)} className="text-green-600 hover:text-green-900">✓ Salvar</button>
                                <button onClick={cancelarEdicao} className="text-red-600 hover:text-red-900">✗ Cancelar</button>
                              </div>
                            ) : (
                              <button onClick={() => iniciarEdicao(grupo)} className="text-blue-600 hover:text-blue-900">✏️ Lançar valores</button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
