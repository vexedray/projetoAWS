/* ═══════════════════════════════════════════════════════════
   CONTROLLER — UserController.js
   ═══════════════════════════════════════════════════════════

   Camada de ORQUESTRAÇÃO — conecta Model ↔ View.

   ✅  Registra handlers da View nos métodos do Model
   ✅  Valida dados de formulário antes de chamar Model
   ✅  Orquestra fluxo: ação do usuário → Model → View
   ❌  NUNCA acessa o DOM (document.getElementById etc.)
   ❌  NUNCA chama AWS SDK diretamente

   Fluxo:
     1. View captura ação do usuário
     2. View chama handler registrado pelo Controller
     3. Controller valida dados
     4. Controller chama Model.endpoint()
     5. Controller atualiza View com resultado
   ═══════════════════════════════════════════════════════════ */

class UserController {

  /**
   * @param {UserModel} model
   * @param {UserView}  view
   */
  constructor(model, view) {
    this.model    = model;
    this.view     = view;
    this._fotoUrls = {};
    this.init();
  }

  /* ═══════════════════════════════════════════════════════
     INIT — Registra handlers e carrega lista inicial
     ═══════════════════════════════════════════════════════ */

  async init() {

    /* ─── Novo Usuário ───────────────────────────────── */
    this.view.bindNovoUsuario(() => {
      this.view.abrirModalCadastro();
    });

    /* ─── Salvar (criar ou atualizar) ────────────────── */
    this.view.bindSalvar((id, dados, foto) => {
      if (id) {
        this._handleAtualizar(id, dados, foto);
      } else {
        this._handleCriar(dados, foto);
      }
    });

    /* ─── Editar (abrir modal preenchido) ────────────── */
    this.view.bindEditarClick((id) => {
      this._handleAbrirEdicao(id);
    });

    /* ─── Deletar (abrir modal confirmação) ──────────── */
    this.view.bindDeletarClick((id, nome, fotoPerfil) => {
      this.view.abrirModalDelete(id, nome, fotoPerfil);
    });

    /* ─── Confirmar Delete ───────────────────────────── */
    this.view.bindConfirmDelete((id, fotoPerfil) => {
      this._handleDeletar(id, fotoPerfil);
    });

    /* ─── Busca ──────────────────────────────────────── */
    this.view.bindBuscar((query) => {
      this._handleBuscar(query);
    });

    /* ─── Carrega lista inicial ──────────────────────── */
    await this.carregarLista();
  }

  /* ═══════════════════════════════════════════════════════
     CARREGAR LISTA
     ═══════════════════════════════════════════════════════ */

  async carregarLista() {
    this.view.renderTabelaLoading();

    try {
      const usuarios = await this.model.listar();

      // Gera URLs assinadas para fotos
      this._fotoUrls = {};
      for (const u of usuarios) {
        if (u.fotoPerfil) {
          this._fotoUrls[u.id] = this.model.getSignedUrl(u.fotoPerfil);
        }
      }

      this.view.renderTabela(usuarios, this._fotoUrls);
      this.view.renderContador(usuarios.length);

    } catch (err) {
      const resolved = this.model.resolveError(err);
      this.view.showErro(`${resolved.title} — ${resolved.msg}`);
      this.view.renderTabela([], {});
      this.view.renderContador(0);
    }
  }

  /* ═══════════════════════════════════════════════════════
     CRIAR USUÁRIO
     ═══════════════════════════════════════════════════════ */

  async _handleCriar(dados, foto) {
    // Validações
    const errors = this._validar(dados, false, foto);
    if (errors.length > 0) {
      this.view.showValidationErrors(errors);
      return;
    }

    // Email único
    if (this.model.emailExiste(dados.email)) {
      this.view.showValidationErrors([{ campo: 'email', msg: 'Este email já está cadastrado.' }]);
      return;
    }

    this.view.setSalvando(true);

    try {
      await this.model.criar(dados, foto);
      this.view.fecharModal();
      this.view.showSucesso(`Usuário "${dados.nome}" cadastrado com sucesso!`);
      await this.carregarLista();
    } catch (err) {
      const resolved = this.model.resolveError(err);
      this.view.showErro(`${resolved.title} — ${resolved.msg}`);
    } finally {
      this.view.setSalvando(false);
    }
  }

  /* ═══════════════════════════════════════════════════════
     ABRIR EDIÇÃO
     ═══════════════════════════════════════════════════════ */

