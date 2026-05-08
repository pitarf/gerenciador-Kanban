/**
 * Tenta converter string JSON para objeto de forma segura.
 * Se não for JSON válido, encapsula o texto bruto em um campo "raw".
 */
export function safeJsonParse(value: string | null | undefined): any {
  if (!value || value.trim() === '') return null;

  try {
    return JSON.parse(value);
  } catch (e) {
    console.warn(`[JsonParser] Falha no parse JSON, retornando como string encapsulada.`);
    return { raw: value };
  }
}
