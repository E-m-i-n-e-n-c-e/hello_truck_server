import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';

function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Hello Truck API')
    .setDescription('API documentation for Hello Truck application')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your access token',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });

  // Add security to all endpoints by default, except auth endpoints
  document.paths = Object.keys(document.paths).reduce((acc, path) => {
    acc[path] = Object.keys(document.paths[path]).reduce((methodAcc, method) => {
      // Skip adding security to auth endpoints
      if (path.includes('/auth/')) {
        methodAcc[method] = document.paths[path][method];
      } else {
        methodAcc[method] = {
          ...document.paths[path][method],
          security: [{ 'access-token': [] }],
        };
      }
      return methodAcc;
    }, {});
    return acc;
  }, {});

  fs.writeFileSync('./swagger-spec.json', JSON.stringify(document, null, 2));

  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      preauthorizeApiKey: {
        'JWT-auth': 'Bearer 6300045929',
      },
    },
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  setupSwagger(app);

  await app.listen(process.env.PORT || 3000);
}

bootstrap();
