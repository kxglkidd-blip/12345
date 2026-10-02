
/* Soft click ripple on primary/ghost buttons */
(function(){
  function ripple(e){
    var btn=e.currentTarget;
    if(!btn||btn.disabled)return;
    var rect=btn.getBoundingClientRect();
    var r=document.createElement('span');
    r.className='ax-click-ripple';
    var size=Math.max(rect.width,rect.height);
    r.style.width=r.style.height=size+'px';
    r.style.left=(e.clientX-rect.left-size/2)+'px';
    r.style.top=(e.clientY-rect.top-size/2)+'px';
    btn.appendChild(r);
    setTimeout(function(){if(r.parentNode)r.parentNode.removeChild(r);},500);
  }
  function bind(){
    document.querySelectorAll('.primary-btn,.sh-add-btn,.sh-exec-btn').forEach(function(b){
      if(b.dataset.axRipple)return;
      b.dataset.axRipple='1';
      b.style.position=b.style.position||'relative';
      b.style.overflow='hidden';
      b.addEventListener('click',ripple);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);
  else bind();
  setInterval(bind,2000);
  window.addEventListener('andrux_lang_change',function(){setTimeout(bind,50);});
})();
