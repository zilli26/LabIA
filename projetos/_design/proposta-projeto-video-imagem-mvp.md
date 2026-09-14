# Proposta — Projeto do LabIA (MVP)

**Escopo:** conceito de domínio e critérios para desenvolvimento. Não define tela completa, não executa geração e não substitui a especificação técnica do módulo.

## Decisão central

Um **Projeto** representa uma peça criativa pretendida: **um vídeo diferente = um Projeto diferente**. Para imagem, vale a mesma regra: uma peça final pretendida = um Projeto.

O Projeto agrupa o brief, as referências de identidade/estilo, os Flows executados, as tentativas e os Assets produzidos. Repetir uma geração, trocar modelo ou testar um prompt não cria outro Projeto; cria um experimento dentro do mesmo Projeto.

## Vocabulário mínimo

| Conceito | O que é no MVP | Relação com Projeto |
|---|---|---|
| **Projeto** | Unidade da peça que se quer aprovar/publicar. | Raiz do agrupamento. |
| **Flow** | Grafo executável do processo, por exemplo brief → imagem-base → vídeo → Asset. | Um ou mais por Projeto; um é marcado como principal. |
| **Asset** | Arquivo produzido ou anexado, com origem, modelo, custo e estado de revisão. | Muitos por Projeto; tentativas e outputs ficam rastreáveis. |
| **Character Sheet** | Pacote persistido de identidade de uma pessoa/personagem e suas referências. | Opcional por Projeto; uma versão ativa no MVP. |
| **Style Bible** | Regras visuais persistidas: luz, câmera, paleta, textura, composição, figurino e restrições. | Opcional por Projeto; uma versão ativa no MVP. |
| **Experimento** | Registro de uma hipótese ou variação testada e do aprendizado obtido. | Muitos por Projeto; aponta para Flow/run, prompt, modelo e Assets. |

Character Sheet e Style Bible não são apenas imagens soltas: são referências versionadas que podem ser reutilizadas em outro Projeto. O Asset continua sendo o arquivo concreto gerado/anexado.

## Dados mínimos do Projeto

Obrigatórios para criar:

- `nome` — identificador legível da peça;
- `tipo` — `VIDEO` ou `IMAGE`;
- `objetivo/brief` — o que a peça precisa comunicar ou vender;
- `formato` — no mínimo proporção, com `9:16` como padrão social;
- `status` — `DRAFT`, `IN_PROGRESS`, `REVIEW`, `APPROVED` ou `ARCHIVED`.

Campos mínimos recomendados para produção:

- `público/contexto`;
- `canal` — opcional no MVP;
- `duração_segundos` — obrigatório quando `tipo = VIDEO`;
- `characterSheetId` — opcional, obrigatório quando houver pessoa/personagem real;
- `styleBibleId` — opcional, mas recomendado;
- `primaryFlowId` — Flow principal do Projeto;
- `aprendizados` — síntese curta editável;
- `createdAt` e `updatedAt`.

Toda geração deve continuar registrando no Asset/Generation a proveniência já prevista: prompt efetivo, provider/modelo, parâmetros, custo estimado/real, origem e resultado.

## Relações e regra de continuidade

```text
Projeto
├── 1..N Flows (1 principal)
├── 0..1 Character Sheet ativo
├── 0..1 Style Bible ativa
├── 1..N Experimentos
└── 0..N Assets / gerações
    └── cada tentativa pode ser resultado de um Flow e de um Experimento
```

Um mesmo Character Sheet ou Style Bible pode ser referenciado por vários Projetos, sem copiar silenciosamente seu conteúdo. Se uma versão for alterada, a execução deve guardar a versão usada naquele momento.

Um vídeo em outra tentativa, outro modelo ou outro prompt permanece no mesmo Projeto quando o objetivo criativo é o mesmo. Um novo conceito, narrativa ou peça final abre outro Projeto.

## Primeiro onboarding

O onboarding é um caminho curto de criação, não um dashboard completo:

