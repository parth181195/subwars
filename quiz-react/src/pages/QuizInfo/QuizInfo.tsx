import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { quizService, type Quiz, type LeaderboardEntry } from '../../services/quiz';
import { quizAuthService } from '../../services/auth';
import { webSocketService } from '../../services/websocket';
import ErrorState from '../../components/ErrorState/ErrorState';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import EmptyState from '../../components/EmptyState/EmptyState';
import './QuizInfo.scss';

export default function QuizInfo() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [loadingLeaderboards, setLoadingLeaderboards] = useState<Record<string, boolean>>({});
  const loadingRef = useRef<Set<string>>(new Set());
  const loadedRef = useRef<Set<string>>(new Set());

  // Load leaderboard for a specific quiz
  const loadLeaderboard = useCallback(async (quizId: string) => {
    // Check if already loading or loaded
    if (loadingRef.current.has(quizId) || loadedRef.current.has(quizId)) {
      return;
    }
    
    // Mark as loading
    loadingRef.current.add(quizId);
    
    // Start loading
    try {
      setLoadingLeaderboards(prev => ({ ...prev, [quizId]: true }));
      const leaderboard = await quizService.getQuizLeaderboard(quizId);
      setLeaderboards(prev => ({ ...prev, [quizId]: leaderboard }));
      loadedRef.current.add(quizId);
    } catch (err) {
      console.error(`Error loading leaderboard for contest ${quizId}:`, err);
    } finally {
      loadingRef.current.delete(quizId);
      setLoadingLeaderboards(prev => ({ ...prev, [quizId]: false }));
    }
  }, []);

  useEffect(() => {
    // Check authentication
    const unsubscribe = quizAuthService.subscribe((user) => {
      setIsAuthenticated(user !== null);
    });

    // Fetch active quizzes
    const fetchQuizzes = async () => {
      try {
        setLoading(true);
        setError(null);
        const activeQuizzes = await quizService.getActiveQuizzes();
        // Ensure we have a valid array
        const quizzesArray = Array.isArray(activeQuizzes) ? activeQuizzes : [];
        setQuizzes(quizzesArray);
        
        // Load leaderboards for all completed quizzes
        const completedQuizzes = quizzesArray.filter(q => q.status === 'completed');
        for (const quiz of completedQuizzes) {
          loadLeaderboard(quiz.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load GUESS THE HERO contests');
        console.error('Error fetching quizzes:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();

    // Listen for quiz status changes to refresh the list
    const unsubscribeQuizStatusChanged = webSocketService.on('quiz-status-changed', async (data: { quizId: string; newStatus: string }) => {
      // Refresh quizzes when status changes (quiz becomes live, completed, or goes to draft)
      if (data.newStatus === 'live' || data.newStatus === 'completed' || data.newStatus === 'draft') {
        try {
          const activeQuizzes = await quizService.getActiveQuizzes();
          const quizzesArray = Array.isArray(activeQuizzes) ? activeQuizzes : [];
          setQuizzes(quizzesArray);
          
          // If quiz is completed, load its leaderboard
          if (data.newStatus === 'completed') {
            loadLeaderboard(data.quizId);
          }
        } catch (err) {
          // Error fetching quizzes - silently fail to avoid disrupting UI
          console.error('Error refreshing contests after status change:', err);
        }
      }
    });

    return () => {
      unsubscribe();
      unsubscribeQuizStatusChanged();
    };
  }, [loadLeaderboard]);

  if (loading) {
    return (
      <div className="quiz-info-page">
        <LoadingSpinner message="Loading GUESS THE HERO contests..." fullPage />
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-info-page">
        <ErrorState
          title="Error"
          message={error}
          actionLabel="Retry"
          onAction={() => window.location.reload()}
        />
      </div>
    );
  }

  // Separate quizzes into live and completed
  const liveQuizzes = quizzes.filter(q => q.status === 'live');
  const completedQuizzes = quizzes.filter(q => q.status === 'completed');

  return (
    <div className="quiz-info-page">
      <div className="quiz-info-container">
        <h1>GUESS THE HERO Contests</h1>
        <p className="quiz-info-description">
          Join a live GUESS THE HERO contest and test your Dota 2 knowledge!
        </p>

        {quizzes.length === 0 ? (
          <EmptyState
            message={
              <>
                <p>No GUESS THE HERO contests are live at the moment.</p>
                <p>Please check back later!</p>
              </>
            }
          />
        ) : (
          <>
            {/* Live Quizzes Section */}
            {liveQuizzes.length > 0 && (
              <div className="quizzes-section quizzes-section-live">
                <h2 className="section-title">Live Contests</h2>
                <div className="quizzes-grid quizzes-grid-live">
                  {liveQuizzes.map((quiz) => (
                    <div key={quiz.id} className="quiz-card">
                      <h2>{quiz.name}</h2>
                      {quiz.description && <p className="quiz-description">{quiz.description}</p>}
                      {quiz.scheduled_at && (
                        <p className="quiz-schedule">
                          Scheduled: {new Date(quiz.scheduled_at).toLocaleString()}
                        </p>
                      )}
                      <div className="quiz-status">
                        <span className={`status-badge status-${quiz.status}`}>
                          {quiz.status.toUpperCase()}
                        </span>
                      </div>
                      {isAuthenticated ? (
                        <Link to={`/quiz?quizId=${quiz.id}`} className="quiz-join-button">
                          JOIN CONTEST
                        </Link>
                      ) : (
                        <Link to="/login" className="quiz-join-button">
                          Login to Join
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Quizzes Section */}
            {completedQuizzes.length > 0 && (
              <div className="quizzes-section">
                <h2 className="section-title">Completed Contests</h2>
                <div className="quizzes-grid">
                  {completedQuizzes.map((quiz) => {
                    const quizLeaderboard = leaderboards[quiz.id] || [];
                    const isLoadingLeaderboard = loadingLeaderboards[quiz.id];
                    
                    return (
                      <div key={quiz.id} className="quiz-card">
                        <h2>{quiz.name}</h2>
                        {quiz.description && <p className="quiz-description">{quiz.description}</p>}
                        {quiz.scheduled_at && (
                          <p className="quiz-schedule">
                            Scheduled: {new Date(quiz.scheduled_at).toLocaleString()}
                          </p>
                        )}
                        <div className="quiz-status">
                          <span className={`status-badge status-${quiz.status}`}>
                            {quiz.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="quiz-leaderboard-section">
                          <h3>Top 5 Leaderboard</h3>
                          {isLoadingLeaderboard ? (
                            <LoadingSpinner message="Loading leaderboard..." />
                          ) : quizLeaderboard.length === 0 ? (
                            <p className="no-leaderboard">No entries yet</p>
                          ) : (
                            <div className="leaderboard-list">
                              {quizLeaderboard.slice(0, 5).map((entry, index) => (
                                <div key={entry.user_id} className="leaderboard-entry">
                                  <span className="rank">#{index + 1}</span>
                                  <span className="name">{entry.user_name || 'Unknown'}</span>
                                  <span className="score">{entry.total_score} pts</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
