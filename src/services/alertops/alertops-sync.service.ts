import crypto from 'crypto';
import prisma from '../../lib/prisma.js';
import { parseAlertOpsDate } from '../../lib/date-parser.js';
import { safeJsonParse } from '../../lib/json-parser.js';

export async function syncAssignedAlertOpsAlerts() {
  const syncId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
  console.log(`[Sync] Iniciando sincronização: ${syncId}`);
  
  let alertsFound = 0;
  let cardsCreated = 0;
  let errorsCount = 0;
  const errors: any[] = [];

  // Garantir que o prisma está conectado
  try {
    await prisma.$connect();
  } catch (err) {
    console.error('[Sync] Falha ao conectar ao banco de dados:', err);
    return { success: false, error: 'Falha na conexão com o banco de dados' };
  }

  try {
    // 1. Buscar registros 'Assigned' na tabela raw
    // Usamos $queryRawUnsafe para ter controle total sobre as aspas de schema/tabela
    console.log(`[Sync] Executando consulta na tabela raw...`);
    
    let rawEvents: any[] = [];
    let retryCount = 0;
    while (retryCount < 3) {
      try {
        rawEvents = await prisma.$queryRawUnsafe(`
          SELECT * FROM "tclog_alertops"."alert_events" 
          WHERE UPPER(TRIM("message_thread_status_type")) = 'ASSIGNED'
        `);
        break;
      } catch (err: any) {
        if (err.message?.includes('terminating connection') || err.code === 'P2024') {
          console.warn(`[Sync] Conexão interrompida, tentando novamente (${retryCount + 1}/3)...`);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          await prisma.$connect();
        } else {
          throw err;
        }
      }
    }

    alertsFound = rawEvents.length;
    console.log(`[Sync] Encontrados ${alertsFound} registros com status 'Assigned'.`);

    // Procura o tenant 'transpetro' ou o primeiro disponível
    let tenant = await prisma.tenant.findUnique({
      where: { slug: 'transpetro' }
    });
    
    if (!tenant) {
      tenant = await prisma.tenant.findFirst();
    }
    
    if (!tenant) throw new Error("Nenhum Tenant encontrado para associar os alertas. Por favor, realize o cadastro inicial.");

    // Status inicial Default
    let initialStatus = await prisma.cardStatus.findFirst({
      where: { tenant_id: tenant.id, is_initial: true }
    });

    if (!initialStatus) {
      // Criar status iniciais se não existirem
      initialStatus = await prisma.cardStatus.create({
        data: {
          tenant_id: tenant.id,
          name: 'Novo',
          slug: 'novo',
          color: '#34d399', // Verde Transpetro
          position: 0,
          is_initial: true
        }
      });
      // Outros status podem ser criados via seed ou admin
    }

    for (const event of rawEvents) {
      try {
        const threadId = event.message_thread_id;
        if (!threadId) {
          console.warn("[Sync] Alerta sem message_thread_id ignorado.");
          continue;
        }

        const truncate = (str: string, n: number) => {
          if (!str) return '';
          // Limpar quebras de linha e excesso de espaços para o título
          const clean = str.replace(/\s+/g, ' ').trim();
          return clean.length > n ? clean.substring(0, n) + '...' : clean;
        };

        const messageText = event.message_text || event.description || '';
        // Prioridade para o título do card: Mensagem > Tópico > Descrição
        const titleForCard = truncate(event.message_text || event.topic || event.description || '', 150) || event.source_identifier || 'Alerta sem identificador';

        // 3. Upsert alertops_alerts
        const alert = await prisma.alertopsAlert.upsert({
          where: { alertops_thread_id: threadId },
          create: {
            alertops_thread_id: threadId,
            source_identifier: event.source_identifier,
            integration_name: event.source_name,
            status_alertops: event.message_thread_status_type,
            title: event.topic || event.description,
            message_text: messageText,
            description: event.description,
            topic: event.topic,
            criticidade: event.criticidade,
            owner_name: event.owner_name,
            owner_username: event.owner_username,
            last_note: event.last_added_note,
            resolution_note: event.resolution,
            source_url: event.source_url,
            json_alerta: safeJsonParse(event.json_alerta),
            json_operacao: safeJsonParse(event.json_operacao),
            json_prog_duto: safeJsonParse(event.json_prog_duto),
            json_detalhe: safeJsonParse(event.json_detalhe),
            alert_created_at: parseAlertOpsDate(event.created_date_local),
            alert_updated_at: parseAlertOpsDate(event.last_modified_date_local),
            alert_closed_at: parseAlertOpsDate(event.closed_date_local),
            sla_deadline_at: parseAlertOpsDate(event.sla_deadline_date_local),
            raw_payload: event as any
          },
          update: {
            status_alertops: event.message_thread_status_type,
            last_note: event.last_added_note,
            resolution_note: event.resolution,
            criticidade: event.criticidade,
            owner_name: event.owner_name,
            owner_username: event.owner_username,
            message_text: messageText,
            alert_updated_at: parseAlertOpsDate(event.last_modified_date_local),
            alert_closed_at: parseAlertOpsDate(event.closed_date_local),
            updated_at: new Date()
          }
        });

        // 4. Verificar existência de card
        const existingCard = await prisma.card.findFirst({
          where: { alertops_thread_id: threadId, tenant_id: tenant.id }
        });

        if (!existingCard) {
          // Criar novo card
          const newCard = await prisma.card.create({
            data: {
              tenant_id: tenant.id,
              alertops_alert_id: alert.id,
              alertops_thread_id: threadId,
              title: titleForCard,
              message_text: messageText,
              description: alert.description,
              status_id: initialStatus!.id,
              criticidade: alert.criticidade,
              owner_name: alert.owner_name,
              due_at: alert.sla_deadline_at
            }
          });
          cardsCreated++;
          
          // Histórico
          await prisma.cardHistory.create({
            data: {
              card_id: newCard.id,
              action: 'CREATED_FROM_SYNC',
              new_value: 'Novo card gerado via sincronização AlertOps'
            }
          });
        } else {
          // Verificar se a criticidade mudou para registrar no histórico
          if (existingCard.criticidade !== alert.criticidade) {
            await prisma.cardHistory.create({
              data: {
                card_id: existingCard.id,
                action: 'CRITICALITY_UPDATED',
                field_name: 'criticidade',
                old_value: existingCard.criticidade,
                new_value: alert.criticidade,
                metadata: { source: 'AlertOps Sync' }
              }
            });
          }

          if (existingCard.owner_name !== alert.owner_name) {
            await prisma.cardHistory.create({
              data: {
                card_id: existingCard.id,
                action: 'OWNER_UPDATED',
                field_name: 'owner_name',
                old_value: existingCard.owner_name,
                new_value: alert.owner_name,
                metadata: { source: 'AlertOps Sync' }
              }
            });
          }
          
          // Atualizar dados espelhados do alerta no card
          await prisma.card.update({
             where: { id: existingCard.id },
             data: {
               due_at: alert.sla_deadline_at,
               criticidade: alert.criticidade,
               owner_name: alert.owner_name,
               message_text: messageText,
               title: titleForCard
             }
          });
        }
      } catch (err: any) {
        errorsCount++;
        errors.push({ id: event.message_thread_id, error: err.message });
      }
    }

    // Registrar log da sincronização
    await prisma.syncLog.create({
      data: {
        status: errorsCount === 0 ? 'SUCCESS' : (errorsCount < alertsFound ? 'PARTIAL' : 'ERROR'),
        message: `Sincronização ${syncId} finalizada.`,
        alerts_found: alertsFound,
        cards_created: cardsCreated,
        errors_count: errorsCount,
        payload: { errors }
      }
    });

    return {
      success: true,
      alertsFound,
      cardsCreated,
      errorsCount
    };

  } catch (error: any) {
    console.error(`[Sync] Erro crítico na sincronização:`, error);
    await prisma.syncLog.create({
      data: {
        status: 'ERROR',
        message: error.message,
        errors_count: 1,
        payload: { error: error.stack }
      }
    });
    return { success: false, error: error.message };
  }
}
