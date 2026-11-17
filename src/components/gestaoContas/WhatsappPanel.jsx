import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Botao, Campo, Card, Dialogo, Rodape, StatCard, inputCls } from "./ui";
import { confirmar, useAviso } from "./hooks";
import { brl, dataBR, erroApi, gc, telefoneBR } from "./utils";

// Gestão de Contas → WhatsApp: conecta um número pelo QR Code (Evolution API, mesmo modelo
// da GiraKids) e avisa os recebedores cadastrados das contas perto do vencimento e no dia.

const ESTADOS = {
  open: { label: "Conectado", classe: "bg-emerald-50 text-emerald-700 ring-emerald-200", ponto: "bg-emerald-500" },
  connecting: { label: "Aguardando leitura do QR Code", classe: "bg-amber-50 text-amber-800 ring-amber-200", ponto: "bg-amber-500 animate-pulse" },
  close: { label: "Desconectado", classe: "bg-red-50 text-red-700 ring-red-200", ponto: "bg-red-500" },
  inexistente: { label: "Número ainda não conectado", classe: "bg-gray-100 text-gray-700 ring-gray-200", ponto: "bg-gray-400" },
  erro: { label: "Evolution API indisponível", classe: "bg-red-50 text-red-700 ring-red-200", ponto: "bg-red-500" },
};

const TIPO_AVISO = { NO_DIA: "No dia", ANTECIPADO: "Antecipado" };

const DESTINATARIO_VAZIO = { nome: "", telefone: "", ativo: true, avisarPagar: true, avisarReceber: false, avisoAntecipado: true, avisoNoDia: true };

