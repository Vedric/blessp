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

            if(!$loggedUser || !$loggedUser['admin']){
                "You are not logged or are not admin.";
            }
        ?>



        <div class="container" style="display:block;">
            <div class="pagePath">
                <a href="../admin_home.php">Admin home</a>
                <span class="chevron">&nbsp;>&nbsp;</span>
                <a href="./orders.php">Orders</a>
                <span class="chevron">&nbsp;>&nbsp;</span>
                <span>Order</span>
            </div>
            <div id="order" class="order">
                <h2>Order <span id="orderNum"></span></h2>
                <div id="shippingAddress"> 
                    <div><span class="bold" id="customerName"></span></div>
                    <div><span id="address"></span></div>
                    <div><span id="postalCode"></span></div>
                    <div><span id="city"></span></div>
                    <div><span id="country"></span></div>
                    <div><span id="phone"></span></div>
                </div>

                <div class="orderStatus"><span>Order status: </span><span id="orderStatus"></span></div>

                <div class="orderItems" id="orderItems"></div>

                <div class="orderPrice" id="orderPrice">
                    <div class="orderPriceBT" id="orderPriceBT"><span>Total amount before taxes: </span><span class="amount" id="amountBt"></span></div>
                    
                    <?php 
                        $CONFIG = getConfig();
                        if($CONFIG['taxe_rate']>0){
                    
                    ?>
                    <div class="orderPriceTx" id="orderPriceTx"><span>Taxes (15%): </span><span class="amount" id="amountTx"></span></div>
                    <div class="orderPriceAt" id="orderPriceAt"><span>Total amount after taxes: </span><span class="amount" id="amountAt"></span></div>
                    <?php 
                        }
                    ?>
                </div>
            </div>
        </div>
    </body>
    <script type="text/javascript" src="/js/slidepanel.js?v=1.0.201" ></script>
<script type="text/javascript" src="/js/header.js?v=1.0.201" ></script>
<script type="text/javascript" src="/js/path.js?v=1.0.201"></script>
<script type="text/javascript" src="/js/admin/components.js?v=1.0.201"></script>
<script type="text/javascript">
    const orderNum = getParam('order_num');

    $("#orderNum").html(orderNum);

    const url = "/api/orders.php/order?order_num=" + orderNum;
    $.getJSON(url, function(data){
        console.log(data);

        const customer =data.customer;
        var firstname = customer.firstname;
        var lastname = customer.lastname;

        const shippingAddress = data.orderInfos.shipping_address;

        const shippingAddressJson = JSON.parse(shippingAddress);
        

        $("#customerName").html(shippingAddressJson.firstname + " " + shippingAddressJson.lastname);
        $("#address").html(shippingAddressJson.address);
        $("#postalCode").html(shippingAddressJson.postal_code);
        $("#city").html(shippingAddressJson.city);
        $("#country").html(shippingAddressJson.country);
        $("#phone").html(shippingAddressJson.phonenumber);

        orderItems = data.orderItems;

        $("#orderStatus").html(data.orderInfos.status);
    
        
        const header = [
                {"name":"Name", "column":"articleName"},
                {"name":"Code", "column":"articleCode"},
                {"name":"Size", "column":"articleSize"},
                {"name":"Color", "column":"articleColor"},
                {"name":"Qty", "column":"qty"},
                {"name":"Unit price", "column":"unitPrice"}
                
            ];
        createList("orderItems", orderItems, header);
        var amount = parseFloat(data.orderInfos.amount);
        var taxes = 0.15*amount;
        var amountAt = 1.15*amount; 
        $("#amountBt").html(amount.toLocaleString('ca-CA', { style: 'currency', currency: 'CAD' }));
        $("#amountTx").html(taxes.toLocaleString('ca-CA', { style: 'currency', currency: 'CAD' }));
        $("#amountAt").html(amountAt.toLocaleString('ca-CA', { style: 'currency', currency: 'CAD' }));

    });

</script>
</html>
