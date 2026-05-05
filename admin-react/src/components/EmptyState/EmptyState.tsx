import { type ReactNode } from 'react';
import './EmptyState.scss';

interface EmptyStateProps {
  title?: string;
  message: string | ReactNode;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title,
  message,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-container">
        {icon && <div className="empty-state-icon">{icon}</div>}
        {title && <h3 className="empty-state-title">{title}</h3>}
        <div className="empty-state-message">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>
        {onAction && actionLabel && (
          <button className="empty-state-button" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

