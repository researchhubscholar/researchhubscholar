# Controle das migrations — etapa 2, primeira entrega

`supabase/migrations-manifest.json` inventaria os arquivos Scholar, hashes SHA-256,
dependências declaradas e tratamento de reexecução. O teste correspondente detecta
arquivo alterado/omitido e dependência fora da ordem. Não aplica SQL automaticamente.

É um inventário do código, **não um histórico de execução no banco**. A presença de
uma tabela não prova todas as políticas/funções de uma migration. Não registrar
instalações antigas por inferência nem reexecutar instaladores para preencher histórico.

| Evidência | Situação |
|---|---|
| `scholar_safe_saves.sql` | Usuário informou Success em 27/10/2026; validação autenticada em andamento |
| Demais migrations por ambiente | Histórico individual ainda precisa ser conferido |
| Scripts de contas de teste e compatibilidade | Separados da instalação geral |
| Testes SQL/RLS | Usam ambiente sintético, não comprovam o banco real |

Não há SQL novo obrigatório para usar a exportação v2. Módulo ausente ou leitura
indisponível produz aviso de exportação parcial.

Próximos passos desta frente:

1. Identificar os bancos de Preview/produção sem presumir que sejam distintos.
2. Conferir a instalação efetiva e registrar ambiente, hash, data e evidência.
3. Homologar instalação nova em banco descartável; as dependências do inventário
   não substituem esse ensaio nem autorizam execução em lote.
4. Adotar registro de execução para migrations futuras, sem marcar antigas como
   instaladas automaticamente.
