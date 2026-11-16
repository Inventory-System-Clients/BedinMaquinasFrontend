import { useEffect, useState } from "react";
import { Botao, Campo, Dialogo, InputSugestao, Rodape, Segmentado, inputCls } from "./ui";
import { useAviso } from "./hooks";
import { TEXTOS, brl, dataBR, erroApi, gc, gerarParcelas, hoje, somarMeses } from "./utils";

// "Nova conta a pagar/receber": cabeçalho (o quê, quem, classificação) + condições de
// pagamento. Cada vencimento vira uma conta, baixada individualmente — parcelamento
// (valor dividido) ou recorrência (mesmo valor todo mês, ex.: aluguel, internet).

const CABECALHO_VAZIO = {
  descricao: "",
  pessoa: "",
  categoria: "",
  grupo: "",
  centroCusto: "",
  documento: "",
  formaPagamento: "",
  contaBancariaId: "",
  observacao: "",
};

export function ContaFormDialog({ tipo, aberto, onFechar, onSalvo, classificacoes, bancos }) {
  const t = TEXTOS[tipo];
  const avisar = useAviso();
  const [cab, setCab] = useState(CABECALHO_VAZIO);
  const [modo, setModo] = useState("unica");
  const [unica, setUnica] = useState({ vencimento: hoje(), valor: "", quitada: false, dataQuitacao: hoje() });
  const [cond, setCond] = useState({ valor: "", quantidade: "3", primeiro: hoje(), intervalo: "mensal", dias: "30" });
  const [linhas, setLinhas] = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setCab(CABECALHO_VAZIO);
    setModo("unica");
    setUnica({ vencimento: hoje(), valor: "", quitada: false, dataQuitacao: hoje() });
    setCond({ valor: "", quantidade: tipo === "PAGAR" ? "3" : "2", primeiro: hoje(), intervalo: "mensal", dias: "30" });
    setLinhas([]);
  }, [aberto, tipo]);

  const set = (k, v) => setCab((c) => ({ ...c, [k]: v }));
  const valorCond = Number(String(cond.valor).replace(",", ".")) || 0;
  const somaLinhas = linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const diferenca = Math.round((valorCond - somaLinhas) * 100) / 100;

  function gerar() {
    const quantidade = Math.max(1, Math.min(120, Math.floor(Number(cond.quantidade) || 1)));
    if (!(valorCond > 0)) return avisar(modo === "parcelada" ? "Informe o valor total." : "Informe o valor de cada mês.", "erro");
    if (!cond.primeiro) return avisar("Informe o 1º vencimento.", "erro");
    if (modo === "parcelada") {
      const intervalo = cond.intervalo === "dias" ? Math.max(1, Number(cond.dias) || 30) : 0;
      setLinhas(gerarParcelas(valorCond, quantidade, cond.primeiro, intervalo).map((p) => ({ ...p, valor: p.valor.toFixed(2) })));
    } else {
      setLinhas(Array.from({ length: quantidade }, (_, i) => ({ vencimento: somarMeses(cond.primeiro, i), valor: valorCond.toFixed(2) })));
    }
  }

  function setLinha(i, campo, valor) {
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  }

  async function salvar(e) {
    e.preventDefault();
    if (!cab.descricao.trim()) return avisar("Informe a descrição.", "erro");
    if (!cab.categoria.trim()) return avisar("Informe a categoria.", "erro");

    let parcelas;
    if (modo === "unica") {
      const valor = Number(String(unica.valor).replace(",", "."));
      if (!(valor > 0)) return avisar("Informe o valor.", "erro");
      if (!unica.vencimento) return avisar("Informe o vencimento.", "erro");
      parcelas = [{ vencimento: unica.vencimento, valor, ...(unica.quitada ? { quitada: { data: unica.dataQuitacao } } : {}) }];
    } else {
      if (linhas.length === 0) return avisar('Clique em "Gerar vencimentos" antes de salvar.', "erro");
      if (linhas.some((l) => !l.vencimento || !(Number(l.valor) > 0))) return avisar("Confira vencimento e valor de todas as parcelas.", "erro");
      if (modo === "parcelada" && Math.abs(diferenca) >= 0.01) {
        return avisar(`A soma das parcelas (${brl(somaLinhas)}) não bate com o valor total (${brl(valorCond)}).`, "erro");
      }
      parcelas = linhas.map((l) => ({ vencimento: l.vencimento, valor: Number(l.valor) }));
    }

    setSalvando(true);
    try {
      const contas = await gc.criarContas({ ...cab, tipo, recorrente: modo === "recorrente", parcelas });
      avisar(contas.length > 1 ? `${contas.length} vencimentos lançados em ${t.titulo.toLowerCase()}.` : "Conta lançada.");
      onSalvo();
      onFechar();
    } catch (err) {
      avisar(erroApi(err, "Não foi possível lançar a conta."), "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialogo aberto={aberto} onFechar={onFechar} titulo={t.nova} largura="max-w-3xl">
      <form onSubmit={salvar} className="grid gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <Campo label="Descrição *" className="sm:col-span-4">
            <input className={inputCls} value={cab.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder={tipo === "PAGAR" ? "Ex.: Aluguel do galpão" : "Ex.: Locação de máquinas — Loja Centro"} autoFocus />
          </Campo>
          <Campo label="Nº documento" className="sm:col-span-2">
            <input className={inputCls} value={cab.documento} onChange={(e) => set("documento", e.target.value)} placeholder="Boleto, NF, contrato..." />
          </Campo>
          <Campo label={t.pessoa} className="sm:col-span-3">
            <InputSugestao id={`gc-pessoa-${tipo}`} opcoes={classificacoes?.pessoas?.[tipo]} value={cab.pessoa} onChange={(e) => set("pessoa", e.target.value)} placeholder="Nome" />
          </Campo>
          <Campo label="Categoria *" className="sm:col-span-3">
            <InputSugestao id={`gc-cat-${tipo}`} opcoes={classificacoes?.categorias?.[tipo]} value={cab.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Escolha ou digite" />
          </Campo>
          <Campo label="Grupo" className="sm:col-span-3">
            <InputSugestao id="gc-grupo" opcoes={classificacoes?.grupos} value={cab.grupo} onChange={(e) => set("grupo", e.target.value)} placeholder="Ex.: Despesas fixas" />
          </Campo>
          <Campo label="Centro de custo / setor" className="sm:col-span-3">
            <InputSugestao id="gc-cc" opcoes={classificacoes?.centrosCusto} value={cab.centroCusto} onChange={(e) => set("centroCusto", e.target.value)} placeholder="Ex.: Administração, Operação" />
          </Campo>
          <Campo label="Conta bancária prevista" className="sm:col-span-3">
            <select className={inputCls} value={cab.contaBancariaId} onChange={(e) => set("contaBancariaId", e.target.value)}>
              <option value="">—</option>
              {bancos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Forma de pagamento" className="sm:col-span-3">
            <InputSugestao id="gc-forma" opcoes={classificacoes?.formasPagamento} value={cab.formaPagamento} onChange={(e) => set("formaPagamento", e.target.value)} placeholder="PIX, Boleto..." />
          </Campo>
          <Campo label="Observação" className="sm:col-span-6">
            <input className={inputCls} value={cab.observacao} onChange={(e) => set("observacao", e.target.value)} placeholder="Opcional" />
          </Campo>
        </div>
        <p className="-mt-2 text-xs text-gray-400">Categorias, grupos, centros de custo e nomes novos ficam salvos e aparecem como sugestão nos próximos lançamentos.</p>

        <fieldset className="grid gap-3 rounded-xl border border-gray-200 p-3">
          <legend className="px-1 text-sm font-semibold text-gray-700">Condições de pagamento</legend>
          <Segmentado
            opcoes={[
              ["unica", "Única"],
              ["parcelada", "Parcelada"],
              ["recorrente", "Recorrente (todo mês)"],
            ]}
            valor={modo}
            onChange={(m) => {
              setModo(m);
              setLinhas([]);
            }}
          />

          {modo === "unica" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Campo label="Vencimento *">
                <input type="date" className={inputCls} value={unica.vencimento} onChange={(e) => setUnica((u) => ({ ...u, vencimento: e.target.value }))} />
              </Campo>
              <Campo label="Valor *">
                <input type="number" min="0" step="0.01" className={inputCls} value={unica.valor} onChange={(e) => setUnica((u) => ({ ...u, valor: e.target.value }))} placeholder="0,00" />
              </Campo>
              <div className="grid content-end gap-1">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={unica.quitada} onChange={(e) => setUnica((u) => ({ ...u, quitada: e.target.checked }))} />
                  Já foi {t.quitada.toLowerCase()}
                </label>
                {unica.quitada && (
                  <input type="date" max={hoje()} className={inputCls} value={unica.dataQuitacao} onChange={(e) => setUnica((u) => ({ ...u, dataQuitacao: e.target.value }))} aria-label={t.dataQuitacao} />
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <Campo label={modo === "parcelada" ? "Valor total *" : "Valor por mês *"}>
                  <input type="number" min="0" step="0.01" className={`${inputCls} w-36`} value={cond.valor} onChange={(e) => setCond((c) => ({ ...c, valor: e.target.value }))} placeholder="0,00" />
                </Campo>
                <Campo label={modo === "parcelada" ? "Parcelas" : "Meses"}>
                  <input type="number" min="1" max="120" className={`${inputCls} w-20`} value={cond.quantidade} onChange={(e) => setCond((c) => ({ ...c, quantidade: e.target.value }))} />
                </Campo>
                <Campo label="1º vencimento">
                  <input type="date" className={`${inputCls} w-40`} value={cond.primeiro} onChange={(e) => setCond((c) => ({ ...c, primeiro: e.target.value }))} />
                </Campo>
                {modo === "parcelada" && (
                  <Campo label="Intervalo">
                    <div className="flex gap-1">
                      <select className={`${inputCls} w-32`} value={cond.intervalo} onChange={(e) => setCond((c) => ({ ...c, intervalo: e.target.value }))}>
                        <option value="mensal">Mensal</option>
                        <option value="dias">A cada N dias</option>
                      </select>
                      {cond.intervalo === "dias" && (
                        <input type="number" min="1" className={`${inputCls} w-20`} value={cond.dias} onChange={(e) => setCond((c) => ({ ...c, dias: e.target.value }))} aria-label="Dias entre parcelas" />
                      )}
                    </div>
                  </Campo>
                )}
                <Botao variante="contorno" onClick={gerar}>
                  ⟳ Gerar vencimentos
                </Botao>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">#</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Vencimento</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Valor</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {linhas.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-sm text-gray-400">
                          Preencha acima e clique em &quot;Gerar vencimentos&quot; — dá pra ajustar data e valor de cada um.
                        </td>
                      </tr>
                    )}
                    {linhas.map((l, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-sm text-gray-500">
                          {i + 1}/{linhas.length}
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="date" className={`${inputCls} w-40 py-1`} value={l.vencimento} onChange={(e) => setLinha(i, "vencimento", e.target.value)} />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="number" min="0" step="0.01" className={`${inputCls} w-32 py-1`} value={l.valor} onChange={(e) => setLinha(i, "valor", e.target.value)} />
                        </td>
                        <td className="px-2">
                          <button type="button" className="text-gray-400 hover:text-red-600" onClick={() => setLinhas((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remover vencimento">
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {linhas.length > 0 && (
                <div className="flex flex-wrap justify-end gap-4 text-sm">
                  <span>
                    Total: <strong>{brl(somaLinhas)}</strong> em {linhas.length} vencimentos ({dataBR(linhas[0].vencimento)} a {dataBR(linhas[linhas.length - 1].vencimento)})
                  </span>
                  {modo === "parcelada" && (
                    <span className={Math.abs(diferenca) >= 0.01 ? "font-semibold text-red-600" : "text-gray-500"}>
                      {Math.abs(diferenca) < 0.01 ? "✓ Bate com o valor total" : diferenca > 0 ? `Faltam ${brl(diferenca)}` : `Passou ${brl(-diferenca)}`}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </fieldset>

        <Rodape>
          <Botao variante="contorno" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : `Salvar ${tipo === "PAGAR" ? "conta a pagar" : "conta a receber"}`}
          </Botao>
        </Rodape>
      </form>
    </Dialogo>
  );
}

/** Edição de uma conta já lançada (inclusive data/valor da quitação, se já baixada). */
export function EditarContaDialog({ conta, onFechar, onSalvo, classificacoes, bancos }) {
  const avisar = useAviso();
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!conta) return;
    setForm({
      descricao: conta.descricao,
      pessoa: conta.pessoa ?? "",
      categoria: conta.categoria,
      grupo: conta.grupo ?? "",
      centroCusto: conta.centroCusto ?? "",
      documento: conta.documento ?? "",
      formaPagamento: conta.formaPagamento ?? "",
      contaBancariaId: conta.contaBancariaId ?? "",
      observacao: conta.observacao ?? "",
      valor: String(conta.valor),
      vencimento: conta.vencimento,
      dataQuitacao: conta.dataQuitacao ?? "",
      valorQuitado: conta.valorQuitado != null ? String(conta.valorQuitado) : "",
    });
  }, [conta]);

  if (!conta || !form) return null;
  const t = TEXTOS[conta.tipo];
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const { dataQuitacao, valorQuitado, ...resto } = form;
      await gc.atualizarConta(conta.id, {
        ...resto,
        ...(conta.status === "QUITADA" ? { dataQuitacao, valorQuitado } : {}),
      });
      avisar("Conta atualizada.");
      onSalvo();
      onFechar();
    } catch (err) {
      avisar(erroApi(err, "Não foi possível salvar."), "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialogo aberto onFechar={onFechar} titulo="Editar conta" descricao={conta.parcelaTotal ? `Parcela ${conta.parcelaNumero}/${conta.parcelaTotal} — só esta parcela é alterada.` : null} largura="max-w-2xl">
      <form onSubmit={salvar} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Descrição" className="sm:col-span-2">
          <input className={inputCls} required value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
        </Campo>
        <Campo label={t.pessoa}>
          <InputSugestao id="gc-ed-pessoa" opcoes={classificacoes?.pessoas?.[conta.tipo]} value={form.pessoa} onChange={(e) => set("pessoa", e.target.value)} />
        </Campo>
        <Campo label="Categoria">
          <InputSugestao id="gc-ed-cat" opcoes={classificacoes?.categorias?.[conta.tipo]} required value={form.categoria} onChange={(e) => set("categoria", e.target.value)} />
        </Campo>
        <Campo label="Grupo">
          <InputSugestao id="gc-ed-grupo" opcoes={classificacoes?.grupos} value={form.grupo} onChange={(e) => set("grupo", e.target.value)} />
        </Campo>
        <Campo label="Centro de custo">
          <InputSugestao id="gc-ed-cc" opcoes={classificacoes?.centrosCusto} value={form.centroCusto} onChange={(e) => set("centroCusto", e.target.value)} />
        </Campo>
        <Campo label="Valor">
          <input type="number" min="0" step="0.01" className={inputCls} required value={form.valor} onChange={(e) => set("valor", e.target.value)} />
        </Campo>
        <Campo label="Vencimento">
          <input type="date" className={inputCls} required value={form.vencimento} onChange={(e) => set("vencimento", e.target.value)} />
        </Campo>
        <Campo label="Nº documento">
          <input className={inputCls} value={form.documento} onChange={(e) => set("documento", e.target.value)} />
        </Campo>
        <Campo label="Forma de pagamento">
          <InputSugestao id="gc-ed-forma" opcoes={classificacoes?.formasPagamento} value={form.formaPagamento} onChange={(e) => set("formaPagamento", e.target.value)} />
        </Campo>
        <Campo label="Conta bancária" className="sm:col-span-2">
          <select className={inputCls} value={form.contaBancariaId} onChange={(e) => set("contaBancariaId", e.target.value)}>
            <option value="">—</option>
            {bancos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </Campo>
        {conta.status === "QUITADA" && (
          <>
            <Campo label={t.dataQuitacao}>
              <input type="date" max={hoje()} className={inputCls} value={form.dataQuitacao} onChange={(e) => set("dataQuitacao", e.target.value)} />
            </Campo>
            <Campo label={t.valorQuitado}>
              <input type="number" min="0" step="0.01" className={inputCls} value={form.valorQuitado} onChange={(e) => set("valorQuitado", e.target.value)} />
            </Campo>
          </>
        )}
        <Campo label="Observação" className="sm:col-span-2">
          <textarea className={inputCls} rows={2} value={form.observacao} onChange={(e) => set("observacao", e.target.value)} />
        </Campo>
        <div className="sm:col-span-2">
          <Rodape>
            <Botao variante="contorno" onClick={onFechar}>
              Cancelar
            </Botao>
            <Botao type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Botao>
          </Rodape>
        </div>
      </form>
    </Dialogo>
  );
}
