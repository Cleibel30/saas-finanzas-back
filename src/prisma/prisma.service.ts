// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  // src/prisma/prisma.service.ts
  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20, // Aumenta un poco el límite
      idleTimeoutMillis: 30000, // Aumenta el tiempo de espera
      connectionTimeoutMillis: 10000, // IMPORTANTE: añade esto
      allowExitOnIdle: true, // IMPORTANTE: añade esto
    });

    // Opcional: Esto ayuda a manejar mejor los errores de conexión del pool
    pool.on('error', (err) => {
      console.error('Error inesperado en el pool de Postgres:', err);
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
