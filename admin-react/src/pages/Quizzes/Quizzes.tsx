import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Quizzes.scss';

interface Quiz {
  id: string;
  name: string;
  description?: string;
  scheduled_at?: string;
  status: 'draft' | 'live' | 'paused' | 'completed';
  created_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function Quizzes() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQuiz, setNewQuiz] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes`);
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

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newQuiz.name,
          description: newQuiz.description || undefined,
          status: 'draft',
        }),
      });

      if (response.ok) {
        const createdQuiz = await response.json();
        navigate(`/quizzes/${createdQuiz.id}`);
        setShowCreateModal(false);
        setNewQuiz({ name: '', description: '' });
      }
    } catch (error) {
      console.error('Failed to create quiz:', error);
      alert('Failed to create quiz');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'status-live';
      case 'completed':
        return 'status-completed';
      case 'paused':
        return 'status-paused';
      default:
        return 'status-draft';
    }
  };

  if (loading) {
    return (
      <div className="quizzes-page">
        <div className="loading-container">
          <p>Loading quizzes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="quizzes-page">
      <div className="page-header">
        <h1 className="page-title">Quizzes</h1>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Create New Quiz
        </button>
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
                <span className={`status-badge ${getStatusColor(quiz.status)}`}>
                  {quiz.status}
                </span>
              </div>
              {quiz.description && (
                <p className="quiz-description">{quiz.description}</p>
              )}
              <div className="quiz-card-footer">
                <span className="quiz-created">
                  Created: {new Date(quiz.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Quiz</h2>
            <form onSubmit={handleCreateQuiz}>
              <div className="form-group">
                <label htmlFor="quiz-name">Quiz Name *</label>
                <input
                  id="quiz-name"
                  type="text"
                  value={newQuiz.name}
                  onChange={(e) => setNewQuiz({ ...newQuiz, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="quiz-description">Description</label>
                <textarea
                  id="quiz-description"
                  value={newQuiz.description}
                  onChange={(e) => setNewQuiz({ ...newQuiz, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Quiz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

