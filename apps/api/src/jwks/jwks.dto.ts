import { ArrayMinSize, IsArray, IsObject } from 'class-validator'

export class JwksDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsObject({ each: true })
  keys: Record<string, unknown>[]
}

