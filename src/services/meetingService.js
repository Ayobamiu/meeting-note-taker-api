import databaseService from './databaseService.js';

// Check if database is configured, fallback to in-memory if not
const useDatabase = process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

// Fallback in-memory storage (for development/testing without database)
const meetings = new Map();

class MeetingService {
  /**
   * Create a new meeting entry
   * @param {string} meetingUrl - The Google Meet URL
   * @param {string} grantId - The Nylas grant ID
   * @returns {Promise<Object>} Meeting object
   */
  async createMeeting(meetingUrl, grantId) {
    const meetingId = `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const meeting = {
      id: meetingId,
      meetingUrl,
      grantId,
      status: 'pending', // pending, joining, recording, completed, failed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notetakerId: null,
      transcript: null,
      recording: null,
      note: null,
      progress: {
        message: 'Meeting link added. Waiting to join...',
        percentage: 0,
      },
    };

    if (useDatabase) {
      try {
        return await databaseService.createMeeting(meeting);
      } catch (error) {
        console.error('Database error, falling back to in-memory:', error);
        // Fallback to in-memory
        meetings.set(meetingId, meeting);
        return meeting;
      }
    } else {
      meetings.set(meetingId, meeting);
      return meeting;
    }
  }

  /**
   * Get meeting by ID
   * @param {string} meetingId - The meeting ID
   * @returns {Promise<Object|null>} Meeting object or null
   */
  async getMeeting(meetingId) {
    if (useDatabase) {
      try {
        return await databaseService.getMeeting(meetingId);
      } catch (error) {
        console.error('Database error, falling back to in-memory:', error);
        return meetings.get(meetingId) || null;
      }
    }
    return meetings.get(meetingId) || null;
  }

  /**
   * Update meeting status
   * @param {string} meetingId - The meeting ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated meeting or null
   */
  async updateMeeting(meetingId, updates) {
    if (useDatabase) {
      try {
        return await databaseService.updateMeeting(meetingId, updates);
      } catch (error) {
        console.error('Database error, falling back to in-memory:', error);
        const meeting = meetings.get(meetingId);
        if (!meeting) return null;
        const updated = { ...meeting, ...updates, updatedAt: new Date().toISOString() };
        meetings.set(meetingId, updated);
        return updated;
      }
    }

    const meeting = meetings.get(meetingId);
    if (!meeting) return null;

    const updated = {
      ...meeting,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    meetings.set(meetingId, updated);
    return updated;
  }

  /**
   * Update meeting progress
   * @param {string} meetingId - The meeting ID
   * @param {string} message - Progress message
   * @param {number} percentage - Progress percentage (0-100)
   * @returns {Promise<void>}
   */
  async updateProgress(meetingId, message, percentage) {
    if (useDatabase) {
      try {
        await databaseService.updateProgress(meetingId, message, percentage);
        return;
      } catch (error) {
        console.error('Database error, falling back to in-memory:', error);
        const meeting = meetings.get(meetingId);
        if (!meeting) return;
        meeting.progress = { message, percentage };
        meeting.updatedAt = new Date().toISOString();
        meetings.set(meetingId, meeting);
        return;
      }
    }

    const meeting = meetings.get(meetingId);
    if (!meeting) return;

    meeting.progress = { message, percentage };
    meeting.updatedAt = new Date().toISOString();
    meetings.set(meetingId, meeting);
  }

  /**
   * Get all meetings
   * @returns {Promise<Array>} Array of all meetings
   */
  async getAllMeetings() {
    if (useDatabase) {
      try {
        return await databaseService.getAllMeetings();
      } catch (error) {
        console.error('Database error, falling back to in-memory:', error);
        return Array.from(meetings.values());
      }
    }
    return Array.from(meetings.values());
  }

  /**
   * Find meeting by notetaker ID
   * @param {string} notetakerId - The notetaker ID
   * @returns {Promise<Object|null>} Meeting or null
   */
  async findByNotetakerId(notetakerId) {
    if (useDatabase) {
      try {
        return await databaseService.findByNotetakerId(notetakerId);
      } catch (error) {
        console.error('Database error, falling back to in-memory:', error);
        const meetingsList = Array.from(meetings.values());
        return meetingsList.find(m => m.notetakerId === notetakerId) || null;
      }
    }

    const meetingsList = Array.from(meetings.values());
    return meetingsList.find(m => m.notetakerId === notetakerId) || null;
  }

  /**
   * Set notetaker ID for a meeting
   * @param {string} meetingId - The meeting ID
   * @param {string} notetakerId - The notetaker ID from Nylas
   * @returns {Promise<void>}
   */
  async setNotetakerId(meetingId, notetakerId) {
    await this.updateMeeting(meetingId, { notetakerId });
  }

  /**
   * Set transcript for a meeting
   * @param {string} meetingId - The meeting ID
   * @param {Object} transcript - Transcript data
   * @returns {Promise<void>}
   */
  async setTranscript(meetingId, transcript) {
    await this.updateMeeting(meetingId, { transcript });
  }

  /**
   * Set recording for a meeting
   * @param {string} meetingId - The meeting ID
   * @param {string} recording - Recording URL
   * @returns {Promise<void>}
   */
  async setRecording(meetingId, recording) {
    await this.updateMeeting(meetingId, { recording });
  }

  /**
   * Set generated note for a meeting
   * @param {string} meetingId - The meeting ID
   * @param {Object} note - Generated note
   * @returns {Promise<void>}
   */
  async setNote(meetingId, note) {
    await this.updateMeeting(meetingId, { note, status: 'completed' });
  }
}

export default new MeetingService();

