# 04-Copywriting — Como funciona

## Fluxo do usuário

1. Seleciona a Brand (DNA carregado: voz, pilares, proibições, exemplos).
2. **Nó Copy**: escreve briefing ("post sobre X para Instagram, objetivo: salvar") + escolhe formato validado opcional.
3. O agente gera N variações; cada uma passa pelo **Detector Anti-IA** automaticamente (score + reescrita se reprovar).
4. A copy aprovada conecta-se adiante: **Nó Melhorar Prompt** → nós de imagem/vídeo; ou direto a um Post (módulo 06).

## Pipeline interno do Nó Copy

```
briefing + Brand.DNA + formato validado (opcional) + lente teórica (opcional)
  → prompt estruturado (few-shot com corpus real da marca)
  → LLM (via ModelProvider texto: API Anthropic/OpenAI ou assinatura — P6)
  → Detector Anti-IA (segunda chamada, checklist de padrões proibidos)
  → saída: CopyDoc com score, variações e formato usado
```

## Regras de negócio

- Few-shot SEMPRE com exemplos reais do corpus da marca (mínimo 5; se a marca não tem corpus, o editor de DNA pede antes).
- Proibições da marca (ex.: "não é X, é Y", template viciado) entram como lista negativa dura no prompt E no detector.
- Custo por copy: tokens estimados × preço do modelo, visível no nó como nas gerações visuais.

## Dependências
Motor de fluxos (03) · entidade Brand (schema na E1, dados na E3) · pesquisa P6 (backend texto por assinatura).
