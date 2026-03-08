<!DOCTYPE html>
<html lang="en">
    <head>
        <?php include './headmeta.php' ?>
        <link href="../css/admin.css" rel="stylesheet">
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
            <div class="myprofile">
                <h2>My profile</h2>
                <div id="user_infos">
                	<div>
                		<span id="firstname"></span>
                		<span id="lastname"></span>
                	</div>
                	<div>
                		<span id="email"></span>
                	</div>
                </div>
                <button onclick="addAddress();">Add an address</button>
                <div id="user_addresses" class="userAddresses"></div>
            </div>
        </div>
    </body>
    <script src="../js/slidepanel.js?v=1.0.42" ></script>
	<script src="../js/header.js?v=1.0.42" ></script>
	<script src="../js/admin/components.js?v=1.0.42"></script>
	<script>
		async function getUserInfos(){
			const url = "/api.php/user_infos";
			const userInfos = await fetch(url);
			
			const userInfosJson = await userInfos.json();

			console.log("USER INFOS: " + JSON.stringify(userInfosJson));

			const user = userInfosJson.user;
			const firstname = user.firstname;
			const lastname = user.lastname;
			const email = user.email;

			$("#firstname").html(firstname);
			$("#lastname").html(lastname);
			$("#email").html(email);
			
		}

		async function getUserAddresses(){
			const url = "/api.php/user_addresses";
			const userAddresses = await fetch(url);

			const userAddressesJson = await userAddresses.json();

			const addresses = userAddressesJson.addresses;
			var addressesBlock = $("#user_addresses");

			addressesBlock.html("");
			
			$.each(addresses, function(index, address){
				console.log(JSON.stringify(address));
				addressesBlock.append(
						createAddressElt(
								address.id,
								address.firstname, 
								address.lastname, 
								address.phonenumber, 
								address.address, 
								address.postal_code, 
								address.city, 
								address.country,
								address.address_type, 
								address.default_address
						)
					);
			});
			
		}

		function createDiv(){
			return document.createElement("div");
		}

		function createSpan(){
			return document.createElement("span");
		}

		function createLineBlock(content){
			var lineBlockDiv = createDiv();
			var lineBlockSpan = createSpan();
			lineBlockDiv.append(lineBlockSpan);
			lineBlockSpan.textContent = content;

			

			return lineBlockDiv;
		}

		function createAddressElt(id, firstname, lastname, phoneNumber, address, postalCode, city, country, type, dflt){

			var addressElt = createDiv();
			
			var addressTypeDiv = createDiv();
			addressTypeDiv.classList.add("addressType");
			var addressTypeSpan = createSpan();
			addressTypeDiv.append(addressTypeSpan);
			var addressType = "";
			if(1==type){
				addressType = "Billing";
			}

			if(2==type){
				addressType = "Delivery";
			}

			var isDefault = "";
			if(dflt|"true"==dflt){
				isDefault = " Default";
			}

			addressTypeSpan.textContent = id + " " + isDefault;

			addressEditLink = document.createElement("a");
			addressEditLink.setAttribute("href", "/profile/edit_address.php?address_id=" + id);
			addressEditIco = document.createElement("img");
			addressEditIco.setAttribute("src", "/img/edit.svg");
			addressEditIco.setAttribute("width", "24");
			addressEditIco.setAttribute("height", "24");
			addressEditLink.append(addressEditIco);

			

			addressActionsDiv = document.createElement("div");
			addressActionsDiv.classList.add("addressActionsDiv");

			addressTypeDiv.append(addressActionsDiv);

			addressActionsDiv.append(addressEditLink);
			
			addressDelLink = document.createElement("a");
			addressDelLink.setAttribute("href", "javascript:void(0);");
			addressDelLink.setAttribute("onclick", "deleteAddress(" + id  + ")");
			//addressDelLink.setAttribute("href", "/api_adress.php/delete_address?addressId=" + id);
			addressDelIco = document.createElement("img");
			addressDelIco.setAttribute("src", "/img/delete.svg");
			addressDelIco.setAttribute("width", "24");
			addressDelIco.setAttribute("height", "24");
			addressDelLink.append(addressDelIco);

			addressActionsDiv.append(addressDelLink);
			
			
			addressElt.append(addressTypeDiv);

			var addressInfosDiv = createDiv();
			addressInfosDiv.classList.add("addressInfos");
			addressElt.classList.add("addressBlock");
			

			var nameDiv = createLineBlock(firstname + " " + lastname);
			addressInfosDiv.append(nameDiv);
						
			var phoneNumberDiv = createLineBlock(phoneNumber);
			addressInfosDiv.append(phoneNumberDiv);
			
			var addressDiv = createLineBlock(address);
			addressInfosDiv.append(addressDiv);

			var postalCodeDiv = createLineBlock(postalCode);
			addressInfosDiv.append(postalCodeDiv);
			
			var cityDiv = createLineBlock(city);
			addressInfosDiv.append(cityDiv);
			
			var countryDiv = createLineBlock(country);
			addressInfosDiv.append(countryDiv);

			addressElt.append(addressInfosDiv);
			
			return addressElt;
		}

		function addAddress(){
			location = "/profile/add_address.php";
		}

		async function deleteAddress(id){
// 			$.get("/api/address.php/delete?addressId=" + id, function(data, status){
// 				alert("Data: " + data + "\nStatus: " + status);
// 			});

			await fetch("/api/address.php/delete?addressId=" + id);
			backToUserInfos();
		}

		function backToUserInfos(){
			location = "/profile/user_infos.php";
		}

		getUserInfos();
		getUserAddresses();
	</script>
</html>