export const TileMotion = /* Shared by the game and the deterministic physics regression checks. */
(function(root){
  function assignLeaners(tiles,rnd){
    const count=Math.min(12,Math.max(4,Math.round(tiles.length*.14)));
    const candidates=tiles.map(t=>({t,rank:rnd()})).sort((a,b)=>a.rank-b.rank);
    const propsUsed=new Set(),chosen=[];
    for(const {t} of candidates){
      if(chosen.length>=count)break;
      if(propsUsed.has(t.id)||t.stand)continue;
      // Spread both angle families across the pile, with an actual neighbour.
      if(chosen.some(o=>Math.abs(o.x-t.x)<.7&&Math.abs(o.y-t.y)<.65))continue;
      const prop=tiles.filter(o=>o!==t&&!o.stand&&o.z>=t.z
        &&Math.abs(o.y-t.y)<.55&&Math.abs(o.x-t.x)>=.3&&Math.abs(o.x-t.x)<=1)
        .sort((a,b)=>Math.abs(a.x-t.x)-Math.abs(b.x-t.x))[0];
      if(!prop)continue;
      t.leanOn=prop.id;
      t.stand=Math.sign(prop.x-t.x)*(chosen.length%2===0?65:35);
      t.leanEver=true;propsUsed.add(prop.id);chosen.push(t);
    }
    return chosen;
  }
  function depth(z,lean,maxLayer){
    // Raised tiles protrude above flat tiles, including during their fall.
    return Math.round(z*100)+10+(Math.abs(lean)>.02?(maxLayer+1)*100:0);
  }
  function targets(tiles){
    const live=tiles.filter(t=>!t.removed&&!t.inTray);
    const result=new Map(live.map(t=>[t.id,{x:t.x,y:t.y,z:t.z,lean:t.stand||0,leanOn:t.leanOn}]));
    // Bottom-up passes propagate a missing support through the entire pile.
    const maxPasses=live.length+Math.max(0,...live.map(t=>t.z));
    for(let pass=0;pass<=maxPasses;pass++){
      let changed=false;
      for(const t of [...live].sort((a,b)=>a.z-b.z)){
        const p=result.get(t.id);
        if(p.z>0&&!live.some(o=>o.id!==t.id&&result.get(o.id).z===p.z-1&&Math.abs(o.x-p.x)<.86&&Math.abs(o.y-p.y)<.86)){
          // Losing its footing, a tile slides off the edge as it drops instead of
          // dropping straight down. It goes the way it was already tilted, which
          // keeps the result deterministic for the regression checks.
          const dir=Math.sign(t.rot||0)||1;
          p.x+=dir*.2;p.y+=.13;
          p.z--;changed=true;
        }
        const prop=result.get(p.leanOn);
        if(p.lean&&(!prop||prop.z<p.z||Math.abs(prop.x-p.x)>1.05||Math.abs(prop.y-p.y)>.6)){
          p.x+=Math.sign(p.lean)*.12;p.lean=0;p.leanOn=null;changed=true;
        }
      }
      if(!changed)break;
    }
    return result;
  }
  function step(m,dt){
    dt=Math.min(.025,Math.max(0,dt));
    const p=m.current,goal=m.target;
    if(m.impactTime!==undefined){
      m.impactTime+=dt;
      const phase=Math.min(1,m.impactTime/.22),bounce=Math.sin(phase*Math.PI)*(1-phase);
      p.lean=goal.lean+Math.sign(m.from.lean-goal.lean)*4*bounce;
      p.z=goal.z+.045*bounce;
      if(phase===1){Object.assign(p,{x:goal.x,y:goal.y,z:goal.z,lean:goal.lean});return true;}
      return false;
    }
    if(Math.abs(p.lean-goal.lean)>.02){
      m.angularVelocity+=-Math.sign(p.lean-goal.lean)*95*Math.max(.25,Math.cos(p.lean*Math.PI/180))*dt;
      const next=p.lean+m.angularVelocity*dt;
      if((p.lean-goal.lean)*(next-goal.lean)<=0){p.lean=goal.lean;m.angularVelocity=0;}else p.lean=next;
    }else p.lean=goal.lean;
    if(p.z>goal.z||m.velocity!==0){
      m.velocity-=9*dt;p.z+=m.velocity*dt;
      if(p.z<=goal.z){p.z=goal.z;m.velocity=0;}
    }
    const angleProgress=m.from.lean===goal.lean?1:1-Math.abs((p.lean-goal.lean)/(m.from.lean-goal.lean));
    const fallProgress=m.from.z===goal.z?1:1-Math.abs((p.z-goal.z)/(m.from.z-goal.z));
    const progress=Math.max(0,Math.min(1,Math.min(angleProgress,fallProgress)));
    // Friction: the slide runs out before the drop finishes, so the tile eases
    // to a stop instead of skating the whole way down.
    const slide=1-(1-progress)*(1-progress);
    p.x=m.from.x+(goal.x-m.from.x)*slide;p.y=m.from.y+(goal.y-m.from.y)*slide;
    if(p.lean===goal.lean&&p.z===goal.z)m.impactTime=0;
    return false;
  }
  return {targets,step,assignLeaners,depth};
})(globalThis);
