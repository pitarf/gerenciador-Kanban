import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🌱 Iniciando seed...');

  // 1. Criar Tenant Transpetro
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'transpetro' },
    update: { code: 'TRP-2026' },
    create: {
      name: 'Transpetro',
      slug: 'transpetro',
      code: 'TRP-2026',
    },
  });

  // 2. Criar Status Iniciais
  const statuses = [
    { name: 'Novo', slug: 'novo', color: '#10b981', position: 0, is_initial: true },
    { name: 'Em triagem', slug: 'triagem', color: '#f59e0b', position: 1 },
    { name: 'Em tratativa', slug: 'tratativa', color: '#3b82f6', position: 2 },
    { name: 'Aguardando área externa', slug: 'externa', color: '#8b5cf6', position: 3 },
    { name: 'Aguardando operação', slug: 'operacao', color: '#6366f1', position: 4 },
    { name: 'Resolvido', slug: 'resolvido', color: '#059669', position: 5, is_final: true },
    { name: 'Cancelado', slug: 'cancelado', color: '#ef4444', position: 6, is_final: true },
  ];

  for (const s of statuses) {
    await prisma.cardStatus.upsert({
      where: { 
        tenant_id_slug: { tenant_id: tenant.id, slug: s.slug } 
      },
      update: s,
      create: { ...s, tenant_id: tenant.id },
    });
  }

  // 3. Criar Usuários padrão
  const testPassword = await bcrypt.hash('senha123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);

  // Admin
  await prisma.user.upsert({
    where: { email: 'admin@transpetro.com.br' },
    update: { password_hash: adminPassword },
    create: {
      email: 'admin@transpetro.com.br',
      name: 'Admin Transpetro',
      password_hash: adminPassword,
      role: 'ADMIN',
      tenant_id: tenant.id,
    },
  });

  // Usuários de Teste
  const testUsers = [
    { name: 'Ana Silva', email: 'ana@teste.com' },
    { name: 'Bruno Santos', email: 'bruno@teste.com' },
    { name: 'Carla Oliveira', email: 'carla@teste.com' },
  ];

  for (const u of testUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { password_hash: testPassword },
      create: {
        ...u,
        password_hash: testPassword,
        role: 'USER',
        tenant_id: tenant.id,
      },
    });
  }

  console.log('✅ Seed concluído com sucesso!');
}

// Nota: Adicionar índice composto no schema para upsert de status funcionar
// @@unique([tenant_id, slug]) em CardStatus

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
