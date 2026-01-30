const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

const agencyIds = ['00291','00144','00057','00042','00195','00233','00109','00485','00161','01200','00740','01260','00530','00016','00015','00165','00167','00176','00186','00219'];

app.get('/incidents', async (req, res) => {
    try {
        const promises = agencyIds.map(async (id) => {
            try {
                const url = `https://m.pulsepoint.org/data/giba.php?agencyid=${id}`;
                
                // Mimicking a real Chrome browser request
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json',
                        'Referer': 'https://m.pulsepoint.org/',
                        'Origin': 'https://m.pulsepoint.org'
                    },
                    signal: AbortSignal.timeout(15000) // 15-second timeout
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const data = await response.json();
                return (data.incidents || []).map(inc => ({ ...inc, agency_id: id }));
            } catch (err) {
                console.log(`Agency ${id} failed: ${err.message}`);
                return [];
            }
        });

        const results = await Promise.all(promises);
        const allIncidents = results.flat();

        // Final Filter: Only keep non-medical calls
        const fireOnly = allIncidents.filter(inc => {
            const summary = (inc.CallSummary || "").toUpperCase();
            return !summary.includes("MED") && !summary.includes("EMS");
        });

        res.json(fireOnly);
    } catch (err) {
        res.status(500).json({ error: "Bridge failed", details: err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Human-Mimic Bridge active on port ${PORT}`));