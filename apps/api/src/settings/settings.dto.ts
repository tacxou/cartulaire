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
  appName: string

  @IsString()
  @IsNotEmpty()
  logo: string

  @IsString()
  @IsNotEmpty()
  backgroundImage: string

  @IsString()
  @IsNotEmpty()
  backgroundColor: string

  @IsNumber()
  @Min(0)
  @Max(1)
  backgroundColorOpacity: number
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

  @ValidateNested()
  @Type(() => BrandingDto)
  branding: BrandingDto

  @ValidateNested()
  @Type(() => PrefsDto)
  prefs: PrefsDto
}
