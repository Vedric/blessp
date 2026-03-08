const openBtn = document.getElementById('openBtn');
    const closeBtn = document.getElementById('closeBtn');
    const panel = document.getElementById('sidePanel');
    const overlay = document.getElementById('overlay');

    function openPanel(){
      panel.classList.add('open');
      panel.setAttribute('aria-hidden','false');
      overlay.classList.add('visible');
      overlay.setAttribute('aria-hidden','false');
      openBtn.setAttribute('aria-expanded','true');
      // donner le focus au panneau pour accessibilité
      panel.focus?.();
      // empêcher le scroll de la page si besoin
      document.documentElement.style.overflow = 'hidden';
    }

    function closePanel(){
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden','true');
      overlay.classList.remove('visible');
      overlay.setAttribute('aria-hidden','true');
      openBtn.setAttribute('aria-expanded','false');
      document.documentElement.style.overflow = '';
    }

    function updateCartContentAndOpen(){
      $("#cartContent").html("");
      $("#cartContent").css('text-align', 'left');
      $.getJSON("/api.php/cart",function(json){
        var cartContent = JSON.parse(json);
        var cartTotal = 0;
        console.log("Nbre elt: " + cartContent.length);
        if(cartContent.length==0){
          $("#cartContent").html("<span>Your cart is empty for now. Continue your shopping to get the pieces you dream about!</span>");
          $("#checkout").prop("disabled", true);
          $("#checkout").css("background-color", "gray");
          $("#checkout").css("color", "silver");
        }else{
          $("#checkout").prop("disabled", false);
        }
        $.each(cartContent,function(index,item){
          var productKey = item.product;
          console.log("Product key : " + productKey);

          var productId = productKey.substring(0,5).replaceAll("0","");
          var productSize = productKey.substring(5,8).replaceAll("0","");
          var productColor = productKey.substring(8,11);
          
          var url = "/api.php/product?id=" + productId;
          console.log("Product get URL: " + url);
          $.getJSON(url,function(products){
            let product = products[0]; 
            let linePrice = item.quantity*product.price;
            cartTotal += linePrice;
            console.log("Cart Total: " +cartTotal);
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
                                  '<span>QTY: <button class="qtyBtn" onclick="qtyPnlDwn(\'' + productKey + '\');">-</button>' + item.quantity + '<button class="qtyBtn" onclick="qtyPnlUp(\'' + productKey + '\');">+</button></span>'+
                                  //'<span>QTY: ' + item.quantity + '</span>'+
                                '</div>'+
                              '</div>' +
                              '<div class="itemInfosL">'+ 
                                '<div class="linePrice">'+
                                  '<span>SUBTOTAL for the article: ' + linePrice.toLocaleString('ca-CA', { style: 'currency', currency: 'CAD' }) + '</span>'+
                                '</div>'+
                                
                              '</div>' +
                            '</div>' +
                          '</div>';
            $("#cartContent").append(cartItem);
            $("#totalBeforeTaxesSpan").html(cartTotal.toLocaleString('ca-CA', { style: 'currency', currency: 'CAD' }));
            var cartTotalAfterTaxes = cartTotal*1.15;
            $("#totalAfterTaxesSpan").html(cartTotalAfterTaxes.toLocaleString('ca-CA', { style: 'currency', currency: 'CAD' }));
            
          });
        });

        if(cartContent.length==0){
          cartTotal =0;
          var cartTotalAfterTaxes =0;
          $("#totalBeforeTaxesSpan").html(cartTotal.toLocaleString('ca-CA', { style: 'currency', currency: 'CAD' }));

          $("#totalAfterTaxesSpan").html(cartTotalAfterTaxes.toLocaleString('ca-CA', { style: 'currency', currency: 'CAD' }));
        }
          
      }).done(function(){
        if(!$('#sidePanel').hasClass('open'))
        openPanel();
      });
    }

    openBtn.addEventListener('click', function(event){
      updateCartContentAndOpen();
      
    });
    closeBtn.addEventListener('click', closePanel);

    // fermer si on clique sur l'overlay
    overlay.addEventListener('click', closePanel);

    // fermer avec Échap
    document.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape' || e.key === 'Esc'){
        if(panel.classList.contains('open')) closePanel();
      }
    });

    async function qtyPnlDwn(pKey){
      const url = "/api.php/cart_qty_dwn?pkey="+pKey;
      await fetch(url);
      updateCartContentAndOpen();
      if($("#orderItems").length){
        loadCartItems();
      }
	  setCartItemNumber();
    }

    async function qtyPnlUp(pKey){
      const url = "/api.php/cart_qty_up?pkey="+pKey;
      await fetch(url);
      updateCartContentAndOpen();
      if($("#orderItems").length){
        loadCartItems();
      }
	  setCartItemNumber();
    }
