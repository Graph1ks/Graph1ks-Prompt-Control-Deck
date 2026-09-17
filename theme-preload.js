(function(){
  'use strict';
  var KEY='graph1ks_ui_theme_v1';
  var theme='dark';
  try{theme=localStorage.getItem(KEY)==='light'?'light':'dark';}catch(_){ }
  document.documentElement.setAttribute('data-theme',theme);
})();
