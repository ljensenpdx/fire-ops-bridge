const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dns = require('node:dns');

// This fixes the 'blank page' hang on Render/Node v22
dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use(cors());

const agencyIds = ['00291','00144','00057','00042','00195','00233','00109','00485','00161','01200','00740','01260','00530','00016','00015','00165','00167','00176','00186','00219'];

app.get('/incidents', async (req, res) => {
    try {
        const promises = agencyIds.map(async (id) => {
            try {
                // We use the most stable 2026 endpoint
                const url = `https://web.pulsepoint.org/data/giba.php?agencyid=${id}`;
                const response = await axios.get(url, {
                    timeout: 8000, // Quick timeout so it doesn't hang
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                
                return (response.data.incidents || []).map(inc => ({ ...inc, agency_id: id }));
            } catch (err) {
                return []; 
            }
        });

        const results = await Promise.all(promises);
        const all = results.flat();
        
        // Filter out Medicals/EMS
        const fireOnly = all.filter(inc => {
            const summary = (inc.CallSummary || "").toUpperCase();
            return !summary.includes("MED") && !summary.includes("EMS");
        });

        res.json(fireOnly);
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

// TEST ROUTE: This will ALWAYS show something if the server is alive
app.get('/test', (req, res) => {
    res.json({ status: "online", time: new Date().toLocaleTimeString(), agencies_tracked: agencyIds.length });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Atomic Bridge active on port ${PORT}`));