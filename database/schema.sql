-- Supabase Database Schema for Meeting Note Taker
-- Run this in your Supabase SQL Editor

-- Create meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  meeting_url TEXT NOT NULL,
  grant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'joining', 'recording', 'processing', 'completed', 'failed')),
  notetaker_id TEXT,
  transcript JSONB,
  recording_url TEXT,
  note JSONB,
  progress JSONB NOT NULL DEFAULT '{"message": "Meeting link added. Waiting to join...", "percentage": 0}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_meetings_grant_id ON meetings(grant_id);
CREATE INDEX IF NOT EXISTS idx_meetings_notetaker_id ON meetings(notetaker_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_updated_at ON meetings(updated_at DESC);

-- Create index on JSONB fields for querying
CREATE INDEX IF NOT EXISTS idx_meetings_note ON meetings USING GIN (note);
CREATE INDEX IF NOT EXISTS idx_meetings_transcript ON meetings USING GIN (transcript);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update updated_at on row update
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE meetings IS 'Stores meeting information and generated notes';
COMMENT ON COLUMN meetings.id IS 'Unique meeting identifier';
COMMENT ON COLUMN meetings.meeting_url IS 'Google Meet URL';
COMMENT ON COLUMN meetings.grant_id IS 'Nylas Grant ID';
COMMENT ON COLUMN meetings.status IS 'Current meeting status';
COMMENT ON COLUMN meetings.notetaker_id IS 'Nylas Notetaker ID';
COMMENT ON COLUMN meetings.transcript IS 'Full transcript JSON from Nylas';
COMMENT ON COLUMN meetings.recording_url IS 'URL to recording file';
COMMENT ON COLUMN meetings.note IS 'Generated note JSON';
COMMENT ON COLUMN meetings.progress IS 'Progress tracking object with message and percentage';

