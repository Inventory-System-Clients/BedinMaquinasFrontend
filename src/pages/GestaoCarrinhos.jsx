import { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { PageLoader } from '../components/Loading';
import { AlertBox, PageHeader } from '../components/UIComponents';
import { DevolucaoAdminModal } from '../components/DevolucaoAdminModal';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Swal from 'sweetalert2';

export function GestaoCarrinhos() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estado para criar carrinho
  const [usuarios, setUsuarios] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [usuarioId, setUsuarioId] = useState('');
  const [itensCarrinho, setItensCarrinho] = useState([
    { produtoId: '', quantidade: 0 }
  ]);
  const [criandoCarrinho, setCriandoCarrinho] = useState(false);
  const [observacaoCarrinho, setObservacaoCarrinho] = useState('');
  
  // Estado para carrinhos ativos
  const [carrinhos, setCarrinhos] = useState([]);
  
  // Estado para alertas
  const [alertas, setAlertas] = useState([]);
  const [totalAlertas, setTotalAlertas] = useState(0);
  const [alertasAtivos, setAlertasAtivos] = useState(0);
  
  // Estado para edição de carrinho
  const [carrinhoEditando, setCarrinhoEditando] = useState(null);
  const [mostrarModalEdicao, setMostrarModalEdicao] = useState(false);
  const [dadosEdicao, setDadosEdicao] = useState({
    quantidadeInicial: 0,
    quantidadeAtual: 0,
    ativo: true
  });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  
  // Estado para devolução por admin
  const [carrinhoParaDevolver, setCarrinhoParaDevolver] = useState(null);
  const [mostrarModalDevolucao, setMostrarModalDevolucao] = useState(false);
  
  // Estado para histórico de devoluções
  const [devolucoes, setDevolucoes] = useState([]);
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroFuncionario, setFiltroFuncionario] = useState('');
  const [carregandoDevolucoes, setCarregandoDevolucoes] = useState(false);
  
  // Aba ativa
  const [abaAtiva, setAbaAtiva] = useState('criar'); // 'criar', 'carrinhos', 'alertas', 'historico'

  // Verificar se o usuário tem permissão para acessar e devolver carrinhos
  const usuarioEmail = usuario?.email || '';
  const emailsAutorizados = [];
  const isEmailAutorizado = emailsAutorizados.includes(usuarioEmail.toLowerCase());
  const isAdmin = usuario?.role === 'ADMIN';
  const podeAcessar = isAdmin || isEmailAutorizado;
  const podeDevolver = isAdmin; // Apenas administradores podem devolver

  // Log de debug de permissões
  console.log('🔐 Permissões:', {
    email: usuarioEmail,
    role: usuario?.role,
    isEmailAutorizado,
    isAdmin,
    podeAcessar,
    podeDevolver
  });

  useEffect(() => {
    // Aguardar carregamento do usuário
    if (!usuario) {
      return;
    }
    
    if (!podeAcessar) {
      setError('Acesso negado. Apenas administradores e usuários autorizados podem acessar esta página.');
      setLoading(false);
      return;
    }
    
    carregarDados();
  }, [usuario]);

  async function carregarDados() {
    setLoading(true);
    try {
      console.log('🔄 Carregando dados - Usuário:', usuario?.email, 'Role:', usuario?.role);
      
      // Carregar usuários (funcionários) - para admins e usuários autorizados
      if (podeAcessar) {
        try {
          const resUsuarios = await api.get('/usuarios/funcionarios');
          setUsuarios(resUsuarios.data || []);
          console.log('✅ Usuários carregados:', resUsuarios.data?.length);
          
          // Carregar produtos disponíveis
          const resProdutos = await api.get('/produtos');
          setProdutos(resProdutos.data || []);
          console.log('✅ Produtos carregados:', resProdutos.data?.length);
        } catch (err) {
          console.warn('⚠️ Erro ao carregar usuários/produtos:', err.message);
        }
      }
      
      // Carregar carrinhos ativos - deve funcionar para todos autorizados
      await carregarCarrinhos();
      
      // Carregar alertas - deve funcionar para todos autorizados
      await carregarAlertas();
      
      setError('');
    } catch (err) {
      console.error('❌ Erro ao carregar dados:', err);
      console.error('Detalhes do erro:', err.response?.data);
      setError('Erro ao carregar dados: ' + (err.response?.data?.erro || err.message));
    } finally {
      setLoading(false);
    }
  }

  async function carregarCarrinhos() {
    try {
      console.log('🛒 Buscando carrinhos ativos...');
      const response = await api.get('/carrinho-usuarios?ativo=true');
      const carrinhos = response.data.carrinhos || [];
      console.log('✅ Carrinhos carregados:', carrinhos.length, carrinhos);
      setCarrinhos(carrinhos);
    } catch (err) {
      console.error('❌ Erro ao carregar carrinhos:', err);
      console.error('Detalhes:', err.response?.data);
      setCarrinhos([]);
    }
  }

  async function carregarAlertas() {
    try {
      console.log('⚠️ Buscando alertas...');
      const response = await api.get('/carrinho-usuarios/alertas?apenasAtivos=true');
      console.log('✅ Alertas carregados:', response.data);
      setAlertas(response.data.alertas || []);
      setTotalAlertas(response.data.total || 0);
      setAlertasAtivos(response.data.ativos || 0);
    } catch (err) {
      console.error('❌ Erro ao carregar alertas:', err);
      console.error('Detalhes:', err.response?.data);
      setAlertas([]);
      setTotalAlertas(0);
      setAlertasAtivos(0);
    }
  }

  async function carregarDevolucoes() {
    setCarregandoDevolucoes(true);
    try {
      console.log('📋 Buscando histórico de devoluções...');
      
      // Construir query params
      const params = new URLSearchParams();
      if (filtroDataInicio) params.append('dataInicio', filtroDataInicio);
      if (filtroDataFim) params.append('dataFim', filtroDataFim);
      if (filtroFuncionario) params.append('usuarioNome', filtroFuncionario);
      
      const response = await api.get(`/carrinho-usuarios/devolucoes?${params.toString()}`);
      console.log('✅ Devoluções carregadas:', response.data);
      setDevolucoes(response.data || []);
    } catch (err) {
      console.error('❌ Erro ao carregar devoluções:', err);
      console.error('Detalhes:', err.response?.data);
      setDevolucoes([]);
    } finally {
      setCarregandoDevolucoes(false);
    }
  }

  // Funções para gerenciar itens do carrinho
  function adicionarProduto() {
    setItensCarrinho([...itensCarrinho, { produtoId: '', quantidade: 0 }]);
  }

  function removerProduto(index) {
    if (itensCarrinho.length === 1) return; // Manter pelo menos um
    setItensCarrinho(itensCarrinho.filter((_, i) => i !== index));
  }

  function atualizarItem(index, campo, valor) {
    const novosItens = [...itensCarrinho];
    novosItens[index][campo] = campo === 'quantidade' ? parseInt(valor) || 0 : valor;
    setItensCarrinho(novosItens);
  }

  async function handleCriarCarrinho(e) {
    e.preventDefault();
    
    // Validar
    const itensValidos = itensCarrinho.filter(
      item => item.produtoId && item.quantidade > 0
    );
    
    if (!usuarioId) {
      Swal.fire({
        icon: 'error',
        title: 'Dados inválidos',
        text: 'Selecione um funcionário'
      });
      return;
    }

    if (itensValidos.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Produtos necessários',
        text: 'Adicione pelo menos um produto com quantidade válida'
      });
      return;
    }

    // Verificar duplicados
    const produtosUnicos = new Set(itensValidos.map(i => i.produtoId));
    if (produtosUnicos.size !== itensValidos.length) {
      Swal.fire({
        icon: 'error',
        title: 'Produto duplicado',
        text: 'Remova produtos duplicados do carrinho'
      });
      return;
    }

    setCriandoCarrinho(true);
    
    try {
      const totalProdutos = itensValidos.reduce((sum, item) => sum + item.quantidade, 0);
      
      const response = await api.post('/carrinho-usuarios', {
        usuarioId,
        itens: itensValidos,
        observacao: observacaoCarrinho.trim() || undefined
      });

      if (response.data) {
        const usuario = usuarios.find(u => u.id === usuarioId);
        await Swal.fire({
          icon: 'success',
          title: 'Carrinho criado!',
          text: `Carrinho com ${totalProdutos} produtos (${itensValidos.length} tipos) criado para ${usuario?.nome || 'funcionário'}`,
          timer: 3000,
          showConfirmButton: false
        });
        
        // Limpar formulário
        setUsuarioId('');
        setItensCarrinho([{ produtoId: '', quantidade: 0 }]);
        setObservacaoCarrinho(''); // Limpar observação
        
        // Recarregar carrinhos
        await carregarCarrinhos();
      }
    } catch (error) {
      console.error('Erro ao criar carrinho:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro ao criar carrinho',
        text: error.response?.data?.erro || error.message
      });
    } finally {
      setCriandoCarrinho(false);
    }
  }

  function handleEditarCarrinho(carrinho) {
    setCarrinhoEditando(carrinho);
    setDadosEdicao({
      quantidadeInicial: carrinho.quantidadeInicial,
      quantidadeAtual: carrinho.quantidadeAtual,
      ativo: carrinho.ativo !== false // Default true se undefined
    });
    setMostrarModalEdicao(true);
  }

  function handleDevolverCarrinho(carrinho) {
    setCarrinhoParaDevolver(carrinho);
    setMostrarModalDevolucao(true);
  }

  function handleFecharModalDevolucao() {
    setMostrarModalDevolucao(false);
    setCarrinhoParaDevolver(null);
  }

  async function handleSucessoDevolucao() {
    // Recarregar carrinhos e alertas após devolução
    await Promise.all([
      carregarCarrinhos(),
      carregarAlertas()
    ]);
  }

  async function handleSalvarEdicao(e) {
    e.preventDefault();
    
    if (dadosEdicao.quantidadeInicial < 0 || dadosEdicao.quantidadeAtual < 0) {
      Swal.fire({
        icon: 'error',
        title: 'Valores inválidos',
        text: 'As quantidades não podem ser negativas'
      });
      return;
    }

    if (dadosEdicao.quantidadeAtual > dadosEdicao.quantidadeInicial) {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Quantidade atual maior que inicial',
        text: 'A quantidade atual é maior que a inicial. Deseja continuar?',
        showCancelButton: true,
        confirmButtonText: 'Sim, continuar',
        cancelButtonText: 'Cancelar'
      });
      
      if (!result.isConfirmed) return;
    }

    setSalvandoEdicao(true);
    
    try {
      const response = await api.put(`/carrinho-usuarios/${carrinhoEditando.id}`, {
        quantidadeInicial: parseInt(dadosEdicao.quantidadeInicial),
        quantidadeAtual: parseInt(dadosEdicao.quantidadeAtual),
        ativo: dadosEdicao.ativo
      });

      if (response.data.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Carrinho atualizado!',
          text: response.data.mensagem || 'Alterações salvas com sucesso',
          timer: 3000,
          showConfirmButton: false
        });
        
        setMostrarModalEdicao(false);
        setCarrinhoEditando(null);
        
        // Recarregar carrinhos
        await carregarCarrinhos();
      }
    } catch (error) {
      console.error('Erro ao atualizar carrinho:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro ao atualizar carrinho',
        text: error.response?.data?.erro || error.message
      });
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function handleDesativarAlerta(alertaId) {
    const result = await Swal.fire({
      title: 'Desativar alerta?',
      html: `
        <textarea 
          id="observacao-alerta" 
          class="swal2-input" 
          placeholder="Observação (opcional)"
          rows="3"
        ></textarea>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Desativar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        return document.getElementById('observacao-alerta').value;
      }
    });

    if (result.isConfirmed) {
      try {
        await api.put(`/carrinho-usuarios/alertas/${alertaId}/desativar`, {
          observacao: result.value || undefined
        });

        Swal.fire({
          icon: 'success',
          title: 'Alerta desativado',
          timer: 2000,
          showConfirmButton: false
        });

        // Recarregar alertas
        await carregarAlertas();
      } catch (error) {
        console.error('Erro ao desativar alerta:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erro ao desativar alerta',
          text: error.response?.data?.erro || error.message
        });
      }
    }
  }

  if (loading) return <PageLoader />;

  if (!podeAcessar) {
    return (
      <div className="min-h-screen bg-background-light">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <AlertBox type="error" message="Acesso negado. Apenas administradores e usuários autorizados podem acessar esta página." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader 
          title="Gestão de Carrinhos" 
          subtitle="Controle de produtos distribuídos aos funcionários"
        />

        {error && <AlertBox type="error" message={error} onClose={() => setError('')} />}
        {success && <AlertBox type="success" message={success} onClose={() => setSuccess('')} />}

        {/* Abas de navegação */}
        <div className="flex gap-2 mb-6 border-b border-gray-300">
          <button
            onClick={() => setAbaAtiva('criar')}
            className={`px-6 py-3 font-semibold transition-colors ${
              abaAtiva === 'criar'
                ? 'border-b-4 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            ➕ Criar Carrinho
          </button>
          
          <button
            onClick={() => setAbaAtiva('carrinhos')}
            className={`px-6 py-3 font-semibold transition-colors relative ${
              abaAtiva === 'carrinhos'
                ? 'border-b-4 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📦 Carrinhos Ativos
            {carrinhos.length > 0 && (
              <span className="ml-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs">
                {carrinhos.length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setAbaAtiva('alertas')}
            className={`px-6 py-3 font-semibold transition-colors relative ${
              abaAtiva === 'alertas'
                ? 'border-b-4 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            ⚠️ Alertas
            {alertasAtivos > 0 && (
              <span className="ml-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs animate-pulse">
                {alertasAtivos}
              </span>
            )}
          </button>
          
          <button
            onClick={() => {
              setAbaAtiva('historico');
              carregarDevolucoes();
            }}
            className={`px-6 py-3 font-semibold transition-colors relative ${
              abaAtiva === 'historico'
                ? 'border-b-4 border-primary text-primary'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            📋 Histórico de Devoluções
          </button>
        </div>

        {/* Conteúdo das abas */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Aba: Criar Carrinho */}
          {abaAtiva === 'criar' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <span>➕</span> Criar Novo Carrinho
              </h2>
              
              <form onSubmit={handleCriarCarrinho} className="max-w-lg">
                <div className="mb-6">
                  <label className="block text-gray-700 font-semibold mb-2">
                    Funcionário *
                  </label>
                  <select
                    value={usuarioId}
                    onChange={(e) => setUsuarioId(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={criandoCarrinho}
                  >
                    <option value="">Selecione um funcionário...</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.nome} - {u.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-6">
                  <label className="block text-gray-700 font-semibold mb-2">
                    Produtos no Carrinho *
                  </label>
                  
                  <div className="space-y-3">
                    {itensCarrinho.map((item, index) => (
                      <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <select
                            value={item.produtoId}
                            onChange={(e) => atualizarItem(index, 'produtoId', e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            disabled={criandoCarrinho}
                          >
                            <option value="">Selecione produto...</option>
                            {produtos.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.nome} {p.codigo ? `(${p.codigo})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <input
                          type="number"
                          min="1"
                          placeholder="Qtd"
                          value={item.quantidade || ''}
                          onChange={(e) => atualizarItem(index, 'quantidade', e.target.value)}
                          required
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-center"
                          disabled={criandoCarrinho}
                        />

                        <button
                          type="button"
                          onClick={() => removerProduto(index)}
                          disabled={itensCarrinho.length === 1 || criandoCarrinho}
                          className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remover produto"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={adicionarProduto}
                    className="mt-3 px-4 py-2 bg-blue-100 text-blue-600 font-semibold rounded-lg hover:bg-blue-200 transition-colors"
                    disabled={criandoCarrinho}
                  >
                    ➕ Adicionar Produto
                  </button>

                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Total:</strong> {itensCarrinho.reduce((sum, item) => sum + (item.quantidade || 0), 0)} produtos
                      {' '}({itensCarrinho.filter(i => i.produtoId).length} tipos diferentes)
                    </p>
                  </div>
                </div>

                {/* Campo Observação */}
                <div className="mb-6">
                  <label className="block text-gray-700 font-semibold mb-2">
                    Observação (opcional)
                  </label>
                  <textarea
                    value={observacaoCarrinho}
                    onChange={(e) => setObservacaoCarrinho(e.target.value)}
                    placeholder="Ex: Cliente VIP, Evento especial, Pedido urgente..."
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-vertical"
                    disabled={criandoCarrinho}
                  />
                  <small className="text-gray-500">{observacaoCarrinho.length}/500 caracteres</small>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setUsuarioId('');
                      setItensCarrinho([{ produtoId: '', quantidade: 0 }]);
                      setObservacaoCarrinho(''); // Limpar observação
                    }}
                    className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={criandoCarrinho}
                  >
                    Limpar
                  </button>
                  
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-primary hover:bg-primary-dark text-black font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={criandoCarrinho}
                  >
                    {criandoCarrinho ? 'Criando...' : 'Criar Carrinho'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Aba: Carrinhos Ativos */}
          {abaAtiva === 'carrinhos' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span>📦</span> Carrinhos Ativos
                </h2>
                <button
                  onClick={carregarCarrinhos}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  🔄 Atualizar
                </button>
              </div>

              {carrinhos.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-2">Nenhum carrinho ativo no momento</p>
                  <p className="text-xs text-gray-400">Os carrinhos aparecerão aqui quando disponíveis</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {carrinhos.map(carrinho => {
                    const percentage = carrinho.quantidadeUsada 
                      ? (carrinho.quantidadeUsada / carrinho.quantidadeInicial * 100).toFixed(0)
                      : 0;
                    const color = percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-yellow-500' : 'bg-green-500';
                    
                    return (
                      <div key={carrinho.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-lg font-bold text-gray-800">
                              {carrinho.usuario?.nome || 'Usuário não encontrado'}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {carrinho.usuario?.email || ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gray-500">
                              {new Date(carrinho.data).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        {/* Exibir observação do carrinho se existir */}
                        {carrinho.observacao && (
                          <div className="mb-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                            <p className="text-xs font-semibold text-gray-700 mb-1">📝 Observação:</p>
                            <p className="text-sm text-gray-600">{carrinho.observacao}</p>
                          </div>
                        )}

                        {/* Resumo Total */}
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div className="text-center">
                            <p className="text-xs text-gray-600">Total Inicial</p>
                            <p className="text-lg font-bold">{carrinho.quantidadeInicial}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-600">Total Usado</p>
                            <p className="text-lg font-bold">{carrinho.quantidadeUsada || 0}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-600">Total Restante</p>
                            <p className="text-lg font-bold">{carrinho.quantidadeAtual}</p>
                          </div>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-3">
                          <div 
                            className={`${color} h-full transition-all duration-500`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-sm mb-3">
                          <span className="text-gray-600">{percentage}% usado</span>
                          {percentage > 90 && (
                            <span className="text-red-600 font-semibold flex items-center gap-1">
                              <span>⚠️</span> Carrinho crítico
                            </span>
                          )}
                        </div>

                        {/* Lista de Produtos */}
                        {carrinho.itens && carrinho.itens.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-600 font-semibold mb-2">Produtos no Carrinho:</p>
                            <div className="space-y-2">
                              {carrinho.itens.map(item => {
                                const percentualItem = item.quantidadeInicial > 0 
                                  ? ((item.quantidadeInicial - item.quantidadeAtual) / item.quantidadeInicial * 100).toFixed(0)
                                  : 0;
                                const colorItem = percentualItem > 90 ? 'text-red-600' : percentualItem > 70 ? 'text-yellow-600' : 'text-green-600';
                                
                                return (
                                  <div key={item.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                                    <div className="flex-1">
                                      <span className="font-medium">{item.produto?.nome || 'Produto'}</span>
                                      {item.produto?.codigo && (
                                        <span className="text-xs text-gray-500 ml-1">({item.produto.codigo})</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                      <span className="text-gray-600">
                                        Restante: <strong className={item.quantidadeAtual === 0 ? 'text-red-600' : ''}>{item.quantidadeAtual}</strong>/{item.quantidadeInicial}
                                      </span>
                                      <span className={colorItem}>
                                        {percentualItem}%
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-200">
                          <button
                            onClick={() => handleEditarCarrinho(carrinho)}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                          >
                            <span>✏️</span> Editar
                          </button>
                          
                          {podeDevolver && (
                            <button
                              onClick={() => handleDevolverCarrinho(carrinho)}
                              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                              title="Registrar devolução em nome do funcionário"
                            >
                              <span>📦</span> Devolver pelo Funcionário
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Aba: Alertas */}
          {abaAtiva === 'alertas' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span>⚠️</span> Alertas de Discrepância
                </h2>
                <button
                  onClick={carregarAlertas}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  🔄 Atualizar
                </button>
              </div>

              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm">
                  <strong>{alertasAtivos}</strong> alertas ativos de <strong>{totalAlertas}</strong> no total
                </p>
              </div>

              {alertas.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  ✅ Nenhum alerta ativo no momento
                </p>
              ) : (
                <div className="space-y-4">
                  {alertas.map(alerta => (
                    <div 
                      key={alerta.id} 
                      className={`border-l-4 ${
                        alerta.discrepancia < 0 ? 'border-red-500 bg-red-50' : 'border-orange-500 bg-orange-50'
                      } p-4 rounded-r-lg`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="text-3xl">
                            {alerta.discrepancia < 0 ? '🔴' : '🟠'}
                          </span>
                          
                          <div className="flex-1">
                            <h3 className="font-bold text-lg mb-1">
                              {alerta.usuario?.nome || 'Usuário não encontrado'}
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">
                              {new Date(alerta.dataDevolucao).toLocaleString('pt-BR')}
                            </p>
                            
                            <div className="grid grid-cols-3 gap-4 mb-2">
                              <div>
                                <p className="text-xs text-gray-600">Devolveu</p>
                                <p className="font-semibold">{alerta.quantidadeDevolvida}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600">Esperado</p>
                                <p className="font-semibold">{alerta.quantidadeEsperada}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600">
                                  {alerta.discrepancia < 0 ? 'Falta' : 'Sobra'}
                                </p>
                                <p className={`font-bold ${
                                  alerta.discrepancia < 0 ? 'text-red-600' : 'text-orange-600'
                                }`}>
                                  {Math.abs(alerta.discrepancia)} un.
                                </p>
                              </div>
                            </div>

                            {alerta.observacao && (
                              <div className="mt-2 p-3 bg-white bg-opacity-70 rounded border-l-3 border-blue-400">
                                <p className="text-xs font-semibold text-gray-700 mb-1">📝 Observação:</p>
                                <p className="text-sm text-gray-600">{alerta.observacao}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDesativarAlerta(alerta.id)}
                          className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Desativar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Aba: Histórico de Devoluções */}
          {abaAtiva === 'historico' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span>📋</span> Histórico de Devoluções
                </h2>
                <button
                  onClick={carregarDevolucoes}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={carregandoDevolucoes}
                >
                  🔄 {carregandoDevolucoes ? 'Carregando...' : 'Atualizar'}
                </button>
              </div>

              {/* Filtros */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-700 mb-3">🔍 Filtros</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Início:
                    </label>
                    <input
                      type="date"
                      value={filtroDataInicio}
                      onChange={(e) => setFiltroDataInicio(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Fim:
                    </label>
                    <input
                      type="date"
                      value={filtroDataFim}
                      onChange={(e) => setFiltroDataFim(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Funcionário:
                    </label>
                    <input
                      type="text"
                      value={filtroFuncionario}
                      onChange={(e) => setFiltroFuncionario(e.target.value)}
                      placeholder="Digite o nome..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={carregarDevolucoes}
                    className="px-4 py-2 bg-primary text-black font-semibold rounded-lg hover:bg-primary-dark transition-colors"
                    disabled={carregandoDevolucoes}
                  >
                    Aplicar Filtros
                  </button>
                  <button
                    onClick={() => {
                      setFiltroDataInicio('');
                      setFiltroDataFim('');
                      setFiltroFuncionario('');
                      carregarDevolucoes();
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                    disabled={carregandoDevolucoes}
                  >
                    Limpar Filtros
                  </button>
                </div>
              </div>

              {/* Lista de Devoluções */}
              {carregandoDevolucoes ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Carregando devoluções...</p>
                </div>
              ) : devolucoes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Nenhuma devolução encontrada</p>
                  <p className="text-xs text-gray-400 mt-2">Tente ajustar os filtros</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {devolucoes.map(devolucao => (
                    <div 
                      key={devolucao.id}
                      className={`border-2 rounded-lg p-4 ${devolucao.alertaAtivo ? 'border-yellow-400 bg-yellow-50' : 'border-green-400 bg-green-50'}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">
                            {devolucao.usuario?.nome || 'Usuário não encontrado'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {devolucao.usuario?.email || ''}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(devolucao.dataDevolucao).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div className="text-right">
                          {devolucao.alertaAtivo ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-200 text-yellow-800 rounded-full text-sm font-semibold">
                              ⚠️ Com Discrepância
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-semibold">
                              ✅ OK
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-3 p-3 bg-white rounded-lg">
                        <div>
                          <p className="text-xs text-gray-600">Quantidade Devolvida</p>
                          <p className="text-lg font-bold">{devolucao.quantidadeDevolvida || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Quantidade Esperada</p>
                          <p className="text-lg font-bold">{devolucao.quantidadeEsperada || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Discrepância</p>
                          <p className={`text-lg font-bold ${devolucao.discrepancia === 0 ? 'text-green-600' : devolucao.discrepancia > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {devolucao.discrepancia > 0 ? '+' : ''}{devolucao.discrepancia || 0}
                          </p>
                        </div>
                      </div>

                      {/* Observação da Devolução */}
                      {devolucao.observacao && (
                        <div className="mt-3 p-3 bg-blue-100 border-l-4 border-blue-500 rounded">
                          <p className="text-sm font-semibold text-gray-700 mb-1">📝 Observação:</p>
                          <p className="text-sm text-gray-700">{devolucao.observacao}</p>
                        </div>
                      )}

                      {/* Detalhes dos produtos */}
                      {devolucao.itens && devolucao.itens.length > 0 && (
                        <details className="mt-3">
                          <summary className="cursor-pointer font-semibold text-gray-700 hover:text-primary">
                            Ver detalhes dos produtos ({devolucao.itens.length})
                          </summary>
                          <div className="mt-2 space-y-2">
                            {devolucao.itens.map(item => (
                              <div key={item.id} className="p-2 bg-white rounded border border-gray-200">
                                <div className="flex justify-between items-center">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-800">
                                      {item.produto?.nome || 'Produto'}
                                    </p>
                                    {item.produto?.codigo && (
                                      <p className="text-xs text-gray-500">
                                        Código: {item.produto.codigo}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right text-sm">
                                    <p className="text-gray-600">
                                      Devolvido: <strong>{item.quantidadeDevolvida}</strong>
                                    </p>
                                    <p className="text-gray-600">
                                      Esperado: <strong>{item.quantidadeEsperada}</strong>
                                    </p>
                                    {item.discrepancia !== 0 && (
                                      <p className={`font-semibold ${item.discrepancia > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                        {item.discrepancia > 0 ? 'Sobra: +' : 'Falta: '}{item.discrepancia}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edição de Carrinho */}
      {mostrarModalEdicao && carrinhoEditando && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <span>✏️</span> Editar Carrinho
                </h3>
                <button 
                  onClick={() => {
                    setMostrarModalEdicao(false);
                    setCarrinhoEditando(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                  disabled={salvandoEdicao}
                >
                  ×
                </button>
              </div>

              {/* Info do usuário */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 mb-1">Funcionário:</p>
                <p className="font-bold text-gray-800">{carrinhoEditando.usuario?.nome}</p>
                <p className="text-sm text-gray-600 mt-2">Data:</p>
                <p className="font-semibold text-gray-700">
                  {new Date(carrinhoEditando.data).toLocaleDateString('pt-BR')}
                </p>
              </div>

              {/* Formulário */}
              <form onSubmit={handleSalvarEdicao}>
                <div className="mb-6">
                  <label className="block text-gray-700 font-semibold mb-2">
                    Quantidade inicial *
                  </label>
                  <input
                    type="number"
                    value={dadosEdicao.quantidadeInicial}
                    onChange={(e) => setDadosEdicao(prev => ({
                      ...prev,
                      quantidadeInicial: e.target.value
                    }))}
                    min="0"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-lg font-semibold text-center"
                    disabled={salvandoEdicao}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Quantidade total de produtos no início do dia
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-gray-700 font-semibold mb-2">
                    Quantidade atual *
                  </label>
                  <input
                    type="number"
                    value={dadosEdicao.quantidadeAtual}
                    onChange={(e) => setDadosEdicao(prev => ({
                      ...prev,
                      quantidadeAtual: e.target.value
                    }))}
                    min="0"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-lg font-semibold text-center"
                    disabled={salvandoEdicao}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Quantidade restante no carrinho agora
                  </p>
                </div>

                <div className="mb-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dadosEdicao.ativo}
                      onChange={(e) => setDadosEdicao(prev => ({
                        ...prev,
                        ativo: e.target.checked
                      }))}
                      className="w-5 h-5 text-primary focus:ring-2 focus:ring-primary rounded"
                      disabled={salvandoEdicao}
                    />
                    <span className="text-gray-700 font-semibold">
                      Carrinho ativo
                    </span>
                  </label>
                  <p className="text-sm text-gray-500 mt-1 ml-8">
                    Desmarque para desativar o carrinho manualmente
                  </p>
                </div>

                {/* Informações calculadas */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Resumo:</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-600">
                      Usado: <strong>{dadosEdicao.quantidadeInicial - dadosEdicao.quantidadeAtual}</strong> unidades
                    </p>
                    <p className="text-gray-600">
                      Percentual: <strong>
                        {dadosEdicao.quantidadeInicial > 0 
                          ? ((dadosEdicao.quantidadeInicial - dadosEdicao.quantidadeAtual) / dadosEdicao.quantidadeInicial * 100).toFixed(1)
                          : 0
                        }%
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarModalEdicao(false);
                      setCarrinhoEditando(null);
                    }}
                    className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={salvandoEdicao}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 bg-green-500 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={salvandoEdicao}
                  >
                    {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Devolução por Admin */}
      {mostrarModalDevolucao && carrinhoParaDevolver && (
        <DevolucaoAdminModal
          carrinho={carrinhoParaDevolver}
          onClose={handleFecharModalDevolucao}
          onSuccess={handleSucessoDevolucao}
        />
      )}

      <Footer />
    </div>
  );
}

export default GestaoCarrinhos;
