if (navigator.onLine) {
caches.delete('USGS')
//This will race other code... And a cache should delete way before the JavaScript execution AND network request finish.
}

function GetId(Id) {
    return document.getElementById(Id)
}
function ReloadAllCache() {
    localStorage.setItem("TimeStamp", Date.now())
    
    caches.delete('rivers.run').then(function(event) {
    window.location.reload(true)
    })
    .catch(function(event) {
    window.location.reload(true)
    })
}
function UpdateTime () {
try {
if (localStorage.getItem("TimeStamp") !== null && Date.now()-localStorage.getItem("TimeStamp") > 600000) {
var Minutes = Math.floor(Math.floor((Date.now() - localStorage.getItem("TimeStamp"))/1000)/60)
var Hours = Math.floor(Minutes/60)
Minutes = Minutes%60 
var Days = Math.floor(Hours/24)
Hours = Hours%24
var TimeStr = ""
if (Days !== 0) {
    if (Days === 1) {
        TimeStr = TimeStr + Days + " day "
    }
    else {
        TimeStr = TimeStr + Days + " days "
    }
}
if (Hours !== 0) {
    if (Hours === 1) {
        TimeStr = TimeStr + Hours + " hour "
    }
    else {
        TimeStr = TimeStr + Hours + " hours "
    }
}
if (Minutes !== 0) {
    if (Minutes === 1) {
        TimeStr = TimeStr + Minutes + " minute "
    }
    else {
        TimeStr = TimeStr + Minutes + " minutes "
    }
}
GetId("ReloadAllText").innerHTML = "You're viewing a cached version of this site from " + TimeStr + " ago."    
}
}
catch (e) {
    console.warn(e)
}
}
try {
if (localStorage.getItem("TimeStamp") !== null && Date.now()-localStorage.getItem("TimeStamp") > 600000) {
    UpdateTime()
    setInterval(UpdateTime, 60000)
    GetId("ReloadAll").hidden= ""
    if (navigator.onLine) {
    GetId("ReloadAllButton").style = "display: inline"
    }
    window.addEventListener("offline", function() {GetId("ReloadAllButton").style = "display: none"})
    window.addEventListener("offline", function() {GetId("ReloadAllButton").style = "display: inline"})
    GetId("ReloadAllButton").addEventListener("click", ReloadAllCache)
    GetId("ReloadAllButton").value = "Update Now"
    UpdateTime()
}
else {
    if (localStorage.getItem("TimeStamp") === null) {
    localStorage.setItem("TimeStamp", Date.now())
    }
}
}
catch (e) {
    console.warn(e)
}


window.addEventListener("resize", function() {setTimeout(RotateHandler, 100)})
window.addEventListener("resize", function() {setTimeout(SortListGen, 100)})
                        
function RotateHandler() {
//Embedded Frames
//Divided by 1.2 prevents the frame from taking up the whole screen and blocking the user from scrolling off of it.
document.documentElement.style.setProperty('--screenheight', (Math.floor(window.innerHeight/1.15)) + "px");
    
//750, 0.55, 0.5, 2.5, 2.4, 2.67 are arbitrary and picked by me
var ScreenWidth = 750/window.innerWidth
if (ScreenWidth < 1) {
    ScreenWidth = ScreenWidth ** 0.55
}
else {
    if (ScreenWidth < 2.5) {
    ScreenWidth = ScreenWidth ** 0.5
    }
    else {
    ScreenWidth = Math.max(ScreenWidth**0.5, 2.67**0.5)
    }
}
ScreenWidth = (2.4 * ScreenWidth) + "vw"
document.documentElement.style.setProperty('--textsize', ScreenWidth);
//Set the textsize (relative) to a higher amount on smaller devices, and a lower amount on bigger devices.
    
}


try {
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('https://rivers.run/serviceworker.js')
  .then(function(registration) {
  })
  .catch(function(error) {
  });
}
}
catch (e) {
    console.warn(e)
    //This should only occour if the page is embedded and sandboxed.
}



