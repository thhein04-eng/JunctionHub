import { Module } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { ResourceController } from './resource.controller';
import { FgaGuard } from '../../guards/fga.guard';
import { DataAccessFgaModule } from '@junction-hub/shared/data-access-fga';

@Module({
  imports: [DataAccessFgaModule],
  controllers: [ResourceController],
  providers: [ResourceService, FgaGuard],
})
export class ResourceModule {}
