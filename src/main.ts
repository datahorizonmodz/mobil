import './style.css';
import { GameApp } from './game/core/game';
void new GameApp().init();

if('serviceWorker' in navigator && import.meta.env.PROD)window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});});
