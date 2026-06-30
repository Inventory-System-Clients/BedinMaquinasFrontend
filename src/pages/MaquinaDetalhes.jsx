import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox, Badge } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

export function MaquinaDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [maquina, setMaquina] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    carregarMaquina();
  }, [id]);

  const carregarMaquina = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/maquinas/${id}`);
      setMaquina(response.data);
    } catch (error) {
      setError("Erro ao carregar máquina: " + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const gerarPDF = () => {
    if (!maquina) return;

    const vendaDinheiro = parseFloat(maquina.vendaDinheiro) || 0;
    const vendaCartao = parseFloat(maquina.vendaCartao) || 0;
    const comissao = parseFloat(maquina.comissao) || 0;
    const liquido = parseFloat(maquina.liquido) || 0;
    const totalVendido = parseFloat(maquina.totalVendido) || 0;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Relatório de Vendas - ${maquina.nome}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
          }
          
          .header {
            background: linear-gradient(to right, #C91F24, #2457B1);
            color: white;
            padding: 40px;
            text-align: center;
          }
          
          .header h1 {
            font-size: 32px;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
          }
          
          .header p {
            font-size: 18px;
            opacity: 0.9;
          }
          
          .info-section {
            padding: 30px 40px;
            border-bottom: 2px solid #f0f0f0;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-top: 20px;
          }
          
          .info-item {
            padding: 15px;
            background: #f8f9fa;
            border-radius: 10px;
            border-left: 4px solid #2457B1;
          }
          
          .info-item label {
            display: block;
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
          }
          
          .info-item value {
            display: block;
            font-size: 16px;
            font-weight: bold;
            color: #333;
          }
          
          .vendas-section {
            padding: 30px 40px;
          }
          
          .vendas-section h2 {
            font-size: 24px;
            color: #333;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .vendas-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }
          
          .venda-card {
            padding: 20px;
            border-radius: 15px;
            text-align: center;
            color: white;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          }
          
          .venda-card.dinheiro {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          }
          
          .venda-card.cartao {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          }
          
          .venda-card.comissao {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
          }
          
          .venda-card.liquido {
            background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
          }
          
          .venda-card.total {
            background: linear-gradient(135deg, #C91F24 0%, #2457B1 100%);
            grid-column: 1 / -1;
            font-size: 1.2em;
          }
          
          .venda-card label {
            display: block;
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .venda-card .valor {
            font-size: 32px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
          }
          
          .footer {
            padding: 30px 40px;
            background: #f8f9fa;
            text-align: center;
            color: #666;
            font-size: 14px;
          }
          
          .footer p {
            margin: 5px 0;
          }
          
          @media print {
            body {
              background: white;
              padding: 0;
            }
            
            .container {
              box-shadow: none;
              max-width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Relatório de Vendas e Comissão</h1>
            <p>Máquina: ${maquina.nome}</p>
          </div>
          
          <div class="info-section">
            <h2 style="color: #333; margin-bottom: 15px;">Informações da Máquina</h2>
            <div class="info-grid">
              <div class="info-item">
                <label>Código</label>
                <value>${maquina.codigo}</value>
              </div>
              <div class="info-item">
                <label>Tipo</label>
                <value>${maquina.tipo}</value>
              </div>
              <div class="info-item">
                <label>Loja</label>
                <value>${maquina.loja?.nome || 'N/A'}</value>
              </div>
              <div class="info-item">
                <label>Localização</label>
                <value>${maquina.localizacao || 'Não especificada'}</value>
              </div>
            </div>
          </div>
          
          <div class="vendas-section">
            <h2>💰 Dados Financeiros</h2>
            <div class="vendas-grid">
              <div class="venda-card dinheiro">
                <label>💵 Venda em Dinheiro</label>
                <div class="valor">R$ ${vendaDinheiro.toFixed(2)}</div>
              </div>
              
              <div class="venda-card cartao">
                <label>💳 Venda em Cartão</label>
                <div class="valor">R$ ${vendaCartao.toFixed(2)}</div>
              </div>
              
              <div class="venda-card comissao">
                <label>📊 Comissão</label>
                <div class="valor">R$ ${comissao.toFixed(2)}</div>
              </div>
              
              <div class="venda-card liquido">
                <label>💰 Valor Líquido</label>
                <div class="valor">R$ ${liquido.toFixed(2)}</div>
              </div>
              
              <div class="venda-card total">
                <label>🎯 Total Vendido</label>
                <div class="valor">R$ ${totalVendido.toFixed(2)}</div>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Relatório gerado automaticamente pelo Sistema Bedin Máquinas</strong></p>
            <p>Data: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Detectar se é mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    if (isMobile) {
      // Mobile: Mostrar alerta e opção de imprimir
      Swal.fire({
        title: 'Relatório Gerado',
        html: '<p>Relatório de vendas e comissão gerado! Clique em Imprimir para visualizar.</p>',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: '🖨️ Imprimir',
        cancelButtonText: 'Fechar',
        confirmButtonColor: '#1e40af'
      }).then((result) => {
        if (result.isConfirmed) {
          const blob = new Blob([htmlContent], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const printWindow = window.open(url, '_blank');
          if (printWindow) {
            printWindow.onload = () => {
              setTimeout(() => {
                printWindow.print();
                URL.revokeObjectURL(url);
              }, 500);
            };
          } else {
            Swal.fire('Pop-up Bloqueado', 'Permita pop-ups para imprimir.', 'warning');
          }
        }
      });
    } else {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      } else {
        Swal.fire('Pop-up Bloqueado', 'Permita pop-ups para visualizar.', 'warning');
      }
    }
  };

  if (loading) return <PageLoader />;
  if (!maquina) return <div>Máquina não encontrada</div>;

  const vendaDinheiro = parseFloat(maquina.vendaDinheiro) || 0;
  const vendaCartao = parseFloat(maquina.vendaCartao) || 0;
  const comissao = parseFloat(maquina.comissao) || 0;
  const liquido = parseFloat(maquina.liquido) || 0;
  const totalVendido = parseFloat(maquina.totalVendido) || 0;

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={`Detalhes da Máquina: ${maquina.nome}`}
          subtitle={`Código: ${maquina.codigo} | Tipo: ${maquina.tipo}`}
          icon="🎮"
        />

        {error && <AlertBox type="error" message={error} onClose={() => setError("")} />}

        {/* Botões de Ação */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => navigate(`/maquinas/${id}/editar`)}
            className="btn-primary"
          >
            ✏️ Editar Máquina
          </button>
          <button
            onClick={gerarPDF}
            className="btn-success"
          >
            📄 Gerar PDF de Vendas
          </button>
          <button
            onClick={() => navigate("/maquinas")}
            className="btn-secondary"
          >
            ← Voltar
          </button>
        </div>

        {/* Informações Básicas */}
        <div className="card mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Informações da Máquina</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Loja</label>
              <p className="text-lg text-gray-900">{maquina.loja?.nome || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Localização</label>
              <p className="text-lg text-gray-900">{maquina.localizacao || 'Não especificada'}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
              <Badge type={maquina.ativo ? "success" : "danger"}>
                {maquina.ativo ? "Ativa" : "Inativa"}
              </Badge>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Estoque Atual</label>
              <p className="text-lg text-gray-900">{maquina.estoqueAtual || 0} unidades</p>
            </div>
          </div>
        </div>

        {/* Dados de Vendas */}
        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">💰 Dados de Vendas e Comissão</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="card bg-linear-to-br from-green-50 to-green-100 border-2 border-green-500">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-green-700">💵 Venda em Dinheiro</h3>
              </div>
              <p className="text-3xl font-bold text-green-900">R$ {vendaDinheiro.toFixed(2)}</p>
            </div>

            <div className="card bg-linear-to-br from-blue-50 to-blue-100 border-2 border-blue-500">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-blue-700">💳 Venda em Cartão</h3>
              </div>
              <p className="text-3xl font-bold text-blue-900">R$ {vendaCartao.toFixed(2)}</p>
            </div>

            <div className="card bg-linear-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-500">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-yellow-700">📊 Comissão</h3>
              </div>
              <p className="text-3xl font-bold text-yellow-900">R$ {comissao.toFixed(2)}</p>
            </div>

            <div className="card bg-linear-to-br from-purple-50 to-purple-100 border-2 border-purple-500">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-purple-700">💰 Valor Líquido</h3>
              </div>
              <p className="text-3xl font-bold text-purple-900">R$ {liquido.toFixed(2)}</p>
            </div>

            <div className="card bg-linear-to-br from-red-50 to-red-100 border-2 border-red-500 md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-red-700">🎯 Total Vendido</h3>
              </div>
              <p className="text-4xl font-bold text-red-900">R$ {totalVendido.toFixed(2)}</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={gerarPDF}
              className="w-full btn-primary text-lg py-4"
            >
              📄 Gerar Relatório em PDF
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