//Graph Code
var $jscomp=$jscomp||{};$jscomp.scope={};$jscomp.ASSUME_ES5=!1;$jscomp.ASSUME_NO_NATIVE_MAP=!1;$jscomp.ASSUME_NO_NATIVE_SET=!1;$jscomp.defineProperty=$jscomp.ASSUME_ES5||"function"==typeof Object.defineProperties?Object.defineProperty:function(a,b,d){a!=Array.prototype&&a!=Object.prototype&&(a[b]=d.value)};$jscomp.getGlobal=function(a){return"undefined"!=typeof window&&window===a?a:"undefined"!=typeof global&&null!=global?global:a};$jscomp.global=$jscomp.getGlobal(this);$jscomp.SYMBOL_PREFIX="jscomp_symbol_";
$jscomp.initSymbol=function(){$jscomp.initSymbol=function(){};$jscomp.global.Symbol||($jscomp.global.Symbol=$jscomp.Symbol)};$jscomp.Symbol=function(){var a=0;return function(b){return $jscomp.SYMBOL_PREFIX+(b||"")+a++}}();
$jscomp.initSymbolIterator=function(){$jscomp.initSymbol();var a=$jscomp.global.Symbol.iterator;a||(a=$jscomp.global.Symbol.iterator=$jscomp.global.Symbol("iterator"));"function"!=typeof Array.prototype[a]&&$jscomp.defineProperty(Array.prototype,a,{configurable:!0,writable:!0,value:function(){return $jscomp.arrayIterator(this)}});$jscomp.initSymbolIterator=function(){}};
$jscomp.initSymbolAsyncIterator=function(){$jscomp.initSymbol();var a=$jscomp.global.Symbol.asyncIterator;a||(a=$jscomp.global.Symbol.asyncIterator=$jscomp.global.Symbol("asyncIterator"));$jscomp.initSymbolAsyncIterator=function(){}};$jscomp.arrayIterator=function(a){var b=0;return $jscomp.iteratorPrototype(function(){return b<a.length?{done:!1,value:a[b++]}:{done:!0}})};
$jscomp.iteratorPrototype=function(a){$jscomp.initSymbolIterator();a={next:a};a[$jscomp.global.Symbol.iterator]=function(){return this};return a};$jscomp.makeIterator=function(a){$jscomp.initSymbolIterator();$jscomp.initSymbol();$jscomp.initSymbolIterator();var b=a[Symbol.iterator];return b?b.call(a):$jscomp.arrayIterator(a)};
$jscomp.polyfill=function(a,b,d,c){if(b){d=$jscomp.global;a=a.split(".");for(c=0;c<a.length-1;c++){var e=a[c];e in d||(d[e]={});d=d[e]}a=a[a.length-1];c=d[a];b=b(c);b!=c&&null!=b&&$jscomp.defineProperty(d,a,{configurable:!0,writable:!0,value:b})}};$jscomp.FORCE_POLYFILL_PROMISE=!1;
$jscomp.polyfill("Promise",function(a){function b(){this.batch_=null}function d(a){return a instanceof e?a:new e(function(b,c){b(a)})}if(a&&!$jscomp.FORCE_POLYFILL_PROMISE)return a;b.prototype.asyncExecute=function(a){null==this.batch_&&(this.batch_=[],this.asyncExecuteBatch_());this.batch_.push(a);return this};b.prototype.asyncExecuteBatch_=function(){var a=this;this.asyncExecuteFunction(function(){a.executeBatch_()})};var c=$jscomp.global.setTimeout;b.prototype.asyncExecuteFunction=function(a){c(a,
0)};b.prototype.executeBatch_=function(){for(;this.batch_&&this.batch_.length;){var a=this.batch_;this.batch_=[];for(var b=0;b<a.length;++b){var c=a[b];a[b]=null;try{c()}catch(q){this.asyncThrow_(q)}}}this.batch_=null};b.prototype.asyncThrow_=function(a){this.asyncExecuteFunction(function(){throw a;})};var e=function(a){this.state_=0;this.result_=void 0;this.onSettledCallbacks_=[];var b=this.createResolveAndReject_();try{a(b.resolve,b.reject)}catch(k){b.reject(k)}};e.prototype.createResolveAndReject_=
function(){function a(a){return function(d){c||(c=!0,a.call(b,d))}}var b=this,c=!1;return{resolve:a(this.resolveTo_),reject:a(this.reject_)}};e.prototype.resolveTo_=function(a){if(a===this)this.reject_(new TypeError("A Promise cannot resolve to itself"));else if(a instanceof e)this.settleSameAsPromise_(a);else{a:switch(typeof a){case "object":var b=null!=a;break a;case "function":b=!0;break a;default:b=!1}b?this.resolveToNonPromiseObj_(a):this.fulfill_(a)}};e.prototype.resolveToNonPromiseObj_=function(a){var b=
void 0;try{b=a.then}catch(k){this.reject_(k);return}"function"==typeof b?this.settleSameAsThenable_(b,a):this.fulfill_(a)};e.prototype.reject_=function(a){this.settle_(2,a)};e.prototype.fulfill_=function(a){this.settle_(1,a)};e.prototype.settle_=function(a,b){if(0!=this.state_)throw Error("Cannot settle("+a+", "+b+"): Promise already settled in state"+this.state_);this.state_=a;this.result_=b;this.executeOnSettledCallbacks_()};e.prototype.executeOnSettledCallbacks_=function(){if(null!=this.onSettledCallbacks_){for(var a=
0;a<this.onSettledCallbacks_.length;++a)g.asyncExecute(this.onSettledCallbacks_[a]);this.onSettledCallbacks_=null}};var g=new b;e.prototype.settleSameAsPromise_=function(a){var b=this.createResolveAndReject_();a.callWhenSettled_(b.resolve,b.reject)};e.prototype.settleSameAsThenable_=function(a,b){var c=this.createResolveAndReject_();try{a.call(b,c.resolve,c.reject)}catch(q){c.reject(q)}};e.prototype.then=function(a,b){function c(a,b){return"function"==typeof a?function(b){try{d(a(b))}catch(f){g(f)}}:
b}var d,g,l=new e(function(a,b){d=a;g=b});this.callWhenSettled_(c(a,d),c(b,g));return l};e.prototype["catch"]=function(a){return this.then(void 0,a)};e.prototype.callWhenSettled_=function(a,b){function c(){switch(d.state_){case 1:a(d.result_);break;case 2:b(d.result_);break;default:throw Error("Unexpected state: "+d.state_);}}var d=this;null==this.onSettledCallbacks_?g.asyncExecute(c):this.onSettledCallbacks_.push(c)};e.resolve=d;e.reject=function(a){return new e(function(b,c){c(a)})};e.race=function(a){return new e(function(b,
c){for(var e=$jscomp.makeIterator(a),k=e.next();!k.done;k=e.next())d(k.value).callWhenSettled_(b,c)})};e.all=function(a){var b=$jscomp.makeIterator(a),c=b.next();return c.done?d([]):new e(function(a,e){function k(b){return function(c){g[b]=c;l--;0==l&&a(g)}}var g=[],l=0;do g.push(void 0),l++,d(c.value).callWhenSettled_(k(g.length-1),e),c=b.next();while(!c.done)})};return e},"es6","es3");
$jscomp.polyfill("Promise.prototype.finally",function(a){return a?a:function(a){return this.then(function(b){return Promise.resolve(a()).then(function(){return b})},function(b){return Promise.resolve(a()).then(function(){throw b;})})}},"es9","es3");$jscomp.underscoreProtoCanBeSet=function(){var a={a:!0},b={};try{return b.__proto__=a,b.a}catch(d){}return!1};
$jscomp.setPrototypeOf="function"==typeof Object.setPrototypeOf?Object.setPrototypeOf:$jscomp.underscoreProtoCanBeSet()?function(a,b){a.__proto__=b;if(a.__proto__!==b)throw new TypeError(a+" is not extensible");return a}:null;$jscomp.generator={};$jscomp.generator.ensureIteratorResultIsObject_=function(a){if(!(a instanceof Object))throw new TypeError("Iterator result "+a+" is not an object");};
$jscomp.generator.Context=function(){this.isRunning_=!1;this.yieldAllIterator_=null;this.yieldResult=void 0;this.nextAddress=1;this.finallyAddress_=this.catchAddress_=0;this.finallyContexts_=this.abruptCompletion_=null};$jscomp.generator.Context.prototype.start_=function(){if(this.isRunning_)throw new TypeError("Generator is already running");this.isRunning_=!0};$jscomp.generator.Context.prototype.stop_=function(){this.isRunning_=!1};
$jscomp.generator.Context.prototype.jumpToErrorHandler_=function(){this.nextAddress=this.catchAddress_||this.finallyAddress_};$jscomp.generator.Context.prototype.next_=function(a){this.yieldResult=a};$jscomp.generator.Context.prototype.throw_=function(a){this.abruptCompletion_={exception:a,isException:!0};this.jumpToErrorHandler_()};$jscomp.generator.Context.prototype["return"]=function(a){this.abruptCompletion_={"return":a};this.nextAddress=this.finallyAddress_};
$jscomp.generator.Context.prototype.jumpThroughFinallyBlocks=function(a){this.abruptCompletion_={jumpTo:a};this.nextAddress=this.finallyAddress_};$jscomp.generator.Context.prototype.yield=function(a,b){this.nextAddress=b;return{value:a}};$jscomp.generator.Context.prototype.yieldAll=function(a,b){var d=$jscomp.makeIterator(a),c=d.next();$jscomp.generator.ensureIteratorResultIsObject_(c);if(c.done)this.yieldResult=c.value,this.nextAddress=b;else return this.yieldAllIterator_=d,this.yield(c.value,b)};
$jscomp.generator.Context.prototype.jumpTo=function(a){this.nextAddress=a};$jscomp.generator.Context.prototype.jumpToEnd=function(){this.nextAddress=0};$jscomp.generator.Context.prototype.setCatchFinallyBlocks=function(a,b){this.catchAddress_=a;void 0!=b&&(this.finallyAddress_=b)};$jscomp.generator.Context.prototype.setFinallyBlock=function(a){this.catchAddress_=0;this.finallyAddress_=a||0};$jscomp.generator.Context.prototype.leaveTryBlock=function(a,b){this.nextAddress=a;this.catchAddress_=b||0};
$jscomp.generator.Context.prototype.enterCatchBlock=function(a){this.catchAddress_=a||0;a=this.abruptCompletion_.exception;this.abruptCompletion_=null;return a};$jscomp.generator.Context.prototype.enterFinallyBlock=function(a,b,d){d?this.finallyContexts_[d]=this.abruptCompletion_:this.finallyContexts_=[this.abruptCompletion_];this.catchAddress_=a||0;this.finallyAddress_=b||0};
$jscomp.generator.Context.prototype.leaveFinallyBlock=function(a,b){var d=this.finallyContexts_.splice(b||0)[0];if(d=this.abruptCompletion_=this.abruptCompletion_||d){if(d.isException)return this.jumpToErrorHandler_();void 0!=d.jumpTo&&this.finallyAddress_<d.jumpTo?(this.nextAddress=d.jumpTo,this.abruptCompletion_=null):this.nextAddress=this.finallyAddress_}else this.nextAddress=a};$jscomp.generator.Context.prototype.forIn=function(a){return new $jscomp.generator.Context.PropertyIterator(a)};
$jscomp.generator.Context.PropertyIterator=function(a){this.object_=a;this.properties_=[];for(var b in a)this.properties_.push(b);this.properties_.reverse()};$jscomp.generator.Context.PropertyIterator.prototype.getNext=function(){for(;0<this.properties_.length;){var a=this.properties_.pop();if(a in this.object_)return a}return null};$jscomp.generator.Engine_=function(a){this.context_=new $jscomp.generator.Context;this.program_=a};
$jscomp.generator.Engine_.prototype.next_=function(a){this.context_.start_();if(this.context_.yieldAllIterator_)return this.yieldAllStep_(this.context_.yieldAllIterator_.next,a,this.context_.next_);this.context_.next_(a);return this.nextStep_()};
$jscomp.generator.Engine_.prototype.return_=function(a){this.context_.start_();var b=this.context_.yieldAllIterator_;if(b)return this.yieldAllStep_("return"in b?b["return"]:function(a){return{value:a,done:!0}},a,this.context_["return"]);this.context_["return"](a);return this.nextStep_()};
$jscomp.generator.Engine_.prototype.throw_=function(a){this.context_.start_();if(this.context_.yieldAllIterator_)return this.yieldAllStep_(this.context_.yieldAllIterator_["throw"],a,this.context_.next_);this.context_.throw_(a);return this.nextStep_()};
$jscomp.generator.Engine_.prototype.yieldAllStep_=function(a,b,d){try{var c=a.call(this.context_.yieldAllIterator_,b);$jscomp.generator.ensureIteratorResultIsObject_(c);if(!c.done)return this.context_.stop_(),c;var e=c.value}catch(g){return this.context_.yieldAllIterator_=null,this.context_.throw_(g),this.nextStep_()}this.context_.yieldAllIterator_=null;d.call(this.context_,e);return this.nextStep_()};
$jscomp.generator.Engine_.prototype.nextStep_=function(){for(;this.context_.nextAddress;)try{var a=this.program_(this.context_);if(a)return this.context_.stop_(),{value:a.value,done:!1}}catch(b){this.context_.yieldResult=void 0,this.context_.throw_(b)}this.context_.stop_();if(this.context_.abruptCompletion_){a=this.context_.abruptCompletion_;this.context_.abruptCompletion_=null;if(a.isException)throw a.exception;return{value:a["return"],done:!0}}return{value:void 0,done:!0}};
$jscomp.generator.Generator_=function(a){this.next=function(b){return a.next_(b)};this["throw"]=function(b){return a.throw_(b)};this["return"]=function(b){return a.return_(b)};$jscomp.initSymbolIterator();$jscomp.initSymbol();$jscomp.initSymbolIterator();this[Symbol.iterator]=function(){return this}};$jscomp.generator.createGenerator=function(a,b){var d=new $jscomp.generator.Generator_(new $jscomp.generator.Engine_(b));$jscomp.setPrototypeOf&&$jscomp.setPrototypeOf(d,a.prototype);return d};
$jscomp.asyncExecutePromiseGenerator=function(a){function b(b){return a.next(b)}function d(b){return a["throw"](b)}return new Promise(function(c,e){function g(a){a.done?c(a.value):Promise.resolve(a.value).then(b,d).then(g,e)}g(a.next())})};$jscomp.asyncExecutePromiseGeneratorFunction=function(a){return $jscomp.asyncExecutePromiseGenerator(a())};$jscomp.asyncExecutePromiseGeneratorProgram=function(a){return $jscomp.asyncExecutePromiseGenerator(new $jscomp.generator.Generator_(new $jscomp.generator.Engine_(a)))};
$jscomp.arrayFromIterator=function(a){for(var b,d=[];!(b=a.next()).done;)d.push(b.value);return d};$jscomp.arrayFromIterable=function(a){return a instanceof Array?a:$jscomp.arrayFromIterator($jscomp.makeIterator(a))};
function CreateURL(a){"number"===typeof a&&console.warn("A number ("+a+") was passed where a string is needed. If the number contained leading zeros that CreateURL is unable to replace, you may get an error.");a=String(a);if(8>a.length){var b=a;a="0".repeat(8-a.length)+a;console.warn("Changed "+b+" to "+a+". It is reccomended to pass strings instead of integers so that modification is not required.")}var d=new Date(Date.now());b=d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();d=new Date(Date.now()-
864E5);d=d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();return"https://waterdata.usgs.gov/nwis/uv?cb_00045=on&cb_00010=on&cb_00045=on&cb_00060=on&cb_00065=on&format=rdb&site_no="+a+"&period=&begin_date="+d+"&end_date="+b}function LoadStringData(a){var b;return $jscomp.asyncExecutePromiseGeneratorProgram(function(d){if(1==d.nextAddress)return d.yield(fetch(a),2);if(3!=d.nextAddress)return b=d.yieldResult,d.yield(b.text(),3);b=d.yieldResult;return d["return"](b)})}
function TrimTopStuff(a){for(a=a.split("\n");"#"===a[0][0];)a.shift();return a}function Expand(a){return a.map(function(a){return a.split("\t")})}function TrimExtraData1(a){return a.map(function(a){a.splice(0,2);return a})}function TrimExtraData2(a){return a.map(function(a){for(var b=3;b<a.length;b+=1)a.splice(b,1);return a})}function CheckTimeZone(a){var b=a[2][1];a=a.splice(2,Array.length-3);a.map(function(a){if(a[1]!==b)throw"Time zones "+b+" and "+a[1]+" do not match!";});return b}
function RemoveTimeZone(a){return a.map(function(a){a.splice(1,1);return a})}
function Objectify(a,b,d){var c={};c.Source=b;c.Timezone=d;c.timeframe=a.map(function(a){return a[0]});c.timeframe.splice(0,2);c.timeframe.pop();a.pop();for(b=0;b<a[0].length;b++)if(-1!==a[0][b].indexOf("00060")){var e=b;break}for(b=0;b<a[0].length;b++)if(-1!==a[0][b].indexOf("00065")){var g=b;break}for(b=0;b<a[0].length;b++)if(-1!==a[0][b].indexOf("00045")){var l=b;break}for(b=0;b<a[0].length;b++)if(-1!==a[0][b].indexOf("00010")){var p=b;break}void 0!==e&&(c.cfs=a.map(function(a){return a[e]}),c.cfs.splice(0,
2));void 0!==g&&(c.height=a.map(function(a){return a[g]}),c.height.splice(0,2));void 0!==l&&(c.precip=a.map(function(a){return a[l]}),c.precip.splice(0,2));void 0!==p&&(c.temp=a.map(function(a){return"NaN"!==String(Number(a[p]))&&""!==a[p]?a[p]:NaN}),c.temp.splice(0,2));return c}
function FetchData(a){var b,d,c,e;return $jscomp.asyncExecutePromiseGeneratorProgram(function(g){if(1==g.nextAddress)return g.yield(LoadStringData(CreateURL(a)),2);b=g.yieldResult;d=b.split("\n")[16].slice(1).trim();c=TrimExtraData2(TrimExtraData1(Expand(TrimTopStuff(b))));e=CheckTimeZone(c);return g["return"](Objectify(RemoveTimeZone(c),d,e))})}
function AddLine(a,b,d,c,e,g,l,p,k){function q(a){return Math.round((a-B)*z)}function t(a){return Math.round(r-(a-C)*A)}if(3===p)var u=k;2!==p&&(k=0);var r=.8*c.height,m=c.width,h=c.getContext("2d");if(!isNaN(Number(e))){e=[];for(var f=0;f<g.length;f++)e.push(f*m)}e.length!==g.length&&console.warn("Uneven amount of datapoints. "+e.length+" horizontal points found, but "+g.length+" vertical points found.");void 0===l&&(l="#000000");h.strokeStyle=l;h.lineWidth=Math.ceil(Math.min(m,r)/120);h.beginPath();
m=2===p?.86*m:.93*m;var n=[];for(f=0;f<g.length;f++)"NaN"!==String(Number(g[f]))&&""!==g[f]?n.push(g[f]):console.warn("Element "+f+" in list is an invalid number. It had a value of: "+g[f]);var A=Math.max.apply(Math,$jscomp.arrayFromIterable(n))-Math.min.apply(Math,$jscomp.arrayFromIterable(n)),z=Math.max.apply(Math,$jscomp.arrayFromIterable(e))-Math.min.apply(Math,$jscomp.arrayFromIterable(e));A=r/A;z=m/z;var C=Math.min.apply(Math,$jscomp.arrayFromIterable(n)),B=Math.min.apply(Math,$jscomp.arrayFromIterable(e));
B-=.07*(Math.max.apply(Math,$jscomp.arrayFromIterable(e))-Math.min.apply(Math,$jscomp.arrayFromIterable(e)));f=Math.floor(.07*c.width/2.6);h.font=f+"px serif";9===l.length&&(l=l.slice(0,7));h.fillStyle=l;3===p&&(f=h.createLinearGradient(0,0,0,r),f.addColorStop(0,l),f.addColorStop(1,u),h.strokeStyle=f,h.fillStyle=f);start=0===k||void 0===k?1:c.width-.07*c.width;for(f=1;11>f;f++)m=(Math.max.apply(Math,$jscomp.arrayFromIterable(n))-Math.min.apply(Math,$jscomp.arrayFromIterable(n)))*((f-1)/10)+Math.min.apply(Math,
$jscomp.arrayFromIterable(n)),1E3<=m?m=Math.round(m):(m=m.toFixed(3-String(Math.round(m)).length),Number(m)===Math.round(m)&&(m=Math.round(m))),h.fillText(m,start,r*(11-f)/10-5);f=Math.floor(.07*c.width/2.8);h.font=f+"px serif";9===l.length&&(l=l.slice(0,7));h.fillStyle="black";n=new Date(b[0]);b=new Date(b[b.length-1]);f=new Date((b-n)/2+n.getTime());m=n.getHours();var v=b.getHours(),w=f.getHours();2>String(n.getHours()).length&&(m+="0");m+=":"+n.getMinutes();2>String(n.getMinutes()).length&&(m+=
"0");m+=" "+(n.getMonth()+1)+"/"+n.getDate()+"/"+n.getFullYear();2>String(b.getHours()).length&&(v+="0");v+=":"+b.getMinutes();2>String(b.getMinutes()).length&&(v+="0");v+=" "+(b.getMonth()+1)+"/"+b.getDate()+"/"+b.getFullYear();2>String(f.getHours()).length&&(w+="0");w+=":"+f.getMinutes();2>String(f.getMinutes()).length&&(w+="0");w+=" "+(f.getMonth()+1)+"/"+f.getDate()+"/"+f.getFullYear();h.fillText(m+" ("+a+")",10,11/12*c.height-.06*c.height-12);h.fillText(v+" ("+a+")",c.width-275,11/12*c.height-
.06*c.height-12);h.textAlign="center";h.fillText(w+" ("+a+")",c.width/2,11/12*c.height-.06*c.height-12);h.textAlign="start";f=Math.floor(.07*c.width/2.4);h.font=f+"px serif";h.fillStyle=l;3===p&&(f=h.createLinearGradient(0,r,200,r),f.addColorStop(0,l),f.addColorStop(1,u),h.strokeStyle=f,h.fillStyle=f);if(2===p)0===k||void 0===k?h.fillText("Flow (Cubic Feet/Second)",start+5,11/12*c.height):h.fillText("Gage Height (Feet)",start-195,11/12*c.height);else if(3===p)h.fillText("Tempreture (\u00b0F)",start+
5,11/12*c.height);else{h.fillText("Precipitation (Inches)",start+5,11/12*c.height);var x=0,y=0;a=g.slice(-96);a=a.map(Number);a.forEach(function(a){x+=a});a=a.slice(-48);a.forEach(function(a){y+=a});x=x.toFixed(2);y=y.toFixed(2);h.fillText("Last 24 Hours: "+x+" in",c.width-700,11/12*c.height);h.fillText("Last 12 Hours: "+y+" in",c.width-330,11/12*c.height)}3===p&&(f=h.createLinearGradient(0,0,0,c.height),f.addColorStop(0,l),f.addColorStop(1,u),h.strokeStyle=f,h.fillStyle=f);h.fillStyle="black";h.textAlign=
"center";h.fillText("Gage: "+d,c.width/2,c.height-10);h.textAlign="start";for(l=0;l<Math.min(g.length,e.length);l++)if("NaN"!==String(Number(g[l]))&&""!==g[l]){h.moveTo(q(e[l]),t(g[l]));break}d=1;for(f=l;f<Math.min(g.length,e.length);f++)"NaN"!==String(Number(g[f]))&&""!==g[f]?1===d?h.lineTo(q(e[f]),t(g[f])):(h.moveTo(q(e[f]),t(g[f])+10),h.lineTo(q(e[f]),t(g[f])),d=1):d=0;h.stroke();h.beginPath();h.lineWidth=Math.ceil(h.lineWidth/10);h.strokeStyle="#000000AA";for(f=1;11>f;f++)h.moveTo(0,r*(11-f)/
10),h.lineTo(c.width,r*(11-f)/10);h.stroke()}
function LoadAndRender(a,b,d,c,e,g,l,p){var k,q,t,u;return $jscomp.asyncExecutePromiseGeneratorProgram(function(r){if(1==r.nextAddress)return r.yield(FetchData(a),2);k=r.yieldResult;b.innerHTML=k.cfs[k.cfs.length-1]+" cfs, "+k.height[k.height.length-1]+" feet";AddLine(k.Timezone,k.timeframe,k.Source,d,0,k.cfs,g,2);AddLine(k.Timezone,k.timeframe,k.Source,d,0,k.height,l,2,1);q=1;try{for(t=0;t<k.temp.length;t++)if(void 0!==k.temp[t]){q=0;break}}catch(m){}0===q?(k.temp=k.temp.map(function(a){return 1.8*
a+32}),AddLine(k.Timezone,k.timeframe,k.Source,c,0,k.temp,"#FF0000",3,"#0000FF")):(u=c.getContext("2d"),u.textAlign="center",u.font=c.width/35+"px Arial",u.fillText("No Temperature Data Avalible for this Site ("+a+")",c.width/2,c.height/2));q=1;try{for(t=0;t<k.precip.length;t++)if(void 0!==k.precip[t]){q=0;break}}catch(m){}0===q?AddLine(k.Timezone,k.timeframe,k.Source,e,0,k.precip,p):(u=e.getContext("2d"),u.font=e.width/35+"px Arial",u.textAlign="center",u.fillText("No Precipitation Data Avalible for this Site ("+
a+")",e.width/2,e.height/2));r.jumpToEnd()})}function ToFlow(a){var b=a.slice(0,-7);a=GetId(b+"canvas1");var d=GetId(b+"canvas2"),c=GetId(b+"canvas3"),e=GetId(b+"button1"),g=GetId(b+"button2");b=GetId(b+"button3");a.style.display="block";d.style.display="none";c.style.display="none";e.className="FlowButton";g.className="Unselected";b.className="Unselected"}
function ToTemp(a){var b=a.slice(0,-7);a=GetId(b+"canvas1");var d=GetId(b+"canvas2"),c=GetId(b+"canvas3"),e=GetId(b+"button1"),g=GetId(b+"button2");b=GetId(b+"button3");d.style.display="block";a.style.display="none";c.style.display="none";e.className="Unselected";g.className="TempButton";b.className="Unselected"}
function ToPrecip(a){var b=a.slice(0,-7);a=GetId(b+"canvas1");var d=GetId(b+"canvas2"),c=GetId(b+"canvas3"),e=GetId(b+"button1"),g=GetId(b+"button2");b=GetId(b+"button3");c.style.display="block";d.style.display="none";a.style.display="none";e.className="Unselected";g.className="Unselected";b.className="PrecipButton"}
function CreateGraphs(a,b,d){for(var c="",e=0;10>e;e++)c+=String(Math.random()*Math.pow(2,53));e=document.createElement("canvas");var g=document.createElement("canvas"),l=document.createElement("canvas");e.width=1200;g.width=1200;l.width=1200;e.height=800;g.height=800;l.height=800;LoadAndRender(b,d,e,g,l,"#00AAFF80","#0000FF80","#0066FF80");a.appendChild(e);g.style.display="none";l.style.display="none";a.appendChild(g);a.appendChild(l);e.id=c+"canvas1";g.id=c+"canvas2";l.id=c+"canvas3";a=document.createElement("button");
a.innerHTML="Flow Info";a.addEventListener("click",function(){ToFlow(this.id)});a.className="FlowButton";a.id=c+"button1";b=document.createElement("button");b.innerHTML="Tempreture";b.addEventListener("click",function(){ToTemp(this.id)});b.className="Unselected";b.id=c+"button2";d=document.createElement("button");d.innerHTML="Precipitation";d.addEventListener("click",function(){ToPrecip(this.id)});d.className="Unselected";d.id=c+"button3";c=document.createElement("div");c.appendChild(a);c.appendChild(d);
c.appendChild(b);c.className="canvasbuttons";return c};
//End of Graph Code





