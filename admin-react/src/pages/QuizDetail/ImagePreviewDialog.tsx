import { Dialog } from '@primer/react';
import './ImagePreviewDialog.scss';

interface ImagePreviewDialogProps {
  imageUrl: string;
  title: string;
  onClose: () => void;
}

export default function ImagePreviewDialog({ imageUrl, title, onClose }: ImagePreviewDialogProps) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      renderBody={() => (
        <div className="image-preview-container">
          <img 
            src={imageUrl} 
            alt={title}
            className="image-preview"
          />
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

