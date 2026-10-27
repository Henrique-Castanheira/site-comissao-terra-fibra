import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { auth, db } from "./firebase-init.js";
import { CATEGORIAS, calcular, analisarFaixa, projetarFimDoMes, formatarBRL, ARQUIVO_FONTE, VERSAO_REGRAS } from "./comissoes.js";
import {
  mensagemFaixaAtual,
  mensagemProximaFaixa,
  mensagemWhatsApp,
  mensagemMudancaDeFaixa,
  mensagensProjecao,
  AVISO_PROJECAO,
} from "./dicas.js";
import {
  CAMPO_ULTIMO_CALCULO,
  montarUltimoCalculo,
  chaveDoCalculo,
  calculoSalvoValido,
  resultadoDoCalculoSalvo,
  entradasParaFormulario,
  formatarDataHora,
} from "./ultimo-calculo.js";
import { salvarUltimoCalculo } from "./ultimo-calculo-db.js";

document.addEventListener("DOMContentLoaded", () => {
  const saudacaoEl = document.getElementById("saudacao");
  const nomeEl = document.getElementById("nome-usuario");
  const telEl = document.getElementById("numero-usuario");
  const btnSair = document.getElementById("btn-sair");

  // Elementos do simulador
  const formSimulador = document.getElementById("form-simulador");
  const canalSelect = document.getElementById("canal-vendas");
  const camposBox = document.getElementById("campos-dinamicos");
  const rvTotalExibida = document.getElementById("rv-total-exibida");
  const detalhesCalculo = document.getElementById("detalhes-calculo");
  const statusSalvamento = document.getElementById("status-salvamento");
  const btnTentarSalvar = document.getElementById("btn-tentar-salvar");
  const faixaAtualEl = document.getElementById("faixa-atual");
  const boxNotificacao = document.getElementById("box-notificacao");
  const textoNotificacao = document.getElementById("texto-notificacao");
  const btnWhatsapp = document.getElementById("btn-whatsapp");
  const diasTrabalhadosEl = document.getElementById("dias-trabalhados");
  const diasRestantesEl = document.getElementById("dias-restantes");
  const resultadoProjecaoEl = document.getElementById("resultado-projecao");

  // ---------------------------------------------------------------------------
  // Simulador: toda a regra de cálculo vive em comissoes.js; aqui só há interface.
  // Nada é montado com innerHTML a partir de dados: apenas createElement/textContent.
  // ---------------------------------------------------------------------------

  function categoriaAtual() {
    return CATEGORIAS.find((c) => c.id === canalSelect.value) || CATEGORIAS[0];
  }

  function criarElemento(tag, propriedades = {}, texto) {
    const el = document.createElement(tag);
    Object.assign(el, propriedades);
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  /** Monta os campos da categoria selecionada (somente os necessários). */
  function montarCampos(cat) {
    camposBox.replaceChildren();
    cat.campos.forEach((campo) => {
      const idCampo = `campo-${campo.id}`;
      const wrapper = criarElemento("div", { className: campo.tipo === "checkbox" ? "campo campo-checkbox" : "campo" });
      let entrada;

      if (campo.tipo === "selecao") {
        entrada = criarElemento("select", { id: idCampo });
        if (!campo.padrao) entrada.appendChild(criarElemento("option", { value: "" }, "Selecione..."));
        campo.opcoes.forEach((o) => entrada.appendChild(criarElemento("option", { value: o.valor }, o.rotulo)));
        if (campo.padrao) entrada.value = campo.padrao;
      } else if (campo.tipo === "checkbox") {
        entrada = criarElemento("input", { id: idCampo, type: "checkbox" });
      } else {
        entrada = criarElemento("input", { id: idCampo, type: "number", inputMode: "decimal", min: "0", step: "any" });
        if (campo.tipo === "inteiro") {
          entrada.step = "1";
          entrada.inputMode = "numeric";
        }
        if (campo.tipo === "percentual") entrada.max = "100";
        // Sem valores pré-preenchidos: campo vazio = dado ausente (diferente de zero).
      }
      entrada.dataset.campo = campo.id;

      const rotulo = criarElemento("label", { htmlFor: idCampo }, campo.rotulo + (campo.obrigatorio ? "" : " (opcional)"));
      if (campo.tipo === "checkbox") {
        wrapper.append(entrada, rotulo);
      } else {
        wrapper.append(rotulo, entrada);
      }
      if (campo.ajuda) wrapper.appendChild(criarElemento("small", { className: "ajuda" }, campo.ajuda));
      camposBox.appendChild(wrapper);
    });
  }

  /** Lê os valores digitados. Vazio permanece vazio (nunca vira 0 nem 100). */
  function lerEntradas(cat) {
    const entradas = {};
    cat.campos.forEach((campo) => {
      const el = camposBox.querySelector(`[data-campo="${campo.id}"]`);
      if (!el) return;
      entradas[campo.id] = campo.tipo === "checkbox" ? el.checked : el.value;
    });
    return entradas;
  }

  function limparResultado() {
    detalhesCalculo.replaceChildren();
  }

  /** Monta um elemento com as "partes" de uma mensagem (texto e negrito), sem innerHTML. */
  function montarMensagem(tag, partes, className) {
    const el = criarElemento(tag, className ? { className } : {});
    partes.forEach((p) => el.append(typeof p === "string" ? document.createTextNode(p) : criarElemento("strong", {}, p.negrito)));
    return el;
  }

  // Última faixa mostrada na categoria atual (para avisar "você subiu de faixa").
  let faixaAnterior = null; // { categoria, descricao, rvTotal }

  function limparDicas() {
    faixaAtualEl.hidden = true;
    faixaAtualEl.replaceChildren();
    boxNotificacao.hidden = true;
    boxNotificacao.classList.remove("sobe");
    textoNotificacao.replaceChildren();
    btnWhatsapp.hidden = true;
    btnWhatsapp.removeAttribute("href");
  }

  /** Faixa atual, quanto falta para a próxima e aviso de mudança de faixa. Só para cálculos válidos. */
  function mostrarDicas(cat, entradas, resultado) {
    limparDicas();
    if (!resultado.ok) {
      faixaAnterior = null;
      return;
    }
    const analise = analisarFaixa(cat.id, entradas);
    const atual = { categoria: cat.id, descricao: resultado.faixa ? resultado.faixa.descricao : null, rvTotal: resultado.rvTotal };
    const mudanca = faixaAnterior && faixaAnterior.categoria === cat.id ? mensagemMudancaDeFaixa(faixaAnterior, atual) : null;
    faixaAnterior = atual;

    const faixa = mensagemFaixaAtual(analise);
    if (faixa) {
      faixaAtualEl.replaceChildren(...montarMensagem("span", faixa).childNodes);
      faixaAtualEl.hidden = false;
    }

    const linhas = [];
    if (mudanca) linhas.push(mudanca);
    const prox = mensagemProximaFaixa(analise);
    if (prox) linhas.push(prox);
    if (linhas.length) {
      linhas.forEach((l) => textoNotificacao.appendChild(montarMensagem("p", l)));
      boxNotificacao.classList.toggle("sobe", Boolean(mudanca) && !analise.proxima);
      boxNotificacao.hidden = false;
    }
    const zap = mensagemWhatsApp(analise);
    if (zap) {
      btnWhatsapp.href = `https://wa.me/?text=${encodeURIComponent(zap)}`;
      btnWhatsapp.hidden = false;
    }
  }

  /** Projeção até o fim do mês (só aparece depois de informar os dois campos de dias). */
  function atualizarProjecao() {
    if (!resultadoProjecaoEl) return;
    resultadoProjecaoEl.replaceChildren();
    const dt = diasTrabalhadosEl.value;
    const dr = diasRestantesEl.value;
    if (dt === "" && dr === "") return;
    const cat = categoriaAtual();
    const proj = projetarFimDoMes(cat.id, lerEntradas(cat), { diasTrabalhados: dt, diasRestantes: dr });
    if (!proj.ok) {
      proj.erros.forEach((e) => resultadoProjecaoEl.appendChild(criarElemento("p", { className: "erro" }, e)));
      return;
    }
    const moeda = cat.id !== "lider_digital_time";
    mensagensProjecao(proj, moeda).forEach((m) => resultadoProjecaoEl.appendChild(montarMensagem("p", m)));
    resultadoProjecaoEl.appendChild(criarElemento("p", { className: "nota-simulador" }, AVISO_PROJECAO));
  }

  /** Mostra o resultado (ou os campos que faltam). `explicito` = usuário clicou em Calcular. */
  function mostrarResultado(r, explicito) {
    limparResultado();

    if (!r.ok) {
      rvTotalExibida.textContent = "R$ 0,00";
      const lista = criarElemento("ul", { className: "msg-preencher" + (explicito ? " erro" : "") });
      r.erros.forEach((e) => lista.appendChild(criarElemento("li", {}, e)));
      detalhesCalculo.append(
        criarElemento("div", { className: "nota-simulador" }, explicito ? "Verifique os valores informados:" : "Preencha os campos para ver a estimativa:"),
        lista
      );
      return;
    }

    rvTotalExibida.textContent = formatarBRL(r.rvTotal);

    if (r.parcial) {
      detalhesCalculo.appendChild(
        criarElemento("div", { className: "banner-parcial" }, "Resultado parcial: esta simulação NÃO contempla todas as regras do documento (veja o aviso abaixo).")
      );
    }

    // Componentes aplicáveis (base, acelerador, adicionais...). Total = soma exata.
    if (r.componentes.length) {
      const ul = criarElemento("ul", { className: "lista-componentes" });
      r.componentes.forEach((c) => {
        const li = criarElemento("li");
        li.append(criarElemento("span", {}, c.rotulo), criarElemento("strong", {}, formatarBRL(c.valor)));
        ul.appendChild(li);
      });
      detalhesCalculo.appendChild(ul);
    }

    if (r.avisos.length) {
      const ul = criarElemento("ul", { className: "lista-avisos" });
      r.avisos.forEach((a) => ul.appendChild(criarElemento("li", {}, a)));
      detalhesCalculo.appendChild(ul);
    }

    const memoria = criarElemento("details", { className: "memoria", open: true });
    memoria.appendChild(criarElemento("summary", {}, "Memória de cálculo"));
    const ol = criarElemento("ol");
    r.memoria.forEach((linha) => ol.appendChild(criarElemento("li", {}, linha)));
    memoria.appendChild(ol);
    detalhesCalculo.appendChild(memoria);

    detalhesCalculo.appendChild(
      criarElemento("div", { className: "fonte-simulador" }, `Fonte: ${ARQUIVO_FONTE}, p. ${r.paginaPdf}.`)
    );
  }

  // ---------------------------------------------------------------------------
  // Último cálculo salvo (users/{uid}.lastCalculation): salva sozinho após um cálculo válido.
  //  - Um único registro por usuário (cada cálculo novo substitui o anterior).
  //  - Cliques em "Calcular" salvam na hora; edições digitadas salvam após uma pausa curta.
  //  - Uma gravação por vez; se chegar um cálculo novo durante a gravação, só o mais recente é gravado.
  //  - O mesmo cálculo (mesmos dados) não é gravado de novo.
  // ---------------------------------------------------------------------------
  const ATRASO_SALVAR_MS = 1200;
  let usuarioAtual = null;
  let pendente = null; // { calculo, chave } mais recente, aguardando gravação
  let falhado = null; // último item que não pôde ser salvo (para "Tentar novamente")
  let chaveSalva = null; // chave do cálculo que sabemos estar salvo
  let timerSalvar = null;
  let rodando = null; // promessa da fila em andamento

  function mostrarStatus(tipo, detalhe) {
    if (!statusSalvamento) return;
    statusSalvamento.className = "status-salvamento" + (tipo === "erro" ? " erro" : "");
    if (btnTentarSalvar) btnTentarSalvar.hidden = tipo !== "erro";
    if (tipo === "salvando") statusSalvamento.textContent = "Salvando...";
    else if (tipo === "salvo") statusSalvamento.textContent = `Cálculo salvo em ${formatarDataHora(detalhe)}.`;
    else if (tipo === "restaurado") statusSalvamento.textContent = `Último cálculo salvo em ${formatarDataHora(detalhe)}.`;
    else if (tipo === "ja-salvo") statusSalvamento.textContent = "Este cálculo já está salvo.";
    else if (tipo === "erro") {
      const codigo = detalhe && detalhe.code;
      let motivo = "Verifique a conexão e tente novamente.";
      if (codigo === "permission-denied") motivo = "Sem permissão para gravar na sua conta.";
      else if (codigo === "not-found") motivo = "Seu perfil não foi encontrado.";
      statusSalvamento.textContent = `O cálculo foi realizado, mas não pôde ser salvo. ${motivo}`;
    } else statusSalvamento.textContent = "";
  }

  function cancelarSalvamentoAgendado() {
    clearTimeout(timerSalvar);
    timerSalvar = null;
    pendente = null; // um resultado que deixou de ser válido nunca é gravado
  }

  function processarFila() {
    if (!rodando) {
      rodando = (async () => {
        while (pendente && usuarioAtual) {
          const item = pendente;
          pendente = null;
          if (item.chave === chaveSalva) continue;
          mostrarStatus("salvando");
          try {
            const gravadoEm = await salvarUltimoCalculo(usuarioAtual.uid, item.calculo);
            chaveSalva = item.chave;
            falhado = null;
            if (!pendente) mostrarStatus("salvo", gravadoEm);
          } catch (err) {
            console.error("Erro ao salvar o último cálculo:", err);
            falhado = pendente || item;
            pendente = null;
            mostrarStatus("erro", err);
          }
        }
      })().finally(() => {
        rodando = null;
      });
    }
    return rodando;
  }

  function agendarSalvamento(cat, entradas, resultado, imediato) {
    const calculo = montarUltimoCalculo(cat, entradas, resultado);
    if (!calculo || !usuarioAtual) return cancelarSalvamentoAgendado();
    const chave = chaveDoCalculo(calculo);
    clearTimeout(timerSalvar);
    timerSalvar = null;
    if (chave === chaveSalva && !rodando) {
      pendente = null;
      if (imediato) mostrarStatus("ja-salvo");
      return;
    }
    pendente = { calculo, chave };
    if (imediato) processarFila();
    else timerSalvar = setTimeout(() => { timerSalvar = null; processarFila(); }, ATRASO_SALVAR_MS);
  }

  /** Grava o que estiver pendente agora (usado ao sair da conta ou ao esconder a página). */
  function descarregarFila() {
    if (timerSalvar) {
      clearTimeout(timerSalvar);
      timerSalvar = null;
      return processarFila();
    }
    return rodando || Promise.resolve();
  }

  if (btnTentarSalvar) {
    btnTentarSalvar.addEventListener("click", () => {
      if (!falhado) return;
      pendente = falhado;
      falhado = null;
      processarFila();
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") descarregarFila();
  });

  /**
   * Mostra o último cálculo salvo e preenche o formulário. NÃO executa nova simulação
   * (exibe os valores gravados) e NÃO grava nada: não há eventos de input nem chamada a calcular().
   */
  function restaurarUltimoCalculo(salvo) {
    if (!calculoSalvoValido(salvo)) return;
    canalSelect.value = salvo.category;
    const cat = categoriaAtual();
    montarCampos(cat);
    const valores = entradasParaFormulario(cat, salvo);
    cat.campos.forEach((campo) => {
      const el = camposBox.querySelector(`[data-campo="${campo.id}"]`);
      if (!el) return;
      if (campo.tipo === "checkbox") el.checked = valores[campo.id];
      else el.value = valores[campo.id];
    });
    mostrarResultado(resultadoDoCalculoSalvo(salvo), false);
    limparDicas(); // dicas e projeção só aparecem após um novo cálculo (nada é recalculado ao restaurar)
    faixaAnterior = null;
    if (resultadoProjecaoEl) resultadoProjecaoEl.replaceChildren();
    if (salvo.rulesVersion && salvo.rulesVersion !== VERSAO_REGRAS) {
      detalhesCalculo.appendChild(
        criarElemento(
          "div",
          { className: "nota-simulador" },
          `Cálculo feito com as regras de ${salvo.rulesVersion} (regras atuais: ${VERSAO_REGRAS}). Calcule de novo para atualizar.`
        )
      );
    }
    chaveSalva = chaveDoCalculo({ category: salvo.category, inputs: salvo.inputs, rulesVersion: salvo.rulesVersion });
    mostrarStatus("restaurado", salvo.calculatedAt);
  }

  function executarCalculoSimulacao(explicito = false) {
    const cat = categoriaAtual();
    try {
      const entradas = lerEntradas(cat);
      const resultado = calcular(cat.id, entradas);
      mostrarResultado(resultado, explicito);
      mostrarDicas(cat, entradas, resultado);
      atualizarProjecao();
      if (resultado.ok) agendarSalvamento(cat, entradas, resultado, explicito);
      else cancelarSalvamentoAgendado();
    } catch (err) {
      console.error("Erro ao calcular comissão:", err);
      rvTotalExibida.textContent = "R$ 0,00";
      limparResultado();
      detalhesCalculo.appendChild(criarElemento("div", { className: "nota-simulador" }, "Não foi possível calcular. Verifique os valores informados."));
    }
  }

  function trocarCategoria() {
    faixaAnterior = null;
    montarCampos(categoriaAtual());
    executarCalculoSimulacao(false);
  }

  if (canalSelect && camposBox && formSimulador) {
    CATEGORIAS.forEach((c) => canalSelect.appendChild(criarElemento("option", { value: c.id }, c.rotulo)));
    canalSelect.addEventListener("change", trocarCategoria);

    // Recalcula quando qualquer dado muda; o submit nunca recarrega a página.
    camposBox.addEventListener("input", () => executarCalculoSimulacao(false));
    camposBox.addEventListener("change", () => executarCalculoSimulacao(false));
    [diasTrabalhadosEl, diasRestantesEl].forEach((el) => el && el.addEventListener("input", atualizarProjecao));
    formSimulador.addEventListener("submit", (e) => {
      e.preventDefault();
      executarCalculoSimulacao(true);
    });

    trocarCategoria();
  }

  // 1. Validação de Sessão com o Firebase
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      usuarioAtual = null;
      cancelarSalvamentoAgendado();
      window.location.href = "index.html";
      return;
    }

    try {
      const userDocRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userDocRef);

      let nome = user.displayName || "Usuário";
      let telefone = user.phoneNumber || "Não informado";
      let ultimoCalculo = null;

      if (docSnap.exists()) {
        const dados = docSnap.data();
        if (dados.displayName) nome = dados.displayName;
        if (dados.phoneNumber) telefone = dados.phoneNumber;
        ultimoCalculo = dados[CAMPO_ULTIMO_CALCULO] || null;
      }
      usuarioAtual = user;

      if (saudacaoEl) saudacaoEl.textContent = `Olá, ${nome.split(" ")[0]}!`;
      if (nomeEl) nomeEl.textContent = nome;
      if (telEl) telEl.textContent = telefone;

      // Recupera o último cálculo salvo (se houver); sem cálculo salvo, o simulador fica no estado inicial.
      if (canalSelect && camposBox) restaurarUltimoCalculo(ultimoCalculo);

      document.body.classList.add("autenticado");
    } catch (error) {
      console.error("Erro ao carregar dados do usuário:", error);
      usuarioAtual = user; // a conta é válida mesmo que a leitura do perfil tenha falhado
      document.body.classList.add("autenticado");
    }
  });

  // Logout
  if (btnSair) {
    btnSair.addEventListener("click", async () => {
      // Dá no máximo 5 s para concluir um salvamento em andamento antes de encerrar a sessão.
      await Promise.race([descarregarFila(), new Promise((r) => setTimeout(r, 5000))]);
      await signOut(auth);
      window.location.href = "index.html";
    });
  }
});
