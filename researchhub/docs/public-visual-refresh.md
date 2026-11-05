# Visuais públicos — conceitos aprovados, 05/11/2026

O usuário autorizou incorporar os 14 conceitos visuais às páginas existentes,
interrompendo temporariamente o checklist. A entrega trata da apresentação.

## Cobertura

- `/`: título editorial, prévia ilustrativa do produto, percurso em três passos,
  benefício de organização, recursos, perguntas e chamadas existentes.
- `/como-funciona`: etapas numeradas, linha de percurso e resultados de cada etapa.
- `/para-residencias`: apresentação e prévia do programa, benefícios e contato.
- `/planos`: colunas alinhadas, destaque discreto do Plus, preços e quotas atuais,
  comparação e regras de convidados preservadas.
- `/contato`: assuntos à esquerda e formulário existente à direita.
- `/radar-demo`: busca e linguagem reorganizadas; continua sem IA, com os filtros,
  limites, revisão terminológica e resultados reais que já existiam. Não adicionamos
  controles decorativos para funcionalidades que a demonstração não possui.
- `/login`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha`: composição comum,
  ilustrações vetoriais leves, formulários e estados existentes preservados.
- `/contratacao`: permanece autenticada. Resumo do plano ao lado da solicitação;
  sem abrir cobrança, adicionar checkout ou alterar recargas/parcelamento.
- `/termos`, `/privacidade`, `/cancelamento`: conteúdo vigente preservado; índice,
  divisórias, leitura e acesso ao suporte recebem o visual conceitual.

`public-concepts.css` limita o tema aos conteúdos públicos e de acesso. Não altera
as classes das ferramentas privadas nem os marcadores de navegação autenticada.
A renderização inicial usa o conteúdo presente, sem aguardar consulta de sessão.
Novos textos promocionais e de apoio têm versões PT/ES em `public-design-copy.ts`.
As imagens conceituais são referências: não usamos screenshots como páginas nem
copiamos textos legais ilustrativos para o produto. Ilustrações são SVG decorativos,
sem novos provedores, dependências ou imagens remotas.

## Verificação

Testes existentes passaram, incluindo privacidade de navegação e cotas. Tipos e
lint passaram. Build e smoke finais devem ser conferidos no commit publicado.
O preview local gerenciado falhou antes de abrir: envia parâmetros de Vite
(`--host`, `--strictPort`) incompatíveis com `next dev`. Não alteramos o comando
funcional do projeto para contornar o visualizador. Conferência visual deve ser
feita no Preview Vercel antes de registrar homologação de desktop/mobile.

## Pendências da jornada

Usuário informou Success da migration de orientadores por plano. A aceitação com
conta gratuita, comentários e revogação continuam aguardando o teste do usuário.
Depois de conferir estes visuais, retomar o checklist de consolidação. Não marcar
as cinco etapas como concluídas por esta entrega visual.

Verificação final local: `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build` e `npm run test:smoke` passaram. O smoke preserva nomes dos campos
de autenticação e confere os novos títulos PT/ES. Sem migração adicional.
