(function(){'use strict';
// Garde-fou d'interface uniquement. AUCUNE écriture IndexedDB/localStorage.
// Les sauvegardes existantes restent intactes; ce script empêche les inputs photo de se contaminer entre eux.
const DB='embk-safe-backup-v2',STORE='backups',KEY='current-complete',LEGACY='legacy-before-photo-fix';
function open(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function get(k){try{const db=await open();if(!db.objectStoreNames.contains(STORE))return null;return await new Promise((ok,no)=>{const r=db.transaction(STORE).objectStore(STORE).get(k);r.onsuccess=()=>ok(r.result||null);r.onerror=()=>no(r.error)})}catch(e){return null}}
function file(inp){return inp?((inp.files&&inp.files[0])||inp._savedBlob||null):null}
function fp(f){return f?[f.size||0,f.type||'',f.name||'',f.lastModified||0].join('|'):''}
function set(inp,p){if(!inp||!p||!p.blob)return;const f=p.blob instanceof File?p.blob:new File([p.blob],p.name||'photo.jpg',{type:p.type||'image/jpeg',lastModified:p.lastModified||Date.now()});inp._savedBlob=f;try{const d=new DataTransfer();d.items.add(f);inp.files=d.files}catch(e){}}
function clearVisible(inp){if(!inp)return;try{inp.value=''}catch(e){}inp._savedBlob=null}
function byLabel(side,label){return Array.from(side.querySelectorAll('input[type=file]')).find(x=>(x.dataset.label||'')===label)||null}
function savedByLabel(so,label){return (so&&so.photos||[]).find(p=>p&&p.label===label)||null}
function inputs(side){return Array.from(side.querySelectorAll('input[type=file]'))}
function markCleanVehicle(v){if(!v)return;v.dataset.photoSlotNew='1';v.querySelectorAll('input[type=file]').forEach(inp=>{inp._savedBlob=null;inp.dataset.userPhoto='0';try{inp.value=''}catch(e){}})}
function removeAccidentalDuplicates(side,changed){if(!side)return;const all=inputs(side),chosen=file(changed);if(!chosen)return;const chosenFp=fp(chosen);all.forEach(inp=>{if(inp===changed)return;const other=file(inp);if(!other||fp(other)!==chosenFp)return;
    // Sur un véhicule nouvellement ajouté, une même sélection ne doit jamais apparaître dans un autre slot.
    // On ne vide jamais un champ que l'utilisateur a lui-même choisi.
    if(side.closest('.vehicle')?.dataset.photoSlotNew==='1' && inp.dataset.userPhoto!=='1')clearVisible(inp);
  })}
async function repairVisible(){
  const cur=await get(KEY),legacyBox=await get(LEGACY),legacy=legacyBox&&legacyBox.draft;
  const vehicles=Array.from(document.querySelectorAll('.vehicle'));
  vehicles.forEach((v,i)=>['left','right'].forEach(key=>{
    const side=v.querySelector('[id$="_'+key+'"]');if(!side)return;
    const coil=byLabel(side,'État de la bobine'),res=byLabel(side,'Mesure de résistance');if(!coil||!res)return;
    const cf=file(coil),rf=file(res);if(!cf||!rf||fp(cf)!==fp(rf))return;
    const so=cur&&cur.vehicles&&cur.vehicles[i]&&cur.vehicles[i].sides&&cur.vehicles[i].sides[key];
    const rp=savedByLabel(so,'Mesure de résistance');
    if(rp&&rp.blob&&fp(rp.blob)!==fp(cf)){set(res,rp);return}
    const old=legacy&&legacy.vehicles&&legacy.vehicles[i]&&legacy.vehicles[i].sides&&legacy.vehicles[i].sides[key];
    const oldp=old&&old.photos&&old.photos[5];
    if(oldp&&oldp.blob&&fp(oldp.blob)!==fp(cf)){set(res,oldp);return}
    clearVisible(res);
  }));
}
// Une sélection utilisateur appartient uniquement à l'input qui a déclenché l'événement.
document.addEventListener('change',e=>{
  const inp=e.target;if(!(inp instanceof HTMLInputElement)||inp.type!=='file')return;
  const picked=(inp.files&&inp.files[0])||null;inp._savedBlob=picked;inp.dataset.userPhoto=picked?'1':'0';
  const side=inp.closest('.embk-side');if(!side)return;
  setTimeout(()=>removeAccidentalDuplicates(side,inp),0);
  setTimeout(()=>removeAccidentalDuplicates(side,inp),100);
},true);
// Chaque prochain véhicule démarre avec TOUS ses emplacements photo réellement vides et indépendants.
document.addEventListener('embkVehicleAdded',e=>{const v=e.detail&&e.detail.wrap;if(!v)return;markCleanVehicle(v)},false);
const restore=document.getElementById('restoreDraft');if(restore)restore.addEventListener('click',()=>{setTimeout(repairVisible,1200);setTimeout(repairVisible,2500)},false);
setTimeout(repairVisible,800);
})();