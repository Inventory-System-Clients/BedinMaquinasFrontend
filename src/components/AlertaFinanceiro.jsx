import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";


export function AlertaFinanceiro() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [valorAReceber, setValorAReceber] = useState(0);
  const [mostrar, setMostrar] = useState(true);

  const verificarPendentes = async () => {
    try {
      const [movsRes, areceberRes] = await Promise.all([
        api.get("/movimentacoes/pendentes-financeiro"),
        api.get("/roteiros/financeiro/areceber"),
      ]);
      // Calcular o valor total a receber das lojas (valorTotal - comissao)
      const lojas = areceberRes.data || [];
      let totalAReceber = 0;
      lojas.forEach((item) => {
        // Ajuste: garantir que os campos corretos sejam usados
        // Se vierem como valorTotal e comissao, usa direto
        // Se vierem como totalLucro e totalComissao, usa esses
        const valorTotal = item.valorTotal ?? item.totalLucro ?? 0;
        const comissao = item.comissao ?? item.totalComissao ?? 0;
        totalAReceber += (valorTotal - comissao);
      });
      setValorAReceber(totalAReceber);
    } catch (error) {
      console.error("Erro ao verificar pendentes financeiro:", error);
    }
  };

  useEffect(() => {
    // Apenas para usuários FINANCEIRO ou ADMIN
    if (usuario?.role === "FINANCEIRO" || usuario?.role === "ADMIN") {
      verificarPendentes();
      
      // Atualizar a cada 5 minutos
      const interval = setInterval(verificarPendentes, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [usuario]);

  // Não mostrar se não for FINANCEIRO/ADMIN ou se não houver pendentes

  if (!usuario || (usuario.role !== "FINANCEIRO" && usuario.role !== "ADMIN")) {
    return null;
  }

  if ((valorAReceber === 0 && valorAReceber !== undefined) || !mostrar) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md transition-all duration-300 ease-in-out transform translate-y-0">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg shadow-2xl p-4 border-2 border-amber-300 animate-bounce">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-2xl animate-pulse">💰</span>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg">Atenção Financeiro!</h3>
              <p className="text-sm opacity-90">
                Valor a receber: <span className="font-bold">R$ {valorAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </p>
              <p className="text-xs opacity-75 mt-1">
                Valor total das lojas pendentes menos comissão
              </p>
            </div>
          </div>
          <button
            onClick={() => setMostrar(false)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex space-x-2">
          <button
            onClick={() => {
              navigate("/financeiro");
              setMostrar(false);
            }}
            className="flex-1 bg-white text-amber-600 px-4 py-2 rounded-lg font-semibold hover:bg-amber-50 transition-colors text-sm"
          >
            Ir para Financeiro
          </button>
          <button
            onClick={() => setMostrar(false)}
            className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors text-sm"
          >
            Depois
          </button>
        </div>
      </div>
    </div>
  );
}
