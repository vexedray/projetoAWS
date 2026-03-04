/* ═══════════════════════════════════════════════════════════
   VIEW — UserView.js
   ═══════════════════════════════════════════════════════════

   Camada de APRESENTAÇÃO e INTERAÇÃO com o DOM.

   ✅  Captura e cacheia referências do DOM
   ✅  Renderiza tabela, modais, alertas, preview de foto
   ✅  Expõe bind*() para o Controller registrar handlers
   ✅  Máscara de telefone, preview de foto, filtro local
   ✅  Não referencia UserModel — desacoplamento MVC
   ❌  NUNCA conhece o AWS SDK
   ❌  NUNCA acessa o Model diretamente
   ❌  Não contém lógica de negócio
   ═══════════════════════════════════════════════════════════ */

class UserView {

  /* ─────────────────────────────────────────────────────
     CONSTRUCTOR — Cacheia TODAS as referências do DOM
     ───────────────────────────────────────────────────── */
  constructor() {
    // ─ Toolbar
    this.searchInput    = document.getElementById('searchInput');
    this.novoBtn        = document.getElementById('novoBtn');
    this.userCount      = document.getElementById('userCount');

    // ─ Tabela
    this.tabelaBody     = document.getElementById('tabelaBody');

    // ─ Modal Cadastro/Edição
    this.userModal      = document.getElementById('userModal');
    this.modalTitle     = document.getElementById('modalTitle');
    this.closeModalBtn  = document.getElementById('closeModalBtn');
    this.editId         = document.getElementById('editId');
    this.editFotoKey    = document.getElementById('editFotoKey');
    this.fotoInput      = document.getElementById('fotoInput');
    this.fotoPreview    = document.getElementById('fotoPreview');
    this.fotoInitial    = document.getElementById('fotoInitial');
    this.nomeInput      = document.getElementById('nomeInput');
    this.emailInput     = document.getElementById('emailInput');
    this.senhaInput     = document.getElementById('senhaInput');
    this.confirmarInput = document.getElementById('confirmarInput');
    this.telefoneInput  = document.getElementById('telefoneInput');
    this.enderecoInput  = document.getElementById('enderecoInput');
    this.salvarBtn      = document.getElementById('salvarBtn');
    this.cancelarBtn    = document.getElementById('cancelarBtn');

    // ─ Modal Delete
    this.deleteModal    = document.getElementById('deleteModal');
    this.deleteNome     = document.getElementById('deleteNome');
    this.deleteId       = document.getElementById('deleteId');
    this.deleteFotoKey  = document.getElementById('deleteFotoKey');
    this.confirmDelBtn  = document.getElementById('confirmDeleteBtn');
    this.cancelDelBtn   = document.getElementById('cancelDeleteBtn');
    this.closeDelBtn    = document.getElementById('closeDeleteBtn');

    // ─ Loading
    this.loadingOverlay = document.getElementById('loadingOverlay');

    // ─ Toast container
    this.toastContainer = document.getElementById('toastContainer');

    // ─ Bind internos (puro UI)
    this._bindFotoPreview();
    this._bindMascaraTelefone();
    this._bindFecharModais();

    // ✅ Handlers de ação da tabela (registrados pelo Controller via bind*)
    this._onEditHandler   = null;
    this._onDeleteHandler  = null;
    this._bindTabelaDelegation();
  }

  /* ═══════════════════════════════════════════════════════
     UTILITÁRIOS INTERNOS DA VIEW
     ═══════════════════════════════════════════════════════ */

  // ✅ Movido para View — não depende mais de UserModel.getInitial()
  _getInicial(nome) {
    if (!nome) return '?';
    return nome.trim().charAt(0).toUpperCase();
  }

  /* ═══════════════════════════════════════════════════════
     BIND METHODS — Controller registra handlers aqui
     ═══════════════════════════════════════════════════════ */

  /**
   * Clique no botão "+ Novo Usuário".
   * @param {Function} handler  () => void
   */
  bindNovoUsuario(handler) {
    this.novoBtn.addEventListener('click', () => handler());
  }

