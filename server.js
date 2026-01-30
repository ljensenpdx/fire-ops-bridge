const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const dns = require('node:dns');

// Forces IPv4 to avoid Render's IPv6 resolution issues
dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(cors());

/**
 * PulsePoint Decryption Logic
 * Reverses the AES-256-CBC encryption using the 'nombrady5rings' key.
 */
function decryptPulsePoint(data) {
    if (!data || !data.ct) return data;
    
    try {
        const passphrase = "nombrady5rings";
        const salt = Buffer.from(data.s, 'hex');
        const iv = Buffer.from(data.iv, 'hex');
        const ct = Buffer.from(data.ct, 'base64');

        // Derive Key (PulsePoint's MD5 algorithm)
        let key = Buffer.alloc(0);
        let block = Buffer.alloc(0);
        while (key.length < 32) {
            block = crypto.createHash('md5').update(block).update(passphrase).update(salt).digest();
            key = Buffer.concat([key, block]);
        }
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', key.slice(0, 32), iv);
        let decrypted = decipher.update(ct, 'binary', 'utf8') + decipher.final('utf8');
        
        // Clean up 2026 double-stringified JSON
        let cleaned = decrypted.trim();
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.substring(1, cleaned.length - 1);
        }
        
        // Unescape backslashes
        cleaned = cleaned.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

        const parsed = JSON.parse(cleaned);
        return parsed.incidents?.active || parsed.active || parsed.incidents || [];
    } catch (e) {
        console.error("Mirroring Error:", e.message);
        return { error: "Decryption failed", raw_received: data };
    }
}

app.get('/incidents', async (req, res) => {
    const id = '00057'; // Clackamas Fire
    try {
        // Updated headers to specifically bypass the HTML redirect
        const url = `https://web.pulsepoint.org/data/giba.php?agencyid=${id}`;
        const response = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://web.pulsepoint.org/',
                'Origin': 'https://web.pulsepoint.org',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
            }
        });

        // Safety check: if we still get HTML, we log it
        if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
            console.error("REDIRECT DETECTED: Still receiving HTML instead of data.");
            return res.status(403).json({ 
                error: "Access Denied by PulsePoint", 
                message: "Server is being redirected to landing page. PulsePoint is blocking this IP." 
            });
        }

        const output = decryptPulsePoint(response.data);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(output, null, 4));
    } catch (err) {
        console.error("Fetch Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/test', (req, res) => {
    res.json({ status: "online", time: new Date().toLocaleTimeString() });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Mirror Bridge active on port ${PORT}`));