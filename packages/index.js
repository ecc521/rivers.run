!function(e){var t={};function n(r){if(t[r])return t[r].exports;var a=t[r]={i:r,l:!1,exports:{}};return e[r].call(a.exports,a,a.exports,n),a.l=!0,a.exports}n.m=e,n.c=t,n.d=function(e,t,r){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:r})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var r=Object.create(null);if(n.r(r),Object.defineProperty(r,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var a in e)n.d(r,a,function(t){return e[t]}.bind(null,a));return r},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n(n.s=14)}([function(e,t){function n(e){return(n="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function r(t){return"function"==typeof Symbol&&"symbol"===n(Symbol.iterator)?e.exports=r=function(e){return n(e)}:e.exports=r=function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":n(e)},r(t)}e.exports=r},function(e,t,n){e.exports=n(15)},function(e,t,n){var r=n(17),a=n(18),o=n(19);e.exports=function(e){return r(e)||a(e)||o()}},function(e,t){function n(e,t,n,r,a,o,i){try{var l=e[o](i),s=l.value}catch(e){return void n(e)}l.done?t(s):Promise.resolve(s).then(r,a)}e.exports=function(e){return function(){var t=this,r=arguments;return new Promise(function(a,o){var i=e.apply(t,r);function l(e){n(i,a,o,l,s,"next",e)}function s(e){n(i,a,o,l,s,"throw",e)}l(void 0)})}}},function(e,t,n){"use strict";n.r(t),n.d(t,"loadUSGS",function(){return l});var r=n(1),a=n.n(r),o=n(3),i=n.n(o);self.usgsarray={},window.updateOldDataWarning=function(){var e=document.getElementById("topOldDataWarning");if(e&&e.remove(),!(window.usgsDataAge<36e5)&&window.usgsDataAge){var t=document.createElement("p");t.id="topOldDataWarning",t.innerHTML="All river data is more than "+Math.floor(window.usgsDataAge/1e3/60/60)+" hours old! ",t.innerHTML+="("+window.loadNewUSGS+") ";var r=document.createElement("button");r.addEventListener("click",function(){window.loadNewUSGS="Trying to Load Data",n(4).loadUSGS()}),r.innerHTML="Try Again",t.appendChild(r);var a=document.getElementById("legend");a.parentNode.insertBefore(t,a)}};var l=function(){var e=i()(a.a.mark(function e(){var t,n,r,o,i,l,s,c,u,d,h,f,p,g,m,v,w,y;return a.a.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:if(!(window.usgsDataAge<36e5)){e.next=2;break}return e.abrupt("return");case 2:for(864e5,t=[],n=0;n<riverarray.length;n++)(r=riverarray[n].usgs)&&r.length>7&&r.length<16&&t.push(r);if(o="https://waterservices.usgs.gov/nwis/iv/?format=json&sites="+t.join(",")+"&startDT="+new Date(Date.now()-864e5).toISOString()+"&parameterCd=00060,00065,00010,00045&siteStatus=all",!window.fetch){e.next=15;break}return e.next=9,fetch(o);case 9:return l=e.sent,e.next=12,l.json();case 12:i=e.sent,e.next=20;break;case 15:return s=new XMLHttpRequest,e.next=18,new Promise(function(e,t){s.onload=function(t){e(t.target.response)},s.open("GET",o),s.send()});case 18:c=e.sent,i=JSON.parse(c);case 20:for(window.usgsDataAge=Date.now()-new Date(i.value.queryInfo.note[3].value).getTime(),window.updateOldDataWarning(),i.value.timeSeries.forEach(function(e){var t={};if(t.values=e.values[0].value,0!==t.values.length){t.units=e.variable.variableDescription;var n=e.sourceInfo.siteCode[0].value;if(!usgsarray[n]){var r={};r.name=e.sourceInfo.siteName,usgsarray[n]=r}var a=e.variable.variableCode[0].value;if("00010"===a&&"Temperature, water, degrees Celsius"===t.units){for(var o=0;o<t.values.length;o++)t.values[o].value=1.8*t.values[o].value+32;t.units="Temperature, water, degrees Fahrenheit"}usgsarray[n][a]=t}else console.log("Empty Array. Skipping")}),u=0;u<ItemHolder.length;u++)if(d=ItemHolder[u],h=usgsarray[d.usgs]){f=h["00060"],p=h["00065"],f&&(f=f.values),p&&(p=p.values),g=void 0,m=void 0,f&&(g=f[f.length-1].value),p&&(m=p[p.length-1].value),d.feet=m,d.cfs=g,g&&m?d.flow=g+"cfs "+m+"ft":g?d.flow=f[f.length-1].value+" cfs":m&&(d.flow=p[p.length-1].value+" ft"),v=document.getElementById(d.base+"1"),w=d.expanded,console.log(w),y=d.create(!0);try{v.parentNode.replaceChild(y,v),w&&(y.dispatchEvent(new Event("click")),y.dispatchEvent(new Event("click")))}catch(e){}}case 24:case"end":return e.stop()}},e)}));return function(){return e.apply(this,arguments)}}()},,,,function(e,t){function n(e,t){return e.sort(function(e,n){return e[t]>n[t]?1:e[t]<n[t]?-1:0}),e}function r(e,t){return e=n(e,"name"),t&&e.reverse(),e}function a(e,t){for(var r=0;r<e.length;r++)"number"==typeof e[r].rating&&(e[r].rating=String(e[r].rating));e=n(e,"rating");for(var a=0;a<e.length;a++)isNaN(parseFloat(e[a].rating))||(e[a].rating=parseFloat(e[a].rating));for(t||e.reverse();"Error"===e[0].rating;)e.push(e.shift());return e}function o(e,t){if(e.sort(function(e,t){function n(e){switch(e.skill){case"FW":e=1;break;case"B":e=2;break;case"N":e=3;break;case"LI":e=4;break;case"I":e=5;break;case"HI":e=6;break;case"A":e=7;break;case"E":e=8;break;default:e=9}return e}return n(e)-n(t)}),t)for(e.reverse();"?"===e[0].skill;)e.push(e.shift());return e}e.exports={ratingsort:a,alphabeticalsort:r,skillsort:o,sort:function(e,t,i){if("alphabetical"===e)t=r(t,i);else if("rating"===e)t=a(t,i);else if("skill"===e)t=o(t,i);else{if("running"!==e)throw"Unknown sorting method "+e;t=function(e,t){var r=[],a=[],o=[],i=[],l=[];return e.forEach(function(e){void 0===e.running||isNaN(e.running)?e.flow&&e.dam?i.push(e):e.flow?o.push(e):e.dam?a.push(e):r.push(e):l.push(e)}),l=n(l,"running"),t||l.reverse(),void 0===window.usgsDataAge?(alert("Flow data has not yet loaded."),e):l=(l=(l=(l=l.concat(i)).concat(o)).concat(a)).concat(r)}(t,i)}return t}}},,,,,,function(e,t,n){"use strict";n.r(t);var r,a=n(1),o=n.n(a),i=n(3),l=n.n(i),s=n(0),c=n.n(s);try{window.loadNewUSGS="Trying to Load Data",window.serviceWorkerMessages=[],navigator.serviceWorker.ready.then(function(e){navigator.serviceWorker.onmessage=function(e){window.serviceWorkerMessages.push(e.data);var t=e.data;t.includes("waterservices.usgs.gov")&&(window.oldLoadUSGS=window.loadNewUSGS,t.includes("Updated cache for")?(console.log("Updating"),n(4).loadUSGS()):t.includes("errored. Using cache")?window.loadNewUSGS="Unable to load latest data":t.includes(" took too long to load from network")?window.loadNewUSGS="Updating data in backgroud":t.includes("has been loaded from the network")&&(window.loadNewUSGS="This is likely a glitch. You should be viewing the latest data."),window.updateOldDataWarning())}})}catch(e){console.error(e)}try{window.addLine=n(16).addLine}catch(e){console.error(e)}Object.assign(window,n(20)),window.River=n(21).River,window.sort=n(8).sort,Object.assign(window,n(23)),window.usgsarray={},window.ItemHolder=[],riverarray.map(function(e,t){ItemHolder[t]=new River(t,e)}),n(4).loadUSGS(),window.NewList=function(e,t,n){"string"==typeof e&&(e=e.toLowerCase());var a=ItemHolder.slice(0);if(0!==String(e).length&&e&&t){if("sort"===t&&(r&&(a=r),a=sort(e,a,n)),"normal"===t&&(a=normalSearch(a,e)),"advanced"===t&&(e=function e(t){if((arguments.length<=1?0:arguments.length-1)>1)for(var n=0;n<(arguments.length<=1?0:arguments.length-1);n++)e(t,n+1<1||arguments.length<=n+1?void 0:arguments[n+1]);else{var r=arguments.length<=1?void 0:arguments[1];for(var a in console.log(Object.assign({},t)),console.log(Object.assign({},r)),r)"object"===c()(r[a])?"object"!==c()(t[a])?t[a]=e({},r[a]):t[a]=e(t[a],r[a]):t[a]=r[a]}return t}({},u,e),a=advancedSearch(a,e)),"location"===t){r&&(a=r);var o=[];a.forEach(function(t){t.plat&&t.plon&&distanceto(t.plat,t.plon)<e&&o.push(t)}),a=o}}else(t=0===e.length)&&(a=normalSearch(a,e));ItemHolder.forEach(function(e){e.delete()});var i=document.getElementById("Rivers");a.forEach(function(e){i.appendChild(e.create())}),"sort"!==t&&(r=a)},document.getElementById("Rivers").appendChild((new TopBar).create()),n(25),NewList("alphabetical","sort");var u,d=document.getElementById("searchbox");function h(e,t){for(var n in e)if("object"===c()(e[n])){if(!h(e[n],t[n]))return!1}else if(e[n]!==t[n])return!1;return!0}function f(){var e={};e.name={type:document.getElementById("nameType").value,query:document.getElementById("nameQuery").value},e.section={type:document.getElementById("sectionType").value,query:document.getElementById("sectionQuery").value},e.writeup={type:document.getElementById("writeupType").value,query:document.getElementById("writeupQuery").value};var t=Number(document.getElementById("distanceQuery").value),n=document.getElementById("latitudeQuery").value,r=document.getElementById("longitudeQuery").value;return n=Number(n),r=Number(r),t>0||!n||!r?!(t>0)||n&&r?t>0&&n&&r&&(e.location={lat:n,lon:r,distance:t,includeUnknown:document.getElementById("includeUnknownLocation").checked}):alert("You must enter a latitude and longitude (Get the coordinates from GPS by pressing Calculate my Location)"):alert("Distance must be a number greater than 0 to use location sorting"),e.tags={query:document.getElementById("tagsQuery").value},e.skill={type:"from",query:[Number(document.getElementById("skillQuery1").value),Number(document.getElementById("skillQuery2").value)]},e.flow={type:"from",query:[Number(document.getElementById("flowQuery1").value),Number(document.getElementById("flowQuery2").value)],includeUnknown:document.getElementById("includeUnknownFlow").checked},e.sort={query:document.getElementById("sortQuery").value,reverse:document.getElementById("sortQueryReverse").checked},void 0!==u&&(console.log(Object.assign({},e)),console.log(Object.assign({},u)),e=function e(t,n){for(var r in t)"object"===c()(t[r])?h(t[r],n[r])?delete t[r]:t[r]instanceof Array||e(t[r],n[r]):t[r]===n[r]&&delete t[r];return t}(e,u)),e}function p(){return(p=l()(o.a.mark(function e(){var t,n,r,a,i,l;return o.a.wrap(function(e){for(;;)switch(e.prev=e.next){case 0:return t=document.getElementById("locationProgress"),n=0,r=setInterval(function(){n=(n+1)%6,t.innerHTML="Calculating your Approximate Location (Expect this to take 15-60 seconds)"+".".repeat(n)},500),e.prev=3,e.next=6,new Promise(function(e,t){navigator.geolocation.getCurrentPosition(e,t)});case 6:a=e.sent,e.next=15;break;case 9:e.prev=9,e.t0=e.catch(3),i="Error code "+e.t0.code+" occurred when getting your location. The error message is: "+e.t0.message,alert(i),clearInterval(r),t.innerHTML=i;case 15:l=a.coords,clearInterval(r),document.getElementById("latitudeQuery").value=l.latitude,document.getElementById("longitudeQuery").value=l.longitude,t.innerHTML="You are within "+l.accuracy+" meters of "+l.latitude+" degrees latitude and "+l.longitude+" degrees longitude.";case 20:case"end":return e.stop()}},e,null,[[3,9]])}))).apply(this,arguments)}if(d.addEventListener("keyup",function(){NewList(d.value,"normal")}),u=f(),console.log(u),document.getElementById("calculateCoordinates").addEventListener("click",function(){return p.apply(this,arguments)}),document.getElementById("performadvancedsearch").addEventListener("click",function(){var e=f(),t=window.location.href;t=t.slice(0,t.lastIndexOf("/")+1);var n=encodeURI(t+"#"+JSON.stringify(e));document.getElementById("searchlink").innerHTML='Link to this search: <a target="_blank" href="'+n+'">'+n+"</a>",NewList(e,"advanced",!1)}),window.location.hash.length>0){var g=decodeURI(window.location.hash.slice(1));try{var m=JSON.parse(g);NewList(m,"advanced")}catch(e){document.getElementById("searchbox").value=g,NewList(g,"normal")}}},function(e,t,n){var r=function(e){"use strict";var t,n=Object.prototype,r=n.hasOwnProperty,a="function"==typeof Symbol?Symbol:{},o=a.iterator||"@@iterator",i=a.asyncIterator||"@@asyncIterator",l=a.toStringTag||"@@toStringTag";function s(e,t,n,r){var a=t&&t.prototype instanceof g?t:g,o=Object.create(a.prototype),i=new T(r||[]);return o._invoke=function(e,t,n){var r=u;return function(a,o){if(r===h)throw new Error("Generator is already running");if(r===f){if("throw"===a)throw o;return I()}for(n.method=a,n.arg=o;;){var i=n.delegate;if(i){var l=k(i,n);if(l){if(l===p)continue;return l}}if("next"===n.method)n.sent=n._sent=n.arg;else if("throw"===n.method){if(r===u)throw r=f,n.arg;n.dispatchException(n.arg)}else"return"===n.method&&n.abrupt("return",n.arg);r=h;var s=c(e,t,n);if("normal"===s.type){if(r=n.done?f:d,s.arg===p)continue;return{value:s.arg,done:n.done}}"throw"===s.type&&(r=f,n.method="throw",n.arg=s.arg)}}}(e,n,i),o}function c(e,t,n){try{return{type:"normal",arg:e.call(t,n)}}catch(e){return{type:"throw",arg:e}}}e.wrap=s;var u="suspendedStart",d="suspendedYield",h="executing",f="completed",p={};function g(){}function m(){}function v(){}var w={};w[o]=function(){return this};var y=Object.getPrototypeOf,b=y&&y(y(C([])));b&&b!==n&&r.call(b,o)&&(w=b);var x=v.prototype=g.prototype=Object.create(w);function M(e){["next","throw","return"].forEach(function(t){e[t]=function(e){return this._invoke(t,e)}})}function E(e){var t;this._invoke=function(n,a){function o(){return new Promise(function(t,o){!function t(n,a,o,i){var l=c(e[n],e,a);if("throw"!==l.type){var s=l.arg,u=s.value;return u&&"object"==typeof u&&r.call(u,"__await")?Promise.resolve(u.__await).then(function(e){t("next",e,o,i)},function(e){t("throw",e,o,i)}):Promise.resolve(u).then(function(e){s.value=e,o(s)},function(e){return t("throw",e,o,i)})}i(l.arg)}(n,a,t,o)})}return t=t?t.then(o,o):o()}}function k(e,n){var r=e.iterator[n.method];if(r===t){if(n.delegate=null,"throw"===n.method){if(e.iterator.return&&(n.method="return",n.arg=t,k(e,n),"throw"===n.method))return p;n.method="throw",n.arg=new TypeError("The iterator does not provide a 'throw' method")}return p}var a=c(r,e.iterator,n.arg);if("throw"===a.type)return n.method="throw",n.arg=a.arg,n.delegate=null,p;var o=a.arg;return o?o.done?(n[e.resultName]=o.value,n.next=e.nextLoc,"return"!==n.method&&(n.method="next",n.arg=t),n.delegate=null,p):o:(n.method="throw",n.arg=new TypeError("iterator result is not an object"),n.delegate=null,p)}function L(e){var t={tryLoc:e[0]};1 in e&&(t.catchLoc=e[1]),2 in e&&(t.finallyLoc=e[2],t.afterLoc=e[3]),this.tryEntries.push(t)}function S(e){var t=e.completion||{};t.type="normal",delete t.arg,e.completion=t}function T(e){this.tryEntries=[{tryLoc:"root"}],e.forEach(L,this),this.reset(!0)}function C(e){if(e){var n=e[o];if(n)return n.call(e);if("function"==typeof e.next)return e;if(!isNaN(e.length)){var a=-1,i=function n(){for(;++a<e.length;)if(r.call(e,a))return n.value=e[a],n.done=!1,n;return n.value=t,n.done=!0,n};return i.next=i}}return{next:I}}function I(){return{value:t,done:!0}}return m.prototype=x.constructor=v,v.constructor=m,v[l]=m.displayName="GeneratorFunction",e.isGeneratorFunction=function(e){var t="function"==typeof e&&e.constructor;return!!t&&(t===m||"GeneratorFunction"===(t.displayName||t.name))},e.mark=function(e){return Object.setPrototypeOf?Object.setPrototypeOf(e,v):(e.__proto__=v,l in e||(e[l]="GeneratorFunction")),e.prototype=Object.create(x),e},e.awrap=function(e){return{__await:e}},M(E.prototype),E.prototype[i]=function(){return this},e.AsyncIterator=E,e.async=function(t,n,r,a){var o=new E(s(t,n,r,a));return e.isGeneratorFunction(n)?o:o.next().then(function(e){return e.done?e.value:o.next()})},M(x),x[l]="Generator",x[o]=function(){return this},x.toString=function(){return"[object Generator]"},e.keys=function(e){var t=[];for(var n in e)t.push(n);return t.reverse(),function n(){for(;t.length;){var r=t.pop();if(r in e)return n.value=r,n.done=!1,n}return n.done=!0,n}},e.values=C,T.prototype={constructor:T,reset:function(e){if(this.prev=0,this.next=0,this.sent=this._sent=t,this.done=!1,this.delegate=null,this.method="next",this.arg=t,this.tryEntries.forEach(S),!e)for(var n in this)"t"===n.charAt(0)&&r.call(this,n)&&!isNaN(+n.slice(1))&&(this[n]=t)},stop:function(){this.done=!0;var e=this.tryEntries[0].completion;if("throw"===e.type)throw e.arg;return this.rval},dispatchException:function(e){if(this.done)throw e;var n=this;function a(r,a){return l.type="throw",l.arg=e,n.next=r,a&&(n.method="next",n.arg=t),!!a}for(var o=this.tryEntries.length-1;o>=0;--o){var i=this.tryEntries[o],l=i.completion;if("root"===i.tryLoc)return a("end");if(i.tryLoc<=this.prev){var s=r.call(i,"catchLoc"),c=r.call(i,"finallyLoc");if(s&&c){if(this.prev<i.catchLoc)return a(i.catchLoc,!0);if(this.prev<i.finallyLoc)return a(i.finallyLoc)}else if(s){if(this.prev<i.catchLoc)return a(i.catchLoc,!0)}else{if(!c)throw new Error("try statement without catch or finally");if(this.prev<i.finallyLoc)return a(i.finallyLoc)}}}},abrupt:function(e,t){for(var n=this.tryEntries.length-1;n>=0;--n){var a=this.tryEntries[n];if(a.tryLoc<=this.prev&&r.call(a,"finallyLoc")&&this.prev<a.finallyLoc){var o=a;break}}o&&("break"===e||"continue"===e)&&o.tryLoc<=t&&t<=o.finallyLoc&&(o=null);var i=o?o.completion:{};return i.type=e,i.arg=t,o?(this.method="next",this.next=o.finallyLoc,p):this.complete(i)},complete:function(e,t){if("throw"===e.type)throw e.arg;return"break"===e.type||"continue"===e.type?this.next=e.arg:"return"===e.type?(this.rval=this.arg=e.arg,this.method="return",this.next="end"):"normal"===e.type&&t&&(this.next=t),p},finish:function(e){for(var t=this.tryEntries.length-1;t>=0;--t){var n=this.tryEntries[t];if(n.finallyLoc===e)return this.complete(n.completion,n.afterLoc),S(n),p}},catch:function(e){for(var t=this.tryEntries.length-1;t>=0;--t){var n=this.tryEntries[t];if(n.tryLoc===e){var r=n.completion;if("throw"===r.type){var a=r.arg;S(n)}return a}}throw new Error("illegal catch attempt")},delegateYield:function(e,n,r){return this.delegate={iterator:C(e),resultName:n,nextLoc:r},"next"===this.method&&(this.arg=t),p}},e}(e.exports);try{regeneratorRuntime=r}catch(e){Function("r","regeneratorRuntime = r")(r)}},function(e,t,n){"use strict";n.r(t),n.d(t,"addLine",function(){return o});var r=n(2),a=n.n(r);function o(e,t,n,r,o,i,l,s,c){if(3===s)var u=c;2!==s&&(c=0);var d=.8*r.height,h=r.width,f=r.getContext("2d");if(!isNaN(Number(o))){o=[];for(var p=0;p<i.length;p++)o.push(p*h)}o.length!==i.length&&console.warn("Uneven amount of datapoints. "+o.length+" horizontal points found, but "+i.length+" vertical points found."),l=l||"#000000",f.lineWidth=Math.ceil(Math.min(h,d)/120),f.beginPath(),h*=2===s?.86:.93;var g=[];for(p=0;p<i.length;p++)isNaN(Number(i[p]))||""===i[p]||g.push(i[p]);var m=Math.max.apply(Math,g)-Math.min.apply(Math,g),v=Math.max.apply(Math,a()(o))-Math.min.apply(Math,a()(o));m=d/m,v=h/v;var w=Math.min.apply(Math,g),y=Math.min.apply(Math,a()(o));y-=.07*(Math.max.apply(Math,a()(o))-Math.min.apply(Math,a()(o)));var b=Math.floor(.07*r.width/2.6);(f.font=b+"px serif",9===l.length&&(l=l.slice(0,7)),f.fillStyle=l,f.strokeStyle=l,3===s)&&((B=f.createLinearGradient(0,0,0,d)).addColorStop(0,l),B.addColorStop(1,u),f.strokeStyle=B,f.fillStyle=B);if(0===c||void 0===c)var x=1;else x=r.width-.07*r.width;for(p=1;p<11;p++){var M=(Math.max.apply(Math,g)-Math.min.apply(Math,g))*((p-1)/10)+Math.min.apply(Math,g),E=Math.max(0,3-String(Math.round(M)).length);M=Number(M.toFixed(E)),f.fillText(M,x,d*(11-p)/10-5)}M=(Math.max.apply(Math,g)-Math.min.apply(Math,g))*((p-1)/10)+Math.min.apply(Math,g);var k=Math.max(0,3-String(Math.round(M)).length);M=Number(M.toFixed(k)),f.fillText(M,x,27);b=Math.floor(.07*r.width/2.8);function L(e){var t=String(e.getHours());return e.getHours()<10&&(t="0"+t),t+=":",e.getMinutes()<10?t+="0"+e.getMinutes():t+=e.getMinutes(),t+=" "+(e.getMonth()+1)+"/"+e.getDate()+"/"+e.getFullYear()}f.font=b+"px serif",9===l.length&&(l=l.slice(0,7)),window.darkMode?f.fillStyle="#cccccc":f.fillStyle="black";var S=new Date(t[0]),T=new Date(t[t.length-1]),C=new Date((T-S)/2+S.getTime()),I=L(S),N=L(T),F=L(C);f.fillText(I,10,r.height*(11/12)-.06*r.height-12),f.textAlign="end",f.fillText(N,r.width-10,r.height*(11/12)-.06*r.height-12),f.textAlign="center",f.fillText(F,r.width/2,r.height*(11/12)-.06*r.height-12),f.textAlign="start";var B;b=Math.floor(.07*r.width/2.4);(f.font=b+"px serif",f.fillStyle=l,3===s)&&((B=f.createLinearGradient(0,d,200,d)).addColorStop(0,l),B.addColorStop(1,u),f.strokeStyle=B,f.fillStyle=B);if(2===s)0===c||void 0===c?f.fillText("Flow (Cubic Feet/Second)",x+5,r.height*(11/12)):(f.textAlign="right",f.fillText("Gauge Height (Feet)",x-5,r.height*(11/12)),f.textAlign="start");else if(3===s)f.fillText("Water Temperature (°F)",x+5,r.height*(11/12));else if("Precipitation"===e){f.fillText("Precipitation (Inches)",x+5,r.height*(11/12));var H,O=0,A=0;(H=(H=i.slice(-96)).map(Number)).forEach(function(e){O+=e}),(H=H.slice(-48)).forEach(function(e){A+=e}),O=O.toFixed(2),A=A.toFixed(2),f.fillText("Last 24 Hours: "+O+" in",r.width-700,r.height*(11/12)),f.fillText("Last 12 Hours: "+A+" in",r.width-330,r.height*(11/12))}else"cfs"===e?f.fillText("Flow (Cubic Feet/Second)",x+5,r.height*(11/12)):"height"===e?f.fillText("Gauge Height (Feet)",x+5,r.height*(11/12)):f.fillText("Labeling Error...",x+5,r.height*(11/12));3===s&&((B=f.createLinearGradient(0,0,0,.8*r.height)).addColorStop(0,l),B.addColorStop(1,u),f.strokeStyle=B,f.fillStyle=B);function G(e){return Math.round((e-y)*v)}function j(e){return Math.round(d-(e-w)*m)}window.darkMode?f.fillStyle="#cccccc":f.fillStyle="black",f.textAlign="center",f.fillText(n,r.width/2,r.height-10),f.textAlign="start";for(var U=0;U<Math.min(i.length,o.length);U++)if(!isNaN(Number(i[U]))&&""!==i[U]){f.moveTo(G(o[U]),j(i[U]));break}var D=1;for(p=U;p<Math.min(i.length,o.length);p++)isNaN(Number(i[p]))||""===i[p]?D=0:1===D?f.lineTo(G(o[p]),j(i[p])):(f.moveTo(G(o[p]),j(i[p])+10),f.lineTo(G(o[p]),j(i[p])),D=1);f.stroke(),f.beginPath(),f.lineWidth=Math.ceil(f.lineWidth/10),window.darkMode?f.strokeStyle="#ccccccAA":f.strokeStyle="000000AA";for(p=1;p<11;p++)f.moveTo(0,d*(11-p)/10),f.lineTo(r.width,d*(11-p)/10);f.stroke()}},function(e,t){e.exports=function(e){if(Array.isArray(e)){for(var t=0,n=new Array(e.length);t<e.length;t++)n[t]=e[t];return n}}},function(e,t){e.exports=function(e){if(Symbol.iterator in Object(e)||"[object Arguments]"===Object.prototype.toString.call(e))return Array.from(e)}},function(e,t){e.exports=function(){throw new TypeError("Invalid attempt to spread non-iterable instance")}},function(e,t){function n(e){var t=document.createElement("span");return t.className="riverspan",t.innerHTML=e,t}function r(e,t){e.onclick=function(){1===this.value?(NewList(t,"sort",!0),this.value=0):(NewList(t,"sort"),this.value=1)}}e.exports={TopBar:function(){this.create=function(){var e=document.createElement("button");e.id="topbar",e.className="riverbutton";var t=n("River⇅");r(t,"alphabetical"),t.value=1,e.appendChild(t),e.appendChild(n("Section")),r(t=n("Skill⇅"),"skill"),t.value=0,e.appendChild(t),t=n("");var a=document.createElement("span");a.className="emptyStars",a.innerHTML="☆☆☆☆☆",a.style.opacity="0";var o=document.createElement("span");return o.innerHTML="Rating⇅",o.style.position="absolute",o.style.left=0,o.style.bottom=0,t.appendChild(a),t.appendChild(o),r(t,"rating"),t.value=0,e.appendChild(t),r(t=n("Flow/Trend⇅"),"running"),t.value=0,e.appendChild(t),e},this.delete=function(){var e=document.getElementById("topbar");e&&e.parentNode.removeChild(e)}}}},function(e,t,n){var r=n(22).addGraphs;function a(e,t){var n=ItemHolder[t];n.minrun&&n.maxrun&&(window.addEventListener("colorSchemeChanged",function(){e.style.backgroundColor=o(n)}),e.addEventListener("mouseover",function(){e.style.backgroundColor=o(n,{highlighted:!0})}),e.addEventListener("mouseout",function(){e.style.backgroundColor=o(n)})),n.dam&&window.addEventListener("colorSchemeChanged",function(){e.style.backgroundColor=i()}),e.onclick=function(){if(0===n.expanded){n.expanded=1;var t=document.createElement("div");if(t.innerHTML="",n.dam){var a=document.createElement("a");a.target="_blank",a.rel="noopener",a.href=n.dam,a.innerHTML="This river has a dam. View information.",t.appendChild(a),t.appendChild(document.createElement("br")),t.appendChild(document.createElement("br"))}t.innerHTML+=n.writeup+"<br><br>",n.plat&&n.plon&&(t.innerHTML+="Put-In GPS Coordinates: "+n.plat+", "+n.plon+"<br>"),n.tlat&&n.tlon&&(t.innerHTML+="Take-Out GPS Coordinates: "+n.tlat+", "+n.tlon+"<br>");for(var o=["minrun","lowflow","midflow","highflow","maxrun"],i=0;i<o.length;i++){var l=o[i];n[l]&&(t.innerHTML+=l+":"+n[l]+" ")}if(n.aw){t.appendChild(document.createElement("br"));var s=document.createElement("a");s.target="_blank",s.rel="noopener",s.href="https://www.americanwhitewater.org/content/River/detail/id/"+n.aw,s.innerHTML="Click here to view this river on American Whitewater",t.appendChild(s)}if(n.usgs){t.appendChild(document.createElement("br"));var c=document.createElement("a");c.target="_blank",c.rel="noopener",c.href="https://waterdata.usgs.gov/nwis/uv?site_no="+n.usgs,c.innerHTML="View flow information on USGS",t.appendChild(c)}if(self.usgsarray&&n.usgs){var u;try{u=function(e){var t=window.usgsarray[e];if(t){var n;if(t["00060"]?n=t["00060"].values:t["00065"]?n=t["00065"].values:t["00010"]?n=t["00010"].values:t["00045"]&&(n=t["00045"].values),n)for(var r=n.length;r>=0;r--){var a=n[r];if(a)return Date.now()-Number(new Date(a.dateTime))}}return null}(n.usgs)}catch(e){console.error(e),u=null}var d;u>72e5&&((d=document.createElement("p")).innerHTML="Check the dates! This river data is more than "+Math.floor(u/1e3/60/60)+" hours old!",d.className="oldDataWarning",t.appendChild(d));var h=self.usgsarray[n.usgs];if(h){var f=document.createElement("p");f.style.fontWeight="bold",f.style.textAlign="center",f.innerHTML="Disclaimer: USGS Gauge data is provisional, and MIGHT be incorrect. Use at your own risk.",t.appendChild(f),u>72e5?(f.style.marginTop="0.5em",d.style.marginBottom="0.5em"):f.style.marginTop="2em",r(t,h)}}t.style.padding="6px",t.id=n.base+2,e.parentNode.insertBefore(t,e.nextSibling)}else{n.expanded=0;var p=document.getElementById(n.base+2);p&&p.parentNode.removeChild(p)}}}function o(e,t){for(var n,r,a=["minrun","lowflow","midflow","highflow","maxrun"],o=0;o<a.length;o++){var i=e[a[o]];if(i){i=(i=i.split("(computer)").join("")).trim();var l=parseFloat(i),s=i.match(/[^\d|.]+/);if(s&&(s=s[0].trim()),!n&&s)n=s;else if(n!==s){console.warn(a[o]+" on "+e.name+" "+e.section+" has a different extension and has been skipped"),a[o]=void 0;continue}a[o]=l}else a[o]=void 0}"cfs"===n?r=e.cfs:"feet"!==n&&"ft"!==n||(r=e.feet);var c=a[0],u=a[4],d=a[2]||Math.pow(10,(Math.log10(c)+Math.log10(u))/2),h=a[1]||Math.pow(10,(Math.log10(c)+Math.log10(d))/2),f=a[3]||Math.pow(10,(Math.log10(d)+Math.log10(u))/2);if(e.lowflow=parseFloat(h.toFixed(2))+n+" (computer)",e.midflow=parseFloat(d.toFixed(2))+n+" (computer)",e.highflow=parseFloat(f.toFixed(2))+n+" (computer)",r<=a[0])return e.running=0,"hsl(0,100%,"+(t&&t.highlighted?window.darkMode?"28%":"63%":window.darkMode?"23%":"67%")+")";if(r>=a[4])return e.running=4,"hsl(240,100%,"+(t&&t.highlighted?window.darkMode?"30%":"67%":window.darkMode?"20%":"69%")+")";var p=function(e,t,n){return e=Math.log(e),t=Math.log(t),((n=Math.log(n))-e)/(t-e)},g=t&&t.highlighted?window.darkMode?"30%":"65%":window.darkMode?"25%":"70%";return e.running=r<h?p(c,h,r):r<d?1+p(h,d,r):r<f?2+p(d,f,r):3+p(f,u,r),"hsl("+(0+60*e.running)+",100%,"+g+")"}function i(){for(var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:window.darkMode?"rgba(256,256,256,0.2)":"rgba(170,170,170,0.33)",t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"rgba(0,0,0,0)",n="linear-gradient(150deg",r=0;r<19;r++)n+=", ",n+=r%3?t:e;return n+=")"}e.exports.River=function(e,t){Object.assign(this,t),this.tags=this.tags||"",this.rating=parseFloat(this.rating),(this.rating<1||this.rating>5||isNaN(this.rating)||void 0===this.rating)&&(this.rating="Error"),this.skill=this.skill||"?",this.base="b"+e,this.expanded=0,this.index=e,this.create=function(t){if(!this.finished||t){var n=function(e){var t=document.createElement("span");return t.innerHTML=e,t.className="riverspan",r.appendChild(t),t},r=document.createElement("button");if(r.id=this.base+1,n(this.name),n(this.section),n(this.skill),"Error"===this.rating){var l=n("☆☆☆☆☆");l.style.opacity="0.2",l.classList.add("emptyStars")}else{var s=document.createElement("span");s.className="riverspan";var c=document.createElement("span");c.className="emptyStars",c.innerHTML="☆☆☆☆☆",c.style.opacity="0",s.appendChild(c);var u=document.createElement("span");u.className="emptyStars",u.innerHTML="☆☆☆☆☆",u.style.position="absolute",u.style.zIndex="1",s.appendChild(u);var d=document.createElement("span");d.className="fullStars",d.innerHTML="★★★★★",d.style.width=20*this.rating+"%",s.appendChild(d),r.appendChild(s)}if(this.flow)n(this.flow+function(e){var t,n=usgsarray[e];if(n&&(n["00060"]?t=n["00060"].values:n["00065"]&&(t=n["00065"].values),t)){for(var r,a,o=Math.max(t.length-5,0),i=t.length;i>o;i--){var l=t[i];if(l){var s=l.value;r?a=s:r=s}}if(r>a)return"⬆";if(a>r)return"⬇";if(r===a)return"-"}}(this.usgs)+(this.dam?"Dam":""));else this.dam&&n("Dam");r.className="riverbutton",a(r,e),this.finished=r}return this.updateExpansion=function(){var t=ItemHolder[e];t.expanded&&(t.finished.onclick(),t.finished.onclick())},window.addEventListener("colorSchemeChanged",this.updateExpansion),this.dam&&(this.finished.style.background=i()),this.minrun&&this.maxrun&&this.flow?this.finished.style.backgroundColor=o(this):this.dam&&this.finished.classList.add("riverbuttonDam"),this.finished},this.delete=function(){var t=ItemHolder[e];function n(e){var n=document.getElementById(t.base+e);n&&n.parentNode.removeChild(n)}var r=document.getElementById(t.base+1);r&&(r.style.backgroundColor=""),n(2),n(1)}}},function(e,t){function n(){var e=document.createElement("canvas");e.width=1200,e.height=800;var t=e.getContext("2d");return window.darkMode?t.fillStyle="black":t.fillStyle="white",t.fillRect(0,0,e.width,e.height),e}function r(e){for(var t=[],n=[],r=0;r<e.length;r++){var a=e[r];t.push(a.value),n.push(a.dateTime)}return{values:t,timestamps:n}}e.exports.addGraphs=function(e,t){var a=t["00010"],o=t["00045"],i=t["00060"],l=t["00065"];try{!function(e,t,a,o){if(t||a){var i=n();if(t&&a){var l=r(t.values);addLine("cfs",l.timestamps,o.name,i,0,l.values,"#00AAFFa0",2),l=r(a.values),addLine("height",l.timestamps,o.name,i,0,l.values,"#2222FFa0",2,1)}else if(t){var s=r(t.values);addLine("cfs",s.timestamps,o.name,i,0,s.values,"#00AAFF")}else{var c=r(a.values);addLine("height",c.timestamps,o.name,i,0,c.values,"#2222FF")}var u=document.createElement("img");u.className="graph",u.src=i.toDataURL("image/png"),e.appendChild(u)}}(e,i,l,t)}catch(e){console.warn("Error creating flow graph: "+e)}try{!function(e,t,a){if(t){var o=n(),i=r(t.values);addLine("",i.timestamps,a.name,o,0,i.values,"#FF0000",3,"#0000FF");var l=document.createElement("img");l.className="graph",l.src=o.toDataURL("image/png"),e.appendChild(l)}}(e,a,t)}catch(e){console.warn("Error creating temperature graph: "+e)}try{!function(e,t,a){if(t){var o=n(),i=r(t.values);addLine("Precipitation",i.timestamps,a.name,o,0,i.values,"#0066FF");var l=document.createElement("img");l.className="graph",l.src=o.toDataURL("image/png"),e.appendChild(l)}}(e,o,t)}catch(e){console.warn("Error creating precipitation graph: "+e)}}},function(e,t,n){var r=n(8);function a(e){var t=e.content,n=e.query;if(e.matchCase||(t=t.toLowerCase(),n=n.toLowerCase()),"contains"===e.type)return t.includes(n);if("matches"===e.type)return t===n;throw"Unknown Search Type "+e.type}function o(e,t,n){for(var r in e){n.content=e[r][t],a(n)||delete e[r]}return e}function i(e){var t;switch(e){case"FW":t=1;break;case"B":t=2;break;case"N":t=3;break;case"LI":t=4;break;case"I":t=5;break;case"HI":t=6;break;case"A":t=7;break;case"E":t=8}return t}function l(e,t){var n=t.query,r=t.type,a=Math.min(n[0],n[1]),o=Math.max(n[0],n[1]);if("from"!==r)throw"Unknown search type"+r;for(var l in e){var s=!1,c=i(e[l].skill);a<=c&&c<=o&&(s=!0),s||delete e[l]}return e}function s(e,t){return console.error("Rating based filtering is not yet implemented"),e}var c=n(24).lambert;function u(e,t){var n=t.distance,r=t.lat,a=t.lon;for(var o in e){var i=e[o],l=i.plat||i.tlat||i.hidlat,s=i.plon||i.tlon||i.hidlon,u=void 0;if(l&&s)u=c(r,a,l,s)<n;else u=t.includeUnknown;u||delete e[o]}return e}function d(e,t){var n=t.query,r=n[0],a=n[1];for(var o in console.log(t),e){var i=e[o];void 0===i.running?t.includeUnknown||delete e[o]:(i.running<r||i.running>a)&&delete e[o]}return e}function h(e,t){t.query;var n=t.query.split(" ").join("").split(",");for(var r in e)for(var a=e[r],o=0;o<n.length;o++)"string"==typeof a.tags&&a.tags.toLowerCase().includes(n[o].toLowerCase())||delete e[r];return e}e.exports={normalSearch:function(e,t){var n=[[],[],[],[],[]];function r(e,t){return e.name>t.name?1:e.name<t.name?-1:0}return e.forEach(function(e){-1!==e.tags.toLowerCase().indexOf(t)?-1!==e.name.toLowerCase().indexOf(t)?n[0].push(e):n[1].push(e):-1!==e.name.toLowerCase().indexOf(t)?e.name.toLowerCase().startsWith(t)?n[0].push(e):n[2].push(e):-1!==e.section.toLowerCase().indexOf(t)?n[3].push(e):-1!==e.writeup.toLowerCase().indexOf(t)&&n[4].push(e)}),console.log(n),n[0]=n[0].sort(r),n[1]=n[1].sort(r),n[2]=n[2].sort(r),n[3]=n[3].sort(r),n[4]=n[4].sort(r),console.log(n),e=n[0].concat(n[1],n[2],n[3],n[4])},advancedSearch:function(e,t){console.log(t);var n=!1;for(var a in t){var i=t[a];["name","section","writeup"].includes(a)?e=o(e,a,i):"skill"===a?e=l(e,i):"rating"===a?e=s(e):"location"===a?e=u(e,i):"flow"===a?e=d(e,i):"tags"===a?e=h(e,i):"sort"===a?(e=e.filter(function(e){return void 0!==e}),e=r.sort(i.query,e,i.reverse),n=!0):alert("Unable to search based on "+a)}return e=e.filter(function(e){return void 0!==e}),n||(e=r.sort("alphabetical",e)),e}};var f=document.getElementById("advanced-search-modal");document.getElementById("advanced-search-modal-close").onclick=function(){f.style.display="none"};window.addEventListener("click",function(e){e.target===f&&(f.style.display="none")}),document.getElementById("advancedsearch").addEventListener("click",function(){f.style.display="block"})},function(e,t){e.exports={lambert:function(e,t,n,r){e=e/180*Math.PI,t=t/180*Math.PI,n=n/180*Math.PI,r=r/180*Math.PI;var a=Math.atan(.9966471893352525*Math.tan(e)),o=Math.atan(.9966471893352525*Math.tan(n)),i=Math.acos(Math.sin(a)*Math.sin(o)+Math.cos(a)*Math.cos(o)*Math.cos(r-t)),l=(a+o)/2,s=(o-a)/2;return 3963.1905919430524*(i-.0016764053323737402*((i-Math.sin(i))*(Math.pow(Math.sin(l),2)*Math.pow(Math.cos(s),2)/Math.pow(Math.cos(i/2),2))+(i+Math.sin(i))*(Math.pow(Math.cos(l),2)*Math.pow(Math.sin(s),2)/Math.pow(Math.sin(i/2),2))))}}},function(e,t){function n(){try{var e=document.getElementById("legend");e.getContext("2d").clearRect(0,0,e.width,e.height);var t=parseFloat(window.getComputedStyle(document.getElementById("Rivers").firstChild).getPropertyValue("font-size"));(function(e,t){var n=e.getContext("2d"),r=window.darkMode?"23%":"67%",a=window.darkMode?"20%":"69%",o=window.darkMode?"25%":"70%";e.width=document.documentElement.clientWidth,e.height=t;var i=n.createLinearGradient(0,0,e.width,e.height),l="hsl(0,100%,"+r+")",s="hsl(240,100%,"+a+")";i.addColorStop(0,l),i.addColorStop(.08,l);for(var c=0;c<=240;c++)i.addColorStop(.08+c/240*(.92-.08),"hsl("+c+",100%,"+o+")");i.addColorStop(.92,s),i.addColorStop(1,s),n.fillStyle=i,n.fillRect(0,0,e.width,e.height)})(e,t>18?10+2*t:t>14.8?10+2*(t*=1.2):10+2*(t*=1.4)),function(e,t){var n=e.getContext("2d");n.fillStyle=window.darkMode?"white":"black";var r=t;n.font=t+"px Arial",n.textAlign="start",n.fillText("Too Low",0,r),n.textAlign="center",n.fillText("Low Flow",.28*e.width,r),n.fillText("Mid Flow",e.width/2,r),n.fillText("High Flow",.72*e.width,r),window.darkMode||(n.fillStyle="white"),n.textAlign="end",n.fillText("Too High",e.width,r,.2*e.width)}(e,t),function(e){e.style.zIndex=2;var t=e.offsetTop;window.addEventListener("scroll",function(){window.pageYOffset>t?(e.style.position="fixed",e.style.top=0,document.body.style.paddingTop=e.height+"px"):(e.style.position="",e.style.top="",document.body.style.paddingTop=0)})}(e)}catch(e){console.error("Legend failed to draw. Logging error."),console.error(e)}}window.addEventListener("resize",n),window.addEventListener("orientationchange",n),window.addEventListener("colorSchemeChanged",n),n()}]);
//# sourceMappingURL=index.js.map