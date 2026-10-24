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
 env.useBrowserCache=true;
 env.backends.onnx.wasm.numThreads=1;
 const hosts=['https://hf-mirror.com','https://huggingface.co'];
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
 throw Error('模型权重下载失败，已尝试镜像和官方源。请检查网络/浏览器内存后重试。详情：'+errors.map(x=>x.replace('https://','')).join('；').slice(0,220));
}
self.onmessage=async e=>{
 try{
  if(!classifier){
   self.postMessage({type:'progress',message:'正在加载识别运行库…'});
   const {pipeline,env}=await loadLib();
   classifier=await loadClassifier(pipeline,env);
  }
  const {image,foods}=e.data;
  const extras=['not food, a person or an object','an empty plate','a plate of multiple mixed dishes'];
  const labels=[...foods.map(f=>f.label),...extras];
  self.postMessage({type:'progress',message:'模型已加载，正在本机分析照片…'});
  const results=await classifier(image,labels,{hypothesis_template:'a photo of {}'});
  self.postMessage({type:'result',results:results.map(r=>({id:foods.find(f=>f.label===r.label)?.id||null,label:r.label,score:r.score}))});
 }catch(error){
  classifier=null;
  self.postMessage({type:'error',message:'本地 AI 识别失败：'+String(error.message||error).slice(0,300)});
 }
};
