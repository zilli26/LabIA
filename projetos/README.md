# Projetos de imagem e vídeo

Este diretório guarda a memória de produção de cada projeto criativo do LabIA: briefing, referências autorizadas, character sheet, style bible, planos de cena, testes e exports locais.

## Convenção

Crie um diretório por trabalho em `projetos/<aaaa-mm-slug>/` a partir de `_template/`.

Cada projeto deve conter:

- `brief.md` — intenção, público, formato, restrições e aprovação de custo.
- `character-sheet.md` — personagem, continuidade visual, roupas, traços e referências autorizadas.
- `style-bible.md` — estética, luz, lente, câmera, paleta e referências.
- `experiment-log.md` — cada geração/teste: prompt, provider, modelo, custo, IDs dos Assets, avaliação e aprendizado.
- `assets/referencias/` — materiais de referência autorizados.
- `assets/imagens/` e `assets/videos/` — exports locais selecionados. O original gerado continua registrado no Asset do LabIA/Supabase; este diretório serve para o pacote criativo e versões escolhidas.

Não armazene chaves, credenciais, material sem autorização de uso ou mídia identificável de terceiros sem consentimento.
