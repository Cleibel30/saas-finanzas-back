export type IntencionTipo =
  | 'CONOCIMIENTO'
  | 'DATOS_SIMPLE'
  | 'ABIERTA'
  | 'CONVERSACIONAL'
  | 'GENERAL';

export type Intencion = { tipo: IntencionTipo };

const PATRON_GREETING =
  /^(hola|buenos?\s+d[ií]as|buenas\s+tardes|buenas\s+noches|hey|que\s+tal|qu[eé]\s+tal|saludos)\b/i;

const PATRON_ADVICE = [
  /(?:c[oó]mo|como)\s+(?:puedo|puedes|debo|podr[ií]a|podriamos)/i,
  /(?:c[oó]mo|como)\s+(?:incrementar|aumentar|subir|mejorar|optimizar|reducir|disminuir|bajar|ahorrar|recuperar|vender\s+m[aá]s)/i,
  /me\s+(?:recomiendas|recomendari[í]as|aconsejas|sugieres|conviene)/i,
  /(?:qu[eé]|que)\s+(?:me\s+)?(?:recomiendas|recomendari[í]as|aconsejas|sugieres|conviene|deber[ií]a|hago|puedo\s+hacer)\b/i,
  /consejo|sugerencia|recomendaci[oó]n|qu[eé]\s+hago\s+(?:con|para)/i,
];

const PATRON_DEFINICION = [
  /(?:qu[eé]\s+es|que\s+es|qu[eé]\s+son|que\s+son|qu[eé]\s+significa|que\s+significa|definici[oó]n|definir|concepto\s+de|explica|expl[ií]came|qu[eé]\s+se\s+entiende\s+por|qu[eé]\s+e?s\s+(?:un|una))\b/i,
  /en\s+qu[eé]\s+consiste|a\s+qu[eé]\s+se\s+refiere|para\s+qu[eé]\s+sirve/i,
];

const PATRON_DATO_EXPLICITO =
  /(?:cu[aá]l\s+es|cu[aá]l\s+son|cu[aá]l\s+ser[ií]a|dame|muestra|mostrar|list(?:a|ar)|cu[aá]nt[oa]\s+(?:es|fue|hay|hubo|tengo|vendo|cuesta)\b)/i;

const PATRON_DATO_CONCRETO =
  /stock|precio|existencia|inventario|movimientos?|transacciones?|list(?:a|ar)|cu[aá]nt[oa]|\bmargen\b|punto\s+de\s+equilibrio|utilidad|ganancia|saldo|balance|ingreso|egreso|gasto|flujo\s+de\s+caja/i;

export function clasificarIntencion(pregunta: string): Intencion {
  const q = pregunta.trim();

  if (PATRON_ADVICE.some((p) => p.test(q))) {
    if (PATRON_DATO_CONCRETO.test(q)) {
      return { tipo: 'DATOS_SIMPLE' };
    }
    return { tipo: 'ABIERTA' };
  }

  if (
    PATRON_DEFINICION.some((p) => p.test(q)) &&
    !PATRON_DATO_EXPLICITO.test(q)
  ) {
    return { tipo: 'CONOCIMIENTO' };
  }

  if (PATRON_GREETING.test(q)) {
    return { tipo: 'CONVERSACIONAL' };
  }

  if (PATRON_DATO_CONCRETO.test(q)) {
    return { tipo: 'DATOS_SIMPLE' };
  }

  return { tipo: 'GENERAL' };
}
