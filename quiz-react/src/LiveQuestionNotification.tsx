import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { environment } from './config/environment';
import { quizService, type Quiz, type QuizQuestion } from './services/quiz';
import { quizAuthService } from './services/auth';
import './LiveQuestionNotification.scss';

interface LiveQuestionData {
  quiz: Quiz;
  question: QuizQuestion;
  timeRemaining: number;
}

export default function LiveQuestionNotification() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [liveQuestionData, setLiveQuestionData] = useState<LiveQuestionData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const timeUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playedSoundForQuestionRef = useRef<string | null>(null); // Track which question we've played sound for

  const isQuizPage = location.pathname === '/quiz';
  const currentQuizId = searchParams.get('quizId');

  // Fetch quiz data when we have a quiz ID
  const fetchQuizData = async (quizId: string) => {
    try {
      const quiz = await quizService.getQuizById(quizId);
      return quiz;
    } catch (error) {
      return null;
    }
  };

  // Update time remaining every second
  const startTimeUpdate = () => {
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
    }

    timeUpdateIntervalRef.current = setInterval(() => {
      setLiveQuestionData((prev) => {
        if (!prev) {
          setIsVisible(false);
          return null;
        }

        // Check if question has actually ended by verifying its status
        // If time remaining is 0 or negative, hide the popup
        if (prev.timeRemaining <= 0) {
          setIsVisible(false);
          if (timeUpdateIntervalRef.current) {
            clearInterval(timeUpdateIntervalRef.current);
            timeUpdateIntervalRef.current = null;
          }
          return null;
        }

        const newRemaining = Math.max(0, prev.timeRemaining - 1);
        if (newRemaining === 0) {
          setIsVisible(false);
          if (timeUpdateIntervalRef.current) {
            clearInterval(timeUpdateIntervalRef.current);
            timeUpdateIntervalRef.current = null;
          }
          return null;
        }

        return {
          ...prev,
          timeRemaining: newRemaining,
        };
      });
    }, 1000);
  };

  useEffect(() => {
    // Helper to determine if we should show the notification (defined inside useEffect to capture current values)
    const shouldShowNotification = async (quizId: string): Promise<boolean> => {
      // If we're on quiz page and the quizId matches, don't show (user is already on that quiz)
      if (isQuizPage && currentQuizId === quizId) {
        return false;
      }

      // Check if user is banned - don't show notifications to banned users
      const user = quizAuthService.user;
      if (user) {
        try {
          const token = await quizAuthService.getIdToken();
          if (token) {
            const response = await fetch(`${environment.apiUrl}/user/${user.id}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            if (response.ok) {
              const userData = await response.json();
              if (userData.is_banned) {
                return false; // Don't show notifications to banned users
              }
            }
          }
        } catch (error) {
          // If check fails, allow notification (don't block legitimate users)
          console.warn('[LiveQuestionNotification] Failed to check user ban status:', error);
        }
      }

      // Show in all other cases (not on quiz page, or different quiz, or no quizId in URL)
      return true;
    };

    // Use direct Socket.IO connection (like Home page) to work without authentication
    const wsUrl = environment.wsUrl;
    if (!wsUrl) {
      console.error('[LiveQuestionNotification] wsUrl not configured');
      return;
    }

    const socketUrl = `${wsUrl}/quiz`;
    const socket: Socket = io(socketUrl, {
      transports: ['websocket'],
      upgrade: false,
    });

    socket.on('connect', () => {
      console.log('[LiveQuestionNotification] Socket connected');
    });

    // Listen for question-live events
    socket.on('question-live', async (data: { question: QuizQuestion; timeRemaining: number }) => {
      try {
        const quiz = await fetchQuizData(data.question.quiz_id);
        if (quiz && await shouldShowNotification(quiz.id)) {
          // Reset sound tracking for new question
          playedSoundForQuestionRef.current = null;
          setLiveQuestionData({
            quiz,
            question: data.question,
            timeRemaining: data.timeRemaining || 0,
          });
          setIsVisible(true);
          startTimeUpdate();

          // Play sound notification only when popup becomes visible
          // The sound will play when isVisible becomes true (handled in useEffect below)
        }
      } catch (error) {
        console.error('[LiveQuestionNotification] Error handling question-live:', error);
      }
    });

    // Listen for question-ended events to hide the popup
    socket.on('question-ended', (data: { quizId: string; questionId: string }) => {
      // Hide popup if it's for the current question
      setLiveQuestionData((prev) => {
        if (prev && prev.question.id === data.questionId) {
          setIsVisible(false);
          // Clear the interval
          if (timeUpdateIntervalRef.current) {
            clearInterval(timeUpdateIntervalRef.current);
            timeUpdateIntervalRef.current = null;
          }
          return null;
        }
        return prev;
      });
    });

    // Listen for quiz-status-changed events (quiz becomes live)
    socket.on('quiz-status-changed', async (data: { quizId: string; newStatus: string }) => {
      console.log('[LiveQuestionNotification] quiz-status-changed received:', data);
      if (data.newStatus === 'live') {
        try {
          const quiz = await fetchQuizData(data.quizId);
          const shouldShow = await shouldShowNotification(data.quizId);
          console.log('[LiveQuestionNotification] Fetched quiz:', quiz?.id, 'shouldShow:', shouldShow);
          if (quiz && shouldShow) {
            // Check if there's an active question
            const activeQuestion = await quizService.getCurrentActiveQuestion(data.quizId);
            if (activeQuestion && activeQuestion.status === 'live' && activeQuestion.is_active) {
              const timeLimit = activeQuestion.time_limit_seconds || 120;
              const startedAt = activeQuestion.started_at ? new Date(activeQuestion.started_at).getTime() : Date.now();
              const elapsed = Math.floor((Date.now() - startedAt) / 1000);
              const remaining = Math.max(0, timeLimit - elapsed);

              // Only show if question is actually live and has time remaining
              if (remaining > 0 && activeQuestion.status === 'live' && activeQuestion.is_active) {
                setLiveQuestionData({
                  quiz,
                  question: activeQuestion,
                  timeRemaining: remaining,
                });
                setIsVisible(true);
                startTimeUpdate();
              } else {
                // Question has ended or is not active, don't show popup
                setIsVisible(false);
                setLiveQuestionData(null);
              }
            } else {
              // No active question or question has ended - don't show popup
              setIsVisible(false);
              setLiveQuestionData(null);
            }
          }
        } catch (error) {
          console.error('[LiveQuestionNotification] Error handling quiz-status-changed:', error);
        }
      } else if (data.newStatus === 'draft' || data.newStatus === 'completed') {
        // Hide notification when quiz goes to draft or completed
        setIsVisible(false);
        setLiveQuestionData(null);
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
          timeUpdateIntervalRef.current = null;
        }
      }
    });

    // Initial check for live question (fallback)
    const checkInitialState = async () => {
      try {
        const activeQuizzes = await quizService.getActiveQuizzes();
        if (activeQuizzes && activeQuizzes.length > 0) {
          const quiz = activeQuizzes[0];
          if (await shouldShowNotification(quiz.id)) {
            const activeQuestion = await quizService.getCurrentActiveQuestion(quiz.id);
            if (activeQuestion) {
              const timeLimit = activeQuestion.time_limit_seconds || 120;
              const startedAt = activeQuestion.started_at ? new Date(activeQuestion.started_at).getTime() : Date.now();
              const elapsed = Math.floor((Date.now() - startedAt) / 1000);
              const remaining = Math.max(0, timeLimit - elapsed);

              if (remaining > 0) {
                setLiveQuestionData({
                  quiz,
                  question: activeQuestion,
                  timeRemaining: remaining,
                });
                setIsVisible(true);
                startTimeUpdate();
              }
            } else {
              // Quiz is live but no question yet
              setLiveQuestionData({
                quiz,
                question: {
                  id: '',
                  quiz_id: quiz.id,
                  order_index: 0,
                  question_type: 'voice_line',
                  time_limit_seconds: 0,
                  status: 'pending',
                  is_active: false,
                } as QuizQuestion,
                timeRemaining: 0,
              });
              setIsVisible(true);
            }
          }
        }
      } catch (error) {
        console.error('[LiveQuestionNotification] Error in checkInitialState:', error);
      }
    };

    checkInitialState();

    return () => {
      socket.disconnect();
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
      // Clean up audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isQuizPage, currentQuizId, navigate]);

  // Play sound when notification popup becomes visible (only for live questions)
  useEffect(() => {
    if (isVisible && liveQuestionData && liveQuestionData.question.id && liveQuestionData.timeRemaining > 0) {
      // Only play sound once per question (avoid replaying if popup stays visible)
      const questionId = liveQuestionData.question.id;
      if (playedSoundForQuestionRef.current === questionId) {
        return; // Already played sound for this question
      }

      // Mark that we've played sound for this question
      playedSoundForQuestionRef.current = questionId;

      // Only play sound when popup is actually visible and showing a live question
      const playSound = async () => {
        try {
          // Create new audio instance each time to ensure it plays
          const audio = new Audio('/sounds/question-live.mp3');
          audio.volume = 0.7; // Set volume to 70%

          // Set up error handling
          audio.onerror = (e) => {
            console.error('[LiveQuestionNotification] Audio error:', e);
            playedSoundForQuestionRef.current = null; // Reset to allow retry
          };

          // Play the sound
          await audio.play();
          console.log('[LiveQuestionNotification] Sound played for question:', questionId);

          // Store reference for cleanup
          audioRef.current = audio;
        } catch (error) {
          console.warn('[LiveQuestionNotification] Could not play sound:', error);
          // Reset the flag so we can try again
          playedSoundForQuestionRef.current = null;
        }
      };

      // Small delay to ensure popup is rendered and DOM is ready
      const timeoutId = setTimeout(() => {
        playSound();
      }, 200);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [isVisible, liveQuestionData]);

  const handleJoinQuiz = () => {
    if (liveQuestionData) {
      navigate(`/quiz?quizId=${liveQuestionData.quiz.id}`);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  // Don't show if we're on quiz page and it matches the current quiz
  if (!isVisible || !liveQuestionData || (isQuizPage && currentQuizId === liveQuestionData.quiz.id)) {
    return null;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="live-question-notification">
      <div className="notification-content">
        <div className="notification-header">
          <div className="live-indicator">
            <span className="pulse-dot"></span>
            <span className="live-text">LIVE</span>
          </div>
          <button className="dismiss-button" onClick={handleDismiss} aria-label="Dismiss">
            ×
          </button>
        </div>
        <div className="notification-body">
          <h3 className="notification-title">
            {liveQuestionData.question.id && liveQuestionData.timeRemaining > 0
              ? 'Question is Live!'
              : 'Contest is Live!'}
          </h3>
          <p className="notification-message">
            {liveQuestionData.question.id && liveQuestionData.timeRemaining > 0 ? (
              <>
                Question #{liveQuestionData.question.order_index + 1} from{' '}
                <strong>{liveQuestionData.quiz.name}</strong> is now active.
              </>
            ) : (
              <>
                <strong>{liveQuestionData.quiz.name}</strong> contest has started. Join now!
              </>
            )}
          </p>
          {liveQuestionData.question.id && liveQuestionData.timeRemaining > 0 && (
            <div className="time-remaining">
              <span className="time-label">Time Remaining:</span>
              <span className="time-value">{formatTime(liveQuestionData.timeRemaining)}</span>
            </div>
          )}
        </div>
        <div className="notification-footer">
          <button className="join-button" onClick={handleJoinQuiz}>
            JOIN CONTEST
          </button>
        </div>
      </div>
    </div>
  );
}

