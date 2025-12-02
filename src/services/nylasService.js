import axios from 'axios';
import { config } from '../config.js';

class NylasService {
  constructor() {
    this.apiKey = config.nylas.apiKey;
    this.baseURL = config.nylas.apiUrl;
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });
  }

  /**
   * Deploy a notetaker bot to a meeting
   * @param {string} grantId - The Nylas grant ID (user's connected account)
   * @param {string} meetingUrl - The Google Meet URL
   * @param {Object} options - Additional options for the notetaker
   * @returns {Promise<Object>} Notetaker deployment response
   */
  async deployNotetaker(grantId, meetingUrl, options = {}) {
    console.log(grantId, meetingUrl, options);
    try {
      const response = await this.client.post(
        `/v3/grants/${grantId}/notetakers`,
        {
          meeting_link: meetingUrl,
          ...options,
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error deploying notetaker:', error.response?.data || error.message);
      throw new Error(`Failed to deploy notetaker: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get notetaker status
   * @param {string} grantId - The Nylas grant ID
   * @param {string} notetakerId - The notetaker ID
   * @returns {Promise<Object>} Notetaker status
   */
  async getNotetakerStatus(grantId, notetakerId) {
    try {
      const response = await this.client.get(
        `/v3/grants/${grantId}/notetakers/${notetakerId}`
      );
      return response.data;
    } catch (error) {
      // Handle timeout and gateway errors gracefully
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        console.warn('⚠️  Timeout getting notetaker status (API may be slow)');
        throw new Error('Request timeout - Nylas API is taking longer than expected');
      }
      if (error.response?.status === 504 || error.response?.status === 502) {
        console.warn('⚠️  Gateway timeout/error getting notetaker status');
        throw new Error('Gateway timeout - Nylas API is temporarily unavailable');
      }
      console.error('Error getting notetaker status:', error.response?.data || error.message);
      throw new Error(`Failed to get notetaker status: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get notetaker transcript
   * @param {string} grantId - The Nylas grant ID
   * @param {string} notetakerId - The notetaker ID
   * @returns {Promise<Object>} Transcript data
   */
  async getTranscript(grantId, notetakerId) {
    try {
      const response = await this.client.get(
        `/v3/grants/${grantId}/notetakers/${notetakerId}/transcript`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting transcript:', error.response?.data || error.message);
      throw new Error(`Failed to get transcript: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get notetaker recording
   * @param {string} grantId - The Nylas grant ID
   * @param {string} notetakerId - The notetaker ID
   * @returns {Promise<Object>} Recording data
   */
  async getRecording(grantId, notetakerId) {
    try {
      const response = await this.client.get(
        `/v3/grants/${grantId}/notetakers/${notetakerId}/recording`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting recording:', error.response?.data || error.message);
      throw new Error(`Failed to get recording: ${error.response?.data?.message || error.message}`);
    }
  }
}

export default new NylasService();

