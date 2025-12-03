import OpenAI from 'openai';
import { config } from '../config.js';

// Initialize OpenAI client
let openaiClient = null;
if (config.openai.apiKey) {
  openaiClient = new OpenAI({
    apiKey: config.openai.apiKey,
  });
}

/**
 * Format transcript segments into a readable format for LLM
 * @param {Array} segments - Transcript segments
 * @returns {string} Formatted transcript text
 */
function formatTranscriptForLLM(segments) {
  if (!segments || segments.length === 0) return '';

  return segments
    .map((segment, index) => {
      const speaker = segment.speaker || 'Unknown Speaker';
      const text = segment.text || '';
      const timestamp = segment.start
        ? formatTimestamp(segment.start)
        : '';

      return `[${timestamp}] ${speaker}: ${text}`;
    })
    .join('\n\n');
}

/**
 * Format timestamp from milliseconds to readable format
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted timestamp (MM:SS)
 */
function formatTimestamp(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate a comprehensive note using OpenAI
 * @param {Object} transcript - Transcript data from Nylas
 * @returns {Promise<Object>} Generated note
 */
async function generateNoteWithLLM(transcript) {
  const segments = transcript?.transcript || [];

  if (!transcript || segments.length === 0) {
    return {
      summary: 'No transcript available.',
      keyPoints: [],
      participants: [],
      duration: 0,
    };
  }

  // Format transcript for LLM
  const formattedTranscript = formatTranscriptForLLM(segments);

  // Extract participants
  const participants = new Set();
  segments.forEach(segment => {
    if (segment.speaker) {
      participants.add(segment.speaker);
    }
  });

  // Calculate duration
  let duration = 0;
  if (segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
    if (lastSegment.end) {
      duration = Math.round(lastSegment.end / 1000);
    } else if (lastSegment.end_time) {
      duration = Math.round(lastSegment.end_time);
    }
  }

  // Calculate word count
  const fullText = segments.map(s => s.text || '').join(' ');
  const wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;

  // Create prompt for OpenAI
  const prompt = `You are an expert meeting note-taker. Analyze the following meeting transcript and generate comprehensive, structured meeting notes.

TRANSCRIPT:
${formattedTranscript}

Generate meeting notes in the following JSON format. Be thorough, accurate, and extract all important information:

{
  "summary": "A concise 2-3 sentence executive summary of the entire meeting",
  "keyPoints": [
    "Important point 1",
    "Important point 2",
    ...
  ],
  "topics": [
    {
      "topic": "Topic name",
      "summary": "Brief summary of what was discussed about this topic"
    }
  ],
  "decisions": [
    {
      "decision": "What was decided",
      "speaker": "Who made/announced the decision (if mentioned)",
      "context": "Brief context around the decision"
    }
  ],
  "actionItems": [
    {
      "item": "What needs to be done",
      "assignee": "Who is responsible (if mentioned, otherwise 'Unassigned')",
      "dueDate": "Due date or timeline if mentioned, otherwise null"
    }
  ],
  "questions": [
    "Question 1 that was raised",
    "Question 2 that was raised",
    ...
  ],
  "nextSteps": [
    "Next step 1",
    "Next step 2",
    ...
  ]
}

Guidelines:
- Extract ALL action items, even if they're implicit (e.g., "I'll send that" or "Let's follow up")
- Identify decisions clearly, even if not explicitly stated as "we decided"
- Group related discussions into topics
- Include questions that were raised but not answered
- Be specific and actionable in action items
- If information is not available, use null or empty arrays
- Keep summaries concise but informative
- Return ONLY valid JSON, no markdown formatting or code blocks`;

  try {
    console.log('🤖 Generating note with OpenAI...');

    const response = await openaiClient.chat.completions.create({
      model: config.openai.model,
      messages: [
        {
          role: 'system',
          content: 'You are a professional meeting note-taker. You extract structured information from meeting transcripts and return it as valid JSON only, without any markdown formatting or code blocks.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent, factual output
      response_format: { type: 'json_object' }, // Force JSON response
      max_tokens: 2000, // Adjust based on meeting length
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    let llmNote;
    try {
      llmNote = JSON.parse(content);
    } catch (parseError) {
      // Sometimes OpenAI wraps JSON in markdown, try to extract it
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        llmNote = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse OpenAI response as JSON');
      }
    }

    // Merge LLM-generated content with metadata
    return {
      summary: llmNote.summary || 'No summary generated.',
      keyPoints: llmNote.keyPoints || [],
      topics: llmNote.topics || [],
      decisions: llmNote.decisions || [],
      actionItems: llmNote.actionItems || [],
      questions: llmNote.questions || [],
      nextSteps: llmNote.nextSteps || [],
      participants: Array.from(participants),
      duration,
      wordCount,
      generatedAt: new Date().toISOString(),
      transcriptType: transcript.type || 'unknown',
      generatedBy: 'openai',
      model: config.openai.model,
    };
  } catch (error) {
    console.error('❌ Error generating note with OpenAI:', error.message);
    // Fallback to basic note generation
    console.log('⚠️  Falling back to basic note generation...');
    return generateBasicNote(transcript);
  }
}

/**
 * Generate a basic note (fallback when LLM is unavailable)
 * @param {Object} transcript - Transcript data from Nylas
 * @returns {Object} Generated note
 */
function generateBasicNote(transcript) {
  const segments = transcript?.transcript || [];

  if (!transcript || segments.length === 0) {
    return {
      summary: 'No transcript available.',
      keyPoints: [],
      participants: [],
      duration: 0,
    };
  }

  const fullText = segments
    .map(segment => segment.text || '')
    .join(' ')
    .trim();

  const participants = new Set();
  segments.forEach(segment => {
    if (segment.speaker) {
      participants.add(segment.speaker);
    }
  });

  const summary = fullText.length > 200
    ? fullText.substring(0, 200) + '...'
    : fullText;

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

  let duration = 0;
  if (segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
    if (lastSegment.end) {
      duration = Math.round(lastSegment.end / 1000);
    } else if (lastSegment.end_time) {
      duration = Math.round(lastSegment.end_time);
    }
  }

  return {
    summary,
    keyPoints: keyPoints.length > 0 ? keyPoints : ['No specific key points identified.'],
    participants: Array.from(participants),
    duration,
    wordCount: fullText.split(/\s+/).length,
    generatedAt: new Date().toISOString(),
    transcriptType: transcript.type || 'unknown',
    generatedBy: 'basic',
  };
}

/**
 * Main function to generate note (uses LLM if available, falls back to basic)
 * @param {Object} transcript - Transcript data from Nylas
 * @returns {Promise<Object>} Generated note
 */
export async function generateNote(transcript) {
  // Use LLM if OpenAI is configured, otherwise use basic generation
  if (openaiClient && config.openai.apiKey) {
    return await generateNoteWithLLM(transcript);
  } else {
    console.log('⚠️  OpenAI not configured, using basic note generation');
    return generateBasicNote(transcript);
  }
}
