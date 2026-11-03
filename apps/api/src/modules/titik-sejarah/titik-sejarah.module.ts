import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TitikSejarah } from '../../entities/titik-sejarah.entity';
import { TitikSejarahService } from './titik-sejarah.service';
import { TitikSejarahController } from './titik-sejarah.controller';

@Module({
  imports: [MikroOrmModule.forFeature([TitikSejarah])],
  providers: [TitikSejarahService],
  controllers: [TitikSejarahController],
  exports: [TitikSejarahService],
})
export class TitikSejarahModule {}

