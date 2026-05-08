/**
 * ARQUIVO: api/index.ts
 * DESCRIÇÃO: Entry point para a Vercel (Serverless Functions).
 * Exporta a instância do Express configurada no app.ts para ser 
 * processada pelo runtime de Node da Vercel.
 */

import app from '../src/server/app';
export default app;
