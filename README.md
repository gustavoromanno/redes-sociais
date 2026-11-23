# Central de Conteúdo — Romanno, Buckley e Afiliados

- `index.html` — Romanno Tecnologia + Buckley (filtro por marca, cores de cada marca)
- `afiliados.html` — Romanno Wear (vídeos por produto)
- `config.js` — marcas, cores, perfis, integração e marca no Metricool
- `data/marcas.json`, `data/afiliados.json` — pautas, tarefas, reuniões, respostas
- `data/metricas.json` — números das redes (gravados pelo Claude a partir do Metricool)

## Rotina
1. **Sexta · Planejar semana** — aceite as sugestões do Claude ou puxe pautas do banco, escolha dia, hora e redes.
2. **Sábado · Revisar e agendar** — vídeo uma vez, legenda/CTA/capa por rede, "Aprovar lote". Depois peça ao Claude: *"agenda a semana aprovada"*.
3. **Semana · Fiscal de post** — o Claude confere às 10h37, 18h37 e 22h37 e avisa no celular se algo falhar.

## Etapas e status
Etapa da pauta: pauta → produção → revisão → aprovado → agendado → publicado.
Status por rede: rascunho → aprovado → agendado → publicado / falhou / aguardando; sem integração: manual.

## Sincronização
Token fine-grained só deste repositório, *Contents: Read and write*, colado em **Sincronização**.
