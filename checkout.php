<!doctype html>
<html lang="en">
    <head>
        <?php include './headmeta.php' ?>
    </head>
    <script type="text/javascript" src="./js/path.js"></script>

    <body>
        <?php 
            include './config.php';
            include './authent.php';
            include './header.php'; 
            include './api/address_fctn.php';

            $loggedUser = getAuthenticatedUser($config);
            
            if($loggedUser){
    
                
            
        ?>

        <div id="checkout" class="checkout">
            <div id="orderAndPayInfos" class="orderAndPayInfos">
                <h2>Address</h2>
                <div><a href="/profile/user_infos.php">Manage addresses</a></div>
                <?php 
                    $addresses = getUserAddresses($CONFIG);
                    $addressesSize = count($addresses);
                    
                    if($addressesSize==0){
                ?>
                
                <form id="checkoutForm">      


                <div class="row">
                    <div class="form-group">
                    <label for="firstname">Firstname *</label>
                    <input class="required" type="text" id="firstname" name="firstname" >
                    </div>

                    <div class="form-group">
                    <label for="lastname">Lastname *</label>
                    <input class="required" type="text" id="lastname" name="lastname" >
                    </div>
                </div>

                <div class="form-group">
                    <label for="tel">Phone number *</label>
                    <input class="required" type="tel" id="phone" name="phone" >
                </div>

                <div class="form-group">
                    <label for="address">Address *</label>
                    <input class="required" type="text" id="address" name="address" >
                </div>

                <div class="row">
                    <div class="form-group">
                    <label for="city">City *</label>
                    <input class="required" type="text" id="city" name="city" >
                    </div>

                    <div class="form-group">
                    <label for="postalcode">Postal code *</label>
                    <input class="required" type="text" id="postalcode" name="postalcode" >
                    </div>
                </div>

                <div class="form-group">
                    <label for="country">Country *</label>
                    <select class="required" id="country" name="country" >
                      <option class="countryOption" value="">-- Choose --</option>
                      <option class="countryOption" value="CA">Canada</option>
                      <option class="countryOption" value="FR">France</option>
                      <option class="countryOption" value="BG">Belgium</option>
                      <option class="countryOption" value="SW">Swiss</option>
                      <option class="countryOption" value="OT">Other</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="note">Additional informations for delivery </label>
                    <textarea id="note" name="note"></textarea>
                </div>
                
                
                </form>
                
                <?php 
                    
                    }else{
                ?>
                <div id="userAddresses"></div>
                
                <?php     
                    }
                    
                ?>

                <h2>Payment mode</h2>

                <div id="paypal-button-container"></div>
                <p id="result-message"></p>

       
                <!-- Initialize the JS-SDK -->
                <?php $paypalClientId = getenv('PAYPAL_CLIENT_ID') ?: ''; ?>
                <script
                  src="https://www.paypal.com/sdk/js?client-id=<?php echo htmlspecialchars($paypalClientId); ?>&buyer-country=CA&currency=CAD&components=buttons&disable-funding=paylater"
                  data-sdk-integration-source="developer-studio"></script>
                
				
            </div>
            

            <div id="orderDetails">
              <div id="orderItems"></div>

              <div id="cartTotal" class="cartTotal">
                <div id="totalBeforeTaxesDiv" class="totalBeforeTaxesDiv">
                  <div class="label"><span>Total price: </span></div>
                  <div class="price"><span id="cartTotalBeforeTaxesSpan"></span></div>
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
                  <div class="price"><span id="cartTotalAfterTaxesSpan"></span></div>
                </div>
                <?php 
                    }
                ?>
                
              </div>
            </div>

            
          </div>
    	
    	<?php 
            }else{
               
        ?>
            
    	   <p>You are not logged in. Please sign in to be able to continue your checkout.</p>
    	
    	<?php 
            }
    	?>
    
    </body>
    <script type="text/javascript" src="/js/checkout.js?v=1.0.201"></script>
    <script type="text/javascript" src="/js/paypal.js?v=1.0.201"></script>
    <script type="text/javascript" src="/js/slidepanel.js?v=1.0.201" ></script>
    <script type="text/javascript" src="/js/header.js?v=1.0.201" ></script>
	<script type="text/javascript" src="/js/home.js?v=1.0.201"></script>
	<script type="text/javascript">
		fillAddresses();
	</script>
</html>
