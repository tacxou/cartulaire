import { Module } from '@nestjs/common'
import { ConsentLabelsService } from './consent-labels.service'

@Module({
  providers: [ConsentLabelsService],
  exports: [ConsentLabelsService],
})
export class ConsentLabelsModule {}
