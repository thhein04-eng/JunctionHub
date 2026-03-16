import { Module, Global } from '@nestjs/common';
import { DataAccessFgaClientService } from './data-access-fga-client.service';
import { DataAccessFgaModelService } from './data-access-fga-model.service';
import { DataAccessFgaTupleService } from './data-access-fga-tuple.service';

@Global()
@Module({
  controllers: [],
  providers: [
    DataAccessFgaClientService,
    DataAccessFgaModelService,
    DataAccessFgaTupleService,
  ],
  exports: [
    DataAccessFgaClientService,
    DataAccessFgaModelService,
    DataAccessFgaTupleService,
  ],
})
export class FgaModule {}
