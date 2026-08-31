import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtherItem } from './entities/other-item.entity';
import { OtherItemsController } from './other-items.controller';
import { OtherItemsService } from './other-items.service';

@Module({
  imports: [TypeOrmModule.forFeature([OtherItem])],
  controllers: [OtherItemsController],
  providers: [OtherItemsService],
  exports: [OtherItemsService],
})
export class OtherItemsModule {}
