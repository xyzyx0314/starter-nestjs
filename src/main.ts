import path from "path";
import { json } from "express";
import { NestFactory } from "@nestjs/core";
import {
  SwaggerModule,
  DocumentBuilder,
  SwaggerDocumentOptions,
} from "@nestjs/swagger";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "@nestjs/common";

import { AppModule } from "./app.module";
import packageInfo from "./package.json";
import { ConfigService } from "./config/config.service";

async function initSwaggerDocument(
  configService: ConfigService,
  app: NestExpressApplication,
) {
  const config = new DocumentBuilder()
    .setTitle(packageInfo.name)
    .setDescription(packageInfo.description)
    .setVersion(packageInfo.version)
    .addBearerAuth()
    .build();

  const options: SwaggerDocumentOptions = {
    ignoreGlobalPrefix: false,
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  };

  const document = SwaggerModule.createDocument(app, config, options);
  SwaggerModule.setup(
    path.join(configService.config.server.globalAPIPathPrefix, "docs"),
    app,
    document,
  );
}

async function initialize(): Promise<
  [configService: ConfigService, app: NestExpressApplication]
> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    ...(process.env.NODE_ENV === "production"
      ? { logger: ["log", "warn", "error"] }
      : {}),
  });

  const configService = app.get(ConfigService);

  app.setGlobalPrefix(configService.config.server.globalAPIPathPrefix);
  app.use(json({ limit: "1024mb" }));
  app.set("trust proxy", configService.config.server.trustProxy);

  initSwaggerDocument(configService, app);

  return [configService, app];
}

async function startApp(
  configService: ConfigService,
  app: NestExpressApplication,
) {
  await app.listen(
    configService.config.server.port,
    configService.config.server.hostname,
  );

  Logger.log(
    `${packageInfo.name} is listening on ${configService.config.server.hostname}:${configService.config.server.port}`,
    "Bootstrap",
  );
}

async function bootstrap() {
  const [configService, app] = await initialize();
  startApp(configService, app);
}

bootstrap().catch((err) => {
  console.error(err); // eslint-disable-line no-console
  console.error("Error bootstrapping the application, exiting..."); // eslint-disable-line no-console
  process.exit(1);
});
