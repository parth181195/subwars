import { type ReactNode } from 'react';
import './ErrorState.scss';

interface ErrorStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export default function ErrorState({
  title = 'Error',
  message,
  actionLabel = 'Go Back',
  onAction,
  icon,
}: ErrorStateProps) {
  return (
    <div className="error-state">
      <div className="error-state-container">
        {icon && <div className="error-state-icon">{icon}</div>}
        <h2 className="error-state-title">{title}</h2>
        <p className="error-state-message">{message}</p>
        {onAction && (
          <button className="error-state-button" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

