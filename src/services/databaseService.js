import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

// Initialize Supabase client
let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Key must be set in environment variables');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
  }

  return supabase;
}

/**
 * Database service for meetings
 */
class DatabaseService {
  /**
   * Create a new meeting
   * @param {Object} meetingData - Meeting data
   * @returns {Promise<Object>} Created meeting
   */
  async createMeeting(meetingData) {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('meetings')
        .insert({
          id: meetingData.id,
          meeting_url: meetingData.meetingUrl,
          grant_id: meetingData.grantId,
          status: meetingData.status || 'pending',
          notetaker_id: meetingData.notetakerId || null,
          transcript: meetingData.transcript || null,
          recording_url: meetingData.recording || null,
          note: meetingData.note || null,
          progress: meetingData.progress || { message: 'Meeting link added. Waiting to join...', percentage: 0 },
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating meeting:', error);
        throw error;
      }

      return this.mapDbToMeeting(data);
    } catch (error) {
      console.error('Database error creating meeting:', error);
      throw error;
    }
  }

  /**
   * Get meeting by ID
   * @param {string} meetingId - Meeting ID
   * @returns {Promise<Object|null>} Meeting or null
   */
  async getMeeting(meetingId) {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('Error getting meeting:', error);
        throw error;
      }

      return data ? this.mapDbToMeeting(data) : null;
    } catch (error) {
      console.error('Database error getting meeting:', error);
      throw error;
    }
  }

  /**
   * Get all meetings
   * @param {Object} options - Query options (limit, orderBy, etc.)
   * @returns {Promise<Array>} Array of meetings
   */
  async getAllMeetings(options = {}) {
    try {
      const client = getSupabaseClient();
      let query = client
        .from('meetings')
        .select('*');

      // Order by created_at descending by default
      query = query.order('created_at', { ascending: false });

      // Apply limit if provided
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting all meetings:', error);
        throw error;
      }

      return (data || []).map(meeting => this.mapDbToMeeting(meeting));
    } catch (error) {
      console.error('Database error getting all meetings:', error);
      throw error;
    }
  }

  /**
   * Update meeting
   * @param {string} meetingId - Meeting ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} Updated meeting or null
   */
  async updateMeeting(meetingId, updates) {
    try {
      const client = getSupabaseClient();
      
      // Map updates to database column names
      const dbUpdates = {};
      if (updates.meetingUrl !== undefined) dbUpdates.meeting_url = updates.meetingUrl;
      if (updates.grantId !== undefined) dbUpdates.grant_id = updates.grantId;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.notetakerId !== undefined) dbUpdates.notetaker_id = updates.notetakerId;
      if (updates.transcript !== undefined) dbUpdates.transcript = updates.transcript;
      if (updates.recording !== undefined) dbUpdates.recording_url = updates.recording;
      if (updates.note !== undefined) dbUpdates.note = updates.note;
      if (updates.progress !== undefined) dbUpdates.progress = updates.progress;

      const { data, error } = await client
        .from('meetings')
        .update(dbUpdates)
        .eq('id', meetingId)
        .select()
        .single();

      if (error) {
        console.error('Error updating meeting:', error);
        throw error;
      }

      return data ? this.mapDbToMeeting(data) : null;
    } catch (error) {
      console.error('Database error updating meeting:', error);
      throw error;
    }
  }

  /**
   * Update meeting progress
   * @param {string} meetingId - Meeting ID
   * @param {string} message - Progress message
   * @param {number} percentage - Progress percentage (0-100)
   * @returns {Promise<Object|null>} Updated meeting or null
   */
  async updateProgress(meetingId, message, percentage) {
    return this.updateMeeting(meetingId, {
      progress: { message, percentage },
    });
  }

  /**
   * Find meeting by notetaker ID
   * @param {string} notetakerId - Nylas Notetaker ID
   * @returns {Promise<Object|null>} Meeting or null
   */
  async findByNotetakerId(notetakerId) {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('meetings')
        .select('*')
        .eq('notetaker_id', notetakerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error finding meeting by notetaker ID:', error);
        throw error;
      }

      return data ? this.mapDbToMeeting(data) : null;
    } catch (error) {
      console.error('Database error finding meeting by notetaker ID:', error);
      throw error;
    }
  }

  /**
   * Map database row to meeting object (snake_case to camelCase)
   * @param {Object} dbRow - Database row
   * @returns {Object} Meeting object
   */
  mapDbToMeeting(dbRow) {
    return {
      id: dbRow.id,
      meetingUrl: dbRow.meeting_url,
      grantId: dbRow.grant_id,
      status: dbRow.status,
      notetakerId: dbRow.notetaker_id,
      transcript: dbRow.transcript,
      recording: dbRow.recording_url,
      note: dbRow.note,
      progress: dbRow.progress || { message: '', percentage: 0 },
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at,
    };
  }
}

export default new DatabaseService();

