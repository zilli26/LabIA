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

> Cada tipo de vídeo dominado vira uma receita aqui: objetivo → modelo → prompts (template) → durações/cortes → trilha → custo total.

### Receita 1 — Fluxo manual bem-feito (aprovada pelo Felipe 2026-07-04, base P8; 🧪 até a 1ª execução real)

1. **Prompt inicial como briefing compacto:** objetivo, público, rede, formato, produto/personagem, mood, restrições, CTA. Salvar nomeado "Briefing" — prepara a semântica para o Video Director (E3).
2. **Prompt de direção visual SEPARADO:** transformar o briefing em sujeito, ambiente, câmera, iluminação, estilo e critérios de aprovação. Não misturar briefing e prompt visual — revisão fica impossível.
3. **Direção visual → `Gerar Imagem`:** modelo barato primeiro (FLUX dev R$0,14); se possível, variações antes do vídeo. A imagem é o gate visual: vídeo custa 10-100x mais e herda erro da imagem.
4. **Revisar a imagem ANTES de `Gerar Vídeo`:** hoje é manual (olhar o asset); o nó "Revisar/Escolher" (spec aprovada no módulo 03) vai tornar esse gate explícito e de custo zero.
5. **Imagem aprovada → `Gerar Vídeo`:** prompt de movimento com ação principal + movimento de câmera + ritmo + continuidade de personagem/produto + restrições.
6. **Com `Estender Vídeo`: re-declarar o bloco de consistência em CADA clipe** (personagem/produto, câmera, luz, estilo, estado final) — regra da P2 contra deriva.
7. **Com `Montagem`: ordenar clipes por intenção e áudio.** A receita oficial de 30s+ é "direção de cenas + montagem", não "dar extend até 30s". Continuidade sonora vem da trilha na Montagem; emendas caem em beats (seção 2).
8. **Registrar custo e aprendizado** no log abaixo após CADA geração real — obrigatório na E2.

- [ ] Receita: produto em 360° (30s, trilha com beat)
- [ ] Receita: cena narrativa com personagem consistente
- [ ] Receita: b-roll de ambiente para reels

## Log de experimentos

| Data | Objetivo | Modelo | Custo real | Resultado | Aprendizado |
|---|---|---|---|---|---|
| — | — | — | — | — | (primeira geração real da E2 entra aqui) |
