import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TitikBudaya } from '../../entities/titik-budaya.entity';
import { Wilayah } from '../../entities/wilayah.entity';
import { User } from '../../entities/user.entity';
import { TitikBudayaService } from './titik-budaya.service';
import { TitikBudayaController } from './titik-budaya.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([TitikBudaya, Wilayah, User]),
    AuthModule,
  ],
  controllers: [TitikBudayaController],
  providers: [TitikBudayaService],
  exports: [TitikBudayaService],
})
export class TitikBudayaModule {}
