# 04-Copywriting — Especificação

**Etapa:** E3 · **Dor que resolve:** copy genérica com cara de IA ("GPT-bland"); copywriter que ignora voz da marca; falta de fundamentação (documentado no vault: 3 tentativas, 100k+ tokens, lixo).

## O que terá

### A entidade Brand/DNA (fundação do módulo)
- Importador do vault ClaudeObisidian: Tom-de-Voz.md, pilares, proibições anti-IA, corpus de exemplos (Como-Escrevo-Exemplos.md) → viram o DNA estruturado da `Brand`.
- Editor de DNA na plataforma (para marcas novas sem vault).

### Nós do canvas
- **Nó Copy** — briefing + Brand + tipo (post, thread, carrossel-texto, legenda) → copy na voz da marca, usando formato validado quando aplicável.
- **Nó Roteiro** — briefing → roteiro por beats (gancho, desenvolvimento, CTA) pronto para virar shotlist no Video Director.
- **Nó Gancho/CTA** — gera variações de hooks e CTAs para teste.
- **Nó Detector Anti-IA** — avalia qualquer texto contra a lista de padrões que denunciam IA (estrutura clone, contraste falso, "não é X, é Y"...); reprova e reescreve. Origem: skill `detector-ia-copy` existente.
- **Nó Melhorar Prompt** — transforma briefing em prompt otimizado para os nós de imagem/vídeo (a ponte copy→visual).

### Bases fundamentadas
Estratégia e copy citam base teórica real (Kotler para marketing, copywriters clássicos para direct response). As bases ficam versionadas como "lentes" selecionáveis no nó.

## Regras de produto
1. NENHUMA copy sai sem Brand associada (sem voz, sem saída).
2. Todo output passa pelo Detector Anti-IA antes de ser entregue.
3. Formatos validados (greentext, hook seco, cliffhanger... — biblioteca do vault) são templates de primeira classe.

## Fora de escopo
Estratégia completa (módulo 08) · publicação (06) · tradução/idiomas (backlog).
