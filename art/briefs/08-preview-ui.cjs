// Transient art review: changes browser memory only, never game source.
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {chromium} = require('@playwright/test');
const root = path.resolve(__dirname, '../..');
const data = file => 'data:image/png;base64,' + fs.readFileSync(path.join(root,file)).toString('base64');
const server = spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5197','--strictPort'],{cwd:path.join(root,'packages/client'),windowsHide:true,stdio:'ignore'});
(async()=>{
 let browser;
 try {
  for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5197')).ok)break;}catch{} await new Promise(r=>setTimeout(r,250));}
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page=await browser.newPage({viewport:{width:680,height:440},deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:5197');
  await page.waitForFunction(()=>window.__adv?.scene==='TitleScene');
  await page.evaluate(async ({bg,logo})=>{
   const s=window.__adv.game.scene.getScene('TitleScene');
   for(const o of s.children.list)if(o.type==='Image'||o.type==='Rectangle'||(o.type==='BitmapText'&&o.text===window.__adv.bundle.config.title))o.setVisible(false);
   const add = async (k,d)=>{s.textures.addBase64(k,d);while(!s.textures.exists(k))await new Promise(r=>setTimeout(r,20));};
   await add('review-title-bg',bg);await add('review-logo',logo);
   s.add.image(0,0,'review-title-bg').setOrigin(0).setScale(.5).setDepth(-1);
   s.add.rectangle(0,0,320,200,0x000000,.5).setOrigin(0).setDepth(-.5);
   s.add.image(32,4,'review-logo').setOrigin(0).setScale(.5).setDepth(1);
  },{bg:data('games/grelok/assets/backgrounds/title.png'),logo:data('games/grelok/assets/ui/title_logo.png')});
  await page.waitForTimeout(200);
  await page.locator('canvas').screenshot({path:path.join(__dirname,'08-title-preview.png')});
  await page.evaluate(()=>window.__adv.game.scene.getScene('TitleScene').showSlots());
  await page.waitForTimeout(100);
  await page.locator('canvas').screenshot({path:path.join(__dirname,'08-title-load-preview.png')});
  await page.evaluate(()=>window.__adv.game.scene.getScene('TitleScene').showMain());
  const item=await page.evaluate(()=>window.__adv.menu.items.find(i=>i.label==='New game'));
  const canvas=await page.locator('canvas').boundingBox();
  await page.mouse.click(canvas.x+(item.x+item.w/2)*2,canvas.y+(item.y+item.h/2)*2);
  await page.waitForFunction(()=>window.__adv.scene==='RoomScene');
  await page.evaluate(async ({frame,cursor})=>{
   const s=window.__adv.game.scene.getScene('RoomScene');
   s.textures.addBase64('review-frame',frame);while(!s.textures.exists('review-frame'))await new Promise(r=>setTimeout(r,20));
   s.add.image(0,144,'review-frame').setOrigin(0).setScale(.5).setDepth(1);
   document.querySelector('canvas').style.cursor=`url("${cursor}") 5 3, auto`;
  },{frame:data('games/grelok/assets/ui/interface_frame.png'),cursor:data('games/grelok/assets/ui/cursor.png')});
  await page.waitForTimeout(150);
  await page.locator('canvas').screenshot({path:path.join(__dirname,'08-interface-preview.png')});
  console.log(JSON.stringify({scene:await page.evaluate(()=>window.__adv.scene),cursorHotspot:await page.evaluate(()=>getComputedStyle(document.querySelector('canvas')).cursor.endsWith('5 3, auto')),previews:['08-title-preview.png','08-title-load-preview.png','08-interface-preview.png']}));
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});

