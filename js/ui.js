// Abrir e Fechar Modal
function abrirModalContato() {
  const modal = document.getElementById('modalContato');
  if (modal) modal.style.display = 'flex';
}

function fecharModalContato() {
  const modal = document.getElementById('modalContato');
  if (modal) modal.style.display = 'none';
}

// Fechar ao clicar fora da caixa do modal
window.addEventListener('click', function(event) {
  const modal = document.getElementById('modalContato');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
});

// Máscara de Telefone: Formata em (XX) XXXXX-XXXX
function mascaraTelefone(input) {
  let v = input.value.replace(/\D/g, ''); // Remove tudo que não é dígito

  if (v.length > 11) v = v.substring(0, 11); // Limita a 11 dígitos (DDD + 9 dígitos)

  if (v.length > 10) {
    // Formato com 9 dígitos: (19) 99999-9999
    v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  } else if (v.length > 6) {
    // Formato parcial: (19) 99999-9
    v = v.replace(/^(\d{2})(\d{5})(\d{0,4})$/, '($1) $2-$3');
  } else if (v.length > 2) {
    // Formato parcial: (19) 9
    v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
  } else if (v.length > 0) {
    // Formato parcial: (19
    v = v.replace(/^(\d{0,2})$/, '($1');
  }

  input.value = v;

  // Oculta a mensagem de erro ao digitar
  document.getElementById('erroTelefone').style.display = 'none';
}

// Máscara de Moeda (BRL): Formata em R$ 9.999,99
function mascaraMoeda(input) {
  let v = input.value.replace(/\D/g, ''); // Remove caracteres não numéricos

  if (v === '') {
    input.value = '';
    return;
  }

  // Converte para número e divide por 100 para criar os centavos
  const valorMonetario = (parseFloat(v) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  input.value = valorMonetario;
}

// Validação e Envio do Formulário
function enviarFormulario(event) {
  event.preventDefault();

  const inputTelefone = document.getElementById('telefone');
  const apenasNumerosTel = inputTelefone.value.replace(/\D/g, '');
  const erroTel = document.getElementById('erroTelefone');

  // Validação: exige exatamente 11 dígitos (2 do DDD + 9 do número)
  if (apenasNumerosTel.length !== 11) {
    erroTel.style.display = 'block';
    inputTelefone.focus();
    return;
  }

  const inputValor = document.getElementById('valor').value;

  alert(`Dados salvos com sucesso!\n\nTelefone: ${inputTelefone.value}\nValor: ${inputValor}`);
  
  // Limpa o formulário e fecha o modal
  document.getElementById('formContato').reset();
  fecharModalContato();
}
