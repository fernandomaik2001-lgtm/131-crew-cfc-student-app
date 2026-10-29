# Histórico de desenvolvimento

## 2026-10-28 — Base independente e validação inicial

- Frontend estático/PWA sem dependências de build nem créditos de AI builders.
- Supabase existente; nenhuma tabela ou policy criada/alterada.
- Autenticação Magic Link sem autocriação de usuários.
- Consultas filtradas pelo membro autenticado e limitadas ao próprio aluno.
- Resultados gravados somente com colunas verificadas, sujeitos às regras RLS existentes.
- Reservas e check-in mantidos em modo consulta até homologação das regras no banco.
- Waiver Jotform disponível; atualização automática via webhook ainda pendente.

## Checklist para produção

- [x] Supabase em status `ACTIVE_HEALTHY` e esquema principal consultável.
- [x] GitHub: `fernandomaik2001-lgtm/131-crew-cfc-student-app` com código verificado em `main`.
- [ ] Hospedagem configurada (GitHub Pages ou Cloudflare Pages plano gratuito).
- [ ] URL exata adicionada aos Redirect URLs no Supabase Auth.
- [ ] Magic Link testado em dispositivo real.
- [ ] Teste de RLS: um aluno não vê dados de outro aluno.
- [ ] Gravação de resultado real validada com aluno piloto.
- [ ] Automação do waiver validada por envio real.