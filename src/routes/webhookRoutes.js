import express from 'express';
import nylasService from '../services/nylasService.js';
import meetingService from '../services/meetingService.js';
import { generateNote } from '../services/noteGenerator.js';

const router = express.Router();

/**
 * Webhook challenge verification endpoint
 * GET /api/webhooks/nylas?challenge=xxx
 * Nylas sends a GET request with a challenge parameter to verify the webhook endpoint
 */
router.get('/nylas', (req, res) => {
  const challenge = req.query.challenge;

  if (challenge) {
    console.log('Webhook challenge received, responding with challenge value');
    // Respond with just the challenge value (no JSON, no extra formatting)
    res.status(200).send(challenge);
  } else {
    console.log('Webhook GET request received without challenge parameter');
    res.status(400).send('Missing challenge parameter');
  }
});

/**
 * Webhook endpoint for Nylas to send updates
 * POST /api/webhooks/nylas
 */
router.post('/nylas', async (req, res) => {
  try {
    const event = req.body;

    console.log('Received webhook event:', event.type);

    // Acknowledge webhook immediately
    res.status(200).json({ received: true });

    // Process webhook asynchronously
    processWebhookEvent(event);
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function processWebhookEvent(event) {
  try {
    const { type, data } = event;

    switch (type) {
      case 'notetaker.joined':
        // Bot joined the meeting
        updateMeetingByNotetakerId(data.notetaker_id, {
          status: 'recording',
        });
        updateProgressByNotetakerId(data.notetaker_id, 'Bot joined meeting. Recording...', 50);
        break;

      case 'notetaker.recording':
        // Bot is recording
        updateMeetingByNotetakerId(data.notetaker_id, {
          status: 'recording',
        });
        updateProgressByNotetakerId(data.notetaker_id, 'Recording in progress...', 70);
        break;

      case 'notetaker.completed':
        // Meeting completed, fetch transcript and generate note
        await handleMeetingCompleted(data.notetaker_id, data.grant_id);
        break;

      case 'notetaker.failed':
        // Bot failed to join or record
        updateMeetingByNotetakerId(data.notetaker_id, {
          status: 'failed',
        });
        updateProgressByNotetakerId(data.notetaker_id, 'Failed to record meeting', 0);
        break;

      default:
        console.log('Unknown webhook event type:', type);
    }
  } catch (error) {
    console.error('Error processing webhook event:', error);
  }
}

function updateMeetingByNotetakerId(notetakerId, updates) {
  const meetings = meetingService.getAllMeetings();
  const meeting = meetings.find(m => m.notetakerId === notetakerId);
  if (meeting) {
    meetingService.updateMeeting(meeting.id, updates);
  }
}

function updateProgressByNotetakerId(notetakerId, message, percentage) {
  const meetings = meetingService.getAllMeetings();
  const meeting = meetings.find(m => m.notetakerId === notetakerId);
  if (meeting) {
    meetingService.updateProgress(meeting.id, message, percentage);
  }
}

async function handleMeetingCompleted(notetakerId, grantId) {
  try {
    const meetings = meetingService.getAllMeetings();
    const meeting = meetings.find(m => m.notetakerId === notetakerId);

    if (!meeting) {
      console.error('Meeting not found for notetaker:', notetakerId);
      return;
    }

    // Update progress
    meetingService.updateProgress(meeting.id, 'Meeting completed. Generating note...', 90);

    // Fetch transcript
    try {
      const transcript = await nylasService.getTranscript(grantId, notetakerId);

      if (transcript) {
        meetingService.setTranscript(meeting.id, transcript);

        // Generate note
        const note = generateNote(transcript);
        meetingService.setNote(meeting.id, note);

        meetingService.updateProgress(meeting.id, 'Note generated successfully!', 100);
      }
    } catch (error) {
      console.error('Error fetching transcript:', error);
      meetingService.updateProgress(meeting.id, 'Error generating note', 0);
    }
  } catch (error) {
    console.error('Error handling meeting completion:', error);
  }
}

export default router;

