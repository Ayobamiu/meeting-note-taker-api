import express from 'express';
import axios from 'axios';
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

    console.log('\n=== Webhook Event Received ===');
    console.log('Event Type:', event.type);
    console.log('Event Data:', JSON.stringify(event.data, null, 2));
    console.log('==============================\n');

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

    // Extract notetaker data - handle both direct data and nested object structure
    const notetakerData = data.object || data;
    const notetakerId = notetakerData.id || data.notetaker_id || data.id;
    const grantId = notetakerData.grant_id || data.grant_id || data.grant?.id;

    switch (type) {
      case 'notetaker.created':
        // Notetaker bot was created/deployed
        console.log('✅ Notetaker created:', notetakerId);
        if (notetakerId) {
          // Try to find meeting that doesn't have a notetakerId yet but matches grant_id
          const meetings = meetingService.getAllMeetings();
          const meeting = meetings.find(m =>
            !m.notetakerId && grantId && m.grantId === grantId
          ) || meetings.find(m => m.notetakerId === notetakerId);

          if (meeting) {
            meetingService.updateMeeting(meeting.id, {
              status: 'joining',
              notetakerId: notetakerId,
            });
            meetingService.updateProgress(meeting.id, 'Notetaker created. Waiting to join meeting...', 20);
            console.log(`   ✅ Linked notetaker ${notetakerId} to meeting ${meeting.id}`);
          } else {
            // Store for later matching when meeting_state events come in
            updateMeetingByNotetakerId(notetakerId, {
              status: 'joining',
              notetakerId: notetakerId,
            });
            updateProgressByNotetakerId(notetakerId, 'Notetaker created. Waiting to join meeting...', 20);
          }
        }
        break;

      case 'notetaker.meeting_state':
        // Meeting state changed (connecting, attending, recording_started, left_meeting, etc.)
        const meetingState = notetakerData.meeting_state || data.meeting_state || data.state;
        console.log('📊 Meeting state update:', meetingState);
        await handleMeetingStateChange({
          notetakerId,
          grantId,
          meetingState,
          status: notetakerData.status,
        });
        break;

      case 'notetaker.media':
        // Media files (transcript, recording, summary, action items) are now available
        console.log('📁 Media files available for notetaker:', notetakerId);
        await handleMediaAvailable(notetakerId, grantId, notetakerData.media || data.media);
        break;

      case 'notetaker.updated':
        // Notetaker configuration was updated
        console.log('🔄 Notetaker updated:', notetakerId);
        // Could update meeting settings if needed
        break;

      case 'notetaker.deleted':
        // Notetaker was deleted/cancelled
        console.log('🗑️  Notetaker deleted:', notetakerId);
        updateMeetingByNotetakerId(notetakerId, {
          status: 'failed',
        });
        updateProgressByNotetakerId(notetakerId, 'Notetaker was cancelled', 0);
        break;

      // Legacy event handlers (may not be used, but keeping for compatibility)
      case 'notetaker.joined':
        console.log('✅ Notetaker joined meeting (legacy event)');
        updateMeetingByNotetakerId(notetakerId, {
          status: 'recording',
        });
        updateProgressByNotetakerId(notetakerId, 'Bot joined meeting. Recording...', 50);
        break;

      case 'notetaker.recording':
        console.log('🔴 Recording in progress (legacy event)');
        updateMeetingByNotetakerId(notetakerId, {
          status: 'recording',
        });
        updateProgressByNotetakerId(notetakerId, 'Recording in progress...', 70);
        break;

      case 'notetaker.completed':
        console.log('✅ Meeting completed (legacy event)');
        await handleMeetingCompleted(notetakerId, grantId);
        break;

      case 'notetaker.failed':
        console.log('❌ Notetaker failed (legacy event)');
        updateMeetingByNotetakerId(notetakerId, {
          status: 'failed',
        });
        updateProgressByNotetakerId(notetakerId, 'Failed to record meeting', 0);
        break;

      default:
        console.log('⚠️  Unknown webhook event type:', type);
        console.log('   Event data:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Error processing webhook event:', error);
    console.error('   Event type:', event.type);
    console.error('   Event data:', event.data);
  }
}

