import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { unlink } from "fs/promises";
import { createReadStream, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Download API - yt-dlp version (no ytdl-core)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");
  const format = searchParams.get("format");
  const quality = searchParams.get("quality") || "720";

  if (!url) {
    return NextResponse.json({ error: "الرجاء إدخال رابط" }, { status: 400 });
  }

  const tempFile = join(tmpdir(), `ytdl_${Date.now()}`);
  const title = await getVideoTitle(url);
  const sanitizedTitle = sanitizeFilename(title);
  const extension = format === "audio" ? "mp3" : "mp4";
  const outputFile = `${tempFile}.${extension}`;
  const filename = `${sanitizedTitle}.${extension}`;

  let formatSelector = "best";
  if (format === "audio") {
    formatSelector = "bestaudio";
  } else {
    const height = parseInt(quality);
    if (!isNaN(height)) {
      formatSelector = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
    }
  }

  const args = [
    "-f",
    formatSelector,
    "--no-warnings",
    "--no-playlist",
    "-o",
    outputFile,
    url,
  ];

  if (format === "audio") {
    args.splice(2, 0, "-x", "--audio-format", "mp3", "--audio-quality", "0");
  } else {
    args.push("--merge-output-format", "mp4");
  }

  console.log("[DOWNLOAD] yt-dlp args:", args.join(" "));

  await new Promise<void>((resolve, reject) => {
    const ytdlp = spawn("yt-dlp", args);
    let errorOutput = "";

    ytdlp.stderr.on("data", (data) => {
      errorOutput += data.toString();
      console.log("[yt-dlp]", data.toString().trim());
    });

    ytdlp.on("close", (code) => {
      if (code === 0 && existsSync(outputFile)) {
        resolve();
      } else {
        reject(new Error(errorOutput || "Download failed"));
      }
    });

    ytdlp.on("error", (err) => {
      reject(new Error(`yt-dlp not found: ${err.message}`));
    });
  });

  const fileStream = createReadStream(outputFile);
  fileStream.on("end", async () => {
    try {
      await unlink(outputFile);
      console.log("[DOWNLOAD] Temp file deleted");
    } catch (err) {
      console.error("[DOWNLOAD] Cleanup error:", err);
    }
  });

  return new Response(fileStream as any, {
    headers: {
      "Content-Type": format === "audio" ? "audio/mpeg" : "video/mp4",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Get video title using yt-dlp
 */
async function getVideoTitle(url: string): Promise<string> {
  return new Promise((resolve) => {
    const ytdlp = spawn("yt-dlp", ["--get-title", "--no-warnings", url]);
    let output = "";
    ytdlp.stdout.on("data", (data) => (output += data.toString()));
    ytdlp.on("close", () => resolve(output.trim() || "video"));
    ytdlp.on("error", () => resolve("video"));
  });
}

/**
 * Sanitize filename
 */
function sanitizeFilename(filename: string): string {
  return (
    filename
      .replace(/[^a-z0-9\s\-_أ-ي]/gi, "")
      .replace(/\s+/g, "_")
      .substring(0, 100) || "video"
  );
}