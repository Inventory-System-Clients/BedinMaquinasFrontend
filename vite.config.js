import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar React e dependências principais
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Separar componentes de UI e contextos
          'components': [
            './src/components/Navbar.jsx',
            './src/components/Footer.jsx',
            './src/components/Loading.jsx',
            './src/components/UIComponents.jsx',
            './src/contexts/AuthContext.jsx'
          ],
          // Páginas de usuário e autenticação
          'auth-pages': [
            './src/pages/Login.jsx',
            './src/pages/Registrar.jsx',
            './src/pages/Usuarios.jsx',
            './src/pages/UsuarioForm.jsx'
          ],
          // Páginas de gerenciamento de lojas e máquinas
          'management-pages': [
            './src/pages/Lojas.jsx',
            './src/pages/LojaForm.jsx',
            './src/pages/LojaDetalhes.jsx',
            './src/pages/Maquinas.jsx',
            './src/pages/MaquinaForm.jsx',
            './src/pages/MaquinaDetalhes.jsx',
            './src/pages/Produtos.jsx',
            './src/pages/ProdutoForm.jsx'
          ],
          // Páginas de roteiros e movimentações
          'roteiro-pages': [
            './src/pages/Roteiros.jsx',
            './src/pages/SelecionarRoteiro.jsx',
            './src/pages/LojasRoteiro.jsx',
            './src/pages/MovimentacoesLoja.jsx',
            './src/pages/GerenciarRoteiros.jsx',
            './src/pages/Movimentacoes.jsx'
          ],
          // Páginas de relatórios e gráficos
          'analytics-pages': [
            './src/pages/Graficos.jsx',
            './src/pages/Relatorios.jsx',
            './src/pages/Dashboard.jsx'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 600,
    sourcemap: false,
  }
});
