/* ═══════════════════════════════════════════════════════════
   MODEL — UserModel.js
   ═══════════════════════════════════════════════════════════

   Camada de DADOS e LÓGICA DE NEGÓCIO.

   ✅  Armazena estado (lista de usuários, cache)
   ✅  Inicializa AWS.S3 client
   ✅  CRUD completo no S3 (JSON por usuário + foto)
   ✅  Hash de senha com bcryptjs
   ✅  Validação de domínio (email único, formato)
   ✅  Mapeia erros AWS → mensagens PT-BR
   ❌  NUNCA acessa o DOM
   ❌  NUNCA importa View ou Controller

   Estrutura no S3:
     usuarios/{uuid}.json   → dados do usuário
     fotos/{uuid}.ext       → foto de perfil

   Endpoints S3 utilizados:
     PUT    /{Bucket}/{Key}                    → putObject()
     GET    /{Bucket}/{Key}                    → getObject()
     GET    /{Bucket}?list-type=2&prefix=      → listObjectsV2()
     DELETE /{Bucket}/{Key}                    → deleteObject()
     GET    /{Bucket}/{Key}?X-Amz-Signature=  → getSignedUrl()
   ═══════════════════════════════════════════════════════════ */

class UserModel {

  /* ─────────────────────────────────────────────────────
     CONSTRUCTOR
     ───────────────────────────────────────────────────── */
  constructor(config) {
    this._config = { ...config };
    this._users  = [];

    // ✅ Sem accessKeyId/secretAccessKey — Cognito já configurado em aws-config.js
    this._s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      region:     config.region,
    });
  }

  /* ═══════════════════════════════════════════════════════
     GETTERS
     ═══════════════════════════════════════════════════════ */

  get bucket()       { return this._config.bucket; }
  get region()       { return this._config.region; }
  get users()        { return [...this._users]; }

  /* ═══════════════════════════════════════════════════════
     UTILITÁRIOS
     ═══════════════════════════════════════════════════════ */

  /** Gera UUID v4 via API nativa. */
  generateId() {
    return crypto.randomUUID();
  }

  /** Key S3 do JSON do usuário. */
  buildUserKey(id) {
    return `usuarios/${id}.json`;
  }

  /** Key S3 da foto de perfil. */
  buildFotoKey(id, fileName) {
    const ext = fileName.split('.').pop().toLowerCase();

    // ✅ Sanitização: só extensões de imagem permitidas (bloqueia .svg, .html, etc.)
    const EXTENSOES_PERMITIDAS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const extSegura = EXTENSOES_PERMITIDAS.includes(ext) ? ext : 'bin';

    return `fotos/${id}.${extSegura}`;
  }

  /** Retorna inicial maiúscula do nome (para avatar fallback). */
  static getInitial(nome) {
    if (!nome) return '?';
    return nome.trim().charAt(0).toUpperCase();
  }

  /** Formata data ISO para pt-BR. */
  static formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR');
  }

  /** Formata bytes em string legível. */
  static formatBytes(bytes) {
    if (bytes < 1024)       return bytes + ' B';
    if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  }

  /* ═══════════════════════════════════════════════════════
     SENHA — bcryptjs
     ═══════════════════════════════════════════════════════ */

  /**
   * Hasheia a senha com bcrypt (salt rounds = 10).
   * @param {string} senha  Texto puro
   * @returns {Promise<string>}  Hash bcrypt
   */
  async hashSenha(senha) {
    // ✅ Versão async — não bloqueia a main thread
    return new Promise((resolve, reject) => {
      dcodeIO.bcrypt.hash(senha, 10, (err, hash) => {
        if (err) return reject(err);
        resolve(hash);
      });
    });
  }

  /**
   * Compara senha com hash.
   * @param {string} senha  Texto puro
   * @param {string} hash   Hash bcrypt
   * @returns {Promise<boolean>}
   */
  async verificarSenha(senha, hash) {
    // ✅ Versão async — não bloqueia a main thread
    return new Promise((resolve, reject) => {
      dcodeIO.bcrypt.compare(senha, hash, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  }

  /* ═══════════════════════════════════════════════════════
     VALIDAÇÕES DE DOMÍNIO
     ═══════════════════════════════════════════════════════ */

  /** Valida formato de email. */
  validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** Valida senha (mínimo 6 caracteres). */
  validarSenha(senha) {
    return senha && senha.length >= 6;
  }

  /** Valida arquivo de foto (MIME whitelist + max 2 MB). */
  validarFoto(file) {
    if (!file) return { valido: true };

    // ✅ Whitelist estrita de MIME types — bloqueia image/svg+xml, image/bmp, etc.
    const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!TIPOS_PERMITIDOS.includes(file.type)) {
      return { valido: false, msg: 'Tipo não aceito. Permitidos: JPEG, PNG, WebP, GIF.' };
    }
    if (file.size > 2 * 1024 * 1024) {
      return { valido: false, msg: `Foto muito grande (${UserModel.formatBytes(file.size)}). Máximo: 2 MB.` };
    }
    return { valido: true };
  }

  /**
   * Verifica se email já existe na lista de usuários.
   * @param {string} email
   * @param {string|null} excludeId  ID do próprio usuário (para edição)
   * @returns {boolean}
   */
  emailExiste(email, excludeId = null) {
    const normalizado = email.trim().toLowerCase();
    return this._users.some(
      u => u.email.toLowerCase() === normalizado && u.id !== excludeId
    );
  }

  /* ═══════════════════════════════════════════════════════
     MAPEAMENTO DE ERROS
     ═══════════════════════════════════════════════════════ */

  mapError(code) {
    const map = {
      NoSuchBucket:          'Bucket não encontrado — verifique nome e região.',
      InvalidAccessKeyId:    'Access Key ID inválida.',
      SignatureDoesNotMatch: 'Secret Key incorreta ou relógio desincronizado.',
      AccessDenied:          'Sem permissão — verifique as policies do IAM.',
      NetworkingError:       'Erro de rede — verifique o CORS do bucket.',
      NoSuchKey:             'Objeto não encontrado no S3.',
      CredentialsError:      'Credenciais inválidas.',
    };
    return map[code] || code;
  }

  resolveError(err) {
    const friendly = this.mapError(err.code);
    if (friendly !== err.code) {
      return { title: friendly, msg: `[${err.code}] ${err.message || ''}` };
    }
    return {
      title: 'Erro inesperado',
      msg:   `[${err.code || 'UNKNOWN'}] ${err.message || 'Tente novamente.'}`,
    };
  }

  /* ═══════════════════════════════════════════════════════
     ENDPOINTS S3 — CRUD
     ═══════════════════════════════════════════════════════ */

  /* ─── CREATE ───────────────────────────────────────── */

  /**
   * Cria um novo usuário: salva JSON no S3 + foto (se houver).
   *
   * @param {Object} dados  { nome, email, senha, telefone, endereco }
   * @param {File|null} fotoFile  Arquivo de imagem (opcional)
   * @returns {Promise<Object>}  Objeto do usuário criado
   */
  async criar(dados, fotoFile) {
    const id  = this.generateId();
    const now = new Date().toISOString();

    let fotoPerfil = '';
    if (fotoFile) {
      fotoPerfil = await this.uploadFoto(id, fotoFile);
    }

    const usuario = {
      id,
      nome:         dados.nome.trim(),
      email:        dados.email.trim().toLowerCase(),
      senha:        await this.hashSenha(dados.senha),
      telefone:     dados.telefone || '',
      endereco:     dados.endereco || '',
      fotoPerfil,
      criadoEm:     now,
      atualizadoEm: now,
    };

    await this._putJSON(this.buildUserKey(id), usuario);
    this._users.push(usuario);
    return usuario;
  }

  /* ─── READ — Listar todos ──────────────────────────── */

  /**
   * Lista todos os usuários do bucket (prefixo "usuarios/").
   * Faz listObjectsV2 + getObject para cada.
   * @returns {Promise<Object[]>}
   */
  async listar() {
    const keys = await this._listKeys('usuarios/');
    const usuarios = [];

    for (const key of keys) {
      try {
        const user = await this._getJSON(key);
        if (user && user.id) usuarios.push(user);
      } catch (e) {
        console.warn('Erro ao ler', key, e);
      }
    }

    this._users = usuarios;
    return [...this._users];
  }

  /* ─── READ — Buscar por ID ────────────────────────── */

  /**
   * Busca um usuário por ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async buscar(id) {
    try {
      return await this._getJSON(this.buildUserKey(id));
    } catch (e) {
      console.warn('Usuário não encontrado:', id, e);
      return null;
    }
  }

  /* ─── UPDATE ───────────────────────────────────────── */

  /**
   * Atualiza dados do usuário. Senha só é rehasheada se fornecida.
   *
   * @param {string} id
   * @param {Object} dados  Campos a atualizar
   * @param {File|null} novaFoto  Nova foto (opcional)
   * @returns {Promise<Object>}  Usuário atualizado
   */
  async atualizar(id, dados, novaFoto) {
    const atual = await this._getJSON(this.buildUserKey(id));
    if (!atual) throw new Error('Usuário não encontrado.');

    // Merge campos
    atual.nome     = dados.nome?.trim()   || atual.nome;
    atual.email    = dados.email?.trim().toLowerCase() || atual.email;
    atual.telefone = dados.telefone ?? atual.telefone;
    atual.endereco = dados.endereco ?? atual.endereco;

    // Senha — só rehasheia se veio preenchida
    if (dados.senha && dados.senha.length > 0) {
      atual.senha = await this.hashSenha(dados.senha);
    }

    // Foto — upload nova se fornecida
    if (novaFoto) {
      // Deletar foto antiga se existir
      if (atual.fotoPerfil) {
        try { await this._deleteKey(atual.fotoPerfil); } catch (_) {}
      }
      atual.fotoPerfil = await this.uploadFoto(id, novaFoto);
    }

    atual.atualizadoEm = new Date().toISOString();

    await this._putJSON(this.buildUserKey(id), atual);

    // Atualiza cache
    const idx = this._users.findIndex(u => u.id === id);
    if (idx >= 0) this._users[idx] = atual;

    return atual;
  }

  /* ─── DELETE ───────────────────────────────────────── */

  /**
   * Remove o JSON e a foto do S3.
   * @param {string} id
   * @param {string} fotoPerfil  Key da foto
   * @returns {Promise<void>}
   */
  async deletar(id, fotoPerfil) {
    await this._deleteKey(this.buildUserKey(id));

    if (fotoPerfil) {
      try { await this._deleteKey(fotoPerfil); } catch (_) {}
    }

    this._users = this._users.filter(u => u.id !== id);
  }

  /* ─── UPLOAD DE FOTO ───────────────────────────────── */

  /**
   * Faz upload da foto de perfil para fotos/{id}.ext
   * @param {string} id
   * @param {File} file
   * @returns {Promise<string>}  Key S3 da foto
   */
  async uploadFoto(id, file) {
    const key = this.buildFotoKey(id, file.name);

    await new Promise((resolve, reject) => {
      this._s3.putObject({
        Bucket:               this.bucket,
        Key:                  key,
        Body:                 file,
        ContentType:          file.type,
        ServerSideEncryption: 'AES256', // ✅ Criptografia em repouso
      }, (err) => err ? reject(err) : resolve());
    });

    return key;
  }

  /* ─── PRESIGNED URL ────────────────────────────────── */

  /**
   * Gera URL temporária para exibir foto.
   * @param {string} key  Key S3
   * @param {number} expires  Segundos (default 3600)
   * @returns {string}
   */
  getSignedUrl(key, expires = 3600) {
    if (!key) return '';
    return this._s3.getSignedUrl('getObject', {
      Bucket:  this.bucket,
      Key:     key,
      Expires: expires,
    });
  }

  /* ═══════════════════════════════════════════════════════
     MÉTODOS PRIVADOS — Wrappers S3
     ═══════════════════════════════════════════════════════ */

  /** PUT JSON stringificado no S3. */
  _putJSON(key, obj) {
    return new Promise((resolve, reject) => {
      this._s3.putObject({
        Bucket:               this.bucket,
        Key:                  key,
        Body:                 JSON.stringify(obj, null, 2),
        ContentType:          'application/json',
        ServerSideEncryption: 'AES256', // ✅ Criptografia em repouso
      }, (err, data) => err ? reject(err) : resolve(data));
    });
  }

  /** GET e parse JSON do S3. */
  _getJSON(key) {
    return new Promise((resolve, reject) => {
      this._s3.getObject({
        Bucket: this.bucket,
        Key:    key,
      }, (err, data) => {
        if (err) return reject(err);
        try {
          resolve(JSON.parse(data.Body.toString()));
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  /** Lista keys com determinado prefixo. */
  _listKeys(prefix) {
    return new Promise((resolve, reject) => {
      this._s3.listObjectsV2({
        Bucket:  this.bucket,
        Prefix:  prefix,
        MaxKeys: 1000,
      }, (err, data) => {
        if (err) return reject(err);
        const keys = (data.Contents || [])
          .filter(o => o.Size > 0)
          .map(o => o.Key);
        resolve(keys);
      });
    });
  }

  /** Delete key do S3. */
  _deleteKey(key) {
    return new Promise((resolve, reject) => {
      this._s3.deleteObject({
        Bucket: this.bucket,
        Key:    key,
      }, (err, data) => err ? reject(err) : resolve(data));
    });
  }
}
