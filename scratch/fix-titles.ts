import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixTitles() {
  console.log('🚀 Iniciando correção em massa de títulos...');
  
  const cards = await prisma.card.findMany({
    include: {
      alertops_alert: true
    }
  });

  console.log(`📋 Total de cards encontrados: ${cards.length}`);
  
  let updatedCount = 0;

  for (const card of cards) {
    const correctMessage = card.message_text || card.alertops_alert?.message_text;
    
    if (correctMessage) {
      await prisma.card.update({
        where: { id: card.id },
        data: {
          title: correctMessage
        }
      });
      updatedCount++;
    }
  }

  console.log(`✅ Sucesso! ${updatedCount} cards tiveram o título atualizado.`);
}

fixTitles()
  .catch(e => {
    console.error('❌ Erro ao rodar script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
