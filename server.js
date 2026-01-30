const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

const agencyIds = ['00291','00144','00057','00042','00195','00233','00109','00485','00161','01200','00740','01260','00530','00016','00015','00165','00167','00176','00186','00219'];

app.get('/incidents', async (req, res) => {
    try {
        const promises = agencyIds.map(async (id) => {
            try {
                const response = await axios.get(`https://m.pulsepoint.org/data/giba.php?agencyid=${id}`, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json'
                    }
                });
                
                return (response.data.incidents || []).map(inc => ({ ...inc, agency_id: id }));
            } catch (err) {
                // This will tell us the SPECIFIC reason for the failure
                console.log(`Agency ${id} Error: ${err.code || err.message}`);
                return [];
            }
        });

        const results = await Promise.all(promises);
        const allIncidents = results.flat();

        // Standard Fire/Non-Medical Filter
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
app.listen(PORT, () => console.log(`Axios Bridge active on port ${PORT}`));