async function handleMeetingStateChange(data) {
  try {
    const { notetakerId, grantId, meetingState, status } = data;

    if (!notetakerId) {
      console.log('⚠️  Meeting state change without notetaker_id');
      return;
    }

    console.log(`   Notetaker ID: ${notetakerId}`);
    console.log(`   Meeting State: ${meetingState}`);
    console.log(`   Status: ${status}`);

    // Map Nylas meeting states to our statuses (based on official documentation)
    switch (meetingState) {
      case 'connecting':
        updateMeetingByNotetakerId(notetakerId, {
          status: 'joining',
        });
        updateProgressByNotetakerId(notetakerId, 'Connecting to meeting...', 30);
        break;

      case 'attending':
      case 'recording_started':
        updateMeetingByNotetakerId(notetakerId, {
          status: 'recording',
        });
        updateProgressByNotetakerId(notetakerId, 'In meeting. Recording...', 60);
        break;

      case 'left_meeting':
      case 'disconnected':
        // Meeting ended, but wait for notetaker.media event for transcript
        updateMeetingByNotetakerId(notetakerId, {
          status: 'processing',
        });
        updateProgressByNotetakerId(notetakerId, 'Meeting ended. Processing recording...', 80);
        break;

      case 'failed_entry':
        updateMeetingByNotetakerId(notetakerId, {
          status: 'failed',
        });
        updateProgressByNotetakerId(notetakerId, 'Failed to join meeting', 0);
        break;

      case 'api_request':
        // Notetaker was removed via API
        updateMeetingByNotetakerId(notetakerId, {
          status: 'processing',
        });
        updateProgressByNotetakerId(notetakerId, 'Recording stopped. Processing...', 80);
        break;

      default:
        console.log(`   ⚠️  Unknown meeting state: ${meetingState}`);
        // Still update progress to show something is happening
        updateProgressByNotetakerId(notetakerId, `Meeting state: ${meetingState}`, 50);
    }
  } catch (error) {
    console.error('❌ Error handling meeting state change:', error);
  }
}

async function handleMediaAvailable(notetakerId, grantId, media) {
  try {
    const meetings = meetingService.getAllMeetings();
    const meeting = meetings.find(m => m.notetakerId === notetakerId);

    if (!meeting) {
      console.error('⚠️  Meeting not found for notetaker:', notetakerId);
      return;
    }

    console.log('📁 Processing media files...');
    console.log('   Transcript URL:', media?.transcript);
    console.log('   Recording URL:', media?.recording);
    console.log('   Summary URL:', media?.summary);
    console.log('   Action Items URL:', media?.action_items);

    // Update progress
    meetingService.updateProgress(meeting.id, 'Media files available. Generating note...', 90);

    // Fetch transcript if available
    if (media?.transcript) {
      try {
        // Download transcript from URL
        const transcriptResponse = await axios.get(media.transcript);
        const transcript = transcriptResponse.data;

        if (transcript) {
          meetingService.setTranscript(meeting.id, transcript);

          // Generate note from transcript
          const note = generateNote(transcript);
          meetingService.setNote(meeting.id, note);

          // Store media URLs
          meetingService.updateMeeting(meeting.id, {
            recording: media.recording,
            note: {
              ...note,
              summaryUrl: media.summary,
              actionItemsUrl: media.action_items,
            },
            status: 'completed',
          });

          meetingService.updateProgress(meeting.id, 'Note generated successfully!', 100);
          console.log('✅ Note generated from media files');
        }
      } catch (error) {
        console.error('❌ Error fetching transcript from media URL:', error);
        // Fallback: try using the API
        await handleMeetingCompleted(notetakerId, grantId);
      }
    } else {
      // No transcript URL, try API fallback
      console.log('   No transcript URL in media, trying API...');
      await handleMeetingCompleted(notetakerId, grantId);
    }
  } catch (error) {
    console.error('❌ Error handling media availability:', error);
    // Fallback to API method
    await handleMeetingCompleted(notetakerId, grantId);
  }
}

function updateMeetingByNotetakerId(notetakerId, updates) {
  if (!notetakerId) {
    console.log('⚠️  updateMeetingByNotetakerId called without notetakerId');
    return;
  }

  const meetings = meetingService.getAllMeetings();
  const meeting = meetings.find(m => m.notetakerId === notetakerId);

  if (meeting) {
    meetingService.updateMeeting(meeting.id, updates);
    console.log(`   ✅ Updated meeting ${meeting.id} with notetaker ${notetakerId}`);
  } else {
    console.log(`   ⚠️  Meeting not found for notetaker_id: ${notetakerId}`);
    console.log(`   Available meetings: ${meetings.length}`);
    // Try to find by matching notetakerId in updates (in case it's being set for the first time)
    if (updates.notetakerId) {
      const meetingByGrant = meetings.find(m =>
        !m.notetakerId && updates.grantId && m.grantId === updates.grantId
      );
      if (meetingByGrant) {
        console.log(`   ✅ Found meeting by grant_id, updating with notetaker_id`);
        meetingService.updateMeeting(meetingByGrant.id, updates);
      }
    }
  }
}

function updateProgressByNotetakerId(notetakerId, message, percentage) {
  if (!notetakerId) {
    console.log('⚠️  updateProgressByNotetakerId called without notetakerId');
    return;
  }

  const meetings = meetingService.getAllMeetings();
  const meeting = meetings.find(m => m.notetakerId === notetakerId);

  if (meeting) {
    meetingService.updateProgress(meeting.id, message, percentage);
    console.log(`   ✅ Updated progress for meeting ${meeting.id}: ${message} (${percentage}%)`);
  } else {
    console.log(`   ⚠️  Meeting not found for notetaker_id: ${notetakerId} - cannot update progress`);
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

