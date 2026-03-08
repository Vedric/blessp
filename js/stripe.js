/**
 * Stripe Elements integration for the checkout page.
 *
 * Mounts a Stripe PaymentElement, creates a PaymentIntent server-side,
 * and handles the confirmation flow. After a successful payment, it
 * calls the same savePayedOrder endpoint used by PayPal.
 */

var stripe = null;
var stripeElements = null;
var stripePaymentElement = null;
var stripeClientSecret = null;
var stripePaymentIntentId = null;
var stripeNonce = null;
var stripeReady = false;

// Generate a nonce for idempotency (one per page load)
function generateNonce() {
    var arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

// Initialize Stripe Elements when the page loads
function initStripe() {
    if (!stripePublishableKey) {
        document.getElementById('stripe-errors').textContent = 'Stripe is not configured.';
        return;
    }

    stripe = Stripe(stripePublishableKey);
    stripeNonce = generateNonce();
}

// Fetch the cart total in dollars
async function getCartTotal() {
    var cartResponse = await fetch('/api.php/cart');
    var cartJson = await cartResponse.json();
    var cartContent = JSON.parse(cartJson);

    var total = 0;
    for (var i = 0; i < cartContent.length; i++) {
        var item = cartContent[i];
        var productId = item.product.substring(0, 5).replace(/^0+/, '');
        var productResponse = await fetch('/api.php/product_min?id=' + encodeURIComponent(productId));
        var products = await productResponse.json();
        if (products.length > 0) {
            total += products[0].price * item.quantity;
        }
    }

    // Apply tax rate if configured
    var taxRateSpan = document.getElementById('taxesRateSpan');
    if (taxRateSpan) {
        var taxRate = parseFloat(taxRateSpan.textContent);
        if (!isNaN(taxRate) && taxRate > 0) {
            total = total * (1 + taxRate / 100);
        }
    }

    return Math.round(total * 100) / 100;
}

// Create a PaymentIntent and mount the PaymentElement
async function createPaymentIntentAndMount() {
    var errorsDiv = document.getElementById('stripe-errors');
    var payBtn = document.getElementById('stripe-pay-btn');
    errorsDiv.textContent = '';

    try {
        var total = await getCartTotal();
        if (total <= 0) {
            errorsDiv.textContent = 'Your cart is empty.';
            return;
        }

        // Fetch CSRF token
        var csrfResponse = await fetch('/api.php/csrf_token');
        var csrfData = await csrfResponse.json();
        var csrfToken = csrfData.csrf_token;

        // Create PaymentIntent on the server
        var response = await fetch('/api/stripe.php/create_payment_intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
                amount: total,
                currency: 'cad',
                nonce: stripeNonce
            })
        });

        var result = await response.json();

        if (result.error) {
            errorsDiv.textContent = result.message || 'Failed to initialize payment.';
            return;
        }

        stripeClientSecret = result.clientSecret;
        stripePaymentIntentId = result.paymentIntentId;

        // Mount the PaymentElement
        stripeElements = stripe.elements({
            clientSecret: stripeClientSecret,
            appearance: {
                theme: 'stripe',
                variables: {
                    colorPrimary: '#000000',
                    borderRadius: '4px'
                }
            }
        });

        stripePaymentElement = stripeElements.create('payment');
        stripePaymentElement.mount('#stripe-element');

        stripePaymentElement.on('ready', function() {
            stripeReady = true;
            payBtn.disabled = false;
        });

        stripePaymentElement.on('change', function(event) {
            if (event.error) {
                errorsDiv.textContent = event.error.message;
            } else {
                errorsDiv.textContent = '';
            }
        });

    } catch (err) {
        errorsDiv.textContent = 'Could not initialize payment. Please try again.';
        console.error('Stripe init error:', err);
    }
}

// Handle the pay button click
async function handleStripePayment() {
    if (!stripeReady || !stripe || !stripeElements) return;

    var payBtn = document.getElementById('stripe-pay-btn');
    var errorsDiv = document.getElementById('stripe-errors');
    errorsDiv.textContent = '';

    // Validate the shipping form first
    if (typeof validCheckoutForm === 'function' && !validCheckoutForm()) {
        errorsDiv.textContent = 'Please fill in all required shipping fields.';
        return;
    }

    payBtn.disabled = true;
    payBtn.textContent = 'Processing...';

    try {
        var confirmResult = await stripe.confirmPayment({
            elements: stripeElements,
            confirmParams: {
                return_url: window.location.origin + '/checkout.php'
            },
            redirect: 'if_required'
        });

        if (confirmResult.error) {
            errorsDiv.textContent = confirmResult.error.message;
            payBtn.disabled = false;
            payBtn.textContent = 'Pay now';
            return;
        }

        var paymentIntent = confirmResult.paymentIntent;

        if (paymentIntent.status === 'succeeded') {
            await saveStripeOrder(paymentIntent);
        } else if (paymentIntent.status === 'requires_action') {
            errorsDiv.textContent = 'Additional authentication required. Please follow the prompts.';
            payBtn.disabled = false;
            payBtn.textContent = 'Pay now';
        } else {
            errorsDiv.textContent = 'Payment was not completed. Please try again.';
            payBtn.disabled = false;
            payBtn.textContent = 'Pay now';
        }

    } catch (err) {
        errorsDiv.textContent = 'Payment failed. Please try again.';
        payBtn.disabled = false;
        payBtn.textContent = 'Pay now';
        console.error('Stripe payment error:', err);
    }
}

