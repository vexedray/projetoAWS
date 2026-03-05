/* ═══════════════════════════════════════════════════════════
   AWS CONFIG — Configurações de acesso ao Amazon S3 + Cognito
   ═══════════════════════════════════════════════════════════

   Carregado ANTES de todos os módulos JS.
   Expõe a constante global AWS_CONFIG usada pelo Model.
   Expõe login(), logout(), getSession(), configureCredentials().

   ✅ Autenticação via Cognito User Pool + Identity Pool
   🔴 NUNCA adicionar accessKeyId ou secretAccessKey neste arquivo
   ═══════════════════════════════════════════════════════════ */

// ✅ Apenas identificadores públicos — sem credenciais estáticas
const AWS_CONFIG = {
  region:         'us-east-2',
  bucket:         'rayssa-borges',
  identityPoolId: 'us-east-2:d3beedce-5c70-4fc8-a92f-4aea6c15941a',
  userPoolId:     'us-east-2_oazJPx4F3',
  clientId:       '51v7djlqh994mec9r8itafm948',
};

// ✅ Apenas a região — credenciais serão configuradas após login
AWS.config.region = AWS_CONFIG.region;

// ✅ User Pool para autenticação
const userPool = new AmazonCognitoIdentity.CognitoUserPool({
  UserPoolId: AWS_CONFIG.userPoolId,
  ClientId:   AWS_CONFIG.clientId,
});

/* ───────────────────────────────────────────────────────
   configureCredentials(idToken)
   Configura credenciais do Identity Pool vinculadas ao
   usuário autenticado via Logins map.
   ─────────────────────────────────────────────────────── */
function configureCredentials(idToken) {
  const loginKey = 'cognito-idp.' + AWS_CONFIG.region + '.amazonaws.com/' + AWS_CONFIG.userPoolId;
  const logins = {};
  logins[loginKey] = idToken;

  AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: AWS_CONFIG.identityPoolId,
    Logins: logins,
  });

  return new Promise(function (resolve, reject) {
    AWS.config.credentials.refresh(function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/* ───────────────────────────────────────────────────────
   login(email, senha) → Promise<string>
   Autentica no User Pool e configura credenciais do
   Identity Pool. Retorna o idToken JWT.
   ─────────────────────────────────────────────────────── */
function login(email, senha) {
  return new Promise(function (resolve, reject) {
    var authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
      Username: email,
      Password: senha,
    });

    var cognitoUser = new AmazonCognitoIdentity.CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: function (result) {
        var idToken = result.getIdToken().getJwtToken();
        configureCredentials(idToken)
          .then(function () { resolve(idToken); })
          .catch(function (err) { reject(err); });
      },
      onFailure: function (err) {
        var msg;
        switch (err.code || err.name) {
          case 'NotAuthorizedException':
            msg = 'Email ou senha incorretos.';
            break;
          case 'UserNotFoundException':
            msg = 'Usuário não encontrado.';
            break;
          case 'UserNotConfirmedException':
            msg = 'Usuário ainda não confirmado. Verifique seu email.';
            break;
          case 'PasswordResetRequiredException':
            msg = 'É necessário redefinir sua senha.';
            break;
          case 'TooManyRequestsException':
            msg = 'Muitas tentativas. Aguarde e tente novamente.';
            break;
          case 'NetworkError':
            msg = 'Erro de conexão. Verifique sua internet.';
            break;
          default:
            msg = err.message || 'Erro ao autenticar. Tente novamente.';
        }
        reject(new Error(msg));
      },
      newPasswordRequired: function () {
        reject(new Error('É necessário redefinir sua senha. Peça ao administrador para confirmar seu usuário via AWS CLI.'));
      },
    });
  });
}

/* ───────────────────────────────────────────────────────
   logout()
   Encerra a sessão do Cognito e recarrega a página.
   ─────────────────────────────────────────────────────── */
function logout() {
  var currentUser = userPool.getCurrentUser();
  if (currentUser) {
    currentUser.signOut();
  }
  if (AWS.config.credentials && typeof AWS.config.credentials.clearCachedId === 'function') {
    AWS.config.credentials.clearCachedId();
  }
  AWS.config.credentials = null;
  location.reload();
}

/* ───────────────────────────────────────────────────────
   getSession() → Promise<string|null>
   Verifica se há sessão ativa. Retorna idToken ou null.
   ─────────────────────────────────────────────────────── */
function getSession() {
  return new Promise(function (resolve) {
    var currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      resolve(null);
      return;
    }

    currentUser.getSession(function (err, session) {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }
      resolve(session.getIdToken().getJwtToken());
    });
  });
}
