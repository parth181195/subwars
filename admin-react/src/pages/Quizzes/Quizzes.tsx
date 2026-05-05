import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Label } from '@primer/react';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import CreateQuizDialog from '../../components/CreateQuizDialog/CreateQuizDialog';
import { useToast } from '../../components/Toast/ToastContainer';
import { environment } from '../../config/environment';
import { getAuthHeaders } from '../../utils/api-client';
import './Quizzes.scss';

interface Quiz {
  id: string;
  name: string;
  description?: string;
  scheduled_at?: string;
  status: 'draft' | 'live' | 'paused' | 'completed';
  excluded_from_combined_leaderboard?: boolean;
  created_at: string;
}

const API_BASE_URL = environment.apiBaseUrl || 'http://localhost:3000';

export default function Quizzes() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [updatingQuizIds, setUpdatingQuizIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes`, {
        headers,
      });
      if (response.ok) {
        const data = await response.json();
        setQuizzes(data);
      }
    } catch (error) {
      console.error('Failed to fetch quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuiz = async (quizData: { name: string; description: string }) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/api/admin/quizzes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: quizData.name,
        description: quizData.description || undefined,
        status: 'draft',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create quiz');
    }

    const createdQuiz = await response.json();
    if (createdQuiz && createdQuiz.id) {
    navigate(`/quizzes/${createdQuiz.id}`);
    } else {
      throw new Error('Invalid quiz data received from server');
    }
    setShowCreateModal(false);
  };

  const handleToggleExcludeFromCombinedLeaderboard = async (
    e: React.MouseEvent,
    quizId: string,
    currentValue: boolean
  ) => {
    e.stopPropagation(); // Prevent navigation to quiz detail page
    
    if (updatingQuizIds.has(quizId)) return; // Prevent duplicate updates
    
    setUpdatingQuizIds((prev) => new Set(prev).add(quizId));
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${quizId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ excluded_from_combined_leaderboard: !currentValue }),
      });

      if (response.ok) {
        const updatedQuiz = await response.json();
        setQuizzes((prevQuizzes) =>
          prevQuizzes.map((q) => (q.id === quizId ? updatedQuiz : q))
        );
        addToast({
          type: 'success',
          title: 'Settings Updated',
          message: `Quiz ${!currentValue ? 'excluded from' : 'included in'} combined leaderboard`,
          duration: 3000,
        });
      } else {
        const errorText = await response.text();
        addToast({
          type: 'error',
          title: 'Update Failed',
          message: `Failed to update setting: ${errorText}`,
          duration: 5000,
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Update Failed',
        message: `Failed to update setting: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 5000,
      });
    } finally {
      setUpdatingQuizIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(quizId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="quizzes-page">
        <LoadingSpinner message="Loading quizzes..." fullPage />
      </div>
    );
  }

  return (
    <div className="quizzes-page">
      <div className="page-header">
        <h1 className="page-title">Quizzes</h1>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Create New Quiz
        </Button>
      </div>

      {quizzes.length === 0 ? (
        <div className="empty-state">
          <p>No quizzes yet. Create your first quiz to get started!</p>
        </div>
      ) : (
        <div className="quizzes-grid">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="quiz-card"
              onClick={() => navigate(`/quizzes/${quiz.id}`)}
            >
              <div className="quiz-card-header">
                <h3 className="quiz-name">{quiz.name}</h3>
                <Label variant={quiz.status === 'live' ? 'success' : quiz.status === 'completed' ? 'secondary' : quiz.status === 'paused' ? 'attention' : 'secondary'}>
                  {quiz.status}
                </Label>
              </div>
              {quiz.description && (
                <p className="quiz-description">{quiz.description}</p>
              )}
              <div className="quiz-card-footer">
                <span className="quiz-created">
                  Created: {quiz.created_at ? new Date(quiz.created_at).toLocaleDateString() : 'Unknown'}
                </span>
                <label
                  className="exclude-leaderboard-toggle"
                  onClick={(e) => handleToggleExcludeFromCombinedLeaderboard(
                    e,
                    quiz.id,
                    quiz.excluded_from_combined_leaderboard || false
                  )}
                  title={quiz.excluded_from_combined_leaderboard 
                    ? 'Include in combined leaderboard' 
                    : 'Exclude from combined leaderboard'}
                >
                  <input
                    type="checkbox"
                    checked={!quiz.excluded_from_combined_leaderboard} // Inverted: checked = included
                    onChange={() => {}} // Controlled by parent onClick
                    disabled={updatingQuizIds.has(quiz.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="toggle-label">
                    Included in Combined Leaderboard
                  </span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateQuizDialog
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateQuiz}
      />
    </div>
  );
}

