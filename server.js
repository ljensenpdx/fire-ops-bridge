const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dns = require('node:dns');

// This is the "Atomic Fix" for the ENOTFOUND hang
dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(cors());

const agencyIds = ['00291','00144','00057','00042','00195','00233','00109','00485','00161','01200','00740','01260','00530','00016','00015','00165','00167','00176','00186','00219'];

app.get('/incidents', async (req, res) => {
    console.log("--- FETCHING PULSEPOINT DATA ---");
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
                
                const count = (response.data.incidents || []).length;
                console.log(`Agency ${id}: Found ${count} calls`);
                return (response.data.incidents || []).map(inc => ({ ...inc, agency_id: id }));
            } catch (err) {
                // THIS WILL LOG THE EXACT REASON FOR THE FAILURE IN RENDER
                console.log(`Agency ${id} FAILED: ${err.response?.status || err.code}`);
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
app.listen(PORT, () => console.log(`Diagnostic Bridge active on port ${PORT}`));