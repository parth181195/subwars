import { useEffect, useState } from 'react';
import { Button, TextInput, Dialog } from '@primer/react';
import { CopyIcon, DownloadIcon } from '@primer/octicons-react';
import { getAuthHeaders } from '../../utils/api-client';
import { environment } from '../../config/environment';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import { useToast } from '../../components/Toast/ToastContainer';
import './CombinedLeaderboard.scss';

const API_BASE_URL = environment.apiBaseUrl || 'http://localhost:3000';

interface CombinedLeaderboardEntry {
  user_id: string;
  user_name: string;
  user_email?: string;
  total_score: number;
  total_answers: number;
  correct_answers: number;
  average_response_time: number;
  quizzes_played: number;
}

export default function CombinedLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<CombinedLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenEmails, setHiddenEmails] = useState<string[]>([]);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showHideEmailDialog, setShowHideEmailDialog] = useState(false);
  const [emailToHide, setEmailToHide] = useState('');
  const [resetting, setResetting] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    fetchLeaderboard();
    fetchHiddenEmails();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/leaderboard/combined`, { headers });
      
      if (response.ok) {
        const data = await response.json();
        // Validate data is an array
        if (Array.isArray(data)) {
          setLeaderboard(data);
        } else {
          setError('Invalid leaderboard data received');
        }
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        setError(`Failed to fetch leaderboard: ${response.status} ${errorText}`);
      }
    } catch {
      setError('Failed to fetch leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchHiddenEmails = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/leaderboard/hidden-emails`, { headers });
      if (response.ok) {
        const data = await response.json();
        // Validate hiddenEmails is an array
        if (data && Array.isArray(data.hiddenEmails)) {
          setHiddenEmails(data.hiddenEmails);
        } else {
          setHiddenEmails([]);
        }
      }
    } catch {
      // Ignore errors
    }
  };

  const handleResetLeaderboard = async () => {
    try {
      setResetting(true);
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/leaderboard/combined`, {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        addToast({
          type: 'success',
          title: 'Leaderboard Reset',
          message: `Successfully reset combined leaderboard. Deleted ${data.deletedAnswers} answers.`,
          duration: 5000,
        });
        setShowResetDialog(false);
        fetchLeaderboard();
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

  const handleHideEmail = async () => {
    if (!emailToHide.trim()) {
      addToast({
        type: 'warning',
        title: 'Validation Error',
        message: 'Please enter an email address',
        duration: 3000,
      });
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/leaderboard/hide-email`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailToHide.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setHiddenEmails(data.hiddenEmails);
        setEmailToHide('');
        setShowHideEmailDialog(false);
        fetchLeaderboard();
        addToast({
          type: 'success',
          title: 'Email Hidden',
          message: `Email ${emailToHide.trim()} hidden from leaderboard`,
          duration: 4000,
        });
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to hide email' }));
        addToast({
          type: 'error',
          title: 'Hide Email Failed',
          message: errorData.message,
          duration: 5000,
        });
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Hide Email Failed',
        message: 'Failed to hide email. Please try again.',
        duration: 5000,
      });
    }
  };

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
    const headers = ['Rank', 'User Name', 'Email', 'Total Score', 'Quizzes Played', 'Correct Answers', 'Total Answers', 'Avg Response Time (s)'];
    
    // Create CSV rows (with validation)
    const rows = (Array.isArray(leaderboard) ? leaderboard : []).map((entry, index) => [
      (index + 1).toString(),
      entry?.user_name || '',
      entry?.user_email || '',
      (entry?.total_score || 0).toString(),
      (entry?.quizzes_played || 0).toString(),
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
    link.setAttribute('download', `combined-leaderboard-${new Date().toISOString().split('T')[0]}.csv`);
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

  const handleShowEmail = async (email: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/admin/quizzes/leaderboard/show-email`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const data = await response.json();
        setHiddenEmails(data.hiddenEmails);
        fetchLeaderboard();
        addToast({
          type: 'success',
          title: 'Email Shown',
          message: `Email ${email} shown in leaderboard`,
          duration: 4000,
        });
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to show email' }));
        addToast({
          type: 'error',
          title: 'Show Email Failed',
          message: errorData.message,
          duration: 5000,
        });
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Show Email Failed',
        message: 'Failed to show email. Please try again.',
        duration: 5000,
      });
    }
  };

  if (loading) {
    return (
      <div className="combined-leaderboard-page">
        <LoadingSpinner message="Loading combined leaderboard..." fullPage />
      </div>
    );
  }

  if (error) {
    return (
      <div className="combined-leaderboard-page">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={fetchLeaderboard}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="combined-leaderboard-page">
      <div className="page-header">
        <div>
        <h1>Combined Leaderboard</h1>
        <p className="page-description">Overall rankings across all quizzes</p>
        </div>
        <div className="header-actions">
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
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowHideEmailDialog(true);
            }}
          >
            Hide Email
          </Button>
        </div>
      </div>

      {hiddenEmails.length > 0 && (
        <div className="hidden-emails-section">
          <h3>Hidden Emails ({hiddenEmails.length})</h3>
          <div className="hidden-emails-list">
            {hiddenEmails.map((email) => (
              <div key={email} className="hidden-email-item">
                <span>{email}</span>
                <Button 
                  size="small" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleShowEmail(email);
                  }}
                >
                  Show
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showResetDialog && (
        <Dialog
          title="Reset Combined Leaderboard"
          onClose={() => setShowResetDialog(false)}
          renderBody={() => (
            <div style={{ padding: '16px' }}>
              <p>Are you sure you want to reset the combined leaderboard?</p>
              <p style={{ color: 'red', fontWeight: 'bold' }}>
                This will soft delete ALL answers across ALL quizzes. This action cannot be undone.
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

      {showHideEmailDialog && (
        <Dialog
          title="Hide Email from Leaderboard"
          onClose={() => setShowHideEmailDialog(false)}
          renderBody={() => (
            <div style={{ padding: '16px' }}>
              <p>Enter the email address to hide from the leaderboard:</p>
              <TextInput
                type="email"
                value={emailToHide}
                onChange={(e) => setEmailToHide(e.target.value)}
                placeholder="user@example.com"
                style={{ width: '100%', marginTop: '8px' }}
              />
            </div>
          )}
          renderFooter={() => (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' , padding: '16px'}}>
              <Button onClick={() => setShowHideEmailDialog(false)}>Cancel</Button>
              <Button onClick={handleHideEmail}>Hide Email</Button>
            </div>
          )}
        />
      )}

      {leaderboard.length === 0 ? (
        <div className="empty-state">
          <p>No entries yet. Participants will appear here once they submit answers in any quiz.</p>
        </div>
      ) : (
        <div className="leaderboard-table">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>User</th>
                <th>Total Score</th>
                <th>Quizzes Played</th>
                <th>Correct Answers</th>
                <th>Total Answers</th>
                <th>Avg Response Time</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                <tr key={entry.user_id}>
                  <td className="rank-cell">
                    {index === 0 && <span className="rank-badge gold">🥇</span>}
                    {index === 1 && <span className="rank-badge silver">🥈</span>}
                    {index === 2 && <span className="rank-badge bronze">🥉</span>}
                    <span className="rank-number">{index + 1}</span>
                  </td>
                  <td className="user-cell">{entry.user_name || 'Unknown'}</td>
                  <td className="score-cell">{(entry.total_score || 0).toLocaleString()}</td>
                  <td className="quizzes-cell">{entry.quizzes_played || 0}</td>
                  <td className="correct-cell">{entry.correct_answers || 0}</td>
                  <td className="total-cell">{entry.total_answers || 0}</td>
                  <td className="time-cell">{((entry.average_response_time || 0) / 1000).toFixed(2)}s</td>
                  <td className="email-cell">
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

