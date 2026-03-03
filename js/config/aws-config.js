/* ═══════════════════════════════════════════════════════════
   AWS CONFIG — Configurações de acesso ao Amazon S3
   ═══════════════════════════════════════════════════════════

   Carregado ANTES de todos os módulos JS.
   Expõe a constante global AWS_CONFIG usada pelo Model.

   ⚠️  NUNCA versione este arquivo com chaves reais.
       Em produção, use Cognito Identity Pools ou
       Presigned URLs geradas por um backend.
   ═══════════════════════════════════════════════════════════ */

const AWS_CONFIG = {
  accessKeyId:     '',
  secretAccessKey: '',
  region:          'us-east-2',
  bucket:          'rayssa-borges',
};
