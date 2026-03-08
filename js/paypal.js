const paypalButtons = window.paypal.Buttons({
   style: {
        shape: "rect",
        layout: "vertical",
        color: "gold",
        label: "paypal",
    },
   message: {
        amount: 100,
    },
   async createOrder() {
        

        try {

            var isFormValid = validCheckoutForm();

            console.log("FORM VALID : " + isFormValid);

            if(!isFormValid){
                throw new Error("Billing informations form is not valid");
            }

            const cartContent = await fetch("/api.php/cart");
            const cartJson = await cartContent.json();
            
            console.log("CART CONTENT:" + cartJson);

            const response = await fetch("/paypal/api/orders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                // use the "body" param to optionally pass additional order information
                // like product ids and quantities
                body: cartJson
            });

            const orderData = await response.json();

            if (orderData.id) {
                return orderData.id;
            }
            const errorDetail = orderData?.details?.[0];
            const errorMessage = errorDetail
                ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
                : JSON.stringify(orderData);

            throw new Error(errorMessage);
        } catch (error) {
            console.error(error);
            // resultMessage(`Could not initiate PayPal Checkout...<br><br>${error}`);
        }
    },
   async onApprove(data, actions) {
        try {
            const response = await fetch(
                `/paypal/api/orders/${data.orderID}/capture`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            const orderData = await response.json();
            // Three cases to handle:
            //   (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
            //   (2) Other non-recoverable errors -> Show a failure message
            //   (3) Successful transaction -> Show confirmation or thank you message

            const errorDetail = orderData?.details?.[0];

            if (errorDetail?.issue === "INSTRUMENT_DECLINED") {
                // (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
                // recoverable state, per
                // https://developer.paypal.com/docs/checkout/standard/customize/handle-funding-failures/
                return actions.restart();
            } else if (errorDetail) {
                // (2) Other non-recoverable errors -> Show a failure message
                throw new Error(
                    `${errorDetail.description} (${orderData.debug_id})`
                );
            } else if (!orderData.purchase_units) {
                throw new Error(JSON.stringify(orderData));
            } else {
                // (3) Successful transaction -> Show confirmation or thank you message
                // Or go to another URL:  actions.redirect('thank_you.html');
                const transaction =
                    orderData?.purchase_units?.[0]?.payments?.captures?.[0] ||
                    orderData?.purchase_units?.[0]?.payments
                        ?.authorizations?.[0];
                resultMessage(
                    `Transaction ${transaction.status}: ${transaction.id}<br><br>See console for all available details`
                );
                console.log("Capture result", orderData, JSON.stringify(orderData, null, 2));
                //ICI ON VA ENREGISTRER LA COMMANDE

                const cartContent = await fetch("/api.php/cart");
                const cartJson = await cartContent.json();

                const orderAmount = orderData.purchase_units[0].payments.captures[0].amount.value;
                const transactionKey = orderData.id;

				
                const note = $("#note").val();
				
				var selectedAddressId = $("input[name='addressRadio']:checked").val();
				
				var accountAddress = "";
				
				if(selectedAddressId!=null){
					const response = await fetch("/api/address.php/address?address_id="+selectedAddressId);
					
					
					const selectedAddressJson = await response.json();
					
					const selectedAddress = selectedAddressJson.address;
					
					console.log("SELECTED ADDRESS: " + JSON.stringify(selectedAddress));
										
					accountAddress = JSON.stringify({
						id: selectedAddressId,
						firstname: selectedAddress.firstname,
						lastname: selectedAddress.lastname,
						address: selectedAddress.address,
						city: selectedAddress.city,
						postalcode: selectedAddress.postal_code,
						phone: selectedAddress.phonenumber,
						country: selectedAddress.country,
						address_type: 1
					});

					
				}else{
					const firstname = $("#firstname").val();
					const lastname  = $("#lastname").val();
					const address = $("#address").val();
					const city = $("#city").val();
					const postalCode = $("#postalcode").val();
					const phoneNumber = $("#phone").val();
					const country = $("#country option:selected").text();
					
					accountAddress = JSON.stringify({
						firstname: firstname,
						lastname: lastname,
						address: address,
						city: city,
						postalcode: postalCode,
						phone: phoneNumber,
						country: country,
						note: note,
						address_type: 1
					});

				}

                
                var orderPayload = JSON.stringify({
                    transaction_key: transactionKey,
                    orderAmount: orderAmount,
                    items: JSON.parse(cartJson),
                    account_address: JSON.parse(accountAddress)
                });
                
                const persistOrderRslt = await fetch(
                    `/api/orders.php/save_payed_order`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: orderPayload, //cartJson
                    }
                );

                const orderDetails = await persistOrderRslt.json();
                console.log("AFTER SAVE: " + JSON.stringify(orderDetails));

                const emptyCart = await fetch(
                    `/api.php/empty_cart`

                );
				
				const orderPdfResponse = await fetch("/pdf/getPdf?id=" + orderDetails.order_id);
				const orderPdfPathJson = await orderPdfResponse.json();
				const orderPdfPath = await JSON.stringify(orderPdfPathJson.pdfPath);
				console.log("PDF path : " + orderPdfPath);

                var mailInfos = '{"recipient":"' + orderDetails.user.email + '", "subject":"Your order number ' + orderDetails.order_id + ' is confirmed", "content":"Hello ' + orderDetails.user.firstname + ' ' + orderDetails.user.lastname + ',<br/><br/>Thank you for your order!<br/><br/>We are happy to confirm that your purchase has been successfully received.<br/><br/>Your items will be prepared and shipped within 1 to 2 business days.<br/><br/>You will receive a shipping confirmation email with tracking details as soon as your order is on its way.<br/><br/>Thank you for shopping with us!<br/><br/>Best regards,<br/><br/>The Team", "file_attached":' +orderPdfPath +'}';

                console.log(mailInfos);
                await fetch(`/mailer/send_mail.php`,{
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: mailInfos
                });
					
				
                //location = './order_recap.php?order_num='+ orderDetails.order_id;

            }
        } catch (error) {
            console.error(error);
            resultMessage(
                `Sorry, your transaction could not be processed...<br><br>${error}`
            );
        }
    },

   
});
paypalButtons.render("#paypal-button-container");


// Example function to show a result to the user. Your site's UI library can be used instead.
function resultMessage(message) {
    const container = document.querySelector("#result-message");
    container.innerHTML = message;
}
