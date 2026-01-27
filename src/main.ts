import { NestFactory } from '@nestjs/core';
import { RootModule } from './root.module';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
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

  // Count and return total endpoints
  const totalEndpoints = Object.values(document.paths).reduce(
    (count, pathItem) => count + Object.keys(pathItem).length,
    0,
  );

  return totalEndpoints;
}

async function bootstrap() {
  const app = await NestFactory.create(RootModule.forRoot(), {
    logger: process.env.NODE_ENV === 'production'
      ? false
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Get ConfigService for typed environment access
  const configService = app.get(ConfigService);
  const appMode = configService.get<string>('APP_MODE', 'app');

  // Enable cookie parser for JWT in cookies
  app.use(cookieParser());

  // Enable CORS with proper credentials support for admin portal
  const corsOptions = {
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Admin portal allowed origins
      const allowedOrigins = [
        'http://localhost:3000',
        'https://hello-truck-admin.vercel.app',
        'https://ht-server.fly.dev',
      ];
      
      // Allow if origin is in the list
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else if (appMode !== 'admin') {
        // If not in admin mode, allow all origins
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Always enable credentials for cookie support
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  };

  app.enableCors(corsOptions);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const totalEndpoints = setupSwagger(app);
  console.log('\nTOTAL ENDPOINTS:', totalEndpoints, '\n');

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
