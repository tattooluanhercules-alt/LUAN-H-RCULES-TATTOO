# LUAN HÉRCULES TATTOO STUDIO

Aplicação web institucional, portfólio editorial, história interativa em 12 fotografias, trilha sonora ambiente, agendamento com consentimento LGPD e painel administrativo integrado ao **Google Drive** e **Google Sheets**, preparada para publicação na **Vercel**.

---

## Arquitetura do Projeto

- **Frontend (`src/`)**: React, TypeScript, Vite, Tailwind CSS v4, Lucide React, Motion.
- **Backend (`server/` + `api/index.ts`)**: Express + Node.js com compatibilidade dual (servidor local `server.ts` na porta `3000` e Vercel Serverless Functions via `/api/index.ts` e `vercel.json`).
- **Armazenamento e Gestão**:
  - **Google Drive API**: organização automática da estrutura `LUAN HERCULES TATTOO/` (`HISTORIA/`, `PORTFOLIO/`, `BASTIDORES/`, `IDENTIDADE-VISUAL/`, `TRILHA-SONORA/`) e persistência privada do hash de senha administrativa no `appDataFolder`.
  - **Google Sheets API**: criação e sincronização automática da planilha `LUAN HERCULES TATTOO — GERENCIAMENTO` com as abas `GALERIA`, `HISTORIA`, `MUSICA`, `AGENDAMENTOS`, `CONFIGURACOES` e `LOG`.

---

## Painel Administrativo (`/admin`)

- **Rota**: `/admin`
- **Credenciais iniciais**:
  - Usuário: `ADMIN`
  - Senha inicial: `ADMIN`
- **Segurança**:
  - Alteração obrigatória da senha no primeiro acesso.
  - Senha armazenada exclusivamente em hash `scrypt` com salt aleatório (nunca em texto puro).
  - Sessões assinadas com cookies `HttpOnly`, proteção CSRF (`X-CSRF-Token`) e limitação de tentativas de login.
  - Conexão Google via botão oficial **Sign in with Google** dentro do painel para autorizar e sincronizar Drive e Sheets com permissão do proprietário.

---

## Variáveis de Ambiente (`.env.example`)

Para operação pública contínua na Vercel (leitura de mídias privadas ou registro automático em planilha sem sessão ativa no navegador), configure na Vercel:

```env
APP_URL="https://seu-dominio.vercel.app"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI=""
GOOGLE_REFRESH_TOKEN=""
GOOGLE_DRIVE_FOLDER_ID=""
GOOGLE_SHEET_ID=""
ADMIN_EMAIL="luanherculestattoo@gmail.com"
SESSION_SECRET="uma-chave-secreta-longa-e-aleatoria"
MAX_UPLOAD_MB="25"
```

---

## Scripts

```bash
npm install
npm run dev      # Servidor de desenvolvimento (porta 3000)
npm run lint     # Verificação TypeScript
npm run build    # Build de produção (dist/)
npm run start    # Execução em produção
```

---

## Publicação na Vercel

1. Conecte o repositório na Vercel.
2. Mantenha `Build Command: npm run build` e `Output Directory: dist` (já configurados em `vercel.json`).
3. Adicione as variáveis de ambiente listadas em `.env.example`.
4. Após o deploy, acesse `/admin`, efetue login com `ADMIN`/`ADMIN`, defina sua nova senha segura e clique em **Sign in with Google** para criar automaticamente as pastas no Drive e a planilha de gerenciamento.
