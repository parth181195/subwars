import { useState, useRef, useEffect } from 'react';
import { Dialog, FormControl, Button, TextInput, SelectPanel } from '@primer/react';
import { TriangleDownIcon } from '@primer/octicons-react';
import AudioPlayer from '../../components/AudioPlayer/AudioPlayer';
import { environment } from '../../config/environment';
import './CreateQuestionDialog.scss';

interface HeroInfo {
  hero: string;
  url: string;
}

interface VoiceLine {
  name: string;
  link: string;
  category: string;
  bunnyCdnLink?: string;
  bunnyCdnPath?: string;
}

interface VoiceLineData {
  hero: string;
  url: string;
  voiceLines: VoiceLine[];
}

interface NewQuestion {
  question_type: 'voice_line' | 'image';
  voice_line_url: string;
  question_content: string;
  correct_answer_hero: string;
  answer_image_url: string;
  time_limit_seconds: number;
  order_index: number;
}

interface QuizQuestion {
  id: string;
  question_type: 'voice_line' | 'image';
  question_content: string;
  correct_answer_hero: string;
  answer_image_url?: string;
  time_limit_seconds: number;
  order_index: number;
  question_content_metadata?: Record<string, any>;
}

interface CreateQuestionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  newQuestion: NewQuestion;
  setNewQuestion: (question: NewQuestion | ((prev: NewQuestion) => NewQuestion)) => void;
  questionFile: File | null;
  setQuestionFile: (file: File | null) => void;
  answerFile: File | null;
  setAnswerFile: (file: File | null) => void;
  heroes: HeroInfo[];
  editingQuestion?: QuizQuestion | null;
}

const API_BASE_URL = environment.apiBaseUrl;

