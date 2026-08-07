# AGENTS.md — DaddyLive (DLHD) M3U Stream Extraction Engine

Guidance for AI coding agents (Claude Code, Antigravity, Cursor, Copilot, OpenCode) working in the `dlhd-m3u` repository.

---

## Repository Overview

This repository hosts an automated extraction and 45-minute auto-refresh pipeline for **DaddyLive (`dlhd.st`)** live TV and sports channels.

- **Total Catalog:** 899 Channels (`channels.json`)
- **Verified Active 24/7 Channels:** 51 Channels (`channels_working.json` & `dlhd_working.m3u`)
- **Stream Format:** HLS (`.m3u8`), H.264 Video, AAC Audio @ 720p 60FPS
- **Logos:** High-resolution external `tvg-logo` URLs included in `dlhd_working.m3u`

---

## Player iFrame Security & Base64 Decoder

DaddyLive obfuscates `.m3u8` master manifests inside player iFrames.

- **Stream iFrame URL:** `https://hamis.romponalis.st/premiumtv/daddy3.php?id={channelId}`
- **Decoder Formula:**
  ```javascript
  const match = html.match(/source:\s*window\.atob\(["']([^"']+)["']\)/i);
  const m3u8Url = Buffer.from(match[1], 'base64').toString('utf-8');
  // Output CDN: https://xameleon.phantemlis.top/three/secure/.../index.m3u8
  ```

---

## Server Endpoints (`server.cjs`)

- `GET /dlhd_working.m3u`: 51 verified active channels in standard `#EXTM3U` format with `tvg-logo` metadata.
- `GET /dlhd.m3u`: Full channel catalog playlist.
- `GET /api/resolve_stream/:id`: JSON endpoint returning fresh stream URL & reverse proxy token.
- `GET /live.php?token=...`: Reverse proxy server bypassing CORS and HTTP 403 blocks.

---

## Website Player Integration (JavaScript)

```javascript
async function playDaddyLiveChannel(channelId) {
    const res = await fetch(`https://your-server.com/api/resolve_stream/${channelId}`);
    const data = await res.json();
    
    if (data.success) {
        const streamUrl = data.proxyUrl || data.m3u8Url;
        const video = document.getElementById('my-video-player');
        
        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
        }
    }
}
```
