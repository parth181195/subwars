import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import { BunnyStorageConfig } from '../config/bunny-storage.config';

@Injectable()
export class BunnyStorageService {
  private config: BunnyStorageConfig;

  constructor(private configService: ConfigService) {
    this.config = this.configService.get<BunnyStorageConfig>('bunnyStorage')!;
  }

  /**
   * Upload a file to Bunny CDN Storage
   * @param filePath - Remote path in storage (e.g., 'voice-lines/voice-lines.json')
   * @param fileBuffer - File content as Buffer
   * @param contentType - MIME type (e.g., 'application/json', 'image/png')
   * @returns CDN URL of the uploaded file
   */
  async uploadFile(
    filePath: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const fileSize = fileBuffer.length;

      // Bunny CDN Storage API endpoint
      const hostname = `${this.config.region}.storage.bunnycdn.com`;
      // Encode the file path to handle special characters
      const encodedPath = filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
      const apiPath = `/${this.config.storageZone}/${encodedPath}`;

      const options = {
        hostname,
        path: apiPath,
        method: 'PUT',
        headers: {
          'AccessKey': this.config.apiKey,
          'Content-Type': contentType === 'application/json' ? 'application/octet-stream' : contentType, // Bunny CDN requires binary format
          'Content-Length': fileSize,
          'accept': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 201 || res.statusCode === 200) {
            // Construct the CDN URL
            const cdnUrl = `${this.config.cdnUrl}/${filePath}`;
            resolve(cdnUrl);
          } else {
            reject(
              new Error(
                `Bunny CDN upload failed with status ${res.statusCode}: ${responseData || res.statusMessage}`
              )
            );
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Bunny CDN request error: ${error.message}`));
      });

      // Upload the file
      req.write(fileBuffer);
      req.end();
    });
  }

  /**
   * Upload a file from Express Multer file
   * @param filePath - Remote path in storage
   * @param file - Express.Multer.File
   * @returns CDN URL of the uploaded file
   */
  async uploadFileFromMulter(
    filePath: string,
    file: Express.Multer.File,
  ): Promise<string> {
    return this.uploadFile(filePath, file.buffer, file.mimetype);
  }

  /**
   * Upload voice-lines.json file
   * @param fileBuffer - JSON file content as Buffer
   * @returns CDN URL of the uploaded file
   */
  async uploadVoiceLinesJson(fileBuffer: Buffer): Promise<string> {
    return this.uploadFile('voice-lines/voice-lines.json', fileBuffer, 'application/json');
  }

  /**
   * Upload an image file
   * @param filePath - Remote path (e.g., 'uploads/user-id/image.png')
   * @param fileBuffer - Image file content as Buffer
   * @param mimeType - Image MIME type (e.g., 'image/png', 'image/jpeg')
   * @returns CDN URL of the uploaded file
   */
  async uploadImage(
    filePath: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    return this.uploadFile(filePath, fileBuffer, mimeType);
  }

  /**
   * Delete a file from Bunny CDN Storage
   * @param filePath - Remote path in storage
   */
  async deleteFile(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const hostname = `${this.config.region}.storage.bunnycdn.com`;
      // Encode the file path to handle special characters
      const encodedPath = filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
      const apiPath = `/${this.config.storageZone}/${encodedPath}`;

      const options = {
        hostname,
        path: apiPath,
        method: 'DELETE',
        headers: {
          'AccessKey': this.config.apiKey,
        },
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 204 || res.statusCode === 404) {
            // 404 means file doesn't exist, which is fine for deletion
            resolve();
          } else {
            reject(
              new Error(
                `Bunny CDN delete failed with status ${res.statusCode}: ${responseData || res.statusMessage}`
              )
            );
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Bunny CDN request error: ${error.message}`));
      });

      req.end();
    });
  }

  /**
   * Get the CDN URL for a file path
   * @param filePath - Remote path in storage
   * @returns Full CDN URL
   */
  getCdnUrl(filePath: string): string {
    return `${this.config.cdnUrl}/${filePath}`;
  }
}