  /**
   * Submit do formulário (salvar). Lê todos os campos.
   * @param {Function} handler  (id|null, dados, fotoFile|null) => void
   */
  bindSalvar(handler) {
    this.salvarBtn.addEventListener('click', () => {
      const id = this.editId.value || null;
      const dados = {
        nome:      this.nomeInput.value,
        email:     this.emailInput.value,
        senha:     this.senhaInput.value,
        confirmar: this.confirmarInput.value,
        telefone:  this.telefoneInput.value,
        endereco:  this.enderecoInput.value,
      };
      const foto = this.fotoInput.files[0] || null;
      handler(id, dados, foto);
    });
  }

  /**
   * Clique no botão ✏️ Editar na tabela.
   * @param {Function} handler  (id) => void
   */
  bindEditarClick(handler) {
    // ✅ Event delegation — sem window globals
    this._onEditHandler = handler;
  }

  /**
   * Clique no botão 🗑️ Deletar na tabela.
   * @param {Function} handler  (id, nome, fotoPerfil) => void
   */
  bindDeletarClick(handler) {
    // ✅ Event delegation — sem window globals
    this._onDeleteHandler = handler;
  }

  /**
   * Confirmação de exclusão no modal.
   * @param {Function} handler  (id, fotoPerfil) => void
   */
  bindConfirmDelete(handler) {
    this.confirmDelBtn.addEventListener('click', () => {
      const id       = this.deleteId.value;
      const fotoKey  = this.deleteFotoKey.value;
      handler(id, fotoKey);
    });
  }

  /**
   * Digitação no campo de busca.
   * @param {Function} handler  (query) => void
   */
  bindBuscar(handler) {
    this.searchInput.addEventListener('input', () => {
      handler(this.searchInput.value.trim());
    });
  }

  /* ═══════════════════════════════════════════════════════
     RENDER — TABELA DE USUÁRIOS
     ═══════════════════════════════════════════════════════ */