function Selo({ estado }) {
  const e = ESTADOS[estado] || { label: "Não configurado", classe: "bg-gray-100 text-gray-600 ring-gray-200", ponto: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${e.classe}`}>
      <span className={`size-2 rounded-full ${e.ponto}`} />
      {e.label}
    </span>
  );
}

function Chave({ checked, onChange, label, disabled }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 text-sm text-gray-700 ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" className="size-4 accent-[#2457B1]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function quando(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function WhatsappPanel() {
  const avisar = useAviso();
  const { usuario } = useAuth();
  const ehAdmin = usuario?.role === "ADMIN";

  const [dados, setDados] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const [qr, setQr] = useState(null);
  const [ocupado, setOcupado] = useState(null); // nome da ação em andamento
  const [form, setForm] = useState(null); // config em edição
  const [destinatario, setDestinatario] = useState(null); // {..} em edição
  const [telefoneTeste, setTelefoneTeste] = useState("");

  const conectado = dados?.conexao?.estado === "open";
  const qrVisivel = qr && !conectado;

  // Status + prévia. Enquanto o QR está na tela, confere a conexão a cada 4 s; senão a cada 30 s.
  useEffect(() => {
    let vivo = true;
    const buscar = () =>
      Promise.all([gc.whatsapp(), gc.whatsappPrevia()])
        .then(([d, p]) => {
          if (!vivo) return;
          setDados(d);
          setPrevia(p);
        })
        .catch((err) => vivo && avisar(erroApi(err, "Erro ao carregar o WhatsApp."), "erro"));
    buscar();
    const id = setInterval(buscar, qrVisivel ? 4000 : 30000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [recarga, qrVisivel, avisar]);

  const recarregar = () => setRecarga((n) => n + 1);

  async function acao(nome, fn, sucesso) {
    setOcupado(nome);
    try {
      const r = await fn();
      if (sucesso) avisar(typeof sucesso === "function" ? sucesso(r) : sucesso, "sucesso");
      recarregar();
      return r;
    } catch (err) {
      avisar(erroApi(err, "Não foi possível concluir."), "erro");
      return null;
    } finally {
      setOcupado(null);
    }
  }

  async function conectar() {
    const r = await acao("conectar", () => gc.whatsappConectar());
    if (!r) return;
    if (r.estado === "open") {
      setQr(null);
      avisar("O WhatsApp já está conectado.", "sucesso");
    } else {
      setQr(r);
    }
  }

  async function desconectar() {
    if (!(await confirmar("Desconectar o WhatsApp?", "Os avisos param até você conectar um número de novo pelo QR Code.", "Desconectar"))) return;
    setQr(null);
    await acao("desconectar", () => gc.whatsappDesconectar(), "WhatsApp desconectado.");
  }

  async function salvarConfig(e) {
    e.preventDefault();
    const body = { ...form, diasAntes: Number(form.diasAntes), horaEnvio: Number(form.horaEnvio) };
    const r = await acao("config", () => gc.whatsappConfig(body), "Configuração salva.");
    if (r) setForm(null);
  }

  async function ligarAvisos(ativo) {
    await acao("ativo", () => gc.whatsappConfig({ ativo }), ativo ? "Avisos automáticos ligados." : "Avisos automáticos desligados.");
  }

  async function salvarDestinatario(e) {
    e.preventDefault();
    const { id, ...body } = destinatario;
    const r = await acao("destinatario", () => (id ? gc.atualizarDestinatario(id, body) : gc.criarDestinatario(body)), id ? "Recebedor atualizado." : "Recebedor cadastrado.");
    if (r) setDestinatario(null);
  }

  async function alternarAtivo(d) {
    await acao(`ativo-${d.id}`, () => gc.atualizarDestinatario(d.id, { ativo: !d.ativo }));
  }

  async function excluir(d) {
    if (!(await confirmar(`Remover ${d.nome}?`, "Ele deixa de receber os avisos de vencimento.", "Remover"))) return;
    await acao(`excluir-${d.id}`, () => gc.excluirDestinatario(d.id), "Recebedor removido.");
  }

  async function testar(telefone) {
    await acao(`teste-${telefone}`, () => gc.whatsappTeste(telefone), (r) => `Mensagem de teste enviada para ${telefoneBR(r.numero)}.`);
  }

  async function enviarAgora() {
    const total = (previa || []).reduce((s, p) => s + p.contas.length, 0);
    if (!(await confirmar("Enviar os avisos agora?", `${total} aviso(s) pendente(s) hoje. Quem já recebeu não recebe de novo.`, "Enviar agora", false))) return;
    await acao("enviar", () => gc.whatsappEnviarAgora(), (r) =>
      r.ignorado ? r.ignorado : r.mensagens ? `${r.mensagens} mensagem(ns) enviada(s) com ${r.contasAvisadas} conta(s).${r.falhas.length ? ` ${r.falhas.length} falha(s).` : ""}` : "Nenhum aviso pendente para enviar."
    );
  }

  if (!dados) return <p className="py-10 text-center text-gray-500">Carregando WhatsApp...</p>;

  const { config, conexao, destinatarios, historico } = dados;
  const ativos = destinatarios.filter((d) => d.ativo).length;
  const pendentesHoje = (previa || []).filter((p) => p.contas.length);
  const ultima = config.ultimaExecucao;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icone="📱" label="Conexão" valor={ESTADOS[conexao.estado]?.label || "Não configurado"} tom={conectado ? "ok" : "crit"} />
        <StatCard icone="🔔" label="Avisos automáticos" valor={config.ativo ? "Ligados" : "Desligados"} tom={config.ativo ? "ok" : "neutro"} detalhe={`A partir das ${config.horaEnvio}h · ${config.diasAntes} dia(s) antes`} />
        <StatCard icone="👥" label="Recebedores ativos" valor={ativos} detalhe={`${destinatarios.length} cadastrado(s)`} />
        <StatCard
          icone="🕒"
          label="Último envio"
          valor={ultima ? quando(ultima.em) : "—"}
          tom={ultima?.erro || ultima?.falhas?.length ? "crit" : "neutro"}
          detalhe={
            ultima
              ? ultima.erro
                ? ultima.erro
                : `${ultima.mensagens || 0} mensagem(ns)${ultima.falhas?.length ? ` · ${ultima.falhas.length} falha(s)` : ""}${ultima.manual ? " · manual" : " · automático"}`
              : "Nenhum envio ainda"
          }
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Conexão */}
        <Card
          titulo="Número que envia os avisos"
          acao={<Selo estado={conexao.configurado ? conexao.estado : null} />}
        >
          {!config.evolutionConfigurada ? (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <p className="font-semibold">Evolution API não configurada no servidor</p>
              <p className="mt-1">
                Defina {config.variaveisFaltando.map((v, i) => (
                  <span key={v}>
                    {i > 0 && " e "}
                    <code className="rounded bg-amber-100 px-1 font-mono text-xs">{v}</code>
                  </span>
                ))}{" "}
                nas variáveis de ambiente do backend (Render → Environment) e reinicie o serviço.
              </p>
            </div>
          ) : !conexao.configurado ? (
            <p className="text-sm text-gray-600">
              {ehAdmin ? "Informe o nome da instância em “Configuração dos avisos” para conectar o WhatsApp da empresa." : "Peça a um administrador para configurar e conectar o WhatsApp."}
            </p>
          ) : conectado ? (
            <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              <span className="text-2xl" aria-hidden>
                ✅
              </span>
              <p>WhatsApp conectado. Os avisos saem deste número para os recebedores cadastrados.</p>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Clique em <strong>Conectar número</strong> e leia o QR Code com o WhatsApp do celular da empresa (Aparelhos conectados → Conectar um aparelho).</p>
          )}
          {conexao.estado === "erro" && conexao.erro && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{conexao.erro}</p>}

          {qrVisivel && (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
              {qr.qrBase64 ? (
                <img src={qr.qrBase64} alt="QR Code para conectar o WhatsApp" className="size-60 rounded-lg bg-white p-2 shadow-sm" />
              ) : (
                <p className="text-sm text-gray-500">A Evolution não devolveu o QR Code. Tente gerar de novo.</p>
              )}
              {qr.pairingCode && (
                <p className="text-sm text-gray-600">
                  Ou use o código: <strong className="font-mono tracking-widest">{qr.pairingCode}</strong>
                </p>
              )}
              <p className="text-xs text-gray-500">O QR expira em cerca de 1 minuto. Esta tela atualiza sozinha quando o número conectar.</p>
            </div>
          )}

          {ehAdmin && conexao.configurado && (
            <div className="mt-4 flex flex-wrap gap-2">
              {!conectado && (
                <Botao onClick={conectar} disabled={ocupado === "conectar"}>
                  {ocupado === "conectar" ? "Gerando QR Code..." : qrVisivel ? "🔄 Gerar novo QR Code" : "📱 Conectar número"}
                </Botao>
              )}
              {(conectado || conexao.estado === "connecting") && (
                <Botao variante="contorno" onClick={desconectar} disabled={ocupado === "desconectar"}>
                  Desconectar
                </Botao>
              )}
            </div>
          )}

          {/* Teste */}
          {conectado && (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <p className="mb-2 text-sm font-medium text-gray-700">Enviar mensagem de teste</p>
              <div className="flex flex-wrap gap-2">
                <input className={`${inputCls} max-w-56`} placeholder="(11) 98765-4321" inputMode="tel" value={telefoneTeste} onChange={(e) => setTelefoneTeste(e.target.value)} />
                <Botao variante="contorno" onClick={() => testar(telefoneTeste)} disabled={!telefoneTeste || ocupado === `teste-${telefoneTeste}`}>
                  Enviar teste
                </Botao>
              </div>
            </div>
          )}
        </Card>

        {/* Configuração */}
        <Card
          titulo="Configuração dos avisos"
          acao={
            ehAdmin && !form ? (
              <Botao
                pequeno
                variante="contorno"
                onClick={() => setForm({ instancia: config.instancia || "", diasAntes: config.diasAntes, horaEnvio: config.horaEnvio })}
              >
                ✏️ Editar
              </Botao>
            ) : null
          }
        >
          {form ? (
            <form onSubmit={salvarConfig} className="grid gap-3">
              <Campo label="Nome da instância" dica="Nome do número na Evolution API, ex.: bedin-contas. A URL e a chave ficam protegidas no servidor.">
                <input className={inputCls} required pattern="[\w.\-]{1,60}" value={form.instancia} onChange={(e) => setForm({ ...form, instancia: e.target.value })} />
              </Campo>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Avisar quantos dias antes" dica="0 = só no dia do vencimento.">
                  <input className={inputCls} type="number" min="0" max="30" value={form.diasAntes} onChange={(e) => setForm({ ...form, diasAntes: e.target.value })} />
                </Campo>
                <Campo label="Enviar a partir das (h)" dica="Horário de Brasília.">
                  <input className={inputCls} type="number" min="0" max="23" value={form.horaEnvio} onChange={(e) => setForm({ ...form, horaEnvio: e.target.value })} />
                </Campo>
              </div>
              <Rodape>
                <Botao variante="fantasma" onClick={() => setForm(null)}>
                  Cancelar
                </Botao>
                <Botao type="submit" disabled={ocupado === "config"}>
                  Salvar
                </Botao>
              </Rodape>
            </form>
          ) : (
            <div className="grid gap-4">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-gray-500">Aviso antecipado</dt>
                  <dd className="font-medium text-gray-800">{config.diasAntes > 0 ? `${config.diasAntes} dia(s) antes do vencimento` : "Desligado"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Aviso no dia</dt>
                  <dd className="font-medium text-gray-800">No dia do vencimento, a partir das {config.horaEnvio}h</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Evolution API</dt>
                  <dd className={`truncate font-medium ${config.evolutionConfigurada ? "text-emerald-700" : "text-amber-700"}`}>
                    {config.evolutionConfigurada ? `Configurada no servidor ✓${config.evolutionHost ? ` (${config.evolutionHost})` : ""}` : "Faltam variáveis no servidor"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Instância</dt>
                  <dd className="font-medium text-gray-800">{config.instancia || "—"}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 p-3">
                <p className="text-sm text-gray-700">
                  Avisos automáticos <strong>{config.ativo ? "ligados" : "desligados"}</strong>
                  <span className="block text-xs text-gray-500">Cada recebedor recebe uma mensagem por dia com as contas dele. Nada é avisado duas vezes.</span>
                </p>
                {ehAdmin && (
                  <Botao variante={config.ativo ? "contorno" : "sucesso"} onClick={() => ligarAvisos(!config.ativo)} disabled={ocupado === "ativo" || (!config.ativo && !conexao.configurado)}>
                    {config.ativo ? "Desligar" : "Ligar avisos"}
                  </Botao>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Recebedores */}
      <Card titulo="Quem recebe os avisos" acao={<Botao onClick={() => setDestinatario({ ...DESTINATARIO_VAZIO })}>＋ Cadastrar recebedor</Botao>}>
        {destinatarios.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Nenhum recebedor cadastrado. Cadastre quem deve ser avisado das contas (ex.: dono, financeiro).</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {destinatarios.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold ${d.ativo ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                  {d.nome.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${d.ativo ? "text-gray-900" : "text-gray-400 line-through"}`}>{d.nome}</p>
                  <p className="text-sm text-gray-500">{telefoneBR(d.telefone)}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {d.avisarPagar && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">A pagar</span>}
                    {d.avisarReceber && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">A receber</span>}
                    {d.avisoAntecipado && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">Antecipado</span>}
                    {d.avisoNoDia && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">No dia</span>}
                  </div>
                </div>
                <div className="flex basis-full flex-wrap justify-end gap-1 sm:basis-auto">
                  {conectado && (
                    <Botao pequeno variante="fantasma" onClick={() => testar(d.telefone)} disabled={ocupado === `teste-${d.telefone}`}>
                      Testar
                    </Botao>
                  )}
                  <Botao pequeno variante="fantasma" onClick={() => alternarAtivo(d)} disabled={ocupado === `ativo-${d.id}`}>
                    {d.ativo ? "Pausar" : "Ativar"}
                  </Botao>
                  <Botao pequeno variante="contorno" onClick={() => setDestinatario({ ...d, telefone: telefoneBR(d.telefone) })}>
                    Editar
                  </Botao>
                  <Botao pequeno variante="perigo" onClick={() => excluir(d)}>
                    Remover
                  </Botao>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
        {/* Prévia */}
        <Card
          titulo="Avisos pendentes de hoje"
          acao={
            <Botao variante="sucesso" onClick={enviarAgora} disabled={!conectado || ocupado === "enviar" || pendentesHoje.length === 0}>
              {ocupado === "enviar" ? "Enviando..." : "📲 Enviar agora"}
            </Botao>
          }
        >
          {pendentesHoje.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">Nenhum aviso pendente: nada vence dentro da janela ou todos já foram avisados. 🎉</p>
          ) : (
            <div className="grid gap-3">
              {pendentesHoje.map((p) => (
                <div key={p.destinatario.id} className="rounded-lg border border-gray-100 p-3">
                  <p className="mb-1 text-sm font-semibold text-gray-800">Para {p.destinatario.nome}</p>
                  <ul className="grid gap-1 text-sm">
                    {p.contas.map((c) => (
                      <li key={`${c.id}-${c.tipoAviso}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className={`text-xs font-semibold ${c.tipo === "PAGAR" ? "text-orange-700" : "text-blue-700"}`}>{c.tipo === "PAGAR" ? "↓ A pagar" : "↑ A receber"}</span>
                        <span className="min-w-0 flex-1 basis-40 truncate">{c.descricao}</span>
                        <span className="text-xs text-gray-500">
                          {dataBR(c.vencimento)} · {TIPO_AVISO[c.tipoAviso]}
                        </span>
                        <strong className="text-gray-900">{brl(c.valor)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {!config.ativo && <p className="text-xs text-amber-700">Os avisos automáticos estão desligados: só saem pelo botão “Enviar agora”.</p>}
            </div>
          )}
        </Card>

        {/* Histórico */}
        <Card titulo="Últimos avisos">
          {historico.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">Nenhum aviso enviado ainda.</p>
          ) : (
            <ul className="grid max-h-96 gap-1 overflow-y-auto text-sm">
              {historico.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-2 py-1.5 hover:bg-gray-50">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${h.status === "ENVIADO" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {h.status === "ENVIADO" ? "Enviado" : "Erro"}
                  </span>
                  <span className="min-w-0 flex-1 basis-48 truncate">
                    {h.conta?.descricao || "Conta removida"} <span className="text-gray-400">→ {h.destinatario?.nome || "—"}</span>
                  </span>
                  <span className="text-xs text-gray-500">
                    {TIPO_AVISO[h.tipoAviso]} · {quando(h.enviadoEm || h.updatedAt)}
                  </span>
                  {h.status === "ERRO" && h.erro && <span className="w-full text-xs text-red-600">{h.erro}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Cadastro / edição de recebedor */}
      <Dialogo
        aberto={!!destinatario}
        onFechar={() => setDestinatario(null)}
        titulo={destinatario?.id ? "Editar recebedor" : "Cadastrar recebedor"}
        descricao="Quem recebe no WhatsApp os avisos de contas perto do vencimento e no dia de pagar."
      >
        {destinatario && (
          <form onSubmit={salvarDestinatario} className="grid gap-3">
            <Campo label="Nome">
              <input className={inputCls} required autoFocus value={destinatario.nome} onChange={(e) => setDestinatario({ ...destinatario, nome: e.target.value })} />
            </Campo>
            <Campo label="WhatsApp (com DDD)">
              <input className={inputCls} required inputMode="tel" placeholder="(11) 98765-4321" value={destinatario.telefone} onChange={(e) => setDestinatario({ ...destinatario, telefone: e.target.value })} />
            </Campo>
            <fieldset className="grid gap-2 rounded-lg border border-gray-200 p-3">
              <legend className="px-1 text-xs font-medium text-gray-600">Avisar sobre</legend>
              <Chave label="Contas a pagar" checked={destinatario.avisarPagar} onChange={(v) => setDestinatario({ ...destinatario, avisarPagar: v })} />
              <Chave label="Contas a receber" checked={destinatario.avisarReceber} onChange={(v) => setDestinatario({ ...destinatario, avisarReceber: v })} />
            </fieldset>
            <fieldset className="grid gap-2 rounded-lg border border-gray-200 p-3">
              <legend className="px-1 text-xs font-medium text-gray-600">Quando</legend>
              <Chave
                label={config.diasAntes > 0 ? `${config.diasAntes} dia(s) antes do vencimento` : "Antes do vencimento (desligado na configuração)"}
                checked={destinatario.avisoAntecipado}
                onChange={(v) => setDestinatario({ ...destinatario, avisoAntecipado: v })}
              />
              <Chave label="No dia do vencimento" checked={destinatario.avisoNoDia} onChange={(v) => setDestinatario({ ...destinatario, avisoNoDia: v })} />
            </fieldset>
            <Chave label="Ativo (recebe os avisos)" checked={destinatario.ativo} onChange={(v) => setDestinatario({ ...destinatario, ativo: v })} />
            <Rodape>
              <Botao variante="fantasma" onClick={() => setDestinatario(null)}>
                Cancelar
              </Botao>
              <Botao type="submit" disabled={ocupado === "destinatario" || (!destinatario.avisarPagar && !destinatario.avisarReceber)}>
                Salvar
              </Botao>
            </Rodape>
          </form>
        )}
      </Dialogo>
    </div>
  );
}
