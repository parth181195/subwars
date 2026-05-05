import { useState } from 'react';
import { Dialog, FormControl, TextInput } from '@primer/react';
import { environment } from '../../config/environment';
import { getAuthHeaders } from '../../utils/api-client';
import './AutoGenerateQuestionsDialog.scss';

const API_BASE_URL = environment.apiBaseUrl;

interface AutoGenerateQuestionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  quizId: string;
  onSuccess: () => void;
}

export default function AutoGenerateQuestionsDialog({
  isOpen,
  onClose,
  quizId,
  onSuccess,
}: AutoGenerateQuestionsDialogProps) {
  const [count, setCount] = useState(10);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(120);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (count < 1 || count > 100) {
      setError('Question count must be between 1 and 100');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${quizId}/questions/auto-generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          count,
          questionType: 'voice_line',
          timeLimitSeconds,
          excludeHeroes: [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Failed to generate questions: ${response.statusText}`);
      }

      await response.json();
      
      // Close dialog and refresh questions
      onClose();
      onSuccess();
      
      // Reset form
      setCount(10);
      setTimeLimitSeconds(120);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    if (!isGenerating) {
      onClose();
      setError(null);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog
      title="Auto-Generate Questions"
      onClose={handleClose}
      renderBody={() => (
        <div className="auto-generate-questions-dialog">
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
          
          <FormControl required>
            <FormControl.Label htmlFor="question-count">Number of Questions</FormControl.Label>
            <TextInput
              id="question-count"
              type="number"
              min={1}
              max={100}
              value={count.toString()}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value >= 1 && value <= 100) {
                  setCount(value);
                  setError(null);
                } else if (e.target.value === '') {
                  setCount(1);
                }
              }}
              disabled={isGenerating}
              block
              placeholder="Enter number of questions (1-100)"
            />
            <FormControl.Caption>
              Enter the number of questions to generate (1-100). Questions will be randomly selected from available heroes and voice lines.
            </FormControl.Caption>
          </FormControl>

          <FormControl required>
            <FormControl.Label htmlFor="time-limit">Time Limit (seconds)</FormControl.Label>
            <TextInput
              id="time-limit"
              type="number"
              min={1}
              max={600}
              value={timeLimitSeconds.toString()}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value >= 1 && value <= 600) {
                  setTimeLimitSeconds(value);
                  setError(null);
                } else if (e.target.value === '') {
                  setTimeLimitSeconds(120);
                }
              }}
              disabled={isGenerating}
              block
              placeholder="Enter time limit in seconds"
            />
            <FormControl.Caption>
              Time limit for each question in seconds (default: 120 seconds)
            </FormControl.Caption>
          </FormControl>

          <div className="info-box">
            <p>
              <strong>Note:</strong> This will randomly generate questions by:
            </p>
            <ul>
              <li>Randomly selecting heroes from available heroes</li>
              <li>Randomly selecting voice lines for each hero</li>
              <li>Ensuring no duplicate questions are created</li>
              <li>Adding questions after existing ones (if any)</li>
            </ul>
          </div>
        </div>
      )}
      footerButtons={[
        {
          buttonType: 'default',
          content: 'Cancel',
          onClick: handleClose,
          disabled: isGenerating,
        },
        {
          buttonType: 'primary',
          content: isGenerating ? 'Generating...' : 'Generate Questions',
          onClick: handleGenerate,
          disabled: isGenerating || count < 1 || count > 100,
        },
      ]}
    />
  );
}

