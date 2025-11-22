import { Injectable, Inject } from '@nestjs/common';
import { Storage } from 'firebase-admin/storage';

@Injectable()
export class StorageService {
  constructor(@Inject('FIREBASE_STORAGE') private storage: Storage) {}

  private getBucket() {
    return this.storage.bucket();
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File): Promise<string> {
    const bucket = this.getBucket();
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `profile.${fileExtension}`;
    const filePath = `uploads/${userId}/${fileName}`;

    const fileRef = bucket.file(filePath);

    await fileRef.save(file.buffer, {
      contentType: file.mimetype,
      metadata: {
        metadata: {
          uploadedBy: userId,
          uploadType: 'profileImage',
        },
      },
    });

    // Get signed URL (valid for 1 year for profile images)
    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-09-2491', // Far future date
    });

    return url;
  }

  async uploadPaymentProof(userId: string, file: Express.Multer.File): Promise<string> {
    const bucket = this.getBucket();
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `payment-proof.${fileExtension}`;
    const filePath = `uploads/${userId}/${fileName}`;

    const fileRef = bucket.file(filePath);

    await fileRef.save(file.buffer, {
      contentType: file.mimetype,
      metadata: {
        metadata: {
          uploadedBy: userId,
          uploadType: 'paymentProof',
        },
      },
    });

    // Get signed URL (valid for 1 year)
    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-09-2491',
    });

    return url;
  }

  async uploadVoiceLine(
    heroName: string,
    file: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<string> {
    const bucket = this.getBucket();
    // Sanitize hero name for file path
    const sanitizedHeroName = heroName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const filePath = `voice-lines/${sanitizedHeroName}/${fileName}`;

    const fileRef = bucket.file(filePath);

    await fileRef.save(file, {
      contentType: mimeType,
      metadata: {
        metadata: {
          heroName: heroName,
          uploadType: 'voiceLine',
        },
      },
    });

    // Voice lines are public, get public URL
    await fileRef.makePublic();
    return fileRef.publicUrl();
  }

  async getSignedUrl(filePath: string, expiresInSeconds = 3600): Promise<string> {
    const bucket = this.getBucket();
    const fileRef = bucket.file(filePath);

    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
    });

    return url;
  }

  async uploadFile(
    folderPath: string,
    file: Express.Multer.File,
    makePublic = false,
  ): Promise<string> {
    const bucket = this.getBucket();
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = `${folderPath}/${fileName}`;

    const fileRef = bucket.file(filePath);

    await fileRef.save(file.buffer, {
      contentType: file.mimetype,
      metadata: {
        metadata: {
          originalName: file.originalname,
          uploadType: 'quizQuestion',
        },
      },
    });

    if (makePublic) {
      await fileRef.makePublic();
      return fileRef.publicUrl();
    }

    // Get signed URL (valid for 1 year)
    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-09-2491',
    });

    return url;
  }

  async deleteFile(filePath: string): Promise<void> {
    const bucket = this.getBucket();
    const fileRef = bucket.file(filePath);
    await fileRef.delete();
  }
}

