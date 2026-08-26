(function(){
  'use strict';
  const CAUSE_KEY='embk-damage-causes-v1';

  function triggerDraftSave(message){
    const train=document.getElementById('train');
    const state=document.getElementById('draftState');
    if(state&&message)state.textContent=message;
    if(train)train.dispatchEvent(new Event('input',{bubbles:true}));
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

    side.querySelectorAll('input[name="'+p+'_embk"]').forEach(function(r){
      r.addEventListener('change',function(){updateDamageBlock(side);saveCauseState();triggerDraftSave();});
    });
    block.querySelectorAll('input[name="'+p+'_damageCause"]').forEach(function(r){
      r.addEventListener('change',function(){updateDamageBlock(side);saveCauseState();triggerDraftSave();});
    });
    updateDamageBlock(side);
  }

  function decorateAll(){
    document.querySelectorAll('.embk-side').forEach(decorateSide);
  }

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

  function validateDamage(){
    const problems=[];
    document.querySelectorAll('.vehicle').forEach(function(v){
      const num=(v.querySelector('.vehicle-number')&&v.querySelector('.vehicle-number').value.trim())||'Véhicule';
      ['left','right'].forEach(function(key){
        const side=v.querySelector('[id$="_'+key+'"]');
        if(!side)return;
        const embkNo=side.querySelector('input[name="'+side.id+'_embk"][value="Non"]');
        if(!embkNo||!embkNo.checked)return;
        const label=key==='left'?'gauche':'droit';
        const cause=side.querySelector('input[name="'+side.id+'_damageCause"]:checked');
        const photo=side.querySelector('.damage-cause-wrap input[type=file]');
        if(!cause)problems.push(num+' - EMBK '+label+' : indiquez la cause du remplacement.');
        if(!photo||(!(photo.files&&photo.files[0])&&!photo._savedBlob))problems.push(num+' - EMBK '+label+' : ajoutez la photo de la casse.');
      });
    });
    if(!problems.length)return true;
    const status=document.getElementById('status');
    if(status){status.className='status show warn';status.innerHTML='<b>Impossible de continuer :</b><br>'+problems.join('<br>');}
    alert(problems.join('\n'));
    return false;
  }

  function setup(){
    decorateAll();
    restoreCauseState();

    document.addEventListener('embkVehicleAdded',function(){
      setTimeout(function(){decorateAll();restoreCauseState();},0);
    });

    const actions=document.querySelector('.draftactions');
    if(actions&&!document.getElementById('saveDraftNow')){
      const btn=document.createElement('button');
      btn.id='saveDraftNow';
      btn.type='button';
      btn.className='btn success';
      btn.textContent='Enregistrer maintenant';
      btn.addEventListener('click',function(){
        saveCauseState();
        triggerDraftSave('Enregistrement du brouillon…');
        setTimeout(function(){
          const state=document.getElementById('draftState');
          if(state)state.textContent='Brouillon enregistré ✓';
        },1000);
      });
      actions.insertBefore(btn,actions.lastElementChild);
    }

    document.addEventListener('click',function(e){
      const el=e.target instanceof Element?e.target:null;
      const target=el&&el.closest('.remove');
      if(target){
        setTimeout(function(){
          saveCauseState();
          triggerDraftSave('Véhicule supprimé — brouillon mis à jour…');
          setTimeout(function(){
            const state=document.getElementById('draftState');
            if(state)state.textContent='Brouillon mis à jour ✓';
          },1000);
        },150);
      }

      const action=el&&el.closest('#addVehicle,#addVehicleBottom,#generatePdf,#generatePdfBottom');
      if(action&&!validateDamage()){
        e.preventDefault();
        e.stopImmediatePropagation();
      }

      const restore=el&&el.closest('#restoreDraft');
      if(restore){
        setTimeout(restoreCauseState,100);
        setTimeout(restoreCauseState,500);
        setTimeout(restoreCauseState,1200);
      }
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();