(function(){'use strict';
// Correctif non destructif : chaque input photo reste lié à son libellé exact.
const DB='embk-safe-backup-v2',STORE='backups',KEY='current-complete',LEGACY='legacy-before-photo-fix';
function open(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function get(k){const db=await open();return new Promise((ok,no)=>{const r=db.transaction(STORE).objectStore(STORE).get(k);r.onsuccess=()=>ok(r.result||null);r.onerror=()=>no(r.error)})}
function file(inp){return inp?((inp.files&&inp.files[0])||inp._savedBlob||null):null}
function fp(f){return f?[f.size||0,f.type||'',f.name||'',f.lastModified||0].join('|'):''}
function set(inp,p){if(!inp||!p||!p.blob)return;const f=p.blob instanceof File?p.blob:new File([p.blob],p.name||'photo.jpg',{type:p.type||'image/jpeg',lastModified:p.lastModified||Date.now()});inp._savedBlob=f;try{const d=new DataTransfer();d.items.add(f);inp.files=d.files}catch(e){}}
function byLabel(side,label){return Array.from(side.querySelectorAll('input[type=file]')).find(x=>(x.dataset.label||'')===label)||null}
function savedByLabel(so,label){return (so&&so.photos||[]).find(p=>p&&p.label===label)||null}
async function repairVisible(){
  const cur=await get(KEY),legacyBox=await get(LEGACY),legacy=legacyBox&&legacyBox.draft;
  const vehicles=Array.from(document.querySelectorAll('.vehicle'));
  vehicles.forEach((v,i)=>['left','right'].forEach(key=>{
    const side=v.querySelector('[id$="_'+key+'"]');if(!side)return;
    const coil=byLabel(side,'État de la bobine'),res=byLabel(side,'Mesure de résistance');if(!coil||!res)return;
    const cf=file(coil),rf=file(res);if(!cf||!rf||fp(cf)!==fp(rf))return;
    // 1) Priorité à une vraie mesure distincte déjà enregistrée par libellé.
    const so=cur&&cur.vehicles&&cur.vehicles[i]&&cur.vehicles[i].sides&&cur.vehicles[i].sides[key];
    const rp=savedByLabel(so,'Mesure de résistance');
    if(rp&&rp.blob&&fp(rp.blob)!==fp(cf)){set(res,rp);return}
    // 2) Ancienne sauvegarde protégée : ordre historique fixe, résistance = slot 5.
    const old=legacy&&legacy.vehicles&&legacy.vehicles[i]&&legacy.vehicles[i].sides&&legacy.vehicles[i].sides[key];
    const oldp=old&&old.photos&&old.photos[5];
    if(oldp&&oldp.blob&&fp(oldp.blob)!==fp(cf)){set(res,oldp);return}
    // Sinon on ne touche à aucune donnée : on vide seulement le faux doublon visible.
    try{res.value=''}catch(e){} res._savedBlob=null;
  }));
}
// Quand l'utilisateur remplace UNE photo, on ne touche à aucun autre input.
document.addEventListener('change',e=>{const inp=e.target;if(!(inp instanceof HTMLInputElement)||inp.type!=='file')return;inp._savedBlob=(inp.files&&inp.files[0])||null;},true);
const restore=document.getElementById('restoreDraft');if(restore)restore.addEventListener('click',()=>{setTimeout(repairVisible,1200);setTimeout(repairVisible,2500)},false);
setTimeout(repairVisible,800);
})();