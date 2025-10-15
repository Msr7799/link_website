import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { Readable } from 'stream';

/**
 * Professional YouTube Downloader API Route
 * Uses yt-dlp + FFmpeg for on-the-fly streaming conversion
 * 
 * Query Parameters:
 * - url: YouTube URL (required)
 * - format: 'video' | 'audio' (required)
 * - quality: '360' | '480' | '720' | '1080' for video, '128' | '256' | '320' for audio
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');
    const format = searchParams.get('format'); // 'video' or 'audio'
    const quality = searchParams.get('quality') || 'best';

    // Validation
    if (!url) {
      return NextResponse.json(
        { error: 'Missing required parameter: url' },
        { status: 400 }
      );
    }

    if (!format || !['video', 'audio'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Use "video" or "audio"' },
        { status: 400 }
      );
    }

    // Security: Validate URL pattern (basic YouTube URL check)
    const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubePattern.test(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    console.log(`[DOWNLOAD] Format: ${format}, Quality: ${quality}, URL: ${url}`);

    // Step 1: Extract direct media URL using yt-dlp
    const mediaUrl = await extractMediaUrl(url, format as 'video' | 'audio', quality);
    
    if (!mediaUrl) {
      throw new Error('Failed to extract media URL from yt-dlp');
    }

    console.log(`[DOWNLOAD] Media URL extracted: ${mediaUrl.substring(0, 100)}...`);

    // Step 2: Get video title for filename
    const title = await getVideoTitle(url);
    const sanitizedTitle = sanitizeFilename(title || 'download');

    // Step 3: Stream through FFmpeg for conversion
    if (format === 'audio') {
      return streamAudio(mediaUrl, sanitizedTitle, quality);
    } else {
      return streamVideo(mediaUrl, sanitizedTitle, quality);
    }

  } catch (error) {
    console.error('[DOWNLOAD ERROR]:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Download failed',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Extract direct media URL using yt-dlp
 */
async function extractMediaUrl(
  url: string, 
  format: 'video' | 'audio', 
  quality: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '-g', // Get direct URL
      '--no-warnings',
      '--no-playlist',
    ];

    // Format selection based on quality
    if (format === 'audio') {
      args.push('-f', 'bestaudio');
    } else {
      // Video quality mapping
      const qualityMap: Record<string, string> = {
        '360': 'bestvideo[height<=360]+bestaudio',
        '480': 'bestvideo[height<=480]+bestaudio',
        '720': 'bestvideo[height<=720]+bestaudio',
        '1080': 'bestvideo[height<=1080]+bestaudio',
        'best': 'best',
      };
      args.push('-f', qualityMap[quality] || 'best');
    }

    args.push(url);

    const ytdlp = spawn('yt-dlp', args);
    let output = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code === 0) {
        const urls = output.trim().split('\n');
        resolve(urls[0] || ''); // First URL is video, second is audio (if separate)
      } else {
        reject(new Error(`yt-dlp failed: ${errorOutput}`));
      }
    });

    ytdlp.on('error', (err) => {
      reject(new Error(`yt-dlp spawn error: ${err.message}`));
    });
  });
}

/**
 * Get video title using yt-dlp
 */
async function getVideoTitle(url: string): Promise<string> {
  return new Promise((resolve) => {
    const ytdlp = spawn('yt-dlp', ['--get-title', '--no-warnings', url]);
    let output = '';

    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytdlp.on('close', () => {
      resolve(output.trim() || 'download');
    });

    ytdlp.on('error', () => {
      resolve('download');
    });
  });
}

/**
 * Stream audio through FFmpeg (convert to MP3)
 */
function streamAudio(
  mediaUrl: string, 
  filename: string, 
  quality: string
): Response {
  // Audio bitrate mapping
  const bitrateMap: Record<string, string> = {
    '128': '128k',
    '192': '192k',
    '256': '256k',
    '320': '320k',
    'best': '256k',
  };

  const bitrate = bitrateMap[quality] || '256k';

  const ffmpeg = spawn('ffmpeg', [
    '-i', mediaUrl,           // Input from direct URL
    '-vn',                    // No video
    '-ar', '44100',           // Sample rate
    '-ac', '2',               // Stereo
    '-b:a', bitrate,          // Audio bitrate
    '-f', 'mp3',              // Output format
    'pipe:1'                  // Output to stdout
  ]);

  // Convert ffmpeg stdout to Web ReadableStream
  const readableStream = new ReadableStream({
    start(controller) {
      ffmpeg.stdout.on('data', (chunk) => {
        controller.enqueue(chunk);
      });

      ffmpeg.stdout.on('end', () => {
        controller.close();
      });

      ffmpeg.stderr.on('data', (data) => {
        console.error('[FFmpeg stderr]:', data.toString());
      });

      ffmpeg.on('error', (err) => {
        console.error('[FFmpeg error]:', err);
        controller.error(err);
      });
    }
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${filename}.mp3"`,
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Stream video through FFmpeg (convert to MP4)
 */
function streamVideo(
  mediaUrl: string, 
  filename: string, 
  quality: string
): Response {
  // Video resolution mapping
  const resolutionMap: Record<string, string> = {
    '360': '640x360',
    '480': '854x480',
    '720': '1280x720',
    '1080': '1920x1080',
  };

  const resolution = resolutionMap[quality];
  const ffmpegArgs = [
    '-i', mediaUrl,
    '-c:v', 'libx264',        // H.264 codec
    '-preset', 'ultrafast',   // Fast encoding
    '-crf', '23',             // Quality (lower = better)
    '-c:a', 'aac',            // AAC audio
    '-b:a', '192k',
    '-movflags', 'frag_keyframe+empty_moov', // Enable streaming
    '-f', 'mp4',
    'pipe:1'
  ];

  // Add resolution scaling if specified
  if (resolution) {
    ffmpegArgs.splice(3, 0, '-vf', `scale=${resolution}`);
  }

  const ffmpeg = spawn('ffmpeg', ffmpegArgs);

  const readableStream = new ReadableStream({
    start(controller) {
      ffmpeg.stdout.on('data', (chunk) => {
        controller.enqueue(chunk);
      });

      ffmpeg.stdout.on('end', () => {
        controller.close();
      });

      ffmpeg.stderr.on('data', (data) => {
        console.error('[FFmpeg stderr]:', data.toString());
      });

      ffmpeg.on('error', (err) => {
        console.error('[FFmpeg error]:', err);
        controller.error(err);
      });
    }
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${filename}.mp4"`,
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Sanitize filename for safe download
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9\s\-_]/gi, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}
