const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const dns = require('node:dns');

dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(cors());

// --- THE ROBUST 2026 DECRYPTOR ---
function decryptPulsePoint(data) {
    if (!data || !data.ct) return [];
    
    try {
        const passphrase = "nombrady5rings";
        const salt = Buffer.from(data.s, 'hex');
        const iv = Buffer.from(data.iv, 'hex');
        const ct = Buffer.from(data.ct, 'base64');

        // Key Derivation (MD5 Salted)
        let key = Buffer.alloc(0);
        let block = Buffer.alloc(0);
        while (key.length < 32) {
            block = crypto.createHash('md5').update(block).update(passphrase).update(salt).digest();
            key = Buffer.concat([key, block]);
        }
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', key.slice(0, 32), iv);
        let decrypted = decipher.update(ct, 'binary', 'utf8') + decipher.final('utf8');
        
        // --- 2026 DATA CLEANING STEP ---
        // PulsePoint wraps the JSON in extra quotes and backslashes
        let cleaned = decrypted.trim();
        if (cleaned.startsWith('"')) cleaned = cleaned.substring(1);
        if (cleaned.endsWith('"')) cleaned = cleaned.substring(0, cleaned.length - 1);
        
        // Remove backslash escapes (\")
        cleaned = cleaned.replace(/\\"/g, '"');
        
        const parsed = JSON.parse(cleaned);
        
        // Extract the 'active' list
        const incidents = parsed.incidents?.active || parsed.active || [];
        return Array.isArray(incidents) ? incidents : [incidents];
    } catch (e) {
        console.log("Parsing/Decryption Error:", e.message);
        return [];
    }
}

app.get('/incidents', async (req, res) => {
    const id = '00057'; // Clackamas Fire
    try {
        const url = `https://web.pulsepoint.org/data/giba.php?agencyid=${id}`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const incidents = decryptPulsePoint(response.data);
        console.log(`Clackamas Status: Found ${incidents.length} active incidents.`);
        
        res.json(incidents);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/test', (req, res) => {
    res.json({ status: "online", time: new Date().toLocaleTimeString() });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Clean-Room Bridge active on ${PORT}`));