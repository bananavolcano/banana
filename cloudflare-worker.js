/* Cloudflare Workers AI proxy for Cycle Companion.
 * Deploy this file as a Cloudflare Worker with an AI binding named AI.
 * Never put a provider API key in the public GitHub Pages frontend.
 */
const ALLOWED_ORIGIN = "*"; // Public personal utility; restrict to your Pages origin if desired.
function cors(extra={}) {
  return { "Access-Control-Allow-Origin": ALLOWED_ORIGIN, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin", ...extra };
}
export default {
 async fetch(request, env) {
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers:cors()});
  if (request.method !== "POST") return Response.json({error:"Use POST with JSON."},{status:405,headers:cors({"Content-Type":"application/json"})});
  try {
   const body=await request.json();
   if(typeof body.image!=="string" || !body.image.startsWith("data:image/")) return Response.json({error:"Missing image data URL."},{status:400,headers:cors()});
   const match=body.image.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,([\s\S]+)$/);
   if(!match) return Response.json({error:"Unsupported image encoding."},{status:400,headers:cors()});
   const bytes=Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0));
   if(bytes.byteLength>5*1024*1024) return Response.json({error:"Image too large; please choose a smaller photo."},{status:413,headers:cors()});
   const foods=Array.isArray(body.foods)?body.foods.filter(x=>x&&typeof x.id==="string"&&typeof x.label==="string").slice(0,250):[];
   if(!foods.length) return Response.json({error:"Food list missing."},{status:400,headers:cors()});
   const labels=foods.map(x=>x.label).join("、");
   const result=await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf",{
    image:bytes,
    prompt:"你是食物照片分类助手。请判断照片中最主要、最清楚的一种食物。只能从以下食物名称中选择一个，并且只输出该名称，不要解释。如果没有合适项，输出 UNKNOWN。候选名称："+labels,
    max_tokens:48
   });
   const answer=String(result?.description||result?.response||result?.text||"").trim().replace(/^[\s"'「『]+|[\s"'」』。,.]+$/g,"");
   const exact=foods.find(f=>(f.name||f.label).toLowerCase()===answer.toLowerCase());
   const found=exact||foods.find(f=>answer.includes(f.name||f.label)||(f.name||f.label).includes(answer)&&answer.length>1);
   const results=found?[{id:found.id,label:found.label,score:0.72}]:[];
   return Response.json({results,answer,source:"cloudflare-workers-ai"},{headers:cors({"Cache-Control":"no-store"})});
  } catch(e) {
   return Response.json({error:"Cloud AI request failed: "+String(e?.message||e).slice(0,180)},{status:500,headers:cors({"Cache-Control":"no-store"})});
  }
 }
};
