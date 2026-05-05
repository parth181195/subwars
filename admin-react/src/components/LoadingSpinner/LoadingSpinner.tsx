import './LoadingSpinner.scss';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullPage?: boolean;
}

export default function LoadingSpinner({
  message = 'Loading...',
  size = 'medium',
  fullPage = false,
}: LoadingSpinnerProps) {
  const containerClass = fullPage
    ? 'loading-spinner-container full-page'
    : 'loading-spinner-container';

  return (
    <div className={containerClass}>
      <div className={`loading-spinner spinner-${size}`}></div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
}

