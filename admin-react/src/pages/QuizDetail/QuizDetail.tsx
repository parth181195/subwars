import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Label } from '@primer/react';
import { ArrowLeftIcon } from '@primer/octicons-react';
import { io } from 'socket.io-client';
import QuestionsTab from './QuestionsTab';
import LeaderboardTab from './LeaderboardTab';
import './QuizDetail.scss';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface Quiz {
  id: string;
  name: string;
  description?: string;
  scheduled_at?: string;
  status: 'draft' | 'live' | 'paused' | 'completed';
  created_at: string;
}

interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_type: 'voice_line' | 'image';
  question_content: string;
  question_content_metadata?: Record<string, any>;
  correct_answer_hero: string;
  answer_image_url?: string;
  time_limit_seconds: number;
  order_index: number;
  status: 'pending' | 'live' | 'completed';
  is_active: boolean;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}

interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  total_score: number;
  total_answers: number;
  correct_answers: number;
  average_response_time: number;
}

interface VoiceLineData {
  hero: string;
  url: string;
  voiceLines: Array<{
    name: string;
    link: string;
    category: string;
    bunnyCdnLink?: string;
    bunnyCdnPath?: string;
  }>;
}

export default function QuizDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [voiceLinesData, setVoiceLinesData] = useState<VoiceLineData[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (id) {
      fetchQuiz();
      fetchQuestions();
      fetchVoiceLines();
    }
  }, [id]);

  // Initialize WebSocket connection for real-time updates
  useEffect(() => {
    if (!id) return;

    const socketUrl = API_BASE_URL.replace('/api', '');
    const newSocket = io(`${socketUrl}/quiz`, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Admin connected to quiz server');
      // Join the quiz room as admin
      newSocket.emit('join-quiz', {
        quizId: id,
        userId: 'admin', // Admin identifier
      });
    });

    newSocket.on('question-live', (data: { question: QuizQuestion; timeRemaining: number }) => {
      console.log('Question went live:', data);
      setTimeRemaining(data.timeRemaining);
      fetchQuestions(); // Refresh questions list
    });

    newSocket.on('question-ended', () => {
      console.log('Question ended');
      setTimeRemaining(null);
      fetchQuestions(); // Refresh questions list
    });

    newSocket.on('leaderboard-updated', () => {
      fetchLeaderboard(); // Refresh leaderboard
    });

    return () => {
      if (newSocket) {
        newSocket.emit('leave-quiz', { quizId: id });
        newSocket.disconnect();
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [id]);

  // Timer countdown for remaining time
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) {
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    timerIntervalRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [timeRemaining]);

  useEffect(() => {
    fetchLeaderboard();
  }, [id]);

  const fetchQuiz = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${id}`);
      if (response.ok) {
        const data = await response.json();
        setQuiz(data);
      }
    } catch (error) {
      console.error('Failed to fetch quiz:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${id}/questions`);
      if (response.ok) {
        const data = await response.json();
        setQuestions(data);
        
        // Update time remaining for active question
        const activeQuestion = data.find((q: QuizQuestion) => q.is_active && q.status === 'live');
        if (activeQuestion && activeQuestion.started_at && activeQuestion.time_limit_seconds) {
          const startedAt = new Date(activeQuestion.started_at).getTime();
          const elapsed = Math.floor((Date.now() - startedAt) / 1000);
          const remaining = Math.max(0, activeQuestion.time_limit_seconds - elapsed);
          setTimeRemaining(remaining);
        } else {
          setTimeRemaining(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    }
  };

  const fetchVoiceLines = async () => {
    try {
      // Fetch from API endpoint
      const response = await fetch(`${API_BASE_URL}/api/voice-lines`);
      if (response.ok) {
        const data = await response.json();
        setVoiceLinesData(data.heroes || []);
      } else {
        console.warn('Voice lines JSON not found. Question creation may be limited.');
      }
    } catch (error) {
      console.error('Failed to fetch voice lines:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${id}/leaderboard`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  };

  const handleViewAnswers = (questionId: string) => {
    navigate(`/quizzes/${id}/questions/${questionId}/answers`);
  };

  const handleQuizStatusToggle = async () => {
    if (!id || !quiz || isTogglingStatus) return;

    const currentStatus = quiz.status;
    const newStatus = currentStatus === 'live' ? 'draft' : 'live';

    setIsTogglingStatus(true);
    try {
      console.log('Toggling quiz status from', currentStatus, 'to:', newStatus);
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const updatedQuiz = await response.json();
        console.log('Quiz updated successfully:', updatedQuiz);
        setQuiz(updatedQuiz);
        
        // If quiz was set to draft, refresh questions to reflect ended live questions
        if (newStatus === 'draft') {
          await fetchQuestions();
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to update quiz status:', response.status, errorText);
        alert(`Failed to update quiz status: ${errorText}`);
      }
    } catch (error) {
      console.error('Failed to update quiz status:', error);
      alert(`Failed to update quiz status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTogglingStatus(false);
    }
  };



  if (loading) {
    return (
      <div className="quiz-detail-page">
        <div className="loading-container">Loading quiz...</div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="quiz-detail-page">
        <div className="error-container">Quiz not found</div>
      </div>
    );
  }

  const activeQuestion = questions.find(q => q.is_active && q.status === 'live');

  return (
    <div className="quiz-detail-page">
      <div className="page-header">
        <Button 
          variant="default" 
          onClick={() => navigate('/quizzes')}
          leadingVisual={ArrowLeftIcon}
        >
          Back to Quizzes
        </Button>
        <div className="quiz-info-footer">
          <div className="quiz-info-text">
            <h1 className="page-title">{quiz.name}</h1>
            {quiz.description && <p className="quiz-description">{quiz.description}</p>}
          </div>
          <div className="quiz-status-control">
            <Button
              variant={quiz.status === 'live' ? 'danger' : 'primary'}
              onClick={handleQuizStatusToggle}
              disabled={isTogglingStatus}
            >
              {quiz.status === 'live' ? 'Set to Draft' : 'Set to Live'}
            </Button>
            <Label variant={quiz.status === 'live' ? 'success' : quiz.status === 'completed' ? 'secondary' : quiz.status === 'paused' ? 'attention' : 'secondary'}>
              {quiz.status}
            </Label>
          </div>
        </div>
      </div>

      {activeQuestion && (
        <div className="active-question-banner">
          <div>
            <strong>Live Question:</strong> Question #{activeQuestion.order_index + 1}
            {activeQuestion.started_at && (
              <span className="question-timer">
                Started: {new Date(activeQuestion.started_at).toLocaleTimeString()}
              </span>
            )}
            {timeRemaining !== null && (
              <span className={`question-time-remaining ${timeRemaining <= 10 ? 'warning' : ''}`}>
                Time Remaining: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </span>
            )}
          </div>
          {activeQuestion.answer_image_url && (
            <img 
              src={activeQuestion.answer_image_url} 
              alt="Answer" 
              className="answer-image-preview"
            />
          )}
          <Button 
            variant="danger" 
            onClick={async () => {
              try {
                const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/questions/${activeQuestion.id}/end`, {
                  method: 'POST',
                });
                if (response.ok) {
                  fetchQuestions();
                }
              } catch (error) {
                console.error('Failed to end question:', error);
              }
            }}
          >
            End Question
          </Button>
        </div>
      )}

      <div className="underline-panels-container">
        <div className="underline-panels-tabs" role="tablist" aria-label="Quiz sections">
          <button
            role="tab"
            aria-selected={selectedTabIndex === 0}
            className={`underline-panel-tab ${selectedTabIndex === 0 ? 'selected' : ''}`}
            onClick={() => setSelectedTabIndex(0)}
          >
            Questions
            <span className="tab-counter">{questions.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={selectedTabIndex === 1}
            className={`underline-panel-tab ${selectedTabIndex === 1 ? 'selected' : ''}`}
            onClick={() => setSelectedTabIndex(1)}
          >
            Leaderboard
          </button>
        </div>
        <div className="underline-panels-content">
          {selectedTabIndex === 0 && (
            <div role="tabpanel">
              <QuestionsTab
                questions={questions}
                quizId={id || ''}
                quizStatus={quiz?.status}
                onQuestionsChange={() => {
                  fetchQuestions();
                }}
                onViewAnswers={handleViewAnswers}
                voiceLinesData={voiceLinesData}
              />
            </div>
          )}
          {selectedTabIndex === 1 && (
            <div role="tabpanel">
              <LeaderboardTab leaderboard={leaderboard} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

