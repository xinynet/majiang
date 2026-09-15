const assert=require('node:assert/strict');
const {targets,step,assignLeaners,depth}=require('../tile-motion.js');
const tile=(id,x,y,z,extra={})=>({id,x,y,z,stand:0,leanOn:null,...extra});
// Removing a prop flattens the leaning tile; a present prop preserves it.
const prop=tile(0,.6,0,0),lean=tile(1,0,0,0,{stand:55,leanOn:0});
assert.equal(targets([prop,lean]).get(1).lean,55);
assert.equal(targets([{...prop,inTray:true},lean]).get(1).lean,0);
// No four-layer cap; all unsupported levels settle, without negative heights.
const stack=Array.from({length:8},(_,i)=>tile(i,0,0,i,{removed:i===0}));
assert.deepEqual([...targets(stack).values()].map(p=>p.z),[0,1,2,3,4,5,6]);
const floating=[tile(0,0,0,4),tile(1,0,0,5)];
assert.deepEqual([...targets(floating).values()].map(p=>p.z),[0,1]);
// An upper layer stays supported while one of two lower supports remains.
assert.equal(targets([tile(0,-.4,0,0,{inTray:true}),tile(1,.4,0,0),tile(2,0,0,1)]).get(2).z,1);
for(const sign of [-1,1])for(const hz of [30,60,120]){
  const from={x:0,y:0,z:3,lean:sign*60},goal={x:sign*.12,y:0,z:0,lean:0};
  const m={from,current:{...from},target:goal,velocity:0,angularVelocity:0};
  let done=false;
  for(let n=0;n<hz*3&&!done;n++){
    done=step(m,1/hz);
    assert.ok(m.current.z>=0);assert.ok(sign*m.current.lean>=0);
    assert.ok(Object.values(m.current).every(Number.isFinite));
  }
  assert.ok(done);assert.deepEqual(m.current,goal);
}
// Retargeting a fall continues from its rendered position and velocity.
const from={x:0,y:0,z:2,lean:45},m={from,current:{...from},target:{...from,z:1,lean:0},velocity:0,angularVelocity:0};
step(m,.02);const height=m.current.z;
m.from={...m.current};m.target.z=0;
step(m,.02);assert.ok(m.current.z<height&&m.current.z>0);
console.log('PASS: prop removal, retained support, cascading stacks, both lean directions, 30/60/120 Hz and retargeting');
// Exercise the real level layouts, not an idealized grid.
const fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const context={};vm.createContext(context);
vm.runInContext(app.slice(app.indexOf('function seeded('),app.indexOf('function starLabel(')),context);
for(const aspect of [.55,.76,1])for(let level=1;level<=20;level++){
  context.aspect=aspect;vm.runInContext('boardAspect=()=>aspect',context);
  const tiles=context.makeLayout(level,context.seeded(level)).map((p,id)=>tile(id,p.x,p.y,p.z));
  const raised=assignLeaners(tiles,context.seeded(level*13+5));
  assert.ok(raised.some(t=>Math.abs(t.stand)===35),`Missing half-standing at ${level}/${aspect}`);
  assert.ok(raised.some(t=>Math.abs(t.stand)===65),`Missing standing at ${level}/${aspect}`);
  for(const t of raised){
    assert.ok(tiles.some(p=>p.id===t.leanOn&&!p.stand&&p.z>=t.z));
    assert.ok(depth(t.z,t.stand,2)>depth(2,0,2));
    const goal=targets(tiles.map(p=>p.id===t.leanOn?{...p,inTray:true}:p)).get(t.id);
    assert.equal(goal.lean,0);
  }
}
assert.equal(depth(0,0,2),10);
console.log('PASS: both visible pose families, valid supports and removal across 60 level/aspect layouts');
// Falling must show intermediate angles and a brief contact rebound, not snap.
const start={x:0,y:0,z:1,lean:65};
const fall={from:start,current:{...start},target:{x:.12,y:0,z:0,lean:0},velocity:0,angularVelocity:0};
const samples=[];let finished=false;
for(let frame=0;frame<180&&!finished;frame++){
  finished=step(fall,1/60);samples.push({...fall.current,impact:fall.impactTime});
}
assert.ok(finished&&samples.length>=40&&samples.length<=120);
assert.ok(samples.filter(p=>p.lean>5&&p.lean<60).length>20);
assert.ok(samples.some(p=>p.impact>0&&p.z>0&&p.lean>0));
assert.equal(fall.current.lean,0);assert.equal(fall.current.z,0);
console.log(`PASS: ${samples.length} animation frames including intermediate poses and contact rebound`);
