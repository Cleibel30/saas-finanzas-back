process.on('warning', (warning) => {
  if (
    warning.name === 'DeprecationWarning' &&
    warning.message.includes(
      'Calling client.query() when the client is already executing a query',
    )
  ) {
    return;
  }
  console.warn(warning);
});

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { PrismaClientExceptionFilter } from './common/filters/prisma-client-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  const frontendOrigins = process.env.FRONTEND_URL?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (frontendOrigins?.length) {
    app.enableCors({
      origin: frontendOrigins,
      credentials: true,
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new PrismaClientExceptionFilter());

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
