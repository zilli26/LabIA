# P9 - Templates de fluxo prontos (biblioteca de modelos pré-moldados)

**Status:** pesquisa executada em 2026-07-04, aguardando decisão do Felipe para virar spec construível em `modulos/03-fluxos/`.
**Criada:** 2026-07-04 (side quest do Felipe, registrada formalmente).
**Encaixe no plano:** pesquisa-base da feature "Templates de fluxo (E2+)" prevista em `modulos/03-fluxos/ESPECIFICACAO.md` e primeiro degrau do backlog "biblioteca de formatos validados como marketplace". Depende conceitualmente da P8: a recomendação abaixo assume a ordem canônica briefing -> direção -> execução -> montagem/exportação.
**Data de acesso das fontes:** 2026-07-04.

---

## Veredito

Templates do LabIA devem ser **flows versionados com placeholders declarados**, não "prints bonitos" nem simples duplicatas soltas. O usuário escolhe um template em uma galeria, preenche um wizard curto com as variáveis obrigatórias, vê o custo estimado em R$ antes de abrir/rodar, e cai no canvas com os nós já montados e os campos pendentes destacados.

O padrão de mercado é consistente: n8n/Zapier vendem templates como workflows por caso de uso, com partes fixas pré-mapeadas e campos/credenciais que o usuário completa; ComfyUI compartilha o grafo inteiro como JSON pequeno e versionável; Canva/CapCut/Higgsfield reduzem fricção deixando estrutura, timing, estilo e efeitos fixos, enquanto o usuário troca textos, mídias e referências.

**Recomendação para o LabIA:** começar com 8 templates E2, todos usando apenas `Prompt`, `Gerar Imagem`, `Gerar Vídeo`, `Text2Video`, `Estender Vídeo` e `Montagem`. Copy/voz de marca entra só como "versão futura E3", para não quebrar SDD nem prometer módulo inexistente.

---

## Fatos

### 1. Como bibliotecas maduras funcionam

