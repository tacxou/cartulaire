import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator'

export class ConsentScopeItemDto {
  @IsString()
  @IsNotEmpty()
  id: string

  @IsString()
  @IsNotEmpty()
  description: string
}

export class ConsentClaimItemDto {
  @IsString()
  @IsNotEmpty()
  id: string

  @IsString()
  @IsNotEmpty()
  description: string
}

export class ConsentLabelsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConsentScopeItemDto)
  scopes: ConsentScopeItemDto[]

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConsentClaimItemDto)
  claims: ConsentClaimItemDto[]
}
