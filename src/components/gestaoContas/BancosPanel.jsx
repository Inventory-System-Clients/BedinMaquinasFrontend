import { useEffect, useState } from "react";
import { Botao, Card, Campo, Dialogo, Rodape, StatCard, Vazio, inputCls, tdCls, thCls } from "./ui";
import { confirmar, useAviso } from "./hooks";
import { GraficoSaldos } from "./Graficos";
import { brl, erroApi, gc } from "./utils";

// Contas bancárias e caixas: saldo inicial + tudo que foi pago/recebido/lançado nelas.

const TIPOS = { BANCO: "Banco", CAIXA: "Caixa (dinheiro)", OUTRO: "Outro" };

export default function BancosPanel({ onAlterado }) {
  const avisar = useAviso();
  const [dados, setDados] = useState({ contas: [], semConta: 0 });
  const [arquivadas, setArquivadas] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null); // null fechado, {} nova, conta = editar

  async function carregar() {
    setCarregando(true);
    try {
      setDados(await gc.bancos(arquivadas));
    } catch (err) {
      avisar(erroApi(err, "Erro ao carregar as contas bancárias."), "erro");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivadas]);

  function recarregar() {
    carregar();
    onAlterado?.();
  }

  async function arquivar(conta) {
    if (!(await confirmar("Arquivar conta?", `"${conta.nome}" some das listas, mas o histórico de lançamentos continua.`, "Arquivar"))) return;
    try {
      await gc.arquivarBanco(conta.id);
      avisar("Conta arquivada.");
      recarregar();
    } catch (err) {
      avisar(erroApi(err, "Não foi possível arquivar."), "erro");
    }
  }

  async function reativar(conta) {
    try {
      await gc.atualizarBanco(conta.id, { ativo: true });
      avisar("Conta reativada.");
      recarregar();
    } catch (err) {
      avisar(erroApi(err, "Não foi possível reativar."), "erro");
    }
  }

  const ativas = dados.contas.filter((c) => c.ativo);
  const total = ativas.reduce((s, c) => s + c.saldoAtual, 0);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icone="🏦" label="Saldo total nas contas" valor={brl(total)} tom={total < 0 ? "crit" : "neutro"} detalhe={`${ativas.length} conta${ativas.length === 1 ? "" : "s"} ativa${ativas.length === 1 ? "" : "s"}`} />
        <StatCard icone="📉" label="Contas no negativo" valor={String(ativas.filter((c) => c.saldoAtual < 0).length)} tom={ativas.some((c) => c.saldoAtual < 0) ? "crit" : "neutro"} />
        <StatCard
          icone="❔"
          label="Movimento sem conta bancária"
          valor={brl(dados.semConta)}
          detalhe="Pagamentos/recebimentos baixados sem escolher a conta"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={arquivadas} onChange={(e) => setArquivadas(e.target.checked)} />
          Mostrar arquivadas
        </label>
        <Botao onClick={() => setEditando({})}>＋ Nova conta</Botao>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className={thCls}>Nome</th>
              <th className={thCls}>Tipo</th>
              <th className={thCls}>Banco / agência / conta</th>
              <th className={thCls}>Saldo inicial</th>
              <th className={thCls}>Saldo atual</th>
              <th className="w-40" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {carregando && dados.contas.length === 0 && <Vazio colSpan={6}>Carregando...</Vazio>}
            {!carregando && dados.contas.length === 0 && <Vazio colSpan={6}>Nenhuma conta cadastrada. Cadastre os bancos e o caixa da empresa para acompanhar os saldos.</Vazio>}
            {dados.contas.map((c) => (
              <tr key={c.id} className={c.ativo ? "hover:bg-blue-50/40" : "bg-gray-50 text-gray-400"}>
                <td className={`${tdCls} font-medium`}>
                  {c.nome}
                  {!c.ativo && <span className="ml-2 text-xs">(arquivada)</span>}
                </td>
                <td className={`${tdCls} text-gray-600`}>{TIPOS[c.tipo] ?? c.tipo}</td>
                <td className={`${tdCls} text-gray-600`}>{[c.banco, c.agencia && `ag. ${c.agencia}`, c.numeroConta && `c/c ${c.numeroConta}`].filter(Boolean).join(" · ") || "—"}</td>
                <td className={tdCls}>{brl(c.saldoInicial)}</td>
                <td className={`${tdCls} font-semibold ${c.saldoAtual < 0 ? "text-red-600" : "text-gray-900"}`}>{brl(c.saldoAtual)}</td>
                <td className="px-3 py-2 text-right">
                  <Botao pequeno variante="fantasma" onClick={() => setEditando(c)}>
                    ✏️ Editar
                  </Botao>
                  {c.ativo ? (
                    <Botao pequeno variante="perigo" onClick={() => arquivar(c)}>
                      Arquivar
                    </Botao>
                  ) : (
                    <Botao pequeno variante="fantasma" onClick={() => reativar(c)}>
                      ↩ Reativar
                    </Botao>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ativas.length > 0 && (
        <Card titulo="Saldo por conta">
          <GraficoSaldos dados={ativas.map((c) => ({ id: c.id, nome: c.nome, saldo: c.saldoAtual }))} />
        </Card>
      )}

      <BancoFormDialog conta={editando} onFechar={() => setEditando(null)} onSalvo={recarregar} />
    </div>
  );
}

function BancoFormDialog({ conta, onFechar, onSalvo }) {
  const avisar = useAviso();
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (conta) setForm({ nome: conta.nome ?? "", tipo: conta.tipo ?? "BANCO", banco: conta.banco ?? "", agencia: conta.agencia ?? "", numeroConta: conta.numeroConta ?? "", saldoInicial: String(conta.saldoInicial ?? 0) });
  }, [conta]);
  if (!conta || !form) return null;
  const nova = !conta.id;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      if (nova) await gc.criarBanco(form);
      else await gc.atualizarBanco(conta.id, form);
      avisar(nova ? "Conta criada." : "Conta atualizada.");
      onSalvo();
      onFechar();
    } catch (err) {
      avisar(erroApi(err, "Não foi possível salvar."), "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialogo aberto onFechar={onFechar} titulo={nova ? "Nova conta bancária / caixa" : `Editar ${conta.nome}`} largura="max-w-md">
      <form onSubmit={salvar} className="grid grid-cols-2 gap-3">
        <Campo label="Nome *" className="col-span-2">
          <input className={inputCls} required value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Itaú PJ, Caixa da loja" autoFocus />
        </Campo>
        <Campo label="Tipo">
          <select className={inputCls} value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
            {Object.entries(TIPOS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Banco">
          <input className={inputCls} value={form.banco} onChange={(e) => set("banco", e.target.value)} />
        </Campo>
        <Campo label="Agência">
          <input className={inputCls} value={form.agencia} onChange={(e) => set("agencia", e.target.value)} />
        </Campo>
        <Campo label="Conta">
          <input className={inputCls} value={form.numeroConta} onChange={(e) => set("numeroConta", e.target.value)} />
        </Campo>
        <Campo label="Saldo inicial" className="col-span-2" dica="Saldo da conta no dia em que você começou a usar a gestão de contas.">
          <input type="number" step="0.01" className={inputCls} value={form.saldoInicial} onChange={(e) => set("saldoInicial", e.target.value)} />
        </Campo>
        <div className="col-span-2">
          <Rodape>
            <Botao variante="contorno" onClick={onFechar}>
              Cancelar
            </Botao>
            <Botao type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : nova ? "Criar conta" : "Salvar"}
            </Botao>
          </Rodape>
        </div>
      </form>
    </Dialogo>
  );
}
