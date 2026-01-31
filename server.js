const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

puppeteer.use(StealthPlugin());

// --- ⚙️ CONFIGURATION ---
const GITHUB_TOKEN = 'YOUR_NEW_TOKEN_HERE'; 
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
        console.log(`   -> Step 1: Checking for existing file SHA at ${url}`);
        let sha = "";
        try {
            const res = await axios.get(url, { 
                headers: { 
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'User-Agent': 'FireTracker-Scraper-V5'
                } 
            });
            sha = res.data.sha;
            console.log(`   -> Step 2: Found existing SHA: ${sha}`);
        } catch (e) {
            if (e.response && e.response.status === 404) {
                console.log(`   -> Step 2: No existing file found. Creating new file.`);
            } else {
                throw e; // Rethrow to main catch block
            }
        }

        console.log(`   -> Step 3: Sending PUT request to update file...`);
        const putRes = await axios.put(url, {
            message: "📟 FEED SYNC: " + new Date().toLocaleTimeString(),
            content: base64Content,
            sha: sha || undefined
        }, { 
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'User-Agent': 'FireTracker-Scraper-V5'
            } 
        });

        console.log(`[${new Date().toLocaleTimeString()}] ✅ SUCCESS: File updated on GitHub! (Status: ${putRes.status})`);
    } catch (err) {
        console.error(`[${new Date().toLocaleTimeString()}] ❌ GITHUB SYNC FAILED:`);
        if (err.response) {
            console.error(`   - Status Code: ${err.response.status}`);
            console.error(`   - Status Text: ${err.response.statusText}`);
            console.error(`   - Server Response:`, JSON.stringify(err.response.data));
            if (err.response.status === 401) console.error("   💡 TIP: Your Token is invalid or expired. Check Step 1.");
            if (err.response.status === 404) console.error("   💡 TIP: Repository or Username is incorrect.");
            if (err.response.status === 403) console.error("   💡 TIP: Token lacks 'Write' permissions for Contents.");
        } else {
            console.error(`   - System Message: ${err.message}`);
        }
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
        console.log(`[${new Date().toLocaleTimeString()}] 🌐 NAVIGATING TO PULSEPOINT...`);

        await page.goto("https://web.pulsepoint.org/?agencies=00291,00144,00057,00042,00195,00233,00109,00485,00161,01200,00740,01260,00530,00016,00015,00165,00167,00176,00186,00219", { 
            waitUntil: 'networkidle2', 
            timeout: 60000 
        });

        console.log(`[${new Date().toLocaleTimeString()}] 🎯 PAGE LOADED. COMMENCING SCRAPE LOOP...`);

        setInterval(async () => {
            console.log(`[${new Date().toLocaleTimeString()}] 🔍 SCRAPING MAP DATA...`);
            try {
                const data = await page.evaluate(() => {
                    const results = [];
                    const rows = Array.from(document.querySelectorAll('tr, div[role="row"]'));
                    // ... [Existing scrape logic remains exactly the same] ...
                    return results; 
                });
                lastData = data;
                console.log(`   -> Found ${lastData.length} incidents.`);
            } catch (e) {
                console.error(`   - Scrape Error: ${e.message}`);
            }
        }, 15000);

        setInterval(() => {
            if (lastData.length > 0) pushToGitHub(lastData);
            else console.log(`[${new Date().toLocaleTimeString()}] ⏳ SKIP: No incident data found to push yet.`);
        }, SYNC_INTERVAL);

    } catch (err) {
        console.error(`[${new Date().toLocaleTimeString()}] 💥 CRITICAL RESTART: ${err.message}`);
        setTimeout(startBridge, 10000);
    }
}

startBridge();
