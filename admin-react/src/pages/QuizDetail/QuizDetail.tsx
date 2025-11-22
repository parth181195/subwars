import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  }>;
}

export default function QuizDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'questions' | 'leaderboard' | 'answers'>('questions');
  const [loading, setLoading] = useState(true);
  const [showCreateQuestion, setShowCreateQuestion] = useState(false);
  const [showViewAnswers, setShowViewAnswers] = useState<string | null>(null);
  const [currentAnswers, setCurrentAnswers] = useState<Answer[]>([]);
  const [voiceLinesData, setVoiceLinesData] = useState<VoiceLineData[]>([]);
  const [newQuestion, setNewQuestion] = useState({
    question_type: 'voice_line' as 'voice_line' | 'image',
    voice_line_url: '',
    question_content: '',
    correct_answer_hero: '',
    answer_image_url: '',
    time_limit_seconds: 120,
    order_index: 0,
  });
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);

  useEffect(() => {
    if (id) {
      fetchQuiz();
      fetchQuestions();
      fetchVoiceLines();
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [activeTab, id]);

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
        // Set order_index for new question
        setNewQuestion(prev => ({ ...prev, order_index: data.length }));
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    }
  };

  const fetchVoiceLines = async () => {
    try {
      // Try multiple possible paths for the voice lines JSON
      const possiblePaths = [
        '/voice-lines/voice-lines.json',
        '/assets/voice-lines/voice-lines.json',
        '/voice-lines.json',
      ];
      
      let data = null;
      for (const path of possiblePaths) {
        try {
          const response = await fetch(path);
          if (response.ok) {
            data = await response.json();
            break;
          }
        } catch (e) {
          // Try next path
          continue;
        }
      }
      
      if (data) {
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

  const fetchQuestionAnswers = async (questionId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/questions/${questionId}/answers`);
      if (response.ok) {
        const data = await response.json();
        setCurrentAnswers(data);
        setShowViewAnswers(questionId);
      }
    } catch (error) {
      console.error('Failed to fetch answers:', error);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      
      if (newQuestion.question_type === 'image' && questionFile) {
        formData.append('question_file', questionFile);
      } else if (newQuestion.question_type === 'voice_line') {
        formData.append('voice_line_url', newQuestion.voice_line_url || newQuestion.question_content);
      } else {
        formData.append('question_content', newQuestion.question_content);
      }
      
      formData.append('question_type', newQuestion.question_type);
      formData.append('correct_answer_hero', newQuestion.correct_answer_hero);
      formData.append('time_limit_seconds', newQuestion.time_limit_seconds.toString());
      formData.append('order_index', newQuestion.order_index.toString());
      
      if (newQuestion.answer_image_url) {
        formData.append('answer_image_url', newQuestion.answer_image_url);
      }
      if (answerFile) {
        // Upload answer image separately - you might need an endpoint for this
        // For now, just add the file
        formData.append('answer_file', answerFile);
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${id}/questions`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await fetchQuestions();
        setShowCreateQuestion(false);
        setNewQuestion({
          question_type: 'voice_line',
          voice_line_url: '',
          question_content: '',
          correct_answer_hero: '',
          answer_image_url: '',
          time_limit_seconds: 120,
          order_index: questions.length,
        });
        setQuestionFile(null);
        setAnswerFile(null);
      } else {
        const error = await response.json();
        alert(`Failed to create question: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to create question:', error);
      alert('Failed to create question');
    }
  };

  const handleMakeQuestionLive = async (questionId: string) => {
    if (!confirm('This will deactivate all other questions. Are you sure?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/questions/${questionId}/make-live`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchQuestions();
      } else {
        alert('Failed to make question live');
      }
    } catch (error) {
      console.error('Failed to make question live:', error);
      alert('Failed to make question live');
    }
  };

  const handleEndQuestion = async (questionId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/questions/${questionId}/end`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchQuestions();
      } else {
        alert('Failed to end question');
      }
    } catch (error) {
      console.error('Failed to end question:', error);
      alert('Failed to end question');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/questions/${questionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchQuestions();
      } else {
        alert('Failed to delete question');
      }
    } catch (error) {
      console.error('Failed to delete question:', error);
      alert('Failed to delete question');
    }
  };

  const getHeroes = () => {
    const heroes = new Set<string>();
    voiceLinesData.forEach(heroData => heroes.add(heroData.hero));
    return Array.from(heroes).sort();
  };

  const getVoiceLinesForHero = (heroName: string) => {
    const heroData = voiceLinesData.find(h => h.hero === heroName);
    return heroData?.voiceLines || [];
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
        <button className="btn-back" onClick={() => navigate('/quizzes')}>
          ← Back to Quizzes
        </button>
        <div>
          <h1 className="page-title">{quiz.name}</h1>
          {quiz.description && <p className="quiz-description">{quiz.description}</p>}
        </div>
        <span className={`status-badge status-${quiz.status}`}>{quiz.status}</span>
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
          </div>
          {activeQuestion.answer_image_url && (
            <img 
              src={activeQuestion.answer_image_url} 
              alt="Answer" 
              className="answer-image-preview"
            />
          )}
          <button 
            className="btn-danger" 
            onClick={() => handleEndQuestion(activeQuestion.id)}
          >
            End Question
          </button>
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'questions' ? 'active' : ''}`}
          onClick={() => setActiveTab('questions')}
        >
          Questions ({questions.length})
        </button>
        <button
          className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Leaderboard
        </button>
      </div>

      {activeTab === 'questions' && (
        <div className="questions-section">
          <div className="section-header">
            <h2>Questions</h2>
            <button
              className="btn-primary"
              onClick={() => setShowCreateQuestion(true)}
            >
              + Add Question
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="empty-state">
              <p>No questions yet. Add your first question to get started!</p>
            </div>
          ) : (
            <div className="questions-list">
              {questions
                .sort((a, b) => a.order_index - b.order_index)
                .map((question) => (
                  <div
                    key={question.id}
                    className={`question-card ${question.is_active ? 'active' : ''}`}
                  >
                    <div className="question-header">
                      <div>
                        <h3>Question #{question.order_index + 1}</h3>
                        <span className={`status-badge status-${question.status}`}>
                          {question.status}
                        </span>
                        {question.is_active && (
                          <span className="status-badge status-live">LIVE</span>
                        )}
                      </div>
                      <div className="question-actions">
                        {!question.is_active && question.status !== 'completed' && (
                          <button
                            className="btn-success"
                            onClick={() => handleMakeQuestionLive(question.id)}
                          >
                            Make Live
                          </button>
                        )}
                        {question.is_active && (
                          <button
                            className="btn-danger"
                            onClick={() => handleEndQuestion(question.id)}
                          >
                            End
                          </button>
                        )}
                        <button
                          className="btn-info"
                          onClick={() => fetchQuestionAnswers(question.id)}
                        >
                          View Answers
                        </button>
                        <button
                          className="btn-danger"
                          onClick={() => handleDeleteQuestion(question.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="question-details">
                      <div className="detail-row">
                        <strong>Type:</strong> {question.question_type === 'voice_line' ? 'Voice Line' : 'Image'}
                      </div>
                      <div className="detail-row">
                        <strong>Correct Answer:</strong> {question.correct_answer_hero}
                      </div>
                      <div className="detail-row">
                        <strong>Time Limit:</strong> {question.time_limit_seconds}s
                      </div>
                      {question.question_content && (
                        <div className="detail-row">
                          <strong>Content:</strong>
                          {question.question_type === 'voice_line' ? (
                            <audio controls src={question.question_content} className="audio-player" />
                          ) : (
                            <img src={question.question_content} alt="Question" className="question-image" />
                          )}
                        </div>
                      )}
                      {question.answer_image_url && (
                        <div className="detail-row">
                          <strong>Answer Image:</strong>
                          <img src={question.answer_image_url} alt="Answer" className="answer-image" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {showCreateQuestion && (
            <div className="modal-overlay" onClick={() => setShowCreateQuestion(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Create New Question</h2>
                <form onSubmit={handleCreateQuestion}>
                  <div className="form-group">
                    <label>Question Type *</label>
                    <select
                      value={newQuestion.question_type}
                      onChange={(e) => setNewQuestion({
                        ...newQuestion,
                        question_type: e.target.value as 'voice_line' | 'image'
                      })}
                      required
                    >
                      <option value="voice_line">Voice Line</option>
                      <option value="image">Image</option>
                    </select>
                  </div>

                  {newQuestion.question_type === 'voice_line' && (
                    <>
                      <div className="form-group">
                        <label>Select Hero</label>
                        <select
                          value={newQuestion.correct_answer_hero}
                          onChange={(e) => setNewQuestion({
                            ...newQuestion,
                            correct_answer_hero: e.target.value,
                            voice_line_url: '',
                          })}
                          required
                        >
                          <option value="">Select a hero</option>
                          {getHeroes().map(hero => (
                            <option key={hero} value={hero}>{hero}</option>
                          ))}
                        </select>
                      </div>

                      {newQuestion.correct_answer_hero && (
                        <div className="form-group">
                          <label>Select Voice Line *</label>
                          <select
                            value={newQuestion.voice_line_url}
                            onChange={(e) => setNewQuestion({
                              ...newQuestion,
                              voice_line_url: e.target.value,
                              question_content: e.target.value,
                            })}
                            required
                          >
                            <option value="">Select a voice line</option>
                            {getVoiceLinesForHero(newQuestion.correct_answer_hero).map((vl, idx) => (
                              <option key={idx} value={vl.link}>{vl.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {newQuestion.voice_line_url && (
                        <div className="form-group">
                          <audio controls src={newQuestion.voice_line_url} className="audio-preview" />
                        </div>
                      )}
                    </>
                  )}

                  {newQuestion.question_type === 'image' && (
                    <>
                      <div className="form-group">
                        <label>Question Image *</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setQuestionFile(e.target.files?.[0] || null)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Correct Answer Hero *</label>
                        <select
                          value={newQuestion.correct_answer_hero}
                          onChange={(e) => setNewQuestion({
                            ...newQuestion,
                            correct_answer_hero: e.target.value,
                          })}
                          required
                        >
                          <option value="">Select a hero</option>
                          {getHeroes().map(hero => (
                            <option key={hero} value={hero}>{hero}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="form-group">
                    <label>Answer Image (shown after question goes live)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setAnswerFile(e.target.files?.[0] || null)}
                    />
                    <small>Or enter URL:</small>
                    <input
                      type="url"
                      value={newQuestion.answer_image_url}
                      onChange={(e) => setNewQuestion({
                        ...newQuestion,
                        answer_image_url: e.target.value,
                      })}
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>

                  <div className="form-group">
                    <label>Time Limit (seconds) *</label>
                    <input
                      type="number"
                      min="1"
                      value={newQuestion.time_limit_seconds}
                      onChange={(e) => setNewQuestion({
                        ...newQuestion,
                        time_limit_seconds: parseInt(e.target.value) || 120,
                      })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Order Index</label>
                    <input
                      type="number"
                      min="0"
                      value={newQuestion.order_index}
                      onChange={(e) => setNewQuestion({
                        ...newQuestion,
                        order_index: parseInt(e.target.value) || 0,
                      })}
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowCreateQuestion(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Create Question
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showViewAnswers && (
            <div className="modal-overlay" onClick={() => setShowViewAnswers(null)}>
              <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
                <h2>Answers for Question</h2>
                <div className="answers-table">
                  <table>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Answer</th>
                        <th>Correct</th>
                        <th>Response Time (ms)</th>
                        <th>Score</th>
                        <th>Submitted At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentAnswers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center">No answers yet</td>
                        </tr>
                      ) : (
                        currentAnswers.map((answer) => (
                          <tr key={answer.id} className={answer.is_correct ? 'correct' : 'incorrect'}>
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
                <div className="modal-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => setShowViewAnswers(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="leaderboard-section">
          <h2>Leaderboard</h2>
          {leaderboard.length === 0 ? (
            <div className="empty-state">
              <p>No entries yet. Participants will appear here once they submit answers.</p>
            </div>
          ) : (
            <div className="leaderboard-table">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>User</th>
                    <th>Total Score</th>
                    <th>Correct Answers</th>
                    <th>Total Answers</th>
                    <th>Avg Response Time</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => (
                    <tr key={entry.user_id}>
                      <td>{index + 1}</td>
                      <td>{entry.user_name}</td>
                      <td>{entry.total_score}</td>
                      <td>{entry.correct_answers}</td>
                      <td>{entry.total_answers}</td>
                      <td>{entry.average_response_time}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

