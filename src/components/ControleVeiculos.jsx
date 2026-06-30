import React, { useState, useContext, useEffect } from "react";
import Swal from "sweetalert2";
import { AuthContext } from "../contexts/AuthContext";

import api from "../services/api";
const emojiVeiculo = (tipo, emoji) => emoji || (tipo === "moto" ? "🏍️" : "🚗");
const getCombustivelLabel = (valor) => {
  switch (valor) {
    case "5":
      return "5 palzinhos";
    case "4":
      return "4 palzinhos";
    case "3":
      return "3 palzinhos";
    case "2":
      return "2 palzinhos";
    case "1":
      return "1 palzinho";
    case "0":
      return "Vazio";
    default:
      return valor;
  }
};

export default function ControleVeiculos({
  veiculos = [],
  onRefresh,
  loading,
}) {
  const getUsuarioIdDaMovimentacao = (mov) =>
    mov?.usuarioId ?? mov?.usuario?.id ?? mov?.usuario_id ?? null;

  const getBackendErrorMessage = (error, fallback) =>
    error.response?.data?.erro ||
    error.response?.data?.error ||
    error.response?.data?.message ||
    error.response?.data?.detalhes ||
    error.message ||
    fallback;

  const podeFinalizarVeiculo = (veiculo) => {
    if (!veiculo?.emUso || !usuario?.id) return false;

    const ultimaMov = ultimasMovs[veiculo.id];
    if (ultimaMov?.tipo !== "retirada") return false;
    if (isAdmin()) return true;

    return (
      String(getUsuarioIdDaMovimentacao(ultimaMov)) === String(usuario.id)
    );
  };

  const podeCorrigirStatusVeiculo = (veiculo) => {
    if (!isAdmin() || !veiculo?.emUso) return false;
    const ultimaMov = ultimasMovs[veiculo.id];
    return ultimaMov?.tipo === "devolucao";
  };

  // Estados para edição de nome/modelo (admin)
  const [editandoId, setEditandoId] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editModelo, setEditModelo] = useState("");
  // Estado para modal de abastecimento obrigatório ao finalizar
    // Estado para formulário de início de pilotagem
    const [form, setForm] = useState({
      estado: "Bom",
      obs: "",
      km: "",
      combustivel: "5",
      limpeza: "esta limpo",
      modo: "trabalho"
    });
  const [modalAbastecimento, setModalAbastecimento] = useState(false);
  const [abastecimento, setAbastecimento] = useState({ litros: '', posto: '' });
  const [erroAbastecimento, setErroAbastecimento] = useState('');
  const { usuario, isAdmin } = useContext(AuthContext);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalFinalizarAberto, setModalFinalizarAberto] = useState(false);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
  const [finalizando, setFinalizando] = useState(false);
  const [formFinalCompleto, setFormFinalCompleto] = useState({
    estado: "Bom",
    obs: "",
    km: "",
    combustivel: "5",
    limpeza: "esta limpo",
    litros: '',
    posto: ''
  });
  const [erroFinalCompleto, setErroFinalCompleto] = useState('');

  const abrirModal = (veiculo) => {
    setVeiculoSelecionado(veiculo);
    setForm({
      estado: veiculo.estado || "Bom",
      obs: "",
      km: "",
      combustivel: "5",
      limpeza: "esta limpo",
      modo: "trabalho"
    });
    setModalAberto(true);
  };

  const abrirModalFinalizar = (veiculo) => {
    if (!podeFinalizarVeiculo(veiculo)) {
      Swal.fire(
        "Em uso",
        "Somente quem iniciou a pilotagem pode finalizar este veículo.",
        "info"
      );
      return;
    }

    setVeiculoSelecionado(veiculo);
    setFormFinalCompleto({
      estado: veiculo.estado,
      obs: "",
      km: "",
      combustivel: "5",
      limpeza: "esta limpo",
      litros: '',
      posto: ''
    });
    setErroFinalCompleto('');
    setModalFinalizarAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setVeiculoSelecionado(null);
  };
  const fecharModalFinalizar = () => {
    setModalFinalizarAberto(false);
    setVeiculoSelecionado(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleFormFinalCompletoChange = (e) => {
    const { name, value } = e.target;
    setFormFinalCompleto((prev) => ({ ...prev, [name]: value }));
  };

  // Exemplo: para atualizar o status do veículo na API, use fetch/axios e depois onRefresh()
  const pilotarVeiculo = async () => {
    if (!veiculoSelecionado) return;
    const kmInformado = Number(form.km);
    const ultimaMov = ultimasMovs[veiculoSelecionado.id];
    // Usar km da última movimentação OU o km atual do veículo como referência
    const kmDaUltimaMov = ultimaMov ? Number(ultimaMov.km) : 0;
    const kmDoVeiculo = veiculoSelecionado.km ? Number(veiculoSelecionado.km) : 0;
    const kmRef = kmDaUltimaMov > 0 ? kmDaUltimaMov : kmDoVeiculo;

    if (!form.km || isNaN(kmInformado)) {
      Swal.fire("Campo obrigatório", "Informe o KM inicial para iniciar o veículo.", "warning");
      return;
    }

    // Bloquear se KM for diferente da referência, exceto para admin
    if (!isAdmin() && kmRef > 0 && kmInformado !== kmRef) {
      const diferenca = kmInformado - kmRef;
      const tipo = diferenca > 0 ? 'maior' : 'menor';

      Swal.fire({
        icon: "error",
        title: "KM inconsistente — retirada bloqueada",
        html: `<p><strong>KM informado:</strong> ${kmInformado}</p>
               <p><strong>KM registrado no veículo:</strong> ${kmRef}</p>
               <p><strong>Diferença:</strong> ${Math.abs(diferenca)} km ${tipo}</p>
               <p class="mt-2 text-red-600 font-semibold">${tipo === 'maior'
                 ? 'O veículo não pode ter sido usado sem registro.'
                 : 'O KM não pode ser menor que o registrado. Verifique o odômetro.'}</p>
               <p class="text-gray-500 text-sm mt-1">O KM deve ser exatamente <strong>${kmRef}</strong> para iniciar a retirada.</p>`,
        confirmButtonText: "Entendi"
      });
      return;
    }
    
    const payloadRetirada = {
      veiculoId: veiculoSelecionado.id,
      usuarioId: usuario?.id || undefined,
      tipo: "retirada",
      gasolina: form.combustivel
        ? getCombustivelLabel(form.combustivel)
        : undefined,
      nivel_limpeza: form.limpeza,
      estado: form.estado,
      modo: form.modo,
      obs: form.obs || undefined,
      dataMovimentacao: new Date().toISOString(),
      km: Number(form.km),
    };

    // Registrar movimentação de retirada antes de atualizar o status do veículo
    try {
      await api.post("/movimentacao-veiculos", payloadRetirada);
    } catch (movError) {
      const detalhes =
        movError?.response?.data?.erro ||
        movError?.response?.data?.message ||
        movError?.response?.data?.detalhes ||
        movError?.message ||
        "Erro desconhecido";

      console.error("Erro ao salvar retirada:", {
        payloadRetirada,
        status: movError?.response?.status,
        responseData: movError?.response?.data,
      });

      Swal.fire(
        "Erro ao salvar retirada",
        `A retirada não foi registrada no banco. Detalhes: ${detalhes}`,
        "error"
      );
      return;
    }

    try {
      await api.put(`/veiculos/${veiculoSelecionado.id}`, {
        ...veiculoSelecionado,
        emUso: true,
        km: kmInformado,
      });
    } catch (error) {
      console.error("Retirada salva, mas falhou atualizar veículo:", error);
      Swal.fire(
        "Atenção",
        "A retirada foi salva, mas não foi possível atualizar o status do veículo. Atualize a página.",
        "warning"
      );
      if (onRefresh) await onRefresh();
      fecharModal();
      return;
    }

    if (onRefresh) onRefresh();
    Swal.fire("Sucesso", "Retirada registrada com sucesso.", "success");
    fecharModal();
  };

  const finalizarVeiculo = async () => {
    setErroFinalCompleto("");
    if (!veiculoSelecionado || finalizando) return;
    if (!podeFinalizarVeiculo(veiculoSelecionado)) {
      Swal.fire(
        "Em uso",
        "Somente quem iniciou a pilotagem pode finalizar este veículo.",
        "info"
      );
      fecharModalFinalizar();
      return;
    }

    const kmInformado = Number(formFinalCompleto.km);
    const ultimaMov = ultimasMovs[veiculoSelecionado.id];
    const kmUltimaMov = ultimaMov ? Number(ultimaMov.km) : 0;
    const kmVeiculo = veiculoSelecionado.km ? Number(veiculoSelecionado.km) : 0;
    const kmBase = Math.max(kmUltimaMov, kmVeiculo);
    if (!formFinalCompleto.km || isNaN(kmInformado)) {
      setErroFinalCompleto("Informe o KM para finalizar o veículo.");
      return;
    }
    // Bloquear apenas para não-admin se KM for menor
    if (!isAdmin() && kmInformado < kmBase) {
      setErroFinalCompleto(`O KM de finalização não pode ser menor que o último KM registrado (${kmBase}).`);
      return;
    }
    if (!isAdmin()) {
      if (!formFinalCompleto.litros || isNaN(Number(formFinalCompleto.litros)) || Number(formFinalCompleto.litros) <= 0) {
        setErroFinalCompleto("Informe quantos litros foram abastecidos.");
        return;
      }
      if (!formFinalCompleto.posto || formFinalCompleto.posto.trim() === "") {
        setErroFinalCompleto("Informe o nome do posto de abastecimento.");
        return;
      }
    }
    setFinalizando(true);
    const usuarioIdDevolucao = getUsuarioIdDaMovimentacao(ultimaMov) || usuario?.id;
    try {
      await api.post("/movimentacao-veiculos", {
        veiculoId: veiculoSelecionado.id,
        usuarioId: usuarioIdDevolucao,
        tipo: "devolucao",
        gasolina: formFinalCompleto.combustivel ? getCombustivelLabel(formFinalCompleto.combustivel) : undefined,
        nivel_limpeza: formFinalCompleto.limpeza,
        estado: formFinalCompleto.estado,
        modo: veiculoSelecionado.modo,
        obs: formFinalCompleto.obs || undefined,
        dataMovimentacao: new Date().toISOString(),
        km: kmInformado,
        litrosAbastecidos: formFinalCompleto.litros ? Number(formFinalCompleto.litros) : null,
        postoAbastecimento: formFinalCompleto.posto?.trim() || null,
      });
      await api.put(`/veiculos/${veiculoSelecionado.id}`, {
        emUso: false,
        estado: formFinalCompleto.estado,
        obs: formFinalCompleto.obs,
        km: kmInformado,
        nivelCombustivel: getCombustivelLabel(formFinalCompleto.combustivel),
        nivelLimpeza: formFinalCompleto.limpeza,
      });
      if (onRefresh) await onRefresh();
      Swal.fire({
        icon: "success",
        title: `${usuario?.nome || "Funcionário"} guardou ${veiculoSelecionado?.nome}`,
        showConfirmButton: true,
        confirmButtonText: "OK",
      });
      setModalFinalizarAberto(false);
      setVeiculoSelecionado(null);
    } catch (error) {
      setErroFinalCompleto(getBackendErrorMessage(error, "Erro ao finalizar veículo."));
      console.error("Erro ao finalizar:", error);
    }
    setFinalizando(false);
  };

  // Confirmação do modal de abastecimento
  const corrigirStatusVeiculo = async (veiculo) => {
    const ultimaMov = ultimasMovs[veiculo.id];
    try {
      await api.put(`/veiculos/${veiculo.id}`, {
        emUso: false,
        estado: ultimaMov?.estado || veiculo.estado,
        obs: ultimaMov?.obs || veiculo.obs,
        km: ultimaMov?.km ?? veiculo.km,
        nivelCombustivel: ultimaMov?.gasolina || veiculo.nivelCombustivel,
        nivelLimpeza: ultimaMov?.nivel_limpeza || veiculo.nivelLimpeza,
      });
      if (onRefresh) await onRefresh();
      Swal.fire("Veículo liberado", "O cadastro foi atualizado como disponível.", "success");
    } catch (error) {
      Swal.fire(
        "Erro",
        getBackendErrorMessage(error, "Não foi possível liberar o veículo."),
        "error"
      );
    }
  };

  const confirmarAbastecimento = async () => {
    setErroAbastecimento("");
    if (!abastecimento.litros || isNaN(Number(abastecimento.litros)) || Number(abastecimento.litros) <= 0) {
      setErroAbastecimento("Informe quantos litros foram abastecidos.");
      return;
    }
    if (!abastecimento.posto || abastecimento.posto.trim() === "") {
      setErroAbastecimento("Informe o nome do posto de abastecimento.");
      return;
    }
    setFinalizando(true);
    const ultimaMov = ultimasMovs[veiculoSelecionado?.id];
    const usuarioIdDevolucao = getUsuarioIdDaMovimentacao(ultimaMov) || usuario?.id;
    try {
      await api.put(`/veiculos/${veiculoSelecionado.id}`, {
        litrosAbastecidos: Number(abastecimento.litros),
        postoAbastecimento: abastecimento.posto.trim(),
      });
      // Finalizar normalmente
      await api.post("/movimentacao-veiculos", {
        veiculoId: veiculoSelecionado.id,
        usuarioId: usuarioIdDevolucao,
        tipo: "devolucao",
        gasolina: formFinalCompleto.combustivel ? getCombustivelLabel(formFinalCompleto.combustivel) : undefined,
        nivel_limpeza: formFinalCompleto.limpeza,
        estado: formFinalCompleto.estado,
        modo: veiculoSelecionado.modo,
        obs: formFinalCompleto.obs || undefined,
        dataMovimentacao: new Date().toISOString(),
        km: Number(formFinalCompleto.km),
        litrosAbastecidos: Number(abastecimento.litros),
        postoAbastecimento: abastecimento.posto.trim(),
      });
      await api.put(`/veiculos/${veiculoSelecionado.id}`, {
        emUso: false,
        estado: formFinalCompleto.estado,
        obs: formFinalCompleto.obs,
        km: Number(formFinalCompleto.km),
        nivelCombustivel: getCombustivelLabel(formFinalCompleto.combustivel),
        nivelLimpeza: formFinalCompleto.limpeza,
      });
      if (onRefresh) await onRefresh();
      Swal.fire({
        icon: "success",
        title: `${usuario?.nome || "Funcionário"} guardou ${veiculoSelecionado?.nome}`,
        showConfirmButton: true,
        confirmButtonText: "OK",
      });
      setModalAbastecimento(false);
      setAbastecimento({ litros: '', posto: '' });
      setVeiculoSelecionado(null);
    } catch (error) {
      setErroAbastecimento("Erro ao salvar abastecimento/finalizar veículo.");
      console.error("Erro ao finalizar:", error);
    }
    setFinalizando(false);
  };
      {/* Modal obrigatório de abastecimento ao finalizar */}
      {modalAbastecimento && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4">Informar Abastecimento</h2>
            <form onSubmit={e => { e.preventDefault(); confirmarAbastecimento(); }} autoComplete="off">
              <div className="mb-3">
                <label className="block text-sm font-medium">Quantos litros foram abastecidos?</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="w-full border rounded p-1"
                  value={abastecimento.litros}
                  onChange={e => setAbastecimento(a => ({ ...a, litros: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Nome do posto de abastecimento</label>
                <input
                  type="text"
                  className="w-full border rounded p-1"
                  value={abastecimento.posto}
                  onChange={e => setAbastecimento(a => ({ ...a, posto: e.target.value }))}
                  required
                />
              </div>
              {erroAbastecimento && <div className="text-red-600 text-sm mb-2">{erroAbastecimento}</div>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-1 bg-gray-300 rounded hover:bg-gray-400"
                  onClick={() => { setModalAbastecimento(false); setAbastecimento({ litros: '', posto: '' }); setVeiculoSelecionado(null); }}
                  disabled={finalizando}
                >Cancelar</button>
                <button
                  type="submit"
                  className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  disabled={finalizando}
                >Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

  const [ultimasMovs, setUltimasMovs] = useState({});

  useEffect(() => {
    // Busca a última movimentação de cada veículo
    async function fetchUltimasMovs() {
      try {
        const { data } = await api.get("/movimentacao-veiculos/ultimas");
        // Espera que a API retorne um objeto { [veiculoId]: movimentacao }
        setUltimasMovs(data || {});
      } catch (error) {
        setUltimasMovs({});
        console.error("Erro ao buscar últimas movimentações:", error);
      }
    }
    fetchUltimasMovs();
  }, [veiculos]);

  if (loading) return <div className="p-6">Carregando veículos...</div>;

  return (
    <div className="flex flex-wrap gap-6 p-6">
      {veiculos.map((veiculo) => {
        const mov = ultimasMovs[veiculo.id];
        const isRuim = mov?.estado?.toLowerCase() === "ruim";
        const precisaLimpar = mov?.nivel_limpeza?.toLowerCase().includes("precisa");
        let cardClass = veiculo.emUso ? "filter grayscale opacity-70" : "bg-white";
        if (isRuim && precisaLimpar) {
          cardClass += " bg-red-100 border-2 border-red-400";
        } else if (isRuim) {
          cardClass += " bg-red-100 border-2 border-red-400";
        } else if (precisaLimpar) {
          cardClass += " bg-yellow-100 border-2 border-yellow-400";
        }
        const isEditing = editandoId === veiculo.id;
        return (
          <div
            key={veiculo.id}
            className={`rounded-lg shadow-md p-4 w-64 transition-all relative ${cardClass}`}
          >
            <div className="flex items-center gap-2 text-2xl mb-2">
              <span>{emojiVeiculo(veiculo.tipo, veiculo.emoji)}</span>
              {isEditing ? (
                <input
                  className="font-bold text-lg border rounded px-1 w-24"
                  value={editNome}
                  onChange={e => setEditNome(e.target.value)}
                  autoFocus
                />
              ) : (
                <span className="font-bold text-lg">{veiculo.nome}</span>
              )}
            </div>
            <div className="text-gray-600 text-sm mb-2">
              Modelo: {isEditing ? (
                <input
                  className="border rounded px-1 w-24"
                  value={editModelo}
                  onChange={e => setEditModelo(e.target.value)}
                />
              ) : (
                veiculo.modelo
              )}
            </div>
            <div className="flex gap-4 mb-2">
              <div>
                <div className="text-xs text-gray-500">Estado</div>
                <div>{veiculo.estado}</div>
              </div>
              {isAdmin() && (
                <div>
                  <div className="text-xs text-gray-500">Km</div>
                  <div>{veiculo.km}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500">Gasolina</div>
                <div>{veiculo.nivelCombustivel || veiculo.combustivel || "-"}</div>
              </div>
            </div>
            {!veiculo.emUso ? (
              <div className="flex flex-col gap-2 mt-2">
                {isEditing ? (
                  <div className="flex gap-2">
                    <button
                      className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      onClick={async () => {
                        try {
                          await api.put(`/veiculos/${veiculo.id}`, { nome: editNome, modelo: editModelo });
                          setEditandoId(null);
                          onRefresh && onRefresh();
                        } catch {
                          Swal.fire("Erro", "Não foi possível salvar.", "error");
                        }
                      }}
                    >Salvar</button>
                    <button
                      className="px-2 py-1 bg-gray-300 rounded hover:bg-gray-400"
                      onClick={() => setEditandoId(null)}
                    >Cancelar</button>
                  </div>
                ) : (
                  <>
                    <button
                      className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      onClick={() => abrirModal(veiculo)}
                      disabled={veiculo.emUso}
                    >Pilotar</button>
                    {isAdmin() && (
                      <>
                        <button
                          className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                          onClick={() => {
                            setEditandoId(veiculo.id);
                            setEditNome(veiculo.nome);
                            setEditModelo(veiculo.modelo);
                          }}
                        >Editar</button>
                        <button
                          className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                          onClick={async () => {
                            if (window.confirm("Tem certeza que deseja excluir este veículo?")) {
                              try {
                                await api.delete(`/veiculos/${veiculo.id}`);
                                onRefresh && onRefresh();
                              } catch {
                                Swal.fire("Erro", "Não foi possível excluir.", "error");
                              }
                            }
                          }}
                        >Excluir</button>
                      </>
                    )}
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 rounded">Em uso</div>
                {podeFinalizarVeiculo(veiculo) && (
                  <button
                    className="mt-2 px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    onClick={() => {
                      setModalFinalizarAberto(false); // Garante que o modal de finalizar não fique aberto
                      abrirModalFinalizar(veiculo);
                    }}
                  >Finalizar</button>
                )}
                {podeCorrigirStatusVeiculo(veiculo) && (
                  <button
                    className="mt-2 px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                    onClick={() => corrigirStatusVeiculo(veiculo)}
                  >Liberar veículo</button>
                )}
              </>
            )}
          </div>
        );
      })}
      {/* Modal Finalizar */}
      {modalFinalizarAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4">
              Finalizar uso de {veiculoSelecionado?.nome}
            </h2>
            <form
              onSubmit={e => { e.preventDefault(); finalizarVeiculo(); }}
              autoComplete="off"
            >
              <div className="mb-3">
                <label className="block text-sm font-medium">Estado da moto</label>
                <select
                  name="estado"
                  value={formFinalCompleto.estado}
                  onChange={handleFormFinalCompletoChange}
                  className="w-full border rounded p-1"
                >
                  <option value="Bom">Sem avaria</option>
                  <option value="Ruim">Com avaria</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Obs:</label>
                <input
                  name="obs"
                  value={formFinalCompleto.obs}
                  onChange={handleFormFinalCompletoChange}
                  className="w-full border rounded p-1"
                  placeholder="Descreva o problema (opcional)"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Km final</label>
                <input
                  name="km"
                  type="number"
                  value={formFinalCompleto.km}
                  onChange={handleFormFinalCompletoChange}
                  className="w-full border rounded p-1"
                  min="0"
                  onWheel={(e) => e.target.blur()}
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Nível de combustível</label>
                <select
                  name="combustivel"
                  value={formFinalCompleto.combustivel}
                  onChange={handleFormFinalCompletoChange}
                  className="w-full border rounded p-1"
                >
                  <option value="5">5 palzinhos</option>
                  <option value="4">4 palzinhos</option>
                  <option value="3">3 palzinhos</option>
                  <option value="2">2 palzinhos</option>
                  <option value="1">1 palzinho</option>
                  <option value="0">Vazio</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Nível de limpeza</label>
                <select
                  name="limpeza"
                  value={formFinalCompleto.limpeza}
                  onChange={handleFormFinalCompletoChange}
                  className="w-full border rounded p-1"
                >
                  <option value="esta limpo">Está limpo</option>
                  <option value="precisa limpar">Precisa limpar</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Quantos litros foram abastecidos?</label>
                <input
                  name="litros"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="w-full border rounded p-1"
                  value={formFinalCompleto.litros}
                  onChange={handleFormFinalCompletoChange}
                  required={!isAdmin()}
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Nome do posto de abastecimento</label>
                <input
                  name="posto"
                  type="text"
                  className="w-full border rounded p-1"
                  value={formFinalCompleto.posto}
                  onChange={handleFormFinalCompletoChange}
                  required={!isAdmin()}
                />
              </div>
              {erroFinalCompleto && <div className="text-red-600 text-sm mb-2">{erroFinalCompleto}</div>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-1 bg-gray-300 rounded hover:bg-gray-400"
                  onClick={() => { setModalFinalizarAberto(false); setVeiculoSelecionado(null); }}
                  disabled={finalizando}
                >Cancelar</button>
                <button
                  type="submit"
                  className={`px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700${finalizando ? ' opacity-50 cursor-not-allowed' : ''}`}
                  disabled={finalizando}
                >{finalizando ? 'Finalizando...' : 'Finalizar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4">
              Pilotar {veiculoSelecionado?.nome}
            </h2>
            <form
              onSubmit={e => { e.preventDefault(); pilotarVeiculo(); }}
              autoComplete="off"
            >
              <div className="mb-3">
                <label className="block text-sm font-medium">
                  Estado da moto
                </label>
                <select
                  name="estado"
                  value={form.estado}
                  onChange={handleFormChange}
                  className="w-full border rounded p-1"
                  required
                >
                  <option value="Bom">Sem avaria</option>
                  <option value="Ruim">Com avaria</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Obs:</label>
                <input
                  name="obs"
                  value={form.obs}
                  onChange={handleFormChange}
                  className="w-full border rounded p-1"
                  placeholder="Descreva o problema (opcional)"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Km inicial</label>
                {(() => {
                  const ultimaMov = ultimasMovs[veiculoSelecionado?.id];
                  const kmDaUltimaMov = ultimaMov ? Number(ultimaMov.km) : 0;
                  const kmDoVeiculo = veiculoSelecionado?.km ? Number(veiculoSelecionado.km) : 0;
                  const kmRef = kmDaUltimaMov > 0 ? kmDaUltimaMov : kmDoVeiculo;
                  return kmRef > 0 && !isAdmin() ? (
                    <p className="text-xs text-blue-700 mb-1">⚠️ O KM deve ser exatamente <strong>{kmRef}</strong></p>
                  ) : null;
                })()}
                <input
                  name="km"
                  type="number"
                  value={form.km}
                  onChange={handleFormChange}
                  className="w-full border rounded p-1"
                  min="0"
                  required
                  onWheel={(e) => e.target.blur()}
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Modo</label>
                <select
                  name="modo"
                  value={form.modo}
                  onChange={handleFormChange}
                  className="w-full border rounded p-1"
                  required
                >
                  <option value="trabalho">Trabalho</option>
                  <option value="emprestado">Emprestado</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">
                  Nível de combustível
                </label>
                <select
                  name="combustivel"
                  value={form.combustivel}
                  onChange={handleFormChange}
                  className="w-full border rounded p-1"
                  required
                >
                  <option value="5">5 palzinhos</option>
                  <option value="4">4 palzinhos</option>
                  <option value="3">3 palzinhos</option>
                  <option value="2">2 palzinhos</option>
                  <option value="1">1 palzinho</option>
                  <option value="0">Vazio</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium">
                  Nível de limpeza
                </label>
                <select
                  name="limpeza"
                  value={form.limpeza}
                  onChange={handleFormChange}
                  className="w-full border rounded p-1"
                  required
                >
                  <option value="esta limpo">Está limpo</option>
                  <option value="precisa limpar">Precisa limpar</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-1 bg-gray-300 rounded hover:bg-gray-400"
                  onClick={fecharModal}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Pilotar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
