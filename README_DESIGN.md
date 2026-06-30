# Sistema Bedin Máquinas - Frontend

Sistema moderno e completo de gestão de estoque para máquinas de pelúcias.

## 🎨 Design System

Este projeto foi desenvolvido com um design moderno e profissional, especialmente criado para o universo das pelúcias. As cores quentes e acolhedoras combinadas com componentes modernos criam uma experiência visual única.

### Paleta de Cores

- **#F2A20C** - Primary Orange (Laranja principal)
- **#F2B705** - Accent Yellow (Amarelo dourado)
- **#F2DC99** - Accent Cream (Creme suave)
- **#F2F2F2** - Background Light (Cinza claro)
- **#0D0D0D** - Background Dark (Preto suave)

### Características do Design

✨ **Moderno e Profissional**

- Gradientes suaves
- Sombras elegantes
- Animações fluidas
- Bordas arredondadas

🎯 **Focado em UX**

- Componentes reutilizáveis
- Feedback visual claro
- Estados de loading personalizados
- Responsivo em todos os dispositivos

🧸 **Temático**

- Emojis de pelúcia
- Cores quentes e acolhedoras
- Padrões decorativos sutis
- Design lúdico mas profissional

## 📦 Componentes Disponíveis

### Componentes de UI Principais

- **Navbar** - Barra de navegação com gradiente e menu ativo
- **Footer** - Rodapé informativo com links e contatos
- **Cards** - Diversos tipos (card, card-gradient, stat-card)
- **Buttons** - btn-primary, btn-secondary, btn-success, btn-danger
- **Inputs** - input-field, select-field
- **Badges** - Para status e informações
- **Alerts** - Mensagens contextuais
- **Tables** - Tabelas modernas com ícones
- **Modals** - Diálogos customizáveis
- **Loading States** - Spinners e loaders temáticos

### Componentes Utilitários

- **PageHeader** - Cabeçalho de página padronizado
- **StatsGrid** - Grid de estatísticas
- **DataTable** - Tabela de dados com renderização customizada
- **AlertBox** - Caixas de alerta com tipos
- **EmptyState** - Estado vazio com ação
- **ConfirmDialog** - Diálogo de confirmação

## 🚀 Como Usar

### Acessar o Style Guide

Visite `/style-guide` para ver todos os componentes em ação e exemplos de uso.

### Exemplo de Uso - Card de Estatística

```jsx
<div className="stat-card bg-gradient-to-br from-primary to-accent-yellow">
  <div className="relative z-10">
    <h3 className="text-sm font-medium opacity-90">Título</h3>
    <p className="text-3xl font-bold">Valor</p>
  </div>
</div>
```

### Exemplo de Uso - Botão

```jsx
<button className="btn-primary">Ação Principal</button>
```

### Exemplo de Uso - Input

```jsx
<input type="text" className="input-field" placeholder="Digite algo..." />
```

## 📁 Estrutura do Projeto

```
src/
├── components/
│   ├── Navbar.jsx          # Barra de navegação
│   ├── Footer.jsx          # Rodapé
│   ├── Loading.jsx         # Componentes de loading
│   ├── UIComponents.jsx    # Componentes reutilizáveis
│   └── PrivateRoute.jsx    # Proteção de rotas
├── pages/
│   ├── Login.jsx           # Página de login
│   ├── Registrar.jsx       # Página de registro
│   ├── Dashboard.jsx       # Dashboard principal
│   ├── StyleGuide.jsx      # Guia de estilos
│   └── ...
├── contexts/
│   └── AuthContext.jsx     # Contexto de autenticação
├── services/
│   └── api.js             # Configuração da API
├── index.css              # Estilos globais e componentes
└── App.jsx                # Aplicação principal
```

## 🎨 Arquivos de Design

- **DESIGN.md** - Documentação completa do design system
- **index.css** - Classes utilitárias e componentes CSS
- **tailwind.config.js** - Configuração das cores e tema

## 🛠️ Tecnologias

- **React** - Biblioteca principal
- **React Router** - Navegação
- **Tailwind CSS** - Framework CSS
- **Vite** - Build tool
- **Axios** - Cliente HTTP

## 📱 Responsividade

O sistema é totalmente responsivo com breakpoints:

- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px

## 🎯 Boas Práticas

### Ao adicionar novos componentes:

1. Use as classes utilitárias do `index.css`
2. Mantenha a paleta de cores definida
3. Adicione emojis temáticos onde apropriado
4. Siga os padrões de espaçamento estabelecidos
5. Garanta responsividade em todos os tamanhos

### Ao criar novas páginas:

```jsx
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";

export function MinhaPage() {
  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Minha Página" subtitle="Descrição" icon="🎯" />

        {/* Seu conteúdo aqui */}
      </div>

      <Footer />
    </div>
  );
}
```

## 🔗 Links Úteis

- Style Guide: `/style-guide`
- Documentação do Design: `DESIGN.md`
- Tailwind Config: `tailwind.config.js`

## 🎨 Capturas de Tela

### Login

Design moderno com gradientes e elementos decorativos

### Dashboard

Cards de estatísticas coloridos e tabelas elegantes

### Style Guide

Todos os componentes em um só lugar para referência

## 👨‍💻 Desenvolvimento

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Build para produção
npm run build
```

## 📄 Licença

Este projeto foi desenvolvido para a empresa Bedin Máquinas.

---

**Desenvolvido com ❤️ para gestão de pelúcias 🧸**