  async _handleAbrirEdicao(id) {
    this.view.setLoading(true);

    try {
      const usuario = await this.model.buscar(id);
      if (!usuario) {
        this.view.showErro('Usuário não encontrado.');
        return;
      }

      const fotoUrl = usuario.fotoPerfil
        ? this.model.getSignedUrl(usuario.fotoPerfil)
        : '';

      this.view.abrirModalEdicao(usuario, fotoUrl);
    } catch (err) {
      const resolved = this.model.resolveError(err);
      this.view.showErro(`${resolved.title} — ${resolved.msg}`);
    } finally {
      this.view.setLoading(false);
    }
  }

  /* ═══════════════════════════════════════════════════════
     ATUALIZAR USUÁRIO
     ═══════════════════════════════════════════════════════ */

  async _handleAtualizar(id, dados, foto) {
    // Validações (edição — senha opcional)
    const errors = this._validar(dados, true, foto);
    if (errors.length > 0) {
      this.view.showValidationErrors(errors);
      return;
    }

    // Email único (excluindo o próprio)
    if (this.model.emailExiste(dados.email, id)) {
      this.view.showValidationErrors([{ campo: 'email', msg: 'Este email já está cadastrado por outro usuário.' }]);
      return;
    }

    this.view.setSalvando(true);

    try {
      await this.model.atualizar(id, dados, foto);
      this.view.fecharModal();
      this.view.showSucesso(`Usuário "${dados.nome}" atualizado com sucesso!`);
      await this.carregarLista();
    } catch (err) {
      const resolved = this.model.resolveError(err);
      this.view.showErro(`${resolved.title} — ${resolved.msg}`);
    } finally {
      this.view.setSalvando(false);
    }
  }

  /* ═══════════════════════════════════════════════════════
     DELETAR USUÁRIO
     ═══════════════════════════════════════════════════════ */

  async _handleDeletar(id, fotoPerfil) {
    this.view.fecharModalDelete();
    this.view.setLoading(true);

    try {
      await this.model.deletar(id, fotoPerfil);
      this.view.showSucesso('Usuário excluído com sucesso!');
      await this.carregarLista();
    } catch (err) {
      const resolved = this.model.resolveError(err);
      this.view.showErro(`${resolved.title} — ${resolved.msg}`);
    } finally {
      this.view.setLoading(false);
    }
  }

  /* ═══════════════════════════════════════════════════════
     BUSCA LOCAL
     ═══════════════════════════════════════════════════════ */

  _handleBuscar(query) {
    const q = query.toLowerCase();
    const todos = this.model.users;

    const filtrados = q
      ? todos.filter(u =>
          u.nome.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        )
      : todos;

    this.view.renderTabela(filtrados, this._fotoUrls);
    this.view.renderContador(filtrados.length);
  }

  /* ═══════════════════════════════════════════════════════
     VALIDAÇÃO DE FORMULÁRIO
     ═══════════════════════════════════════════════════════ */

  /**
   * Valida dados do formulário.
   * @param {Object} dados
   * @param {boolean} isEdicao  Se true, senha é opcional
   * @param {File|null} foto
   * @returns {Array<{campo: string, msg: string}>}
   */
  _validar(dados, isEdicao, foto) {
    const errors = [];

    // Nome obrigatório
    if (!dados.nome || !dados.nome.trim()) {
      errors.push({ campo: 'nome', msg: 'Nome é obrigatório.' });
    }

    // Email obrigatório + formato
    if (!dados.email || !dados.email.trim()) {
      errors.push({ campo: 'email', msg: 'Email é obrigatório.' });
    } else if (!this.model.validarEmail(dados.email)) {
      errors.push({ campo: 'email', msg: 'Formato de email inválido.' });
    }

    // Senha
    if (!isEdicao) {
      // Cadastro: obrigatória
      if (!dados.senha) {
        errors.push({ campo: 'senha', msg: 'Senha é obrigatória.' });
      } else if (!this.model.validarSenha(dados.senha)) {
        errors.push({ campo: 'senha', msg: 'Mínimo 6 caracteres.' });
      }
    } else {
      // Edição: opcional, mas se preenchida deve ter 6+ chars
      if (dados.senha && !this.model.validarSenha(dados.senha)) {
        errors.push({ campo: 'senha', msg: 'Mínimo 6 caracteres.' });
      }
    }

    // Confirmar senha
    if (dados.senha && dados.senha !== dados.confirmar) {
      errors.push({ campo: 'confirmar', msg: 'As senhas não coincidem.' });
    }

    // Foto
    if (foto) {
      const v = this.model.validarFoto(foto);
      if (!v.valido) {
        errors.push({ campo: 'foto', msg: v.msg });
      }
    }

    return errors;
  }
}
