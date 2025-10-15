'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FaDownload, FaArrowRight } from 'react-icons/fa';

export default function PlayPage() {
  const searchParams = useSearchParams();
  const [videoData, setVideoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = searchParams.get('url');
    const quality = searchParams.get('quality') || '720';
    const format = searchParams.get('format') || 'video';

    if (!url) {
      setError('لا يوجد رابط فيديو');
      setLoading(false);
      return;
    }

    // جلب معلومات الفيديو
    fetch(`/api/download?url=${encodeURIComponent(url)}&format=${format}&quality=${quality}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setVideoData(data);
        } else {
          setError(data.error || 'فشل في جلب الفيديو');
        }
        setLoading(false);
      })
      .catch(err => {
        setError('حدث خطأ في جلب الفيديو');
        setLoading(false);
      });
  }, [searchParams]);

  // Video element focus and fullscreen enhancement (inspired by Firefox TopLevelVideoDocument)
  useEffect(() => {
    if (!videoData?.downloadUrl) return;

    const videoElement = document.querySelector('video');
    if (!videoElement) return;

    // Auto-focus on video after a short delay
    const focusTimeout = setTimeout(() => {
      videoElement.focus();
    }, 500);

    // Auto-focus on document focus
    const setFocusToVideo = (e?: Event) => {
      if (e && (e.target as HTMLElement) === videoElement) return;
      videoElement.focus();
    };

    document.addEventListener('focus', setFocusToVideo as EventListener, true);

    // F11 fullscreen toggle
    const handleKeyPress = (ev: KeyboardEvent) => {
      if (ev.key === 'F11' && videoElement.videoWidth !== 0 && videoElement.videoHeight !== 0) {
        ev.preventDefault();
        ev.stopPropagation();

        if (!document.fullscreenElement) {
          videoElement.requestFullscreen().catch(err => {
            console.error('Fullscreen error:', err);
          });
        } else {
          document.exitFullscreen();
        }
      }
    };

    document.addEventListener('keypress', handleKeyPress);

    console.log('✅ Video ready! Press F11 for fullscreen, right-click to download.');

    // Cleanup
    return () => {
      clearTimeout(focusTimeout);
      document.removeEventListener('focus', setFocusToVideo as EventListener, true);
      document.removeEventListener('keypress', handleKeyPress);
    };
  }, [videoData]);

  const handleDownload = () => {
    if (videoData?.downloadUrl) {
      const link = document.createElement('a');
      link.href = videoData.downloadUrl;
      link.download = videoData.title || 'video';
      link.click();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">جاري التحميل...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-500 text-xl">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black" style={{ height: '100vh', margin: 0, padding: 0 }}>
      <style jsx global>{`
        :root {
          background-color: black;
          height: 100%;
          -moz-user-focus: ignore;
        }

        video {
          position: absolute;
          inset: 0;
          margin: auto;
          max-width: 100%;
          max-height: 100%;
          user-select: none;
          -moz-user-focus: normal;
        }

        video:focus {
          outline-style: none;
        }
      `}</style>

      {/* شريط علوي للتحكم */}
      <div className="fixed top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10 flex justify-between items-center">
        <div className="text-white font-bold truncate max-w-md">
          {videoData?.title || 'مشغل الفيديو'}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
          >
            <FaDownload />
            تحميل
          </button>
          <a
            href="/"
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
          >
            <FaArrowRight />
            رجوع
          </a>
        </div>
      </div>

      {/* مشغل الفيديو */}
      {videoData?.downloadUrl && (
        <video
          src={videoData.downloadUrl}
          controls
          autoPlay
          crossOrigin="anonymous"
          className="w-full h-full"
          style={{
            position: 'absolute',
            inset: 0,
            margin: 'auto',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          متصفحك لا يدعم تشغيل الفيديو.
        </video>
      )}

      {/* تعليمات التحميل */}
      <div className="fixed bottom-4 left-4 right-4 bg-black/80 text-white p-3 rounded-lg text-sm text-center z-10">
        💡 <strong>نصيحة:</strong> انقر بالزر الأيمن على الفيديو واختر "حفظ الفيديو باسم" للتحميل المباشر
      </div>
    </div>
  );
}
