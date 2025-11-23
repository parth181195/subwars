import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Heading } from '@primer/react';
import { ArrowLeftIcon } from '@primer/octicons-react';
import './Answers.scss';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface Answer {
  id: string;
  user_id: string;
  quiz_id: string;
  question_id: string;
  answer: string;
  is_correct: boolean;
  response_time?: number;
  score: number;
  submitted_at: string;
}

interface Question {
  id: string;
  quiz_id: string;
  question_type: 'voice_line' | 'image';
  question_content: string;
  correct_answer_hero: string;
  order_index: number;
  status: 'pending' | 'live' | 'completed';
}

export default function Answers() {
  const { id: quizId, questionId } = useParams<{ id: string; questionId: string }>();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnswers = async () => {
    if (!questionId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/questions/${questionId}/answers`);
      if (response.ok) {
        const data = await response.json();
        setAnswers(data);
        setError(null);
      } else {
        setError('Failed to fetch answers');
      }
    } catch (err) {
      console.error('Failed to fetch answers:', err);
      setError('Failed to fetch answers');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestion = async () => {
    if (!questionId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/questions/${questionId}`);
      if (response.ok) {
        const data = await response.json();
        setQuestion(data);
      } else {
        console.error('Failed to fetch question:', response.statusText);
      }
    } catch (err) {
      console.error('Failed to fetch question:', err);
    }
  };

  useEffect(() => {
    if (questionId) {
      fetchQuestion();
      fetchAnswers();
    }
  }, [questionId]);

  // Poll for new answers every 2 seconds if question is live
  useEffect(() => {
    if (!questionId || !question) return;

    if (question.status === 'live') {
      const interval = setInterval(() => {
        fetchAnswers();
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [questionId, question?.status]);

  const handleBack = () => {
    if (quizId) {
      navigate(`/quizzes/${quizId}`);
    } else {
      navigate('/quizzes');
    }
  };

  if (loading) {
    return (
      <div className="answers-page">
        <div className="answers-container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="answers-page">
      <div className="answers-container">
        <div className="answers-header">
          <Button
            onClick={handleBack}
            leadingVisual={ArrowLeftIcon}
            variant="default"
            className="back-button"
          >
            Back to Quiz
          </Button>
          <Heading as="h1" className="answers-title">
            Answers
            {question && (
              <span className="question-info">
                {' '}• Question {question.order_index + 1}
                {question.status === 'live' && (
                  <span className="live-badge">LIVE</span>
                )}
              </span>
            )}
          </Heading>
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        {question && (
          <div className="question-details">
            <p><strong>Correct Answer:</strong> {question.correct_answer_hero}</p>
            <p><strong>Status:</strong> {question.status}</p>
            <p><strong>Total Answers:</strong> {answers.length}</p>
            <p><strong>Correct Answers:</strong> {answers.filter(a => a.is_correct).length}</p>
          </div>
        )}

        <div className="answers-table-container">
          <table className="answers-table">
            <thead>
              <tr>
                <th>#</th>
                <th>User ID</th>
                <th>Answer</th>
                <th>Correct</th>
                <th>Response Time (ms)</th>
                <th>Score</th>
                <th>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {answers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center">
                    No answers yet
                  </td>
                </tr>
              ) : (
                answers.map((answer, index) => (
                  <tr
                    key={answer.id}
                    className={answer.is_correct ? 'correct' : 'incorrect'}
                  >
                    <td>{index + 1}</td>
                    <td>{answer.user_id}</td>
                    <td>{answer.answer}</td>
                    <td>{answer.is_correct ? '✓' : '✗'}</td>
                    <td>{answer.response_time || 'N/A'}</td>
                    <td>{answer.score}</td>
                    <td>{new Date(answer.submitted_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

