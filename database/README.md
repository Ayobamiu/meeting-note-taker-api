# Database Schema - Supabase

## Overview

This project uses Supabase (PostgreSQL) for persistent storage of meetings and generated notes.

## Schema

### `meetings` Table

Stores all meeting information, transcripts, and generated notes.

| Column          | Type        | Description                                                                            |
| --------------- | ----------- | -------------------------------------------------------------------------------------- |
| `id`            | TEXT (PK)   | Unique meeting identifier                                                              |
| `meeting_url`   | TEXT        | Google Meet URL                                                                        |
| `grant_id`      | TEXT        | Nylas Grant ID                                                                         |
| `status`        | TEXT        | Meeting status: `pending`, `joining`, `recording`, `processing`, `completed`, `failed` |
| `notetaker_id`  | TEXT        | Nylas Notetaker ID (nullable)                                                          |
| `transcript`    | JSONB       | Full transcript JSON from Nylas (nullable)                                             |
| `recording_url` | TEXT        | URL to recording file (nullable)                                                       |
| `note`          | JSONB       | Generated note JSON (nullable)                                                         |
| `progress`      | JSONB       | Progress tracking: `{message: string, percentage: number}`                             |
| `created_at`    | TIMESTAMPTZ | Creation timestamp                                                                     |
| `updated_at`    | TIMESTAMPTZ | Last update timestamp (auto-updated)                                                   |

## Indexes

- `idx_meetings_grant_id` - Fast lookup by grant ID
- `idx_meetings_notetaker_id` - Fast lookup by notetaker ID
- `idx_meetings_status` - Filter by status
- `idx_meetings_created_at` - Sort by creation date
- `idx_meetings_updated_at` - Sort by update date
- `idx_meetings_note` (GIN) - Full-text search in notes
- `idx_meetings_transcript` (GIN) - Full-text search in transcripts

## JSONB Structure

### `transcript` JSONB

```json
{
  "object": "transcript",
  "type": "speaker_labelled",
  "transcript": [
    {
      "speaker": "Speaker Name",
      "start": 15120,
      "end": 100330,
      "text": "Transcript text..."
    }
  ]
}
```

### `note` JSONB

```json
{
  "summary": "Meeting summary...",
  "keyPoints": ["Point 1", "Point 2"],
  "participants": ["Speaker 1", "Speaker 2"],
  "duration": 1800,
  "wordCount": 500,
  "generatedAt": "2024-01-01T12:00:00.000Z",
  "transcriptType": "speaker_labelled"
}
```

### `progress` JSONB

```json
{
  "message": "Recording in progress...",
  "percentage": 60
}
```

## Setup Instructions

1. **Create Supabase Project**

   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and anon key

2. **Run Schema**

   - Open Supabase SQL Editor
   - Copy and paste contents of `schema.sql`
   - Execute the script

3. **Get Connection String**

   - Go to Project Settings > Database
   - Copy the connection string (use the "Connection string" tab)
   - Format: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`

4. **Environment Variables**
   Add to your `.env`:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key (for server-side)
   DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
   ```

## Future Enhancements

- **User Authentication**: Add `user_id` column for multi-user support
- **Soft Deletes**: Add `deleted_at` column
- **Archiving**: Separate table for archived meetings
- **Search**: Full-text search on transcripts and notes
- **Analytics**: Separate table for meeting analytics
