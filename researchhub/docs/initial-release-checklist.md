# ResearchHub Scholar — fechamento da versão inicial

Estado em 15/10/2026. Implementação não equivale a validação em uso real.

## Produto científico implementado

Radar, geração/refinamento de ideias, criação do projeto, biblioteca, matriz,
jornada, orientação, manuscrito com citações, resultados descritivos, três análises
inferenciais guiadas (Welch, Pearson, qui-quadrado), exportações DOCX/XLSX/SVG/PNG.
Limites estatísticos: docs/statistical-analysis.md.
Exclusão do projeto com confirmação: requer scholar_project_delete.sql.

## Antes da liberação para teste completo

1. Confirmar migrations aplicadas e testar exclusão com um projeto descartável;
   verificar preservação da biblioteca. Não excluir projeto real para validar.
2. Regressão autenticada desktop/mobile: ideia → refinamento → Radar → biblioteca
   → projeto → manuscrito/citação → resultados → exportação → sair/entrar.
   Testar permissões com contas separadas de residente, orientador e coordenação.
3. Avaliar respostas reais da IA por especificidade, método, viabilidade e fontes;
   verificar latência, falhas, reembolso de franquia e recuperação de erro em cada
   operação. Crédito/modelo gratuito não garante capacidade ou disponibilidade.
4. Confirmar tarifas e ativação dos limites financeiros reais, franquias e recargas
   no banco. Conferir painel de consumo contra operações realizadas.
5. Provisionar e-mail, validar domínio/remetente e implementar alertas com entrega,
   falhas, repetição segura e descadastro. Alertas internos não provam entrega por e-mail.
6. Consolidar relatórios finais: referências efetivamente citadas e figuras, além
   de decidir incluir análise inferencial no documento consolidado (hoje tem exportação
   separada). Revisão científica humana continua necessária.

## Para primeira venda individual e institucional

7. Checkout Stripe, webhook idempotente, ativação, renovação, inadimplência,
   cancelamento e recargas. Testar compra individual e quantidade flexível de vagas.
8. Revisar titular, contatos e termos comerciais; testar suporte e recuperação de
   acesso. Fazer backup e um ensaio de restauração antes do grupo pagante.
9. Piloto pequeno, corrigir bloqueadores e promover somente o commit validado para
   main/produção; continuar mudanças maiores no Preview.

## Pode ficar para evolução

Mais bases bibliográficas, importação XLSX, múltiplas figuras por projeto,
regressões e testes avançados, colaboração simultânea e submissão a periódicos.
