/* 图片只在浏览器内处理；远程请求只用于下载运行库和模型权重。已配置国内可访问的镜像，通常无需翻墙。 */
let classifier;
const LIBS=[
 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2',
 'https://fastly.jsdelivr.net/npm/@xenova/transformers@2.17.2',
 'https://cdn.jsdmirror.com/npm/@xenova/transformers@2.17.2',
 'https://unpkg.com/@xenova/transformers@2.17.2'
];
async function loadLib(){
 for(const url of LIBS){
  try{return await import(url);}catch(e){/* 尝试下一个源 */}
 }
 throw Error('无法加载识别运行库，请检查网络');
}
self.onmessage=async e=>{
 try{
  if(!classifier){
   const {pipeline,env}=await loadLib();
   env.allowLocalModels=false;env.useBrowserCache=true;env.backends.onnx.wasm.numThreads=1;
   env.remoteHost='https://hf-mirror.com';
   classifier=await pipeline('zero-shot-image-classification','Xenova/clip-vit-base-patch32',{quantized:true,progress_callback:p=>{
    if(p.status==='progress')self.postMessage({type:'progress',message:`下载识别模型 ${p.file||''} · ${Math.round(p.progress||0)}%（照片留在本机）`});
    else if(p.status==='ready')self.postMessage({type:'progress',message:'模型已就绪，正在分析照片…'});
   }});
  }
  const {image,foods}=e.data;const extras=['not food, a person or an object','an empty plate','a plate of multiple mixed dishes'];
  const labels=[...foods.map(f=>f.label),...extras];
  self.postMessage({type:'progress',message:'正在本机匹配食物种类…'});
  const results=await classifier(image,labels,{hypothesis_template:'a photo of {}'});
  self.postMessage({type:'result',results:results.map(r=>({id:foods.find(f=>f.label===r.label)?.id||null,label:r.label,score:r.score}))});
 }catch(error){self.postMessage({type:'error',message:'本地模型加载或识别失败：'+String(error.message||error).slice(0,180)});classifier=null;}
};
