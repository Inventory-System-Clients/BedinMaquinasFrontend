export const TIPO_OCORRENCIA_INCONSISTENCIA = "Inconsistência de Estoque";

const FORMULA_TOTAL_POS = "totalPre + abastecidas - retiradaProduto";

export function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getProdutosDetalhados(movimentacao = {}) {
  return (
    movimentacao.produtos ||
    movimentacao.detalhesProdutos ||
    movimentacao.movimentacao_produtos ||
    movimentacao.produtosMovimentacao ||
    []
  );
}

export function getQuantidadeProdutoDetalhe(produto = {}, chaves = []) {
  for (const chave of chaves) {
    if (produto[chave] !== undefined && produto[chave] !== null) {
      return toNumber(produto[chave]);
    }
  }

  return 0;
}

export function calcularSomasProdutos(movimentacao = {}) {
  const produtos = Array.isArray(getProdutosDetalhados(movimentacao))
    ? getProdutosDetalhados(movimentacao)
    : [];

  return produtos.reduce(
    (acc, produto) => {
      acc.sairam += getQuantidadeProdutoDetalhe(produto, [
        "quantidadeSaiu",
        "quantidade_saiu",
        "sairam",
        "quantidadeSaida",
      ]);
      acc.abastecidas += getQuantidadeProdutoDetalhe(produto, [
        "quantidadeAbastecida",
        "quantidade_abastecida",
        "abastecidas",
        "quantidadeEntrada",
        "quantidade",
      ]);
      return acc;
    },
    { sairam: 0, abastecidas: 0 },
  );
}

function buscarEstoqueProduto(estoqueDeposito = [], produtoId) {
  if (!produtoId || !Array.isArray(estoqueDeposito)) return null;

  const item = estoqueDeposito.find((registro) => {
    const id =
      registro?.produto?.id ||
      registro?.produtoId ||
      registro?.produto_id ||
      registro?.id;
    return String(id) === String(produtoId);
  });

  if (!item) return null;
  return toNumber(item.quantidade ?? item.estoqueAtual ?? item.estoque ?? item.saldo);
}

export function montarObservacaoInconsistencia({
  observacoes,
  justificativa,
  inconsistencias,
}) {
  const motivos = inconsistencias.map((item) => `- ${item.mensagem}`).join("\n");
  const bloco = [
    `[${TIPO_OCORRENCIA_INCONSISTENCIA}]`,
    "Motivos detectados:",
    motivos,
    `Justificativa: ${justificativa.trim()}`,
  ].join("\n");

  return observacoes ? `${observacoes}\n\n${bloco}` : bloco;
}

export function isMovimentacaoInconsistente(movimentacao = {}) {
  const tipo = String(
    movimentacao.tipoOcorrencia ||
      movimentacao.tipo_ocorrencia ||
      movimentacao.ocorrencia ||
      "",
  ).toLowerCase();
  const observacoes = String(
    movimentacao.observacoes || movimentacao.observacao || "",
  ).toLowerCase();

  return (
    tipo.includes("inconsist") ||
    tipo.includes("erro de lançamento") ||
    tipo.includes("conferência necessária") ||
    observacoes.includes(TIPO_OCORRENCIA_INCONSISTENCIA.toLowerCase())
  );
}

