const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  console.log('Loading http://localhost/wk-whatsapp/...');
  await page.goto('http://localhost/wk-whatsapp/', { waitUntil: 'networkidle' });
  
  // Dar tempo para o JS carregar
  await page.waitForTimeout(1000);
  
  // Tirar screenshot
  await page.screenshot({ path: 'C:\Users\User\AppData\Local\Temp\claude\c--xampp-htdocs-wk-whatsapp\2981150c-2657-4995-a7db-f58b8c9a7e92\scratchpad\wk-whatsapp-screenshot.png' });
  
  // Verificar que os elementos principais estão presentes
  const headerTitle = await page.textContent('h1');
  const cardTitles = await page.locator('.card-title').allTextContents();
  const cssLink = await page.getAttribute('link[rel="stylesheet"]', 'href');
  
  console.log('✓ Header title:', headerTitle);
  console.log('✓ Card titles found:', cardTitles.length);
  console.log('✓ CSS loaded from:', cssLink);
  console.log('✓ Screenshot saved');
  
  // Verificar console errors
  page.on('console', msg => console.log('Browser console:', msg.type(), msg.text()));
  
  await browser.close();
})();
