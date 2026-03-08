var homePic = document.getElementById("homePic");
const ratio = 2.5;
if(homePic==null){
    console.log("homePic not found");
}else{
    console.log("homePic has been found");
    var hpw = homePic.offsetWidth;
    var hph = homePic.offsetHeight;
    console.log("homePic size: Width=" + hpw +", Height=" + hph );
    resizeHomePic(homePic, ratio);
}

function resizeHomePic(elt, ratio){
    
    
    var setHeight= elt.offsetWidth/ratio;
    elt.style.height=setHeight + "px";
}

/*document.addEventListener('DOMContentLoaded', function(event) {
    var homePic =  this.document.getElementById("homePic");
    resizeHomePic(homePic, 1.6);
}, true);*/

window.addEventListener('resize', function(event) {
    var homePic =  this.document.getElementById("homePic");
    resizeHomePic(homePic, ratio);
}, true);

function windowSize(){
    let windowW = window.innerWidth;
    let windowH = window.innerHeight;
    return "Window size: H = " + windowH + " px, W = " + windowW + "px"
}

function dsiplaySize(){
    $("#wSize").html(windowSize());
}

dsiplaySize();
