function getParams(){
    var urlAddress = window.location.search;
    var map = new Map();
    if(urlAddress.includes("?")){
        var startPrmIdx = urlAddress.lastIndexOf("?");
        var paramsStr = urlAddress.substring(startPrmIdx + 1, urlAddress.length);
        var params = paramsStr.split("&");
        params.forEach(function(paramStr){
            var param = paramStr.split("=");
            map.set(param[0], param[1]);
        });
    }
    return map;
}

function getParam(prm){
    return getParams().get(prm);
}