const express = require('express');
const cors = require('cors');
const { getIncidents } = require('pulsepoint');

const app = express();
app.use(cors());

const agencyIds = ['00291','00144','00057','00042','00195','00233','00109','00485','00161','01200','00740','01260','00530','00016','00015','00165','00167','00176','00186','00219'];

app.get('/incidents', async (req, res) => {
    try {
        // We use .reflect() style logic to prevent one failure from killing the whole request
        const promises = agencyIds.map(id => 
            getIncidents(id).catch(err => {
                console.error(`Error fetching agency ${id}:`, err.message);
                return { active: [] }; // Return empty list if one agency fails
            })
        );
        
        const results = await Promise.all(promises);
        const allActive = results.flatMap(data => data.active || []);
        
        const fireOnly = allActive.filter(inc => 
            !inc.type.toLowerCase().includes('med') && 
            !inc.type.toLowerCase().includes('ems')
        );

        res.json(fireOnly);
    } catch (err) {
        res.status(500).json({ error: "Major Bridge Failure", details: err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Resilient Bridge active on port ${PORT}`));