  /**
   * Renderiza tabela com lista de usuários.
   * @param {Object[]} usuarios
   * @param {Object} fotoUrlMap  { id: signedUrl }
   */
  renderTabela(usuarios, fotoUrlMap = {}) {
    // corrigido — limpa conteúdo anterior antes de renderizar (evita sobreposição)
    this.tabelaBody.innerHTML = '';

    if (!usuarios || usuarios.length === 0) {
      this.tabelaBody.innerHTML =
        `<div class="empty-state">
          <span class="empty-icon">👤</span>
          <div class="empty-title">Nenhum usuário cadastrado</div>
          <div class="empty-sub">Clique em "+ Novo Usuário" para começar.</div>
        </div>`;
      return;
    }

    let rows = '';
    for (const u of usuarios) {
      const fotoUrl   = fotoUrlMap[u.id] || '';
      const initial   = this._getInicial(u.nome); // ✅ Usa método da View, não do Model
      const safeNome  = this._esc(u.nome);
      const safeEmail = this._esc(u.email);
      const safeTel   = this._esc(u.telefone || '—'); // ✅ Escape no telefone
      const safeFotoKey = this._esc(u.fotoPerfil || '');

      const avatarHtml = fotoUrl
        ? `<img class="avatar" src="${fotoUrl}" alt="${safeNome}" />`
        : `<div class="avatar avatar-fallback">${initial}</div>`;

      // ✅ Event delegation via data-* — sem onclick inline, sem window globals
      rows +=
        `<tr>
          <td>${avatarHtml}</td>
          <td class="col-nome">${safeNome}</td>
          <td class="col-email">${safeEmail}</td>
          <td class="col-telefone">${safeTel}</td>
          <td class="col-actions">
            <button class="btn btn-ghost btn-icon" data-action="editar" data-id="${u.id}" title="Editar">✏️</button>
            <button class="btn btn-ghost btn-icon btn-icon-danger" data-action="deletar" data-id="${u.id}" data-nome="${safeNome}" data-foto="${safeFotoKey}" title="Excluir">🗑️</button>
          </td>
        </tr>`;
    }

    this.tabelaBody.innerHTML =
      `<table class="user-table">
        <thead><tr>
          <th style="width:52px">Foto</th>
          <th>Nome</th>
          <th>Email</th>
          <th>Telefone</th>
          <th style="width:90px;text-align:right">Ações</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // corrigido — estado vazio específico para busca sem resultados (não confunde com lista vazia)
  renderSemResultados(query) {
    this.tabelaBody.innerHTML =
      `<div class="empty-state">
        <span class="empty-icon">🔍</span>
        <div class="empty-title">Nenhum resultado encontrado</div>
        <div class="empty-sub">Nenhum usuário corresponde a "${this._esc(query)}".</div>
      </div>`;
  }

  renderTabelaLoading() {
    // corrigido — limpa conteúdo anterior antes do spinner
    this.tabelaBody.innerHTML =
      `<div class="empty-state">
        <div class="spinner"></div>
        <div class="empty-title" style="margin-top:16px">Carregando usuários...</div>
      </div>`;
  }

  /** Atualiza badge de contagem. */
  renderContador(n) {
    this.userCount.textContent = n;
    this.userCount.style.display = n > 0 ? 'inline-flex' : 'none';
  }

  /* ═══════════════════════════════════════════════════════
     MODAIS
     ═══════════════════════════════════════════════════════ */

  /* ─── Modal Cadastro (limpo) ───────────────────────── */

  abrirModalCadastro() {
    this.modalTitle.textContent = '👤  Novo Usuário';
    this.editId.value       = '';
    this.editFotoKey.value  = '';
    this.nomeInput.value    = '';
    this.emailInput.value   = '';
    this.senhaInput.value   = '';
    this.confirmarInput.value = '';
    this.telefoneInput.value = '';
    this.enderecoInput.value = '';
    this.fotoInput.value     = '';
    this.senhaInput.placeholder     = 'Mínimo 6 caracteres *';
    this.confirmarInput.placeholder = 'Repita a senha *';

    // Reset foto preview
    this.fotoPreview.style.display   = 'none';
    this.fotoPreview.src             = '';
    this.fotoInitial.style.display   = 'flex';
    this.fotoInitial.textContent     = '📷';

    this.clearValidation();
    this.userModal.classList.add('show');
  }

  /* ─── Modal Edição (preenchido) ────────────────────── */

  /**
   * @param {Object} usuario  Dados do usuário
   * @param {string} fotoUrl  URL assinada da foto (ou '')
   */
  abrirModalEdicao(usuario, fotoUrl) {
    this.modalTitle.textContent = '✏️  Editar Usuário';
    this.editId.value          = usuario.id;
    this.editFotoKey.value     = usuario.fotoPerfil || '';
    this.nomeInput.value       = usuario.nome;
    this.emailInput.value      = usuario.email;
    this.senhaInput.value      = '';
    this.confirmarInput.value  = '';
    this.telefoneInput.value   = usuario.telefone || '';
    this.enderecoInput.value   = usuario.endereco || '';
    this.fotoInput.value       = '';
    this.senhaInput.placeholder     = 'Deixe vazio para manter';
    this.confirmarInput.placeholder = 'Deixe vazio para manter';

    // Foto
    if (fotoUrl) {
      this.fotoPreview.src           = fotoUrl;
      this.fotoPreview.style.display = 'block';
      this.fotoInitial.style.display = 'none';
    } else {
      this.fotoPreview.style.display   = 'none';
      this.fotoInitial.style.display   = 'flex';
      this.fotoInitial.textContent     = this._getInicial(usuario.nome); // ✅ View, não Model
    }

    this.clearValidation();
    this.userModal.classList.add('show');
  }

  fecharModal() {
    this.userModal.classList.remove('show');
  }

  /* ─── Modal Delete ─────────────────────────────────── */

  abrirModalDelete(id, nome, fotoPerfil) {
    this.deleteId.value       = id;
    this.deleteFotoKey.value  = fotoPerfil || '';
    this.deleteNome.textContent = nome;
    this.deleteModal.classList.add('show');
  }

  fecharModalDelete() {
    this.deleteModal.classList.remove('show');
  }

  /* ═══════════════════════════════════════════════════════
     FOTO PREVIEW
     ═══════════════════════════════════════════════════════ */

  previewFoto(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.fotoPreview.src           = e.target.result;
      this.fotoPreview.style.display = 'block';
      this.fotoInitial.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  /* ═══════════════════════════════════════════════════════
     LOADING & FEEDBACK
     ═══════════════════════════════════════════════════════ */

  setLoading(ativo) {
    this.loadingOverlay.classList.toggle('show', ativo);
  }

  setSalvando(ativo) {
    this.salvarBtn.disabled = ativo;
    this.salvarBtn.innerHTML = ativo
      ? '<span class="spinner-sm"></span>&nbsp; Salvando...'
      : '💾 &nbsp; Salvar';
  }

  /* ─── Toasts ───────────────────────────────────────── */

  showSucesso(msg) {
    this._toast('success', '✅', msg);
  }

  showErro(msg) {
    this._toast('error', '🚨', msg);
  }

  // ✅ Construção segura via DOM API — sem innerHTML com dados dinâmicos (previne XSS)
  _toast(type, icon, msg) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icon;

    const msgSpan = document.createElement('span');
    msgSpan.className = 'toast-msg';
    msgSpan.textContent = msg; // ✅ textContent — nunca innerHTML

    el.appendChild(iconSpan);
    el.appendChild(msgSpan);
    this.toastContainer.appendChild(el);

    // Auto-remove after 4s
    setTimeout(() => {
      el.classList.add('toast-out');
      setTimeout(() => el.remove(), 400);
    }, 4000);
  }

  /* ─── Validation Errors ────────────────────────────── */

  /**
   * Exibe erros de validação inline nos campos.
   * @param {Array<{campo: string, msg: string}>} errors
   */
  showValidationErrors(errors) {
    this.clearValidation();
    for (const err of errors) {
      const input = document.getElementById(`${err.campo}Input`);
      if (input) {
        input.classList.add('input-error');
        const msg = document.createElement('span');
        msg.className = 'validation-msg';
        msg.textContent = err.msg;
        input.parentElement.appendChild(msg);
      }
    }
  }

  clearValidation() {
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    document.querySelectorAll('.validation-msg').forEach(el => el.remove());
  }

  /* ═══════════════════════════════════════════════════════
     INTERNOS — Puro UI (sem Controller)
     ═══════════════════════════════════════════════════════ */

  /** Preview de foto ao selecionar arquivo. */
  _bindFotoPreview() {
    this.fotoInput.addEventListener('change', () => {
      const file = this.fotoInput.files[0];
      if (file && file.type.startsWith('image/')) {
        this.previewFoto(file);
      }
    });
  }

  /** Máscara de telefone: (00) 00000-0000. */
  _bindMascaraTelefone() {
    this.telefoneInput.addEventListener('input', () => {
      let v = this.telefoneInput.value.replace(/\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 6) {
        v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
      } else if (v.length > 2) {
        v = `(${v.slice(0,2)}) ${v.slice(2)}`;
      } else if (v.length > 0) {
        v = `(${v}`;
      }
      this.telefoneInput.value = v;
    });
  }

  /** Fechar modais pelo ✕, overlay, ou Cancelar. */
  _bindFecharModais() {
    // Modal cadastro/edição
    this.closeModalBtn.addEventListener('click', () => this.fecharModal());
    this.cancelarBtn.addEventListener('click', () => this.fecharModal());
    this.userModal.addEventListener('click', (e) => {
      if (e.target === this.userModal) this.fecharModal();
    });

    // Modal delete
    this.closeDelBtn.addEventListener('click', () => this.fecharModalDelete());
    this.cancelDelBtn.addEventListener('click', () => this.fecharModalDelete());
    this.deleteModal.addEventListener('click', (e) => {
      if (e.target === this.deleteModal) this.fecharModalDelete();
    });
  }

  /** Escapa HTML. */
  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ✅ Event delegation na tabela — elimina onclick inline e window globals
  _bindTabelaDelegation() {
    this.tabelaBody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id     = btn.dataset.id;

      if (action === 'editar' && this._onEditHandler) {
        this._onEditHandler(id);
      } else if (action === 'deletar' && this._onDeleteHandler) {
        this._onDeleteHandler(id, btn.dataset.nome, btn.dataset.foto);
      }
    });
  }
}
