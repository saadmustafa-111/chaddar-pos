import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialFamily } from './entities/material-family.entity';
import { MaterialFamiliesService } from './material-families.service';
import { MaterialFamiliesController } from './material-families.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MaterialFamily])],
  controllers: [MaterialFamiliesController],
  providers: [MaterialFamiliesService],
  exports: [MaterialFamiliesService],
})
export class MaterialFamiliesModule {}
