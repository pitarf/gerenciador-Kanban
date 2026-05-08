import { parse, isValid } from 'date-fns';

/**
 * Converte data da string do AlertOps para Date de forma segura.
 * Suporta formatos comuns recebidos via API do AlertOps.
 */
export function parseAlertOpsDate(value: string | null | undefined): Date | null {
  if (!value || value.trim() === '') return null;

  // Tentativa 1: ISO 8601 direto
  const dateIso = new Date(value);
  if (isValid(dateIso) && !isNaN(dateIso.getTime())) {
    return dateIso;
  }

  // Tentativa 2: Formato DD/MM/YYYY HH:mm:ss (comum em dumps locais)
  try {
    const parsed = parse(value, 'dd/MM/yyyy HH:mm:ss', new Date());
    if (isValid(parsed)) return parsed;
  } catch (e) {
    // ignorar e tentar próximo
  }

  console.error(`[DateParser] Erro de conversão de data: "${value}"`);
  return null;
}
