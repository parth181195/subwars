import { useState } from 'react';
import { Dialog, Button, Label } from '@primer/react';
import { ImageIcon } from '@primer/octicons-react';
import AudioPlayer from '../../components/AudioPlayer/AudioPlayer';
import ConfirmationDialog from './ConfirmationDialog';
import './QuestionDetailsPopup.scss';

interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_type: 'voice_line' | 'image';
  question_content: string;
  correct_answer_hero: string;
  answer_image_url?: string;
  time_limit_seconds: number;
  order_index: number;
  status: 'pending' | 'live' | 'completed';
  is_active: boolean;
}

interface QuestionStatistics {
  totalAnswers: number;
  correctAnswers: number;
  answerHero: string;
}

interface QuestionDetailsPopupProps {
  question: QuizQuestion;
  questionStatistics: QuestionStatistics | null;
  quizStatus?: 'draft' | 'live' | 'paused' | 'completed';
  onClose: () => void;
  onMakeLive: (questionId: string) => void;
  onEndQuestion: (questionId: string) => void;
  onDeleteQuestion: (questionId: string) => void;
  onViewAllAnswers: (questionId: string) => void;
  onViewImage: (url: string, title: string) => void;
}

export default function QuestionDetailsPopup({
  question,
  questionStatistics,
  quizStatus,
  onClose,
  onMakeLive,
  onEndQuestion,
  onDeleteQuestion,
  onViewAllAnswers,
  onViewImage,
}: QuestionDetailsPopupProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleMakeLive = () => {
    onMakeLive(question.id);
    onClose();
  };

  const handleEndQuestion = () => {
    onEndQuestion(question.id);
    onClose();
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    onDeleteQuestion(question.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleViewAllAnswers = () => {
    onViewAllAnswers(question.id);
    onClose();
  };

  return (
    <>
      <Dialog
      title={`Question #${question.order_index + 1} Details`}
      onClose={onClose}
      width="xlarge"
      renderBody={() => (
        <div className="question-details-popup">
          <div className="details-list">
            <div className="list-row">
              <div className="list-label">Type</div>
              <div className="list-value">{question.question_type === 'voice_line' ? 'Voice Line' : 'Image'}</div>
            </div>
            <div className="list-row">
              <div className="list-label">Correct Answer Hero</div>
              <div className="list-value">{question.correct_answer_hero}</div>
            </div>
            <div className="list-row">
              <div className="list-label">Time Limit</div>
              <div className="list-value">{question.time_limit_seconds}s</div>
            </div>
            <div className="list-row">
              <div className="list-label">Status</div>
              <div className="list-value">
                <Label variant={question.status === 'live' ? 'success' : question.status === 'completed' ? 'secondary' : 'secondary'}>
                  {question.status}
                </Label>
              </div>
            </div>
            {question.question_content && (
              <div className="list-row">
                <div className="list-label">Content</div>
                <div className="list-value">
                  {question.question_type === 'voice_line' ? (
                    <AudioPlayer src={question.question_content} />
                  ) : (
                    <Button
                      variant="invisible"
                      size="small"
                      onClick={() => onViewImage(question.question_content, 'Question Image')}
                      leadingVisual={ImageIcon}
                    >
                      View Question Image
                    </Button>
                  )}
                </div>
              </div>
            )}
            {question.answer_image_url && (
              <div className="list-row">
                <div className="list-label">Answer Image</div>
                <div className="list-value">
                  <Button
                    variant="invisible"
                    size="small"
                    onClick={() => onViewImage(question.answer_image_url!, 'Answer Image')}
                    leadingVisual={ImageIcon}
                  >
                    View Answer Image
                  </Button>
                </div>
              </div>
            )}
            {questionStatistics && (
              <>
                <div className="list-row">
                  <div className="list-label">Total Answered</div>
                  <div className="list-value">{questionStatistics.totalAnswers}</div>
                </div>
                <div className="list-row">
                  <div className="list-label">Correct Answers</div>
                  <div className="list-value">{questionStatistics.correctAnswers}</div>
                </div>
                <div className="list-row">
                  <div className="list-label">Answer Hero</div>
                  <div className="list-value">{questionStatistics.answerHero || 'N/A'}</div>
                </div>
                <div className="list-row">
                  <div className="list-label">Accuracy</div>
                  <div className="list-value">
                    {questionStatistics.totalAnswers > 0
                      ? `${Math.round((questionStatistics.correctAnswers / questionStatistics.totalAnswers) * 100)}%`
                      : 'N/A'}
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      )}
      footerButtons={[
        ...(!question.is_active && quizStatus !== 'draft'
          ? [
              {
                buttonType: 'primary' as const,
                content: question.status === 'completed' ? 'Reactivate' : 'Make Live',
                onClick: handleMakeLive,
              },
            ]
          : []),
        ...(question.is_active
          ? [
              {
                buttonType: 'danger' as const,
                content: 'End Question',
                onClick: handleEndQuestion,
              },
            ]
          : []),
        {
          buttonType: 'normal' as const,
          content: 'View All Answers',
          onClick: handleViewAllAnswers,
        },
        ...(question.is_active && question.status === 'live'
          ? []
          : [
              {
                buttonType: 'danger' as const,
                content: 'Delete Question',
                onClick: handleDeleteClick,
              },
            ]),
        {
          buttonType: 'default' as const,
          content: 'Close',
          onClick: onClose,
        },
      ]}
    />
    <ConfirmationDialog
      isOpen={showDeleteConfirm}
      title="Delete Question"
      message={`Are you sure you want to delete Question #${question.order_index + 1}? This action cannot be undone.`}
      confirmText="Delete"
      cancelText="Cancel"
      variant="danger"
      onConfirm={handleDeleteConfirm}
      onCancel={() => setShowDeleteConfirm(false)}
    />
    </>
  );
}

