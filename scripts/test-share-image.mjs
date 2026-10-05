import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext,SourceTextModule,SyntheticModule } from 'node:vm';
import ts from 'typescript';
import jpeg from 'jpeg-js';
import { encode as png } from 'fast-png';
const context=createContext({WebAssembly,Uint8Array,Uint8ClampedArray,Uint16Array,DataView,URL,console});
const cache=new Map();
async function load(specifier,ref={identifier:new URL('../lib/share-image-codec.ts',import.meta.url).href}) {
 const id=specifier.startsWith('.')?new URL(specifier.endsWith('.ts')?specifier:specifier+'.ts',ref.identifier).href:specifier;
 if(cache.has(id))return cache.get(id);
 let namespace;
 if(id.endsWith('.wasm?module'))namespace={default:new WebAssembly.Module(readFileSync('node_modules/@jsquash/webp/codec/dec/webp_dec.wasm'))};
 else if(!id.startsWith('file:'))namespace=await import(id);
 const mod=namespace?new SyntheticModule(Object.keys(namespace),function(){for(const[k,v]of Object.entries(namespace))this.setExport(k,v);},{context})
 :new SourceTextModule(ts.transpileModule(readFileSync(new URL(id),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,{context,identifier:id});
 cache.set(id,mod);return mod;
}
const mod=await load(new URL('../lib/share-image-codec.ts',import.meta.url).href);await mod.link(load);await mod.evaluate();
const create=mod.namespace.createShareJpeg;
const pixels=new Uint8Array(20*40*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=200;pixels[i+1]=40;pixels[i+2]=60;pixels[i+3]=128;}
for(const [bytes,type] of [[readFileSync('scripts/fixtures/upload.webp'),'image/webp'],[png({width:20,height:40,data:pixels,channels:4}),'image/png'],[jpeg.encode({width:20,height:40,data:pixels},80).data,'image/jpeg'],[Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'),'image/gif']]) {
 const result=await create(bytes,type),image=jpeg.decode(result,{useTArray:true});
 assert.equal(image.width,1200);assert.equal(image.height,630);assert.ok(result.length<1024*1024);
 assert.ok(image.data[0]>245&&image.data[1]>245&&image.data[2]>245,'Contain layout preserves the whole image with white letterboxing');
 if(type==='image/png') {const p=(315*1200+600)*4;assert.ok(image.data[p]>210&&image.data[p+1]>130&&image.data[p+2]>140,'Transparent PNGs are composited onto white');}
}
await assert.rejects(()=>create(new Uint8Array([1,2,3]),'image/webp'));
await assert.rejects(()=>create(new Uint8Array([1,2,3]),'image/png'));
await assert.rejects(()=>create(new Uint8Array([1,2,3]),'application/pdf'));
console.log('PASS: real WebP/JPEG/PNG/GIF decode to bounded 1200×630 JPEG; complete photo framing, transparency, corrupt inputs and unsupported types.');
