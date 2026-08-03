# 📺 dlhd-m3u

Automated **DaddyLive (`dlhd.st`)** 24/7 Channel M3U Playlist & CORS/Referer Proxy Server.

## Features
- **Auto-Refreshing M3U Playlist (`/dlhd.m3u`)**: Generates `#EXTM3U` playlists with direct `.m3u8` links.
- **Stream Resolver API (`/api/resolve_stream/:id`)**: Decodes `dlhd.st` Base64 player sources on the fly.
- **CORS & Referer Reverse Proxy (`/live.php?token=...`)**: Bypasses 403 Forbidden and CORS blocks for web video players (Hls.js, JW Player).

## Quick Start
```bash
git clone https://github.com/hariqwert/dlhd-m3u.git
cd dlhd-m3u
npm start
```

## Endpoints
- M3U Playlist: `http://localhost:8080/dlhd.m3u`
- Stream Resolver: `http://localhost:8080/api/resolve_stream/51`
- Reverse Proxy: `http://localhost:8080/live.php?token=TOKEN`

## Website Player Integration
See [`AGENTS.md`](./AGENTS.md) for step-by-step developer guidelines on embedding this backup stream proxy in any website player.
