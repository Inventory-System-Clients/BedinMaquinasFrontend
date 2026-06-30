import { useEffect, useState } from 'react';
import api from '../services/api';

export function CarrinhoWidget({ onDevolucaoClick, onCarrinhoUpdate }) {
  const [carrinho, setCarrinho] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const response = await api.get('/carrinho-usuarios/status');
      
      if (response.data.temCarrinho) {
        setCarrinho(response.data.carrinho);
        if (onCarrinhoUpdate) {
          onCarrinhoUpdate(response.data.carrinho);
        }
      } else {
        setCarrinho(null);
      }
    } catch (error) {
      // Log detalhado apenas se não for erro esperado
      if (error.response?.status === 400) {
        // Erro 400 pode ser "não tem carrinho" ou outro erro
        console.log('ℹ️ [CarrinhoWidget] Resposta do backend:', {
          status: error.response.status,
          data: error.response.data
        });
        
        // Se a mensagem indicar que não tem carrinho, é comportamento normal
        const mensagem = error.response.data?.mensagem || error.response.data?.erro || '';
        if (mensagem.includes('carrinho') || mensagem.includes('ativo')) {
          console.log('✓ [CarrinhoWidget] Sem carrinho ativo - comportamento normal');
        } else {
          console.warn('⚠️ [CarrinhoWidget] Erro 400 inesperado:', error.response.data);
        }
      } else {
        // Erros não-400 são realmente problemáticos
        console.error('❌ [CarrinhoWidget] Erro ao buscar status do carrinho:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });
      }
      setCarrinho(null);
    } finally {
      setLoading(false);
    }
  }

  // Expor função para atualização externa
  useEffect(() => {
    // Store refresh function in window for external access
    window.refreshCarrinho = fetchStatus;
    return () => {
      delete window.refreshCarrinho;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (!carrinho) {
    return null; // Não mostrar nada se não houver carrinho
  }

  const percentage = carrinho.percentualUsado;
  const color = percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-yellow-500' : 'bg-green-500';
  const textColor = percentage > 90 ? 'text-red-600' : percentage > 70 ? 'text-yellow-600' : 'text-green-600';

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-2 border-primary-light">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🛒</span>
        <h3 className="text-xl font-bold text-gray-800">Meu Carrinho de Produtos</h3>
      </div>

      {/* Exibir observação do carrinho se existir */}
      {carrinho.observacao && (
        <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
          <p className="text-sm font-semibold text-gray-700 mb-1">📝 Observação:</p>
          <p className="text-sm text-gray-600">{carrinho.observacao}</p>
        </div>
      )}
      
      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Inicial:</span>
          <span className="font-semibold text-gray-800">{carrinho.quantidadeInicial} unidades</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Usado:</span>
          <span className={`font-semibold ${textColor}`}>
            {carrinho.quantidadeUsada} unidades ({percentage.toFixed(0)}%)
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Restante:</span>
          <span className="font-semibold text-gray-800">{carrinho.quantidadeAtual} unidades</span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div 
            className={`${color} h-full transition-all duration-500 rounded-full flex items-center justify-center text-xs text-white font-semibold`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          >
            {percentage > 15 && `${percentage.toFixed(0)}%`}
          </div>
        </div>
      </div>

      {/* Alerta se estiver acima de 90% */}
      {percentage > 90 && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <span className="font-semibold">Atenção: Carrinho quase vazio!</span>
          </div>
        </div>
      )}

      {/* Botão de devolução */}
      <button 
        onClick={() => onDevolucaoClick && onDevolucaoClick(carrinho)}
        className="w-full py-3 px-4 bg-green-500 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
      >
        Registrar Devolução
      </button>

      <p className="text-xs text-gray-500 text-center mt-3">
        Data: {new Date(carrinho.data).toLocaleDateString('pt-BR')}
      </p>
    </div>
  );
}