function AddElement(Name, Section, Difficulty, Quality, Length, USGS, Writeup) {
    var Rivers = GetId("Rivers")
    var Button = document.createElement("button")
    Button.className = "accordion"
    var Div = document.createElement("Div")
    Div.className = "panel"
    
    function AddSpan(Content) {
        var Span = document.createElement("Span")
        if (Content !== undefined) {
        Span.innerHTML = Content
        }
        else {
        Span.innerHTML = "Not Found"
        }
        Span.className = "riverspan"
        Button.appendChild(Span)
    }
    AddSpan(Name)
    AddSpan(Section)
    AddSpan(Difficulty)
    
if (Quality === "Rating" || Quality === "Below" || Quality === "Not Found") {
    AddSpan(Quality)
}
else {
var Text;
switch (parseInt(Quality)) {
    case 1:
        Text = "1Star";
        break;
    case 2:
        Text = "2Stars";
        break;
    case 3:
        Text = "3Stars";
        break;
    case 4:
        Text = "4Stars";
        break;
    case 5:
        Text = "5Stars";
        break;
    default:
        Text = "Error"
}
if (Text === "Error") {
   AddSpan("Unknown") 
}
else {
var span = document.createElement("span")
var img = document.createElement("img")
img.src = "https://rivers.run/resources/" + Text + ".png"
span.className = "riverspan"
span.appendChild(img)
Button.appendChild(span)
}    
}   
    
    
    AddSpan(Length)
    
    if (Writeup !== undefined) {
    Div.innerHTML = Writeup
    }
    else {
    Div.innerHTML = "This River has no Writeup."
    }
    
    if (USGS === "Flow Info") {
        AddSpan(USGS)
        Button.id = "LabelRow"
    }
    else if (String(USGS).length < 15 && USGS !== undefined && Number(USGS) !== 0) {
        var RiverGageSpan = document.createElement("span")
        RiverGageSpan.className = "riverspan"
        RiverGageSpan.innerHTML = "Loading From USGS..."
        Button.appendChild(RiverGageSpan)
        Div.appendChild(CreateGraphs(Div, USGS, RiverGageSpan))
    }

    
    Button.addEventListener("click", function() {
    this.classList.toggle("active");
    var panel = this.nextElementSibling;
    if (panel.style.maxHeight){
      panel.style.maxHeight = null;
      panel.style.padding = "0px"
      panel.hidden = "hidden"
    } else {
      panel.style.maxHeight = "100%"/*(panel.scrollHeight + 20) + "px"*/;
      panel.style.padding = "10px"
      panel.hidden = ""
    } 
    });
    
    if (Section === "Relevant") {
        Button.id = "lessrelevant"
    }
    Div.hidden = "hidden" 
    Rivers.appendChild(Button)
    Rivers.appendChild(Div)
}
 
