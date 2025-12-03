# AWS S3 Setup for Recordings

This application automatically uploads meeting recordings to AWS S3 for persistent storage.

## Prerequisites

1. An AWS account
2. An S3 bucket created in your AWS account
3. AWS credentials (Access Key ID and Secret Access Key) with permissions to upload to S3

## Configuration

Add the following environment variables to your `.env` file:

```env
# AWS S3 Configuration
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
S3_BUCKET_NAME=meeting-recordings
```

## Creating an S3 Bucket

1. Log in to the AWS Console
2. Navigate to S3 service
3. Click "Create bucket"
4. Enter a unique bucket name (e.g., `meeting-recordings`)
5. Select your preferred region (e.g., `us-west-2`)
6. Configure bucket settings as needed
7. Click "Create bucket"

## IAM Permissions

Your AWS credentials need the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::meeting-recordings/*"
    }
  ]
}
```

## How It Works

1. When a meeting recording becomes available from Nylas, the webhook handler receives the recording URL
2. The application downloads the recording from Nylas
3. The recording is uploaded to S3 with the path: `recordings/{meeting_id}/{timestamp}.mp3`
4. The S3 URL is stored in the database instead of the original Nylas URL
5. If S3 upload fails, the original Nylas URL is used as a fallback

## File Structure in S3

Recordings are stored with the following structure:
```
recordings/
  ├── {meeting_id_1}/
  │   └── {timestamp}.mp3
  ├── {meeting_id_2}/
  │   └── {timestamp}.mp3
  └── ...
```

## Troubleshooting

- **"S3 not configured" warning**: Make sure all S3 environment variables are set in your `.env` file
- **Upload failures**: Check that your AWS credentials have the correct permissions and that the bucket name is correct
- **Timeout errors**: Large recordings may take longer to upload. The timeout is set to 30 seconds by default

