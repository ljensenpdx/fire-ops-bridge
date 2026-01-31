const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

puppeteer.use(StealthPlugin());

// --- ⚙️ CONFIGURATION ---
const GITHUB_TOKEN = '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'; // Replace with your REGENERATED token
const GITHUB_USER = 'ljensenpdx';
const REPO_NAME = 'FireTracker'; 
const FILE_PATH = 'data.json';
const SYNC_INTERVAL = 60000; // Push to GitHub every 60s

let lastData = [];
let browser;

// --- 📤 GITHUB PUSH ENGINE ---
async function pushToGitHub(data) {
    const url = `https://api.github.com/repos/${GITHUB_USER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const base64Content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    
    try {
        let sha = "";
        try {
            const res = await axios.get(url, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}` } });
            sha = res.data.sha;
        } catch (e) { /* File doesn't exist yet, that's okay */ }

        await axios.put(url, {
            message: "📟 SYNC: " + new Date().toLocaleTimeString(),
            content: base64Content,
            sha: sha
        }, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}` } });

        console.log(`\n[${new Date().toLocaleTimeString()}] ✅ GITHUB SYNC SUCCESSFUL`);
    } catch (err) {
        console.error("❌ GITHUB SYNC FAILED:", err.response?.data?.message || err.message);
    }
}

// --- 📡 PULSEPOINT SCRAPER ENGINE ---
async function startBridge() {
    try {
        if (browser) await browser.close();
        console.log(`\n[${new Date().toLocaleTimeString()}] 🚀 LAUNCHING STATUS-AWARE BRIDGE...`);
        
        browser = await puppeteer.launch({ 
            headless: false, 
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            args: [
                '--window-size=500,900', 
                '--no-sandbox', 
                '--disable-dev-shm-usage',
                '--blink-settings=imagesEnabled=false' 
            ] 
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 500, height: 900 });

        // BLOCK UNNECESSARY ASSETS
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        const targetUrl = "https://web.pulsepoint.org/?agencies=00291,00144,00057,00042,00195,00233,00109,00485,00161,01200,00740,01260,00530,00016,00015,00165,00167,00176,00186,00219";
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 0 });

        // DATA EXTRACTION LOOP (Every 10 Seconds)
        setInterval(async () => {
            try {
                const data = await page.evaluate(() => {
                    const results = [];
                    const rows = Array.from(document.querySelectorAll('tr, div[role="row"]'));
                    let reachedRecent = false;

                    for (const row of rows) {
                        const text = row.innerText;
                        if (text.includes('Recent')) { reachedRecent = true; break; }
                        if (reachedRecent) continue;

                        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                        const timeLine = lines.find(l => l.includes('AM') || l.includes('PM'));

                        if (lines.length >= 2 && timeLine) {
                            const address = lines.find(l => l.includes(',') && l.toUpperCase().includes('OR')) || "LOCATION RESTRICTED";
                            const agency = lines.find(l => (l.includes('Fire') || l.includes('F&R') || l.includes('EMS') || l.includes('County')) && l !== address) || lines[0];
                            const type = lines.find(l => l !== agency && l !== address && l !== timeLine && !l.match(/^[A-Z0-9?^*]{2,7}$/)) || "EMERGENCY CALL";

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
                                else if (r < 100 && g < 100 && b < 100) status = "Cleared";

                                unitMap.set(clean, status);
                            });

                            const buckets = {};
                            unitMap.forEach((s, u) => { if(!buckets[s]) buckets[s] = []; buckets[s].push(u); });

                            results.push({
                                agency: agency.toUpperCase(),
                                type: type,
                                time: timeLine,
                                address: address,
                                unitStatuses: Object.entries(buckets).map(([s, u]) => `${s}: ${u.join(', ')}`)
                            });
                        }
                    }
                    return results;
                });
                lastData = data;
                process.stdout.write(`\r📡 [BRIDGE ACTIVE] Tracking ${lastData.length} Incidents...   `);
            } catch (e) {}
        }, 10000);

        // GITHUB SYNC LOOP (Every 60 Seconds)
        setInterval(() => {
            if (lastData.length > 0) pushToGitHub(lastData);
        }, SYNC_INTERVAL);

    } catch (err) {
        console.error("\n⚠️ BRIDGE REBOOTING...", err.message);
        setTimeout(startBridge, 10000);
    }
}

startBridge();