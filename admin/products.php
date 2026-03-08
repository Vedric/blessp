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
                http_response_code(403);
                echo '<p>Forbidden: admin access required.</p>';
                exit;
            }
        ?>
        <div class="container" style="display:block;">
            <div class="pagePath">
                <a href="/admin_home.php">Admin home</a>
                <span class="chevron">&nbsp;>&nbsp;</span>
                <span>Products</span>
            </div>
            <div id="products" class="products">
                <div class="productTitleStrip"><h2>Products</h2><button id="newProduct" class="btn">New product</button></div>
                <div id="productsListDiv" class="productsListDiv">
                </div>
            </div>
        </div>
    </body>

</html>
<script src="/js/slidepanel.js?v=1.0.201" ></script>
<script src="/js/header.js?v=1.0.201" ></script>
<script type="text/javascript" src="/js/admin/components.js?v=1.0.201"></script>
    <script type="text/javascript">
    function renderList() {
        const url = "/api/products.php/products";
        $.getJSON(url, function(data){
            const header = [
                {"name":"Article Num.", "column":"id"},
                {"name":"Article name", "column":"name"},
                {"name":"Price", "column":"price"},
                {"name":"Picture path", "column":"picture"},
                {"name":"Categories", "column":"category"},
                {"name":"Active", "column":"active"},
                {"name":"On front", "column":"onfront_order"}
            ];
            createList("productsListDiv", data.products, header);

        }).done(function(){
                $(".rw").click(function(){
                console.log("Row");
                let id = $(this).find("td").eq(0).html();
                let url = "/admin/product.php?id="+id;
                location = url;
            });
        });
        
    }    
    renderList();

    $("#newProduct").on('click',function(){
        location="/admin/product.php";
    });
    </script>
