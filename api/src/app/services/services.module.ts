import { Module } from '@nestjs/common';
import { SteamVerificationService } from './steam-verification.service';
import { DiscordVerificationService } from './discord-verification.service';

@Module({
  providers: [SteamVerificationService, DiscordVerificationService],
  exports: [SteamVerificationService, DiscordVerificationService],
})
export class ServicesModule {}

