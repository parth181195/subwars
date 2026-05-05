import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { VoiceLine, VoiceLineInsert, VoiceLineUpdate } from '../types/database.types';

@Injectable()
export class VoiceLineService {
  constructor(
    @Inject('SUPABASE_ADMIN_CLIENT')
    private supabase: SupabaseClient,
  ) {}

  async createVoiceLine(voiceLineInsert: VoiceLineInsert): Promise<VoiceLine> {
    const { data: voiceLine, error } = await this.supabase
      .from('voice_lines')
      .insert(voiceLineInsert)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to create voice line: ${error.message}`);
    }

    return voiceLine as VoiceLine;
  }

  async getVoiceLineById(id: string): Promise<VoiceLine> {
    const { data: voiceLine, error } = await this.supabase
      .from('voice_lines')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !voiceLine) {
      throw new NotFoundException(`Voice line with ID ${id} not found`);
    }

    return voiceLine as VoiceLine;
  }

  async getAllVoiceLines(): Promise<VoiceLine[]> {
    const { data: voiceLines, error } = await this.supabase
      .from('voice_lines')
      .select('*')
      .order('scraped_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Failed to get voice lines: ${error.message}`);
    }

    return (voiceLines || []) as VoiceLine[];
  }

  async getVoiceLinesByHero(heroName: string): Promise<VoiceLine[]> {
    const { data: voiceLines, error } = await this.supabase
      .from('voice_lines')
      .select('*')
      .eq('hero_name', heroName)
      .order('scraped_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Failed to get voice lines: ${error.message}`);
    }

    return (voiceLines || []) as VoiceLine[];
  }

  async getRandomVoiceLine(heroName?: string): Promise<VoiceLine> {
    let query = this.supabase
      .from('voice_lines')
      .select('*');

    if (heroName) {
      query = query.eq('hero_name', heroName);
    }

    const { data: voiceLines, error } = await query;

    if (error) {
      throw new BadRequestException(`Failed to get voice lines: ${error.message}`);
    }

    if (!voiceLines || voiceLines.length === 0) {
      throw new NotFoundException('No voice lines found');
    }

    // Get random voice line
    const randomIndex = Math.floor(Math.random() * voiceLines.length);
    return voiceLines[randomIndex] as VoiceLine;
  }

  async updateVoiceLine(id: string, voiceLineUpdate: VoiceLineUpdate): Promise<VoiceLine> {
    const { data: voiceLine, error } = await this.supabase
      .from('voice_lines')
      .update(voiceLineUpdate)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to update voice line: ${error.message}`);
    }

    return voiceLine as VoiceLine;
  }

  async deleteVoiceLine(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('voice_lines')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BadRequestException(`Failed to delete voice line: ${error.message}`);
    }
  }
}

