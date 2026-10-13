# Auditoria de design — 13/10/2026

Escopo: revisão da organização do código/interface e capturas anteriores.
Não substitui inspeção visual autenticada em desktop, tablet e celular.

## Radar — ajuste implementado

Problema: ações complementares e gráficos apareciam antes da lista de artigos,
aumentando a distância entre a busca e o resultado e a competição entre botões.

- CTA principal: Pesquisar artigos.
- Assistência de IA em seção opcional recolhida.
- Buscas salvas, histórico e alertas em uma seção expansível.
- Importação por DOI/PMID/link em seção expansível.
- Volume, tendências e cobertura passam para depois dos artigos e ficam recolhidos.
- Filtros, revisão de conceitos, avisos, destino dos artigos, paginação,
  fontes, exportação e acesso aos resultados continuam disponíveis.

## Próximas prioridades

- Biblioteca: distinguir organização, leitura e matriz; reduzir ações simultâneas
  em cada artigo; manter salvar notas sempre perto do editor e das pendências.
- Ideias: separar gerar, comparar e salvar; agrupar ações secundárias das propostas
  e manter uma ação principal por estado da jornada.
- Meu projeto: separar edição do protocolo, jornada e documentos; contextualizar
  ações da IA junto ao campo/seção; reduzir competição no painel de ações.
- Manuscrito: dar predominância ao texto; fontes e assistência como ferramentas
  complementares; manter visível o estado de salvamento e versão.
- Orientação: explicitar seleção de projeto e papel do usuário antes dos controles.
- Sistema: padronizar significado de cores dos botões, tamanhos, espaçamento,
  mensagens vazias, carregamento, erros e confirmação de salvamento.

## Verificação pendente

Testar navegação por teclado dos elementos details, aplicação da busca de IA,
retomada de histórico/alertas, importação por identificador, leitura dos gráficos,
scroll e larguras em desktop e celular com sessão autenticada.
