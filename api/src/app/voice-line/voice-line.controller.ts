import { Controller, Get } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Controller('voice-lines')
export class VoiceLineController {
  @Get()
  getVoiceLines() {
    try {
      // Try multiple possible paths
      const possiblePaths = [
        path.join(process.cwd(), 'assets', 'voice-lines', 'voice-lines.json'), // From project root
        path.join(process.cwd(), '..', 'assets', 'voice-lines', 'voice-lines.json'), // From api directory
        path.resolve(__dirname, '..', '..', '..', 'assets', 'voice-lines', 'voice-lines.json'), // Relative to compiled code
      ];
      
      for (const voiceLinesPath of possiblePaths) {
        if (fs.existsSync(voiceLinesPath)) {
          const fileContent = fs.readFileSync(voiceLinesPath, 'utf-8');
          const voiceLines = JSON.parse(fileContent);
          return voiceLines;
        }
      }
      
      console.warn('Voice lines file not found. Tried paths:', possiblePaths);
      // Fallback: return empty structure
      return { heroes: [] };
    } catch (error) {
      console.error('Failed to load voice lines:', error);
      return { heroes: [] };
    }
  }
}

