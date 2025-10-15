'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FaYoutube, FaDownload, FaMusic, FaVideo } from 'react-icons/fa';
import { FiChevronDown } from 'react-icons/fi';
import { LoaderOne, LoaderThree } from '@/components/ui/loader';
import { toast } from 'sonner';
import Switch from '@/components/ui/switch';
import { useTheme } from './ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: string;
  author: string;
  videoFormats: Array<{
    itag?: number;
    quality?: string;
    qualityLabel?: string;
    container?: string;
    format?: string;
    size?: string;
    hasAudio?: boolean;
  }>;
  audioFormats: Array<{
    itag?: number;
    quality?: string;
    container?: string;
    format?: string;
    size?: string;
    bitrate?: number;
  }>;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [downloadType, setDownloadType] = useState<'video' | 'audio'>('video');
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'wav'>('mp3');
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const { theme } = useTheme();

  // 🎬 مراقبة حالة isDownloading
  console.log('📊 [State] isDownloading =', isDownloading);

  const handleFetchInfo = async () => {
    if (!url) {
      toast.error('❌ الرجاء إدخال رابط YouTube');
      return;
    }

    setLoading(true);
    toast.loading('⏳ جاري جلب معلومات الفيديو...');
    
    try {
      // Try yt-dlp API first (more reliable)
      let response = await fetch('/api/video-info-pro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      // Fallback to ytdl-core if yt-dlp not installed
      if (!response.ok) {
        console.log('yt-dlp API failed, falling back to ytdl-core...');
        response = await fetch('/api/video-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
      }

      if (!response.ok) {
        throw new Error('فشل في جلب المعلومات');
      }

      const data = await response.json();
      
      if (!data.success && data.error) {
        throw new Error(data.error);
      }
      
      setVideoInfo(data);
      toast.dismiss();
      toast.success('✅ تم جلب معلومات الفيديو بنجاح!');
    } catch (error) {
      console.error(error);
      toast.dismiss();
      const errorMsg = error instanceof Error ? error.message : 'حدث خطأ أثناء جلب معلومات الفيديو';
      toast.error(`❌ ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!url) {
      toast.error('❌ الرجاء إدخال رابط أولاً');
      return;
    }

    console.log('🚀 [LoaderThree] بدء التحميل - LoaderThree يظهر الآن!');
    setIsDownloading(true); // 🔥 يظهر LoaderThree في وسط الشاشة
    
    try {
      // Build download URL
      let downloadUrl = `/api/download?url=${encodeURIComponent(url)}`;
      
      if (downloadType === 'audio') {
        downloadUrl += `&format=audio&quality=256`;
      } else {
        downloadUrl += `&format=video&quality=${selectedFormat || '720'}`;
      }

      console.log('[Frontend] Downloading:', downloadUrl);

      // استخدام fetch للتحقق من بداية التحميل
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error('فشل التحميل');
      }

      console.log('✅ [LoaderThree] بدأ التحميل - إخفاء اللودر الآن!');
      
      // تحويل الـ response إلى blob ثم تحميله
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      // إنشاء رابط للتحميل
      const link = document.createElement('a');
      link.href = blobUrl;
      
      // تحديد اسم الملف
      const filename = downloadType === 'audio' 
        ? `audio_${Date.now()}.mp3`
        : `video_${Date.now()}.mp4`;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // تنظيف blob URL
      window.URL.revokeObjectURL(blobUrl);
      
      setIsDownloading(false);
      toast.success('✅ تم التحميل بنجاح!');
    } catch (error) {
      console.error('❌ [LoaderThree] خطأ في التحميل:', error);
      setIsDownloading(false);
      toast.error('❌ حدث خطأ. يرجى المحاولة مرة أخرى.');
    }
  };

  return (
    <div className="p-4 sm:p-8">
      {/* LoaderThree Overlay - يظهر عند التحميل */}
      {isDownloading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl">
            <LoaderThree />
            <p className="text-center mt-4 text-lg font-semibold text-gray-700 dark:text-gray-200">
              جاري تحضير التحميل...
            </p>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        {/* Theme Toggle Switch في أعلى اليمين */}
        <div className="flex justify-end mb-6">
          <Switch />
        </div>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className='px-3 py-3 bg-white absolute  right-[37%]'></div>
            <FaYoutube className="text-red-600 z-1 text-5xl" />
            <h1 
              className="text-4xl font-bold"
              style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}
            >
              YouTube Downloader
            </h1>
          </div>
          <p style={{ color: theme === 'dark' ? '#d1d5db' : '#4b5563' }}>
            حمل فيديوهاتك المفضلة من يوتيوب بجودات مختلفة
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>أدخل رابط الفيديو</CardTitle>
            <CardDescription>
              الصق رابط YouTube هنا للحصول على خيارات التحميل
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                className="flex-1"
                dir="ltr"
              />
              <Button onClick={handleFetchInfo} disabled={loading}>
                {loading ? (
                  <div className="flex items-center py-4 px-5 gap-2">
                    <LoaderOne />
               
                  </div>
                ) : (
                  'بحث'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {videoInfo && (
          <Card>
            <CardHeader>
              <div className="flex gap-4">
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  className="w-40 h-24 object-cover rounded"
                />
                <div>
                  <CardTitle className="text-lg mb-2">{videoInfo.title}</CardTitle>
                  <CardDescription>{videoInfo.author}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 mb-4">
                <Button
                  variant={downloadType === 'video' ? 'default' : 'outline'}
                  onClick={() => setDownloadType('video')}
                  className="flex-1"
                >
                  <FaVideo className="mr-2" /> فيديو
                </Button>
                <Button
                  variant={downloadType === 'audio' ? 'default' : 'outline'}
                  onClick={() => setDownloadType('audio')}
                  className="flex-1"
                >
                  <FaMusic className="mr-2" /> صوت فقط
                </Button>
              </div>

              {downloadType === 'video' && videoInfo.videoFormats.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    اختر الجودة
                  </label>
                  <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر جودة الفيديو" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(videoInfo?.videoFormats) &&
                        videoInfo.videoFormats
                          .filter((f) => f && (f.itag || f.quality)) // 🔒 تأكد من وجود itag أو quality
                          .map((format, index) => {
                            // Generate unique key (use itag if available, otherwise quality + index)
                            const key = format.itag ? format.itag.toString() : `${format.quality}-${index}`;
                            const value = format.itag ? format.itag.toString() : format.quality || `format-${index}`;
                            
                            return (
                              <SelectItem key={key} value={value}>
                                {format.quality || format.qualityLabel || "Unknown quality"} - {format.container || format.format || "N/A"}
                                {format.size && ` (${(parseInt(format.size) / 1024 / 1024).toFixed(2)} MB)`}
                              </SelectItem>
                            );
                          })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {downloadType === 'audio' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    اختر صيغة الصوت
                  </label>
                  <Select value={audioFormat} onValueChange={(val: string) => setAudioFormat(val as 'mp3' | 'wav')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mp3">MP3</SelectItem>
                      <SelectItem value="wav">WAV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                onClick={handleDownload}
                className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
                size="lg"
                disabled={downloadType === 'video' && !selectedFormat}
              >
                <FaDownload className="mr-2" />
                {downloadType === 'video' ? '▶️ تشغيل وتحميل الفيديو' : '🎵 تشغيل وتحميل الصوت'}
              </Button>
              
              <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
                💡 سيتم فتح صفحة تشغيل حيث يمكنك المشاهدة والتحميل
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* AI Lyrics Generator Section - Collapsible with Animation */}
      <div className="max-w-4xl mx-auto mt-8">
        <motion.div animate={isLyricsOpen ? "open" : "closed"}>
          <Card>
            <CardHeader 
              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              onClick={() => setIsLyricsOpen(!isLyricsOpen)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle 
                    className="text-xl font-bold mb-2"
                    style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}
                  >
                    🎵 AI Lyrics Generator
                  </CardTitle>
                  <CardDescription style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}>
                    Generate song lyrics using AI
                  </CardDescription>
                </div>
                <motion.div variants={iconVariants}>
                  <FiChevronDown className="text-2xl" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }} />
                </motion.div>
              </div>
            </CardHeader>
            
            <AnimatePresence>
              {isLyricsOpen && (
                <motion.div
                  initial="collapsed"
                  animate="open"
                  exit="collapsed"
                  variants={contentVariants}
                >
                  <CardContent>
                    <motion.div 
                      className="relative w-full overflow-hidden rounded-lg" 
                      style={{ height: '600px' }}
                      variants={iframeVariants}
                    >
                      <iframe
                        src="https://www.yeschat.ai/i/gpts-2OToEpmlAP-Rewrite-This-Song-Lyrics-Generator"
                        className="w-full h-full border-0 rounded-lg"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                        title="AI Lyrics Generator"
                      />
                    </motion.div>
                    <motion.p 
                      className="text-xs text-center mt-4"
                      style={{ color: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                      variants={textVariants}
                    >
                      ⚠️ إذا لم يظهر المحتوى، الموقع قد يمنع التضمين في iframe
                    </motion.p>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

// Animation variants
const iconVariants = {
  open: { rotate: 180 },
  closed: { rotate: 0 },
};

const contentVariants = {
  open: {
    height: "auto",
    opacity: 1,
    transition: {
      height: {
        duration: 0.4,
      },
      opacity: {
        duration: 0.3,
        delay: 0.1,
      },
    },
  },
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: {
        duration: 0.4,
      },
      opacity: {
        duration: 0.2,
      },
    },
  },
};

const iframeVariants = {
  open: {
    scale: 1,
    y: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
      delay: 0.2,
    },
  },
  collapsed: {
    scale: 0.95,
    y: -20,
    opacity: 0,
  },
};

const textVariants = {
  open: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.4,
    },
  },
  collapsed: {
    opacity: 0,
    y: -10,
  },
};