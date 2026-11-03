import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WilayahModule } from './modules/wilayah/wilayah.module';
import { TitikSejarahModule } from './modules/titik-sejarah/titik-sejarah.module';
import { TitikBudayaModule } from './modules/titik-budaya/titik-budaya.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { AdminModule } from './modules/admin/admin.module';
import mikroOrmConfig from './config/mikro-orm.config';

@Module({
  imports: [
    // Config global — .env tersedia di semua module
    ConfigModule.forRoot({ isGlobal: true }),

    // MikroORM — koneksi PostgreSQL + PostGIS
    MikroOrmModule.forRoot(mikroOrmConfig),

    // Feature modules
    AuthModule,
    UsersModule,
    WilayahModule,
    TitikSejarahModule,
    TitikBudayaModule,
    UploadsModule,
    AdminModule,
  ],
})
export class AppModule {}

