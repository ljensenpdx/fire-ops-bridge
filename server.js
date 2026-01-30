const express = require('express');
const cors = require('cors');
const { getIncidents } = require('pulsepoint');

const app = express();
app.use(cors());

// Your list of 20 Agency IDs
const agencyIds = ['00291','00144','00057','00042','00195','00233','00109','00485','00161','01200','00740','01260','00530','00016','00015','00165','00167','00176','00186','00219'];

app.get('/incidents', async (req, res) => {
    try {
        // This fetches data for all agencies simultaneously
        const results = await Promise.all(agencyIds.map(id => getIncidents(id)));
        
        // This flattens all incident lists into one big array
        const allActive = results.flatMap(data => data.active || []);
        
        // Filter out medical calls (Medical, EMS, etc.)
        const fireOnly = allActive.filter(inc => 
            !inc.type.toLowerCase().includes('med') && 
            !inc.type.toLowerCase().includes('ems')
        );

        res.json(fireOnly);
    } catch (err) {
        console.error("Fetch Error:", err.message);
        res.status(500).json({ error: "Failed to fetch PulsePoint data" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bridge active on port ${PORT}`));