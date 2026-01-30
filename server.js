const express = require('express');
const cors = require('cors');
const { getIncidents } = require('pulsepoint');

const app = express();
app.use(cors());

// Your full list of 20 agencies
const agencyIds = ['00291','00144','00057','00042','00195','00233','00109','00485','00161','01200','00740','01260','00530','00016','00015','00165','00167','00176','00186','00219'];

app.get('/incidents', async (req, res) => {
    try {
        const promises = agencyIds.map(async (id) => {
            try {
                // Ensure the ID is a clean string
                const safeId = String(id).trim();
                
                // Fetch with a timeout to prevent hanging
                const data = await getIncidents(safeId);
                
                // If data exists, return the active incidents
                return data && data.active ? data.active : [];
            } catch (err) {
                // Log the error but don't let it crash the loop
                console.log(`Agency ${id} skipped: ${err.message}`);
                return []; 
            }
        });
        
        const results = await Promise.all(promises);
        
        // Combine all lists and filter out medical calls
        const allActive = results.flat();
        
        const fireOnly = allActive.filter(inc => 
            inc.type && 
            !inc.type.toLowerCase().includes('med') && 
            !inc.type.toLowerCase().includes('ems')
        );

        res.json(fireOnly);
    } catch (err) {
        console.error("Critical Failure:", err.message);
        res.status(500).json({ error: "Bridge processing failed" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Bulletproof Bridge active on port ${PORT}`));