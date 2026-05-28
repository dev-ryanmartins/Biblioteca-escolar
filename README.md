# Biblioteca Escolar — Sistema de Controle

Sistema desktop completo para controle de biblioteca escolar do Ensino Fundamental, desenvolvido com **Tauri + Rust** no back-end e **React + TypeScript + Vite** no front-end.

---

## Pré-requisitos

Antes de compilar, instale as dependências abaixo na sua máquina:

### 1. Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. Node.js (v18+) e pnpm (ou npm)
```bash
# Com nvm (recomendado)
nvm install 20

# Instalar pnpm (opcional)
npm install -g pnpm
```

### 3. Tauri CLI e dependências do sistema

**Windows:**
- Instale o [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) ou o Visual Studio.
- Instale o [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (já incluso no Windows 11).

**macOS:**
```bash
xcode-select --install
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev build-essential curl wget file \
  libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

---

## Como instalar e executar

```bash
# 1. Entre na pasta do projeto
cd biblioteca-escolar

# 2. Instale as dependências JavaScript
npm install

# 3. Inicie em modo de desenvolvimento (abre a janela do app)
npm run tauri dev

# 4. Para gerar o instalador de produção (.exe / .dmg / .AppImage)
npm run tauri build
```

O instalador gerado estará em `src-tauri/target/release/bundle/`.

---

## Estrutura do Projeto

```
biblioteca-escolar/
├── src/                        # Front-end React
│   ├── pages/
│   │   ├── Login.tsx           # Tela de login / primeiro acesso
│   │   ├── Dashboard.tsx       # Painel com gráficos e estatísticas
│   │   ├── Students.tsx        # Cadastro e importação de alunos
│   │   ├── Books.tsx           # Acervo e importação de livros
│   │   ├── Loans.tsx           # Empréstimos, devolução e renovação
│   │   ├── Fines.tsx           # Multas pedagógicas
│   │   ├── Reports.tsx         # Relatórios mensais (PDF e CSV)
│   │   └── Users.tsx           # Gerenciamento de usuários
│   ├── components/
│   │   ├── Sidebar.tsx         # Menu lateral de navegação
│   │   └── Modal.tsx           # Componente de modal reutilizável
│   ├── types.ts                # Tipos TypeScript compartilhados
│   └── App.tsx                 # Roteamento e contexto de autenticação
│
└── src-tauri/
    └── src/
        └── main.rs             # Back-end Rust: SQLite + todos os comandos Tauri
```

---

## Funcionalidades

### 1. Autenticação
- Primeira execução: cria o administrador automaticamente.
- Usuários subsequentes são criados pelo administrador dentro do sistema.
- Apenas Nome e Senha são necessários.

### 2. Gerenciamento de Alunos
- Importação em lote via arquivo CSV.
- Validação de turmas: 1° ao 9° Ano, Turmas A e B (3° Ano inclui Turma C).
- Cadastro manual com nome, série, turma, telefone e e-mail.

**Formato do CSV de alunos:**
```
Nome, Série, Turma, Telefone, Email
Maria Silva, 3, C, (11) 99999-9999, maria@email.com
João Souza, 7, A, (11) 88888-8888, joao@email.com
```

### 3. Acervo de Livros
- Importação via planilha CSV com colunas:
  `Código, Título, Autor, Quantidade, Editora, Ano, Nome do Doador, Data de Doação`
- **Inferência automática de gênero** por palavras-chave no título/autor.
- Revisão de gêneros antes de confirmar a importação.
- Cadastro manual de novos livros.
- Gêneros: Aventura, Fantasia, Ficção Científica, Romance, Mistério/Terror, História/Biografia, Humor, Poesia, Infantil/Fábula, Educativo/Ciências, Clássico.

### 4. Empréstimos
- Busca de aluno e livro com autocomplete.
- Prazo padrão: 14 dias. Pode ser reduzido para 7 dias (−1 semana) ou definido manualmente.
- Botão **Renovar** com seleção de nova data de devolução.
- Validação: aluno com atraso ou multa pendente não pode fazer novo empréstimo.

### 5. Multas Pedagógicas
- Gerada automaticamente quando um livro é devolvido em atraso.
- Aluno deve trazer um livro como doação.
- Botão **Dar Baixa na Multa**: registra o livro doado e adiciona ao acervo automaticamente.

### 6. Alertas no Painel
- Empréstimos em atraso.
- Multas pedagógicas pendentes.
- Empréstimos renovados.

### 7. Relatórios Mensais
- Filtro por mês (Janeiro a Dezembro) e ano.
- Estatísticas: total de empréstimos, devoluções, atrasos e multas regularizadas.
- Exportação em **PDF** (via jsPDF) e **CSV**.
- Gráfico de empréstimos por mês e distribuição por gênero.

---

## Banco de Dados

O banco SQLite é criado automaticamente na primeira execução, no diretório de dados do aplicativo:
- **Windows:** `C:\Users\<usuário>\AppData\Roaming\com.biblioteca.escolar\biblioteca.db`
- **macOS:** `~/Library/Application Support/com.biblioteca.escolar/biblioteca.db`
- **Linux:** `~/.local/share/com.biblioteca.escolar/biblioteca.db`

---

## Segurança de Senhas

As senhas são armazenadas como hash SHA-256 com salt fixo. Para produção em ambiente com dados sensíveis, considere migrar para bcrypt (crate `bcrypt`).

---

## Personalização

- Para alterar o nome do aplicativo: edite `src-tauri/tauri.conf.json` → `package.productName`.
- Para alterar o ícone: substitua os arquivos em `src-tauri/icons/` (veja a [documentação do Tauri](https://tauri.app/v1/guides/features/icons/)).
- Para alterar o prazo padrão de empréstimo: veja o componente `CreateLoanModal` em `src/pages/Loans.tsx`.
