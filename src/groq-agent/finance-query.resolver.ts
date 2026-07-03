export type RangoFechas = { startDate: string; endDate: string };

export type ItemResuelto = {
  id: string;
  name: string;
  type: string;
};

export type CategoriaResuelta = {
  id: string;
  name: string;
};

/** Consultas que requieren itemId/categoryId y se resuelven por nombre. */
export type ConsultaEncadenada =
  | {
      tipo: 'margen_item';
      nombreEntidad: string;
      fechas: RangoFechas;
      forzarServicio?: boolean;
    }
  | {
      tipo: 'margen_global';
      fechas: RangoFechas;
    }
  | {
      tipo: 'punto_equilibrio';
      fechas: RangoFechas;
    }
  | {
      tipo: 'transacciones_categoria';
      nombreEntidad: string;
    }
  | {
      tipo: 'lotes_producto';
      nombreEntidad: string;
    };

export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function extraerRangoFechas(pregunta: string): RangoFechas {
  const hoy = new Date();
  const formato = (d: Date) => d.toISOString().split('T')[0];

  const rangoExplicito = pregunta.match(
    /(\d{4}-\d{2}-\d{2})\s*(?:a|al|hasta|-|—)\s*(\d{4}-\d{2}-\d{2})/i,
  );
  if (rangoExplicito) {
    return { startDate: rangoExplicito[1], endDate: rangoExplicito[2] };
  }

  const q = normalizarTexto(pregunta);

  if (/mes pasado|ultimo mes|último mes/.test(q)) {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    return { startDate: formato(inicio), endDate: formato(fin) };
  }

  if (/ultimos?\s+30\s+d[ií]as|últimos?\s+30\s+d[ií]as/.test(q)) {
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - 30);
    return { startDate: formato(inicio), endDate: formato(hoy) };
  }

  if (/esta\s+semana|semana\s+actual/.test(q)) {
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - inicio.getDay());
    return { startDate: formato(inicio), endDate: formato(hoy) };
  }

  if (/hoy|dia\s+de\s+hoy/.test(q)) {
    return { startDate: formato(hoy), endDate: formato(hoy) };
  }

  // Por defecto: mes en curso
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return { startDate: formato(inicioMes), endDate: formato(hoy) };
}

export function extraerNombreEntidad(pregunta: string): string | null {
  const limpiar = (texto: string) =>
    texto
      .trim()
      .replace(/^["'«]|["'»]$/g, '')
      .replace(/[?.!,:;]+$/g, '')
      .replace(
        /\b(en|del|de|este|mes|pasado|hoy|ultimos?|últimos?|30\s+d[ií]as|año|ano)\b/gi,
        ' ',
      )
      .replace(/\s+/g, ' ')
      .trim();

  const sinRuidoFecha = pregunta
    .replace(/\ben\s+este\s+mes\b/gi, '')
    .replace(/\beste\s+mes\b/gi, '')
    .replace(/\bmes\s+pasado\b/gi, '')
    .replace(/\bultimos?\s+30\s+d[ií]as\b/gi, '')
    .replace(/\d{4}-\d{2}-\d{2}\s*(?:a|al|hasta|-)\s*\d{4}-\d{2}-\d{2}/gi, '');

  const patrones = [
    /margen\s+(?:de\s+contribucion\s+)?(?:de|del)\s+(?:el\s+)?(?:servicio|producto)\s+(.+)/i,
    /margen\s+(?:de\s+contribucion\s+)?(?:de|del)\s+(.+)/i,
    /(?:rentabilidad|utilidad)\s+(?:de|del)\s+(?:el\s+)?(?:servicio|producto)\s+(.+)/i,
    /(?:rentabilidad|utilidad)\s+(?:de|del)\s+(.+)/i,
    /transacciones\s+(?:de|del|de la)\s+categor[ií]a\s+(.+)/i,
    /categor[ií]a\s+(.+?)\s+transacciones/i,
    /lotes?\s+(?:de|del|de la)\s+(?:producto\s+)?(.+)/i,
    /(?:cu[aá]nto|cu[aá]nta)\s+stock\s+(?:tiene|hay)\s+(?:la|el|los|las)?\s*(.+)/i,
    /stock\s+(?:de|del|de la|del)\s+(?:la|el|los|las)?\s*(.+)/i,
    /(?:precio|existencias?|disponibilidad)\s+(?:de|del|de la)\s+(?:la|el)?\s*(.+)/i,
    /(?:servicio|producto|art[ií]culo|item)\s+(.+)/i,
    /buscar\s+(?:producto|servicio|item|categor[ií]a)?\s*(.+)/i,
  ];

  for (const patron of patrones) {
    const match = sinRuidoFecha.match(patron);
    if (match?.[1]) {
      const nombre = limpiar(match[1]);
      if (nombre.length >= 2 && !/^(global|empresa|total)$/i.test(nombre)) {
        return nombre;
      }
    }
  }

  return null;
}

export function detectarConsultaEncadenada(
  pregunta: string,
): ConsultaEncadenada | null {
  const q = normalizarTexto(pregunta);
  const fechas = extraerRangoFechas(pregunta);
  const nombre = extraerNombreEntidad(pregunta);

  if (/punto\s+de\s+equilibrio|break\s*even|equilibrio/.test(q)) {
    return { tipo: 'punto_equilibrio', fechas };
  }

  if (/margen|rentabilidad|contribucion/.test(q)) {
    if (!nombre || /global|empresa|total/.test(nombre)) {
      return { tipo: 'margen_global', fechas };
    }

    return {
      tipo: 'margen_item',
      nombreEntidad: nombre,
      fechas,
      forzarServicio: /servicio/.test(q),
    };
  }

  if (/transacciones/.test(q) && /categor/i.test(q) && nombre) {
    return { tipo: 'transacciones_categoria', nombreEntidad: nombre };
  }

  if (/lotes?/.test(q) && nombre) {
    return { tipo: 'lotes_producto', nombreEntidad: nombre };
  }

  return null;
}

export function elegirMejorCoincidencia<T extends { id: string; name: string }>(
  candidatos: T[],
  terminoBusqueda: string,
): T | null {
  if (!candidatos.length) {
    return null;
  }

  const termino = normalizarTexto(terminoBusqueda);

  const exacto = candidatos.find((c) => normalizarTexto(c.name) === termino);
  if (exacto) {
    return exacto;
  }

  const contiene = candidatos.find((c) =>
    normalizarTexto(c.name).includes(termino),
  );
  if (contiene) {
    return contiene;
  }

  return candidatos[0];
}

export function herramientaMargenPorTipo(
  tipo: string,
  forzarServicio?: boolean,
): 'get_service_margin' | 'get_product_margin' {
  if (forzarServicio || tipo === 'SERVICE') {
    return 'get_service_margin';
  }
  return 'get_product_margin';
}
