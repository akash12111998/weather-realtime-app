const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TEST_URL = 'http://127.0.0.1:5500';
const SCREENSHOTS_DIR = path.join(__dirname, 'test-screenshots');

// Create screenshots directory
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureScreenshot(page, name) {
  const filepath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`Screenshot saved: ${name}.png`);
  return filepath;
}

async function runTests() {
  console.log('Starting browser tests...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const consoleErrors = [];
  const networkErrors = [];
  
  // Capture console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('Console Error:', msg.text());
    }
  });
  
  page.on('pageerror', (error) => {
    consoleErrors.push(error.toString());
    console.log('Page Error:', error.toString());
  });
  
  // Capture network errors
  page.on('requestfailed', (request) => {
    networkErrors.push({
      url: request.url(),
      failure: request.failure().errorText
    });
    console.log('Network Error:', request.url(), '-', request.failure().errorText);
  });
  
  const testResults = {
    step1: {},
    step2: {},
    step3: {},
    step4: {},
    step5: {},
    step6: {},
    consoleErrors: [],
    networkErrors: []
  };
  
  try {
    // Navigate to the page
    console.log('Step 0: Navigating to', TEST_URL);
    await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 10000 });
    await captureScreenshot(page, '00-initial-load');
    console.log('Page loaded successfully\n');
    
    // ===== STEP 1: Search for Tokyo =====
    console.log('Step 1: Searching for Tokyo...');
    testResults.step1.started = true;
    
    // Type in search input
    await page.waitForSelector('#location-input', { timeout: 5000 });
    await page.type('#location-input', 'Tokyo');
    await captureScreenshot(page, '01-tokyo-typed');
    console.log('Typed "Tokyo" in search input');
    
    // Submit form
    await page.click('#search-btn');
    await sleep(2000); // Wait for search results
    await captureScreenshot(page, '02-search-results');
    console.log('Search form submitted');
    
    // Check if results appeared
    const resultsCount = await page.$$eval('#results-list li', items => items.length);
    testResults.step1.resultsCount = resultsCount;
    console.log(`Found ${resultsCount} matching locations`);
    
    // Click first result
    if (resultsCount > 0) {
      await page.click('#results-list li:first-child button');
      await sleep(3000); // Wait for weather data to load
      await captureScreenshot(page, '03-tokyo-weather-loaded');
      console.log('Clicked first result (Tokyo)');
      testResults.step1.firstResultClicked = true;
    } else {
      testResults.step1.error = 'No results found';
      console.log('No results found');
    }
    
    console.log('');
    
    // ===== STEP 2: Verify weather section content =====
    console.log('Step 2: Verifying weather section content...');
    testResults.step2.started = true;
    
    // Check if weather section is visible
    const weatherSectionVisible = await page.$eval('#weather-section', el => !el.classList.contains('hidden'));
    testResults.step2.weatherSectionVisible = weatherSectionVisible;
    console.log(`Weather section visible: ${weatherSectionVisible}`);
    
    // Check weather cards
    const weatherCardsCount = await page.$$eval('#weather-grid .card', cards => cards.length);
    testResults.step2.weatherCardsCount = weatherCardsCount;
    console.log(`Weather cards count: ${weatherCardsCount}`);
    
    // Get card labels
    const cardLabels = await page.$$eval('#weather-grid .card .card-label', labels => labels.map(l => l.textContent));
    testResults.step2.cardLabels = cardLabels;
    console.log(`Card labels: ${cardLabels.join(', ')}`);
    
    // Check 7-day forecast
    const forecastCardsCount = await page.$$eval('#forecast-grid .forecast-card', cards => cards.length);
    testResults.step2.forecastCardsCount = forecastCardsCount;
    console.log(`7-day forecast cards: ${forecastCardsCount}`);
    
    // Check Sun & UV section
    const sunUvCardsCount = await page.$$eval('#sun-uv-grid .card', cards => cards.length);
    testResults.step2.sunUvCardsCount = sunUvCardsCount;
    console.log(`Sun & UV cards: ${sunUvCardsCount}`);
    
    // Check AQI section
    const aqiCardsCount = await page.$$eval('#aqi-grid .card', cards => cards.length);
    testResults.step2.aqiCardsCount = aqiCardsCount;
    console.log(`AQI cards: ${aqiCardsCount}`);
    
    // Check hourly chart SVG
    const hourlyChartContent = await page.$eval('#hourly-chart', svg => svg.innerHTML);
    const hasPolyline = hourlyChartContent.includes('<polyline');
    const hasCircles = hourlyChartContent.includes('<circle');
    testResults.step2.hourlyChartHasPolyline = hasPolyline;
    testResults.step2.hourlyChartHasCircles = hasCircles;
    console.log(`Hourly chart has polyline: ${hasPolyline}`);
    console.log(`Hourly chart has circles: ${hasCircles}`);
    
    await captureScreenshot(page, '04-weather-section-verified');
    console.log('');
    
    // ===== STEP 3: Change unit selectors =====
    console.log('Step 3: Changing unit selectors...');
    testResults.step3.started = true;
    
    // Get initial values
    const initialTemp = await page.$eval('#weather-grid .card:nth-child(2) .card-value', el => el.textContent);
    const initialWind = await page.$eval('#weather-grid .card:nth-child(5) .card-value', el => el.textContent);
    const initialPrecip = await page.$eval('#weather-grid .card:nth-child(7) .card-value', el => el.textContent);
    const initialPressure = await page.$eval('#weather-grid .card:nth-child(6) .card-value', el => el.textContent);
    
    testResults.step3.initialValues = {
      temp: initialTemp,
      wind: initialWind,
      precip: initialPrecip,
      pressure: initialPressure
    };
    console.log(`Initial values:`, testResults.step3.initialValues);
    
    // Change Temperature to Fahrenheit
    await page.select('#temp-unit-select', 'fahrenheit');
    await sleep(2000);
    await captureScreenshot(page, '05-temp-fahrenheit');
    const newTemp = await page.$eval('#weather-grid .card:nth-child(2) .card-value', el => el.textContent);
    testResults.step3.newTemp = newTemp;
    console.log(`Temperature changed to: ${newTemp}`);
    
    // Change Wind to mph
    await page.select('#wind-unit-select', 'mph');
    await sleep(2000);
    await captureScreenshot(page, '06-wind-mph');
    const newWind = await page.$eval('#weather-grid .card:nth-child(5) .card-value', el => el.textContent);
    testResults.step3.newWind = newWind;
    console.log(`Wind changed to: ${newWind}`);
    
    // Change Precip to inch
    await page.select('#precip-unit-select', 'inch');
    await sleep(2000);
    await captureScreenshot(page, '07-precip-inch');
    const newPrecip = await page.$eval('#weather-grid .card:nth-child(7) .card-value', el => el.textContent);
    testResults.step3.newPrecip = newPrecip;
    console.log(`Precipitation changed to: ${newPrecip}`);
    
    // Change Pressure to inhg
    await page.select('#pressure-unit-select', 'inhg');
    await sleep(2000);
    await captureScreenshot(page, '08-pressure-inhg');
    const newPressure = await page.$eval('#weather-grid .card:nth-child(6) .card-value', el => el.textContent);
    testResults.step3.newPressure = newPressure;
    console.log(`Pressure changed to: ${newPressure}`);
    
    testResults.step3.valuesChanged = {
      temp: initialTemp !== newTemp,
      wind: initialWind !== newWind,
      precip: initialPrecip !== newPrecip,
      pressure: initialPressure !== newPressure
    };
    console.log(`Values changed:`, testResults.step3.valuesChanged);
    console.log('');
    
    // ===== STEP 4: Click globe to pin location =====
    console.log('Step 4: Clicking globe to pin location...');
    testResults.step4.started = true;
    
    // Get initial pinned label
    const initialPinnedLabel = await page.$eval('#pinned-coords', el => el.textContent);
    testResults.step4.initialPinnedLabel = initialPinnedLabel;
    console.log(`Initial pinned label: ${initialPinnedLabel}`);
    
    // Wait for globe to be ready
    await sleep(2000);
    
    // Click on globe (center of globe view)
    const globeView = await page.$('#globe-view');
    const globeBox = await globeView.boundingBox();
    
    if (globeBox) {
      const clickX = globeBox.x + globeBox.width / 2;
      const clickY = globeBox.y + globeBox.height / 2;
      
      await page.mouse.click(clickX, clickY);
      await sleep(3000); // Wait for pin and weather refresh
      await captureScreenshot(page, '09-globe-pinned');
      
      const newPinnedLabel = await page.$eval('#pinned-coords', el => el.textContent);
      testResults.step4.newPinnedLabel = newPinnedLabel;
      console.log(`New pinned label: ${newPinnedLabel}`);
      
      testResults.step4.labelChanged = initialPinnedLabel !== newPinnedLabel;
      console.log(`Label changed: ${testResults.step4.labelChanged}`);
      
      // Check if weather refreshed (location name should update)
      const locationName = await page.$eval('#selected-location', el => el.textContent);
      testResults.step4.locationName = locationName;
      console.log(`Location name: ${locationName}`);
    } else {
      testResults.step4.error = 'Globe view not found';
      console.log('Globe view not found');
    }
    
    console.log('');
    
    // ===== STEP 5: Click Reset View =====
    console.log('Step 5: Clicking Reset View...');
    testResults.step5.started = true;
    
    // Get initial status
    const initialStatus = await page.$eval('#status-message', el => el.textContent);
    testResults.step5.initialStatus = initialStatus;
    console.log(`Initial status: ${initialStatus}`);
    
    // Click Reset View button
    await page.click('#reset-globe-view-btn');
    await sleep(2000);
    await captureScreenshot(page, '10-reset-view');
    
    const newStatus = await page.$eval('#status-message', el => el.textContent);
    testResults.step5.newStatus = newStatus;
    console.log(`New status: ${newStatus}`);
    
    testResults.step5.statusChanged = initialStatus !== newStatus;
    console.log(`Status changed: ${testResults.step5.statusChanged}`);
    console.log('');
    
    // ===== STEP 6: Click Use My Location =====
    console.log('Step 6: Clicking Use My Location...');
    testResults.step6.started = true;
    
    // Override geolocation permission (deny)
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(TEST_URL, []);
    
    // Click Use My Location button
    await page.click('#current-location-btn');
    await sleep(2000);
    await captureScreenshot(page, '11-use-my-location');
    
    const statusAfterLocation = await page.$eval('#status-message', el => el.textContent);
    testResults.step6.statusMessage = statusAfterLocation;
    console.log(`Status message: ${statusAfterLocation}`);
    
    // Check if it shows permission/error message
    const hasPermissionError = statusAfterLocation.includes('Unable to access') || 
                               statusAfterLocation.includes('not supported') ||
                               statusAfterLocation.includes('Detecting');
    testResults.step6.hasPermissionError = hasPermissionError;
    console.log(`Has permission/error message: ${hasPermissionError}`);
    console.log('');
    
    // ===== STEP 7: Capture console and network errors =====
    console.log('Step 7: Capturing errors...');
    testResults.consoleErrors = consoleErrors;
    testResults.networkErrors = networkErrors;
    
    console.log(`Console errors: ${consoleErrors.length}`);
    consoleErrors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });
    
    console.log(`Network errors: ${networkErrors.length}`);
    networkErrors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error.url} - ${error.failure}`);
    });
    
    console.log('');
    
    // Save test results to JSON
    const resultsPath = path.join(__dirname, 'test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
    console.log(`Test results saved to: test-results.json\n`);
    
    // ===== SUMMARY =====
    console.log('===========================================================');
    console.log('                      TEST SUMMARY                         ');
    console.log('===========================================================');
    console.log(`Step 1: Search Tokyo - ${testResults.step1.firstResultClicked ? 'PASSED' : 'FAILED'}`);
    console.log(`Step 2: Weather section verification - ${weatherSectionVisible && weatherCardsCount > 0 ? 'PASSED' : 'FAILED'}`);
    console.log(`   - Weather cards: ${weatherCardsCount}`);
    console.log(`   - 7-day forecast: ${forecastCardsCount} cards`);
    console.log(`   - Sun & UV: ${sunUvCardsCount} cards`);
    console.log(`   - AQI: ${aqiCardsCount} cards`);
    console.log(`   - Hourly chart SVG: ${hasPolyline && hasCircles ? 'PASSED' : 'FAILED'}`);
    console.log(`Step 3: Unit conversions - ${Object.values(testResults.step3.valuesChanged).every(v => v) ? 'PASSED' : 'PARTIAL'}`);
    console.log(`   - Temp: ${testResults.step3.valuesChanged.temp ? 'Y' : 'N'}`);
    console.log(`   - Wind: ${testResults.step3.valuesChanged.wind ? 'Y' : 'N'}`);
    console.log(`   - Precip: ${testResults.step3.valuesChanged.precip ? 'Y' : 'N'}`);
    console.log(`   - Pressure: ${testResults.step3.valuesChanged.pressure ? 'Y' : 'N'}`);
    console.log(`Step 4: Globe pin - ${testResults.step4.labelChanged ? 'PASSED' : 'FAILED'}`);
    console.log(`Step 5: Reset view - ${testResults.step5.statusChanged ? 'PASSED' : 'FAILED'}`);
    console.log(`Step 6: Use my location - ${testResults.step6.hasPermissionError ? 'PASSED' : 'FAILED'}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`Network errors: ${networkErrors.length}`);
    console.log('===========================================================\n');
    
  } catch (error) {
    console.error('Test failed with error:', error);
    testResults.fatalError = error.toString();
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

runTests().catch(console.error);
