# 131 Crew CFC — Student App

Aplicativo de alunos **próprio**, mobile-first e instalável como PWA. Não utiliza Lovable, Replit ou outro AI builder. Não precisa de npm, build ou créditos de terceiros para editar o código. O frontend usa **HTML, CSS e JavaScript** e conecta ao Supabase preexistente.

## Estrutura

- `index.html` — entrada do aplicativo
- `app.js` — login Magic Link, sessão, perfil, WOD, resultados, aulas e waiver
- `style.css` — layout responsivo da 131 Crew
- `manifest.webmanifest`, `icon.svg`, `sw.js` — PWA, ícone e cache restrito a arquivos estáticos
- `tests/logic.cjs` — testes locais sem Supabase ou dependências npm
- `tests/smoke.py` — roteiro opcional de testes no Chromium com respostas simuladas; pode exigir Playwright no computador e um navegador sem bloqueios administrativos
- `CHANGELOG.md` — status e checklist da homologação
- `.nojekyll` — publicação estática no GitHub Pages

## Testes locais

```bash
node --check app.js
node --check sw.js
node tests/logic.cjs
python3 -m http.server 8080
```

Abra `http://localhost:8080`. Sem login e sem URL autorizada no Supabase Auth, o Magic Link não poderá completar autenticação. Não abra `index.html` diretamente como `file://` para testar o login.

## Colocar no GitHub Pages Free (sem builder)

1. Entre em https://github.com/new e crie um repositório **público** chamado `131-crew-cfc-student-app`, no seu perfil. Não inclua README, licença ou `.gitignore` automáticos. O repositório público contém somente **código do frontend**; não envie documentos privados, dados de alunos ou segredos.
2. Depois de criado, forneça o endereço exato do repositório ao assistente para que ele use o conector GitHub para subir estes arquivos. O conector atual permite criar/editar arquivos em repositórios existentes, mas não criar um repositório do zero.
3. No GitHub, abra **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main → /(root) → Save**. O site deve ficar em uma URL `https://<usuario>.github.io/131-crew-cfc-student-app/` depois da publicação. Valide a URL exibida na página Pages, em vez de adivinhá-la.
4. Abra **Supabase → Authentication → URL Configuration → Redirect URLs** no projeto `aohfzxgchbuqqgeshopf` e adicione a URL de produção efetivamente criada, com o caminho do repositório e `/**` (por exemplo, `https://<usuario>.github.io/131-crew-cfc-student-app/**`). Faça a mesma configuração para qualquer preview legítimo usado para Magic Links.
5. Teste autenticação, acesso de Member real, resultados, logout, waiver e isolamento entre alunos **antes de enviar a URL para toda a turma**.

Publicação no GitHub Pages não custa créditos de IA. O serviço e o Supabase possuem seus próprios limites e políticas do plano gratuito; não garantimos disponibilidade ilimitada.

## Banco e segurança

- Supabase existente `aohfzxgchbuqqgeshopf`; tabelas, dados e RLS preservados.
- Única chave no browser: **publishable key**, criada para uso público. Nunca inserir `service_role`, tokens de acesso administrativos ou outro segredo no frontend.
- Login por e-mail: opção `create_user:false`; usuários devem ser provisionados via processo administrativo existente.
- As consultas por membro usam o `member_id` autenticado e dependem das policies de RLS existentes para garantir isolamento. Não considerar a filtragem do frontend uma barreira de segurança por si só.
- Os resultados usam somente as colunas conhecidas de `workout_results`, por INSERT sujeito às policies existentes. Não há upsert/deduplicação sem auditar constraints reais.
- Aulas são exibidas em modo consulta; reservas/check-in dependem de confirmação das regras reais e não foram habilitados.
- O Jotform é aberto externamente em https://form.jotform.com/262244759522057. O webhook de atualização automática do waiver **ainda não foi comprovado funcionando**.
- O app não inventa treinos, aulas, cobrança, presença ou formulários assinados.
- Caches da PWA abrangem **apenas arquivos estáticos**, jamais resposta da API ou informações do aluno.

## Testes e limites

- Testes `node --check` e `node tests/logic.cjs` verificam sintaxe, fluxo simulado de sessão, filtros, formulário de resultado, refresh e logout.
- O ambiente de navegador automatizado atual impediu navegação até local/URLs de teste (`ERR_BLOCKED_BY_ADMINISTRATOR`); teste real no Chrome/Safari ainda é obrigatório.
- A conexão com o Supabase real depende de o projeto estar **ACTIVE**. O projeto estava `INACTIVE` e recebeu solicitação de restauração em 28/10/2026, passando inicialmente a `COMING_UP`.
- O código foi gerado, mas a implantação pública, o envio ao repositório e a homologação com alunos ainda estão pendentes.