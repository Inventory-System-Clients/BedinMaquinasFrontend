
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Veiculos from "./pages/Veiculos";
import { Suspense, lazy } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/AuthContext";
import { PrivateRoute } from "./components/PrivateRoute";
import { PageLoader } from "./components/Loading";
import { AlertaFinanceiro } from "./components/AlertaFinanceiro";
import RoteiroLocationTracker from "./components/RoteiroLocationTracker.jsx";

// Lazy load das páginas para reduzir bundle inicial
const Manutencoes = lazy(() => import("./pages/Manutencoes").then(m => ({ default: m.default })));
const GestaoCarrinhos = lazy(() => import("./pages/GestaoCarrinhos").then(m => ({ default: m.default })));

// Lazy load das páginas para reduzir bundle inicial
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const Registrar = lazy(() => import("./pages/Registrar").then(m => ({ default: m.Registrar })));
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Usuarios = lazy(() => import("./pages/Usuarios").then(m => ({ default: m.Usuarios })));
const UsuarioForm = lazy(() => import("./pages/UsuarioForm").then(m => ({ default: m.UsuarioForm })));
const Lojas = lazy(() => import("./pages/Lojas").then(m => ({ default: m.Lojas })));
const LojaForm = lazy(() => import("./pages/LojaForm").then(m => ({ default: m.LojaForm })));
const LojaDetalhes = lazy(() => import("./pages/LojaDetalhes").then(m => ({ default: m.LojaDetalhes })));
const Maquinas = lazy(() => import("./pages/Maquinas").then(m => ({ default: m.Maquinas })));
const MaquinaForm = lazy(() => import("./pages/MaquinaForm").then(m => ({ default: m.MaquinaForm })));
const MaquinaDetalhes = lazy(() => import("./pages/MaquinaDetalhes").then(m => ({ default: m.MaquinaDetalhes })));
const Produtos = lazy(() => import("./pages/Produtos").then(m => ({ default: m.Produtos })));
const ProdutoForm = lazy(() => import("./pages/ProdutoForm").then(m => ({ default: m.ProdutoForm })));
const Movimentacoes = lazy(() => import("./pages/Movimentacoes").then(m => ({ default: m.Movimentacoes })));
const SelecionarRoteiro = lazy(() => import("./pages/SelecionarRoteiro").then(m => ({ default: m.SelecionarRoteiro })));
const LojasRoteiro = lazy(() => import("./pages/LojasRoteiro").then(m => ({ default: m.LojasRoteiro })));
const MovimentacoesLoja = lazy(() => import("./pages/MovimentacoesLoja").then(m => ({ default: m.MovimentacoesLoja })));
const ExecutarRoteiro = lazy(() => import("./pages/ExecutarRoteiro").then(m => ({ default: m.ExecutarRoteiro })));
const Roteiros = lazy(() => import("./pages/Roteiros").then(m => ({ default: m.Roteiros })));
const GerenciarRoteiros = lazy(() => import("./pages/GerenciarRoteiros").then(m => ({ default: m.GerenciarRoteiros })));
const Financeiro = lazy(() => import("./pages/Financeiro").then(m => ({ default: m.Financeiro })));
const Graficos = lazy(() => import("./pages/Graficos").then(m => ({ default: m.Graficos })));
const Relatorios = lazy(() => import("./pages/Relatorios").then(m => ({ default: m.Relatorios })));
const AlertasEstoque = lazy(() => import("./pages/AlertasEstoque").then(m => ({ default: m.AlertasEstoque })));
const StyleGuide = lazy(() => import("./pages/StyleGuide").then(m => ({ default: m.StyleGuide })));

function AppRoutes() {
  const { usuario } = useAuth();

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <RoteiroLocationTracker usuario={usuario} />
        <AlertaFinanceiro />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/registrar" element={<Registrar />} />
          <Route path="/style-guide" element={<StyleGuide />} />
           <Route path="/veiculos" element={<Veiculos />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/usuarios"
            element={
              <PrivateRoute adminOnly>
                <Usuarios />
              </PrivateRoute>
            }
          />
          <Route
            path="/usuarios/novo"
            element={
              <PrivateRoute adminOnly>
                <UsuarioForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/usuarios/:id/editar"
            element={
              <PrivateRoute adminOnly>
                <UsuarioForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/carrinhos"
            element={
              <PrivateRoute>
                <GestaoCarrinhos />
              </PrivateRoute>
            }
          />
          <Route
            path="/lojas"
            element={
              <PrivateRoute>
                <Lojas />
              </PrivateRoute>
            }
          />
          <Route
            path="/lojas/:id"
            element={
              <PrivateRoute>
                <LojaDetalhes />
              </PrivateRoute>
            }
          />
          <Route
            path="/lojas/nova"
            element={
              <PrivateRoute>
                <LojaForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/lojas/:id/editar"
            element={
              <PrivateRoute>
                <LojaForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/maquinas"
            element={
              <PrivateRoute>
                <Maquinas />
              </PrivateRoute>
            }
          />
          <Route
            path="/maquinas/nova"
            element={
              <PrivateRoute>
                <MaquinaForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/maquinas/:id/editar"
            element={
              <PrivateRoute>
                <MaquinaForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/maquinas/:id"
            element={
              <PrivateRoute>
                <MaquinaDetalhes />
              </PrivateRoute>
            }
          />
          <Route
            path="/produtos"
            element={
              <PrivateRoute>
                <Produtos />
              </PrivateRoute>
            }
          />
          <Route
            path="/produtos/novo"
            element={
              <PrivateRoute>
                <ProdutoForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/produtos/:id/editar"
            element={
              <PrivateRoute>
                <ProdutoForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/movimentacoes"
            element={
              <PrivateRoute>
                <SelecionarRoteiro />
              </PrivateRoute>
            }
          />
          <Route
            path="/movimentacoes/roteiro/:roteiroId"
            element={
              <PrivateRoute>
                <LojasRoteiro />
              </PrivateRoute>
            }
          />
          <Route
            path="/movimentacoes/roteiro/:roteiroId/loja/:lojaId"
            element={
              <PrivateRoute>
                <MovimentacoesLoja />
              </PrivateRoute>
            }
          />
          <Route
            path="/roteiros"
            element={
              <PrivateRoute>
                <Roteiros />
              </PrivateRoute>
            }
          />
          <Route
            path="/roteiros/:id/executar"
            element={
              <PrivateRoute>
                <ExecutarRoteiro />
              </PrivateRoute>
            }
          />
          <Route
            path="/roteiros/gerenciar"
            element={
              <PrivateRoute adminOnly={true}>
                <GerenciarRoteiros />
              </PrivateRoute>
            }
          />
          <Route
            path="/financeiro"
            element={
              <PrivateRoute allowedRoles={["ADMIN", "FINANCEIRO"]}>
                <Financeiro />
              </PrivateRoute>
            }
          />
          <Route
            path="/graficos"
            element={
              <PrivateRoute adminOnly>
                <Graficos />
              </PrivateRoute>
            }
          />

          <Route
            path="/alertas-estoque"
            element={
              <PrivateRoute adminOnly>
                <AlertasEstoque />
              </PrivateRoute>
            }
          />

          <Route
            path="/relatorios"
            element={
              <PrivateRoute adminOnly>
                <Relatorios />
              </PrivateRoute>
            }
          />

          <Route
            path="/manutencoes"
            element={
              <PrivateRoute>
                <Manutencoes />
              </PrivateRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
