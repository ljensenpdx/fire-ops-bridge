const express = require('express');
const cors = require('axios'); // Note: ensure you have 'cors' and 'axios' installed
const axios = require('axios');
const dns = require('node:dns');

dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(require('cors')());

const agencyIds = ['00291','00144','00057','00042','00195','00233','00109','00485','00161','01200','00740','01260','00530','00016','00015','00165','00167','00176','00186','00219'];

app.get('/incidents', async (req, res) => {
    console.log("--- New Sync Request ---");
    try {
        const promises = agencyIds.map(async (id) => {
            try {
                const url = `https://web.pulsepoint.org/data/giba.php?agencyid=${id}`;
                const response = await axios.get(url, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                        'Referer': 'https://web.pulsepoint.org/',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                return (response.data.incidents || []).map(inc => ({ ...inc, agency_id: id }));
            } catch (err) {
                // This logs the SPECIFIC error for each agency to your Render dashboard
                console.log(`Agency ${id} ERROR: ${err.response?.status || err.code} - ${err.message}`);
                return [];
            }
        });

        const results = await Promise.all(promises);
        const all = results.flat();
        console.log(`Successfully fetched ${all.length} total calls.`);
        res.json(all);
    } catch (err) {
        res.status(500).json({ error: "Master Failure", detail: err.message });
    }
});

app.get('/test', (req, res) => {
    res.json({ status: "online", time: new Date().toLocaleTimeString() });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Diagnostic Bridge active on ${PORT}`));