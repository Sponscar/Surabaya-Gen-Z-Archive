import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Wilayah } from '../../entities/wilayah.entity';
import { WilayahService } from './wilayah.service';
import { WilayahController } from './wilayah.controller';

@Module({
  imports: [MikroOrmModule.forFeature([Wilayah])],
  providers: [WilayahService],
  controllers: [WilayahController],
  exports: [WilayahService],
})
export class WilayahModule {}

