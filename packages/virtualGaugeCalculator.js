!function(e){var t={};function n(o){if(t[o])return t[o].exports;var r=t[o]={i:o,l:!1,exports:{}};return e[o].call(r.exports,r,r.exports,n),r.l=!0,r.exports}n.m=e,n.c=t,n.d=function(e,t,o){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:o})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var o=Object.create(null);if(n.r(o),Object.defineProperty(o,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var r in e)n.d(o,r,function(t){return e[t]}.bind(null,r));return o},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n(n.s=15)}({0:function(e,t){function n(e){return(n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function o(t){return"function"==typeof Symbol&&"symbol"===n(Symbol.iterator)?e.exports=o=function(e){return n(e)}:e.exports=o=function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":n(e)},o(t)}e.exports=o},15:function(e,t,n){"use strict";n.r(t);var o=n(0),r=n.n(o);window.addEventListener("message",function(e){if(e.origin!==window.location.origin)return console.log(e.origin+" is not permitted to use this iframe."),"Your origin is not permitted to use this iframe";var t=e.source;e.data;if(console.log(e),"usgsarray"===e.data.type)window.usgsarray=e.data.data,t.postMessage({type:"confirmation",result:"usgsarray"},e.origin),console.log(window.usgsarray);else if("calculation"===e.data.type){for(var n=e.data.usgsSites,o={},a=0;a<n.length;a++)o[n[a]]=usgsarray[n[a]];console.log(o),function(e,t){var n,o={},r=t.parameters||[];void 0!==r.length&&"string"!=typeof r||(r=[r]),console.log(r),n="\nself.onmessage = function(parameters) {\n\tparameters = parameters.data\n\tlet result = (".concat(e,')(...parameters);\n\tpostMessage({\n\t\ttype:"message",\n\t\tfinished:true,\n\t\tcontent:result\n\t})\n}'),console.log(n);var a=new Blob([n]),i=URL.createObjectURL(a);return o.worker=new Worker(i),o.result=new Promise(function(e,t){o.worker.onmessage=function(t){(t=t.data).finished?e(t.content):o.onmessage&&o.onmessage(t)},Object.defineProperty(o.worker,"onmessage",{configurable:!1,writable:!1,value:o.worker.onmessage})}),o.init=function(){return o.worker.postMessage(r),delete o.init,o},o}(e.data.function,{parameters:[o]}).init().result.then(function(n){if("object"===r()(n)&&n){for(var o=Object.keys(n),a=0;a<o.length;a++)["00060","00065"].includes(o[a])||(console.warn(e.data.gaugeID+" returned a property named "+o[a]+", which is not allowed."),delete n[o[a]]);n.name=e.data.gaugeID,usgsarray[e.data.gaugeID]=n}else n=void 0,console.warn(e.data.gaugeID+" failed to return an object, and instead returned "+n);t.postMessage({type:"calculation",gaugeID:e.data.gaugeID,result:n},e.origin)})}})}});
//# sourceMappingURL=virtualGaugeCalculator.js.map