const express = require('express');
const cors = require('cors');
const PulsePoint = require('pulsepoint');

const app = express();
app.use(cors()); // This allows your dashboard to talk to this server

const agencyIds = ['00291','00144','00057','00042','00195','00233','00109','00485','00161','01200','00740','01260','00530','00016','00015','00165','00167','00176','00186','00219'];
const pulse = new PulsePoint(agencyIds);

app.get('/incidents', async (req, res) => {
    try {
        const data = await pulse.getIncidents();
        // Filters out medical calls automatically
        const fireOnly = data.active.filter(inc => !inc.type.toLowerCase().includes('med'));
        res.json(fireOnly);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch PulsePoint data" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bridge active on port ${PORT}`));