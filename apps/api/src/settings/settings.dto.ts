import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

export class BrandingDto {
  @IsString()
  @IsNotEmpty()
  appName = 'Cartulaire'

  @IsString()
  @IsNotEmpty()
  logo = '/assets/logo.png'

  @IsString()
  backgroundImage = '/assets/background.svg'

  @IsString()
  @IsNotEmpty()
  backgroundColor = '#09090b'

  @IsNumber()
  @Min(0)
  @Max(1)
  backgroundColorOpacity = 0.8
}

export class BrandingOverridesDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  appName?: string

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  logo?: string

  @IsString()
  @IsOptional()
  backgroundImage?: string

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  backgroundColor?: string

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  backgroundColorOpacity?: number
}

export class PrefsDto {
  @IsString()
  @IsNotEmpty()
  defaultLanguage: string

  @IsBoolean()
  allowRegistration: boolean
}

export class UiDto {
  @IsString()
  @IsNotEmpty()
  theme: string

  @IsObject()
  @IsOptional()
  themeOverrides?: Record<string, string>
}

export class SettingsDto {
  @ValidateNested()
  @Type(() => UiDto)
  ui: UiDto

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandingOverridesDto)
  branding?: BrandingOverridesDto

  @ValidateNested()
  @Type(() => PrefsDto)
  prefs: PrefsDto
}
