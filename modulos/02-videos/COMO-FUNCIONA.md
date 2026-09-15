# 02-Vídeos — Como funciona

## Caminho recomendado: produto importado → vídeo curto

1. No Projeto, importa uma imagem real e a marca explicitamente como **imagem-base**. Importar, selecionar ou trocar esse Asset não gera imagem nem enfileira fluxo pago.
2. Conecta o Asset ao nó público **Animar imagem** (tipo interno `video-generation`). A imagem importada é o primeiro frame; não há etapa implícita de **Gerar imagem**.
3. Informa movimento, câmera, ritmo, modelo, duração e áudio quando suportado. Antes de enfileirar, o fluxo mostra o custo estimado em R$ e exige aprovação explícita para aquela geração.
4. Depois da geração, mostra o status e o custo real do clipe. O clipe persistido vira Asset reutilizável para revisão, retry ou montagem.
5. Opcionalmente, conecta o clipe concluído a **Continuar clipe** (tipo interno `video-extend`) para gerar outro trecho da mesma cena.
6. Conecta dois ou mais clipes a **Juntar clipes** (tipo interno `video-assembly`), que concatena na ordem esquerda→direita e pode receber trilha/voz. A montagem local não gera IA, não cria `Generation` e custa R$0.
7. O MP4 final é salvo como Asset vinculado ao Projeto do Flow. O custo real do vídeo pago é apresentado por clipe e no total.

## Contratos que evitam caminhos errados

- **Imagem-base** é a fonte escolhida para o primeiro frame de **Animar imagem**. Ela pode ser importada e alimentar img2video sem gerar uma imagem nova.
- **Referência visual** é papel diferente: não vira primeiro frame automaticamente. Só orienta a direção/modelo quando houver seleção explícita e suporte declarado pelo provider.
- **Continuar clipe** usa o último frame de uma `Generation` de vídeo upstream concluída. Não estende nem abre um MP4 importado; vídeo importado é Asset de entrada/proveniência, não upstream elegível para este nó.
- **Juntar clipes** exige pelo menos dois clipes. Concatena vídeo e preserva/mixa áudio conforme a configuração de trilha/voz; é pós-produção local, não geração de IA.
- O template **Produto importado → Vídeo curto** não contém geração de imagem. Se não houver imagem-base, fica pendente de seleção explícita.
- Os nomes públicos **Animar imagem**, **Continuar clipe** e **Juntar clipes** não alteram `video-generation`, `video-extend` e `video-assembly` nem flows persistidos.

## Regras de negócio

- Frame-chaining é modelo-agnóstico: **Continuar clipe** extrai o último frame server-side (ffmpeg) da Generation upstream e o usa como entrada técnica do próximo img2video. Esse frame não é Asset de biblioteca.
- **Aviso de degradação:** qualidade consistente até ~30s; degrada após ~60s de extends — a UI avisa a partir do 6º encadeamento.
- **Áudio:** modelos com áudio nativo podem gerar som por clipe, mas o chaining não preserva áudio contínuo. Continuidade sonora vem da trilha/voz em **Juntar clipes**, com cortes planejados em beats/pausas quando aplicável.
- Consistência entre clipes: o prompt de continuação herda descrição de estilo/personagem, e o contexto local do nó pode estreitar essa direção.
- Falha num clipe do meio: o fluxo pausa naquele nó; retry reexecuta só o nó e não paga novamente clipes anteriores já persistidos.
- Toda geração exibe custo estimado antes e custo real depois. Aprovação é individual: nenhuma aprovação vale automaticamente para a próxima geração.
- Modelos e durações máximas por modelo: tabela vinda de P1/P2.

## Dependências

Módulo 01 (imagens/assets), motor de fluxos (03), ffmpeg no servidor e resolução de Projeto/ownership para o Asset final.
