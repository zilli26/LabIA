# 06-Calendário — Como funciona

## Fluxo do usuário

1. Conecta as redes da Brand (OAuth — fluxo exato depende de P3: APIs oficiais exigem app review da Meta; agregador tipo Ayrshare/Post Bridge simplifica em troca de custo mensal).
2. Um Post nasce: (a) da saída de um fluxo do canvas (Nó Publicar), ou (b) direto no composer.
3. No composer: seleciona redes → para cada rede vê preview fiel e ajusta (proporção inline, texto truncado, hashtags).
4. Agenda (ou envia para aprovação do cliente). No horário, worker publica em todas as redes; status por rede (publicado/falhou+retry).
5. Após publicar: job coleta métricas em D+1, D+3, D+7 → grava no Post → dashboards e loop de aprendizado.

## Regras de negócio

- Tokens de rede social criptografados; renovação automática quando a API permitir.
- Agendamento: pg-boss com jobs agendados; timezone da Brand.
- Adaptação por rede é sugerida automaticamente, confirmada pelo usuário (nunca publicar versão que ele não viu).

## Dependências
Módulo 05 (proporções), 03 (Nó Publicar), pesquisa P3 (decisão API vs. agregador — BLOQUEANTE para começar).
