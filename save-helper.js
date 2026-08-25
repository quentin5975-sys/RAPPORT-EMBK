(function(){
  'use strict';
  function triggerDraftSave(message){
    const train=document.getElementById('train');
    const state=document.getElementById('draftState');
    if(state&&message)state.textContent=message;
    if(train)train.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function setup(){
    const actions=document.querySelector('.draftactions');
    if(actions&&!document.getElementById('saveDraftNow')){
      const btn=document.createElement('button');
      btn.id='saveDraftNow';
      btn.type='button';
      btn.className='btn success';
      btn.textContent='Enregistrer maintenant';
      btn.addEventListener('click',function(){
        triggerDraftSave('Enregistrement du brouillon…');
        setTimeout(function(){
          const state=document.getElementById('draftState');
          if(state)state.textContent='Brouillon enregistré ✓';
        },1000);
      });
      actions.insertBefore(btn,actions.lastElementChild);
    }
    document.addEventListener('click',function(e){
      const target=e.target instanceof Element?e.target.closest('.remove'):null;
      if(target){
        setTimeout(function(){
          triggerDraftSave('Véhicule supprimé — brouillon mis à jour…');
          setTimeout(function(){
            const state=document.getElementById('draftState');
            if(state)state.textContent='Brouillon mis à jour ✓';
          },1000);
        },100);
      }
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();