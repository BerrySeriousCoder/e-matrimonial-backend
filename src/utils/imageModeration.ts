import vision from '@google-cloud/vision';
import path from 'path';

// Path to Google Cloud credentials file
const CREDENTIALS_PATH = path.join(__dirname, '../../googlecredential.json');

// Initialize Vision API client with service account credentials
const getVisionClient = () => {
  // If credentials JSON content is provided directly (useful for deployment)
  if (process.env.GOOGLE_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    return new vision.ImageAnnotatorClient({ credentials });
  }
  
  // If custom path to credentials file is provided via env
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new vision.ImageAnnotatorClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }
  
  // Default: use the googlecredential.json in backend folder
  return new vision.ImageAnnotatorClient({
    keyFilename: CREDENTIALS_PATH,
  });
};

const client = getVisionClient();

// Likelihood levels from Google Vision API
const LIKELIHOOD_LEVELS = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};

// Threshold: LIKELY (4) or higher is considered unsafe
const UNSAFE_THRESHOLD = LIKELIHOOD_LEVELS.LIKELY;

export interface ModerationResult {
  safe: boolean;
  reason?: string;
  details?: {
    adult: string;
    violence: string;
    racy: string;
    medical: string;
    spoof: string;
  };
}

/**
 * Check if an image is safe using Google Cloud Vision SafeSearch
 * @param imageBuffer - Buffer containing the image data
 * @returns ModerationResult indicating if image is safe
 */
export async function moderateImage(imageBuffer: Buffer): Promise<ModerationResult> {
  try {
    // Call Vision API with the image buffer
    const [result] = await client.safeSearchDetection({
      image: { content: imageBuffer.toString('base64') },
    });

    const safeSearch = result.safeSearchAnnotation;

    if (!safeSearch) {
      console.error('Vision API returned no SafeSearch annotation');
      return {
        safe: false,
        reason: 'Unable to analyze image content. Please try a different image.',
      };
    }

    const details = {
      adult: String(safeSearch.adult || 'UNKNOWN'),
      violence: String(safeSearch.violence || 'UNKNOWN'),
      racy: String(safeSearch.racy || 'UNKNOWN'),
      medical: String(safeSearch.medical || 'UNKNOWN'),
      spoof: String(safeSearch.spoof || 'UNKNOWN'),
    };

    // Check adult content
    const adultLevel = LIKELIHOOD_LEVELS[details.adult as keyof typeof LIKELIHOOD_LEVELS] || 0;
    if (adultLevel >= UNSAFE_THRESHOLD) {
      return {
        safe: false,
        reason: 'Image contains adult content and cannot be sent.',
        details,
      };
    }

    // Check violence
    const violenceLevel = LIKELIHOOD_LEVELS[details.violence as keyof typeof LIKELIHOOD_LEVELS] || 0;
    if (violenceLevel >= UNSAFE_THRESHOLD) {
      return {
        safe: false,
        reason: 'Image contains violent content and cannot be sent.',
        details,
      };
    }

    // Check racy content (suggestive but not explicit)
    const racyLevel = LIKELIHOOD_LEVELS[details.racy as keyof typeof LIKELIHOOD_LEVELS] || 0;
    if (racyLevel >= UNSAFE_THRESHOLD) {
      return {
        safe: false,
        reason: 'Image contains inappropriate content and cannot be sent.',
        details,
      };
    }

    // Image passed all checks
    return {
      safe: true,
      details,
    };
  } catch (error: any) {
    console.error('Vision API error:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });

    // If Vision API fails, reject the image for safety
    return {
      safe: false,
      reason: 'Unable to verify image safety. Please try again or use a different image.',
    };
  }
}

/**
 * Validate that a file is an allowed image type
 */
export function isAllowedImageType(mimetype: string): boolean {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  return allowedTypes.includes(mimetype);
}

/**
 * Get max file size in bytes (5MB)
 */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

