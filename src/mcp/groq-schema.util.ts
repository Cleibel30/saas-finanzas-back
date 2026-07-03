import { z } from 'zod';

/**
 * Convierte el shape Zod de las herramientas MCP al JSON Schema que exige la API de Groq.
 * Sin esto, Groq ignora las tools y el modelo responde con texto inventado.
 */
export function zodShapeToGroqParameters(
  shape: Record<string, z.ZodTypeAny> | undefined,
): Record<string, unknown> {
  if (!shape || Object.keys(shape).length === 0) {
    return { type: 'object', properties: {} };
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, schema] of Object.entries(shape)) {
    const { zodType, description, optional } = unwrapZod(schema);

    properties[key] = {
      type: zodType,
      description: description ?? key,
    };

    if (!optional) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function unwrapZod(schema: z.ZodTypeAny): {
  zodType: string;
  description?: string;
  optional: boolean;
} {
  let current: z.ZodTypeAny = schema;
  let optional = false;

  while (current instanceof z.ZodOptional || current instanceof z.ZodDefault) {
    optional = optional || current instanceof z.ZodOptional;
    current = current.unwrap() as z.ZodTypeAny;
  }

  const description = current.description ?? schema.description;

  if (current instanceof z.ZodString) {
    return { zodType: 'string', description, optional };
  }
  if (current instanceof z.ZodNumber) {
    return { zodType: 'number', description, optional };
  }
  if (current instanceof z.ZodBoolean) {
    return { zodType: 'boolean', description, optional };
  }

  return { zodType: 'string', description, optional };
}
