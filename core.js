(function(g){
'use strict';
const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&localDate(new Date(d+'T12:00:00'))===d;
const days=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000);
const addDays=(d,n)=>{const v=new Date(d+'T12:00:00');v.setDate(v.getDate()+n);return localDate(v);};
const round=n=>Math.round(n*10)/10;
const finite=(x,min,max)=>Number.isFinite(Number(x))&&Number(x)>=min&&Number(x)<=max;
const phaseInfo={
 '月经期':{hormones:'雌激素与孕激素处于较低水平，子宫内膜脱落。',body:'可能出现腹部不适、乏力或腰酸；也有人没有明显不适。'},
 '卵泡期':{hormones:'卵泡逐渐发育，雌激素通常逐步升高。月经期在生理学上也属于卵泡期。',body:'有些人经后体感更轻松，具体变化因人而异，不据此提高运动强度。'},
 '排卵期':{hormones:'排卵前常出现黄体生成素（LH）峰值，促使卵子释放；日期计算不能确认这一过程。',body:'部分人会发现分泌物变化或短暂下腹不适，也可能没有明显感觉。'},
 '黄体期':{hormones:'排卵后黄体形成，孕激素通常升高；未妊娠时，在下次经期前逐渐下降。',body:'部分人可能出现乳房胀痛、水肿、情绪变化或食欲改变。'},
 '阶段待确认':{hormones:'记录不足或当前周期已超过预计长度，暂不推测激素状态。',body:'请补充实际经期开始日期，或继续记录真实体感。'}
};
function cycleAt(periods,settings,date){
 const starts=periods.filter(p=>validDate(p.start)&&p.start<=date).sort((a,b)=>a.start.localeCompare(b.start));
 if(!starts.length)return {name:'阶段待确认',day:0,phaseDay:0,next:null,length:settings.cycleLength,...phaseInfo['阶段待确认']};
 const intervals=starts.slice(1).map((p,i)=>days(starts[i].start,p.start)).filter(n=>n>=15&&n<=60).slice(-6).sort((a,b)=>a-b);
 const mid=Math.floor(intervals.length/2);const length=intervals.length?Math.round(intervals.length%2?intervals[mid]:(intervals[mid-1]+intervals[mid])/2):settings.cycleLength;
 const latest=starts.at(-1),day=days(latest.start,date)+1;
 const duration=latest.end?days(latest.start,latest.end)+1:settings.periodLength;
 const ovulation=Math.max(duration+2,length-14),ovStart=Math.max(duration+1,ovulation-1),ovEnd=ovulation+1;
 let name='阶段待确认',phaseDay=0;
 if(day<=duration){name='月经期';phaseDay=day;}
 else if(day<ovStart){name='卵泡期';phaseDay=day-duration;}
 else if(day<=ovEnd){name='排卵期';phaseDay=day-ovStart+1;}
 else if(day<=length){name='黄体期';phaseDay=day-ovEnd;}
 return {name,day,phaseDay,length,next:addDays(latest.start,length),...phaseInfo[name]};
}
function nutrition(food,grams){return {kcal:round(food.kcal*grams/100),protein:round(food.protein*grams/100),fiber:round(food.fiber*grams/100)};}
function totals(s,date){const fs=s.foodLogs.filter(x=>x.date===date),es=s.exerciseLogs.filter(x=>x.date===date);const sum=k=>round(fs.reduce((a,x)=>a+Number(x[k]||0),0));const intake=sum('kcal'),burn=round(es.reduce((a,x)=>a+Number(x.kcal||0),0));return {intake,protein:sum('protein'),fiber:sum('fiber'),burn,difference:round(intake-burn)};}
function recommend(s,weather,scene){
 if(!weather)return [];
 const valid=s.clothes.filter(c=>!c.blacklisted),temp=weather.temp;
 const needsCoat=temp<22||['下雨','大风','下雪'].includes(weather.condition);
 const score=c=>{let n=0;const target=temp<13?'厚':temp>25?'薄':'适中';if(c.thickness===target)n+=5;if(c.scenes.includes(scene))n+=3;if(['下雨','大风'].includes(weather.condition)&&c.tags.some(t=>/防水|防风/.test(t)))n+=3;for(const f of s.feedback||[])if(f.ids.includes(c.id))n+=f.accepted?1:-2;return n;};
 const by=t=>valid.filter(c=>c.type===t).sort((a,b)=>score(b)-score(a));
 const tops=by('上衣'),bottoms=by('下装'),dresses=by('连衣裙'),coats=by('外套'),shoes=by('鞋');
 const bases=dresses.map(d=>[d]);for(const t of tops)for(const b of bottoms)bases.push([t,b]);
 const combos=bases.map(base=>{let pieces=[...base];if(needsCoat&&coats.length)pieces.push(coats[0]);if(shoes.length)pieces.push(shoes[0]);return {pieces,score:pieces.reduce((n,c)=>n+score(c),0),missingCoat:needsCoat&&!coats.length};}).sort((a,b)=>b.score-a.score);
 const picks=[];for(const c of combos){if(picks.length===2)break;if(picks.length&&picks[0].pieces[0].id===c.pieces[0].id&&combos.some(x=>x.pieces[0].id!==c.pieces[0].id))continue;picks.push(c);}return picks;
}
function cycleStats(periods){const starts=periods.filter(p=>validDate(p.start)).sort((a,b)=>a.start.localeCompare(b.start));const points=starts.slice(1).map((p,i)=>({date:p.start,gap:days(starts[i].start,p.start)})).filter(x=>x.gap>=15&&x.gap<=60);if(!points.length)return null;const vals=points.map(x=>x.gap),sorted=[...vals].sort((a,b)=>a-b);const mean=round(vals.reduce((a,b)=>a+b,0)/vals.length),mid=Math.floor(sorted.length/2);const median=sorted.length%2?sorted[mid]:round((sorted[mid-1]+sorted[mid])/2);const min=Math.min(...vals),max=Math.max(...vals);const sd=round(Math.sqrt(vals.reduce((a,n)=>a+(n-mean)**2,0)/vals.length));const regularity=sd<=1?'非常规律':sd<=2.5?'较为规律':sd<=4?'略有波动':'波动较大';return {points,mean,median,min,max,sd,regularity};}
const csvCell=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
const csv=(headers,rows)=>'\uFEFF'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');
const C={localDate,validDate,days,addDays,round,finite,cycleAt,nutrition,totals,recommend,cycleStats,csv};g.CycleCore=C;if(typeof module!=='undefined')module.exports=C;
})(globalThis);
