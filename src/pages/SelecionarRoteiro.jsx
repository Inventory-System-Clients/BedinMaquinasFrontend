import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox, Badge } from "../components/UIComponents";
import { PageLoader, EmptyState } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";

function normalizarLocalizacaoRoteiro(item) {
  if (!item) return null;

  const origem = item.localizacao || item.ultimaLocalizacao || item;
  const latitude = Number(origem.latitude ?? origem.lat);
  const longitude = Number(origem.longitude ?? origem.lng ?? origem.lon);
  const roteiroId = origem.roteiroId ?? origem.roteiro_id ?? item.roteiroId ?? item.id;

  if (!roteiroId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    roteiroId,
    usuarioId: origem.usuarioId ?? origem.usuario_id ?? item.usuarioId,
    usuarioNome:
      origem.usuarioNome ??
      origem.usuario_nome ??
      origem.usuario?.nome ??
      item.funcionarioNome ??
      "Usuario em rota",
    latitude,
    longitude,
    accuracy: origem.accuracy ?? origem.precisao,
    capturedAt: origem.capturedAt ?? origem.captured_at ?? origem.dataCaptura,
    updatedAt: origem.updatedAt ?? origem.updated_at ?? origem.capturedAt ?? origem.captured_at,
    ativa: Boolean(origem.ativa),
    encerradaEm: origem.encerradaEm ?? origem.encerrada_em ?? null,
    recente: Boolean(origem.recente),
    minutosSemAtualizar:
      origem.minutosSemAtualizar !== undefined ? Number(origem.minutosSemAtualizar) : null,
  };
}

