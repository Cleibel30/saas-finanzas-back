# Tasks — Mejora de NLU en Finance Chat

## Opción 2: Patrones mejorados + Groq single-round fallback

### Objetivo
Cubrir ~99% de consultas de un solo paso combinando patrones regex expandidos con un fallback universal a Groq LLM (tool-calling en 1 ronda).

### Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/groq-agent/finance-query.resolver.ts` | +7 patrones en `extraerNombreEntidad()`, + palabras en `limpiar()` |
| `src/groq-agent/groq-agent.service.ts` | Restructurar fallback, nuevo método `ejecutarFallbackGroq()`, mejorar system prompt |
| `src/groq-agent/groq-agent.service.ts` | Agregar keywords a `requiereConsultaBaseDeDatos()` |

### Tasks

#### 1. Expandir patrones de extracción de entidades

**Archivo:** `src/groq-agent/finance-query.resolver.ts` — función `extraerNombreEntidad()`

Agregar estos patrones al array `patrones` (después del existente #12):

```typescript
// #13 — "dame stock tortas", "dame el precio de tortas"
/dame\s+(?:el|la|los|las)?\s*(?:stock|precio|inventario|existencia)\s+(?:de|del|de\s+la)?\s*(.+)/i,

// #14 — "tengo en stock tortas", "hay stock de tortas"
/(?:tengo|hay|tenemos)\s+(?:en\s+)?(?:stock|inventario|existencia)\s+(?:de|del|de\s+la)?\s*(.+)/i,

// #15 — "cuanto stock tengo de tortas"
/(?:cu[aá]nto|cu[aá]nta)\s+(?:stock|existencia|inventario)\s+(?:tengo|hay|tenemos)\s+(?:de|del|de\s+la)?\s*(.+)/i,

// #16 — "que tortas hay", "cuales servicios existen"
/(?:que|cu[aá]l|cu[aá]les)\s+(.+)\s+(?:hay|tengo|tenemos|existen|tiene)/i,

// #17 — "hay tortas en stock"
/hay\s+(.+)\s+(?:en\s+)?(?:stock|inventario)/i,

// #18 — "quiero ver stock de tortas", "necesito precio de tortas"
/(?:quiero|necesito|ver|mostrar)\s+(?:el|la|los|las)?\s*(?:stock|precio|inventario|existencia|info(?:rmacion|rmación)|datos)\s+(?:de|del|de\s+la|sobre)?\s*(.+)/i,

// #19 — "informacion de tortas", "detalles sobre tortas"
/(?:informacion|información|detalles?|resumen)\s+(?:de|del|sobre|acerca\s+de)\s+(.+)/i,
```

Ampliar palabras de ruido en `limpiar()` (opcional):
```
/\b(en|del|de|este|mes|pasado|hoy|ultimos?|últimos?|30\s+d[ií]as|año|ano|dame|quiero|necesito|ver|mostrar|hay|tengo|pasame|busca)\b/gi
```

#### 2. Agregar keywords a `requiereConsultaBaseDeDatos()`

**Archivo:** `src/groq-agent/groq-agent.service.ts`

Agregar al array `palabrasDatos`:
```typescript
'dame', 'que', 'cual', 'quiero', 'necesito', 'hay', 'tengo',
'informacion', 'detalle', 'resumen', 'sobre', 'pasame', 'muestra'
```

#### 3. Restructurar fallback en `procesarPreguntaFinanciera()`

**Archivo:** `src/groq-agent/groq-agent.service.ts`

Cambiar el flujo actual:

```
[Actual]
determinista falla && requiereDatos → extraerNombreEntidad()
  → si hay nombre → search_item_by_name
  → si NO → "No identifiqué qué dato consultar"

[Nuevo]
determinista falla && requiereDatos → extraerNombreEntidad()
  → si hay nombre → search_item_by_name
  → si NO → ejecutarFallbackGroq()  ← NUEVO
```

La estructura general queda:

```
1. Stage 1 (chain detection) → si funciona, return
2. Stage 2 (planificarEjecucionDirecta) → si funciona, return
3. Stage 3 (keyword inference) si requiereDatos → si funciona, return
4. Entity name extraction si requiereDatos → si funciona, return
5. ejecutarFallbackGroq() ← SIEMPRE se ejecuta (data y no-data)
```

#### 4. Crear método `ejecutarFallbackGroq()`

```typescript
private async ejecutarFallbackGroq(
  preguntaUsuario: string,
  companyId: string,
  serverHandlers: HerramientaRegistrada[],
  requiereDatos: boolean,
): Promise<string> {
  const tools = serverHandlers.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.groqParameters ?? { type: 'object', properties: {} },
    },
  }));

  const hoy = new Date().toISOString().split('T')[0];
  const systemPrompt = this.construirSystemPromptConEjemplos(hoy);

  try {
    const choice = await this.llamarGroq(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: preguntaUsuario },
      ],
      tools,
      'auto',
    );

    if (choice.message.tool_calls?.length) {
      const ejecuciones = await this.ejecutarHerramientas(
        choice.message.tool_calls,
        serverHandlers,
        companyId,
      );
      return this.formatearRespuestaDeterministica(ejecuciones, preguntaUsuario);
    }

    return choice.message.content ?? this.mensajeAyuda(requiereDatos);
  } catch (error) {
    this.logger.warn(`Groq fallback error: ${error}`);
    return this.mensajeAyuda(requiereDatos);
  }
}
```

#### 5. Mejorar system prompt de Groq

Crear método `construirSystemPromptConEjemplos()`:

```typescript
private construirSystemPromptConEjemplos(hoy: string): string {
  return [
    `Eres un asistente financiero para una empresa. Fecha actual: ${hoy}.`,
    '',
    'IMPORTANTE: Cuando el usuario mencione un producto, servicio o categoría',
    'por su nombre, usa search_item_by_name(name="...") o',
    'search_category_by_name(name="...") para buscarlo en la base de datos.',
    '',
    'REGLAS:',
    '- Si preguntan por stock, precio, inventario, existencia → search_item_by_name',
    '- Si preguntan por margen/rentabilidad de X → search_item_by_name + get_service/product_margin',
    '- Si preguntan por listados → list_products, list_services, list_categories',
    '- Si preguntan por flujo de caja → get_total_cash_flow',
    '- Si preguntan por punto de equilibrio → get_break_even_point',
    '- Si preguntan por lotes de X → search_item_by_name + get_batches_by_product',
    '- Si preguntan por transacciones de categoría X → search_category_by_name + get_transactions_by_category',
    '- Si preguntan por costos → get_unit_cost_by_product/service/batch',
    '',
    'Responde SIEMPRE en español, de forma breve y amable.',
    'No inventes datos. Usa las herramientas disponibles.',
  ].join('\n');
}
```

#### 6. Añadir método `mensajeAyuda()`

```typescript
private mensajeAyuda(requiereDatos: boolean): string {
  if (requiereDatos) {
    return (
      'No identifiqué qué dato consultar. Ejemplos:\n' +
      '- "stock de tortas"\n' +
      '- "listar productos"\n' +
      '- "margen del servicio consultoría este mes"\n' +
      '- "flujo de caja"'
    );
  }
  return 'Hola. Puedo ayudarte con stock, precios, márgenes, transacciones y flujo de caja. ¿Qué necesitas consultar?';
}
```

### Verificación

```bash
npm run lint
npm run test -- --testPathPattern=groq-agent
```

---

## Opción 3: Patrones mejorados + Groq multi-round (ReAct)

### Objetivo
Además de todo lo anterior, agregar un bucle ReAct de múltiples rondas para que Groq pueda **encadenar herramientas** automáticamente (ej: buscar nombre → calcular margen).

### Cambios adicionales sobre Opción 2

| Archivo | Cambios adicionales |
|---------|---------------------|
| `src/groq-agent/groq-agent.service.ts` | Nuevo método `ejecutarGroqMultiRound()`, modificar `ejecutarHerramientas()` para devolver resultados estructurados |

### Tasks

#### 1. Identificar herramientas "resolvedoras" vs "finales"

Las herramientas de búsqueda de nombres son **resolvedoras**:
- `search_item_by_name` → busca ID de item
- `search_category_by_name` → busca ID de categoría

Las herramientas que aceptan IDs son **finales** (no producen IDs para encadenar):
- `get_product_margin`, `get_service_margin`, `get_global_margin`
- `get_product_gross_profit`, `get_service_gross_profit`
- `get_batches_by_product`, `get_transactions_by_category`
- `get_unit_cost_by_product`, `get_unit_cost_by_service`
- `calculate_price_with_margin`
- etc.

#### 2. Crear método `ejecutarGroqMultiRound()`

```
Entrada: preguntaUsuario, companyId, serverHandlers
Salida: string (respuesta formateada)

algoritmo:
  messages = [systemPrompt, { role: 'user', content: preguntaUsuario }]
  tools = serverHandlers (sin companyId)
  
  por ronda = 1 a MAX_RONDAS (3):
    choice = llamarGroq(messages, tools, 'auto')
    
    si choice.message.content y NO tool_calls:
      return choice.message.content  # Groq respondió directamente
    
    si tool_calls:
      ejecuciones = ejecutarHerramientas(tool_calls, serverHandlers, companyId)
      
      para cada ejecucion:
        agregar tool_result como mensaje role:"tool"
      
      si todas las herramientas ejecutadas son "finales" (no resolvedoras):
        # Ya tenemos el resultado final, formatear y devolver
        return formatearRespuestaDeterministica(ejecuciones, preguntaUsuario)
      
      # Si alguna es resolvedora, continuar el bucle
      # La próxima ronda Groq verá los IDs resueltos y podrá llamar tools finales
  
  # Si llegamos al máximo de rondas, formatear lo que tenemos
  return formatearRespuestaDeterministica(ejecuciones, preguntaUsuario)
```

#### 3. Modificar `ejecutarHerramientas()` para compatibilidad ReAct

Actualmente `ejecutarHerramientas()` devuelve `ToolExecution[]`. Para ReAct necesita también devolver los **resultados como mensajes `role: 'tool'`** con sus `tool_call_id`:

```typescript
type ToolResultMessage = {
  role: 'tool';
  tool_call_id: string;
  content: string;
};

type EjecucionReAct = {
  ejecuciones: ToolExecution[];
  mensajesTool: ToolResultMessage[];
};
```

#### 4. System prompt con instrucciones ReAct

```
[System prompt base de Opción 2]
+
INSTRUCCIONES PARA RAZONAMIENTO MULTI-PASO:
- Cuando necesites un ID (itemId, categoryId, batchId):
  1. PRIMERO llama a search_item_by_name/search_category_by_name
  2. ESPERA el resultado con el ID
  3. DESPUÉS llama a la herramienta final con ese ID

- NO respondas al usuario hasta tener el dato final.
- Si el usuario pide comparar dos items, resuelve cada uno por separado.
- Puedes hacer hasta 3 rondas de llamadas.
```

#### 5. Modificar `procesarPreguntaFinanciera()` para Opción 3

El Stage 1 (determinista) se mantiene por velocidad. Si falla, en lugar de single-round Groq, se usa multi-round:

```
1. Stage 1 (chain detection) → return
2. Stages 2-3 (direct/kw) → return
3. Entity extraction → return
4. ejecutarGroqMultiRound()  ← ReAct loop (hasta 3 rondas)
```

### Verificación

```bash
npm run lint
npm run test -- --testPathPattern=groq-agent
```

### Costo estimado (opcional, documentación)

| Consulta típica | Rondas ReAct | Costo estimado |
|---|---|---|
| "stock de tortas" | 1 (search) | ~$0.0013 |
| "margen del servicio consultoría" | 2 (search → margin) | ~$0.0026 |
| "costo unitario de tortas y margen" | 3 (search → cost → margin) | ~$0.0040 |
| "comparar margen de tortas vs pan" | ❌ No soportado | N/A |
