const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dns = require('node:dns');

// This forces Node.js to prefer IPv4, fixing the ENOTFOUND error
dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(cors());

const agencyIds = ['00291','00144','00057','00042','00195','00233','00109','00485','00161','01200','00740','01260','00530','00016','00015','00165','00167','00176','00186','00219'];

app.get('/incidents', async (req, res) => {
    try {
        const promises = agencyIds.map(async (id) => {
            try {
                // Using web.pulsepoint.org which is the primary 2026 endpoint
                const url = `https://web.pulsepoint.org/data/giba.php?agencyid=${id}`;
                
                const response = await axios.get(url, {
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://web.pulsepoint.org/'
                    }
                });
                
                // Extracting incident data
                const incidents = response.data.incidents || [];
                return incidents.map(inc => ({ ...inc, agency_id: id }));
            } catch (err) {
                console.log(`Agency ${id} failed: ${err.code || err.message}`);
                return [];
            }
        });

        const results = await Promise.all(promises);
        const allIncidents = results.flat();

        // Filter: Keep only Fire (Non-Medical) calls
        const fireOnly = allIncidents.filter(inc => {
            const summary = (inc.CallSummary || "").toUpperCase();
            return !summary.includes("MED") && !summary.includes("EMS");
        });

        res.json(fireOnly);
    } catch (err) {
        res.status(500).json({ error: "Bridge processing failed", detail: err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.get('/test', async (req, res) => {
    try {
        const id = '00144'; // TVF&R is always busy
        const url = `https://web.pulsepoint.org/data/giba.php?agencyid=${id}`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        res.json(response.data.incidents || []);
    } catch (err) {
        res.json({ error: err.message });
    }
});
app.listen(PORT, () => console.log(`Master Fix Bridge active on port ${PORT}`));