const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const dns = require('node:dns');

dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(cors());

/**
 * THE MIRROR DECRYPTION ENGINE
 * This perfectly reverses the PulsePoint web encryption.
 */
function decryptPulsePoint(data) {
    if (!data || !data.ct) return data; // Return raw if not encrypted
    
    try {
        const passphrase = "nombrady5rings";
        const salt = Buffer.from(data.s, 'hex');
        const iv = Buffer.from(data.iv, 'hex');
        const ct = Buffer.from(data.ct, 'base64');

        // Derive Key (MD5 Salted)
        let key = Buffer.alloc(0);
        let block = Buffer.alloc(0);
        while (key.length < 32) {
            block = crypto.createHash('md5').update(block).update(passphrase).update(salt).digest();
            key = Buffer.concat([key, block]);
        }
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', key.slice(0, 32), iv);
        let decrypted = decipher.update(ct, 'binary', 'utf8') + decipher.final('utf8');
        
        // --- THE MIRROR STEP ---
        // 1. Remove surrounding quotes if they exist
        let cleaned = decrypted.trim();
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.substring(1, cleaned.length - 1);
        }
        
        // 2. Unescape backslashes (Turning \" back into ")
        cleaned = cleaned.replace(/\\"/g, '"');
        cleaned = cleaned.replace(/\\\\/g, '\\');

        // 3. Parse the now-clean string into a real JSON object
        const parsed = JSON.parse(cleaned);
        
        // 4. Return the 'active' list (the "PulsePoint Output")
        return parsed.incidents?.active || parsed.active || parsed.incidents || [];
    } catch (e) {
        console.log("Mirroring Error:", e.message);
        return { error: "Decryption failed", raw: data };
    }
}

app.get('/incidents', async (req, res) => {
    const id = '00057'; // Clackamas Fire
    try {
        const url = `https://web.pulsepoint.org/data/giba.php?agencyid=${id}`;
        const response = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const output = decryptPulsePoint(response.data);
        
        // Set content type to JSON so the browser formats it nicely
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(output, null, 4)); // Pretty-print with 4 spaces
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Mirror Bridge active on port ${PORT}`));