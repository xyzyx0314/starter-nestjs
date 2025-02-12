import cluster from "node:cluster";
import util from "node:util";
import process from "node:process";

import { json } from "express";
import getGitRepoInfo from "git-repo-info";
import urlJoin from "url-join";

import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "@nestjs/common";
import {

  DocumentBuilder,
  SwaggerDocumentOptions,
  SwaggerModule,
} from "@nestjs/swagger";

import packageInfo from "./package.json";
import dayjs from "@/common/dayjs";
import { AppModule } from "@/app/app.module";
import { ConfigService } from "@/config/config.service";
import { ClusterService } from "@/cluster/cluster.service";

const appGitRepoInfo = getGitRepoInfo();
const logger = new Logger("Bootstrap");

// eslint-disable-next-line no-extend-native
String.prototype.format = function format(...args) {
  return util.format.call(undefined, this, ...args);
};

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
    urlJoin(configService.config.server.globalAPIPathPrefix, "docs"),
    app,
    document,
  );
}

async function initialize(): Promise<
  [configService: ConfigService, app: NestExpressApplication]
> {
  const appVersion = `v${packageInfo.version}`;
  const gitRepoVersion = appGitRepoInfo.abbreviatedSha
    ? ` (Git revision ${appGitRepoInfo.abbreviatedSha} on ${dayjs(
        appGitRepoInfo.committerDate,
      ).format()})`
    : "";

  if (cluster.isPrimary) {
    logger.log(
      `Starting ${packageInfo.name} version ${appVersion}${gitRepoVersion}`,
    );
  }

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

  logger.log(
    `${packageInfo.name} is listening on ${configService.config.server.hostname}:${configService.config.server.port}`,
  );
}

async function bootstrap() {
  const [configService, app] = await initialize();
  const clusterService = app.get(ClusterService);
  await clusterService.initialization(
    async () => await startApp(configService, app),
  );
}

bootstrap().catch((err) => {
  console.error(err);
  console.error("Error bootstrapping the application, exiting...");
  process.exit(1);
});
