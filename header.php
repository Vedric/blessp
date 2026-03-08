    <?php
        
        $loggedUser = getAuthenticatedUser($config);
    ?>
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"
        integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo="
        crossorigin="anonymous"></script>
    <div class="header">
        <div id="left" class="hLeft"><span></span></div>
        <div id="brand" class="hBrand"><span></span></div>
        <div class="hSocial">
            <?php
                if($loggedUser && $loggedUser['admin']){
            ?>
                <div class="socialLink adm_lnk" id="adminBtn">&nbsp;</div>
            <?php } ?>
            <div class="socialLink cart_lnk" id="openBtn">
            	<div class="cart_item_number" id="cart_item_number" style="display:none;"></div>
            </div>
            <div class="socialLink fbk_lnk">&nbsp;</div>
            <div class="socialLink inst_lnk">&nbsp;</div>
            <div class="socialLink tiktok_lnk">&nbsp;</div>
        </div>
      </div>
      <div id="hSign" class="hSign">
        <?php
           
            
            if($loggedUser){
        
            echo '<div id="hSignUser" class="hSignUser collapsed">'.$loggedUser['firstname']." ".$loggedUser['lastname'].'</div>';
            echo '<div style="display.none;" id="userMenu" class="dropDown">';
            echo '<ul>';
            echo '<li><a href="/profile/orders_histo.php">My orders</a></li>';
            echo '<li><a href="/profile/user_infos.php">My profile</a></li>';
            echo '<li><a href="#" onclick="javascript:logout();">Log out</a></li>';
            echo '</ul>';
            echo '</div>';
        
            }else{
        ?>
          <a class="signLink" href="/signin.php">Sign in</a>
          <!--<a class="signLink" href="/signup.php">Sign up</a>-->
        <?php } ?>
      </div>
      
      <!-- Overlay pour bloquer l'interaction avec la page quand le panneau est ouvert -->
      <div id="overlay" class="overlay" tabindex="-1" aria-hidden="true"></div>
    
      <!-- Panneau fixé à droite -->
      <aside id="sidePanel" class="panel" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="panel-header">
          <strong>My cart</strong>
          <button class="close-btn" id="closeBtn" aria-label="Fermer le panneau">✕</button>
        </div>
    
        <div class="panel-content">
          <div id="cartContent">
            <span>Your cart is empty. Continue your shoppping!</span>
          </div>
        </div>
        <div id="cartTotal" class="cartTotal">
          <div id="totalBeforeTaxesDiv" class="totalBeforeTaxesDiv">
            <div class="label"><span>Total price: </span></div>
            <div class="price"><span id="totalBeforeTaxesSpan"></span></div>
          </div>
          
          <?php 
            $CONFIG = getConfig();
            if($CONFIG['taxe_rate']>0){
          
          ?>
          <div id="taxesRates" class="taxesRates">
            <div class="label"><span>Taxes rate: </span></div>
            <div class="price"><span id="taxesRateSpan">15%</span></div>
          </div>
          <div id="totalAfterTaxesDiv" class="totalAfterTaxesDiv">
            <div class="label"><span>Total price after taxes: </span></div>
            <div class="price"><span id="totalAfterTaxesSpan"></span></div>
          </div>
          <?php 
            }
          ?>
          <div id="checkoutDiv">
            <button id="checkout" class="checkout">Checkout</button>
          </div>
        </div>
      </aside>
      <script type="text/javascript">
      	$("#cart_item_number").hide();
        $("#checkout").on('click', function(){
          location = "/checkout.php";
        });

        

        function setCartItemNumber(){
            
            $.getJSON("/api.php/cart",function(json){
                var itemNumber = 0;
            	var cartContent = JSON.parse(json);
            	$.each(cartContent,function(index,item){
                	itemNumber = itemNumber + item.quantity;
            	});
    
            	if(itemNumber>0){
    				$("#cart_item_number").html(itemNumber);
    				$("#cart_item_number").show();
            	}else{
            		$("#cart_item_number").hide();
            	}
            });

        }    

        setCartItemNumber();
      </script>
      

