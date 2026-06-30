import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox, Badge } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import {
  ROTEIRO_LOCATION_CHANGED_EVENT,
  ROTEIRO_LOCATION_STATUS_EVENT,
  ROTEIRO_LOCATION_STORAGE_KEY,
} from "../components/RoteiroLocationTracker.jsx";

const normalizarStatusManutencao = status => String(status || "").trim().toLowerCase();
const isManutencaoUrgente = status => normalizarStatusManutencao(status) === "urgente";
const isManutencaoFeita = status => {
  const statusNormalizado = normalizarStatusManutencao(status);
  return statusNormalizado === "feito" || statusNormalizado === "concluida";
};

export function ExecutarRoteiro() {
      const [manutencaoUrgente, setManutencaoUrgente] = useState(false);
    // Estado para manutenções
    const [manutencoes, setManutencoes] = useState([]);
    // Marcar manutenção como feita
    const marcarManutencaoFeita = async (manutencaoId) => {
      try {
        await api.put(`/manutencoes/${manutencaoId}`, { status: "feito" });
        setSuccess("Manutenção marcada como feita!");
        await carregarRoteiro();
      } catch (error) {
        setError("Erro ao marcar manutenção: " + (error.response?.data?.error || error.message));
      }
    };
  const { usuario } = useAuth();
    // Função para desfazer finalização do roteiro (apenas admin)
    const desfazerFinalizacao = async () => {
      if (!window.confirm("Deseja realmente desfazer a finalização deste roteiro?")) return;
      try {
        await api.post(`/roteiros/${id}/desfazer-finalizacao`);
        setSuccess("Finalização desfeita! O roteiro voltou para pendente.");
        await carregarRoteiro();
      } catch (error) {
        setError("Erro ao desfazer finalização: " + (error.response?.data?.error || error.message));
      }
    };
  // Pesquisa de loja
  const [buscaLoja, setBuscaLoja] = useState("");
  const lojaRefs = useRef({});
  const handleBuscarLoja = (e) => {
    e.preventDefault();
    if (!buscaLoja.trim() || !roteiro?.lojas) return;
    const termo = buscaLoja.trim().toLowerCase();
    const lojaEncontrada = roteiro.lojas.find(l => l.nome.toLowerCase().includes(termo));
    if (lojaEncontrada && lojaRefs.current[lojaEncontrada.id]) {
      lojaRefs.current[lojaEncontrada.id].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [roteiro, setRoteiro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastUpdate, setLastUpdate] = useState(Date.now());
    const [aReceberPendentes, setAReceberPendentes] = useState(new Set());
  const [reloadConsumido, setReloadConsumido] = useState(false);
  const [localizacaoRota, setLocalizacaoRota] = useState({
    compartilhando: false,
    status: "idle",
    mensagem: "",
    deveCompartilhar: false,
    ultimaLocalizacao: null,
  });
  
  // Controle de gastos
  const [mostrarFormGasto, setMostrarFormGasto] = useState(false);
  const [novoGasto, setNovoGasto] = useState({
    categoria: "",
    valor: "",
    descricao: ""
  });
  
  // Controle de manutenção
  const [mostrarFormManutencao, setMostrarFormManutencao] = useState(false);
  const [manutencaoMaquina, setManutencaoMaquina] = useState(null);
  const [descricaoManutencao, setDescricaoManutencao] = useState("");

  useEffect(() => {
    console.log('🎯 [ExecutarRoteiro] Montado ou ID mudou, carregando...');
    carregarRoteiro();
  }, [id]);

  useEffect(() => {
    sincronizarEstadoLocalizacaoRota();
    carregarStatusLocalizacaoRota();

    const handleStatusLocalizacao = (event) => {
      const detail = event.detail || {};
      if (detail.roteiroId && String(detail.roteiroId) !== String(id)) return;

      setLocalizacaoRota((prev) => ({
        ...prev,
        compartilhando: detail.status === "idle" ? false : prev.compartilhando,
        status: detail.status || prev.status,
        mensagem: detail.mensagem || "",
      }));
    };

    const handleLocalizacaoChanged = () => {
      sincronizarEstadoLocalizacaoRota();
    };

    window.addEventListener(ROTEIRO_LOCATION_STATUS_EVENT, handleStatusLocalizacao);
    window.addEventListener(ROTEIRO_LOCATION_CHANGED_EVENT, handleLocalizacaoChanged);
    window.addEventListener("storage", handleLocalizacaoChanged);

    return () => {
      window.removeEventListener(ROTEIRO_LOCATION_STATUS_EVENT, handleStatusLocalizacao);
      window.removeEventListener(ROTEIRO_LOCATION_CHANGED_EVENT, handleLocalizacaoChanged);
      window.removeEventListener("storage", handleLocalizacaoChanged);
    };
  }, [id]);
  
  // Recarregar quando location.state mudar (vindo de MovimentacoesLoja)
  useEffect(() => {
    if ((location.state?.reload || location.state?.timestamp) && !reloadConsumido) {
      console.log('🔄 [ExecutarRoteiro] Estado de reload detectado, recarregando...');
      carregarRoteiro();
      setReloadConsumido(true);
    }
  }, [location.state, reloadConsumido]);
  
  // Recarregar quando voltar para a página (focus)
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 [ExecutarRoteiro] Janela focada - recarregando dados...');
      carregarRoteiro();
    };
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 [ExecutarRoteiro] Página visível - recarregando dados...');
        carregarRoteiro();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [id]);

  const carregarRoteiro = async () => {
    try {
      setLoading(true);
      const [roteiroRes, areceberRes, manutencoesRes] = await Promise.all([
        api.get(`/roteiros/${id}?_t=${Date.now()}`),
        api.get(`/roteiros/financeiro/areceber`),
        api.get(`/manutencoes?roteiroId=${id}`)
      ]);
      setRoteiro(roteiroRes.data);
      setManutencoes(manutencoesRes.data || []);
      const pendSet = new Set((areceberRes.data || []).filter(r => !r.recebido).map(r => r.lojaId));
      setAReceberPendentes(pendSet);
      setLastUpdate(Date.now());
    } catch (error) {
      setError("Erro ao carregar roteiro: " + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const lerLocalizacaoRotaAtiva = () => {
    try {
      const raw = localStorage.getItem(ROTEIRO_LOCATION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error("Erro ao ler localizacao ativa:", error);
      return null;
    }
  };

  const sincronizarEstadoLocalizacaoRota = () => {
    const ativa = lerLocalizacaoRotaAtiva();
    const compartilhando = String(ativa?.roteiroId || "") === String(id);

    setLocalizacaoRota((prev) => ({
      ...prev,
      compartilhando,
      status: compartilhando ? prev.status || "sharing" : "idle",
      mensagem: compartilhando ? prev.mensagem : "",
    }));
  };

  const ativarCompartilhamentoLocal = (mensagem = "Solicitando permissao de localizacao...") => {
    if (!usuario?.id || !localStorage.getItem("token")) {
      setLocalizacaoRota((prev) => ({
        ...prev,
        compartilhando: false,
        status: "error",
        mensagem: "Entre novamente para compartilhar sua localizacao.",
      }));
      return false;
    }

    if (!navigator.geolocation) {
      setLocalizacaoRota((prev) => ({
        ...prev,
        compartilhando: false,
        status: "error",
        mensagem: "Este navegador nao oferece suporte a geolocalizacao.",
      }));
      return false;
    }

    const payload = {
      roteiroId: id,
      roteiroNome: roteiro?.zona || roteiro?.nome || "Roteiro",
      usuarioId: usuario?.id,
      usuarioNome: usuario?.nome,
      startedAt: new Date().toISOString(),
    };

    localStorage.setItem(ROTEIRO_LOCATION_STORAGE_KEY, JSON.stringify(payload));
    setLocalizacaoRota((prev) => ({
      ...prev,
      compartilhando: true,
      status: "requesting",
      mensagem,
    }));
    window.dispatchEvent(new CustomEvent(ROTEIRO_LOCATION_CHANGED_EVENT, { detail: payload }));
    return true;
  };

  const carregarStatusLocalizacaoRota = async () => {
    if (!id || !localStorage.getItem("token")) return;

    try {
      const response = await api.get(`/roteiros/${id}/localizacao/status`);
      const status = response.data || {};

      setLocalizacaoRota((prev) => ({
        ...prev,
        compartilhando: Boolean(status.deveCompartilhar),
        status: status.deveCompartilhar ? "requesting" : "idle",
        mensagem: status.deveCompartilhar
          ? "Compartilhamento ativo. Retomando atualizacao da localizacao..."
          : "",
        deveCompartilhar: Boolean(status.deveCompartilhar),
        ultimaLocalizacao: status.ultimaLocalizacao || null,
      }));

      if (status.deveCompartilhar) {
        ativarCompartilhamentoLocal("Compartilhamento ativo. Retomando atualizacao da localizacao...");
      } else {
        const ativa = lerLocalizacaoRotaAtiva();
        if (String(ativa?.roteiroId || "") === String(id)) {
          encerrarCompartilhamentoLocal("Compartilhamento de localizacao desativado.");
        }
      }
    } catch (error) {
      console.error("Erro ao consultar status de localizacao:", error);
    }
  };

  const iniciarCompartilhamentoLocalizacao = () => {
    setError("");
    ativarCompartilhamentoLocal();
  };

  const encerrarCompartilhamentoLocal = (mensagem = "Compartilhamento de localizacao encerrado.") => {
    const ativa = lerLocalizacaoRotaAtiva();
    const devePararRotaAtual = String(ativa?.roteiroId || "") === String(id);

    if (devePararRotaAtual) {
      localStorage.removeItem(ROTEIRO_LOCATION_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(ROTEIRO_LOCATION_CHANGED_EVENT, { detail: null }));
    }

    setLocalizacaoRota((prev) => ({
      ...prev,
      compartilhando: false,
      status: "idle",
      mensagem,
      deveCompartilhar: false,
    }));

    return devePararRotaAtual;
  };

  const pararCompartilhamentoLocalizacao = async () => {
    const devePararRotaAtual = encerrarCompartilhamentoLocal();
    if (!devePararRotaAtual) return;

    try {
      await api.delete(`/roteiros/${id}/localizacao`);
    } catch (error) {
      console.error("Erro ao encerrar localizacao no backend:", error);
      setLocalizacaoRota((prev) => ({
        ...prev,
        compartilhando: false,
        status: "error",
        mensagem:
          error.response?.data?.error ||
          error.response?.data?.message ||
          "A localizacao parou no navegador, mas o backend nao confirmou o encerramento.",
      }));
    }
  };

  const marcarLojaConcluida = async (lojaId) => {
    try {
      console.log('🔄 Tentando concluir loja:', lojaId);
      const response = await api.post(`/roteiros/${id}/lojas/${lojaId}/concluir`);
      console.log('✅ Loja concluída com sucesso:', response.data);
      setSuccess("✅ Loja marcada como concluída! Agora você pode atender outras lojas.");
      await carregarRoteiro();
    } catch (error) {
      console.error('❌ Erro ao concluir loja:', error);
      console.error('Detalhes do erro:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      // Exibir mensagem de erro mais detalhada
      const errorMessage = error.response?.data?.error 
        || error.response?.data?.message 
        || error.response?.data?.details
        || error.message
        || 'Erro desconhecido ao concluir loja';
      
      setError(`Erro ao marcar loja como concluída: ${errorMessage}`);
      
      // Se for erro 500, adicionar informação adicional
      if (error.response?.status === 500) {
        setError(
          `Erro interno do servidor ao concluir loja. ` +
          `Detalhes: ${errorMessage}. ` +
          `Por favor, verifique os logs do servidor ou tente novamente.`
        );
      }
    }
  };

  const verificarTodasMaquinasAtendidas = (loja) => {
    if (!loja || !loja.maquinas || loja.maquinas.length === 0) {
      console.log('⚠️ Loja sem máquinas:', loja?.nome);
      return false;
    }
    // Cada máquina precisa ter pelo menos 1 movimentação registrada no roteiro
    const todasAtendidas = loja.maquinas.every(m => m.atendida === true);
    console.log(`🔍 Loja ${loja.nome}: ${loja.maquinas.filter(m => m.atendida).length}/${loja.maquinas.length} máquinas atendidas =`, todasAtendidas);
    return todasAtendidas;
  };

  const marcarLojaAReceber = async (lojaId) => {
    try {
      await api.post(`/roteiros/${id}/lojas/${lojaId}/areceber`);
      setSuccess("Loja marcada como 'à receber'. Siga para o próximo atendimento.");
      setAReceberPendentes(prev => new Set([...prev, lojaId]));
    } catch (error) {
      setError("Erro ao marcar 'à receber': " + (error.response?.data?.error || error.message));
    }
  };
  
  const contarMaquinasAtendidas = () => {
    let totalMaquinas = 0;
    let maquinasAtendidas = 0;
    roteiro.lojas?.forEach(loja => {
      const maquinas = loja.maquinas || [];
      totalMaquinas += maquinas.length;
      maquinasAtendidas += maquinas.filter(m => m.atendida).length;
    });
    return { totalMaquinas, maquinasAtendidas };
  };

  const adicionarGasto = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/roteiros/${id}/gastos`, {
        ...novoGasto,
        valor: parseFloat(novoGasto.valor)
      });
      setSuccess("Gasto adicionado com sucesso!");
      setMostrarFormGasto(false);
      setNovoGasto({ categoria: "", valor: "", descricao: "" });
      await carregarRoteiro();
    } catch (error) {
      setError("Erro ao adicionar gasto: " + (error.response?.data?.error || error.message));
    }
  };

  const adicionarManutencao = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/roteiros/${id}/manutencoes`, {
        maquinaId: manutencaoMaquina,
        descricao: descricaoManutencao,
        status: manutencaoUrgente ? "urgente" : "pendente"
      });
      setSuccess("Manutenção registrada com sucesso!");
      setMostrarFormManutencao(false);
      setManutencaoMaquina(null);
      setDescricaoManutencao("");
      setManutencaoUrgente(false);
      await carregarRoteiro();
    } catch (error) {
      setError("Erro ao registrar manutenção: " + (error.response?.data?.error || error.message));
    }
  };

  const concluirRoteiro = async () => {
    if (!confirm("Deseja realmente concluir este roteiro?")) return;
    
    try {
      await api.post(`/roteiros/${id}/concluir`);
      encerrarCompartilhamentoLocal("Roteiro concluido. Compartilhamento local encerrado.");
      setSuccess("Roteiro concluído com sucesso!");
      setTimeout(() => navigate("/roteiros"), 2000);
    } catch (error) {
      setError("Erro ao concluir roteiro: " + (error.response?.data?.error || error.message));
    }
  };

  if (loading || !roteiro) return <PageLoader />;

  const totalLojas = roteiro.lojas?.length || 0;
  const lojasConcluidas = roteiro.lojas?.filter(l => l.concluida).length || 0;
  const progressoPorcentagem = totalLojas > 0 ? (lojasConcluidas / totalLojas) * 100 : 0;
  
  // Contadores de máquinas (limite de 1 movimentação por máquina)
  const { totalMaquinas, maquinasAtendidas } = contarMaquinasAtendidas();
  const progressoMaquinas = totalMaquinas > 0 ? (maquinasAtendidas / totalMaquinas) * 100 : 0;

  const formatarEnderecoLoja = loja => {
    if (!loja) return "";
    const endereco = (loja.endereco || "").trim();
    const cidade = (loja.cidade || "").trim();
    const estado = (loja.estado || "").trim();
    const cidadeUf = cidade && estado ? `${cidade}/${estado}` : (cidade || estado);

    if (endereco && cidadeUf) return `${endereco} - ${cidadeUf}`;
    if (endereco) return endereco;
    if (cidadeUf) return cidadeUf;
    return "Endereço não cadastrado";
  };

  const localizacaoStatusClass =
    localizacaoRota.status === "error"
      ? "text-red-700"
      : localizacaoRota.compartilhando
        ? "text-green-700"
        : "text-gray-600";

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <Navbar />
      {/* Barra de pesquisa de loja centralizada */}
      <div className="flex flex-col items-center mt-4 w-full px-2">
        <form onSubmit={handleBuscarLoja} className="flex flex-col sm:flex-row items-center gap-2 w-full max-w-md">
          <input
            type="text"
            placeholder="Buscar loja..."
            value={buscaLoja}
            onChange={e => setBuscaLoja(e.target.value)}
            className="p-2 rounded border border-gray-300 w-full min-w-0"
          />
          <button type="submit" className="p-2 rounded bg-blue-600 text-white w-full sm:w-auto">
            Buscar
          </button>
        </form>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={roteiro.zona || "Roteiro"}
          subtitle={`Data: ${new Date(roteiro.data).toLocaleDateString()} | Última atualização: ${new Date(lastUpdate).toLocaleTimeString()}`}
          icon="🛠️"
        />

        {error && <AlertBox type="error" message={error} onClose={() => setError("")} />}
        {success && <AlertBox type="success" message={success} onClose={() => setSuccess("")} />}

        <div className="card mb-6 bg-white border border-blue-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Compartilhar localizacao da rota</h3>
              <p className="text-sm text-gray-600 mt-1">
                Sua localizacao sera enviada ao administrador ate voce finalizar a rota ou parar o compartilhamento.
              </p>
              {localizacaoRota.mensagem && (
                <p className={`text-sm font-semibold mt-2 ${localizacaoStatusClass}`}>
                  {localizacaoRota.mensagem}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={
                localizacaoRota.compartilhando
                  ? pararCompartilhamentoLocalizacao
                  : iniciarCompartilhamentoLocalizacao
              }
              className={localizacaoRota.compartilhando ? "btn-danger" : "btn-primary"}
            >
              {localizacaoRota.compartilhando ? "Parar compartilhamento" : "Compartilhar localizacao"}
            </button>
          </div>
        </div>

        {/* Resumo do Roteiro */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card bg-linear-to-br from-blue-50 to-blue-100">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Progresso Lojas</h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-500"
                  style={{ width: `${progressoPorcentagem}%` }}
                ></div>
              </div>
              <span className="text-sm font-bold">{progressoPorcentagem.toFixed(0)}%</span>
            </div>
            <p className="text-sm text-gray-700 mt-1">
              {lojasConcluidas} de {totalLojas} lojas concluídas
            </p>
            <div className="mt-3 pt-3 border-t border-blue-200">
              <h4 className="text-xs font-bold text-gray-600 mb-1">Máquinas (Limite: 1 mov/máquina)</h4>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-green-500 h-full transition-all duration-500"
                    style={{ width: `${progressoMaquinas}%` }}
                  ></div>
                </div>
                <span className="text-xs font-bold">{progressoMaquinas.toFixed(0)}%</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {maquinasAtendidas} de {totalMaquinas} máquinas com movimentação
              </p>
            </div>
          </div>

          <div className="card bg-linear-to-br from-green-50 to-green-100">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Orçamento</h3>
            <p className="text-2xl font-bold text-green-700">
              R$ {(parseFloat(roteiro.saldoRestante) || 500).toFixed(2)}
            </p>
            <p className="text-sm text-gray-700">
              Gasto: R$ {((parseFloat(roteiro.valorInicial) || 500) - (parseFloat(roteiro.saldoRestante) || 500)).toFixed(2)}
            </p>
          </div>

          <div className="card bg-linear-to-br from-yellow-50 to-yellow-100">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Ações</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  console.log('🔄 [ExecutarRoteiro] Botão atualizar clicado');
                  carregarRoteiro();
                }}
                className="btn-primary text-sm font-bold"
                title="Recarregar dados do roteiro"
              >
                🔄 Atualizar Progresso
              </button>
              <button
                onClick={() => setMostrarFormGasto(true)}
                className="btn-secondary text-sm"
              >
                💰 Novo Gasto
              </button>
              {roteiro.observacoes && (
                <div className="bg-orange-50 border-2 border-orange-500 rounded-xl p-4 shadow-md animate-pulse">
                  <p className="text-lg sm:text-xl font-extrabold text-orange-800 mb-2 flex items-center gap-2">
                    <span className="text-2xl">⚠️</span>
                    Observações Importantes
                  </p>
                  <p className="text-base sm:text-lg font-semibold text-orange-900 whitespace-pre-wrap leading-relaxed">
                    {roteiro.observacoes}
                  </p>
                </div>
              )}
              <button
                onClick={concluirRoteiro}
                disabled={lojasConcluidas < totalLojas || maquinasAtendidas < totalMaquinas}
                className={`text-sm ${
                  lojasConcluidas < totalLojas || maquinasAtendidas < totalMaquinas
                    ? 'btn-secondary opacity-50 cursor-not-allowed' 
                    : 'btn-success'
                }`}
                title={
                  lojasConcluidas < totalLojas 
                    ? `Faltam ${totalLojas - lojasConcluidas} loja(s) para concluir` 
                    : maquinasAtendidas < totalMaquinas
                    ? `Faltam ${totalMaquinas - maquinasAtendidas} máquina(s) com movimentação`
                    : 'Finalizar roteiro'
                }
              >
                {lojasConcluidas === totalLojas && maquinasAtendidas === totalMaquinas 
                  ? '✓ Concluir Roteiro' 
                  : `⏳ Faltam ${totalMaquinas - maquinasAtendidas} máquina(s)`
                }
              </button>
              {/* Botão de desfazer finalização para admin se status for finalizado */}
              {usuario?.role === "ADMIN" && roteiro.status === "concluido" && (
                <button
                  onClick={desfazerFinalizacao}
                  className="btn-danger text-sm"
                  title="Desfazer finalização do roteiro (apenas admin)"
                >
                  ⬅️ Desfazer Finalização
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Formulário de Novo Gasto */}
        {mostrarFormGasto && (
          <div className="card mb-6 bg-yellow-50 border-2 border-yellow-500">
            <form onSubmit={adicionarGasto}>
              <h3 className="text-lg font-bold mb-4">Registrar Novo Gasto</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Categoria</label>
                  <select
                    value={novoGasto.categoria}
                    onChange={(e) => setNovoGasto({...novoGasto, categoria: e.target.value})}
                    className="select-field"
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="Combustível">Combustível</option>
                    <option value="Alimentação">Alimentação</option>
                    <option value="Pedágio">Pedágio</option>
                    <option value="Estacionamento">Estacionamento</option>
                    <option value="Manutenção">Manutenção</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    value={novoGasto.valor}
                    onChange={(e) => setNovoGasto({...novoGasto, valor: e.target.value})}
                    className="input-field"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Descrição</label>
                  <input
                    type="text"
                    value={novoGasto.descricao}
                    onChange={(e) => setNovoGasto({...novoGasto, descricao: e.target.value})}
                    className="input-field"
                    placeholder="Opcional"
                  />
                </div>
                {/* Campos extras para combustível */}
                {novoGasto.categoria === "Combustível" && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold mb-2">KM quando abasteceu</label>
                      <input
                        type="number"
                        value={novoGasto.kmAbastecimento || ""}
                        onChange={e => setNovoGasto({...novoGasto, kmAbastecimento: e.target.value})}
                        className="input-field"
                        placeholder="KM atual"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2">Quantidade de litros</label>
                      <input
                        type="number"
                        step="0.01"
                        value={novoGasto.litrosAbastecimento || ""}
                        onChange={e => setNovoGasto({...novoGasto, litrosAbastecimento: e.target.value})}
                        className="input-field"
                        placeholder="Litros abastecidos"
                        required
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary">Adicionar</button>
                <button 
                  type="button" 
                  onClick={() => setMostrarFormGasto(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Formulário de Manutenção */}
        {mostrarFormManutencao && (
          <div className="card mb-6 bg-red-50 border-2 border-red-500">
            <form onSubmit={adicionarManutencao}>
              <h3 className="text-lg font-bold mb-4">Registrar Manutenção Necessária</h3>
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Descrição do Problema</label>
                <textarea
                  value={descricaoManutencao}
                  onChange={(e) => setDescricaoManutencao(e.target.value)}
                  className="input-field"
                  rows="3"
                  placeholder="Descreva o problema encontrado..."
                  required
                />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  checked={manutencaoUrgente}
                  onChange={e => setManutencaoUrgente(e.target.checked)}
                  id="manutencaoUrgente"
                />
                <label htmlFor="manutencaoUrgente" className="text-sm font-semibold text-red-700">Urgente</label>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-danger">Registrar</button>
                <button 
                  type="button" 
                  onClick={() => {
                    setMostrarFormManutencao(false);
                    setManutencaoMaquina(null);
                    setDescricaoManutencao("");
                    setManutencaoUrgente(false);
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Lojas e Máquinas */}
        <div className="space-y-6">
          {roteiro.lojas?.map((loja, idx) => {
            const maquinasDaLoja = loja.maquinas || [];
            const totalMaquinas = maquinasDaLoja.length;
            const maquinasAtendidas = maquinasDaLoja.filter(m => m.atendida).length;
            const todasAtendidas = verificarTodasMaquinasAtendidas(loja);
            // Filtra manutenções desta loja (por lojaId e status diferente de 'feito')
            const manutencoesDaLoja = Array.isArray(manutencoes)
              ? manutencoes.filter(m => m.lojaId === loja.id && !isManutencaoFeita(m.status))
              : [];
            return (
              <div
                key={loja.id + '-' + (loja.cidade || '') + '-' + idx}
                ref={el => { lojaRefs.current[loja.id] = el; }}
                className={`card ${
                  loja.concluida 
                    ? 'bg-green-50 border-2 border-green-500' 
                    : todasAtendidas 
                      ? 'bg-green-50 border-2 border-green-400 shadow-lg' 
                      : 'bg-white border border-gray-200'
                } w-full max-w-full overflow-x-auto`}
                style={{ minWidth: 0 }}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex flex-wrap items-center gap-2">
                      {loja.concluida && '✅ '}
                      🏪 {loja.nome}
                      <Badge type="info">{loja.cidade}</Badge>
                    </h3>
                    <div className="text-sm text-gray-600 flex flex-wrap items-center gap-1 mt-1">
                      <span className="opacity-80">{formatarEnderecoLoja(loja)}</span>
                    </div>
                    {/* Manutenções desta loja */}
                    {manutencoesDaLoja.length > 0 && (
                      <div className="mt-2 animate-pulse">
                        <div className="font-extrabold text-red-700 text-lg sm:text-xl mb-1 flex items-center gap-2">
                          <span className="animate-pulse text-xl sm:text-2xl">🔴</span>
                          <span>Manutenções registradas:</span>
                        </div>
                        <ul className="pl-4 list-disc text-sm text-red-700 font-bold space-y-1">
                          {manutencoesDaLoja.map((m, idx) => {
                            const maq = loja.maquinas?.find(maq => maq.id === m.maquinaId);
                            return (
                              <li key={m.id + '-' + idx} className="flex items-center gap-2">
                                <span className="animate-pulse">⚠️</span>
                                {maq ? (
                                  <span className="font-bold">{maq.nome}</span>
                                ) : (
                                  <span className="font-bold">Manutenção</span>
                                )}
                                : {m.descricao}
                                {!m.feita && (
                                  <button
                                    onClick={() => marcarManutencaoFeita(m.id)}
                                    className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                    title="Marcar manutenção como feita"
                                  >
                                    Marcar como feita
                                  </button>
                                )}
                                {m.feita && (
                                  <span className="text-green-700 font-bold ml-1">✓</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    <p className="text-sm text-gray-600 mt-1">
                      {maquinasAtendidas} de {totalMaquinas} máquina{totalMaquinas !== 1 ? 's' : ''} atendida{maquinasAtendidas !== 1 ? 's' : ''}
                      <span className="text-xs text-gray-500 ml-1">(Limite: 1 mov/máquina)</span>
                    </p>
                    {!loja.concluida && todasAtendidas && (
                      <p className="text-sm text-green-600 font-bold mt-2 flex items-center gap-2 animate-pulse">
                        <span className="text-lg">✅</span>
                        Todas as máquinas foram atendidas! Clique em "Concluir Loja"
                      </p>
                    )}
                    {!loja.concluida && !todasAtendidas && maquinasAtendidas > 0 && (
                      <p className="text-sm text-yellow-600 font-semibold mt-1">
                        ⏳ Faltam {totalMaquinas - maquinasAtendidas} máquina(s) para concluir a loja
                      </p>
                    )}
                    {!loja.concluida && maquinasAtendidas === 0 && totalMaquinas > 0 && (
                      <p className="text-sm text-red-600 font-semibold mt-1">
                        ❌ Nenhuma máquina foi atendida ainda
                      </p>
                    )}
                  </div>
                  
                    {!loja.concluida && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => marcarLojaConcluida(loja.id)}
                          className="btn-success"
                          title="Concluir loja"
                        >
                          ✓ Concluir Loja
                        </button>
                        <button
                          onClick={() => marcarLojaAReceber(loja.id)}
                          disabled={aReceberPendentes.has(loja.id)}
                          className={`btn-secondary ${aReceberPendentes.has(loja.id) ? 'opacity-60 cursor-not-allowed' : ''}`}
                          title={aReceberPendentes.has(loja.id) ? 'Já há pendência "à receber" para esta loja' : 'Marcar que o recebimento será feito depois'}
                        >
                          💸 Deixar à Receber
                        </button>
                      </div>
                    )}
                  {loja.concluida && (
                    <Badge type="success">Loja Concluída ✓</Badge>
                  )}
                </div>
                
                <div className="space-y-3 w-full">
                  {maquinasDaLoja.map((maquina) => {
                    // Filtra manutenções desta máquina
                    const manutencoesMaquina = Array.isArray(manutencoes)
                      ? manutencoes.filter(m => m.maquinaId === maquina.id)
                      : [];
                    // Verifica se há manutenção urgente pendente para esta máquina
                    const manutencaoUrgentePendente = manutencoesMaquina.some(m => isManutencaoUrgente(m.status));
                    return (
                      <div 
                        key={maquina.id + '-' + (maquina.codigo || '')}
                        className={`p-4 rounded-lg border-2 transition-all w-full ${
                          manutencaoUrgentePendente
                            ? 'bg-red-100 border-red-500 animate-pulse'
                            : maquina.atendida 
                              ? 'bg-green-50 border-green-300' 
                              : 'bg-white border-gray-200'
                        }`}
                        style={{ minWidth: 0 }}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 mb-1 flex flex-wrap items-center gap-2 text-base sm:text-lg">
                              {maquina.nome}
                              {maquina.atendida && (
                                <span className="inline-flex items-center px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                                  ✓ 1/1 mov
                                </span>
                              )}
                              {!maquina.atendida && (
                                <span className="inline-flex items-center px-2 py-1 bg-gray-300 text-gray-700 text-xs font-bold rounded-full">
                                  0/1 mov
                                </span>
                              )}
                            </h4>
                            <p className="text-xs sm:text-sm text-gray-600 break-all">
                              Código: {maquina.codigo} | Tipo: {maquina.tipo}
                            </p>
                            {/* Manutenções desta máquina */}
                            {manutencoesMaquina.filter(m => !isManutencaoFeita(m.status)).length > 0 && (
                              <div className="mt-2">
                                <div className="font-semibold text-red-700 text-xs mb-1 flex items-center gap-1">
                                  <span>🔧</span> Manutenções registradas:
                                </div>
                                <ul className="pl-4 list-disc text-xs">
                                  {manutencoesMaquina.filter(m => !isManutencaoFeita(m.status)).map((m, idx) => (
                                    <li key={m.id + '-' + idx} className={`flex items-center gap-2 ${isManutencaoUrgente(m.status) ? 'text-red-700 font-bold animate-pulse' : 'text-red-800'}`}>
                                      {isManutencaoUrgente(m.status) && <span className="text-red-700 font-bold">URGENTE!</span>}
                                      {m.descricao}
                                      <button
                                        onClick={() => marcarManutencaoFeita(m.id)}
                                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                        title="Marcar manutenção como feita"
                                      >
                                        Feito
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            {!loja.concluida && (
                              <>
                                <button
                                  onClick={() => {
                                    setManutencaoMaquina(maquina.id);
                                    setMostrarFormManutencao(true);
                                  }}
                                  className="w-full sm:w-auto px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                  title="Registrar Manutenção"
                                >
                                  🔧
                                </button>
                                <button
                                  onClick={() => navigate(`/movimentacoes/roteiro/${id}/loja/${loja.id}`, { state: { maquinaId: maquina.id } })}
                                  className={`w-full sm:w-auto px-4 py-2 rounded-lg transition-colors ${
                                    maquina.atendida
                                      ? 'bg-green-600 text-white hover:bg-green-700'
                                      : 'bg-blue-500 text-white hover:bg-blue-600'
                                  }`}
                                  title={maquina.atendida ? 'Limite atingido (1/1)' : 'Registrar movimentação'}
                                >
                                  {maquina.atendida ? '✓ Limite OK' : '📝 Registrar Movimentação'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Gastos Registrados */}
        {roteiro.gastos && roteiro.gastos.length > 0 && (
          <div className="card mt-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Gastos Registrados</h3>
            <div className="overflow-x-auto w-full">
              <table className="min-w-full text-xs sm:text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 sm:px-4 py-2 text-left font-bold">Categoria</th>
                    <th className="px-2 sm:px-4 py-2 text-left font-bold">Valor</th>
                    <th className="px-2 sm:px-4 py-2 text-left font-bold">Descrição</th>
                    <th className="px-2 sm:px-4 py-2 text-left font-bold">Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {roteiro.gastos.map((gasto, idx) => (
                    <tr key={(gasto.id ? gasto.id : 'gasto') + '-' + idx} className="border-t">
                      <td className="px-2 sm:px-4 py-2">{gasto.categoria}</td>
                      <td className="px-2 sm:px-4 py-2 font-bold">R$ {(parseFloat(gasto.valor) || 0).toFixed(2)}</td>
                      <td className="px-2 sm:px-4 py-2">{gasto.descricao || '-'}</td>
                      <td className="px-2 sm:px-4 py-2 text-gray-600">
                        {new Date(gasto.dataHora).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
