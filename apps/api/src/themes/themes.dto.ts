import { Type } from 'class-transformer'
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'
import { BrandingDto } from '~/settings/settings.dto'

export class ThemeManifestDto {
  @IsString()
  @IsNotEmpty()
  id: string

  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsOptional()
  description?: string

  @IsString()
  @IsOptional()
  version?: string

  @IsString()
  @IsOptional()
  author?: string

  @IsObject()
  variables: Record<string, string>

  @ValidateNested()
  @Type(() => BrandingDto)
  @IsOptional()
  branding?: BrandingDto

  @IsString()
  @IsOptional()
  fontGoogleUrl?: string
}

export interface ThemeScriptsContext {
  global?: string
  page?: string
}

export interface ThemeOverridesInfo {
  views: string[]
  css: string[]
  scripts: string[]
}

export interface ThemeViewContext {
  id: string
  name: string
  description?: string
  version?: string
  author?: string
  fontGoogleUrl?: string
  styles: string
  scripts: ThemeScriptsContext
  overrides: ThemeOverridesInfo
  assetsBaseUrl: string
}

export interface ViewLocals {
  theme: ThemeViewContext
  branding: BrandingDto
  prefs: {
    defaultLanguage: string
    allowRegistration: boolean
  }
  availableThemes: Array<{ id: string; name: string; description?: string }>
}