function criarUrlMapaRoteiro(localizacao) {
  if (!localizacao) return "";

  const lat = Number(localizacao.latitude);
  const lng = Number(localizacao.longitude);
  const delta = 0.004;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(",");

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

function formatarHorarioLocalizacao(localizacao) {
  const data = localizacao?.updatedAt || localizacao?.capturedAt;
  if (!data) return "Horario nao informado";

  const date = new Date(data);
  if (Number.isNaN(date.getTime())) return "Horario nao informado";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function obterStatusLocalizacao(localizacao) {
  if (!localizacao) return "";
  if (localizacao.recente) return "Ao vivo";
  if (localizacao.ativa) {
    return localizacao.minutosSemAtualizar !== null
      ? `Ultima localizacao conhecida ha ${localizacao.minutosSemAtualizar} min`
      : "Ultima localizacao conhecida";
  }
  return "Compartilhamento encerrado";
}

function RoteiroMapaLocalizacao({ localizacao, grande = false, onClick }) {
  if (!localizacao) {
    return (
      <div className="mt-2 rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-500">
        Sem localizacao compartilhada no momento.
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="mt-2 w-full text-left rounded border border-gray-200 bg-white overflow-hidden hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-default disabled:hover:border-gray-200"
    >
      <iframe
        title={`Localizacao do roteiro ${localizacao.roteiroId}`}
        src={criarUrlMapaRoteiro(localizacao)}
        className="w-full border-0 pointer-events-none"
        style={{ height: grande ? "70vh" : "8rem" }}
        loading="lazy"
      />
      <div className="p-2 text-xs text-gray-700">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{localizacao.usuarioNome}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              localizacao.recente
                ? "bg-green-100 text-green-700"
                : localizacao.ativa
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {obterStatusLocalizacao(localizacao)}
          </span>
        </div>
        <p>
          Atualizado: {formatarHorarioLocalizacao(localizacao)}
          {localizacao.accuracy ? ` | Precisao aprox.: ${Math.round(localizacao.accuracy)}m` : ""}
        </p>
      </div>
    </button>
  );
}

function calcularProgressoMaquinasRoteiro(roteiro) {
  const total = Number(roteiro?.totalMaquinas || 0);
  const atendidas = Number(roteiro?.maquinasConcluidas || 0);
  const porcentagem = total > 0 ? Math.min(Math.max((atendidas / total) * 100, 0), 100) : 0;

  return {
    total,
    atendidas,
    porcentagem,
  };
}

export function SelecionarRoteiro() {
  const { usuario } = useAuth();
  // Função para desfazer finalização do roteiro (apenas admin)
  const desfazerFinalizacao = async (roteiroId) => {
    if (!window.confirm("Deseja realmente desfazer a finalização deste roteiro?")) return;
    try {
      console.log('🔄 Tentando desfazer finalização do roteiro:', roteiroId);
      const response = await api.post(`/roteiros/${roteiroId}/desfazer-finalizacao`, {});
      console.log('✅ Finalização desfeita com sucesso:', response.data);
      setSuccess("Finalização desfeita! O roteiro voltou para pendente.");
      await carregarRoteiros();
    } catch (error) {
      console.error('❌ Erro ao desfazer finalização:', error);
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
        || 'Erro desconhecido ao desfazer finalização';
      
      setError(`Erro ao desfazer finalização: ${errorMessage}`);
      
      // Se for erro 400, adicionar sugestão
      if (error.response?.status === 400) {
        setError(
          `Não foi possível desfazer a finalização. ` +
          `Detalhes: ${errorMessage}. ` +
          `Verifique se o roteiro está realmente finalizado.`
        );
      }
    }
  };
    // Função para remover loja de todos os roteiros
    const removerLojaDeTodosOsRoteiros = async (lojaId) => {
      if (!window.confirm("Deseja realmente remover esta loja de todos os roteiros?")) return;
      try {
        setError("");
        await api.delete(`/roteiros/remover-loja/${lojaId}`);
        setSuccess("Loja removida de todos os roteiros!");
        await carregarRoteiros();
      } catch (error) {
        setError("Erro ao remover loja: " + (error.response?.data?.error || error.message));
      }
    };
  const navigate = useNavigate();

  const [roteiros, setRoteiros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [draggedLoja, setDraggedLoja] = useState(null);
  const [draggedFromRoteiro, setDraggedFromRoteiro] = useState(null);
  const [funcionarios, setFuncionarios] = useState([]);
  const [todasLojas, setTodasLojas] = useState([]);
  const [showModalAdicionarLoja, setShowModalAdicionarLoja] = useState(false);
  const [roteiroSelecionadoParaAdicionar, setRoteiroSelecionadoParaAdicionar] = useState(null);
  const [filtroLoja, setFiltroLoja] = useState("");
  // Filtro de tipo de roteiro: 'bolinha' ou 'dias'
  const [filtroTipoRoteiro, setFiltroTipoRoteiro] = useState("todos");
  const [filtroNome, setFiltroNome] = useState("");
  const [observacoesEditando, setObservacoesEditando] = useState({});
  const [alertasRoteiro, setAlertasRoteiro] = useState([]);
  const [loadingAlertas, setLoadingAlertas] = useState(false);
  const [localizacoesRotas, setLocalizacoesRotas] = useState({});
  const [mapaExpandido, setMapaExpandido] = useState(null);


  useEffect(() => {
    carregarRoteiros();
    carregarFuncionarios();
    carregarTodasLojas();
  }, []);

  useEffect(() => {
    if (usuario?.role === "ADMIN") {
      carregarAlertasRoteirosIncompletos();
    }
  }, [usuario]);

  useEffect(() => {
    if (usuario?.role !== "ADMIN") return;

    carregarLocalizacoesRotas();
    const intervalId = window.setInterval(carregarLocalizacoesRotas, 15000);

    return () => window.clearInterval(intervalId);
  }, [usuario?.role]);

  const carregarAlertasRoteirosIncompletos = async (dataSelecionada) => {
    if (usuario?.role !== "ADMIN") return;
    try {
      setLoadingAlertas(true);
      const params = dataSelecionada ? { data: dataSelecionada } : {};
      const res = await api.get("/roteiros/alertas/finalizados-incompletos", { params });
      setAlertasRoteiro(res.data?.alertas || []);
    } catch (error) {
      console.error("Erro ao carregar alertas de roteiros incompletos:", error);
      setAlertasRoteiro([]);
    } finally {
      setLoadingAlertas(false);
    }
  };

  const formatarEnderecoAlerta = (loja) => {
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

  const getAlertaFinalizacao = (roteiro) => {
    const alerta = roteiro?.alertaFinalizacao || {};
    return {
      possuiAlertaFinalizacao: Boolean(alerta.possuiAlertaFinalizacao),
      foiFinalizadoSemConcluirTodasLojas: Boolean(alerta.foiFinalizadoSemConcluirTodasLojas),
      totalLojasNaoConcluidas: Number(alerta.totalLojasNaoConcluidas || 0),
      lojasNaoConcluidas: Array.isArray(alerta.lojasNaoConcluidas)
        ? alerta.lojasNaoConcluidas
        : [],
      totalLojasConcluidasSemMovimentacao: Number(
        alerta.totalLojasConcluidasSemMovimentacao || 0,
      ),
      lojasConcluidasSemMovimentacao: Array.isArray(
        alerta.lojasConcluidasSemMovimentacao,
      )
        ? alerta.lojasConcluidasSemMovimentacao
        : [],
    };
  };

  // Função para buscar roteiros do dia 24/02/2026 e bolinhas do dia atual
  const carregarRoteiros = async () => {
    try {
      setLoading(true);
      // Buscar roteiros do dia 24/02/2026
      const responseFixo = await api.get("/roteiros", { params: { data: "2026-02-24" } });
      // Buscar roteiros bolinha do dia atual
      const hoje = new Date().toISOString().split("T")[0];
      const responseBolinha = await api.get("/roteiros", { params: { data: hoje } });
      // Filtrar apenas os de bolinha e o Roteiro Coringa do dia atual
      const bolinhasHoje = (responseBolinha.data || []).filter(r => (r.zona || "").toLowerCase().startsWith("bolinha") || r.zona === "Roteiro Coringa");
      // Priorizar roteiros do dia 24: se houver bolinha com mesmo nome/zona, não adicionar do dia atual
      const zonasFixo = new Set((responseFixo.data || []).map(r => (r.zona || "").toLowerCase().trim()));
      const bolinhasHojeNaoDuplicadas = bolinhasHoje.filter(r => !zonasFixo.has((r.zona || "").toLowerCase().trim()));
      const roteirosCombinados = [...(responseFixo.data || []), ...bolinhasHojeNaoDuplicadas];
      setRoteiros(roteirosCombinados);
    } catch (error) {
      setError(
        "Erro ao carregar roteiros: " +
          (error.response?.data?.error || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const carregarFuncionarios = async () => {
    try {
      const response = await api.get("/usuarios/funcionarios");
      setFuncionarios(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar funcionários:", error);
    }
  };

  const carregarTodasLojas = async () => {
    try {
      const response = await api.get("/lojas");
      setTodasLojas(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar lojas:", error);
    }
  };

  const removerLojaDoRoteiro = async (roteiroId, lojaId) => {
    if (!window.confirm("Deseja realmente remover esta loja deste roteiro?")) return;

    try {
      setError("");
      await api.delete(`/roteiros/${roteiroId}/lojas/${lojaId}`);
      setSuccess("Loja removida do roteiro!");
      await carregarRoteiros();
    } catch (error) {
      setError("Erro ao remover loja: " + (error.response?.data?.error || error.message));
    }
  };

  const carregarLocalizacoesRotas = async () => {
    try {
      const response = await api.get("/roteiros/localizacoes-ativas");
      const data = response.data;
      const lista = Array.isArray(data)
        ? data
        : Array.isArray(data?.localizacoes)
          ? data.localizacoes
          : Array.isArray(data?.rows)
            ? data.rows
            : data && typeof data === "object"
              ? Object.values(data)
              : [];

      const agrupadas = {};
      lista.forEach((item) => {
        const localizacao = normalizarLocalizacaoRoteiro(item);
        if (localizacao) {
          agrupadas[String(localizacao.roteiroId)] = localizacao;
        }
      });

      setLocalizacoesRotas(agrupadas);
    } catch (error) {
      console.error("Erro ao carregar localizacoes ativas:", error);
    }
  };

  const selecionarRoteiro = (roteiroId) => {
    // Verificar se o roteiro está concluído
    const roteiro = roteiros.find((r) => r.id === roteiroId);

    if (roteiro) {

      const totalLojas = roteiro.lojas?.length || 0;
      const lojasConcluidas =
        roteiro.lojas?.filter((l) => l.concluida).length || 0;

      // Se todas as lojas estão concluídas ou status é 'concluido'
      if (
        (totalLojas > 0 && lojasConcluidas === totalLojas) ||
        roteiro.status === "concluido"
      ) {
        setError(
          "Este roteiro já foi concluído hoje e não pode mais ser acessado!",
        );
        return;
      }
    }

    navigate(`/roteiros/${roteiroId}/executar`);
  };

  const handleDragStart = (e, loja, roteiroId) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ lojaId: loja.id, roteiroOrigemId: roteiroId }),
    );
    setDraggedLoja(loja);
    setDraggedFromRoteiro(roteiroId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnd = () => {
    setDraggedLoja(null);
    setDraggedFromRoteiro(null);
  };

  const handleDrop = async (e, roteiroDestinoId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedLoja || !draggedFromRoteiro) return;

    const roteiroOrigem = roteiros.find((r) => r.id === draggedFromRoteiro);
    const roteiroDestino = roteiros.find((r) => r.id === roteiroDestinoId);

    if (
      !isAdmin ||
      !podeMoverLojas(roteiroOrigem) ||
      !podeMoverLojas(roteiroDestino)
    ) {
      setError("Voce nao tem permissao para mover lojas entre estes roteiros.");
      setDraggedLoja(null);
      setDraggedFromRoteiro(null);
      return;
    }

    // Se é o mesmo roteiro, não fazer nada
    if (draggedFromRoteiro === roteiroDestinoId) {
      setDraggedLoja(null);
      setDraggedFromRoteiro(null);
      return;
    }

    try {
      setError("");

      // Mover loja entre roteiros
      await api.post("/roteiros/mover-loja", {
        lojaId: draggedLoja.id,
        roteiroOrigemId: draggedFromRoteiro,
        roteiroDestinoId: roteiroDestinoId,
      });

      setSuccess(`Loja "${draggedLoja.nome}" movida com sucesso!`);
      await carregarRoteiros();
    } catch (error) {
      setError(
        "Erro ao mover loja: " + (error.response?.data?.error || error.message),
      );
    } finally {
      setDraggedLoja(null);
      setDraggedFromRoteiro(null);
    }
  };

  const atribuirFuncionario = async (roteiroId, funcionarioId) => {
    try {
      setError("");
      await api.put(`/roteiros/${roteiroId}`, { funcionarioId });

      setSuccess("Funcionário atribuído com sucesso!");
      await carregarRoteiros();
    } catch (error) {
      setError(
        "Erro ao atribuir funcionário: " +
          (error.response?.data?.error || error.message),
      );
    }
  };

  const salvarObservacoes = async (roteiroId, observacoes) => {
    try {
      setError("");
      const novoValor = observacoes || null;
      await api.put(`/roteiros/${roteiroId}`, { observacoes: novoValor });
      // Atualiza apenas o state local — backend não salva observacoes no banco ainda
      setRoteiros(prev => prev.map(r => r.id === roteiroId ? { ...r, observacoes: novoValor } : r));
      setSuccess(novoValor ? "Observação salva!" : "Observação excluída!");
    } catch (error) {
      setError("Erro ao salvar observação: " + (error.response?.data?.error || error.message));
    }
  };

  const adicionarLojaAoRoteiro = async (lojaId, roteiroId) => {
    try {
      setError("");
      await api.post(`/roteiros/${roteiroId}/lojas`, { lojaId });

      setSuccess("Loja adicionada ao roteiro com sucesso!");
      await carregarRoteiros();
    } catch (error) {
      setError(
        "Erro ao adicionar loja: " +
          (error.response?.data?.error || error.message),
      );
    }
  };

  const abrirModalAdicionarLoja = (roteiro) => {
    setRoteiroSelecionadoParaAdicionar(roteiro);
    setFiltroLoja("");
    setShowModalAdicionarLoja(true);
  };

  const fecharModalAdicionarLoja = () => {
    setShowModalAdicionarLoja(false);
    setRoteiroSelecionadoParaAdicionar(null);
    setFiltroLoja("");
  };

  const adicionarLojaSelecionadaAoRoteiro = async (loja, jaEstaEmRoteiro) => {
    if (!roteiroSelecionadoParaAdicionar) return;

    // Se a loja já está em um roteiro, confirmar a movimentação
    if (jaEstaEmRoteiro) {
      const confirmar = window.confirm(
        `A loja "${loja.nome}" já está no roteiro "${jaEstaEmRoteiro.zona}".\n\nDeseja movê-la para "${roteiroSelecionadoParaAdicionar.zona}"?`,
      );
      if (!confirmar) return;

      // Mover loja entre roteiros
      try {
        setError("");
        await api.post("/roteiros/mover-loja", {
          lojaId: loja.id,
          roteiroOrigemId: jaEstaEmRoteiro.id,
          roteiroDestinoId: roteiroSelecionadoParaAdicionar.id,
        });

        setSuccess(`Loja "${loja.nome}" movida com sucesso!`);
        await carregarRoteiros();
        fecharModalAdicionarLoja();
      } catch (error) {
        setError(
          "Erro ao mover loja: " +
            (error.response?.data?.error || error.message),
        );
      }
    } else {
      // Adicionar loja que não está em nenhum roteiro
      await adicionarLojaAoRoteiro(loja.id, roteiroSelecionadoParaAdicionar.id);
      fecharModalAdicionarLoja();
    }
  };

  // Exibir todos os roteiros carregados, aplicar filtro de tipo e nome normalmente
  let roteirosFiltrados = roteiros.filter(r =>
    !filtroNome ||
    (r.nome || r.zona || "").toLowerCase().includes(filtroNome.toLowerCase())
  );
  if (filtroTipoRoteiro === "bolinha") {
    roteirosFiltrados = roteirosFiltrados.filter(r => (r.zona || "").toLowerCase().startsWith("bolinha"));
  } else if (filtroTipoRoteiro === "dias") {
    const dias = ["segunda", "terça", "terca", "quarta", "quinta", "sexta"];
    roteirosFiltrados = roteirosFiltrados.filter(r => {
      const zona = (r.zona || "").toLowerCase();
      return dias.some(dia => zona.startsWith(dia));
    });
  } else if (filtroTipoRoteiro === "gigantes") {
    roteirosFiltrados = roteirosFiltrados.filter(r => (r.zona || "").toLowerCase() === "gruas gigantes");
  }

  // Roteiros de bolinha e gruas gigantes só aparecem para o funcionário atribuído (exceto admin)
  if (usuario?.role !== "ADMIN") {
    roteirosFiltrados = roteirosFiltrados.filter(r => {
      const zona = (r.zona || "").toLowerCase();
      if (zona.startsWith("bolinha") || zona === "gruas gigantes") {
        return r.funcionarioId === usuario.id;
      }
      return true;
    });
  }


  // Separar roteiros pendentes/em andamento e concluídos
  // Se todas as lojas de um roteiro estão concluídas, considerar como concluído
  const roteirosPendentes = roteirosFiltrados.filter((r) => {
    // Se o status já é concluído, não mostrar aqui
    if (r.status === "concluido") return false;

    // Se tem lojas e todas estão concluídas, não mostrar aqui (vai para concluídos)
    const totalLojas = r.lojas?.length || 0;
    const lojasConcluidas = r.lojas?.filter((l) => l.concluida).length || 0;

    if (totalLojas > 0 && lojasConcluidas === totalLojas) {
      return false; // Roteiro com todas lojas concluídas vai para "concluídos"
    }

    return true; // Pendente ou em andamento com lojas pendentes
  });

  const roteirosConcluidos = roteirosFiltrados.filter((r) => {
    // Se o status já é concluído, mostrar aqui
    if (r.status === "concluido") return true;

    // Se tem lojas e todas estão concluídas, considerar concluído
    const totalLojas = r.lojas?.length || 0;
    const lojasConcluidas = r.lojas?.filter((l) => l.concluida).length || 0;

    return totalLojas > 0 && lojasConcluidas === totalLojas;
  });

  // Verificar se usuário é admin
  const isAdmin = usuario?.role === "ADMIN";

  function permissaoNaoBloqueada(roteiro, permissao) {
    return roteiro?.[permissao] !== false;
  }

  function podeGerenciarLojas(roteiro) {
    return isAdmin && permissaoNaoBloqueada(roteiro, "permiteGerenciarLojas");
  }

  function podeMoverLojas(roteiro) {
    return podeGerenciarLojas(roteiro) && permissaoNaoBloqueada(roteiro, "permiteMoverLojas");
  }

  function podeRemoverLojas(roteiro) {
    return podeGerenciarLojas(roteiro) && permissaoNaoBloqueada(roteiro, "permiteRemoverLojas");
  }

  function podeAdicionarLojas(roteiro) {
    return podeGerenciarLojas(roteiro);
  }

  function podeFinalizarAdminComPendencias(roteiro) {
    return isAdmin && Boolean(roteiro?.permiteFinalizacaoAdminComPendencias);
  }

  const renderMapaAdmin = (roteiro) => {
    if (!isAdmin) return null;

    const localizacao = localizacoesRotas[String(roteiro.id)];

    return (
      <div className="mb-3">
        <p className="text-xs font-bold text-gray-700">
          {localizacao?.recente ? "LOCALIZACAO AO VIVO" : "ULTIMA LOCALIZACAO CONHECIDA"}
        </p>
        <RoteiroMapaLocalizacao
          localizacao={localizacao}
          onClick={
            localizacao
              ? (event) => {
                  event.stopPropagation();
                  setMapaExpandido({ roteiro, localizacao });
                }
              : undefined
          }
        />
      </div>
    );
  };

  const concluirRoteiroAdmin = async (roteiro) => {
    if (!isAdmin) return;

    const lojas = roteiro.lojas || [];
    const lojasPendentes = lojas.filter((loja) => !loja.concluida);
    const possuiPendencias =
      lojasPendentes.length > 0 ||
      getAlertaFinalizacao(roteiro).possuiAlertaFinalizacao;

    if (
      possuiPendencias &&
      !window.confirm("Este roteiro possui lojas nao concluidas. Deseja finalizar mesmo assim?")
    ) {
      return;
    }

    try {
      setError("");
      const response = await api.post(`/roteiros/${roteiro.id}/concluir`);
      const alertaFinalizacao =
        response.data?.roteiro?.alertaFinalizacao || response.data?.alertaFinalizacao;

      setSuccess(
        alertaFinalizacao?.possuiAlertaFinalizacao
          ? "Roteiro finalizado com alertas."
          : "Roteiro finalizado com sucesso!"
      );
      await carregarRoteiros();
      await carregarAlertasRoteirosIncompletos();
    } catch (error) {
      setError("Erro ao finalizar roteiro: " + (error.response?.data?.error || error.message));
    }
  };

  // Função helper para verificar se uma loja já está em um roteiro

  const obterRoteiroAtualDaLoja = (lojaId) => {
    return roteirosFiltrados.find((roteiro) =>
      roteiro.lojas?.some((loja) => loja.id === lojaId),
    );
  };

  // Filtrar lojas para o modal
  const lojasFiltradas = todasLojas.filter((loja) => {
    if (!loja.ativo) return false;
    if (!filtroLoja) return true;

    const searchTerm = filtroLoja.toLowerCase();
    return (
      loja.nome.toLowerCase().includes(searchTerm) ||
      loja.cidade.toLowerCase().includes(searchTerm) ||
      loja.estado.toLowerCase().includes(searchTerm) ||
      loja.endereco?.toLowerCase().includes(searchTerm)
    );
  });

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
          <PageHeader
            title="Selecionar Roteiro"
            subtitle="Escolha um roteiro para iniciar as movimentações"
            icon="🗺️"
          />
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <button
              className={`px-4 py-2 rounded-lg font-semibold border-2 transition-colors ${filtroTipoRoteiro === "bolinha" ? "bg-blue-500 text-white border-blue-700" : "bg-white text-blue-700 border-blue-300 hover:bg-blue-100"}`}
              onClick={() => setFiltroTipoRoteiro("bolinha")}
            >
              Bolinha
            </button>
            <button
              className={`px-4 py-2 rounded-lg font-semibold border-2 transition-colors ${filtroTipoRoteiro === "dias" ? "bg-blue-500 text-white border-blue-700" : "bg-white text-blue-700 border-blue-300 hover:bg-blue-100"}`}
              onClick={() => setFiltroTipoRoteiro("dias")}
            >
              Dias da Semana
            </button>
            <button
              className={`px-4 py-2 rounded-lg font-semibold border-2 transition-colors ${filtroTipoRoteiro === "gigantes" ? "bg-orange-500 text-white border-orange-700" : "bg-white text-orange-700 border-orange-300 hover:bg-orange-100"}`}
              onClick={() => setFiltroTipoRoteiro("gigantes")}
            >
              Gigantes
            </button>
            <button
              className={`px-4 py-2 rounded-lg font-semibold border-2 transition-colors ${filtroTipoRoteiro === "todos" ? "bg-blue-500 text-white border-blue-700" : "bg-white text-blue-700 border-blue-300 hover:bg-blue-100"}`}
              onClick={() => setFiltroTipoRoteiro("todos")}
            >
              Todos
            </button>
            <input
              type="text"
              placeholder="🔍 Buscar por nome..."
              value={filtroNome}
              onChange={e => setFiltroNome(e.target.value)}
              className="px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-blue-400 outline-none text-sm min-w-40"
            />
          </div>
        </div>

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

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card-gradient text-center">
            <div className="text-4xl mb-2">📋</div>
            <div className="text-3xl font-bold text-primary mb-1">
              {roteirosFiltrados.length}
            </div>
            <div className="text-gray-600 font-medium">Roteiros Hoje</div>
          </div>
          <div className="card-gradient text-center">
            <div className="text-4xl mb-2">🔄</div>
            <div className="text-3xl font-bold text-yellow-600 mb-1">
              {roteirosPendentes.length}
            </div>
            <div className="text-gray-600 font-medium">Pendentes</div>
          </div>
          <div className="card-gradient text-center">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-3xl font-bold text-green-600 mb-1">
              {roteirosConcluidos.length}
            </div>
            <div className="text-gray-600 font-medium">Concluídos</div>
          </div>
        </div>

        {/* Roteiros Pendentes */}
        {roteirosPendentes.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              🔄 Roteiros Disponíveis
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roteirosPendentes.map((roteiro) => {
                const progressoMaquinas = calcularProgressoMaquinasRoteiro(roteiro);

                return (
                <div
                  key={roteiro.id + '-' + (roteiro.zona || '')}
                  className={`transition-all duration-300 ${
                    roteiro.zona === "Roteiro Coringa"
                      ? "card bg-purple-200 border-2 border-purple-400 rounded-3xl shadow-md"
                      : (roteiro.zona || "").toLowerCase() === "gruas gigantes"
                      ? "card bg-orange-200 border-2 border-orange-500 rounded-3xl shadow-md"
                      : (roteiro.zona || "").toLowerCase().startsWith("bolinha")
                        ? "card bg-blue-100 border-2 border-blue-400 rounded-3xl shadow-md"
                        : "card-gradient"
                  } hover:shadow-xl ${
                    isAdmin && draggedLoja && draggedFromRoteiro !== roteiro.id
                      ? "ring-2 ring-blue-400 ring-offset-2"
                      : ""
                  }`}
                  onDragOver={podeMoverLojas(roteiro) ? handleDragOver : undefined}
                  onDrop={
                    podeMoverLojas(roteiro) ? (e) => handleDrop(e, roteiro.id) : undefined
                  }
                >
                  <div className="flex flex-col mb-4">
                    <h3 className="text-xl font-bold text-primary mb-2">
                      {roteiro.zona}
                    </h3>
                    {renderMapaAdmin(roteiro)}

                    <div className="flex items-center justify-between">
                      {isAdmin && (
                        <div className="flex-1 mr-2">
                          <label className="text-xs text-gray-600 block mb-1">
                            Funcionário:
                          </label>
                          <select
                            value={roteiro.funcionarioId || ""}
                            onChange={(e) =>
                              atribuirFuncionario(
                                roteiro.id,
                                e.target.value || null,
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-sm px-2 py-1 border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 rounded outline-none"
                          >
                            <option value="">-- Não atribuído --</option>
                            {funcionarios.map((func) => (
                              <option key={func.id} value={func.id}>
                                {func.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {!isAdmin && roteiro.funcionarioNome && (
                        <p className="text-sm text-gray-600 mb-2">
                          <strong>Funcionário:</strong>{" "}
                          {roteiro.funcionarioNome}
                        </p>
                      )}
                      <Badge
                        variant={
                          roteiro.status === "em_andamento" ? "warning" : "info"
                        }
                      >
                        {roteiro.status === "em_andamento"
                          ? "Em Andamento"
                          : "Pendente"}
                      </Badge>
                    </div>
                    {isAdmin && (
                      <div className="mt-2">
                        <label className="text-xs text-gray-600 block mb-1">⚠️ Observações para o funcionário:</label>
                        <textarea
                          rows={2}
                          placeholder="Adicionar observação para o funcionário..."
                          value={observacoesEditando[roteiro.id] !== undefined ? observacoesEditando[roteiro.id] : (roteiro.observacoes || "")}
                          onChange={(e) => {
                            e.stopPropagation();
                            setObservacoesEditando(prev => ({ ...prev, [roteiro.id]: e.target.value }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-sm px-2 py-1 border-2 border-gray-300 hover:border-orange-400 focus:border-orange-500 rounded outline-none resize-none"
                        />
                        <div className="mt-1 flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const val = observacoesEditando[roteiro.id] !== undefined ? observacoesEditando[roteiro.id] : (roteiro.observacoes || "");
                              salvarObservacoes(roteiro.id, val);
                              setObservacoesEditando(prev => { const n = {...prev}; delete n[roteiro.id]; return n; });
                            }}
                            className="flex-1 text-xs py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors font-semibold"
                          >
                            💾 Salvar
                          </button>
                          {roteiro.observacoes && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm("Excluir a observação deste roteiro?")) {
                                  salvarObservacoes(roteiro.id, null);
                                  setObservacoesEditando(prev => { const n = {...prev}; delete n[roteiro.id]; return n; });
                                }
                              }}
                              className="text-xs py-1 px-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors font-semibold"
                              title="Excluir observação"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {!isAdmin && roteiro.observacoes && (
                      <div className="mt-2 bg-yellow-50 border-2 border-orange-400 rounded-lg p-3">
                        <p className="text-sm font-bold text-orange-700 mb-1">⚠️ Observações</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{roteiro.observacoes}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center text-gray-700">
                      <span className="text-2xl mr-3">📍</span>
                      <div>
                        <div className="font-semibold">
                          Estado: {roteiro.estado || "N/A"}
                        </div>
                        <div className="text-sm text-gray-600">
                          {roteiro.cidade || "N/A"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center text-gray-700">
                      <span className="text-2xl mr-3">🏪</span>
                      <div>
                        <div className="font-semibold">
                          {roteiro.lojas?.length || 0} Lojas
                        </div>
                        <div className="text-sm text-gray-600">
                          {roteiro.lojas?.filter((l) => l.concluida).length ||
                            0}{" "}
                          concluídas
                        </div>
                      </div>
                    </div>

                    {/* Lista de lojas (arrastáveis para admin) */}
                    {roteiro.lojas && roteiro.lojas.length > 0 && (
                      <div className="mb-3 space-y-1 max-h-32 overflow-y-auto">
                        <p className="text-xs font-semibold text-gray-700 mb-1">
                          Lojas neste roteiro:
                        </p>
                        {roteiro.lojas.map((loja, idx) => (
                          <div
                            key={loja.id + '-' + roteiro.id + '-' + idx}
                            draggable={podeMoverLojas(roteiro)}
                            onDragStart={(e) => {
                              if (podeMoverLojas(roteiro)) {
                                handleDragStart(e, loja, roteiro.id);
                              } else {
                                e.preventDefault();
                              }
                            }}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => e.stopPropagation()}
                            className={`text-xs p-2 rounded border transition-all flex items-center justify-between ${
                              loja.concluida
                                ? "bg-green-50 border-green-400 text-green-800"
                                : "bg-white border-gray-300"
                            } ${
                              draggedLoja?.id === loja.id
                                ? "border-blue-500 opacity-50 shadow-lg"
                                : ""
                            } ${
                              podeMoverLojas(roteiro)
                                ? "cursor-move hover:border-blue-400 hover:shadow-md select-none"
                                : ""
                            }`}
                          >
                            <span>{loja.concluida ? "✅" : "🏪"} {loja.nome || "Loja sem nome"}</span>
                            {podeRemoverLojas(roteiro) && (
                              <button
                                className="ml-1 w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded hover:bg-red-600"
                                title="Remover loja de todos os roteiros"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removerLojaDoRoteiro(roteiro.id, loja.id);
                                }}
                              >
                                <span className="text-base" role="img" aria-label="Excluir">🗑️</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center text-gray-700">
                      <span className="text-2xl mr-3">🎰</span>
                      <div>
                        <div className="font-semibold">
                          {progressoMaquinas.total} Máquinas
                        </div>
                      </div>
                    </div>

                    {roteiro.funcionarioNome && (
                      <div className="flex items-center text-gray-700">
                        <span className="text-2xl mr-3">👤</span>
                        <div>
                          <div className="font-semibold">
                            {roteiro.funcionarioNome}
                          </div>
                        </div>
                      </div>
                    )}

                    {roteiro.status === "em_andamento" && (
                      <div className="mt-4 bg-yellow-100 border-l-4 border-yellow-500 p-3 rounded">
                        <div className="flex items-center">
                          <span className="text-yellow-700 font-semibold">
                            Progresso: {progressoMaquinas.atendidas}/
                            {progressoMaquinas.total}
                          </span>
                        </div>
                        <div className="w-full bg-yellow-200 rounded-full h-2 mt-2">
                          <div
                            className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${progressoMaquinas.porcentagem}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 space-y-2">
                    {podeAdicionarLojas(roteiro) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirModalAdicionarLoja(roteiro);
                        }}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                      >
                        ➕ Adicionar Loja Manualmente
                      </button>
                    )}
                    {podeFinalizarAdminComPendencias(roteiro) && roteiro.status !== "concluido" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          concluirRoteiroAdmin(roteiro);
                        }}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                      >
                        Finalizar Roteiro
                      </button>
                    )}
                    <button
                      className="btn-primary w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        selecionarRoteiro(roteiro.id);
                      }}
                      disabled={(() => {
                        const totalLojas = roteiro.lojas?.length || 0;
                        const lojasConcluidas =
                          roteiro.lojas?.filter((l) => l.concluida).length || 0;
                        return totalLojas > 0 && lojasConcluidas === totalLojas;
                      })()}
                    >
                      {(() => {
                        const totalLojas = roteiro.lojas?.length || 0;
                        const lojasConcluidas =
                          roteiro.lojas?.filter((l) => l.concluida).length || 0;
                        if (totalLojas > 0 && lojasConcluidas === totalLojas) {
                          return "Roteiro Concluído";
                        } else if (lojasConcluidas > 0) {
                          return "Continuar Roteiro";
                        } else {
                          return "Iniciar Roteiro";
                        }
                      })()}
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card-gradient">
            <EmptyState
              icon="🗺️"
              title="Nenhum roteiro disponível"
              message={
                usuario?.role === "ADMIN"
                  ? "Clique em 'Gerar 6 Roteiros Diários' para criar os roteiros de hoje."
                  : "Aguarde um administrador gerar os roteiros do dia."
              }
            />
          </div>
        )}

        {/* Roteiros Concluídos */}
        {roteirosConcluidos.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              ✅ Roteiros Concluídos Hoje
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roteirosConcluidos.map((roteiro) => {
                const alerta = getAlertaFinalizacao(roteiro);
                const possuiAlertaFinalizacao =
                  roteiro.status === "concluido" &&
                  alerta.possuiAlertaFinalizacao;

                return (
                  <div
                    key={roteiro.id + '-' + (roteiro.zona || '')}
                    className={`card-gradient border-2 relative ${
                      possuiAlertaFinalizacao
                        ? "bg-linear-to-br from-amber-50 to-amber-100 border-amber-500"
                        : roteiro.zona === "Roteiro Coringa"
                          ? "bg-purple-200 border-purple-400 rounded-xl"
                          : "bg-linear-to-br from-green-50 to-green-100 border-green-500"
                    } ${
                      podeMoverLojas(roteiro) && draggedLoja && draggedFromRoteiro !== roteiro.id
                        ? "ring-2 ring-blue-400 ring-offset-2"
                        : ""
                    }`}
                    onDragOver={podeMoverLojas(roteiro) ? handleDragOver : undefined}
                    onDrop={podeMoverLojas(roteiro) ? (e) => handleDrop(e, roteiro.id) : undefined}
                  >
                    {/* Ícone de bloqueio */}
                    <div className="absolute top-4 right-4 text-3xl">🔒</div>

                    <div className="flex items-center justify-between mb-4">
                      <h3
                        className={`text-xl font-bold ${
                          possuiAlertaFinalizacao
                            ? "text-amber-800"
                            : "text-green-700"
                        }`}
                      >
                        {roteiro.zona}
                      </h3>
                      {possuiAlertaFinalizacao ? (
                        <Badge variant="warning">⚠️ Finalizado com alerta</Badge>
                      ) : (
                        <Badge variant="success">✅ Finalizado sem pendências</Badge>
                      )}
                    </div>
                    {renderMapaAdmin(roteiro)}

                    <div className="space-y-2 text-gray-700">
                      <div className="flex items-center">
                        <span className="text-2xl mr-2">📍</span>
                        <div>
                          <div className="font-semibold">
                            Estado: {roteiro.estado || "N/A"}
                          </div>
                          <div className="text-sm text-gray-600">
                            {roteiro.cidade || "N/A"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-2xl mr-2">🏪</span>
                        <span>Lojas: {roteiro.lojas?.length || 0}</span>
                      </div>
                      {roteiro.lojas && roteiro.lojas.length > 0 && (
                        <div className="mb-3 space-y-1 max-h-32 overflow-y-auto">
                          <p className="text-xs font-semibold text-gray-700 mb-1">
                            Lojas neste roteiro:
                          </p>
                          {roteiro.lojas.map((loja, idx) => (
                            <div
                              key={loja.id + '-' + roteiro.id + '-' + idx}
                              draggable={podeMoverLojas(roteiro)}
                              onDragStart={(e) => {
                                if (podeMoverLojas(roteiro)) {
                                  handleDragStart(e, loja, roteiro.id);
                                } else {
                                  e.preventDefault();
                                }
                              }}
                              onDragEnd={handleDragEnd}
                              onClick={(e) => e.stopPropagation()}
                              className={`text-xs p-2 rounded border transition-all flex items-center justify-between ${
                                loja.concluida
                                  ? "bg-green-50 border-green-400 text-green-800"
                                  : "bg-white border-gray-300"
                              } ${
                                draggedLoja?.id === loja.id
                                  ? "border-blue-500 opacity-50 shadow-lg"
                                  : ""
                              } ${
                                podeMoverLojas(roteiro)
                                  ? "cursor-move hover:border-blue-400 hover:shadow-md select-none"
                                  : ""
                              }`}
                            >
                              <span>{loja.concluida ? "✅" : "🏪"} {loja.nome || "Loja sem nome"}</span>
                              {podeRemoverLojas(roteiro) && (
                                <button
                                  className="ml-1 w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded hover:bg-red-600"
                                  title="Remover loja deste roteiro"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removerLojaDoRoteiro(roteiro.id, loja.id);
                                  }}
                                >
                                  <span className="text-base" role="img" aria-label="Excluir">🗑️</span>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center">
                        <span className="text-2xl mr-2">🎰</span>
                        <span>Máquinas: {roteiro.totalMaquinas || 0}</span>
                      </div>
                      {roteiro.funcionarioNome && (
                        <div className="flex items-center">
                          <span className="text-2xl mr-2">👤</span>
                          <span>{roteiro.funcionarioNome}</span>
                        </div>
                      )}
                    </div>

                    {possuiAlertaFinalizacao && (
                      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-100 p-3 space-y-3">
                        {alerta.foiFinalizadoSemConcluirTodasLojas && (
                          <section>
                            <p className="text-sm font-semibold text-red-700">
                              Lojas não concluídas ({alerta.totalLojasNaoConcluidas})
                            </p>
                            <ul className="mt-1 list-disc pl-5 text-sm text-red-900 space-y-1">
                              {alerta.lojasNaoConcluidas.length > 0 ? (
                                alerta.lojasNaoConcluidas.map((loja) => (
                                  <li key={loja.id}>
                                    {loja.nome || "Loja sem nome"}
                                  </li>
                                ))
                              ) : (
                                <li>Detalhes não informados pelo backend</li>
                              )}
                            </ul>
                          </section>
                        )}

                        {alerta.totalLojasConcluidasSemMovimentacao > 0 && (
                          <section>
                            <p className="text-sm font-semibold text-orange-700">
                              Lojas concluídas sem nenhuma máquina movimentada ({alerta.totalLojasConcluidasSemMovimentacao})
                            </p>
                            <ul className="mt-1 list-disc pl-5 text-sm text-orange-900 space-y-1">
                              {alerta.lojasConcluidasSemMovimentacao.length > 0 ? (
                                alerta.lojasConcluidasSemMovimentacao.map((loja) => (
                                  <li key={loja.id}>
                                    {loja.nome || "Loja sem nome"}
                                  </li>
                                ))
                              ) : (
                                <li>Detalhes não informados pelo backend</li>
                              )}
                            </ul>
                          </section>
                        )}
                      </div>
                    )}

                    {/* Observação do roteiro */}
                    {roteiro.observacoes && (
                      <div className="mt-4 bg-yellow-50 border-2 border-orange-400 rounded-lg p-3">
                        <p className="text-sm font-bold text-orange-700 mb-1">⚠️ Observações</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{roteiro.observacoes}</p>
                      </div>
                    )}

                    {/* Mensagem de roteiro bloqueado */}
                    <div
                      className={`mt-4 p-4 border-l-4 rounded ${
                        possuiAlertaFinalizacao
                          ? "bg-amber-200 border-amber-600"
                          : "bg-green-200 border-green-600"
                      }`}
                    >
                      <p
                        className={`text-sm font-semibold text-center ${
                          possuiAlertaFinalizacao
                            ? "text-amber-900"
                            : "text-green-800"
                        }`}
                      >
                        {possuiAlertaFinalizacao
                          ? "⚠️ Roteiro finalizado com inconsistências. Revise os alertas acima."
                          : "🎉 Roteiro finalizado sem pendências! Não pode mais ser acessado hoje."}
                      </p>
                    </div>
                    {/* Botão de desfazer finalização para admin */}
                    {usuario?.role === "ADMIN" && (
                      <div className="mt-4 space-y-2">
                        {podeAdicionarLojas(roteiro) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirModalAdicionarLoja(roteiro);
                            }}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                          >
                            ➕ Adicionar Loja Manualmente
                          </button>
                        )}
                        <button
                          onClick={() => desfazerFinalizacao(roteiro.id)}
                          className="btn-danger w-full"
                          title="Desfazer finalização do roteiro (apenas admin)"
                        >
                          ⬅️ Desfazer Finalização
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isAdmin && !loadingAlertas && alertasRoteiro.length > 0 && (
          <section className="mt-8 rounded-lg border-2 border-red-300 bg-red-50 p-4 shadow-sm">
            <h3 className="font-bold text-red-800 text-lg flex items-center gap-2">
              <span>🚨</span>
              Alertas de roteiros concluídos (resumo)
            </h3>
            <p className="mt-1 text-sm text-red-700">
              Lista de roteiros finalizados com lojas não concluídas e/ou lojas concluídas sem nenhuma máquina movimentada.
            </p>
            <div className="mt-3 space-y-3">
              {alertasRoteiro.map((item) => {
                const lojasNaoConcluidas = Array.isArray(item?.lojasNaoConcluidas)
                  ? item.lojasNaoConcluidas
                  : Array.isArray(item?.alertaFinalizacao?.lojasNaoConcluidas)
                    ? item.alertaFinalizacao.lojasNaoConcluidas
                    : [];
                const lojasConcluidasSemMovimentacao = Array.isArray(
                  item?.lojasConcluidasSemMovimentacao,
                )
                  ? item.lojasConcluidasSemMovimentacao
                  : Array.isArray(
                    item?.alertaFinalizacao?.lojasConcluidasSemMovimentacao,
                  )
                    ? item.alertaFinalizacao.lojasConcluidasSemMovimentacao
                    : [];
                const totalLojasConcluidasSemMovimentacao =
                  Number(item?.totalLojasConcluidasSemMovimentacao || 0) ||
                  lojasConcluidasSemMovimentacao.length;

                return (
                  <div key={item.roteiro.id} className="rounded border border-red-200 bg-white p-3">
                    <p className="font-semibold text-red-700">
                      Roteiro: {item.roteiro.zona} ({item.roteiro.data})
                    </p>
                    <p className="text-xs text-gray-600 mb-1">Responsável: {item.roteiro.funcionarioNome || "-"}</p>

                    {lojasNaoConcluidas.length > 0 && (
                      <>
                        <p className="mt-2 text-sm font-semibold text-red-700">
                          Lojas não concluídas ({lojasNaoConcluidas.length})
                        </p>
                        <ul className="mt-1 list-disc pl-5 text-sm text-gray-800 space-y-1">
                          {lojasNaoConcluidas.map((loja) => (
                            <li key={loja.id}>
                              <span className="font-semibold text-red-800">{loja.nome || "Loja sem nome"}</span>
                              {" - "}
                              <span className="text-gray-700">{formatarEnderecoAlerta(loja)}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {totalLojasConcluidasSemMovimentacao > 0 && (
                      <>
                        <p className="mt-3 text-sm font-semibold text-orange-700">
                          Lojas concluídas sem nenhuma máquina movimentada ({totalLojasConcluidasSemMovimentacao})
                        </p>
                        <ul className="mt-1 list-disc pl-5 text-sm text-gray-800 space-y-1">
                          {lojasConcluidasSemMovimentacao.length > 0 ? (
                            lojasConcluidasSemMovimentacao.map((loja) => (
                              <li key={loja.id}>
                                <span className="font-semibold text-orange-800">{loja.nome || "Loja sem nome"}</span>
                                {" - "}
                                <span className="text-gray-700">{formatarEnderecoAlerta(loja)}</span>
                              </li>
                            ))
                          ) : (
                            <li>Detalhes não informados pelo backend</li>
                          )}
                        </ul>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {mapaExpandido && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Localizacao ao vivo
                </h2>
                <p className="text-sm text-gray-600">
                  {mapaExpandido.roteiro?.zona || mapaExpandido.roteiro?.nome || "Roteiro"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMapaExpandido(null)}
                className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold"
              >
                Fechar
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <RoteiroMapaLocalizacao localizacao={mapaExpandido.localizacao} grande />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Adicionar Loja */}
      {showModalAdicionarLoja && roteiroSelecionadoParaAdicionar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header do Modal */}
            <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">
                    Adicionar Loja ao Roteiro
                  </h2>
                  <p className="text-blue-100 mt-1">
                    {roteiroSelecionadoParaAdicionar.zona}
                  </p>
                </div>
                <button
                  onClick={fecharModalAdicionarLoja}
                  className="text-white hover:text-gray-200 text-3xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Filtro de Busca */}
            <div className="p-4 border-b border-gray-200">
              <input
                type="text"
                placeholder="🔍 Buscar por nome, cidade, estado ou endereço..."
                value={filtroLoja}
                onChange={(e) => setFiltroLoja(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>

            {/* Lista de Lojas */}
            <div className="flex-1 overflow-y-auto p-4">
              {lojasFiltradas.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-4xl mb-2">🔍</div>
                  <p>Nenhuma loja encontrada</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {lojasFiltradas.map((loja) => {
                    const roteiroAtual = obterRoteiroAtualDaLoja(loja.id);
                    const jaEstaNesteRoteiro =
                      roteiroAtual?.id === roteiroSelecionadoParaAdicionar.id;

                    return (
                      <div
                        key={loja.id + '-' + (loja.nome || '')}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          jaEstaNesteRoteiro
                            ? "bg-gray-100 border-gray-300"
                            : roteiroAtual
                              ? "bg-yellow-50 border-yellow-300 hover:border-yellow-500"
                              : "bg-white border-gray-200 hover:border-blue-500 hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-900 mb-1">
                              {loja.nome}
                            </h3>
                            <p className="text-sm text-gray-600">
                              📍 {loja.endereco}
                            </p>
                            <p className="text-sm text-gray-600">
                              {loja.cidade} - {loja.estado}
                            </p>

                            {roteiroAtual && (
                              <div className="mt-2">
                                <Badge
                                  variant={
                                    jaEstaNesteRoteiro ? "default" : "warning"
                                  }
                                >
                                  {jaEstaNesteRoteiro
                                    ? "✓ Já está neste roteiro"
                                    : `No roteiro: ${roteiroAtual.zona}`}
                                </Badge>
                              </div>
                            )}

                            {!roteiroAtual && (
                              <div className="mt-2">
                                <Badge variant="info">📦 Disponível</Badge>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() =>
                              adicionarLojaSelecionadaAoRoteiro(
                                loja,
                                roteiroAtual,
                              )
                            }
                            disabled={jaEstaNesteRoteiro}
                            className={`ml-3 px-4 py-2 rounded-lg font-medium transition-colors ${
                              jaEstaNesteRoteiro
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : roteiroAtual
                                  ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                                  : "bg-blue-600 hover:bg-blue-700 text-white"
                            }`}
                          >
                            {jaEstaNesteRoteiro
                              ? "✓ Já está aqui"
                              : roteiroAtual
                                ? "Mover ↔️"
                                : "Adicionar ➕"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {lojasFiltradas.length}{" "}
                  {lojasFiltradas.length === 1
                    ? "loja encontrada"
                    : "lojas encontradas"}
                </p>
                <button
                  onClick={fecharModalAdicionarLoja}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
