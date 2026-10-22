// Pasarela de pago SIMULADA de la tienda (S5-18i, D-034). Solo para server actions: no tiene
// "use client" y no hay que importarla desde componentes cliente. No se comunica con ningún
// procesador real. Nunca guarda ni devuelve el número completo de la tarjeta ni el CVV.

const CUOTAS_CREDITO = [1, 3, 6, 12];
const DEMORA_MS = 800;

// Tarjetas de prueba con resultado fijo; cualquier otro número con Luhn válido se aprueba.
const TARJETAS_RECHAZADAS = {
  "4000000000000002": "Fondos insuficientes.",
  "4000000000000069": "La tarjeta fue rechazada: revisá los datos ingresados.",
};

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function luhnValido(numero) {
  let suma = 0;
  let doble = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let digito = Number(numero[i]);
    if (doble) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    suma += digito;
    doble = !doble;
  }
  return suma % 10 === 0;
}

function codigoReferencia() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Vencimiento MM/AA (o MM/AAAA): válido hasta el último día del mes indicado.
function vencimientoVigente(texto) {
  const m = /^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/.exec(texto ?? "");
  if (!m) return false;
  const mes = Number(m[1]);
  if (mes < 1 || mes > 12) return false;
  const anio = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  const hoy = new Date();
  return anio > hoy.getFullYear() || (anio === hoy.getFullYear() && mes >= hoy.getMonth() + 1);
}

// tipo: "debito" | "credito". Devuelve { aprobado, referencia?, error? }.
export async function procesarPagoTarjeta({ tipo, numero, titular, vencimiento, cvv, cuotas = 1 }) {
  const digitos = String(numero ?? "").replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(digitos) || !luhnValido(digitos)) {
    return { aprobado: false, error: "El número de tarjeta no es válido." };
  }
  if (!String(titular ?? "").trim()) {
    return { aprobado: false, error: "Ingresá el nombre del titular." };
  }
  if (!vencimientoVigente(String(vencimiento ?? "").trim())) {
    return { aprobado: false, error: "La tarjeta está vencida o la fecha es inválida." };
  }
  if (!/^\d{3,4}$/.test(String(cvv ?? ""))) {
    return { aprobado: false, error: "El código de seguridad no es válido." };
  }

  const cantidadCuotas = tipo === "credito" ? Number(cuotas) : 1;
  if (tipo === "credito" && !CUOTAS_CREDITO.includes(cantidadCuotas)) {
    return { aprobado: false, error: "Elegí una cantidad de cuotas válida." };
  }

  await esperar(DEMORA_MS);

  if (TARJETAS_RECHAZADAS[digitos]) {
    return { aprobado: false, error: TARJETAS_RECHAZADAS[digitos] };
  }

  const ultimos = digitos.slice(-4);
  const detalleCuotas = tipo === "credito" ? ` ${cantidadCuotas} ${cantidadCuotas === 1 ? "cuota" : "cuotas"}` : "";
  return { aprobado: true, referencia: `SIM-TC-${codigoReferencia()} ****${ultimos}${detalleCuotas}` };
}

// La transferencia simulada se acredita al instante.
export async function procesarTransferencia() {
  await esperar(DEMORA_MS);
  return { aprobado: true, referencia: `SIM-TRF-${codigoReferencia()}` };
}
