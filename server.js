const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const dns = require('node:dns');

dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(cors());

// --- DECIPHER ENGINE ---
function decryptPulsePoint(data) {
    if (!data || !data.ct) return data.incidents || [];
    try {
        const passphrase = "nombrady5rings";
        const salt = Buffer.from(data.s, 'hex');
        const iv = Buffer.from(data.iv, 'hex');
        const ct = Buffer.from(data.ct, 'base64');

        let key = Buffer.alloc(0);
        let block = Buffer.alloc(0);
        while (key.length < 32) {
            const hash = crypto.createHash('md5').update(block).update(passphrase).update(salt).digest();
            block = hash;
            key = Buffer.concat([key, block]);
        }
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', key.slice(0, 32), iv);
        let decrypted = decipher.update(ct, 'binary', 'utf8') + decipher.final('utf8');
        
        const parsed = JSON.parse(decrypted.substring(decrypted.indexOf('{'), decrypted.lastIndexOf('}') + 1));
        return parsed.incidents?.active || parsed.incidents || [];
    } catch (e) {
        console.log("Decryption failed:", e.message);
        return [];
    }
}

// --- CLACKAMAS ROUTE ---
app.get('/incidents', async (req, res) => {
    const id = '00057'; // CLACKAMAS FIRE
    try {
        console.log(`Fetching Clackamas Fire (00057)...`);
        const url = `https://web.pulsepoint.org/data/giba.php?agencyid=${id}`;
        
        const response = await axios.get(url, {
            timeout: 10000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://web.pulsepoint.org/'
            }
        });

        const incidents = decryptPulsePoint(response.data);
        console.log(`Success: Found ${incidents.length} incidents for Clackamas.`);
        res.json(incidents);
    } catch (err) {
        console.log(`Clackamas Fetch Failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

app.get('/test', (req, res) => {
    res.json({ status: "online", target: "Clackamas Fire (00057)", time: new Date().toLocaleTimeString() });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Clackamas-Only Bridge active on ${PORT}`));