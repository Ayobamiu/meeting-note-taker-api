import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import axios from 'axios';
import { config } from '../config.js';

class S3Service {
    constructor() {
        if (config.s3.region && config.s3.accessKeyId && config.s3.secretAccessKey) {
            this.client = new S3Client({
                region: config.s3.region,
                credentials: {
                    accessKeyId: config.s3.accessKeyId,
                    secretAccessKey: config.s3.secretAccessKey,
                },
            });
            this.bucketName = config.s3.bucketName;
            this.enabled = true;
        } else {
            this.enabled = false;
            console.warn('⚠️  S3 not configured. Recordings will not be saved to S3.');
        }
    }

    /**
     * Upload a file from a URL to S3
     * @param {string} fileUrl - URL of the file to download and upload
     * @param {string} key - S3 object key (path)
     * @param {string} contentType - MIME type of the file
     * @returns {Promise<string>} S3 URL of the uploaded file
     */
    async uploadFromUrl(fileUrl, key, contentType = 'audio/mpeg') {
        if (!this.enabled) {
            console.warn('S3 not enabled, skipping upload');
            return fileUrl; // Return original URL if S3 not configured
        }

        try {
            console.log(`📤 Uploading to S3: ${key}`);

            // Download the file from the URL
            const response = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
                timeout: 30000, // 30 second timeout
            });

            const fileBuffer = Buffer.from(response.data);

            // Upload to S3
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: fileBuffer,
                ContentType: contentType,
            });

            await this.client.send(command);

            // Return S3 URL
            const s3Url = `https://${this.bucketName}.s3.${config.s3.region}.amazonaws.com/${key}`;
            console.log(`✅ Uploaded to S3: ${s3Url}`);

            return s3Url;
        } catch (error) {
            console.error('❌ Error uploading to S3:', error.message);
            // Return original URL as fallback
            return fileUrl;
        }
    }

    /**
     * Upload a buffer directly to S3
     * @param {Buffer} buffer - File buffer
     * @param {string} key - S3 object key (path)
     * @param {string} contentType - MIME type of the file
     * @returns {Promise<string>} S3 URL of the uploaded file
     */
    async uploadBuffer(buffer, key, contentType = 'audio/mpeg') {
        if (!this.enabled) {
            console.warn('S3 not enabled, skipping upload');
            return null;
        }

        try {
            console.log(`📤 Uploading buffer to S3: ${key}`);

            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                ContentType: contentType,
            });

            await this.client.send(command);

            const s3Url = `https://${this.bucketName}.s3.${config.s3.region}.amazonaws.com/${key}`;
            console.log(`✅ Uploaded to S3: ${s3Url}`);

            return s3Url;
        } catch (error) {
            console.error('❌ Error uploading buffer to S3:', error.message);
            throw error;
        }
    }

    /**
     * Generate a presigned URL for accessing a file
     * @param {string} key - S3 object key
     * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
     * @returns {Promise<string>} Presigned URL
     */
    async getPresignedUrl(key, expiresIn = 3600) {
        if (!this.enabled) {
            return null;
        }

        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            const url = await getSignedUrl(this.client, command, { expiresIn });
            return url;
        } catch (error) {
            console.error('❌ Error generating presigned URL:', error.message);
            return null;
        }
    }
}

export default new S3Service();

