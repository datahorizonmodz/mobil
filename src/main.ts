import './style.css';
import { GameApp } from './game/core/game';
void new GameApp().init();

if(import.meta.env.PROD&&'serviceWorker' in navigator)window.addEventListener('load',()=>{
  const hadController=!!navigator.serviceWorker.controller;
  let refreshed=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(hadController&&!refreshed){refreshed=true;location.reload();}
  });
  void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(registration=>{
    if(registration.waiting)registration.waiting.postMessage('SKIP_WAITING');
    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;
      worker?.addEventListener('statechange',()=>{
        if(worker.state==='installed'&&navigator.serviceWorker.controller)worker.postMessage('SKIP_WAITING');
      });
    });
    void registration.update();
  }).catch(error=>console.warn('[Coastline] Service worker update failed',error));
});
