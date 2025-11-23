import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { quizService, type Quiz } from '../../services/quiz';
import { quizAuthService } from '../../services/auth';
import './QuizInfo.scss';

export default function QuizInfo() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
        setQuizzes(activeQuizzes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quizzes');
        console.error('Error fetching quizzes:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();

    return () => {
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="quiz-info-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading quizzes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-info-page">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-info-page">
      <div className="quiz-info-container">
        <h1>Active Quizzes</h1>
        <p className="quiz-info-description">
          Join a live quiz contest and test your Dota 2 knowledge!
        </p>

        {quizzes.length === 0 ? (
          <div className="no-quizzes">
            <p>No active quizzes at the moment.</p>
            <p>Check back later for new contests!</p>
          </div>
        ) : (
          <div className="quizzes-grid">
            {quizzes.map((quiz) => (
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
                    Join Quiz
                  </Link>
                ) : (
                  <Link to="/login" className="quiz-join-button">
                    Login to Join
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
