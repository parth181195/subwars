import { useState } from 'react';
import { Button, Dialog } from '@primer/react';
import { CopyIcon, DownloadIcon } from '@primer/octicons-react';
import { getAuthHeaders } from '../../utils/api-client';
import { environment } from '../../config/environment';
import { useToast } from '../../components/Toast/ToastContainer';
import './LeaderboardTab.scss';

const API_BASE_URL = environment.apiBaseUrl || 'http://localhost:3000';

interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  user_email?: string;
  total_score: number;
  total_answers: number;
  correct_answers: number;
  average_response_time: number;
}

interface LeaderboardTabProps {
  leaderboard: LeaderboardEntry[];
  quizId: string;
  quizName?: string;
  onRefresh: () => void;
}

export default function LeaderboardTab({ leaderboard, quizId, quizName, onRefresh }: LeaderboardTabProps) {
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { addToast } = useToast();

  const handleCopyEmail = async (email: string | undefined, userName: string) => {
    if (!email || !email.trim()) {
      addToast({
        type: 'warning',
        title: 'No Email',
        message: `No email address available for ${userName}.`,
        duration: 3000,
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(email);
      addToast({
        type: 'success',
        title: 'Email Copied',
        message: `Copied ${email} to clipboard.`,
        duration: 3000,
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Copy Failed',
        message: 'Failed to copy email to clipboard. Please try again.',
        duration: 3000,
      });
    }
  };

  const handleDownloadCSV = () => {
    if (leaderboard.length === 0) {
      addToast({
        type: 'warning',
        title: 'No Data',
        message: 'No leaderboard data available to download.',
        duration: 3000,
      });
      return;
    }

    // Create CSV header
    const headers = ['Rank', 'User Name', 'Email', 'Total Score', 'Correct Answers', 'Total Answers', 'Avg Response Time (s)'];
    
    // Create CSV rows (with validation)
    const rows = (Array.isArray(leaderboard) ? leaderboard : []).map((entry, index) => [
      (index + 1).toString(),
      entry?.user_name || '',
      entry?.user_email || '',
      (entry?.total_score || 0).toString(),
      (entry?.correct_answers || 0).toString(),
      (entry?.total_answers || 0).toString(),
      ((entry?.average_response_time || 0) / 1000).toFixed(2),
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape commas and quotes in cell content
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
    
    // Create filename with quiz name or ID
    const safeQuizName = quizName ? quizName.replace(/[^a-z0-9]/gi, '-').toLowerCase() : `quiz-${quizId}`;
    link.setAttribute('download', `${safeQuizName}-leaderboard-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addToast({
      type: 'success',
      title: 'CSV Downloaded',
      message: `Successfully downloaded leaderboard with ${leaderboard.length} entries.`,
      duration: 3000,
    });
  };

  const handleResetLeaderboard = async () => {
    try {
      setResetting(true);
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/${quizId}/leaderboard`, {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        addToast({
          type: 'success',
          title: 'Leaderboard Reset',
          message: `Successfully reset leaderboard. Deleted ${data.deletedAnswers} answers.`,
          duration: 5000,
        });
        setShowResetDialog(false);
        onRefresh();
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to reset leaderboard' }));
        addToast({
          type: 'error',
          title: 'Reset Failed',
          message: errorData.message,
          duration: 5000,
        });
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Reset Failed',
        message: 'Failed to reset leaderboard. Please try again.',
        duration: 5000,
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="leaderboard-tab">
      <div className="leaderboard-header">
      <h2>Leaderboard</h2>
        <div className="leaderboard-actions">
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDownloadCSV();
            }}
            leadingVisual={DownloadIcon}
          >
            Download CSV
          </Button>
          <Button 
            variant="danger" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowResetDialog(true);
            }}
          >
            Reset Leaderboard
          </Button>
        </div>
      </div>

      {showResetDialog && (
        <Dialog
          title="Reset Quiz Leaderboard"
          onClose={() => setShowResetDialog(false)}
          renderBody={() => (
            <div style={{ padding: '16px' }}>
              <p>Are you sure you want to reset the leaderboard for this quiz?</p>
              <p style={{ color: 'red', fontWeight: 'bold' }}>
                This will delete ALL answers for this quiz. This action cannot be undone.
              </p>
            </div>
          )}
          renderFooter={() => (
            <>
              <Button onClick={() => setShowResetDialog(false)}>Cancel</Button>
              <Button variant="danger" onClick={handleResetLeaderboard} disabled={resetting}>
                {resetting ? 'Resetting...' : 'Reset Leaderboard'}
              </Button>
            </>
          )}
        />
      )}
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
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                <tr key={entry.user_id}>
                  <td>{index + 1}</td>
                  <td>{entry.user_name || 'Unknown'}</td>
                  <td>{entry.total_score || 0}</td>
                  <td>{entry.correct_answers || 0}</td>
                  <td>{entry.total_answers || 0}</td>
                  <td>{((entry.average_response_time || 0) / 1000).toFixed(2)}s</td>
                  <td>
                    {entry.user_email ? (
                      <Button
                        size="small"
                        variant="invisible"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCopyEmail(entry.user_email, entry.user_name);
                        }}
                        leadingVisual={CopyIcon}
                        aria-label={`Copy email for ${entry.user_name}`}
                      >
                      </Button>
                    ) : (
                      <span style={{ color: '#8b949e' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

