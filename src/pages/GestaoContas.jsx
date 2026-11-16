import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import { ToastProvider } from "../components/gestaoContas/ui";
import { gc } from "../components/gestaoContas/utils";
import ResumoPanel from "../components/gestaoContas/ResumoPanel";
import ContasPanel from "../components/gestaoContas/ContasPanel";
import BancosPanel from "../components/gestaoContas/BancosPanel";
import FluxoCaixaPanel from "../components/gestaoContas/FluxoCaixaPanel";

// Financeiro → Gestão de Contas: controle de contas da empresa (a pagar, a receber,
// contas bancárias e fluxo de caixa), no mesmo modelo do financeiro da Reblind.

const ABAS = [
  ["resumo", "📊 Resumo"],
  ["pagar", "📤 Contas a pagar"],
  ["receber", "📥 Contas a receber"],
  ["bancos", "🏦 Contas bancárias"],
  ["fluxo", "💵 Fluxo de caixa"],
];

/** Bolinha na aba: vermelha piscando com conta vencida, laranja com conta vencendo em breve. */
function Bolinha({ estado }) {
  if (!estado) return null;
  const label = estado === "vencida" ? "Há contas vencidas" : "Há contas vencendo em breve";
  return <span role="img" aria-label={label} title={label} className={`inline-block size-2.5 rounded-full ${estado === "vencida" ? "animate-pulse bg-red-600" : "bg-orange-500"}`} />;
}

function estadoAlerta(a) {
  if (!a) return null;
  if (a.vencidas.count > 0) return "vencida";
  return a.emBreve.count > 0 ? "embreve" : null;
}

function lerAba() {
  try {
    const salva = sessionStorage.getItem("gestaoContas.aba");
    return ABAS.some(([k]) => k === salva) ? salva : "resumo";
  } catch {
    return "resumo";
  }
}

export function GestaoContas() {
  const [aba, setAba] = useState(lerAba);
  const [classificacoes, setClassificacoes] = useState(null);
  const [bancos, setBancos] = useState([]);
  const [alertas, setAlertas] = useState(null);
  const [versao, setVersao] = useState(0);

  // Sugestões, contas bancárias e alertas de vencimento — de novo a cada 5 min e a cada alteração.
  useEffect(() => {
    let vivo = true;
    const buscar = () =>
      Promise.allSettled([gc.classificacoes(), gc.bancos(), gc.alertas()]).then(([cls, bcs, al]) => {
        if (!vivo) return;
        if (cls.status === "fulfilled") setClassificacoes(cls.value);
        if (bcs.status === "fulfilled") setBancos(bcs.value.contas);
        if (al.status === "fulfilled") setAlertas(al.value);
      });
    buscar();
    const id = setInterval(buscar, 5 * 60 * 1000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [versao]);

  function trocarAba(chave) {
    setAba(chave);
    try {
      sessionStorage.setItem("gestaoContas.aba", chave);
    } catch {
      /* sem storage: só não lembra a aba */
    }
  }

  // Algo mudou numa aba: atualiza sugestões, saldos e alertas (e o resumo, se voltar a ele).
  function alterado() {
    setVersao((v) => v + 1);
  }

  const bolinhas = { pagar: estadoAlerta(alertas?.PAGAR), receber: estadoAlerta(alertas?.RECEBER) };
  const props = { classificacoes, bancos, onAlterado: alterado };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
        <Navbar />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeader
            title="Gestão de Contas"
            subtitle="Contas a pagar e a receber, contas bancárias, fluxo de caixa e análises da empresa"
            icon="📒"
            action={
              <Link to="/financeiro" className="btn-secondary inline-block">
                ← Voltar ao Financeiro
              </Link>
            }
          />

          <div className="mb-6 flex flex-wrap gap-1 border-b border-gray-200">
            {ABAS.map(([chave, label]) => (
              <button
                key={chave}
                type="button"
                onClick={() => trocarAba(chave)}
                className={`-mb-px rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${
                  aba === chave ? "border-b-2 border-[#2457B1] bg-white text-[#2457B1]" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {label}
                  <Bolinha estado={bolinhas[chave]} />
                </span>
              </button>
            ))}
          </div>

          {aba === "resumo" && <ResumoPanel {...props} irPara={trocarAba} versao={versao} />}
          {aba === "pagar" && <ContasPanel key="PAGAR" tipo="PAGAR" {...props} />}
          {aba === "receber" && <ContasPanel key="RECEBER" tipo="RECEBER" {...props} />}
          {aba === "bancos" && <BancosPanel onAlterado={alterado} />}
          {aba === "fluxo" && <FluxoCaixaPanel {...props} />}
        </div>
        <Footer />
      </div>
    </ToastProvider>
  );
}
