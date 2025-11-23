import { useState } from 'react';
import { Button, Label } from '@primer/react';
import QuestionDetailsPopup from './QuestionDetailsPopup';
import CreateQuestionDialog from './CreateQuestionDialog';
import ImagePreviewDialog from './ImagePreviewDialog';
import ConfirmationDialog from './ConfirmationDialog';
import './QuestionsTab.scss';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

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

interface QuestionsTabProps {
  questions: QuizQuestion[];
  quizId: string;
  quizStatus?: 'draft' | 'live' | 'paused' | 'completed';
  onQuestionsChange: () => void;
  onViewAnswers: (questionId: string) => void;
  voiceLinesData: VoiceLineData[];
}

export default function QuestionsTab({
  questions,
  quizId,
  quizStatus,
  onQuestionsChange,
  onViewAnswers,
  voiceLinesData,
}: QuestionsTabProps) {
  const [showCreateQuestion, setShowCreateQuestion] = useState(false);
  const [showQuestionDetails, setShowQuestionDetails] = useState<string | null>(null);
  const [questionStatistics, setQuestionStatistics] = useState<{
    totalAnswers: number;
    correctAnswers: number;
    answerHero: string;
  } | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imagePreviewTitle, setImagePreviewTitle] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ questionId: string; questionNumber: number } | null>(null);
  const [reactivateConfirm, setReactivateConfirm] = useState<{ questionId: string; questionNumber: number } | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
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

  const fetchQuestionDetails = async (questionId: string) => {
    try {
      const [answersResponse, questionResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/quizzes/questions/${questionId}/answers`),
        fetch(`${API_BASE_URL}/api/admin/quizzes/questions/${questionId}`),
      ]);

      if (answersResponse.ok && questionResponse.ok) {
        const answers = await answersResponse.json();
        const question = await questionResponse.json();
        
        setQuestionStatistics({
          totalAnswers: answers.length,
          correctAnswers: answers.filter((a: any) => a.is_correct).length,
          answerHero: question.correct_answer_hero,
        });
        setShowQuestionDetails(questionId);
      }
    } catch (error) {
      console.error('Failed to fetch question details:', error);
    }
  };

  const handleMakeQuestionLiveClick = (questionId: string, questionNumber: number) => {
    // Prevent making questions live if quiz is in draft
    if (quizStatus === 'draft') {
      alert('Cannot make questions live while the quiz is in draft status. Please set the quiz to live first.');
      return;
    }

    const question = questions.find(q => q.id === questionId);
    // Show confirmation if question was previously live or completed (reactivation)
    if (question && (question.status === 'completed' || question.status === 'live')) {
      setReactivateConfirm({ questionId, questionNumber });
      setShowQuestionDetails(null);
    } else {
      // Direct activation for pending questions
      handleMakeQuestionLive(questionId);
    }
  };

  const handleMakeQuestionLive = async (questionId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/questions/${questionId}/make-live`, {
        method: 'POST',
      });
      if (response.ok) {
        // Refresh questions list to get updated statuses from backend
        await onQuestionsChange();
        setShowQuestionDetails(null);
        setReactivateConfirm(null);
      } else {
        const errorText = await response.text();
        console.error('Failed to make question live:', response.status, errorText);
        alert(`Failed to make question live: ${errorText}`);
      }
    } catch (error) {
      console.error('Failed to make question live:', error);
      alert('Failed to make question live. Please try again.');
    }
  };

  const handleEndQuestion = async (questionId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/questions/${questionId}/end`, {
        method: 'POST',
      });
      if (response.ok) {
        onQuestionsChange();
        setShowQuestionDetails(null);
      }
    } catch (error) {
      console.error('Failed to end question:', error);
    }
  };

  const handleDeleteClick = (questionId: string, questionNumber: number) => {
    setDeleteConfirm({ questionId, questionNumber });
    setShowQuestionDetails(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/questions/${deleteConfirm.questionId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onQuestionsChange();
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Failed to delete question:', error);
    }
  };

  const handleEditQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion) return;

    const formData = new FormData();
    formData.append('question_type', newQuestion.question_type);
    formData.append('correct_answer_hero', newQuestion.correct_answer_hero);
    formData.append('time_limit_seconds', newQuestion.time_limit_seconds.toString());
    
    if (newQuestion.question_type === 'voice_line') {
      formData.append('voice_line_url', newQuestion.voice_line_url || newQuestion.question_content);
    } else if (newQuestion.question_type === 'image' && questionFile) {
      formData.append('question_file', questionFile);
    } else {
      formData.append('question_content', newQuestion.question_content);
    }

    if (answerFile) {
      formData.append('answer_file', answerFile);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/questions/${editingQuestion.id}`, {
        method: 'PUT',
        body: formData,
      });

      if (response.ok) {
        onQuestionsChange();
        setEditingQuestion(null);
        setShowCreateQuestion(false);
        // Reset form
        setNewQuestion({
          question_type: 'voice_line',
          voice_line_url: '',
          question_content: '',
          correct_answer_hero: '',
          answer_image_url: '',
          time_limit_seconds: 120,
          order_index: 0,
        });
        setQuestionFile(null);
        setAnswerFile(null);
      } else {
        const error = await response.json();
        alert(`Failed to update question: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update question:', error);
      alert('Failed to update question');
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
      formData.append('order_index', questions.length.toString());
      
      if (newQuestion.answer_image_url) {
        formData.append('answer_image_url', newQuestion.answer_image_url);
      }
      if (answerFile) {
        formData.append('answer_file', answerFile);
      }

      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${quizId}/questions`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setShowCreateQuestion(false);
        setNewQuestion({
          question_type: 'voice_line',
          voice_line_url: '',
          question_content: '',
          correct_answer_hero: '',
          answer_image_url: '',
          time_limit_seconds: 120,
          order_index: 0,
        });
        setQuestionFile(null);
        setAnswerFile(null);
        onQuestionsChange();
      } else {
        const error = await response.json();
        alert(`Failed to create question: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to create question:', error);
      alert('Failed to create question');
    }
  };

  const currentQuestion = showQuestionDetails ? questions.find(q => q.id === showQuestionDetails) : null;

  return (
    <div className="questions-tab">
      <div className="section-header">
        <h2>Questions</h2>
        <Button
          variant="primary"
          onClick={() => setShowCreateQuestion(true)}
        >
          + Add Question
        </Button>
      </div>

      {questions.length === 0 ? (
        <div className="empty-state">
          <p>No questions yet. Add your first question to get started!</p>
        </div>
      ) : (
        <div className="questions-list">
          {questions
            .sort((a, b) => {
              // Priority 1: Currently live questions first
              const aIsLive = a.is_active && a.status === 'live';
              const bIsLive = b.is_active && b.status === 'live';
              if (aIsLive !== bIsLive) {
                return aIsLive ? -1 : 1;
              }
              
              // If both are live, sort by order_index
              if (aIsLive && bIsLive) {
                return a.order_index - b.order_index;
              }
              
              // Priority 2: Determine if questions have been activated
              // A question is activated if it has started_at, ended_at, or status is 'completed'
              const aActivated = !!(a.started_at || a.ended_at || a.status === 'completed');
              const bActivated = !!(b.started_at || b.ended_at || b.status === 'completed');
              
              // Priority 3: Non-activated questions come before activated ones
              if (aActivated !== bActivated) {
                return aActivated ? 1 : -1; // Activated goes to bottom (1), non-activated stays on top (-1)
              }
              
              // Priority 4: For activated questions, sort by started_at timestamp (most recent first)
              if (aActivated && bActivated) {
                const aStartedAt = a.started_at ? new Date(a.started_at).getTime() : 0;
                const bStartedAt = b.started_at ? new Date(b.started_at).getTime() : 0;
                if (aStartedAt !== bStartedAt) {
                  return bStartedAt - aStartedAt; // Most recent first
                }
              }
              
              // Final fallback: sort by order_index
              return a.order_index - b.order_index;
            })
            .map((question) => {
              // Question has been activated if it has ended_at or status is 'completed'
              // But not if it's currently active (to avoid double highlighting)
              const isCurrentlyLive = question.is_active && question.status === 'live';
              const hasBeenActivated = !isCurrentlyLive && !!(question.ended_at || question.status === 'completed');
              return (
              <div
                key={question.id}
                className={`question-row ${question.is_active ? 'active' : ''} ${hasBeenActivated ? 'activated' : ''}`}
                onClick={() => onViewAnswers(question.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="question-row-content">
                  <div className="question-row-main">
                    <span className="question-number">#{question.order_index + 1}</span>
                    <span className="question-type">{question.question_type === 'voice_line' ? 'Voice Line' : 'Image'}</span>
                    <span className="question-answer-hero">{question.correct_answer_hero}</span>
                    {question.is_active && question.status === 'live' && (
                      <div className="live-indicator-inline">
                        <span className="live-dot"></span>
                        <span className="live-text">LIVE</span>
                      </div>
                    )}
                    <Label variant={question.status === 'live' ? 'success' : question.status === 'completed' ? 'secondary' : 'secondary'}>
                      {question.status}
                    </Label>
                  </div>
                  <div className="question-row-actions" onClick={(e) => e.stopPropagation()}>
                    {!question.is_active && (
                      <Button
                        variant="primary"
                        size="small"
                        disabled={quizStatus === 'draft'}
                        onClick={() => handleMakeQuestionLiveClick(question.id, question.order_index + 1)}
                        title={quizStatus === 'draft' ? 'Quiz must be live to activate questions' : ''}
                      >
                        {question.status === 'completed' ? 'Reactivate' : 'Make Live'}
                      </Button>
                    )}
                    <Button
                      variant="invisible"
                      size="small"
                      disabled={question.is_active && question.status === 'live'}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (question.is_active && question.status === 'live') return;
                        const questionToEdit = questions.find(q => q.id === question.id);
                        if (questionToEdit) {
                          setNewQuestion({
                            question_type: questionToEdit.question_type,
                            voice_line_url: questionToEdit.question_content_metadata?.voice_line_url || '',
                            question_content: questionToEdit.question_content,
                            correct_answer_hero: questionToEdit.correct_answer_hero,
                            answer_image_url: questionToEdit.answer_image_url || '',
                            time_limit_seconds: questionToEdit.time_limit_seconds,
                            order_index: questionToEdit.order_index,
                          });
                          setEditingQuestion(questionToEdit);
                          setShowCreateQuestion(true);
                        }
                      }}
                    >
                      Edit
                    </Button>
                    {question.is_active && (
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => handleEndQuestion(question.id)}
                      >
                        End
                      </Button>
                    )}
                    <Button
                      variant="invisible"
                      size="small"
                      onClick={() => fetchQuestionDetails(question.id)}
                    >
                      View Details
                    </Button>
                    <Button
                      variant="invisible"
                      size="small"
                      onClick={() => onViewAnswers(question.id)}
                    >
                      View Answers
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      disabled={question.is_active && question.status === 'live'}
                      onClick={() => {
                        if (question.is_active && question.status === 'live') return;
                        handleDeleteClick(question.id, question.order_index + 1);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
            })}
        </div>
      )}

      {showCreateQuestion && (
        <CreateQuestionDialog
          isOpen={showCreateQuestion}
          onClose={() => {
            setShowCreateQuestion(false);
            setEditingQuestion(null);
            // Reset form
            setNewQuestion({
              question_type: 'voice_line',
              voice_line_url: '',
              question_content: '',
              correct_answer_hero: '',
              answer_image_url: '',
              time_limit_seconds: 120,
              order_index: 0,
            });
            setQuestionFile(null);
            setAnswerFile(null);
          }}
          onSubmit={editingQuestion ? handleEditQuestion : handleCreateQuestion}
          newQuestion={newQuestion}
          setNewQuestion={setNewQuestion}
          questionFile={questionFile}
          setQuestionFile={setQuestionFile}
          answerFile={answerFile}
          setAnswerFile={setAnswerFile}
          voiceLinesData={voiceLinesData}
          editingQuestion={editingQuestion}
        />
      )}

      {reactivateConfirm && (
        <ConfirmationDialog
          title="Reactivate Question"
          message={`Are you sure you want to reactivate Question #${reactivateConfirm.questionNumber}? This will make it live again.`}
          onConfirm={() => handleMakeQuestionLive(reactivateConfirm.questionId)}
          onCancel={() => setReactivateConfirm(null)}
          confirmButtonText="Reactivate"
          cancelButtonText="Cancel"
          variant="attention"
        />
      )}

      {showQuestionDetails && currentQuestion && (
        <QuestionDetailsPopup
          question={currentQuestion}
          questionStatistics={questionStatistics}
          quizStatus={quizStatus}
          onClose={() => {
            setShowQuestionDetails(null);
            setQuestionStatistics(null);
          }}
          onMakeLive={(questionId) => {
            // Prevent making questions live if quiz is in draft
            if (quizStatus === 'draft') {
              alert('Cannot make questions live while the quiz is in draft status. Please set the quiz to live first.');
              return;
            }
            const question = questions.find(q => q.id === questionId);
            if (question && (question.status === 'completed' || question.status === 'live')) {
              setReactivateConfirm({ questionId, questionNumber: question.order_index + 1 });
              setShowQuestionDetails(null);
            } else {
              handleMakeQuestionLive(questionId);
            }
          }}
          onEndQuestion={handleEndQuestion}
          onDeleteQuestion={(questionId) => {
            const question = questions.find(q => q.id === questionId);
            if (question) {
              handleDeleteClick(questionId, question.order_index + 1);
            }
          }}
          onViewAllAnswers={onViewAnswers}
          onViewImage={(url, title) => {
            setImagePreviewUrl(url);
            setImagePreviewTitle(title);
          }}
        />
      )}

      {imagePreviewUrl && (
        <ImagePreviewDialog
          imageUrl={imagePreviewUrl}
          title={imagePreviewTitle}
          onClose={() => {
            setImagePreviewUrl(null);
            setImagePreviewTitle('');
          }}
        />
      )}

      {deleteConfirm && (
        <ConfirmationDialog
          isOpen={!!deleteConfirm}
          title="Delete Question"
          message={`Are you sure you want to delete Question #${deleteConfirm.questionNumber}? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {reactivateConfirm && (
        <ConfirmationDialog
          isOpen={!!reactivateConfirm}
          title="Reactivate Question"
          message={`Are you sure you want to reactivate Question #${reactivateConfirm.questionNumber}? This will make it live again.`}
          confirmText="Reactivate"
          cancelText="Cancel"
          variant="attention"
          onConfirm={() => handleMakeQuestionLive(reactivateConfirm.questionId)}
          onCancel={() => setReactivateConfirm(null)}
        />
      )}
    </div>
  );
}

