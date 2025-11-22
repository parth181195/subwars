import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { quizAuthService } from '../../services/auth';
import './Profile.scss';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(quizAuthService.user);

  useEffect(() => {
    const unsubscribe = quizAuthService.subscribe((currentUser) => {
      if (!currentUser) {
        navigate('/login');
      } else {
        setUser(currentUser);
      }
    });

    // Check if user is logged in
    if (!quizAuthService.isAuthenticated) {
      navigate('/login');
      return unsubscribe;
    }

    return unsubscribe;
  }, [navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h1 className="profile-title">Profile</h1>

        {/* User Info Section */}
        <div className="profile-section">
          <div className="profile-header">
            {user.profile_image_url ? (
              <img
                src={user.profile_image_url}
                alt={user.full_name || user.email || 'Profile'}
                className="profile-image"
              />
            ) : (
              <div className="profile-image-placeholder">
                {user.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="profile-info">
              <h2 className="profile-name">{user.full_name || 'User'}</h2>
              <p className="profile-email">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Quiz Section - Hidden for now */}
        {/* <div className="profile-section">
          <h2 className="section-title">Quiz</h2>
          <p className="section-description">
            You can participate in quizzes anytime. Login with Google to get started.
          </p>
          <Button
            variant="primary"
            onClick={() => navigate('/quiz')}
            className="quiz-button"
          >
            Go to Quiz
          </Button>
        </div> */}
      </div>
    </div>
  );
}
