import './LeaderboardTab.scss';

interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  total_score: number;
  total_answers: number;
  correct_answers: number;
  average_response_time: number;
}

interface LeaderboardTabProps {
  leaderboard: LeaderboardEntry[];
}

export default function LeaderboardTab({ leaderboard }: LeaderboardTabProps) {
  return (
    <div className="leaderboard-tab">
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
  );
}

