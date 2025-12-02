import nylasService from '../services/nylasService.js';
import meetingService from '../services/meetingService.js';
import { generateNote } from '../services/noteGenerator.js';

/**
 * Add a new meeting link
 * POST /api/meetings
 */
export async function addMeeting(req, res) {
  try {
    const { meetingUrl, grantId } = req.body;

    if (!meetingUrl) {
      return res.status(400).json({ error: 'meetingUrl is required' });
    }

    if (!grantId) {
      return res.status(400).json({ error: 'grantId is required' });
    }

    // Validate Google Meet URL format
    if (!meetingUrl.includes('meet.google.com') && !meetingUrl.includes('meet/')) {
      return res.status(400).json({ error: 'Invalid Google Meet URL' });
    }

    // Create meeting entry
    const meeting = meetingService.createMeeting(meetingUrl, grantId);

    // Deploy notetaker bot
    try {
      const notetakerResponse = await nylasService.deployNotetaker(grantId, meetingUrl);

      if (notetakerResponse.id) {
        meetingService.setNotetakerId(meeting.id, notetakerResponse.id);
        meetingService.updateMeeting(meeting.id, {
          status: 'joining',
          notetakerId: notetakerResponse.id,
        });
        meetingService.updateProgress(meeting.id, 'Bot deployed. Joining meeting...', 20);
      }
    } catch (error) {
      console.error('Error deploying notetaker:', error);
      meetingService.updateMeeting(meeting.id, {
        status: 'failed',
      });
      meetingService.updateProgress(meeting.id, `Error: ${error.message}`, 0);
    }

    res.status(201).json({
      success: true,
      meeting: {
        id: meeting.id,
        meetingUrl: meeting.meetingUrl,
        status: meeting.status,
        progress: meeting.progress,
        createdAt: meeting.createdAt,
      },
    });
  } catch (error) {
    console.error('Error adding meeting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get meeting status
 * GET /api/meetings/:meetingId
 */
export async function getMeetingStatus(req, res) {
  try {
    const { meetingId } = req.params;
    const meeting = meetingService.getMeeting(meetingId);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // If notetaker is deployed, check status with Nylas (non-blocking)
    // Note: We rely primarily on webhooks for status updates, this is just a fallback
    if (meeting.notetakerId && meeting.status !== 'completed' && meeting.status !== 'failed') {
      try {
        const notetakerStatus = await nylasService.getNotetakerStatus(
          meeting.grantId,
          meeting.notetakerId
        );

        // Update meeting status based on notetaker status
        if (notetakerStatus.status) {
          let newStatus = meeting.status;
          let progressMessage = meeting.progress.message;
          let progressPercentage = meeting.progress.percentage;

          switch (notetakerStatus.status) {
            case 'joined':
              newStatus = 'recording';
              progressMessage = 'Bot joined meeting. Recording in progress...';
              progressPercentage = 50;
              break;
            case 'recording':
              newStatus = 'recording';
              progressMessage = 'Recording meeting...';
              progressPercentage = 70;
              break;
            case 'completed':
              newStatus = 'processing';
              progressMessage = 'Meeting ended. Processing transcript...';
              progressPercentage = 90;
              break;
          }

          meetingService.updateMeeting(meeting.id, { status: newStatus });
          meetingService.updateProgress(meeting.id, progressMessage, progressPercentage);

          // If completed, fetch transcript and generate note
          if (notetakerStatus.status === 'completed' && !meeting.note) {
            try {
              const transcript = await nylasService.getTranscript(
                meeting.grantId,
                meeting.notetakerId
              );
              
              if (transcript) {
                meetingService.setTranscript(meeting.id, transcript);
                const note = generateNote(transcript);
                meetingService.setNote(meeting.id, note);
              }
            } catch (error) {
              console.error('Error fetching transcript:', error);
            }
          }
        }
      } catch (error) {
        // Don't fail the request if status check times out - webhooks will update status
        if (error.message.includes('timeout') || error.message.includes('Gateway')) {
          console.warn('⚠️  Status check timed out (webhooks will provide updates):', error.message);
        } else {
          console.error('Error checking notetaker status:', error);
        }
        // Continue to return the current meeting status even if API check fails
      }
    }

    // Return updated meeting
    const updatedMeeting = meetingService.getMeeting(meetingId);
    res.json({
      success: true,
      meeting: updatedMeeting,
    });
  } catch (error) {
    console.error('Error getting meeting status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get all meetings
 * GET /api/meetings
 */
export async function getAllMeetings(req, res) {
  try {
    const meetings = meetingService.getAllMeetings();
    res.json({
      success: true,
      meetings: meetings.map(m => ({
        id: m.id,
        meetingUrl: m.meetingUrl,
        status: m.status,
        progress: m.progress,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error getting meetings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get meeting note
 * GET /api/meetings/:meetingId/note
 */
export async function getMeetingNote(req, res) {
  try {
    const { meetingId } = req.params;
    const meeting = meetingService.getMeeting(meetingId);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (!meeting.note) {
      return res.status(404).json({
        error: 'Note not available yet. Meeting may still be in progress.',
        status: meeting.status,
      });
    }

    res.json({
      success: true,
      note: meeting.note,
      transcript: meeting.transcript,
    });
  } catch (error) {
    console.error('Error getting meeting note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

