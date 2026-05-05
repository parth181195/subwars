import { useEffect, useState } from 'react';
import { environment } from '../../config/environment';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import './Leaderboard.scss';

const API_BASE_URL = environment.apiUrl;

interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  user_email?: string;
  total_score: number;
  total_answers: number;
  correct_answers: number;
  average_response_time: number;
  quizzes_played: number;
}

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/quiz/leaderboard/combined`);
      
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

  if (loading) {
    return (
      <div className="leaderboard-page">
        <LoadingSpinner message="Loading leaderboard..." fullPage />
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard-page">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={fetchLeaderboard}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-container">
        <h1 className="leaderboard-title">Combined Leaderboard</h1>
        <p className="leaderboard-description">Overall rankings across all contests</p>

        {leaderboard.length === 0 ? (
          <div className="empty-state">
            <p>No entries yet. Participants will appear here once they submit answers in any contest.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="leaderboard-table">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>User</th>
                    <th>Total Score</th>
                    <th>Contests Played</th>
                    <th>Correct Answers</th>
                    <th>Total Answers</th>
                    <th>Avg Response Time</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => {
                    // Map rank to medal image: 1st place = 8.png, 2nd = 7.png, etc.
                    // Top 8 positions get medals
                    const medalNumber = index < 8 ? 8 - index : null;
                    
                    return (
                      <tr key={entry.user_id}>
                        <td className="rank-cell">
                          {medalNumber && (
                            <img 
                              src={`/assets/medals/${medalNumber}.png`} 
                              alt={`Rank ${index + 1} Medal`} 
                              className="rank-badge"
                            />
                          )}
                          <span className="rank-number">{index + 1}</span>
                        </td>
                        <td className="user-cell">{entry.user_name}</td>
                        <td className="score-cell">{entry.total_score.toLocaleString()}</td>
                        <td className="quizzes-cell">{entry.quizzes_played}</td>
                        <td className="correct-cell">{entry.correct_answers}</td>
                        <td className="total-cell">{entry.total_answers}</td>
                        <td className="time-cell">{(entry.average_response_time / 1000).toFixed(2)}s</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="leaderboard-cards">
              {leaderboard.map((entry, index) => {
                const medalNumber = index < 8 ? 8 - index : null;
                
                return (
                  <div key={entry.user_id} className="leaderboard-card">
                    <div className="card-header">
                      <div className="card-rank">
                        {medalNumber && (
                          <img 
                            src={`/assets/medals/${medalNumber}.png`} 
                            alt={`Rank ${index + 1} Medal`} 
                            className="card-rank-badge"
                          />
                        )}
                        <span className="card-rank-number">#{index + 1}</span>
                      </div>
                      <div className="card-user">{entry.user_name}</div>
                    </div>
                    <div className="card-body">
                      <div className="card-stat">
                        <span className="card-stat-label">Total Score</span>
                        <span className="card-stat-value card-stat-score">{entry.total_score.toLocaleString()}</span>
                      </div>
                      <div className="card-stats-grid">
                        <div className="card-stat">
                          <span className="card-stat-label">Contests</span>
                          <span className="card-stat-value">{entry.quizzes_played}</span>
                        </div>
                        <div className="card-stat">
                          <span className="card-stat-label">Correct</span>
                          <span className="card-stat-value">{entry.correct_answers}</span>
                        </div>
                        <div className="card-stat">
                          <span className="card-stat-label">Total</span>
                          <span className="card-stat-value">{entry.total_answers}</span>
                        </div>
                        <div className="card-stat">
                          <span className="card-stat-label">Avg Time</span>
                          <span className="card-stat-value">{(entry.average_response_time / 1000).toFixed(2)}s</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

