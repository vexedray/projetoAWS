/* ═══════════════════════════════════════════════════════════
   AWS CONFIG — Configurações de acesso ao Amazon S3
   ═══════════════════════════════════════════════════════════

   Carregado ANTES de todos os módulos JS.
   Expõe a constante global AWS_CONFIG usada pelo Model.

   ✅ Autenticação via Cognito Identity Pool (sem chaves estáticas)
   🔴 NUNCA adicionar accessKeyId ou secretAccessKey neste arquivo
   ═══════════════════════════════════════════════════════════ */

// ✅ Apenas identificadores públicos — sem credenciais estáticas
const AWS_CONFIG = {
  region:         'us-east-2',
  bucket:         'rayssa-borges',
  identityPoolId: 'us-east-2:d3beedce-5c70-4fc8-a92f-4aea6c15941a',
};

// ✅ Cognito Identity Pool — credenciais temporárias gerenciadas pelo SDK
AWS.config.update({
  region: AWS_CONFIG.region,
  credentials: new AWS.CognitoIdentityCredentials({
    IdentityPoolId: AWS_CONFIG.identityPoolId,
  }),
});
