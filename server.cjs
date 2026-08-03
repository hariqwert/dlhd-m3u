const http = require('http');
const https = require('https');
const urlModule = require('url');
const fs = require('fs');

const PORT = process.env.PORT || 8080;
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 Minutes

let cachedPlaylist = null;
let lastFetchTime = 0;

function fetchPage(urlStr, referer) {
    return new Promise((resolve) => {
        try {
            const u = new URL(urlStr);
            const options = {
                hostname: u.hostname,
                port: u.port || (u.protocol === 'https:' ? 443 : 80),
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': referer || 'https://dlhd.st/'
                }
            };
            const client = u.protocol === 'https:' ? https : http;
            client.get(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', () => resolve(''));
        } catch(e) {
            resolve('');
        }
    });
}

function decodeDaddyLiveBase64(html) {
    if (!html) return null;
    const match = html.match(/source:\s*window\.atob\(["']([^"']+)["']\)/i);
    if (match) {
        try {
            return Buffer.from(match[1], 'base64').toString('utf-8');
        } catch(e) {}
    }
    return null;
}

function encodeToken(str) {
    return Buffer.from(str).toString('base64url');
}

function decodeToken(token) {
    try {
        return Buffer.from(token, 'base64url').toString('utf-8');
    } catch(e) {
        return null;
    }
}

async function resolveDaddyLiveStream(channelId) {
    const cleanId = channelId.replace(/[^0-9]/g, '') || '51';
    const streamPhpUrl = `https://dlhd.st/stream/stream-${cleanId}.php`;
    const playerIframeUrl = `https://hamis.romponalis.st/premiumtv/daddy3.php?id=${cleanId}`;
    
    const playerHtml = await fetchPage(playerIframeUrl, streamPhpUrl);
    const m3u8Url = decodeDaddyLiveBase64(playerHtml);
    const token = m3u8Url ? encodeToken(m3u8Url + '|' + playerIframeUrl) : null;

    return {
        success: !!m3u8Url,
        channelId: cleanId,
        streamPhpUrl,
        playerIframeUrl,
        m3u8Url,
        proxyUrl: token ? `/live.php?token=${token}` : null
    };
}

async function buildPlaylist() {
    const now = Date.now();
    if (cachedPlaylist && (now - lastFetchTime < CACHE_DURATION_MS)) {
        return cachedPlaylist;
    }

    console.log("[*] Fetching 24/7 channels catalog from dlhd.st...");
    const html = await fetchPage('https://dlhd.st/24-7-channels.php');
    const linkMatches = [...html.matchAll(/href=["'](?:https?:\/\/dlhd\.st)?\/watch\.php\?id=(\d+)["'][^>]*>([^<]+)/gi)];

    let m3uLines = ['#EXTM3U\n'];
    let count = 0;

    const sampleIds = ["51", "61", "62", "90", "91", "100", "116", "123", "124", "134", "206", "283", "302", "303", "304", "370", "425", "429", "432", "578", "600", "664", "742"];
    
    for (const id of sampleIds) {
        const res = await resolveDaddyLiveStream(id);
        if (res.success) {
            count++;
            m3uLines.push(`#EXTINF:-1 tvg-name="DaddyLive Channel ${id}" group-title="DaddyLive",DaddyLive Channel ${id}\n`);
            m3uLines.push(`${res.m3u8Url}\n`);
        }
    }

    cachedPlaylist = m3uLines.join('');
    lastFetchTime = Date.now();
    try {
        fs.writeFileSync('dlhd.m3u', cachedPlaylist, 'utf-8');
    } catch(e) {}
    return cachedPlaylist;
}

function handleProxyRequest(req, res) {
    const parsedUrl = urlModule.parse(req.url, true);
    const query = parsedUrl.query;
    
    let decodedStr = null;
    if (query.token) decodedStr = decodeToken(query.token);
    
    if (!decodedStr) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Missing or invalid token' }));
    }

    const parts = decodedStr.split('|');
    const targetUrl = parts[0];
    const referer = parts[1] || 'https://hamis.romponalis.st/';

    try {
        const target = new URL(targetUrl);
        const proxyOptions = {
            hostname: target.hostname,
            port: target.port || (target.protocol === 'https:' ? 443 : 80),
            path: target.pathname + target.search,
            method: req.method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': referer,
                'Origin': new URL(referer).origin
            }
        };

        const client = (target.protocol === 'https:' ? https : http).request(proxyOptions, (remoteRes) => {
            const headers = { ...remoteRes.headers };
            headers['access-control-allow-origin'] = '*';
            headers['access-control-allow-methods'] = 'GET, OPTIONS';
            headers['access-control-allow-headers'] = '*';

            res.writeHead(remoteRes.statusCode, headers);
            remoteRes.pipe(res);
        });

        client.on('error', (err) => {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Proxy Error', message: err.message }));
        });

        req.pipe(client);
    } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid URL format' }));
    }
}

const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*'
        });
        return res.end();
    }

    if (url === '/dlhd.m3u' || url === '/playlist.m3u' || url === '/') {
        const playlist = await buildPlaylist();
        res.writeHead(200, {
            'Content-Type': 'application/x-mpegurl; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(playlist);
    } 
    else if (url.startsWith('/api/resolve_stream/') || url.startsWith('/stream/')) {
        const channelId = url.replace(/^\/(?:api\/resolve_stream|stream)\//, '');
        const result = await resolveDaddyLiveStream(channelId);
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(result, null, 2));
    } 
    else if (url === '/live.php' || url === '/proxy') {
        handleProxyRequest(req, res);
    } 
    else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`[✓] DaddyLive Server running on port ${PORT}`);
    console.log(`[✓] M3U Playlist: http://localhost:${PORT}/dlhd.m3u`);
    console.log(`[✓] Stream Resolver: http://localhost:${PORT}/api/resolve_stream/:id`);
    console.log(`[✓] Reverse Proxy: http://localhost:${PORT}/live.php?token=TOKEN`);
});
