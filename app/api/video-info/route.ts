import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

/**
 * Video Info API - Now fully using yt-dlp (fallback to ytdl-core removed)
 * Uses yt-dlp -j to get JSON metadata
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'الرجاء إدخال رابط' },
        { status: 400 }
      );
    }

    console.log('[VIDEO-INFO] Fetching with yt-dlp:', url);

    // Try yt-dlp first
    const info = await getVideoInfoYtdlp(url);
    
    if (!info) {
      throw new Error('فشل في جلب معلومات الفيديو');
    }

    console.log('[VIDEO-INFO] Success:', info.title);

    return NextResponse.json({
      success: true,
      ...info,
    });

  } catch (error) {
    console.error('[VIDEO-INFO ERROR]:', error);
    const errorMessage = error instanceof Error ? error.message : 'فشل في جلب معلومات الفيديو';
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Get video info using yt-dlp -j
 */
async function getVideoInfoYtdlp(url: string) {
  return new Promise<any>((resolve, reject) => {
    const ytdlp = spawn('yt-dlp', [
      '-j',                    // JSON output
      '--no-warnings',
      '--no-playlist',
      '--skip-download',
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

          // Parse formats
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
          console.error('[VIDEO-INFO] Parse error:', err);
          reject(new Error('Failed to parse yt-dlp output'));
        }
      } else {
        console.error('[VIDEO-INFO] yt-dlp failed:', errorOutput);
        reject(new Error(`yt-dlp error: ${errorOutput || 'Unknown error'}`));
      }
    });

    ytdlp.on('error', (err) => {
      console.error('[VIDEO-INFO] Spawn error:', err);
      reject(new Error(`yt-dlp not found. Please install: winget install yt-dlp`));
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

  const uniqueFormats = new Map();
  videoFormats.forEach(f => {
    const key = f.height;
    if (!uniqueFormats.has(key) || (f.acodec && f.acodec !== 'none')) {
      uniqueFormats.set(key, {
        itag: f.format_id || f.itag || key,
        quality: `${f.height}p`,
        qualityLabel: f.format_note || `${f.height}p`,
        container: f.ext || 'mp4',
        format: f.ext || 'mp4',
        size: f.filesize ? String(f.filesize) : '0',
        hasAudio: f.acodec && f.acodec !== 'none',
        fps: f.fps || 30,
      });
    }
  });

  return Array.from(uniqueFormats.values())
    .sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
}

/**
 * Parse audio formats
 */
function parseAudioFormats(formats: any[]) {
  const audioFormats = formats.filter(f => 
    f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none')
  );

  const uniqueFormats = new Map();
  audioFormats.forEach(f => {
    const bitrate = f.abr || 128;
    const key = Math.round(bitrate / 32) * 32;
    
    if (!uniqueFormats.has(key)) {
      uniqueFormats.set(key, {
        itag: f.format_id || f.itag || key,
        quality: `${key}kbps`,
        format: f.ext || 'mp3',
        bitrate: bitrate,
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


