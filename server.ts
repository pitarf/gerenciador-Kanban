/**
 * ARQUIVO: server.ts
 * DESCRIÇÃO: Entry point principal para DESENVOLVIMENTO LOCAL.
 * Este arquivo configura o servidor Express junto com o Vite Middleware 
 * para HMR (Hot Module Replacement) e inicia o loop local de lembretes.
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import app from './api/_app';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import prisma from './src/lib/prisma';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const PORT = process.env.PORT || 3000;

  // Vite integration for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  // Local Reminder Checker (Alternative to Cron on Vercel)
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    setInterval(async () => {
      try {
        const dueReminders = await prisma.reminder.findMany({
          where: { is_done: false, due_at: { lte: new Date() } }
        });

        for (const reminder of dueReminders) {
          await prisma.notification.create({
            data: {
              user_id: reminder.user_id,
              title: '⏰ Lembrete Ativo (Local)',
              message: reminder.title,
            }
          });
          await prisma.reminder.update({ where: { id: reminder.id }, data: { is_done: true } });
        }
      } catch (err) {
        console.error('[Reminders] Error:', err);
      }
    }, 60000);
  }
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
