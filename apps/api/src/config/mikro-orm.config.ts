import * as dotenv from 'dotenv';
import * as path from 'path';
import { defineConfig, PostgreSqlDriver } from '@mikro-orm/postgresql';

// Muat .env saat CLI dipanggil
dotenv.config({ path: path.resolve(__dirname, '../../../apps/api/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { Migrator } from '@mikro-orm/migrations';
import { SeedManager } from '@mikro-orm/seeder';
import { User } from '../entities/user.entity';
import { Wilayah } from '../entities/wilayah.entity';
import { TitikSejarah } from '../entities/titik-sejarah.entity';
import { TitikBudaya } from '../entities/titik-budaya.entity';

export default defineConfig({
  driver: PostgreSqlDriver,
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  dbName: process.env.DB_NAME ?? 'sgza_db',
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',

  entities: [User, Wilayah, TitikSejarah, TitikBudaya],
  entitiesTs: [User, Wilayah, TitikSejarah, TitikBudaya],

  // Aktifkan PostGIS spatial types
  driverOptions: {
    connection: {
      options: '-c search_path=public',
    },
  },

  extensions: [Migrator, SeedManager],

  migrations: {
    path: './src/database/migrations',
    pathTs: './src/database/migrations',
    glob: '!(*.d).{js,ts}',
  },

  seeder: {
    path: './src/database/seeds',
    pathTs: './src/database/seeds',
    glob: '!(*.d).{js,ts}',
    defaultSeeder: 'DatabaseSeeder',
  },

  debug: process.env.NODE_ENV !== 'production',
});

