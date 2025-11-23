import { Dialog } from '@primer/react';
import './ViewAnswersDialog.scss';

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

interface ViewAnswersDialogProps {
  answers: Answer[];
  onClose: () => void;
}

export default function ViewAnswersDialog({ answers, onClose }: ViewAnswersDialogProps) {
  return (
    <Dialog
      title="Answers for Question"
      onClose={onClose}
      width="large"
      renderBody={() => (
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
              {answers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center">No answers yet</td>
                </tr>
              ) : (
                answers.map((answer) => (
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
      )}
      footerButtons={[
        {
          buttonType: 'default',
          content: 'Close',
          onClick: onClose,
        },
      ]}
    />
  );
}

