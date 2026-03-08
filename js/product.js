var id = getParam("id");
$("#productId").val(id);
var url = "/api.php/product?id=" + id;

$.getJSON(url, function(json){
    var article = json[0];
    $("#imgContainer").append("<img id='productImg' class='productImg' src='/img/" + article.picture + "'>");
    $("#articleName").html(article.name);
    $("#articlePrice").html(article.price);
    $("#articleDetails").html(article.details);

    var secondaryPicturesStr = article.secondary_pictures;
    var secondaryPictures = secondaryPicturesStr.split(";");

    $("#minsContainer").append("<img class='productMinPic' src='" + article.picture + "'>");

    $.each(secondaryPictures, function(index, picture){
        if(picture.trim()){
            $("#minsContainer").append("<img class='productMinPic' src='" + picture.trim() + "'>");
        }
    });

    $(".productMinPic").on("click", function(){
        var picturePath = $(this).attr("src");
        $("#productImg").attr("src", picturePath);
    });

    var articleColors = JSON.parse(article.colors);
    var firstColor = articleColors[0];
    setColor(firstColor.name, firstColor.code);

    $.each(articleColors, function(index, clr){
        $("#articleColors").append('<div onclick="setColor(\'' + clr.name + '\', \'' + clr.code + '\');" class="articleColorItem" style="background-color:#' + clr.value + '" id="' + clr.name + '"></div>');
    });
});

$(".articleSizeItem").on("click", function(){
    var size = this.textContent;
    $('#articleSize').html(size);
    $('.articleSizeItem').css('background-color', '');
    $(this).css('background-color', 'var(--color-gray-200)');
});

$.get("/api/products.php/active_products", function(json){
    var products = json.data;
    $.each(products, function(index, product){
        if(product.id != id){
            var otherProductDiv = document.createElement("div");
            var otherProductImg = document.createElement("img");

            otherProductDiv.appendChild(otherProductImg);
            otherProductDiv.classList.add("otherProductDiv");

            otherProductImg.setAttribute("src", product.picture);
            otherProductImg.classList.add("otherProductImg");

            otherProductDiv.setAttribute("onclick", "goToProduct(" + product.id + ")");

            $('#otherProducts').append(otherProductDiv);
        }
    });
});

function goToProduct(id){
    location = "/product.php?id=" + id;
}

function setColor(color, code){
    $('#articleColor').html(color);
    $('#colorCode').val(code);
}

$("#qtyPlus").on("click", function(){
    var qty = parseInt($("#quantity").text());
    qty = qty + 1;
    $("#quantity").html(qty);
});

$("#qtyMinus").on("click", function(){
    var qty = parseInt($("#quantity").text());
    if(qty > 1){
        qty = qty - 1;
        $("#quantity").html(qty);
    }
});

function addToCart(){
    var qty = $("#quantity").text();
    var pid = $("#productId").val();
    var size = $("#articleSize").text();
    var color = $("#colorCode").val();
    var message = "";
    if(size == ""){
        message += "Please, select a size.\n\r";
    }
    if(color == ""){
        message += "Please, select a color.\n\r";
    }
    if(message.length > 0){
        alert(message);
        return;
    }

    var data = JSON.stringify({
        'qty': qty,
        'id': pid,
        'size': size,
        'clr': color
    });

    $.post("/api.php/cart_add", data).done(function(){
        updateCartContentAndOpen();
    });

    setCartItemNumber();
}

$("#addToCartBtn").on('click', function(){
    addToCart();
});
