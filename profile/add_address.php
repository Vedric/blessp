<!DOCTYPE html>
<html lang="en">
    <head>
        <?php include './headmeta.php' ?>
        <link href="/css/admin.css" rel="stylesheet">
    </head>
    <body>
        <?php
            include '../config.php';
            include '../authent.php';
            include '../header.php'; 
            
            $loggedUser = getAuthenticatedUser($config);

            if(!$loggedUser){
                die("You are not logged in. Please sign in");
            }
        ?>
        <div class="container">
        
        <form id="editAddressForm">
				<div>
					<input type="checkbox" id="default" name="default" >
                    <label for="default">Default address</label>
				</div>
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

            </form>
            
            <div><button id="saveAddressBtn">Save</button></div>
        </div>
    </body>
    <script type="text/javascript" src="/js/path.js?v=1.0.201"></script>
    <script src="/js/slidepanel.js?v=1.0.201" ></script>
	<script src="/js/header.js?v=1.0.201" ></script>
    <script>

    async function saveAddress(){

    	let defaultVal  = $("#default").val();
		let dflt        = $("#default").prop("checked");
		let firstname   = $("#firstname").val();
		let lastname    = $("#lastname").val();
		let phonenumber = $("#phone").val();
		let address     = $("#address").val();
		let postalcode  = $("#postalcode").val();
		let city        = $("#city").val();
		let country     = $("#country option:selected").text();

		let dfltStr = "FALSE";

		if(dflt||dflt=="true"||dflt=="TRUE"){
			dfltStr = "TRUE";
		}

		const addressData = {
				
				"firstname": firstname,
				"lastname": lastname,
				"phonenumber": phonenumber,
				"address": address,
				"postalcode": postalcode,
				"city": city,
				"country": country,
				"default": dfltStr};

		const addressPayload = JSON.stringify(addressData);
		console.log("Address Data: " + addressPayload);

		const saveResult = await fetch(
                '/api/address.php/add',
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: addressPayload
                }
            );
        console.log(saveResult);
    }

    $("#saveAddressBtn").on('click', function(){
		
		let defaultVal  = $("#default").prop("checked");

		console.log("Default: " + defaultVal);
		
		if(defaultVal=="on"){
			console.log("Equal on : " + true);
		}else{
			console.log("Equal on : " + false);
		}

		saveAddress();

		location = "/profile/user_infos.php";
		
    });

    </script>
</html>