import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Label, TextInput } from '@primer/react';
import { ArrowLeftIcon, DownloadIcon } from '@primer/octicons-react';
import { io } from 'socket.io-client';
import QuestionsTab from './QuestionsTab';
import LeaderboardTab from './LeaderboardTab';
import ErrorState from '../../components/ErrorState/ErrorState';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import { useToast } from '../../components/Toast/ToastContainer';
import { environment } from '../../config/environment';
import { getAuthHeaders } from '../../utils/api-client';
import { getHeroes } from '../../constants/heroes';
import './QuizDetail.scss';

const API_BASE_URL = environment.apiBaseUrl || 'http://localhost:3000';

interface Quiz {
  id: string;
  name: string;
  description?: string;
  scheduled_at?: string;
  status: 'draft' | 'live' | 'paused' | 'completed';
  auto_mode_enabled?: boolean;
  auto_mode_paused?: boolean;
  auto_mode_interval_seconds?: number;
  quiz_duration_minutes?: number;
  excluded_from_combined_leaderboard?: boolean;
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
  user_email?: string;
  total_score: number;
  total_answers: number;
  correct_answers: number;
  average_response_time: number;
}

interface HeroInfo {
  hero: string;
  url: string;
}

export default function QuizDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [heroes, setHeroes] = useState<HeroInfo[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const [autoModeEnabled, setAutoModeEnabled] = useState(false);
  const [autoModePaused, setAutoModePaused] = useState(false);
  const [autoModeInterval, setAutoModeInterval] = useState(120);
  const [quizDurationMinutes, setQuizDurationMinutes] = useState(60);
  const [isSavingAutoMode, setIsSavingAutoMode] = useState(false);
  const [nextQuestionTimeRemaining, setNextQuestionTimeRemaining] = useState<number | null>(null);
  const nextQuestionTimerRef = useRef<number | null>(null);
  const [excludedFromCombinedLeaderboard, setExcludedFromCombinedLeaderboard] = useState(false);

  useEffect(() => {
    if (id) {
      fetchQuiz();
      fetchQuestions();
      // Use local hero names instead of fetching from API
      setHeroes(getHeroes());
    }
  }, [id]);

  // Initialize WebSocket connection for real-time updates
  useEffect(() => {
    if (!id) return;

    const socketUrl = environment.apiBaseUrl;
    const newSocket = io(`${socketUrl}/quiz`, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      // Join the quiz room as admin
      newSocket.emit('join-quiz', {
        isAdmin: true, // Mark as admin client to receive admin-only events
        quizId: id,
        userId: 'admin', // Admin identifier
      });
    });

    newSocket.on('question-live', (data: { question: QuizQuestion; timeRemaining: number }) => {
      setTimeRemaining(data.timeRemaining);
      fetchQuestions(); // Refresh questions list
    });

    newSocket.on('question-ended', () => {
      setTimeRemaining(null);
      fetchQuestions(); // Refresh questions list
    });

    newSocket.on('quiz-status-changed', (data: { quizId: string; newStatus: string }) => {
      // Quiz status changed - refresh quiz data
      if (data.quizId === id) {
        fetchQuiz();
        // If quiz was set to draft, refresh questions to reflect ended live questions
        // Also refresh when status changes to ensure auto mode state is updated
        if (data.newStatus === 'draft' || data.newStatus === 'live') {
          fetchQuestions();
        }
      }
    });

    newSocket.on('leaderboard-updated', () => {
      // Leaderboard updated - refresh leaderboard
      fetchLeaderboard();
    });

    // Listen for quiz-updated event (emitted when quiz data changes, including auto mode)
    newSocket.on('quiz-updated', (data: { quizId: string }) => {
      if (data.quizId === id) {
        // Refresh quiz data to get latest auto_mode_enabled and other fields
        fetchQuiz();
        fetchQuestions();
      }
    });

    // Listen for next question time updates via WebSocket (replaces HTTP polling)
    newSocket.on('next-question-time', (data: { quizId: string; nextActivationTime: string | null; timeRemaining: number | null }) => {
      if (data.quizId === id) {
        if (data.timeRemaining !== null && data.timeRemaining !== undefined) {
          setNextQuestionTimeRemaining(data.timeRemaining);
        } else {
          setNextQuestionTimeRemaining(null);
        }
      }
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

  // Timer countdown for remaining time - calculate from started_at to stay in sync
  useEffect(() => {
    const activeQuestion = questions?.find(q => q && q.is_active && q.status === 'live') || null;
    
    if (!activeQuestion || !activeQuestion.started_at || !activeQuestion.time_limit_seconds) {
      setTimeRemaining(null);
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    // Calculate time remaining from started_at timestamp (stays in sync)
    const updateTimeRemaining = () => {
      const startedAt = new Date(activeQuestion.started_at!).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - startedAt) / 1000);
      const remaining = Math.max(0, activeQuestion.time_limit_seconds! - elapsed);
      setTimeRemaining(remaining);
      
      if (remaining <= 0) {
        if (timerIntervalRef.current !== null) {
          window.clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      }
    };

    // Update immediately
    updateTimeRemaining();

    // Update every second
    timerIntervalRef.current = window.setInterval(updateTimeRemaining, 1000);

    return () => {
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [questions]);

  useEffect(() => {
    fetchLeaderboard();
  }, [id]);

  // Timer for next question countdown - now uses WebSocket updates
  // The countdown is updated via WebSocket events, we just decrement locally
  useEffect(() => {
    if (!id || !autoModeEnabled || autoModePaused) {
      setNextQuestionTimeRemaining(null);
      if (nextQuestionTimerRef.current !== null) {
        window.clearInterval(nextQuestionTimerRef.current);
        nextQuestionTimerRef.current = null;
      }
      return;
    }

    // Decrement countdown every second (WebSocket provides the base value)
    nextQuestionTimerRef.current = window.setInterval(() => {
      setNextQuestionTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          return null; // Set to null instead of 0 to hide the display
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (nextQuestionTimerRef.current !== null) {
        window.clearInterval(nextQuestionTimerRef.current);
        nextQuestionTimerRef.current = null;
      }
    };
  }, [id, autoModeEnabled, autoModePaused]);

  const fetchQuiz = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${id}`, { headers });
      if (response.ok) {
        const data = await response.json();
        // Validate quiz data
        if (data && data.id) {
          setQuiz(data);
          setAutoModeEnabled(data.auto_mode_enabled || false);
          setAutoModePaused(data.auto_mode_paused || false);
          setAutoModeInterval(data.auto_mode_interval_seconds || 120);
          setQuizDurationMinutes(data.quiz_duration_minutes || 60);
          setExcludedFromCombinedLeaderboard(data.excluded_from_combined_leaderboard || false);
        } else {
          console.error('Invalid quiz data received');
        }
      }
    } catch (error) {
      // Error fetching quiz
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${id}/questions`, { headers });
      if (response.ok) {
        const data = await response.json();
        // Validate data is an array
        if (Array.isArray(data)) {
          setQuestions(data);
        } else {
          setQuestions([]);
        }
        
        // Update time remaining for active question
        const activeQuestion = Array.isArray(data) ? data.find((q: QuizQuestion) => q && q.is_active && q.status === 'live') : null;
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
      // Error fetching questions
    }
  };

  // Removed fetchHeroes - now using local hero names from constants

  const fetchLeaderboard = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${id}/leaderboard`, { headers });
      if (response.ok) {
        const data = await response.json();
        // Validate data is an array
        if (Array.isArray(data)) {
          setLeaderboard(data);
        } else {
          setLeaderboard([]);
        }
      }
    } catch (error) {
      // Error fetching leaderboard
    }
  };

  const handleViewAnswers = (questionId: string) => {
    navigate(`/quizzes/${id}/questions/${questionId}/answers`);
  };


  const handleDownloadAnswersCSV = async () => {
    if (!id) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${id}/answers`, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch answers');
      }

      const answers = await response.json();

      if (answers.length === 0) {
        addToast({
          type: 'warning',
          title: 'No Data',
          message: 'No answer data available to download.',
          duration: 3000,
        });
        return;
      }

      // Create CSV header
      const csvHeaders = [
        'Answer ID',
        'User ID',
        'User Name',
        'User Email',
        'Question ID',
        'Answer',
        'Is Correct',
        'Score',
        'Response Time (s)',
        'Attempt Count',
        'Submitted At',
      ];

      // Create CSV rows (with validation)
      const rows = (Array.isArray(answers) ? answers : []).map((answer: any) => [
        answer?.id || '',
        answer?.user_id || '',
        answer?.user_name || '',
        answer?.user_email || '',
        answer?.question_id || '',
        answer?.answer || '',
        answer?.is_correct ? 'Yes' : 'No',
        answer?.score?.toString() || '0',
        answer?.response_time ? ((answer.response_time / 1000).toFixed(2)) : '',
        answer?.attempt_count?.toString() || '1',
        answer?.submitted_at || '',
      ]);

      // Combine headers and rows
      const csvContent = [
        csvHeaders.join(','),
        ...rows.map((row: any[]) => row.map((cell: any) => {
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','))
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      const safeQuizName = quiz?.name ? quiz.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() : `quiz-${id}`;
      link.setAttribute('download', `${safeQuizName}-answers-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast({
        type: 'success',
        title: 'CSV Downloaded',
        message: `Successfully downloaded ${answers.length} answer${answers.length > 1 ? 's' : ''}.`,
        duration: 3000,
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Download Failed',
        message: 'Failed to download answers. Please try again.',
        duration: 3000,
      });
    }
  };

  const handleQuizStatusChange = async (newStatus: 'draft' | 'live' | 'completed') => {
    if (!id || !quiz || isTogglingStatus) return;

    setIsTogglingStatus(true);
    try {
      // Updating quiz status
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const updatedQuiz = await response.json();
        // Quiz updated successfully
        setQuiz(updatedQuiz);
        
        // If quiz was set to draft, refresh questions to reflect ended live questions
        if (newStatus === 'draft') {
          await fetchQuestions();
        }
      } else {
        const errorText = await response.text();
        addToast({
          type: 'error',
          title: 'Update Failed',
          message: `Failed to update quiz status: ${errorText}`,
          duration: 5000,
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: `Failed to update quiz status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 5000,
      });
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Calculate minimum required quiz duration based on question time limits
  const calculateMinimumQuizDuration = () => {
    if (questions.length === 0) {
      return 0;
    }
    // Sum of all question time limits + 5 seconds per question for intervals
    const totalQuestionTime = questions.reduce((sum, q) => sum + (q.time_limit_seconds || 0), 0);
    const intervalBuffer = questions.length * 5; // 5 seconds per question
    return Math.ceil((totalQuestionTime + intervalBuffer) / 60); // Convert to minutes
  };

  // Calculate total quiz runtime including intervals
  const calculateTotalQuizRuntime = () => {
    if (questions.length === 0 || !autoModeEnabled) {
      return 0;
    }
    // Total question time + intervals between questions
    const totalQuestionTime = questions.reduce((sum, q) => sum + (q.time_limit_seconds || 0), 0);
    const totalIntervalTime = questions.length > 0 ? (questions.length - 1) * autoModeInterval : 0;
    return totalQuestionTime + totalIntervalTime;
  };

  // Calculate interval for a given duration (helper function)
  const calculateAutoIntervalForDuration = (durationMinutes: number) => {
    if (questions.length === 0 || durationMinutes <= 0) {
      return 120; // Default 2 minutes
    }
    
    // Calculate total question time
    const totalQuestionTime = questions.reduce((sum, q) => sum + (q.time_limit_seconds || 0), 0);
    const totalQuestionTimeSeconds = totalQuestionTime;
    
    // Total runtime = durationMinutes (in seconds)
    const totalRuntimeSeconds = durationMinutes * 60;
    
    // Total runtime = total question time + intervals
    // So: intervals = total runtime - total question time
    const totalIntervalTimeSeconds = totalRuntimeSeconds - totalQuestionTimeSeconds;
    
    // Distribute intervals between questions (n-1 intervals for n questions)
    const numberOfIntervals = questions.length > 1 ? questions.length - 1 : 1;
    const intervalSeconds = totalIntervalTimeSeconds / numberOfIntervals;
    
    // Round to nearest integer to ensure total runtime matches exactly
    // Use Math.round instead of Math.floor to minimize rounding error
    return Math.max(10, Math.round(intervalSeconds)); // Minimum 10 seconds, rounded to nearest second
  };

  // Calculate interval automatically based on quiz duration (total runtime) and number of questions
  // Quiz duration represents total runtime (questions + intervals)
  const calculateAutoInterval = () => {
    return calculateAutoIntervalForDuration(quizDurationMinutes);
  };

  const handleCalculate = () => {
    // Only calculate and update local state, don't save
    // Recalculate interval based on current quiz duration
    const calculatedInterval = calculateAutoInterval();
    setAutoModeInterval(calculatedInterval);
    
    // Show calculated interval in a toast
    addToast({
      type: 'info',
      title: 'Interval Calculated',
      message: `Interval set to ${Math.floor(calculatedInterval / 60)}:${(calculatedInterval % 60).toString().padStart(2, '0')} (${calculatedInterval}s) between questions`,
      duration: 3000,
    });
  };

  const handleSaveAutoMode = async () => {
    await handleSaveAutoModeWithDuration();
  };

  const handleToggleAutoMode = () => {
    // Only update local state, don't save yet
    const newAutoModeState = !autoModeEnabled;

    // Validate: Auto mode can only be enabled if quiz is live
    if (newAutoModeState && quiz?.status !== 'live') {
      addToast({
        type: 'warning',
        title: 'Quiz Must Be Live',
        message: 'Auto mode can only be enabled when the quiz status is "live". Please set the quiz to live first.',
        duration: 5000,
      });
      return;
    }

    // Update local state only
    setAutoModeEnabled(newAutoModeState);
    if (!newAutoModeState) {
      setAutoModePaused(false);
    }
  };

  const handleSaveAutoModeWithDuration = async (intervalSeconds?: number, pausedState?: boolean) => {
    if (!id || isSavingAutoMode) return;

    const intervalToSave = intervalSeconds !== undefined ? intervalSeconds : autoModeInterval;
    const pausedToSave = pausedState !== undefined ? pausedState : autoModePaused;

    // Validate interval
    if (intervalToSave < 10 || intervalToSave > 3600) {
      addToast({
        type: 'warning',
        title: 'Invalid Interval',
        message: 'Interval must be between 10 and 3600 seconds',
        duration: 3000,
      });
      return;
    }

    // Validate quiz duration - must be at least the minimum required time
    const minDuration = calculateMinimumQuizDuration();
    if (quizDurationMinutes < minDuration || quizDurationMinutes > 600) {
      addToast({
        type: 'warning',
        title: 'Invalid Duration',
        message: `Quiz duration must be at least ${minDuration} minutes (based on question time limits + 5s per question) and not more than 600 minutes`,
        duration: 5000,
      });
      return;
    }

    setIsSavingAutoMode(true);
    try {
      const headers = await getAuthHeaders();
      
      // Prepare update payload - include auto_mode_enabled state
      const updatePayload: any = {
        auto_mode_enabled: autoModeEnabled, // Save the current enabled state
        auto_mode_paused: pausedToSave,
        auto_mode_interval_seconds: intervalToSave,
        quiz_duration_minutes: quizDurationMinutes,
      };
      
      // If disabling auto mode, also reset pause state
      if (!autoModeEnabled) {
        updatePayload.auto_mode_paused = false;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${id}`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      if (response.ok) {
        const updatedQuiz = await response.json();
        setQuiz(updatedQuiz);
        setAutoModeInterval(intervalToSave);
        setAutoModePaused(pausedToSave);
        // Sync enabled state from server response
        if (updatedQuiz.auto_mode_enabled !== undefined) {
          setAutoModeEnabled(updatedQuiz.auto_mode_enabled);
        }
        
        addToast({
          type: 'success',
          title: 'Auto Mode Saved',
          message: `Auto mode ${autoModeEnabled ? 'enabled' : 'disabled'} and settings saved successfully`,
          duration: 3000,
        });
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to update auto mode' }));
        addToast({
          type: 'error',
          title: 'Update Failed',
          message: errorData.message,
          duration: 5000,
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: `Failed to update auto mode: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 5000,
      });
    } finally {
      setIsSavingAutoMode(false);
    }
  };

  const handleStartNextQuestion = async () => {
    if (!id || !autoModeEnabled) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${id}/auto-mode/start-next-question`, {
        method: 'POST',
        headers,
      });

      if (response.ok) {
        const result = await response.json();
        addToast({
          type: 'success',
          title: 'Next Question Started',
          message: result.message || 'Next question has been started successfully',
          duration: 3000,
        });
        // Refresh questions to show the new active question
        fetchQuestions();
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to start next question' }));
        addToast({
          type: 'error',
          title: 'Error',
          message: errorData.message || 'Failed to start next question',
          duration: 5000,
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error',
        message: `Failed to start next question: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 5000,
      });
    }
  };



  if (loading) {
    return (
      <div className="quiz-detail-page">
        <LoadingSpinner message="Loading quiz..." fullPage />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="quiz-detail-page">
        <ErrorState
          title="Quiz not found"
          message="The quiz you're looking for doesn't exist or has been removed."
          actionLabel="Back to Quizzes"
          onAction={() => navigate('/quizzes')}
        />
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
              onClick={handleDownloadAnswersCSV}
              leadingVisual={DownloadIcon}
            >
              Download Answers CSV
            </Button>
            <select
              value={quiz.status}
              onChange={(e) => handleQuizStatusChange(e.target.value as 'draft' | 'live' | 'completed')}
              disabled={isTogglingStatus}
              style={{ 
                minWidth: 150, 
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--color-border-default, #30363d)',
                backgroundColor: 'var(--color-canvas-default, #0d1117)',
                color: 'var(--color-fg-default, #f0f6fc)',
                fontSize: '14px',
                cursor: isTogglingStatus ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="draft">Draft</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
            </select>
            <Label variant={quiz.status === 'live' ? 'success' : quiz.status === 'completed' ? 'secondary' : quiz.status === 'paused' ? 'attention' : 'secondary'}>
              {quiz.status}
            </Label>
          </div>
        </div>
        <div className="auto-mode-controls">
            <div className="auto-mode-toggle">
              <input
                type="checkbox"
                id="auto-mode-enabled"
                checked={autoModeEnabled}
                readOnly
                disabled
                style={{ cursor: 'default' }}
              />
              <label 
                htmlFor="auto-mode-enabled" 
                style={{ 
                  marginLeft: '8px', 
                  cursor: 'default',
                  color: '#f0f6fc',
                }}
              >
                Auto Mode {autoModeEnabled ? '(Enabled)' : '(Disabled)'}
              </label>
            </div>
            {autoModeEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px', paddingLeft: '12px', borderLeft: '1px solid rgba(31, 111, 235, 0.3)' }}>
                <Button
                  size="small"
                  variant={autoModePaused ? 'primary' : 'default'}
                  onClick={async () => {
                    const newPausedState = !autoModePaused;
                    setAutoModePaused(newPausedState);
                    await handleSaveAutoModeWithDuration(autoModeInterval, newPausedState);
                  }}
                  disabled={isSavingAutoMode}
                >
                  {autoModePaused ? 'Resume' : 'Pause'}
                </Button>
                {!autoModePaused && (
                  <Button
                    size="small"
                    variant="primary"
                    onClick={handleStartNextQuestion}
                    disabled={isSavingAutoMode}
                    title="Manually start the next question (bypasses timing)"
                  >
                    Start Next Question
                  </Button>
                )}
                {autoModePaused && (
                  <span style={{ color: '#f0f6fc', fontSize: '13px' }}>Paused</span>
                )}
                {autoModeEnabled && !autoModePaused && nextQuestionTimeRemaining !== null && nextQuestionTimeRemaining > 0 && (
                  <span style={{ color: '#58a6ff', fontSize: '13px', marginLeft: '8px' }}>
                    Next Question: {Math.floor(nextQuestionTimeRemaining / 60)}:{(nextQuestionTimeRemaining % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
              <Button
                size="small"
                variant={autoModeEnabled ? 'danger' : 'primary'}
                onClick={handleToggleAutoMode}
                disabled={isSavingAutoMode || (quiz?.status !== 'live' && !autoModeEnabled)}
                title={autoModeEnabled ? 'Click Save to apply changes' : 'Click Save to apply changes'}
              >
                {autoModeEnabled ? 'Turn Off Auto Mode' : 'Turn On Auto Mode'}
              </Button>
            </div>
            {autoModeEnabled && (
              <div className="auto-mode-interval">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <label htmlFor="quiz-duration" style={{ marginRight: '8px', color: '#f0f6fc', fontSize: '13px' }}>
                    Total Quiz Runtime (minutes):
                  </label>
                  <TextInput
                    id="quiz-duration"
                    type="number"
                    value={quizDurationMinutes}
                    onChange={(e) => {
                      const newDuration = parseInt(e.target.value) || 60;
                      setQuizDurationMinutes(newDuration);
                      // Auto-recalculate interval when duration changes
                      if (questions.length > 0 && newDuration > 0) {
                        const newInterval = calculateAutoIntervalForDuration(newDuration);
                        setAutoModeInterval(newInterval);
                      }
                    }}
                    min={calculateMinimumQuizDuration() || 1}
                    max={600}
                    disabled={isSavingAutoMode}
                    style={{ width: '80px', marginRight: '8px' }}
                    title={`Minimum: ${calculateMinimumQuizDuration()} minutes (based on question time limits + 5s per question)`}
                  />
                  <Button
                    size="small"
                    onClick={handleCalculate}
                    disabled={isSavingAutoMode || questions.length === 0}
                    title={questions.length === 0 ? 'Add questions first' : `Calculate interval: ${Math.floor(calculateAutoInterval() / 60)}:${(calculateAutoInterval() % 60).toString().padStart(2, '0')} per question`}
                  >
                    Calculate
                  </Button>
                </div>
                <div style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#0d1117', borderRadius: '4px', border: '1px solid #30363d' }}>
                  <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '4px' }}>
                    Minimum Runtime: {calculateMinimumQuizDuration()} minutes
                  </div>
                  {autoModeEnabled && questions.length > 0 && (
                    <>
                      <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '4px' }}>
                        Interval Between Questions: {Math.floor(autoModeInterval / 60)}:{(autoModeInterval % 60).toString().padStart(2, '0')} ({autoModeInterval}s)
                      </div>
                      <div style={{ fontSize: '12px', color: '#58a6ff', fontWeight: 'bold' }}>
                        Calculated Total Runtime: {Math.floor(calculateTotalQuizRuntime() / 60)}:{(calculateTotalQuizRuntime() % 60).toString().padStart(2, '0')} ({Math.floor(calculateTotalQuizRuntime() / 60)} min {calculateTotalQuizRuntime() % 60}s)
                      </div>
                      {Math.abs(calculateTotalQuizRuntime() / 60 - quizDurationMinutes) > 0.1 && (
                        <div style={{ fontSize: '12px', color: '#f85149', marginTop: '4px' }}>
                          ⚠️ Runtime mismatch: Set duration ({quizDurationMinutes} min) vs Calculated ({Math.floor(calculateTotalQuizRuntime() / 60)} min {calculateTotalQuizRuntime() % 60}s). Click Calculate to sync.
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="auto-mode-interval" style={{ marginRight: '8px', color: '#f0f6fc', fontSize: '13px' }}>
                    Interval: {Math.floor(autoModeInterval / 60)}:{(autoModeInterval % 60).toString().padStart(2, '0')} ({autoModeInterval}s)
                  </label>
                  <Button
                    size="small"
                    onClick={handleSaveAutoMode}
                    disabled={isSavingAutoMode}
                  >
                    {isSavingAutoMode ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            )}
        </div>
        <div className="quiz-settings-section">
          <h3 className="settings-section-title">Leaderboard Settings</h3>
          <div className="setting-item">
            <label htmlFor="exclude-from-combined" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                id="exclude-from-combined"
                checked={!excludedFromCombinedLeaderboard} // Inverted: checked = included
                onChange={async (e) => {
                  const newValue = !e.target.checked; // Invert: unchecked = excluded
                  setExcludedFromCombinedLeaderboard(newValue);
                  
                  // Save immediately
                  try {
                    const headers = await getAuthHeaders();
                    const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${id}`, {
                      method: 'PUT',
                      headers,
                      body: JSON.stringify({ excluded_from_combined_leaderboard: newValue }),
                    });

                    if (response.ok) {
                      const updatedQuiz = await response.json();
                      setQuiz(updatedQuiz);
                      addToast({
                        type: 'success',
                        title: 'Settings Updated',
                        message: `Quiz ${newValue ? 'excluded from' : 'included in'} combined leaderboard`,
                        duration: 3000,
                      });
                    } else {
                      // Revert on error
                      setExcludedFromCombinedLeaderboard(!newValue);
                      const errorText = await response.text();
                      addToast({
                        type: 'error',
                        title: 'Update Failed',
                        message: `Failed to update setting: ${errorText}`,
                        duration: 5000,
                      });
                    }
                  } catch (error) {
                    // Revert on error
                    setExcludedFromCombinedLeaderboard(!newValue);
                    addToast({
                      type: 'error',
                      title: 'Update Failed',
                      message: `Failed to update setting: ${error instanceof Error ? error.message : 'Unknown error'}`,
                      duration: 5000,
                    });
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ color: '#f0f6fc', fontSize: '14px' }}>
                Included in Combined Leaderboard
              </span>
            </label>
            <p style={{ color: '#8b949e', fontSize: '12px', marginTop: '4px', marginLeft: '28px' }}>
              When unchecked, this quiz's answers will not appear in the combined leaderboard, but will still appear in this quiz's individual leaderboard.
            </p>
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
                const headers = await getAuthHeaders();
                const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/questions/${activeQuestion.id}/end`, {
                  method: 'POST',
                  headers,
                });
                if (response.ok) {
                  fetchQuestions();
                }
              } catch (error) {
                // Error ending question
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
                heroes={heroes}
              />
            </div>
          )}
          {selectedTabIndex === 1 && (
            <div role="tabpanel">
              <LeaderboardTab leaderboard={leaderboard} quizId={id!} quizName={quiz?.name} onRefresh={fetchLeaderboard} />
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

