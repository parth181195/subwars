import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { quizService, type Quiz, type QuizQuestion, type LeaderboardEntry } from '../../services/quiz';
import { quizAuthService, type AuthUser } from '../../services/auth';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../config/environment';
import QuestionResultPopup, { type TopAnswer } from '../../components/QuestionResultPopup/QuestionResultPopup';
import './Quiz.scss';

// Helper function to convert relative voice line URLs to absolute URLs
const getVoiceLineUrl = (url: string): string => {
  if (!url) return url;
  // If it's already an absolute URL (starts with http:// or https://), return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // If it's a relative URL (starts with /api/), prepend the base URL without /api
  if (url.startsWith('/api/')) {
    // environment.apiUrl is 'http://localhost:3000/api', so we need to remove /api from it
    const baseUrl = environment.apiUrl.replace(/\/api$/, '');
    return `${baseUrl}${url}`;
  }
  // If it's a relative URL (starts with /), prepend the base URL
  if (url.startsWith('/')) {
    const baseUrl = environment.apiUrl.replace(/\/api$/, '');
    return `${baseUrl}${url}`;
  }
  return url;
};

interface QuestionState {
  question: QuizQuestion | null;
  timeRemaining: number;
  isActive: boolean;
}

export default function Quiz() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const quizIdFromParams = searchParams.get('quizId');
  
  const [user, setUser] = useState<AuthUser | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizId, setQuizId] = useState<string | null>(quizIdFromParams);
  const [questionState, setQuestionState] = useState<QuestionState>({
    question: null,
    timeRemaining: 0,
    isActive: false,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    is_correct: boolean;
    score: number;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [resultData, setResultData] = useState<{
    correctAnswer: string;
    topAnswers: TopAnswer[];
    questionNumber: number;
  } | null>(null);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTimeRef = useRef<number | null>(null);

  // Initialize authentication
  useEffect(() => {
    const unsubscribe = quizAuthService.subscribe((authUser) => {
      setUser(authUser);
      if (!authUser) {
        navigate('/login');
      }
    });

    return unsubscribe;
  }, [navigate]);

  // Initialize socket connection
  useEffect(() => {
    if (!quizId || !user) return;

    const socketUrl = environment.apiUrl.replace('/api', '');
    const newSocket = io(`${socketUrl}/quiz`, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to quiz server');
      setConnected(true);
      
      // Join the quiz room
      newSocket.emit('join-quiz', {
        quizId,
        userId: user.id,
      });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from quiz server');
      setConnected(false);
    });

    newSocket.on('joined-quiz', (data) => {
      console.log('Joined quiz:', data);
    });

    newSocket.on('question-live', (data: { question: QuizQuestion; timeRemaining: number }) => {
      console.log('Question went live:', data);
      setQuestionState({
        question: data.question,
        timeRemaining: data.timeRemaining,
        isActive: true,
      });
      setSubmitted(false);
      setSubmissionResult(null);
      setAnswer('');
      questionStartTimeRef.current = Date.now();
    });

    newSocket.on('question-ended', async (data: { question: QuizQuestion }) => {
      console.log('Question ended:', data);
      setQuestionState((prev) => ({
        ...prev,
        isActive: false,
        timeRemaining: 0,
      }));
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      // Fetch top 3 fastest correct answers and show popup
      try {
        const topAnswers = await quizService.getTopAnswers(data.question.id);
        setResultData({
          correctAnswer: data.question.correct_answer_hero || 'Unknown',
          topAnswers: topAnswers.map(a => ({
            user_name: a.user_name,
            response_time: a.response_time,
            score: a.score,
            position: a.position,
          })),
          questionNumber: (data.question.order_index || 0) + 1,
        });
        setShowResultPopup(true);
      } catch (error) {
        console.error('Failed to fetch top answers:', error);
        // Still show popup with just correct answer
        setResultData({
          correctAnswer: data.question.correct_answer_hero || 'Unknown',
          topAnswers: [],
          questionNumber: (data.question.order_index || 0) + 1,
        });
        setShowResultPopup(true);
      }
    });

    newSocket.on('answer-submitted', (data: {
      answer: { is_correct: boolean; score: number };
      success: boolean;
    }) => {
      console.log('Answer submitted:', data);
      setSubmissionResult({
        is_correct: data.answer.is_correct,
        score: data.answer.score,
        message: data.answer.is_correct ? 'Correct!' : 'Incorrect',
      });
      setSubmitted(true);
    });

    newSocket.on('answer-rejected', (data: { message: string }) => {
      console.error('Answer rejected:', data.message);
      alert(data.message);
    });

    newSocket.on('leaderboard-updated', (data: { leaderboard: LeaderboardEntry[] }) => {
      console.log('Leaderboard updated:', data);
      setLeaderboard(data.leaderboard);
    });

    newSocket.on('error', (data: { message: string }) => {
      console.error('Socket error:', data.message);
      setError(data.message);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.emit('leave-quiz', { quizId });
        newSocket.disconnect();
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [quizId, user]);

  // Fetch active quiz if no quizId provided
  useEffect(() => {
    if (quizId) return; // Already have a quiz ID

    const fetchActiveQuiz = async () => {
      try {
        setLoading(true);
        setError(null);

        const activeQuizzes = await quizService.getActiveQuizzes();
        if (activeQuizzes.length === 0) {
          setError('No active quiz available at the moment. Please check back later.');
          setLoading(false);
          return;
        }

        // Use the first active quiz (should only be one)
        const activeQuiz = activeQuizzes[0];
        setQuizId(activeQuiz.id);
        setQuiz(activeQuiz);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load active quiz');
        console.error('Error fetching active quiz:', err);
        setLoading(false);
      }
    };

    fetchActiveQuiz();
  }, [quizId]);

  // Fetch quiz data when quizId is available
  useEffect(() => {
    if (!quizId) return;

    const fetchQuizData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [quizData, questions, leaderboardData] = await Promise.all([
          quizService.getQuizById(quizId),
          quizService.getQuizQuestions(quizId),
          quizService.getQuizLeaderboard(quizId),
        ]);

        setQuiz(quizData);
        setLeaderboard(leaderboardData);

        // Find active question
        const activeQuestion = questions.find(q => q.is_active && q.status === 'live');
        if (activeQuestion) {
          const timeLimit = activeQuestion.time_limit_seconds || 120;
          const startedAt = activeQuestion.started_at ? new Date(activeQuestion.started_at).getTime() : Date.now();
          const elapsed = Math.floor((Date.now() - startedAt) / 1000);
          const remaining = Math.max(0, timeLimit - elapsed);

          setQuestionState({
            question: activeQuestion,
            timeRemaining: remaining,
            isActive: remaining > 0,
          });
          questionStartTimeRef.current = startedAt;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quiz data');
        console.error('Error fetching quiz data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizData();
  }, [quizId]);

  // Timer countdown
  useEffect(() => {
    if (!questionState.isActive || questionState.timeRemaining <= 0) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setQuestionState((prev) => {
        if (prev.timeRemaining <= 1) {
          return { ...prev, timeRemaining: 0, isActive: false };
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 };
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [questionState.isActive, questionState.timeRemaining]);

  const handleSubmitAnswer = () => {
    if (!socket || !questionState.question || !user || !answer.trim() || submitted) {
      return;
    }

    const responseTime = questionStartTimeRef.current
      ? Math.floor((Date.now() - questionStartTimeRef.current) / 1000)
      : undefined;

    socket.emit('submit-answer', {
      quizId,
      questionId: questionState.question.id,
      answer: answer.trim(),
      userId: user.id,
      responseTime,
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="quiz-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-page">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/quiz-info')}>Back to Quizzes</button>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="quiz-page">
        <div className="error-container">
          <h2>Quiz not found</h2>
          <button onClick={() => navigate('/quiz-info')}>Back to Quizzes</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <div className="quiz-container">
        {/* Header */}
        <div className="quiz-header">
          <h1>{quiz.name}</h1>
          <div className="connection-status">
            <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}></span>
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="quiz-content">
          {/* Question Section */}
          <div className="question-section">
            {questionState.question && questionState.isActive ? (
              <>
                <div className="question-header">
                  <div className="question-timer">
                    <span className="timer-label">Time Remaining:</span>
                    <span className={`timer-value ${questionState.timeRemaining <= 10 ? 'warning' : ''}`}>
                      {formatTime(questionState.timeRemaining)}
                    </span>
                  </div>
                  <span className="live-badge">LIVE</span>
                </div>

                <div className="question-content">
                  {questionState.question.question_type === 'voice_line' ? (
                    <div className="voice-line-question">
                      <audio
                        controls
                        src={getVoiceLineUrl(questionState.question.question_content)}
                        crossOrigin="anonymous"
                        preload="auto"
                        className="voice-line-audio"
                      />
                      <p className="question-instruction">Listen to the voice line and identify the hero!</p>
                    </div>
                  ) : (
                    <div className="image-question">
                      <img
                        src={questionState.question.question_image_url || questionState.question.question_content}
                        alt="Question"
                        className="question-image"
                      />
                      <p className="question-instruction">Identify the hero in the image!</p>
                    </div>
                  )}
                </div>

                {/* Answer Input */}
                {questionState.isActive && !submitted && (
                  <div className="answer-section">
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSubmitAnswer();
                        }
                      }}
                      placeholder="Enter hero name..."
                      className="answer-input"
                      disabled={submitted}
                    />
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={!answer.trim() || submitted}
                      className="submit-button"
                    >
                      Submit Answer
                    </button>
                  </div>
                )}

                {/* Submission Result */}
                {submitted && submissionResult && (
                  <div className={`submission-result ${submissionResult.is_correct ? 'correct' : 'incorrect'}`}>
                    <h3>{submissionResult.is_correct ? '✓ Correct!' : '✗ Incorrect'}</h3>
                    <p>Score: {submissionResult.score} points</p>
                    {!submissionResult.is_correct && (
                      <p className="correct-answer">
                        Correct answer: {questionState.question.correct_answer_hero}
                      </p>
                    )}
                  </div>
                )}

              </>
            ) : (
              <div className="no-question">
                <p>No question is active at the moment.</p>
              </div>
            )}
          </div>

          {/* Leaderboard Section */}
          <div className="leaderboard-section">
            <h2>Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <p className="no-leaderboard">No scores yet</p>
            ) : (
              <div className="leaderboard-list">
                {leaderboard.slice(0, 10).map((entry, index) => (
                  <div
                    key={entry.user_id}
                    className={`leaderboard-entry ${user?.id === entry.user_id ? 'current-user' : ''}`}
                  >
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{entry.user_name || `User ${entry.user_id.slice(0, 8)}`}</span>
                    <span className="score">{entry.total_score}</span>
                    <span className="stats">
                      {entry.correct_answers}/{entry.total_answers} correct
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showResultPopup && resultData && (
        <QuestionResultPopup
          isOpen={showResultPopup}
          correctAnswer={resultData.correctAnswer}
          topAnswers={resultData.topAnswers}
          questionNumber={resultData.questionNumber}
          onClose={() => {
            setShowResultPopup(false);
            setResultData(null);
          }}
        />
      )}
    </div>
  );
}
