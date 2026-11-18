import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

// Trazido da AgarraMais (bloco "Alertas de Movimentação" da página de Manutenção).
// Quando o funcionário marca na tela de Movimentações que NÃO vai registrar (ou há
// divergência na conferência da Machine Pay), fica um alerta aqui para o admin:
// "Lançar movimentação" abre a tela já preenchida; "Resolver" só fecha o alerta.

const CAMPOS = [
  ["quantidadeAtualMaquina", "Total antes"],
  ["quantidadeAdicionada", "Abastecido"],
  ["fichas", "Fichas"],
  ["contadorIn", "Contador IN"],
  ["contadorOut", "Contador OUT"],
  ["quantidade_notas_entrada", "Notas (R$)"],
  ["valor_entrada_maquininha_pix", "Cartão/PIX (R$)"],
];

const preenchido = (v) => v !== null && v !== undefined && v !== "";

function formatarDataHora(dataIso) {
  if (!dataIso) return "-";
  const data = new Date(dataIso);
  return Number.isNaN(data.getTime()) ? "-" : data.toLocaleString("pt-BR");
}

export function AlertasMovimentacaoPanel() {
  const navigate = useNavigate();
  const [alertas, setAlertas] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vivo = true;
    Promise.all([api.get("/alertas-movimentacao"), api.get("/produtos")])
      .then(([a, p]) => {
        if (!vivo) return;
        setAlertas(a.data || []);
        setProdutos(p.data || []);
      })
      .catch((err) => vivo && setErro(err.response?.data?.error || "Erro ao carregar alertas de movimentação"));
    return () => {
      vivo = false;
    };
  }, [recarga]);

  const nomeProduto = (produtoId) => {
    if (!produtoId) return null;
    const produto = produtos.find((p) => String(p.id) === String(produtoId));
    return produto ? `${produto.emoji || "🧸"} ${produto.nome}` : null;
  };

  const resolver = async (id) => {
    try {
      setErro("");
      await api.patch(`/alertas-movimentacao/${id}/resolver`);
      setRecarga((n) => n + 1);
    } catch (err) {
      setErro(err.response?.data?.error || "Erro ao resolver alerta de movimentação");
    }
  };

  const lancarMovimentacao = (alerta) => {
    const dados = alerta.dadosAbastecimento || {};
    navigate("/movimentacoes?abrirFormulario=true&modo=nova_movimentacao", {
      state: {
        abrirFormulario: true,
        modo: "nova_movimentacao",
        lojaId: alerta.loja?.id,
        maquinaId: alerta.maquina?.id,
        contadorIn: dados.contadorIn,
        contadorOut: dados.contadorOut,
        produtoId: dados.produtoId,
        quantidadeAtualMaquina: dados.quantidadeAtualMaquina,
        quantidadeAdicionada: dados.quantidadeAdicionada,
        fichas: dados.fichas,
        quantidade_notas_entrada: dados.quantidade_notas_entrada,
        valor_entrada_maquininha_pix: dados.valor_entrada_maquininha_pix,
        observacao: alerta.observacao,
        alertaId: alerta.id,
        origem: "AlertaMovimentacao",
      },
    });
  };

  if (alertas === null && !erro) return null;

  return (
    <div className="card mb-6 border-l-4 border-amber-500">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">⚠️ Alertas de Movimentação ({alertas?.length || 0})</h2>
      {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}

      {!alertas?.length ? (
        <p className="text-sm text-gray-600">Nenhum alerta pendente.</p>
      ) : (
        <div className="space-y-3">
          {alertas.map((alerta) => {
            const dados = alerta.dadosAbastecimento || null;
            const produto = dados ? nomeProduto(dados.produtoId) : null;
            return (
              <div key={alerta.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="space-y-1 text-sm text-gray-800">
                  <p>
                    <span className="font-semibold">Loja:</span> {alerta.loja?.nome || "-"}
                  </p>
                  <p>
                    <span className="font-semibold">Máquina:</span>{" "}
                    {alerta.maquina ? `${alerta.maquina.nome || ""} - ${alerta.maquina.codigo || ""}` : "-"}
                  </p>
                  <p>
                    <span className="font-semibold">Usuário:</span> {alerta.usuario?.nome || "-"}
                  </p>
                  <p>
                    <span className="font-semibold">Data/Hora:</span> {formatarDataHora(alerta.createdAt)}
                  </p>
                  <p>
                    <span className="font-semibold">Motivo:</span> {alerta.observacao}
                  </p>
                </div>

                {dados && (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-white/70 p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">Abastecimento informado</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 sm:grid-cols-3">
                      {produto && (
                        <p>
                          <span className="font-semibold">Produto:</span> {produto}
                        </p>
                      )}
                      {CAMPOS.filter(([k]) => preenchido(dados[k])).map(([k, label]) => (
                        <p key={k}>
                          <span className="font-semibold">{label}:</span> {dados[k]}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {dados && (
                    <button type="button" onClick={() => lancarMovimentacao(alerta)} className="btn-primary px-4 py-2 text-sm">
                      📦 Lançar movimentação
                    </button>
                  )}
                  <button type="button" onClick={() => resolver(alerta.id)} className="btn-secondary px-4 py-2 text-sm">
                    ✅ Resolver
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
