import puppeteer from 'puppeteer-core';
const [,, url, out, w='1000', h='700'] = process.argv;
const b = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox'],headless:true});
const p = await b.newPage(); await p.setViewport({width:+w,height:+h});
p.on('pageerror',e=>console.log('PAGEERR',e.message)); p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
await p.goto(url); await new Promise(r=>setTimeout(r,2500)); await p.screenshot({path:out}); await b.close();
