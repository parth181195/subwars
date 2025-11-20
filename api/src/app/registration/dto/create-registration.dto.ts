import { IsString, IsEmail, IsOptional, IsUrl, Matches, MaxLength } from 'class-validator';

export class CreateRegistrationDto {
  @IsEmail()
  email: string;

  @IsString()
  googleId: string;

  @IsString()
  @MaxLength(200)
  fullName: string;

  @IsString()
  @IsOptional()
  @Matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, {
    message: 'Please provide a valid phone number',
  })
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  inGameName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  dota2FriendId?: string;

  @IsUrl()
  @IsOptional()
  steamProfileLink?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  rankAndMmr?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  discordId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  upiId?: string;

  // Verification flags (optional, will be set by server)
  @IsOptional()
  steamProfileVerified?: boolean;

  @IsOptional()
  discordVerified?: boolean;

  @IsString()
  @IsOptional()
  dotabuffProfileLink?: string;
}

