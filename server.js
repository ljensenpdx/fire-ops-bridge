const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const dns = require('node:dns');

// Fix for Render DNS/IPv6 issues
dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(cors());

const agencyIds = ['00291','00144','00057','00042','00195','00233','00109','00485','00161','01200','00740','01260','00530','00016','00015','00165','00167','00176','00186','00219'];

/**
 * PulsePoint Decryption Logic
 * Decodes the 'ct' (ciphertext) from the API using the 'nombrady5rings' passphrase.
 */
function decryptPulsePoint(data) {
    if (!data.ct) return data.incidents || [];
    
    try {
        const passphrase = "nombrady5rings";
        const salt = Buffer.from(data.s, 'hex');
        const iv = Buffer.from(data.iv, 'hex');
        const ct = Buffer.from(data.ct, 'base64');

        // Derive Key (MD5-based derivation used by PulsePoint)
        let key = Buffer.alloc(0);
        let block = Buffer.alloc(0);
        while (key.length < 32) {
            const hash = crypto.createHash('md5');
            hash.update(block);
            hash.update(passphrase);
            hash.update(salt);
            block = hash.digest();
            key = Buffer.concat([key, block]);
        }
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', key.slice(0, 32), iv);
        let decrypted = decipher.update(ct, 'binary', 'utf8');
        decrypted += decipher.final('utf8');

        // Clean up formatting
        const cleaned = decrypted.substring(decrypted.indexOf('{'), decrypted.lastIndexOf('}') + 1);
        const parsed = JSON.parse(cleaned);
        return parsed.incidents?.active || parsed.incidents || [];
    } catch (e) {
        console.log("Decryption failed:", e.message);
        return [];
    }
}

app.get('/incidents', async (req, res) => {
    try {
        const promises = agencyIds.map(async (id) => {
            try {
                const url = `https://web.pulsepoint.org/data/giba.php?agencyid=${id}`;
                const response = await axios.get(url, {
                    timeout: 8000,
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://web.pulsepoint.org/'
                    }
                });
                
                // Decrypt if necessary
                const incidents = decryptPulsePoint(response.data);
                console.log(`Agency ${id}: Found ${incidents.length} calls`);
                return incidents.map(inc => ({ ...inc, agency_id: id }));
            } catch (err) {
                return [];
            }
        });

        const results = await Promise.all(promises);
        res.json(results.flat());
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

app.get('/test', (req, res) => {
    res.json({ status: "online", time: new Date().toLocaleTimeString() });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Decryption Bridge active on ${PORT}`));