// In-memory storage for meetings (replace with database in production)
const meetings = new Map();

class MeetingService {
  /**
   * Create a new meeting entry
   * @param {string} meetingUrl - The Google Meet URL
   * @param {string} grantId - The Nylas grant ID
   * @returns {Object} Meeting object
   */
  createMeeting(meetingUrl, grantId) {
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

    meetings.set(meetingId, meeting);
    return meeting;
  }

  /**
   * Get meeting by ID
   * @param {string} meetingId - The meeting ID
   * @returns {Object|null} Meeting object or null
   */
  getMeeting(meetingId) {
    return meetings.get(meetingId) || null;
  }

  /**
   * Update meeting status
   * @param {string} meetingId - The meeting ID
   * @param {Object} updates - Fields to update
   * @returns {Object|null} Updated meeting or null
   */
  updateMeeting(meetingId, updates) {
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
   */
  updateProgress(meetingId, message, percentage) {
    const meeting = meetings.get(meetingId);
    if (!meeting) return;

    meeting.progress = { message, percentage };
    meeting.updatedAt = new Date().toISOString();
    meetings.set(meetingId, meeting);
  }

  /**
   * Get all meetings
   * @returns {Array} Array of all meetings
   */
  getAllMeetings() {
    return Array.from(meetings.values());
  }

  /**
   * Set notetaker ID for a meeting
   * @param {string} meetingId - The meeting ID
   * @param {string} notetakerId - The notetaker ID from Nylas
   */
  setNotetakerId(meetingId, notetakerId) {
    this.updateMeeting(meetingId, { notetakerId });
  }

  /**
   * Set transcript for a meeting
   * @param {string} meetingId - The meeting ID
   * @param {Object} transcript - Transcript data
   */
  setTranscript(meetingId, transcript) {
    this.updateMeeting(meetingId, { transcript });
  }

  /**
   * Set recording for a meeting
   * @param {string} meetingId - The meeting ID
   * @param {Object} recording - Recording data
   */
  setRecording(meetingId, recording) {
    this.updateMeeting(meetingId, { recording });
  }

  /**
   * Set generated note for a meeting
   * @param {string} meetingId - The meeting ID
   * @param {Object} note - Generated note
   */
  setNote(meetingId, note) {
    this.updateMeeting(meetingId, { note, status: 'completed' });
  }
}

export default new MeetingService();

