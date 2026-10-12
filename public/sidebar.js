'use strict';
(()=>{const button=document.getElementById('sidebarToggle');let hidden=false;try{hidden=localStorage.getItem('hangul-garden-sidebar-hidden')==='true';}catch{}
function update(){document.documentElement.classList.toggle('sidebar-hidden',hidden);document.getElementById('wordSidebar').hidden=hidden;button.setAttribute('aria-expanded',String(!hidden));button.textContent=hidden?'☰ 낱말 메뉴 열기':'☰ 낱말 메뉴 닫기';}
button.onclick=()=>{hidden=!hidden;update();try{localStorage.setItem('hangul-garden-sidebar-hidden',String(hidden));}catch{}window.dispatchEvent(new Event('resize'));};update();})();
