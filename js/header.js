$("#brand").on('click', function(){
    location="/home.php";
});

$("#adminBtn").on('click', function(){
    location="/admin_home.php";
});

$("#hSignUser").on('click', function(){
    var sig = $("#hSignUser");
    if(sig.hasClass("collapsed")){
        sig.removeClass("collapsed");
        sig.addClass("expanded");
    }else if(sig.hasClass("expanded")){
        sig.removeClass("expanded");
        sig.addClass("collapsed");
    }
    
    $("#userMenu").toggle();
});

async function logout(){
    const rtrn = await fetch("/api.php/logout");
    const rtrnMsg = await rtrn.json();
	if(!rtrnMsg.ok){
    	alert('Something goes wrong as you logged out!');
    }
    location="/home.php";
}