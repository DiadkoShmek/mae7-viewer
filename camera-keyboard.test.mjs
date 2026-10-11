import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {keyboardTranslation} from './camera-keyboard.js';
test('walking respects view heading, level height and normalized diagonals',()=>{
 const c=new THREE.PerspectiveCamera();c.position.set(12,8,0);c.lookAt(0,0,0);c.updateMatrixWorld();
 const d=keyboardTranslation(c,new Set(['KeyW']),2);assert.ok(d.x<-1.99);assert.equal(d.y,0);
 assert.ok(Math.abs(keyboardTranslation(c,new Set(['KeyW','KeyD','KeyE']),2).length()-2)<1e-9);
 assert.ok(keyboardTranslation(c,new Set(['KeyA','KeyD']),2).length()<1e-9);
 assert.equal(keyboardTranslation(c,new Set(['KeyE']),2).y,2);
});
test('orthographic W/S and arrows visibly pan instead of moving along the view ray',()=>{
 const c=new THREE.OrthographicCamera();c.position.set(0,5,20);c.lookAt(0,5,0);c.updateMatrixWorld();
 assert.deepEqual(keyboardTranslation(c,new Set(['KeyW']),1).toArray(),[0,1,0]);
 assert.deepEqual(keyboardTranslation(c,new Set(['ArrowDown']),1).toArray(),[0,-1,0]);
 assert.deepEqual(keyboardTranslation(c,new Set(['KeyD']),1).toArray(),[1,0,0]);
});
