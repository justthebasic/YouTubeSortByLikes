// src/app/api/videos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getChannelIdFromUrl } from '@/lib/getChannelId';

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    publishedAt: string;
    thumbnails: { medium: { url: string } };
  };
}

interface ApiError extends Error {
  status?: number;
}

// --- In-memory rate limiter (per-process, no external deps) ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// --- In-memory cache (24h TTL, no external deps) ---
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expiry) cache.delete(k);
    }
  }
}

// --- Helpers ---
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

interface VideoResult {
  title: string;
  videoId: string;
  views: number;
  likes: number;
  thumbnail: string;
  publishedAt: string;
  duration: string;
  comments: number;
}

function sortVideos(videos: VideoResult[]): VideoResult[] {
  const copy = [...videos];
  return copy.sort((a, b) => b.likes - a.likes);
}

// --- Main handler ---
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute.' },
        { status: 429 }
      );
    }

    if (!process.env.YOUTUBE_API_KEY) {
      return NextResponse.json({ error: 'YouTube API key is not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const channelUrl = searchParams.get('channelUrl');
    const maxVideos = Number(searchParams.get('maxVideos')) || 50;

    if (!channelUrl) {
      return NextResponse.json({ error: 'Missing channelUrl param' }, { status: 400 });
    }
    if (maxVideos < 50 || maxVideos > 1000) {
      return NextResponse.json({ error: 'maxVideos must be between 50 and 1000' }, { status: 400 });
    }

    const identifier = getChannelIdFromUrl(channelUrl);
    if (!identifier) {
      return NextResponse.json({ error: 'Could not parse channel or playlist URL' }, { status: 400 });
    }

    // Check server-side cache
    const cacheKey = `${identifier}:${maxVideos}`;
    const cached = getCached(cacheKey) as VideoResult[] | null;
    if (cached) {
      return NextResponse.json({ data: sortVideos(cached), cached: true }, { status: 200 });
    }

    // Resolve channel ID or playlist ID
    let channelId: string | undefined;
    let playlistId: string | undefined;

    if (identifier.startsWith('playlist/')) {
      playlistId = identifier.split('/')[1];
    } else if (identifier.startsWith('UC')) {
      channelId = identifier;
    } else if (identifier.startsWith('@')) {
      channelId = await resolveChannelIdFromUsername(identifier.slice(1));
    } else if (identifier.startsWith('c/')) {
      channelId = await resolveChannelIdFromCustomUrl(identifier.slice(2));
    } else {
      return NextResponse.json({ error: 'Invalid channel or playlist identifier' }, { status: 400 });
    }

    // Fetch videos from search endpoint or playlist items
    let videos: YouTubeSearchItem[] = [];
    if (playlistId) {
      videos = await getPlaylistVideos(playlistId, maxVideos);
    } else if (channelId) {
      const uploadsId = await getUploadsPlaylistId(channelId);
      if (uploadsId) {
        videos = await getPlaylistVideos(uploadsId, maxVideos);
      } else {
        // Fallback to search if uploads playlist not found
        videos = await getChannelVideos(channelId, maxVideos);
      }
    }

    // BATCH stats: 50 IDs per call instead of 1 (98% quota reduction)
    const videosWithStats = await batchGetVideoStats(videos);

    setCache(cacheKey, videosWithStats);
    return NextResponse.json({ data: sortVideos(videosWithStats) }, { status: 200 });
  } catch (err: unknown) {
    const error = err as ApiError;
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}

// --- Batch video stats (50 per call) ---
async function batchGetVideoStats(videos: YouTubeSearchItem[]): Promise<VideoResult[]> {
  const videoIds = videos.map(v => v.id.videoId);
  const chunks = chunkArray(videoIds, 50);

  const statsMap = new Map<string, { viewCount: string; likeCount: string; duration: string; commentCount: string }>();

  for (const chunk of chunks) {
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${chunk.join(',')}&part=statistics,contentDetails&key=${process.env.YOUTUBE_API_KEY}`;
    const data = await fetchYouTubeAPI(url);
    if (data.items) {
      for (const item of data.items) {
        statsMap.set(item.id, {
          viewCount: item.statistics?.viewCount || '0',
          likeCount: item.statistics?.likeCount || '0',
          commentCount: item.statistics?.commentCount || '0',
          duration: item.contentDetails?.duration || 'PT0S',
        });
      }
    }
  }

  return videos.map(v => {
    const stats = statsMap.get(v.id.videoId);
    return {
      title: v.snippet.title,
      videoId: v.id.videoId,
      views: Number(stats?.viewCount || 0),
      likes: Number(stats?.likeCount || 0),
      thumbnail: v.snippet.thumbnails?.medium?.url || '',
      publishedAt: v.snippet.publishedAt || '',
      duration: stats?.duration || 'PT0S',
      comments: Number(stats?.commentCount || 0),
    };
  });
}

// --- YouTube API helpers ---
async function fetchYouTubeAPI(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`YouTube API responded with status: ${response.status}`) as ApiError;
    error.status = response.status;
    throw error;
  }
  return await response.json();
}

async function resolveChannelIdFromUsername(username: string): Promise<string> {
  try {
    const data = await fetchYouTubeAPI(
      `https://www.googleapis.com/youtube/v3/channels?key=${process.env.YOUTUBE_API_KEY}&forUsername=${username}&part=id`
    );
    if (data.items?.length > 0) return data.items[0].id;
  } catch {
    console.log('forUsername lookup failed, trying search...');
  }
  return resolveChannelIdFromCustomUrl(username);
}

async function resolveChannelIdFromCustomUrl(customUrl: string): Promise<string> {
  try {
    const searchData = await fetchYouTubeAPI(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(customUrl)}&type=channel&maxResults=5&key=${process.env.YOUTUBE_API_KEY}`
    );
    if (!searchData.items?.length) throw new Error('Channel not found');

    for (const item of searchData.items) {
      const channelId = item.id.channelId;
      const channelData = await fetchYouTubeAPI(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${process.env.YOUTUBE_API_KEY}`
      );
      if (channelData.items?.length) {
        let channelCustomUrl = channelData.items[0].snippet.customUrl;
        if (channelCustomUrl) {
          channelCustomUrl = channelCustomUrl.replace(/^@/, '').toLowerCase();
          if (channelCustomUrl === customUrl.toLowerCase()) return channelId;
        }
      }
    }

    const fallbackId = searchData.items[0].id.channelId;
    const fallbackData = await fetchYouTubeAPI(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${fallbackId}&key=${process.env.YOUTUBE_API_KEY}`
    );
    if (fallbackData.items?.length) return fallbackId;
    throw new Error('Could not find matching channel');
  } catch (error) {
    console.error('Error resolving custom URL:', error);
    throw new Error('Could not find matching channel');
  }
}

async function getChannelVideos(channelId: string, maxVideos: number = 50) {
  let allVideos: YouTubeSearchItem[] = [];
  let nextPageToken: string | undefined = undefined;

  do {
    const url = `https://www.googleapis.com/youtube/v3/search?channelId=${channelId}&part=snippet,id&type=video&maxResults=50&order=date&key=${process.env.YOUTUBE_API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
    const data = await fetchYouTubeAPI(url);
    if (!data.items) break;
    allVideos = [...allVideos, ...data.items];
    nextPageToken = data.nextPageToken;
    if (allVideos.length >= maxVideos) break;
  } while (nextPageToken);

  return allVideos;
}

async function getPlaylistVideos(playlistId: string, maxVideos: number = 50) {
  let allVideos: YouTubeSearchItem[] = [];
  let nextPageToken: string | undefined = undefined;

  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${playlistId}&part=snippet&maxResults=50&key=${process.env.YOUTUBE_API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
    const data = await fetchYouTubeAPI(url);
    if (!data.items) break;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappedItems = data.items.map((item: any) => ({
      id: { videoId: item.snippet.resourceId.videoId },
      snippet: {
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        thumbnails: item.snippet.thumbnails
      }
    }));
    allVideos = [...allVideos, ...mappedItems];
    nextPageToken = data.nextPageToken;
    if (allVideos.length >= maxVideos) break;
  } while (nextPageToken);

  return allVideos;
}

async function getUploadsPlaylistId(channelId: string): Promise<string | null> {
  try {
    const data = await fetchYouTubeAPI(
      `https://www.googleapis.com/youtube/v3/channels?id=${channelId}&part=contentDetails&key=${process.env.YOUTUBE_API_KEY}`
    );
    return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null;
  } catch (error) {
    console.error('Error fetching uploads playlist ID:', error);
    return null;
  }
}
