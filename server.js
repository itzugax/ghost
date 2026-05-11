const h=require('http'),f=require('fs'),p=require('path');
const m={'html':'text/html','css':'text/css','js':'text/javascript','png':'image/png','svg':'image/svg+xml','json':'application/json','ico':'image/x-icon'};
h.createServer((r,s)=>{let u=r.url==='/'?'/index.html':r.url,fp=p.join(__dirname,u);
try{f.accessSync(fp);let t=m[p.extname(u).slice(1)]||'text/plain';
s.writeHead(200,{'Content-Type':t});f.createReadStream(fp).pipe(s);}
catch(e){s.writeHead(404);s.end('404');}}).listen(5000,()=>console.log(':5000'));