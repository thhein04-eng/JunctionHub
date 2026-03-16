import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ResourceModule } from './resource/resource.module';
import { DataAccessPrismaModule } from '@junction-hub/shared/data-access-prisma';
import { DataAccessFgaModule } from '@junction-hub/shared/data-access-fga';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DataAccessPrismaModule,
    DataAccessFgaModule,
    ResourceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
