# 📡 Site Comissão Terra Fibra

Aplicação web desenvolvida para autenticação de consultores e simulação/cálculo de **Remuneração Variável (RV)** com base nas regras comerciais do projeto Terra Fibra.

---

## 🚀 Funcionalidades

### 🔐 Autenticação e Perfil
* **Login simplificado:** Acesso rápido utilizando número de telefone e senha (com suporte a autenticação automática via parâmetros de URL).
* **Cadastro de novos usuários:** Registro de consultores com gravação de perfil no Firestore (`users/{uid}`).
* **Sessão protegida:** Validação de login em tempo real na página inicial (`home.html`) para evitar acessos não autorizados.

### 🧮 Simulador de Comissões (RV)
* **Regras oficiais de Outubro/2026** (PDF "RV Geral Terra Oficial", 23 páginas) implementadas em `js/comissoes.js`, uma função por categoria:
  * Consultores PAP, Call Center e Digital (faixas + Acelerador de Qualidade)
  * Vendedor Loja (parcial), Líderes (PAP, Call Center, Digital), Coordenador Call Center
  * Executivo de Vendas e Gerente Regional
  * Casa Conectada
* **Interface dinâmica:** cada cargo mostra só os campos que precisa; resultado em R$ 1.234,56, com **memória de cálculo**, avisos e a página do PDF de origem.
* **Estimativa não oficial.** Onde o PDF é ambíguo o simulador exibe um aviso. Detalhes em `docs/REGRAS_RV_OUTUBRO_2026.md`.
* **Atualizar valores:** as regras são constantes no código; é preciso editar `js/comissoes.js` e publicar nova versão do site.
* **Testes:** `node --test` (39 testes, com os exemplos do PDF).

### 🛡️ Gestão Administrativa
* **Painel do Administrador (`admin.html`):** Portal para gerenciamento de contas registradas.
* **Controle de Usuários:** Permite atualizar nomes, telefones, redefinir senhas manuais ou excluir registros cadastrados da base de dados.

---

## 🛠️ Tecnologias Utilizadas

* **HTML5 & CSS3:** Interface responsiva construída com CSS nativo e variáveis globais para estilização fluida.
* **JavaScript ES6+ (Modules):** Estrutura modular sem dependência de frameworks pesados.
* **Firebase v10 (SDK Modular):**
  * **Firebase Authentication:** Gestão de acesso dos usuários.
  * **Cloud Firestore:** Armazenamento do perfil de consultores e controle de permissões.

---

## 📂 Estrutura do Projeto

```text
├── index.html           # Tela de Login de Consultores
├── cadastro.html        # Tela de Cadastro de novos usuários
├── home.html            # Painel do usuário & Simulador de Comissões
├── admin.html           # Painel de Administração de Usuários
├── css/
│   └── style.css        # Estilos globais e paleta de cores
└── js/
    ├── firebase-config.js # Configuração do projeto Firebase (oculta)
    ├── firebase-init.js   # Inicialização dos serviços Firebase Auth e Firestore
    ├── auth.js            # Módulo de Autenticação (Login, Cadastro e Tratamento de Erros)
    ├── phone.js           # Utilitário de normalização de telefone
    ├── comissoes.js       # Regras e fórmulas de RV (Outubro/2026), sem dependência de navegador/Firebase
    ├── login.js           # Lógica da interface de login
    ├── cadastro.js        # Lógica da interface de cadastro
    ├── home.js            # Lógica do painel principal e calculadora
    └── admin.js           # Lógica do painel de administração
```

Outros arquivos: `tests/comissoes.test.mjs` (testes automatizados), `docs/REGRAS_RV_OUTUBRO_2026.md` (regras × páginas do PDF, premissas e pontos em aberto).

## 🌐 Publicação (GitHub Pages)
1. Rode `node --test` e confirme que todos os testes passam.
2. Faça commit dos arquivos alterados (`js/comissoes.js`, `js/home.js`, `home.html`, `tests/`, `docs/`, `package.json`, `README.md`) e `git push` na branch publicada.
3. Em Settings > Pages, confirme a branch/pasta; aguarde o deploy e abra o site com Ctrl+Shift+R (cache dos módulos JS).

## Alterações de outubro/2026 (simulador)

- Índice de qualidade e férias saíram da tela (o motor ainda aceita esses campos de forma opcional).
- PAP: seletor "Dentro dos três primeiros meses?" (Sim/Não) → garantia de R$ 300 (regra do PDF p.7, só PAP).
- Faixa atual, "faltam R$ X para mudar de faixa e chegar a R$ Z", aviso de mudança de faixa e botão de WhatsApp.
- Projeção até o fim do mês pela média diária (dias trabalhados/restantes informados; estimativa, não é regra do PDF).
- Identidade visual Terra (css/style.css, variáveis no topo; banner em img/).
- Último cálculo salvo em `users/{uid}.lastCalculation`; regras em `firestore.rules` (publicar no console).
  As regras NÃO foram testadas em emulador (bloqueado neste ambiente): teste no "Playground de regras".
- Testes: `node --test` (53 testes do motor e dos textos).
