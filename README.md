# YouTube Sort By Likes (Modernized)

<p align="center"><i>Find the best quality videos from any channel or playlist! Like:View ratio is the best signal.</i></p>

<p align="center">
  <img src="assets/image.png" width="700" alt="Screenshot of YouTube Sort By Likes">
</p>

## ✨ Key Features

- 🔍 **Universal Search**: Supports YouTube Channel URLs, `@usernames`, and Playlist URLs.
- 📊 **Advanced Analytics**:
  - **Likes/Views Ratio**: Identify the most loved content.
  - **Engagement Rate**: Combined signals (Likes + Comments) vs Views.
  - **View Velocity**: Track growth speed (Views/Day).
  - **Comment Counts**: See which videos spark the most conversation.
- ⚡ **Ultra-Efficient**: implementation of **Batch Processing** (50 videos/call) resulting in a **98% reduction** in API quota usage.
- 🚀 **High Performance**: Server-side caching (24h) and client-side filtering/sorting.
- 🎨 **Neo-Brutalist UI**: Stunning high-contrast design with full Dark Mode support.
- 📥 **Data Export**: Save your analysis to CSV or JSON with one click.
- 📱 **Fully Responsive**: Analyze content on any device.

## ⚠️ Note on the YouTube API Quota Limitations

This project uses the YouTube Data API which has a daily quota limit of 10,000 units. This is a hard limit that's difficult to increase.

To mitigate this, we have implemented:
- **Batch Requests**: Instead of fetching stats for each video individually, we batch 50 IDs per call.
- **Server-side Cache**: Results are cached for 24 hours to prevent redundant API calls.
- **Smart Resolution**: Intelligent handling of channel IDs and playlist IDs to minimize lookup overhead.

## 🛠️ To run locally 

1. Clone the repository:
```bash
git clone https://github.com/justthebasic/YouTubeSortByLikes.git
cd YouTubeSortByLikes
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory:
```env
YOUTUBE_API_KEY=your_api_key_here
```

4. Run the development server:
```bash
npm run dev
```

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.



