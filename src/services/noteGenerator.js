/**
 * Generate a basic note from transcript data
 * @param {Object} transcript - Transcript data from Nylas
 * @returns {Object} Generated note
 */
export function generateNote(transcript) {
  // Handle Nylas transcript format: transcript.transcript array
  // Also support legacy format: transcript.segments array
  const segments = transcript?.transcript || [];

  if (!transcript || segments.length === 0) {
    return {
      summary: 'No transcript available.',
      keyPoints: [],
      participants: [],
      duration: 0,
    };
  }

  // Extract text from transcript segments
  const fullText = segments
    .map(segment => segment.text || '')
    .join(' ')
    .trim();

  // Extract participants (speakers)
  const participants = new Set();
  segments.forEach(segment => {
    if (segment.speaker) {
      participants.add(segment.speaker);
    }
  });

  // Generate a simple summary (first 200 characters)
  const summary = fullText.length > 200
    ? fullText.substring(0, 200) + '...'
    : fullText;

  // Extract key points (simple approach: sentences with question marks or important keywords)
  const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const keyPoints = sentences
    .filter(sentence => {
      const lower = sentence.toLowerCase();
      return lower.includes('?') ||
        lower.includes('important') ||
        lower.includes('action') ||
        lower.includes('decision') ||
        lower.includes('next');
    })
    .slice(0, 5)
    .map(s => s.trim());

  // Calculate duration if available
  // Nylas format uses 'end' (in milliseconds), legacy format uses 'end_time' (in seconds)
  let duration = 0;
  if (segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
    if (lastSegment.end) {
      // Nylas format: end is in milliseconds, convert to seconds
      duration = Math.round(lastSegment.end / 1000);
    } else if (lastSegment.end_time) {
      // Legacy format: end_time is already in seconds
      duration = Math.round(lastSegment.end_time);
    }
  }

  return {
    summary,
    keyPoints: keyPoints.length > 0 ? keyPoints : ['No specific key points identified.'],
    participants: Array.from(participants),
    duration, // in seconds
    wordCount: fullText.split(/\s+/).length,
    generatedAt: new Date().toISOString(),
    transcriptType: transcript.type || 'unknown', // e.g., "speaker_labelled"
  };
}

