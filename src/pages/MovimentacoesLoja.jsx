import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox, Badge } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { MovimentacaoInconsistenteModal } from "../components/MovimentacaoInconsistenteModal";
import {
  TIPO_OCORRENCIA_INCONSISTENCIA,
  montarObservacaoInconsistencia,
  validarInconsistenciasMovimentacao,
} from "../utils/movimentacaoInconsistencias";

const NUMEROS_BAG_BLOQUEADOS = new Set([
  "0",
  "00",
  "1",
  "2",
  "3",
  "4",
  "01",
  "02",
  "03",
  "04",
]);
const numeroBagBloqueado = (numeroBag = "") =>
  NUMEROS_BAG_BLOQUEADOS.has(numeroBag.trim());

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const lojaTemMovimentacaoReal = (loja, lojasRoteiro = []) => {
  if (
    !loja ||
    loja.concluido === true ||
    loja.movimentacao_em_andamento !== true
  ) {
    return false;
  }

  const indicadoresDiretos = [
    loja.movimentacoes_count,
    loja.movimentacao_count,
    loja.totalMovimentacoes,
    loja.total_movimentacoes,
    loja.maquinasAtendidas,
    loja.maquinas_atendidas,
  ];

  if (indicadoresDiretos.some((valor) => Number(valor) > 0)) {
    return true;
  }

  if (Array.isArray(loja.movimentacoes) && loja.movimentacoes.length > 0) {
    return true;
  }

  if (
    Array.isArray(loja.maquinas) &&
    loja.maquinas.some((m) => m?.atendida === true || m?.ultimaMovimentacao)
  ) {
    return true;
  }

  const lojaNoRoteiro = lojasRoteiro.find((l) => {
    const idLoja = toNumberOrNull(loja.id);
    const idLista = toNumberOrNull(l.id);
    return idLoja !== null && idLista !== null
      ? idLoja === idLista
      : String(loja.id) === String(l.id);
  });

  if (!lojaNoRoteiro) {
    return false;
  }

  if (Array.isArray(lojaNoRoteiro.maquinas)) {
    return lojaNoRoteiro.maquinas.some(
      (m) => m?.atendida === true || m?.ultimaMovimentacao,
    );
  }

  return false;
};

