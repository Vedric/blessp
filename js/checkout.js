function validCheckoutForm(){

    var validForm = true;
    $('.required').each(function(){
        
        
        var elt = $(this);
        var eltId = elt.attr('id');
        var tagName = elt.prop("tagName");
        var type = elt.attr('type');
        var val = elt.val();
        
        elt.removeClass("form_field_error");
        
        if(tagName.toLowerCase() ==='input'){
           
           if(type=="text"&&val==""){
             flagError(elt,"This field is required!");
             validForm=false;
           }else if(type=="tel"){
            if(val==null||val==""){
                flagError(elt,"This field is required!");
                validForm=false;
            }
           }else if(type=="email"){
            if(val==null||val==""){
                flagError(elt,"An email is required!");
                validForm=false;
            }
           }
        }else{
            
            if(tagName=='SELECT'){
                
                var selected = $("#"+eltId + " option:selected");
                var value = null;
                if(selected){
                    value = selected.val();
                    console.log("SELECTED: " + (value!=null)?value:"");
                    if(value==null||value==""){
                        flagError(elt,"You have to choose an option");
                        validForm=false;

                    }
                }
                
            }
        }
        
    });
    return validForm;
}

function flagError(elt, msg){
    elt.attr("placeholder", msg);
    elt.addClass("form_field_error");            
}

function loadCartItems(){
    $("#orderItems").html("");
      
    $.getJSON("/api.php/cart",function(json){
        var cartContent = JSON.parse(json);
        var cartTotal = 0;
        
        $.each(cartContent,function(index,item){
            var productKey = item.product;
            
            var productId = productKey.substring(0,5).replaceAll("0","");
            var productSize = productKey.substring(5,8).replaceAll("0","");
            var productColor = productKey.substring(8,11);
          
            var url = "/api.php/product?id=" + productId;
            
			$.getJSON(url,function(products){
                let product = products[0]; 
                let linePrice = item.quantity*product.price;
                cartTotal += linePrice;

				var cartItem ='<div class="cartItem">' + 
                    '<div class="itemImg">' + 
                        '<img style="width:100px;height:150px;" src="/img/' + product.picture + '">' +
                    '</div>' +
                    '<div class="itemInfos">'+ 
                        '<div class="itemInfosL1">'+ 
                            '<div class="itemName">'+
                                '<span>' + product.name + '</span>'+
                            '</div>'+
                            '<div class="itemPrice">'+
                                '<span>' + parseFloat(product.price).toLocaleString('ca-CA', { style: 'currency', currency: 'CAD' }) + '</span>'+
                            '</div>'+
                        '</div>' +
                        '<div class="itemInfosL2">'+ 
                            '<div class="itemSize">'+
                                '<span>SIZE: ' + productSize + '</span>'+
                            '</div>'+
                            '<div class="itemColor">'+
                                '<span>COLOR: ' + productColor + '</span>'+
                            '</div>'+
                            '<div class="itemQty">'+
                                '<span>QTY: <button class="qtyBtn" onclick="qtyDwn(\'' + productKey + '\');">-</button>' + item.quantity + '<button class="qtyBtn" onclick="qtyUp(\'' + productKey + '\');">+</button></span>'+
                            '</div>'+
                        '</div>' +
                        '<div class="itemInfosL">'+ 
                            '<div class="linePrice">'+
                                '<span>Subtotal: ' + linePrice.toLocaleString('ca-CA', { style: 'currency', currency: 'CAD' }) + '</span>'+
                            '</div>'+
                                
                            '</div>' +
                        '</div>' +
                    '</div>';
                $("#orderItems").append(cartItem);
                $("#cartTotalBeforeTaxesSpan").html(cartTotal.toLocaleString('ca-CA', { style: 'currency', currency: 'CAD' }));
                var cartTotalAfterTaxes = cartTotal*1.15;
                $("#cartTotalAfterTaxesSpan").html(cartTotalAfterTaxes.toLocaleString('ca-CA', { style: 'currency', currency: 'CAD' }));
            });
        });
          
    });
}

loadCartItems();

$(".required").each(function(){
    $(this).on('change', function(){
        validCheckoutForm();
    })
});

async function qtyDwn(pKey){
    const url = "/api.php/cart_qty_dwn?pkey="+pKey;
    await fetch(url);
    loadCartItems();
	setCartItemNumber();
}

async function qtyUp(pKey){
    const url = "/api.php/cart_qty_up?pkey="+pKey;
    await fetch(url);
    loadCartItems();
	setCartItemNumber();
}

async function fillDefaultAddress(){
	const url = "/api.php/user_default_address";
	const response = await fetch(url);
	const defaultAddressJson = await response.json();
	const defaultAddress = defaultAddressJson.address;
	$("#firstname").val(defaultAddress.firstname);
	$("#lastname").val(defaultAddress.lastname);
	$("#phone").val(defaultAddress.phonenumber);
	$("#address").val(defaultAddress.address);
	$("#postalcode").val(defaultAddress.postal_code);
	$("#city").val(defaultAddress.city);
	
	$(".countryOption").each(function(index){
		
		if($(this).text()==defaultAddress.country){
			$(this).prop("selected", true);
		}
	});
}

function createElt(eltName){
	
	return document.createElement(eltName);
}

async function fillAddresses(){
	const url = "/api/address.php/user_addresses";
	
	const response = await fetch(url);
	
	const addressesJson = await response.json();
	
	const addresses = addressesJson.addresses;
	
	const userAddresses = $('#userAddresses');
	
	$.each(addresses, function(index, address){
		
		console.log("ADDRESS: " + JSON.stringify(address));
		
		let addressDiv = createElt("div");
		addressDiv.classList.add("addressDiv");
		
	
		
		let addressRadio = createElt("input");
		addressRadio.classList.add("addressRadio");
		addressRadio.setAttribute("type", "radio");
		addressRadio.setAttribute("id", "addressRadio"+address.id);
		addressRadio.setAttribute("name", "addressRadio");
		addressRadio.value = address.id;
		
		let addressLbl = createElt("label");
		addressLbl.classList.add("addressRadioLbl");
		addressLbl.textContent = address.firstname+" "+address.lastname+", "+ address.address + "\n\r" + address.postal_code + " " + address.city + ", " + address.country;
		
		addressDiv.append(addressRadio);
		addressDiv.append(addressLbl);
		
		userAddresses.append(addressDiv);
		
		if(address.default_address||"true"==address.default_address){
			addressRadio.checked = true;
		}else{
			addressRadio.checked = false;
		}
		
	});
	
	
}

//fillDefaultAddress();

