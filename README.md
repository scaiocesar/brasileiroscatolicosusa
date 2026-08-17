# Brasileiros Católicos nos EUA

Mapa interativo das comunidades católicas brasileiras nos Estados Unidos: pins, horários de missa, serviços e um painel admin para aprovar pré-cadastros.

## Desenvolvimento local

Requer Node.js 22+.

```bash
nvm use
cp .dev.vars.example .dev.vars
npm install
npm run db:migrate:local
npm run dev
```

- Site: [http://localhost:5173](http://localhost:5173)
- Admin: [http://localhost:5173/admin](http://localhost:5173/admin)
- Senha local padrão: `admin` (definida em `.dev.vars`)

O Turnstile de desenvolvimento usa as chaves de teste da Cloudflare (sempre aprovam).

## Deploy na Cloudflare

1. Entre na conta: `npx wrangler login`
2. Crie o banco D1 e copie o `database_id` para `wrangler.jsonc`:

```bash
npx wrangler d1 create brasileiroscatolicoseua
npm run db:migrate:remote
```

3. Configure os secrets de produção:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put AUTH_SECRET
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put TURNSTILE_SITE_KEY
```

Crie um widget no [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) e use o site key / secret reais.

4. Publique:

```bash
npm run deploy
```

5. No dashboard da Cloudflare, abra o Worker `brasileiroscatolicoseua` → **Settings** → **Domains & Routes** → **Add** → **Custom Domain** e informe `brasileiroscatolicoseua.com` (e `www` se quiser). O domínio precisa estar na mesma conta Cloudflare, com o DNS apontando para a Cloudflare.

A publicação remota exige `npx wrangler login` no computador (abre o browser da conta Cloudflare). Sem isso, o app roda só em `npm run dev`.

## Estrutura

- `src/` — mapa Leaflet, formulário público e painel admin (React)
- `worker/` — API Hono (listagem, pré-cadastro, geocode, admin)
- `migrations/` — schema D1
- `shared/` — tipos e listas (estados, serviços, dias da semana)
