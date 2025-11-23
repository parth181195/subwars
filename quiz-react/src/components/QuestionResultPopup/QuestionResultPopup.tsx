import { Button } from '@primer/react';
import './QuestionResultPopup.scss';

export interface TopAnswer {
  user_name: string;
  response_time: number;
  score: number;
  position: number;
}

interface QuestionResultPopupProps {
  isOpen: boolean;
  correctAnswer: string;
  topAnswers: TopAnswer[];
  questionNumber: number;
  onClose: () => void;
}

export default function QuestionResultPopup({
  isOpen,
  correctAnswer,
  topAnswers,
  questionNumber,
  onClose,
}: QuestionResultPopupProps) {
  if (!isOpen) return null;

  const formatTime = (ms: number): string => {
    const seconds = (ms / 1000).toFixed(2);
    return `${seconds}s`;
  };

  const getMedal = (position: number): string => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return '';
  };

  return (
    <div className="question-result-overlay" onClick={onClose}>
      <div className="question-result-popup" onClick={(e) => e.stopPropagation()}>
        <div className="question-result-header">
          <h2>Question #{questionNumber} Results</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="question-result-content">
          <div className="correct-answer-section">
            <h3>Correct Answer</h3>
            <div className="correct-answer-value">{correctAnswer}</div>
          </div>

          {topAnswers.length > 0 && (
            <div className="top-answers-section">
              <h3>Top 3 Fastest Correct Answers</h3>
              <div className="top-answers-list">
                {topAnswers.map((answer) => (
                  <div key={answer.position} className="top-answer-item">
                    <div className="answer-position">
                      {getMedal(answer.position)} {answer.position}
                    </div>
                    <div className="answer-details">
                      <div className="answer-name">{answer.user_name}</div>
                      <div className="answer-stats">
                        <span className="answer-time">⏱️ {formatTime(answer.response_time)}</span>
                        <span className="answer-score">⭐ {answer.score} pts</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topAnswers.length === 0 && (
            <div className="no-answers-message">
              No correct answers were submitted for this question.
            </div>
          )}
        </div>

        <div className="question-result-footer">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

