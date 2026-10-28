/** Utilitários de interface compartilhados pelas telas de login e cadastro. */

export function mostrarMensagem(tipo, texto) {
  const caixa = document.getElementById("mensagem");
  caixa.textContent = texto; // textContent: nunca interpreta HTML
  caixa.className = "alerta " + tipo; // "erro" | "sucesso"
  caixa.hidden = false;
}

export function limparMensagem() {
  const caixa = document.getElementById("mensagem");
  caixa.hidden = true;
  caixa.textContent = "";
}

export function erroDeCampo(idCampo, texto) {
  const entrada = document.getElementById(idCampo);
  const aviso = document.getElementById("erro-" + idCampo);
  if (texto) {
    aviso.textContent = texto;
    aviso.hidden = false;
    entrada.setAttribute("aria-invalid", "true");
    entrada.setAttribute("aria-describedby", aviso.id);
  } else {
    aviso.textContent = "";
    aviso.hidden = true;
    entrada.removeAttribute("aria-invalid");
    entrada.removeAttribute("aria-describedby");
  }
}

export function limparErrosDeCampo(ids) {
  ids.forEach((id) => erroDeCampo(id, ""));
}

/** Alterna o estado de carregamento do botão (também bloqueia reenvios). */
export function definirCarregando(botao, carregando) {
  botao.disabled = carregando;
  botao.setAttribute("aria-busy", String(carregando));
  botao.querySelector(".spinner").hidden = !carregando;
}
