import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

/**
 * Video Info API using yt-dlp (more reliable than ytdl-core)
 * 
 * POST /api/video-info-pro
 * Body: { url: "youtube_url" }
 * 
 * Response: {
 *   title, author, thumbnail, duration, videoId,
 *   videoFormats: [{quality, format, hasAudio}],
 *   audioFormats: [{quality, format}]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'Missing required parameter: url' },
        { status: 400 }
      );
    }

    // Security: Validate YouTube URL
    const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubePattern.test(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    console.log('[VIDEO-INFO-PRO] Fetching info for:', url);

    // Get video metadata using yt-dlp
    const videoInfo = await getVideoInfoYtdlp(url);

    if (!videoInfo) {
      throw new Error('Failed to fetch video information');
    }

    console.log('[VIDEO-INFO-PRO] Success:', videoInfo.title);

    return NextResponse.json({
      success: true,
      ...videoInfo,
    });

  } catch (error) {
    console.error('[VIDEO-INFO-PRO ERROR]:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch video info',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Get video information using yt-dlp
 */
async function getVideoInfoYtdlp(url: string) {
  return new Promise<any>((resolve, reject) => {
    const ytdlp = spawn('yt-dlp', [
      '--dump-json',           // Output JSON metadata
      '--no-warnings',
      '--no-playlist',
      '--skip-download',       // Don't download, just get info
      url
    ]);

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
        try {
          const data = JSON.parse(output);
          
          // Extract video ID
          const videoId = data.id || extractVideoId(url);

          // Parse formats for video and audio
          const videoFormats = parseVideoFormats(data.formats || []);
          const audioFormats = parseAudioFormats(data.formats || []);

          resolve({
            title: data.title || 'Unknown Title',
            author: data.uploader || data.channel || 'Unknown',
            thumbnail: data.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            duration: data.duration || 0,
            videoId: videoId,
            videoFormats: videoFormats,
            audioFormats: audioFormats,
          });
        } catch (err) {
          reject(new Error('Failed to parse yt-dlp output'));
        }
      } else {
        reject(new Error(`yt-dlp failed: ${errorOutput || 'Unknown error'}`));
      }
    });

    ytdlp.on('error', (err) => {
      reject(new Error(`yt-dlp spawn error: ${err.message}. Make sure yt-dlp is installed.`));
    });
  });
}

/**
 * Parse video formats from yt-dlp output
 */
function parseVideoFormats(formats: any[]) {
  const videoFormats = formats.filter(f => 
    f.vcodec && f.vcodec !== 'none' && f.height
  );

  // Remove duplicates by quality
  const uniqueFormats = new Map();
  videoFormats.forEach(f => {
    const key = f.height;
    if (!uniqueFormats.has(key) || (f.acodec && f.acodec !== 'none')) {
      uniqueFormats.set(key, {
        quality: `${f.height}p`,
        qualityLabel: f.format_note || `${f.height}p`,
        format: f.ext || 'mp4',
        hasAudio: f.acodec && f.acodec !== 'none',
        fps: f.fps || 30,
        filesize: f.filesize || 0,
      });
    }
  });

  return Array.from(uniqueFormats.values())
    .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
}

/**
 * Parse audio formats from yt-dlp output
 */
function parseAudioFormats(formats: any[]) {
  const audioFormats = formats.filter(f => 
    f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none')
  );

  const uniqueFormats = new Map();
  audioFormats.forEach(f => {
    const bitrate = f.abr || 128;
    const key = Math.round(bitrate / 32) * 32; // Round to nearest 32
    
    if (!uniqueFormats.has(key)) {
      uniqueFormats.set(key, {
        quality: `${key}kbps`,
        format: f.ext || 'mp3',
        bitrate: bitrate,
        filesize: f.filesize || 0,
      });
    }
  });

  return Array.from(uniqueFormats.values())
    .sort((a, b) => b.bitrate - a.bitrate);
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return '';
}