// Save the order after successful Stripe payment (same flow as PayPal)
async function saveStripeOrder(paymentIntent) {
    var resultMsg = document.getElementById('result-message');

    try {
        // Get cart contents
        var cartResponse = await fetch('/api.php/cart');
        var cartJson = await cartResponse.json();

        var orderAmount = (paymentIntent.amount / 100).toFixed(2);
        var transactionKey = paymentIntent.id;

        // Build the shipping address (same logic as paypal.js)
        var accountAddress = buildShippingAddress();

        // Fetch CSRF token for the order save
        var csrfResponse = await fetch('/api.php/csrf_token');
        var csrfData = await csrfResponse.json();

        var orderPayload = JSON.stringify({
            transaction_key: transactionKey,
            orderAmount: orderAmount,
            items: JSON.parse(cartJson),
            account_address: accountAddress
        });

        var persistResult = await fetch('/api/orders.php/save_payed_order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfData.csrf_token
            },
            body: orderPayload
        });

        var orderDetails = await persistResult.json();

        // Empty the cart
        await fetch('/api.php/empty_cart');

        // Generate PDF
        var pdfResponse = await fetch('/pdf/getPdf?id=' + orderDetails.order_id);
        var pdfData = await pdfResponse.json();
        var pdfPath = JSON.stringify(pdfData.pdfPath);

        // Send confirmation email
        var mailInfos = JSON.stringify({
            recipient: orderDetails.user.email,
            subject: 'Your order number ' + orderDetails.order_id + ' is confirmed',
            content: 'Hello ' + orderDetails.user.firstname + ' ' + orderDetails.user.lastname +
                ',<br/><br/>Thank you for your order!<br/><br/>' +
                'We are happy to confirm that your purchase has been successfully received.<br/><br/>' +
                'Your items will be prepared and shipped within 1 to 2 business days.<br/><br/>' +
                'You will receive a shipping confirmation email with tracking details as soon as your order is on its way.<br/><br/>' +
                'Thank you for shopping with us!<br/><br/>Best regards,<br/><br/>The Team',
            file_attached: pdfData.pdfPath
        });

        await fetch('/mailer/send_mail.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: mailInfos
        });

        resultMessage('Payment successful! Your order #' + orderDetails.order_id + ' has been confirmed.');

        // Update cart badge
        if (typeof setCartItemNumber === 'function') {
            setCartItemNumber();
        }

    } catch (err) {
        resultMessage('Payment was processed but there was an issue saving your order. Please contact support.');
        console.error('Order save error:', err);
    }
}

// Build shipping address object from form or saved address radio
function buildShippingAddress() {
    var selectedRadio = document.querySelector("input[name='addressRadio']:checked");

    if (selectedRadio) {
        return { id: selectedRadio.value };
    }

    return {
        firstname: document.getElementById('firstname') ? document.getElementById('firstname').value : '',
        lastname: document.getElementById('lastname') ? document.getElementById('lastname').value : '',
        address: document.getElementById('address') ? document.getElementById('address').value : '',
        city: document.getElementById('city') ? document.getElementById('city').value : '',
        postalcode: document.getElementById('postalcode') ? document.getElementById('postalcode').value : '',
        phone: document.getElementById('phone') ? document.getElementById('phone').value : '',
        country: document.getElementById('country') ? document.getElementById('country').options[document.getElementById('country').selectedIndex].text : '',
        note: document.getElementById('note') ? document.getElementById('note').value : '',
        address_type: 1
    };
}

// Payment method tab switching
function selectPaymentMethod(method) {
    var tabs = document.querySelectorAll('.payment-tab');
    tabs.forEach(function(tab) {
        tab.classList.toggle('active', tab.getAttribute('data-method') === method);
    });

    var stripeContainer = document.getElementById('stripe-payment-container');
    var paypalContainer = document.getElementById('paypal-payment-container');

    if (method === 'stripe') {
        stripeContainer.style.display = 'block';
        paypalContainer.style.display = 'none';
        // Initialize Stripe Elements if not already done
        if (!stripePaymentElement && stripe) {
            createPaymentIntentAndMount();
        }
    } else {
        stripeContainer.style.display = 'none';
        paypalContainer.style.display = 'block';
    }
}

// Initialize on page load
initStripe();
// Auto-mount Stripe Elements since it's the default selected tab
if (stripe) {
    createPaymentIntentAndMount();
}
