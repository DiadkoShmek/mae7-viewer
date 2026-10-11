import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTerrainRelief,terrainGeometry} from './terrain-relief.js';
import {sitePlanReference} from './site-plan-reference.js';
import {endWallSpec} from './end-wall-plan.js';
test('lawn relief is bounded, keeps the apron and all traced walking areas flat, and has an exact geometry hole',()=>{
 const halfX=20.8,halfZ=6.22,contours=sitePlanReference.asphalt.map(p=>p.modelFitContourXZMetres);
 const field=createTerrainRelief({halfX,halfZ,flatContours:contours});
 for(const x of [-halfX,0,halfX])for(const z of [-halfZ,0,halfZ])assert.equal(field.height(x,z),0);
 for(const ring of contours)for(let j=0;j<ring.length;j++)for(let i=0;i<=10;i++){
  const a=ring[j],b=ring[(j+1)%ring.length],t=i/10;assert.equal(field.height(a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t),0);
 }
 let min=0,max=0,maxSlope=0;
 for(let z=-245;z<=245;z+=2)for(let x=-245;x<=245;x+=2){const h=field.height(x,z);assert(Number.isFinite(h));min=Math.min(min,h);max=Math.max(max,h);maxSlope=Math.max(maxSlope,Math.abs(field.height(x+.1,z)-h)/.1,Math.abs(field.height(x,z+.1)-h)/.1);}
 assert(min<-.1&&max>.15&&min>-.5&&max<.5);assert(maxSlope<.15);
 const geometry=terrainGeometry(THREE,{halfX,halfZ,height:field.height}),p=geometry.attributes.position,index=geometry.index;
 for(let i=0;i<index.count;i+=3){let x=0,z=0;for(let j=0;j<3;j++){x+=p.getX(index.getX(i+j))/3;z-=p.getY(index.getX(i+j))/3;}assert(!(Math.abs(x)<halfX-1e-5&&Math.abs(z)<halfZ-1e-5),'No terrain triangle enters the real apron hole');}
 for(let i=0;i<p.count;i++)assert(geometry.attributes.normal.getZ(i)>=0,'Terrain faces point upward');
 assert.equal(field.approved,false);assert.equal(field.quantity,0);geometry.dispose();console.log({min,max,maxSlope,triangles:index.count/3});
});
test('the asymmetric full end wall and its 600mm apron remain flat and free of lawn triangles',()=>{
 const halfX=20.230+.6,halfZ=endWallSpec.widthMM/2000+.6,centreZ=(endWallSpec.frontZ+endWallSpec.rearZ)/2;
 const field=createTerrainRelief({halfX,halfZ,centreZ});
 for(const x of [-halfX,0,halfX])for(const z of [centreZ-halfZ,centreZ,centreZ+halfZ])assert.equal(field.height(x,z),0);
 const g=terrainGeometry(THREE,{halfX,halfZ,centreZ,height:field.height}),p=g.attributes.position;
 for(let i=0;i<g.index.count;i+=3){let x=0,z=0;for(let j=0;j<3;j++){x+=p.getX(g.index.getX(i+j))/3;z-=p.getY(g.index.getX(i+j))/3;}assert(!(Math.abs(x)<halfX-1e-5&&Math.abs(z-centreZ)<halfZ-1e-5));}
 assert(g.index.count/3<25000,'Far lawn geometry stays coarse');g.dispose();
});
