const express = require('express');
const YTDlpWrap = require('yt-dlp-wrap').default;
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

let ytDlpWrap;
let isReady = false;

// Sanitize filename for download
function sanitizeFilename(filename) {
    return filename
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/-+/g, '-')
        .substring(0, 100)
        .trim()
        .replace(/^-+|-+$/g, '');
}

// Download and initialize yt-dlp
async function initializeYtDlp() {
    try {
        console.log('🔄 Setting up yt-dlp...');
        
        const binaryDir = path.join(__dirname, 'bin');
        const binaryPath = path.join(binaryDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
        
        if (!fs.existsSync(binaryDir)) {
            fs.mkdirSync(binaryDir, { recursive: true });
        }
        
        if (fs.existsSync(binaryPath)) {
            console.log('✅ Using existing yt-dlp binary');
            ytDlpWrap = new YTDlpWrap(binaryPath);
            isReady = true;
        } else {
            console.log('📥 Downloading yt-dlp binary...');
            await YTDlpWrap.downloadFromGithub(binaryPath);
            console.log('✅ yt-dlp downloaded');
            ytDlpWrap = new YTDlpWrap(binaryPath);
            isReady = true;
        }
        
        const version = await ytDlpWrap.getVersion();
        console.log('✅ yt-dlp version:', version);
        
    } catch (error) {
        console.error('❌ Failed to initialize yt-dlp:', error.message);
        console.log('⚠️ Trying system yt-dlp...');
        
        try {
            ytDlpWrap = new YTDlpWrap('yt-dlp');
            const version = await ytDlpWrap.getVersion();
            console.log('✅ Using system yt-dlp version:', version);
            isReady = true;
        } catch (err) {
            console.error('❌ System yt-dlp not found');
        }
    }
}

initializeYtDlp();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/video-info', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ 
                error: 'Service is still initializing. Please wait a moment and try again.' 
            });
        }

        const { url } = req.body;
        console.log('📥 Fetching info for:', url);
        
        const videoInfo = await ytDlpWrap.getVideoInfo(url);
        console.log('✅ Video:', videoInfo.title);
        
        const formats = [];
        
        const videoFormats = videoInfo.formats.filter(f => 
            f.vcodec !== 'none' && f.acodec !== 'none' && f.ext === 'mp4'
        );
        
        const qualities = ['1080', '720', '480', '360'];
        for (let quality of qualities) {
            const format = videoFormats.find(f => f.height == quality);
            if (format) {
                formats.push({
                    quality: quality + 'p',
                    type: 'MP4',
                    size: formatBytes(format.filesize || format.filesize_approx),
                    format: 'video',
                    formatId: format.format_id
                });
            }
        }
        
        const audioFormats = videoInfo.formats.filter(f => 
            f.acodec !== 'none' && f.vcodec === 'none'
        );
        
        if (audioFormats.length > 0) {
            const bestAudio = audioFormats.sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
            formats.push({
                quality: Math.round(bestAudio.abr || 128) + 'kbps',
                type: 'MP3',
                size: formatBytes(bestAudio.filesize || bestAudio.filesize_approx),
                format: 'audio',
                formatId: bestAudio.format_id
            });
        }

        console.log('📊 Available formats:', formats.length);

        res.json({
            videoId: videoInfo.id,
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
            duration: formatDuration(videoInfo.duration),
            formats: formats
        });
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch video info',
            details: error.message 
        });
    }
});

app.get('/api/download', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ 
                error: 'Service is initializing, please try again' 
            });
        }

        const { url, formatId } = req.query;
        console.log('⬇️ Downloading format:', formatId);
        
        const videoInfo = await ytDlpWrap.getVideoInfo(url);
        
        // Sanitize filename
        const cleanTitle = sanitizeFilename(videoInfo.title) || 'video';
        const filename = `${cleanTitle}.mp4`;
        
        console.log('📁 Filename:', filename);
        
        // Set headers safely
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'video/mp4');
        
        const stream = ytDlpWrap.execStream([
            url,
            '-f', formatId,
            '-o', '-'
        ]);
        
        stream.pipe(res);
        
        stream.on('error', (err) => {
            console.error('❌ Stream error:', err);
        });
        
    } catch (error) {
        console.error('❌ Download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed: ' + error.message });
        }
    }
});

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDuration(seconds) {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📦 Using yt-dlp-wrap`);
});