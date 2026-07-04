# 02-Vídeos — Técnicas (documento vivo de expertise)

> Objetivo: ser EXPERT em geração de vídeo por IA — técnicas, direção de cortes com áudio, replicação de estilos. Cada geração real paga alimenta este doc: prompt exato, modelo, custo, o que funcionou, o que não, como replicar. Nada aqui é teoria solta: **✅ validado** = rodamos e vimos; **🧪 hipótese** = vem de pesquisa (P2/fontes), falta validar com geração real aprovada.
> Criado: 2026-07-03. Formato de tutorial: cada técnica madura vira uma receita replicável (passo a passo + prompt template + custo).

## 1. Vídeo contínuo 30s+ (frame-chaining)

- 🧪 **Encadeamento por último frame é o padrão do mercado** (P2: é como Kling, Veo/Flow e Higgsfield fazem). Último frame do clipe N = primeira imagem do clipe N+1 → continuidade "pixel-locked" no corte.
- 🧪 **Regra de consistência (P2):** re-declarar personagem, iluminação, câmera e estilo em CADA prompt de segmento — senão o modelo "deriva". O campo "contexto de cena" propagado pela aresta existe para isso.
- 🧪 **Degradação:** qualidade consistente até ~30s; degrada após ~60s de extends empilhados (P2). Máximo prático: ~6 encadeamentos.
- [ ] Validar com 1 cena real: qual modelo mantém melhor consistência de personagem entre clipes (Wan vs Kling vs Veo) — benchmark interno, custo aprovado antes.

## 2. Direção de cortes com áudio (a técnica a dominar)

Princípio: **o áudio manda no corte, não o contrário.** O frame-chaining nos dá um corte "de graça" a cada 5–10s (fronteira entre clipes) — a técnica é fazer essas fronteiras caírem onde o áudio pede.

- 🧪 **Planejar o vídeo a partir da trilha/narração:** marcar os beats/frases da trilha ANTES de gerar; escolher duração de cada clipe para que a emenda caia num beat ou pausa de narração. Corte em beat é percebido como intencional; corte fora de beat é percebido como erro.
- 🧪 **Mudança de cena = mudança sonora:** transições de movimento/enquadramento entre clipes ficam naturais quando coincidem com virada musical, entrada de instrumento ou início de frase.
- 🧪 **Áudio nativo por clipe não é contínuo entre clipes** (P2) — usar áudio nativo para som diegético (ambiente, efeitos dentro do clipe) e a trilha da Montagem para a continuidade emocional do vídeo inteiro.
- [ ] Validar: gerar 1 vídeo de 2 clipes com emenda em beat vs fora de beat e comparar percepção (custo aprovado antes).

## 3. Prompt de movimento (img2video)

- 🧪 Estrutura que a literatura converge: **sujeito + ação + movimento de câmera + ritmo** ("câmera orbita lentamente o produto, luz quente, movimento suave"). Confirmar o que cada modelo respeita na tarefa 0 (docs) e nas primeiras gerações.
- [ ] Construir tabela por modelo: verbos de câmera que cada um entende (orbit, dolly, pan, zoom), o que ignora, o que quebra.

## 4. Receitas replicáveis (tutoriais)

> Cada tipo de vídeo dominado vira uma receita aqui: objetivo → modelo → prompts (template) → durações/cortes → trilha → custo total. Ainda vazio — preenche conforme validamos.

- [ ] Receita: produto em 360° (30s, trilha com beat)
- [ ] Receita: cena narrativa com personagem consistente
- [ ] Receita: b-roll de ambiente para reels

## Log de experimentos

| Data | Objetivo | Modelo | Custo real | Resultado | Aprendizado |
|---|---|---|---|---|---|
| — | — | — | — | — | (primeira geração real da E2 entra aqui) |
