import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { quizService, type Quiz, type QuizQuestion, type LeaderboardEntry } from '../../services/quiz';
import { quizAuthService, type AuthUser } from '../../services/auth';
import { webSocketService } from '../../services/websocket';
import { environment } from '../../config/environment';
import QuestionResultPopup, { type TopAnswer } from '../../components/QuestionResultPopup/QuestionResultPopup';
import ErrorState from '../../components/ErrorState/ErrorState';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import ToastContainer, { useToast } from '../../components/Toast/ToastContainer';
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
  const { toasts, addToast, removeToast } = useToast();
  
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizId, setQuizId] = useState<string | null>(quizIdFromParams);
  const shownToastsRef = useRef<Set<string>>(new Set());
  const [questionState, setQuestionState] = useState<QuestionState>({
    question: null,
    timeRemaining: 0,
    isActive: false,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [submissionResult, setSubmissionResult] = useState<{
    is_correct: boolean;
    score: number;
    message: string;
    attempt_count?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [canParticipate, setCanParticipate] = useState<boolean | null>(null); // Whether user can submit answers (null = checking)
  const [resultData, setResultData] = useState<{
    correctAnswer: string;
    topAnswers: TopAnswer[];
    questionNumber: number;
  } | null>(null);
  const [userAnswerState, setUserAnswerState] = useState<{
    answer: string;
    isCorrect: boolean;
    score: number;
    attemptCount: number;
    attemptsExhausted: boolean;
  } | null>(null);

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousConnectedRef = useRef<boolean | null>(null);
  const questionStartTimeRef = useRef<number | null>(null);
  const fetchingQuizDataRef = useRef<boolean>(false);
  const fetchedQuizIdRef = useRef<string | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch quiz data function - can be called from anywhere
  const fetchQuizData = useCallback(async (targetQuizId?: string) => {
    const idToFetch = targetQuizId || quizId;
    if (!idToFetch) return;

    // Prevent duplicate concurrent fetches
    if (fetchingQuizDataRef.current && fetchedQuizIdRef.current === idToFetch) {
      return;
    }

    fetchingQuizDataRef.current = true;
    fetchedQuizIdRef.current = idToFetch;

    try {
      setError(null);

      const [quizData, questions, leaderboardData] = await Promise.all([
        quizService.getQuizById(idToFetch),
        quizService.getQuizQuestions(idToFetch),
        quizService.getQuizLeaderboard(idToFetch),
      ]);

      // Validate all data is present
      if (!quizData) {
        throw new Error('Contest data not found');
      }
      if (!Array.isArray(questions)) {
        throw new Error('Invalid questions data');
      }
      if (!Array.isArray(leaderboardData)) {
        throw new Error('Invalid leaderboard data');
      }

      setQuiz(quizData);
      setLeaderboard(leaderboardData || []);

      // Check if user can participate (if quiz has email restrictions)
      if (quizData.has_email_restriction && user) {
        // Fetch quiz with auth token to check access
        try {
          const token = await quizAuthService.getIdToken();
          const quizResponse = await fetch(`${environment.apiUrl}/quiz/${idToFetch}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (quizResponse.ok) {
            const fullQuizData = await quizResponse.json();
            // Explicitly check can_participate - default to false if not explicitly true
            setCanParticipate(fullQuizData.can_participate === true);
          } else {
            setCanParticipate(false); // Assume read-only if check fails
          }
        } catch {
          setCanParticipate(false); // Assume read-only if check fails
        }
      } else if (quizData.has_email_restriction && !user) {
        // Quiz has restrictions but user is not logged in
        setCanParticipate(false);
      } else {
        setCanParticipate(true); // No restrictions
      }

      // Check if quiz is still live - if not, show error and schedule redirect
      if (quizData.status !== 'live') {
        setError('No GUESS THE HERO contests are live at the moment. Please check back later.');
        // Schedule redirect to quiz-info page after 3 seconds
        if (redirectTimerRef.current) {
          clearTimeout(redirectTimerRef.current);
        }
        redirectTimerRef.current = setTimeout(() => {
          navigate('/quiz-info');
        }, 3000);
        setQuestionState({
          question: null,
          timeRemaining: 0,
          isActive: false,
        });
        return;
      }

      // Find active question (with null safety)
      const activeQuestion = questions?.find(q => q && q.is_active && q.status === 'live') || null;
      if (activeQuestion) {
        const timeLimit = activeQuestion.time_limit_seconds || 120;
        const startedAt = activeQuestion.started_at ? new Date(activeQuestion.started_at).getTime() : Date.now();
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const remaining = Math.max(0, timeLimit - elapsed);

        setQuestionState((prev) => {
          // Only update if this is a new question or we don't have one active
          if (!prev.question || prev.question.id !== activeQuestion.id) {
            return {
              question: activeQuestion,
              timeRemaining: remaining,
              isActive: remaining > 0,
            };
          }
          // If same question, just update time remaining
          return {
            ...prev,
            timeRemaining: remaining,
            isActive: remaining > 0,
          };
        });
        questionStartTimeRef.current = startedAt;

        // Fetch user's answer for this question if user is logged in
        if (user && authInitialized) {
          try {
            const userAnswerData = await quizService.getUserAnswer(activeQuestion.id);
            if (userAnswerData.hasAnswer && userAnswerData.answer) {
              // Use the same submissionResult state that's used when answering
              setSubmissionResult({
                is_correct: userAnswerData.answer.is_correct || false,
                score: userAnswerData.answer.score || 0,
                message: userAnswerData.answer.is_correct ? 'Correct!' : 'Incorrect',
                attempt_count: userAnswerData.answer.attempt_count || 0,
              });
              setUserAnswerState({
                answer: userAnswerData.answer.answer,
                isCorrect: userAnswerData.answer.is_correct || false,
                score: userAnswerData.answer.score || 0,
                attemptCount: userAnswerData.answer.attempt_count || 0,
                attemptsExhausted: userAnswerData.attemptsExhausted,
              });
              setAnswer(userAnswerData.answer.answer);
              setSubmitted(true);
              setAttemptCount(userAnswerData.answer.attempt_count || 0);
            } else {
              setUserAnswerState(null);
              setSubmissionResult(null);
              setAnswer('');
              setSubmitted(false);
              setAttemptCount(0);
            }
          } catch (error) {
            // Silently fail - user might not have answered yet
            setUserAnswerState(null);
            setSubmissionResult(null);
            setAnswer('');
            setSubmitted(false);
            setAttemptCount(0);
          }
        } else {
          setUserAnswerState(null);
          setSubmissionResult(null);
          setAnswer('');
          setSubmitted(false);
          setAttemptCount(0);
        }
      } else {
        // No active question - clear answer state
        setUserAnswerState(null);
        setAnswer('');
        setSubmitted(false);
        setAttemptCount(0);
      }
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load contest data');
    } finally {
      fetchingQuizDataRef.current = false;
    }
  }, [quizId, user, authInitialized]);

  // Initialize authentication - ProtectedRoute handles redirect, we just need to wait for auth state
  useEffect(() => {
    let isInitialized = false;
    
    const unsubscribe = quizAuthService.subscribe((authUser) => {
      setUser(authUser);
      // Mark as initialized after first auth check
      if (!isInitialized) {
        isInitialized = true;
        setAuthInitialized(true);
      }
    });

    return unsubscribe;
  }, []);

  // Sync quizId with URL params - update state if URL param changes (e.g., on refresh)
  useEffect(() => {
    if (quizIdFromParams && quizIdFromParams !== quizId) {
      setQuizId(quizIdFromParams);
    } else if (!quizIdFromParams && quizId) {
      // If URL param is missing but we have quizId in state, update URL
      // Use replace: true to avoid adding to history and prevent loops
      navigate(`/quiz?quizId=${quizId}`, { replace: true });
    }
    // Only depend on quizIdFromParams to avoid loops when quizId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizIdFromParams]);

  // Use global WebSocket service - connection persists across pages
  useEffect(() => {
    if (!quizId || !user || !authInitialized) return;

    // Update connection status only if it actually changed
    const currentConnected = webSocketService.connected;
    if (previousConnectedRef.current !== currentConnected) {
      setConnected(currentConnected);
      previousConnectedRef.current = currentConnected;
    }

    // Subscribe to connection status changes
    const unsubscribeConnected = webSocketService.on('connected', () => {
      setConnected(true);
      // Join quiz room when connected
      if (quizId) {
        webSocketService.joinQuiz(quizId);
      }
    });

    const unsubscribeDisconnected = webSocketService.on('disconnected', () => {
      setConnected(false);
    });

    // Join quiz room if already connected
    if (webSocketService.connected) {
      webSocketService.joinQuiz(quizId);
    }

    // Subscribe to quiz events
    const unsubscribeJoinedQuiz = webSocketService.on('joined-quiz', () => {
      // Joined quiz
    });

    const unsubscribeQuestionLive = webSocketService.on('question-live', async (data: { question: QuizQuestion; timeRemaining: number }) => {
      // Reset fetching flag when new question starts to allow refetch if needed
      if (fetchedQuizIdRef.current !== quizId) {
        fetchedQuizIdRef.current = null;
      }
      setQuestionState({
        question: data.question,
        timeRemaining: data.timeRemaining,
        isActive: true,
      });
      
      // Note: Sound is only played in LiveQuestionNotification component when popup is visible
      
      // Fetch user's answer for this question if user is logged in
      if (user && authInitialized && data.question) {
        try {
          const userAnswerData = await quizService.getUserAnswer(data.question.id);
          if (userAnswerData.hasAnswer && userAnswerData.answer) {
            // Use the same submissionResult state that's used when answering
            setSubmissionResult({
              is_correct: userAnswerData.answer.is_correct || false,
              score: userAnswerData.answer.score || 0,
              message: userAnswerData.answer.is_correct ? 'Correct!' : 'Incorrect',
              attempt_count: userAnswerData.answer.attempt_count || 0,
            });
            setUserAnswerState({
              answer: userAnswerData.answer.answer,
              isCorrect: userAnswerData.answer.is_correct || false,
              score: userAnswerData.answer.score || 0,
              attemptCount: userAnswerData.answer.attempt_count || 0,
              attemptsExhausted: userAnswerData.attemptsExhausted,
            });
            setAnswer(userAnswerData.answer.answer);
            setSubmitted(true);
            setAttemptCount(userAnswerData.answer.attempt_count || 0);
          } else {
            setUserAnswerState(null);
            setSubmissionResult(null);
            setAnswer('');
            setSubmitted(false);
            setAttemptCount(0);
          }
        } catch (error) {
          // Silently fail - user might not have answered yet
          setUserAnswerState(null);
          setSubmissionResult(null);
          setAnswer('');
          setSubmitted(false);
          setAttemptCount(0);
        }
      } else {
        setSubmitted(false);
        setSubmitting(false);
        setSubmissionResult(null);
        setAttemptCount(0);
        setAnswer('');
        setUserAnswerState(null);
      }
      
      // Use the server's started_at timestamp, not the current time
      // This ensures accurate response time calculation
      questionStartTimeRef.current = data.question?.started_at 
        ? new Date(data.question.started_at).getTime() 
        : Date.now();
    });

    const unsubscribeQuestionEnded = webSocketService.on('question-ended', async (data: { question: QuizQuestion }) => {
      setQuestionState((prev) => ({
        ...prev,
        isActive: false,
        timeRemaining: 0,
      }));
      setSubmitting(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      // Fetch top 3 fastest correct answers and show popup
      try {
        const topAnswers = await quizService.getTopAnswers(data.question?.id || '');
        setResultData({
          correctAnswer: data.question?.correct_answer_hero || 'Unknown',
          topAnswers: (topAnswers || []).map(a => ({
            user_name: a?.user_name || 'Unknown',
            response_time: a?.response_time || 0,
            score: a?.score || 0,
            position: a?.position || 0,
          })),
          questionNumber: (data.question.order_index || 0) + 1,
        });
        setShowResultPopup(true);
      } catch (error) {
        // Still show popup with just correct answer
        setResultData({
          correctAnswer: data.question.correct_answer_hero || 'Unknown',
          topAnswers: [],
          questionNumber: (data.question.order_index || 0) + 1,
        });
        setShowResultPopup(true);
      }
    });

    // Answer submission is now handled via API, not Socket.IO
    // Removed answer-submitted listener

    const unsubscribeAnswerRejected = webSocketService.on('answer-rejected', (data: { message: string }) => {
      // Clear submitting state
      setSubmitting(false);
      
      // Prevent duplicate toasts - use message as key to prevent duplicates from error handler too
      const toastKey = data.message;
      if (shownToastsRef.current.has(toastKey)) {
        return;
      }
      shownToastsRef.current.add(toastKey);
      
      // Clear from set after toast duration
      setTimeout(() => {
        shownToastsRef.current.delete(toastKey);
      }, 5000);
      
      addToast({
        type: 'warning',
        title: 'Answer Rejected',
        message: data.message,
        duration: 5000,
      });
    });

    // Listen for leaderboard updates via Socket.IO
    const unsubscribeLeaderboardUpdated = quizId ? webSocketService.on('leaderboard-updated', (data: { leaderboard: LeaderboardEntry[] }) => {
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }
    }) : () => {};

    // Listen for user banned event
    const unsubscribeUserBanned = webSocketService.on('user-banned', async (data: { userId: string; message: string }) => {
      // Check if this ban is for the current user
      if (user && data.userId === user.id) {
        addToast({
          type: 'error',
          title: 'Account Banned',
          message: data.message || 'Your account has been banned. You will be logged out.',
          duration: 10000,
        });
        
        // Logout user after a short delay
        setTimeout(async () => {
          try {
            await quizAuthService.signOut();
            navigate('/');
          } catch (error) {
            console.error('Error during logout:', error);
            // Force redirect even if logout fails
            window.location.href = '/';
          }
        }, 2000);
      }
    });

    // Listen for quiz status changes via Socket.IO
    const unsubscribeQuizStatusChanged = webSocketService.on('quiz-status-changed', async (data: { quizId: string; newStatus: string }) => {
      
      // If a quiz became live
      if (data.newStatus === 'live') {
        try {
          setError(null);
          // Clear any pending redirect when quiz becomes live
          if (redirectTimerRef.current) {
            clearTimeout(redirectTimerRef.current);
            redirectTimerRef.current = null;
          }
          
          // Fetch active quizzes to get the quiz that became live
          const activeQuizzes = await quizService.getActiveQuizzes();
          if (activeQuizzes && activeQuizzes.length > 0) {
            const activeQuiz = activeQuizzes.find(q => q && q.id === data.quizId) || activeQuizzes[0];
            if (!activeQuiz || !activeQuiz.id) {
              return; // No valid quiz found
            }
            
            // If we don't have a quizId, or if this is our current quiz
            if (!quizId || data.quizId === quizId) {
              // If we already have this quizId, use fetchQuizData to avoid duplication
              if (quizId === activeQuiz.id) {
                // Same quizId - use fetchQuizData to prevent duplicate API calls
                await fetchQuizData(activeQuiz.id);
              } else {
                // Different or no quizId - set it (useEffect will fetch data)
                setQuizId(activeQuiz.id);
                setQuiz(activeQuiz);
              }
              
              // Join the quiz room if connected
              if (webSocketService.connected) {
                webSocketService.joinQuiz(activeQuiz.id);
              }
            }
          }
        } catch (err) {
          // Error fetching active quiz after status change
        }
      } else if (data.quizId === quizId && data.newStatus !== 'live') {
        // Quiz is no longer live (went to draft/completed)
        setError('No GUESS THE HERO contests are live at the moment. Please check back later.');
        // Schedule redirect to quiz-info page after 3 seconds
        if (redirectTimerRef.current) {
          clearTimeout(redirectTimerRef.current);
        }
        redirectTimerRef.current = setTimeout(() => {
          navigate('/quiz-info');
        }, 3000);
        setQuiz(null);
        setQuestionState({
          question: null,
          timeRemaining: 0,
          isActive: false,
        });
        setLeaderboard([]);
        
        // Clear quizId so it refetches active quiz on next render
        setQuizId(null);
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      }
    });
    
    // Also listen for quiz status changes for the current quiz (refresh quiz data when status changes)
    const unsubscribeQuizStatusRefresh = quizId ? webSocketService.on('quiz-status-changed', async (data: { quizId: string; newStatus: string }) => {
      if (data.quizId === quizId) {
        // Refresh quiz data to get updated status
        try {
          const updatedQuiz = await quizService.getQuizById(quizId);
          if (updatedQuiz) {
            setQuiz(updatedQuiz);
            
            // Show notification when quiz becomes live
            if (data.newStatus === 'live' && updatedQuiz.status === 'live') {
              addToast({
                type: 'success',
                title: '🎮 Contest is Live!',
                message: `${updatedQuiz.name} is now live. Questions will appear here soon!`,
                duration: 8000,
              });
            }
          }
        } catch (err) {
          // Error fetching updated quiz
        }
      }
    }) : () => {};

    const unsubscribeError = webSocketService.on('error', (data: { message?: string } | string) => {
      const errorMessage = typeof data === 'string' ? data : data.message || 'WebSocket error';
      
      // Check if this is an answer-related error that shouldn't redirect the user
      const answerRelatedErrors = [
        'You have already answered this question correctly',
        'Maximum retry limit',
        'Question is not currently active',
        'attempts are not allowed',
      ];
      
      const isAnswerRelatedError = answerRelatedErrors.some(pattern => 
        errorMessage.includes(pattern)
      );
      
      if (isAnswerRelatedError) {
        // Prevent duplicate toasts - use message as key to prevent duplicates from answer-rejected handler too
        const toastKey = errorMessage;
        if (shownToastsRef.current.has(toastKey)) {
          return;
        }
        
        // Add to set immediately to prevent race conditions
        shownToastsRef.current.add(toastKey);
        
        // Clear from set after toast duration
        setTimeout(() => {
          shownToastsRef.current.delete(toastKey);
        }, 5000);
        
        addToast({
          type: 'warning',
          title: 'Answer Validation',
          message: errorMessage,
          duration: 5000,
        });
      } else {
        setError(errorMessage);
      }
    });

    return () => {
      // Leave quiz room when component unmounts or quizId changes
      if (quizId) {
        webSocketService.leaveQuiz(quizId);
      }
      // Unsubscribe from all events
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeJoinedQuiz();
      unsubscribeQuestionLive();
      unsubscribeQuestionEnded();
      unsubscribeAnswerRejected();
      unsubscribeQuizStatusChanged();
      unsubscribeQuizStatusRefresh();
      unsubscribeLeaderboardUpdated();
      unsubscribeUserBanned();
      unsubscribeError();
      // Clear timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      // Clear redirect timer
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
    // fetchQuizData is used in quiz-status-changed handler, but it's stable (useCallback with quizId dependency)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, user, authInitialized, addToast]);

  // Ref to track if we've already attempted to fetch active quiz
  const hasFetchedActiveQuizRef = useRef(false);

  // Fetch active quiz if no quizId provided
  useEffect(() => {
    if (quizId) {
      // Reset the ref when we have a quizId (e.g., from URL params)
      hasFetchedActiveQuizRef.current = false;
      return; // Already have a quiz ID
    }

    // Prevent multiple fetch attempts
    if (hasFetchedActiveQuizRef.current) {
      return;
    }

    hasFetchedActiveQuizRef.current = true;

    const fetchActiveQuiz = async () => {
      try {
        setLoading(true);
        setError(null);

        const activeQuizzes = await quizService.getActiveQuizzes();
        if (activeQuizzes.length === 0) {
          setError('No GUESS THE HERO contests are live at the moment. Please check back later.');
          // Schedule redirect to quiz-info page after 3 seconds
          if (redirectTimerRef.current) {
            clearTimeout(redirectTimerRef.current);
          }
          redirectTimerRef.current = setTimeout(() => {
            navigate('/quiz-info');
          }, 3000);
          setLoading(false);
          hasFetchedActiveQuizRef.current = false; // Allow retry
          return;
        }

        // Use the first active quiz (should only be one)
        const activeQuiz = activeQuizzes[0];
        if (activeQuiz && activeQuiz.id) {
        setQuizId(activeQuiz.id);
        setQuiz(activeQuiz);
        } else {
          setError('No valid active contest found');
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load active contest');
        setLoading(false);
        hasFetchedActiveQuizRef.current = false; // Allow retry on error
      }
    };

    fetchActiveQuiz();
    // Only run when quizId is null/undefined (initial load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch quiz data when quizId is available
  useEffect(() => {
    if (!quizId) return;
    
    // Skip if we already fetched this quizId (to prevent duplicate calls from StrictMode)
    if (fetchedQuizIdRef.current === quizId && !fetchingQuizDataRef.current) {
      return;
    }

    // Initial fetch only - WebSocket handles all real-time updates
    setLoading(true);
    fetchQuizData().finally(() => setLoading(false));
    // Note: fetchQuizData is a useCallback that depends on quizId, so it's stable when quizId doesn't change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]); // fetchQuizData is stable (useCallback with quizId dependency)

  // Timer countdown - calculate from started_at to stay in sync
  useEffect(() => {
    if (!questionState.isActive || !questionState.question) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    const question = questionState.question;
    if (!question || !question.started_at || !question.time_limit_seconds) {
      return;
    }

    // Calculate time remaining from started_at timestamp (stays in sync)
    const updateTimeRemaining = () => {
      const startedAt = new Date(question.started_at!).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - startedAt) / 1000);
      const remaining = Math.max(0, question.time_limit_seconds! - elapsed);
      
      setQuestionState((prev) => {
        if (remaining <= 0) {
          return { ...prev, timeRemaining: 0, isActive: false };
        }
        return { ...prev, timeRemaining: remaining, isActive: true };
      });

      if (remaining <= 0 && timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };

    // Update immediately
    updateTimeRemaining();

    // Update every second
    timerIntervalRef.current = setInterval(updateTimeRemaining, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [questionState.isActive, questionState.question?.id, questionState.question?.started_at]);

  const handleSubmitAnswer = async () => {
    if (!webSocketService.connected || !questionState.question || !user || !answer.trim() || submitted || submitting || canParticipate !== true) {
      if (canParticipate === false) {
        addToast({
          type: 'warning',
          title: 'Read-Only Mode',
          message: 'You can view questions and hear sounds, but cannot submit answers.',
          duration: 4000,
        });
      }
      return;
    }

    // Immediate feedback - set submitting state
    setSubmitting(true);
    
    // Show immediate toast feedback
    addToast({
      type: 'info',
      title: 'Submitting Answer',
      message: 'Your answer is being submitted...',
      duration: 2000,
    });

    const responseTime = questionStartTimeRef.current
      ? Math.floor((Date.now() - questionStartTimeRef.current) / 1000)
      : undefined;

    try {
      // Submit answer via API instead of Socket.IO
      const token = await quizAuthService.getIdToken();
      const response = await fetch(`${environment.apiUrl}/quiz/questions/${questionState.question.id}/answers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
      quizId,
      answer: answer.trim(),
      userId: user.id,
      responseTime,
        }),
    });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || 'Failed to submit answer');
      }

      const data = await response.json();
      
      // Handle the response similar to Socket.IO answer-submitted event
      const attemptCount = data.answer.attempt_count || 1;
      const isCorrect = data.answer.is_correct;
      const maxAttempts = 3;
      
      // Clear submitting state
      setSubmitting(false);
      
      setAttemptCount(attemptCount);
      setSubmissionResult({
        is_correct: isCorrect,
        score: data.answer.score,
        message: isCorrect ? 'Correct!' : 'Incorrect',
        attempt_count: attemptCount,
      });
      
      // Show success toast
      addToast({
        type: isCorrect ? 'success' : 'warning',
        title: isCorrect ? 'Answer Submitted!' : 'Incorrect Answer',
        message: isCorrect 
          ? `Correct! You earned ${data.answer.score} points.` 
          : attemptCount < maxAttempts 
            ? `Incorrect. You have ${maxAttempts - attemptCount} attempt(s) remaining.`
            : 'Incorrect. Maximum attempts reached.',
        duration: 4000,
      });
      
      // Only mark as submitted (disable input) if:
      // 1. Answer is correct, OR
      // 2. Max attempts reached
      if (isCorrect || attemptCount >= maxAttempts) {
        setSubmitted(true);
      } else {
        // Allow retry - keep input enabled but show result
        setSubmitted(false);
      }
    } catch (error) {
      // If submission fails, reset submitting state
      setSubmitting(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit answer. Please try again.';
      addToast({
        type: 'error',
        title: 'Submission Failed',
        message: errorMessage,
        duration: 3000,
      });
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show loading while auth is being initialized
  if (!authInitialized) {
    return (
      <div className="quiz-page">
        <LoadingSpinner message="Loading GUESS THE HERO contest..." fullPage />
      </div>
    );
  }

  // If we have a quizId but no quiz yet, show loading (even if loading state is false)
  // This prevents flash of "Contest not found" when navigating with quizId in URL
  const hasQuizIdButNoQuiz = quizId && !quiz;
  const isCurrentlyFetching = loading || fetchingQuizDataRef.current;
  
  if (hasQuizIdButNoQuiz || isCurrentlyFetching) {
    return (
      <div className="quiz-page">
        <LoadingSpinner message="Loading GUESS THE HERO contest..." fullPage />
      </div>
    );
  }

  if (error) {
    // Check if it's a "no quiz live" error to customize the heading
    const isNoQuizError = error.includes('No GUESS THE HERO contests are live');
    
    return (
      <div className="quiz-page">
        <ErrorState
          title={isNoQuizError ? 'No Live Contests' : 'Error'}
          message={error}
          actionLabel="Back to Contests"
          onAction={() => navigate('/quiz-info')}
        />
      </div>
    );
  }

  // Only show "Contest not found" if we don't have a quiz and we're not fetching
  if (!quiz) {
    return (
      <div className="quiz-page">
        <ErrorState
          title="Contest not found"
          message="The contest you're looking for doesn't exist or has been removed."
          actionLabel="Back to Contests"
          onAction={() => navigate('/quiz-info')}
        />
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="quiz-page">
        <div className="quiz-container">
        {/* Header */}
        <div className="quiz-header">
          <h1>{quiz.name}</h1>
          <div className="header-right">
            {canParticipate === false && (
              <div className="read-only-badge">
                <span>👁️ Read-Only Mode</span>
              </div>
            )}
          <div className="connection-status">
            <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}></span>
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
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
                  {questionState.question?.question_type === 'voice_line' ? (
                    <div className="voice-line-question">
                      <audio
                        controls
                        src={getVoiceLineUrl(questionState.question?.question_content || '')}
                        crossOrigin="anonymous"
                        preload="auto"
                        autoPlay
                        className="voice-line-audio"
                      />
                      <p className="question-instruction">Listen to the voice line and identify the hero!</p>
                    </div>
                  ) : (
                    <div className="image-question">
                      <img
                        src={questionState.question?.question_image_url || questionState.question?.question_content || ''}
                        alt="Question"
                        className="question-image"
                      />
                      <p className="question-instruction">Identify the hero in the image!</p>
                    </div>
                  )}
                </div>

                {/* Answer Input - Only show if user can participate */}
                {questionState.isActive && canParticipate === true && (
                  <div className="answer-section">
                    {attemptCount > 0 && (
                      <div className="attempt-counter">
                        Attempt {attemptCount} of 3
                      </div>
                    )}
                    {attemptCount >= 3 && !submissionResult?.is_correct && (
                      <div className="max-attempts-alert">
                        ⚠️ Maximum attempts reached (3/3)
                      </div>
                    )}
                    {!userAnswerState && (
                      <div className="answer-input-group">
                        <input
                          type="text"
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !submitted && !submitting && attemptCount < 3) {
                              handleSubmitAnswer();
                            }
                          }}
                          placeholder={attemptCount >= 3 && !submissionResult?.is_correct 
                            ? "Maximum attempts reached" 
                            : submitting
                          ? "Submitting..."
                          : "Enter hero name..."}
                        className="answer-input"
                        disabled={submitted || submitting || (attemptCount >= 3 && !submissionResult?.is_correct)}
                      />
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={!answer.trim() || submitted || submitting || (attemptCount >= 3 && !submissionResult?.is_correct)}
                        className={`submit-button ${submitting ? 'submitting' : ''}`}
                      >
                        {submitting
                          ? 'Submitting...'
                          : attemptCount >= 3 && !submissionResult?.is_correct
                          ? 'Maximum Reached'
                          : submissionResult && !submissionResult.is_correct && attemptCount < 3 
                          ? 'Try Again' 
                          : 'Submit Answer'}
                      </button>
                    </div>
                    )}
                  </div>
                )}

                {/* Read-Only Notice - Show if user cannot participate */}
                {questionState.isActive && canParticipate === false && (
                  <div className="read-only-notice">
                    <p>👁️ <strong>Read-Only Mode:</strong> You can view questions and hear sounds, but cannot submit answers.</p>
                  </div>
                )}

                {/* Submission Result */}
                {submissionResult && (
                  <div className={`submission-result ${submissionResult.is_correct ? 'correct' : 'incorrect'}`}>
                    <h3>{submissionResult.is_correct ? '✓ Correct!' : '✗ Incorrect'}</h3>
                    <p>Score: {submissionResult.score} points</p>
                    {!submissionResult.is_correct && (
                      <>
                        <p className="correct-answer">
                          Correct answer: {questionState.question?.correct_answer_hero || 'Unknown'}
                        </p>
                        {attemptCount >= 3 ? (
                          <p className="max-attempts-reached">
                            Maximum attempts reached (3/3)
                          </p>
                        ) : (
                          <p className="retry-hint">
                            You can try again! ({attemptCount}/3 attempts used)
                          </p>
                        )}
                      </>
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
                    <span className="name">{entry.user_name || `User ${entry.user_id?.slice(0, 8) || 'Unknown'}`}</span>
                    <span className="score">{entry.total_score || 0}</span>
                    <span className="stats">
                      {entry.correct_answers || 0}/{entry.total_answers || 0} correct
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
    </>
  );
}
