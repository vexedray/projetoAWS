# CRUD S3 Web — Gerenciamento de Usuários

Aplicação web de gerenciamento de usuários com arquitetura MVC pura (HTML, CSS, JavaScript), hospedada como site estático no Amazon S3 e integrada com serviços AWS para autenticação e armazenamento.

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (ES6+) |
| Autenticação | Amazon Cognito (User Pool + Identity Pool) |
| Armazenamento | Amazon S3 |
| Autorização | AWS IAM |
| SDK | AWS SDK v2 (JavaScript) |
| Hashing | bcryptjs |

---

## Arquitetura

```
Frontend (MVC)
├── UserModel.js        # Lógica de dados e comunicação com S3
├── UserView.js         # Manipulação do DOM e renderização
├── UserController.js   # Intermediário entre Model e View
└── aws-config.js       # Inicialização do AWS SDK
```

A aplicação é **100% frontend** — não há backend tradicional. As requisições ao S3 são assinadas via **SigV4** usando credenciais temporárias fornecidas pelo Cognito Identity Pool.

### Fluxo de autenticação

```
Login (SRP) → JWT (Cognito) → Credenciais temporárias (STS) → Requisições S3 assinadas (SigV4)
```

---

## Recursos AWS

| Recurso | Identificador |
|---|---|
| S3 Bucket | `rayssa-borges` (us-east-2) |
| Cognito User Pool | `us-east-2_oazJPx4F3` |
| App Client | `crud-s3-web` |
| Identity Pool | `us-east-2:d3beedce-5c70-4fc8-a92f-4aea6c15941a` |

### Estrutura do bucket S3

```
rayssa-borges/
├── usuarios/    # Dados dos usuários (JSON)
└── fotos/       # Fotos de perfil
```

---

## Segurança

A aplicação implementa múltiplas camadas de segurança:

- **Sem credenciais estáticas** — credenciais temporárias via Cognito Identity Pool
- **IAM com escopo mínimo** — acesso restrito aos prefixos `usuarios/*` e `fotos/*`
- **CORS** — restrito a uma única origem
- **Criptografia** — SSE-AES256 no S3
- **Hashing de senhas** — bcryptjs no frontend
- **Whitelist de MIME types** — validação de uploads de imagem
- **Proteção contra XSS** — uso de `textContent` e função `_esc()` para renderização segura

---

## Configuração

### Pré-requisitos

- Conta AWS com os recursos listados acima criados
- Cognito User Pool e Identity Pool configurados
- Bucket S3 com hospedagem de site estático habilitada

### Deploy

1. Clone o repositório
2. Configure o arquivo `aws-config.js` com os IDs do seu ambiente
3. Faça o upload dos arquivos para o bucket S3:

```bash
aws s3 sync . s3://rayssa-borges --exclude ".git/*"
```

4. Acesse o endpoint de site estático do bucket S3

### Criar usuário no Cognito

```bash
# Criar usuário
aws cognito-idp admin-create-user \
  --user-pool-id us-east-2_oazJPx4F3 \
  --username SEU_USUARIO

# Confirmar senha permanente (bypassa FORCE_CHANGE_PASSWORD)
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-2_oazJPx4F3 \
  --username SEU_USUARIO \
  --password SUA_SENHA \
  --permanent
```

---

## Observações

- A função `generateId()` usa `crypto.getRandomValues()` em vez de `crypto.randomUUID()` para garantir compatibilidade em contextos HTTP (não-HTTPS)
- A política IAM deve cobrir **ambos** os prefixos `usuarios/*` e `fotos/*`; cobrir apenas um causará erros de `AccessDenied` no upload de fotos

---

## Autores

Desenvolvido por **Rayssa** e **Nathan**.
