import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";
import { Icone } from "./dashboard/fx";
import "./dashboard/dashboard.css";

// Links do menu, com a mesma regra de permissão de antes.
const LINKS = [
  { to: "/", label: "Dashboard", icone: "dashboard" },
  { to: "/movimentacoes", label: "Movimentações", icone: "box" },
  { to: "/maquinas", label: "Máquinas", icone: "gamepad" },
  { to: "/lojas", label: "Lojas", icone: "store" },
  { to: "/produtos", label: "Produtos", icone: "tag" },
  { to: "/financeiro", label: "Financeiro", icone: "wallet", roles: ["ADMIN", "FINANCEIRO"] },
  { to: "/graficos", label: "Gráficos", icone: "chart", roles: ["ADMIN"] },
  { to: "/alertas-estoque", label: "Alertas", labelMobile: "Alertas de Estoque", icone: "bell", roles: ["ADMIN"] },
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

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  const links = LINKS.filter((l) => !l.roles || l.roles.includes(usuario?.role));
  const ehAdmin = usuario?.role === "ADMIN";

  return (
    <nav className="bm-nav relative z-40 text-white">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3 sm:h-18">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/" className="group flex shrink-0 items-center" title="Ir para o Dashboard">
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

            {/* Menu Desktop */}
            <div className="hidden min-w-0 items-center gap-0.5 xl:flex">
              {links.map((l) => (
                <Link key={l.to} to={l.to} className={`bm-nav-link ${isActive(l.to) ? "is-active" : ""}`} aria-current={isActive(l.to) ? "page" : undefined}>
                  <Icone nome={l.icone} className="h-4 w-4" />
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* User Info e Logout */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Entre xl e 2xl o menu ocupa a largura: o nome vira só o avatar (com dica). */}
            <div
              className="hidden items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-3 md:flex xl:pr-1.5 2xl:pr-3"
              title={`${usuario?.nome || ""} · ${ehAdmin ? "Administrador" : "Funcionário"}`}
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-linear-to-br from-[#3a7bff] to-[#2457b1] text-xs font-bold ring-1 ring-white/20">
                {iniciais(usuario?.nome)}
              </span>
              <div className="leading-tight xl:hidden 2xl:block">
                <div className="max-w-40 truncate text-sm font-semibold text-white">{usuario?.nome}</div>
                <div className={`flex items-center gap-1 text-[11px] font-medium ${ehAdmin ? "text-[#ffd84a]" : "text-slate-300"}`}>
                  {ehAdmin && <Icone nome="shield" className="h-3 w-3" strokeWidth={2.2} />}
                  {ehAdmin ? "Administrador" : "Funcionário"}
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
            {/* Botão Hamburger Mobile */}
            <button
              onClick={toggleMenu}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 transition-colors hover:bg-white/10 xl:hidden"
              aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={isMenuOpen}
            >
              <Icone nome={isMenuOpen ? "x" : "menu"} className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Menu Mobile Dropdown */}
      {isMenuOpen && (
        <div className="bm-menu-panel border-t border-white/10 bg-[#081329]/95 backdrop-blur xl:hidden">
          <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
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
                  {l.labelMobile || l.label}
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
                  {ehAdmin ? "Administrador" : "Funcionário"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
