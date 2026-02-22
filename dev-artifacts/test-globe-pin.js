const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testGlobePin() {
  console.log('🧪 Testing Globe Pin Functionality...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Capture console logs
  page.on('console', (msg) => {
    console.log(`[Browser Console ${msg.type()}]:`, msg.text());
  });
  
  try {
    await page.goto('http://127.0.0.1:5500', { waitUntil: 'networkidle2' });
    console.log('✅ Page loaded\n');
    
    // First load Tokyo weather
    await page.type('#location-input', 'Tokyo');
    await page.click('#search-btn');
    await sleep(2000);
    await page.click('#results-list li:first-child button');
    await sleep(3000);
    console.log('✅ Tokyo weather loaded\n');
    
    // Get initial state
    const initialPinned = await page.$eval('#pinned-coords', el => el.textContent);
    console.log('Initial pinned label:', initialPinned);
    
    // Wait for globe to be fully initialized
    await sleep(3000);
    
    // Try to click on the globe
    console.log('\n🎯 Attempting to click globe...');
    
    // Method 1: Click center of globe view
    const globeView = await page.$('#globe-view');
    const globeBox = await globeView.boundingBox();
    
    if (globeBox) {
      console.log('Globe box:', globeBox);
      
      // Click slightly off-center to hit a location
      const clickX = globeBox.x + globeBox.width * 0.6;
      const clickY = globeBox.y + globeBox.height * 0.4;
      
      console.log(`Clicking at (${clickX}, ${clickY})`);
      await page.mouse.click(clickX, clickY);
      
      // Wait for pin animation and reverse geocoding
      console.log('Waiting for pin and reverse geocoding...');
      await sleep(1000);
      
      let pinnedLabel = await page.$eval('#pinned-coords', el => el.textContent);
      console.log('After 1s:', pinnedLabel);
      
      await sleep(2000);
      pinnedLabel = await page.$eval('#pinned-coords', el => el.textContent);
      console.log('After 3s:', pinnedLabel);
      
      await sleep(3000);
      pinnedLabel = await page.$eval('#pinned-coords', el => el.textContent);
      console.log('After 6s:', pinnedLabel);
      
      // Check if weather section updated
      const locationName = await page.$eval('#selected-location', el => el.textContent);
      console.log('Location name:', locationName);
      
      // Check if pin is visible on globe
      const hasPin = await page.evaluate(() => {
        return window.globe && window.globe.pointsData && window.globe.pointsData().length > 0;
      });
      console.log('Has pin on globe:', hasPin);
      
      // Try clicking in a different location
      console.log('\n🎯 Trying another click...');
      const clickX2 = globeBox.x + globeBox.width * 0.3;
      const clickY2 = globeBox.y + globeBox.height * 0.6;
      console.log(`Clicking at (${clickX2}, ${clickY2})`);
      await page.mouse.click(clickX2, clickY2);
      await sleep(5000);
      
      pinnedLabel = await page.$eval('#pinned-coords', el => el.textContent);
      console.log('After second click:', pinnedLabel);
      
      const locationName2 = await page.$eval('#selected-location', el => el.textContent);
      console.log('Location name after second click:', locationName2);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testGlobePin().catch(console.error);
