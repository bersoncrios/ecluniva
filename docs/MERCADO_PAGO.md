# Mercado Pago

## Configuração da aplicação

1. No Mercado Pago, abra **Seu negócio → Configurações → Gestão de integrações** e crie uma aplicação para o Quadrei.
2. Crie usuários de teste para vendedor e comprador. O vendedor de teste deve ser o dono da aplicação; o comprador de teste será usado para concluir o checkout.
3. Crie três planos de assinatura no Mercado Pago usando a API de Assinaturas (`/preapproval_plan`): Essencial mensal, Profissional mensal e Institucional mensal. A API de Assinaturas é a adequada para cobranças recorrentes; ela cria os planos e as assinaturas (`/preapproval`).
4. Configure o webhook de produção apontando para a API pública do Quadrei:
   `https://www.ecluniva.pro/api/billing/webhook`
5. Ative os eventos de assinaturas e pagamentos que serão usados pela integração.
6. Use a mesma aplicação Mercado Pago para os planos, o `MERCADOPAGO_ACCESS_TOKEN` e a assinatura secreta do webhook. Salve a assinatura correspondente em `MERCADOPAGO_WEBHOOK_SECRET` no ambiente Production da Vercel e faça um novo deploy após alterar variáveis.

## Variáveis server-side

Configure estas variáveis na Vercel em **Settings → Environment Variables**. Elas não devem ser colocadas em `.env.hml`, no bundle Angular ou no repositório:

```text
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=...
MERCADOPAGO_PLAN_ESSENTIAL_ID=...
MERCADOPAGO_PLAN_PROFESSIONAL_ID=...
MERCADOPAGO_PLAN_INSTITUTIONAL_ID=...
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

O fluxo atual não usa uma variável `QUADREI_BILLING_APP_URL`; o checkout abre o link hospedado do plano no Mercado Pago.

`FIREBASE_SERVICE_ACCOUNT_JSON` é usada somente pelas funções serverless da Vercel para validar o usuário Firebase e atualizar o plano no Firestore. Gere uma credencial de conta de serviço no projeto Firebase e armazene o JSON inteiro como segredo na Vercel; nunca o envie ao Angular ou ao Git.

Também é possível configurar três variáveis separadas na Vercel: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY`. Elas vêm de **Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada**. Em `FIREBASE_PRIVATE_KEY`, mantenha as quebras de linha como `\\n`.

O `ACCESS_TOKEN` autoriza chamadas do servidor ao Mercado Pago. A `PUBLIC_KEY` pode ser enviada ao navegador quando o checkout exigir; o token privado e o segredo do webhook nunca podem ser enviados ao cliente.

## Teste antes da produção

- Use credenciais `TEST-...` e `APP_USR-...` de teste.
- Faça o checkout com o usuário comprador de teste, não com o usuário vendedor.
- Confirme que o webhook recebe o evento e que o plano só é ativado depois da consulta server-side ao pagamento no Mercado Pago.
- Teste pagamento aprovado, pendente, recusado, cancelamento e renovação.

Em produção, substitua as credenciais de teste pelas credenciais reais. O domínio canônico é `https://www.ecluniva.pro`; mantenha o webhook apontando diretamente para `https://www.ecluniva.pro/api/billing/webhook` para evitar o redirecionamento 308 do domínio sem `www`.

## Domínio na Vercel

O projeto `ecluniva` usa `www.ecluniva.pro` como domínio principal e redireciona `ecluniva.pro` para ele (HTTP 308). No painel Vercel, os registros solicitados são:

```text
Tipo: A
Nome/Host: @
Valor: 216.198.79.1
```

Para `www`, configure o CNAME indicado pelo painel (no momento: `98e739e915192107.vercel-dns-017.com`). Os valores DNS específicos exibidos na tela do projeto prevalecem sobre exemplos genéricos. Depois de salvar os registros no provedor DNS, use **Refresh** na Vercel para validar.

## Planos do Quadrei

O preço inicial configurado é:

- Essencial: R$ 9,90/mês ou R$ 99,00/ano;
- Profissional: R$ 29,90/mês ou R$ 299,00/ano;
- Institucional: a partir de R$ 79,90/mês, com valor definido no atendimento.

Para cada plano, guarde no servidor o `preapproval_plan_id` retornado pelo Mercado Pago. O navegador nunca deve decidir o preço nem informar diretamente qual plano será ativado; o servidor deve relacionar o plano escolhido ao preço e ao ID oficial do Mercado Pago.

