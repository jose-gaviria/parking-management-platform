/**
 * Deja el usuario de demostración con las credenciales fijas de DEMO_USERNAME /
 * DEMO_PASSWORD. Corre en cada despliegue (vercel-build); sin esas variables no hace nada.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { demoAccess } from '../src/common/demo';
import { BCRYPT_COST } from '../src/common/hashing';

const prisma = new PrismaClient();

async function main() {
  const demo = demoAccess();
  if (!demo) {
    console.log('Usuario demo: DEMO_USERNAME / DEMO_PASSWORD sin definir, se omite.');
    return;
  }
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const passwordHash = await bcrypt.hash(demo.password, BCRYPT_COST);
  const user = await prisma.user.upsert({
    where: { username: demo.username },
    create: { username: demo.username, fullName: 'Usuario de demostración', passwordHash },
    update: { passwordHash, active: true },
  });
  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  console.log(`Usuario demo «${demo.username}» listo.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
