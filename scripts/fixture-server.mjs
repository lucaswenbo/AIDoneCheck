import http from 'node:http';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
export async function startFixtures(port=0){
  let peerURL='';
  const handler=(req,res)=>{
    const route=new URL(req.url,'http://fixture').pathname;
    const html=body=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><title>AIDoneCheck fixture</title><link rel="icon" href="data:,"></head><body>${body}</body></html>`);};
    if(route==='/abort.js'){req.socket.destroy();return;}
    if(route==='/missing.js'||route==='/missing.css'||route==='/missing.png'){res.writeHead(404);res.end('missing fixture');return;}
    if(route==='/pageerror'){html('<h1>Ready</h1><script>throw new Error("fixture pageerror")</script>');return;}
    if(route==='/script-fail'){html('<h1>Ready</h1><script src="/abort.js"></script>');return;}
    if(route==='/style-fail'){html('<link rel="stylesheet" href="/missing.css"><h1>Ready</h1>');return;}
    if(route==='/http-error'){res.statusCode=503;html('<h1>Service unavailable fixture</h1>');return;}
    if(route==='/cross-fail'){html(`<h1>Ready</h1><script src="${peerURL}/missing.js"></script>`);return;}
    if(route==='/resource-overflow'){html('<h1>Ready</h1>'+Array.from({length:205},(_,i)=>`<script src="${peerURL}/missing.js?n=${i}"></script>`).join('')+'<script>const last=document.createElement("script");last.src="/missing.js?critical=last";document.body.append(last);</script>');return;}
    if(route==='/console'){html('<h1>Ready</h1><script>console.error("fixture console error")</script>');return;}
    if(route==='/empty'){html('');return;}
    if(route==='/hidden'){html('<p hidden>SECRET_EXPECT</p><p>Ready</p>');return;}
    if(route==='/hidden-body'){res.setHeader('Content-Type','text/html');res.end('<body style="display:none">SECRET_EXPECT</body>');return;}
    if(route==='/image-fail'){html('<h1>Ready</h1><img src="/missing.png" alt="">');return;}
    if(route==='/redirect'){res.writeHead(302,{Location:`${peerURL}/style-fail`});res.end();return;}
    if(route==='/pass-redirect'){res.writeHead(302,{Location:`${peerURL}/pass`});res.end();return;}
    html('<h1>Ready</h1><div id="rendered"></div><script>document.querySelector("#rendered").textContent="Rendered evidence"</script>');
  };
  const server=http.createServer(handler),peer=http.createServer(handler);
  const listen=(s,p)=>new Promise(resolve=>s.listen(p,'127.0.0.1',resolve));
  await listen(peer,0);peerURL=`http://127.0.0.1:${peer.address().port}`;await listen(server,port);
  return {url:`http://127.0.0.1:${server.address().port}`,peerURL,close:async()=>{server.closeAllConnections();peer.closeAllConnections();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>peer.close(r))]);}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const fixture=await startFixtures(Number(process.argv[2]??0));
  if(process.argv[3])await fs.writeFile(process.argv[3],fixture.url);
  console.log(fixture.url);
  process.on('SIGTERM',()=>fixture.close().then(()=>process.exit(0)));
}
