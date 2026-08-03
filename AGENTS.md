# AGENTS.md

Guidance for AI coding agents (Claude Code, Antigravity, Cursor, Copilot, OpenCode) working in this repository.

## Repository Overview

This repository contains an automated M3U playlist extraction server and CORS/Referer reverse proxy relay system for **DaddyLive (`dlhd.st`)** live TV and sports channels.

DaddyLive streams are secured using:
1. Multi-tier iframe embedding (`https://dlhd.st/watch.php?id={id}` ➔ `https://dlhd.st/stream/stream-{id}.php` ➔ `https://hamis.romponalis.st/premiumtv/daddy3.php?id={id}`).
2. Base64 `window.atob(...)` Clappr player source obfuscation.
3. Strict HTTP `Referer` and `Origin` validation.

---

## 📊 Stream Specifications & Channel Metrics

- **Total Active Channels**: **899+ Live TV & Sports Channels**
- **Stream Protocol**: **HLS (HTTP Live Streaming / `.m3u8` Master Manifests)**
- **Video Codec**: **H.264 / AVC (`avc1.640020`)**
- **Audio Codec**: **AAC (`mp4a.40.2`)**
- **Resolution & Frame Rate**: **720p HD (1280x720) @ 59.94 / 60 FPS**
- **Average Bandwidth**: **~7,000 kbps (8,900 kbps peak)**
- **MIME / Content-Type**: `application/vnd.apple.mpegurl` or `text/plain`

---

## Core Architecture & Workflow

```
[ DaddyLive 24/7 Page ] ───> Fetch Channel Catalog (899 channels) from dlhd.st/24-7-channels.php
         │
         ▼
[ Embed Page Fetch ] ───> Fetch Player iFrame: https://hamis.romponalis.st/premiumtv/daddy3.php?id={id}
         │
         ▼
[ Base64 Decoder ] ───> Extract window.atob('...') string and decode direct .m3u8 URL
         │
         ▼
[ M3U Generator ] ───> Write #EXTM3U playlist & serve /dlhd.m3u & /playlist.m3u
         │
         ▼
[ Reverse Proxy (/live.php) ] ───> Spoof Referer: https://hamis.romponalis.st/ & Origin headers,
                                   Inject Access-Control-Allow-Origin: * CORS headers
```

---

## Key Endpoints & Commands

- **`server.cjs`**: Primary Express / HTTP application entry point for Cloud Run / Node.js. Serves `/dlhd.m3u` playlist and `/live.php` reverse proxy.
- **`daddylive_extractor.cjs`**: Standalone crawler script. Crawls all 899 DaddyLive channels and updates `dlhd.m3u`.
- **`vlc_bridge.js`**: Standalone proxy bridge for local VLC testing (`http://localhost:8088/play.m3u8?id=51`).

---

## How to Enable & Integrate on Any Website (Instructions for AI & Developers)

To play DaddyLive streams in any browser video player (Hls.js / Video.js / JW Player) without CORS or 403 Forbidden errors:

### 1. Website Frontend Player Integration Script
```html
<video id="videoPlayer" controls autoplay style="width:100%; max-width:900px;"></video>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>

<script>
const PROXY_SERVER = "https://your-cloud-run-domain.a.run.app";

async function playDaddyLiveChannel(channelId) {
    const video = document.getElementById("videoPlayer");
    const hls = new Hls();

    // Route playback through backend stream resolver & proxy
    const res = await fetch(`${PROXY_SERVER}/api/resolve_stream/${channelId}`);
    const data = await res.json();

    if (data.success && data.proxyUrl) {
        const streamUrl = `${PROXY_SERVER}${data.proxyUrl}`;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else {
        console.error("Stream resolution failed");
    }
}

// Example: Play ABC USA (ID 51)
playDaddyLiveChannel('51');
</script>
```

### 2. Port Binding & Environment
- Server port binds to `process.env.PORT || 8080`.
- Docker build entry point: `node server.cjs`.
