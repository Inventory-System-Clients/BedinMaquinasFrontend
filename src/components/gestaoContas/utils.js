import api from "../../services/api";

// Utilitários da Gestão de Contas (Financeiro → Gestão de Contas).

export const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Hoje no horário de Brasília, "YYYY-MM-DD". */
export function hoje() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function primeiroDiaDoMes() {
  return `${hoje().slice(0, 7)}-01`;
}

/** "2026-11-16" -> "16/11/2026" (sem passar por Date, que erraria o dia pelo fuso). */
export function dataBR(dia) {
  if (!dia) return "—";
  const [a, m, d] = String(dia).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function somarMeses(dia, meses) {
  const [ano, mes, d] = dia.split("-").map(Number);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

export function somarDias(dia, dias) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Divide o valor em N parcelas exatas em centavos (diferença na última). */
export function gerarParcelas(valor, quantidade, primeiroVencimento, intervaloDias = 0) {
  const total = Math.max(1, Math.min(120, Math.floor(quantidade) || 1));
  const centavos = Math.round(Number(valor) * 100);
  const base = Math.floor(centavos / total);
  return Array.from({ length: total }, (_, i) => ({
    vencimento: intervaloDias > 0 ? somarDias(primeiroVencimento, i * intervaloDias) : somarMeses(primeiroVencimento, i),
    valor: (i === total - 1 ? centavos - base * (total - 1) : base) / 100,
  }));
}

export function mesCurto(chave) {
  const [ano, mes] = chave.split("-").map(Number);
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

export function erroApi(err, fallback) {
  return err?.response?.data?.error || fallback;
}

export const TEXTOS = {
  PAGAR: {
    titulo: "Contas a pagar",
    pessoa: "Fornecedor / beneficiário",
    quitar: "Pagar",
    quitada: "Paga",
    quitadas: "Pagas",
    dataQuitacao: "Data do pagamento",
    valorQuitado: "Valor pago",
    quitadoEm: "Pago em",
    aberto: "Em aberto a pagar",
    totalQuitado: "Total já pago",
    nova: "Nova conta a pagar",
    verbo: "pagas",
  },
  RECEBER: {
    titulo: "Contas a receber",
    pessoa: "Cliente / pagador",
    quitar: "Receber",
    quitada: "Recebida",
    quitadas: "Recebidas",
    dataQuitacao: "Data do recebimento",
    valorQuitado: "Valor recebido",
    quitadoEm: "Recebido em",
    aberto: "Em aberto a receber",
    totalQuitado: "Total já recebido",
    nova: "Nova conta a receber",
    verbo: "recebidas",
  },
};

export const SITUACAO = {
  PENDENTE: { label: "Pendente", classe: "bg-amber-50 text-amber-800 border-amber-200" },
  VENCIDA: { label: "Vencida", classe: "bg-red-100 text-red-700 border-red-300 animate-pulse" },
  QUITADA: { label: "Quitada", classe: "bg-green-100 text-green-700 border-green-200" },
  CANCELADA: { label: "Cancelada", classe: "bg-gray-100 text-gray-500 border-gray-200" },
};

// ------------------------------------------------------------------ API

const base = "/gestao-contas";
export const gc = {
  resumo: (params) => api.get(`${base}/resumo`, { params }).then((r) => r.data.resumo),
  fluxo: (params) => api.get(`${base}/fluxo-caixa`, { params }).then((r) => r.data.fluxo),
  classificacoes: () => api.get(`${base}/classificacoes`).then((r) => r.data),
  contas: (params) => api.get(`${base}/contas`, { params }).then((r) => r.data),
  resumoContas: (params) => api.get(`${base}/contas/resumo`, { params }).then((r) => r.data.resumo),
  alertas: () => api.get(`${base}/contas/alertas`).then((r) => r.data.alertas),
  criarContas: (body) => api.post(`${base}/contas`, body).then((r) => r.data.contas),
  atualizarConta: (id, body) => api.put(`${base}/contas/${id}`, body).then((r) => r.data.conta),
  quitar: (id, body) => api.post(`${base}/contas/${id}/quitar`, body).then((r) => r.data.conta),
  quitarLote: (body) => api.post(`${base}/contas/quitar-lote`, body).then((r) => r.data.quitadas),
  reabrir: (id) => api.post(`${base}/contas/${id}/reabrir`).then((r) => r.data.conta),
  cancelar: (id) => api.post(`${base}/contas/${id}/cancelar`).then((r) => r.data.conta),
  excluir: (id, parcelasFuturas) => api.delete(`${base}/contas/${id}`, { params: parcelasFuturas ? { parcelasFuturas: 1 } : {} }).then((r) => r.data),
  bancos: (arquivadas) => api.get(`${base}/bancos`, { params: arquivadas ? { arquivadas: 1 } : {} }).then((r) => r.data),
  criarBanco: (body) => api.post(`${base}/bancos`, body).then((r) => r.data.conta),
  atualizarBanco: (id, body) => api.put(`${base}/bancos/${id}`, body).then((r) => r.data.conta),
  arquivarBanco: (id) => api.delete(`${base}/bancos/${id}`).then((r) => r.data.conta),
  lancamentos: (params) => api.get(`${base}/lancamentos`, { params }).then((r) => r.data.lancamentos),
  criarLancamento: (body) => api.post(`${base}/lancamentos`, body).then((r) => r.data.lancamento),
  atualizarLancamento: (id, body) => api.put(`${base}/lancamentos/${id}`, body).then((r) => r.data.lancamento),
  excluirLancamento: (id) => api.delete(`${base}/lancamentos/${id}`),
};

// ------------------------------------------------------------------ Exportação

/** Planilha CSV (abre no Excel): separador ";" e BOM pra acentuação. */
export function exportarCsv(nomeArquivo, colunas, linhas) {
  const celula = (v) => {
    if (v === null || v === undefined) return "";
    const t = typeof v === "number" ? v.toFixed(2).replace(".", ",") : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const csv = [colunas.map((c) => c.titulo).join(";"), ...linhas.map((l) => colunas.map((c) => celula(c.valor(l))).join(";"))].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeArquivo}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Abre uma janela de impressão (Salvar como PDF) com o relatório. */
export function abrirRelatorio(titulo, corpo) {
  const janela = window.open("", "_blank");
  if (!janela) {
    alert("Permita pop-ups para gerar o PDF.");
    return;
  }
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:20px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
  .muted{color:#666;margin-bottom:12px}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
  .box{border:1px solid #ddd;border-radius:6px;padding:8px}
  table{width:100%;border-collapse:collapse;margin-bottom:10px} th,td{border:1px solid #ddd;padding:4px 6px;text-align:left} th{background:#f3f4f6}
  td.num,th.num{text-align:right} .total{font-weight:bold;font-size:14px;margin-top:12px;text-align:right}
  @media print{button{display:none}}
</style></head><body>${corpo}<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
  janela.document.close();
}
