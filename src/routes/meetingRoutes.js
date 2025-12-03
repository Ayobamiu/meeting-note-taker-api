import express from 'express';
import {
  addMeeting,
  getMeetingStatus,
  getAllMeetings,
  getMeetingNote,
  regenerateNote,
} from '../controllers/meetingController.js';

const router = express.Router();

// Add a new meeting
router.post('/', addMeeting);

// Get all meetings
router.get('/', getAllMeetings);

// Get meeting status
router.get('/:meetingId', getMeetingStatus);

// Get meeting note
router.get('/:meetingId/note', getMeetingNote);

// Regenerate meeting note
router.post('/:meetingId/regenerate-note', regenerateNote);

export default router;

