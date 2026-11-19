import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";

// Tela de Movimentações no formato da AgarraMais: escolhe a loja, aparecem as
// máquinas dela com uma barrinha de andamento, e cada máquina guarda o que já
// foi digitado (rascunho) — dá para ir fazendo várias ao mesmo tempo, etapa
// por etapa, e registrar cada uma quando estiver completa.
//
// Versão simplificada do Bedin: sem controle de estoque. O operador informa só
// o produto, os contadores IN/OUT, quanto abasteceu, quanto retirou de
// dinheiro e os gastos extras; o que entrou na Machine Pay é somado sozinho
// (da última movimentação até agora, ou a partir da data que ele escolher).

const CHAVE_RASCUNHOS = "rascunhosMovimentacaoBedin";
// Conta a partir da última alteração na máquina.
const VALIDADE_RASCUNHO_MS = 3 * 60 * 60 * 1000;
// Uma máquina conta como "concluída" na lista se teve movimentação nessa janela.
const HORAS_MAQUINA_CONCLUIDA = 12;
// Salto grande no contador costuma ser erro de leitura/digitação.
const LIMITE_DIFERENCA_CONTADOR_IN = 300;
const LIMITE_DIFERENCA_CONTADOR_OUT = 40;

const FORMULARIO_VAZIO = {
  maquina_id: "",
  produto_id: "",
  contadorIn: "",
  contadorOut: "",
  quantidadeAdicionada: "",
  dinheiroRetirado: "",
  // Vazio = desde a última movimentação. Preenchido = o operador escolheu.
  machinePayInicio: "",
  gastos: [],
  observacao: "",
};
const CAMPOS_RASCUNHO = Object.keys(FORMULARIO_VAZIO).filter(
  (c) => c !== "maquina_id",
);

const campoPreenchido = (valor) =>
  valor !== "" && valor !== null && valor !== undefined;

