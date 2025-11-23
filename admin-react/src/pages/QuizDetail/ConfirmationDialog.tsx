import { Dialog } from '@primer/react';
import './ConfirmationDialog.scss';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default' | 'attention';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog
      title={title}
      onClose={onCancel}
      renderBody={() => (
        <div className="confirmation-dialog-content">
          <p>{message}</p>
        </div>
      )}
      footerButtons={[
        {
          buttonType: 'default',
          content: cancelText,
          onClick: onCancel,
        },
        {
          buttonType: variant,
          content: confirmText,
          onClick: onConfirm,
        },
      ]}
    />
  );
}

