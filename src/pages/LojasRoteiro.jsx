import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox, Badge } from "../components/UIComponents";
import { PageLoader, EmptyState } from "../components/Loading";

export function LojasRoteiro() {
  // Estado para roteiros pendentes do dia
  const [roteirosPendentesDia, setRoteirosPendentesDia] = useState([]);
  const [showAlertaPendentes, setShowAlertaPendentes] = useState(true);
  const { roteiroId } = useParams();
  const navigate = useNavigate();
  const [roteiro, setRoteiro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    carregarRoteiro();
    buscarRoteirosPendentesDia();
  }, [roteiroId]);

  // Buscar roteiros pendentes do dia da semana atual
  const buscarRoteirosPendentesDia = async () => {
    try {
      const resp = await api.get("/roteiros/pendentes-dia");
      setRoteirosPendentesDia(resp.data || []);
    } catch (e) {
      // Não exibe erro para usuário
    }
  };

  // Função para carregar os dados do roteiro
  const carregarRoteiro = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await api.get(`/roteiros/${roteiroId}`);
      setRoteiro(resp.data);
    } catch (e) {
      setError("Erro ao carregar roteiro.");
      setRoteiro(null);
    } finally {
      setLoading(false);
    }
  };

  // Alerta visual para roteiros pendentes do dia da semana atual
  const alertaPendentesDia =
    roteirosPendentesDia.length > 0 && showAlertaPendentes ? (
      <div style={{ position: "fixed", left: 20, bottom: 30, zIndex: 50, maxWidth: 350 }}>
        <AlertBox
          type="warning"
          title="Roteiros pendentes do dia"
          message={
            <div>
              Existem <b>{roteirosPendentesDia.length}</b> roteiro(s) pendente(s) para hoje.<br />
              <ul className="list-disc ml-5 mt-2">
                {roteirosPendentesDia.map((r) => (
                  <li key={r.id}>
                    <b>{r.zona}</b> ({r.cidade || ""})
                  </li>
                ))}
              </ul>
            </div>
          }
          onClose={() => setShowAlertaPendentes(false)}
        />
      </div>
    ) : null;

  // Renderização principal: alerta sempre visível, conteúdo condicional
  if (loading) {
    return (
      <>
        {alertaPendentesDia}
        <PageLoader />
      </>
    );
  }

  if (!roteiro) {
    return (
      <>
        {alertaPendentesDia}
        <div className="min-h-screen bg-background-light">
          <Navbar />
          <div className="max-w-7xl mx-auto px-4 py-8">
            <AlertBox type="error" message={error || "Roteiro não encontrado."} />
          </div>
          <Footer />
        </div>
      </>
    );
  }

  // Lógica para lojasConcluidas, lojasPendentes, totalLojas, acessarLoja
  const lojasConcluidas = roteiro.lojas.filter((loja) => loja.status === "concluida");
  const lojasPendentes = roteiro.lojas.filter((loja) => loja.status !== "concluida");
  const totalLojas = roteiro.lojas.length;

  const acessarLoja = (lojaId) => {
    navigate(`/movimentacoes/roteiro/${roteiroId}/loja/${lojaId}`);
  };

  return (
    <>
      {alertaPendentesDia}
      <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Lojas Concluídas - aparecem primeiro */}
          {lojasConcluidas.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-green-700 mb-4 flex items-center gap-2">
                <span className="text-3xl">✅</span>
                Lojas Concluídas ({lojasConcluidas.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lojasConcluidas.map((loja) => (
                  <div
                    key={loja.id}
                    className="card-gradient bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-500 shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-green-700">
                        {loja.nome}
                      </h3>
                      <Badge variant="success">✅ Concluída</Badge>
                    </div>

                    <div className="space-y-2 text-sm text-gray-700">
                      {loja.endereco && (
                        <p className="flex items-center gap-2">
                          <span className="text-lg">📍</span>
                          <span>{loja.endereco}</span>
                        </p>
                      )}
                      {loja.cidade && (
                        <p className="flex items-center gap-2">
                          <span className="text-lg">🏙️</span>
                          <span>{loja.cidade} - {loja.estado}</span>
                        </p>
                      )}
                      <p className="flex items-center gap-2">
                        <span className="text-lg">🎰</span>
                        <span>{loja.maquinas?.length || 0} máquinas processadas</span>
                      </p>
                    </div>

                    <div className="mt-4 p-3 bg-green-200 border-l-4 border-green-600 rounded">
                      <p className="text-sm font-semibold text-green-800 text-center">
                        🎉 Todas as movimentações finalizadas!
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lojas Pendentes */}
          {lojasPendentes.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-yellow-700 mb-4 flex items-center gap-2">
                <span className="text-3xl">⏳</span>
                Lojas Pendentes ({lojasPendentes.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lojasPendentes.map((loja) => (
                  <div
                    key={loja.id}
                    className="card-gradient hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105 border-2 border-yellow-400"
                    onClick={() => acessarLoja(loja.id)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-primary">
                        {loja.nome}
                      </h3>
                      <Badge variant="warning">⏳ Pendente</Badge>
                    </div>

                    <div className="space-y-2 text-gray-700">
                      <div className="flex items-center">
                        <span className="text-xl mr-2">📍</span>
                        <span className="text-sm">
                          {loja.endereco || 'N/A'}
                        </span>
                      </div>
                      
                      <div className="flex items-center">
                        <span className="text-xl mr-2">🏙️</span>
                        <span className="text-sm">
                          {loja.cidade || 'N/A'} - {loja.estado || 'N/A'}
                        </span>
                      </div>
                      
                      {loja.zona && (
                        <div className="flex items-center">
                          <span className="text-xl mr-2">🗺️</span>
                          <span className="text-sm font-semibold">
                            Zona {loja.zona}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center">
                        <span className="text-xl mr-2">🎰</span>
                        <span className="text-sm">
                          {loja.maquinas?.length || 0} máquinas
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 text-center">
                      <button className="btn-primary w-full">
                        Fazer Movimentações
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalLojas === 0 && (
            <div className="card-gradient">
              <EmptyState
                icon="🏪"
                title="Nenhuma loja neste roteiro"
                message="Este roteiro não possui lojas cadastradas."
              />
            </div>
          )}
        </div>

        <Footer />
      </div>
    </>
  );
}
