# Redes sociais — painéis

- `index.html` — agenda Romanno Tecnologia + Buckley (filtro por marca)
- `afiliados.html` — calendário de afiliados (Romanno Wear), vídeos por produto
- `config.js` — perfis, redes e tipo de integração
- `data/*.json` — o plano da semana; o painel salva aqui (com token) e o Claude lê/atualiza status

## Rotina
1. **Sexta · Planejar** — banco de pautas → "Pôr na semana" → marcar onde sai.
2. **Sábado · Revisar e agendar** — link do vídeo uma vez, legenda/CTA/capa por rede, "Aprovar lote".
   Depois, no projeto "Redes Sociais" do Claude: *"agenda a semana aprovada"*.
3. **Semana · Acompanhar** — status, links, alertas de atraso/falha, posts manuais com legenda pronta.

## Status
`rascunho` → `aprovado` (Claude agenda no Metricool) → `agendado` → `publicado` / `falhou`.
Sem integração automática: `manual` (você posta; legenda e vídeo prontos).

## Token (opcional, para sincronizar entre aparelhos)
GitHub → Settings → Developer settings → Fine-grained tokens → só este repositório → *Contents: Read and write*.
Cole em **Contas**. Fica salvo só no navegador do aparelho.
