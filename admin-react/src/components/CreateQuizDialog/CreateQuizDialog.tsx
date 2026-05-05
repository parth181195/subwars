import { useState } from 'react';
import { Dialog, FormControl, TextInput } from '@primer/react';
import './CreateQuizDialog.scss';

interface CreateQuizDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (quizData: { name: string; description: string }) => Promise<void>;
}

export default function CreateQuizDialog({
  isOpen,
  onClose,
  onSubmit,
}: CreateQuizDialogProps) {
  const [quizData, setQuizData] = useState({
    name: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!quizData.name.trim()) {
      setError('Quiz name is required');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(quizData);
      // Reset form on success
      setQuizData({ name: '', description: '' });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setQuizData({ name: '', description: '' });
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog
      title="Create New Quiz"
      onClose={handleClose}
      renderBody={() => (
        <div className="create-quiz-dialog">
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
          <FormControl required>
            <FormControl.Label htmlFor="quiz-name">Quiz Name *</FormControl.Label>
            <TextInput
              id="quiz-name"
              value={quizData.name}
              onChange={(e) => {
                setQuizData({ ...quizData, name: e.target.value });
                if (error) setError(null);
              }}
              required
              block
              disabled={isSubmitting}
              placeholder="Enter quiz name"
            />
          </FormControl>
          <FormControl className="form-control-spacing">
            <FormControl.Label htmlFor="quiz-description">Description</FormControl.Label>
            <textarea
              id="quiz-description"
              value={quizData.description}
              onChange={(e) => setQuizData({ ...quizData, description: e.target.value })}
              rows={3}
              disabled={isSubmitting}
              placeholder="Enter quiz description (optional)"
              className="quiz-textarea"
            />
          </FormControl>
        </div>
      )}
      footerButtons={[
        {
          buttonType: 'default',
          content: 'Cancel',
          onClick: handleClose,
          disabled: isSubmitting,
        },
        {
          buttonType: 'primary',
          content: isSubmitting ? 'Creating...' : 'Create Quiz',
          onClick: handleSubmit,
          disabled: isSubmitting || !quizData.name.trim(),
        },
      ]}
    />
  );
}

