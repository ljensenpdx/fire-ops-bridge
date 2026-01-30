const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// All 20 Agency IDs
const agencyIds = ['00291','00144','00057','00042','00195','00233','00109','00485','00161','01200','00740','01260','00530','00016','00015','00165','00167','00176','00186','00219'];

app.get('/incidents', async (req, res) => {
    try {
        const promises = agencyIds.map(async (id) => {
            try {
                // Fetch directly from PulsePoint's mobile web API
                const response = await fetch(`https://m.pulsepoint.org/data/giba.php?agencyid=${id}`);
                const data = await response.json();
                
                // PulsePoint returns incidents in an 'incidents' array
                // We add the agency ID to each incident so we know where it came from
                return (data.incidents || []).map(inc => ({ ...inc, agency_id: id }));
            } catch (err) {
                console.error(`Agency ${id} fetch failed:`, err.message);
                return [];
            }
        });

        const results = await Promise.all(promises);
        const allIncidents = results.flat();

        // Filter: Direct API uses "PulsePointItemType" or "IncidentType" logic
        // We will pass the raw data and let the dashboard handle specific filtering
        res.json(allIncidents);
    } catch (err) {
        res.status(500).json({ error: "Bridge failed to process data" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Direct-Fetch Bridge active on port ${PORT}`));