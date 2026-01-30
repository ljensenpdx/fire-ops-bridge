const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dns = require('node:dns');

// Forces IPv4 to resolve the ENOTFOUND issue on Render
dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(cors());

const agencyIds = ['00291','00144','00057','00042','00195','00233','00109','00485','00161','01200','00740','01260','00530','00016','00015','00165','00167','00176','00186','00219'];

app.get('/incidents', async (req, res) => {
    try {
        const promises = agencyIds.map(async (id) => {
            try {
                // Hitting the Web-App endpoint with full spoofed headers
                const response = await axios.get(`https://web.pulsepoint.org/data/giba.php?agencyid=${id}`, {
                    timeout: 12000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': 'https://web.pulsepoint.org/',
                        'Origin': 'https://web.pulsepoint.org',
                        'Connection': 'keep-alive'
                    }
                });

                const incidents = response.data.incidents || [];
                return incidents.map(inc => ({ ...inc, agency_id: id }));
            } catch (err) {
                return [];
            }
        });

        const results = await Promise.all(promises);
        const allCalls = results.flat();

        // LOGGING: Check your Render logs - it will show how many calls we found
        console.log(`Sync complete. Total calls: ${allCalls.length}`);

        res.json(allCalls);
    } catch (err) {
        res.status(500).json({ error: "Bridge Processing Error", detail: err.message });
    }
});

app.get('/test', (req, res) => {
    res.json({ status: "online", time: new Date().toLocaleTimeString(), tracking: agencyIds.length });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Ultimate Session Bridge active on ${PORT}`));