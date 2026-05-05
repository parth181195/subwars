import { Module } from '@nestjs/common';
import { SteamVerificationService } from './steam-verification.service';
import { DiscordVerificationService } from './discord-verification.service';
import { FirestoreService } from './firestore.service';
import { PostgresService } from './postgres.service';

@Module({
  providers: [SteamVerificationService, DiscordVerificationService, FirestoreService, PostgresService],
  exports: [SteamVerificationService, DiscordVerificationService, FirestoreService, PostgresService],
})
export class ServicesModule {}

