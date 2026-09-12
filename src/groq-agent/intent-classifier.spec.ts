import { clasificarIntencion } from './intent-classifier';

describe('clasificarIntencion', () => {
  const casos: Array<[string, string]> = [
    ['¿qué es el margen de contribución?', 'CONOCIMIENTO'],
    ['que es el punto de equilibrio', 'CONOCIMIENTO'],
    ['¿qué significa COGS?', 'CONOCIMIENTO'],
    ['explica qué es el flujo de caja', 'CONOCIMIENTO'],
    ['definición de costo unitario', 'CONOCIMIENTO'],
    ['¿cuál es el margen de contribución?', 'DATOS_SIMPLE'],
    ['¿cuáles son los movimientos de este mes?', 'DATOS_SIMPLE'],
    ['stock de camisa oversize', 'DATOS_SIMPLE'],
    ['listar productos', 'DATOS_SIMPLE'],
    ['dame el flujo de caja', 'DATOS_SIMPLE'],
    ['¿cómo incrementar las ventas?', 'ABIERTA'],
    ['¿cómo puedo mejorar mis márgenes?', 'ABIERTA'],
    ['¿qué me recomiendas para bajar costos?', 'ABIERTA'],
    ['dame un consejo para subir las ventas', 'ABIERTA'],
    ['¿cómo puedo ver el stock de camisas?', 'DATOS_SIMPLE'],
    ['¿cómo puedo mejorar el margen de este mes?', 'DATOS_SIMPLE'],
    ['hola', 'CONVERSACIONAL'],
    ['buenas tardes', 'CONVERSACIONAL'],
  ];

  it.each(casos)('%s → %s', (pregunta, esperado) => {
    expect(clasificarIntencion(pregunta).tipo).toBe(esperado);
  });
});
