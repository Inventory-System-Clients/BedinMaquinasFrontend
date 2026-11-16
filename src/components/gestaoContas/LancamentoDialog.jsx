import { useEffect, useState } from "react";
import { Botao, Campo, Dialogo, InputSugestao, Rodape, Segmentado, inputCls } from "./ui";
import { useAviso } from "./hooks";
import { erroApi, gc, hoje } from "./utils";

// Lançamento manual (entrada ou saída já realizada, sem vencimento): gasto do dia a dia,
// retirada, aporte, venda à vista... `lancamento` com id = editar; {} ou {tipo} = novo.
export function LancamentoDialog({ lancamento, onFechar, onSalvo, classificacoes, bancos }) {
  const avisar = useAviso();
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!lancamento) return;
    setForm({
      tipo: lancamento.tipo ?? "SAIDA",
      descricao: lancamento.descricao ?? "",
      categoria: lancamento.categoria ?? "",
      centroCusto: lancamento.centroCusto ?? "",
      valor: lancamento.valor != null ? String(lancamento.valor) : "",
      data: lancamento.data ?? hoje(),
      formaPagamento: lancamento.formaPagamento ?? "",
      contaBancariaId: lancamento.contaBancariaId ?? "",
    });
  }, [lancamento]);

  if (!lancamento || !form) return null;
  const novo = !lancamento.id;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const categorias = classificacoes?.categorias?.[form.tipo === "ENTRADA" ? "RECEBER" : "PAGAR"];

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      if (novo) await gc.criarLancamento(form);
      else await gc.atualizarLancamento(lancamento.id, form);
      avisar(novo ? "Lançamento registrado." : "Lançamento atualizado.");
      onSalvo();
      onFechar();
    } catch (err) {
      avisar(erroApi(err, "Não foi possível salvar o lançamento."), "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialogo aberto onFechar={onFechar} titulo={novo ? "Novo lançamento" : "Editar lançamento"} descricao="Movimento já realizado (sem vencimento) — entra direto no fluxo de caixa." largura="max-w-lg">
      <form onSubmit={salvar} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Segmentado
            opcoes={[
              ["SAIDA", "↓ Saída (gasto)"],
              ["ENTRADA", "↑ Entrada"],
            ]}
            valor={form.tipo}
            onChange={(v) => set("tipo", v)}
          />
        </div>
        <Campo label="Descrição *" className="col-span-2">
          <input className={inputCls} required value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Ex.: Material de limpeza" autoFocus />
        </Campo>
        <Campo label="Categoria *">
          <InputSugestao id="gc-l-cat" opcoes={categorias} required value={form.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Escolha ou digite" />
        </Campo>
        <Campo label="Valor *">
          <input type="number" min="0" step="0.01" required className={inputCls} value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" />
        </Campo>
        <Campo label="Data">
          <input type="date" max={hoje()} required className={inputCls} value={form.data} onChange={(e) => set("data", e.target.value)} />
        </Campo>
        <Campo label="Centro de custo">
          <InputSugestao id="gc-l-cc" opcoes={classificacoes?.centrosCusto} value={form.centroCusto} onChange={(e) => set("centroCusto", e.target.value)} />
        </Campo>
        <Campo label="Conta bancária / caixa">
          <select className={inputCls} value={form.contaBancariaId} onChange={(e) => set("contaBancariaId", e.target.value)}>
            <option value="">—</option>
            {bancos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Forma de pagamento">
          <InputSugestao id="gc-l-forma" opcoes={classificacoes?.formasPagamento} value={form.formaPagamento} onChange={(e) => set("formaPagamento", e.target.value)} />
        </Campo>
        <div className="col-span-2">
          <Rodape>
            <Botao variante="contorno" onClick={onFechar}>
              Cancelar
            </Botao>
            <Botao type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : novo ? "Registrar" : "Salvar"}
            </Botao>
          </Rodape>
        </div>
      </form>
    </Dialogo>
  );
}
