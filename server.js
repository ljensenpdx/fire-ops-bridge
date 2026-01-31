const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

puppeteer.use(StealthPlugin());

// --- ⚙️ CONFIGURATION ---
// BE CAREFUL: Ensure no extra spaces are inside the quotes below
const GITHUB_TOKEN = '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'; 
const GITHUB_USER = 'ljensenpdx';
const REPO_NAME = 'FireTracker'; 
const FILE_PATH = 'data.json';
const SYNC_INTERVAL = 60000; 

let lastData = [];
let browser;

// --- 📤 VERBOSE GITHUB PUSH ENGINE ---
async function pushToGitHub(data) {
    console.log(`[${new Date().toLocaleTimeString()}] 📤 ATTEMPTING GITHUB SYNC...`);
    const url = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const base64Content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    
    try {
        let sha = "";
        try {
            const res = await axios.get(url, { 
                headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'FireTracker-V5' } 
            });
            sha = res.data.sha;
        } catch (e) {
            if (e.response && e.response.status !== 404) throw e;
        }

        await axios.put(url, {
            message: "📟 FEED SYNC: " + new Date().toLocaleTimeString(),
            content: base64Content,
            sha: sha || undefined
        }, { headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'FireTracker-V5' } });

        console.log(`[${new Date().toLocaleTimeString()}] ✅ GITHUB SYNC SUCCESSFUL`);
    } catch (err) {
        console.error(`[${new Date().toLocaleTimeString()}] ❌ GITHUB SYNC FAILED: ${err.response?.data?.message || err.message}`);
    }
}

// --- 📡 VERBOSE SCRAPER ENGINE ---
async function startBridge() {
    try {
        console.log(`[${new Date().toLocaleTimeString()}] 🛠️ INITIALIZING PUPPETEER...`);
        browser = await puppeteer.launch({ 
            headless: false, 
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            args: ['--window-size=600,1000', '--no-sandbox'] 
        });

        const page = await browser.newPage();
        await page.goto("https://web.pulsepoint.org/?agencies=00291,00144,00057,00042,00195,00233,00109,00485,00161,01200,00740,01260,00530,00016,00015,00165,00167,00176,00186,00219", { waitUntil: 'networkidle2' });

        setInterval(async () => {
            try {
                const data = await page.evaluate(() => {
                    const results = [];
                    const rows = Array.from(document.querySelectorAll('div[role="row"], tr, .pp-incident-row'));
                    for (const row of rows) {
                        const text = row.innerText;
                        if (text.includes('Recent')) break; 
                        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                        const timeLine = lines.find(l => l.match(/\d{1,2}:\d{2}\s[AP]M/));

                        if (timeLine && lines.length >= 2) {
                            const address = lines.find(l => l.includes(',') || l.match(/[A-Z]{2}\s\d{5}/)) || "Location Restricted";
                            const agency = lines[0]; 
                            const type = lines.find(l => l !== agency && l !== address && l !== timeLine) || "Emergency Call";
                            const unitMap = new Map();
                            const units = Array.from(row.querySelectorAll('div, span, td'))
                                .filter(el => /^[?^]*[A-Z0-9]{1,7}[?^*]*$/.test(el.innerText.trim()));

                            units.forEach(el => {
                                const raw = el.innerText.trim();
                                const clean = raw.replace(/[?^*]/g, '');
                                const color = window.getComputedStyle(el).color;
                                const [r, g, b] = color.match(/\d+/g).map(Number);
                                let status = "Dispatched";
                                if (raw.includes('?')) status = "Dispatched";
                                else if (r > 160 && g < 80) status = "On Scene";
                                else if (r > 200 && g > 180) status = "To Hospital";
                                else if (g > 160 && r < 120) status = "En Route";
                                else if (raw.includes('^')) status = "Avail Scene";
                                unitMap.set(clean, status);
                            });
                            const buckets = {};
                            unitMap.forEach((s, u) => { if(!buckets[s]) buckets[s] = []; buckets[s].push(u); });
                            results.push({ agency: agency.toUpperCase(), type: type, time: timeLine, address: address, unitStatuses: Object.entries(buckets).map(([s, u]) => `${s}: ${u.join(', ')}`) });
                        }
                    }
                    return results;
                });
                lastData = data;
                process.stdout.write(`\r📡 [BRIDGE ACTIVE] Tracking ${lastData.length} Incidents...   `);
            } catch (e) { console.error("\nScrape Error:", e.message); }
        }, 15000);

        setInterval(() => {
            if (lastData.length > 0) pushToGitHub(lastData);
        }, SYNC_INTERVAL);

    } catch (err) {
        console.error("Critical Restart:", err.message);
        setTimeout(startBridge, 10000);
    }
}

startBridge();

