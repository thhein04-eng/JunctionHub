import { Module, Global } from '@nestjs/common';
import { DataAccessFgaService } from './data-access-fga.service';

@Global()
@Module({
  controllers: [],
  providers: [DataAccessFgaService],
  exports: [DataAccessFgaService],
})
export class DataAccessFgaModule {}
