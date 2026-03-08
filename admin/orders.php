<!DOCTYPE html>
<html lang="en">
    <head>
        <?php include './headmeta.php' ?>
        <link href="/css/admin.css?v=1.0.201" rel="stylesheet">
    </head>
    <body>
        <?php 
            include '../config.php';
            include '../authent.php';
            include '../header.php'; 
            
            $loggedUser = getAuthenticatedUser($config);

            if(!$loggedUser || !$loggedUser['admin']){
                http_response_code(403);
                echo '<p>Forbidden: admin access required.</p>';
                exit;
            }
        ?>
        <div class="container" style="display:block;">
            <div class="pagePath">
                <a href="../admin_home.php">Admin home</a>
                <span class="chevron">&nbsp;>&nbsp;</span>
                <span>Orders</span>
            </div>
            <div id="order" class="order">
            <h2>Orders</h2>
            <div id="orderListDiv"></div>
            <div id="order" class="order">
        </div>
    </body>
    <script src="/js/slidepanel.js?v=1.0.201" ></script>
	<script src="/js/header.js?v=1.0.201" ></script>
    <script type="text/javascript" src="/js/admin/components.js?v=1.0.201"></script>
    <script type="text/javascript">
    function renderList() {
        const url = "/api/orders.php/orders";
        $.getJSON(url, function(data){
            const header = [
                {"name":"Order Num.","column":"id"},
                {"name":"Cust. Num.","column":"user_id"},
                {"name":"Amount","column":"amount"},
                {"name":"Status","column":"status"},
                {"name":"Creation date","column":"created_at"},
                {"name":"Transaction key","column":"transaction_key"},
                {"name":"Address id","column":"shipping_address_id"}
            ];
            createList("orderListDiv", data.data, header);

        }).done(function(){
                $(".rw").click(function(){
                console.log("Row");
                let id = $(this).find("td").eq(0).html();
                let url = "/admin/order.php?order_num="+id;
                location = url;
            });
        });
        
    }    
    renderList();

    
    </script>
    
</html>