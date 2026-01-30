const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const dns = require('node:dns');

dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(cors());

/**
 * THE CLACKAMAS-X DECRYPTION ENGINE
 * Specifically tuned for the 2026 'active' folder structure.
 */
function decryptPulsePoint(data) {
    if (!data || !data.ct) return data.incidents || [];
    
    try {
        const passphrase = "nombrady5rings";
        const salt = Buffer.from(data.s, 'hex');
        const iv = Buffer.from(data.iv, 'hex');
        const ct = Buffer.from(data.ct, 'base64');

        // Derive AES-256-CBC Key
        let key = Buffer.alloc(0);
        let block = Buffer.alloc(0);
        while (key.length < 32) {
            block = crypto.createHash('md5').update(block).update(passphrase).update(salt).digest();
            key = Buffer.concat([key, block]);
        }
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', key.slice(0, 32), iv);
        let decrypted = decipher.update(ct, 'binary', 'utf8') + decipher.final('utf8');
        
        // Find the JSON block inside the decrypted string
        const jsonStart = decrypted.indexOf('{');
        const jsonEnd = decrypted.lastIndexOf('}');
        const parsed = JSON.parse(decrypted.substring(jsonStart, jsonEnd + 1));

        // --- THE FIX: NEW 2026 DATA PATH ---
        // Clackamas puts the good stuff in incidents.active
        const activeList = parsed.incidents?.active || parsed.active || parsed.incidents || [];
        
        return Array.isArray(activeList) ? activeList : [activeList];
    } catch (e) {
        console.log("Decryption failed:", e.message);
        return [];
    }
}

app.get('/incidents', async (req, res) => {
    try {
        const id = '00057'; // Clackamas Fire
        const url = `https://web.pulsepoint.org/data/giba.php?agencyid=${id}`;
        
        const response = await axios.get(url, {
            timeout: 10000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const incidents = decryptPulsePoint(response.data);
        
        // This log will tell you if we finally cracked it
        console.log(`Clackamas Final Check: Found ${incidents.length} active calls.`);
        
        res.json(incidents);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/test', (req, res) => {
    res.json({ status: "online", target: "Clackamas (Fixed Path)", time: new Date().toLocaleTimeString() });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Clackamas-X Bridge active on ${PORT}`));