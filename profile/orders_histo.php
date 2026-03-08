<!DOCTYPE html>
<html lang="en">
    <head>
        <?php include './headmeta.php' ?>
        <link href="../css/admin.css" rel="stylesheet">
    </head>
    <style>
        div.itemName{
            padding: 10px;
            width:70%;
        }

        div.itemQty{
            padding:10px;
        }

        img.itemImg{
            border-radius: 5px;
        }
    </style>
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
            <div class="myorders">
                <h2>My orders</h2>
                <?php echo '<input type="hidden" id="userId" name="userId" value="'.$loggedUser['id'].'" >'; ?>
                <div id="orders"></div>
            </div>
        </div>
    </body>
</html>
<script src="../js/slidepanel.js?v=1.0.201" ></script>
<script src="../js/header.js?v=1.0.201" ></script>
<script>
    if($("#userId")!=null){
        const ordersUrl = "/api/orders.php/user_orders";
        $.getJSON(ordersUrl, function(response){
            $.each(response.data,function(index, order){
                console.log("Order: " + JSON.stringify(order));
                let orderDiv = createElt("div");
                orderDiv.classList.add("order_histo");
                let orderHead = createElt("div");
                orderHead.classList.add("orderHead");
                orderDiv.append(orderHead);
                $("#orders").append(orderDiv);
                let orderNumSpan = createElt("span");
                orderNumSpan.classList.add("order");
                orderNumSpan.classList.add("orderId");
                orderNumSpan.textContent="Order num. : " + order.orderInfos.id;
                let orderDateSpan = createElt("span");
                orderDateSpan.classList.add("order");
                orderDateSpan.classList.add("creationDate");
                orderDateSpan.textContent="Order placed: " + order.orderInfos.created_at.substr(0,10);
                let orderAmountSpan = createElt("span");
                orderAmountSpan.classList.add("order");
                orderAmountSpan.classList.add("orderAmount");
                orderAmountSpan.textContent="Total: " + parseFloat(order.orderInfos.amount).toLocaleString('ca-CA', { style: 'currency', currency: 'CAD' });
                orderHead.append(orderDateSpan);
                orderHead.append(orderNumSpan);
                
                
                orderHead.append(orderAmountSpan);
                let orderView = createElt("a");
                orderView.setAttribute("href","/order_recap.php?order_num=" + order.orderInfos.id);
                orderView.textContent = "Detail";
                orderHead.append(orderView);
                let orderItems = createElt("div");
                orderItems.classList.add("orderItems");
                orderDiv.append(orderItems);
                $.each(order.orderItems,function(index, item){
                    console.log("Item: " + item);
                    let itemDiv = createElt("div");
                    itemDiv.classList.add("itemDiv");
                    let itemImg = createElt("img");
                    itemImg.classList.add("itemImg");
                    itemImg.setAttribute("src", "../img/" + item.picture);
                    itemImg.setAttribute("height", "100");
                    itemDiv.append(itemImg);
                    orderItems.append(itemDiv);
                    let itemName = createElt("div");
                    itemName.classList.add("itemName");
                    itemName.textContent = item.articleName;
                    itemDiv.append(itemName);
                    let itemQty = createElt("div");
                    itemQty.classList.add("itemQty");
                    itemQty.textContent = "Quantity: " + item.qty;
                    itemDiv.append(itemQty);
                });
            });
        });
    }

    function createElt(name){
        return document.createElement(name);
    }
</script>