export function MovimentacoesLoja() {
  const { roteiroId, lojaId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [roteiro, setRoteiro] = useState(null);
  const [loja, setLoja] = useState(null);
  const [maquinas, setMaquinas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [areceberPendente, setAReceberPendente] = useState(false);
  const [lojaComMovimentacao, setLojaComMovimentacao] = useState(null); // Loja bloqueando outras movimentações
  const [modalInconsistencia, setModalInconsistencia] = useState(null);
  const [justificativaInconsistencia, setJustificativaInconsistencia] =
    useState("");

  // Formulário de movimentação
  // Inicializa com o ID da máquina passada via navegação, se houver
  const [maquinaSelecionada, setMaquinaSelecionada] = useState(() => {
    return location.state?.maquinaId || "";
  });
  const [formData, setFormData] = useState({
    produto_id: "",
    quantidadeAtualMaquina: "",
    quantidadeAdicionada: "",
    contadorIn: "",
    contadorOut: "",
    valor_entrada_maquininha_pix: "",
    numeroBag: "",
    valorEntradaNotas: "",
    valorEntradaCartao: "",
    observacao: "",
  });

  useEffect(() => {
    carregarDados();
  }, [roteiroId, lojaId]);

  // Remove bloqueio se loja já está concluída
  useEffect(() => {
    if (loja && loja.concluido === true) {
      localStorage.removeItem("lojaAtiva");
    }
  }, [loja]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [roteiroRes, lojaRes, produtosRes] = await Promise.all([
        api.get(`/roteiros/${roteiroId}`),
        api.get(`/lojas/${lojaId}`),
        api.get("/produtos"),
      ]);

      setRoteiro(roteiroRes.data);
      setLoja(lojaRes.data);
      setProdutos(produtosRes.data);

      // Buscar máquinas da loja
      const maquinasRes = await api.get(`/maquinas?lojaId=${lojaId}`);
      setMaquinas(maquinasRes.data);

      const lojasDoRoteiro = Array.isArray(roteiroRes.data?.lojas)
        ? roteiroRes.data.lojas
        : [];

      // Buscar todas as lojas do roteiro para verificar bloqueios
      try {
        const lojasRoteiroRes = await api.get(`/roteiros/${roteiroId}/lojas`);
        const lojasBloqueadas = lojasRoteiroRes.data.filter(
          (l) =>
            lojaTemMovimentacaoReal(l, lojasDoRoteiro) &&
            String(l.id) !== String(lojaId),
        );

        if (lojasBloqueadas.length > 0) {
          setLojaComMovimentacao(lojasBloqueadas[0]);
          // Atualiza localStorage
          localStorage.setItem("lojaAtiva", lojasBloqueadas[0].id);
        } else if (lojaTemMovimentacaoReal(lojaRes.data, lojasDoRoteiro)) {
          // A loja atual está com movimentação em andamento
          localStorage.setItem("lojaAtiva", lojaId);
          setLojaComMovimentacao(null);
        } else {
          // Nenhuma loja bloqueada
          localStorage.removeItem("lojaAtiva");
          setLojaComMovimentacao(null);
        }
      } catch (err) {
        console.warn("Erro ao buscar lojas do roteiro:", err);
        // Fallback para localStorage em caso de erro
        const lojaAtiva = localStorage.getItem("lojaAtiva");
        if (lojaAtiva && lojaAtiva !== lojaId) {
          const lojaDoRoteiro = lojasDoRoteiro.find(
            (l) => String(l.id) === String(lojaAtiva),
          );
          if (lojaTemMovimentacaoReal(lojaDoRoteiro, lojasDoRoteiro)) {
            setLojaComMovimentacao({
              id: lojaAtiva,
              nome: lojaDoRoteiro?.nome || "Loja bloqueada",
            });
          } else {
            localStorage.removeItem("lojaAtiva");
            setLojaComMovimentacao(null);
          }
        }
      }

      // Verificar se já existe pendência "à receber" para esta loja neste roteiro
      try {
        const arRes = await api.get(`/roteiros/financeiro/areceber`);
        const existe = (arRes.data || []).some(
          (r) =>
            r.lojaId === lojaId && r.roteiroId === roteiroId && !r.recebido,
        );
        setAReceberPendente(existe);
      } catch {}

      // Sincronizar localStorage com o estado do backend
      if (lojaTemMovimentacaoReal(lojaRes.data, lojasDoRoteiro)) {
        localStorage.setItem("lojaAtiva", lojaId);
      } else if (lojaRes.data.concluido === true) {
        localStorage.removeItem("lojaAtiva");
      }
    } catch (error) {
      setError(
        "Erro ao carregar dados: " +
          (error.response?.data?.error || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const carregarEstoqueDeposito = async () => {
    try {
      const res = await api.get(`/estoque-lojas/${lojaId}`);
      return Array.isArray(res.data)
        ? res.data
        : res.data?.estoque || res.data?.itens || [];
    } catch (error) {
      console.warn("Não foi possível validar estoque do depósito:", error);
      return [];
    }
  };

  const finalizarMovimentacaoSalva = () => {
    localStorage.setItem("lojaAtiva", lojaId);

    console.log(
      "🛒 [MovimentacoesLoja] Carrinho atualizado automaticamente pelo backend",
    );

    setSuccess("Movimentação registrada com sucesso! Redirecionando...");
    console.log("✅ [MovimentacoesLoja] Movimentação salva com sucesso");
    console.log("📊 [MovimentacoesLoja] RoteiroId:", roteiroId);
    console.log("🔧 [MovimentacoesLoja] MaquinaId:", maquinaSelecionada);
    setTimeout(() => {
      console.log(
        "🔄 [MovimentacoesLoja] Redirecionando para /roteiros/" +
          roteiroId +
          "/executar",
      );
      navigate(`/roteiros/${roteiroId}/executar`, {
        replace: true,
        state: { reload: true, timestamp: Date.now() },
      });
    }, 1500);
  };

  const salvarMovimentacaoInconsistente = async () => {
    if (!modalInconsistencia || !justificativaInconsistencia.trim()) return;

    const payload = {
      ...modalInconsistencia.payload,
      tipoOcorrencia: TIPO_OCORRENCIA_INCONSISTENCIA,
      observacoes: montarObservacaoInconsistencia({
        observacoes: modalInconsistencia.payload.observacoes,
        justificativa: justificativaInconsistencia,
        inconsistencias: modalInconsistencia.inconsistencias,
      }),
    };

    try {
      setSalvando(true);
      setError("");
      await api.post("/movimentacoes", payload);
      setModalInconsistencia(null);
      setJustificativaInconsistencia("");
      finalizarMovimentacaoSalva();
    } catch (error) {
      if (error.response?.data?.lojaEmUso) {
        const lojaEmUso = error.response.data.lojaEmUso;
        setLojaComMovimentacao(lojaEmUso);
        localStorage.setItem("lojaAtiva", lojaEmUso.id);
        setModalInconsistencia(null);
        setJustificativaInconsistencia("");
        setError(
          `Movimentação bloqueada! A loja "${lojaEmUso.nome}" está com movimentação em andamento. ` +
            "Conclua aquela loja antes de salvar esta movimentação inconsistente.",
        );
      } else {
        const mensagem =
          error.response?.data?.error ||
          error.response?.data?.message ||
          error.message;

        if (/outra loja/i.test(mensagem)) {
          setModalInconsistencia(null);
          setJustificativaInconsistencia("");
          setError(
            "Movimentação bloqueada: existe outra loja em andamento. Conclua a loja ativa antes de salvar esta movimentação inconsistente.",
          );
          carregarDados();
        } else {
          setError("Erro ao salvar movimentação: " + mensagem);
        }
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleSubmitMovimentacao = async (e) => {
    e.preventDefault();
    if (!maquinaSelecionada) {
      setError("Selecione uma máquina");
      return;
    }
    if (!formData.produto_id) {
      setError("Selecione um produto para registrar a movimentação.");
      return;
    }
    const numeroBagInformado = formData.numeroBag?.trim() || "";

    if (!numeroBagInformado) {
      setError("Informe o número de bag para prosseguir.");
      return;
    }
    if (numeroBagBloqueado(numeroBagInformado)) {
      setError(
        "Os números 00, 01, 02, 03, 04 (e 0, 1, 2, 3, 4) são bloqueados para BAG. Informe outro número para lançar a movimentação.",
      );
      return;
    }

    try {
      setSalvando(true);
      const movimentacao = {
        maquinaId: maquinaSelecionada,
        roteiroId: roteiroId,
        totalPre: parseInt(formData.quantidadeAtualMaquina) || 0,
        sairam: 0, // Calculado no backend baseado no produto
        abastecidas: parseInt(formData.quantidadeAdicionada) || 0,
        totalPos:
          (parseInt(formData.quantidadeAtualMaquina) || 0) +
          (parseInt(formData.quantidadeAdicionada) || 0),
        contadorIn: parseInt(formData.contadorIn) || 0,
        contadorOut: parseInt(formData.contadorOut) || 0,
        quantidade_notas_entrada: 0,
        valor_entrada_maquininha_pix:
          parseFloat(formData.valor_entrada_maquininha_pix) || 0,
        numeroBag: numeroBagInformado,
        valorEntradaNotas: formData.valorEntradaNotas
          ? parseFloat(formData.valorEntradaNotas)
          : null,
        valorEntradaCartao: formData.valorEntradaCartao
          ? parseFloat(formData.valorEntradaCartao)
          : null,
        observacoes: formData.observacao || "",
        produtos: formData.produto_id
          ? [
              {
                produtoId: formData.produto_id,
                quantidadeSaiu: 0,
                quantidadeAbastecida:
                  parseInt(formData.quantidadeAdicionada) || 0,
              },
            ]
          : [],
      };

      const maquina = maquinas.find((m) => m.id === maquinaSelecionada);
      const estoqueDeposito = await carregarEstoqueDeposito();
      const inconsistencias = validarInconsistenciasMovimentacao({
        movimentacao,
        maquina,
        estoqueDeposito,
      });

      if (inconsistencias.length > 0) {
        setModalInconsistencia({
          payload: movimentacao,
          inconsistencias,
        });
        setJustificativaInconsistencia("");
        return;
      }

      await api.post("/movimentacoes", movimentacao);
      finalizarMovimentacaoSalva();
    } catch (error) {
      // Tratar erro específico de bloqueio de loja
      if (error.response?.data?.lojaEmUso) {
        const lojaEmUso = error.response.data.lojaEmUso;
        setError(
          `Movimentação bloqueada! A loja "${lojaEmUso.nome}" está com movimentação em andamento. ` +
            `Por favor, conclua aquela loja antes de iniciar movimentações em outra loja.`,
        );
      } else {
        setError(
          "Erro ao salvar movimentação: " +
            (error.response?.data?.error ||
              error.response?.data?.message ||
              error.message),
        );
      }
    } finally {
      setSalvando(false);
    }
  };

  const finalizarLoja = async () => {
    // Confirmação mais detalhada
    const confirmacao = window.confirm(
      "⚠️ Tem certeza que deseja concluir esta loja?\n\n" +
        "Após concluir, você não poderá mais fazer movimentações nas máquinas desta loja neste roteiro.\n\n" +
        "Clique em OK para confirmar a conclusão da loja.",
    );

    if (!confirmacao) {
      return;
    }

    try {
      setFinalizando(true);
      const resp = await api.post(
        `/roteiros/${roteiroId}/lojas/${lojaId}/concluir`,
      );
      if (resp.data && resp.data.concluido === true) {
        // Mensagem de sucesso mais clara
        setSuccess(
          "✅ Loja concluída com sucesso! Agora você pode iniciar o atendimento em outra loja. Redirecionando...",
        );
        // Ao concluir loja, remove loja ativa e limpa estado
        localStorage.removeItem("lojaAtiva");
        setLojaComMovimentacao(null);
      } else {
        setError(
          "A loja não foi concluída pelo backend. Não é possível liberar movimentação em outra loja.",
        );
        return;
      }
      setTimeout(() => {
        navigate(`/roteiros/${roteiroId}/executar`, { replace: true });
      }, 2000);
    } catch (error) {
      setError(
        "Erro ao concluir loja: " +
          (error.response?.data?.error || error.message),
      );
    } finally {
      setFinalizando(false);
    }
  };

  const marcarLojaAReceber = async () => {
    if (!window.confirm("Deseja marcar esta loja como 'à receber'?")) return;
    try {
      setFinalizando(true);
      await api.post(`/roteiros/${roteiroId}/lojas/${lojaId}/areceber`);
      setSuccess(
        "Loja marcada como 'à receber'. Você pode concluir a loja agora ou depois.",
      );
      setAReceberPendente(true);
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      setError("Não foi possível marcar como 'à receber': " + msg);
    } finally {
      setFinalizando(false);
    }
  };

  const voltarParaRoteiro = () => {
    navigate(`/roteiros/${roteiroId}/executar`, { replace: true });
  };

  // Verificar quais máquinas já têm movimentação
  const maquinasComMovimentacao = new Set(
    maquinas
      .filter((m) => m.ultimaMovimentacao?.roteiro_id === parseInt(roteiroId))
      .map((m) => m.id),
  );

  const maquinasPendentes = maquinas.filter(
    (m) => !maquinasComMovimentacao.has(m.id),
  );
  const maquinasConcluidas = maquinas.filter((m) =>
    maquinasComMovimentacao.has(m.id),
  );
  const progresso =
    maquinas.length > 0
      ? (maquinasConcluidas.length / maquinas.length) * 100
      : 0;

  // Bloqueio de movimentação em outras lojas - baseado no backend
  const bloqueadoPorOutraLoja = lojaComMovimentacao !== null;
  const lojaEmAtendimento = lojaTemMovimentacaoReal(loja, roteiro?.lojas || []);
  const bagInvalida = numeroBagBloqueado(formData.numeroBag);

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={voltarParaRoteiro}
          className="mb-4 text-primary hover:text-blue-700 font-semibold flex items-center gap-2"
        >
          ← Voltar para Lojas do Roteiro
        </button>

        <PageHeader
          title={loja?.nome || "Carregando..."}
          subtitle={`${loja?.endereco || ""} - ${loja?.cidade || ""}`}
          icon="🏪"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && (
          <AlertBox
            type="success"
            message={success}
            onClose={() => setSuccess("")}
          />
        )}

        {/* BLOQUEIO DE MOVIMENTAÇÃO EM OUTRA LOJA */}
        {bloqueadoPorOutraLoja && lojaComMovimentacao && (
          <AlertBox
            type="error"
            message={
              <div>
                <b>🔒 Movimentação bloqueada!</b>
                <br />A loja <b>"{lojaComMovimentacao.nome}"</b> está com
                movimentação em andamento.
                <br />
                Para movimentar máquinas desta loja, conclua a loja ativa
                primeiro.
                <br />
                <span className="text-xs">
                  (Volte para "{lojaComMovimentacao.nome}" e clique em "Concluir
                  Loja")
                </span>
              </div>
            }
          />
        )}

        {/* Barra de Progresso */}
        <div className="card-gradient mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              📊 Progresso da Loja
            </h3>
            {/* Indicador de loja em uso */}
            {lojaEmAtendimento && (
              <span className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold border border-green-300">
                <span className="animate-pulse">🟢</span>
                Em atendimento
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Máquinas Processadas</span>
                <span className="font-semibold">
                  {maquinasConcluidas.length}/{maquinas.length}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-linear-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${progresso}%` }}
                ></div>
              </div>
            </div>
            <div className="text-3xl font-bold text-blue-600">
              {Math.round(progresso)}%
            </div>
          </div>

          {/* Botões de finalizar e à receber - aparecem se tiver pelo menos 1 máquina processada */}
          {maquinasConcluidas.length > 0 && (
            <div className="mt-6 space-y-3">
              <button
                onClick={finalizarLoja}
                disabled={finalizando}
                className={`w-full text-lg py-3 ${
                  progresso === 100
                    ? "btn-success"
                    : "bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-xl transition-colors"
                }`}
              >
                {finalizando
                  ? "Finalizando..."
                  : progresso === 100
                    ? "✅ Finalizar Movimentação da Loja"
                    : `⚠️ Finalizar Loja Parcialmente (${maquinasConcluidas.length}/${maquinas.length})`}
              </button>
              <button
                onClick={marcarLojaAReceber}
                disabled={finalizando || areceberPendente}
                className={`w-full btn-secondary text-lg py-3 ${areceberPendente ? "opacity-60 cursor-not-allowed" : ""}`}
                title={
                  areceberPendente
                    ? "Já existe uma pendência à receber para esta loja"
                    : "Marcar que o dono fará o PIX depois"
                }
              >
                💸 Deixar à Receber
              </button>
              {progresso < 100 && (
                <p className="text-sm text-yellow-700 text-center">
                  ⚠️ Faltam {maquinasPendentes.length} máquina(s). Finalize
                  agora ou continue depois.
                </p>
              )}
              <button
                onClick={voltarParaRoteiro}
                className="w-full btn-secondary text-lg py-3"
              >
                ← Voltar ao Roteiro sem Finalizar
              </button>
            </div>
          )}
          {maquinasConcluidas.length === 0 && (
            <div className="mt-6">
              <button
                onClick={voltarParaRoteiro}
                className="w-full btn-secondary text-lg py-3"
              >
                ← Voltar ao Roteiro
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulário de Movimentação */}
          <div className="lg:col-span-2">
            <div
              className={`card-gradient ${bloqueadoPorOutraLoja ? "opacity-75" : ""}`}
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                📝 Nova Movimentação
              </h2>

              {/* Aviso de formulário bloqueado */}
              {bloqueadoPorOutraLoja && lojaComMovimentacao && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
                  <p className="font-semibold">🔒 Formulário Bloqueado</p>
                  <p className="text-sm mt-1">
                    Conclua a loja "{lojaComMovimentacao.nome}" antes de fazer
                    movimentações aqui.
                  </p>
                </div>
              )}

              <form
                onSubmit={handleSubmitMovimentacao}
                className="space-y-6"
                disabled={bloqueadoPorOutraLoja}
              >
                {/* Seleção de Máquina */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Máquina *
                  </label>
                  <select
                    value={maquinaSelecionada}
                    onChange={(e) => setMaquinaSelecionada(e.target.value)}
                    className="select-field"
                    required
                    disabled={bloqueadoPorOutraLoja}
                  >
                    <option value="">Selecione uma máquina</option>
                    <optgroup label="Pendentes">
                      {maquinasPendentes.map((maq) => (
                        <option key={maq.id} value={maq.id}>
                          {maq.codigo} - {maq.nome}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Já Processadas">
                      {maquinasConcluidas.map((maq) => (
                        <option key={maq.id} value={maq.id}>
                          ✓ {maq.codigo} - {maq.nome}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Produto */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Produto *
                  </label>
                  <select
                    value={formData.produto_id}
                    onChange={(e) =>
                      setFormData({ ...formData, produto_id: e.target.value })
                    }
                    className="select-field"
                    required
                  >
                    <option value="">Selecione um produto</option>
                    {produtos.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grid de Quantidades */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Quantidade Atual na Máquina
                    </label>
                    <input
                      type="number"
                      value={formData.quantidadeAtualMaquina}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quantidadeAtualMaquina: e.target.value,
                        })
                      }
                      className="input-field"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Quantidade Adicionada
                    </label>
                    <input
                      type="number"
                      value={formData.quantidadeAdicionada}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quantidadeAdicionada: e.target.value,
                        })
                      }
                      className="input-field"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Contador IN
                    </label>
                    <input
                      type="number"
                      value={formData.contadorIn}
                      onChange={(e) =>
                        setFormData({ ...formData, contadorIn: e.target.value })
                      }
                      className="input-field"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Contador OUT
                    </label>
                    <input
                      type="number"
                      value={formData.contadorOut}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contadorOut: e.target.value,
                        })
                      }
                      className="input-field"
                      min="0"
                    />
                  </div>

                  {/* Número da Bag */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      🎒 Número da Bag (opcional)
                    </label>
                    <input
                      type="text"
                      value={formData.numeroBag}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          numeroBag: e.target.value,
                        })
                      }
                      className="input-field"
                      placeholder="Preencha se levar dinheiro na bag para contar depois"
                    />
                    {formData.numeroBag && (
                      <p className="text-sm text-amber-600 mt-1">
                        ⚠️ Os valores financeiros abaixo são opcionais quando há
                        número de bag
                      </p>
                    )}
                    {bagInvalida && (
                      <p className="text-sm text-red-600 mt-1 font-semibold">
                        ❌ Os números 00, 01, 02, 03, 04 (ou 0, 1, 2, 3, 4) não
                        são permitidos para BAG.
                      </p>
                    )}
                  </div>

                  <div></div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      💵 Valor Entrada Notas (R$){!formData.numeroBag && " *"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.valorEntradaNotas}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          valorEntradaNotas: e.target.value,
                        })
                      }
                      className="input-field"
                      min="0"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      💳 Valor Entrada Cartão/PIX (R$)
                      {!formData.numeroBag && " *"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.valorEntradaCartao}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          valorEntradaCartao: e.target.value,
                        })
                      }
                      className="input-field"
                      min="0"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Observação */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observação
                  </label>
                  <textarea
                    value={formData.observacao}
                    onChange={(e) =>
                      setFormData({ ...formData, observacao: e.target.value })
                    }
                    className="input-field"
                    rows="3"
                    placeholder="Observações sobre a movimentação..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={salvando || bloqueadoPorOutraLoja || bagInvalida}
                  className={`w-full text-lg py-3 font-bold rounded-xl transition-colors ${
                    bloqueadoPorOutraLoja || bagInvalida
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "btn-primary"
                  }`}
                  title={
                    bloqueadoPorOutraLoja
                      ? `Conclua a loja "${lojaComMovimentacao?.nome}" primeiro`
                      : bagInvalida
                        ? "Número de bag inválido. Use um valor diferente de 00, 01, 02, 03, 04, 0, 1, 2, 3 ou 4."
                        : ""
                  }
                >
                  {salvando
                    ? "Salvando..."
                    : bloqueadoPorOutraLoja
                      ? "🔒 Formulário Bloqueado"
                      : bagInvalida
                        ? "⚠️ BAG Inválida"
                        : "💾 Salvar Movimentação"}
                </button>
              </form>
            </div>
          </div>

          {/* Status das Máquinas */}
          <div className="lg:col-span-1">
            <div className="card-gradient sticky top-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                🎰 Status das Máquinas
              </h3>

              <div className="space-y-4">
                {/* Máquinas Pendentes */}
                {maquinasPendentes.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-yellow-600 mb-2">
                      ⏳ Pendentes ({maquinasPendentes.length})
                    </h4>
                    <div className="space-y-2">
                      {maquinasPendentes.map((maq) => (
                        <div
                          key={maq.id}
                          className="p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded"
                        >
                          <div className="font-semibold text-gray-800">
                            {maq.codigo}
                          </div>
                          <div className="text-sm text-gray-600">
                            {maq.nome}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Máquinas Concluídas */}
                {maquinasConcluidas.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-green-600 mb-2">
                      ✅ Concluídas ({maquinasConcluidas.length})
                    </h4>
                    <div className="space-y-2">
                      {maquinasConcluidas.map((maq) => (
                        <div
                          key={maq.id}
                          className="p-3 bg-green-50 border-l-4 border-green-500 rounded"
                        >
                          <div className="font-semibold text-gray-800">
                            ✓ {maq.codigo}
                          </div>
                          <div className="text-sm text-gray-600">
                            {maq.nome}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {maquinas.length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    Nenhuma máquina nesta loja
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <MovimentacaoInconsistenteModal
        inconsistencias={modalInconsistencia?.inconsistencias || []}
        justificativa={justificativaInconsistencia}
        setJustificativa={setJustificativaInconsistencia}
        onCancel={() => {
          setModalInconsistencia(null);
          setJustificativaInconsistencia("");
        }}
        onConfirm={salvarMovimentacaoInconsistente}
        loading={salvando}
      />

      <Footer />
    </div>
  );
}
