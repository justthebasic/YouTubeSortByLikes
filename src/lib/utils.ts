/**
 * Utility functions for text manipulation, formatting, and data export
 */

export function decodeHtmlEntities(text: string) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

/** Parse ISO 8601 duration (PT4M13S, PT1H2M3S) to total seconds */
export function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    parseInt(match[1] || '0') * 3600 +
    parseInt(match[2] || '0') * 60 +
    parseInt(match[3] || '0')
  );
}

/** Format seconds to human-readable duration (1:02:03 or 4:13) */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Format a number with locale-aware separators */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Format a date string to locale short date */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export interface VideoData {
  title: string;
  videoId: string;
  views: number;
  likes: number;
  thumbnail: string;
  publishedAt: string;
  duration: string; // ISO 8601
  comments: number;
  description: string;
}

/** Export video data to CSV and trigger download */
export function exportToCSV(videos: VideoData[], filename = 'videos.csv') {
  const header = 'Rank,Title,Likes,Comments,Views,Ratio (%),Engagement (%),Velocity (Views/Day),Duration,Published,URL,Description\n';
  const rows = videos.map((v, i) => {
    const ratio = v.views > 0 ? ((v.likes / v.views) * 100).toFixed(2) : '0';
    const engagement = v.views > 0 ? (((v.likes + v.comments) / v.views) * 100).toFixed(2) : '0';
    
    const daysSincePublished = Math.max(1, (Date.now() - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24));
    const velocity = (v.views / daysSincePublished).toFixed(0);

    const dur = formatDuration(parseDuration(v.duration));
    const date = new Date(v.publishedAt).toISOString().split('T')[0];
    const url = `https://www.youtube.com/watch?v=${v.videoId}`;
    const title = v.title.replace(/"/g, '""');
    const description = v.description ? v.description.replace(/"/g, '""') : '';
    return `${i + 1},"${title}",${v.likes},${v.comments},${v.views},${ratio},${engagement},${velocity},${dur},${date},${url},"${description}"`;
  });
  const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

/** Export video data to JSON and trigger download */
export function exportToJSON(videos: VideoData[], filename = 'videos.json') {
  const data = videos.map((v, i) => {
    const daysSincePublished = Math.max(1, (Date.now() - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24));
    return {
      rank: i + 1,
      title: v.title,
      likes: v.likes,
      comments: v.comments,
      views: v.views,
      ratio: v.views > 0 ? parseFloat(((v.likes / v.views) * 100).toFixed(2)) : 0,
      engagement: v.views > 0 ? parseFloat((((v.likes + v.comments) / v.views) * 100).toFixed(2)) : 0,
      velocity: Math.round(v.views / daysSincePublished),
      duration: formatDuration(parseDuration(v.duration)),
      publishedAt: v.publishedAt,
      url: `https://www.youtube.com/watch?v=${v.videoId}`,
      description: v.description || '',
    };
  });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}