(function(){
  'use strict';
  const CAUSE_KEY='embk-damage-causes-v1';
  const LEGACY_DB='embk-safe-draft-v1', LEGACY_STORE='drafts', LEGACY_KEY='current';
  const SAFE_DB='embk-safe-backup-v2', SAFE_STORE='backups';
  const SAFE_CURRENT='current-complete', SAFE_LEGACY='legacy-before-photo-fix';
  let safeTimer=null, restoreGuard=false;

  function triggerDraftSave(message){
    const train=document.getElementById('train');
    const state=document.getElementById('draftState');
    if(state&&message)state.textContent=message;
    if(train)train.dispatchEvent(new Event('input',{bubbles:true}));
  }

  function openDb(name,store){
    return new Promise((ok,no)=>{
      const r=indexedDB.open(name,1);
      r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(store))r.result.createObjectStore(store)};
      r.onsuccess=()=>ok(r.result);
      r.onerror=()=>no(r.error);
    });
  }
  async function dbGet(name,store,key){
    const db=await openDb(name,store);
    return new Promise((ok,no)=>{
      const r=db.transaction(store).objectStore(store).get(key);
      r.onsuccess=()=>ok(r.result||null); r.onerror=()=>no(r.error);
    });
  }
  async function dbPut(name,store,key,value){
    const db=await openDb(name,store);
    return new Promise((ok,no)=>{
      const t=db.transaction(store,'readwrite');
      t.objectStore(store).put(value,key);
      t.oncomplete=()=>ok(); t.onerror=()=>no(t.error);
    });
  }

  async function protectExistingDraft(){
    try{
      const already=await dbGet(SAFE_DB,SAFE_STORE,SAFE_LEGACY);
      if(already)return;
      const old=await dbGet(LEGACY_DB,LEGACY_STORE,LEGACY_KEY);
      if(old)await dbPut(SAFE_DB,SAFE_STORE,SAFE_LEGACY,{copiedAt:Date.now(),draft:old});
    }catch(e){console.warn('Copie de sécurité du brouillon existant',e)}
  }

  function getCauseState(){
    try{return JSON.parse(localStorage.getItem(CAUSE_KEY)||'[]')}catch(e){return []}
  }
  function saveCauseState(){
    const data=[];
    document.querySelectorAll('.vehicle').forEach(function(v){
      const item={left:'',right:''};
      ['left','right'].forEach(function(key){
        const side=v.querySelector('[id$="_'+key+'"]');
        if(!side)return;
        const checked=side.querySelector('input[name="'+side.id+'_damageCause"]:checked');
        item[key]=checked?checked.value:'';
      });
      data.push(item);
    });
    try{localStorage.setItem(CAUSE_KEY,JSON.stringify(data))}catch(e){console.warn('Sauvegarde cause EMBK',e)}
  }

  function fileFromInput(inp){
    return (inp&&inp.files&&inp.files[0]) || (inp&&inp._savedBlob) || null;
  }

  async function completeSnapshot(){
    const data={
      version:2,savedAt:Date.now(),
      train:document.getElementById('train')?.value||'',
      baseDate:document.getElementById('baseDate')?.value||'',
      baseOperator:document.getElementById('baseOperator')?.value||'',
      dateCommon:document.querySelector('input[name="dateCommon"]:checked')?.value||'',
      opCommon:document.querySelector('input[name="opCommon"]:checked')?.value||'',
      vehicles:[]
    };
    document.querySelectorAll('.vehicle').forEach(function(v){
      const vo={
        number:v.querySelector('.vehicle-number')?.value||'',
        date:v.querySelector('.vehicle-date')?.value||'',
        operator:v.querySelector('.vehicle-operator')?.value||'',
        sides:{}
      };
      ['left','right'].forEach(function(key){
        const side=v.querySelector('[id$="_'+key+'"]');
        if(!side)return;
        const id=side.id;
        const so={
          embk:side.querySelector('input[name="'+id+'_embk"]:checked')?.value||'',
          coil:side.querySelector('input[name="'+id+'_coil"]:checked')?.value||'',
          tests:side.querySelector('input[name="'+id+'_tests"]:checked')?.value||'',
          damageCause:side.querySelector('input[name="'+id+'_damageCause"]:checked')?.value||'',
          res:side.querySelector('.res-value')?.value||'',
          photos:[]
        };
        side.querySelectorAll('input[type=file]').forEach(function(inp,index){
          const f=fileFromInput(inp);
          so.photos.push(f?{
            index:index,label:inp.dataset.label||'',name:f.name||('photo_'+index+'.jpg'),
            type:f.type||'image/jpeg',lastModified:f.lastModified||Date.now(),blob:f
          }:null);
        });
        vo.sides[key]=so;
      });
      data.vehicles.push(vo);
    });
    return data;
  }

  async function saveComplete(message){
    if(restoreGuard)return false;
    await protectExistingDraft();
    try{
      saveCauseState();
      const snap=await completeSnapshot();
      await dbPut(SAFE_DB,SAFE_STORE,SAFE_CURRENT,snap);
      const state=document.getElementById('draftState');
      if(state&&message)state.textContent=message;
      return true;
    }catch(e){
      console.error('Sauvegarde complète',e);
      const state=document.getElementById('draftState');
      if(state)state.textContent='Erreur pendant la sauvegarde complète';
      return false;
    }
  }
  function queueComplete(){
    if(restoreGuard)return;
    clearTimeout(safeTimer);
    safeTimer=setTimeout(()=>saveComplete(),500);
  }

  function updateDamageBlock(side){
    if(!side)return;
    const block=side.querySelector('.damage-cause-wrap');
    if(!block)return;
    const embkNo=side.querySelector('input[name="'+side.id+'_embk"][value="Non"]');
    block.style.display=embkNo&&embkNo.checked?'block':'none';
    const cause=side.querySelector('input[name="'+side.id+'_damageCause"]:checked');
    const photo=block.querySelector('input[type=file]');
    if(photo)photo.dataset.label=cause&&cause.value?'Photo de la casse - Cause : '+cause.value:'Photo de la casse';
  }

  function decorateSide(side){
    if(!side||side.querySelector('.damage-cause-wrap'))return;
    const p=side.id;
    const embkRadio=side.querySelector('input[name="'+p+'_embk"]');
    if(!embkRadio)return;
    const choiceRow=embkRadio.closest('.row.choice');
    if(!choiceRow)return;
    const block=document.createElement('div');
    block.className='replacement damage-cause-wrap';
    block.style.display='none';
    block.innerHTML='<h3>Cause du remplacement de l\'EMBK</h3>'+
      '<div class="row choice">'+
      '<div><input id="'+p+'_causeAilettes" type="radio" name="'+p+'_damageCause" value="Ailettes cassées"><label for="'+p+'_causeAilettes">Ailettes cassées</label></div>'+
      '<div><input id="'+p+'_causeBornes" type="radio" name="'+p+'_damageCause" value="Bornes fissurées"><label for="'+p+'_causeBornes">Bornes fissurées</label></div>'+
      '</div>'+
      '<div class="photo replacement"><label>Photo de la casse</label><input data-label="Photo de la casse" type="file" accept="image/*" capture="environment"></div>';
    choiceRow.insertAdjacentElement('afterend',block);
    side.querySelectorAll('input[name="'+p+'_embk"]').forEach(r=>r.addEventListener('change',()=>{updateDamageBlock(side);saveCauseState();queueComplete();}));
    block.querySelectorAll('input[name="'+p+'_damageCause"]').forEach(r=>r.addEventListener('change',()=>{updateDamageBlock(side);saveCauseState();queueComplete();}));
    updateDamageBlock(side);
  }
  function decorateAll(){document.querySelectorAll('.embk-side').forEach(decorateSide)}

  function restoreCauseState(){
    decorateAll();
    const data=getCauseState();
    document.querySelectorAll('.vehicle').forEach(function(v,i){
      ['left','right'].forEach(function(key){
        const side=v.querySelector('[id$="_'+key+'"]');
        if(!side)return;
        const value=data[i]&&data[i][key];
        if(value){
          const r=side.querySelector('input[name="'+side.id+'_damageCause"][value="'+value+'"]');
          if(r)r.checked=true;
        }
        updateDamageBlock(side);
      });
    });
  }

  function putFileBack(input,p){
    if(!input||!p?.blob)return;
    const file=p.blob instanceof File?p.blob:new File([p.blob],p.name||'photo.jpg',{type:p.type||'image/jpeg',lastModified:p.lastModified||Date.now()});
    input._savedBlob=file;
    try{
      const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;
    }catch(e){console.warn('Photo gardée en mémoire restaurée',e)}
  }

  function findVehicleElement(vehicles,vo,i){
    const num=(vo&&vo.number||'').trim();
    if(num){
      const exact=vehicles.find(function(v){return (v.querySelector('.vehicle-number')?.value||'').trim()===num});
      if(exact)return exact;
    }
    return vehicles[i]||null;
  }
  function normalizedPhotoLabel(label){
    return String(label||'').startsWith('Photo de la casse')?'Photo de la casse':String(label||'');
  }
  function inputBySavedPhoto(side,ph){
    if(!side||!ph||!ph.label)return null;
    const wanted=normalizedPhotoLabel(ph.label);
    return Array.from(side.querySelectorAll('input[type=file]')).find(function(inp){
      return normalizedPhotoLabel(inp.dataset.label||'')===wanted;
    })||null;
  }
  async function overlayProtectedOriginalPhotos(){
    try{
      const box=await dbGet(SAFE_DB,SAFE_STORE,SAFE_LEGACY);
      const d=box&&box.draft;
      if(!d||!Array.isArray(d.vehicles))return false;
      decorateAll();
      const vehicles=Array.from(document.querySelectorAll('.vehicle'));
      d.vehicles.forEach(function(vo,i){
        const v=findVehicleElement(vehicles,vo,i); if(!v)return;
        ['left','right'].forEach(function(key){
          const side=v.querySelector('[id$="_'+key+'"]'),so=vo.sides&&vo.sides[key];
          if(!side||!so)return;
          (so.photos||[]).forEach(function(ph,j){
            const inp=inputBySavedPhoto(side,ph,j,true,{savedCount:(so.photos||[]).length});
            if(ph&&ph.blob&&inp)putFileBack(inp,ph);
          });
        });
      });
      return true;
    }catch(e){console.warn('Récupération copie originale',e);return false}
  }

  async function repairKnownRightDuplication(){
    try{
      const box=await dbGet(SAFE_DB,SAFE_STORE,SAFE_LEGACY),old=box&&box.draft;
      if(!old||!Array.isArray(old.vehicles))return false;
      const vehicles=Array.from(document.querySelectorAll('.vehicle'));
      let repaired=false;
      old.vehicles.forEach(function(vo,i){
        const v=findVehicleElement(vehicles,vo,i);if(!v)return;
        const side=v.querySelector('[id$="_right"]'),so=vo.sides&&vo.sides.right;if(!side||!so)return;
        const normal=Array.from(side.querySelectorAll('input[type=file]')).filter(inp=>!inp.closest('.damage-cause-wrap'));
        const photos=so.photos||[];
        const hasDamageSlot=photos.length===normal.length+1;
        const old1=photos[hasDamageSlot?1:0],old2=photos[hasDamageSlot?2:1];
        if(!old1?.blob||!old2?.blob)return;
        const first=normal[0],second=normal[1],lastA=normal[normal.length-2],lastB=normal[normal.length-1];
        const cur1=fileFromInput(first),cur2=fileFromInput(second),curA=fileFromInput(lastA),curB=fileFromInput(lastB);
        const fp=f=>f?[f.size||0,f.type||'',f.name||'',f.lastModified||0].join('|'):'';
        if(fp(cur1)&&fp(cur2)&&fp(cur1)===fp(curA)&&fp(cur2)===fp(curB)){
          putFileBack(first,old1);putFileBack(second,old2);repaired=true;
        }
      });
      return repaired;
    }catch(e){console.warn('Réparation ciblée EMBK droit',e);return false}
  }

  async function overlayCompleteBackup(){
    try{
      const d=await dbGet(SAFE_DB,SAFE_STORE,SAFE_CURRENT);
      if(!d||!Array.isArray(d.vehicles))return;
      decorateAll();
      const vehicles=Array.from(document.querySelectorAll('.vehicle'));
      d.vehicles.forEach(function(vo,i){
        const v=findVehicleElement(vehicles,vo,i); if(!v)return;
        if(v.querySelector('.vehicle-number'))v.querySelector('.vehicle-number').value=vo.number||'';
        if(v.querySelector('.vehicle-date'))v.querySelector('.vehicle-date').value=vo.date||'';
        if(v.querySelector('.vehicle-operator'))v.querySelector('.vehicle-operator').value=vo.operator||'';
        ['left','right'].forEach(function(key){
          const side=v.querySelector('[id$="_'+key+'"]'),so=vo.sides?.[key]; if(!side||!so)return;
          [['embk',so.embk],['coil',so.coil],['tests',so.tests],['damageCause',so.damageCause]].forEach(function(pair){
            if(!pair[1])return;
            const r=side.querySelector('input[name="'+side.id+'_'+pair[0]+'"][value="'+pair[1]+'"]');
            if(r){r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}))}
          });
          if(side.querySelector('.res-value'))side.querySelector('.res-value').value=so.res||'';
          (so.photos||[]).forEach(function(ph){
            const inp=inputBySavedPhoto(side,ph);
            if(ph&&ph.blob&&inp)putFileBack(inp,ph);
          });
          updateDamageBlock(side);
        });
      });
      const state=document.getElementById('draftState');
      if(state)state.textContent='Brouillon repris avec toutes les photos ✓';
    }catch(e){console.warn('Restauration sauvegarde complète',e)}
  }

  function validateDamage(){
    const problems=[];
    document.querySelectorAll('.vehicle').forEach(function(v){
      const num=v.querySelector('.vehicle-number')?.value.trim()||'Véhicule';
      ['left','right'].forEach(function(key){
        const side=v.querySelector('[id$="_'+key+'"]'); if(!side)return;
        const embkNo=side.querySelector('input[name="'+side.id+'_embk"][value="Non"]');
        if(!embkNo||!embkNo.checked)return;
        const label=key==='left'?'gauche':'droit';
        const cause=side.querySelector('input[name="'+side.id+'_damageCause"]:checked');
        const photo=side.querySelector('.damage-cause-wrap input[type=file]');
        if(!cause)problems.push(num+' - EMBK '+label+' : indiquez la cause du remplacement.');
        if(!photo||!fileFromInput(photo))problems.push(num+' - EMBK '+label+' : ajoutez la photo de la casse.');
      });
    });
    if(!problems.length)return true;
    const status=document.getElementById('status');
    if(status){status.className='status show warn';status.innerHTML='<b>Impossible de continuer :</b><br>'+problems.join('<br>')}
    alert(problems.join('\n')); return false;
  }

  function setup(){
    decorateAll(); restoreCauseState();
    protectExistingDraft();

    document.addEventListener('change',function(e){
      if(restoreGuard)return;
      if(e.target instanceof HTMLInputElement){
        if(e.target.type==='file')e.target._savedBlob=(e.target.files&&e.target.files[0])||null;
        queueComplete();
      }
    },true);

    document.addEventListener('embkVehicleAdded',function(){
      setTimeout(function(){decorateAll();restoreCauseState();if(!restoreGuard)queueComplete();},0);
    });

    const actions=document.querySelector('.draftactions');
    if(actions&&!document.getElementById('saveDraftNow')){
      const btn=document.createElement('button');
      btn.id='saveDraftNow';btn.type='button';btn.className='btn success';btn.textContent='Enregistrer maintenant';
      btn.addEventListener('click',async function(){
        const ok=await saveComplete('Sauvegarde complète en cours…');
        if(ok){
          triggerDraftSave();
          setTimeout(()=>{const s=document.getElementById('draftState');if(s)s.textContent='Tout le rapport et toutes les photos sont enregistrés ✓'},900);
        }
      });
      actions.insertBefore(btn,actions.lastElementChild);
    }

    document.addEventListener('click',function(e){
      const el=e.target instanceof Element?e.target:null;
      const target=el&&el.closest('.remove');
      if(target)setTimeout(async function(){saveCauseState();await saveComplete('Véhicule supprimé — sauvegarde mise à jour…');triggerDraftSave();},200);

      const action=el&&el.closest('#addVehicle,#addVehicleBottom');
      if(action&&!validateDamage()){e.preventDefault();e.stopImmediatePropagation()}

      const restore=el&&el.closest('#restoreDraft');
      if(restore){
        restoreGuard=true;
        clearTimeout(safeTimer);
        setTimeout(restoreCauseState,150);
        // Let the application's normal restore rebuild the fields first,
        // then put the untouched original photo blobs back in their original slots.
        setTimeout(async function(){
          await overlayCompleteBackup();
          const state=document.getElementById('draftState');
          if(state)state.textContent='Brouillon repris — photos de tous les véhicules récupérées ✓';
        },1000);
        setTimeout(async function(){
          await overlayCompleteBackup();
          restoreGuard=false;
        },2200);
      }
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();