**n8n.** Workflows são salvos/exportados em JSON, podem ser importados por arquivo, URL, CLI ou copy/paste no editor, e o JSON exportado pode carregar referências de credenciais que precisam ser limpas ou remapeadas antes de compartilhar [n8n export/import](https://docs.n8n.io/workflows/export-import/). A documentação de templates do n8n posiciona templates como ponto de partida navegável por biblioteca; a documentação de expressões mostra o padrão `{{ ... }}` para valores dinâmicos vindos de dados anteriores, metadata ou ambiente [n8n expressions](https://docs.n8n.io/data/expressions/).
**Recomendação LabIA:** usar JSON de grafo como base, mas declarar placeholders fora do grafo para a UI conseguir montar formulário, validar obrigatórios e calcular custo antes de executar.

**ComfyUI.** Workflow é uma rede de nós; templates internos usam core nodes e podem pedir download de modelos necessários. O workflow também é salvo como metadata de imagem gerada e como JSON pequeno, legível, versionável e compartilhável [ComfyUI workflow](https://docs.comfy.org/development/core-concepts/workflow).
**Recomendação LabIA:** copiar a virtude de reprodutibilidade: `FlowRun` já guarda snapshot do grafo; templates devem ter versão imutável para um run antigo continuar explicável.

**Zapier.** Zap templates são Zaps prontos com apps e campos principais pré-selecionados; em poucos cliques o usuário descobre caso de uso, conecta apps e liga o Zap. O criador do template não conecta conta real: usa sample data, deixa campos vazios quando são específicos do usuário, mapeia o máximo possível e submete versões/revisões [Zapier templates docs](https://docs.zapier.com/integrations/publish/zap-templates). A biblioteca pública organiza templates por use case como lead management, marketing campaigns, support, data management e project management [Zapier templates](https://zapier.com/templates).
**Recomendação LabIA:** nomear templates por resultado ("Criar reel de produto 6s"), não por técnica ("Fluxo img2video com Hailuo").

**Canva.** Brand Templates e Brand Kits separam estrutura reutilizável de marca/ativos: designers publicam templates para a equipe e usuários aplicam logos, cores e fontes aprovadas [Canva Brand Templates](https://www.canva.com/help/publish-team-template/) [Canva Brand Kit](https://www.canva.com/help/using-brand-templates/). A biblioteca pública tem coleções de templates por formato, incluindo posts e carrosséis de Instagram [Canva carousel templates](https://www.canva.com/instagram-posts/templates/carousel/).
**Recomendação LabIA:** na E3/E4, conectar templates a `Brand`; na E2, deixar o campo "marca/cliente" como metadata opcional, sem depender do módulo de marca.

**CapCut.** A biblioteca é organizada por finalidade/estilo, com busca e categorias; o usuário troca texto, mídia, timing/transições e elementos de marca. Para templates sociais, o fluxo comum é abrir um template a partir do TikTok/CapCut, substituir clips/fotos, ajustar texto/efeitos e exportar [CapCut template editing](https://www.capcut.com/resource/capcut-template-editing-made-easy-a-comprehensive-guide-to-enhancing-your-videos) [CapCut template creation](https://www.capcut.com/resource/how-to-make-a-capcut-template).
**Recomendação LabIA:** separar "trocar inputs" de "mexer no canvas": o caminho rápido deve pedir produto/referências/duração antes, e o modo avançado libera edição fina dos nós.

**Higgsfield.** A área de apps/templates vende "one-click AI effects" com categorias como Professional, Enhance & Style, Video Editing, Ads & Products e Trending Templates; presets transformam uma imagem/vídeo em anúncios, tendências ou efeitos artísticos [Higgsfield Trending Templates](https://higgsfield.ai/apps/trending-templates). O gerador de produto promete transformar foto/prompt em vídeo de produto, demos, lifestyle scenes e UGC [Higgsfield Product Video](https://higgsfield.ai/ai-product-video-generator).
**Recomendação LabIA:** templates de primeira leva devem ser orientados a entregável de social media, principalmente produto, reel, carrossel e variações criativas.

### 2. Demanda real para social media

Fontes convergem em 4 famílias de demanda: post estático, carrossel, short video/reel e vídeo de produto/ads. Canva mantém coleções grandes para Instagram post e carousel [Canva Instagram templates](https://www.canva.com/instagram-posts/templates/) [Canva carousel templates](https://www.canva.com/instagram-posts/templates/carousel/). CapCut destaca templates sociais, reels e tendências como caminho rápido para vídeo social [CapCut reel templates](https://www.capcut.com/explore/capcut-reel-template/7497636669043263504) [CapCut social templates](https://www.capcut.com/explore/social-media-template/7497641479519668241). Buffer lista tipos recorrentes de conteúdo social para preencher calendário, incluindo vídeo curto, imagens, carrosséis, bastidores, conteúdo educativo, produto e UGC [Buffer content types](https://buffer.com/resources/social-media-content-types/). Manychat mapeia Reel, Carousel e Feed Post por objetivo de alcance/engajamento/conversão [Manychat formats](https://manychat.com/blog/when-to-use-each-instagram-content-format/).

**Recomendação para o LabIA:** primeira leva não deve tentar cobrir "tudo"; deve cobrir repetições de trabalho do Felipe: post visual, carrossel de variações, reel curto, vídeo contínuo 30s+, campanha de produto e trend/preset visual.

---

## Primeira leva de templates

Cálculo de custo usa `docs/06-PROVEDORES.md`, câmbio R$5,40 e custos já catalogados. Não inclui copy E3. Valores são estimativa típica antes de rodar; execução real deve recalcular pelo `estimateFlowCost`.

| Nome | Objetivo | Nós na ordem | Variáveis do usuário | Decisões pré-moldadas | Modo avançado | Custo típico |
|---|---|---|---|---|---|---|
| Post visual simples | Gerar 1 imagem pronta para post/thumbnail | Prompt -> Gerar Imagem | produto/tema, prompt-base, estilo, referência opcional | FLUX dev, 1 imagem | trocar para Nano Banana 2, mudar proporção/modelo | ~R$0,14 |
| Carrossel de variações visuais | Gerar 6 imagens coerentes para carrossel/seleção | Prompt -> 6x Gerar Imagem | tema, lista de 6 cenas/slides, estilo, refs | FLUX dev em todos os slides; sem texto/render final E4 | trocar modelo por slide, reduzir/aumentar slides | ~R$0,81 |
| Reel produto 6s barato | Transformar foto/cena de produto em vídeo curto | Prompt -> Gerar Imagem -> Gerar Vídeo | produto, promessa visual, movimento desejado, ref produto | FLUX dev + Hailuo 2.3 Standard 6s | trocar para Wan/Kling/Seedance/Veo, gerar áudio quando modelo suportar | ~R$1,65 |
| Trend visual a partir de foto | Aplicar preset/efeito simples em um asset | Prompt -> Gerar Imagem -> Gerar Vídeo | foto/ref, efeito desejado, intensidade em texto | Hailuo 6s como default barato | escolher Seedance/Veo para áudio/premium | ~R$1,65 |
| Text2Video rápido 10s | Criar vídeo curto sem imagem inicial | Prompt -> Text2Video -> Montagem | prompt de cena, duração, formato 9:16/1:1 | Kling 2.5 Turbo Pro 10s | trocar para Wan/Seedance/Veo; dividir em 2 cenas | ~R$3,78 |
| Campanha produto mini | Gerar 3 rotas criativas de produto para escolher | Prompt -> 3x Gerar Imagem -> 3x Gerar Vídeo | produto, público, benefício, refs, restrições | 3 imagens FLUX dev + 3 Hailuo 6s | escolher uma rota e estender; trocar modelos por rota | ~R$4,94 |
| Vídeo contínuo 30s+ | Gerar 30s encadeado com último frame/continuidade | Prompt -> Gerar Imagem -> Gerar Vídeo -> 5x Estender Vídeo -> Montagem | briefing, duração, cenas/beats, movimento, ref inicial | Wan 480p para custo baixo; 6 clipes de 5s; montagem simples | subir para 720p/1080p; escolher Seedance/Veo por cenas; áudio em montagem | ~R$8,24 |
| Premium com áudio nativo | Testar peça curta premium com áudio | Prompt -> Text2Video -> Montagem | cena, fala/som desejado, tom, duração | Veo 3 8s com áudio | desligar áudio, trocar para Seedance, reduzir duração | ~R$17,28 |

**Recomendação para o LabIA:** lançar 5 como default visível (`Post visual simples`, `Carrossel de variações`, `Reel produto 6s barato`, `Campanha produto mini`, `Vídeo contínuo 30s+`) e manter `Text2Video rápido`/`Premium com áudio nativo` como "avançados" para evitar gasto alto por clique curioso.

---

## O que parametrizar

### Variáveis do usuário

- `briefing`: objetivo do conteúdo, produto/serviço, público, promessa e restrições.
- `basePrompt`: descrição base que alimenta todos os nós.
- `references`: imagens/vídeos de produto, marca, pessoa, cenário ou estilo.
- `format`: 1:1, 4:5, 9:16, 16:9 quando o nó suportar.
- `durationSeconds`: duração-alvo do template ou de cada clipe.
- `tone/style`: linguagem visual desejada; em E3 vira tom de voz/Brand.
- `budgetMode`: barato, equilibrado, premium.

### Decisões pré-moldadas

- Modelo default por etapa.
- Resolução default.
- Número de variações.
- Encadeamento entre cenas.
- Ordem do fluxo.
- Parâmetros técnicos que reduzem risco: durações suportadas, toggles de áudio só quando modelo suporta, resolução com preço confirmado.

### Destravar no modo avançado

- Trocar modelo por nó.
- Editar prompt final de cada nó.
- Ajustar resolução/duração por cena.
- Inserir/remover ramificações.
- Rodar apenas um ramo ou nó.
- Ver JSON/manifest do template para debug.

### Padrão de placeholder

Mercado usa duas famílias: expressões inline no workflow (`{{...}}` no n8n) e placeholders visuais de mídia/texto no CapCut/Canva. Para o LabIA, o melhor desenho é:

```json
{
  "key": "product_name",
  "label": "Produto",
  "type": "text",
  "required": true,
  "mapsTo": [
    { "nodeId": "prompt-brief", "path": "data.params.productName" },
    { "nodeId": "image-hero", "path": "data.params.prompt" }
  ]
}
```

**Recomendação para o LabIA:** não espalhar `{{product_name}}` solto em strings como única fonte de verdade. Usar placeholders declarados em manifest e permitir interpolação dentro dos campos do grafo. Isso permite formulário, validação, custo e highlight visual.

---

## Modelo de dados recomendado

O schema atual já tem `Flow.isTemplate`, `Flow.graph` e `FlowRun.graph`. Isso é suficiente para um protótipo, mas insuficiente para biblioteca com versão, categorias, previews, placeholders e marketplace.

### Comparação

- n8n: workflow JSON importável/exportável; biblioteca externa/interna instancia uma cópia editável; credenciais e campos específicos ficam para o usuário completar.
- ComfyUI: grafo JSON pequeno, compartilhável e versionável; run/output preserva metadata do workflow.
- Zapier: template tem metadata editorial, campos fixos/pré-mapeados, campos obrigatórios do usuário e revisão/publicação.
- Canva/CapCut/Higgsfield: template é um produto de biblioteca com preview, categoria, tags, placeholders e resultado esperado.

### Desenho recomendado para Prisma

Criar tabela própria, sem depender apenas de `Flow.isTemplate`:

```prisma
model FlowTemplate {
  id             String   @id @default(cuid())
  slug           String
  version        Int
  name           String
  description    String
  category       String
  status         String   @default("draft")
  graph          Json
  placeholders   Json
  defaultParams  Json?
  preview        Json?
  estimatedCost  Json?
  sourceFlowId   String?  @map("source_flow_id")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@unique([slug, version])
  @@index([category, status])
  @@map("flow_templates")
}
```

Instanciação:

1. Usuário escolhe `FlowTemplate.slug@version`.
2. UI renderiza placeholders.
3. Backend valida obrigatórios e aplica substituições no `graph`.
4. Cria `Flow` normal com `templateSlug`, `templateVersion` (ou metadata se não quiser migration extra no primeiro passo).
5. `FlowRun.graph` continua snapshot imutável da execução.

Seeds no repo:

- Guardar templates iniciais em `lib/flows/templates/*.json` ou `data/flow-templates/*.json`.
- Rodar seed para popular `FlowTemplate`.
- Cada arquivo deve ter `schemaVersion`, `templateVersion`, `graph`, `placeholders`, `preview`, `estimatedCostExample`.

**Recomendação para o LabIA:** implementar `FlowTemplate` quando a feature entrar. Enquanto isso, não usar `Flow.isTemplate` como produto final; manter como compatibilidade/protótipo ou migrar para tabela própria.

---

## UX recomendada

### Fluxo de instância

1. Botão `Novo fluxo` abre opções: `Em branco` e `A partir de template`.
2. Galeria com busca, categorias e cards com preview do resultado, custo típico e badges: `Barato`, `Vídeo`, `Produto`, `30s+`, `Premium`.
3. Ao clicar, abrir wizard curto de variáveis obrigatórias.
4. Antes de criar/rodar: mostrar `Custo estimado` em R$ e detalhar por nó.
5. Criar Flow e abrir canvas já montado.
6. Nós com placeholders preenchidos ficam normais; nós pendentes ficam destacados.
7. CTA primário: `Executar fluxo` ou `Executar primeiro nó` dependendo do risco/custo.

### Por que isso reduz tempo até primeira execução

CapCut/Canva/Higgsfield reduzem fricção porque o usuário troca conteúdo antes de mexer na estrutura. Zapier reduz fricção pré-mapeando campos e deixando o usuário completar apenas o que é dele. Para LabIA, abrir direto num canvas cheio sem wizard transfere ansiedade para o usuário: ele precisa entender o grafo antes de produzir.

**Recomendação para o LabIA:** galeria + wizard antes do canvas. Canvas é a espinha dorsal, mas o primeiro contato com template deve ser "troque as informações e rode", não "aprenda a montar nós".

---

## Impacto nos docs

- `modulos/03-fluxos/ESPECIFICACAO.md`: transformar "Templates de fluxo (E2+)" em spec com galeria, wizard, placeholders, custo estimado por template e instanciação em `Flow`.
- `modulos/03-fluxos/CONSTRUCAO.md`: adicionar etapa candidata ao fim da E2 ou abertura da E3: `FlowTemplate`, seeds, API de galeria, wizard e validação de placeholders.
- `modulos/03-fluxos/decisoes.md`: registrar decisão local "template = FlowTemplate versionado + manifest de placeholders".
- `modulos/02-videos/TECNICAS.md`: cada template maduro deve virar receita testada, principalmente `Reel produto 6s barato` e `Vídeo contínuo 30s+`.
- `prisma/schema.prisma`: se aprovado, criar migration com `FlowTemplate`; opcionalmente adicionar `templateSlug`/`templateVersion` em `Flow`.
- `docs/WHITEPAPER.md`: capítulo "Comece por um template" no fechamento da E2.

**Recomendação para o LabIA:** atualizar specs só depois de Felipe aprovar esta pesquisa. A pesquisa recomenda desenho, mas SDD exige que a spec aprovada seja o contrato antes de código.

---

## Lacunas da verificação

1. P8 ainda precisa executar/fechar a ordem canônica com mais rigor. Esta P9 assumiu a ordem briefing -> direção -> execução -> montagem/exportação.
2. Canva bloqueou leitura completa por cliente web em algumas páginas de ajuda; usei páginas públicas de help/templates e mantive a conclusão em nível de comportamento de produto, não schema interno.
3. Higgsfield não expõe publicamente schema de armazenamento dos presets. A conclusão sobre placeholders vem da UX pública ("add media/generate") e categorias, não de banco/API.
4. Custos reais dependem dos parâmetros finais implementados nos nós E2. A tabela usa o catálogo local vigente (`docs/06-PROVEDORES.md`) e deve ser recalculada pelo motor antes da execução.
5. Templates de carrossel ainda não produzem design final com texto sobre imagem, porque Design/E4 não existe. A primeira versão é "pack de imagens/variações"; a versão final de carrossel fica para E4.

**Recomendação para o LabIA:** não vender a biblioteca como marketplace ainda. Começar como biblioteca curada interna, validada por uso real do Felipe, e só depois abrir marketplace.

---

## Fontes

1. n8n Docs, "Export and import workflows", https://docs.n8n.io/workflows/export-import/ (acesso 2026-07-04).
2. n8n Docs, "Expressions versus data nodes", https://docs.n8n.io/data/expressions/ (acesso 2026-07-04).
3. n8n Docs, "Use templates", https://docs.n8n.io/build/ways-of-building-workflows/use-templates/ (acesso 2026-07-04; pagina localizada via busca, fetch direto instavel).
4. ComfyUI Docs, "Workflow", https://docs.comfy.org/development/core-concepts/workflow (acesso 2026-07-04).
5. Zapier Developer Docs, "Zap templates", https://docs.zapier.com/integrations/publish/zap-templates (acesso 2026-07-04).
6. Zapier, "Workflow Automation Templates", https://zapier.com/templates (acesso 2026-07-04).
7. Canva Help Center, "Publish designs as Brand Templates", https://www.canva.com/help/publish-team-template/ (acesso 2026-07-04).
8. Canva Help Center, "Design with Brand Kits and Brand Templates", https://www.canva.com/help/using-brand-templates/ (acesso 2026-07-04).
9. Canva, "Instagram post templates", https://www.canva.com/instagram-posts/templates/ (acesso 2026-07-04).
10. Canva, "Carousel Instagram post templates", https://www.canva.com/instagram-posts/templates/carousel/ (acesso 2026-07-04).
11. CapCut, "CapCut Template Editing Made Easy", https://www.capcut.com/resource/capcut-template-editing-made-easy-a-comprehensive-guide-to-enhancing-your-videos (acesso 2026-07-04).
12. CapCut, "How to Make a CapCut Template", https://www.capcut.com/resource/how-to-make-a-capcut-template (acesso 2026-07-04).
13. CapCut, "CapCut Reel Template", https://www.capcut.com/explore/capcut-reel-template/7497636669043263504 (acesso 2026-07-04).
14. CapCut, "Social Media Template", https://www.capcut.com/explore/social-media-template/7497641479519668241 (acesso 2026-07-04).
15. Higgsfield, "Trending Templates", https://higgsfield.ai/apps/trending-templates (acesso 2026-07-04).
16. Higgsfield, "AI Product Video Generator", https://higgsfield.ai/ai-product-video-generator (acesso 2026-07-04).
17. Buffer, "Types of Social Media Content", https://buffer.com/resources/social-media-content-types/ (acesso 2026-07-04).
18. Manychat, "Carousel, Reel, or Feed Post?", https://manychat.com/blog/when-to-use-each-instagram-content-format/ (acesso 2026-07-04).
