import { useState } from 'react';
import api from '../services/api';
import Swal from 'sweetalert2';

export function DevolucaoAdminModal({ carrinho, onClose, onSuccess }) {
  // Inicializar itens com quantidades esperadas
  const [itensDevolucao, setItensDevolucao] = useState(
    carrinho?.itens?.map(item => ({
      produtoId: item.produto.id,
      produtoNome: item.produto.nome,
      produtoCodigo: item.produto.codigo,
      quantidadeEsperada: item.quantidadeAtual,
      quantidadeDevolvida: item.quantidadeAtual // Pré-preenchido com valor esperado
    })) || []
  );
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(false);

  const atualizarQuantidade = (index, valor) => {
    const novosItens = [...itensDevolucao];
    novosItens[index].quantidadeDevolvida = parseInt(valor) || 0;
    setItensDevolucao(novosItens);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    
    // Validação
    const itensValidos = itensDevolucao.filter(item => item.quantidadeDevolvida >= 0);
    if (itensValidos.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Nenhum produto válido',
        text: 'Adicione pelo menos um produto com quantidade válida'
      });
      return;
    }

    // Calcular totais e discrepâncias
    const totalEsperado = itensDevolucao.reduce((sum, item) => sum + item.quantidadeEsperada, 0);
    const totalDevolvido = itensDevolucao.reduce((sum, item) => sum + item.quantidadeDevolvida, 0);
    const discrepanciaTotal = totalDevolvido - totalEsperado;
    
    // Detectar discrepâncias por produto
    const produtosComDiscrepancia = itensDevolucao.filter(
      item => item.quantidadeDevolvida !== item.quantidadeEsperada
    );

    // Confirmação extra
    const confirmacao = await Swal.fire({
      title: 'Confirmar devolução?',
      html: `
        <div class="text-left">
          <p class="mb-2">Você está registrando a devolução <strong>EM NOME DO funcionário</strong>:</p>
          <p class="font-bold mb-2">${carrinho.usuario?.nome}</p>
          <p class="mb-2"><strong>Total devolvido:</strong> ${totalDevolvido} unidades</p>
          <p class="mb-2"><strong>Total esperado:</strong> ${totalEsperado} unidades</p>
          ${produtosComDiscrepancia.length > 0 ? `
            <div class="bg-yellow-100 p-2 rounded mt-2">
              <p class="text-sm text-yellow-800">⚠️ ${produtosComDiscrepancia.length} produto(s) com discrepância</p>
            </div>
          ` : ''}
          <p class="text-red-600 font-semibold mt-4">⚠️ Esta ação não pode ser desfeita!</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sim, confirmar devolução',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4caf50',
      cancelButtonColor: '#d33'
    });

    if (!confirmacao.isConfirmed) return;

    setLoading(true);

    try {
      const response = await api.post('/carrinho-usuarios/devolucao', {
        carrinhoId: carrinho.id,
        itens: itensDevolucao.map(item => ({
          produtoId: item.produtoId,
          quantidadeDevolvida: item.quantidadeDevolvida
        })),
        observacao: observacao || undefined
      });

      const data = response.data;

      if (!data.ok) {
        throw new Error(data.erro || 'Erro ao registrar devolução');
      }

      // Sucesso
      if (data.alertaGerado) {
        // Devolução com discrepância
        const discrepancias = data.devolucao.itens?.filter(
          item => item.discrepancia !== 0
        ) || [];
        
        await Swal.fire({
          icon: 'warning',
          title: 'Devolução registrada com discrepância',
          html: `
            <div class="text-left">
              <p class="mb-2"><strong>Devolução registrada para:</strong> ${carrinho.usuario?.nome}</p>
              <div class="mt-3 p-3 bg-yellow-100 rounded">
                <p class="text-sm font-bold mb-2">⚠️ Produtos com discrepância:</p>
                ${discrepancias.map(item => `
                  <p class="text-sm">
                    ${item.produtoNome}: ${item.discrepancia > 0 ? '+' : ''}${item.discrepancia} unidades
                  </p>
                `).join('')}
              </div>
            </div>
          `,
          confirmButtonText: 'Entendi'
        });
      } else {
        // Devolução sem discrepância
        await Swal.fire({
          icon: 'success',
          title: 'Devolução registrada!',
          html: `
            <div class="text-left">
              <p class="mb-2">Devolução registrada com sucesso para:</p>
              <p class="font-bold mb-2">${carrinho.usuario?.nome}</p>
              <p class="text-green-600">✅ Quantidades conferem!</p>
            </div>
          `,
          timer: 3000,
          showConfirmButton: true
        });
      }

      onSuccess(); // Atualizar lista de carrinhos
      onClose();
    } catch (error) {
      console.error('Erro ao registrar devolução:', error);
      
      let errorMessage = 'Erro ao registrar devolução';
      let errorDetail = error.message;
      
      // Tratar erros específicos
      if (error.response?.status === 403) {
        errorMessage = 'Permissão negada';
        errorDetail = 'Você não tem permissão para registrar devolução por funcionários';
      } else if (error.response?.status === 404) {
        errorMessage = 'Carrinho não encontrado';
        errorDetail = 'Nenhum carrinho ativo encontrado para este funcionário';
      } else if (error.response?.status === 409) {
        errorMessage = 'Devolução já registrada';
        errorDetail = 'Já existe uma devolução registrada para este carrinho';
      } else if (error.response?.data?.erro) {
        errorDetail = error.response.data.erro;
      }

      Swal.fire({
        icon: 'error',
        title: errorMessage,
        text: errorDetail
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span>📦</span> Devolver Carrinho - {carrinho.usuario?.nome}
            </h3>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              disabled={loading}
            >
              ×
            </button>
          </div>

          {/* Alerta informativo */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex items-start">
              <div className="shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-800 mb-1">
                  Você está registrando a devolução <strong>EM NOME DO funcionário</strong>{' '}
                  <span className="font-bold">{carrinho.usuario?.nome}</span> ({carrinho.usuario?.email})
                </p>
                <p className="text-sm text-red-600 font-semibold mt-2">
                  Esta ação não pode ser desfeita!
                </p>
              </div>
            </div>
          </div>

          {/* Exibir observação do carrinho se existir */}
          {carrinho.observacao && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-1">📝 Observação do carrinho:</p>
              <p className="text-sm text-gray-600">{carrinho.observacao}</p>
            </div>
          )}

          <hr className="my-6 border-gray-300" />

          {/* Informações do carrinho */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <span>📊</span> Resumo do Carrinho:
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Quantidade total inicial</p>
                <p className="text-lg font-bold text-gray-800">{carrinho.quantidadeInicial} unidades</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Data</p>
                <p className="text-lg font-bold text-gray-800">
                  {new Date(carrinho.data).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </div>

          <hr className="my-6 border-gray-300" />

          {/* Formulário */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-3">
                Produtos a Devolver:
              </label>
              
              <div className="space-y-3">
                {itensDevolucao.map((item, index) => {
                  const temDiscrepancia = item.quantidadeDevolvida !== item.quantidadeEsperada;
                  const discrepancia = item.quantidadeDevolvida - item.quantidadeEsperada;
                  
                  return (
                    <div 
                      key={item.produtoId} 
                      className={`p-4 border-2 rounded-lg ${temDiscrepancia ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <h5 className="font-bold text-gray-800">{item.produtoNome}</h5>
                          {item.produtoCodigo && (
                            <p className="text-xs text-gray-500">Código: {item.produtoCodigo}</p>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          Esperado: <strong>{item.quantidadeEsperada}</strong>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                          Devolvido:
                        </label>
                        <input
                          type="number"
                          value={item.quantidadeDevolvida}
                          onChange={(e) => atualizarQuantidade(index, e.target.value)}
                          min="0"
                          required
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-semibold"
                          disabled={loading}
                        />
                        <span className="text-gray-600 text-sm">unid.</span>
                      </div>
                      
                      {temDiscrepancia && (
                        <div className="mt-2 text-sm">
                          <span className={`font-semibold ${discrepancia > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {discrepancia > 0 ? '↑ Sobra' : '↓ Falta'} de {Math.abs(discrepancia)} unidade(s)
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <p className="text-sm text-gray-500 mt-3">
                Digite a quantidade devolvida para cada produto. Valores diferentes do esperado gerarão alertas.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">
                Observação (opcional):
              </label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Funcionário saiu mais cedo, admin registrou devolução"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                disabled={loading}
              />
              <p className="text-sm text-gray-500 mt-2">
                Adicione informações relevantes sobre a devolução
              </p>
            </div>

            {/* Info footer */}
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
              <div className="flex items-start">
                <div className="shrink-0">
                  <span className="text-xl">ℹ️</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    O sistema registrará automaticamente que esta devolução foi feita por você.
                  </p>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Registrando...
                  </span>
                ) : (
                  'Confirmar Devolução'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default DevolucaoAdminModal;