const numero = (valor) => {
  if (!campoPreenchido(valor)) return 0;
  const n = Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const formatarReais = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatarDataHora = (valor) =>
  valor
    ? new Date(valor).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

// Data no formato do <input type="datetime-local"> (YYYY-MM-DDTHH:mm, hora local).
const paraInputDataHora = (valor) => {
  const data = valor ? new Date(valor) : new Date();
  if (Number.isNaN(data.getTime())) return "";
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const gastosValidos = (gastos = []) =>
  gastos.filter((g) => String(g.descricao || "").trim() && numero(g.valor) > 0);

const gastosIncompletos = (gastos = []) =>
  gastos.filter(
    (g) =>
      (String(g.descricao || "").trim() || campoPreenchido(g.valor)) &&
      !(String(g.descricao || "").trim() && numero(g.valor) > 0),
  );

// --- Rascunhos (ficam no aparelho: no celular o WhatsApp sai da página) ---
const lerRascunhos = () => {
  try {
    const salvos = JSON.parse(localStorage.getItem(CHAVE_RASCUNHOS) || "{}");
    const agora = Date.now();
    return Object.fromEntries(
      Object.entries(salvos).filter(
        ([, r]) => r && agora - r.atualizadoEm < VALIDADE_RASCUNHO_MS,
      ),
    );
  } catch {
    return {};
  }
};

const gravarRascunhos = (rascunhos) => {
  try {
    localStorage.setItem(CHAVE_RASCUNHOS, JSON.stringify(rascunhos));
  } catch {
    // Sem localStorage (aba anônima etc.) o rascunho vale só até recarregar.
  }
};

// O produto vem sugerido sozinho ao abrir a máquina, então não conta pra
// dizer que a pessoa começou a preencher.
const rascunhoTemDados = (campos = {}) =>
  [
    "contadorIn",
    "contadorOut",
    "quantidadeAdicionada",
    "dinheiroRetirado",
    "machinePayInicio",
    "observacao",
  ].some((c) => campoPreenchido(campos[c])) ||
  (campos.gastos || []).some(
    (g) => String(g.descricao || "").trim() || campoPreenchido(g.valor),
  );

const progressoRascunho = (campos = {}) => {
  const itens = [
    { label: "Produto", ok: !!campos.produto_id },
    { label: "Contador IN", ok: campoPreenchido(campos.contadorIn) },
    { label: "Contador OUT", ok: campoPreenchido(campos.contadorOut) },
    { label: "Abastecido", ok: campoPreenchido(campos.quantidadeAdicionada) },
    { label: "Dinheiro retirado", ok: campoPreenchido(campos.dinheiroRetirado) },
  ];
  const feitos = itens.filter((i) => i.ok).length;
  return {
    feitos,
    total: itens.length,
    faltando: itens.filter((i) => !i.ok).map((i) => i.label),
  };
};

// --- WhatsApp ---
// Em celular navega a própria aba (aba aberta "em branco" fica presa em
// about:blank em vários Android). Em desktop abre a aba já no clique, senão o
// navegador bloqueia (o envio só acontece depois de chamar a API).
const ehDispositivoMovel = () =>
  /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

function abrirJanelaWhatsapp() {
  if (ehDispositivoMovel()) return null;
  try {
    return window.open("", "_blank");
  } catch {
    return null;
  }
}

function navegarParaWhatsapp(janelaPreAberta, url) {
  if (ehDispositivoMovel()) {
    if (janelaPreAberta && !janelaPreAberta.closed) janelaPreAberta.close();
    window.location.href = url;
    return;
  }
  if (janelaPreAberta && !janelaPreAberta.closed) {
    janelaPreAberta.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// api.whatsapp.com/send e não wa.me: o redirecionamento do wa.me troca os
// emojis da mensagem por "�".
const urlWhatsapp = (mensagem) =>
  `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;

async function compartilharOuAbrir({ mensagem, foto, janela, onAvisoFoto }) {
  if (
    foto &&
    navigator.canShare &&
    navigator.share &&
    navigator.canShare({ files: [foto] })
  ) {
    try {
      await navigator.share({
        title: "Movimentação de Máquina",
        text: mensagem,
        files: [foto],
      });
      if (janela && !janela.closed) janela.close();
      return;
    } catch (err) {
      if (err?.name === "AbortError") {
        if (janela && !janela.closed) janela.close();
        return;
      }
      console.error("Erro ao compartilhar foto no WhatsApp:", err);
    }
  }
  if (foto) onAvisoFoto?.();
  navegarParaWhatsapp(janela, urlWhatsapp(mensagem));
}

// Status das máquinas de uma loja (quando cada uma foi concluída, quantas
// manutenções pendentes tem) e as últimas movimentações da loja.
async function buscarDadosLoja(lojaId) {
  const desde = new Date(
    Date.now() - HORAS_MAQUINA_CONCLUIDA * 60 * 60 * 1000,
  ).toISOString();
  const [recentesRes, manutRes, historicoRes] = await Promise.allSettled([
    api.get("/movimentacoes", {
      params: { lojaId, dataInicio: desde, limite: 500 },
    }),
    api.get("/manutencoes"),
    api.get("/movimentacoes", { params: { lojaId, limite: 30 } }),
  ]);

  const concluidas = {};
  if (recentesRes.status === "fulfilled") {
    for (const mov of recentesRes.value.data || []) {
      const data = new Date(mov.dataColeta || mov.createdAt);
      if (!concluidas[mov.maquinaId] || data > concluidas[mov.maquinaId]) {
        concluidas[mov.maquinaId] = data;
      }
    }
  }

  const manutencoes = {};
  if (manutRes.status === "fulfilled" && Array.isArray(manutRes.value.data)) {
    for (const manut of manutRes.value.data) {
      if (!manut.maquinaId || String(manut.lojaId) !== String(lojaId)) continue;
      if (String(manut.status || "").toLowerCase() !== "pendente") continue;
      manutencoes[manut.maquinaId] = (manutencoes[manut.maquinaId] || 0) + 1;
    }
  }

  const historico =
    historicoRes.status === "fulfilled" ? historicoRes.value.data || [] : [];

  return { lojaId, concluidas, manutencoes, historico };
}

function BarraProgresso({ feitos, total, className = "" }) {
  const completo = feitos === total;
  return (
    <div
      className={`h-1.5 rounded-full bg-slate-200 overflow-hidden ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all ${completo ? "bg-emerald-500" : "bg-amber-400"}`}
        style={{ width: `${total ? (feitos / total) * 100 : 0}%` }}
      />
    </div>
  );
}

function CampoNumero({
  label,
  name,
  value,
  onChange,
  placeholder,
  ajuda,
  prefixo,
  step = "1",
}) {
  return (
    <div>
      <label
        htmlFor={`campo-${name}`}
        className="block text-sm font-semibold text-gray-700 mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        {prefixo && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
            {prefixo}
          </span>
        )}
        <input
          id={`campo-${name}`}
          type="number"
          inputMode={step === "1" ? "numeric" : "decimal"}
          name={name}
          value={value}
          onChange={onChange}
          min="0"
          step={step}
          placeholder={placeholder}
          className={`input-field ${prefixo ? "pl-10" : ""} ${campoPreenchido(value) ? "border-blue-500 bg-blue-50" : ""}`}
        />
      </div>
      {ajuda && <p className="text-xs text-gray-500 mt-1">{ajuda}</p>}
    </div>
  );
}

function LinhaResumo({ label, valor, forte, tom = "text-slate-800" }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${forte ? "border-t border-slate-200 pt-2 mt-1" : ""}`}
    >
      <span
        className={`text-sm ${forte ? "font-bold text-slate-900" : "text-slate-600"}`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${forte ? "text-lg font-bold" : "font-semibold"} ${tom}`}
      >
        {valor}
      </span>
    </div>
  );
}

export function Movimentacoes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useAuth();
  const ehAdmin = usuario?.role === "ADMIN";

  const [maquinas, setMaquinas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filtroLoja, setFiltroLoja] = useState("");
  const [dadosLoja, setDadosLoja] = useState(null);
  const [atualizacaoLoja, setAtualizacaoLoja] = useState(0);

  const [formData, setFormData] = useState(FORMULARIO_VAZIO);
  const [rascunhos, setRascunhos] = useState(lerRascunhos);
  // Resumo da máquina aberta (última movimentação + Machine Pay do período),
  // guardado pela chave "máquina|início".
  const [resumos, setResumos] = useState({});
  const [produtoSugeridoId, setProdutoSugeridoId] = useState({});
  const [confirmacaoContadores, setConfirmacaoContadores] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const envioEmAndamentoRef = useRef(false);
  const [alertaOrigem, setAlertaOrigem] = useState(null);
  const [excluindo, setExcluindo] = useState(null);

  // Foto dos contadores (lida pela IA). Por máquina, só em memória.
  const fotosRef = useRef({});
  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [lendoFoto, setLendoFoto] = useState(false);
  const [resultadoFoto, setResultadoFoto] = useState("");

  // "Nova movimentação" (Dashboard) chega com ?nova=true: rola até a escolha da loja.
  const escolhaLojaRef = useRef(null);
  const [rolarParaLoja] = useState(
    () => new URLSearchParams(location.search).get("nova") === "true",
  );

  // Vindo de um alerta (Manutenções → "Lançar movimentação"): abre a máquina
  // já preenchida.
  const [alertaInicial] = useState(() => {
    const state = location.state || {};
    const params = new URLSearchParams(location.search);
    const abrir =
      state.abrirFormulario === true ||
      params.get("abrirFormulario") === "true";
    return abrir && state.maquinaId ? state : null;
  });

  // --- Dados ---
  useEffect(() => {
    let cancelado = false;
    Promise.all([api.get("/maquinas"), api.get("/produtos"), api.get("/lojas")])
      .then(([maqRes, prodRes, lojasRes]) => {
        if (cancelado) return;
        const listaMaquinas = maqRes.data || [];
        setMaquinas(listaMaquinas);
        setProdutos((prodRes.data || []).filter((p) => p.ativo !== false));
        setLojas(lojasRes.data || []);

        if (alertaInicial) {
          const maquina = listaMaquinas.find(
            (m) => String(m.id) === String(alertaInicial.maquinaId),
          );
          if (maquina) {
            const texto = (v) =>
              v !== undefined && v !== null ? String(v) : "";
            setFiltroLoja(String(alertaInicial.lojaId || maquina.lojaId || ""));
            setFormData({
              ...FORMULARIO_VAZIO,
              maquina_id: String(maquina.id),
              produto_id: texto(alertaInicial.produtoId),
              contadorIn: texto(alertaInicial.contadorIn),
              contadorOut: texto(alertaInicial.contadorOut),
              quantidadeAdicionada: texto(alertaInicial.quantidadeAdicionada),
              observacao: texto(alertaInicial.observacao),
            });
            if (alertaInicial.alertaId) {
              setAlertaOrigem({
                id: alertaInicial.alertaId,
                maquinaId: String(maquina.id),
              });
            }
          }
          navigate(location.pathname, { replace: true, state: null });
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar dados:", err);
        if (!cancelado) setError("Erro ao carregar dados iniciais.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
    // Só na abertura da página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || !rolarParaLoja) return;
    const alvo = escolhaLojaRef.current;
    if (!alvo) return;
    alvo.scrollIntoView({ behavior: "smooth", block: "start" });
    alvo.querySelector("select")?.focus({ preventScroll: true });
  }, [loading, rolarParaLoja]);

  useEffect(() => {
    if (!filtroLoja) return;
    let cancelado = false;
    buscarDadosLoja(filtroLoja).then((dados) => {
      if (!cancelado) setDadosLoja(dados);
    });
    return () => {
      cancelado = true;
    };
  }, [filtroLoja, atualizacaoLoja]);

  const maquinaAberta = formData.maquina_id;
  const chaveResumo = maquinaAberta
    ? `${maquinaAberta}|${formData.machinePayInicio || ""}`
    : "";

  // Ao abrir a máquina (ou trocar o início da Machine Pay), busca a última
  // movimentação e quanto entrou na Machine Pay no período.
  useEffect(() => {
    if (!chaveResumo) return;
    const [maquinaId, inicioLocal] = chaveResumo.split("|");
    const inicioData = inicioLocal ? new Date(inicioLocal) : null;
    if (inicioData && Number.isNaN(inicioData.getTime())) return;
    let cancelado = false;
    const timer = setTimeout(
      () => {
        setResumos((prev) => ({
          ...prev,
          [chaveResumo]: { ...(prev[chaveResumo] || {}), carregando: true },
        }));
        api
          .get(`/movimentacoes/resumo-maquina/${maquinaId}`, {
            params: { inicio: inicioData ? inicioData.toISOString() : undefined },
          })
          .then((res) => {
            if (cancelado) return;
            setResumos((prev) => ({
              ...prev,
              [chaveResumo]: { dados: res.data },
            }));
          })
          .catch((err) => {
            if (cancelado) return;
            setResumos((prev) => ({
              ...prev,
              [chaveResumo]: {
                erro:
                  err.response?.data?.error ||
                  "Não foi possível buscar os dados da máquina.",
              },
            }));
          });
      },
      inicioLocal ? 600 : 0,
    );
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [chaveResumo]);

  // Produto da última visita vem pré-selecionado.
  useEffect(() => {
    if (!maquinaAberta) return;
    let cancelado = false;
    api
      .get(`/maquinas/${maquinaAberta}/produto-sugerido`)
      .then((res) => {
        const produtoId = res.data?.produtoSugerido?.id;
        if (cancelado || !produtoId) return;
        setProdutoSugeridoId((prev) => ({
          ...prev,
          [maquinaAberta]: String(produtoId),
        }));
        setFormData((prev) =>
          prev.maquina_id === maquinaAberta && !prev.produto_id
            ? { ...prev, produto_id: String(produtoId) }
            : prev,
        );
      })
      .catch(() => {
        // Sem sugestão: nada é pré-selecionado.
      });
    return () => {
      cancelado = true;
    };
  }, [maquinaAberta]);

  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  // --- Rascunhos ---
  const salvarRascunhos = (atualizar) => {
    setRascunhos((prev) => {
      const proximo = atualizar(prev);
      gravarRascunhos(proximo);
      return proximo;
    });
  };

  const guardarRascunho = (campos) => {
    const maquinaId = campos.maquina_id;
    if (!maquinaId) return;
    salvarRascunhos((prev) => {
      if (!rascunhoTemDados(campos)) {
        if (!prev[maquinaId]) return prev;
        const { [maquinaId]: _removido, ...resto } = prev;
        return resto;
      }
      const dados = Object.fromEntries(
        CAMPOS_RASCUNHO.map((c) => [c, campos[c]]),
      );
      return { ...prev, [maquinaId]: { ...dados, atualizadoEm: Date.now() } };
    });
  };

  const descartarRascunho = (maquinaId) => {
    if (!maquinaId) return;
    delete fotosRef.current[maquinaId];
    salvarRascunhos((prev) => {
      const { [maquinaId]: _removido, ...resto } = prev;
      return resto;
    });
  };

  const atualizarCampos = (patch) => {
    const proximo = { ...formData, ...patch };
    setFormData(proximo);
    guardarRascunho(proximo);
    if ("contadorIn" in patch || "contadorOut" in patch) {
      setConfirmacaoContadores(false);
    }
    if (error) setError("");
    if (success) setSuccess("");
  };

  const handleChange = (e) =>
    atualizarCampos({ [e.target.name]: e.target.value });

  // --- Foto dos contadores (IA) ---
  const trocarFoto = (arquivo, resultado = "") => {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFoto(arquivo);
    setFotoPreview(arquivo ? URL.createObjectURL(arquivo) : "");
    setResultadoFoto(resultado);
  };

  const prepararImagemParaEnvioIa = (file) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        const maxSize = 900;
        const escala = Math.min(
          1,
          maxSize / Math.max(image.width, image.height),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * escala));
        canvas.height = Math.max(1, Math.round(image.height * escala));
        canvas
          .getContext("2d")
          .drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/jpeg", 0.62));
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Não foi possível ler a imagem."));
      };
      image.src = objectUrl;
    });

  const handleFotoContadores = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setResultadoFoto("Selecione uma imagem válida.");
      return;
    }
    const maquinaDaFoto = formData.maquina_id;
    trocarFoto(file, "Lendo os contadores...");
    setLendoFoto(true);
    try {
      const dataUrl = await prepararImagemParaEnvioIa(file);
      const [meta, imagemBase64] = dataUrl.split(",");
      const mimeType = meta.match(/^data:(.*);base64$/)?.[1] || "image/jpeg";
      const response = await api.post("/assistente-ia/ler-contadores", {
        imagemBase64,
        mimeType,
      });
      const { contadorIn, contadorOut, confianca, observacao } =
        response.data || {};
      if (!contadorIn || !contadorOut || confianca === "baixa") {
        setResultadoFoto(
          observacao ||
            "A IA não teve certeza dos dois contadores. Preencha à mão ou tire outra foto mais perto e reta.",
        );
        return;
      }
      setFormData((prev) => {
        if (prev.maquina_id !== maquinaDaFoto) return prev;
        const proximo = {
          ...prev,
          contadorIn: String(contadorIn),
          contadorOut: String(contadorOut),
        };
        guardarRascunho(proximo);
        return proximo;
      });
      setConfirmacaoContadores(false);
      setResultadoFoto(
        `A IA leu: IN ${contadorIn} e OUT ${contadorOut}. Confira antes de registrar.`,
      );
    } catch (err) {
      const erroApi = err.response?.data?.message || err.response?.data?.error;
      setResultadoFoto(
        typeof erroApi === "string"
          ? erroApi
          : "Não foi possível ler a foto com IA. Preencha à mão ou tente de novo.",
      );
    } finally {
      setLendoFoto(false);
    }
  };

  // --- Abrir / fechar máquina ---
  const selecionarMaquina = (maquinaId) => {
    if (lendoFoto) return;
    const atual = formData.maquina_id;
    if (atual) {
      if (foto) fotosRef.current[atual] = { foto, resultado: resultadoFoto };
      else delete fotosRef.current[atual];
    }

    const abrindo = atual === maquinaId ? "" : maquinaId;
    const { atualizadoEm: _atualizadoEm, ...campos } =
      (abrindo && rascunhos[abrindo]) || {};
    const fotoSalva = abrindo ? fotosRef.current[abrindo] : null;
    trocarFoto(fotoSalva?.foto || null, fotoSalva?.resultado || "");
    setConfirmacaoContadores(false);
    setError("");
    setFormData({ ...FORMULARIO_VAZIO, ...campos, maquina_id: abrindo });

    if (abrindo) {
      setTimeout(() => {
        document
          .getElementById(`maquina-${abrindo}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  };

  const limparCamposMaquina = () => {
    trocarFoto(null);
    setFormData({ ...FORMULARIO_VAZIO, maquina_id: formData.maquina_id });
    setConfirmacaoContadores(false);
    descartarRascunho(formData.maquina_id);
  };

  // --- Gastos extras ---
  const adicionarGasto = () =>
    atualizarCampos({
      gastos: [...(formData.gastos || []), { descricao: "", valor: "" }],
    });
  const alterarGasto = (indice, campo, valor) =>
    atualizarCampos({
      gastos: formData.gastos.map((g, i) =>
        i === indice ? { ...g, [campo]: valor } : g,
      ),
    });
  const removerGasto = (indice) =>
    atualizarCampos({
      gastos: formData.gastos.filter((_, i) => i !== indice),
    });

  if (loading) return <PageLoader />;

  // --- Derivados ---
  const lojasAtivas = lojas.filter((l) => l.ativo !== false);
  const lojaSelecionada = lojas.find(
    (l) => String(l.id) === String(filtroLoja),
  );
  const maquinasDaLoja = filtroLoja
    ? maquinas.filter(
        (m) => String(m.lojaId) === String(filtroLoja) && m.ativo !== false,
      )
    : [];
  const dadosDaLojaAtual =
    dadosLoja && String(dadosLoja.lojaId) === String(filtroLoja)
      ? dadosLoja
      : null;
  const concluidas = dadosDaLojaAtual?.concluidas || {};
  const manutencoes = dadosDaLojaAtual?.manutencoes || {};
  const historico = dadosDaLojaAtual?.historico || [];
  const maquinasConcluidas = maquinasDaLoja.filter(
    (m) => concluidas[m.id],
  ).length;
  const maquinasEmAndamento = maquinasDaLoja.filter(
    (m) => rascunhos[m.id],
  ).length;

  const maquinaSelecionada = maquinas.find(
    (m) => String(m.id) === String(maquinaAberta),
  );
  const produtoSelecionado = produtos.find(
    (p) => String(p.id) === String(formData.produto_id),
  );
  const resumo = chaveResumo ? resumos[chaveResumo] : null;
  const ultimaMov = resumo?.dados?.ultimaMovimentacao || null;
  const machinePay = resumo?.dados?.machinePay || null;
  const machinePayConfigurada = machinePay
    ? machinePay.configurada
    : Boolean(maquinaSelecionada?.machinePayPosId);

  const inAtual = parseInt(formData.contadorIn);
  const outAtual = parseInt(formData.contadorOut);
  const difIn =
    !Number.isNaN(inAtual) && typeof ultimaMov?.contadorIn === "number"
      ? inAtual - ultimaMov.contadorIn
      : null;
  const difOut =
    !Number.isNaN(outAtual) && typeof ultimaMov?.contadorOut === "number"
      ? outAtual - ultimaMov.contadorOut
      : null;
  const avisosContadores = [
    difIn !== null &&
      difIn < 0 &&
      `Contador IN (${inAtual}) menor que o da última movimentação (${ultimaMov.contadorIn})`,
    difOut !== null &&
      difOut < 0 &&
      `Contador OUT (${outAtual}) menor que o da última movimentação (${ultimaMov.contadorOut})`,
    difIn !== null &&
      difIn > LIMITE_DIFERENCA_CONTADOR_IN &&
      `Contador IN subiu ${difIn} desde a última movimentação — confira se não trocou os contadores ou digitou um número a mais`,
    difOut !== null &&
      difOut > LIMITE_DIFERENCA_CONTADOR_OUT &&
      `Contador OUT subiu ${difOut} desde a última movimentação — confira se não trocou os contadores ou digitou um número a mais`,
  ].filter(Boolean);

  const dinheiro = numero(formData.dinheiroRetirado);
  const valorMachinePay =
    machinePay && machinePay.valor !== null && machinePay.valor !== undefined
      ? Number(machinePay.valor)
      : null;
  const gastosOk = gastosValidos(formData.gastos);
  const totalGastos = gastosOk.reduce((s, g) => s + numero(g.valor), 0);
  const liquido = dinheiro + (valorMachinePay || 0) - totalGastos;

  const progressoAberta = progressoRascunho(formData);
  const pendencias = [
    ...progressoAberta.faltando.map((f) => `preencher ${f}`),
    gastosIncompletos(formData.gastos).length > 0 &&
      "completar ou remover o gasto extra sem descrição ou valor",
    machinePayConfigurada &&
      machinePay?.precisaDataInicio &&
      "escolher desde quando somar a Machine Pay (a máquina ainda não tem movimentação)",
    machinePayConfigurada && !resumo?.dados && !resumo?.erro &&
      "aguardar o cálculo da Machine Pay",
    avisosContadores.length > 0 &&
      !confirmacaoContadores &&
      "confirmar os contadores",
  ].filter(Boolean);

  const montarMensagem = () => {
    const linhas = [
      "*Movimentação de Máquina*",
      "━━━━━━━━━━━━━━━━━━━━",
      `🏪 *Loja:* ${lojaSelecionada?.nome || "-"}`,
      `🎰 *Máquina:* ${maquinaSelecionada ? `${maquinaSelecionada.nome}${maquinaSelecionada.codigo ? ` - ${maquinaSelecionada.codigo}` : ""}` : "-"}`,
      `🧸 *Produto:* ${produtoSelecionado ? `${produtoSelecionado.emoji || ""} ${produtoSelecionado.nome}`.trim() : "-"}`,
      "",
      `🔢 *Contador IN:* ${formData.contadorIn || "0"}${difIn !== null && difIn >= 0 ? ` (+${difIn})` : ""}`,
      `🔢 *Contador OUT:* ${formData.contadorOut || "0"}${difOut !== null && difOut >= 0 ? ` (+${difOut})` : ""}`,
      `📦 *Abastecido:* ${numero(formData.quantidadeAdicionada)}`,
      "",
      `💵 *Dinheiro retirado:* ${formatarReais(dinheiro)}`,
    ];
    if (machinePayConfigurada) {
      linhas.push(
        `💳 *Machine Pay:* ${valorMachinePay === null ? "não consultado" : formatarReais(valorMachinePay)}${machinePay?.inicio ? ` (desde ${formatarDataHora(machinePay.inicio)})` : ""}`,
      );
    }
    if (gastosOk.length) {
      linhas.push("", "🧾 *Gastos extras:*");
      for (const g of gastosOk) {
        linhas.push(`   • ${g.descricao.trim()}: ${formatarReais(numero(g.valor))}`);
      }
    }
    linhas.push("", `✅ *Total líquido:* ${formatarReais(liquido)}`);
    if (formData.observacao?.trim()) {
      linhas.push("", `📝 *Observação:* ${formData.observacao.trim()}`);
    }
    if (foto) linhas.push("", "📷 Foto dos contadores anexada");
    return linhas.join("\n");
  };

  const abrirConfirmacao = (e) => {
    e.preventDefault();
    if (pendencias.length) {
      setError(`Antes de registrar: ${pendencias.join("; ")}.`);
      return;
    }
    setError("");
    setMostrarConfirmacao(true);
  };

  const registrar = async () => {
    if (envioEmAndamentoRef.current) return;
    // Aberta já no clique (senão o navegador bloqueia a aba do WhatsApp).
    const janela = abrirJanelaWhatsapp();
    let janelaUsada = false;
    envioEmAndamentoRef.current = true;
    setSalvando(true);
    setError("");
    setSuccess("");

    const maquinaId = formData.maquina_id;
    const abastecidas = Math.max(
      0,
      parseInt(formData.quantidadeAdicionada) || 0,
    );
    try {
      await api.post("/movimentacoes", {
        maquinaId,
        modoSimples: true,
        abastecidas,
        fichas: 0,
        contadorIn: Number.isNaN(inAtual) ? null : inAtual,
        contadorOut: Number.isNaN(outAtual) ? null : outAtual,
        valorEntradaNotas: dinheiro,
        ...(formData.machinePayInicio && {
          machinePayDataInicio: new Date(
            formData.machinePayInicio,
          ).toISOString(),
        }),
        gastosExtras: gastosOk.map((g) => ({
          descricao: g.descricao.trim(),
          valor: numero(g.valor),
        })),
        observacoes: formData.observacao?.trim() || null,
        produtos: [
          {
            produtoId: formData.produto_id,
            quantidadeSaiu: 0,
            quantidadeAbastecida: abastecidas,
            retiradaProduto: 0,
          },
        ],
      });

      if (
        alertaOrigem &&
        String(alertaOrigem.maquinaId) === String(maquinaId)
      ) {
        try {
          await api.patch(`/alertas-movimentacao/${alertaOrigem.id}/resolver`);
        } catch (erroAlerta) {
          console.error("Erro ao resolver alerta de origem:", erroAlerta);
        }
        setAlertaOrigem(null);
      }

      const mensagem = montarMensagem();

      const fotoEnvio = foto;
      const nomeMaquina = maquinaSelecionada?.nome || "máquina";
      descartarRascunho(maquinaId);
      trocarFoto(null);
      setFormData(FORMULARIO_VAZIO);
      setMostrarConfirmacao(false);
      setSuccess(
        `Movimentação de ${nomeMaquina} registrada${gastosOk.length ? ` (${gastosOk.length} gasto(s) extra(s) lançado(s) na Gestão de Contas como pagos)` : ""}.`,
      );
      setAtualizacaoLoja((n) => n + 1);

      janelaUsada = true;
      await compartilharOuAbrir({
        mensagem,
        foto: fotoEnvio,
        janela,
        onAvisoFoto: () =>
          setError(
            "Este navegador não anexa a foto sozinho. A mensagem foi aberta; anexe a foto na conversa.",
          ),
      });
    } catch (err) {
      console.error("Erro ao registrar movimentação:", err);
      setMostrarConfirmacao(false);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Erro ao registrar movimentação",
      );
    } finally {
      if (janela && !janelaUsada && !janela.closed) janela.close();
      envioEmAndamentoRef.current = false;
      setSalvando(false);
    }
  };

  const excluirMovimentacao = async () => {
    if (!excluindo) return;
    try {
      await api.delete(`/movimentacoes/${excluindo.id}`);
      setSuccess(
        "Movimentação excluída (os gastos extras dela saíram da Gestão de Contas).",
      );
      setAtualizacaoLoja((n) => n + 1);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao excluir movimentação");
    } finally {
      setExcluindo(null);
    }
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <PageHeader
            title="Movimentações"
            subtitle="Escolha a loja e vá registrando as máquinas"
            icon="🔄"
            action={null}
          />
        </div>

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && (
          <AlertBox
            type="success"
            message={success}
            onClose={() => setSuccess("")}
          />
        )}

        <div ref={escolhaLojaRef} className="card-gradient mb-6 scroll-mt-4">
          <label
            htmlFor="loja-atual"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            🏪 Loja atual
          </label>
          <select
            id="loja-atual"
            value={filtroLoja}
            onChange={(e) => {
              if (formData.maquina_id) selecionarMaquina(formData.maquina_id);
              setFiltroLoja(e.target.value);
            }}
            className="select-field text-base font-semibold"
          >
            <option value="">Em qual loja você está?</option>
            {lojasAtivas.map((loja) => (
              <option key={loja.id} value={loja.id}>
                {loja.nome}
              </option>
            ))}
          </select>

          {!filtroLoja ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/70 py-10 text-center">
              <div className="text-4xl mb-2">🏪</div>
              <p className="font-semibold text-slate-700">
                Escolha a loja para ver as máquinas
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Toque numa máquina para registrar. Dá para ir preenchendo
                várias ao mesmo tempo.
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex items-end justify-between gap-3 mb-2">
                <h3 className="text-lg font-bold text-gray-900">Máquinas</h3>
                <p className="text-sm font-semibold text-slate-600 tabular-nums">
                  {!dadosDaLojaAtual
                    ? "Atualizando..."
                    : `${maquinasConcluidas} de ${maquinasDaLoja.length} concluídas${maquinasEmAndamento ? ` · ${maquinasEmAndamento} em andamento` : ""}`}
                </p>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${maquinasDaLoja.length ? (maquinasConcluidas / maquinasDaLoja.length) * 100 : 0}%`,
                  }}
                />
              </div>

              {maquinasDaLoja.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">
                  Nenhuma máquina ativa cadastrada nesta loja.
                </p>
              )}

              <div className="space-y-2">
                {maquinasDaLoja.map((maquina) => {
                  const aberta = String(maquinaAberta) === String(maquina.id);
                  const concluidaEm = concluidas[maquina.id];
                  const manutencoesPendentes = manutencoes[maquina.id] || 0;
                  const rascunho = aberta ? formData : rascunhos[maquina.id];
                  const temRascunho = aberta
                    ? rascunhoTemDados(formData)
                    : !!rascunhos[maquina.id];
                  const progresso = progressoRascunho(rascunho);
                  const barraCheia = concluidaEm && !temRascunho;

                  return (
                    <div
                      key={maquina.id}
                      id={`maquina-${maquina.id}`}
                      className={`scroll-mt-4 rounded-2xl border overflow-hidden transition-shadow ${
                        aberta
                          ? "border-amber-400 bg-white shadow-lg"
                          : concluidaEm
                            ? "border-emerald-200 bg-emerald-50/60"
                            : "border-slate-200 bg-white hover:shadow-md"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selecionarMaquina(String(maquina.id))}
                        className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left"
                        aria-expanded={aberta}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <p
                              className={`font-bold truncate ${
                                barraCheia && !aberta
                                  ? "text-slate-500 line-through decoration-emerald-500/60"
                                  : "text-slate-900"
                              }`}
                            >
                              {maquina.nome}
                            </p>
                            {maquina.machinePayPosId && (
                              <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                💳 Machine Pay
                              </span>
                            )}
                          </div>
                          {maquina.codigo && maquina.codigo !== maquina.nome && (
                            <p className="text-xs text-slate-500 truncate">
                              {maquina.codigo}
                            </p>
                          )}
                          <div className="mt-1.5 flex items-center gap-2">
                            <BarraProgresso
                              feitos={barraCheia ? 1 : progresso.feitos}
                              total={barraCheia ? 1 : progresso.total}
                              className="flex-1 max-w-56"
                            />
                            <span
                              className={`shrink-0 text-xs font-semibold tabular-nums ${
                                barraCheia
                                  ? "text-emerald-700"
                                  : temRascunho
                                    ? "text-amber-700"
                                    : "text-slate-400"
                              }`}
                            >
                              {barraCheia
                                ? `✓ Concluída às ${concluidaEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                                : `${progresso.feitos}/${progresso.total}`}
                            </span>
                          </div>
                        </div>
                        {manutencoesPendentes > 0 && (
                          <span
                            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700"
                            title={`${manutencoesPendentes} manutenção(ões) pendente(s)`}
                          >
                            🔧 {manutencoesPendentes}
                          </span>
                        )}
                        <svg
                          className={`w-5 h-5 shrink-0 text-slate-400 transition-transform ${aberta ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {aberta && (
                        <form
                          onSubmit={abrirConfirmacao}
                          className="border-t border-slate-200 px-3 sm:px-4 py-4 space-y-4"
                        >
                          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-slate-700">
                                {progresso.faltando.length === 0
                                  ? "✅ Tudo preenchido, pode registrar"
                                  : `Falta: ${progresso.faltando.join(", ")}`}
                              </span>
                              <span className="shrink-0 text-slate-500 tabular-nums">
                                {progresso.feitos}/{progresso.total}
                                {temRascunho && " · 💾 salvo"}
                              </span>
                            </div>
                            <BarraProgresso
                              feitos={progresso.feitos}
                              total={progresso.total}
                              className="mt-1.5"
                            />
                          </div>

                          {concluidaEm && (
                            <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
                              ✓ Esta máquina já teve movimentação nas últimas{" "}
                              {HORAS_MAQUINA_CONCLUIDA}h. Registrar de novo cria
                              uma nova movimentação.
                            </p>
                          )}
                          {manutencoesPendentes > 0 && (
                            <p className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-800">
                              🔧 {manutencoesPendentes} manutenção(ões)
                              pendente(s) nesta máquina.{" "}
                              <button
                                type="button"
                                onClick={() => navigate("/manutencoes")}
                                className="font-semibold underline"
                              >
                                Ver manutenções
                              </button>
                            </p>
                          )}

                          <p className="text-xs text-slate-500">
                            {!resumo?.dados && !resumo?.erro
                              ? "Buscando a última movimentação..."
                              : ultimaMov
                                ? `Última movimentação: ${formatarDataHora(ultimaMov.dataColeta)} · IN ${ultimaMov.contadorIn ?? "-"} · OUT ${ultimaMov.contadorOut ?? "-"}`
                                : resumo?.dados
                                  ? "Primeira movimentação desta máquina."
                                  : ""}
                          </p>

                          {/* Produto */}
                          <div>
                            <label
                              htmlFor="campo-produto"
                              className="block text-sm font-semibold text-gray-700 mb-1.5"
                            >
                              Produto *
                            </label>
                            <select
                              id="campo-produto"
                              name="produto_id"
                              value={formData.produto_id}
                              onChange={handleChange}
                              className={`select-field ${formData.produto_id ? "border-blue-500 bg-blue-50" : ""}`}
                            >
                              <option value="">Escolha o produto</option>
                              {produtos.map((produto) => (
                                <option key={produto.id} value={produto.id}>
                                  {produto.emoji || "🧸"} {produto.nome}
                                </option>
                              ))}
                            </select>
                            {formData.produto_id &&
                              produtoSugeridoId[maquina.id] ===
                                String(formData.produto_id) && (
                                <p className="mt-1 text-[11px] text-blue-600">
                                  ✨ Produto sugerido com base na última visita
                                </p>
                              )}
                          </div>

                          {/* Foto dos contadores */}
                          <div className="p-3 bg-white border border-blue-100 rounded-xl">
                            <p className="text-sm font-semibold text-gray-700 mb-2">
                              Foto dos contadores (opcional)
                            </p>
                            <input
                              id={`foto-contadores-${maquina.id}`}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleFotoContadores}
                              className="sr-only"
                              disabled={lendoFoto}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <label
                                htmlFor={`foto-contadores-${maquina.id}`}
                                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-white shadow ${
                                  lendoFoto
                                    ? "cursor-not-allowed bg-gray-400"
                                    : "cursor-pointer bg-blue-600 hover:bg-blue-700"
                                }`}
                              >
                                <span aria-hidden="true">📷</span>
                                {lendoFoto
                                  ? "Lendo foto..."
                                  : foto
                                    ? "Tirar outra foto"
                                    : "Tirar foto e ler com IA"}
                              </label>
                              {foto && !lendoFoto && (
                                <button
                                  type="button"
                                  onClick={() => trocarFoto(null)}
                                  className="text-xs font-semibold text-slate-500 underline"
                                >
                                  Remover foto
                                </button>
                              )}
                            </div>
                            {fotoPreview && (
                              <img
                                src={fotoPreview}
                                alt="Foto dos contadores"
                                className="mt-3 max-h-48 rounded-lg border border-slate-200 object-contain"
                              />
                            )}
                            {resultadoFoto && (
                              <p className="mt-2 text-xs text-slate-600">
                                {resultadoFoto}
                              </p>
                            )}
                          </div>

                          {/* Contadores */}
                          <div className="grid grid-cols-2 gap-3">
                            <CampoNumero
                              label="Contador IN *"
                              name="contadorIn"
                              value={formData.contadorIn}
                              onChange={handleChange}
                              placeholder={
                                ultimaMov?.contadorIn != null
                                  ? `Último: ${ultimaMov.contadorIn}`
                                  : "Ex: 1250"
                              }
                              ajuda={
                                difIn !== null && difIn >= 0
                                  ? `+${difIn} desde a última`
                                  : null
                              }
                            />
                            <CampoNumero
                              label="Contador OUT *"
                              name="contadorOut"
                              value={formData.contadorOut}
                              onChange={handleChange}
                              placeholder={
                                ultimaMov?.contadorOut != null
                                  ? `Último: ${ultimaMov.contadorOut}`
                                  : "Ex: 310"
                              }
                              ajuda={
                                difOut !== null && difOut >= 0
                                  ? `${difOut} prêmio(s) saíram`
                                  : null
                              }
                            />
                          </div>

                          {avisosContadores.length > 0 && (
                            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 space-y-2">
                              {avisosContadores.map((aviso) => (
                                <p key={aviso} className="text-sm text-amber-900">
                                  ⚠️ {aviso}.
                                </p>
                              ))}
                              <label className="flex items-start gap-2 text-sm font-semibold text-amber-900">
                                <input
                                  type="checkbox"
                                  checked={confirmacaoContadores}
                                  onChange={(e) =>
                                    setConfirmacaoContadores(e.target.checked)
                                  }
                                  className="mt-0.5 h-4 w-4"
                                />
                                Conferi e os contadores estão certos
                              </label>
                            </div>
                          )}

                          <CampoNumero
                            label="Quanto abasteceu na máquina? *"
                            name="quantidadeAdicionada"
                            value={formData.quantidadeAdicionada}
                            onChange={handleChange}
                            placeholder="0"
                            ajuda="Quantidade de produtos colocados agora (0 se não abasteceu)."
                          />

                          {/* Dinheiro */}
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-3">
                            <p className="text-sm font-bold text-emerald-900">
                              💰 Dinheiro
                            </p>
                            <CampoNumero
                              label="Dinheiro retirado da máquina *"
                              name="dinheiroRetirado"
                              value={formData.dinheiroRetirado}
                              onChange={handleChange}
                              placeholder="0,00"
                              prefixo="R$"
                              step="0.01"
                              ajuda="Notas e moedas que você tirou agora (0 se não tirou)."
                            />

                            <div className="rounded-lg bg-white border border-emerald-100 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-gray-700">
                                    💳 Entrou na Machine Pay
                                  </p>
                                  {machinePayConfigurada && (
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      {machinePay?.inicio
                                        ? `De ${formatarDataHora(machinePay.inicio)} até agora`
                                        : machinePay?.precisaDataInicio
                                          ? "Escolha desde quando somar"
                                          : "Desde a última movimentação até agora"}
                                    </p>
                                  )}
                                </div>
                                <p className="text-lg font-bold tabular-nums text-blue-700">
                                  {!machinePayConfigurada
                                    ? "—"
                                    : resumo?.carregando
                                      ? "..."
                                      : valorMachinePay !== null
                                        ? formatarReais(valorMachinePay)
                                        : "—"}
                                </p>
                              </div>
                              {!machinePayConfigurada ? (
                                <p className="mt-1 text-xs text-slate-500">
                                  Esta máquina não tem Machine Pay configurada
                                  (cadastro da máquina).
                                </p>
                              ) : (
                                <>
                                  {(machinePay?.erro || resumo?.erro) && (
                                    <p className="mt-1 text-xs text-red-600">
                                      {machinePay?.erro || resumo.erro}
                                    </p>
                                  )}
                                  <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                                    <label
                                      htmlFor="campo-machine-pay-inicio"
                                      className="text-xs font-semibold text-slate-600 shrink-0"
                                    >
                                      Somar a partir de:
                                    </label>
                                    <input
                                      id="campo-machine-pay-inicio"
                                      type="datetime-local"
                                      name="machinePayInicio"
                                      value={
                                        formData.machinePayInicio ||
                                        (machinePay?.inicioPadrao
                                          ? paraInputDataHora(
                                              machinePay.inicioPadrao,
                                            )
                                          : "")
                                      }
                                      max={paraInputDataHora()}
                                      onChange={handleChange}
                                      className={`input-field text-sm ${
                                        formData.machinePayInicio ||
                                        machinePay?.precisaDataInicio
                                          ? "border-amber-500 bg-amber-50"
                                          : ""
                                      }`}
                                    />
                                    {formData.machinePayInicio &&
                                      machinePay?.inicioPadrao && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            atualizarCampos({
                                              machinePayInicio: "",
                                            })
                                          }
                                          className="text-xs font-semibold text-blue-600 whitespace-nowrap"
                                        >
                                          Voltar para a última movimentação
                                        </button>
                                      )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Gastos extras */}
                          <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-bold text-rose-900">
                                  🧾 Gastos extras
                                </p>
                                <p className="text-xs text-rose-800/80">
                                  Entram na Gestão de Contas como conta a pagar
                                  já paga.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={adicionarGasto}
                                className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-rose-700"
                              >
                                + Gasto
                              </button>
                            </div>
                            {(formData.gastos || []).length === 0 && (
                              <p className="text-xs text-slate-500">
                                Nenhum gasto extra nesta movimentação.
                              </p>
                            )}
                            {(formData.gastos || []).map((gasto, indice) => (
                              <div
                                key={indice}
                                className="grid grid-cols-[minmax(0,1fr)_7rem_auto] gap-2 items-center"
                              >
                                <input
                                  type="text"
                                  value={gasto.descricao}
                                  onChange={(e) =>
                                    alterarGasto(indice, "descricao", e.target.value)
                                  }
                                  placeholder="Ex: estacionamento, peça"
                                  aria-label={`Descrição do gasto ${indice + 1}`}
                                  className="input-field text-sm"
                                  maxLength={200}
                                />
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="0.01"
                                  value={gasto.valor}
                                  onChange={(e) =>
                                    alterarGasto(indice, "valor", e.target.value)
                                  }
                                  placeholder="R$ 0,00"
                                  aria-label={`Valor do gasto ${indice + 1}`}
                                  className="input-field text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => removerGasto(indice)}
                                  className="rounded-lg px-2 py-1 text-lg text-slate-400 hover:text-red-600"
                                  aria-label={`Remover gasto ${indice + 1}`}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>

                          <div>
                            <label
                              htmlFor="campo-observacao"
                              className="block text-sm font-semibold text-gray-700 mb-1.5"
                            >
                              Observação (opcional)
                            </label>
                            <textarea
                              id="campo-observacao"
                              name="observacao"
                              value={formData.observacao}
                              onChange={handleChange}
                              rows={2}
                              className="input-field"
                              placeholder="Algo que o escritório precise saber"
                            />
                          </div>

                          {/* Resumo */}
                          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5">
                            <LinhaResumo
                              label="Dinheiro retirado"
                              valor={formatarReais(dinheiro)}
                            />
                            {machinePayConfigurada && (
                              <LinhaResumo
                                label="Machine Pay"
                                valor={
                                  valorMachinePay !== null
                                    ? formatarReais(valorMachinePay)
                                    : "—"
                                }
                              />
                            )}
                            {totalGastos > 0 && (
                              <LinhaResumo
                                label="Gastos extras"
                                valor={`− ${formatarReais(totalGastos)}`}
                                tom="text-rose-700"
                              />
                            )}
                            <LinhaResumo
                              label="Total líquido"
                              valor={formatarReais(liquido)}
                              forte
                              tom={liquido < 0 ? "text-rose-700" : "text-emerald-700"}
                            />
                          </div>

                          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => selecionarMaquina(String(maquina.id))}
                                className="btn-secondary"
                              >
                                Fechar
                              </button>
                              {temRascunho && (
                                <button
                                  type="button"
                                  onClick={limparCamposMaquina}
                                  className="px-3 py-2 text-sm font-semibold text-slate-500 hover:text-red-600"
                                >
                                  Limpar
                                </button>
                              )}
                            </div>
                            <button
                              type="submit"
                              disabled={salvando || lendoFoto}
                              className="btn-primary disabled:opacity-60"
                            >
                              {salvando ? "Registrando..." : "Registrar movimentação"}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {filtroLoja && (
          <div className="card-gradient">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              Últimas movimentações
              {lojaSelecionada ? ` — ${lojaSelecionada.nome}` : ""}
            </h3>
            {!dadosDaLojaAtual ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : historico.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhuma movimentação registrada nesta loja ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {historico.map((mov) => {
                  const dinheiroMov = Number(mov.valorEntradaNotas) || 0;
                  const machinePayMov =
                    mov.valorEntradaCartao !== null &&
                    mov.valorEntradaCartao !== undefined
                      ? Number(mov.valorEntradaCartao)
                      : null;
                  const gastosMov = Number(mov.valorGastosExtras) || 0;
                  const produtoMov = mov.detalhesProdutos?.[0]?.produto?.nome;
                  return (
                    <div
                      key={mov.id}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {mov.maquina?.nome || "Máquina"}
                            {produtoMov && (
                              <span className="font-normal text-slate-500">
                                {" "}
                                · {produtoMov}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatarDataHora(mov.dataColeta)} ·{" "}
                            {mov.usuario?.nome || "-"}
                          </p>
                        </div>
                        {ehAdmin && (
                          <button
                            type="button"
                            onClick={() => setExcluindo(mov)}
                            className="shrink-0 text-xs font-semibold text-red-600 hover:underline"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 tabular-nums">
                        <span>IN {mov.contadorIn ?? "-"}</span>
                        <span>OUT {mov.contadorOut ?? "-"}</span>
                        <span>Abastecido {mov.abastecidas ?? 0}</span>
                        <span>💵 {formatarReais(dinheiroMov)}</span>
                        {machinePayMov !== null && (
                          <span>💳 {formatarReais(machinePayMov)}</span>
                        )}
                        {gastosMov > 0 && (
                          <span className="text-rose-700">
                            🧾 − {formatarReais(gastosMov)}
                          </span>
                        )}
                      </div>
                      {mov.observacoes && (
                        <p className="mt-1 text-xs text-slate-500 italic">
                          {mov.observacoes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmação do registro */}
      {mostrarConfirmacao && maquinaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              Confirmar movimentação
            </h3>
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <p>
                <strong>Loja:</strong> {lojaSelecionada?.nome || "-"}
              </p>
              <p>
                <strong>Máquina:</strong> {maquinaSelecionada.nome}
              </p>
              <p>
                <strong>Produto:</strong> {produtoSelecionado?.nome || "-"}
              </p>
              <p>
                <strong>Contadores:</strong> IN {formData.contadorIn} · OUT{" "}
                {formData.contadorOut}
              </p>
              <p>
                <strong>Abastecido:</strong>{" "}
                {numero(formData.quantidadeAdicionada)}
              </p>
              <p>
                <strong>Dinheiro retirado:</strong> {formatarReais(dinheiro)}
              </p>
              {machinePayConfigurada && (
                <p>
                  <strong>Machine Pay:</strong>{" "}
                  {valorMachinePay !== null
                    ? formatarReais(valorMachinePay)
                    : "não consultado"}
                  {machinePay?.inicio &&
                    ` (desde ${formatarDataHora(machinePay.inicio)})`}
                </p>
              )}
              {gastosOk.length > 0 && (
                <div>
                  <strong>
                    Gastos extras (vão para a Gestão de Contas como pagos):
                  </strong>
                  <ul className="ml-4 list-disc">
                    {gastosOk.map((g, i) => (
                      <li key={i}>
                        {g.descricao.trim()}: {formatarReais(numero(g.valor))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="pt-1 text-base font-bold text-emerald-700">
                Total líquido: {formatarReais(liquido)}
              </p>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Depois de registrar, a mensagem abre no WhatsApp.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMostrarConfirmacao(false)}
                disabled={salvando}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn-primary disabled:opacity-60"
                onClick={registrar}
                disabled={salvando}
              >
                {salvando ? "Registrando..." : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {excluindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              Excluir movimentação?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {excluindo.maquina?.nome || "Máquina"} —{" "}
              {formatarDataHora(excluindo.dataColeta)}. Os gastos extras
              lançados nela também saem da Gestão de Contas.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setExcluindo(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={excluirMovimentacao}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default Movimentacoes;
