import { createContext, useContext, useState } from "react";
import Swal from "sweetalert2";

// Hooks e helpers (não-componentes) da Gestão de Contas — separados de ui.jsx para o
// fast refresh do Vite funcionar.

export const ToastCtx = createContext(() => {});

/** avisar(mensagem, "sucesso" | "erro") — toast no canto da tela (ver ToastProvider). */
export function useAviso() {
  return useContext(ToastCtx);
}

/** "Ver mais": começa com 10 e busca tudo do filtro ao clicar; volta a 10 quando a chave muda. */
export function useVerMais(chave) {
  const [chaveTodos, setChaveTodos] = useState(null);
  return { pageSize: chaveTodos === chave ? "all" : 10, verMais: () => setChaveTodos(chave) };
}

export async function confirmar(titulo, texto, botao = "Confirmar", perigo = true) {
  const r = await Swal.fire({
    title: titulo,
    text: texto,
    icon: perigo ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: botao,
    cancelButtonText: "Voltar",
    confirmButtonColor: perigo ? "#dc2626" : "#2457B1",
    reverseButtons: true,
  });
  return r.isConfirmed;
}