1. **Criar Projeto:** escolher `Vídeo` ou `Imagem`, nome, objetivo, proporção e, para vídeo, duração.
2. **Definir referências:** anexar ou criar Character Sheet e Style Bible; permitir seguir sem elas quando a peça não exigir identidade/estilo persistente.
3. **Abrir o Flow principal:** criar o vínculo com o Flow guiado adequado ao tipo de peça, sem gerar automaticamente.
4. **Confirmar execução:** mostrar o custo estimado e exigir aprovação explícita antes de qualquer geração; depois a execução registra Flow, geração, Asset e experimento correspondente.

Ao terminar o onboarding, o usuário deve ter um Projeto persistido e navegável no canvas, ainda que nenhum arquivo tenha sido gerado.

## Biblioteca: filtros MVP

Os filtros devem combinar-se com lógica **E** e refletir os metadados reais do Asset:

- **Projeto:** nome/ID do Projeto, incluindo estado “Sem projeto” para Assets legados;
- **Tipo:** `IMAGE` ou `VIDEO`;
- **Modelo:** exibir `provider / modelo`, para não confundir modelos homônimos;
- **Período:** intervalo por data de criação da geração/Asset.

Cada resultado precisa mostrar, sem abrir outra tela: Projeto, tipo, provider/modelo, data, estado de revisão, papel do Asset (`reference`, `candidate`, `approved` ou `output`) e custo quando disponível. Filtros vazios, combinação sem resultado e isolamento por workspace são estados obrigatórios.

## Corte MVP

Construir apenas o necessário para provar agrupamento, continuidade e rastreabilidade:

1. CRUD/persistência de Projeto para `VIDEO` e `IMAGE`.
2. Vínculo Projeto ↔ Flow, com Flow principal e runs associados.
3. Vínculo Projeto ↔ Assets/gerações, preservando proveniência e revisão.
4. Anexar/selecionar uma versão ativa de Character Sheet e Style Bible.
5. Registrar Experimento com: hipótese, variável testada, Flow/modelo usado, Assets resultantes e aprendizado/conclusão.
6. Biblioteca com os quatro filtros acima.
7. Onboarding sem geração automática e com barreira de custo antes da execução.

Fica fora deste corte: calendário/publicação, métricas de campanha, aprovação multiusuário, permissões avançadas, marketplace de templates, editor completo de Character Sheet/Style Bible, comparação automática de fidelidade, compilador universal de prompts e compartilhamento avançado entre Projetos.

## Critérios de aceitação para desenvolvimento

- [ ] É possível criar, recarregar e arquivar um Projeto de vídeo ou imagem com os dados mínimos; `duração_segundos` é exigida somente para vídeo.
- [ ] A regra é observável: dois vídeos com conceitos diferentes aparecem em dois Projetos; novas tentativas do mesmo vídeo aparecem como Experimentos/Assets no Projeto original.
- [ ] Um Flow principal pode ser aberto pelo Projeto e cada execução fica vinculada ao Projeto e ao seu resultado.
- [ ] Cada Asset gerado ou anexado conserva Projeto, tipo, provider/modelo, data, papel, origem e custo conforme disponibilidade.
- [ ] Um Projeto pode apontar para uma versão ativa de Character Sheet e Style Bible, e a execução conserva qual versão foi usada.
- [ ] É possível registrar um Experimento sem criar uma nova peça: hipótese, variável, resultado e aprendizado ficam consultáveis no Projeto.
- [ ] A Biblioteca filtra simultaneamente por Projeto, tipo, provider/modelo e intervalo de período, sem misturar workspaces.
- [ ] O onboarding cria Projeto, referências e Flow, mas não dispara geração; qualquer geração exige aprovação de custo estimado.
- [ ] Um Projeto vazio, um Projeto sem referências e uma busca sem resultados têm estado explícito; nenhum caso depende de uma tela completa ainda não especificada.

## Pergunta de validação do MVP

Depois de produzir uma peça, Felipe deve conseguir responder em menos de dois minutos: **qual era o objetivo, qual personagem/estilo foram usados, quais tentativas falharam, qual Asset foi aprovado, quanto custou e o que repetir no próximo Projeto?**
