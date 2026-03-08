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
            include './navshop.php';
        ?>
        <div id="container" class="container" style="padding: 0;">
            <div class="homeVid" id="homeVid">
                <video id="video" style="width:100%" autoplay loop muted playsinline>
                    <source src="./video/blessp_video.mp4" type="video/mp4"/>
                </video>
            </div>
            <div id="onfront" class="otherProducts" style="padding-top: var(--space-8); padding-bottom: var(--space-8);">
            </div>
        </div>
        <?php include './footer.php'; ?>
    </body>
    <script type="text/javascript" src="/js/slidepanel.js?v=1.1.0"></script>
    <script type="text/javascript" src="/js/header.js?v=1.1.0"></script>
    <script type="text/javascript" src="/js/home.js?v=1.1.0"></script>
    <script type="text/javascript">
        $("#video").on("mouseover", function(){
            $(this).attr("controls", true);
        });

        $.get("/api/products.php/on_front", function(json){
            var products = json.products;
            $.each(products, function(index, product){
                var onfrontDiv = document.createElement("div");
                onfrontDiv.className = "otherProductDiv";
                onfrontDiv.setAttribute("onclick", "location='/product.php?id=" + product.id + "'");

                var onfrontImg = document.createElement("img");
                onfrontImg.className = "otherProductImg";
                onfrontImg.setAttribute("src", product.picture);
                onfrontImg.setAttribute("alt", product.name);

                onfrontDiv.appendChild(onfrontImg);
                $("#onfront").append(onfrontDiv);
            });
        });
    </script>
</html>
