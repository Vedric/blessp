const id = getParam("id");
    $("#productId").val(id);
    var url = "/api.php/product?id=" + id;
    
    $.getJSON(url,function(json){
        
        let article = json[0];
        $("#imgContainer").append("<img id='productImg' class='productImg' src='/img/" + article.picture + "'>");
        $("#articleName").html(article.name);
        $("#articlePrice").html(article.price);
        $("#articleDetails").html(article.details);
		
		
		let secondaryPicturesStr = article.secondary_pictures;
		
		const secondaryPictures = secondaryPicturesStr.split(";");
		
		$("#minsContainer").append("<img class='productMinPic' style='width:100px;height:150px;' src='" + article.picture + " '>");
		
		$.each(secondaryPictures, function(index, picture){
			console.log("Secondary pic: " + picture);
			$("#minsContainer").append("<img class='productMinPic' style='width:100px;height:150px;' src='" + picture + " '>");
		});
		
		$(".productMinPic").on("click", function(){
			let picturePath = $(this).attr("src");
			$("#productImg").attr("src", picturePath);
		});

        const articleColors = JSON.parse(article.colors);
		
		let firstColor = articleColors[0];
		
		setColor(firstColor.name, firstColor.code);

        $.each(articleColors, function(index, clr){
            
            $("#articleColors").append('<div onclick="setColor(\'' + clr.name + '\', \'' + clr.code + '\');" class="articleColorItem" style="background-color:#' + clr.value + '" id="' + clr.name + '"></div>');
        });
    });
	
	

    $(".articleSizeItem").on("click", function(item){
        
        var size = this.textContent;
        $('#articleSize').html(size);
        //$(".articleSizeItem").style.backgroundColor = 'white';
        $('.articleSizeItem').css('background-color', 'white');
        this.style.backgroundColor = 'silver';
        
    });
	
	$.get("/api/products.php/active_products", function(json){
		const products = json.data;
		const screenWidth = window.screen.width;
		$.each(products, function(index, product){
			if(product.id!=id){
				
				let otherProductDiv = createElt("div");
				let otherProductImg = createElt("img");
				
				
				otherProductDiv.append(otherProductImg);
				otherProductDiv.classList.add("otherProductDiv");
							
				otherProductImg.setAttribute("src", product.picture);
				otherProductImg.classList.add("otherProductImg");
				
				if(screenWidth<400){
					let divWidth = screenWidth / 2;
					let divHeight = divWidth *1.5;
					
					otherProductDiv.style.width = divWidth + "px";
					otherProductDiv.style.height = divHeight + "px";
					
					otherProductImg.style.width = divWidth + "px";
					otherProductImg.style.height = divHeight + "px";
					
				}			
				otherProductDiv.setAttribute("onclick", "goToProduct(" + product.id+")");
							
							
				$('#otherProducts').append(otherProductDiv);	
				
			}
			
			
			
		});
		
		
	});
	
	function goToProduct(id){
		location = "/product.php?id=" + id;
	}
	
	function createElt(name){
		return document.createElement(name);
	}
	
	function getColors(){
		const colorsStr = article
	}
    
    function setColor(color, code){
        
        $('#articleColor').html(color);
        $('#colorCode').val(code);
    }

    $("#qtyPlus").on("click", function(event){
        var qtyStr = $("#quantity").text();
        
        var qty = parseInt(qtyStr);
        qty = qty + 1;
        $("#quantity").html(qty);
    });

    $("#qtyMinus").on("click", function(event){
        var qtyStr = $("#quantity").text();
        
        var qty = parseInt(qtyStr);
        if(qty>1){
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
        if(size==""){
            message+="Please, select a size.\n\r";
        }
        if(color==""){
            message+="Please, select a color.\n\r";
        }
        if(message.length>0){
            alert(message);
            return;
        }

        var data = JSON.stringify({
            'qty': qty,
            'id': pid,
            'size': size,
            'clr': color
        });

        var posted = $.post( "/api.php/cart_add", data).done(function(){
            updateCartContentAndOpen();
        });
		
		setCartItemNumber();

    }

    $("#addToCartBtn").on('click',function(event){
        addToCart();
        
    });