export function validarInconsistenciasMovimentacao({
  movimentacao,
  maquina,
  estoqueDeposito = [],
  validarDeposito = true,
}) {
  const inconsistencias = [];
  const totalPre = toNumber(movimentacao?.totalPre);
  const sairam = toNumber(movimentacao?.sairam);
  const abastecidas = toNumber(movimentacao?.abastecidas);
  const retiradaProduto = toNumber(
    movimentacao?.retiradaProduto ??
      movimentacao?.retirada_produto ??
      movimentacao?.retiradas ??
      0,
  );
  const totalPos = toNumber(movimentacao?.totalPos);
  const capacidade = toNumber(
    maquina?.capacidadePadrao || maquina?.capacidade_padrao,
  );
  const produtos = Array.isArray(getProdutosDetalhados(movimentacao))
    ? getProdutosDetalhados(movimentacao)
    : [];
  const somasProdutos = calcularSomasProdutos(movimentacao);

  if (capacidade > 0 && totalPos > capacidade) {
    inconsistencias.push({
      severidade: "critica",
      codigo: "TOTAL_ACIMA_CAPACIDADE",
      motivo:
        "A máquina não deveria terminar com mais produtos do que sua capacidade máxima.",
      mensagem:
        "O total final informado ultrapassa a capacidade da máquina. Confira a quantidade abastecida ou o total encontrado.",
    });
  }

  if (capacidade > 0 && abastecidas > 0 && totalPos < capacidade) {
    inconsistencias.push({
      severidade: "media",
      codigo: "ABASTECIMENTO_ABAIXO_DO_PADRAO",
      motivo:
        "A máquina recebeu abastecimento, mas não ficou com o estoque padrão definido no cadastro.",
      mensagem:
        "O abastecimento informado é menor que o necessário para a máquina ficar no padrão. Informe uma justificativa para salvar.",
    });
  }

  if (totalPos < 0) {
    inconsistencias.push({
      severidade: "critica",
      codigo: "TOTAL_NEGATIVO",
      motivo: "Não existe estoque negativo dentro da máquina.",
      mensagem:
        "O cálculo resultou em estoque negativo. Confira os produtos que saíram, retiradas e abastecimento.",
    });
  }

  if (sairam > totalPre && abastecidas === 0) {
    inconsistencias.push({
      severidade: "critica",
      codigo: "SAIDA_MAIOR_QUE_ESTOQUE",
      motivo:
        "A máquina não poderia vender/sair com mais produtos do que havia antes da coleta, salvo se houver abastecimento registrado corretamente.",
      mensagem:
        "A quantidade de produtos que saiu é maior que o estoque encontrado antes da movimentação.",
    });
  }

  if ((sairam > 0 || abastecidas > 0) && produtos.length === 0) {
    inconsistencias.push({
      severidade: "media",
      codigo: "SEM_PRODUTOS_DETALHADOS",
      motivo:
        "O sistema sabe que houve movimentação de quantidade, mas não sabe quais produtos participaram.",
      mensagem:
        "Esta movimentação possui saída ou abastecimento, mas nenhum produto foi detalhado.",
    });
  }

  if (
    produtos.length > 0 &&
    (somasProdutos.sairam !== sairam || somasProdutos.abastecidas !== abastecidas)
  ) {
    inconsistencias.push({
      severidade: "media",
      codigo: "SOMA_PRODUTOS_DIVERGENTE",
      motivo:
        "O total geral da movimentação não bate com o detalhamento por produto.",
      mensagem:
        "A soma dos produtos não confere com o total informado na movimentação.",
    });
  }

  if (retiradaProduto > 0 && !movimentacao?.retiradaEstoque) {
    inconsistencias.push({
      severidade: "media",
      codigo: "RETIRADA_SEM_MARCAÇÃO",
      motivo:
        "Produto foi removido da máquina, mas a movimentação não foi classificada corretamente.",
      mensagem:
        "Há retirada de produto registrada, mas a movimentação não foi marcada como retirada de estoque.",
    });
  }

  const temTotalPosInformado =
    movimentacao?.totalPos !== undefined && movimentacao?.totalPos !== null;
  const totalEsperado = totalPre + abastecidas - retiradaProduto;
  if (temTotalPosInformado && totalPos !== totalEsperado) {
    inconsistencias.push({
      severidade: "critica",
      codigo: "TOTAL_FINAL_INCOMPATIVEL",
      motivo: `O total final deveria seguir a fórmula ${FORMULA_TOTAL_POS}.`,
      mensagem:
        "O total final não confere com os valores informados na movimentação.",
    });
  }

  if (validarDeposito && produtos.length > 0 && estoqueDeposito.length > 0) {
    produtos.forEach((produto) => {
      const produtoId = produto.produtoId || produto.produto_id || produto?.produto?.id;
      const quantidadeAbastecida = getQuantidadeProdutoDetalhe(produto, [
        "quantidadeAbastecida",
        "quantidade_abastecida",
        "abastecidas",
        "quantidadeEntrada",
        "quantidade",
      ]);
      const estoqueDisponivel = buscarEstoqueProduto(estoqueDeposito, produtoId);

      if (
        estoqueDisponivel !== null &&
        quantidadeAbastecida > 0 &&
        quantidadeAbastecida > estoqueDisponivel
      ) {
        inconsistencias.push({
          severidade: "critica",
          codigo: "DEPOSITO_INSUFICIENTE",
          motivo:
            "A loja não tinha produtos suficientes para abastecer a máquina naquela quantidade.",
          mensagem:
            "O abastecimento informado é maior que o estoque disponível no depósito da loja.",
        });
      }
    });
  }

  return inconsistencias;
}