function ClearList() {
var myNode = GetId("Rivers");
while (myNode.firstChild) {
    myNode.removeChild(myNode.firstChild);
}
AddElement("River Name", "Section", "Skill", "Rating", "Length", "Flow Info", "The River's Write-up will appear here.")
}
var Updates = 0;
//For locking out list. 
function CreateList(PassedList) {
Updates += 1
var LockCounter = Updates

ClearList()
var i = 0;
function AddMore(LockCounter) {
    var c = i+40//Amount that is added each time
    for (i;i<Math.min(c, PassedList.length);i++) {
    var Elem = PassedList[i]
    if (LockCounter === Updates) {
    AddElement(Elem.Name, Elem.Section, Elem.Difficulty, Elem.Quality, Elem.Length + " miles", Elem.USGS, Elem.Writeup)
    }
    else {
    break;  
    }
    }
    if (i < PassedList.length && LockCounter === Updates) {
        setTimeout(function() {requestAnimationFrame(function() {AddMore(LockCounter)})}, 50/*Try and give time for response to user input*/)
    }
}
if (PassedList.length > 0) {
AddMore(LockCounter)
}
    
}

//RiverArray is defined because of the other JavaScript file that was loaded.
CreateList(RiverArray)
//That will be the initial list with everything in it.
RotateHandler()
//Resize text initially


