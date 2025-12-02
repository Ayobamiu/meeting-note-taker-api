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
        // Media status changed (available, deleted, error, processing)
        const mediaState = notetakerData.state || data.state;
        const media = notetakerData.media || data.media;
        console.log('📁 Media event for notetaker:', notetakerId, 'State:', mediaState);
        await handleMediaAvailable(notetakerId, grantId, media, mediaState);
        break;

      case 'notetaker.updated':
        // Notetaker status changed (attending, connecting, disconnected, failed_entry, scheduled, waiting_for_entry)
        const updatedState = notetakerData.state || data.state;
        console.log('🔄 Notetaker updated:', notetakerId, 'State:', updatedState);
        await handleNotetakerStatusUpdate({
          notetakerId,
          grantId,
          state: updatedState,
        });
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
    // meeting_state values: api_request, bad_meeting_code, dispatched, entry_denied, 
    // internal_error, kicked, no_meeting_activity, no_participants, no_response, 
    // recording_active, waiting_for_entry
    switch (meetingState) {
      case 'dispatched':
        // Notetaker has loaded the meeting page
        updateMeetingByNotetakerId(notetakerId, {
          status: 'joining',
        });
        updateProgressByNotetakerId(notetakerId, 'Notetaker dispatched. Preparing to join...', 25);
        break;

      case 'waiting_for_entry':
        // Notetaker is waiting to be admitted to the meeting
        updateMeetingByNotetakerId(notetakerId, {
          status: 'joining',
        });
        updateProgressByNotetakerId(notetakerId, 'Waiting to be admitted to meeting...', 30);
        break;

      case 'recording_active':
        // Notetaker is attending and recording
        updateMeetingByNotetakerId(notetakerId, {
          status: 'recording',
        });
        updateProgressByNotetakerId(notetakerId, 'In meeting. Recording...', 60);
        break;

      case 'api_request':
        // Notetaker left because of Remove from Meeting request
        updateMeetingByNotetakerId(notetakerId, {
          status: 'processing',
        });
        updateProgressByNotetakerId(notetakerId, 'Recording stopped. Processing...', 80);
        break;

      case 'no_meeting_activity':
      case 'no_participants':
        // Notetaker left because no activity or no participants
        updateMeetingByNotetakerId(notetakerId, {
          status: 'processing',
        });
        updateProgressByNotetakerId(notetakerId, 'Meeting ended. Processing recording...', 80);
        break;

      case 'bad_meeting_code':
      case 'entry_denied':
      case 'no_response':
        // Failed to join meeting
        updateMeetingByNotetakerId(notetakerId, {
          status: 'failed',
        });
        updateProgressByNotetakerId(notetakerId, `Failed to join: ${meetingState}`, 0);
        break;

      case 'kicked':
        // Notetaker was removed by a participant
        updateMeetingByNotetakerId(notetakerId, {
          status: 'failed',
        });
        updateProgressByNotetakerId(notetakerId, 'Removed from meeting by participant', 0);
        break;

      case 'internal_error':
        // Notetaker encountered an error
        updateMeetingByNotetakerId(notetakerId, {
          status: 'failed',
        });
        updateProgressByNotetakerId(notetakerId, 'Internal error occurred', 0);
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

async function handleNotetakerStatusUpdate(data) {
  try {
    const { notetakerId, grantId, state } = data;

    if (!notetakerId) {
      console.log('⚠️  Notetaker status update without notetaker_id');
      return;
    }

    console.log(`   Notetaker ID: ${notetakerId}`);
    console.log(`   Status: ${state}`);

    // Map notetaker.updated state values: attending, connecting, disconnected, 
    // failed_entry, scheduled, waiting_for_entry
    switch (state) {
      case 'scheduled':
        updateMeetingByNotetakerId(notetakerId, {
          status: 'joining',
        });
        updateProgressByNotetakerId(notetakerId, 'Notetaker scheduled. Waiting...', 15);
        break;

      case 'connecting':
        updateMeetingByNotetakerId(notetakerId, {
          status: 'joining',
        });
        updateProgressByNotetakerId(notetakerId, 'Connecting to meeting...', 30);
        break;

      case 'waiting_for_entry':
        updateMeetingByNotetakerId(notetakerId, {
          status: 'joining',
        });
        updateProgressByNotetakerId(notetakerId, 'Waiting to be admitted...', 35);
        break;

      case 'attending':
        updateMeetingByNotetakerId(notetakerId, {
          status: 'recording',
        });
        updateProgressByNotetakerId(notetakerId, 'Attending meeting. Recording...', 60);
        break;

      case 'disconnected':
        // Notetaker left, wait for media event
        updateMeetingByNotetakerId(notetakerId, {
          status: 'processing',
        });
        updateProgressByNotetakerId(notetakerId, 'Disconnected. Processing recording...', 80);
        break;

      case 'failed_entry':
        updateMeetingByNotetakerId(notetakerId, {
          status: 'failed',
        });
        updateProgressByNotetakerId(notetakerId, 'Failed to enter meeting', 0);
        break;

      default:
        console.log(`   ⚠️  Unknown notetaker status: ${state}`);
        updateProgressByNotetakerId(notetakerId, `Status: ${state}`, 50);
    }
  } catch (error) {
    console.error('❌ Error handling notetaker status update:', error);
  }
}

async function handleMediaAvailable(notetakerId, grantId, media, mediaState) {
  try {
    const meetings = meetingService.getAllMeetings();
    const meeting = meetings.find(m => m.notetakerId === notetakerId);

    if (!meeting) {
      console.error('⚠️  Meeting not found for notetaker:', notetakerId);
      return;
    }

    console.log('📁 Media event received');
    console.log('   Media State:', mediaState);
    console.log('   Transcript URL:', media?.transcript);
    console.log('   Recording URL:', media?.recording);
    console.log('   Summary URL:', media?.summary);
    console.log('   Action Items URL:', media?.action_items);

    // Handle different media states: available, deleted, error, processing
    switch (mediaState) {
      case 'processing':
        meetingService.updateProgress(meeting.id, 'Processing recording and transcription...', 85);
        break;

      case 'available':
        // Media files are available, fetch and process
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
        break;

      case 'error':
        meetingService.updateProgress(meeting.id, 'Error processing recording', 0);
        meetingService.updateMeeting(meeting.id, {
          status: 'failed',
        });
        break;

      case 'deleted':
        console.log('   Media files were deleted');
        break;

      default:
        console.log(`   ⚠️  Unknown media state: ${mediaState}`);
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

