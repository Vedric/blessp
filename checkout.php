<!doctype html>
<html lang="en">
    <head>
        <?php include './headmeta.php' ?>
    </head>
    <body>
        <?php
            include './config.php';
            include './authent.php';
            include './header.php';
            include './api/address_fctn.php';

            $loggedUser = getAuthenticatedUser($config);

            if($loggedUser){
        ?>

        <div class="checkout-steps" id="checkoutSteps">
            <div class="checkout-step active" data-step="1">
                <span class="checkout-step__number">1</span>
                <span class="checkout-step__label">Shipping</span>
            </div>
            <div class="checkout-step__line"></div>
            <div class="checkout-step" data-step="2">
                <span class="checkout-step__number">2</span>
                <span class="checkout-step__label">Payment</span>
            </div>
            <div class="checkout-step__line"></div>
            <div class="checkout-step" data-step="3">
                <span class="checkout-step__number">3</span>
                <span class="checkout-step__label">Confirmation</span>
            </div>
        </div>

        <div id="checkout" class="checkout">
            <div id="orderAndPayInfos" class="orderAndPayInfos">
                <h2>Shipping address</h2>
                <div style="margin-bottom: var(--space-4);"><a href="/profile/user_infos.php" style="text-decoration: underline; font-size: var(--font-size-sm);">Manage saved addresses</a></div>
                <?php
                    $addresses = getUserAddresses($CONFIG);
                    $addressesSize = count($addresses);

                    if($addressesSize == 0){
                ?>

                <form id="checkoutForm">
                    <div class="row">
                        <div class="form-group">
                            <label for="firstname">Firstname *</label>
                            <input class="required" type="text" id="firstname" name="firstname">
                        </div>
                        <div class="form-group">
                            <label for="lastname">Lastname *</label>
                            <input class="required" type="text" id="lastname" name="lastname">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="phone">Phone number *</label>
                        <input class="required" type="tel" id="phone" name="phone">
                    </div>

                    <div class="form-group">
                        <label for="address">Address *</label>
                        <input class="required" type="text" id="address" name="address">
                    </div>

                    <div class="row">
                        <div class="form-group">
                            <label for="city">City *</label>
                            <input class="required" type="text" id="city" name="city">
                        </div>
                        <div class="form-group">
                            <label for="postalcode">Postal code *</label>
                            <input class="required" type="text" id="postalcode" name="postalcode">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="country">Country *</label>
                        <select class="required" id="country" name="country">
                            <option value="">-- Choose --</option>
                            <option value="CA">Canada</option>
                            <option value="FR">France</option>
                            <option value="BG">Belgium</option>
                            <option value="SW">Switzerland</option>
                            <option value="OT">Other</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="note">Delivery notes (optional)</label>
                        <textarea id="note" name="note"></textarea>
                    </div>
                </form>

                <?php
                    } else {
                ?>
                <div id="userAddresses"></div>
                <?php
                    }
                ?>

                <h2 style="margin-top: var(--space-8);">Payment</h2>

                <div class="payment-method-tabs">
                    <button type="button" class="payment-tab active" data-method="stripe" onclick="selectPaymentMethod('stripe')">Credit Card</button>
                    <button type="button" class="payment-tab" data-method="paypal" onclick="selectPaymentMethod('paypal')">PayPal</button>
                </div>

                <div id="stripe-payment-container" class="payment-container">
                    <div id="stripe-element"></div>
                    <div id="stripe-errors" class="payment-error" role="alert"></div>
                    <button type="button" id="stripe-pay-btn" class="stripe-pay-btn" onclick="handleStripePayment()" disabled>Pay now</button>
                </div>

                <div id="paypal-payment-container" class="payment-container" style="display: none;">
                    <div id="paypal-button-container"></div>
                </div>

                <p id="result-message"></p>

                <?php
                    $paypalClientId = getenv('PAYPAL_CLIENT_ID') ?: '';
                    $stripePublishableKey = getenv('STRIPE_PUBLISHABLE_KEY') ?: '';
                ?>
                <script src="https://js.stripe.com/v3/"></script>
                <script>var stripePublishableKey = <?php echo json_encode($stripePublishableKey); ?>;</script>
                <script
                    src="https://www.paypal.com/sdk/js?client-id=<?php echo htmlspecialchars($paypalClientId); ?>&buyer-country=CA&currency=CAD&components=buttons&disable-funding=paylater"
                    data-sdk-integration-source="developer-studio"></script>
            </div>

            <div id="orderDetails" class="orderDetails">
                <h2>Order summary</h2>
                <div id="orderItems"></div>

                <div id="cartTotal" class="cartTotal">
                    <div id="totalBeforeTaxesDiv" class="totalBeforeTaxesDiv">
                        <div class="label"><span>Subtotal</span></div>
                        <div class="price"><span id="cartTotalBeforeTaxesSpan"></span></div>
                    </div>
                    <?php
                        $CONFIG = getConfig();
                        if($CONFIG['taxe_rate'] > 0){
                    ?>
                    <div id="taxesRates" class="taxesRates">
                        <div class="label"><span>Taxes (<?php echo $CONFIG['taxe_rate']; ?>%)</span></div>
                        <div class="price"><span id="taxesRateSpan"><?php echo $CONFIG['taxe_rate']; ?>%</span></div>
                    </div>
                    <div id="totalAfterTaxesDiv" class="totalAfterTaxesDiv">
                        <div class="label"><span><strong>Total</strong></span></div>
                        <div class="price"><strong><span id="cartTotalAfterTaxesSpan"></span></strong></div>
                    </div>
                    <?php
                        }
                    ?>
                </div>
            </div>
        </div>

        <?php
            } else {
        ?>
        <div class="container" style="text-align: center; padding: var(--space-12);">
            <h2>Sign in required</h2>
            <p>Please <a href="/signin.php" style="text-decoration: underline;">sign in</a> to continue your checkout.</p>
        </div>
        <?php
            }
        ?>

    </body>
    <script type="text/javascript" src="/js/checkout.js?v=1.2.0"></script>
    <script type="text/javascript" src="/js/stripe.js?v=1.0.0"></script>
    <script type="text/javascript" src="/js/paypal.js?v=1.1.0"></script>
    <script type="text/javascript" src="/js/slidepanel.js?v=1.1.0"></script>
    <script type="text/javascript" src="/js/header.js?v=1.1.0"></script>
    <script type="text/javascript">
        fillAddresses();
    </script>
</html>
