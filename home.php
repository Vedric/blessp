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
        <div id="container" class="container">
        	
            <div class="homeVid" id="homeVid">
				<video id="video" style="width:100%" autoplay loop>
                    <source src="./video/blessp_video.mp4" type="video/mp4"/> 
                </video>
            </div>
            <div id="onfront" style="display:flex; justify-content: beetwen;flex-wrap: wrap;">
               
            </div>
        </div>
        <?php include './footer.php'; ?>
    </body>
    <script type="text/javascript" src="/js/slidepanel.js?v=1.0.201" ></script>
    <script type="text/javascript" src="/js/header.js?v=1.0.201" ></script>
	<script type="text/javascript" src="/js/home.js?v=1.0.201"></script>
	<script type="text/javascript">
        var minH = window.innerHeight - 304;
    
        $(".container").css('min-height',minH);
    
        $("#video").on("mouseover", function(){
            $(this).attr("controls", true);
        });


        const screenWidth = window.screen.width;
		
        $('#msg').html("Screen width:" + screenWidth);
        $.get("/api/products.php/on_front", function(json){

			const products = json.products;

			$.each(products, function(index, product){
				console.log(product.id + " " + product.picture);

				const onfrontImg = document.createElement("img");
				if(screenWidth<400){
					
					onfrontImg.setAttribute("width",screenWidth/2);
					let imgWidth = onfrontImg.getAttribute("width");
					onfrontImg.setAttribute("height",imgWidth*1.5);
				}else{
					onfrontImg.setAttribute("height","400");
					onfrontImg.setAttribute("width","300");
				}
				
				onfrontImg.setAttribute("src", product.picture);
				onfrontImg.setAttribute("onclick", "javascript:product(" + product.id + ")");
				$("#onfront").append(onfrontImg);
			
			});
			
        });

        function product(id){
			location = "/product.php?id=" + id;
        }
    </script>
	
</html>