GetId("SearchBox").addEventListener("keydown", function() {setTimeout(SortListGen, 20)})
function SortListGen() {
    var Text = (GetId("SearchBox").value).toLowerCase().trim()
    var array = []
    var array1 = []
    var array2 = []
    var array3 = []
    var array4 = []
    for (var i = 0;i<RiverArray.length;i++) {
        var Obj = RiverArray[i]
        if (Obj.Tags.toLowerCase().indexOf(Text) !== -1) {
            if (Obj.Name.toLowerCase().indexOf(Text) !== -1) {
            array.splice(0,0,Obj)
            }
            else {
            array.push(Obj)
            }
        }
        else if (Obj.Name.toLowerCase().indexOf(Text) !== -1) {
            array1.push(Obj)
        }
        else if (Obj.Section.toLowerCase().indexOf(Text) !== -1) {
            array2.push(Obj)
        }
        else if (Obj.Difficulty.toLowerCase().indexOf(Text) !== -1) {
           //Exact match is highly relevant
            if (Obj.Difficulty.toLowerCase().indexOf(Text) === 0) {
            array3.push(Obj)
            }
            else if (Obj.Writeup.toLowerCase().indexOf(Text) === -1) {
                    array4.push(Obj)
            //Not that relevant. Add to less relevant list if it won't be added later.    
            }
        }   
        else if (Obj.Writeup.toLowerCase().indexOf(Text) !== -1) {
            array4.push(Obj)
        }   
    }
    for (var i = 0; i<array1.length;i++) {
        array.push(array1[i])
    }
    for (var i = 0; i<array2.length;i++) {
        array.push(array2[i])
    }
    for (var i = 0; i<array3.length;i++) {
        array.push(array3[i])
    }
    if (array4.length > 0) {
    array.push({Name:"Less", Section: "Relevant", Difficulty: "Results", Quality: "Below", Length: "", Writeup: "Results below contained the search query, but not in a way that was clearly related to the search query. The results shown below may not be what you are looking for."})
    }
    for (var i = 0; i<array4.length;i++) {
        array.push(array4[i])
    }
    CreateList(array)
    
    if (array.length === 0) {
AddElement("Not Found", "Not Found", "Not Found", "Not Found", "Not Found", "No Rivers were found for your search query.")
    }

}


//Query Handler
var ThisURL = window.location.href
ThisURL = decodeURIComponent(ThisURL)
var Query = ThisURL.slice(ThisURL.indexOf("?") + 1)
if (Query.indexOf("q=cache:") === 0) {
    Query = ""
    setTimeout(function(){alert("It appears that you have been redirected from Google's Webcache to this page. You are now at the actual site.")}, 1000)
    //In case they try to visit the cached version.
}
if (ThisURL !== Query) {
  document.getElementById("SearchBox").value = Query
  SortListGen()
}


