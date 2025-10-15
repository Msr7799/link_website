import ytdl from '@distube/ytdl-core';

// إنشاء agent محسّن لتجنب 403
const agent = ytdl.createAgent(undefined, {
  localAddress: undefined,
});

/**
 * استخراج video ID من رابط YouTube
 */
function extractVideoId(url: string): string | null {
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
  
  return null;
}

/**
 * جلب معلومات الفيديو باستخدام ytdl-core
 */
export async function getVideoInfo(url: string) {
  try {
    console.log('Fetching video info for:', url);
    
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('رابط YouTube غير صالح');
    }

    // استخدام ytdl-core للحصول على معلومات الفيديو
    const info = await ytdl.getInfo(url, {
      agent,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      },
    });

    console.log('Successfully fetched video info');
    return {
      videoId,
      title: info.videoDetails.title,
      author: info.videoDetails.author.name,
      thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
      duration: info.videoDetails.lengthSeconds,
      formats: info.formats,
    };
  } catch (error) {
    console.error('Error in getVideoInfo:', error);
    throw error;
  }
}

/**
 * الحصول على stream للتحميل المباشر
 */
export function getDownloadStream(url: string, options: ytdl.downloadOptions = {}) {
  return ytdl(url, {
    ...options,
    agent,
    requestOptions: {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
    },
  });
}

/**
 * الحصول على رابط التحميل المباشر
 */
export async function getDirectDownloadUrl(
  url: string,
  quality: string = '720',
  format: 'audio' | 'video' = 'video'
) {
  try {
    const info = await ytdl.getInfo(url, {
      agent,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
        },
      },
    });

    let selectedFormat;

    if (format === 'audio') {
      // الحصول على أفضل جودة صوت
      selectedFormat = ytdl.chooseFormat(info.formats, {
        quality: 'highestaudio',
        filter: 'audioonly',
      });
    } else {
      // الحصول على الفيديو بالجودة المطلوبة
      const qualityLabel = quality.replace('p', ''); // تحويل "720p" إلى "720"
      selectedFormat = ytdl.chooseFormat(info.formats, {
        quality: qualityLabel,
        filter: 'videoandaudio',
      });
    }

    if (!selectedFormat || !selectedFormat.url) {
      throw new Error('لم يتم العثور على صيغة مناسبة');
    }

    return {
      url: selectedFormat.url,
      format: selectedFormat,
      title: info.videoDetails.title,
      videoId: info.videoDetails.videoId,
    };
  } catch (error) {
    console.error('Error in getDirectDownloadUrl:', error);
    throw error;
  }
}

