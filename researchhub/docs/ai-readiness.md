# IA OpenAI — decisão de 20/11/2026

O modelo de todas as operações é `gpt-6-luna`, pela API Responses da OpenAI.
A Vercel hospeda o aplicativo. Nenhuma operação passa pelo AI Gateway.
`OPENAI_API_KEY` é segredo de servidor, sem prefixo NEXT_PUBLIC.
A disponibilidade exige a chave, Supabase e SCHOLAR_AI_ENABLED=true.

Configuração padrão: reasoning none, service tier default e store=false.
Os esquemas estruturados e os validadores científicos existentes são preservados.
Não há troca automática para modelos ou provedores diferentes.

Tarifas Standard verificadas em 20/11: US$0,10/M entrada e US$0,50/M saída.
Entrada em cache é contabilizada conservadoramente como entrada comum.
Até 10.000 tokens por operação, incluindo entrada e saída, com reserva e liquidação.
Franquias anuais: Essencial 3M, Plus 6M, Premium 12M.
Recarga: R$79 por 1M tokens, com a validade da licença atual.

A confirmação do Asaas é obrigatória para creditar licença ou recarga.
O retorno do navegador só consulta o pedido e aguarda o estado activated.
A compra não é aberta quando pagamentos/IA estão desligados no banco ou a
conexão de IA está incompleta no servidor.

Instalação: configurar OPENAI_API_KEY como variável sensível em Preview e Production,
aplicar scholar_paid_license_renewal_20261120.sql após conferência do banco,
e verificar o diagnóstico operacional e a carteira da conta compradora.
Manter RESEARCHHUB_ASAAS_CHECKOUT_READY desligado até testar pagamento real,
confirmação, liberação e recarga sem duplicações. A flag habilita vendas normais.

Implementado, instalado e validado são estados separados.
Uma resposta do endpoint de status confirma configuração, não qualidade científica.
Os testes com banco isolado não comprovam a instalação no Supabase de Production.
