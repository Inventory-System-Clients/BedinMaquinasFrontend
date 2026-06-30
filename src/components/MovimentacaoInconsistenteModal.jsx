export function MovimentacaoInconsistenteModal({
  inconsistencias,
  justificativa,
  setJustificativa,
  onCancel,
  onConfirm,
  loading = false,
}) {
  if (!Array.isArray(inconsistencias) || inconsistencias.length === 0) {
    return null;
  }

  const temCritica = inconsistencias.some(
    (item) => item.severidade === "critica",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Movimentação inconsistente
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Encontramos diferenças que precisam ser conferidas antes de
              salvar.
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold ${
              temCritica
                ? "border-red-200 bg-red-100 text-red-700"
                : "border-amber-200 bg-amber-100 text-amber-800"
            }`}
          >
            {temCritica ? "Crítica" : "Conferência"}
          </span>
        </div>

        <div className="mb-5 max-h-60 space-y-3 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
          {inconsistencias.map((item) => (
            <div key={item.codigo} className="rounded-lg bg-white p-3">
              <p className="font-semibold text-gray-900">{item.mensagem}</p>
              <p className="mt-1 text-sm text-gray-600">{item.motivo}</p>
            </div>
          ))}
        </div>

        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Justificativa *
        </label>
        <textarea
          value={justificativa}
          onChange={(event) => setJustificativa(event.target.value)}
          className="input-field min-h-28"
          placeholder="Explique por que a movimentação deve ser salva mesmo assim..."
        />

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={loading}
          >
            Voltar e corrigir
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-danger disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || justificativa.trim().length === 0}
          >
            {loading ? "Salvando..." : "Salvar como inconsistente"}
          </button>
        </div>
      </div>
    </div>
  );
}
