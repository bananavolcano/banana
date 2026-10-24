/* 图片只在浏览器内处理；远程请求仅下载运行库和模型权重。 */
let classifier;
const LIBS=[
 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2',
 'https://fastly.jsdelivr.net/npm/@xenova/transformers@2.17.2',
 'https://cdn.jsdmirror.com/npm/@xenova/transformers@2.17.2',
 'https://unpkg.com/@xenova/transformers@2.17.2',
 'https://esm.sh/@xenova/transformers@2.17.2'
];
async function loadLib(){
 const errors=[];
 for(const url of LIBS){
  try{return await import(url);}
  catch(e){errors.push(url.split('/')[2]+': '+String(e.message||e).slice(0,90));}
 }
 throw Error('识别运行库下载失败。请切换稳定网络后重试。详情：'+errors.slice(0,2).join('；'));
}
async function loadClassifier(pipeline,env){
 env.allowLocalModels=false;
 env.allowRemoteModels=true;
 env.useBrowserCache=true;
 env.backends.onnx.wasm.numThreads=1;
 /* Transformers.js v2 model URL: host/model/resolve/revision/file */
 env.remotePathTemplate='{model}/resolve/{revision}/{file}';
 const hosts=['https://huggingface.co','https://hf-mirror.com'];
 const errors=[];
 for(const host of hosts){
  try{
   env.remoteHost=host;
   self.postMessage({type:'progress',message:'正在连接模型源 '+new URL(host).hostname+'，首次下载模型可能需要几分钟…'});
   return await pipeline('zero-shot-image-classification','Xenova/clip-vit-base-patch32',{
    quantized:true,
    progress_callback:p=>{
     if(p.status==='progress')self.postMessage({type:'progress',message:'下载识别模型 '+(p.file||'')+' · '+Math.round(p.progress||0)+'%（照片留在本机）'});
     else if(p.status==='ready')self.postMessage({type:'progress',message:'模型已就绪，正在分析照片…'});
    }
   });
  }catch(e){errors.push(host+': '+String(e.message||e).slice(0,120));}
 }
 throw Error('模型文件下载失败。该 CLIP 模型的量化主权重约 154 MB，手机首次下载需要稳定网络和足够存储空间。请查看各源错误详情；若是 Failed to fetch/Load failed，通常是网络或跨域连接被拦截。详情：'+errors.map(x=>x.replace('https://','')).join('；').slice(0,360));
}
async function recognizeCloud(endpoint,image,foods){
 self.postMessage({type:'progress',message:'正在通过云端 AI 分析照片…照片将发送到你配置的服务。'});
 let url;
 try{url=new URL(endpoint);if(url.protocol!=='https:')throw Error('云端识别地址必须使用 HTTPS');}
 catch(e){throw Error('云端识别地址无效：'+String(e.message||e));}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
 let res;
 try{
  res=await fetch(url.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,foods}),signal:controller.signal,cache:'no-store'});
 }catch(e){
  if(e.name==='AbortError')throw Error('云端 AI 请求超时（60 秒）。请检查 Worker 日志、网络或 VPN。');
  throw Error('无法连接 Cloudflare Worker（'+url.hostname+'）。浏览器未收到 HTTP 响应，常见原因是 CORS/OPTIONS 预检失败、网络/VPN 拦截或 Worker 连接中断。原始错误：'+String(e.message||e).slice(0,100));
 }finally{clearTimeout(timer);}
 const body=await res.json().catch(()=>null);
 if(!res.ok)throw Error(body?.error||('云端 AI 请求失败（HTTP '+res.status+'）'));
 if(!body||!Array.isArray(body.results))throw Error(body?.error||'云端服务返回格式不正确，请检查 Worker 返回的 JSON。');
 self.postMessage({type:'result',results:body.results});
}
self.onmessage=async e=>{
 const cloudEndpoint=e.data?.cloudEndpoint;
 try{
  const {image,foods}=e.data;
  if(cloudEndpoint){
   await recognizeCloud(cloudEndpoint,image,foods);
   return;
  }
  if(!classifier){
   self.postMessage({type:'progress',message:'正在加载识别运行库…'});
   const {pipeline,env}=await loadLib();
   classifier=await loadClassifier(pipeline,env);
  }
  const extras=['not food, a person or an object','an empty plate','a plate of multiple mixed dishes'];
  const labels=[...foods.map(f=>f.label),...extras];
  self.postMessage({type:'progress',message:'模型已加载，正在本机分析照片…'});
  const results=await classifier(image,labels,{hypothesis_template:'a photo of {}'});
  self.postMessage({type:'result',results:results.map(r=>({id:foods.find(f=>f.label===r.label)?.id||null,label:r.label,score:r.score}))});
 }catch(error){
  classifier=null;
  self.postMessage({type:'error',message:(cloudEndpoint?'云端 AI 识别失败：':'本地 AI 识别失败：')+String(error.message||error).slice(0,420)});
 }
};
