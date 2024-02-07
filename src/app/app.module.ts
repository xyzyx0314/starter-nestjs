import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { UserService } from "../user.service";
import { PostService } from "../post.service";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

import { ClusterModule } from "@/cluster/cluster.module";
import { ConfigModule } from "@/config/config.module";
import { HealthModule } from "@/health/health.module";

@Module({
  imports: [ConfigModule, ClusterModule, HealthModule],
  controllers: [AppController],
  providers: [AppService, UserService, PrismaService, PostService],
})
export class AppModule { }
