import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useRef, useState } from "react";
import { Icone } from "./dashboard/fx";
import "./dashboard/dashboard.css";

// Header enxuto (padrão AgarraMais): hambúrguer sempre visível + logo à esquerda,
// usuário e Sair à direita. Os links abrem num painel sobreposto, sem empurrar a página.
const LINKS = [
  { to: "/", label: "Dashboard", icone: "dashboard" },
  { to: "/movimentacoes", label: "Movimentações", icone: "box" },
  { to: "/maquinas", label: "Máquinas", icone: "gamepad" },
  { to: "/lojas", label: "Lojas", icone: "store" },
  { to: "/produtos", label: "Produtos", icone: "tag" },
  // Financeiro = Gestão de Contas (contas a pagar/receber, bancos, fluxo de caixa, WhatsApp)
  { to: "/financeiro", label: "Financeiro", icone: "wallet", roles: ["ADMIN", "FINANCEIRO"] },
  { to: "/graficos", label: "Gráficos", icone: "chart", roles: ["ADMIN"] },
  { to: "/alertas-estoque", label: "Alertas de Estoque", icone: "bell", roles: ["ADMIN"] },
  { to: "/relatorios", label: "Relatórios", icone: "file", roles: ["ADMIN"] },
  { to: "/usuarios", label: "Usuários", icone: "users", roles: ["ADMIN"] },
];

function iniciais(nome = "") {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] || "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase() || "?";
}

export function Navbar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;
  const closeMenu = () => setIsMenuOpen(false);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const clicarFora = (e) => {
      if (menuRef.current?.contains(e.target) || menuButtonRef.current?.contains(e.target)) return;
      setIsMenuOpen(false);
    };
    const tecla = (e) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", clicarFora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", clicarFora);
      document.removeEventListener("keydown", tecla);
    };
  }, [isMenuOpen]);

  const links = LINKS.filter((l) => !l.roles || l.roles.includes(usuario?.role));
  const ehAdmin = usuario?.role === "ADMIN";
  // Página atual = link de caminho mais longo que casa com a URL (ex.: /movimentacoes/roteiro/...).
  const paginaAtual =
    location.pathname === "/"
      ? LINKS[0]
      : LINKS.filter((l) => l.to !== "/" && (location.pathname === l.to || location.pathname.startsWith(`${l.to}/`))).sort((a, b) => b.to.length - a.to.length)[0];

  return (
    <nav className="bm-nav relative z-50 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3 sm:h-18">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              ref={menuButtonRef}
              onClick={() => setIsMenuOpen((v) => !v)}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors ${
                isMenuOpen ? "border-[#3ee6ff]/50 bg-white/15" : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
              aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={isMenuOpen}
              aria-controls="menu-principal"
            >
              <Icone nome={isMenuOpen ? "x" : "menu"} className="h-5 w-5" />
            </button>

            <Link to="/" onClick={closeMenu} className="group flex shrink-0 items-center" title="Ir para o Dashboard">
              {/* O PNG é quadrado com margem transparente: o tamanho maior compensa a margem. */}
              <img
                src="/logo.png"
                alt="Bedin Máquinas"
                className="-my-3 h-20 w-20 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-105 sm:h-22 sm:w-22"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            </Link>

            {paginaAtual && (
              <span className="hidden items-center gap-2 truncate border-l border-white/15 pl-3 text-sm font-medium text-slate-300 sm:flex">
                <Icone nome={paginaAtual.icone} className="h-4 w-4 text-[#3ee6ff]" />
                {paginaAtual.label}
              </span>
            )}
          </div>

          {/* User Info e Logout */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-3 md:flex">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-linear-to-br from-[#3a7bff] to-[#2457b1] text-xs font-bold ring-1 ring-white/20">
                {iniciais(usuario?.nome)}
              </span>
              <div className="leading-tight">
                <div className="max-w-40 truncate text-sm font-semibold text-white">{usuario?.nome}</div>
                <div className={`flex items-center gap-1 text-[11px] font-medium ${ehAdmin ? "text-[#ffd84a]" : "text-slate-300"}`}>
                  {ehAdmin && <Icone nome="shield" className="h-3 w-3" strokeWidth={2.2} />}
                  {ehAdmin ? "Administrador" : usuario?.role === "FINANCEIRO" ? "Financeiro" : "Funcionário"}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bm-btn border border-red-400/40 bg-red-500/10 px-3 py-2 text-red-100 hover:border-red-400 hover:bg-[#ed3136] hover:text-white"
            >
              <Icone nome="logout" className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Painel do menu (todas as telas), sobreposto ao conteúdo */}
      {isMenuOpen && (
        <div
          id="menu-principal"
          ref={menuRef}
          className="bm-menu-panel absolute inset-x-0 top-full max-h-[calc(100vh-4.5rem)] overflow-y-auto border-t border-white/10 bg-[#081329]/97 shadow-2xl backdrop-blur"
        >
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={closeMenu}
                  aria-current={isActive(l.to) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive(l.to) ? "bg-[#3a7bff]/25 text-white ring-1 ring-[#7aa7ff]/40" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icone nome={l.icone} className={`h-5 w-5 ${isActive(l.to) ? "text-[#3ee6ff]" : ""}`} />
                  {l.label}
                </Link>
              ))}
            </div>

            {/* User Info Mobile */}
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 md:hidden">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-linear-to-br from-[#3a7bff] to-[#2457b1] text-xs font-bold">{iniciais(usuario?.nome)}</span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-white">{usuario?.nome}</div>
                <div className={`mt-0.5 flex items-center gap-1 text-xs ${ehAdmin ? "text-[#ffd84a]" : "text-slate-300"}`}>
                  {ehAdmin && <Icone nome="shield" className="h-3 w-3" strokeWidth={2.2} />}
                  {ehAdmin ? "Administrador" : usuario?.role === "FINANCEIRO" ? "Financeiro" : "Funcionário"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