export default function CreateQuestionDialog({
  isOpen,
  onClose,
  onSubmit,
  newQuestion,
  setNewQuestion,
  questionFile: _questionFile,
  setQuestionFile,
  answerFile: _answerFile,
  setAnswerFile,
  heroes,
  editingQuestion,
}: CreateQuestionDialogProps) {
  const [questionTypeOpen, setQuestionTypeOpen] = useState(false);
  const [questionTypeFilter, setQuestionTypeFilter] = useState('');
  const [heroSelectOpen, setHeroSelectOpen] = useState(false);
  const [heroSelectFilter, setHeroSelectFilter] = useState('');
  const [voiceLineSelectOpen, setVoiceLineSelectOpen] = useState(false);
  const [voiceLineSelectFilter, setVoiceLineSelectFilter] = useState('');
  const [heroImageSelectOpen, setHeroImageSelectOpen] = useState(false);
  const [heroImageSelectFilter, setHeroImageSelectFilter] = useState('');
  
  // Cache for voice lines per hero (to avoid re-fetching)
  const voiceLinesCache = useRef<Map<string, VoiceLineData>>(new Map());
  const [loadingVoiceLines, setLoadingVoiceLines] = useState<string | null>(null);
  const voiceLineUrlMap = useRef<Map<string, string>>(new Map());

  // Fetch voice lines for a hero on-demand
  const fetchVoiceLinesForHero = async (heroName: string): Promise<VoiceLineData | null> => {
    // Check cache first
    if (voiceLinesCache.current.has(heroName)) {
      return voiceLinesCache.current.get(heroName) || null;
    }

    // Fetch from API
    setLoadingVoiceLines(heroName);
    try {
      const encodedHeroName = encodeURIComponent(heroName);
      const response = await fetch(`${API_BASE_URL}/api/voice-lines/hero/${encodedHeroName}`);
      
      if (!response.ok) {
        console.error(`Failed to fetch voice lines for ${heroName}:`, response.statusText);
        return null;
      }

      const data = await response.json();
      const voiceLineData: VoiceLineData = {
        hero: data.hero,
        url: data.url,
        voiceLines: data.voiceLines || [],
      };

      // Cache it
      voiceLinesCache.current.set(heroName, voiceLineData);
      
      // Update hero URL in the heroes list if needed
      // (Hero URL is optional and mainly used for display)
      
      return voiceLineData;
    } catch (error) {
      console.error(`Error fetching voice lines for ${heroName}:`, error);
      return null;
    } finally {
      setLoadingVoiceLines(null);
    }
  };

  // Load voice lines when hero is selected
  useEffect(() => {
    if (newQuestion.correct_answer_hero && !voiceLinesCache.current.has(newQuestion.correct_answer_hero)) {
      fetchVoiceLinesForHero(newQuestion.correct_answer_hero);
    }
  }, [newQuestion.correct_answer_hero]);

  // When editing a question, ensure voice lines are loaded if it's a voice line question
  useEffect(() => {
    if (editingQuestion && editingQuestion.question_type === 'voice_line' && editingQuestion.correct_answer_hero) {
      if (!voiceLinesCache.current.has(editingQuestion.correct_answer_hero)) {
        fetchVoiceLinesForHero(editingQuestion.correct_answer_hero);
      }
    }
  }, [editingQuestion]);

  const getHeroes = (searchTerm: string = '') => {
    const heroList = heroes.map(h => h.hero).sort();
    
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      return heroList.filter(hero => hero.toLowerCase().includes(searchLower));
    }
    
    return heroList;
  };

  const getHeroItems = () => {
    return getHeroes().map(hero => ({
      id: hero,
      text: hero,
    }));
  };

  const getFilteredHeroItems = () => {
    return getHeroItems().filter(item => 
      item.text.toLowerCase().includes(heroSelectFilter.toLowerCase())
    );
  };

  const getFilteredHeroItemsForImage = () => {
    return getHeroItems().filter(item => 
      item.text.toLowerCase().includes(heroImageSelectFilter.toLowerCase())
    );
  };

  const getVoiceLinesForHero = (heroName: string): VoiceLine[] => {
    const cached = voiceLinesCache.current.get(heroName);
    return cached?.voiceLines || [];
  };

  const getVoiceLineItems = (heroName: string) => {
    const voiceLines = getVoiceLinesForHero(heroName);
    voiceLineUrlMap.current.clear();
    return voiceLines.map((vl, idx) => {
      const id = `vl-${idx}-${vl.bunnyCdnLink || vl.link}`;
      const url = vl.bunnyCdnLink || vl.link;
      voiceLineUrlMap.current.set(id, url);
      return {
        id,
        text: vl.name,
        groupId: vl.category,
        url, // Store URL in the item for easier lookup
      };
    });
  };

  // Helper to find voice line item by URL (reverse lookup)
  const findVoiceLineByUrl = (heroName: string, url: string) => {
    if (!url || !heroName) return undefined;
    const items = getVoiceLineItems(heroName);
    // Find by checking if the URL in the map matches, or if the item's url property matches
    return items.find(item => {
      const mappedUrl = voiceLineUrlMap.current.get(item.id);
      return mappedUrl === url || (item as any).url === url;
    });
  };

  const getVoiceLineGroupMetadata = (heroName: string) => {
    const voiceLines = getVoiceLinesForHero(heroName);
    const categories = Array.from(new Set(voiceLines.map(vl => vl.category)));
    return categories.map(category => ({
      groupId: category,
      header: {
        title: category,
      },
    }));
  };

  const getFilteredVoiceLineItems = (heroName: string) => {
    const items = getVoiceLineItems(heroName);
    if (!voiceLineSelectFilter) return items;
    return items.filter(item => 
      item.text.toLowerCase().includes(voiceLineSelectFilter.toLowerCase())
    );
  };

  if (!isOpen) return null;

  const isVoiceLinesLoading = loadingVoiceLines === newQuestion.correct_answer_hero;
  const voiceLinesForHero = getVoiceLinesForHero(newQuestion.correct_answer_hero);

  return (
    <Dialog
      title={editingQuestion ? "Edit Question" : "Create New Question"}
      onClose={onClose}
      renderBody={() => (
        <form onSubmit={onSubmit} id="create-question-form">
          <FormControl required>
            <FormControl.Label>Question Type</FormControl.Label>
            <SelectPanel
              renderAnchor={({ children, ...anchorProps }: any) => {
                const { validationStatus, ...buttonProps } = anchorProps;
                return (
                  <Button
                    trailingAction={TriangleDownIcon}
                    {...buttonProps}
                    aria-haspopup="dialog"
                    block
                  >
                    {children || (newQuestion.question_type === 'voice_line' ? 'Voice Line' : newQuestion.question_type === 'image' ? 'Image' : 'Select question type')}
                  </Button>
                );
              }}
              placeholder="Select question type"
              open={questionTypeOpen}
              onOpenChange={setQuestionTypeOpen}
              items={[
                { text: 'Voice Line', id: 'voice_line' },
                { text: 'Image', id: 'image' }
              ].filter(item => 
                item.text.toLowerCase().includes(questionTypeFilter.toLowerCase())
              )}
              selected={newQuestion.question_type ? { text: newQuestion.question_type === 'voice_line' ? 'Voice Line' : 'Image', id: newQuestion.question_type } : undefined}
              onSelectedChange={(selected: { id?: string | number; text?: string } | { id?: string | number; text?: string }[] | undefined) => {
                if (selected && !Array.isArray(selected) && 'id' in selected && typeof selected.id === 'string') {
                  setNewQuestion({
                    ...newQuestion,
                    question_type: selected.id as 'voice_line' | 'image'
                  });
                  setQuestionTypeOpen(false);
                }
              }}
              onFilterChange={setQuestionTypeFilter}
              filterValue={questionTypeFilter}
              width="medium"
            />
          </FormControl>

          {newQuestion.question_type === 'voice_line' && (
            <>
              <FormControl required>
                <FormControl.Label>Select Hero</FormControl.Label>
                <SelectPanel
                  renderAnchor={({ children, ...anchorProps }: any) => {
                    const { validationStatus, ...buttonProps } = anchorProps;
                    return (
                      <Button
                        trailingAction={TriangleDownIcon}
                        {...buttonProps}
                        aria-haspopup="dialog"
                        block
                      >
                        {children || (newQuestion.correct_answer_hero || 'Select hero')}
                      </Button>
                    );
                  }}
                  placeholder="Select hero"
                  open={heroSelectOpen}
                  onOpenChange={setHeroSelectOpen}
                  items={getFilteredHeroItems()}
                  selected={newQuestion.correct_answer_hero ? { text: newQuestion.correct_answer_hero, id: newQuestion.correct_answer_hero } : undefined}
                  onSelectedChange={(selected: { id?: string | number; text?: string } | { id?: string | number; text?: string }[] | undefined) => {
                    if (selected && !Array.isArray(selected) && 'id' in selected && typeof selected.id === 'string') {
                      setNewQuestion({
                        ...newQuestion,
                        correct_answer_hero: selected.id,
                        voice_line_url: '',
                      });
                      setHeroSelectOpen(false);
                    }
                  }}
                  onFilterChange={setHeroSelectFilter}
                  filterValue={heroSelectFilter}
                  width="medium"
                />
              </FormControl>

              {newQuestion.correct_answer_hero && (
                <>
                  <FormControl required>
                    <FormControl.Label id="voice-line-autocomplete-label">
                      Select Voice Line
                      {isVoiceLinesLoading && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#8b949e' }}>(Loading...)</span>}
                    </FormControl.Label>
                    <SelectPanel
                      renderAnchor={({ children, ...anchorProps }: any) => {
                        const { validationStatus, ...buttonProps } = anchorProps;
                        const displayText = children || (newQuestion.voice_line_url ? findVoiceLineByUrl(newQuestion.correct_answer_hero, newQuestion.voice_line_url)?.text || 'Select voice line' : 'Select voice line');
                        const truncatedText = typeof displayText === 'string' && displayText.length > 60 
                          ? displayText.substring(0, 60) + '...' 
                          : displayText;
                        return (
                          <Button
                            trailingAction={TriangleDownIcon}
                            {...buttonProps}
                            aria-haspopup="dialog"
                            block
                            disabled={isVoiceLinesLoading || voiceLinesForHero.length === 0}
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isVoiceLinesLoading ? 'Loading voice lines...' : truncatedText}
                          </Button>
                        );
                      }}
                      placeholder={isVoiceLinesLoading ? "Loading voice lines..." : "Select voice line"}
                      open={voiceLineSelectOpen && !isVoiceLinesLoading}
                      onOpenChange={setVoiceLineSelectOpen}
                      items={getFilteredVoiceLineItems(newQuestion.correct_answer_hero)}
                      groupMetadata={getVoiceLineGroupMetadata(newQuestion.correct_answer_hero)}
                      selected={newQuestion.voice_line_url ? findVoiceLineByUrl(newQuestion.correct_answer_hero, newQuestion.voice_line_url) : undefined}
                      onSelectedChange={(selected: { id?: string | number; text?: string } | { id?: string | number; text?: string }[] | undefined) => {
                        if (selected && !Array.isArray(selected) && 'id' in selected && typeof selected.id === 'string') {
                          const voiceLineUrl = voiceLineUrlMap.current.get(selected.id);
                          if (voiceLineUrl) {
                            setNewQuestion({
                              ...newQuestion,
                              voice_line_url: voiceLineUrl,
                              question_content: voiceLineUrl,
                            });
                            setVoiceLineSelectOpen(false);
                          }
                        }
                      }}
                      onFilterChange={setVoiceLineSelectFilter}
                      filterValue={voiceLineSelectFilter}
                      width="medium"
                    />
                  </FormControl>
                </>
              )}

              {newQuestion.voice_line_url && (
                <div style={{ marginTop: '0.5rem' }}>
                  <AudioPlayer src={newQuestion.voice_line_url} />
                </div>
              )}
            </>
          )}

          {newQuestion.question_type === 'image' && (
            <>
              <FormControl required>
                <FormControl.Label>Question Image</FormControl.Label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setQuestionFile(e.target.files?.[0] || null)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    lineHeight: '20px',
                    color: 'var(--color-fg-default)',
                    backgroundColor: 'var(--color-input-bg)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                />
              </FormControl>

              <FormControl required>
                <FormControl.Label id="hero-autocomplete-image-label">Correct Answer Hero</FormControl.Label>
                <SelectPanel
                  renderAnchor={({ children, ...anchorProps }: any) => {
                    const { validationStatus, ...buttonProps } = anchorProps;
                    return (
                      <Button
                        trailingAction={TriangleDownIcon}
                        {...buttonProps}
                        aria-haspopup="dialog"
                        block
                      >
                        {children || (newQuestion.correct_answer_hero || 'Select hero')}
                      </Button>
                    );
                  }}
                  placeholder="Select hero"
                  open={heroImageSelectOpen}
                  onOpenChange={setHeroImageSelectOpen}
                  items={getFilteredHeroItemsForImage()}
                  selected={newQuestion.correct_answer_hero ? { text: newQuestion.correct_answer_hero, id: newQuestion.correct_answer_hero } : undefined}
                  onSelectedChange={(selected: { id?: string | number; text?: string } | { id?: string | number; text?: string }[] | undefined) => {
                    if (selected && !Array.isArray(selected) && 'id' in selected && typeof selected.id === 'string') {
                      setNewQuestion({
                        ...newQuestion,
                        correct_answer_hero: selected.id,
                      });
                      setHeroImageSelectOpen(false);
                    }
                  }}
                  onFilterChange={setHeroImageSelectFilter}
                  filterValue={heroImageSelectFilter}
                  width="medium"
                />
              </FormControl>
            </>
          )}

          <FormControl>
            <FormControl.Label>Answer Image (shown after question goes live)</FormControl.Label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAnswerFile(e.target.files?.[0] || null)}
            />
            <FormControl.Caption>Or enter URL:</FormControl.Caption>
            <TextInput
              type="url"
              value={newQuestion.answer_image_url || ''}
              onChange={(e) => setNewQuestion({
                ...newQuestion,
                answer_image_url: e.target.value,
              })}
              placeholder="https://example.com/image.jpg"
              block
            />
          </FormControl>

          <FormControl required>
            <FormControl.Label>Time Limit (seconds)</FormControl.Label>
            <TextInput
              type="number"
              min="1"
              value={newQuestion.time_limit_seconds.toString()}
              onChange={(e) => setNewQuestion({
                ...newQuestion,
                time_limit_seconds: parseInt(e.target.value) || 120,
              })}
              required
              block
            />
          </FormControl>

          <FormControl>
            <FormControl.Label>Order Index</FormControl.Label>
            <TextInput
              type="number"
              min="0"
              value={newQuestion.order_index.toString()}
              onChange={(e) => setNewQuestion({
                ...newQuestion,
                order_index: parseInt(e.target.value) || 0,
              })}
              block
            />
          </FormControl>
        </form>
      )}
      footerButtons={[
        {
          buttonType: 'default',
          content: 'Cancel',
          onClick: onClose,
        },
        {
          buttonType: 'primary',
          content: editingQuestion ? 'Update Question' : 'Create Question',
          onClick: () => {
            const form = document.getElementById('create-question-form') as HTMLFormElement;
            if (form) {
              form.requestSubmit();
            }
          },
        },
      ]}
    />
  );
}
