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
                // We are switching to the 'Incidents' endpoint used by the Respond App
                // This endpoint rarely encrypts data and is much more stable.
                const url = `https://m.pulsepoint.org/data/incidents.php?agencyid=${id}`;
                
                const response = await axios.get(url, {
                    timeout: 8000,
                    headers: {
                        'User-Agent': 'PulsePoint/4.0 (iPhone; iOS 17.0; Scale/3.00)',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                // The mobile API structure: data -> active_incidents
                const incidents = response.data.active_incidents || response.data.incidents || [];
                return incidents.map(inc => ({ ...inc, agency_id: id }));
            } catch (err) {
                return [];
            }
        });

        const results = await Promise.all(promises);
        res.json(results.flat());
    } catch (err) {
        res.status(500).json({ error: "Bridge Error", detail: err.message });
    }
});

app.get('/test', (req, res) => {
    res.json({ status: "online", time: new Date().toLocaleTimeString() });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Mobile Bypass Bridge active on ${PORT}`));