import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator'
import { ClientMetadata } from 'oidc-provider'

type ClientAuthMethod = ClientMetadata['token_endpoint_auth_method']
type ResponseType = ClientMetadata['response_types'][number]

export class ClientDto {
  @IsString()
  @IsNotEmpty()
  client_id: string

  @IsString()
  @IsOptional()
  client_secret?: string

  @IsString()
  @IsOptional()
  client_name?: string

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  grant_types?: string[]

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  response_types?: ResponseType[]

  @IsEnum(['client_secret_basic', 'client_secret_post', 'client_secret_jwt', 'private_key_jwt', 'none'])
  @IsOptional()
  token_endpoint_auth_method?: ClientAuthMethod

  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  redirect_uris?: string[]

  @IsArray()
  @IsUrl({}, { each: true })
  @IsOptional()
  post_logout_redirect_uris?: string[]

  @IsString()
  @IsOptional()
  scope?: string

  @IsBoolean()
  @IsOptional()
  skip_consent?: boolean
}

export class ClientsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientDto)
  clients: ClientDto[]
}
