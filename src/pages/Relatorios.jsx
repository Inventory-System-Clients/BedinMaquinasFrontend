import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";

export function Relatorios() {
  const { usuario, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [roteiros, setRoteiros] = useState([]);
  const [roteiroSelecionado, setRoteiroSelecionado] = useState("");
  const [lojas, setLojas] = useState([]);
  const [lojasSelecionadas, setLojasSelecionadas] = useState([]);
  const [buscaLoja, setBuscaLoja] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingRoteiros, setLoadingRoteiros] = useState(true);
  const [loadingLojas, setLoadingLojas] = useState(true);
  const [loadingPdfPlanilha, setLoadingPdfPlanilha] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [error, setError] = useState("");
  const [gastosLoja, setGastosLoja] = useState([]);

  const toNumber = (value) => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === "string") {
      let normalized = value.trim();
      if (!normalized) return 0;

      normalized = normalized.replace(/\s+/g, "").replace(/R\$/gi, "");
      normalized = normalized.replace(/[^\d,.-]/g, "");

      if (normalized.includes(",") && normalized.includes(".")) {
        normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
      } else if (normalized.includes(",")) {
        normalized = normalized.replace(/,/g, ".");
      }

      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const obterDataMovimentacao = (movimentacao) => {
    return new Date(
      movimentacao?.dataColeta ||
        movimentacao?.dataMovimentacao ||
        movimentacao?.createdAt ||
        movimentacao?.data ||
        0,
    );
  };

  const obterTotalFinanceiroMovimentacao = (movimentacao) => {
    const notas = toNumber(
      movimentacao?.valorEntradaNotas ?? movimentacao?.valor_entrada_notas,
    );
    const cartao = toNumber(
      movimentacao?.valorEntradaCartao ?? movimentacao?.valor_entrada_cartao,
    );
    const fichas = toNumber(
      movimentacao?.valorEntradaFichas ?? movimentacao?.valor_entrada_fichas,
    );
    const valorFaturado = toNumber(
      movimentacao?.valorFaturado ?? movimentacao?.valor_faturado,
    );

    return valorFaturado > 0 ? valorFaturado : notas + cartao + fichas;
  };

  const formatarMoedaBRL = (valor) =>
    toNumber(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const agregarProdutos = (produtos = []) => {
    const mapa = new Map();

    produtos.forEach((produto) => {
      const chave = `${produto?.id ?? "sem-id"}-${produto?.codigo ?? "sem-codigo"}`;
      const atual = mapa.get(chave) || {
        ...produto,
        quantidade: 0,
      };

      atual.quantidade += toNumber(produto?.quantidade);

      if (toNumber(atual?.preco) <= 0 && toNumber(produto?.preco) > 0) {
        atual.preco = produto.preco;
      }

      mapa.set(chave, atual);
    });

    return Array.from(mapa.values());
  };

  const combinarRelatoriosPorLojas = (relatorios, idsLojas = []) => {
    if (!Array.isArray(relatorios) || relatorios.length === 0) {
      return null;
    }

    const totaisCombinados = {
      produtosSairam: 0,
      produtosEntraram: 0,
      movimentacoes: 0,
      valoresEntrada: {
        notas: 0,
        cartao: 0,
        total: 0,
      },
      comissao: 0,
      lucroComDescontoComissao: 0,
    };

    const produtosSairamTodos = [];
    const produtosEntraramTodos = [];
    const mapaMaquinas = new Map();

    relatorios.forEach((relatorioAtual) => {
      const totais = relatorioAtual?.totais || {};

      totaisCombinados.produtosSairam += toNumber(totais.produtosSairam);
      totaisCombinados.produtosEntraram += toNumber(totais.produtosEntraram);
      totaisCombinados.movimentacoes += toNumber(totais.movimentacoes);
      totaisCombinados.valoresEntrada.notas += toNumber(
        totais.valoresEntrada?.notas,
      );
      totaisCombinados.valoresEntrada.cartao += toNumber(
        totais.valoresEntrada?.cartao,
      );
      totaisCombinados.valoresEntrada.total += toNumber(
        totais.valoresEntrada?.total,
      );

      if (Array.isArray(relatorioAtual?.produtosSairam)) {
        produtosSairamTodos.push(...relatorioAtual.produtosSairam);
      }

      if (Array.isArray(relatorioAtual?.produtosEntraram)) {
        produtosEntraramTodos.push(...relatorioAtual.produtosEntraram);
      }

      (relatorioAtual?.maquinas || []).forEach((maquinaAtual) => {
        const maquinaId = String(maquinaAtual?.maquina?.id ?? "");
        if (!maquinaId) return;

        if (!mapaMaquinas.has(maquinaId)) {
          mapaMaquinas.set(maquinaId, {
            ...maquinaAtual,
            maquina: {
              ...(maquinaAtual?.maquina || {}),
              lojaId: maquinaAtual?.maquina?.lojaId ?? relatorioAtual?.loja?.id,
            },
            totais: {
              produtosSairam: toNumber(maquinaAtual?.totais?.produtosSairam),
              produtosEntraram: toNumber(
                maquinaAtual?.totais?.produtosEntraram,
              ),
              movimentacoes: toNumber(maquinaAtual?.totais?.movimentacoes),
            },
            valoresEntrada: {
              notas: toNumber(maquinaAtual?.valoresEntrada?.notas),
              cartao: toNumber(maquinaAtual?.valoresEntrada?.cartao),
            },
            produtosSairam: Array.isArray(maquinaAtual?.produtosSairam)
              ? [...maquinaAtual.produtosSairam]
              : [],
            produtosEntraram: Array.isArray(maquinaAtual?.produtosEntraram)
              ? [...maquinaAtual.produtosEntraram]
              : [],
          });
          return;
        }

        const acumulada = mapaMaquinas.get(maquinaId);
        acumulada.totais.produtosSairam += toNumber(
          maquinaAtual?.totais?.produtosSairam,
        );
        acumulada.totais.produtosEntraram += toNumber(
          maquinaAtual?.totais?.produtosEntraram,
        );
        acumulada.totais.movimentacoes += toNumber(
          maquinaAtual?.totais?.movimentacoes,
        );
        acumulada.valoresEntrada.notas += toNumber(
          maquinaAtual?.valoresEntrada?.notas,
        );
        acumulada.valoresEntrada.cartao += toNumber(
          maquinaAtual?.valoresEntrada?.cartao,
        );
        acumulada.produtosSairam.push(
          ...(Array.isArray(maquinaAtual?.produtosSairam)
            ? maquinaAtual.produtosSairam
            : []),
        );
        acumulada.produtosEntraram.push(
          ...(Array.isArray(maquinaAtual?.produtosEntraram)
            ? maquinaAtual.produtosEntraram
            : []),
        );
      });
    });

    const lojasResumo = idsLojas.map((id) => {
      const loja = lojas.find((l) => String(l.id) === String(id));
      return {
        loja: {
          id,
          nome: loja?.nome || `Loja ${id}`,
        },
        totais: {
          movimentacoes: 0,
        },
      };
    });

    const maquinasCombinadas = Array.from(mapaMaquinas.values()).map(
      (maquina) => ({
        ...maquina,
        produtosSairam: agregarProdutos(maquina.produtosSairam),
        produtosEntraram: agregarProdutos(maquina.produtosEntraram),
      }),
    );

    return {
      totais: totaisCombinados,
      maquinas: maquinasCombinadas,
      produtosSairam: agregarProdutos(produtosSairamTodos),
      produtosEntraram: agregarProdutos(produtosEntraramTodos),
      lojas: lojasResumo,
    };
  };

  const toggleLojaSelecionada = (lojaId) => {
    setRoteiroSelecionado("");
    setLojasSelecionadas((prev) => {
      const chave = String(lojaId);
      if (prev.some((id) => String(id) === chave)) {
        return prev.filter((id) => String(id) !== chave);
      }
      return [...prev, lojaId];
    });
  };

  const selecionarTodasAsLojas = () => {
    setRoteiroSelecionado("");
    setLojasSelecionadas(lojas.map((loja) => loja.id));
  };

  const limparSelecaoLojas = () => {
    setLojasSelecionadas([]);
  };

  const lojasFiltradas = lojas.filter((loja) => {
    const termo = buscaLoja.trim().toLowerCase();
    if (!termo) return true;
    return (loja?.nome || "").toLowerCase().includes(termo);
  });

  useEffect(() => {
    carregarRoteiros();
    carregarLojas();
    definirDatasDefault();
  }, []);

  const carregarLojas = async () => {
    try {
      setLoadingLojas(true);
      const response = await api.get("/lojas");
      setLojas(response.data || []);
    } catch (error) {
      setError("Erro ao carregar lojas");
    } finally {
      setLoadingLojas(false);
    }
  };

  const definirDatasDefault = () => {
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 7);

    setDataFim(hoje.toISOString().split("T")[0]);
    setDataInicio(seteDiasAtras.toISOString().split("T")[0]);
  };

  const carregarRoteiros = async () => {
    try {
      setLoadingRoteiros(true);
      // Buscar roteiros do dia 24/02/2026
      const responseFixo = await api.get("/roteiros", {
        params: { data: "2026-02-24" },
      });
      // Buscar roteiros bolinha do dia atual
      const hoje = new Date().toISOString().split("T")[0];
      const responseBolinha = await api.get("/roteiros", {
        params: { data: hoje },
      });
      // Filtrar apenas os de bolinha e o Roteiro Coringa do dia atual
      const bolinhasHoje = (responseBolinha.data || []).filter(
        (r) =>
          (r.zona || "").toLowerCase().startsWith("bolinha") ||
          r.zona === "Roteiro Coringa",
      );
      // Priorizar roteiros do dia 24: se houver bolinha com mesmo nome/zona, não adicionar do dia atual
      const zonasFixo = new Set(
        (responseFixo.data || []).map((r) =>
          (r.zona || "").toLowerCase().trim(),
        ),
      );
      const bolinhasHojeNaoDuplicadas = bolinhasHoje.filter(
        (r) => !zonasFixo.has((r.zona || "").toLowerCase().trim()),
      );
      const roteirosCombinados = [
        ...(responseFixo.data || []),
        ...bolinhasHojeNaoDuplicadas,
      ];
      setRoteiros(roteirosCombinados);
    } catch (error) {
      console.error("Erro ao carregar roteiros:", error);
      setError("Erro ao carregar roteiros");
    } finally {
      setLoadingRoteiros(false);
    }
  };

  const gerarRelatorio = async () => {
    if (
      (!roteiroSelecionado && lojasSelecionadas.length === 0) ||
      !dataInicio ||
      !dataFim
    ) {
      setError(
        "Por favor, selecione um roteiro ou pelo menos uma loja e preencha as datas.",
      );
      return;
    }

    // Validar datas
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    if (fim < inicio) {
      setError("A data final não pode ser anterior à data inicial");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setRelatorio(null);
      setGastosLoja([]);

      let roteiroId = roteiroSelecionado;
      let relatorioData = null;
      let lojasParaProcessar = [...lojasSelecionadas];

      // Buscar relatório base
      if (roteiroId) {
        relatorioData = (
          await api.get("/relatorios/roteiro", {
            params: { roteiroId, dataInicio, dataFim },
          })
        ).data;

        lojasParaProcessar = (relatorioData?.lojas || [])
          .map((item) => item?.loja?.id)
          .filter((id) => id !== undefined && id !== null);
      } else if (lojasSelecionadas.length === 1) {
        const lojaIdUnica = lojasSelecionadas[0];
        relatorioData = (
          await api.get("/relatorios/impressao", {
            params: { lojaId: lojaIdUnica, dataInicio, dataFim },
          })
        ).data;
      } else {
        const respostasRelatorios = await Promise.all(
          lojasSelecionadas.map((lojaId) =>
            api
              .get("/relatorios/impressao", {
                params: { lojaId, dataInicio, dataFim },
              })
              .then((res) => ({ lojaId, data: res.data }))
              .catch(() => ({ lojaId, data: null })),
          ),
        );

        const relatoriosValidos = respostasRelatorios
          .filter((item) => item.data)
          .map((item) => item.data);

        if (relatoriosValidos.length === 0) {
          throw new Error(
            "Nenhum dado encontrado para as lojas selecionadas no período.",
          );
        }

        relatorioData = combinarRelatoriosPorLojas(
          relatoriosValidos,
          lojasSelecionadas,
        );

        relatorioData.lojas = respostasRelatorios
          .filter((item) => item.data)
          .map((item) => {
            const loja = lojas.find(
              (l) => String(l.id) === String(item.lojaId),
            );
            return {
              loja: {
                id: item.lojaId,
                nome: loja?.nome || `Loja ${item.lojaId}`,
              },
              totais: {
                movimentacoes: toNumber(item.data?.totais?.movimentacoes),
              },
            };
          });
      }

      // Buscar e calcular comissão igual ao dashboard
      let comissoes = [];
      let totalComissao = 0;
      let totalLucro = 0;
      let maquinasDaLoja = [];
      const idsLojasUnicos = Array.from(
        new Set(lojasParaProcessar.map((id) => String(id))),
      );

      if (idsLojasUnicos.length > 0) {
        try {
          const maquinasRes = await api.get(`/maquinas`);
          maquinasDaLoja = (maquinasRes.data || []).filter((maq) =>
            idsLojasUnicos.includes(String(maq.lojaId ?? maq.loja_id ?? "")),
          );
        } catch {
          maquinasDaLoja = [];
        }

        // Buscar roteiros do período para garantir cálculo
        const roteirosRes = await api.get(`/roteiros?data=${dataFim}`);
        const roteiros = roteirosRes.data || [];

        for (const lojaId of idsLojasUnicos) {
          let roteiroIdParaComissao = roteiroId;

          if (!roteiroIdParaComissao && roteiros.length > 0) {
            for (const roteiro of roteiros) {
              if (
                (roteiro.lojas || []).some(
                  (l) => String(l.id) === String(lojaId),
                )
              ) {
                roteiroIdParaComissao = roteiro.id;
                break;
              }
            }
          }

          if (roteiroIdParaComissao) {
            try {
              await api.post(`/roteiros/lojas/${lojaId}/calcular-comissao`, {
                roteiroId: roteiroIdParaComissao,
              });
            } catch (e) {
              // Pode já estar calculada
            }
          }
        }

        // Buscar comissões do período
        const comissoesPorLoja = await Promise.all(
          idsLojasUnicos.map((lojaId) =>
            api
              .get(`/relatorios/comissoes`, {
                params: { lojaId, dataInicio, dataFim },
              })
              .then((res) => res.data?.comissoes || [])
              .catch(() => []),
          ),
        );

        comissoes = comissoesPorLoja.flat();
        totalComissao = comissoes.reduce(
          (acc, c) => acc + toNumber(c.totalComissao),
          0,
        );
        totalLucro = comissoes.reduce(
          (acc, c) => acc + toNumber(c.totalLucro),
          0,
        );

        // Buscar gastos por loja
        const gastosPorLoja = await Promise.all(
          idsLojasUnicos.map((lojaId) =>
            api
              .get(`/gastos`, {
                params: { lojaId },
              })
              .then((res) => res.data || [])
              .catch(() => []),
          ),
        );

        setGastosLoja(
          gastosPorLoja
            .flat()
            .sort((a, b) => new Date(b?.data || 0) - new Date(a?.data || 0)),
        );
      }

      // Atualizar totais gerais
      if (!relatorioData.totais) relatorioData.totais = {};
      relatorioData.totais.comissao = totalComissao;
      relatorioData.totais.lucroComDescontoComissao =
        totalLucro - totalComissao;

      // Atualizar máquinas com detalhes de comissão agregados no período e fallback por percentual cadastrado
      if (Array.isArray(relatorioData.maquinas)) {
        const percentualPorMaquina = new Map();

        maquinasDaLoja.forEach((maq) => {
          percentualPorMaquina.set(
            String(maq.id),
            toNumber(maq.percentualComissao ?? maq.percentual_comissao),
          );
        });

        const detalhesComissaoPorMaquina = new Map();

        comissoes.forEach((comissao) => {
          if (!Array.isArray(comissao.detalhes)) {
            return;
          }

          comissao.detalhes.forEach((detalhe) => {
            const maquinaId = String(detalhe.maquinaId);
            const acumulado = detalhesComissaoPorMaquina.get(maquinaId) || {
              lucro: 0,
              comissao: 0,
              percentualComissao: null,
            };

            const percentualDetalhe = toNumber(
              detalhe.percentualComissao ?? detalhe.percentual_comissao,
            );

            acumulado.lucro += toNumber(detalhe.lucro);
            acumulado.comissao += toNumber(detalhe.comissao);
            acumulado.percentualComissao =
              percentualDetalhe > 0
                ? percentualDetalhe
                : (acumulado.percentualComissao ?? null);

            detalhesComissaoPorMaquina.set(maquinaId, acumulado);
          });
        });

        relatorioData.maquinas = relatorioData.maquinas.map((maq) => {
          const maquinaId = String(maq.maquina?.id);
          const detalhe = detalhesComissaoPorMaquina.get(maquinaId);

          const notas = toNumber(maq.valoresEntrada?.notas);
          const cartao = toNumber(maq.valoresEntrada?.cartao);
          const totalRecebimento = notas + cartao;

          const percentualCadastro =
            toNumber(
              maq.maquina?.percentualComissao ??
                maq.maquina?.percentual_comissao,
            ) || toNumber(percentualPorMaquina.get(maquinaId));

          const percentualDetalhe = toNumber(detalhe?.percentualComissao);
          const percentualInferidoDaComissao =
            totalRecebimento > 0
              ? (toNumber(detalhe?.comissao) / totalRecebimento) * 100
              : 0;

          const percentualAplicado =
            percentualDetalhe > 0
              ? percentualDetalhe
              : percentualCadastro > 0
                ? percentualCadastro
                : percentualInferidoDaComissao;

          const comissaoCalculadaPorPercentual =
            percentualAplicado > 0
              ? totalRecebimento * (percentualAplicado / 100)
              : 0;

          const valoresComissao =
            percentualAplicado > 0
              ? comissaoCalculadaPorPercentual
              : toNumber(detalhe?.comissao);

          return {
            ...maq,
            valoresComissao,
            percentualComissaoAplicado: percentualAplicado,
            lucroComDescontoComissao: totalRecebimento - valoresComissao,
          };
        });

        const comissaoRecalculada = relatorioData.maquinas.reduce(
          (acc, maq) => acc + toNumber(maq.valoresComissao),
          0,
        );

        const lucroLiquidoRecalculado = relatorioData.maquinas.reduce(
          (acc, maq) => {
            const notas = toNumber(maq.valoresEntrada?.notas);
            const cartao = toNumber(maq.valoresEntrada?.cartao);
            return acc + (notas + cartao - toNumber(maq.valoresComissao));
          },
          0,
        );

        relatorioData.totais.comissao = comissaoRecalculada;
        relatorioData.totais.lucroComDescontoComissao = lucroLiquidoRecalculado;
      }

      // Buscar movimentações de cada máquina para detalhar no relatório de impressão
      if (
        Array.isArray(relatorioData?.maquinas) &&
        relatorioData.maquinas.length > 0
      ) {
        const inicioPeriodo = new Date(`${dataInicio}T00:00:00`);
        const fimPeriodo = new Date(`${dataFim}T23:59:59`);

        const movimentosPorMaquina = await Promise.all(
          relatorioData.maquinas.map(async (maquina) => {
            const maquinaId = maquina?.maquina?.id;
            if (!maquinaId) {
              return { maquinaId: null, movimentacoes: [] };
            }

            try {
              const responseMovimentacoes = await api.get(
                `/movimentacoes?maquinaId=${maquinaId}`,
              );
              const movimentacoesFiltradas = (responseMovimentacoes.data || [])
                .filter((mov) => {
                  const dataMov = obterDataMovimentacao(mov);
                  return dataMov >= inicioPeriodo && dataMov <= fimPeriodo;
                })
                .sort(
                  (a, b) => obterDataMovimentacao(b) - obterDataMovimentacao(a),
                )
                .map((mov) => {
                  const notas = toNumber(
                    mov.valorEntradaNotas ?? mov.valor_entrada_notas,
                  );
                  const cartao = toNumber(
                    mov.valorEntradaCartao ?? mov.valor_entrada_cartao,
                  );
                  const fichas = toNumber(
                    mov.valorEntradaFichas ?? mov.valor_entrada_fichas,
                  );
                  const totalFinanceiro = obterTotalFinanceiroMovimentacao(mov);
                  const numeroBag = String(mov.numeroBag || "").trim();

                  return {
                    ...mov,
                    valorEntradaNotasNormalizado: notas,
                    valorEntradaCartaoNormalizado: cartao,
                    valorEntradaFichasNormalizado: fichas,
                    valorFinanceiroTotal: totalFinanceiro,
                    numeroBagNormalizado: numeroBag,
                    financeiroPendente:
                      Boolean(numeroBag) && totalFinanceiro <= 0,
                  };
                });

              return {
                maquinaId: String(maquinaId),
                movimentacoes: movimentacoesFiltradas,
              };
            } catch {
              return { maquinaId: String(maquinaId), movimentacoes: [] };
            }
          }),
        );

        const mapaMovimentos = new Map(
          movimentosPorMaquina
            .filter((item) => item.maquinaId)
            .map((item) => [item.maquinaId, item.movimentacoes]),
        );

        relatorioData.maquinas = relatorioData.maquinas.map((maquina) => {
          const maquinaId = String(maquina?.maquina?.id ?? "");
          return {
            ...maquina,
            movimentacoesDetalhes: mapaMovimentos.get(maquinaId) || [],
          };
        });
      }

      setRelatorio(relatorioData);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      console.error("Detalhes do erro:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      let errorMessage = "Erro ao gerar relatório. Tente novamente.";

      if (error.response?.status === 404) {
        errorMessage =
          "⚠️ Endpoint não encontrado. O servidor pode estar atualizando ou o endpoint de relatório de roteiro/loja não existe.";
      } else if (error.response?.status === 500) {
        errorMessage = `⚠️ Erro no servidor: ${
          error.response?.data?.error || "Erro interno no servidor"
        }. Verifique se o roteiro/loja existe e se há dados para o período selecionado.`;
      } else if (error.response?.status === 400) {
        errorMessage = `⚠️ Requisição inválida: ${
          error.response?.data?.error || "Verifique os campos preenchidos"
        }`;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message === "Network Error") {
        errorMessage = "⚠️ Erro de conexão. Verifique sua internet.";
      }

      setError(errorMessage);
      setRelatorio(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const gerarPdfPlanilha = async () => {
    if (!dataInicio || !dataFim) {
      setError("Preencha o período para gerar o PDF em planilha.");
      return;
    }

    if (!relatorio) {
      setError("Gere o relatório primeiro antes de criar o PDF.");
      return;
    }

    try {
      setLoadingPdfPlanilha(true);
      setError("");

      // Usar os mesmos dados do relatório principal
      // Agrupar máquinas por loja e detalhar cada máquina na planilha
      const dadosPorLoja = new Map();
      const lojaPadraoRelatorio = relatorio?.loja;

      (relatorio?.maquinas || []).forEach((maquina, index) => {
        const lojaIdMaquina =
          maquina?.maquina?.lojaId || lojaPadraoRelatorio?.id || null;
        const lojaDoEstado = lojas.find(
          (l) => String(l.id) === String(lojaIdMaquina),
        );
        const lojaNoRelatorio = Array.isArray(relatorio?.lojas)
          ? relatorio.lojas.find(
              (item) => String(item?.loja?.id) === String(lojaIdMaquina),
            )
          : null;

        const nomeLoja =
          lojaDoEstado?.nome ||
          lojaNoRelatorio?.loja?.nome ||
          lojaPadraoRelatorio?.nome ||
          (lojaIdMaquina ? `Loja ${lojaIdMaquina}` : "Loja não identificada");

        const chaveLoja = String(lojaIdMaquina ?? nomeLoja);

        if (!dadosPorLoja.has(chaveLoja)) {
          dadosPorLoja.set(chaveLoja, {
            id: lojaIdMaquina,
            nomeLoja,
            maquinas: [],
            totais: {
              dinheiro: 0,
              cartao: 0,
              comissao: 0,
              conferidoTotal: 0,
              pelucias: 0,
              lucroLojaPeriodo: 0,
            },
          });
        }

        const dinheiro = toNumber(maquina.valoresEntrada?.notas || 0);
        const cartao = toNumber(maquina.valoresEntrada?.cartao || 0);
        const comissao = toNumber(maquina.valoresComissao || 0);
        const conferidoTotal = dinheiro + cartao;
        const pelucias = toNumber(maquina?.totais?.produtosSairam);
        const lucroMaquinaPeriodo = conferidoTotal - comissao;
        const mediaRecebidaPorPelucia = toNumber(
          maquina?.indicadoresFinanceiros?.mediaRecebidaPorPelucia,
        );

        const dadosMaquina = {
          nomeLoja,
          nomeMaquina:
            maquina?.maquina?.nome ||
            (maquina?.maquina?.id
              ? `Máquina ${maquina.maquina.id}`
              : `Máquina ${index + 1}`),
          codigoMaquina: maquina?.maquina?.codigo || "-",
          dinheiro,
          cartao,
          comissao,
          conferidoTotal,
          pelucias,
          lucroMaquinaPeriodo,
          mediaRecebidaPorPelucia,
        };

        const dadosLoja = dadosPorLoja.get(chaveLoja);
        dadosLoja.maquinas.push(dadosMaquina);
        dadosLoja.totais.dinheiro += dinheiro;
        dadosLoja.totais.cartao += cartao;
        dadosLoja.totais.comissao += comissao;
        dadosLoja.totais.conferidoTotal += conferidoTotal;
        dadosLoja.totais.pelucias += pelucias;
        dadosLoja.totais.lucroLojaPeriodo += lucroMaquinaPeriodo;
      });

      const lojasOrdenadas = Array.from(dadosPorLoja.values())
        .map((loja) => {
          const maquinasOrdenadas = [...loja.maquinas].sort((a, b) =>
            a.nomeMaquina.localeCompare(b.nomeMaquina, "pt-BR"),
          );

          return {
            ...loja,
            maquinas: maquinasOrdenadas,
          };
        })
        .sort((a, b) => a.nomeLoja.localeCompare(b.nomeLoja, "pt-BR"));

      const totalDinheiro = lojasOrdenadas.reduce(
        (acc, loja) => acc + loja.totais.dinheiro,
        0,
      );
      const totalCartao = lojasOrdenadas.reduce(
        (acc, loja) => acc + loja.totais.cartao,
        0,
      );
      const totalComissao = lojasOrdenadas.reduce(
        (acc, loja) => acc + loja.totais.comissao,
        0,
      );
      const totalConferido = lojasOrdenadas.reduce(
        (acc, loja) => acc + loja.totais.conferidoTotal,
        0,
      );
      const totalPelucias = lojasOrdenadas.reduce(
        (acc, loja) => acc + loja.totais.pelucias,
        0,
      );
      const totalLucroLojas = lojasOrdenadas.reduce(
        (acc, loja) => acc + loja.totais.lucroLojaPeriodo,
        0,
      );
      const mediaGeralValorPorPelucia =
        totalPelucias > 0 ? totalLucroLojas / totalPelucias : 0;
      const exibirTotalGeral = lojasOrdenadas.length > 1;

      const formatarMoeda = formatarMoedaBRL;

      const produtosSaidaDetalhados = agregarProdutos(
        (relatorio?.maquinas || []).flatMap((maquina) =>
          Array.isArray(maquina?.produtosSairam) ? maquina.produtosSairam : [],
        ),
      );

      const produtosSaidaPdf =
        produtosSaidaDetalhados.length > 0
          ? produtosSaidaDetalhados
          : Array.isArray(relatorio?.produtosSairam)
            ? relatorio.produtosSairam
            : [];

      const produtosSaidaOrdenados = [...produtosSaidaPdf].sort(
        (a, b) => toNumber(b.quantidade) - toNumber(a.quantidade),
      );

      const totalValorProdutos = produtosSaidaOrdenados.reduce(
        (acc, produto) => {
          const valorUnitario =
            toNumber(produto.preco) > 0
              ? toNumber(produto.preco)
              : mediaGeralValorPorPelucia;

          return acc + toNumber(produto.quantidade) * valorUnitario;
        },
        0,
      );

      const linhasHtml = lojasOrdenadas
        .map((loja) => {
          const linhasMaquinasHtml = loja.maquinas
            .map(
              (linha) => `
                <tr class="maquina-row">
                  <td>${linha.nomeLoja}</td>
                  <td>${linha.nomeMaquina} (${linha.codigoMaquina})</td>
                  <td class="num">${formatarMoeda(linha.dinheiro)}</td>
                  <td class="num">${formatarMoeda(linha.cartao)}</td>
                  <td class="num">${formatarMoeda(linha.comissao)}</td>
                  <td class="num">${formatarMoeda(linha.conferidoTotal)}</td>
                  <td class="num">${Math.round(linha.pelucias)}</td>
                  <td class="num">${formatarMoeda(linha.mediaRecebidaPorPelucia)}</td>
                </tr>
              `,
            )
            .join("");

          const subtotalLojaHtml = `
            <tr class="subtotal-row">
              <td colspan="2">TOTAL DA LOJA - ${loja.nomeLoja}</td>
              <td class="num">${formatarMoeda(loja.totais.dinheiro)}</td>
              <td class="num">${formatarMoeda(loja.totais.cartao)}</td>
              <td class="num">${formatarMoeda(loja.totais.comissao)}</td>
              <td class="num">${formatarMoeda(loja.totais.conferidoTotal)}</td>
              <td class="num">${Math.round(loja.totais.pelucias)}</td>
              <td class="num">-</td>
            </tr>
          `;

          return `${linhasMaquinasHtml}${subtotalLojaHtml}`;
        })
        .join("");

      const linhasProdutosHtml = produtosSaidaOrdenados.length
        ? produtosSaidaOrdenados
            .map((produto) => {
              const quantidade = toNumber(produto.quantidade);
              const valorUnitario =
                toNumber(produto.preco) > 0
                  ? toNumber(produto.preco)
                  : mediaGeralValorPorPelucia;
              const valorTotal = quantidade * valorUnitario;

              return `
                <tr>
                  <td>${produto.emoji || "📦"} ${produto.nome}</td>
                  <td>${produto.codigo || "-"}</td>
                  <td class="num">${Math.round(quantidade)}</td>
                  <td class="num">${formatarMoeda(valorUnitario)}</td>
                  <td class="num">${formatarMoeda(valorTotal)}</td>
                </tr>
              `;
            })
            .join("")
        : `
            <tr>
              <td colspan="5" style="text-align:center;">Nenhum produto com saída detalhada no período.</td>
            </tr>
          `;

      const htmlPlanilha = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Relatório Planilha</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; color: #1f2937; }
            h1 { font-size: 18px; margin: 0 0 6px; }
            .sub { font-size: 12px; margin-bottom: 12px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #9ca3af; padding: 6px 8px; }
            th { background: #f3f4f6; text-align: left; }
            .num { text-align: right; white-space: nowrap; }
            .section-title { margin: 18px 0 8px; font-size: 14px; font-weight: bold; }
            .maquina-row td { background: #ffffff; }
            .subtotal-row td {
              font-weight: 700;
              font-size: 13px;
              background: #dbeafe;
              border-top: 2px solid #2563eb;
              border-bottom: 2px solid #2563eb;
            }
            .subtotal-row td:first-child {
              letter-spacing: 0.2px;
            }
            .total-geral-row td {
              font-weight: 800;
              font-size: 13px;
              background: #fef3c7;
              border-top: 2px solid #d97706;
              border-bottom: 2px solid #d97706;
            }
            .total-geral-row td:first-child {
              letter-spacing: 0.3px;
            }
            @media print {
              body { padding: 0; }
              @page { size: A4 landscape; margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <h1>Relatório de Impressão - Estilo Planilha</h1>
          <div class="sub">Período: ${dataInicio} até ${dataFim}</div>

          <table>
            <thead>
              <tr>
                <th>Cliente (Loja)</th>
                <th>Máquina</th>
                <th>DINHEIRO</th>
                <th>Conf. Cartão</th>
                <th>Comissão</th>
                <th>Conferido Total</th>
                <th>Pelúcias (Qtd Saída)</th>
                <th>Média recebida por pelúcia</th>
              </tr>
            </thead>
            <tbody>
              ${linhasHtml}
            </tbody>
            ${
              exibirTotalGeral
                ? `
            <tfoot>
              <tr class="total-geral-row">
                <td colspan="2">TOTAL GERAL</td>
                <td class="num">${formatarMoeda(totalDinheiro)}</td>
                <td class="num">${formatarMoeda(totalCartao)}</td>
                <td class="num">${formatarMoeda(totalComissao)}</td>
                <td class="num">${formatarMoeda(totalConferido)}</td>
                <td class="num">${Math.round(totalPelucias)}</td>
                <td class="num">-</td>
              </tr>
            </tfoot>
            `
                : ""
            }
          </table>

          <div class="section-title">Detalhamento dos Produtos que Saíram</div>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Código</th>
                <th>Qtd Saída</th>
                <th>Valor Unitário</th>
                <th>Valor Total</th>
              </tr>
            </thead>
            <tbody>
              ${linhasProdutosHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2">TOTAL PRODUTOS</td>
                <td class="num">${Math.round(totalPelucias)}</td>
                <td class="num">-</td>
                <td class="num">${formatarMoeda(totalValorProdutos)}</td>
              </tr>
            </tfoot>
          </table>

          <script>
            window.onload = () => window.print();
          </script>
        </body>
        </html>
      `;

      const janela = window.open("", "_blank", "width=1200,height=800");
      if (!janela) {
        setError(
          "Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-up.",
        );
        return;
      }

      janela.document.open();
      janela.document.write(htmlPlanilha);
      janela.document.close();
    } catch (e) {
      setError("Erro ao gerar PDF em formato planilha. Tente novamente.");
    } finally {
      setLoadingPdfPlanilha(false);
    }
  };

  if (loadingRoteiros || loadingLojas) return <PageLoader />;

  // Proteções extras para evitar erros de undefined/null
  const totais =
    relatorio && typeof relatorio.totais === "object" ? relatorio.totais : {};
  const maquinas =
    relatorio && Array.isArray(relatorio.maquinas) ? relatorio.maquinas : [];
  const produtosSairam =
    relatorio && Array.isArray(relatorio.produtosSairam)
      ? relatorio.produtosSairam
      : [];
  const produtosEntraram =
    relatorio && Array.isArray(relatorio.produtosEntraram)
      ? relatorio.produtosEntraram
      : [];

  const produtosSairamDasMaquinas = agregarProdutos(
    maquinas.flatMap((maquina) =>
      Array.isArray(maquina?.produtosSairam) ? maquina.produtosSairam : [],
    ),
  );

  const produtosSairamConsolidado =
    produtosSairamDasMaquinas.length > 0
      ? produtosSairamDasMaquinas
      : produtosSairam.length > 0
        ? produtosSairam
        : toNumber(totais.produtosSairam) > 0
          ? [
              {
                id: "sem-detalhamento-saida",
                nome: "Sem detalhamento por produto",
                codigo: "-",
                emoji: "⚠️",
                quantidade: toNumber(totais.produtosSairam),
              },
            ]
          : [];

  const lojasComMovimentacoes = (() => {
    if (!relatorio) return [];

    const mapa = new Map();

    if (Array.isArray(relatorio.lojas)) {
      relatorio.lojas.forEach((item) => {
        const loja = item?.loja;
        const id = loja?.id;
        if (!id) return;

        const movs = toNumber(
          item?.totais?.movimentacoes ?? item?.movimentacoes,
        );

        if (!mapa.has(String(id))) {
          mapa.set(String(id), {
            id,
            nome: loja?.nome || `Loja ${id}`,
            movimentacoes: movs,
          });
        } else {
          const atual = mapa.get(String(id));
          mapa.set(String(id), {
            ...atual,
            movimentacoes: atual.movimentacoes + movs,
          });
        }
      });
    }

    if (mapa.size === 0 && lojasSelecionadas.length > 0) {
      lojasSelecionadas.forEach((lojaId) => {
        const loja = lojas.find((l) => String(l.id) === String(lojaId));
        mapa.set(String(lojaId), {
          id: lojaId,
          nome: loja?.nome || `Loja ${lojaId}`,
          movimentacoes: 0,
        });
      });
    }

    return Array.from(mapa.values())
      .filter((item) => item.movimentacoes > 0)
      .sort((a, b) => b.movimentacoes - a.movimentacoes);
  })();

  const lojaDestinoMovimentacoesId =
    lojasSelecionadas[0] || lojasComMovimentacoes[0]?.id;

  const abrirLojaMovimentacoes = (lojaId) => {
    if (!lojaId) return;
    navigate(`/lojas/${lojaId}`);
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="📄 Relatório de Impressão"
          subtitle="Gere relatórios detalhados de movimentações por loja"
          icon="📊"
        />

        {/* Formulário de Filtros */}
        <div className="card mb-6 no-print">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🚚 Roteiro
              </label>
              <select
                value={roteiroSelecionado}
                onChange={(e) => {
                  setRoteiroSelecionado(e.target.value);
                  setLojasSelecionadas([]);
                }}
                className="input-field w-full"
              >
                <option value="">Selecione um roteiro (opcional)</option>
                {roteiros.map((roteiro) => (
                  <option key={roteiro.id} value={roteiro.id}>
                    {roteiro.nome}{" "}
                    {roteiro.zona ? `- Zona: ${roteiro.zona}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏪 Lojas (múltipla seleção)
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={selecionarTodasAsLojas}
                  className="px-3 py-1 rounded-lg border border-gray-300 text-xs font-semibold hover:bg-gray-50"
                >
                  Selecionar todas
                </button>
                <button
                  type="button"
                  onClick={limparSelecaoLojas}
                  className="px-3 py-1 rounded-lg border border-gray-300 text-xs font-semibold hover:bg-gray-50"
                >
                  Limpar
                </button>
              </div>
              <input
                type="text"
                value={buscaLoja}
                onChange={(e) => setBuscaLoja(e.target.value)}
                placeholder="Buscar loja por nome..."
                className="input-field w-full mb-2"
              />
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white">
                {lojasFiltradas.map((loja) => {
                  const marcada = lojasSelecionadas.some(
                    (id) => String(id) === String(loja.id),
                  );
                  return (
                    <label
                      key={loja.id}
                      className="flex items-center gap-2 text-sm text-gray-700 py-1 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={() => toggleLojaSelecionada(loja.id)}
                      />
                      <span>{loja.nome}</span>
                    </label>
                  );
                })}
                {lojasFiltradas.length === 0 && (
                  <p className="text-sm text-gray-500 py-2 px-1">
                    Nenhuma loja encontrada com esse nome.
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {lojasSelecionadas.length > 0
                  ? `${lojasSelecionadas.length} loja(s) selecionada(s)`
                  : "Nenhuma loja selecionada"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data Inicial *
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data Final *
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                ⚠️{" "}
                {error.includes("Nenhuma loja encontrada para o roteiro")
                  ? "Este roteiro não possui nenhuma loja cadastrada. Selecione outro roteiro ou cadastre lojas para este roteiro."
                  : error}
              </p>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={gerarRelatorio}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "⏳ Gerando..." : "📊 Gerar Relatório"}
            </button>
            <button
              onClick={handleImprimir}
              disabled={!relatorio}
              className="btn-secondary"
            >
              🖨️ Imprimir
            </button>
            <button
              onClick={gerarPdfPlanilha}
              disabled={!relatorio || loadingPdfPlanilha}
              className="btn-secondary"
            >
              {loadingPdfPlanilha
                ? "⏳ Gerando PDF..."
                : "📄 Gerar PDF Planilha"}
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-gray-600 mt-4">Gerando relatório...</p>
          </div>
        )}

        {/* Relatório */}
        {relatorio && !loading && (
          <div className="space-y-6">
            {/* Header do Relatório */}

            {/* Exibir lojas do roteiro, se filtrando por roteiro */}
            {roteiroSelecionado &&
              relatorio.lojas &&
              relatorio.lojas.length > 0 && (
                <div className="card bg-linear-to-r from-blue-50 to-blue-100 border-2 border-blue-300">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <span className="text-xl sm:text-2xl">🏪</span>
                    Lojas deste roteiro
                  </h3>
                  <ul className="list-disc pl-6">
                    {relatorio.lojas.map((l) => (
                      <li key={l.loja.id} className="mb-1">
                        <span className="font-bold">{l.loja.nome}</span>
                        {l.loja.endereco ? ` — ${l.loja.endereco}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Tabela de Gastos por Loja */}
            {gastosLoja.length > 0 && (
              <div className="card bg-linear-to-r from-yellow-50 to-orange-100 border-2 border-yellow-300">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">💸</span>
                  Gastos registrados nas lojas selecionadas
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto">
                    <thead>
                      <tr className="bg-yellow-100">
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700">
                          Data
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700">
                          Categoria
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700">
                          Descrição
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-bold text-gray-700">
                          Valor (R$)
                        </th>
                        {isAdmin() && (
                          <th className="px-3 py-2 text-left text-xs font-bold text-gray-700">
                            KM Abastecimento
                          </th>
                        )}
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700">
                          Litros Abastecidos
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-700">
                          Roteiro
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {gastosLoja.map((gasto, idx) => (
                        <tr
                          key={gasto.id || idx}
                          className="border-b border-yellow-200"
                        >
                          <td className="px-3 py-2 text-xs text-gray-700">
                            {gasto.data
                              ? new Date(gasto.data).toLocaleDateString("pt-BR")
                              : "-"}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-700">
                            {gasto.categoria || "-"}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-700">
                            {gasto.descricao || "-"}
                          </td>
                          <td className="px-3 py-2 text-xs text-right font-bold text-orange-700">
                            {gasto.valor ? Number(gasto.valor).toFixed(2) : "-"}
                          </td>
                          {isAdmin() && (
                            <td className="px-3 py-2 text-xs text-gray-700">
                              {gasto.kmAbastecimento ??
                                gasto.km_abastecimento ??
                                "-"}
                            </td>
                          )}
                          <td className="px-3 py-2 text-xs text-gray-700">
                            {gasto.litrosAbastecimento ??
                              gasto.litros_abastecimento ??
                              "-"}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-700">
                            {(() => {
                              const roteiro = roteiros.find(
                                (r) => r.id === gasto.roteiroId,
                              );
                              return roteiro
                                ? roteiro.nome || roteiro.zona || roteiro.id
                                : gasto.roteiroId || "-";
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="card bg-linear-to-r from-purple-50 to-purple-100 border-2 border-purple-300">
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl sm:text-3xl">📊</span>
                {roteiroSelecionado &&
                relatorio &&
                relatorio.roteiro &&
                relatorio.roteiro.zona
                  ? `Resumo Geral do Roteiro (${relatorio.roteiro.zona})`
                  : lojasSelecionadas.length > 1
                    ? "Resumo Geral das Lojas Selecionadas"
                    : "Resumo Geral da Loja"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="card bg-linear-to-br from-red-500 to-red-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">📤</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {typeof totais.produtosSairam === "number"
                      ? totais.produtosSairam.toLocaleString("pt-BR")
                      : "0"}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Produtos Saíram
                  </div>
                </div>

                <div className="card bg-linear-to-br from-green-500 to-green-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">📥</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {typeof totais.produtosEntraram === "number"
                      ? totais.produtosEntraram.toLocaleString("pt-BR")
                      : "0"}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Produtos Entraram
                  </div>
                </div>

                <div
                  onClick={() =>
                    abrirLojaMovimentacoes(lojaDestinoMovimentacoesId)
                  }
                  className={`card bg-linear-to-br from-purple-500 to-purple-600 text-white text-left transition-transform ${
                    lojaDestinoMovimentacoesId
                      ? "hover:scale-[1.02] cursor-pointer"
                      : "opacity-70 cursor-not-allowed"
                  }`}
                >
                  <div className="text-2xl sm:text-3xl mb-2">🔄</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {typeof totais.movimentacoes === "number"
                      ? totais.movimentacoes.toLocaleString("pt-BR")
                      : "0"}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Total de Movimentações
                  </div>
                  {lojasComMovimentacoes.length > 0 && (
                    <div className="mt-3 border-t border-white/30 pt-3">
                      <div className="text-[11px] sm:text-xs opacity-90 mb-2">
                        Lojas com movimentações:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {lojasComMovimentacoes.map((lojaMov) => (
                          <button
                            key={lojaMov.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirLojaMovimentacoes(lojaMov.id);
                            }}
                            className="px-2 py-1 rounded-full text-[11px] sm:text-xs bg-white/20 hover:bg-white/30"
                          >
                            {lojaMov.nome} ({lojaMov.movimentacoes})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {lojaDestinoMovimentacoesId && (
                    <div className="mt-3 text-[11px] sm:text-xs opacity-90">
                      Clique para abrir a loja e acessar o histórico de
                      movimentações.
                    </div>
                  )}
                </div>
              </div>

              {/* Cards de Valores de Entrada */}
              <h4 className="text-lg sm:text-xl font-bold text-gray-900 mt-6 mb-4 flex items-center gap-2">
                <span className="text-xl sm:text-2xl">💰</span>
                Valores de Entrada (Lucro)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="card bg-linear-to-br from-green-400 to-green-500 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">💵</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {typeof totais.valoresEntrada?.notas === "number"
                      ? totais.valoresEntrada.notas.toFixed(2)
                      : "0.00"}
                  </div>
                  <div className="text-sm opacity-90">Entrada em Notas</div>
                </div>
                <div className="card bg-linear-to-br from-blue-400 to-blue-500 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">💳</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {typeof totais.valoresEntrada?.cartao === "number"
                      ? totais.valoresEntrada.cartao.toFixed(2)
                      : "0.00"}
                  </div>
                  <div className="text-sm opacity-90">
                    Entrada Digital/Cartão
                  </div>
                </div>
                <div className="card bg-linear-to-br from-orange-500 to-red-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">💰</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {typeof totais.valoresEntrada?.total === "number"
                      ? totais.valoresEntrada.total.toFixed(2)
                      : "0.00"}
                  </div>
                  <div className="text-sm opacity-90">Recebimento Total</div>
                </div>
                <div className="card bg-linear-to-br from-yellow-500 to-yellow-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">📉</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(typeof totais.comissao === "number"
                      ? totais.comissao
                      : maquinas.reduce(
                          (acc, m) => acc + (m.valoresComissao || 0),
                          0,
                        )
                    ).toFixed(2)}
                  </div>
                  <div className="text-sm opacity-90">Comissão Total Paga</div>
                </div>
                <div className="card bg-linear-to-br from-green-700 to-green-900 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">💸</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(typeof totais.lucroComDescontoComissao === "number"
                      ? totais.lucroComDescontoComissao
                      : (() => {
                          const totalRecebido =
                            typeof totais.valoresEntrada?.total === "number"
                              ? totais.valoresEntrada.total
                              : 0;
                          const totalComissao = maquinas.reduce(
                            (acc, m) => acc + (m.valoresComissao || 0),
                            0,
                          );
                          return totalRecebido - totalComissao;
                        })()
                    ).toFixed(2)}
                  </div>
                  <div className="text-sm opacity-90">Lucro Total</div>
                </div>
              </div>
            </div>

            {/* DETALHAMENTO POR MÁQUINA - PRINCIPAL */}
            {maquinas.length > 0 && (
              <div className="space-y-6">
                <div className="card bg-linear-to-r from-indigo-500 to-purple-600 text-white">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2 sm:gap-3">
                    <span className="text-3xl sm:text-4xl">🎰</span>
                    <span className="wrap-break-word">
                      RELATÓRIO DETALHADO POR MÁQUINA
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm opacity-90 mt-2">
                    Visualize abaixo as informações detalhadas de cada máquina
                    desta loja no período selecionado
                  </p>
                </div>

                {maquinas.map((maquina, index) => (
                  <div
                    key={maquina.maquina.id}
                    className="card border-4 border-indigo-300 shadow-2xl page-break-before"
                  >
                    {/* Header da Máquina com destaque */}
                    <div className="bg-linear-to-r from-indigo-600 to-purple-600 text-white p-4 sm:p-6 rounded-xl mb-4 sm:mb-6 shadow-lg">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">
                            🎰 {maquina.maquina.nome || `Máquina ${index + 1}`}
                          </h3>
                          <p className="text-sm sm:text-lg opacity-90">
                            📋 Código:{" "}
                            <span className="font-mono font-bold">
                              {maquina.maquina.codigo}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="bg-white/20 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-lg">
                            <div className="text-xs sm:text-sm opacity-90">
                              Máquina
                            </div>
                            <div className="text-2xl sm:text-3xl font-bold">
                              {index + 1}/{relatorio.maquinas.length}
                            </div>
                          </div>
                        </div>
                        <div className="bg-linear-to-br from-teal-600 to-cyan-700 text-white p-3 sm:p-5 rounded-xl shadow-lg col-span-2 lg:col-span-1">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            R$
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {formatarMoedaBRL(
                              maquina.indicadoresFinanceiros
                                ?.mediaRecebidaPorPelucia,
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Média recebida por pelúcia
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Totais da Máquina em destaque */}
                    <div className="mb-4 sm:mb-6">
                      <h4 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                        <span className="text-xl sm:text-2xl">📊</span>
                        <span className="text-sm sm:text-base">
                          Resumo de Movimentações desta Máquina
                        </span>
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                        <div className="bg-linear-to-br from-red-500 to-red-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            📤
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {typeof maquina.totais?.produtosSairam === "number"
                              ? maquina.totais.produtosSairam.toLocaleString(
                                  "pt-BR",
                                )
                              : "0"}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Produtos Saíram
                          </div>
                        </div>
                        <div className="bg-linear-to-br from-green-500 to-green-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            📥
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {typeof maquina.totais?.produtosEntraram ===
                            "number"
                              ? maquina.totais.produtosEntraram.toLocaleString(
                                  "pt-BR",
                                )
                              : "0"}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Produtos Entraram
                          </div>
                        </div>
                        <div className="bg-linear-to-br from-purple-500 to-purple-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🔄
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {maquina.totais.movimentacoes}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Movimentações
                          </div>
                        </div>
                      </div>

                      {/* Valores de Entrada por Máquina */}
                      <h4 className="text-base sm:text-xl font-bold text-gray-900 mt-4 sm:mt-6 mb-3 sm:mb-4 flex items-center gap-2">
                        <span className="text-xl sm:text-2xl">💰</span>
                        <span className="text-sm sm:text-base">
                          Valores de Entrada (Lucro da Máquina)
                        </span>
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                        <div className="bg-linear-to-br from-green-400 to-green-500 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            💵
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R$ {(maquina.valoresEntrada?.notas || 0).toFixed(2)}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Entrada em Notas
                          </div>
                        </div>
                        <div className="bg-linear-to-br from-blue-400 to-blue-500 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            💳
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {(maquina.valoresEntrada?.cartao || 0).toFixed(2)}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Entrada Digital/Cartão
                          </div>
                        </div>
                        <div className="bg-linear-to-br from-orange-500 to-red-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            💰
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {(() => {
                              const notas = maquina.valoresEntrada?.notas || 0;
                              const cartao =
                                maquina.valoresEntrada?.cartao || 0;
                              return (notas + cartao).toFixed(2);
                            })()}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Recebimento Total
                          </div>
                        </div>
                        <div className="bg-linear-to-br from-yellow-500 to-yellow-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            📉
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {(typeof maquina.valoresComissao === "number"
                              ? maquina.valoresComissao
                              : 0
                            ).toFixed(2)}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Comissão Paga
                          </div>
                        </div>
                        <div className="bg-linear-to-br from-green-700 to-green-900 text-white p-3 sm:p-5 rounded-xl shadow-lg col-span-2 lg:col-span-1">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            💸
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {(typeof maquina.lucroComDescontoComissao ===
                            "number"
                              ? maquina.lucroComDescontoComissao
                              : (() => {
                                  const notas =
                                    maquina.valoresEntrada?.notas || 0;
                                  const cartao =
                                    maquina.valoresEntrada?.cartao || 0;
                                  const totalRecebido = notas + cartao;
                                  const comissao = maquina.valoresComissao || 0;
                                  return totalRecebido - comissao;
                                })()
                            ).toFixed(2)}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Lucro da Máquina
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Movimentações da Máquina com valor financeiro */}
                    <div className="mb-4 sm:mb-6 bg-blue-50 p-3 sm:p-5 rounded-xl border-2 border-blue-200">
                      <h4 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2 bg-blue-600 text-white p-2 sm:p-3 rounded-lg">
                        <span className="text-xl sm:text-2xl">🔄</span>
                        <span className="text-sm sm:text-base">
                          Movimentações e Valores Financeiros
                        </span>
                      </h4>

                      {Array.isArray(maquina.movimentacoesDetalhes) &&
                      maquina.movimentacoesDetalhes.length > 0 ? (
                        <div className="space-y-2 sm:space-y-3">
                          {maquina.movimentacoesDetalhes.map((mov) => {
                            const dataMov = obterDataMovimentacao(mov);
                            return (
                              <div
                                key={mov.id}
                                className="p-3 bg-white border-2 border-blue-200 rounded-lg"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="text-xs sm:text-sm text-gray-600">
                                    {dataMov.getTime() > 0
                                      ? `${dataMov.toLocaleDateString("pt-BR")} às ${dataMov.toLocaleTimeString("pt-BR")}`
                                      : "Data não informada"}
                                  </div>
                                  <div className="text-xs sm:text-sm font-semibold text-gray-700">
                                    {mov.numeroBagNormalizado
                                      ? `Bag: ${mov.numeroBagNormalizado}`
                                      : "Sem bag"}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mt-3 text-xs sm:text-sm">
                                  <div>
                                    <p className="text-gray-500">Total Pré</p>
                                    <p className="font-semibold">
                                      {toNumber(mov.totalPre)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Saíram</p>
                                    <p className="font-semibold text-red-600">
                                      {toNumber(
                                        mov.produtosVendidos ?? mov.sairam,
                                      )}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Abastecidas</p>
                                    <p className="font-semibold text-green-600">
                                      {toNumber(mov.abastecidas)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">
                                      Notas / Digital
                                    </p>
                                    <p className="font-semibold text-blue-700">
                                      R${" "}
                                      {toNumber(
                                        mov.valorEntradaNotasNormalizado,
                                      ).toFixed(2)}{" "}
                                      / R${" "}
                                      {toNumber(
                                        mov.valorEntradaCartaoNormalizado,
                                      ).toFixed(2)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">
                                      Valor Financeiro
                                    </p>
                                    <p
                                      className={`font-bold ${mov.financeiroPendente ? "text-amber-600" : "text-emerald-700"}`}
                                    >
                                      {mov.financeiroPendente
                                        ? "Pendente"
                                        : `R$ ${toNumber(mov.valorFinanceiroTotal).toFixed(2)}`}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 sm:py-8 bg-white rounded-lg">
                          <p className="text-4xl sm:text-6xl mb-2">📭</p>
                          <p className="text-sm sm:text-base text-gray-500 font-medium">
                            Nenhuma movimentação encontrada no período
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Produtos da Máquina */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      {/* Produtos que Saíram */}
                      <div className="bg-red-50 p-3 sm:p-5 rounded-xl border-2 border-red-200">
                        <h4 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2 bg-red-500 text-white p-2 sm:p-3 rounded-lg">
                          <span className="text-xl sm:text-2xl">📤</span>
                          <span className="text-sm sm:text-base">
                            Produtos que SAÍRAM
                          </span>
                          <span className="ml-auto bg-white text-red-500 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                            {maquina.totais.produtosSairam}
                          </span>
                        </h4>
                        {maquina.produtosSairam &&
                        maquina.produtosSairam.length > 0 ? (
                          <div className="space-y-2 sm:space-y-3">
                            {(Array.isArray(maquina.produtosSairam)
                              ? maquina.produtosSairam
                              : []
                            )
                              .sort((a, b) => b.quantidade - a.quantidade)
                              .map((produto) => (
                                <div
                                  key={
                                    produto.id + "-" + (produto.codigo || "S/C")
                                  }
                                  className="p-3 bg-white border-2 border-red-200 rounded-lg"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-2xl">
                                        {produto.emoji || "📦"}
                                      </span>
                                      <div>
                                        <div className="font-bold text-gray-900">
                                          {produto.nome}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                          Cód: {produto.codigo || "S/C"}
                                        </div>
                                      </div>
                                    </div>
                                    <span className="bg-red-500 text-white px-3 py-1 rounded-full font-bold">
                                      {typeof produto.quantidade === "number"
                                        ? produto.quantidade.toLocaleString(
                                            "pt-BR",
                                          )
                                        : "0"}
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-white rounded-lg">
                            <p className="text-6xl mb-2">📭</p>
                            <p className="text-gray-500 font-medium">
                              Nenhum produto saiu
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Produtos que Entraram */}
                      <div className="bg-green-50 p-3 sm:p-5 rounded-xl border-2 border-green-200">
                        <h4 className="text-base sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2 bg-green-500 text-white p-2 sm:p-3 rounded-lg">
                          <span className="text-xl sm:text-2xl">📥</span>
                          <span className="text-sm sm:text-base">
                            Produtos que ENTRARAM
                          </span>
                          <span className="ml-auto bg-white text-green-500 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                            {maquina.totais.produtosEntraram}
                          </span>
                        </h4>
                        {maquina.produtosEntraram &&
                        maquina.produtosEntraram.length > 0 ? (
                          <div className="space-y-2 sm:space-y-3">
                            {(Array.isArray(maquina.produtosEntraram)
                              ? maquina.produtosEntraram
                              : []
                            )
                              .sort((a, b) => b.quantidade - a.quantidade)
                              .map((produto) => (
                                <div
                                  key={
                                    produto.id + "-" + (produto.codigo || "S/C")
                                  }
                                  className="p-3 bg-white border-2 border-green-200 rounded-lg"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-2xl">
                                        {produto.emoji || "📦"}
                                      </span>
                                      <div>
                                        <div className="font-bold text-gray-900">
                                          {produto.nome}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                          Cód: {produto.codigo || "S/C"}
                                        </div>
                                      </div>
                                    </div>
                                    <span className="bg-green-500 text-white px-3 py-1 rounded-full font-bold">
                                      {typeof produto.quantidade === "number"
                                        ? produto.quantidade.toLocaleString(
                                            "pt-BR",
                                          )
                                        : "0"}
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 sm:py-8 bg-white rounded-lg">
                            <p className="text-4xl sm:text-6xl mb-2">📭</p>
                            <p className="text-sm sm:text-base text-gray-500 font-medium">
                              Nenhum produto entrou
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Separador entre máquinas */}
                    {index < relatorio.maquinas.length - 1 && (
                      <div className="mt-8 pt-6 border-t-4 border-dashed border-gray-300">
                        <p className="text-center text-gray-500 text-sm font-medium">
                          ⬇️ Próxima Máquina ⬇️
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Consolidado Geral de Produtos */}
            <div className="card bg-linear-to-r from-amber-50 to-orange-100 border-2 border-orange-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-3xl">📊</span>
                Consolidado Geral de Produtos
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Resumo de todos os produtos (todas as máquinas das lojas
                selecionadas)
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Produtos que Saíram - Consolidado */}
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📤</span>
                    Produtos que Saíram (Total Geral)
                  </h4>
                  {produtosSairamConsolidado.length > 0 ? (
                    <div className="space-y-2">
                      {produtosSairamConsolidado
                        .sort((a, b) => b.quantidade - a.quantidade)
                        .map((produto) => (
                          <div
                            key={produto.id + "-" + (produto.codigo || "S/C")}
                            className="p-3 bg-white border-2 border-red-200 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">
                                  {produto.emoji || "📦"}
                                </span>
                                <div>
                                  <div className="font-bold text-gray-900">
                                    {produto.nome}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    Cód: {produto.codigo || "S/C"}
                                  </div>
                                </div>
                              </div>
                              <span className="bg-red-500 text-white px-3 py-1 rounded-full font-bold">
                                {typeof produto.quantidade === "number"
                                  ? produto.quantidade.toLocaleString("pt-BR")
                                  : "0"}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-2">📭</p>
                      <p className="text-gray-600">Nenhum produto saiu</p>
                    </div>
                  )}
                </div>

                {/* Produtos que Entraram - Consolidado */}
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📥</span>
                    Produtos que Entraram (Total Geral)
                  </h4>
                  {produtosEntraram.length > 0 ? (
                    <div className="space-y-2">
                      {produtosEntraram
                        .sort((a, b) => b.quantidade - a.quantidade)
                        .map((produto) => (
                          <div
                            key={produto.id + "-" + (produto.codigo || "S/C")}
                            className="p-3 bg-white border-2 border-green-200 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">
                                  {produto.emoji || "📦"}
                                </span>
                                <div>
                                  <div className="font-bold text-gray-900">
                                    {produto.nome}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    Cód: {produto.codigo || "S/C"}
                                  </div>
                                </div>
                              </div>
                              <span className="bg-green-500 text-white px-3 py-1 rounded-full font-bold">
                                {typeof produto.quantidade === "number"
                                  ? produto.quantidade.toLocaleString("pt-BR")
                                  : "0"}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-2">📭</p>
                      <p className="text-gray-600">Nenhum produto entrou</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Estado Vazio */}
        {!relatorio && !loading && !error && (
          <div className="text-center py-12 card">
            <p className="text-6xl mb-4">📄</p>
            <p className="text-gray-600 text-lg">
              Selecione uma ou mais lojas e o período para gerar o relatório
            </p>
          </div>
        )}
      </div>

      <Footer />

      {/* Estilos de Impressão */}
      <style>{`
        @media print {
          .no-print, nav, footer {
            display: none !important;
          }
          
          body {
            background: white !important;
          }
          
          .card {
            page-break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #e5e7eb;
          }
          
          .page-break-before {
            page-break-before: always;
          }
          
          .print-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color: white !important;
          }
          
          .bg-gradient-to-br, .bg-gradient-to-r {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .from-blue-500, .to-blue-600,
          .from-red-500, .to-red-600,
          .from-green-500, .to-green-600,
          .from-purple-500, .to-purple-600,
          .from-indigo-500, .to-indigo-500 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .bg-blue-50, .bg-red-50, .bg-green-50, .bg-purple-50, .bg-gray-50 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .border-blue-200, .border-red-200, .border-green-200, .border-purple-200 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          @page {
            margin: 1.5cm;
            size: A4;
          }
          
          h1, h2, h3, h4 {
            page-break-after: avoid;
          }
          
          .grid {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
