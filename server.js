const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const dns = require('node:dns');

dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(cors());

// --- THE CLACKAMAS KEY ENGINE ---
function decryptPulsePoint(data) {
    if (!data || !data.ct) return data.incidents || [];
    
    try {
        const passphrase = "nombrady5rings";
        const salt = Buffer.from(data.s, 'hex');
        const iv = Buffer.from(data.iv, 'hex');
        const ct = Buffer.from(data.ct, 'base64');

        // Derive Key (The 'nombrady5rings' algorithm)
        let key = Buffer.alloc(0);
        let block = Buffer.alloc(0);
        while (key.length < 32) {
            const hash = crypto.createHash('md5').update(block).update(passphrase).update(salt).digest();
            block = hash;
            key = Buffer.concat([key, block]);
        }
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', key.slice(0, 32), iv);
        let decrypted = decipher.update(ct, 'binary', 'utf8') + decipher.final('utf8');
        
        // Clean up and Parse
        const jsonStart = decrypted.indexOf('{');
        const jsonEnd = decrypted.lastIndexOf('}');
        const cleaned = decrypted.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(cleaned);

        // Clackamas puts active calls in incidents.active
        const activeCalls = parsed.incidents?.active || parsed.incidents || [];
        return Array.isArray(activeCalls) ? activeCalls : [activeCalls];
    } catch (e) {
        console.log("Decryption Error:", e.message);
        return [];
    }
}

app.get('/incidents', async (req, res) => {
    const id = '00057'; // Targeted Agency
    try {
        const url = `https://web.pulsepoint.org/data/giba.php?agencyid=${id}`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
        });

        // Log the RAW data size for debugging
        console.log(`Clackamas Sync - Raw Data Received: ${JSON.stringify(response.data).length} bytes`);

        const incidents = decryptPulsePoint(response.data);
        console.log(`Decryption Success - Found ${incidents.length} active calls for Clackamas.`);
        
        res.json(incidents);
    } catch (err) {
        console.log(`Fetch Failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

app.get('/test', (req, res) => {
    res.json({ status: "online", target: "Clackamas Fire (00057)", time: new Date().toLocaleTimeString() });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Clackamas Bridge (V5) active on ${PORT}`));